package notifier

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

// Event type sent to notification channels.
type EventType string

const (
	EventDown     EventType = "down"
	EventRecovery EventType = "recovery"
)

// Payload holds the data available to message templates.
type Payload struct {
	MonitorName  string
	MonitorURL   string
	Status       string
	ResponseTime int
	ErrorMessage string
	CheckedAt    time.Time
	Event        EventType
}

// Notifier sends a notification for a given payload.
type Notifier interface {
	Send(ctx context.Context, p Payload) error
}

// renderTemplate replaces {{var}} placeholders in a template string.
func renderTemplate(tmpl string, p Payload) string {
	r := strings.NewReplacer(
		"{{monitor_name}}", p.MonitorName,
		"{{monitor_url}}", p.MonitorURL,
		"{{status}}", p.Status,
		"{{response_time}}", fmt.Sprintf("%d", p.ResponseTime),
		"{{error_message}}", p.ErrorMessage,
		"{{checked_at}}", p.CheckedAt.Format(time.RFC3339),
	)
	return r.Replace(tmpl)
}

// defaultMessage builds a fallback message when no custom template is set.
func defaultMessage(p Payload) string {
	if p.Event == EventDown {
		msg := fmt.Sprintf("🔴 *%s* is *down*\nURL: %s\nChecked at: %s",
			p.MonitorName, p.MonitorURL, p.CheckedAt.Format(time.RFC3339))
		if p.ErrorMessage != "" {
			msg += "\nError: " + p.ErrorMessage
		}
		return msg
	}
	return fmt.Sprintf("✅ *%s* has *recovered*\nURL: %s\nResponse time: %dms\nChecked at: %s",
		p.MonitorName, p.MonitorURL, p.ResponseTime, p.CheckedAt.Format(time.RFC3339))
}

// ─────────────────────────────────────────────────────────────────────────────
// Google Chat
// ─────────────────────────────────────────────────────────────────────────────

type GoogleChatConfig struct {
	WebhookURL      string `json:"webhook_url"`
	DownMessage     string `json:"down_message"`
	RecoveryMessage string `json:"recovery_message"`
	// legacy fallback
	CustomMessage string `json:"custom_message"`
}

type GoogleChatNotifier struct {
	cfg    GoogleChatConfig
	client *http.Client
}

func NewGoogleChat(cfg GoogleChatConfig) *GoogleChatNotifier {
	return &GoogleChatNotifier{cfg: cfg, client: &http.Client{Timeout: 10 * time.Second}}
}

func (n *GoogleChatNotifier) Send(ctx context.Context, p Payload) error {
	tmpl := n.cfg.DownMessage
	if p.Event == EventRecovery {
		tmpl = n.cfg.RecoveryMessage
	}
	if tmpl == "" {
		tmpl = n.cfg.CustomMessage // legacy
	}
	var msg string
	if tmpl == "" {
		msg = defaultMessage(p)
	} else {
		msg = renderTemplate(tmpl, p)
	}

	body, _ := json.Marshal(map[string]string{"text": msg})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, n.cfg.WebhookURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("google_chat: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := n.client.Do(req)
	if err != nil {
		return fmt.Errorf("google_chat: send: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("google_chat: unexpected status %d", resp.StatusCode)
	}
	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Telegram
// ─────────────────────────────────────────────────────────────────────────────

type TelegramConfig struct {
	BotToken        string `json:"bot_token"`
	ChatID          string `json:"chat_id"`
	DownMessage     string `json:"down_message"`
	RecoveryMessage string `json:"recovery_message"`
	CustomMessage   string `json:"custom_message"` // legacy
}

type TelegramNotifier struct {
	cfg    TelegramConfig
	client *http.Client
}

func NewTelegram(cfg TelegramConfig) *TelegramNotifier {
	return &TelegramNotifier{cfg: cfg, client: &http.Client{Timeout: 10 * time.Second}}
}

func (n *TelegramNotifier) Send(ctx context.Context, p Payload) error {
	tmpl := n.cfg.DownMessage
	if p.Event == EventRecovery {
		tmpl = n.cfg.RecoveryMessage
	}
	if tmpl == "" {
		tmpl = n.cfg.CustomMessage
	}
	var msg string
	if tmpl == "" {
		msg = defaultMessage(p)
	} else {
		msg = renderTemplate(tmpl, p)
	}

	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", n.cfg.BotToken)
	body, _ := json.Marshal(map[string]string{
		"chat_id":    n.cfg.ChatID,
		"text":       msg,
		"parse_mode": "Markdown",
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("telegram: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := n.client.Do(req)
	if err != nil {
		return fmt.Errorf("telegram: send: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("telegram: unexpected status %d", resp.StatusCode)
	}
	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Slack
// ─────────────────────────────────────────────────────────────────────────────

type SlackConfig struct {
	WebhookURL      string `json:"webhook_url"`
	DownMessage     string `json:"down_message"`
	RecoveryMessage string `json:"recovery_message"`
	CustomMessage   string `json:"custom_message"` // legacy
}

type SlackNotifier struct {
	cfg    SlackConfig
	client *http.Client
}

func NewSlack(cfg SlackConfig) *SlackNotifier {
	return &SlackNotifier{cfg: cfg, client: &http.Client{Timeout: 10 * time.Second}}
}

func (n *SlackNotifier) Send(ctx context.Context, p Payload) error {
	tmpl := n.cfg.DownMessage
	if p.Event == EventRecovery {
		tmpl = n.cfg.RecoveryMessage
	}
	if tmpl == "" {
		tmpl = n.cfg.CustomMessage
	}
	var msg string
	if tmpl == "" {
		msg = defaultMessage(p)
	} else {
		msg = renderTemplate(tmpl, p)
	}

	body, _ := json.Marshal(map[string]string{"text": msg})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, n.cfg.WebhookURL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("slack: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := n.client.Do(req)
	if err != nil {
		return fmt.Errorf("slack: send: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("slack: unexpected status %d", resp.StatusCode)
	}
	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic Webhook
// ─────────────────────────────────────────────────────────────────────────────

type WebhookConfig struct {
	URL             string `json:"url"`
	DownMessage     string `json:"down_message"`
	RecoveryMessage string `json:"recovery_message"`
	CustomMessage   string `json:"custom_message"` // legacy
}

type WebhookNotifier struct {
	cfg    WebhookConfig
	client *http.Client
}

func NewWebhook(cfg WebhookConfig) *WebhookNotifier {
	return &WebhookNotifier{cfg: cfg, client: &http.Client{Timeout: 10 * time.Second}}
}

func (n *WebhookNotifier) Send(ctx context.Context, p Payload) error {
	tmpl := n.cfg.DownMessage
	if p.Event == EventRecovery {
		tmpl = n.cfg.RecoveryMessage
	}
	if tmpl == "" {
		tmpl = n.cfg.CustomMessage
	}
	var msg string
	if tmpl == "" {
		msg = defaultMessage(p)
	} else {
		msg = renderTemplate(tmpl, p)
	}

	body, _ := json.Marshal(map[string]interface{}{
		"event":         string(p.Event),
		"monitor_name":  p.MonitorName,
		"monitor_url":   p.MonitorURL,
		"status":        p.Status,
		"response_time": p.ResponseTime,
		"error_message": p.ErrorMessage,
		"checked_at":    p.CheckedAt.Format(time.RFC3339),
		"message":       msg,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, n.cfg.URL, bytes.NewReader(body))
	if err != nil {
		return fmt.Errorf("webhook: build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := n.client.Do(req)
	if err != nil {
		return fmt.Errorf("webhook: send: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 300 {
		return fmt.Errorf("webhook: unexpected status %d", resp.StatusCode)
	}
	return nil
}
