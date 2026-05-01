package store

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/theodore/vibecoding-server/internal/model"
)

func (s *Store) GetPriceRefreshSettings(userID string) (model.PriceRefreshSettings, error) {
	var settings model.PriceRefreshSettings
	var autoEnabled, dashboardOpen int
	err := s.db.QueryRow(`
		SELECT user_id, auto_refresh_enabled, refresh_interval_minutes, refresh_on_dashboard_open, updated_at
		FROM price_refresh_settings WHERE user_id = ?
	`, userID).Scan(&settings.UserID, &autoEnabled, &settings.RefreshIntervalMinutes, &dashboardOpen, &settings.UpdatedAt)
	if err == nil {
		settings.AutoRefreshEnabled = autoEnabled == 1
		settings.RefreshOnDashboardOpen = dashboardOpen == 1
		return settings, nil
	}
	if err != sql.ErrNoRows {
		return settings, fmt.Errorf("get price refresh settings: %w", err)
	}

	now := time.Now().UTC().Format(time.RFC3339Nano)
	settings = model.PriceRefreshSettings{
		UserID:                 userID,
		AutoRefreshEnabled:     true,
		RefreshIntervalMinutes: 30,
		RefreshOnDashboardOpen: true,
		UpdatedAt:              now,
	}
	if err := s.UpsertPriceRefreshSettings(settings); err != nil {
		return settings, err
	}
	return settings, nil
}

func (s *Store) UpsertPriceRefreshSettings(settings model.PriceRefreshSettings) error {
	autoEnabled := 0
	if settings.AutoRefreshEnabled {
		autoEnabled = 1
	}
	dashboardOpen := 0
	if settings.RefreshOnDashboardOpen {
		dashboardOpen = 1
	}
	if settings.RefreshIntervalMinutes <= 0 {
		settings.RefreshIntervalMinutes = 30
	}
	if settings.UpdatedAt == "" {
		settings.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	}
	_, err := s.db.Exec(`
		INSERT INTO price_refresh_settings (
			user_id, auto_refresh_enabled, refresh_interval_minutes, refresh_on_dashboard_open, updated_at
		)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			auto_refresh_enabled = excluded.auto_refresh_enabled,
			refresh_interval_minutes = excluded.refresh_interval_minutes,
			refresh_on_dashboard_open = excluded.refresh_on_dashboard_open,
			updated_at = excluded.updated_at
	`, settings.UserID, autoEnabled, settings.RefreshIntervalMinutes, dashboardOpen, settings.UpdatedAt)
	if err != nil {
		return fmt.Errorf("upsert price refresh settings: %w", err)
	}
	return nil
}

func (s *Store) UpsertAssetPriceStatus(status model.AssetPriceStatus) error {
	if status.UpdatedAt == "" {
		status.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	}
	_, err := s.db.Exec(`
		INSERT INTO asset_price_status (
			asset_id, user_id, source, last_price, last_success_at, last_attempt_at,
			status, error_message, updated_at
		)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(asset_id) DO UPDATE SET
			user_id = excluded.user_id,
			source = excluded.source,
			last_price = excluded.last_price,
			last_success_at = excluded.last_success_at,
			last_attempt_at = excluded.last_attempt_at,
			status = excluded.status,
			error_message = excluded.error_message,
			updated_at = excluded.updated_at
	`, status.AssetID, status.UserID, status.Source, status.LastPrice, status.LastSuccessAt,
		status.LastAttemptAt, status.Status, status.ErrorMessage, status.UpdatedAt)
	if err != nil {
		return fmt.Errorf("upsert asset price status: %w", err)
	}
	return nil
}

func (s *Store) ListPriceRefreshStatus(userID string) ([]model.PriceRefreshStatus, error) {
	rows, err := s.db.Query(`
		SELECT
			a.id, a.user_id, a.symbol, a.market, a.category, a.currency, a.current_price, a.quantity, a.owner,
			COALESCE(ps.source, ''),
			COALESCE(ps.last_price, 0),
			COALESCE(ps.last_success_at, ''),
			COALESCE(ps.last_attempt_at, ''),
			COALESCE(ps.status, 'skipped'),
			COALESCE(ps.error_message, ''),
			COALESCE(ps.updated_at, '')
		FROM assets a
		LEFT JOIN asset_price_status ps ON ps.asset_id = a.id
		WHERE a.user_id = ? AND a.quantity > 0
		ORDER BY a.market, a.symbol, a.created_at
	`, userID)
	if err != nil {
		return nil, fmt.Errorf("list price refresh status: %w", err)
	}
	defer rows.Close()

	var statuses []model.PriceRefreshStatus
	for rows.Next() {
		var status model.PriceRefreshStatus
		if err := rows.Scan(
			&status.AssetID, &status.UserID, &status.Symbol, &status.Market, &status.Category,
			&status.Currency, &status.CurrentPrice, &status.Quantity, &status.Owner,
			&status.Source, &status.LastPrice, &status.LastSuccessAt, &status.LastAttemptAt,
			&status.Status, &status.ErrorMessage, &status.UpdatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan price refresh status: %w", err)
		}
		statuses = append(statuses, status)
	}
	return statuses, rows.Err()
}
