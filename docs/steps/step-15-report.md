# Step 15 执行简报 — iOS 看板首页

## 交付内容

### 新增文件
- `ios/AssetDashboard/ViewModel/DashboardViewModel.swift` — 看板数据管理（加载资产、计算汇总、分类占比、Top 5 排行）
- `ios/AssetDashboard/View/Dashboard/DashboardView.swift` — 看板主视图（统计卡片 + 饼图 + 排行 + 游客 banner + 空状态 + 下拉刷新）
- `ios/AssetDashboard/View/Dashboard/StatCardView.swift` — 统计卡片组件（标题、数值、副标题、图标、颜色）
- `ios/AssetDashboard/View/Dashboard/CategoryPieChart.swift` — 分类占比饼图（Swift Charts SectorMark + 图例）

### 修改文件
- `ios/AssetDashboard/ContentView.swift` — 总览 Tab 接入 DashboardView

## 功能要点
- 三张统计卡片：总资产、浮动盈亏（正绿负红 + 百分比）、投入本金
- 分类占比环形饼图（Swift Charts SectorMark），带图例显示占比和金额
- 涨跌排行 Top 5（按盈亏率排序）
- 游客模式：从 MockData 加载 + 蓝色演示 banner
- 登录模式：从 API 拉取，登录/登出时自动切换数据源
- 下拉刷新（`.refreshable`）

## 红线遵守
- ✅ 未引入第三方依赖
- ✅ 派生计算使用 Calc.swift（与 Web 端一致）
- ✅ 游客模式不发 API 请求

## 验收结果
- `xcodebuild build` — 编译通过
- 模拟器运行：游客看到 Mock 数据看板 + 演示 banner
- 登录后：自动切换为真实 API 数据
- 饼图正确渲染，Top 5 排行正确排序
- 下拉刷新正常
