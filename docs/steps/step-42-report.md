# Step 42 — 设置页全量 JSON 备份导出 / 导入

> 步号说明：本会话与「Step 41 — 目标配置 + 偏离再平衡提醒」「benchmark 基准对照」等功能并行开发，备份功能取下一个空闲步号 42。迁移文件取 `018`（空闲，与并行的 `019_create_benchmark_prices.sql` 无冲突）。

## 目标
在设置页提供「数据备份」卡片：一键导出全量数据为单个 JSON、从备份文件整体恢复、并显示「上次备份：X 天前」。补齐普通使用路径里的兜底（此前只有 CLI 脚本 `scripts/backup-real-data.sh`，CSV 导出又是有损的）。

## 设计取舍
- **后端端点而非前端拼装**：真正的兜底必须是 `data.db` 的忠实转储。纯前端按 API 拉取拼 JSON 无法原子恢复、且漏掉附表。备份端点是纯存储 I/O，不涉派生计算，符合红线「后端只做存储 + CRUD」。
- **通用列驱动导出**：`SELECT *` + `rows.Columns()` 动态读列，schema 增列后自动纳入，无需逐表硬编码字段。
- **整表替换 + 单事务**：导入时按子表→父表倒序清空、父表→子表正序插入，满足外键依赖；任一步失败整体回滚，不留半套数据。
- **导入前服务端兜底**：用 `VACUUM INTO` 生成一份一致快照到 `data.db.pre-import-<时间>.db`，不受 WAL / 活动连接影响。
- **上次备份时间存服务端**（`app_meta` 表），比 localStorage 强：iOS / 多浏览器一致，也能反映恢复操作。
- **排除敏感与元数据表**：`users` / `sessions`（含凭据）、`goose_db_version` 不进备份文件。
- **schema 版本闸门**：导出写入 `schemaVersion`；导入时若备份版本 **高于** 当前服务则拒绝（可能含未知列）；更旧或相同的备份允许导入，缺失的新列由表默认值补齐。

## 改动文件（共 7 个）

### 后端（4）
- **`server/migrations/018_create_app_meta.sql`**（新）— `app_meta(key, value)` 键值表，存 `last_backup_at`。
- **`server/internal/store/backup.go`**（新）— `ExportTables` / `ImportTables` / `SchemaVersion` / `VacuumInto` / `GetMeta` / `SetMeta`；`backupTables` 白名单定义父子顺序。
- **`server/internal/handler/backup.go`**（新）— `GET /api/backup/export`、`POST /api/backup/import`、`GET /api/backup/status`，均走 `middleware.Auth`。
- **`server/main.go`** — 注册 `backupHandler`（注入 `DBPath` 供导入前快照）。

### 前端（3）
- **`src/vendor/lucide.ts`** — 新增 `Upload` 图标 shim。
- **`src/hooks/useBackup.ts`**（新）— 拉 status、导出下载、导入上传；模块级缓存。
- **`src/components/settings/Settings.tsx`** — 新增 `BackupCard`：上次备份提示（≥7 天或从未 → 琥珀警告）、导出按钮、导入（文件选择 → AlertDialog 二次确认 → 覆盖恢复 → 刷新页面）。只读模式禁用导入。

## 备份覆盖的表（7）
`fx_rates`、`price_refresh_settings`、`liabilities`、`assets`、`asset_price_status`、`portfolio_snapshots`、`portfolio_snapshot_breakdowns`。

## ⚠️ 待你拍板：benchmark_prices
工作区里有未提交的并行功能（migration `019_create_benchmark_prices.sql` + `benchmark.go` + `ContributionPanel.tsx`）。**`benchmark_prices` 暂未纳入备份集**，理由：它属于另一个 in-flight Step，若把它写进 `backupTables` 而该功能被回退，导出会在运行时 `SELECT *` 失败。它和 `fx_rates` 一样是「外部价格懒填充缓存」，可重新拉取，遗漏无数据损失。
**等 benchmark 功能落地后，在 `server/internal/store/backup.go` 的 `backupTables` 末尾加一行 `"benchmark_prices"` 即可。** 要现在就加我也可以。

## 关键命令与验收
```bash
# 前端
npx tsc -b      # 0 errors
npm run build   # tsc + vite build 通过（lucide Upload shim 生效，无 build 挂）

# 后端
go build ./...  # Success
```

端到端实测（临时库 `/tmp/bk_test.db`，未触碰真实 `server/data.db`）：
- `GET /api/backup/export` → 导出 1446 assets / 1442 asset_price_status / 136 fx_rates / 2 snapshots / 22 breakdowns / 1 settings，`schemaVersion` 正确。
- 删除 1 条 asset 后 `POST /api/backup/import` → assets 恢复到 1446，返回各表导入计数。
- 导入前生成 `data.db.pre-import-<时间>.db` 快照 ✅。
- `status` 在导出后正确返回 `lastBackupAt`。
- 篡改 `schemaVersion=999` 导入 → 正确拒绝并返回中文错误。

## 红线遵守
- 后端仅做存储 + CRUD，无派生计算。
- 未引入 Web 框架 / ORM / 状态库 / React Router。
- 新增 lucide 图标已同步 `src/vendor/lucide.ts`。
- 未改真实 `server/data.db`（全程用 `ASSET_DASHBOARD_DB` 指向临时库）。
- 未 push。
