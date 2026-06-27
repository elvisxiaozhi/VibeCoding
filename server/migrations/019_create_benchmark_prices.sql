-- +goose Up
-- 基准指数日线收盘价缓存。读时懒填充：未命中则从外部源拉取后回写（同 fx_rates 模式）。
-- 仅存储，不做派生；组合 vs 基准的对照 XIRR 全部在前端 lib/benchmark.ts 计算。
CREATE TABLE benchmark_prices (
    symbol TEXT NOT NULL,          -- 000300（沪深300）/ SPX（标普500）
    date   TEXT NOT NULL,          -- YYYY-MM-DD（指数原币计价，不在此换算 CNY）
    close  REAL NOT NULL,
    PRIMARY KEY (symbol, date)
);

CREATE INDEX idx_benchmark_prices_symbol_date ON benchmark_prices(symbol, date);

-- +goose Down
DROP TABLE IF EXISTS benchmark_prices;
