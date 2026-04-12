# 资产汇总看板 iOS App — 项目规范

## 1. 项目概述

已有 Web 前端 + Go 后端的资产看板 iOS 原生客户端。复用后端 API，提供与 Web 端一致的功能：游客可浏览演示数据，登录后管理个人资产。

**核心目标：**

- 对接已有 Go 后端 REST API（`http://62.234.19.227`）
- 游客模式展示本地 Mock 数据（只读）
- 登录后展示真实数据，支持增删改查
- iOS 原生体验，深色主题为主

---

## 2. 技术栈（严格约束）

| 用途 | 选型 | 说明 |
|------|------|------|
| 语言 | **Swift** | — |
| UI 框架 | **SwiftUI** | 声明式 UI，最低支持 iOS 17 |
| 网络层 | **URLSession** | 系统自带，不引入 Alamofire 等第三方 |
| JSON 解析 | **Codable** | Swift 标准协议 |
| 图表 | **Swift Charts** | Apple 原生图表框架（iOS 16+） |
| Token 存储 | **Keychain**（Security framework） | 安全存储 session token |
| 包管理 | **不使用** | 不引入 SPM / CocoaPods 第三方依赖 |

### 禁止引入

- 第三方网络库（Alamofire、Moya）
- 第三方 JSON 库（SwiftyJSON）
- 第三方 UI 库
- 第三方状态管理（TCA 等）

---

## 3. 数据契约

### 与后端对齐的模型

```swift
enum AssetCategory: String, Codable, CaseIterable {
    case stock, etf, crypto, cash

    var label: String {
        switch self {
        case .stock:  return "股票"
        case .etf:    return "ETF"
        case .crypto: return "加密货币"
        case .cash:   return "现金"
        }
    }
}

struct Asset: Codable, Identifiable {
    let id: String
    var symbol: String
    var category: AssetCategory
    var costBasis: Double
    var currentPrice: Double
    var quantity: Double
    var currency: String
    let createdAt: String
    let updatedAt: String
}

struct User: Codable {
    let id: String
    let username: String
}
```

### 派生计算（与 Web 前端 calc.ts 一致，iOS 端本地计算）

```
市值 = currentPrice × quantity
成本 = costBasis × quantity
盈亏额 = 市值 - 成本
盈亏率 = 盈亏额 / 成本 × 100%
```

---

## 4. API 端点

基础地址：`http://62.234.19.227`

认证方式：`Authorization: Bearer <token>`（token 从 `/api/login` 响应的 Set-Cookie 中提取，或后端支持 Header 方式）

| 方法 | 路径 | 认证 | 说明 |
|------|------|------|------|
| GET | `/api/health` | 否 | 健康检查 |
| POST | `/api/login` | 否 | 登录，body: `{"username":"","password":""}` |
| POST | `/api/logout` | 是 | 登出 |
| GET | `/api/me` | 是 | 当前用户信息 |
| GET | `/api/assets` | 是 | 资产列表 |
| GET | `/api/assets/{id}` | 是 | 单条资产 |
| POST | `/api/assets` | 是 | 新增资产 |
| PUT | `/api/assets/{id}` | 是 | 更新资产 |
| DELETE | `/api/assets/{id}` | 是 | 删除资产 |

---

## 5. 开发计划

### 前置：后端适配（在 Web 项目中完成）

#### Step 13：后端支持 Bearer Token 认证

**目标：** auth 中间件同时支持 Cookie 和 Authorization Header，iOS 客户端可用 Bearer token 调用 API。

- 修改 `server/internal/middleware/auth.go`：优先读 `Authorization: Bearer <token>` header，fallback 到 Cookie
- 修改 `server/internal/handler/auth.go`：login 响应 body 中返回 `token` 字段，方便客户端提取
- CORS 中间件 `Access-Control-Allow-Headers` 补充 `Authorization`
- 现有 Web 前端行为不变（继续走 Cookie）

**验收：** curl 用 `-H "Authorization: Bearer <token>"` 可正常访问 `/api/assets`；Web 前端 Cookie 方式不受影响。

---

### Phase 5 — iOS App

#### Step 14：Xcode 项目初始化 + 网络层 + 登录

**目标：** iOS 项目能跑起来，能登录并获取资产数据。

- Xcode 创建 SwiftUI App 项目，目录 `ios/AssetDashboard/`
- 定义 Model 层：`Asset.swift`、`User.swift`（Codable，字段对齐后端）
- 定义 Mock 数据：`MockData.swift`，与 Web 端 `mock.ts` 一致的 10 条数据
- 封装 `APIClient.swift`：
  - 基础 URL 可配置
  - 所有请求附带 `Authorization: Bearer <token>`
  - `login(username, password) async throws -> (User, String)`（返回 user + token）
  - `logout() async`
  - `fetchMe() async throws -> User`
  - `fetchAssets() async throws -> [Asset]`
  - `createAsset(...)`, `updateAsset(...)`, `deleteAsset(...)` async throws
- Token 持久化：Keychain 存取（`KeychainHelper.swift`）
- 登录页面：用户名 + 密码输入框 + 登录按钮 + 错误提示
- 认证状态管理：`AuthViewModel`（`@Observable`）
  - 启动时从 Keychain 读 token → 调 `/api/me` 验证
  - 有效 → 已登录；无效 → 游客模式
- Tab 骨架：底部 TabView（总览、资产、设置）

**验收：** 模拟器运行，游客看到空骨架；输入 admin/admin123 登录成功，能打印出资产列表。

---

#### Step 15：看板首页

**目标：** 总览 Tab 展示核心指标和图表。

- 计算工具：`Calc.swift`，封装市值、盈亏等计算（与 Web 端 `calc.ts` 逻辑一致）
- 三张统计卡片：总资产、浮动盈亏（正绿负红）、投入本金
- 分类占比饼图（Swift Charts `SectorMark`）
- 涨跌排行 Top 5 列表
- 游客模式：从 MockData 加载 + 显示「演示模式」banner
- 登录模式：从 API 拉取
- 下拉刷新（`.refreshable`）

**验收：** 游客看到 Mock 数据看板；登录后看到真实数据。

---

#### Step 16：资产列表 + CRUD

**目标：** 资产 Tab 展示明细，支持增删改查。

- 资产列表（`List`），显示：名称、分类、市值、盈亏额、盈亏率
- 盈亏正绿负红
- 点击排序（按市值、盈亏率等）
- 新增资产：NavigationLink 或 Sheet 表单（代码、分类、成本价、现价、数量）
- 编辑资产：点击行进入编辑表单
- 删除资产：左滑删除 + `.confirmationDialog` 确认
- 游客模式：隐藏新增按钮，禁用编辑/删除
- 空状态引导

**验收：** 登录后可新增、编辑、删除资产；退出登录回到游客模式。

---

#### Step 17：体验打磨

**目标：** 补全细节，打磨原生体验。

- 数字格式化（千分位、2 位小数、¥ 前缀）
- 深色主题适配（跟随系统或强制深色）
- 加载状态（ProgressView）
- 网络错误处理 + 重试提示
- App Icon 设计（简约金融风）
- 设置页面：显示当前用户、服务器地址、登出按钮

**验收：** 整体交互流畅，无崩溃，深色主题下视觉一致。

---

## 6. UI 设计规范

| 项目 | 规范 |
|------|------|
| 主题 | 深色优先，跟随系统 `colorScheme` |
| 强调色 | 系统蓝 `.blue` |
| 盈利色 | `.green`（`#22c55e`） |
| 亏损色 | `.red`（`#ef4444`） |
| 字体 | 数字使用 `.monospacedDigit()` |
| 导航 | 底部 `TabView`（总览、资产、设置） |
| 列表 | 系统 `List` 样式，`.insetGrouped` |

---

## 7. 文件结构参考

```
ios/AssetDashboard/
├── AssetDashboardApp.swift          # App 入口
├── ContentView.swift                # TabView 容器
├── Model/
│   ├── Asset.swift                  # Asset + AssetCategory
│   ├── User.swift                   # User
│   └── MockData.swift               # 10 条 Mock 数据
├── Network/
│   ├── APIClient.swift              # URLSession 封装
│   └── KeychainHelper.swift         # Keychain 存取 token
├── ViewModel/
│   ├── AuthViewModel.swift          # 登录状态管理
│   ├── DashboardViewModel.swift     # 看板数据
│   └── AssetListViewModel.swift     # 资产列表数据
├── View/
│   ├── Auth/
│   │   └── LoginView.swift
│   ├── Dashboard/
│   │   ├── DashboardView.swift
│   │   ├── StatCardView.swift
│   │   └── CategoryPieChart.swift
│   ├── Assets/
│   │   ├── AssetListView.swift
│   │   ├── AssetRowView.swift
│   │   └── AssetFormView.swift
│   └── Settings/
│       └── SettingsView.swift
├── Util/
│   └── Calc.swift                   # 市值、盈亏计算
└── Assets.xcassets/                 # 图标资源
```

---

## 8. 注意事项

- **不引入任何第三方依赖**，全部用 Apple 系统框架
- **Model 字段与后端 JSON 严格对齐**，使用 Codable 自动解析
- **派生计算留在客户端**，后端只做存储和 CRUD（与 Web 端一致）
- **Token 不能存 UserDefaults**，必须用 Keychain
- **每个 Step 结束后必须能完整运行**，不允许留下半成品
- **游客模式不发任何 API 请求**，只读本地 Mock 数据
