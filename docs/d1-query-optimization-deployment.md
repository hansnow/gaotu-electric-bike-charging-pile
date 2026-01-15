# D1 查询优化部署指南

## 概述
本次优化针对 `getLatestSocketEventsD1` 查询，将其从"聚合+JOIN"模式改写为窗口函数，并配合覆盖索引，大幅降低 rows read 和查询耗时。

## 改动内容

### 1. 代码变更
- **文件**: `d1-storage.ts`
- **函数**: `getLatestSocketEventsD1()`
- **变更**: 使用 `ROW_NUMBER() OVER (PARTITION BY socket_id ORDER BY timestamp DESC)` 窗口函数替代聚合+JOIN

### 2. 数据库迁移
- **迁移 0005**: `migrations/0005_optimize-status-events-indexes.sql`
  - 创建复合索引 `idx_events_station_socket_timestamp`
  - 创建复合索引 `idx_events_station_socket_status_timestamp`
  - 删除已被覆盖的单列索引 `idx_events_station`

- **迁移 0006**: `migrations/0006_add-covering-index-for-window-query.sql`
  - 创建覆盖索引 `idx_events_station_socket_timestamp_status`
  - 专门为窗口函数查询优化，避免回表

## 部署步骤

### 第一步：确认本地测试通过
```bash
# 运行所有测试
pnpm test

# 应该看到所有测试通过
# ✓ test-local.test.ts (3 tests)
# ✓ idle-alert/holiday-checker.test.ts (7 tests)
# ✓ status-tracker.test.ts (31 tests)
```

### 第二步：应用数据库迁移到生产环境
```bash
# 检查待应用的迁移
npx wrangler d1 migrations list gaotu-electric-bike-charging-pile-db --remote

# 应用迁移（如果显示 0005 和 0006 待应用）
npx wrangler d1 migrations apply gaotu-electric-bike-charging-pile-db --remote
```

**重要提示**：
- 迁移过程中数据库可能短暂不可用（通常 < 1秒）
- 建议在低峰时段执行
- 索引创建是 `IF NOT EXISTS`，多次执行安全

### 第三步：验证索引已创建
```bash
npx wrangler d1 execute gaotu-electric-bike-charging-pile-db --remote \
  --command="SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='status_events' ORDER BY name;"
```

**预期输出应包含**：
- `idx_events_station_socket_timestamp`
- `idx_events_station_socket_status_timestamp`
- `idx_events_station_socket_timestamp_status`

### 第四步：部署代码
```bash
# 部署到 Cloudflare Workers
pnpm run deploy
```

### 第五步：监控验证

#### 立即验证
部署后访问应用的 `/detail` 接口，确认功能正常：
```bash
curl -X POST https://your-worker.workers.dev/detail \
  -H "Content-Type: application/json" \
  -d '{"simId": "867997075125699"}'
```

应该返回包含 `statusSince` 的正常响应。

#### 观察 Cloudflare 后台指标（12-24小时窗口）
1. 登录 Cloudflare Dashboard
2. 进入 D1 数据库 > Analytics
3. 查看 `getLatestSocketEventsD1` 相关的 SQL 查询
4. 对比指标：

| 指标 | 优化前 | 优化后（预期） |
|------|--------|---------------|
| Rows read / 12h | ~17,850 | ~2,000-4,000 |
| 平均 rows read / 次 | ~83 | ~10-20 |
| Query duration | 基准 | 减少 30-50% |

## 回滚方案

如果出现问题，可以快速回滚：

### 回滚代码
```bash
# 回退到上一个版本
git revert HEAD
pnpm run deploy
```

### 回滚数据库（不推荐，索引不影响数据）
索引只影响查询性能，不影响数据正确性，通常无需回滚。
如果确实需要删除索引：

```sql
DROP INDEX IF EXISTS idx_events_station_socket_timestamp_status;
DROP INDEX IF EXISTS idx_events_station_socket_timestamp;
DROP INDEX IF EXISTS idx_events_station_socket_status_timestamp;

-- 恢复旧索引
CREATE INDEX idx_events_station ON status_events(station_id);
```

## 性能预期

### 查询优化点
1. ✅ 表扫描次数：从 2次 降至 1次（减少 50%）
2. ✅ 临时存储：消除 TEMP B-TREE
3. ✅ JOIN 开销：消除 BLOOM FILTER 和临时 JOIN
4. ✅ 回表：使用 COVERING INDEX，无需回表

### 预期提升
- **Rows read**: 降低 70-80%（从 ~83行/次 降至 ~10-20行/次）
- **Query duration**: 减少 30-50%
- **D1 读取配额**: 节省 50% 以上

### 写入影响
- 新增 1 个覆盖索引，每次插入需要维护 3 个索引（原 2 个 + 新 1 个）
- 预计写入耗时增加 < 10%
- 由于写入频率远低于读取（每分钟 3 个站点 vs 每次用户访问），整体收益显著

## 技术细节

详细的执行计划对比和优化分析见：
- `docs/query-optimization-analysis.md`

测试脚本：
- `scripts/compare-query-plans.ts`
- `scripts/compare-query-plans.sql`
- `scripts/new-query-plan.sql`

## 联系与支持

如有问题，请查看：
- Cloudflare Workers 日志: `npx wrangler tail`
- D1 查询分析: Cloudflare Dashboard > D1 > Analytics
- 本地调试: `pnpm dev` 或 `pnpm dev:prod`
