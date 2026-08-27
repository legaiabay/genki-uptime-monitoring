package handlers

import (
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/legaiabay/genki-uptime-monitoring/internal/applog"
	"github.com/gorilla/websocket"
	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // TODO: restrict in production
	},
}

// wsMessage is the envelope sent to every connected client.
type wsMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// hub manages all active WebSocket connections.
type hub struct {
	mu      sync.RWMutex
	clients map[*websocket.Conn]struct{}
}

func newHub() *hub {
	return &hub{clients: make(map[*websocket.Conn]struct{})}
}

func (h *hub) add(conn *websocket.Conn) {
	h.mu.Lock()
	h.clients[conn] = struct{}{}
	h.mu.Unlock()
}

func (h *hub) remove(conn *websocket.Conn) {
	h.mu.Lock()
	delete(h.clients, conn)
	h.mu.Unlock()
}

func (h *hub) broadcast(msg wsMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	for conn := range h.clients {
		// Non-blocking write with deadline to avoid a stuck client stalling others.
		_ = conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
		_ = conn.WriteMessage(websocket.TextMessage, data)
	}
}

// WebSocketHandler upgrades HTTP connections and streams server-sent events.
type WebSocketHandler struct {
	db     *sqlx.DB
	logBuf *applog.Buffer
	hub    *hub
}

func NewWebSocketHandler(db *sqlx.DB, logBuf *applog.Buffer) *WebSocketHandler {
	h := &WebSocketHandler{
		db:     db,
		logBuf: logBuf,
		hub:    newHub(),
	}
	// Start the goroutine that tails log entries and broadcasts them.
	go h.tailLogs()
	return h
}

// tailLogs subscribes to the log buffer and broadcasts each entry to all
// connected WebSocket clients.
func (h *WebSocketHandler) tailLogs() {
	ch := h.logBuf.Subscribe()
	defer h.logBuf.Unsubscribe(ch)

	for entry := range ch {
		payload, err := json.Marshal(entry)
		if err != nil {
			continue
		}
		h.hub.broadcast(wsMessage{
			Type:    "log",
			Payload: json.RawMessage(payload),
		})
	}
}

// Handle upgrades the connection and keeps it alive until the client disconnects.
func (h *WebSocketHandler) Handle(c echo.Context) error {
	conn, err := upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err
	}
	defer func() {
		h.hub.remove(conn)
		conn.Close()
	}()

	h.hub.add(conn)

	// Read loop — keeps the connection open and detects client disconnect.
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}

	return nil
}

// Broadcast allows other handlers (e.g. scheduler) to push arbitrary events.
func (h *WebSocketHandler) Broadcast(msgType string, payload any) {
	raw, err := json.Marshal(payload)
	if err != nil {
		return
	}
	h.hub.broadcast(wsMessage{Type: msgType, Payload: json.RawMessage(raw)})
}
