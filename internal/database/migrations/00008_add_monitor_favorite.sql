-- +goose Up
ALTER TABLE monitors ADD COLUMN favorite BOOLEAN NOT NULL DEFAULT FALSE;

-- +goose Down
ALTER TABLE monitors DROP COLUMN favorite;
