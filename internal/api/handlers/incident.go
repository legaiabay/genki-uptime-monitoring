package handlers

import (
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

type IncidentHandler struct {
	db *sqlx.DB
}

func NewIncidentHandler(db *sqlx.DB) *IncidentHandler {
	return &IncidentHandler{db: db}
}

type incidentRow struct {
	ID          int64      `db:"id" json:"id"`
	MonitorID   *int64     `db:"monitor_id" json:"monitor_id"`
	Title       string     `db:"title" json:"title"`
	Description string     `db:"description" json:"description"`
	Status      string     `db:"status" json:"status"`
	StartedAt   time.Time  `db:"started_at" json:"started_at"`
	ResolvedAt  *time.Time `db:"resolved_at" json:"resolved_at"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time  `db:"updated_at" json:"updated_at"`
}

func (h *IncidentHandler) List(c echo.Context) error {
	statusFilter := c.QueryParam("status")

	var incidents []incidentRow
	var err error

	if statusFilter != "" && (statusFilter == "investigating" || statusFilter == "identified" || statusFilter == "resolved") {
		err = h.db.SelectContext(c.Request().Context(), &incidents,
			`SELECT id, monitor_id, title, description, status, started_at, resolved_at, created_at, updated_at
			 FROM incidents WHERE status = $1 ORDER BY started_at DESC`, statusFilter)
	} else {
		err = h.db.SelectContext(c.Request().Context(), &incidents,
			`SELECT id, monitor_id, title, description, status, started_at, resolved_at, created_at, updated_at
			 FROM incidents ORDER BY started_at DESC`)
	}

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch incidents")
	}
	if incidents == nil {
		incidents = []incidentRow{}
	}
	return c.JSON(http.StatusOK, echo.Map{"data": incidents})
}

func (h *IncidentHandler) Get(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid incident id")
	}

	var incident incidentRow
	err = h.db.GetContext(c.Request().Context(), &incident,
		`SELECT id, monitor_id, title, description, status, started_at, resolved_at, created_at, updated_at
		 FROM incidents WHERE id = $1`, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "incident not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch incident")
	}

	return c.JSON(http.StatusOK, echo.Map{"data": incident})
}

type updateIncidentRequest struct {
	Status      string `json:"status"`
	Description string `json:"description"`
}

func (h *IncidentHandler) Update(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid incident id")
	}

	var req updateIncidentRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	validStatuses := map[string]bool{"investigating": true, "identified": true, "resolved": true}
	if req.Status != "" && !validStatuses[req.Status] {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid status value")
	}

	var incident incidentRow
	if req.Status == "resolved" {
		err = h.db.QueryRowxContext(c.Request().Context(),
			`UPDATE incidents
			 SET status = $1,
			     description = CASE WHEN $2 = '' THEN description ELSE $2 END,
			     resolved_at = NOW(),
			     updated_at = NOW()
			 WHERE id = $3
			 RETURNING id, monitor_id, title, description, status, started_at, resolved_at, created_at, updated_at`,
			req.Status, req.Description, id).StructScan(&incident)
	} else {
		err = h.db.QueryRowxContext(c.Request().Context(),
			`UPDATE incidents
			 SET status = COALESCE(NULLIF($1, ''), status),
			     description = CASE WHEN $2 = '' THEN description ELSE $2 END,
			     updated_at = NOW()
			 WHERE id = $3
			 RETURNING id, monitor_id, title, description, status, started_at, resolved_at, created_at, updated_at`,
			req.Status, req.Description, id).StructScan(&incident)
	}

	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "incident not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update incident")
	}

	return c.JSON(http.StatusOK, echo.Map{"data": incident})
}
