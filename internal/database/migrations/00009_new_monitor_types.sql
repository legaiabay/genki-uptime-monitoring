-- +goose Up
ALTER TABLE monitors ADD COLUMN dns_record_type  VARCHAR(10)  NOT NULL DEFAULT 'A';
ALTER TABLE monitors ADD COLUMN dns_expected_ip  TEXT         NOT NULL DEFAULT '';
ALTER TABLE monitors ADD COLUMN ssl_warning_days INT          NOT NULL DEFAULT 30;
ALTER TABLE monitors ADD COLUMN grpc_service     TEXT         NOT NULL DEFAULT '';
ALTER TABLE monitors ADD COLUMN grpc_method      TEXT         NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE monitors DROP COLUMN grpc_method;
ALTER TABLE monitors DROP COLUMN grpc_service;
ALTER TABLE monitors DROP COLUMN ssl_warning_days;
ALTER TABLE monitors DROP COLUMN dns_expected_ip;
ALTER TABLE monitors DROP COLUMN dns_record_type;
