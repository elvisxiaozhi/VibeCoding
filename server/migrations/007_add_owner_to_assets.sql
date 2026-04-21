-- +goose Up
ALTER TABLE assets ADD COLUMN owner TEXT NOT NULL DEFAULT 'me';

-- +goose Down
ALTER TABLE assets DROP COLUMN owner;
