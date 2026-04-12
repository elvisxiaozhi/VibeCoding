-- +goose Up
CREATE TABLE assets (
    id            TEXT PRIMARY KEY,
    symbol        TEXT    NOT NULL,
    category      TEXT    NOT NULL CHECK (category IN ('stock', 'etf', 'crypto', 'cash')),
    cost_basis    REAL    NOT NULL,
    current_price REAL    NOT NULL,
    quantity      REAL    NOT NULL,
    currency      TEXT    NOT NULL DEFAULT 'CNY',
    created_at    TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL
);

-- +goose Down
DROP TABLE IF EXISTS assets;
