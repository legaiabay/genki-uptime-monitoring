package handlers

import (
	"archive/zip"
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/lib/pq"
)

// BackupHandler handles export and import of monitoring data.
type BackupHandler struct {
	db *sqlx.DB
}

func NewBackupHandler(db *sqlx.DB) *BackupHandler {
	return &BackupHandler{db: db}
}

// ── Payload structs ───────────────────────────────────────────────────────────

const backupSchemaVersion = "1"

// BackupPayload is the top-level JSON structure for export/import.
type BackupPayload struct {
	Version    string          `json:"version"`
	ExportedAt time.Time       `json:"exported_at"`
	Monitors   []backupMonitor `json:"monitors"`
}

type backupMonitor struct {
	// Config fields (restored on import)
	Name           string   `json:"name"`
	URL            string   `json:"url"`
	Type           string   `json:"type"`
	Interval       int      `json:"interval"`
	Timeout        int      `json:"timeout"`
	Active         bool     `json:"active"`
	ExpectedStatus int      `json:"expected_status"`
	MaxRetries     int      `json:"max_retries"`
	Public         bool     `json:"public"`
	PublicSlug     *string  `json:"public_slug"`
	GroupName      string   `json:"group_name"`
	Labels         []string `json:"labels"`
	Favorite       bool     `json:"favorite"`

	// Historical data
	Logs      []backupLog      `json:"logs"`
	Incidents []backupIncident `json:"incidents"`
}

type backupLog struct {
	Status       string    `json:"status"`
	ResponseTime int       `json:"response_time"`
	StatusCode   *int      `json:"status_code"`
	Message      string    `json:"message"`
	CheckedAt    time.Time `json:"checked_at"`
}

type backupIncident struct {
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Status      string     `json:"status"`
	StartedAt   time.Time  `json:"started_at"`
	ResolvedAt  *time.Time `json:"resolved_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// ── DB scan structs ───────────────────────────────────────────────────────────

type exportMonitorRow struct {
	ID             int64          `db:"id"`
	Name           string         `db:"name"`
	URL            string         `db:"url"`
	Type           string         `db:"type"`
	Interval       int            `db:"interval"`
	Timeout        int            `db:"timeout"`
	Active         bool           `db:"active"`
	ExpectedStatus int            `db:"expected_status"`
	MaxRetries     int            `db:"max_retries"`
	Public         bool           `db:"public"`
	PublicSlug     *string        `db:"public_slug"`
	GroupName      string         `db:"group_name"`
	Labels         pq.StringArray `db:"labels"`
	Favorite       bool           `db:"favorite"`
}

type exportLogRow struct {
	MonitorID    int64     `db:"monitor_id"`
	Status       string    `db:"status"`
	ResponseTime int       `db:"response_time"`
	StatusCode   *int      `db:"status_code"`
	Message      string    `db:"message"`
	CheckedAt    time.Time `db:"checked_at"`
}

type exportIncidentRow struct {
	MonitorID   *int64     `db:"monitor_id"`
	Title       string     `db:"title"`
	Description string     `db:"description"`
	Status      string     `db:"status"`
	StartedAt   time.Time  `db:"started_at"`
	ResolvedAt  *time.Time `db:"resolved_at"`
	CreatedAt   time.Time  `db:"created_at"`
	UpdatedAt   time.Time  `db:"updated_at"`
}

// ── Export ────────────────────────────────────────────────────────────────────

// Export streams a JSON backup file containing all monitors, their logs
// (up to retention_days), and their incidents.
//
//	GET /api/v1/backup/export
func (h *BackupHandler) Export(c echo.Context) error {
	ctx := c.Request().Context()

	// Read retention_days from app_settings (default 90)
	retentionDays := 90
	var retVal string
	if err := h.db.GetContext(ctx, &retVal,
		`SELECT value FROM app_settings WHERE key = 'retention_days'`); err == nil {
		if v, err := strconv.Atoi(retVal); err == nil && v > 0 {
			retentionDays = v
		}
	}
	cutoff := time.Now().UTC().AddDate(0, 0, -retentionDays)

	// Fetch all monitors
	var monitors []exportMonitorRow
	if err := h.db.SelectContext(ctx, &monitors,
		`SELECT id, name, url, type, interval, timeout, active,
		        expected_status, max_retries, public, public_slug,
		        group_name, labels, favorite
		 FROM monitors
		 ORDER BY favorite DESC, group_name ASC, created_at ASC`); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch monitors: "+err.Error())
	}

	// Build monitor ID → index map
	idxByID := make(map[int64]int, len(monitors))
	result := make([]backupMonitor, len(monitors))
	for i, m := range monitors {
		idxByID[m.ID] = i
		labels := []string(m.Labels)
		if labels == nil {
			labels = []string{}
		}
		result[i] = backupMonitor{
			Name:           m.Name,
			URL:            m.URL,
			Type:           m.Type,
			Interval:       m.Interval,
			Timeout:        m.Timeout,
			Active:         m.Active,
			ExpectedStatus: m.ExpectedStatus,
			MaxRetries:     m.MaxRetries,
			Public:         m.Public,
			PublicSlug:     m.PublicSlug,
			GroupName:      m.GroupName,
			Labels:         labels,
			Favorite:       m.Favorite,
			Logs:           []backupLog{},
			Incidents:      []backupIncident{},
		}
	}

	// Fetch logs within retention window
	var logs []exportLogRow
	if len(monitors) > 0 {
		if err := h.db.SelectContext(ctx, &logs,
			`SELECT monitor_id, status, response_time, status_code, message, checked_at
			 FROM monitor_logs
			 WHERE checked_at >= $1
			 ORDER BY monitor_id, checked_at ASC`, cutoff); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch logs: "+err.Error())
		}
	}
	for _, l := range logs {
		idx, ok := idxByID[l.MonitorID]
		if !ok {
			continue
		}
		result[idx].Logs = append(result[idx].Logs, backupLog{
			Status:       l.Status,
			ResponseTime: l.ResponseTime,
			StatusCode:   l.StatusCode,
			Message:      l.Message,
			CheckedAt:    l.CheckedAt,
		})
	}

	// Fetch incidents for known monitors
	var incidents []exportIncidentRow
	if len(monitors) > 0 {
		// Build IN clause for monitor IDs
		ids := make([]string, len(monitors))
		for i, m := range monitors {
			ids[i] = strconv.FormatInt(m.ID, 10)
		}
		q := fmt.Sprintf(
			`SELECT monitor_id, title, description, status, started_at,
			        resolved_at, created_at, updated_at
			 FROM incidents
			 WHERE monitor_id IN (%s)
			 ORDER BY monitor_id, started_at ASC`,
			strings.Join(ids, ","),
		)
		if err := h.db.SelectContext(ctx, &incidents, q); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch incidents: "+err.Error())
		}
	}
	for _, inc := range incidents {
		if inc.MonitorID == nil {
			continue
		}
		idx, ok := idxByID[*inc.MonitorID]
		if !ok {
			continue
		}
		result[idx].Incidents = append(result[idx].Incidents, backupIncident{
			Title:       inc.Title,
			Description: inc.Description,
			Status:      inc.Status,
			StartedAt:   inc.StartedAt,
			ResolvedAt:  inc.ResolvedAt,
			CreatedAt:   inc.CreatedAt,
			UpdatedAt:   inc.UpdatedAt,
		})
	}

	payload := BackupPayload{
		Version:    backupSchemaVersion,
		ExportedAt: time.Now().UTC(),
		Monitors:   result,
	}

	// Encode payload to JSON bytes first
	jsonData, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to encode backup: "+err.Error())
	}

	// Wrap inside a ZIP archive
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	jsonFilename := fmt.Sprintf("genki-backup-%s.json", time.Now().UTC().Format("2006-01-02"))
	fw, err := zw.Create(jsonFilename)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create zip entry: "+err.Error())
	}
	if _, err = fw.Write(jsonData); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to write zip entry: "+err.Error())
	}
	if err = zw.Close(); err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to finalise zip: "+err.Error())
	}

	zipFilename := fmt.Sprintf("genki-backup-%s.zip", time.Now().UTC().Format("2006-01-02"))
	c.Response().Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, zipFilename))
	c.Response().Header().Set("Content-Type", "application/zip")
	return c.Blob(http.StatusOK, "application/zip", buf.Bytes())
}

// ── Import ────────────────────────────────────────────────────────────────────

type importResult struct {
	MonitorsCreated  int `json:"monitors_created"`
	MonitorsSkipped  int `json:"monitors_skipped"`
	LogsImported     int `json:"logs_imported"`
	IncidentsCreated int `json:"incidents_created"`
}

// Import restores monitors, logs, and incidents from a backup file.
// Strategy: merge — skip monitors whose name+url already exists; insert new ones.
// Accepts both .zip (containing a single JSON entry) and raw .json bodies.
//
//	POST /api/v1/backup/import
func (h *BackupHandler) Import(c echo.Context) error {
	ctx := c.Request().Context()

	// Read the full body so we can sniff the format
	body, readErr := io.ReadAll(c.Request().Body)
	if readErr != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "failed to read request body: "+readErr.Error())
	}

	jsonBytes, err := extractJSONFromBody(body)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, err.Error())
	}

	var payload BackupPayload
	if err = json.Unmarshal(jsonBytes, &payload); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid JSON: "+err.Error())
	}
	if payload.Version != backupSchemaVersion {
		return echo.NewHTTPError(http.StatusBadRequest,
			fmt.Sprintf("unsupported backup version: %s (expected %s)", payload.Version, backupSchemaVersion))
	}
	if len(payload.Monitors) == 0 {
		return c.JSON(http.StatusOK, echo.Map{"data": importResult{}})
	}

	// Run everything in a single transaction so a failure rolls back cleanly.
	tx, err := h.db.BeginTxx(ctx, nil)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to begin transaction: "+err.Error())
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback()
		}
	}()

	res := importResult{}

	for _, m := range payload.Monitors {
		// Merge: check if a monitor with the same name+url already exists
		var existingID int64
		scanErr := tx.QueryRowContext(ctx,
			`SELECT id FROM monitors WHERE name = $1 AND url = $2 LIMIT 1`,
			strings.TrimSpace(m.Name), strings.TrimSpace(m.URL),
		).Scan(&existingID)

		var monitorID int64
		if scanErr == nil {
			// Already exists — skip config, but still import logs/incidents
			monitorID = existingID
			res.MonitorsSkipped++
		} else if scanErr == sql.ErrNoRows {
			// Create new monitor
			labels := m.Labels
			if labels == nil {
				labels = []string{}
			}
			insErr := tx.QueryRowContext(ctx,
				`INSERT INTO monitors
				 (name, url, type, interval, timeout, active, expected_status, max_retries,
				  public, public_slug, group_name, labels, favorite)
				 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
				 RETURNING id`,
				strings.TrimSpace(m.Name),
				strings.TrimSpace(m.URL),
				m.Type,
				m.Interval,
				m.Timeout,
				m.Active,
				m.ExpectedStatus,
				m.MaxRetries,
				m.Public,
				m.PublicSlug,
				m.GroupName,
				pq.Array(labels),
				m.Favorite,
			).Scan(&monitorID)
			if insErr != nil {
				err = insErr
				return echo.NewHTTPError(http.StatusInternalServerError,
					"failed to insert monitor '"+m.Name+"': "+insErr.Error())
			}
			res.MonitorsCreated++
		} else {
			err = scanErr
			return echo.NewHTTPError(http.StatusInternalServerError, "db error: "+scanErr.Error())
		}

		// Import logs (skip duplicates by checked_at)
		for _, l := range m.Logs {
			var exists bool
			_ = tx.QueryRowContext(ctx,
				`SELECT EXISTS(SELECT 1 FROM monitor_logs WHERE monitor_id=$1 AND checked_at=$2)`,
				monitorID, l.CheckedAt,
			).Scan(&exists)
			if exists {
				continue
			}
			if _, insErr := tx.ExecContext(ctx,
				`INSERT INTO monitor_logs (monitor_id, status, response_time, status_code, message, checked_at)
				 VALUES ($1,$2,$3,$4,$5,$6)`,
				monitorID, l.Status, l.ResponseTime, l.StatusCode, l.Message, l.CheckedAt,
			); insErr != nil {
				err = insErr
				return echo.NewHTTPError(http.StatusInternalServerError,
					"failed to insert log for monitor '"+m.Name+"': "+insErr.Error())
			}
			res.LogsImported++
		}

		// Import incidents (skip duplicates by title+started_at)
		for _, inc := range m.Incidents {
			var exists bool
			_ = tx.QueryRowContext(ctx,
				`SELECT EXISTS(SELECT 1 FROM incidents WHERE monitor_id=$1 AND title=$2 AND started_at=$3)`,
				monitorID, inc.Title, inc.StartedAt,
			).Scan(&exists)
			if exists {
				continue
			}
			if _, insErr := tx.ExecContext(ctx,
				`INSERT INTO incidents
				 (monitor_id, title, description, status, started_at, resolved_at, created_at, updated_at)
				 VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
				monitorID, inc.Title, inc.Description, inc.Status,
				inc.StartedAt, inc.ResolvedAt, inc.CreatedAt, inc.UpdatedAt,
			); insErr != nil {
				err = insErr
				return echo.NewHTTPError(http.StatusInternalServerError,
					"failed to insert incident '"+inc.Title+"': "+insErr.Error())
			}
			res.IncidentsCreated++
		}
	}

	if commitErr := tx.Commit(); commitErr != nil {
		err = commitErr
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to commit: "+commitErr.Error())
	}

	return c.JSON(http.StatusOK, echo.Map{"data": res})
}

// extractJSONFromBody returns raw JSON bytes from either a ZIP archive (reads
// the first .json entry) or a plain JSON body.
func extractJSONFromBody(body []byte) ([]byte, error) {
	// Detect ZIP by magic bytes: PK\x03\x04
	if len(body) >= 4 && body[0] == 0x50 && body[1] == 0x4B && body[2] == 0x03 && body[3] == 0x04 {
		zr, err := zip.NewReader(bytes.NewReader(body), int64(len(body)))
		if err != nil {
			return nil, fmt.Errorf("failed to open zip: %w", err)
		}
		for _, f := range zr.File {
			if strings.HasSuffix(f.Name, ".json") {
				rc, err := f.Open()
				if err != nil {
					return nil, fmt.Errorf("failed to open zip entry %s: %w", f.Name, err)
				}
				defer rc.Close()
				data, err := io.ReadAll(rc)
				if err != nil {
					return nil, fmt.Errorf("failed to read zip entry %s: %w", f.Name, err)
				}
				return data, nil
			}
		}
		return nil, fmt.Errorf("no .json file found inside the zip archive")
	}
	// Assume raw JSON
	return body, nil
}
