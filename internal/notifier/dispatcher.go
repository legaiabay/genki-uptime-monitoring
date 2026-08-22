package notifier

import (
	"context"
	"encoding/json"
	"log"

	"github.com/jmoiron/sqlx"
)

type channelRow struct {
	ID      int64           `db:"id"`
	Type    string          `db:"type"`
	Enabled bool            `db:"enabled"`
	Config  json.RawMessage `db:"config"`
}

// Dispatcher loads enabled notification channels from DB and fans out.
type Dispatcher struct {
	db *sqlx.DB
}

func NewDispatcher(db *sqlx.DB) *Dispatcher {
	return &Dispatcher{db: db}
}

// Notify sends p to all enabled notification channels.
func (d *Dispatcher) Notify(ctx context.Context, p Payload) {
	var rows []channelRow
	err := d.db.SelectContext(ctx, &rows,
		`SELECT id, type, enabled, config FROM notification_channels WHERE enabled = true`)
	if err != nil {
		log.Printf("[notifier] error loading channels: %v", err)
		return
	}

	for _, row := range rows {
		n, err := buildNotifier(row)
		if err != nil {
			log.Printf("[notifier] skip channel %d (%s): %v", row.ID, row.Type, err)
			continue
		}
		go func(n Notifier, chType string) {
			if err := n.Send(ctx, p); err != nil {
				log.Printf("[notifier] channel %s send error: %v", chType, err)
			} else {
				log.Printf("[notifier] sent %s notification via %s", p.Event, chType)
			}
		}(n, row.Type)
	}
}

func buildNotifier(row channelRow) (Notifier, error) {
	switch row.Type {
	case "google_chat":
		var cfg GoogleChatConfig
		if err := json.Unmarshal(row.Config, &cfg); err != nil {
			return nil, err
		}
		return NewGoogleChat(cfg), nil

	case "telegram":
		var cfg TelegramConfig
		if err := json.Unmarshal(row.Config, &cfg); err != nil {
			return nil, err
		}
		return NewTelegram(cfg), nil

	case "slack":
		var cfg SlackConfig
		if err := json.Unmarshal(row.Config, &cfg); err != nil {
			return nil, err
		}
		return NewSlack(cfg), nil

	case "webhook":
		var cfg WebhookConfig
		if err := json.Unmarshal(row.Config, &cfg); err != nil {
			return nil, err
		}
		return NewWebhook(cfg), nil

	default:
		return nil, nil
	}
}
