-- +goose Up
-- +goose StatementBegin

CREATE TABLE IF NOT EXISTS users (
    id         BIGSERIAL PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    email      VARCHAR(255) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    role       VARCHAR(50)  NOT NULL DEFAULT 'member',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS api_keys (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       VARCHAR(255) NOT NULL,
    key        VARCHAR(255) NOT NULL UNIQUE,
    last_used  TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monitors (
    id                 BIGSERIAL PRIMARY KEY,
    name               VARCHAR(255)   NOT NULL,
    url                TEXT           NOT NULL,
    type               VARCHAR(50)    NOT NULL DEFAULT 'http',
    interval           INT            NOT NULL DEFAULT 60,
    timeout            INT            NOT NULL DEFAULT 30,
    status             VARCHAR(50)    NOT NULL DEFAULT 'pending',
    active             BOOLEAN        NOT NULL DEFAULT TRUE,
    expected_status    INT            NOT NULL DEFAULT 200,
    max_retries        INT            NOT NULL DEFAULT 1,
    uptime_percentage  NUMERIC(5, 2)  NOT NULL DEFAULT 0,
    last_checked_at    TIMESTAMPTZ,
    created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monitor_logs (
    id            BIGSERIAL PRIMARY KEY,
    monitor_id    BIGINT      NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    status        VARCHAR(50) NOT NULL,
    response_time INT         NOT NULL DEFAULT 0,
    status_code   INT,
    message       TEXT        NOT NULL DEFAULT '',
    checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_monitor_logs_monitor_id ON monitor_logs(monitor_id);
CREATE INDEX IF NOT EXISTS idx_monitor_logs_checked_at ON monitor_logs(checked_at DESC);

CREATE TABLE IF NOT EXISTS incidents (
    id          BIGSERIAL PRIMARY KEY,
    monitor_id  BIGINT      NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    description TEXT         NOT NULL DEFAULT '',
    status      VARCHAR(50)  NOT NULL DEFAULT 'investigating',
    started_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_monitor_id ON incidents(monitor_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status     ON incidents(status);

CREATE TABLE IF NOT EXISTS heartbeats (
    id         BIGSERIAL PRIMARY KEY,
    monitor_id BIGINT      NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
    status     VARCHAR(50) NOT NULL,
    ping       INT         NOT NULL DEFAULT 0,
    message    TEXT        NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_heartbeats_monitor_id ON heartbeats(monitor_id);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS heartbeats;
DROP TABLE IF EXISTS incidents;
DROP TABLE IF EXISTS monitor_logs;
DROP TABLE IF EXISTS monitors;
DROP TABLE IF EXISTS api_keys;
DROP TABLE IF EXISTS users;
-- +goose StatementEnd
