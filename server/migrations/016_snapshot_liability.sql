-- +goose Up
ALTER TABLE portfolio_snapshots ADD COLUMN total_liability_cny REAL NOT NULL DEFAULT 0;

-- +goose Down
-- SQLite 不支持 DROP COLUMN (兼容旧版)，不回滚此字段
SELECT 1;
