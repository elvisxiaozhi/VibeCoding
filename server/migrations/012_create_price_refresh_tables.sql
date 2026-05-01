-- +goose Up
CREATE TABLE price_refresh_settings (
    user_id                   TEXT PRIMARY KEY,
    auto_refresh_enabled      INTEGER NOT NULL DEFAULT 1,
    refresh_interval_minutes  INTEGER NOT NULL DEFAULT 30,
    refresh_on_dashboard_open INTEGER NOT NULL DEFAULT 1,
    updated_at                TEXT NOT NULL
);

CREATE TABLE asset_price_status (
    asset_id        TEXT PRIMARY KEY,
    user_id         TEXT NOT NULL,
    source          TEXT NOT NULL DEFAULT '',
    last_price      REAL NOT NULL DEFAULT 0,
    last_success_at TEXT NOT NULL DEFAULT '',
    last_attempt_at TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'skipped',
    error_message   TEXT NOT NULL DEFAULT '',
    updated_at      TEXT NOT NULL,
    FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
);

CREATE INDEX idx_asset_price_status_user
    ON asset_price_status(user_id, status, updated_at);

-- +goose Down
DROP TABLE IF EXISTS asset_price_status;
DROP TABLE IF EXISTS price_refresh_settings;
