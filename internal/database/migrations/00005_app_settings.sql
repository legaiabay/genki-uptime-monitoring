-- +goose Up
-- +goose StatementBegin

CREATE TABLE IF NOT EXISTS app_settings (
    key        VARCHAR(100) PRIMARY KEY,
    value      TEXT         NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed default values
INSERT INTO app_settings (key, value) VALUES
    ('site_name',        'Genki'),
    ('timezone',         'Asia/Jakarta'),
    ('default_interval', '60'),
    ('retention_days',   '90')
ON CONFLICT (key) DO NOTHING;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS app_settings;
-- +goose StatementEnd
