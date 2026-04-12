# Step 16 执行简报 — iOS 资产列表 + CRUD

## 交付内容

### 新增文件
- `ios/AssetDashboard/ViewModel/AssetListViewModel.swift` — 资产列表数据管理（加载、排序、CRUD 操作）
- `ios/AssetDashboard/View/Assets/AssetListView.swift` — 资产列表主视图（列表 + 排序菜单 + 新增/编辑/删除交互 + 游客 banner + 空状态）
- `ios/AssetDashboard/View/Assets/AssetRowView.swift` — 单行资产展示（名称、分类、市值、盈亏额、盈亏率）
- `ios/AssetDashboard/View/Assets/AssetFormView.swift` — 新增/编辑表单（Sheet，含校验 + 错误提示）

### 修改文件
- `ios/AssetDashboard/ContentView.swift` — 资产 Tab 接入 AssetListView

## 功能要点
- 资产列表：List + insetGrouped 样式，显示名称、分类、市值、盈亏
- 盈亏正绿负红
- 排序：toolbar 菜单选择排序字段（名称/分类/市值/盈亏额/盈亏率），点击同一字段切换升降序
- 新增资产：右上角 + 按钮 → Sheet 表单（代码、分类、成本价、现价、数量）
- 编辑资产：点击行 → Sheet 预填充表单
- 删除资产：左滑删除 → confirmationDialog 确认
- 游客模式：隐藏 + 按钮、禁用编辑/删除、显示演示 banner
- 空状态引导
- 下拉刷新
- 登录/登出自动切换数据源

## 红线遵守
- ✅ 未引入第三方依赖
- ✅ 游客模式不发 API 请求
- ✅ 表单校验：所有字段必填，数值 > 0

## 验收结果
- `xcodebuild build` — 编译通过
- 模拟器运行：
  - 游客：Mock 数据列表 + 演示 banner，无编辑/删除/新增
  - 登录后：真实数据，新增/编辑/删除正常
  - 排序切换正常
  - 左滑删除 + 确认弹窗正常
  - 登出回到游客模式
