-- +goose Up
-- +goose StatementBegin
ALTER TABLE monitors
    ADD COLUMN IF NOT EXISTS db_driver            VARCHAR(20)  NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS db_connection_string TEXT         NOT NULL DEFAULT '';
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE monitors
    DROP COLUMN IF EXISTS db_driver,
    DROP COLUMN IF EXISTS db_connection_string;
-- +goose StatementEnd
