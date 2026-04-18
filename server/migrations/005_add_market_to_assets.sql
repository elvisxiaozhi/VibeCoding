-- +goose Up
ALTER TABLE assets ADD COLUMN market TEXT NOT NULL DEFAULT 'cn';

-- 根据 category 推断 market：crypto/currency 中的加密相关 → crypto，其余保持 cn
UPDATE assets SET market = 'crypto' WHERE category IN ('crypto');
UPDATE assets SET market = 'crypto' WHERE category = 'currency' AND symbol LIKE '%BTC%';
UPDATE assets SET market = 'crypto' WHERE category = 'currency' AND symbol LIKE '%USDT%';
UPDATE assets SET market = 'crypto' WHERE category = 'currency' AND symbol LIKE '%USDC%';
UPDATE assets SET market = 'us' WHERE category = 'currency' AND symbol LIKE '%USD%' AND market = 'cn';
UPDATE assets SET market = 'hk' WHERE category = 'currency' AND symbol LIKE '%HKD%';

-- +goose Down
ALTER TABLE assets DROP COLUMN market;
