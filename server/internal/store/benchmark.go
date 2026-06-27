package store

import (
	"fmt"

	"github.com/theodore/vibecoding-server/internal/model"
)

// ListBenchmarkPrices 返回某基准的全部日线，按日期升序
func (s *Store) ListBenchmarkPrices(symbol string) ([]model.BenchmarkPrice, error) {
	rows, err := s.db.Query(`
		SELECT date, close FROM benchmark_prices
		WHERE symbol = ?
		ORDER BY date ASC
	`, symbol)
	if err != nil {
		return nil, fmt.Errorf("list benchmark prices: %w", err)
	}
	defer rows.Close()

	var prices []model.BenchmarkPrice
	for rows.Next() {
		var p model.BenchmarkPrice
		if err := rows.Scan(&p.Date, &p.Close); err != nil {
			return nil, fmt.Errorf("scan benchmark price: %w", err)
		}
		prices = append(prices, p)
	}
	return prices, rows.Err()
}

// LatestBenchmarkDate 返回某基准已缓存的最新日期，空表返回 ""
func (s *Store) LatestBenchmarkDate(symbol string) (string, error) {
	var date string
	err := s.db.QueryRow(`
		SELECT COALESCE(MAX(date), '') FROM benchmark_prices WHERE symbol = ?
	`, symbol).Scan(&date)
	if err != nil {
		return "", fmt.Errorf("latest benchmark date: %w", err)
	}
	return date, nil
}

// UpsertBenchmarkPrices 批量写入日线（已存在的 (symbol,date) 覆盖 close）
func (s *Store) UpsertBenchmarkPrices(symbol string, prices []model.BenchmarkPrice) error {
	if len(prices) == 0 {
		return nil
	}
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("begin benchmark upsert: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT INTO benchmark_prices (symbol, date, close)
		VALUES (?, ?, ?)
		ON CONFLICT(symbol, date) DO UPDATE SET close = excluded.close
	`)
	if err != nil {
		return fmt.Errorf("prepare benchmark upsert: %w", err)
	}
	defer stmt.Close()

	for _, p := range prices {
		if p.Date == "" || p.Close <= 0 {
			continue
		}
		if _, err := stmt.Exec(symbol, p.Date, p.Close); err != nil {
			return fmt.Errorf("exec benchmark upsert: %w", err)
		}
	}
	return tx.Commit()
}
