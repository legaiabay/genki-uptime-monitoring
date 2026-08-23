package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/lib/pq"
)

type PublicHandler struct {
	db *sqlx.DB
}

func NewPublicHandler(db *sqlx.DB) *PublicHandler {
	return &PublicHandler{db: db}
}

type publicMonitor struct {
	ID               int64          `db:"id" json:"id"`
	Name             string         `db:"name" json:"name"`
	URL              string         `db:"url" json:"url"`
	Type             string         `db:"type" json:"type"`
	Status           string         `db:"status" json:"status"`
	UptimePercentage float64        `db:"uptime_percentage" json:"uptime_percentage"`
	PublicSlug       *string        `db:"public_slug" json:"public_slug"`
	GroupName        string         `db:"group_name" json:"group_name"`
	Labels           pq.StringArray `db:"labels" json:"labels"`
	LastCheckedAt    *time.Time     `db:"last_checked_at" json:"last_checked_at"`
}

type publicLog struct {
	Status       string    `db:"status" json:"status"`
	ResponseTime int       `db:"response_time" json:"response_time"`
	CheckedAt    time.Time `db:"checked_at" json:"checked_at"`
}

type monitorWithLogs struct {
	publicMonitor
	Logs []publicLog `json:"logs"`
}

const publicMonitorCols = `id, name, url, type, status, uptime_percentage, public_slug, group_name, labels, last_checked_at`

// fetchLogsForMonitors attaches the last 90 logs to each monitor.
func (h *PublicHandler) fetchLogsForMonitors(c echo.Context, monitors []publicMonitor) []monitorWithLogs {
	ctx := c.Request().Context()
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
	return result
}

// GetStatus returns all public monitors — no auth required.
func (h *PublicHandler) GetStatus(c echo.Context) error {
	ctx := c.Request().Context()

	var monitors []publicMonitor
	err := h.db.SelectContext(ctx, &monitors,
		`SELECT `+publicMonitorCols+`
		 FROM monitors WHERE public = true
		 ORDER BY group_name ASC, name ASC`)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch status")
	}
	if monitors == nil {
		monitors = []publicMonitor{}
	}

	result := h.fetchLogsForMonitors(c, monitors)

	var overallUptime float64
	_ = h.db.GetContext(ctx, &overallUptime,
		`SELECT COALESCE(AVG(uptime_percentage), 100) FROM monitors WHERE public = true`)

	siteName := "Genki"
	_ = h.db.GetContext(ctx, &siteName,
		`SELECT value FROM app_settings WHERE key = 'site_name'`)

	// Collect distinct groups that have public monitors
	var groups []string
	_ = h.db.SelectContext(ctx, &groups,
		`SELECT DISTINCT group_name FROM monitors
		 WHERE public = true AND group_name <> ''
		 ORDER BY group_name ASC`)
	if groups == nil {
		groups = []string{}
	}

	return c.JSON(http.StatusOK, echo.Map{
		"monitors":       result,
		"overall_uptime": overallUptime,
		"site_name":      siteName,
		"groups":         groups,
	})
}

// GetGroupStatus returns public monitors belonging to a specific group — no auth required.
func (h *PublicHandler) GetGroupStatus(c echo.Context) error {
	ctx := c.Request().Context()

	// groupSlug is the URL-safe version of the group name (lowercase, spaces→hyphens)
	groupSlug := c.Param("groupSlug")
	if groupSlug == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "group slug is required")
	}

	// Match against slug-ified group_name
	var monitors []publicMonitor
	err := h.db.SelectContext(ctx, &monitors,
		`SELECT `+publicMonitorCols+`
		 FROM monitors
		 WHERE public = true
		   AND LOWER(REPLACE(group_name, ' ', '-')) = $1
		 ORDER BY name ASC`, groupSlug)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch group status")
	}
	if len(monitors) == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "group not found or has no public monitors")
	}

	result := h.fetchLogsForMonitors(c, monitors)

	groupName := monitors[0].GroupName

	var overallUptime float64
	_ = h.db.GetContext(ctx, &overallUptime,
		`SELECT COALESCE(AVG(uptime_percentage), 100)
		 FROM monitors WHERE public = true AND group_name = $1`, groupName)

	siteName := "Genki"
	_ = h.db.GetContext(ctx, &siteName,
		`SELECT value FROM app_settings WHERE key = 'site_name'`)

	return c.JSON(http.StatusOK, echo.Map{
		"monitors":       result,
		"overall_uptime": overallUptime,
		"site_name":      siteName,
		"group_name":     groupName,
		"group_slug":     groupSlug,
	})
}

// GetPublicGroups returns all groups that have at least one public monitor.
func (h *PublicHandler) GetPublicGroups(c echo.Context) error {
	ctx := c.Request().Context()

	type groupInfo struct {
		GroupName   string `db:"group_name" json:"group_name"`
		GroupSlug   string `json:"group_slug"`
		Count       int    `db:"count" json:"count"`
		HasDown     bool   `db:"has_down" json:"has_down"`
		HasDegraded bool   `db:"has_degraded" json:"has_degraded"`
	}

	type groupRow struct {
		GroupName   string `db:"group_name"`
		Count       int    `db:"count"`
		HasDown     bool   `db:"has_down"`
		HasDegraded bool   `db:"has_degraded"`
	}

	var rows []groupRow
	err := h.db.SelectContext(ctx, &rows,
		`SELECT group_name,
		        COUNT(*) AS count,
		        BOOL_OR(status = 'down') AS has_down,
		        BOOL_OR(status = 'degraded') AS has_degraded
		 FROM monitors
		 WHERE public = true AND group_name <> ''
		 GROUP BY group_name
		 ORDER BY group_name ASC`)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch groups")
	}
	if rows == nil {
		rows = []groupRow{}
	}

	result := make([]groupInfo, 0, len(rows))
	for _, r := range rows {
		result = append(result, groupInfo{
			GroupName:   r.GroupName,
			GroupSlug:   strings.ToLower(strings.ReplaceAll(r.GroupName, " ", "-")),
			Count:       r.Count,
			HasDown:     r.HasDown,
			HasDegraded: r.HasDegraded,
		})
	}

	siteName := "Genki"
	_ = h.db.GetContext(ctx, &siteName,
		`SELECT value FROM app_settings WHERE key = 'site_name'`)

	return c.JSON(http.StatusOK, echo.Map{
		"groups":    result,
		"site_name": siteName,
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
		`SELECT `+publicMonitorCols+`
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
