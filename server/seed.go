package main

import (
	"fmt"
	"log"

	"github.com/theodore/vibecoding-server/internal/model"
	"github.com/theodore/vibecoding-server/internal/store"
)

// mockAssets 与前端 src/data/mock.ts 保持一致的 10 条示例数据
var mockAssets = []model.Asset{
	{ID: "mock-600519", Symbol: "600519 贵州茅台", Category: model.CategoryStock, CostBasis: 1680, CurrentPrice: 1582.4, Quantity: 20, Currency: "CNY", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
	{ID: "mock-00700", Symbol: "00700 腾讯控股", Category: model.CategoryStock, CostBasis: 320, CurrentPrice: 385.6, Quantity: 100, Currency: "CNY", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
	{ID: "mock-300750", Symbol: "300750 宁德时代", Category: model.CategoryStock, CostBasis: 210, CurrentPrice: 176.8, Quantity: 150, Currency: "CNY", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
	{ID: "mock-510300", Symbol: "510300 沪深300ETF", Category: model.CategoryETF, CostBasis: 4.18, CurrentPrice: 4.05, Quantity: 5000, Currency: "CNY", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
	{ID: "mock-513100", Symbol: "513100 纳指ETF", Category: model.CategoryETF, CostBasis: 1.52, CurrentPrice: 1.684, Quantity: 8000, Currency: "CNY", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
	{ID: "mock-btc", Symbol: "BTC 比特币", Category: model.CategoryCrypto, CostBasis: 420000, CurrentPrice: 586000, Quantity: 0.15, Currency: "CNY", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
	{ID: "mock-eth", Symbol: "ETH 以太坊", Category: model.CategoryCrypto, CostBasis: 18200, CurrentPrice: 22450, Quantity: 2, Currency: "CNY", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
	{ID: "mock-sol", Symbol: "SOL Solana", Category: model.CategoryCrypto, CostBasis: 920, CurrentPrice: 1210, Quantity: 30, Currency: "CNY", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
	{ID: "mock-cash-demand", Symbol: "活期存款", Category: model.CategoryCash, CostBasis: 1, CurrentPrice: 1, Quantity: 50000, Currency: "CNY", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
	{ID: "mock-cash-mmf", Symbol: "货币基金", Category: model.CategoryCash, CostBasis: 1, CurrentPrice: 1.0023, Quantity: 80000, Currency: "CNY", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
}

// seed 检查数据库是否为空，为空则插入 Mock 数据
func seed(s *store.Store) error {
	n, err := s.Count()
	if err != nil {
		return fmt.Errorf("seed count: %w", err)
	}
	if n > 0 {
		log.Printf("seed: 跳过，数据库已有 %d 条资产\n", n)
		return nil
	}
	for _, a := range mockAssets {
		if err := s.CreateAsset(a); err != nil {
			return fmt.Errorf("seed insert %s: %w", a.ID, err)
		}
	}
	log.Printf("seed: 已插入 %d 条 Mock 资产\n", len(mockAssets))
	return nil
}
