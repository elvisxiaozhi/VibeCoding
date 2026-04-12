# Step 11 执行简报 — 后端认证体系

## 交付内容

### 数据库迁移
- `server/migrations/002_create_users.sql` — 创建 `users` 表和 `sessions` 表
- `server/migrations/003_add_user_id_to_assets.sql` — `assets` 表新增 `user_id` 列

### 新增文件
- `server/internal/model/user.go` — `User` 和 `Session` struct
- `server/internal/store/user.go` — 用户/会话 CRUD（CreateUser、GetUserByUsername、GetUserByID、CreateSession、GetSession、DeleteSession 等）
- `server/internal/middleware/auth.go` — 认证中间件，从 Cookie 读 `session_token`，验证后注入 `user_id` 到 context
- `server/internal/handler/auth.go` — `POST /api/login`、`POST /api/logout`、`GET /api/me`

### 修改文件
- `server/internal/model/asset.go` — Asset struct 新增 `UserID` 字段（`json:"-"`）
- `server/internal/store/store.go` — 所有资产查询加 `WHERE user_id = ?` 隔离；新增 `AssignOrphanAssets` 方法
- `server/internal/handler/assets.go` — 5 个 CRUD handler 从 context 取 `userID`；路由注册包裹 auth 中间件
- `server/internal/middleware/cors.go` — 新增 `Access-Control-Allow-Credentials: true`
- `server/seed.go` — 新增 `seedUser` 创建默认用户（admin/admin123）；seed 资产归属到默认用户
- `server/main.go` — 注册 auth 路由
- `server/internal/store/store_test.go` — 适配新签名，新增用户隔离测试用例
- `server/go.mod` / `server/go.sum` — 新增 `golang.org/x/crypto/bcrypt` 依赖

## 认证方案
- Session Token 存 SQLite `sessions` 表，7 天有效期
- 密码 bcrypt 哈希
- Cookie `session_token`，HttpOnly + SameSite=Lax
- 不开放注册，seed 硬编码默认用户 admin/admin123

## 红线遵守
- ✅ 未引入 Web 框架，使用 `net/http` 标准库
- ✅ 未引入 ORM，使用 `database/sql` 直接写 SQL
- ✅ bcrypt 来自 `golang.org/x/crypto`，标准库扩展
- ✅ 未涉及前端改动（Step 12 负责）

## 验收结果
- `go build ./...` — 编译通过
- `go test ./internal/store/...` — 全部通过（含用户隔离测试）
- curl 测试：
  - 未登录 `GET /api/assets` → 401
  - 错误密码 `POST /api/login` → 401
  - 正确登录 → 200 + Set-Cookie
  - 带 Cookie `GET /api/assets` → 200，返回 10 条资产
  - `GET /api/me` → 200，返回用户信息
  - `POST /api/logout` → 200，之后访问 assets → 401
