package store

import (
	"database/sql"
	"fmt"

	"github.com/theodore/vibecoding-server/internal/model"
)

func (s *Store) UpsertPortfolioSnapshot(snapshot model.PortfolioSnapshot) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("begin snapshot tx: %w", err)
	}
	defer tx.Rollback()

	_, err = tx.Exec(`
		INSERT INTO portfolio_snapshots (
			id, user_id, snapshot_date, total_value_cny, total_cost_cny, total_pnl_cny,
			total_dividend_cny, asset_count, rates_json, assets_json, created_at, updated_at
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id, snapshot_date) DO UPDATE SET
			total_value_cny = excluded.total_value_cny,
			total_cost_cny = excluded.total_cost_cny,
			total_pnl_cny = excluded.total_pnl_cny,
			total_dividend_cny = excluded.total_dividend_cny,
			asset_count = excluded.asset_count,
			rates_json = excluded.rates_json,
			assets_json = excluded.assets_json,
			updated_at = excluded.updated_at
	`, snapshot.ID, snapshot.UserID, snapshot.SnapshotDate, snapshot.TotalValueCNY,
		snapshot.TotalCostCNY, snapshot.TotalPnLCNY, snapshot.TotalDividendCNY,
		snapshot.AssetCount, snapshot.RatesJSON, snapshot.AssetsJSON,
		snapshot.CreatedAt, snapshot.UpdatedAt)
	if err != nil {
		return fmt.Errorf("upsert portfolio snapshot: %w", err)
	}

	var snapshotID string
	if err := tx.QueryRow(`
		SELECT id FROM portfolio_snapshots WHERE user_id = ? AND snapshot_date = ?
	`, snapshot.UserID, snapshot.SnapshotDate).Scan(&snapshotID); err != nil {
		return fmt.Errorf("select portfolio snapshot id: %w", err)
	}

	if _, err := tx.Exec(`DELETE FROM portfolio_snapshot_breakdowns WHERE snapshot_id = ?`, snapshotID); err != nil {
		return fmt.Errorf("delete portfolio snapshot breakdowns: %w", err)
	}
	for _, item := range snapshot.Breakdowns {
		_, err := tx.Exec(`
			INSERT INTO portfolio_snapshot_breakdowns (
				snapshot_id, dimension, key, label, value_cny, cost_cny, pnl_cny, ratio
			)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		`, snapshotID, item.Dimension, item.Key, item.Label, item.ValueCNY, item.CostCNY, item.PnLCNY, item.Ratio)
		if err != nil {
			return fmt.Errorf("insert portfolio snapshot breakdown: %w", err)
		}
	}

	return tx.Commit()
}

func (s *Store) ListPortfolioSnapshots(userID, from, to string) ([]model.PortfolioSnapshot, error) {
	query := `
		SELECT id, user_id, snapshot_date, total_value_cny, total_cost_cny, total_pnl_cny,
			total_dividend_cny, asset_count, rates_json, assets_json, created_at, updated_at
		FROM portfolio_snapshots
		WHERE user_id = ?
	`
	args := []any{userID}
	if from != "" {
		query += ` AND snapshot_date >= ?`
		args = append(args, from)
	}
	if to != "" {
		query += ` AND snapshot_date <= ?`
		args = append(args, to)
	}
	query += ` ORDER BY snapshot_date`

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("list portfolio snapshots: %w", err)
	}
	defer rows.Close()

	var snapshots []model.PortfolioSnapshot
	for rows.Next() {
		var snapshot model.PortfolioSnapshot
		if err := scanPortfolioSnapshot(rows, &snapshot); err != nil {
			return nil, err
		}
		snapshots = append(snapshots, snapshot)
	}
	return snapshots, rows.Err()
}

func (s *Store) GetPortfolioSnapshot(userID, snapshotDate string) (model.PortfolioSnapshot, error) {
	var snapshot model.PortfolioSnapshot
	row := s.db.QueryRow(`
		SELECT id, user_id, snapshot_date, total_value_cny, total_cost_cny, total_pnl_cny,
			total_dividend_cny, asset_count, rates_json, assets_json, created_at, updated_at
		FROM portfolio_snapshots
		WHERE user_id = ? AND snapshot_date = ?
	`, userID, snapshotDate)
	if err := row.Scan(
		&snapshot.ID, &snapshot.UserID, &snapshot.SnapshotDate, &snapshot.TotalValueCNY,
		&snapshot.TotalCostCNY, &snapshot.TotalPnLCNY, &snapshot.TotalDividendCNY,
		&snapshot.AssetCount, &snapshot.RatesJSON, &snapshot.AssetsJSON,
		&snapshot.CreatedAt, &snapshot.UpdatedAt,
	); err != nil {
		return snapshot, fmt.Errorf("get portfolio snapshot: %w", err)
	}

	breakdowns, err := s.ListPortfolioSnapshotBreakdowns(snapshot.ID)
	if err != nil {
		return snapshot, err
	}
	snapshot.Breakdowns = breakdowns
	return snapshot, nil
}

func (s *Store) ListPortfolioSnapshotBreakdowns(snapshotID string) ([]model.PortfolioSnapshotBreakdown, error) {
	rows, err := s.db.Query(`
		SELECT dimension, key, label, value_cny, cost_cny, pnl_cny, ratio
		FROM portfolio_snapshot_breakdowns
		WHERE snapshot_id = ?
		ORDER BY dimension, value_cny DESC
	`, snapshotID)
	if err != nil {
		return nil, fmt.Errorf("list portfolio snapshot breakdowns: %w", err)
	}
	defer rows.Close()

	var breakdowns []model.PortfolioSnapshotBreakdown
	for rows.Next() {
		var item model.PortfolioSnapshotBreakdown
		if err := rows.Scan(&item.Dimension, &item.Key, &item.Label, &item.ValueCNY, &item.CostCNY, &item.PnLCNY, &item.Ratio); err != nil {
			return nil, fmt.Errorf("scan portfolio snapshot breakdown: %w", err)
		}
		breakdowns = append(breakdowns, item)
	}
	return breakdowns, rows.Err()
}

type portfolioSnapshotScanner interface {
	Scan(dest ...any) error
}

func scanPortfolioSnapshot(row portfolioSnapshotScanner, snapshot *model.PortfolioSnapshot) error {
	if err := row.Scan(
		&snapshot.ID, &snapshot.UserID, &snapshot.SnapshotDate, &snapshot.TotalValueCNY,
		&snapshot.TotalCostCNY, &snapshot.TotalPnLCNY, &snapshot.TotalDividendCNY,
		&snapshot.AssetCount, &snapshot.RatesJSON, &snapshot.AssetsJSON,
		&snapshot.CreatedAt, &snapshot.UpdatedAt,
	); err != nil {
		if err == sql.ErrNoRows {
			return err
		}
		return fmt.Errorf("scan portfolio snapshot: %w", err)
	}
	return nil
}
