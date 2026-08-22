package models

import "time"

type IncidentStatus string

const (
	IncidentStatusInvestigating IncidentStatus = "investigating"
	IncidentStatusIdentified    IncidentStatus = "identified"
	IncidentStatusResolved      IncidentStatus = "resolved"
)

type Incident struct {
	ID          int64          `db:"id" json:"id"`
	MonitorID   *int64         `db:"monitor_id" json:"monitor_id"`
	Title       string         `db:"title" json:"title"`
	Description string         `db:"description" json:"description"`
	Status      IncidentStatus `db:"status" json:"status"`
	StartedAt   time.Time      `db:"started_at" json:"started_at"`
	ResolvedAt  *time.Time     `db:"resolved_at" json:"resolved_at"`
	CreatedAt   time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time      `db:"updated_at" json:"updated_at"`
}
