-- +goose Up
-- +goose StatementBegin

-- Replace the plain composite index (from 00012, or absent) with a covering
-- index that INCLUDEs the two columns read in the hot paths:
--
--   • response_time — fetched by the LATERAL in GET /api/v1/monitors
--   • status        — filtered by the uptime_percentage subquery in the scheduler
--
-- With both columns in the index leaf, PostgreSQL can serve both queries with
-- an index-only scan (no heap fetch), which is the primary reason the old fix
-- did not eliminate the slowness: it still required a heap page read per monitor.
--
-- ANALYZE is run immediately so the planner uses the new index right away
-- without waiting for the next AUTOVACUUM cycle.

DROP INDEX IF EXISTS idx_monitor_logs_monitor_id_checked_at;

CREATE INDEX idx_monitor_logs_monitor_id_checked_at
    ON monitor_logs(monitor_id, checked_at DESC)
    INCLUDE (response_time, status);

ANALYZE monitor_logs;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP INDEX IF EXISTS idx_monitor_logs_monitor_id_checked_at;
CREATE INDEX idx_monitor_logs_monitor_id_checked_at
    ON monitor_logs(monitor_id, checked_at DESC);
-- +goose StatementEnd
