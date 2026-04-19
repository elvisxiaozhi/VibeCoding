-- +goose Up
ALTER TABLE assets ADD COLUMN dividends REAL NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE assets DROP COLUMN dividends;
