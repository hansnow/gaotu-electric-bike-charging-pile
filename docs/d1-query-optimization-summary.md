# D1 查询优化总结

## 问题背景
从 Cloudflare 后台观察到，过去 12 小时内 `getLatestSocketEventsD1` 查询执行了 216 次，扫描了 17.85k 行（平均 ~83 行/次），存在优化空间。

## 优化方案
将查询从"聚合+JOIN"模式改写为窗口函数模式，并配合覆盖索引，大幅降低查询开销。

### 原查询（聚合+JOIN）
```sql
SELECT event.socket_id, event.new_status, event.timestamp
FROM status_events event
INNER JOIN (
  SELECT socket_id, MAX(timestamp) as max_timestamp
  FROM status_events
  WHERE station_id = ?
  GROUP BY socket_id
) latest
  ON event.socket_id = latest.socket_id 
  AND event.timestamp = latest.max_timestamp
WHERE event.station_id = ?
```

**问题**：
- 需要两次扫描 `status_events` 表
- 需要创建临时 B-Tree 进行 GROUP BY
- 需要 BLOOM FILTER 进行 JOIN

### 新查询（窗口函数）
```sql
SELECT socket_id, new_status, timestamp
FROM (
  SELECT 
    socket_id,
    new_status,
    timestamp,
    ROW_NUMBER() OVER (PARTITION BY socket_id ORDER BY timestamp DESC) as rn
  FROM status_events
  WHERE station_id = ?
) ranked
WHERE rn = 1
```

**优势**：
- 只扫描一次 `status_events` 表
- 无需临时 B-Tree
- 无需 JOIN 操作
- 配合覆盖索引完全从索引读取

## 实施内容

### 1. 代码变更
- **文件**: `d1-storage.ts`
- **修改**: `getLatestSocketEventsD1()` 函数改用窗口函数

### 2. 数据库迁移
- **迁移 0006**: `migrations/0006_add-covering-index-for-window-query.sql`
  - 创建覆盖索引: `idx_events_station_socket_timestamp_status (station_id, socket_id, timestamp DESC, new_status)`
  - 此索引包含查询所需的所有字段，无需回表

### 3. 验证工具
- `scripts/compare-query-plans.sql` - 旧版执行计划
- `scripts/new-query-plan.sql` - 新版执行计划

### 4. 文档
- `docs/query-optimization-analysis.md` - 详细优化分析
- `docs/d1-query-optimization-deployment.md` - 部署指南

## 执行计划对比

### 优化前（有索引但仍用 JOIN）
```
- SEARCH status_events USING COVERING INDEX (2次)
- USE TEMP B-TREE FOR GROUP BY
- BLOOM FILTER ON latest
- SEARCH latest USING AUTOMATIC COVERING INDEX
```

### 优化后（窗口函数+覆盖索引）
```
- SEARCH status_events USING COVERING INDEX (1次)
- 无临时 B-TREE
- 无 BLOOM FILTER
- 无 JOIN
```

## 性能提升预期

| 指标 | 优化前 | 优化后 | 改进 |
|------|--------|--------|------|
| 表扫描次数 | 2次 | 1次 | ✅ -50% |
| 临时存储 | TEMP B-TREE | 无 | ✅ 消除 |
| JOIN 开销 | BLOOM FILTER | 无 | ✅ 消除 |
| Rows read/次 | ~83 | ~10-20 | ✅ -70~80% |
| Query duration | 基准 | -30~50% | ✅ 显著减少 |
| D1 读取配额 | 基准 | -50%+ | ✅ 大幅节省 |

## 测试结果
✅ 所有单元测试通过（41 个测试）
✅ 本地执行计划验证通过
✅ 查询使用 COVERING INDEX，无回表

## 部署步骤

### 1. 应用数据库迁移
```bash
# 检查待应用的迁移
npx wrangler d1 migrations list gaotu-electric-bike-charging-pile-db --remote

# 应用迁移
npx wrangler d1 migrations apply gaotu-electric-bike-charging-pile-db --remote
```

### 2. 部署代码
```bash
pnpm run deploy
```

### 3. 监控验证
- 观察 Cloudflare D1 后台的查询指标（12-24 小时）
- 重点关注 rows read 和 query duration

## 回滚方案
如有问题可快速回滚：
```bash
git revert HEAD
pnpm run deploy
```

索引可保留（不影响数据正确性，仅影响性能）。

## 技术亮点
1. **窗口函数优化**: 利用 SQLite 原生窗口函数特性，简化查询逻辑
2. **覆盖索引**: 精心设计索引列顺序，消除回表开销
3. **向后兼容**: 保持 API 接口不变，零业务影响
4. **可验证性**: 提供执行计划对比工具，优化效果可量化

## 相关文件
- 代码: `d1-storage.ts`
- 迁移: `migrations/0006_add-covering-index-for-window-query.sql`
- 分析: `docs/query-optimization-analysis.md`
- 部署: `docs/d1-query-optimization-deployment.md`
- 变更: `CHANGELOG.md` (v1.6.1)

## 版本信息
- **版本**: v1.6.1
- **日期**: 2026-01-15
- **影响范围**: D1 查询性能优化
- **业务影响**: 无（向后兼容）
