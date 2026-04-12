# Step 14 执行简报 — Xcode 项目初始化 + 网络层 + 登录

## 交付内容

### 新增文件（`ios/AssetDashboard/`）
- `AssetDashboardApp.swift` — App 入口，初始化 AuthViewModel，强制深色主题
- `ContentView.swift` — TabView 容器（总览、资产、设置），初始化 loading 状态
- `Model/Asset.swift` — Asset + AssetCategory（Codable，与后端对齐）
- `Model/User.swift` — User、LoginResponse、ErrorResponse
- `Model/MockData.swift` — 10 条 Mock 数据（与 Web 端 mock.ts 一致）
- `Network/APIClient.swift` — URLSession 封装，Bearer token 认证，login/logout/me/assets CRUD
- `Network/KeychainHelper.swift` — Keychain 存取 session token
- `ViewModel/AuthViewModel.swift` — @MainActor @Observable，登录状态管理
- `View/Auth/LoginView.swift` — 登录表单（用户名 + 密码 + 错误提示）
- `View/Settings/SettingsView.swift` — 设置页（账户信息、登录/登出、服务器地址、版本）
- `Util/Calc.swift` — 派生计算（市值、盈亏，与 Web 端 calc.ts 一致）
- `Info.plist` — App Transport Security 允许 HTTP
- `Assets.xcassets/` — 资源目录骨架

### 项目配置
- `ios/project.yml` — xcodegen 项目配置
- `ios/AssetDashboard.xcodeproj` — 生成的 Xcode 项目
- 部署目标：iOS 18.0+
- Swift 6.0，严格并发检查通过

## 红线遵守
- ✅ 未引入任何第三方依赖（纯 Apple 系统框架）
- ✅ Model 字段与后端 JSON 严格对齐
- ✅ Token 存储使用 Keychain
- ✅ 派生计算在客户端本地
- ✅ 总览和资产 Tab 为占位符（Step 15/16 实现）

## 验收结果
- `xcodebuild build` — 编译通过（0 error，0 warning）
- 模拟器启动：显示 TabView 三个 tab
- 设置页：登录按钮可点击，弹出登录表单
- 登录 admin/admin123：连接公网 API 成功，显示已登录状态
- 登出：回到未登录状态
