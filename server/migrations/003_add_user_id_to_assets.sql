-- +goose Up
ALTER TABLE assets ADD COLUMN user_id TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE assets DROP COLUMN user_id;
