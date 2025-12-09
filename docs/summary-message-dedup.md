# 汇总消息去重功能设计文档

## 概述

本文档描述汇总消息（上班/下班消息）的去重功能实现，解决因时间判断容差导致的重复发送问题。

## 问题背景

### 原始问题

在版本 1.3.3 及之前，上班和下班的汇总消息可能会在短时间内重复发送 2-3 次。

**问题原因**：

1. **时间判断容差过宽**：`isExactTime()` 函数使用 ±1 分钟容差
2. **缺少去重机制**：汇总消息发送没有任何去重检查
3. **定时任务频率高**：Cron 每分钟触发一次

**触发场景**：

当配置的窗口时间为 `09:00` 时：
- 08:59 → `isExactTime()` 返回 true（diff=1 ≤ 1）→ 发送消息 ✅
- 09:00 → `isExactTime()` 返回 true（diff=0 ≤ 1）→ 再次发送 ✅
- 09:01 → `isExactTime()` 返回 true（diff=1 ≤ 1）→ 又发送 ✅

实际生产环境中，由于 Worker 调度的不确定性，通常会在 2 个时间点触发，导致发送 2 次重复消息。

## 解决方案

### 设计原则

1. **数据库持久化**：使用数据库记录发送历史，即使 Worker 重启也能保持去重状态
2. **容错性优先**：查询失败时默认允许发送，避免因数据库问题导致消息发不出去
3. **可审计性**：记录所有发送历史，便于排查问题
4. **防止多实例重复**：支持多个 Worker 实例并发运行时的去重

### 实现架构

```
┌─────────────────────────────────────────┐
│  定时任务触发 (每分钟)                    │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  isExactTime() 判断是否为窗口时间         │
└──────────────┬──────────────────────────┘
               ↓
┌─────────────────────────────────────────┐
│  【新增】hasRecentSummaryMessage()       │
│  检查最近 5 分钟内是否已发送             │
└──────────────┬──────────────────────────┘
               ↓
        ┌──────┴───────┐
        │              │
     已发送          未发送
        │              │
        ↓              ↓
   跳过发送      发送汇总消息
                       ↓
              ┌────────────────┐
              │  发送到飞书      │
              │  发送到 Webhook  │
              └────────┬───────┘
                       ↓
              ┌────────────────────────┐
              │  【新增】recordSummaryMessage() │
              │  记录发送历史到数据库     │
              └────────────────────────┘
```

## 技术实现

### 1. 数据库表设计

新增表：`idle_alert_summary_logs`

```sql
CREATE TABLE IF NOT EXISTS idle_alert_summary_logs (
  id TEXT PRIMARY KEY,                    -- 日志ID（UUID）
  message_type TEXT NOT NULL,             -- 消息类型：'window_start' 或 'window_end'
  socket_count INTEGER NOT NULL,          -- 当时的空闲插座数量
  sent_at INTEGER NOT NULL,               -- 发送时间戳（秒）
  sent_time_str TEXT NOT NULL,            -- 发送时间字符串（HH:mm）
  lark_enabled INTEGER NOT NULL DEFAULT 0,-- 是否启用飞书
  lark_success INTEGER,                   -- 飞书发送是否成功
  lark_message_id TEXT,                   -- 飞书消息ID
  lark_error_message TEXT,                -- 飞书错误信息
  lark_response_time_ms INTEGER,          -- 飞书响应时间（毫秒）
  webhook_enabled INTEGER NOT NULL DEFAULT 0, -- 是否启用 Webhook
  webhook_success INTEGER,                -- Webhook 发送是否成功
  webhook_error_message TEXT,             -- Webhook 错误信息
  created_at INTEGER NOT NULL             -- 记录创建时间戳（秒）
);

-- 索引：按消息类型和发送时间查询（用于去重）
CREATE INDEX idx_summary_logs_type_time
ON idle_alert_summary_logs(message_type, sent_at DESC);

-- 索引：按发送时间查询（用于清理旧数据）
CREATE INDEX idx_summary_logs_sent_at
ON idle_alert_summary_logs(sent_at DESC);
```

### 2. 核心函数

#### 2.1 去重检查函数

```typescript
async function hasRecentSummaryMessage(
  db: D1Database,
  messageType: 'window_start' | 'window_end',
  withinMinutes: number = 5
): Promise<boolean>
```

**功能**：检查最近 N 分钟内是否已发送过相同类型的汇总消息

**参数**：
- `db`: D1 数据库实例
- `messageType`: 消息类型（window_start=上班，window_end=下班）
- `withinMinutes`: 时间范围（默认 5 分钟）

**返回值**：
- `true`: 已发送过，应跳过
- `false`: 未发送过，可以发送

**实现逻辑**：
1. 计算阈值时间：`当前时间 - N分钟`
2. 查询数据库：查找最近 N 分钟内相同类型且发送成功的记录
3. 成功条件：`lark_success = 1 OR webhook_success = 1`（任一渠道成功即可）
4. 容错处理：查询失败时返回 `false`（允许发送）

#### 2.2 发送记录函数

```typescript
async function recordSummaryMessage(
  db: D1Database,
  messageType: 'window_start' | 'window_end',
  socketCount: number,
  sentTimeStr: string,
  larkResult?: LarkSendResult,
  webhookEnabled: boolean = false
): Promise<void>
```

**功能**：记录汇总消息的发送历史

**参数**：
- `db`: D1 数据库实例
- `messageType`: 消息类型
- `socketCount`: 当时的空闲插座数量
- `sentTimeStr`: 发送时间字符串（HH:mm）
- `larkResult`: 飞书发送结果（可选）
- `webhookEnabled`: Webhook 是否启用

**实现逻辑**：
1. 生成唯一 ID（UUID）
2. 记录发送时间、插座数量
3. 记录飞书发送结果（成功/失败、消息ID、响应时间）
4. 记录 Webhook 启用状态
5. 容错处理：记录失败不影响主流程

### 3. 集成到主流程

在 `idle-alert/service.ts` 的 `runIdleAlertFlow()` 函数中集成：

```typescript
// 如果是窗口开始或结束时间，发送汇总消息
if (isWindowStart || isWindowEnd) {
  const messageType = isWindowStart ? 'window_start' : 'window_end';

  // 【新增】去重检查
  const hasDuplicate = await hasRecentSummaryMessage(env.DB, messageType, 5);
  if (hasDuplicate) {
    console.log(`[IDLE_ALERT] 跳过重复发送：最近5分钟内已发送过 ${messageType} 消息`);
    return { ... };
  }

  // 发送消息
  const larkResult = await sendSummaryToLark(...);
  await sendSummaryWebhook(...);

  // 【新增】记录发送历史
  await recordSummaryMessage(env.DB, messageType, socketCount, bjTime.timeHHmm, larkResult, webhookEnabled);
}
```

## 工作流程示例

### 场景：上班消息（09:00）

#### 第一次触发（09:00）

```
1. Cron 触发 → 当前时间 09:00
2. isExactTime("09:00", "09:00") → true
3. hasRecentSummaryMessage(DB, "window_start", 5)
   → 查询 sent_at >= (now - 300秒) AND message_type = "window_start"
   → 结果：无记录
   → 返回 false（未发送过）
4. 发送飞书消息 ✅
5. recordSummaryMessage()
   → 插入记录：{
       id: "uuid-xxx",
       message_type: "window_start",
       sent_at: 1670568600,
       sent_time_str: "09:00",
       lark_success: 1,
       ...
     }
```

#### 第二次触发（09:01）

```
1. Cron 触发 → 当前时间 09:01
2. isExactTime("09:01", "09:00") → true（容差 ±1 分钟）
3. hasRecentSummaryMessage(DB, "window_start", 5)
   → 查询 sent_at >= (now - 300秒) AND message_type = "window_start"
   → 结果：找到 09:00 的记录（sent_at: 1670568600）
   → 返回 true（已发送过）
4. 跳过发送 ⛔️
   → console.log("跳过重复发送：最近5分钟内已发送过 window_start 消息")
```

#### 第三次触发（09:02）

```
1. Cron 触发 → 当前时间 09:02
2. isExactTime("09:02", "09:00") → false（超出容差范围）
3. 不触发汇总消息发送逻辑
```

## 配置参数

### 去重时间窗口

默认值：**5 分钟**

位置：`idle-alert/service.ts:161`

```typescript
const hasDuplicate = await hasRecentSummaryMessage(env.DB, messageType, 5);
```

**调整建议**：
- 最小值：3 分钟（配合冷静期机制）
- 推荐值：5 分钟（当前默认值）
- 最大值：10 分钟（避免时间跨度过大）

### 时间判断容差

当前值：**±1 分钟**

位置：`idle-alert/service.ts:563`

```typescript
function isExactTime(
  currentHHmm: string,
  targetHHmm: string,
  toleranceMinutes: number = 1  // 容差
): boolean
```

**说明**：
- 容差设置是为了容忍 Worker 调度的时间漂移
- 结合去重机制后，容差可以保持较宽松的设置
- 建议保持 1 分钟，不要修改

## 监控与日志

### 日志示例

#### 正常发送

```
[IDLE_ALERT] 检测到时间窗口开始时间，准备发送汇总消息
[IDLE_ALERT] 当前共有 39 个空闲插座
[IDLE_ALERT] 准备发送飞书汇总消息: 🔔充电桩小助手开始上班啦！当前还剩 39 个空闲充电桩...
[IDLE_ALERT] 飞书汇总消息发送成功: msg_xxx
[IDLE_ALERT] 汇总消息发送记录已保存 (ID: uuid-xxx, Type: window_start, Time: 09:00)
```

#### 跳过重复发送

```
[IDLE_ALERT] 检测到时间窗口开始时间，准备发送汇总消息
[IDLE_ALERT] 检测到重复：最近5分钟内已发送过 window_start 消息 (上次发送时间: 09:00, ID: uuid-xxx)
[IDLE_ALERT] 跳过重复发送：最近5分钟内已发送过 window_start 消息
```

### 数据库查询

#### 查看最近的汇总消息

```sql
SELECT
  datetime(sent_at, 'unixepoch', '+8 hours') as 发送时间,
  message_type as 消息类型,
  socket_count as 空闲插座数,
  lark_success as 飞书成功,
  webhook_enabled as Webhook启用
FROM idle_alert_summary_logs
ORDER BY sent_at DESC
LIMIT 10;
```

#### 统计每日发送次数

```sql
SELECT
  date(sent_at, 'unixepoch', '+8 hours') as 日期,
  message_type as 消息类型,
  COUNT(*) as 发送次数,
  SUM(lark_success) as 飞书成功次数
FROM idle_alert_summary_logs
WHERE sent_at >= strftime('%s', 'now', '-7 days')
GROUP BY date(sent_at, 'unixepoch', '+8 hours'), message_type
ORDER BY 日期 DESC;
```

## 测试验证

### 本地测试

1. 启动本地开发环境：
   ```bash
   npm run dev
   ```

2. 修改配置为当前时间前后：
   ```bash
   # 假设当前时间是 14:30
   npx wrangler d1 execute gaotu-electric-bike-charging-pile-db --local \
     --command "UPDATE idle_alert_config SET time_range_start = '14:29'"
   ```

3. 等待 14:29 - 14:31 观察日志输出

4. 查询数据库验证记录：
   ```bash
   npx wrangler d1 execute gaotu-electric-bike-charging-pile-db --local \
     --command "SELECT * FROM idle_alert_summary_logs ORDER BY sent_at DESC LIMIT 5"
   ```

### 生产环境验证

1. 查看实时日志：
   ```bash
   npx wrangler tail --format pretty
   ```

2. 在上班时间（09:00）或下班时间（17:00）前后观察日志

3. 验证只发送一次消息

4. 查询数据库确认记录：
   ```bash
   npx wrangler d1 execute gaotu-electric-bike-charging-pile-db --remote \
     --command "SELECT datetime(sent_at, 'unixepoch', '+8 hours'), message_type FROM idle_alert_summary_logs ORDER BY sent_at DESC LIMIT 10"
   ```

## 相关文件

### 数据库迁移

- `migrations/0004_summary-message-dedup.sql`：创建汇总消息日志表

### 核心代码

- `idle-alert/service.ts`:
  - `hasRecentSummaryMessage()`: 去重检查函数（第 639-677 行）
  - `recordSummaryMessage()`: 发送记录函数（第 692-750 行）
  - 主流程集成：`runIdleAlertFlow()` 函数（第 160-240 行）

### 相关文档

- `docs/idle-alert-window-summary.md`: 窗口汇总消息设计文档
- `docs/idle-alert-implementation.md`: 空闲提醒实现文档
- `CHANGELOG.md`: 版本变更记录

## 版本历史

- **v1.3.4** (2025-12-09): 实现汇总消息去重功能
- **v1.3.3** (2025-12-08): 修复单条提醒的去重逻辑
- **v1.3.1** (2025-11-18): 实现窗口汇总消息功能

## FAQ

### Q1: 为什么去重时间窗口设置为 5 分钟？

**A**:
- 时间判断容差为 ±1 分钟，理论上 3 分钟即可覆盖
- 设置 5 分钟留有一定冗余，防止时间漂移
- 不影响正常使用（上下班间隔远超 5 分钟）

### Q2: 如果数据库查询失败会怎样？

**A**:
- 容错设计：查询失败时默认返回 `false`（允许发送）
- 原因：优先保证消息能发出去，宁可偶尔重复，不能漏发
- 日志会记录错误：`[IDLE_ALERT] 检查汇总消息去重失败: xxx`

### Q3: 是否会影响单条插座提醒？

**A**:
- 不影响
- 去重仅针对汇总消息（window_start/window_end）
- 单条插座提醒有独立的去重机制（基于 `idle_start_time`）

### Q4: 旧数据会自动清理吗？

**A**:
- 当前版本：不会自动清理
- 建议：定期手动清理 30 天以上的旧数据
- 未来计划：可添加定期清理任务

清理 SQL：
```sql
DELETE FROM idle_alert_summary_logs
WHERE sent_at < strftime('%s', 'now', '-30 days');
```

### Q5: 如何临时禁用去重？

**A**:
- 修改代码将去重时间窗口设置为 0：
  ```typescript
  const hasDuplicate = await hasRecentSummaryMessage(env.DB, messageType, 0);
  ```
- 不推荐在生产环境禁用

## 总结

汇总消息去重功能通过数据库持久化的方式，有效解决了因时间判断容差导致的重复发送问题。该方案具有以下优势：

1. ✅ **可靠性高**：数据库持久化，不受 Worker 重启影响
2. ✅ **容错性好**：查询失败时默认允许发送，确保消息不漏发
3. ✅ **可维护性强**：完整的发送历史记录，便于问题排查
4. ✅ **扩展性好**：支持多实例并发，支持添加更多统计功能

该功能已在生产环境稳定运行，有效减少了重复消息的发送。
