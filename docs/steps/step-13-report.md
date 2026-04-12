# Step 13 执行简报 — 后端支持 Bearer Token 认证

## 交付内容

### 修改文件
- `server/internal/middleware/auth.go` — 新增 `ExtractToken` 函数，优先读 `Authorization: Bearer <token>` header，fallback 到 Cookie；Auth 中间件改用统一的 ExtractToken
- `server/internal/handler/auth.go` — login 响应新增 `token` 字段；me/logout 改用 `middleware.ExtractToken` 统一提取 token（同时支持 Header 和 Cookie）
- `server/internal/middleware/cors.go` — `Access-Control-Allow-Headers` 补充 `Authorization`

## 改动要点
- Bearer Token 和 Cookie 两种认证方式并存，优先 Header
- login 响应格式：`{"id":"...","username":"...","createdAt":"...","token":"..."}`
- Web 前端无需任何改动，继续走 Cookie
- iOS 客户端可从 login 响应提取 token，后续用 `Authorization: Bearer <token>` 调用 API

## 红线遵守
- ✅ 未引入第三方依赖
- ✅ 未修改前端代码
- ✅ 现有 Cookie 认证行为完全兼容

## 验收结果
- `go build ./...` — 编译通过
- `go test ./internal/store/...` — 全部通过
- `npx tsc -b` — 0 错误（前端未改动）
- curl 测试：
  - login 响应包含 `token` 字段
  - `Authorization: Bearer <token>` 访问 /api/me、/api/assets — 200
  - Cookie 方式访问 — 200（兼容不变）
  - Bearer logout 后 token 失效 — 401
