-- +goose Up
-- +goose StatementBegin

-- Add unique constraint on type if it doesn't exist yet
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notification_channels_type_key'
      AND conrelid = 'notification_channels'::regclass
  ) THEN
    ALTER TABLE notification_channels ADD CONSTRAINT notification_channels_type_key UNIQUE (type);
  END IF;
END$$;

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE notification_channels DROP CONSTRAINT IF EXISTS notification_channels_type_key;
-- +goose StatementEnd
