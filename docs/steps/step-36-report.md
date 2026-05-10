# Step 36: 资产结构扩展 — 公积金、负债、移动端与系统主题

## 背景
本轮围绕真实资产口径继续扩展：现金和公积金需要从市场板块里独立展示；总览需要支持
是否纳入公积金；还需要新增负债模块、手机端可用布局，以及跟随系统白天 / 黑夜模式。
同时处理了几次真实资产数据核对和线上同步，但真实 seed / 缓存文件不纳入 git。

## 交付内容

### 1. 公积金资产分类
- 新增 `provident_fund` 资产分类，后端 CHECK 约束通过迁移 013 放开
- 前端类型、分类标签、饼图颜色、Dashboard 统计口径同步支持
- iOS Asset model 和分类图同步识别公积金
- 线上已新增公积金资产，余额口径按用户确认的 `192148.99 CNY`

### 2. 现金 / 公积金独立板块
- 资产页展示板块改为：A股 / 港股 / 美股 / 黄金 / 加密货币 / 现金 / 公积金
- 资产结构面板的“市场”视图同步把现金、公积金拆成独立项
- 总览页新增“包含公积金” checkbox，默认不包含，切换后重新计算总资产、盈亏、风险、结构等派生指标

### 3. 负债模块
- 新增 `liabilities` 表和迁移 014
- 新增 Go model / store / handler，注册 `/api/liabilities`
- 前端新增 `useLiabilities`、`LiabilityForm`、`LiabilityTable`
- 资产页顶部 Tab 扩展为“持仓 / 已清仓 / 负债”
- Dashboard 新增总负债、净资产、负债率指标
- 负债只记录当前余额，不追溯还款流水，派生计算仍在前端完成

### 4. 小屏幕适配
- App 外壳、Header、Dialog、统计卡片、总览面板、资产表单、负债表单做响应式调整
- 资产页和负债页新增移动端卡片视图，桌面端继续保留表格视图
- Owner tab、板块汇总、资产明细展开等关键区域避免小屏横向挤压

### 5. 系统白天 / 黑夜模式
- 新增 `useTheme`，支持 `system | light | dark`
- 默认跟随系统，设置页可手动切换，选择写入 `localStorage`
- 顶层应用启动时应用主题，监听系统主题变化
- 去掉 `index.html` 的硬编码 `class="dark"`，避免浅色模式首屏闪深色
- 布局、导航、设置页、表单 option、图表 tooltip 等高频硬编码深色样式改为 CSS 变量

### 6. 真实数据核对与同步
- 修正中欧时代先锋异常识别结果，恢复正确买卖记录结构
- 新增 / 更新现金类资产：人民币现金、港币现金、招行美元定期
- 部署前按真实数据操作流程创建备份
- 真实数据 seed 和缓存文件不纳入 git，避免泄露和误提交

## 关键文件

| 文件 | 变更 |
|------|------|
| `server/migrations/013_add_provident_fund_category.sql` | 放开 assets.category 支持 `provident_fund` |
| `server/migrations/014_create_liabilities.sql` | 新建负债表 |
| `server/internal/{model,store,handler}/liability*.go` | 负债 API 后端实现 |
| `server/main.go` | 注册 liabilities 路由 |
| `src/lib/types.ts` | 公积金 / 负债类型、标签、顺序 |
| `src/components/assets/AssetTable.tsx` | 独立现金/公积金板块、负债 Tab、移动端卡片 |
| `src/components/assets/LiabilityForm.tsx` | 负债新增 / 编辑表单 |
| `src/components/assets/LiabilityTable.tsx` | 负债列表与移动端卡片 |
| `src/hooks/useLiabilities.ts` | 负债数据 hook |
| `src/hooks/useTheme.ts` | 系统主题 hook |
| `src/components/settings/Settings.tsx` | 外观模式设置入口 |
| `src/index.css` | light/dark CSS 变量与兼容样式 |
| `src/components/dashboard/Dashboard.tsx` | 公积金纳入开关、负债净值指标 |
| `src/components/dashboard/AssetStructurePanel.tsx` | 市场结构拆出现金 / 公积金 |
| `ios/AssetDashboard/*` | iOS 分类模型和分类图支持公积金 |

## 红线遵守
- 未引入 React Router、状态管理库或新 UI 框架
- 后端仍使用 `net/http` + `database/sql`，未引入 ORM
- 市值、盈亏、负债率等派生指标仍在前端计算
- Schema 变更全部走 goose migration，未手动改 SQLite schema
- 真实数据文件不纳入 git；缓存目录不提交

## 验收结果
- `rtk npm run build` 通过
- `rtk bash deploy/deploy.sh` 已部署
- `rtk proxy curl -s http://62.234.19.227/api/health` 返回 `{"status":"ok"}`
- 线上首页已更新到最新前端资源

## 备份
- 部署移动端适配前备份：`/Users/theodore/Desktop/VibeCoding-backups/2026-05-11_005724_before-deploy-mobile-responsive`
- 部署主题适配前备份：`/Users/theodore/Desktop/VibeCoding-backups/2026-05-11_010331_before-deploy-theme`

## 已知限制
- `useTheme` 依赖前端运行后设置 class，极早期首屏仍以浅色变量为默认；已去掉 HTML 硬编码深色来降低闪烁
- 负债模块当前是余额台账，不保存还款流水或历史负债曲线
- 小程序目录仍未纳入当前 git 追踪，本 Step 不提交 `miniprogram/`
