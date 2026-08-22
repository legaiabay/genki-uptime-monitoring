-- +goose Up
-- +goose StatementBegin

CREATE TABLE IF NOT EXISTS notification_channels (
    id         BIGSERIAL    PRIMARY KEY,
    type       VARCHAR(50)  NOT NULL UNIQUE, -- 'google_chat' | 'telegram' | 'slack' | 'webhook'
    name       VARCHAR(255) NOT NULL DEFAULT '',
    enabled    BOOLEAN      NOT NULL DEFAULT TRUE,
    config     JSONB        NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS notification_channels;
-- +goose StatementEnd
