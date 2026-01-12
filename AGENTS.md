# 项目知识库

**生成时间:** 2026-01-12
**提交:** 868d388
**分支:** master

## 概述
基于 Cloudflare Workers 的电动车充电桩监控服务。使用 KV 缓存最新状态、D1 记录历史事件，按分钟定时检查并支持空闲提醒。

## 结构
```
./
├── worker.ts              # HTTP + 定时任务入口
├── status-tracker.ts      # 状态对比 + KV 写入
├── d1-storage.ts          # D1 持久化 + 查询
├── idle-alert/            # 空闲提醒子系统（见 idle-alert/AGENTS.md）
├── migrations/            # D1 SQL 迁移（0001...）
├── scripts/               # 回测与工具脚本
├── public/                # Worker 静态资源
└── docs/                  # 设计与集成文档
```

## 位置索引
| 任务 | 位置 | 备注 |
|------|------|------|
| 请求路由、定时入口 | `worker.ts` | `fetch` + `scheduled` 处理器 |
| 状态变化检测 | `status-tracker.ts` | KV 最新状态 + 事件列表 |
| D1 写入/查询 | `d1-storage.ts` | 报表与统计查询 |
| 空闲提醒 | `idle-alert/service.ts` | 编排与去重 |
| 默认配置 | `wrangler.toml` | 环境变量 + 定时配置 |
| KV/D1 schema | `migrations/*.sql` | 迁移序号必须递增 |

## 开发命令

### 本地开发
```bash
pnpm dev                # 本地开发模式（使用模拟 KV 存储）
pnpm dev:prod           # 生产环境连接模式（连接真实 KV，谨慎操作）
```

### 测试
```bash
pnpm test               # 运行所有测试
pnpm test:watch         # 监听模式运行测试
pnpm test:coverage      # 生成测试覆盖率报告
npx tsx test-local.ts   # 运行本地测试脚本
```

### 部署
```bash
npx wrangler login      # 首次部署需先登录
pnpm run deploy         # 部署到 Cloudflare Workers
```

### 数据库迁移
```bash
# 本地开发环境
npx wrangler d1 migrations apply gaotu-electric-bike-charging-pile-db --local

# 生产环境（谨慎操作）
npx wrangler d1 migrations apply gaotu-electric-bike-charging-pile-db --remote
```

### 日志查看
```bash
npx wrangler tail                    # 实时查看 Worker 日志
npx wrangler tail --format pretty    # 美化格式
npx wrangler tail --format json      # JSON 格式
```

### 回测工具
```bash
pnpm backtest           # 运行空闲提醒回测脚本（分析历史数据）
```

## 核心架构

### 三层数据流
1. **API 层** (`worker.ts`)：HTTP 请求路由和响应处理
2. **业务逻辑层**：
   - `status-tracker.ts`：状态检测核心逻辑（KV 操作）
   - `d1-storage.ts`：数据持久化（D1 操作）
   - `idle-alert/service.ts`：空闲提醒编排
3. **数据层**：Cloudflare D1（持久化）+ KV（临时缓存）

### 双存储策略
- **KV**：用于快速读写最新状态，支持定时任务高频访问（每分钟）
- **D1**：用于事件持久化和历史查询，存储所有状态变化事件

**重要**：所有状态变化必须同时写入 KV 和 D1，确保数据一致性。

### 定时任务机制
Cloudflare Workers 通过 `wrangler.toml` 中的 `crons` 配置触发定时任务：
```toml
[triggers]
crons = ["* * * * *"]  # 每分钟执行
```

任务在 `worker.ts` 的 `scheduled()` 方法中处理：
1. 检测所有充电桩状态变化（`status-tracker.ts`）
2. 存储变化事件到 D1（`d1-storage.ts`）
3. 运行空闲提醒逻辑（`idle-alert/service.ts`）

## 空闲提醒系统

### 模块化设计
- `config.ts`：配置管理（从 D1 读取，支持运行时更新）
- `holiday-checker.ts`：节假日判定（集成 Apple iCloud 日历）
- `idle-detector.ts`：空闲检测（基于空闲周期的去重）
- `alert-sender.ts`：Webhook 发送（支持重试）
- `lark-sender.ts`：飞书消息发送
- `service.ts`：服务编排层（协调上述模块）

### 核心概念：空闲周期 (Idle Cycle)
- 当插座从 `occupied` 变为 `available` 时，新的空闲周期开始
- 空闲周期 ID 格式：`{stationId}-{socketId}-{startTimestamp}`
- 每个空闲周期内只发送一次提醒，避免重复

### 窗口汇总功能（v1.3.0+）
- **窗口开始**（如 08:00）：发送"开始上班"汇总，跳过单条提醒
- **窗口结束**（如 17:00）：发送"下班"汇总，恢复单条提醒
- 汇总消息包含所有空闲插座列表

### 节假日处理
使用 `holiday-checker.ts` 解析 Apple iCloud 日历（.ics 格式）：
- 日历 URL 配置在 `idle-alert/config.ts` 中的 `CALENDAR_URL`
- 支持识别中国法定假日（通过 iCal VEVENT）
- **注意**：节气（如小寒、大寒）不算做假期

## Git Commit 规范
- 用中文编写 commit message
- 使用 Co-Authored-By 标记协作者

## 测试注意事项

### 单元测试
- 使用 Vitest 框架
- 测试文件命名：`*.test.ts`
- 需要 mock Cloudflare Workers 环境（KV、D1、ExecutionContext）

### 运行单个测试
```bash
pnpm test status-tracker.test.ts
pnpm test holiday-checker.test.ts
```

### 覆盖率
当前覆盖目标：`status-tracker.ts`（配置在 `vitest.config.ts`）

## 环境变量和密钥

### 配置类型
- **环境变量**（`wrangler.toml` 的 `[vars]`）：非敏感配置
- **Secrets**（使用 `wrangler secret` 命令）：API 密钥、Webhook URL 等

### 设置 Secret
```bash
wrangler secret put IDLE_ALERT_WEBHOOK_URLS  # Webhook URLs（逗号分隔）
wrangler secret put ADMIN_API_TOKEN           # 管理 API Token
```

## 数据库迁移
迁移文件位于 `migrations/` 目录：
- `0001_init-schema.sql`：初始化表结构
- `0002_idle-alert.sql`：空闲提醒相关表
- `0003_add-lark-support.sql`：飞书集成字段
- `0004_summary-message-dedup.sql`：汇总消息去重

**重要**：新增迁移文件必须按序号命名（0005、0006...）

## KV 配额管理
Cloudflare Workers KV 免费套餐限制：
- 每天 1000 次写入
- 每天 100,000 次读取

### 优化策略（v2.0）
- 仅在状态变化时写入 KV
- 实时追踪写入次数（`quota:writes:{date}` key）
- 达到 80% 和 95% 时发出警告
- 日志中显示配额使用百分比

### 估算
- 正常情况：约 675 次写入/天（假设每天 225 次状态变化）
- 每次状态变化 = 3 次写入（最新状态 + 事件列表 + 配额计数）

## 常见问题

### 本地开发连接生产 KV
使用 `pnpm dev:prod`，Worker 代码在 Cloudflare 预览环境运行，可以访问真实的生产 KV 数据。**谨慎操作**，可能修改线上数据。

### 定时任务不触发
检查 `wrangler.toml` 中的 `[triggers]` 配置，确保 cron 表达式正确。本地开发环境不会自动触发定时任务，需要手动调用 `POST /check-status`。

### D1 数据库查询
```bash
# 本地环境
npx wrangler d1 execute gaotu-electric-bike-charging-pile-db --local --command="SELECT * FROM latest_status"

# 生产环境
npx wrangler d1 execute gaotu-electric-bike-charging-pile-db --remote --command="SELECT * FROM latest_status"
```

### 测试飞书消息
确保配置了以下字段（通过 API `/api/alert/config`）：
- `lark_enabled`: 1
- `lark_auth_token`: 飞书 Bot Token
- `lark_chat_id`: 飞书群组 ID

## 约定
- 根目录扁平结构（无 `src/`），测试文件与源码同级（`*.test.ts`）。
- TypeScript `strict` 开启；避免 `any`，使用显式类型。
- 对象结构优先使用 `interface`。
- 所有函数必须有 JSDoc（用途、参数、返回值）。
- 状态变化必须同时写入 **KV** 和 **D1**（一致性要求）。
- KV 写入配额必须记录（`quota:writes:{date}` 规则）。
- `worker-configuration.d.ts` 由 `pnpm types`（`wrangler types`）生成。

## 禁止事项
- 仅写 KV 或仅写 D1 的状态更新。
- 非必要不要运行 `pnpm dev:prod`（会访问生产 KV）。
- 不要手动编辑 `worker-configuration.d.ts`。
- 不要引入 `any` 或抑制类型错误。

## 文档参考
- `API.md`：完整的 API 接口文档
- `LOGGING.md`：日志系统详细说明
- `STORAGE_MIGRATION_GUIDE.md`：KV 到 D1 迁移指南
- `docs/idle-alert-design.md`：空闲提醒功能设计
- `docs/lark-integration.md`：飞书消息集成指南

## 备注
- Cron 每分钟触发，配置在 `wrangler.toml` 的 `[triggers]`。
- 本地开发不会自动触发 cron，请用 `POST /check-status`。
- 覆盖率重点在 `status-tracker.ts`（见 `vitest.config.ts`）。
