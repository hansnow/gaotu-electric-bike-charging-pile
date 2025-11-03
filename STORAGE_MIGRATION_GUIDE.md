# 存储方案迁移指南：从 KV 到 D1

## 目标与范围

- 将所有状态数据（最新状态、事件历史、写入配额统计）从 Cloudflare KV 迁移到 Cloudflare D1。
- 保持现有接口 `/events`、`/check-status` 的功能与 SLA，不影响客户端体验。
- 新增按时间范围聚合的统计能力，并提供 `/statistics` 查询端点。
- 在整个迁移期间保留平滑回滚能力，并确保数据一致。

## 为什么要迁移到 D1？

### 当前 KV 方案的限制
- ❌ 无法范围查询（如"查询某个时间段的事件"）
- ❌ 无法聚合统计（如"每天变化次数统计"）
- ❌ 查询灵活性低（只能按固定的 key 查询）
- ❌ 数据分析困难

### D1 方案的优势
- ✅ 强大的 SQL 查询能力
- ✅ 支持时间范围查询、聚合、统计
- ✅ 免费额度更高（100K 读，100K 写/天）
- ✅ 更适合时序数据分析
- ✅ 可生成报表和图表

## 迁移步骤

## 实施计划总览

| 阶段 | 核心任务 | 负责人 | 输出 | 预计耗时 |
| ---- | -------- | ------ | ---- | -------- |
| 0. 准备 | 申请 D1、确认权限、配置密钥 | 运维 | 新 D1 数据库、访问凭据 | 0.5d |
| 1. 建表与配置 | 建立 schema、配置 `wrangler.toml`、创建迁移脚本 | 开发 | `migrations/<timestamp>-init.sql`、更新后的配置 | 0.5d |
| 2. 代码改造 | 引入 D1 适配器、替换 KV 调用、限制批量写入 | 开发 | `d1-storage.ts`、更新的 `status-tracker.ts`、`worker.ts` | 1d |
| 3. 数据迁移 | 离线脚本回填历史数据、验证数据对齐 | 开发/运维 | `scripts/migrate-kv-to-d1.ts`、校验报告 | 0.5d |
| 4. 测试与验证 | 单测、集成测、预发验证、回归分析 | QA/开发 | 测试用例、测试报告 | 1d |
| 5. 发布与监控 | 分阶段流量切换、观察指标、准备回滚 | 运维/开发 | 发布记录、监控面板 | 0.5d |

## 操作详解

## AI Coding Agent 操作注意事项

- **工作目录**：所有命令均在仓库根目录 `/Users/han/code/hansnow/gaotu-electric-bike-charging-pile` 执行。
- **命令规范**：Shell 命令统一使用 `bash -lc "<command>"`；必要时说明理由后再申请提权。
- **文件操作**：优先使用 `apply_patch` 编辑现有文件，新增文件可通过 `cat <<'EOF' > path` 或 `apply_patch`。
- **命名约定**：D1 数据库名为 `gaotu-electric-bike-charging-pile-db`，与项目保持一致；所有引用保持完全一致。
- **变量替换**：文档中的 `YOUR_DATABASE_ID`、`<timestamp>` 等占位符由 agent 根据实际输出替换。
- **校验步骤**：每个阶段执行后需 `git status` 确认变更，必要时运行测试命令。

> 若某步执行失败，记录失败输出并在继续前进行处理或回滚。

### 1. 创建 D1 数据库

```bash
# 创建数据库
npx wrangler d1 create gaotu-electric-bike-charging-pile-db

# 输出会包含数据库 ID，需要添加到 wrangler.toml
```

> 命令执行结束后，请记录 `uuid` 形式的 `database_id`，稍后在配置文件中替换 `YOUR_DATABASE_ID`。

### 2. 使用 D1 迁移机制创建表结构

1. 创建首个迁移文件（命名示例）：

```bash
npx wrangler d1 migrations create gaotu-electric-bike-charging-pile-db init-schema
```

2. 在生成的 `migrations/<timestamp>_init-schema.sql` 中填入以下 schema（详见下一节）。

3. 将迁移应用到本地与生产：

```bash
# 本地（SQLite）
npx wrangler d1 migrations apply gaotu-electric-bike-charging-pile-db --local

# 生产
npx wrangler d1 migrations apply gaotu-electric-bike-charging-pile-db --remote
```

> ⚠️ 使用 migrations 可以记录 schema 版本，后续迭代也通过新增迁移文件管理。

### 3. 更新 wrangler.toml

```toml
[[d1_databases]]
binding = "DB"  # 在代码中使用 env.DB 访问
database_name = "gaotu-electric-bike-charging-pile-db"
database_id = "YOUR_DATABASE_ID"  # 替换为创建时的 ID
```

> 推荐先保留原有 KV 配置，等线上验证稳定后再移除，方便快速切回。

### 4. 创建表结构（迁移文件内容）

```sql
-- 充电桩最新状态表
CREATE TABLE latest_status (
  station_id INTEGER PRIMARY KEY,
  station_name TEXT NOT NULL,
  sim_id TEXT NOT NULL,
  sockets TEXT NOT NULL,  -- JSON 格式
  online INTEGER NOT NULL,
  address TEXT,
  timestamp INTEGER NOT NULL
);

-- 状态变化事件表
CREATE TABLE status_events (
  id TEXT PRIMARY KEY,
  station_id INTEGER NOT NULL,
  station_name TEXT NOT NULL,
  socket_id INTEGER NOT NULL,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  event_date TEXT NOT NULL, -- YYYY-MM-DD 字符串，写入时直接赋值
  time_string TEXT NOT NULL
);

-- 创建索引以加速查询
CREATE INDEX idx_events_timestamp ON status_events(timestamp);
CREATE INDEX idx_events_station ON status_events(station_id);
CREATE INDEX idx_events_event_date ON status_events(event_date);

-- KV 配额统计表（替换现有 KV 计数器）
CREATE TABLE quota_stats (
  date TEXT PRIMARY KEY,
  write_count INTEGER NOT NULL DEFAULT 0,
  read_count INTEGER NOT NULL DEFAULT 0,
  last_updated INTEGER NOT NULL
);
```

> 索引采用物理字段 `event_date` 避免 D1 当前不支持表达式索引的问题。写入时需显式带入。

### 5. 修改代码

#### 5.1 引入 D1 存储适配器（`d1-storage.ts`）

- 在仓库根目录新增文件 `d1-storage.ts` 承载 D1 逻辑。
- 直接复用 `status-tracker.ts` 中已有的 `StationStatus`、`StatusChangeEvent`、`SocketStatus` 类型，避免重复声明。
- 在批量写入事件时做分批（D1 `batch` 最多 50 条），建议 `chunkSize = 40` 保留余量。
- 为 `quota_stats` 提供 `getQuotaStatsD1()` / `incrementQuotaStatsD1()`，用以替换 KV 计数器。

```typescript
// d1-storage.ts
import type { StationStatus, StatusChangeEvent, SocketStatus } from './status-tracker';

const EVENT_BATCH_SIZE = 40;

/**
 * 存储最新状态到 D1
 */
export async function storeLatestStatusD1(
  db: D1Database, 
  status: StationStatus
): Promise<void> {
  await db.prepare(`
    INSERT OR REPLACE INTO latest_status 
    (station_id, station_name, sim_id, sockets, online, address, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    status.id,
    status.name,
    status.simId,
    JSON.stringify(status.sockets),
    status.online ? 1 : 0,
    status.address,
    status.timestamp
  ).run();
}

/**
 * 获取最新状态从 D1
 */
export async function getLatestStatusD1(
  db: D1Database,
  stationId: number
): Promise<StationStatus | null> {
  const result = await db.prepare(`
    SELECT * FROM latest_status WHERE station_id = ?
  `).bind(stationId).first();

  if (!result) return null;

  return {
    id: result.station_id as number,
    name: result.station_name as string,
    simId: result.sim_id as string,
    sockets: JSON.parse(result.sockets as string),
    online: (result.online as number) === 1,
    address: result.address as string,
    timestamp: result.timestamp as number
  };
}

/**
 * 批量存储事件到 D1
 */
export async function storeEventsD1(
  db: D1Database,
  events: StatusChangeEvent[]
): Promise<void> {
  if (events.length === 0) return;

  // D1 对 batch 长度有限制，这里分批执行
  for (let i = 0; i < events.length; i += EVENT_BATCH_SIZE) {
    const chunk = events.slice(i, i + EVENT_BATCH_SIZE);
    await db.batch(
      chunk.map(event =>
        db.prepare(`
          INSERT INTO status_events 
          (id, station_id, station_name, socket_id, old_status, new_status, timestamp, event_date, time_string)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          event.id,
          event.stationId,
          event.stationName,
          event.socketId,
          event.oldStatus,
          event.newStatus,
          event.timestamp,
          event.timeString.substring(0, 10),
          event.timeString
        )
      )
    );
  }
}

/**
 * 查询指定日期的事件
 */
export async function getEventsD1(
  db: D1Database,
  date: string
): Promise<StatusChangeEvent[]> {
  // date 格式: YYYY-MM-DD
  const startTimestamp = new Date(`${date}T00:00:00Z`).getTime();
  const endTimestamp = startTimestamp + 24 * 60 * 60 * 1000;

  const result = await db.prepare(`
    SELECT * FROM status_events
    WHERE timestamp >= ? AND timestamp < ?
    ORDER BY timestamp DESC
    LIMIT 1000
  `).bind(startTimestamp, endTimestamp).all();

  return result.results.map(row => ({
    id: row.id as string,
    stationId: row.station_id as number,
    stationName: row.station_name as string,
    socketId: row.socket_id as number,
    oldStatus: row.old_status as SocketStatus,
    newStatus: row.new_status as SocketStatus,
    timestamp: row.timestamp as number,
    timeString: row.time_string as string
  }));
}

/**
 * 查询时间范围内的事件（新功能）
 */
export async function getEventsInRangeD1(
  db: D1Database,
  startDate: string,
  endDate: string
): Promise<StatusChangeEvent[]> {
  const startTimestamp = new Date(`${startDate}T00:00:00Z`).getTime();
  const endTimestamp = new Date(`${endDate}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000;

  const result = await db.prepare(`
    SELECT * FROM status_events
    WHERE timestamp >= ? AND timestamp < ?
    ORDER BY timestamp DESC
  `).bind(startTimestamp, endTimestamp).all();

  return result.results.map(row => ({
    id: row.id as string,
    stationId: row.station_id as number,
    stationName: row.station_name as string,
    socketId: row.socket_id as number,
    oldStatus: row.old_status as SocketStatus,
    newStatus: row.new_status as SocketStatus,
    timestamp: row.timestamp as number,
    timeString: row.time_string as string
  }));
}

/**
 * 统计功能（D1 独有）
 */
export async function getStatisticsD1(
  db: D1Database,
  startDate: string,
  endDate: string
) {
  const startTimestamp = new Date(`${startDate}T00:00:00Z`).getTime();
  const endTimestamp = new Date(`${endDate}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000;

  // 每天的变化统计
  const dailyStats = await db.prepare(`
    SELECT 
      DATE(timestamp/1000, 'unixepoch') as date,
      station_id,
      station_name,
      COUNT(*) as changes,
      SUM(CASE WHEN new_status = 'occupied' THEN 1 ELSE 0 END) as occupied_count,
      SUM(CASE WHEN new_status = 'available' THEN 1 ELSE 0 END) as available_count
    FROM status_events
    WHERE timestamp >= ? AND timestamp < ?
    GROUP BY date, station_id, station_name
    ORDER BY date DESC
  `).bind(startTimestamp, endTimestamp).all();

  // 每小时的变化统计
  const hourlyStats = await db.prepare(`
    SELECT 
      strftime('%H', timestamp/1000, 'unixepoch') as hour,
      COUNT(*) as changes
    FROM status_events
    WHERE timestamp >= ? AND timestamp < ?
    GROUP BY hour
    ORDER BY hour
  `).bind(startTimestamp, endTimestamp).all();

  return {
    daily: dailyStats.results,
    hourly: hourlyStats.results
  };
}

/**
 * 替换 KV 计数器的配额统计
 */
export async function incrementQuotaStatsD1(
  db: D1Database,
  date: string,
  delta: { reads?: number; writes?: number }
): Promise<void> {
  await db.prepare(`
    INSERT INTO quota_stats (date, write_count, read_count, last_updated)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      write_count = write_count + ?,
      read_count = read_count + ?,
      last_updated = excluded.last_updated
  `).bind(
    date,
    delta.writes ?? 0,
    delta.reads ?? 0,
    Date.now(),
    delta.writes ?? 0,
    delta.reads ?? 0
  ).run();
}

export async function getQuotaStatsD1(
  db: D1Database,
  date: string
): Promise<{ writes: number; reads: number } | null> {
  const row = await db.prepare(`
    SELECT write_count, read_count FROM quota_stats WHERE date = ?
  `).bind(date).first();

  if (!row) return null;
  return {
    writes: row.write_count as number,
    reads: row.read_count as number
  };
}

/**
 * 清理过期数据（自动维护）
 */
export async function cleanupOldDataD1(
  db: D1Database,
  daysToKeep: number = 7
): Promise<void> {
  const cutoffTimestamp = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

  await db.prepare(`
    DELETE FROM status_events WHERE timestamp < ?
  `).bind(cutoffTimestamp).run();
}
```

#### 5.2 更新 `status-tracker.ts`

1. 保留业务逻辑不变，仅调整存储层调用：
   - 将 `getLatestStatus` / `storeLatestStatus` / `storeEvents` / `getEvents` / `getWriteCount` / `incrementWriteCount` 重定向到 D1 适配器。
   - 在定时任务内部统计读写次数后调用 `incrementQuotaStatsD1`，避免单独的 KV 计数器。
2. 迁移期间保留 KV 版本的函数在同文件中（例如 `getLatestStatusKV`），用于必要时的回滚或双写。
3. 处理事件写入时，传入 `timeString.substring(0, 10)` 作为 `event_date`。
4. 新增工具函数 `dayDiff(start: string, end: string)`，用于计算日期范围天数（基于 UTC），供 `/statistics` 参数校验复用。

#### 5.3 更新 `worker.ts`

```typescript
import { 
  storeLatestStatusD1, 
  getLatestStatusD1, 
  storeEventsD1,
  getEventsD1,
  getEventsInRangeD1,
  getStatisticsD1,
  incrementQuotaStatsD1,
  getQuotaStatsD1
} from './d1-storage';

```typescript
async function performStatusCheck(env: any): Promise<any> {
  // ... 检查逻辑 ...

  // 替换 KV 调用为 D1 调用
  const previousStatus = await getLatestStatusD1(env.DB, station.id);
  
  if (stationHasChange) {
    await storeLatestStatusD1(env.DB, currentStatus);
  }

  if (allEvents.length > 0) {
    await storeEventsD1(env.DB, allEvents);
  }

  await incrementQuotaStatsD1(env.DB, getDateString(new Date(timestamp)), {
    reads: kvReadCount,
    writes: kvWriteCount
  });
}
```

> 迁移发布阶段可通过环境变量控制开关（例如 `USE_D1=true`），实现灰度切换。

```typescript
function dayDiff(start: string, end: string): number {
  const startMs = new Date(`${start}T00:00:00Z`).getTime();
  const endMs = new Date(`${end}T00:00:00Z`).getTime();
  return Math.floor((endMs - startMs) / (24 * 60 * 60 * 1000)) + 1;
}
```

### 6. 新增统计 API

```typescript
// 在 worker.ts 中添加新的统计接口
if (url.pathname === '/statistics' && request.method === 'GET') {
  const startDate =
    url.searchParams.get('start') || getDateString();
  const endDate =
    url.searchParams.get('end') || getDateString();
  const maxRangeDays = 31;

  if (dayDiff(startDate, endDate) > maxRangeDays) {
    return new Response(JSON.stringify({
      success: false,
      error: `date range must be <= ${maxRangeDays} days`
    }), { status: 400 });
  }

  try {
    const stats = await getStatisticsD1(env.DB, startDate, endDate);
    return new Response(JSON.stringify({
      success: true,
      startDate,
      endDate,
      statistics: stats
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('获取统计失败:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
```

> 如果未来需要分页，可以在 SQL 中追加 `LIMIT/OFFSET`，并在查询参数中增加相应字段。

## 迁移策略

### 方案 A：双写灰度迁移（推荐）
1. **阶段 1（开发/预发）**：代码中新增 `USE_D1` 开关，默认开启双写（KV + D1）。接口读优先走 KV。
2. **阶段 2（预发验证）**：在预发环境开启仅 D1 读取，验证接口、统计、配额逻辑。
3. **阶段 3（生产灰度）**：上线后按站点逐步开启 `USE_D1`，观察 24 小时指标。
4. **阶段 4（完全切换）**：确认稳定后关闭 KV 写入，只保留 D1。
5. **阶段 5（收尾）**：清理 KV 数据与代码路径，更新文档。

### 方案 B：直接切换
1. 停止 cron 任务，确保无并发写入。
2. 回填历史数据（详见下一节）。
3. 切换代码为 D1，重新启用 cron。
4. 7 天后 KV 数据自然过期，人工清理残留键。

### 历史数据迁移脚本
如果需要保留 KV 中的历史数据与最新状态，可在 Worker 中加入临时脚本或本地脚本执行：

```typescript
// migration-script.ts
async function migrateKVToD1(env: any) {
  // 1. 列出所有 KV keys
  const list = await env.CHARGING_EVENTS.list({ prefix: 'events:' });
  
  for (const key of list.keys) {
    // 2. 读取 KV 数据
    const eventsStr = await env.CHARGING_EVENTS.get(key.name);
    const events = JSON.parse(eventsStr);
    
    // 3. 写入 D1（确保 chunk 逻辑与正式代码一致）
    await storeEventsD1(env.DB, events);
  }

  // 4. 回填最新状态
  const latestKeys = await env.CHARGING_EVENTS.list({ prefix: 'latest:' });
  for (const key of latestKeys.keys) {
    const statusStr = await env.CHARGING_EVENTS.get(key.name);
    if (!statusStr) continue;
    const status = JSON.parse(statusStr) as StationStatus;
    await storeLatestStatusD1(env.DB, status);
  }
}
```

> 建议迁移脚本仅在一次性操作后下线，避免生产环境误触。

### 数据校验

| 校验项 | 方法 |
| ------ | ---- |
| 事件数量 | 比较 `SELECT COUNT(*) FROM status_events WHERE event_date = ?` 与 KV 同日事件数量 |
| 最新状态 | 对比 D1 `latest_status` 中每个 `station_id` 的 `timestamp` 与 KV |
| 配额统计 | 校验 `quota_stats` 与旧 KV 计数（迁移阶段可保留日志比对） |

## 性能对比

| 指标 | KV | D1 |
|------|----|----|
| 简单读取延迟 | ~5ms | ~10ms |
| 范围查询 | ❌ 不支持 | ✅ 支持 |
| 聚合统计 | ❌ 不支持 | ✅ 支持 |
| 免费读取 | 100K/天 | 100K/天 |
| 免费写入 | 1K/天 | 100K/天 |
| 数据一致性 | 最终一致 | 强一致 |

## 测试计划

- **单元测试**：为 `d1-storage.ts` 编写针对 `storeLatestStatusD1`、`storeEventsD1`、`getEventsD1`、`getStatisticsD1`、`incrementQuotaStatsD1` 的测试，使用 `wrangler d1 execute --local` 或 `@cloudflare/d1` mock。
- **集成测试**：运行 `worker` 端到端测试，验证 `/events`、`/statistics`、`/check-status` 在 D1 模式下的响应。
- **性能测试**：模拟高频 cron（例如 10 分钟一次），确认批量写入不会触发 D1 限制，且统计查询在 31 天范围内延迟可接受。
- **数据对比**：灰度阶段开启双写时，记录 KV/D1 差异日志；若 24 小时内无差异即认为迁移成功。

## 部署与回滚

1. 创建 Feature Flag `USE_D1`（可在 `wrangler.toml` 或 Secrets 中配置）。
2. 发布流程：
   - 部署包含 D1 适配器的版本，默认双写。
   - 在生产环境开启 D1 读路径并监控 4 小时。
   - 根据指标逐步关闭 KV 写入。
3. 回滚策略：
   - 关闭 `USE_D1` 即可退回 KV 读写。
   - 若 D1 数据不一致，可使用迁移脚本重新同步。
   - 仍保留 KV 数据 7 天作为缓冲。

## 监控与运维

- **指标**：关注 `status_events` 表的写入速率、查询成功率、慢查询日志（Cloudflare Analytics）。
- **配额**：D1 免费额度 100K 读 / 100K 写 / 日，如需扩容提前评估成本。
- **备份**：定期使用 `wrangler d1 export` 拉取快照并保存到对象存储。
- **告警**：当 `quota_stats` 中写入接近阈值（例如 80% 时）发送告警。

## 总结

**推荐使用 D1 的情况**：
- ✅ 需要复杂查询和统计
- ✅ 需要时间范围查询
- ✅ 需要生成报表
- ✅ 数据保留时间长

**继续使用 KV 的情况**：
- ✅ 只需简单的键值查询
- ✅ 对延迟要求极高（<5ms）
- ✅ 查询模式固定且简单
