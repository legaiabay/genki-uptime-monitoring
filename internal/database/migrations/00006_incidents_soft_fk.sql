-- +goose Up
-- +goose StatementBegin

-- Change incidents.monitor_id FK from CASCADE to SET NULL
-- so incidents are preserved when a monitor is deleted

ALTER TABLE incidents
  DROP CONSTRAINT IF EXISTS incidents_monitor_id_fkey;

ALTER TABLE incidents
  ALTER COLUMN monitor_id DROP NOT NULL;

ALTER TABLE incidents
  ADD CONSTRAINT incidents_monitor_id_fkey
  FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE SET NULL;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

ALTER TABLE incidents
  DROP CONSTRAINT IF EXISTS incidents_monitor_id_fkey;

ALTER TABLE incidents
  ALTER COLUMN monitor_id SET NOT NULL;

ALTER TABLE incidents
  ADD CONSTRAINT incidents_monitor_id_fkey
  FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE;

-- +goose StatementEnd
