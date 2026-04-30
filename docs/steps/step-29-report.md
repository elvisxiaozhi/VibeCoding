# Step 29: 真实数据改动前自动备份机制

## 交付内容

### 1. 项目外时间戳备份
- 新增统一备份目录：`/Users/theodore/Desktop/VibeCoding-backups`
- 每次备份创建不可覆盖的时间戳目录，例如：
  - `2026-04-30_233552_initial-setup`
  - `2026-04-30_233935_verify-backup-script`
- 备份目录包含：
  - `data.db`：当前本地运行态 SQLite 数据库副本
  - `real-data-files.tar.gz`：真实数据源与关键脚本压缩包
  - `manifest.txt`：备份时间、项目路径、标签、包含路径
  - `SHA256SUMS.txt`：备份文件校验和

### 2. 备份内容范围
- `server/data.db`
- `deploy/`
- `public/cleared-assets.json`
- `scripts/process-mywife-cny.py`
- `scripts/generate-tlt-report.mjs`
- `scripts/process-vbrokers-tlt.mjs`

### 3. 新增备份脚本
- `scripts/backup-real-data.sh`
  - 创建时间戳备份目录
  - 复制 `server/data.db`
  - 打包真实数据源和关键处理脚本
  - 写入 `manifest.txt`
  - 生成 `SHA256SUMS.txt`
- `scripts/with-backup.sh`
  - 统一入口：先备份，备份成功后再执行真实命令
  - 设置 `SKIP_REAL_DATA_BACKUP=1`，避免被调用脚本重复备份
  - 通过 `VIBECODING_ACTIVE_BACKUP_PATH` 把当前备份目录传给子命令
- `scripts/update-backup-checksums.sh`
  - 刷新单个备份目录的 `SHA256SUMS.txt`
  - 用于远端资产快照写入后重新计算校验

### 4. Seed 脚本接入改动前备份
- 以下脚本在执行删除 / 追加远端资产前会先创建本地备份：
  - `deploy/seed-cn.sh`
  - `deploy/seed-us.sh`
  - `deploy/seed-hk.sh`
  - `deploy/seed-crypto.sh`
  - `deploy/seed-wife-cn.sh`
  - `deploy/seed-real.sh`
  - `deploy/seed-misc.sh`
- 每个脚本支持 `SKIP_REAL_DATA_BACKUP=1`，供 `with-backup.sh` 统一入口避免重复备份

### 5. 远端资产改动前快照
- Seed 脚本登录远端成功后、执行删除 / 追加前，会把当前 `/api/assets` 响应写入本次备份目录
- 文件名按脚本区分：
  - `remote-assets-before-seed-cn.json`
  - `remote-assets-before-seed-us.json`
  - `remote-assets-before-seed-hk.json`
  - `remote-assets-before-seed-crypto.json`
  - `remote-assets-before-seed-wife-cn.json`
  - `remote-assets-before-seed-real.json`
  - `remote-assets-before-seed-misc.json`
- 写入远端快照后会重新刷新 `SHA256SUMS.txt`

## 使用方式

### 1. 直接运行原 seed 脚本
```bash
bash deploy/seed-us.sh
```

脚本会自动先创建本地备份，再登录远端并保存远端资产快照，最后才进入删除 / 导入逻辑。

### 2. 使用统一入口包裹任意命令
```bash
scripts/with-backup.sh before-manual-change bash deploy/seed-us.sh
```

统一入口适合后续临时数据修复、手动导入、清理类命令。

### 3. 自定义备份根目录
```bash
VIBECODING_BACKUP_DIR=/path/to/backups scripts/backup-real-data.sh before-change
```

未设置时默认使用 `/Users/theodore/Desktop/VibeCoding-backups`。

## 关键文件

| 文件 | 变更 |
|------|------|
| `scripts/backup-real-data.sh` | 新建：项目外时间戳备份、manifest、校验和 |
| `scripts/with-backup.sh` | 新建：先备份再执行命令的统一入口 |
| `scripts/update-backup-checksums.sh` | 新建：刷新备份目录校验文件 |
| `deploy/seed-cn.sh` | 接入备份钩子 + 远端资产快照 |
| `deploy/seed-us.sh` | 接入备份钩子 + 远端资产快照 |
| `deploy/seed-hk.sh` | 接入备份钩子 + 远端资产快照 |
| `deploy/seed-crypto.sh` | 接入备份钩子 + 远端资产快照 |
| `deploy/seed-wife-cn.sh` | 接入备份钩子 + 远端资产快照 |
| `deploy/seed-real.sh` | 接入备份钩子 + 远端资产快照；`--clear` 复用预取快照 |
| `deploy/seed-misc.sh` | 接入备份钩子 + 追加前远端资产快照 |

## 红线遵守

- 不删除任何真实数据
- 不把备份目录放进项目内
- 不改数据库 schema
- 不改前端展示逻辑
- 不引入新依赖
- 不改变 seed 脚本原有登录、删除、导入语义，只在数据改动前增加备份和快照

## 验收结果

- `bash -n scripts/backup-real-data.sh scripts/with-backup.sh scripts/update-backup-checksums.sh` 通过
- `bash -n deploy/seed-cn.sh deploy/seed-us.sh deploy/seed-hk.sh deploy/seed-crypto.sh deploy/seed-wife-cn.sh deploy/seed-real.sh deploy/seed-misc.sh` 通过
- 已创建并验证两份备份：
  - `/Users/theodore/Desktop/VibeCoding-backups/2026-04-30_233552_initial-setup`
  - `/Users/theodore/Desktop/VibeCoding-backups/2026-04-30_233935_verify-backup-script`
- 验证备份内包含：
  - `data.db`
  - `real-data-files.tar.gz`
  - `manifest.txt`
  - `SHA256SUMS.txt`
- 抽查压缩包内容确认包含：
  - `deploy/seed-cn.json`
  - `deploy/cn/transactions.json`
  - `deploy/my wife/*.xlsx`
  - `public/cleared-assets.json`
  - `scripts/process-mywife-cny.py`

## 已知限制

- 这是改动前快照机制，不是数据库事务回滚
- 远端资产快照依赖登录成功；登录失败时只会留下本地备份
- 当前只覆盖 seed 脚本和统一入口；如果未来新增其它会改真实数据的脚本，需要接入同样钩子
- 备份保留策略尚未自动化；后续可增加 prune 脚本实现按天 / 周 / 月清理
