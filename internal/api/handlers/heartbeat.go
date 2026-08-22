package handlers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

type HeartbeatHandler struct {
	db *sqlx.DB
}

func NewHeartbeatHandler(db *sqlx.DB) *HeartbeatHandler {
	return &HeartbeatHandler{db: db}
}

type heartbeatRow struct {
	ID        int64     `db:"id" json:"id"`
	MonitorID int64     `db:"monitor_id" json:"monitor_id"`
	Status    string    `db:"status" json:"status"`
	Ping      int       `db:"ping" json:"ping"`
	Message   string    `db:"message" json:"message"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}

func (h *HeartbeatHandler) List(c echo.Context) error {
	var heartbeats []heartbeatRow
	err := h.db.SelectContext(c.Request().Context(), &heartbeats,
		`SELECT id, monitor_id, status, ping, message, created_at
		 FROM heartbeats ORDER BY created_at DESC LIMIT 100`)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch heartbeats")
	}
	if heartbeats == nil {
		heartbeats = []heartbeatRow{}
	}
	return c.JSON(http.StatusOK, echo.Map{"data": heartbeats})
}

type pushHeartbeatRequest struct {
	Status  string `json:"status"`
	Ping    int    `json:"ping"`
	Message string `json:"message"`
}

// Push is the public endpoint that accepts heartbeat pings.
// URL: POST /api/v1/heartbeats/:slug
// slug format: "monitor-{id}" or a custom slug stored on monitor (future)
func (h *HeartbeatHandler) Push(c echo.Context) error {
	slug := c.Param("slug")
	if slug == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "slug is required")
	}

	// Resolve monitor by slug (simple pattern: "monitor-{id}")
	var monitorID int64
	// Try parsing slug as "monitor-<id>"
	if len(slug) > 8 && slug[:8] == "monitor-" {
		var err error
		_, err = fmt.Sscanf(slug, "monitor-%d", &monitorID)
		if err != nil || monitorID == 0 {
			return echo.NewHTTPError(http.StatusNotFound, "monitor not found for this slug")
		}
	} else {
		return echo.NewHTTPError(http.StatusNotFound, "monitor not found for this slug")
	}

	// Verify monitor exists
	var exists bool
	_ = h.db.GetContext(c.Request().Context(), &exists,
		`SELECT EXISTS(SELECT 1 FROM monitors WHERE id = $1)`, monitorID)
	if !exists {
		return echo.NewHTTPError(http.StatusNotFound, "monitor not found")
	}

	var req pushHeartbeatRequest
	// Allow empty body (simple ping)
	_ = c.Bind(&req)
	if req.Status == "" {
		req.Status = "up"
	}

	_, err := h.db.ExecContext(c.Request().Context(),
		`INSERT INTO heartbeats (monitor_id, status, ping, message)
		 VALUES ($1, $2, $3, $4)`,
		monitorID, req.Status, req.Ping, req.Message)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to record heartbeat")
	}

	// Update monitor status and last_checked_at
	_, _ = h.db.ExecContext(c.Request().Context(),
		`UPDATE monitors SET status = $1, last_checked_at = NOW(), updated_at = NOW() WHERE id = $2`,
		req.Status, monitorID)

	return c.JSON(http.StatusOK, echo.Map{"message": "ok"})
}
