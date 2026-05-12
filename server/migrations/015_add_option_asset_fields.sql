-- +goose Up
-- +goose StatementBegin
CREATE TABLE assets_new (
    id                  TEXT PRIMARY KEY,
    symbol              TEXT    NOT NULL,
    category            TEXT    NOT NULL CHECK (category IN ('stock', 'etf', 'gold', 'crypto', 'cash', 'currency', 'provident_fund', 'option')),
    cost_basis          REAL    NOT NULL,
    current_price       REAL    NOT NULL,
    quantity            REAL    NOT NULL,
    currency            TEXT    NOT NULL DEFAULT 'CNY',
    created_at          TEXT    NOT NULL,
    updated_at          TEXT    NOT NULL,
    user_id             TEXT    NOT NULL DEFAULT '',
    purchased_at        TEXT    NOT NULL DEFAULT '',
    market              TEXT    NOT NULL DEFAULT 'cn',
    dividends           REAL    NOT NULL DEFAULT 0,
    owner               TEXT    NOT NULL DEFAULT 'me',
    note                TEXT    NOT NULL DEFAULT '',
    option_type         TEXT    NOT NULL DEFAULT '',
    underlying_symbol   TEXT    NOT NULL DEFAULT '',
    strike_price        REAL    NOT NULL DEFAULT 0,
    expiry_date         TEXT    NOT NULL DEFAULT '',
    contract_multiplier REAL    NOT NULL DEFAULT 1
);

INSERT INTO assets_new (
    id, symbol, category, cost_basis, current_price, quantity, currency, created_at, updated_at,
    user_id, purchased_at, market, dividends, owner, note,
    option_type, underlying_symbol, strike_price, expiry_date, contract_multiplier
)
SELECT
    id, symbol, category, cost_basis, current_price, quantity, currency, created_at, updated_at,
    user_id, purchased_at, market, dividends, owner, note,
    '', '', 0, '', 1
FROM assets;

DROP TABLE assets;
ALTER TABLE assets_new RENAME TO assets;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
CREATE TABLE assets_old (
    id            TEXT PRIMARY KEY,
    symbol        TEXT    NOT NULL,
    category      TEXT    NOT NULL CHECK (category IN ('stock', 'etf', 'gold', 'crypto', 'cash', 'currency', 'provident_fund')),
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

INSERT INTO assets_old (
    id, symbol, category, cost_basis, current_price, quantity, currency, created_at, updated_at,
    user_id, purchased_at, market, dividends, owner, note
)
SELECT
    id, symbol, category, cost_basis, current_price, quantity, currency, created_at, updated_at,
    user_id, purchased_at, market, dividends, owner, note
FROM assets
WHERE category <> 'option';

DROP TABLE assets;
ALTER TABLE assets_old RENAME TO assets;
-- +goose StatementEnd
