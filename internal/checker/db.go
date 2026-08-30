package checker

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	// MySQL / MariaDB driver — registers "mysql" with database/sql
	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
	// PostgreSQL driver — lib/pq already in the project; registers "postgres"
	_ "github.com/lib/pq"
	"go.mongodb.org/mongo-driver/v2/mongo"
	mongoopts "go.mongodb.org/mongo-driver/v2/mongo/options"

	"github.com/legaiabay/genki-uptime-monitoring/internal/crypto"
	"github.com/legaiabay/genki-uptime-monitoring/internal/models"
)

// Recommended default timeouts per driver when monitor.Timeout is not set.
// These are intentionally conservative — fast enough to fail quickly without
// hanging the scheduler goroutine pool.
var dbDefaultTimeouts = map[string]time.Duration{
	"mysql":      10 * time.Second,
	"mariadb":    10 * time.Second,
	"postgresql": 10 * time.Second,
	"redis":      5 * time.Second,
	"mongodb":    10 * time.Second,
}

// DatabaseChecker verifies that a database is reachable and accepts
// authentication. It performs a lightweight ping — no reads or writes.
//
// Required monitor fields:
//   - DBDriver           — one of: mysql, mariadb, postgresql, redis, mongodb
//   - DBConnectionString — AES-256-GCM encrypted DSN (hex); decrypted at check
//     time using the encKey passed to NewDatabaseChecker.
//
// DSN format per driver:
//
//	mysql / mariadb  : user:pass@tcp(host:3306)/dbname
//	postgresql       : postgres://user:pass@host:5432/dbname?sslmode=disable
//	redis            : redis://:pass@host:6379/0   OR   host:6379 (no auth)
//	mongodb          : mongodb://user:pass@host:27017/dbname
type DatabaseChecker struct {
	encKey string // hex-encoded 32-byte AES key from config.DBEncryptionKey
}

func NewDatabaseChecker(encKey string) *DatabaseChecker {
	return &DatabaseChecker{encKey: encKey}
}

func (c *DatabaseChecker) Check(ctx context.Context, monitor *models.Monitor) (*Result, error) {
	// ── Decrypt connection string ─────────────────────────────────────────────
	dsn, err := crypto.Decrypt(c.encKey, monitor.DBConnectionString)
	if err != nil {
		return &Result{
			MonitorID: monitor.ID,
			Status:    models.MonitorStatusDown,
			Message:   fmt.Sprintf("connection string decryption failed: %v", err),
			CheckedAt: time.Now(),
		}, nil
	}

	// ── Build check context with per-monitor timeout ──────────────────────────
	timeout := time.Duration(monitor.Timeout) * time.Second
	if timeout <= 0 {
		if d, ok := dbDefaultTimeouts[monitor.DBDriver]; ok {
			timeout = d
		} else {
			timeout = 10 * time.Second
		}
	}
	checkCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	// ── Dispatch to driver-specific ping ─────────────────────────────────────
	switch monitor.DBDriver {
	case "mysql", "mariadb":
		return c.checkSQL(checkCtx, monitor, "mysql", dsn)
	case "postgresql":
		return c.checkSQL(checkCtx, monitor, "postgres", dsn)
	case "redis":
		return c.checkRedis(checkCtx, monitor, dsn)
	case "mongodb":
		return c.checkMongo(checkCtx, monitor, dsn)
	default:
		return &Result{
			MonitorID: monitor.ID,
			Status:    models.MonitorStatusDown,
			Message:   fmt.Sprintf("unsupported database driver: %q", monitor.DBDriver),
			CheckedAt: time.Now(),
		}, nil
	}
}

// ── MySQL / MariaDB / PostgreSQL (database/sql ping) ─────────────────────────

func (c *DatabaseChecker) checkSQL(ctx context.Context, monitor *models.Monitor, driverName, dsn string) (*Result, error) {
	start := time.Now()

	db, err := sql.Open(driverName, dsn)
	if err != nil {
		return &Result{
			MonitorID:    monitor.ID,
			Status:       models.MonitorStatusDown,
			ResponseTime: int(time.Since(start).Milliseconds()),
			Message:      fmt.Sprintf("open connection: %v", err),
			CheckedAt:    time.Now(),
		}, nil
	}
	defer db.Close()

	// Limit pool so each check is a fresh single connection.
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(0)

	if err := db.PingContext(ctx); err != nil {
		return &Result{
			MonitorID:    monitor.ID,
			Status:       models.MonitorStatusDown,
			ResponseTime: int(time.Since(start).Milliseconds()),
			Message:      fmt.Sprintf("ping failed: %v", err),
			CheckedAt:    time.Now(),
		}, nil
	}

	responseTime := int(time.Since(start).Milliseconds())
	label := monitor.DBDriver
	if label == "" {
		label = driverName
	}
	return &Result{
		MonitorID:    monitor.ID,
		Status:       models.MonitorStatusUp,
		ResponseTime: responseTime,
		Message:      fmt.Sprintf("%s ping succeeded (%dms)", label, responseTime),
		CheckedAt:    time.Now(),
	}, nil
}

// ── Redis ─────────────────────────────────────────────────────────────────────

func (c *DatabaseChecker) checkRedis(ctx context.Context, monitor *models.Monitor, dsn string) (*Result, error) {
	start := time.Now()

	opts, err := redis.ParseURL(dsn)
	if err != nil {
		// Fallback: treat dsn as bare host:port with no auth.
		opts = &redis.Options{Addr: dsn}
	}

	// Enforce the monitor timeout at the client level too.
	opts.DialTimeout = time.Duration(monitor.Timeout) * time.Second
	opts.ReadTimeout = opts.DialTimeout
	opts.WriteTimeout = opts.DialTimeout

	client := redis.NewClient(opts)
	defer client.Close()

	if err := client.Ping(ctx).Err(); err != nil {
		return &Result{
			MonitorID:    monitor.ID,
			Status:       models.MonitorStatusDown,
			ResponseTime: int(time.Since(start).Milliseconds()),
			Message:      fmt.Sprintf("redis ping failed: %v", err),
			CheckedAt:    time.Now(),
		}, nil
	}

	responseTime := int(time.Since(start).Milliseconds())
	return &Result{
		MonitorID:    monitor.ID,
		Status:       models.MonitorStatusUp,
		ResponseTime: responseTime,
		Message:      fmt.Sprintf("redis ping succeeded (%dms)", responseTime),
		CheckedAt:    time.Now(),
	}, nil
}

// ── MongoDB ───────────────────────────────────────────────────────────────────

func (c *DatabaseChecker) checkMongo(ctx context.Context, monitor *models.Monitor, dsn string) (*Result, error) {
	start := time.Now()

	serverTimeout := time.Duration(monitor.Timeout) * time.Second
	connectTimeout := serverTimeout

	clientOpts := mongoopts.Client().
		ApplyURI(dsn).
		SetServerSelectionTimeout(serverTimeout).
		SetConnectTimeout(connectTimeout)

	client, err := mongo.Connect(clientOpts)
	if err != nil {
		return &Result{
			MonitorID:    monitor.ID,
			Status:       models.MonitorStatusDown,
			ResponseTime: int(time.Since(start).Milliseconds()),
			Message:      fmt.Sprintf("mongodb connect failed: %v", err),
			CheckedAt:    time.Now(),
		}, nil
	}
	defer client.Disconnect(ctx) //nolint:errcheck

	if err := client.Ping(ctx, nil); err != nil {
		return &Result{
			MonitorID:    monitor.ID,
			Status:       models.MonitorStatusDown,
			ResponseTime: int(time.Since(start).Milliseconds()),
			Message:      fmt.Sprintf("mongodb ping failed: %v", err),
			CheckedAt:    time.Now(),
		}, nil
	}

	responseTime := int(time.Since(start).Milliseconds())
	return &Result{
		MonitorID:    monitor.ID,
		Status:       models.MonitorStatusUp,
		ResponseTime: responseTime,
		Message:      fmt.Sprintf("mongodb ping succeeded (%dms)", responseTime),
		CheckedAt:    time.Now(),
	}, nil
}
