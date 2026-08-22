package handlers

import (
	"net/http"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

type StatsHandler struct {
	db *sqlx.DB
}

func NewStatsHandler(db *sqlx.DB) *StatsHandler {
	return &StatsHandler{db: db}
}

type overviewResponse struct {
	TotalMonitors    int     `json:"total_monitors"`
	UptimePercentage float64 `json:"uptime_percentage"`
	AvgResponseTime  int     `json:"avg_response_time"`
	IncidentCount    int     `json:"incident_count"`
}

func (h *StatsHandler) Overview(c echo.Context) error {
	ctx := c.Request().Context()
	var stats overviewResponse

	// Total monitors
	_ = h.db.GetContext(ctx, &stats.TotalMonitors,
		`SELECT COUNT(*) FROM monitors`)

	// Average uptime percentage across all active monitors
	_ = h.db.GetContext(ctx, &stats.UptimePercentage,
		`SELECT COALESCE(AVG(uptime_percentage), 0) FROM monitors WHERE active = true`)

	// Average response time from last 24h of logs
	_ = h.db.GetContext(ctx, &stats.AvgResponseTime,
		`SELECT COALESCE(AVG(response_time)::int, 0)
		 FROM monitor_logs
		 WHERE checked_at > NOW() - INTERVAL '24 hours'
		   AND response_time > 0`)

	// Active incidents (not resolved)
	_ = h.db.GetContext(ctx, &stats.IncidentCount,
		`SELECT COUNT(*) FROM incidents WHERE status != 'resolved'`)

	return c.JSON(http.StatusOK, stats)
}
