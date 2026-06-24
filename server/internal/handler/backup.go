package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/theodore/vibecoding-server/internal/middleware"
	"github.com/theodore/vibecoding-server/internal/store"
)

// Backup 提供全量 JSON 备份的导出 / 导入 / 状态接口（均需认证）。
type Backup struct {
	Store  *store.Store
	DBPath string // 数据库文件路径，用于导入前生成服务端兜底快照
}

const (
	backupFormat     = "asset-dashboard-backup"
	backupFormatVer  = 1
	metaLastBackupAt = "last_backup_at"
)

// backupFile 是导出/导入交换的顶层结构。
type backupFile struct {
	Format        string                      `json:"format"`
	Version       int                         `json:"version"`
	SchemaVersion int                         `json:"schemaVersion"`
	ExportedAt    string                      `json:"exportedAt"`
	Tables        map[string][]map[string]any `json:"tables"`
}

// RegisterRoutes 注册备份相关路由（需要认证）。
func (h *Backup) RegisterRoutes(mux *http.ServeMux) {
	authMw := middleware.Auth(h.Store)
	mux.Handle("GET /api/backup/export", authMw(http.HandlerFunc(h.export)))
	mux.Handle("POST /api/backup/import", authMw(http.HandlerFunc(h.importBackup)))
	mux.Handle("GET /api/backup/status", authMw(http.HandlerFunc(h.status)))
}

// GET /api/backup/export — 导出全量数据为单个 JSON，并记录本次备份时间。
func (h *Backup) export(w http.ResponseWriter, r *http.Request) {
	schemaVer, err := h.Store.SchemaVersion()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	tables, err := h.Store.ExportTables()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	file := backupFile{
		Format:        backupFormat,
		Version:       backupFormatVer,
		SchemaVersion: schemaVer,
		ExportedAt:    now,
		Tables:        tables,
	}

	// 记录「上次备份」时间（导出一次即视为已备份）。失败不阻断导出。
	if err := h.Store.SetMeta(metaLastBackupAt, now); err != nil {
		// 仅记录，不影响主流程
		fmt.Printf("warn: set last_backup_at failed: %v\n", err)
	}

	writeJSON(w, http.StatusOK, file)
}

// POST /api/backup/import — 用上传的备份 JSON 整体替换数据，导入前生成服务端快照。
func (h *Backup) importBackup(w http.ResponseWriter, r *http.Request) {
	var file backupFile
	if err := json.NewDecoder(r.Body).Decode(&file); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON")
		return
	}
	if file.Format != backupFormat {
		writeError(w, http.StatusBadRequest, "不是有效的备份文件（format 不匹配）")
		return
	}
	if file.Tables == nil {
		writeError(w, http.StatusBadRequest, "备份文件缺少 tables 字段")
		return
	}

	schemaVer, err := h.Store.SchemaVersion()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	// 备份来自比当前更新的 schema → 可能含未知列，拒绝导入。
	// 更旧或相同的备份可安全导入：缺失的新列由表默认值补齐。
	if file.SchemaVersion > schemaVer {
		writeError(w, http.StatusBadRequest, fmt.Sprintf(
			"备份的数据结构版本（%d）高于当前服务（%d），无法导入", file.SchemaVersion, schemaVer))
		return
	}

	// 导入前在 DB 同目录生成一致快照，作为兜底。
	if h.DBPath != "" {
		snapPath := fmt.Sprintf("%s.pre-import-%s.db", h.DBPath, time.Now().Format("20060102-150405"))
		if err := h.Store.VacuumInto(snapPath); err != nil {
			writeError(w, http.StatusInternalServerError, "导入前快照失败，已中止: "+err.Error())
			return
		}
	}

	if err := h.Store.ImportTables(file.Tables); err != nil {
		writeError(w, http.StatusInternalServerError, "导入失败，数据已回滚: "+err.Error())
		return
	}

	// 恢复后刷新「上次备份」时间为该备份文件的导出时间（若有）。
	if file.ExportedAt != "" {
		_ = h.Store.SetMeta(metaLastBackupAt, file.ExportedAt)
	}

	counts := make(map[string]int, len(file.Tables))
	for table, rows := range file.Tables {
		counts[table] = len(rows)
	}
	writeJSON(w, http.StatusOK, map[string]any{"imported": counts})
}

// GET /api/backup/status — 返回上次备份时间与当前数据结构版本。
func (h *Backup) status(w http.ResponseWriter, r *http.Request) {
	lastBackupAt, err := h.Store.GetMeta(metaLastBackupAt)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	schemaVer, err := h.Store.SchemaVersion()
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"lastBackupAt":  lastBackupAt,
		"schemaVersion": schemaVer,
	})
}
