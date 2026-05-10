-- +goose Up
CREATE TABLE liabilities (
    id            TEXT PRIMARY KEY,
    user_id       TEXT    NOT NULL DEFAULT '',
    name          TEXT    NOT NULL,
    category      TEXT    NOT NULL CHECK (category IN ('mortgage', 'credit_card', 'loan', 'other')),
    principal     REAL    NOT NULL,
    currency      TEXT    NOT NULL DEFAULT 'CNY',
    interest_rate REAL    NOT NULL DEFAULT 0,
    due_date      TEXT    NOT NULL DEFAULT '',
    owner         TEXT    NOT NULL DEFAULT 'me',
    note          TEXT    NOT NULL DEFAULT '',
    created_at    TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL
);

-- +goose Down
DROP TABLE IF EXISTS liabilities;
