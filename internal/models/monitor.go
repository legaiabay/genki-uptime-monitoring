package models

import (
	"time"
)

type MonitorType string
type MonitorStatus string

const (
	MonitorTypeHTTP     MonitorType = "http"
	MonitorTypeTCP      MonitorType = "tcp"
	MonitorTypePing     MonitorType = "ping"
	MonitorTypeDNS      MonitorType = "dns"
	MonitorTypeSSL      MonitorType = "ssl"
	MonitorTypeGRPC     MonitorType = "grpc"
	MonitorTypeUDP      MonitorType = "udp"
	MonitorTypeDatabase MonitorType = "database"

	MonitorStatusUp       MonitorStatus = "up"
	MonitorStatusDown     MonitorStatus = "down"
	MonitorStatusDegraded MonitorStatus = "degraded"
	MonitorStatusPending  MonitorStatus = "pending"
)

type Monitor struct {
	ID               int64         `db:"id"               json:"id"`
	Name             string        `db:"name"             json:"name"`
	URL              string        `db:"url"              json:"url"`
	Type             MonitorType   `db:"type"             json:"type"`
	Interval         int           `db:"interval"         json:"interval"` // seconds
	Timeout          int           `db:"timeout"          json:"timeout"`  // seconds
	Status           MonitorStatus `db:"status"           json:"status"`
	Active           bool          `db:"active"           json:"active"`
	ExpectedStatus   int           `db:"expected_status"  json:"expected_status"`
	MaxRetries       int           `db:"max_retries"      json:"max_retries"`
	UptimePercentage float64       `db:"uptime_percentage" json:"uptime_percentage"`
	Public           bool          `db:"public"           json:"public"`
	PublicSlug       *string       `db:"public_slug"      json:"public_slug"`
	LastCheckedAt    *time.Time    `db:"last_checked_at"  json:"last_checked_at"`
	CreatedAt        time.Time     `db:"created_at"       json:"created_at"`
	UpdatedAt        time.Time     `db:"updated_at"       json:"updated_at"`
	// DNS-specific
	DNSRecordType string `db:"dns_record_type" json:"dns_record_type"`
	DNSExpectedIP string `db:"dns_expected_ip" json:"dns_expected_ip"`
	// SSL-specific
	SSLWarningDays int        `db:"ssl_warning_days" json:"ssl_warning_days"`
	SSLExpiryDate  *time.Time `db:"ssl_expiry_date"  json:"ssl_expiry_date"`
	// gRPC-specific
	GRPCService string `db:"grpc_service" json:"grpc_service"`
	GRPCMethod  string `db:"grpc_method"  json:"grpc_method"`
	// Database-specific
	// DBDriver holds the engine name: mysql, mariadb, postgresql, redis, mongodb.
	DBDriver string `db:"db_driver" json:"db_driver"`
	// DBConnectionString holds the AES-256-GCM encrypted DSN (hex-encoded).
	// The scheduler decrypts it at check time; the API never returns the raw value.
	DBConnectionString string `db:"db_connection_string" json:"-"`
}

type MonitorLog struct {
	ID           int64         `db:"id"            json:"id"`
	MonitorID    int64         `db:"monitor_id"    json:"monitor_id"`
	Status       MonitorStatus `db:"status"        json:"status"`
	ResponseTime int           `db:"response_time" json:"response_time"` // milliseconds
	StatusCode   *int          `db:"status_code"   json:"status_code"`
	Message      string        `db:"message"       json:"message"`
	CheckedAt    time.Time     `db:"checked_at"    json:"checked_at"`
}
