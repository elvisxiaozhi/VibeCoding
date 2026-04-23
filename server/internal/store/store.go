package store

import (
	"database/sql"
	"fmt"

	"github.com/theodore/vibecoding-server/internal/model"
)

// Store 封装数据库访问，提供资产 CRUD 方法
type Store struct {
	db *sql.DB
}

// New 创建 Store 实例，调用方负责传入已完成迁移的 *sql.DB
func New(db *sql.DB) *Store {
	return &Store{db: db}
}

// ListAssets 返回指定用户的全部资产，可选按 owner 过滤
func (s *Store) ListAssets(userID string, owner string) ([]model.Asset, error) {
	var rows *sql.Rows
	var err error
	if owner != "" {
		rows, err = s.db.Query(`
			SELECT id, user_id, symbol, category, market, cost_basis, current_price, quantity, currency, dividends, owner, note, purchased_at, created_at, updated_at
			FROM assets WHERE user_id = ? AND owner = ? ORDER BY created_at`, userID, owner)
	} else {
		rows, err = s.db.Query(`
			SELECT id, user_id, symbol, category, market, cost_basis, current_price, quantity, currency, dividends, owner, note, purchased_at, created_at, updated_at
			FROM assets WHERE user_id = ? ORDER BY created_at`, userID)
	}
	if err != nil {
		return nil, fmt.Errorf("list assets: %w", err)
	}
	defer rows.Close()

	var assets []model.Asset
	for rows.Next() {
		var a model.Asset
		if err := rows.Scan(&a.ID, &a.UserID, &a.Symbol, &a.Category, &a.Market, &a.CostBasis, &a.CurrentPrice, &a.Quantity, &a.Currency, &a.Dividends, &a.Owner, &a.Note, &a.PurchasedAt, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan asset: %w", err)
		}
		assets = append(assets, a)
	}
	return assets, rows.Err()
}

// GetAsset 按 ID 查询单条资产（限定用户）
func (s *Store) GetAsset(id, userID string) (model.Asset, error) {
	var a model.Asset
	err := s.db.QueryRow(`
		SELECT id, user_id, symbol, category, market, cost_basis, current_price, quantity, currency, dividends, owner, note, purchased_at, created_at, updated_at
		FROM assets WHERE id = ? AND user_id = ?`, id, userID).
		Scan(&a.ID, &a.UserID, &a.Symbol, &a.Category, &a.Market, &a.CostBasis, &a.CurrentPrice, &a.Quantity, &a.Currency, &a.Dividends, &a.Owner, &a.Note, &a.PurchasedAt, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		return a, fmt.Errorf("get asset %s: %w", id, err)
	}
	return a, nil
}

// CreateAsset 插入一条资产
func (s *Store) CreateAsset(a model.Asset) error {
	_, err := s.db.Exec(`
		INSERT INTO assets (id, user_id, symbol, category, market, cost_basis, current_price, quantity, currency, dividends, owner, note, purchased_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		a.ID, a.UserID, a.Symbol, a.Category, a.Market, a.CostBasis, a.CurrentPrice, a.Quantity, a.Currency, a.Dividends, a.Owner, a.Note, a.PurchasedAt, a.CreatedAt, a.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create asset: %w", err)
	}
	return nil
}

// UpdateAsset 按 ID 更新资产全部字段（限定用户）
func (s *Store) UpdateAsset(a model.Asset) error {
	result, err := s.db.Exec(`
		UPDATE assets SET symbol=?, category=?, market=?, cost_basis=?, current_price=?, quantity=?, currency=?, dividends=?, owner=?, note=?, purchased_at=?, updated_at=?
		WHERE id=? AND user_id=?`,
		a.Symbol, a.Category, a.Market, a.CostBasis, a.CurrentPrice, a.Quantity, a.Currency, a.Dividends, a.Owner, a.Note, a.PurchasedAt, a.UpdatedAt, a.ID, a.UserID)
	if err != nil {
		return fmt.Errorf("update asset: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("update asset %s: %w", a.ID, sql.ErrNoRows)
	}
	return nil
}

// DeleteAsset 按 ID 删除资产（限定用户）
func (s *Store) DeleteAsset(id, userID string) error {
	result, err := s.db.Exec(`DELETE FROM assets WHERE id=? AND user_id=?`, id, userID)
	if err != nil {
		return fmt.Errorf("delete asset %s: %w", id, err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("delete asset %s: %w", id, sql.ErrNoRows)
	}
	return nil
}

// Count 返回资产总条数（用于 Seed 判断是否需要填充）
func (s *Store) Count() (int, error) {
	var n int
	err := s.db.QueryRow(`SELECT COUNT(*) FROM assets`).Scan(&n)
	return n, err
}

// AssignOrphanAssets 将 user_id 为空的资产归属给指定用户
func (s *Store) AssignOrphanAssets(userID string) error {
	_, err := s.db.Exec(`UPDATE assets SET user_id = ? WHERE user_id = ''`, userID)
	if err != nil {
		return fmt.Errorf("assign orphan assets: %w", err)
	}
	return nil
}
