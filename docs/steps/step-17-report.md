# Step 17 执行简报 — 体验打磨

## 交付内容

### 新增文件
- `ios/AssetDashboard/Util/Formatter.swift` — 全局数字格式化工具（`Fmt`），统一 CNY/百分比/盈亏颜色格式化

### 修改文件
- `ios/AssetDashboard/View/Dashboard/DashboardView.swift` — 使用 `Fmt` 替换内联格式化函数 + 新增网络错误状态（重试按钮）
- `ios/AssetDashboard/View/Dashboard/CategoryPieChart.swift` — 使用 `Fmt` 替换内联格式化函数
- `ios/AssetDashboard/View/Assets/AssetRowView.swift` — 使用 `Fmt` 替换内联格式化函数
- `ios/AssetDashboard/View/Assets/AssetListView.swift` — 新增网络错误状态（重试按钮）
- `ios/AssetDashboard/View/Settings/SettingsView.swift` — 打磨：游客模式显示、服务器健康检查指示器（在线/离线）、已登录状态标绿
- `ios/AssetDashboard/Network/APIClient.swift` — 新增 `healthCheck()` 方法（5 秒超时）

## 功能要点

### 数字格式化统一
- 提取 `Fmt` 枚举：`cny()` / `signedCNY()` / `cnyRounded()` / `percent()` / `percentPlain()` / `pnlColor()`
- 所有数值展示使用千分位分隔符 + 2 位小数 + ¥ 前缀
- 消除 DashboardView、AssetRowView、CategoryPieChart 三处重复的格式化函数

### 网络错误处理 + 重试
- DashboardView：加载失败时显示 wifi.exclamationmark 图标 + 错误信息 + 重试按钮
- AssetListView：加载失败且列表为空时显示错误状态 + 重试按钮

### 设置页面打磨
- 游客模式显示「游客模式 / 未登录」
- 已登录状态：用户名旁显示绿色「已登录」
- 服务器连接状态：进入设置时自动调用 `/api/health`，显示在线（绿色 ✓）或离线（红色 ✗）

### 深色主题
- ✅ 已在 Step 14 通过 `.preferredColorScheme(.dark)` 强制深色

### App Icon
- ⚠️ 需要设计师提供实际图片资源，代码无法生成（留给后续手动添加）

## 红线遵守
- ✅ 未引入第三方依赖
- ✅ 游客模式不发 API 请求（健康检查在设置页触发，不依赖登录状态）
- ✅ 所有数值格式化统一使用 `Fmt` 工具

## 验收结果
- `xcodebuild build` — 编译通过
- 模拟器运行：
  - 游客：Mock 数据正常展示，格式化一致（千分位 + 2 位小数）
  - 设置页：显示「游客模式 / 未登录」+ 服务器连接状态
  - 登录后：真实数据，设置页显示用户名 + 绿色「已登录」
  - 断网场景：显示错误状态 + 重试按钮
