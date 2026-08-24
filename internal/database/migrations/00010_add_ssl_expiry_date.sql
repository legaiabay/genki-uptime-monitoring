-- +goose Up
ALTER TABLE monitors ADD COLUMN ssl_expiry_date TIMESTAMPTZ;

-- +goose Down
ALTER TABLE monitors DROP COLUMN ssl_expiry_date;
