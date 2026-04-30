-- +goose Up
CREATE TABLE portfolio_snapshots (
    id                 TEXT PRIMARY KEY,
    user_id            TEXT NOT NULL,
    snapshot_date      TEXT NOT NULL,
    total_value_cny    REAL NOT NULL,
    total_cost_cny     REAL NOT NULL,
    total_pnl_cny      REAL NOT NULL,
    total_dividend_cny REAL NOT NULL,
    asset_count        INTEGER NOT NULL,
    rates_json         TEXT NOT NULL DEFAULT '{}',
    assets_json        TEXT NOT NULL DEFAULT '[]',
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL,
    UNIQUE(user_id, snapshot_date)
);

CREATE TABLE portfolio_snapshot_breakdowns (
    snapshot_id TEXT NOT NULL,
    dimension   TEXT NOT NULL,
    key         TEXT NOT NULL,
    label       TEXT NOT NULL,
    value_cny   REAL NOT NULL,
    cost_cny    REAL NOT NULL,
    pnl_cny     REAL NOT NULL,
    ratio       REAL NOT NULL,
    PRIMARY KEY (snapshot_id, dimension, key),
    FOREIGN KEY (snapshot_id) REFERENCES portfolio_snapshots(id) ON DELETE CASCADE
);

CREATE INDEX idx_portfolio_snapshots_user_date
    ON portfolio_snapshots(user_id, snapshot_date);

-- +goose Down
DROP TABLE IF EXISTS portfolio_snapshot_breakdowns;
DROP TABLE IF EXISTS portfolio_snapshots;
