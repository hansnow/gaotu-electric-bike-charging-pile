# 空闲提醒窗口汇总功能

## 📋 版本信息

- **实施日期**: 2025-11-17
- **版本**: v1.2.0
- **功能状态**: ✅ 已实现

---

## 🎯 功能背景

### 问题描述

在原有的空闲提醒功能中，存在一个体验问题：

**场景**：
- 时间窗口配置为 `08:00-17:00`
- 有 20 个插座在凌晨就已经空闲
- 早上 8:00 定时任务执行时，这些插座已经空闲了 4-6 小时
- **结果**：8:00 瞬间发送 20 条提醒，造成消息轰炸 💥

### 优化目标

1. **消除消息轰炸**：时间窗口开始时，不要一次性发送大量单条提醒
2. **增强用户体验**：通过友好的汇总消息告知整体情况
3. **保留详细信息**：Webhook 中仍然提供完整的插座列表供系统集成

---

## 🚀 实现方案

### 核心策略

**方案 3：汇总报告 + 单条提醒**

- **时间窗口开始时**（如 08:00）：发送汇总消息，跳过单条提醒
- **时间窗口结束时**（如 17:00）：发送汇总消息，跳过单条提醒
- **窗口内其他时间**：正常执行单条提醒逻辑（保持原有功能）

### 消息内容设计

#### 飞书消息

**开始消息**：
```
🔔充电桩小助手开始上班啦！当前还剩 15 个空闲充电桩，有需要的小伙伴快去充电哟~
```

**结束消息**：
```
🥳充电桩小助手下班啦，当前共有 12 个空闲充电桩，有需要的小伙伴快去充电吧！
```

#### Webhook 消息

**Payload 结构**：
```json
{
  "alertType": "window_start",  // 或 "window_end"
  "timestamp": 1730793600,
  "timeString": "2025-11-05 08:00:00",
  "totalAvailableSockets": 15,
  "sockets": [
    {
      "stationId": 1,
      "stationName": "1号充电桩",
      "socketId": 3,
      "idleMinutes": 360,
      "idleStartTime": 1730772000,
      "status": "available"
    }
    // ...更多插座
  ],
  "config": {
    "threshold": 30,
    "timeRange": "08:00-17:00"
  }
}
```

**关键设计点**：
- `alertType` 区分窗口开始和结束
- `totalAvailableSockets` 提供快速统计
- `sockets` 数组包含所有空闲插座的详细信息

---

## 🔧 技术实现

### 1. 新增函数

#### `getAllAvailableSockets()` - idle-detector.ts

```typescript
export async function getAllAvailableSockets(
  db: D1Database,
  config: IdleAlertConfig,
  now: Date = new Date()
): Promise<IdleSocket[]>
```

**功能**：获取所有 `status='available'` 的插座，不考虑空闲时长阈值

**与 `detectIdleSockets()` 的区别**：
- ❌ 不过滤空闲时长阈值
- ❌ 不进行去重检查
- ✅ 仍然应用 `enabled_station_ids` 筛选

#### `isExactTime()` - service.ts

```typescript
function isExactTime(
  currentHHmm: string,
  targetHHmm: string,
  toleranceMinutes: number = 1
): boolean
```

**功能**：判断当前时间是否在目标时间的容差范围内

**特性**：
- 默认容差 ±1 分钟，避免定时任务延迟导致错过
- 支持跨日场景（如 23:59 和 00:01）
- 用于精确判断窗口开始/结束时间点

**示例**：
```
目标时间: 08:00, 容差: 1 分钟
- 07:59 ✅ (在 08:00-1 范围内)
- 08:00 ✅
- 08:01 ✅ (在 08:00+1 范围内)
- 08:02 ❌
```

#### `sendSummaryWebhook()` - alert-sender.ts

```typescript
export async function sendSummaryWebhook(
  urls: string[],
  payload: SummaryWebhookPayload,
  retryConfig: RetryConfig
): Promise<SendResult[]>
```

**功能**：并行发送汇总 Webhook 到多个 URL

**新增接口**：`SummaryWebhookPayload`

#### `sendSummaryToLark()` - lark-sender.ts

```typescript
export async function sendSummaryToLark(
  config: LarkConfig,
  count: number,
  type: 'window_start' | 'window_end'
): Promise<LarkSendResult>
```

**功能**：发送汇总飞书消息

**参数**：
- `count`: 空闲充电桩数量
- `type`: 消息类型（开始或结束）

### 2. 主流程改造

在 `runIdleAlertFlow()` 中添加窗口开始/结束检测逻辑：

```typescript
// 判断是否是窗口开始/结束的精确时间点（±1分钟容差）
const isWindowStart = isExactTime(bjTime.timeHHmm, config.time_range_start);
const isWindowEnd = isExactTime(bjTime.timeHHmm, config.time_range_end);

if (isWindowStart || isWindowEnd) {
  // 获取所有空闲插座
  const allAvailableSockets = await getAllAvailableSockets(env.DB, config, now);

  // 发送飞书汇总消息
  await sendSummaryToLark(larkConfig, socketCount, messageType);

  // 发送 Webhook 汇总消息
  await sendSummaryWebhook(webhookUrls, summaryPayload, retryConfig);

  // 窗口开始或结束时：跳过单条提醒，直接返回
  const windowType = isWindowStart ? '开始' : '结束';
  console.log(`[IDLE_ALERT] 窗口${windowType}时间，跳过单条提醒，流程结束`);
  return { /* ... */ };
}

// 检查是否在窗口边界冷静期内（±3分钟）
// 避免在窗口开始/结束附近发送单条消息与汇总消息冲突
if (isNearWindowBoundary(bjTime.timeHHmm, config.time_range_start, config.time_range_end)) {
  console.log('[IDLE_ALERT] 当前时间在窗口边界冷静期内，跳过单条提醒，流程结束');
  return { /* ... */ };
}

// 继续执行正常的单条提醒逻辑...
```

---

## 📊 功能特性

### 1. 统计范围

✅ **汇总消息统计所有 `available` 插座**，不仅是超过阈值的

**理由**：
- 用户问卷选择：「所有 status=available 的插座」
- 提供更完整的充电桩可用性信息

### 2. 去重策略

✅ **双重机制**：精确时间触发 + 窗口边界冷静期

**汇总消息去重**：
- 时间容差 ±1 分钟（避免重复发送汇总消息）
- 定时任务每 2 分钟执行一次，只有距离窗口开始/结束 ±1 分钟内才发送汇总

**单条消息抑制**：
- 窗口边界冷静期 ±3 分钟
- 在窗口开始/结束附近 3 分钟内跳过单条提醒
- 避免汇总消息和单条消息冲突

### 3. 消息策略

- **窗口开始时**：只发汇总，不发单条 ⛔
- **窗口结束时**：只发汇总，不发单条 ⛔
- **窗口内其他时间**：正常发送单条 ✅

### 4. 向后兼容

✅ 窗口内的单条提醒逻辑保持完全不变

---

## 🧪 测试方法

### 1. 使用 Backtest 脚本

```bash
# 测试窗口开始时间（08:00）- 应发送汇总消息
pnpm backtest 2025-11-17 08:00 --remote

# 测试窗口开始后冷静期（08:02）- 应跳过单条提醒
pnpm backtest 2025-11-17 08:02 --remote

# 测试窗口开始后恢复（08:04）- 应正常发送单条提醒
pnpm backtest 2025-11-17 08:04 --remote

# 测试窗口结束时间（17:00）- 应发送汇总消息
pnpm backtest 2025-11-17 17:00 --remote

# 测试窗口结束后冷静期（17:02）- 应跳过单条提醒
pnpm backtest 2025-11-17 17:02 --remote

# 测试窗口内正常时间（10:00）- 应正常发送单条提醒
pnpm backtest 2025-11-17 10:00 --remote
```

### 2. 检查日志输出

**窗口开始时**：
```
[IDLE_ALERT] 检测到时间窗口开始时间，准备发送汇总消息
[IDLE_ALERT] 当前共有 15 个空闲插座
[IDLE_ALERT] 准备发送飞书汇总消息: 🔔充电桩小助手开始上班啦！...
[IDLE_ALERT] 窗口开始时间，跳过单条提醒，流程结束
```

**窗口结束时**：
```
[IDLE_ALERT] 检测到时间窗口结束时间，准备发送汇总消息
[IDLE_ALERT] 当前共有 12 个空闲插座
[IDLE_ALERT] 准备发送飞书汇总消息: 🥳充电桩小助手下班啦...
[IDLE_ALERT] 窗口结束时间，跳过单条提醒，流程结束
```

**冷静期内（如 08:02 或 17:02）**：
```
[IDLE_ALERT] 在时间窗口内
[IDLE_ALERT] 今天是工作日
[IDLE_ALERT] 当前时间在窗口边界冷静期内，跳过单条提醒，流程结束
```

**冷静期外的正常时间（如 08:04 或 10:00）**：
```
[IDLE_ALERT] 在时间窗口内
[IDLE_ALERT] 今天是工作日
[IDLE_ALERT] 找到 3 个需要提醒的空闲插座
[IDLE_ALERT] 发送提醒到飞书...
```

### 3. 验证消息内容

**飞书消息**：
- ✅ 包含正确的 emoji（🔔 或 🥳）
- ✅ 显示正确的空闲插座数量
- ✅ 文案符合预期（「开始上班啦」或「下班啦」）

**Webhook**：
- ✅ `alertType` 为 `window_start` 或 `window_end`
- ✅ `totalAvailableSockets` 正确
- ✅ `sockets` 数组包含所有空闲插座
- ✅ 每个插座包含 `stationId`, `socketId`, `idleMinutes` 等字段

---

## 📁 文件修改清单

| 文件 | 修改内容 | 行号 |
|------|---------|------|
| `idle-alert/idle-detector.ts` | 新增 `getAllAvailableSockets()` 函数 | 44-147 |
| `idle-alert/service.ts` | 新增 `isExactTime()` 函数 | 441-459 |
| `idle-alert/service.ts` | 改造主流程，添加窗口检测逻辑 | 128-210 |
| `idle-alert/alert-sender.ts` | 新增 `SummaryWebhookPayload` 接口 | 65-82 |
| `idle-alert/alert-sender.ts` | 新增 `sendSummaryWebhook()` 函数 | 234-265 |
| `idle-alert/lark-sender.ts` | 新增 `sendSummaryToLark()` 函数 | 245-347 |

---

## 🔄 执行流程

```
定时任务触发（每2分钟）
    ↓
1. 加载配置 & 判断启用状态
    ↓
2. 转换为北京时间
    ↓
3. 判断是否在时间窗口内 ───❌──→ 跳过执行
    ↓ ✅
4. 判断是否为工作日 ───❌──→ 跳过执行
    ↓ ✅
5. 判断是否窗口开始/结束时间（±1分钟）
    ↓
┌───┴────┬─────────┬──────────┐
│        │         │          │
窗口开始  窗口结束  非精确时间
08:00±1  17:00±1   (如10:30)
│        │         │
↓        ↓         ↓
获取所有  获取所有   6. 判断是否在
空闲插座  空闲插座   窗口边界冷静期
│        │         （±3分钟）
↓        ↓         ↓
发送汇总  发送汇总   ┌─YES──┬─NO─┐
消息      消息       │      │    │
│        │         跳过   检测
↓        ↓         单条   超阈值
直接返回  直接返回   提醒   插座
⛔不发单条 ⛔不发单条  ↓      ↓
                  返回   去重检查
                         ↓
                         发送单条
                         消息
                         ↓
                         返回
```

---

## 📝 注意事项

### 1. 定时任务配置

确保定时任务在窗口开始和结束时间的容差范围内执行：

**推荐配置**（Cron 表达式）：
```
# 每 2 分钟执行一次
*/2 * * * *
```

**时间容差说明**：
- **汇总消息触发**：窗口开始/结束时间 ±1 分钟
  - 08:00 精确时间 → ✅ 发送汇总消息
  - 08:02 非精确时间 → ⛔ 不发送汇总消息（避免重复）
- **单条消息抑制**：窗口开始/结束时间 ±3 分钟（冷静期）
  - 08:02 在冷静期内 → ⛔ 跳过单条消息
  - 08:04 冷静期外 → ✅ 正常发送单条消息

### 2. 时区处理

所有时间判断基于**北京时间（Asia/Shanghai）**：
- 配置中的时间格式为 `HH:mm`
- 自动处理时区转换
- 支持跨日时间段（如 22:00-02:00）

### 3. 飞书配置

需要在配置中启用飞书：
```sql
UPDATE idle_alert_config
SET lark_enabled = 1,
    lark_auth_token = 'your-token',
    lark_chat_id = 'your-chat-id';
```

### 4. Webhook 兼容性

接收方需要适配新的 `alertType`：
- `socket_idle`: 单条提醒（原有）
- `window_start`: 窗口开始汇总（新增）
- `window_end`: 窗口结束汇总（新增）

---

## 🎉 实施效果

### Before（优化前）

```
08:00 - 发送 20 条单条提醒 💥
08:01 - 发送 5 条单条提醒
08:02 - 发送 3 条单条提醒
...
```

**问题**：消息轰炸，用户体验差

### After（优化后）

```
08:00 - 发送 1 条汇总消息 ✅
        「🔔充电桩小助手开始上班啦！当前还剩 20 个空闲充电桩...」
10:30 - 发送 1 条单条提醒（新检测到的空闲插座）
12:15 - 发送 2 条单条提醒
17:00 - 发送 1 条汇总消息 ✅
        「🥳充电桩小助手下班啦，当前共有 15 个空闲充电桩...」
        + 3 条单条提醒（超过阈值的插座）
```

**效果**：
- ✅ 消息数量大幅减少
- ✅ 用户体验友好
- ✅ 信息完整性不受影响

---

## 🔗 相关文档

- [空闲提醒功能设计](./idle-alert-design.md)
- [空闲提醒功能实现](./idle-alert-implementation.md)
- [飞书集成说明](./lark-integration.md)
- [Backtest 使用指南](./backtest-guide.md)

---

## 📞 联系方式

如有问题，请在项目 Issues 中反馈。
