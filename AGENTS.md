# PROJECT KNOWLEDGE BASE

**Generated:** 2026-01-14 17:15:07 CST
**Commit:** 0012adc
**Branch:** master

## OVERVIEW
基于 Cloudflare Workers 的电动车充电桩监控服务，KV 缓存最新状态、D1 记录历史事件；定时任务每分钟执行并支持空闲提醒。

## STRUCTURE
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

## WHERE TO LOOK
| 任务 | 位置 | 备注 |
|------|------|------|
| HTTP 路由与定时入口 | `worker.ts` | `fetch` + `scheduled` 处理器 |
| 状态变化检测 | `status-tracker.ts` | KV 最新状态 + 事件列表 |
| D1 写入/查询 | `d1-storage.ts` | 报表与统计查询 |
| 空闲提醒编排 | `idle-alert/service.ts` | 去重 + 发送流程 |
| 默认配置 | `wrangler.toml` | 环境变量 + cron 配置 |
| KV/D1 schema | `migrations/*.sql` | 迁移序号必须递增 |
| 前端静态页 | `public/index.html` | 由 `env.ASSETS` 提供 |
| 回测脚本 | `scripts/backtest-idle-alert.ts` | 历史数据回测 |
| 单元测试 | `*.test.ts` | 与源码同级 |

## CONVENTIONS
- 扁平根目录结构，无 `src/`。
- 测试文件与源码同级，命名 `*.test.ts`。
- TypeScript `strict` 开启；避免 `any`，对象结构优先 `interface`。
- 所有函数必须写 JSDoc（用途/参数/返回值）。
- 状态变化必须同时写入 KV 与 D1。
- KV 配额计数使用 `quota:writes:{date}`。
- 迁移文件命名 `NNNN_*.sql`，序号递增。
- `worker-configuration.d.ts` 由 `pnpm types` 生成。

## ANTI-PATTERNS
- 仅写 KV 或仅写 D1 的状态更新。
- 非必要运行 `pnpm dev:prod`（会访问生产 KV）。
- 手动编辑 `worker-configuration.d.ts`。
- 引入 `any` 或抑制类型错误。

## UNIQUE STYLES
- 定时任务每分钟执行（`wrangler.toml` cron）。
- 空闲提醒包含时间窗口/节假日判断与窗口汇总。
- 节假日来源 iCalendar（节气不算假期）。

## COMMANDS
```bash
pnpm dev                # 本地开发（模拟 KV）
pnpm dev:prod           # 连接生产 KV（谨慎）
pnpm test               # 运行所有测试
pnpm test:watch         # 监听模式
pnpm test:coverage      # 覆盖率报告
npx tsx test-local.ts   # 本地测试脚本
pnpm backtest           # 空闲提醒回测
pnpm run deploy         # 部署到 Cloudflare Workers
npx wrangler tail       # 实时日志
npx wrangler d1 migrations apply gaotu-electric-bike-charging-pile-db --local
npx wrangler d1 migrations apply gaotu-electric-bike-charging-pile-db --remote
```

## NOTES
- 无内置 CI 配置，主要依赖本地脚本与 wrangler。
- 覆盖率重点在 `status-tracker.ts`（见 `vitest.config.ts`）。
