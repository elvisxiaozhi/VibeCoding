# Step 4 执行简报 — SQLite 数据层 + 迁移 + Seed

> 交付日期：2026-04-12
> 目标：数据库就绪，Go 代码可以读写资产数据

---

## 1. 关键终端命令

| 顺序 | 命令 | 作用 |
|------|------|------|
| 1 | `GOPROXY=https://proxy.golang.org,direct go mod tidy` | 安装依赖（modernc.org/sqlite + goose）；goproxy.cn 超时，临时换用默认代理 |
| 2 | `go test ./internal/store/... -v` | 运行 Store 单元测试（6 pass） |
| 3 | `go run .` | 启动 server，自动执行迁移 + Seed |
| 4 | `sqlite3 data.db "SELECT id, symbol, category FROM assets;"` | 验证 10 条 Mock 数据已写入 |

---

## 2. 新增文件

| 路径 | 作用 |
|------|------|
| `server/migrations/001_create_assets.sql` | goose 迁移：`assets` 表 9 列（id/symbol/category/cost_basis/current_price/quantity/currency/created_at/updated_at），含 category CHECK 约束 |
| `server/internal/model/asset.go` | Go `Asset` struct + JSON tags（camelCase，与前端 `types.ts` 一一对应）+ 分类常量 |
| `server/internal/store/store.go` | `Store` 封装 `*sql.DB`，提供 `ListAssets` / `GetAsset` / `CreateAsset` / `UpdateAsset` / `DeleteAsset` / `Count` |
| `server/internal/store/store_test.go` | 6 个测试用例：CreateAndGet / ListAssets / UpdateAsset / DeleteAsset / DeleteNotFound / Count（内存 SQLite） |
| `server/seed.go` | 10 条 Mock 数据（与前端 `mock.ts` 一致），首次启动若表空则插入 |

## 3. 修改文件

| 路径 | 变更 |
|------|------|
| `server/main.go` | 新增：打开 SQLite → goose 迁移 → 创建 Store → 调用 seed → 保留 health 路由 |
| `server/go.mod` / `go.sum` | 新增依赖：`modernc.org/sqlite`、`github.com/pressly/goose/v3` 及其传递依赖 |
| `.gitignore` | 新增 `server/data.db` |

## 4. 架构要点

- **迁移**：goose 使用 `embed.FS` 嵌入 `migrations/*.sql`，在 `main.go` 中程序化执行，不依赖 goose CLI
- **DB 列名**：snake_case（`cost_basis`、`current_price`），JSON tag 仍为 camelCase，`rows.Scan` 按位置映射
- **Store 与 main 解耦**：Store 只接收 `*sql.DB`，不知道迁移和 seed 的存在
- **测试**：使用 `:memory:` SQLite 数据库 + 内联 CREATE TABLE，不依赖 goose/embed

---

## 5. 红线遵守情况

| 约束 | 是否遵守 |
|------|----------|
| 不引入 Web 框架 | ✅ 仅 `net/http` 标准库 |
| 不引入 ORM | ✅ 仅 `database/sql` + 手写 SQL |
| 不提前实现 Step 5 的 HTTP handler | ✅ main.go 只有 health 路由 |
| 前后端类型手动同步 | ✅ Go struct JSON tags 与 TS interface 一一对齐 |
| Mock 数据与前端一致 | ✅ 10 条，ID / symbol / 数值完全相同 |
| data.db 已加入 .gitignore | ✅ |

---

## 6. 验收结果

- `go test ./internal/store/... -v` — 6 PASS，0 FAIL（0.592s）
- `go run .` — 迁移输出 `OK 001_create_assets.sql`，seed 输出 `已插入 10 条 Mock 资产`
- `sqlite3 data.db` — 10 条资产，覆盖 stock×3 / etf×2 / crypto×3 / cash×2
- `curl localhost:8080/api/health` — `{"status":"ok"}`（health 端点不受影响）
- 前端 `npx tsc -b` — 0 错误
- **注意**：`goproxy.cn` 超时，本次使用 `GOPROXY=https://proxy.golang.org,direct` 绕过；后续如需稳定使用中国代理，建议排查网络配置
