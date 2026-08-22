package scheduler

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/abdulkhobirfauzi/genki-uptime-monitoring/internal/checker"
	"github.com/abdulkhobirfauzi/genki-uptime-monitoring/internal/models"
	"github.com/abdulkhobirfauzi/genki-uptime-monitoring/internal/notifier"
	"github.com/jmoiron/sqlx"
	"github.com/robfig/cron/v3"
)

type Scheduler struct {
	cron       *cron.Cron
	db         *sqlx.DB
	checker    *checker.HTTPChecker
	dispatcher *notifier.Dispatcher
}

func New(db *sqlx.DB) *Scheduler {
	return &Scheduler{
		cron:       cron.New(cron.WithSeconds()),
		db:         db,
		checker:    checker.NewHTTPChecker(),
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
		        created_at, updated_at
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
	timeout := time.Duration(mon.Timeout) * time.Second
	checkCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	result, err := s.checker.Check(checkCtx, mon)
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

	// Update monitor status + uptime + last_checked_at
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
		s.resolveIncident(ctx, mon.ID)
		s.dispatcher.Notify(ctx, notifier.Payload{
			MonitorName:  mon.Name,
			MonitorURL:   string(mon.URL),
			Status:       string(result.Status),
			ResponseTime: result.ResponseTime,
			CheckedAt:    result.CheckedAt,
			Event:        notifier.EventRecovery,
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
