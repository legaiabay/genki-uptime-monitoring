package handlers

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jmoiron/sqlx"
	"github.com/labstack/echo/v4"
	"github.com/legaiabay/genki-uptime-monitoring/internal/checker"
	"github.com/legaiabay/genki-uptime-monitoring/internal/crypto"
	"github.com/legaiabay/genki-uptime-monitoring/internal/models"
	"github.com/lib/pq"
)

type MonitorHandler struct {
	db     *sqlx.DB
	encKey string // hex-encoded 32-byte AES key; may be empty (encryption disabled)
}

func NewMonitorHandler(db *sqlx.DB, encKey string) *MonitorHandler {
	return &MonitorHandler{db: db, encKey: encKey}
}

const monitorCols = `id, name, url, type, interval, timeout, status, active,
	expected_status, max_retries, uptime_percentage,
	public, public_slug, group_name, labels, favorite, last_checked_at, created_at, updated_at,
	dns_record_type, dns_expected_ip, ssl_warning_days, ssl_expiry_date, grpc_service, grpc_method,
	db_driver, db_connection_string`

type monitorRow struct {
	ID               int64          `db:"id"                json:"id"`
	Name             string         `db:"name"              json:"name"`
	URL              string         `db:"url"               json:"url"`
	Type             string         `db:"type"              json:"type"`
	Interval         int            `db:"interval"          json:"interval"`
	Timeout          int            `db:"timeout"           json:"timeout"`
	Status           string         `db:"status"            json:"status"`
	Active           bool           `db:"active"            json:"active"`
	ExpectedStatus   int            `db:"expected_status"   json:"expected_status"`
	MaxRetries       int            `db:"max_retries"       json:"max_retries"`
	UptimePercentage float64        `db:"uptime_percentage" json:"uptime_percentage"`
	Public           bool           `db:"public"            json:"public"`
	PublicSlug       *string        `db:"public_slug"       json:"public_slug"`
	GroupName        string         `db:"group_name"        json:"group_name"`
	Labels           pq.StringArray `db:"labels"            json:"labels"`
	Favorite         bool           `db:"favorite"          json:"favorite"`
	LastCheckedAt    *time.Time     `db:"last_checked_at"   json:"last_checked_at"`
	CreatedAt        time.Time      `db:"created_at"        json:"created_at"`
	UpdatedAt        time.Time      `db:"updated_at"        json:"updated_at"`
	LastResponseTime *int           `db:"last_response_time" json:"last_response_time"`
	// Type-specific fields
	DNSRecordType  string     `db:"dns_record_type"  json:"dns_record_type"`
	DNSExpectedIP  string     `db:"dns_expected_ip"  json:"dns_expected_ip"`
	SSLWarningDays int        `db:"ssl_warning_days" json:"ssl_warning_days"`
	SSLExpiryDate  *time.Time `db:"ssl_expiry_date"  json:"ssl_expiry_date"`
	GRPCService    string     `db:"grpc_service"     json:"grpc_service"`
	GRPCMethod     string     `db:"grpc_method"      json:"grpc_method"`
	// Database monitor fields
	DBDriver string `db:"db_driver" json:"db_driver"`
	// DBConnectionStringRaw is scanned from the DB but never serialized — json:"-".
	// Use DBConnectionStringSet in responses to indicate a DSN is configured.
	DBConnectionStringRaw string `db:"db_connection_string" json:"-"`
	DBConnectionStringSet bool   `db:"-"                    json:"db_connection_string_set"`
}

type createMonitorRequest struct {
	Name           string   `json:"name"`
	URL            string   `json:"url"`
	Type           string   `json:"type"`
	Interval       int      `json:"interval"`
	Timeout        int      `json:"timeout"`
	ExpectedStatus int      `json:"expected_status"`
	MaxRetries     int      `json:"max_retries"`
	GroupName      string   `json:"group_name"`
	Labels         []string `json:"labels"`
	// Type-specific fields
	DNSRecordType  string `json:"dns_record_type"`
	DNSExpectedIP  string `json:"dns_expected_ip"`
	SSLWarningDays int    `json:"ssl_warning_days"`
	GRPCService    string `json:"grpc_service"`
	GRPCMethod     string `json:"grpc_method"`
	// Database monitor fields
	DBDriver           string `json:"db_driver"`
	DBConnectionString string `json:"db_connection_string"` // plaintext DSN from the client; encrypted before storage
}

// maskMonitor sets DBConnectionStringSet based on whether a DSN is stored
// and ensures the raw ciphertext is never serialized.
func maskMonitor(m *monitorRow) {
	m.DBConnectionStringSet = m.DBConnectionStringRaw != ""
	// DBConnectionStringRaw has json:"-" so it never reaches the wire;
	// we zero it anyway as an extra safeguard.
	m.DBConnectionStringRaw = ""
}

// encryptDSN encrypts a plaintext DSN using the handler's key.
// If the DSN is empty it returns "" without error (caller may leave it blank
// when updating a DB monitor without changing the DSN).
func (h *MonitorHandler) encryptDSN(dsn string) (string, error) {
	if dsn == "" {
		return "", nil
	}
	encrypted, err := crypto.Encrypt(h.encKey, dsn)
	if err != nil {
		return "", fmt.Errorf("failed to encrypt connection string: %w", err)
	}
	return encrypted, nil
}

func (h *MonitorHandler) List(c echo.Context) error {
	var monitors []monitorRow
	err := h.db.SelectContext(c.Request().Context(), &monitors,
		`SELECT m.id, m.name, m.url, m.type, m.interval, m.timeout, m.status, m.active,
		        m.expected_status, m.max_retries, m.uptime_percentage,
		        m.public, m.public_slug, m.group_name, m.labels, m.favorite,
		        m.last_checked_at, m.created_at, m.updated_at,
		        m.dns_record_type, m.dns_expected_ip, m.ssl_warning_days, m.ssl_expiry_date,
		        m.grpc_service, m.grpc_method,
		        m.db_driver, m.db_connection_string,
		        (SELECT l.response_time FROM monitor_logs l
		         WHERE l.monitor_id = m.id ORDER BY l.checked_at DESC LIMIT 1) AS last_response_time
		 FROM monitors m ORDER BY m.favorite DESC, m.group_name ASC, m.created_at DESC`)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch monitors")
	}
	if monitors == nil {
		monitors = []monitorRow{}
	}
	for i := range monitors {
		maskMonitor(&monitors[i])
	}
	return c.JSON(http.StatusOK, echo.Map{"data": monitors})
}

func (h *MonitorHandler) ListGroups(c echo.Context) error {
	var groups []string
	err := h.db.SelectContext(c.Request().Context(), &groups,
		`SELECT DISTINCT group_name FROM monitors WHERE group_name <> '' ORDER BY group_name ASC`)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch groups")
	}
	if groups == nil {
		groups = []string{}
	}
	return c.JSON(http.StatusOK, echo.Map{"data": groups})
}

func (h *MonitorHandler) Create(c echo.Context) error {
	var req createMonitorRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	req.Name = strings.TrimSpace(req.Name)
	req.URL = strings.TrimSpace(req.URL)
	req.GroupName = strings.TrimSpace(req.GroupName)

	if req.Type == "" {
		req.Type = "http"
	}

	// For database monitors the URL field is not required; connection string is.
	if req.Type == "database" {
		if req.Name == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "name is required")
		}
		if req.DBConnectionString == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "db_connection_string is required for database monitors")
		}
		if req.DBDriver == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "db_driver is required for database monitors (mysql, mariadb, postgresql, redis, mongodb)")
		}
		// Use a placeholder URL so the non-null constraint is satisfied.
		if req.URL == "" {
			req.URL = req.DBDriver + "://<encrypted>"
		}
	} else {
		if req.Name == "" || req.URL == "" {
			return echo.NewHTTPError(http.StatusBadRequest, "name and url are required")
		}
	}

	if req.Interval <= 0 {
		req.Interval = 60
	}
	if req.Timeout <= 0 {
		req.Timeout = 30
	}
	if req.ExpectedStatus <= 0 {
		req.ExpectedStatus = 200
	}
	if req.MaxRetries <= 0 {
		req.MaxRetries = 1
	}
	if req.Labels == nil {
		req.Labels = []string{}
	}

	// Encrypt DSN before storage.
	encDSN, err := h.encryptDSN(req.DBConnectionString)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	var monitor monitorRow
	err = h.db.QueryRowxContext(c.Request().Context(),
		`INSERT INTO monitors (name, url, type, interval, timeout, expected_status, max_retries,
		                       group_name, labels,
		                       dns_record_type, dns_expected_ip, ssl_warning_days,
		                       grpc_service, grpc_method,
		                       db_driver, db_connection_string)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		 RETURNING `+monitorCols,
		req.Name, req.URL, req.Type, req.Interval, req.Timeout, req.ExpectedStatus, req.MaxRetries,
		req.GroupName, pq.Array(req.Labels),
		req.DNSRecordType, req.DNSExpectedIP, req.SSLWarningDays,
		req.GRPCService, req.GRPCMethod,
		req.DBDriver, encDSN,
	).StructScan(&monitor)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to create monitor")
	}

	maskMonitor(&monitor)
	return c.JSON(http.StatusCreated, echo.Map{"data": monitor})
}

func (h *MonitorHandler) Get(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid monitor id")
	}

	var monitor monitorRow
	err = h.db.QueryRowxContext(c.Request().Context(),
		`SELECT `+monitorCols+` FROM monitors WHERE id = $1`, id).StructScan(&monitor)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "monitor not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch monitor")
	}

	maskMonitor(&monitor)
	return c.JSON(http.StatusOK, echo.Map{"data": monitor})
}

func (h *MonitorHandler) Update(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid monitor id")
	}

	var req createMonitorRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.Labels == nil {
		req.Labels = []string{}
	}

	// Encrypt the new DSN if provided; empty string means "keep existing".
	encDSN, err := h.encryptDSN(req.DBConnectionString)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, err.Error())
	}

	var monitor monitorRow
	err = h.db.QueryRowxContext(c.Request().Context(),
		`UPDATE monitors
		 SET name = COALESCE(NULLIF($1, ''), name),
		     url = COALESCE(NULLIF($2, ''), url),
		     type = COALESCE(NULLIF($3, ''), type),
		     interval = CASE WHEN $4 > 0 THEN $4 ELSE interval END,
		     timeout = CASE WHEN $5 > 0 THEN $5 ELSE timeout END,
		     expected_status = CASE WHEN $6 > 0 THEN $6 ELSE expected_status END,
		     max_retries = CASE WHEN $7 > 0 THEN $7 ELSE max_retries END,
		     group_name = $8,
		     labels = $9,
		     dns_record_type = COALESCE(NULLIF($10, ''), dns_record_type),
		     dns_expected_ip = $11,
		     ssl_warning_days = CASE WHEN $12 > 0 THEN $12 ELSE ssl_warning_days END,
		     grpc_service = $13,
		     grpc_method = $14,
		     db_driver = COALESCE(NULLIF($15, ''), db_driver),
		     db_connection_string = CASE WHEN $16 <> '' THEN $16 ELSE db_connection_string END,
		     updated_at = NOW()
		 WHERE id = $17
		 RETURNING `+monitorCols,
		req.Name, req.URL, req.Type, req.Interval, req.Timeout, req.ExpectedStatus, req.MaxRetries,
		strings.TrimSpace(req.GroupName), pq.Array(req.Labels),
		req.DNSRecordType, req.DNSExpectedIP, req.SSLWarningDays,
		req.GRPCService, req.GRPCMethod,
		req.DBDriver, encDSN, id,
	).StructScan(&monitor)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "monitor not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update monitor")
	}

	maskMonitor(&monitor)
	return c.JSON(http.StatusOK, echo.Map{"data": monitor})
}

func (h *MonitorHandler) Delete(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid monitor id")
	}

	result, err := h.db.ExecContext(c.Request().Context(), `DELETE FROM monitors WHERE id = $1`, id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to delete monitor")
	}
	rows, _ := result.RowsAffected()
	if rows == 0 {
		return echo.NewHTTPError(http.StatusNotFound, "monitor not found")
	}

	return c.JSON(http.StatusOK, echo.Map{"message": "monitor deleted"})
}

type monitorLogRow struct {
	ID           int64     `db:"id" json:"id"`
	MonitorID    int64     `db:"monitor_id" json:"monitor_id"`
	Status       string    `db:"status" json:"status"`
	ResponseTime int       `db:"response_time" json:"response_time"`
	StatusCode   *int      `db:"status_code" json:"status_code"`
	Message      string    `db:"message" json:"message"`
	CheckedAt    time.Time `db:"checked_at" json:"checked_at"`
}

func (h *MonitorHandler) Logs(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid monitor id")
	}

	limit := 50
	if l := c.QueryParam("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 200 {
			limit = parsed
		}
	}

	var logs []monitorLogRow
	err = h.db.SelectContext(c.Request().Context(), &logs,
		`SELECT id, monitor_id, status, response_time, status_code, message, checked_at
		 FROM monitor_logs WHERE monitor_id = $1
		 ORDER BY checked_at DESC LIMIT $2`, id, limit)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to fetch logs")
	}
	if logs == nil {
		logs = []monitorLogRow{}
	}

	return c.JSON(http.StatusOK, echo.Map{"data": logs})
}

type bulkUpdateRequest struct {
	IDs            []int64  `json:"ids"`
	Type           string   `json:"type"`
	Interval       int      `json:"interval"`
	Timeout        int      `json:"timeout"`
	ExpectedStatus int      `json:"expected_status"`
	MaxRetries     int      `json:"max_retries"`
	GroupName      *string  `json:"group_name"`
	Labels         []string `json:"labels"`
	SetLabels      bool     `json:"set_labels"`
	Favorite       bool     `json:"favorite"`
	SetFavorite    bool     `json:"set_favorite"`
}

func (h *MonitorHandler) BulkUpdate(c echo.Context) error {
	var req bulkUpdateRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}
	if len(req.IDs) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "ids must not be empty")
	}

	// Build SET clauses dynamically based on which fields are provided
	setClauses := []string{"updated_at = NOW()"}
	args := []interface{}{}
	argIdx := 1

	if req.Type != "" {
		setClauses = append(setClauses, fmt.Sprintf("type = $%d", argIdx))
		args = append(args, req.Type)
		argIdx++
	}
	if req.Interval > 0 {
		setClauses = append(setClauses, fmt.Sprintf("interval = $%d", argIdx))
		args = append(args, req.Interval)
		argIdx++
	}
	if req.Timeout > 0 {
		setClauses = append(setClauses, fmt.Sprintf("timeout = $%d", argIdx))
		args = append(args, req.Timeout)
		argIdx++
	}
	if req.ExpectedStatus > 0 {
		setClauses = append(setClauses, fmt.Sprintf("expected_status = $%d", argIdx))
		args = append(args, req.ExpectedStatus)
		argIdx++
	}
	if req.MaxRetries > 0 {
		setClauses = append(setClauses, fmt.Sprintf("max_retries = $%d", argIdx))
		args = append(args, req.MaxRetries)
		argIdx++
	}
	if req.GroupName != nil {
		setClauses = append(setClauses, fmt.Sprintf("group_name = $%d", argIdx))
		args = append(args, strings.TrimSpace(*req.GroupName))
		argIdx++
	}
	if req.SetLabels {
		if req.Labels == nil {
			req.Labels = []string{}
		}
		setClauses = append(setClauses, fmt.Sprintf("labels = $%d", argIdx))
		args = append(args, pq.Array(req.Labels))
		argIdx++
	}
	if req.SetFavorite {
		setClauses = append(setClauses, fmt.Sprintf("favorite = $%d", argIdx))
		args = append(args, req.Favorite)
		argIdx++
	}

	if len(setClauses) == 1 {
		// only updated_at — nothing to do
		return c.JSON(http.StatusOK, echo.Map{"message": "no fields to update", "updated": 0})
	}

	// Build IN clause for ids
	idPlaceholders := make([]string, len(req.IDs))
	for i, id := range req.IDs {
		idPlaceholders[i] = fmt.Sprintf("$%d", argIdx)
		args = append(args, id)
		argIdx++
	}

	query := fmt.Sprintf(
		"UPDATE monitors SET %s WHERE id IN (%s)",
		strings.Join(setClauses, ", "),
		strings.Join(idPlaceholders, ", "),
	)

	result, err := h.db.ExecContext(c.Request().Context(), query, args...)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to bulk update monitors: "+err.Error())
	}
	updated, _ := result.RowsAffected()

	return c.JSON(http.StatusOK, echo.Map{"message": "monitors updated", "updated": updated})
}

type setFavoriteRequest struct {
	Favorite bool `json:"favorite"`
}

func (h *MonitorHandler) SetFavorite(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid monitor id")
	}

	var req setFavoriteRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	var monitor monitorRow
	err = h.db.QueryRowxContext(c.Request().Context(),
		`UPDATE monitors SET favorite = $1, updated_at = NOW() WHERE id = $2 RETURNING `+monitorCols,
		req.Favorite, id,
	).StructScan(&monitor)
	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "monitor not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update favorite")
	}

	maskMonitor(&monitor)
	return c.JSON(http.StatusOK, echo.Map{"data": monitor})
}

type setVisibilityRequest struct {
	Public bool `json:"public"`
}

// SetVisibility toggles the public flag and auto-generates a slug when enabling.
func (h *MonitorHandler) SetVisibility(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid monitor id")
	}

	var req setVisibilityRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	var monitor monitorRow
	if req.Public {
		// Generate slug from name if not already set
		slug := fmt.Sprintf("monitor-%d", id)
		err = h.db.QueryRowxContext(c.Request().Context(),
			`UPDATE monitors
			 SET public = true,
			     public_slug = COALESCE(public_slug, $1),
			     updated_at = NOW()
			 WHERE id = $2
			 RETURNING `+monitorCols,
			slug, id,
		).StructScan(&monitor)
	} else {
		err = h.db.QueryRowxContext(c.Request().Context(),
			`UPDATE monitors
			 SET public = false,
			     updated_at = NOW()
			 WHERE id = $1
			 RETURNING `+monitorCols,
			id,
		).StructScan(&monitor)
	}

	if err != nil {
		if err == sql.ErrNoRows {
			return echo.NewHTTPError(http.StatusNotFound, "monitor not found")
		}
		return echo.NewHTTPError(http.StatusInternalServerError, "failed to update visibility")
	}

	maskMonitor(&monitor)
	return c.JSON(http.StatusOK, echo.Map{"data": monitor})
}

// ── Test Connection ───────────────────────────────────────────────────────────
// POST /api/v1/monitors/test
//
// Runs a single check using the same logic as the scheduler, but makes no DB
// writes. Returns the check result so the user can verify config before saving.
//
// For database monitors being edited: if db_connection_string is blank, the
// handler looks up the existing encrypted DSN from the DB (identified by the
// optional monitor_id field) so the test can run against stored credentials
// without the client ever receiving the plaintext.

type testConnectionRequest struct {
	// Optional — if set, the stored DSN is used as fallback when
	// db_connection_string is blank (edit flow for database monitors).
	MonitorID int64 `json:"monitor_id"`

	// Mirror of createMonitorRequest fields needed to build a transient monitor.
	Type           string `json:"type"`
	URL            string `json:"url"`
	Timeout        int    `json:"timeout"`
	ExpectedStatus int    `json:"expected_status"`
	// DNS
	DNSRecordType string `json:"dns_record_type"`
	DNSExpectedIP string `json:"dns_expected_ip"`
	// SSL
	SSLWarningDays int `json:"ssl_warning_days"`
	// gRPC
	GRPCService string `json:"grpc_service"`
	GRPCMethod  string `json:"grpc_method"`
	// Database
	DBDriver           string `json:"db_driver"`
	DBConnectionString string `json:"db_connection_string"` // plaintext from client
}

type testConnectionResponse struct {
	Success      bool   `json:"success"`
	Status       string `json:"status"`
	ResponseTime int    `json:"response_time"`
	Message      string `json:"message"`
}

func (h *MonitorHandler) TestConnection(c echo.Context) error {
	var req testConnectionRequest
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request body")
	}

	if req.Type == "" {
		req.Type = "http"
	}
	timeout := req.Timeout
	if timeout <= 0 {
		timeout = 30
	}

	// Build a transient monitor — no ID, no DB row needed.
	mon := &models.Monitor{
		Type:           models.MonitorType(req.Type),
		URL:            req.URL,
		Timeout:        timeout,
		ExpectedStatus: req.ExpectedStatus,
		DNSRecordType:  req.DNSRecordType,
		DNSExpectedIP:  req.DNSExpectedIP,
		SSLWarningDays: req.SSLWarningDays,
		GRPCService:    req.GRPCService,
		GRPCMethod:     req.GRPCMethod,
		DBDriver:       req.DBDriver,
	}
	if mon.SSLWarningDays <= 0 {
		mon.SSLWarningDays = 30
	}

	// For database monitors, resolve the encrypted DSN.
	if req.Type == "database" {
		if req.DBConnectionString != "" {
			// Client sent a plaintext DSN — encrypt it ephemerally for the checker.
			enc, err := crypto.Encrypt(h.encKey, req.DBConnectionString)
			if err != nil {
				return echo.NewHTTPError(http.StatusInternalServerError, "failed to encrypt connection string for test")
			}
			mon.DBConnectionString = enc
		} else if req.MonitorID > 0 {
			// Edit flow: no new DSN provided — load the stored ciphertext.
			var storedDSN string
			err := h.db.QueryRowContext(c.Request().Context(),
				`SELECT db_connection_string FROM monitors WHERE id = $1`, req.MonitorID,
			).Scan(&storedDSN)
			if err != nil {
				if err == sql.ErrNoRows {
					return echo.NewHTTPError(http.StatusNotFound, "monitor not found")
				}
				return echo.NewHTTPError(http.StatusInternalServerError, "failed to load stored connection string")
			}
			if storedDSN == "" {
				return echo.NewHTTPError(http.StatusBadRequest, "no connection string stored for this monitor — provide db_connection_string to test")
			}
			mon.DBConnectionString = storedDSN
		} else {
			return echo.NewHTTPError(http.StatusBadRequest, "db_connection_string is required for database monitor test")
		}
	}

	// Pick the right checker.
	checkers := map[models.MonitorType]checker.Checker{
		models.MonitorTypeHTTP:     checker.NewHTTPChecker(),
		models.MonitorTypeTCP:      checker.NewTCPChecker(),
		models.MonitorTypePing:     checker.NewPingChecker(),
		models.MonitorTypeDNS:      checker.NewDNSChecker(),
		models.MonitorTypeSSL:      checker.NewSSLChecker(),
		models.MonitorTypeGRPC:     checker.NewGRPCChecker(),
		models.MonitorTypeUDP:      checker.NewUDPChecker(),
		models.MonitorTypeDatabase: checker.NewDatabaseChecker(h.encKey),
	}

	chk, ok := checkers[mon.Type]
	if !ok {
		chk = checkers[models.MonitorTypeHTTP]
	}

	checkCtx, cancel := context.WithTimeout(c.Request().Context(), time.Duration(timeout)*time.Second)
	defer cancel()

	result, err := chk.Check(checkCtx, mon)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, fmt.Sprintf("check failed: %v", err))
	}

	return c.JSON(http.StatusOK, testConnectionResponse{
		Success:      result.Status == models.MonitorStatusUp || result.Status == models.MonitorStatusDegraded,
		Status:       string(result.Status),
		ResponseTime: result.ResponseTime,
		Message:      result.Message,
	})
}
