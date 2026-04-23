-- +goose Up
ALTER TABLE assets ADD COLUMN note TEXT NOT NULL DEFAULT '';

-- +goose Down
ALTER TABLE assets DROP COLUMN note;
