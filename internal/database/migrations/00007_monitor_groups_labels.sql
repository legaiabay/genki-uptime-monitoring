-- +goose Up
-- +goose StatementBegin
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS group_name VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS labels     TEXT[]       NOT NULL DEFAULT '{}';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE monitors DROP COLUMN IF EXISTS group_name;
ALTER TABLE monitors DROP COLUMN IF EXISTS labels;
-- +goose StatementEnd
