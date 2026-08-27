package scheduler

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/legaiabay/genki-uptime-monitoring/internal/checker"
	"github.com/legaiabay/genki-uptime-monitoring/internal/models"
	"github.com/legaiabay/genki-uptime-monitoring/internal/notifier"
	"github.com/jmoiron/sqlx"
	"github.com/robfig/cron/v3"
)

type Scheduler struct {
	cron       *cron.Cron
	db         *sqlx.DB
	checkers   map[models.MonitorType]checker.Checker
	dispatcher *notifier.Dispatcher
}

func New(db *sqlx.DB) *Scheduler {
	return &Scheduler{
		cron: cron.New(cron.WithSeconds()),
		db:   db,
		checkers: map[models.MonitorType]checker.Checker{
			models.MonitorTypeHTTP: checker.NewHTTPChecker(),
			models.MonitorTypeTCP:  checker.NewTCPChecker(),
			models.MonitorTypePing: checker.NewPingChecker(),
			models.MonitorTypeDNS:  checker.NewDNSChecker(),
			models.MonitorTypeSSL:  checker.NewSSLChecker(),
			models.MonitorTypeGRPC: checker.NewGRPCChecker(),
			models.MonitorTypeUDP:  checker.NewUDPChecker(),
		},
		dispatcher: notifier.NewDispatcher(db),
	}
}

func (s *Scheduler) Start() {
	s.cron.AddFunc("@every 10s", func() {
		s.runChecks()
	})
	s.cron.Start()
	log.Println("[scheduler] started — checking monitors every 10s")
}

func (s *Scheduler) Stop() {
	ctx := s.cron.Stop()
	<-ctx.Done()
	log.Println("[scheduler] stopped")
}

func (s *Scheduler) runChecks() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var monitors []models.Monitor
	err := s.db.SelectContext(ctx, &monitors,
		`SELECT id, name, url, type, interval, timeout, status, active,
		        expected_status, max_retries, uptime_percentage, last_checked_at,
		        created_at, updated_at,
		        dns_record_type, dns_expected_ip, ssl_warning_days,
		        grpc_service, grpc_method
		 FROM monitors
		 WHERE active = true
		   AND (last_checked_at IS NULL
		        OR EXTRACT(EPOCH FROM (NOW() - last_checked_at)) >= interval)`)
	if err != nil {
		log.Printf("[scheduler] error fetching monitors: %v", err)
		return
	}

	if len(monitors) == 0 {
		return
	}

	log.Printf("[scheduler] checking %d monitors", len(monitors))

	const maxWorkers = 10
	sem := make(chan struct{}, maxWorkers)
	var wg sync.WaitGroup

	for i := range monitors {
		wg.Add(1)
		sem <- struct{}{}
		go func(mon models.Monitor) {
			defer wg.Done()
			defer func() { <-sem }()
			s.checkMonitor(ctx, &mon)
		}(monitors[i])
	}

	wg.Wait()
}

func (s *Scheduler) checkMonitor(ctx context.Context, mon *models.Monitor) {
	// Claim this monitor immediately so concurrent scheduler ticks cannot
	// pick it up again before this check completes. Without this, a slow
	// check (e.g. a TCP timeout) that outlives the 10-second cron interval
	// causes the same monitor to be fetched a second time while the first
	// check is still in flight — both goroutines then read the old status
	// and both fire a "down" notification.
	_, err := s.db.ExecContext(ctx,
		`UPDATE monitors SET last_checked_at = NOW() WHERE id = $1`, mon.ID)
	if err != nil {
		log.Printf("[scheduler] error claiming monitor %s: %v", mon.Name, err)
		// Continue anyway — the check should still proceed.
	}

	chk, ok := s.checkers[mon.Type]
	if !ok {
		// Fallback to HTTP for unknown types
		chk = s.checkers[models.MonitorTypeHTTP]
		log.Printf("[scheduler] unknown monitor type %q for %s, falling back to HTTP", mon.Type, mon.Name)
	}

	timeout := time.Duration(mon.Timeout) * time.Second
	checkCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	result, err := chk.Check(checkCtx, mon)
	if err != nil {
		log.Printf("[scheduler] check error for %s: %v", mon.Name, err)
		return
	}

	// Insert log
	_, err = s.db.ExecContext(ctx,
		`INSERT INTO monitor_logs (monitor_id, status, response_time, status_code, message, checked_at)
		 VALUES ($1, $2, $3, $4, $5, $6)`,
		result.MonitorID, result.Status, result.ResponseTime, result.StatusCode, result.Message, result.CheckedAt)
	if err != nil {
		log.Printf("[scheduler] error inserting log for %s: %v", mon.Name, err)
	}

	// Update monitor status + uptime + last_checked_at (+ ssl_expiry_date when present)
	if result.SSLExpiryDate != nil {
		_, err = s.db.ExecContext(ctx,
			`UPDATE monitors SET
			   status = $1,
			   last_checked_at = $2,
			   ssl_expiry_date = $3,
			   uptime_percentage = (
			     SELECT COALESCE(
			       ROUND(COUNT(*) FILTER (WHERE status = 'up')::numeric / NULLIF(COUNT(*), 0) * 100, 2),
			       0
			     )
			     FROM monitor_logs WHERE monitor_id = $4 AND checked_at > NOW() - INTERVAL '24 hours'
			   ),
			   updated_at = NOW()
			 WHERE id = $4`,
			result.Status, result.CheckedAt, result.SSLExpiryDate, result.MonitorID)
	} else {
		_, err = s.db.ExecContext(ctx,
			`UPDATE monitors SET
			   status = $1,
			   last_checked_at = $2,
			   uptime_percentage = (
			     SELECT COALESCE(
			       ROUND(COUNT(*) FILTER (WHERE status = 'up')::numeric / NULLIF(COUNT(*), 0) * 100, 2),
			       0
			     )
			     FROM monitor_logs WHERE monitor_id = $3 AND checked_at > NOW() - INTERVAL '24 hours'
			   ),
			   updated_at = NOW()
			 WHERE id = $3`,
			result.Status, result.CheckedAt, result.MonitorID)
	}
	if err != nil {
		log.Printf("[scheduler] error updating monitor %s: %v", mon.Name, err)
	}

	// ── Status transition handling ────────────────────────────────────────────

	wentDown := result.Status == models.MonitorStatusDown && mon.Status != models.MonitorStatusDown
	wentRecovery := result.Status == models.MonitorStatusUp && mon.Status == models.MonitorStatusDown

	if wentDown {
		s.createIncident(ctx, mon, result)
		s.dispatcher.Notify(ctx, notifier.Payload{
			MonitorName:  mon.Name,
			MonitorURL:   string(mon.URL),
			Status:       string(result.Status),
			ResponseTime: result.ResponseTime,
			ErrorMessage: result.Message,
			CheckedAt:    result.CheckedAt,
			Event:        notifier.EventDown,
		})
	}

	if wentRecovery {
		var downtimeDuration string
		var startedAt time.Time
		err := s.db.QueryRowContext(ctx,
			`SELECT started_at FROM incidents
			 WHERE monitor_id = $1 AND status != 'resolved'
			 ORDER BY started_at DESC LIMIT 1`, mon.ID).Scan(&startedAt)
		if err == nil {
			downtimeDuration = formatDuration(result.CheckedAt.Sub(startedAt))
		} else if err != sql.ErrNoRows {
			log.Printf("[scheduler] error querying incident start for %s: %v", mon.Name, err)
		}

		s.resolveIncident(ctx, mon.ID)
		s.dispatcher.Notify(ctx, notifier.Payload{
			MonitorName:      mon.Name,
			MonitorURL:       string(mon.URL),
			Status:           string(result.Status),
			ResponseTime:     result.ResponseTime,
			CheckedAt:        result.CheckedAt,
			Event:            notifier.EventRecovery,
			DowntimeDuration: downtimeDuration,
		})
	}
}

func (s *Scheduler) createIncident(ctx context.Context, mon *models.Monitor, result *checker.Result) {
	title := mon.Name + " - Down"
	if result.Message != "" {
		title = mon.Name + " - " + result.Message
	}
	_, err := s.db.ExecContext(ctx,
		`INSERT INTO incidents (monitor_id, title, description, status, started_at)
		 VALUES ($1, $2, $3, 'investigating', NOW())`,
		mon.ID, title, "Automatically created by health check")
	if err != nil {
		log.Printf("[scheduler] error creating incident for %s: %v", mon.Name, err)
	}
}

func (s *Scheduler) resolveIncident(ctx context.Context, monitorID int64) {
	_, err := s.db.ExecContext(ctx,
		`UPDATE incidents
		 SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
		 WHERE monitor_id = $1 AND status != 'resolved'`,
		monitorID)
	if err != nil {
		log.Printf("[scheduler] error resolving incident for monitor %d: %v", monitorID, err)
	}
}

// formatDuration formats a duration into a human-readable string like "1h 23m 45s".
func formatDuration(d time.Duration) string {
	d = d.Round(time.Second)
	h := int(d.Hours())
	m := int(d.Minutes()) % 60
	s := int(d.Seconds()) % 60
	if h > 0 {
		return fmt.Sprintf("%dh %dm %ds", h, m, s)
	}
	if m > 0 {
		return fmt.Sprintf("%dm %ds", m, s)
	}
	return fmt.Sprintf("%ds", s)
}
