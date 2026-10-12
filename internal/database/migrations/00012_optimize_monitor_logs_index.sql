-- +goose Up
-- +goose StatementBegin

-- Composite index for the common query pattern:
-- "latest log entry per monitor" (ORDER BY checked_at DESC LIMIT 1 WHERE monitor_id = ?)
-- Without this, each per-monitor lookup must sort all rows for that monitor.
CREATE INDEX IF NOT EXISTS idx_monitor_logs_monitor_id_checked_at
    ON monitor_logs(monitor_id, checked_at DESC);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_monitor_logs_monitor_id_checked_at;
-- +goose StatementEnd
