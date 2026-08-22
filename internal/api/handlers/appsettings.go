package handlers

import (
	"net/http"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

type AppSettingsHandler struct {
	db *sqlx.DB
}

func NewAppSettingsHandler(db *sqlx.DB) *AppSettingsHandler {
	return &AppSettingsHandler{db: db}
}

type appSettingsResponse struct {
	SiteName        string `json:"site_name"`
	Timezone        string `json:"timezone"`
	DefaultInterval string `json:"default_interval"`
	RetentionDays   string `json:"retention_days"`
}

func (h *AppSettingsHandler) Get(c echo.Context) error {
	ctx := c.Request().Context()

	rows, err := h.db.QueryContext(ctx, `SELECT key, value FROM app_settings`)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch settings")
	}
	defer rows.Close()

	settings := appSettingsResponse{
		SiteName:        "Genki",
		Timezone:        "Asia/Jakarta",
		DefaultInterval: "60",
		RetentionDays:   "90",
	}

	for rows.Next() {
		var key, value string
		if err := rows.Scan(&key, &value); err != nil {
			continue
		}
		switch key {
		case "site_name":
			settings.SiteName = value
		case "timezone":
			settings.Timezone = value
		case "default_interval":
			settings.DefaultInterval = value
		case "retention_days":
			settings.RetentionDays = value
		}
	}

	return c.JSON(http.StatusOK, echo.Map{"data": settings})
}

type updateAppSettingsRequest struct {
	SiteName        string `json:"site_name"`
	Timezone        string `json:"timezone"`
	DefaultInterval string `json:"default_interval"`
	RetentionDays   string `json:"retention_days"`
}

func (h *AppSettingsHandler) Update(c echo.Context) error {
	var req updateAppSettingsRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	ctx := c.Request().Context()

	updates := map[string]string{}
	if req.SiteName != "" {
		updates["site_name"] = req.SiteName
	}
	if req.Timezone != "" {
		updates["timezone"] = req.Timezone
	}
	if req.DefaultInterval != "" {
		updates["default_interval"] = req.DefaultInterval
	}
	if req.RetentionDays != "" {
		updates["retention_days"] = req.RetentionDays
	}

	for key, value := range updates {
		_, err := h.db.ExecContext(ctx,
			`INSERT INTO app_settings (key, value, updated_at)
			 VALUES ($1, $2, NOW())
			 ON CONFLICT (key) DO UPDATE
			   SET value = EXCLUDED.value, updated_at = NOW()`,
			key, value)
		if err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to update settings")
		}
	}

	return h.Get(c)
}
