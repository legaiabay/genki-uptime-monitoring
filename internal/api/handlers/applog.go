package handlers

import (
	"net/http"

	"github.com/abdulkhobirfauzi/genki-uptime-monitoring/internal/applog"
	"github.com/labstack/echo/v4"
)

// LogHandler serves the in-memory application log buffer.
type LogHandler struct {
	buf *applog.Buffer
}

func NewLogHandler(buf *applog.Buffer) *LogHandler {
	return &LogHandler{buf: buf}
}

// Snapshot godoc
// GET /api/v1/logs
// Returns the most recent log entries from the ring buffer (up to 500).
func (h *LogHandler) Snapshot(c echo.Context) error {
	entries := h.buf.Snapshot()
	return c.JSON(http.StatusOK, map[string]any{
		"data": entries,
	})
}
