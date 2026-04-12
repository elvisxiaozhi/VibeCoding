# Step 9 执行简报 — 新增 / 编辑资产

> 交付日期：2026-04-12
> 目标：实现资产新增与编辑功能（Dialog 表单）

---

## 1. 新增文件

| 路径 | 作用 |
|------|------|
| `src/components/ui/dialog.tsx` | Shadcn Dialog 组件（基于 @radix-ui/react-dialog），手动安装 |
| `src/components/ui/input.tsx` | Shadcn Input 组件（styled HTML input） |
| `src/components/ui/label.tsx` | Shadcn Label 组件（基于 @radix-ui/react-label） |
| `src/components/assets/AssetForm.tsx` | 资产新增/编辑表单弹窗 |

## 2. 修改文件

| 路径 | 变更 |
|------|------|
| `src/components/assets/AssetTable.tsx` | 集成 AssetForm：新增「新增资产」按钮、表单弹窗状态管理、编辑按钮 onClick 接入 |

## 3. 新增依赖

| 包名 | 用途 |
|------|------|
| `@radix-ui/react-dialog` | Dialog 原语（Shadcn Dialog 底层） |
| `@radix-ui/react-label` | Label 原语（Shadcn Label 底层） |

---

## 4. AssetForm 功能明细

### 表单字段
| 字段 | 类型 | 验证规则 |
|------|------|----------|
| 资产代码/名称 | 文本 | 非空 |
| 分类 | 下拉选择（原生 select） | 4 类：股票/ETF/加密货币/现金 |
| 成本价 | 数字 | > 0 |
| 现价 | 数字 | > 0 |
| 数量 | 数字 | > 0 |

### 模式
- **新增模式**：点击顶部「新增资产」按钮 → 空表单 → 提交 POST /api/assets
- **编辑模式**：点击行内编辑按钮 → 预填充当前资产数据 → 提交 PUT /api/assets/{id}

### 交互
- Dialog 弹窗，带遮罩 + 关闭按钮
- 验证不通过时，字段下方显示红色错误提示
- 提交成功后自动关闭弹窗，列表刷新

---

## 5. 红线遵守情况

| 约束 | 是否遵守 |
|------|----------|
| 使用 Shadcn Dialog / Input / Label | ✅ 手动安装到 ui/ |
| 表单验证（必填 + 数值 > 0） | ✅ |
| 新增调用 POST、编辑调用 PUT | ✅ 通过 useAssets hook |
| currency 默认 CNY | ✅ |
| 不提前实现删除确认（Step 10） | ✅ 删除按钮仍无 onClick |
| 使用原生 select 而非 Radix Select | ✅ 保持极简 |

---

## 6. 验收结果

- `npx tsc -b` — 0 错误
- Go server + Vite dev 同时启动成功
- API POST 测试：新增资产成功（count 10 → 11）
- 浏览器预期效果：
  - 点击「新增资产」→ 弹出空表单 → 填写提交 → 列表新增一行
  - 点击行内编辑按钮 → 弹出预填充表单 → 修改提交 → 列表刷新
  - 验证不通过时红色错误提示可见
  - 关闭弹窗 / 取消按钮正常
  - 删除按钮仍为占位（Step 10）
