package models

import "time"

type Heartbeat struct {
	ID        int64     `db:"id" json:"id"`
	MonitorID int64     `db:"monitor_id" json:"monitor_id"`
	Status    string    `db:"status" json:"status"`
	Ping      int       `db:"ping" json:"ping"` // milliseconds
	Message   string    `db:"message" json:"message"`
	CreatedAt time.Time `db:"created_at" json:"created_at"`
}
