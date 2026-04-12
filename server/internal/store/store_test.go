package store

import (
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"

	"github.com/theodore/vibecoding-server/internal/model"
)

const testUserID = "test-user-001"

// 在内存数据库中建表，返回可用的 Store
func setupTestStore(t *testing.T) *Store {
	t.Helper()
	db, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`CREATE TABLE assets (
		id            TEXT PRIMARY KEY,
		user_id       TEXT NOT NULL DEFAULT '',
		symbol        TEXT    NOT NULL,
		category      TEXT    NOT NULL,
		cost_basis    REAL    NOT NULL,
		current_price REAL    NOT NULL,
		quantity      REAL    NOT NULL,
		currency      TEXT    NOT NULL DEFAULT 'CNY',
		created_at    TEXT    NOT NULL,
		updated_at    TEXT    NOT NULL
	)`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`CREATE TABLE users (
		id            TEXT PRIMARY KEY,
		username      TEXT NOT NULL UNIQUE,
		password_hash TEXT NOT NULL,
		created_at    TEXT NOT NULL
	)`)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`CREATE TABLE sessions (
		token      TEXT PRIMARY KEY,
		user_id    TEXT NOT NULL,
		expires_at TEXT NOT NULL
	)`)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return New(db)
}

func sampleAsset() model.Asset {
	return model.Asset{
		ID:           "test-001",
		UserID:       testUserID,
		Symbol:       "AAPL",
		Category:     model.CategoryStock,
		CostBasis:    150.0,
		CurrentPrice: 185.5,
		Quantity:     10,
		Currency:     "CNY",
		CreatedAt:    "2026-04-01T00:00:00.000Z",
		UpdatedAt:    "2026-04-01T00:00:00.000Z",
	}
}

func TestCreateAndGet(t *testing.T) {
	s := setupTestStore(t)
	a := sampleAsset()

	if err := s.CreateAsset(a); err != nil {
		t.Fatalf("CreateAsset: %v", err)
	}

	got, err := s.GetAsset(a.ID, testUserID)
	if err != nil {
		t.Fatalf("GetAsset: %v", err)
	}
	if got.Symbol != a.Symbol || got.CostBasis != a.CostBasis || got.Quantity != a.Quantity {
		t.Errorf("GetAsset mismatch: got %+v, want %+v", got, a)
	}
}

func TestGetAssetWrongUser(t *testing.T) {
	s := setupTestStore(t)
	a := sampleAsset()
	s.CreateAsset(a)

	_, err := s.GetAsset(a.ID, "other-user")
	if err == nil {
		t.Error("expected error getting asset with wrong user, got nil")
	}
}

func TestListAssets(t *testing.T) {
	s := setupTestStore(t)

	// 空表
	list, err := s.ListAssets(testUserID)
	if err != nil {
		t.Fatalf("ListAssets empty: %v", err)
	}
	if len(list) != 0 {
		t.Errorf("expected 0 assets, got %d", len(list))
	}

	// 插入 2 条
	a1 := sampleAsset()
	a2 := sampleAsset()
	a2.ID = "test-002"
	a2.Symbol = "BTC"
	a2.Category = model.CategoryCrypto

	s.CreateAsset(a1)
	s.CreateAsset(a2)

	list, err = s.ListAssets(testUserID)
	if err != nil {
		t.Fatalf("ListAssets: %v", err)
	}
	if len(list) != 2 {
		t.Errorf("expected 2 assets, got %d", len(list))
	}

	// 其他用户看不到
	list, err = s.ListAssets("other-user")
	if err != nil {
		t.Fatalf("ListAssets other: %v", err)
	}
	if len(list) != 0 {
		t.Errorf("expected 0 assets for other user, got %d", len(list))
	}
}

func TestUpdateAsset(t *testing.T) {
	s := setupTestStore(t)
	a := sampleAsset()
	s.CreateAsset(a)

	a.CurrentPrice = 200.0
	a.UpdatedAt = "2026-04-12T00:00:00.000Z"
	if err := s.UpdateAsset(a); err != nil {
		t.Fatalf("UpdateAsset: %v", err)
	}

	got, _ := s.GetAsset(a.ID, testUserID)
	if got.CurrentPrice != 200.0 {
		t.Errorf("expected CurrentPrice 200, got %f", got.CurrentPrice)
	}
	if got.UpdatedAt != "2026-04-12T00:00:00.000Z" {
		t.Errorf("expected UpdatedAt updated, got %s", got.UpdatedAt)
	}
}

func TestDeleteAsset(t *testing.T) {
	s := setupTestStore(t)
	a := sampleAsset()
	s.CreateAsset(a)

	if err := s.DeleteAsset(a.ID, testUserID); err != nil {
		t.Fatalf("DeleteAsset: %v", err)
	}

	_, err := s.GetAsset(a.ID, testUserID)
	if err == nil {
		t.Error("expected error after delete, got nil")
	}
}

func TestDeleteNotFound(t *testing.T) {
	s := setupTestStore(t)
	err := s.DeleteAsset("nonexistent", testUserID)
	if err == nil {
		t.Error("expected error deleting nonexistent asset, got nil")
	}
}

func TestDeleteWrongUser(t *testing.T) {
	s := setupTestStore(t)
	a := sampleAsset()
	s.CreateAsset(a)

	err := s.DeleteAsset(a.ID, "other-user")
	if err == nil {
		t.Error("expected error deleting asset with wrong user, got nil")
	}
}

func TestCount(t *testing.T) {
	s := setupTestStore(t)

	n, _ := s.Count()
	if n != 0 {
		t.Errorf("expected 0, got %d", n)
	}

	s.CreateAsset(sampleAsset())
	n, _ = s.Count()
	if n != 1 {
		t.Errorf("expected 1, got %d", n)
	}
}
