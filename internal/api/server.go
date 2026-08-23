package api

import (
	"context"

	"github.com/abdulkhobirfauzi/genki-uptime-monitoring/internal/api/handlers"
	"github.com/abdulkhobirfauzi/genki-uptime-monitoring/internal/api/middleware"
	"github.com/abdulkhobirfauzi/genki-uptime-monitoring/internal/applog"
	"github.com/abdulkhobirfauzi/genki-uptime-monitoring/internal/config"
	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	echomiddleware "github.com/labstack/echo/v4/middleware"
)

type Server struct {
	echo *echo.Echo
	cfg  *config.Config
	db   *sqlx.DB
}

func NewServer(cfg *config.Config, db *sqlx.DB, logBuf *applog.Buffer) *Server {
	e := echo.New()
	e.HideBanner = true

	// Global middleware
	e.Use(echomiddleware.Logger())
	e.Use(echomiddleware.Recover())
	e.Use(echomiddleware.CORS())

	s := &Server{echo: e, cfg: cfg, db: db}
	s.registerRoutes(logBuf)

	return s
}

func (s *Server) registerRoutes(logBuf *applog.Buffer) {
	// API routes
	api := s.echo.Group("/api/v1")

	// Auth (public)
	authHandler := handlers.NewAuthHandler(s.db, s.cfg)
	api.POST("/auth/login", authHandler.Login)
	api.POST("/auth/register", authHandler.Register)
	api.GET("/auth/needs-setup", authHandler.NeedsSetup)
	api.POST("/auth/reset-password", authHandler.ResetPassword)

	// Protected routes — accepts JWT or "gk_…" API keys
	protected := api.Group("")
	protected.Use(middleware.JWT(s.cfg.JWTSecret, s.db))

	// Profile
	profileHandler := handlers.NewProfileHandler(s.db)
	protected.GET("/profile", profileHandler.GetProfile)
	protected.PUT("/profile", profileHandler.UpdateProfile)
	protected.POST("/profile/password", profileHandler.ChangePassword)

	// App settings (general)
	appSettingsHandler := handlers.NewAppSettingsHandler(s.db)
	protected.GET("/settings/general", appSettingsHandler.Get)
	protected.PUT("/settings/general", appSettingsHandler.Update)
	protected.POST("/settings/reset-data", appSettingsHandler.ResetAllData)
	protected.POST("/settings/reset-monitoring", appSettingsHandler.ResetMonitoringData)
	protected.GET("/settings/show-url", appSettingsHandler.GetShowURL)
	protected.PATCH("/settings/show-url", appSettingsHandler.SetShowURL)
	protected.PATCH("/settings/show-url", appSettingsHandler.SetShowURL)
	protected.GET("/settings/show-url", appSettingsHandler.GetShowURL)

	// App logs
	logHandler := handlers.NewLogHandler(logBuf)
	protected.GET("/logs", logHandler.Snapshot)

	// Monitors
	monitorHandler := handlers.NewMonitorHandler(s.db)
	protected.GET("/monitors", monitorHandler.List)
	protected.POST("/monitors", monitorHandler.Create)
	protected.GET("/monitors/groups", monitorHandler.ListGroups)
	protected.GET("/monitors/:id", monitorHandler.Get)
	protected.PUT("/monitors/:id", monitorHandler.Update)
	protected.DELETE("/monitors/:id", monitorHandler.Delete)
	protected.GET("/monitors/:id/logs", monitorHandler.Logs)
	protected.PATCH("/monitors/:id/visibility", monitorHandler.SetVisibility)

	// Public status (no auth)
	publicHandler := handlers.NewPublicHandler(s.db)
	api.GET("/public/status", publicHandler.GetStatus)
	api.GET("/public/groups", publicHandler.GetPublicGroups)
	api.GET("/public/status/group/:groupSlug", publicHandler.GetGroupStatus)
	api.GET("/public/status/:slug", publicHandler.GetMonitorStatus)

	// Incidents
	incidentHandler := handlers.NewIncidentHandler(s.db)
	protected.GET("/incidents", incidentHandler.List)
	protected.GET("/incidents/:id", incidentHandler.Get)
	protected.PUT("/incidents/:id", incidentHandler.Update)

	// Heartbeats
	heartbeatHandler := handlers.NewHeartbeatHandler(s.db)
	protected.GET("/heartbeats", heartbeatHandler.List)
	api.POST("/heartbeats/:slug", heartbeatHandler.Push) // public endpoint

	// Notification channels
	notifHandler := handlers.NewNotificationHandler(s.db)
	protected.GET("/notifications", notifHandler.List)
	protected.POST("/notifications", notifHandler.Upsert)
	protected.DELETE("/notifications/:id", notifHandler.Delete)
	protected.PATCH("/notifications/:id/enabled", notifHandler.SetEnabled)

	// API Keys
	apiKeyHandler := handlers.NewAPIKeyHandler(s.db)
	protected.GET("/api-keys", apiKeyHandler.List)
	protected.POST("/api-keys", apiKeyHandler.Create)
	protected.DELETE("/api-keys/:id", apiKeyHandler.Delete)

	// Dashboard stats
	statsHandler := handlers.NewStatsHandler(s.db)
	protected.GET("/stats/overview", statsHandler.Overview)

	// Uptime time-series
	uptimeSeriesHandler := handlers.NewUptimeSeriesHandler(s.db)
	protected.GET("/stats/uptime-series", uptimeSeriesHandler.GetSeries)

	// WebSocket — passes logBuf so it can stream live log entries
	wsHandler := handlers.NewWebSocketHandler(s.db, logBuf)
	protected.GET("/ws", wsHandler.Handle)

	// Serve React frontend (catch-all)
	// Frontend is embedded at build time from internal/api/web/dist
	s.serveStaticFiles()
}

func (s *Server) Start(port string) error {
	return s.echo.Start(port)
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.echo.Shutdown(ctx)
}
