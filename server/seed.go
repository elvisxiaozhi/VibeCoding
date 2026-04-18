package main

import (
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/theodore/vibecoding-server/internal/model"
	"github.com/theodore/vibecoding-server/internal/store"
)

const (
	defaultUsername = "admin"
	defaultPassword = "admin123"
)

// seedUser 确保默认用户存在，返回其 ID
func seedUser(s *store.Store) (string, error) {
	// 已有用户则直接返回
	n, err := s.UserCount()
	if err != nil {
		return "", fmt.Errorf("seed user count: %w", err)
	}
	if n > 0 {
		id, err := s.FirstUserID()
		if err != nil {
			return "", fmt.Errorf("seed first user: %w", err)
		}
		log.Printf("seed: 跳过用户创建，已有 %d 个用户\n", n)
		return id, nil
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(defaultPassword), bcrypt.DefaultCost)
	if err != nil {
		return "", fmt.Errorf("seed bcrypt: %w", err)
	}

	user := model.User{
		ID:           uuid.NewString(),
		Username:     defaultUsername,
		PasswordHash: string(hash),
		CreatedAt:    time.Now().UTC().Format(time.RFC3339),
	}
	if err := s.CreateUser(user); err != nil {
		return "", fmt.Errorf("seed create user: %w", err)
	}
	log.Printf("seed: 已创建默认用户 %s（密码: %s）\n", defaultUsername, defaultPassword)
	return user.ID, nil
}

// mockAssets 与前端 src/data/mock.ts 保持一致的 10 条示例数据
var mockAssets = []model.Asset{
	{ID: "mock-600519", Symbol: "600519 贵州茅台", Category: model.CategoryStock, Market: model.MarketCn, CostBasis: 1680, CurrentPrice: 1582.4, Quantity: 20, Currency: "CNY", PurchasedAt: "2024-08-15", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
	{ID: "mock-00700", Symbol: "00700 腾讯控股", Category: model.CategoryStock, Market: model.MarketHk, CostBasis: 320, CurrentPrice: 385.6, Quantity: 100, Currency: "CNY", PurchasedAt: "2025-01-10", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
	{ID: "mock-300750", Symbol: "300750 宁德时代", Category: model.CategoryStock, Market: model.MarketCn, CostBasis: 210, CurrentPrice: 176.8, Quantity: 150, Currency: "CNY", PurchasedAt: "2025-06-20", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
	{ID: "mock-510300", Symbol: "510300 沪深300ETF", Category: model.CategoryETF, Market: model.MarketCn, CostBasis: 4.18, CurrentPrice: 4.05, Quantity: 5000, Currency: "CNY", PurchasedAt: "2025-03-05", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
	{ID: "mock-513100", Symbol: "513100 纳指ETF", Category: model.CategoryETF, Market: model.MarketUs, CostBasis: 1.52, CurrentPrice: 1.684, Quantity: 8000, Currency: "CNY", PurchasedAt: "2024-11-22", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
	{ID: "mock-btc", Symbol: "BTC 比特币", Category: model.CategoryCrypto, Market: model.MarketCrypto, CostBasis: 420000, CurrentPrice: 586000, Quantity: 0.15, Currency: "CNY", PurchasedAt: "2024-06-01", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
	{ID: "mock-eth", Symbol: "ETH 以太坊", Category: model.CategoryCrypto, Market: model.MarketCrypto, CostBasis: 18200, CurrentPrice: 22450, Quantity: 2, Currency: "CNY", PurchasedAt: "2025-02-14", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
	{ID: "mock-sol", Symbol: "SOL Solana", Category: model.CategoryCrypto, Market: model.MarketCrypto, CostBasis: 920, CurrentPrice: 1210, Quantity: 30, Currency: "CNY", PurchasedAt: "2025-09-01", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
	{ID: "mock-cash-demand", Symbol: "活期存款", Category: model.CategoryCash, Market: model.MarketCn, CostBasis: 1, CurrentPrice: 1, Quantity: 50000, Currency: "CNY", PurchasedAt: "2025-01-01", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
	{ID: "mock-cash-mmf", Symbol: "货币基金", Category: model.CategoryCash, Market: model.MarketCn, CostBasis: 1, CurrentPrice: 1.0023, Quantity: 80000, Currency: "CNY", PurchasedAt: "2025-04-10", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
	{ID: "mock-cur-usd", Symbol: "USD 美金", Category: model.CategoryCurrency, Market: model.MarketUs, CostBasis: 7.23, CurrentPrice: 7.28, Quantity: 10000, Currency: "CNY", PurchasedAt: "2025-03-15", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
	{ID: "mock-cur-hkd", Symbol: "HKD 港币", Category: model.CategoryCurrency, Market: model.MarketHk, CostBasis: 0.928, CurrentPrice: 0.935, Quantity: 50000, Currency: "CNY", PurchasedAt: "2025-05-20", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
	{ID: "mock-cur-usdt", Symbol: "USDT", Category: model.CategoryCurrency, Market: model.MarketCrypto, CostBasis: 7.2, CurrentPrice: 7.25, Quantity: 5000, Currency: "CNY", PurchasedAt: "2025-08-01", CreatedAt: "2026-03-01T00:00:00.000Z", UpdatedAt: "2026-04-01T00:00:00.000Z"},
}

// seed 创建默认用户，填充 Mock 数据，归属孤儿资产
func seed(s *store.Store) error {
	userID, err := seedUser(s)
	if err != nil {
		return err
	}

	// 将迁移前已存在的无主资产归属到默认用户
	if err := s.AssignOrphanAssets(userID); err != nil {
		return fmt.Errorf("seed assign orphans: %w", err)
	}

	// 填充 Mock 数据
	n, err := s.Count()
	if err != nil {
		return fmt.Errorf("seed count: %w", err)
	}
	if n > 0 {
		log.Printf("seed: 跳过，数据库已有 %d 条资产\n", n)
		return nil
	}
	for _, a := range mockAssets {
		a.UserID = userID
		if err := s.CreateAsset(a); err != nil {
			return fmt.Errorf("seed insert %s: %w", a.ID, err)
		}
	}
	log.Printf("seed: 已插入 %d 条 Mock 资产\n", len(mockAssets))
	return nil
}
