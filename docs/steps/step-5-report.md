# Step 5 执行简报 — Assets CRUD API

> 交付日期：2026-04-12
> 目标：5 个 RESTful 端点可通过 curl 测试通过

---

## 1. 新增文件

| 路径 | 作用 |
|------|------|
| `server/internal/handler/assets.go` | 5 个 CRUD handler + `RegisterRoutes` 路由注册 + `writeJSON` / `writeError` 辅助 + `validateCreate` 校验 |
| `server/internal/middleware/cors.go` | CORS 中间件，允许 `http://localhost:5173`，处理 OPTIONS 预检 |

## 2. 修改文件

| 路径 | 变更 |
|------|------|
| `server/main.go` | 导入 handler / middleware，注册 CRUD 路由，ListenAndServe 包裹 CORS 中间件 |
| `server/go.mod` / `go.sum` | 新增依赖 `github.com/google/uuid`（handler 中生成资产 ID） |

---

## 3. API 端点明细

| 方法 | 路径 | 功能 | 成功状态码 | 错误状态码 |
|------|------|------|-----------|-----------|
| GET | `/api/assets` | 全部资产列表（空时返回 `[]`） | 200 | 500 |
| GET | `/api/assets/{id}` | 单条资产 | 200 | 404 / 500 |
| POST | `/api/assets` | 新增（服务端生成 UUID + 时间戳） | 201 | 400 / 500 |
| PUT | `/api/assets/{id}` | 更新全部字段（保留 createdAt） | 200 | 400 / 404 / 500 |
| DELETE | `/api/assets/{id}` | 删除 | 200 | 404 / 500 |

**错误响应格式**：`{"error":"..."}`

**创建校验**：symbol 必填、category 必须为 stock/etf/crypto/cash、quantity > 0

---

## 4. 红线遵守情况

| 约束 | 是否遵守 |
|------|----------|
| 不引入 Web 框架 | ✅ 仅 `net/http` 标准库 |
| 不引入 ORM | ✅ 复用 Step 4 的 `database/sql` Store |
| 不提前实现 Step 6 的前端接入 | ✅ |
| CORS 手写中间件 | ✅ 约 15 行，无第三方依赖 |
| 错误返回统一 JSON 格式 | ✅ |

---

## 5. 验收结果（curl 测试 11 个场景）

| # | 场景 | 结果 |
|---|------|------|
| 1 | GET /api/assets — 列表 | ✅ count=10 |
| 2 | GET /api/assets/mock-btc — 单条 | ✅ symbol=BTC 比特币 |
| 3 | POST /api/assets — 新增 | ✅ UUID 生成，count→11 |
| 4 | 新增后再 list | ✅ count=11 |
| 5 | PUT /api/assets/mock-btc — 更新价格 | ✅ 586000→600000 |
| 6 | 更新后再 get | ✅ price=600000 |
| 7 | DELETE /api/assets/mock-sol | ✅ `{"deleted":"mock-sol"}` |
| 8 | 删除后再 get | ✅ 404 `asset not found` |
| 9 | 删除后 list | ✅ count=10 |
| 10 | POST 空 symbol | ✅ 400 `symbol is required` |
| 11 | GET 不存在的 ID | ✅ 404 `asset not found` |

- `go build .` — 编译成功
- 前端 `npx tsc -b` — 0 错误（未受影响）
