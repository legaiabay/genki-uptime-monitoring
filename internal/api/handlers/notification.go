package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

type NotificationHandler struct {
	db *sqlx.DB
}

func NewNotificationHandler(db *sqlx.DB) *NotificationHandler {
	return &NotificationHandler{db: db}
}

type notificationChannelRow struct {
	ID        int64           `db:"id"         json:"id"`
	Type      string          `db:"type"        json:"type"`
	Name      string          `db:"name"        json:"name"`
	Enabled   bool            `db:"enabled"     json:"enabled"`
	Config    json.RawMessage `db:"config"      json:"config"`
	CreatedAt time.Time       `db:"created_at"  json:"created_at"`
	UpdatedAt time.Time       `db:"updated_at"  json:"updated_at"`
}

type upsertChannelRequest struct {
	Type    string          `json:"type"`
	Name    string          `json:"name"`
	Enabled *bool           `json:"enabled"`
	Config  json.RawMessage `json:"config"`
}

func (h *NotificationHandler) List(c echo.Context) error {
	var channels []notificationChannelRow
	err := h.db.SelectContext(c.Request().Context(), &channels,
		`SELECT id, type, name, enabled, config, created_at, updated_at
		 FROM notification_channels ORDER BY type, id`)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch channels")
	}
	if channels == nil {
		channels = []notificationChannelRow{}
	}
	return c.JSON(http.StatusOK, echo.Map{"data": channels})
}

func (h *NotificationHandler) Upsert(c echo.Context) error {
	var req upsertChannelRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	validTypes := map[string]bool{"google_chat": true, "telegram": true, "slack": true, "webhook": true}
	if !validTypes[req.Type] {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid channel type")
	}
	if len(req.Config) == 0 {
		req.Config = json.RawMessage("{}")
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	var ch notificationChannelRow

	// Try update first (if a row with this type already exists)
	err := h.db.QueryRowxContext(c.Request().Context(),
		`UPDATE notification_channels
		 SET name = $1, enabled = $2, config = $3, updated_at = NOW()
		 WHERE type = $4
		 RETURNING id, type, name, enabled, config, created_at, updated_at`,
		req.Name, enabled, req.Config, req.Type,
	).StructScan(&ch)

	if err == sql.ErrNoRows {
		// No existing row — insert new
		err = h.db.QueryRowxContext(c.Request().Context(),
			`INSERT INTO notification_channels (type, name, enabled, config)
			 VALUES ($1, $2, $3, $4)
			 RETURNING id, type, name, enabled, config, created_at, updated_at`,
			req.Type, req.Name, enabled, req.Config,
		).StructScan(&ch)
	}

	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to save channel: "+err.Error())
	}

	return c.JSON(http.StatusOK, echo.Map{"data": ch})
}

func (h *NotificationHandler) Delete(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}

	result, err := h.db.ExecContext(c.Request().Context(),
		`DELETE FROM notification_channels WHERE id = $1`, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to delete channel")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "channel not found")
	}

	return c.JSON(http.StatusOK, echo.Map{"message": "deleted"})
}

func (h *NotificationHandler) SetEnabled(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid id")
	}

	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	var ch notificationChannelRow
	err = h.db.QueryRowxContext(c.Request().Context(),
		`UPDATE notification_channels
		 SET enabled = $1, updated_at = NOW()
		 WHERE id = $2
		 RETURNING id, type, name, enabled, config, created_at, updated_at`,
		req.Enabled, id,
	).StructScan(&ch)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "channel not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update channel")
	}

	return c.JSON(http.StatusOK, echo.Map{"data": ch})
}
