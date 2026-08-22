package handlers

import (
	"net/http"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

// ResetMonitoringData truncates only monitoring-related tables (monitors, logs,
// incidents, heartbeats). Users, API keys, notification channels, and settings
// are preserved. The caller stays logged in.
func (h *AppSettingsHandler) ResetMonitoringData(c echo.Context) error {
	ctx := c.Request().Context()

	tables := []string{
		"monitor_logs",
		"incidents",
		"heartbeats",
		"monitors",
	}

	for _, t := range tables {
		if _, err := h.db.ExecContext(ctx, "TRUNCATE TABLE "+t+" CASCADE"); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to reset table: "+t+": "+err.Error())
		}
	}

	return c.JSON(http.StatusOK, echo.Map{"message": "monitoring data has been reset"})
}

// ResetAllData truncates all application tables (including users) so the app
// returns to a first-boot state. The caller must log out immediately after.
func (h *AppSettingsHandler) ResetAllData(c echo.Context) error {
	ctx := c.Request().Context()

	tables := []string{
		"monitor_logs",
		"incidents",
		"heartbeats",
		"api_keys",
		"notification_channels",
		"monitors",
		"app_settings",
		"users",
	}

	for _, t := range tables {
		if _, err := h.db.ExecContext(ctx, "TRUNCATE TABLE "+t+" CASCADE"); err != nil {
			return echo.NewHTTPError(http.StatusInternalServerError, "failed to reset table: "+t+": "+err.Error())
		}
	}

	return c.JSON(http.StatusOK, echo.Map{"message": "all data has been reset"})
}

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
