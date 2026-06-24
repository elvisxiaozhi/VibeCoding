package store

import (
	"database/sql"
	"fmt"
	"sort"
)

// backupTables 列出全量备份覆盖的数据表，顺序为「父表在前」——
// 导入时按此顺序插入、按倒序删除，满足外键依赖（asset_price_status→assets，
// portfolio_snapshot_breakdowns→portfolio_snapshots）。
// 刻意排除 users / sessions（含凭据）与 goose_db_version（迁移元数据）。
var backupTables = []string{
	"fx_rates",
	"price_refresh_settings",
	"liabilities",
	"assets",
	"asset_price_status",
	"portfolio_snapshots",
	"portfolio_snapshot_breakdowns",
}

// SchemaVersion 返回当前已应用的最大迁移版本号（goose_db_version）。
func (s *Store) SchemaVersion() (int, error) {
	var v sql.NullInt64
	err := s.db.QueryRow(`SELECT MAX(version_id) FROM goose_db_version WHERE is_applied = 1`).Scan(&v)
	if err != nil {
		return 0, fmt.Errorf("schema version: %w", err)
	}
	return int(v.Int64), nil
}

// ExportTables 把全部备份表导出为 map[表名][]行，行用列名→值表示。
// 通过 rows.Columns() 动态读列，schema 增列后自动纳入，无需改这里。
func (s *Store) ExportTables() (map[string][]map[string]any, error) {
	out := make(map[string][]map[string]any, len(backupTables))
	for _, table := range backupTables {
		rows, err := exportOne(s.db, table)
		if err != nil {
			return nil, err
		}
		out[table] = rows
	}
	return out, nil
}

func exportOne(db *sql.DB, table string) ([]map[string]any, error) {
	// table 来自固定白名单 backupTables，非用户输入，可安全拼接。
	rows, err := db.Query("SELECT * FROM " + table)
	if err != nil {
		return nil, fmt.Errorf("export %s: %w", table, err)
	}
	defer rows.Close()

	cols, err := rows.Columns()
	if err != nil {
		return nil, fmt.Errorf("export %s columns: %w", table, err)
	}

	result := make([]map[string]any, 0)
	for rows.Next() {
		vals := make([]any, len(cols))
		ptrs := make([]any, len(cols))
		for i := range vals {
			ptrs[i] = &vals[i]
		}
		if err := rows.Scan(ptrs...); err != nil {
			return nil, fmt.Errorf("export %s scan: %w", table, err)
		}
		row := make(map[string]any, len(cols))
		for i, c := range cols {
			v := vals[i]
			if b, ok := v.([]byte); ok {
				v = string(b)
			}
			row[c] = v
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

// ImportTables 在单事务里整体替换全部备份表：先按倒序清空、再按正序插入。
// 任一步出错整体回滚，不会留下半套数据。
func (s *Store) ImportTables(data map[string][]map[string]any) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("import begin: %w", err)
	}
	defer tx.Rollback()

	// 倒序删除（子表在前）
	for i := len(backupTables) - 1; i >= 0; i-- {
		if _, err := tx.Exec("DELETE FROM " + backupTables[i]); err != nil {
			return fmt.Errorf("import clear %s: %w", backupTables[i], err)
		}
	}

	// 正序插入（父表在前）
	for _, table := range backupTables {
		for _, row := range data[table] {
			if err := insertRow(tx, table, row); err != nil {
				return err
			}
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("import commit: %w", err)
	}
	return nil
}

func insertRow(tx *sql.Tx, table string, row map[string]any) error {
	if len(row) == 0 {
		return nil
	}
	cols := make([]string, 0, len(row))
	for c := range row {
		cols = append(cols, c)
	}
	sort.Strings(cols) // 确定列序，保证 placeholder 与值对齐

	placeholders := make([]string, len(cols))
	vals := make([]any, len(cols))
	colList := ""
	for i, c := range cols {
		placeholders[i] = "?"
		vals[i] = row[c]
		if i > 0 {
			colList += ", "
		}
		colList += c
	}

	q := "INSERT INTO " + table + " (" + colList + ") VALUES (" + joinComma(placeholders) + ")"
	if _, err := tx.Exec(q, vals...); err != nil {
		return fmt.Errorf("import insert %s: %w", table, err)
	}
	return nil
}

func joinComma(parts []string) string {
	out := ""
	for i, p := range parts {
		if i > 0 {
			out += ", "
		}
		out += p
	}
	return out
}

// VacuumInto 用 SQLite VACUUM INTO 生成一份一致的数据库快照到 path（path 须不存在）。
// 导入恢复前调用，作为服务端兜底，不受 WAL / 活动连接影响。
func (s *Store) VacuumInto(path string) error {
	if _, err := s.db.Exec(`VACUUM INTO ?`, path); err != nil {
		return fmt.Errorf("vacuum into %s: %w", path, err)
	}
	return nil
}

// GetMeta 读 app_meta 一项，未命中返回空串。
func (s *Store) GetMeta(key string) (string, error) {
	var v string
	err := s.db.QueryRow(`SELECT value FROM app_meta WHERE key = ?`, key).Scan(&v)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("get meta %s: %w", key, err)
	}
	return v, nil
}

// SetMeta 写入/更新 app_meta 一项。
func (s *Store) SetMeta(key, value string) error {
	_, err := s.db.Exec(`
		INSERT INTO app_meta (key, value) VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value`, key, value)
	if err != nil {
		return fmt.Errorf("set meta %s: %w", key, err)
	}
	return nil
}
