# 资产汇总看板 (Asset Dashboard) — 项目规范 v3

## 1. 项目概述

一款**纯前端 → 前后端分离**的个人资产记录与汇总工具。用户可录入股票、ETF、加密货币、现金等资产，系统自动计算总资产、盈亏，并以图表展示分类占比。

**核心目标：**

- 提供清晰的全局资产视图（总资产、各分类占比、盈亏情况）
- 支持多类资产的增删改查
- 数据持久化（Phase 1 使用 localStorage，Phase 2 起切换为 Go + SQLite 后端）
- 界面具备现代金融产品的专业感，深色主题为主
- Go 后端可编译为单二进制部署到 VPS

---

## 2. 技术栈（严格约束）

### 前端

| 用途 | 选型 | 说明 |
|------|------|------|
| 构建工具 | **Vite** | 轻量快速，纯前端最佳选择 |
| 核心框架 | **React 18 + TypeScript** | — |
| 样式方案 | **Tailwind CSS** | 实用优先，适合快速开发 |
| UI 组件库 | **Shadcn UI** | 按需复制组件，不引入额外依赖 |
| 图表库 | **Recharts** | React 生态主流图表库（Step 7 起引入） |
| 图标库 | **Lucide React** | — |
| 包管理器 | **npm** | — |

### 后端（Phase 2 起引入）

| 用途 | 选型 | 说明 |
|------|------|------|
| 语言 | **Go 1.22+** | 标准库 ServeMux 已支持 method + path pattern routing |
| 路由 | **`net/http` 标准库** | 不引入 gin/echo/chi 等框架 |
| 数据库 | **SQLite** | 单文件零运维，贴合个人工具定位 |
| SQLite 驱动 | **`modernc.org/sqlite`** | 纯 Go 实现，无 CGO，交叉编译友好 |
| SQL 层 | **`database/sql`** | 直接写 SQL，不用 ORM，不用 sqlc |
| 数据库迁移 | **goose** | 纯 SQL 迁移文件，轻量 |
| JSON | **stdlib `encoding/json`** | 无需第三方 |
| CORS | **手写中间件** | 开发阶段允许 localhost:5173，不拉依赖 |
| 密码哈希 | **`golang.org/x/crypto/bcrypt`** | 标准库扩展，不算第三方框架 |
| 部署 | **`go build` → 单二进制 + data.db** | scp 到 VPS 即可运行 |

### 类型同步策略

前后端各自维护一份 `Asset` 类型定义（前端 `src/lib/types.ts`，后端 `server/internal/model/asset.go`），手动保持一致。字段变更时两端都要改。

---

## 3. 数据契约 (Data Schema)

所有组件必须基于以下接口构建，不得随意扩展字段。

```typescript
// 资产分类
type AssetCategory = 'stock' | 'etf' | 'crypto' | 'cash';

// 资产分类中文映射
const CATEGORY_LABELS: Record<AssetCategory, string> = {
  stock: '股票',
  etf: 'ETF',
  crypto: '加密货币',
  cash: '现金',
};

// 单条资产记录
interface Asset {
  id: string;            // 唯一 ID（使用 crypto.randomUUID()）
  symbol: string;        // 资产代码/名称，如 "AAPL"、"BTC"
  category: AssetCategory;
  costBasis: number;     // 持仓成本价（单价）
  currentPrice: number;  // 当前市价（单价）
  quantity: number;      // 持有数量
  currency: string;      // 币种，默认 "CNY"
  createdAt: string;     // ISO 8601 创建时间
  updatedAt: string;     // ISO 8601 更新时间
}

// 派生计算（不存储，实时计算，保留在前端 calc.ts）
// 市值 = currentPrice × quantity
// 成本 = costBasis × quantity
// 盈亏额 = 市值 - 成本
// 盈亏率 = 盈亏额 / 成本 × 100%
```

Go 后端对应 struct：

```go
type Asset struct {
    ID           string  `json:"id"`
    Symbol       string  `json:"symbol"`
    Category     string  `json:"category"`
    CostBasis    float64 `json:"costBasis"`
    CurrentPrice float64 `json:"currentPrice"`
    Quantity     float64 `json:"quantity"`
    Currency     string  `json:"currency"`
    CreatedAt    string  `json:"createdAt"`
    UpdatedAt    string  `json:"updatedAt"`
}
```

### 用户与认证（Phase 4 引入）

```typescript
// 用户（仅后端存储，前端只用 id + username）
interface User {
  id: string;
  username: string;
}

// 前端认证状态
interface AuthState {
  user: User | null;    // null = 游客
  loading: boolean;     // 初始化时检查登录态
}
```

Go 后端对应 struct：

```go
type User struct {
    ID           string `json:"id"`
    Username     string `json:"username"`
    PasswordHash string `json:"-"`          // 不序列化到 JSON
    CreatedAt    string `json:"createdAt"`
}

type Session struct {
    Token     string
    UserID    string
    ExpiresAt string
}
```

---

## 4. 页面结构

```
┌──────────────────────────────────────────────┐
│  App                                         │
│  ┌────────┬─────────────────────────────────┐│
│  │        │  Header (页面标题 + 日期)         ││
│  │ Sidebar│─────────────────────────────────││
│  │        │                                 ││
│  │ · 总览  │  Main Content Area              ││
│  │ · 资产  │  (根据当前页面切换内容)            ││
│  │ · 设置  │                                 ││
│  │        │                                 ││
│  └────────┴─────────────────────────────────┘│
└──────────────────────────────────────────────┘
```

- **侧边栏**：固定宽度 240px，深色背景，包含导航项（总览、资产列表、设置）
- **Header**：显示当前页面名称、当前日期
- **Main**：根据导航切换内容，使用简单的状态切换（无需 React Router）

---

## 5. 开发计划 (Milestones)

每个 Step 为一次完整可运行的交付，按顺序执行。分为三个 Phase。

---

### Phase 1 — 前端基础（已完成）

#### Step 1：项目初始化 + 全局布局骨架 ✅

**目标：** 项目能跑起来，看到左右分栏布局。

- 使用 Vite 创建 React + TypeScript 项目
- 配置 Tailwind CSS
- 安装 Shadcn UI（初始化 + 引入 Button、Card 组件验证可用）
- 实现布局骨架：Sidebar + Header + Main 三区域
- Sidebar 包含三个导航项，点击可高亮切换
- 深色主题配色

**验收：** 浏览器打开能看到完整布局，点击侧边栏导航项能切换高亮状态。

---

#### Step 2：Mock 数据 + 本地存储层 ✅

**目标：** 数据层就绪，组件可以读写资产数据。

- 创建 `src/data/mock.ts`，包含 8-10 条覆盖全分类的示例数据
- 创建 `src/hooks/useAssets.ts` 自定义 Hook，封装：
  - `assets`: 资产列表
  - `addAsset(asset)`: 新增
  - `updateAsset(id, partial)`: 更新
  - `deleteAsset(id)`: 删除
  - 派生数据：`totalValue`、`totalCost`、`totalPnL`、`categoryBreakdown`
- 首次加载时将 Mock 数据写入 localStorage，后续从 localStorage 读取
- 创建 `src/lib/calc.ts`，封装所有计算逻辑（市值、盈亏等）

**验收：** 在控制台或临时组件中能看到数据正确加载和计算结果。

---

### Phase 2 — Go 后端

#### Step 3：Go 项目骨架 + Health API

**目标：** Go 后端能跑起来，能响应一个 HTTP 请求。

- 在项目根目录创建 `server/` 子目录
- `go mod init` 初始化 Go 模块
- `server/main.go`：使用 `net/http` 启动 HTTP server 监听 `:8080`
- 唯一路由 `GET /api/health` → `{"status":"ok"}`
- 在项目根 `CLAUDE.md` 补充后端启动命令

**验收：** `go run ./server` 启动成功，`curl localhost:8080/api/health` 返回 `{"status":"ok"}`。

---

#### Step 4：SQLite 数据层 + 迁移 + Seed

**目标：** 数据库就绪，Go 代码可以读写资产数据。

- 安装依赖：`modernc.org/sqlite`、`github.com/pressly/goose/v3`
- goose 迁移文件 `server/migrations/001_create_assets.sql`：建 `assets` 表，字段与前端 `Asset` 一一对应
- `server/internal/model/asset.go`：Go `Asset` struct + JSON tags，手动对齐前端 `src/lib/types.ts`
- `server/internal/store/store.go`：封装 `*sql.DB`，提供方法：
  - `ListAssets() ([]Asset, error)`
  - `GetAsset(id string) (Asset, error)`
  - `CreateAsset(a Asset) error`
  - `UpdateAsset(a Asset) error`
  - `DeleteAsset(id string) error`
- Seed 函数：首次启动若表空则插入与前端 `mock.ts` 相同的 10 条数据
- 数据库文件位于 `server/data.db`（已加入 `.gitignore`）

**验收：** `go test ./server/internal/store/...` 通过，能正确增删改查。

---

#### Step 5：Assets CRUD API

**目标：** 5 个 RESTful 端点可通过 curl 测试通过。

- `server/internal/handler/assets.go`：实现 5 个 handler
  - `GET    /api/assets`      → 返回全部资产列表
  - `GET    /api/assets/{id}` → 返回单条资产
  - `POST   /api/assets`      → 新增资产
  - `PUT    /api/assets/{id}` → 更新资产
  - `DELETE /api/assets/{id}` → 删除资产
- JSON 请求 / 响应格式与前端 `Asset` 接口一致
- 错误返回统一格式 `{"error":"..."}`，合理使用 HTTP 状态码（400/404/500）
- CORS 中间件 `server/internal/middleware/cors.go`（允许 `localhost:5173`）

**验收：** 用 `curl` 逐一测试五个端点，增删改查闭环正常。

---

#### Step 6：前端接入后端

**目标：** 前端数据来源从 localStorage 切换为 Go API，全链路跑通。

- `vite.config.ts` 添加 `server.proxy`：`/api` → `http://localhost:8080`
- 改写 `src/hooks/useAssets.ts`：
  - CRUD 操作全部替换为 `fetch('/api/...')`
  - 删除 localStorage 读写逻辑
  - 删除对 `src/data/mock.ts` 的 import（Mock 数据由后端 Seed 提供）
- 派生计算（`totalValue` 等）保留在前端 `calc.ts`，不搬到后端
- `src/data/mock.ts` 保留文件但不再被前端引用（后端 Seed 仍参考其数据）

**验收：** 同时启动 Go server（`go run ./server`）+ Vite dev（`npm run dev`），前端页面展示的数据来自 SQLite，手动增删改查后刷新页面数据不丢失。

---

### Phase 3 — 前端功能完善（基于真实 API）

#### Step 7：首页看板 (Dashboard)

**目标：** 总览页展示核心指标和分类占比图表。

- 三张统计卡片，横向排列：
  - **总资产**（所有资产市值之和，最大字号突出显示）
  - **浮动盈亏**（总市值 - 总成本，正绿负红，显示金额和百分比）
  - **投入本金**（所有资产成本之和）
- 分类占比饼图（Recharts PieChart）：按 stock/etf/crypto/cash 分类，显示各类市值占比
- 资产涨跌排行（可选）：按盈亏率排序的 Top 5 列表
- 删除 `src/App.tsx` 中 Step 2 遗留的临时 `DataSelfCheck` 组件

**验收：** 看板数据与 API 返回数据计算一致，饼图正确渲染。

---

#### Step 8：资产列表页

**目标：** 展示所有资产明细，支持排序。

- 使用 Shadcn Table 组件展示资产列表
- 列：名称/代码、分类、数量、成本价、现价、市值、盈亏额、盈亏率
- 盈亏列：正值绿色、负值红色
- 支持按列点击排序
- 每行末尾有「编辑」「删除」操作按钮

**验收：** 列表正确显示所有资产数据，排序功能正常。

---

#### Step 9：新增 / 编辑资产

**目标：** 用户可以手动录入和修改资产。

- 点击「新增资产」按钮弹出 Dialog/Sheet 表单
- 表单字段：代码、分类（下拉选择）、成本价、现价、数量
- 表单校验：所有字段必填，数值必须 > 0
- 编辑模式：点击列表行的「编辑」按钮，弹出预填充表单
- 提交后数据写入后端并刷新列表

**验收：** 能正常新增、编辑资产，刷新页面数据不丢失。

---

#### Step 10：删除确认 + 全局优化

**目标：** 补全交互细节，打磨体验。

- 删除前弹出确认对话框
- 空状态处理（无资产时显示引导）
- 数字格式化（千分位、保留 2 位小数）
- 响应式适配（侧边栏在窄屏可折叠）
- 加载状态和过渡动画

**验收：** 所有交互流程顺畅，无控制台报错。

---

### Phase 4 — 用户认证

#### Step 11：后端认证体系

**目标：** 后端支持单用户登录，资产数据按用户隔离。

- 新增 goose 迁移：
  - `users` 表：`id`, `username`, `password_hash`, `created_at`
  - `sessions` 表：`token`, `user_id`, `expires_at`
  - `assets` 表新增 `user_id` 列，已有数据归属到 seed 用户
- `server/internal/model/user.go`：`User` 和 `Session` struct
- `server/internal/store/user.go`：用户和会话的 CRUD 方法
- 密码哈希使用 `golang.org/x/crypto/bcrypt`
- 新增 API：
  - `POST /api/login` — 验证用户名密码，创建 session，Set-Cookie 返回 token
  - `POST /api/logout` — 删除 session，清除 Cookie
  - `GET /api/me` — 返回当前用户信息，未登录返回 401
- 不开放注册，提供 CLI seed 方式创建账号（在 seed 函数中硬编码一个默认用户，用户名密码从环境变量或写死）
- `server/internal/middleware/auth.go`：
  - 从 Cookie 读 token，查 sessions 表验证
  - 验证通过后将 `user_id` 注入 `context`
- `/api/assets/*` 全部包裹 auth 中间件，store 层查询加 `WHERE user_id = ?`
- `/api/health`, `/api/login`, `/api/me` 不需要认证

**验收：** 用 curl 测试：未登录访问 `/api/assets` 返回 401；登录后带 Cookie 可正常 CRUD；数据按 user_id 隔离。

---

#### Step 12：前端登录与双模式切换

**目标：** 前端区分游客/登录态，游客看 mock 静态数据（只读），登录后看真实数据（完整 CRUD）。

- 新增 `src/hooks/useAuth.ts`：
  - 启动时调 `GET /api/me`，成功 → 已登录，401 → 游客
  - `login(username, password)` → `POST /api/login`
  - `logout()` → `POST /api/logout`
  - 暴露 `user: User | null`、`loading: boolean`
- 改造 `src/hooks/useAssets.ts`：
  - 接收 `isLoggedIn` 参数
  - 游客态：从 `mock.ts` 读取静态数据，CRUD 方法不可用（不暴露或返回 no-op）
  - 登录态：走 `/api/assets`（现有逻辑不变）
- UI 改动：
  - Header 右上角：游客显示「登录」按钮，登录后显示用户名 + 「登出」按钮
  - 点击「登录」弹出 Dialog（Shadcn Dialog + Input），包含用户名、密码输入框 + 提交
  - 登录失败显示错误提示
  - 游客模式下：资产列表隐藏「编辑」「删除」按钮，隐藏「新增资产」按钮
  - 游客模式下：页面顶部展示一条提示 banner「当前为演示模式，登录后管理您的资产」

**验收：** 未登录可浏览 mock 数据看板（只读）；登录后看到真实数据并可增删改查；登出后回到游客模式。

---

## 6. UI 设计规范

| 项目 | 规范 |
|------|------|
| 主题 | 深色（dark），背景 `#0a0a0a` ~ `#1a1a1a` |
| 强调色 | 蓝色系 `#3b82f6`，用于导航高亮、按钮 |
| 盈利色 | `#22c55e`（绿） |
| 亏损色 | `#ef4444`（红） |
| 字体 | 系统字体栈，数字使用等宽字体 `font-mono` |
| 卡片 | 圆角 `rounded-xl`，微妙边框 `border-border/50` |
| 间距 | 主内容区 `p-6`，卡片间距 `gap-6` |

---

## 7. 文件结构参考

```
VibeCoding/
├── src/                            # 前端
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── AppLayout.tsx
│   │   ├── ui/                     # Shadcn 组件
│   │   ├── dashboard/
│   │   │   ├── StatCard.tsx
│   │   │   └── CategoryPieChart.tsx
│   │   ├── auth/
│   │   │   └── LoginDialog.tsx
│   │   └── assets/
│   │       ├── AssetTable.tsx
│   │       └── AssetForm.tsx
│   ├── hooks/
│   │   ├── useAssets.ts
│   │   └── useAuth.ts
│   ├── lib/
│   │   ├── calc.ts
│   │   ├── types.ts
│   │   └── utils.ts
│   ├── data/
│   │   └── mock.ts
│   ├── App.tsx
│   └── main.tsx
├── server/                         # Go 后端（Phase 2 起创建）
│   ├── main.go
│   ├── go.mod
│   ├── go.sum
│   ├── internal/
│   │   ├── model/
│   │   │   ├── asset.go
│   │   │   └── user.go
│   │   ├── store/
│   │   │   ├── store.go
│   │   │   ├── store_test.go
│   │   │   └── user.go
│   │   ├── handler/
│   │   │   ├── assets.go
│   │   │   └── auth.go
│   │   └── middleware/
│   │       ├── cors.go
│   │       └── auth.go
│   ├── migrations/
│   │   ├── 001_create_assets.sql
│   │   ├── 002_create_users.sql
│   │   └── 003_add_user_id_to_assets.sql
│   └── seed.go
├── asset-dashboard-spec.md
├── CLAUDE.md
└── docs/steps/
```

---

## 8. 注意事项

- **不要过早引入路由库**：只有 3 个页面，用 `useState` 切换即可
- **不要过早引入状态管理库**：`useAssets` Hook 足够当前需求
- **Go 后端不引入 Web 框架**（gin/echo/chi），用 `net/http` 标准库
- **Go 后端不引入 ORM**（gorm 等），用 `database/sql` 直接写 SQL
- **前后端类型手动同步**：`Asset` 字段变更时两端都要改
- **派生计算留在前端**：`calc.ts` 不搬到后端，后端只做存储和 CRUD
- **所有金额计算使用原始数值**，仅在展示层格式化
- **每个 Step 结束后必须能完整运行**，不允许留下半成品
