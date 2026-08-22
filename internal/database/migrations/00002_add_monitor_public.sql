-- +goose Up
-- +goose StatementBegin
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS public     BOOLEAN      NOT NULL DEFAULT FALSE;
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS public_slug VARCHAR(100) UNIQUE;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE monitors DROP COLUMN IF EXISTS public;
ALTER TABLE monitors DROP COLUMN IF EXISTS public_slug;
-- +goose StatementEnd
