package store

import (
	"database/sql"
	"fmt"

	"github.com/theodore/vibecoding-server/internal/model"
)

func (s *Store) ListLiabilities(userID string, owner string) ([]model.Liability, error) {
	var rows *sql.Rows
	var err error
	if owner != "" {
		rows, err = s.db.Query(`
			SELECT id, user_id, name, category, principal, currency, interest_rate, due_date, owner, note, created_at, updated_at
			FROM liabilities WHERE user_id = ? AND owner = ? ORDER BY created_at`, userID, owner)
	} else {
		rows, err = s.db.Query(`
			SELECT id, user_id, name, category, principal, currency, interest_rate, due_date, owner, note, created_at, updated_at
			FROM liabilities WHERE user_id = ? ORDER BY created_at`, userID)
	}
	if err != nil {
		return nil, fmt.Errorf("list liabilities: %w", err)
	}
	defer rows.Close()

	var liabilities []model.Liability
	for rows.Next() {
		var l model.Liability
		if err := rows.Scan(&l.ID, &l.UserID, &l.Name, &l.Category, &l.Principal, &l.Currency, &l.InterestRate, &l.DueDate, &l.Owner, &l.Note, &l.CreatedAt, &l.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan liability: %w", err)
		}
		liabilities = append(liabilities, l)
	}
	return liabilities, rows.Err()
}

func (s *Store) GetLiability(id, userID string) (model.Liability, error) {
	var l model.Liability
	err := s.db.QueryRow(`
		SELECT id, user_id, name, category, principal, currency, interest_rate, due_date, owner, note, created_at, updated_at
		FROM liabilities WHERE id = ? AND user_id = ?`, id, userID).
		Scan(&l.ID, &l.UserID, &l.Name, &l.Category, &l.Principal, &l.Currency, &l.InterestRate, &l.DueDate, &l.Owner, &l.Note, &l.CreatedAt, &l.UpdatedAt)
	if err != nil {
		return l, fmt.Errorf("get liability %s: %w", id, err)
	}
	return l, nil
}

func (s *Store) CreateLiability(l model.Liability) error {
	_, err := s.db.Exec(`
		INSERT INTO liabilities (id, user_id, name, category, principal, currency, interest_rate, due_date, owner, note, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		l.ID, l.UserID, l.Name, l.Category, l.Principal, l.Currency, l.InterestRate, l.DueDate, l.Owner, l.Note, l.CreatedAt, l.UpdatedAt)
	if err != nil {
		return fmt.Errorf("create liability: %w", err)
	}
	return nil
}

func (s *Store) UpdateLiability(l model.Liability) error {
	result, err := s.db.Exec(`
		UPDATE liabilities SET name=?, category=?, principal=?, currency=?, interest_rate=?, due_date=?, owner=?, note=?, updated_at=?
		WHERE id=? AND user_id=?`,
		l.Name, l.Category, l.Principal, l.Currency, l.InterestRate, l.DueDate, l.Owner, l.Note, l.UpdatedAt, l.ID, l.UserID)
	if err != nil {
		return fmt.Errorf("update liability: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("update liability %s: %w", l.ID, sql.ErrNoRows)
	}
	return nil
}

func (s *Store) DeleteLiability(id, userID string) error {
	result, err := s.db.Exec(`DELETE FROM liabilities WHERE id=? AND user_id=?`, id, userID)
	if err != nil {
		return fmt.Errorf("delete liability %s: %w", id, err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("delete liability %s: %w", id, sql.ErrNoRows)
	}
	return nil
}
