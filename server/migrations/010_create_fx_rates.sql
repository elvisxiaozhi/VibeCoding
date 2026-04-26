-- +goose Up
CREATE TABLE fx_rates (
    currency TEXT NOT NULL,
    date     TEXT NOT NULL,
    rate     REAL NOT NULL,
    PRIMARY KEY (currency, date)
);

-- +goose Down
DROP TABLE IF EXISTS fx_rates;
