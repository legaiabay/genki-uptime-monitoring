package handlers

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

type PublicHandler struct {
	db *sqlx.DB
}

func NewPublicHandler(db *sqlx.DB) *PublicHandler {
	return &PublicHandler{db: db}
}

type publicMonitor struct {
	ID               int64      `db:"id" json:"id"`
	Name             string     `db:"name" json:"name"`
	URL              string     `db:"url" json:"url"`
	Type             string     `db:"type" json:"type"`
	Status           string     `db:"status" json:"status"`
	UptimePercentage float64    `db:"uptime_percentage" json:"uptime_percentage"`
	PublicSlug       *string    `db:"public_slug" json:"public_slug"`
	LastCheckedAt    *time.Time `db:"last_checked_at" json:"last_checked_at"`
}

type publicLog struct {
	Status       string    `db:"status" json:"status"`
	ResponseTime int       `db:"response_time" json:"response_time"`
	CheckedAt    time.Time `db:"checked_at" json:"checked_at"`
}

// GetStatus returns all public monitors — no auth required.
// Used by the public status page.
func (h *PublicHandler) GetStatus(c echo.Context) error {
	ctx := c.Request().Context()

	var monitors []publicMonitor
	err := h.db.SelectContext(ctx, &monitors,
		`SELECT id, name, url, type, status, uptime_percentage, public_slug, last_checked_at
		 FROM monitors WHERE public = true ORDER BY name`)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch status")
	}
	if monitors == nil {
		monitors = []publicMonitor{}
	}

	// For each monitor get last 90 check results for the mini-bar
	type monitorWithLogs struct {
		publicMonitor
		Logs []publicLog `json:"logs"`
	}

	result := make([]monitorWithLogs, 0, len(monitors))
	for _, m := range monitors {
		var logs []publicLog
		_ = h.db.SelectContext(ctx, &logs,
			`SELECT status, response_time, checked_at
			 FROM monitor_logs WHERE monitor_id = $1
			 ORDER BY checked_at DESC LIMIT 90`, m.ID)
		if logs == nil {
			logs = []publicLog{}
		}
		result = append(result, monitorWithLogs{publicMonitor: m, Logs: logs})
	}

	// Overall uptime across all public monitors
	var overallUptime float64
	_ = h.db.GetContext(ctx, &overallUptime,
		`SELECT COALESCE(AVG(uptime_percentage), 100)
		 FROM monitors WHERE public = true`)

	return c.JSON(http.StatusOK, echo.Map{
		"monitors":       result,
		"overall_uptime": overallUptime,
	})
}

// GetMonitorStatus returns a single public monitor by slug — no auth required.
func (h *PublicHandler) GetMonitorStatus(c echo.Context) error {
	slug := c.Param("slug")
	if slug == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "slug is required")
	}

	var monitor publicMonitor
	err := h.db.QueryRowxContext(c.Request().Context(),
		`SELECT id, name, url, type, status, uptime_percentage, public_slug, last_checked_at
		 FROM monitors WHERE public_slug = $1 AND public = true`, slug).StructScan(&monitor)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "monitor not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch monitor")
	}

	var logs []publicLog
	_ = h.db.SelectContext(c.Request().Context(), &logs,
		`SELECT status, response_time, checked_at
		 FROM monitor_logs WHERE monitor_id = $1
		 ORDER BY checked_at DESC LIMIT 90`, monitor.ID)
	if logs == nil {
		logs = []publicLog{}
	}

	return c.JSON(http.StatusOK, echo.Map{
		"monitor": monitor,
		"logs":    logs,
	})
}
