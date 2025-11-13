# 空闲提醒飞书消息集成文档

## 概述

空闲提醒功能已于 2025-11-13 集成了飞书消息发送能力。当检测到空闲插座时，系统除了发送 Webhook 请求外，还可以同时向飞书群组发送消息通知。

**版本信息**
- 实现版本：v1.1.0
- 部署日期：2025-11-13
- 依赖服务：[飞书消息服务](https://lark-messager.hansnow.me)
- 相关模块：`idle-alert/lark-sender.ts`

---

## 功能特性

### ✅ 核心功能

1. **消息发送**
   - 支持向飞书群组发送空闲提醒消息
   - 使用固定的消息模板格式
   - 自动记录发送结果到日志

2. **配置灵活**
   - 可独立启用/禁用飞书提醒
   - 支持配置鉴权令牌和群组 ID
   - 与 Webhook 发送互不影响

3. **可靠性**
   - 完整的错误处理和日志记录
   - 发送结果记录到数据库
   - 支持多条消息顺序发送

4. **性能优化**
   - 多条消息之间自动间隔 100ms，避免频率限制
   - 不影响 Webhook 发送性能

### 📱 消息模板

飞书消息使用固定格式：

```
x号充电桩y号插座已经空闲z分钟啦
```

**示例**：
- `1号充电桩2号插座已经空闲30分钟啦`
- `3号充电桩1号插座已经空闲45分钟啦`

---

## 架构设计

### 模块结构

```
idle-alert/
├── config.ts          # 配置管理（新增飞书配置字段）
├── lark-sender.ts     # 飞书消息发送模块（新增）
├── service.ts         # 服务整合层（集成飞书发送）
└── ... 其他模块
```

### 数据流

```
空闲检测 → 构建消息内容 → 并行发送
                           ├─> Webhook 发送
                           └─> 飞书消息发送 → 记录日志
```

---

## 数据库变更

### 1. `idle_alert_config` 表新增字段

| 字段 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| lark_enabled | INTEGER | 是否启用飞书提醒（1=启用，0=禁用） | 0 |
| lark_auth_token | TEXT | 飞书鉴权令牌 | NULL |
| lark_chat_id | TEXT | 飞书群组 ID（可选） | NULL |

**迁移脚本**：`migrations/0003_add-lark-support.sql`

### 2. `idle_alert_logs` 表新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| lark_message_id | TEXT | 飞书消息 ID |
| lark_success | INTEGER | 飞书发送是否成功（1=成功，0=失败） |
| lark_error_message | TEXT | 飞书发送错误信息 |
| lark_response_time_ms | INTEGER | 飞书 API 响应时间（毫秒） |

---

## 配置说明

### 环境变量

飞书配置存储在数据库中，不使用环境变量（出于安全考虑）。

### 数据库配置

通过 API 接口更新配置：

```http
POST /api/alert/config
X-Admin-Token: your-admin-token
Content-Type: application/json

{
  "lark_enabled": 1,
  "lark_auth_token": "your-lark-auth-token",
  "lark_chat_id": "oc_xxx"
}
```

**参数说明**：

- `lark_enabled`: 必填，1=启用，0=禁用
- `lark_auth_token`: 必填，飞书消息服务的鉴权令牌
- `lark_chat_id`: 可选，飞书群组 ID（如果服务端配置了默认群组可不传）

---

## 实现细节

### 1. 飞书消息发送模块 (`lark-sender.ts`)

#### 接口定义

```typescript
// 飞书配置接口
export interface LarkConfig {
  authToken: string;
  chatId?: string;
  enabled: boolean;
}

// 发送结果接口
export interface LarkSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  elapsedMs: number;
}

// 消息内容接口
export interface LarkMessageContent {
  stationId: number;
  stationName: string;
  socketId: number;
  idleMinutes: number;
}
```

#### 核心功能

**1. 消息构建**

```typescript
function buildLarkMessage(content: LarkMessageContent): string {
  return `${content.stationId}号充电桩${content.socketId}号插座已经空闲${content.idleMinutes}分钟啦`;
}
```

**2. 单条消息发送**

```typescript
export async function sendLarkMessage(
  config: LarkConfig,
  content: LarkMessageContent,
  fetchImpl: typeof fetch = fetch
): Promise<LarkSendResult>
```

- 验证配置有效性
- 构建请求体（符合飞书消息 API 格式）
- 发送 HTTP POST 请求
- 解析响应并返回结果

**3. 批量消息发送**

```typescript
export async function sendLarkMessages(
  config: LarkConfig,
  contents: LarkMessageContent[],
  fetchImpl: typeof fetch = fetch
): Promise<LarkSendResult[]>
```

- 顺序发送多条消息（避免并发导致的消息顺序混乱）
- 每条消息之间间隔 100ms（避免频率限制）
- 统计成功/失败数量

### 2. 服务层集成 (`service.ts`)

#### 流程变更

在原有的空闲提醒流程中，增加了飞书消息发送步骤：

```typescript
// 7. 为每个空闲插座发送 Webhook 和飞书消息
for (const socket of idleSockets) {
  // 构建 Webhook Payload
  const payload = buildWebhookPayload(socket, config, bjTime);

  // 发送到所有 Webhook URLs
  const results = await sendToAll(webhookUrls, payload, {
    retryTimes: config.retry_times,
    retryIntervalSeconds: config.retry_interval_seconds,
  });

  // 发送飞书消息（如果启用）
  let larkResult: LarkSendResult | undefined;
  if (larkConfig.enabled) {
    larkResult = await sendLarkMessage(larkConfig, {
      stationId: socket.stationId,
      stationName: socket.stationName,
      socketId: socket.socketId,
      idleMinutes: socket.idleMinutes,
    });
  }

  // 保存日志（包含飞书结果）
  await saveLogs(env.DB, socket, results, bjTime, larkResult);
}
```

#### 日志记录

日志保存时增加飞书相关字段：

```typescript
db.prepare(
  `INSERT INTO idle_alert_logs
   (..., lark_message_id, lark_success, lark_error_message, lark_response_time_ms)
   VALUES (?, ?, ?, ?)`
).bind(
  ...,
  larkResult?.messageId || null,
  larkResult ? (larkResult.success ? 1 : 0) : null,
  larkResult?.error || null,
  larkResult?.elapsedMs || null
);
```

### 3. 配置管理 (`config.ts`)

#### 配置接口扩展

```typescript
export interface IdleAlertConfig {
  // ... 原有字段
  lark_enabled: number;
  lark_auth_token: string | null;
  lark_chat_id: string | null;
}

export interface UpdateConfigPayload {
  // ... 原有字段
  lark_enabled?: number;
  lark_auth_token?: string | null;
  lark_chat_id?: string | null;
}
```

#### 配置更新逻辑

```typescript
export async function updateConfig(
  db: D1Database,
  payload: UpdateConfigPayload
): Promise<void> {
  // ... 原有验证逻辑

  // 更新飞书配置字段
  if (payload.lark_enabled !== undefined) {
    updateFields.push('lark_enabled = ?');
    params.push(payload.lark_enabled);
  }
  // ... 其他字段
}
```

---

## API 使用示例

### 1. 查询配置

```bash
curl https://electric-bike-charging-pile.hansnow.me/api/alert/config
```

**响应**：

```json
{
  "success": true,
  "data": {
    "id": 1,
    "idle_threshold_minutes": 30,
    "time_range_start": "08:00",
    "time_range_end": "17:00",
    "webhook_urls": "[\"https://webhook.site/xxx\"]",
    "enabled": 1,
    "lark_enabled": 1,
    "lark_auth_token": "your-token",
    "lark_chat_id": "oc_xxx",
    "created_at": 1762938823,
    "updated_at": 1762938823
  }
}
```

### 2. 启用飞书提醒

```bash
curl -X POST https://electric-bike-charging-pile.hansnow.me/api/alert/config \
  -H "X-Admin-Token: your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "lark_enabled": 1,
    "lark_auth_token": "your-lark-auth-token",
    "lark_chat_id": "oc_xxx"
  }'
```

### 3. 禁用飞书提醒

```bash
curl -X POST https://electric-bike-charging-pile.hansnow.me/api/alert/config \
  -H "X-Admin-Token: your-admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "lark_enabled": 0
  }'
```

### 4. 查询日志（包含飞书结果）

```bash
curl "https://electric-bike-charging-pile.hansnow.me/api/alert/logs?date=2025-11-13&limit=10"
```

**响应**：

```json
{
  "success": true,
  "data": [
    {
      "id": "1-2-https://webhook.site/xxx-1762938823",
      "station_id": 1,
      "station_name": "1号充电桩",
      "socket_id": 2,
      "idle_minutes": 30,
      "webhook_url": "https://webhook.site/xxx",
      "success": 1,
      "lark_message_id": "om_abc123",
      "lark_success": 1,
      "lark_error_message": null,
      "lark_response_time_ms": 156,
      "log_date": "2025-11-13"
    }
  ],
  "count": 1
}
```

---

## 错误处理

### 1. 配置错误

**场景**：未配置 `lark_auth_token` 但启用了飞书提醒

**行为**：
- 不发送飞书消息
- 日志中记录错误信息：`"lark_error_message": "飞书 auth_token 未配置"`
- 不影响 Webhook 发送

### 2. 发送失败

**场景**：飞书 API 返回错误（如网络问题、鉴权失败等）

**行为**：
- 日志中记录失败状态：`lark_success: 0`
- 记录错误信息到 `lark_error_message`
- 不影响 Webhook 发送
- **注意**：飞书消息发送不支持重试（与 Webhook 不同）

### 3. 响应解析失败

**场景**：飞书 API 返回非 JSON 格式

**行为**：
- 日志中记录错误：`"飞书 API 响应解析失败"`
- 不影响后续流程

---

## 性能考虑

### 1. 发送延迟

- **单条消息**：平均响应时间约 100-200ms
- **批量消息**：顺序发送，每条消息间隔 100ms
- **对整体性能影响**：轻微延长空闲提醒流程，但可接受

### 2. 并发控制

- 飞书消息采用顺序发送（避免消息顺序混乱）
- Webhook 仍然采用并行发送（互不影响）

### 3. 频率限制

- 自动在每条消息之间间隔 100ms
- 避免触发飞书 API 频率限制
- 生产环境中通常每分钟只有少量空闲插座，不会有性能问题

---

## 安全性

### 1. 鉴权令牌管理

- `lark_auth_token` 存储在 D1 数据库中（非明文环境变量）
- 仅管理员可通过 API 更新配置（需要 `X-Admin-Token`）
- API 响应中会返回 token（脱敏后可考虑隐藏）

### 2. 数据隐私

- 飞书消息仅包含充电桩/插座编号和空闲时长
- 不包含用户个人信息
- 日志中记录飞书消息 ID，便于追溯

---

## 监控与告警

### 1. 关键指标

可通过查询日志统计以下指标：

**飞书消息发送成功率**：
```sql
SELECT
  COUNT(*) as total,
  SUM(CASE WHEN lark_success = 1 THEN 1 ELSE 0 END) as success_count,
  ROUND(100.0 * SUM(CASE WHEN lark_success = 1 THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM idle_alert_logs
WHERE lark_success IS NOT NULL
  AND log_date >= date('now', '-7 days');
```

**飞书消息平均响应时间**：
```sql
SELECT
  AVG(lark_response_time_ms) as avg_response_ms,
  MAX(lark_response_time_ms) as max_response_ms
FROM idle_alert_logs
WHERE lark_success = 1
  AND log_date >= date('now', '-7 days');
```

### 2. 常见问题排查

**问题 1：飞书消息未发送**

排查步骤：
1. 检查配置：`GET /api/alert/config` 确认 `lark_enabled = 1`
2. 检查日志：`GET /api/alert/logs` 查看 `lark_error_message`
3. 验证 token：确保 `lark_auth_token` 有效

**问题 2：消息发送成功但未收到**

排查步骤：
1. 检查日志确认 `lark_success = 1` 和 `lark_message_id` 存在
2. 确认飞书群组 ID 正确
3. 确认机器人在群组中且有发送权限

---

## 测试

### 1. 单元测试

暂未实现（可考虑添加）。

建议测试用例：
- 消息模板构建测试
- 配置验证测试
- 错误处理测试

### 2. 手动测试

**测试步骤**：

1. 配置飞书提醒：
   ```bash
   curl -X POST https://electric-bike-charging-pile.hansnow.me/api/alert/config \
     -H "X-Admin-Token: your-admin-token" \
     -H "Content-Type: application/json" \
     -d '{
       "lark_enabled": 1,
       "lark_auth_token": "test-token",
       "lark_chat_id": "oc_test"
     }'
   ```

2. 等待触发条件满足（或修改配置降低阈值）

3. 检查飞书群组是否收到消息

4. 查询日志验证：
   ```bash
   curl "https://electric-bike-charging-pile.hansnow.me/api/alert/logs?limit=10"
   ```

---

## 未来优化

### 1. 功能增强

- [ ] 支持富文本消息（卡片消息）
- [ ] 支持 @特定用户
- [ ] 支持消息模板自定义
- [ ] 支持飞书消息发送失败重试

### 2. 性能优化

- [ ] 考虑异步发送（使用 Cloudflare Queue）
- [ ] 批量发送优化（减少 API 调用次数）

### 3. 可观测性

- [ ] 添加飞书发送成功率监控指标
- [ ] 添加响应时间 P99 监控
- [ ] 集成到 Cloudflare Workers 观测面板

---

## 相关文档

- [空闲提醒功能实现文档](./idle-alert-implementation.md)
- [空闲提醒功能设计文档](./idle-alert-design.md)
- [飞书消息 API 文档](../../lark-messager/API_USAGE.md)
- [API 接口文档](../API.md)

---

## 变更记录

| 日期 | 版本 | 变更内容 |
|------|------|----------|
| 2025-11-13 | v1.1.0 | 初始版本，实现飞书消息发送功能 |
