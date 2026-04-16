-- +goose Up
ALTER TABLE assets ADD COLUMN purchased_at TEXT NOT NULL DEFAULT '';

-- 已有数据：用 created_at 作为默认 purchased_at
UPDATE assets SET purchased_at = created_at WHERE purchased_at = '';

-- +goose Down
ALTER TABLE assets DROP COLUMN purchased_at;
