-- +goose Up
-- +goose StatementBegin
CREATE TABLE assets_new (
    id            TEXT PRIMARY KEY,
    symbol        TEXT    NOT NULL,
    category      TEXT    NOT NULL CHECK (category IN ('stock', 'etf', 'gold', 'crypto', 'cash', 'currency')),
    cost_basis    REAL    NOT NULL,
    current_price REAL    NOT NULL,
    quantity      REAL    NOT NULL,
    currency      TEXT    NOT NULL DEFAULT 'CNY',
    created_at    TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL,
    user_id       TEXT    NOT NULL DEFAULT '',
    purchased_at  TEXT    NOT NULL DEFAULT '',
    market        TEXT    NOT NULL DEFAULT 'cn',
    dividends     REAL    NOT NULL DEFAULT 0,
    owner         TEXT    NOT NULL DEFAULT 'me',
    note          TEXT    NOT NULL DEFAULT ''
);

INSERT INTO assets_new (id, symbol, category, cost_basis, current_price, quantity, currency, created_at, updated_at, user_id, purchased_at, market, dividends, owner, note)
SELECT id, symbol, category, cost_basis, current_price, quantity, currency, created_at, updated_at, user_id, purchased_at, market, dividends, owner, note FROM assets;

DROP TABLE assets;
ALTER TABLE assets_new RENAME TO assets;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
CREATE TABLE assets_old (
    id            TEXT PRIMARY KEY,
    symbol        TEXT    NOT NULL,
    category      TEXT    NOT NULL CHECK (category IN ('stock', 'etf', 'crypto', 'cash')),
    cost_basis    REAL    NOT NULL,
    current_price REAL    NOT NULL,
    quantity      REAL    NOT NULL,
    currency      TEXT    NOT NULL DEFAULT 'CNY',
    created_at    TEXT    NOT NULL,
    updated_at    TEXT    NOT NULL,
    user_id       TEXT    NOT NULL DEFAULT '',
    purchased_at  TEXT    NOT NULL DEFAULT '',
    market        TEXT    NOT NULL DEFAULT 'cn',
    dividends     REAL    NOT NULL DEFAULT 0,
    owner         TEXT    NOT NULL DEFAULT 'me',
    note          TEXT    NOT NULL DEFAULT ''
);

INSERT INTO assets_old (id, symbol, category, cost_basis, current_price, quantity, currency, created_at, updated_at, user_id, purchased_at, market, dividends, owner, note)
SELECT id, symbol, category, cost_basis, current_price, quantity, currency, created_at, updated_at, user_id, purchased_at, market, dividends, owner, note FROM assets WHERE category IN ('stock', 'etf', 'crypto', 'cash');

DROP TABLE assets;
ALTER TABLE assets_old RENAME TO assets;
-- +goose StatementEnd
