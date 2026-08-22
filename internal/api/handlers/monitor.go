package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

type MonitorHandler struct {
	db *sqlx.DB
}

func NewMonitorHandler(db *sqlx.DB) *MonitorHandler {
	return &MonitorHandler{db: db}
}

const monitorCols = `id, name, url, type, interval, timeout, status, active,
	expected_status, max_retries, uptime_percentage,
	public, public_slug, last_checked_at, created_at, updated_at`

type monitorRow struct {
	ID               int64      `db:"id" json:"id"`
	Name             string     `db:"name" json:"name"`
	URL              string     `db:"url" json:"url"`
	Type             string     `db:"type" json:"type"`
	Interval         int        `db:"interval" json:"interval"`
	Timeout          int        `db:"timeout" json:"timeout"`
	Status           string     `db:"status" json:"status"`
	Active           bool       `db:"active" json:"active"`
	ExpectedStatus   int        `db:"expected_status" json:"expected_status"`
	MaxRetries       int        `db:"max_retries" json:"max_retries"`
	UptimePercentage float64    `db:"uptime_percentage" json:"uptime_percentage"`
	Public           bool       `db:"public" json:"public"`
	PublicSlug       *string    `db:"public_slug" json:"public_slug"`
	LastCheckedAt    *time.Time `db:"last_checked_at" json:"last_checked_at"`
	CreatedAt        time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt        time.Time  `db:"updated_at" json:"updated_at"`
	LastResponseTime *int       `db:"last_response_time" json:"last_response_time"`
}

type createMonitorRequest struct {
	Name           string `json:"name"`
	URL            string `json:"url"`
	Type           string `json:"type"`
	Interval       int    `json:"interval"`
	Timeout        int    `json:"timeout"`
	ExpectedStatus int    `json:"expected_status"`
	MaxRetries     int    `json:"max_retries"`
}

func (h *MonitorHandler) List(c echo.Context) error {
	var monitors []monitorRow
	err := h.db.SelectContext(c.Request().Context(), &monitors,
		`SELECT m.id, m.name, m.url, m.type, m.interval, m.timeout, m.status, m.active,
		        m.expected_status, m.max_retries, m.uptime_percentage,
		        m.public, m.public_slug, m.last_checked_at, m.created_at, m.updated_at,
		        (SELECT l.response_time FROM monitor_logs l
		         WHERE l.monitor_id = m.id ORDER BY l.checked_at DESC LIMIT 1) AS last_response_time
		 FROM monitors m ORDER BY m.created_at DESC`)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch monitors")
	}
	if monitors == nil {
		monitors = []monitorRow{}
	}
	return c.JSON(http.StatusOK, echo.Map{"data": monitors})
}

func (h *MonitorHandler) Create(c echo.Context) error {
	var req createMonitorRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	req.Name = strings.TrimSpace(req.Name)
	req.URL = strings.TrimSpace(req.URL)
	if req.Name == "" || req.URL == "" {
		return echo.NewHTTPError(http.StatusBadRequest, "name and url are required")
	}
	if req.Type == "" {
		req.Type = "http"
	}
	if req.Interval <= 0 {
		req.Interval = 60
	}
	if req.Timeout <= 0 {
		req.Timeout = 30
	}
	if req.ExpectedStatus <= 0 {
		req.ExpectedStatus = 200
	}
	if req.MaxRetries <= 0 {
		req.MaxRetries = 1
	}

	var monitor monitorRow
	err := h.db.QueryRowxContext(c.Request().Context(),
		`INSERT INTO monitors (name, url, type, interval, timeout, expected_status, max_retries)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)
		 RETURNING `+monitorCols,
		req.Name, req.URL, req.Type, req.Interval, req.Timeout, req.ExpectedStatus, req.MaxRetries,
	).StructScan(&monitor)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create monitor")
	}

	return c.JSON(http.StatusCreated, echo.Map{"data": monitor})
}

func (h *MonitorHandler) Get(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid monitor id")
	}

	var monitor monitorRow
	err = h.db.QueryRowxContext(c.Request().Context(),
		`SELECT `+monitorCols+` FROM monitors WHERE id = $1`, id).StructScan(&monitor)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "monitor not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch monitor")
	}

	return c.JSON(http.StatusOK, echo.Map{"data": monitor})
}

func (h *MonitorHandler) Update(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid monitor id")
	}

	var req createMonitorRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	var monitor monitorRow
	err = h.db.QueryRowxContext(c.Request().Context(),
		`UPDATE monitors
		 SET name = COALESCE(NULLIF($1, ''), name),
		     url = COALESCE(NULLIF($2, ''), url),
		     type = COALESCE(NULLIF($3, ''), type),
		     interval = CASE WHEN $4 > 0 THEN $4 ELSE interval END,
		     timeout = CASE WHEN $5 > 0 THEN $5 ELSE timeout END,
		     expected_status = CASE WHEN $6 > 0 THEN $6 ELSE expected_status END,
		     max_retries = CASE WHEN $7 > 0 THEN $7 ELSE max_retries END,
		     updated_at = NOW()
		 WHERE id = $8
		 RETURNING `+monitorCols,
		req.Name, req.URL, req.Type, req.Interval, req.Timeout, req.ExpectedStatus, req.MaxRetries, id,
	).StructScan(&monitor)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "monitor not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update monitor")
	}

	return c.JSON(http.StatusOK, echo.Map{"data": monitor})
}

func (h *MonitorHandler) Delete(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid monitor id")
	}

	result, err := h.db.ExecContext(c.Request().Context(), `DELETE FROM monitors WHERE id = $1`, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to delete monitor")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "monitor not found")
	}

	return c.JSON(http.StatusOK, echo.Map{"message": "monitor deleted"})
}

type monitorLogRow struct {
	ID           int64     `db:"id" json:"id"`
	MonitorID    int64     `db:"monitor_id" json:"monitor_id"`
	Status       string    `db:"status" json:"status"`
	ResponseTime int       `db:"response_time" json:"response_time"`
	StatusCode   *int      `db:"status_code" json:"status_code"`
	Message      string    `db:"message" json:"message"`
	CheckedAt    time.Time `db:"checked_at" json:"checked_at"`
}

func (h *MonitorHandler) Logs(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid monitor id")
	}

	limit := 50
	if l := c.QueryParam("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 200 {
			limit = parsed
		}
	}

	var logs []monitorLogRow
	err = h.db.SelectContext(c.Request().Context(), &logs,
		`SELECT id, monitor_id, status, response_time, status_code, message, checked_at
		 FROM monitor_logs WHERE monitor_id = $1
		 ORDER BY checked_at DESC LIMIT $2`, id, limit)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch logs")
	}
	if logs == nil {
		logs = []monitorLogRow{}
	}

	return c.JSON(http.StatusOK, echo.Map{"data": logs})
}

type setVisibilityRequest struct {
	Public bool `json:"public"`
}

// SetVisibility toggles the public flag and auto-generates a slug when enabling.
func (h *MonitorHandler) SetVisibility(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid monitor id")
	}

	var req setVisibilityRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	var monitor monitorRow
	if req.Public {
		// Generate slug from name if not already set
		slug := fmt.Sprintf("monitor-%d", id)
		err = h.db.QueryRowxContext(c.Request().Context(),
			`UPDATE monitors
			 SET public = true,
			     public_slug = COALESCE(public_slug, $1),
			     updated_at = NOW()
			 WHERE id = $2
			 RETURNING `+monitorCols,
			slug, id,
		).StructScan(&monitor)
	} else {
		err = h.db.QueryRowxContext(c.Request().Context(),
			`UPDATE monitors
			 SET public = false,
			     updated_at = NOW()
			 WHERE id = $1
			 RETURNING `+monitorCols,
			id,
		).StructScan(&monitor)
	}

	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "monitor not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update visibility")
	}

	return c.JSON(http.StatusOK, echo.Map{"data": monitor})
}
