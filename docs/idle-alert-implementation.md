# 空闲提醒功能实现文档

## 概述

空闲提醒功能已于 2025-11-12 完成实现并部署到生产环境。该功能可以自动检测充电桩插座空闲超过阈值时间，并在工作时间通过 Webhook 发送提醒。

**版本信息**
- 实现版本：v1.0.0
- Commit: e4a11b4
- 部署日期：2025-11-12
- 环境：Cloudflare Workers + D1 Database

---

## 功能特性

### ✅ 核心功能

1. **智能检测**
   - 自动检测插座空闲时长
   - 基于最近一次 `available` 状态事件计算空闲时间
   - 支持多充电桩、多插座并发检测

2. **时间控制**
   - 可配置工作时间窗口（默认 08:00-17:00）
   - 支持跨日时间段（如 22:00-02:00）
   - 自动判定工作日（集成 Apple iCloud 中国节假日日历）

3. **去重机制**
   - 基于空闲周期去重：同一插座的同一次空闲周期只提醒一次
   - 去重判定基于 `(station_id, socket_id, idle_start_time)` 三元组
   - 如果插座中间被占用过，再次空闲时会产生新的 `idle_start_time`，会重新提醒
   - 基于 `idle_alert_logs` 表的 `success = 1` 记录判定
   - 失败的提醒不计入去重，允许重试

4. **可靠发送**
   - 支持多个 Webhook URL 并行发送
   - 超时控制（5 秒）
   - 失败重试（可配置次数和间隔）
   - 完整的请求/响应日志记录

### 🎯 智能判定

**提醒触发条件**（所有条件需同时满足）：

```
✅ 功能已启用（enabled = 1）
✅ 当前时间在时间窗口内（time_range_start - time_range_end）
✅ 今天是工作日（非周末且非节假日）
✅ 插座状态为 available
✅ 空闲时长 >= idle_threshold_minutes
✅ 本次空闲周期该插座尚未成功提醒（基于 idle_start_time）
✅ 已配置有效的 Webhook URL
```

---

## 架构设计

### 模块结构

```
idle-alert/
├── config.ts          # 配置管理（加载、更新、校验）
├── holiday-checker.ts # 节假日判定（iCloud 日历集成）
├── idle-detector.ts   # 空闲检测（时长计算、去重）
├── alert-sender.ts    # Webhook 发送（超时、重试、并发）
└── service.ts         # 服务整合层（流程编排）
```

### 数据库表

#### 1. `idle_alert_config` - 提醒配置表

| 字段 | 类型 | 说明 | 默认值 |
|------|------|------|--------|
| id | INTEGER | 主键（自增） | - |
| idle_threshold_minutes | INTEGER | 空闲阈值（分钟） | 30 |
| time_range_start | TEXT | 时间窗口开始（HH:mm） | '08:00' |
| time_range_end | TEXT | 时间窗口结束（HH:mm） | '17:00' |
| webhook_urls | TEXT | Webhook URLs（JSON 数组） | '[]' |
| enabled_station_ids | TEXT | 启用的充电桩ID（JSON 数组，null=全部） | null |
| enabled | INTEGER | 是否启用（1=启用，0=禁用） | 1 |
| retry_times | INTEGER | 重试次数 | 2 |
| retry_interval_seconds | INTEGER | 重试间隔（秒） | 60 |
| created_at | INTEGER | 创建时间（Unix 时间戳） | - |
| updated_at | INTEGER | 更新时间（Unix 时间戳） | - |

**配置读取顺序**：
1. 数据库配置（优先级最高）
2. Secret 环境变量（`IDLE_ALERT_WEBHOOK_URLS`）
3. 普通环境变量（`IDLE_ALERT_*`）
4. 代码默认值（兜底）

#### 2. `idle_alert_logs` - 提醒日志表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 日志ID（主键） |
| station_id | INTEGER | 充电桩ID |
| station_name | TEXT | 充电桩名称 |
| socket_id | INTEGER | 插座ID |
| idle_minutes | INTEGER | 空闲分钟数 |
| idle_start_time | INTEGER | 空闲开始时间（Unix 秒） |
| webhook_url | TEXT | Webhook URL |
| request_payload | TEXT | 请求体（JSON） |
| response_status | INTEGER | HTTP 状态码 |
| response_body | TEXT | 响应体（截断到 1024 字符） |
| response_time_ms | INTEGER | 响应耗时（毫秒） |
| success | INTEGER | 是否成功（1=成功，0=失败） |
| error_message | TEXT | 错误信息 |
| retry_count | INTEGER | 重试次数 |
| triggered_at | INTEGER | 触发时间（Unix 秒） |
| sent_at | INTEGER | 发送时间（Unix 秒） |
| log_date | TEXT | 日期（YYYY-MM-DD，用于去重） |

**索引**：
- `idx_alert_logs_date` (log_date)
- `idx_alert_logs_station` (station_id, socket_id)
- `idx_alert_logs_success` (success)

#### 3. `holiday_cache` - 节假日缓存表

| 字段 | 类型 | 说明 |
|------|------|------|
| date | TEXT | 日期（YYYY-MM-DD，主键） |
| is_holiday | INTEGER | 是否节假日（1=是，0=否） |
| holiday_name | TEXT | 节假日名称 |
| cached_at | INTEGER | 缓存时间（Unix 秒） |
| source | TEXT | 数据源（'apple_ical'） |

**数据源**：
- URL: https://calendars.icloud.com/holidays/cn_zh.ics
- 格式：iCalendar (ICS)
- 缓存有效期：30 天
- 自动刷新：缓存过期时触发

---

## API 接口

### 1. 查询配置

```http
GET /api/alert/config
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "id": 1,
    "idle_threshold_minutes": 30,
    "time_range_start": "08:00",
    "time_range_end": "17:00",
    "webhook_urls": "[\"https://webhook.site/xxx\"]",
    "enabled_station_ids": null,
    "enabled": 1,
    "retry_times": 2,
    "retry_interval_seconds": 60,
    "created_at": 1762938823,
    "updated_at": 1762938823
  }
}
```

### 2. 更新配置（需要 Token）

```http
POST /api/alert/config
Headers:
  X-Admin-Token: your-admin-token
  Content-Type: application/json
Body:
{
  "idle_threshold_minutes": 45,
  "time_range_start": "09:00",
  "time_range_end": "18:00",
  "webhook_urls": "[\"https://webhook.site/xxx\"]",
  "enabled": 1
}
```

**参数校验**：
- `idle_threshold_minutes`: 1-1440 之间
- `time_range_start/end`: 必须为 HH:mm 格式
- `webhook_urls`: 必须为 JSON 数组，每个 URL 以 http/https 开头
- `retry_times`: 0-10 之间
- `retry_interval_seconds`: 1-300 之间

### 3. 查询日志

```http
GET /api/alert/logs?date=2025-11-12&limit=100&offset=0
```

**查询参数**：
- `date` (可选): 日期过滤（YYYY-MM-DD）
- `stationId` (可选): 充电桩ID
- `socketId` (可选): 插座ID
- `success` (可选): 成功状态（'true'/'false'）
- `limit` (可选): 返回数量，默认 100
- `offset` (可选): 偏移量，默认 0

### 4. 测试 Webhook（需要 Token）

```http
POST /api/alert/test
Headers:
  X-Admin-Token: your-admin-token
```

发送一条测试消息到所有配置的 Webhook URL。

### 5. 查询统计

```http
GET /api/alert/stats
```

返回近 7 天的统计数据（总次数、成功率、按充电桩分组、趋势）。

---

## 执行流程

### 定时任务流程

```
每分钟执行（Cron: * * * * *）
    ↓
1. 执行状态检查（performStatusCheck）
    ↓
2. 执行空闲提醒流程（runIdleAlertFlow）
    ↓
    ├─ 加载配置
    ├─ 检查是否启用
    ├─ 判断时间窗口
    ├─ 判断工作日
    ├─ 检测空闲插座（detectIdleSockets）
    │   ├─ 读取 latest_status
    │   ├─ 筛选 available 插座
    │   ├─ 查询最近 available 事件
    │   ├─ 计算空闲时长
    │   ├─ 应用阈值过滤
    │   └─ 去重检查
    ├─ 发送 Webhook（sendToAll）
    │   ├─ 并行发送到多个 URL
    │   ├─ 超时控制（5秒）
    │   └─ 失败重试
    └─ 保存日志（saveLogs）
```

### 节假日判定流程

```
isWorkday(date)
    ↓
查询 holiday_cache
    ↓
    ├─ 命中缓存 ──→ 检查缓存时效（<30天）
    │                     ↓
    │               有效 ──→ 返回结果
    │                     ↓
    │               过期 ──→ 刷新缓存
    └─ 未命中 ──→ 刷新缓存
                      ↓
              拉取 iCloud 日历
                      ↓
              解析 ICS 文件
                      ↓
              生成未来365天缓存
                      ↓
              批量写入数据库
                      ↓
              返回结果
```

**容错机制**：
- 刷新失败时回退到周末逻辑（周六、周日为非工作日）
- 网络异常不影响核心功能

---

## Webhook Payload 格式

```json
{
  "alertType": "socket_idle",
  "timestamp": 1762938823,
  "timeString": "2025-11-12 16:13:43",
  "station": {
    "id": 1,
    "name": "1号充电桩"
  },
  "socket": {
    "id": 2,
    "status": "available",
    "idleMinutes": 60,
    "idleStartTime": 1762935223,
    "idleStartTimeString": "2025-11-12 15:13:43"
  },
  "config": {
    "threshold": 30,
    "timeRange": "08:00-17:00"
  }
}
```

**字段说明**：
- `alertType`: 固定为 "socket_idle"
- `timestamp`: 当前 Unix 时间戳（秒）
- `timeString`: 北京时间字符串
- `station.id/name`: 充电桩信息
- `socket.id`: 插座编号
- `socket.idleMinutes`: 空闲分钟数
- `socket.idleStartTime`: 空闲开始时间（Unix 秒）
- `config.threshold`: 当前配置的阈值
- `config.timeRange`: 当前配置的时间窗口

---

## 前端界面

### 标签页结构

```
充电桩状态监控
├── [充电桩状态] 标签页
│   ├── 状态图例
│   ├── 充电桩卡片（3个）
│   └── 状态变化事件
└── [空闲提醒] 标签页 ★新增
    ├── 提醒配置表单
    │   ├── 空闲阈值
    │   ├── 时间窗口
    │   ├── Webhook URLs
    │   ├── 启用/禁用
    │   └── 操作按钮（保存/测试/刷新）
    ├── 提醒日志查询
    │   ├── 日期选择器
    │   └── 日志表格
    └── 统计信息
        ├── 总次数/成功率
        └── 按充电桩分组统计
```

### Token 管理

- Token 存储在 `localStorage.adminToken`
- 首次使用时通过 `prompt()` 获取
- 更新配置或测试时自动读取
- Token 验证失败时清除缓存，提示重新输入

---

## 部署指南

### 1. 数据库迁移

**本地测试**：
```bash
wrangler d1 migrations apply gaotu-electric-bike-charging-pile-db --local
```

**生产环境**：
```bash
wrangler d1 migrations apply gaotu-electric-bike-charging-pile-db --remote
```

### 2. 配置 Secrets

```bash
# 配置 Webhook URLs（必需）
wrangler secret put IDLE_ALERT_WEBHOOK_URLS
# 输入：["https://your-webhook-url.com/endpoint"]

# 配置管理员 Token（必需）
wrangler secret put ADMIN_API_TOKEN
# 输入：your-secure-random-token
```

### 3. 部署 Worker

```bash
wrangler deploy
```

### 4. 验证部署

```bash
# 查询配置
curl https://electric-bike-charging-pile.hansnow.me/api/alert/config

# 查询统计
curl https://electric-bike-charging-pile.hansnow.me/api/alert/stats
```

---

## 监控与维护

### 日志检查

**Worker 日志**（Cloudflare Dashboard）：
```
[IDLE_ALERT] 配置加载成功
[IDLE_ALERT] 开始检测空闲插座
[IDLE_ALERT] 找到 X 个超过阈值的空闲插座
[IDLE_ALERT] 开始发送 Webhook 到 X 个 URL
[IDLE_ALERT] Webhook 发送完成: 成功 X, 失败 X
[IDLE_ALERT] 保存 X 条提醒日志成功
```

**数据库日志**：
```sql
-- 查询今天的提醒记录
SELECT * FROM idle_alert_logs WHERE log_date = '2025-11-12';

-- 查询失败的提醒
SELECT * FROM idle_alert_logs WHERE success = 0 ORDER BY triggered_at DESC;

-- 查询成功率
SELECT
  log_date,
  COUNT(*) as total,
  SUM(success) as success_count,
  ROUND(SUM(success) * 100.0 / COUNT(*), 2) as success_rate
FROM idle_alert_logs
GROUP BY log_date
ORDER BY log_date DESC;
```

### 性能指标

| 指标 | 目标值 | 监控方式 |
|------|--------|----------|
| 提醒延迟 | < 2 分钟 | Worker 执行时间 |
| 成功率 | ≥ 95% | `idle_alert_logs.success` |
| Webhook 响应时间 | < 5 秒 | `idle_alert_logs.response_time_ms` |
| 数据库查询时间 | < 100ms | Worker 日志 |

### 常见问题排查

**问题 1：没有收到提醒**

检查清单：
- [ ] `enabled = 1`（功能已启用）
- [ ] 当前时间在时间窗口内
- [ ] 今天是工作日（非周末/节假日）
- [ ] 确实有插座空闲超过阈值
- [ ] Webhook URL 配置正确
- [ ] 今天该插座未成功提醒过

**问题 2：提醒失败**

检查：
1. 查看 `idle_alert_logs` 表的 `error_message` 字段
2. 检查 `response_status` 是否为 2xx
3. 验证 Webhook URL 是否可访问
4. 检查 Webhook 接收端是否正常

**问题 3：同一空闲周期重复提醒**

- 去重机制基于 `(station_id, socket_id, idle_start_time)` 和 `success = 1` 的记录
- 如果所有尝试都失败（`success = 0`），下次仍会尝试
- 检查 `idle_alert_logs` 表确认 `idle_start_time` 是否一致
- 如果插座中间被占用过，会产生新的 `idle_start_time`，再次提醒是正常的

---

## 测试建议

### 单元测试

目前空闲提醒模块已实现但未添加单元测试。建议补充：

```typescript
// idle-alert/holiday-checker.test.ts
describe('HolidayChecker', () => {
  test('应该正确解析 ICS 文件', () => { ... });
  test('应该识别周末为非工作日', () => { ... });
  test('应该使用缓存', () => { ... });
});

// idle-alert/idle-detector.test.ts
describe('IdleDetector', () => {
  test('应该正确计算空闲时长', () => { ... });
  test('应该应用阈值过滤', () => { ... });
  test('应该去重', () => { ... });
});
```

### 集成测试

使用 [webhook.site](https://webhook.site) 进行端到端测试：

1. 获取一个临时 Webhook URL
2. 配置到 `IDLE_ALERT_WEBHOOK_URLS`
3. 手动创建测试数据（空闲插座）
4. 等待定时任务执行或手动触发
5. 在 webhook.site 查看收到的消息

---

## 性能优化

### 已实现的优化

1. **批量查询**：一次查询所有在线充电桩
2. **并行发送**：使用 `Promise.all` 并行发送到多个 Webhook
3. **异步日志**：使用 `ctx.waitUntil` 异步保存日志
4. **节假日缓存**：缓存未来 365 天的节假日数据
5. **索引优化**：在 `log_date`、`station_id`、`success` 字段上建立索引

### 未来优化方向

1. **增量检测**：只检查最近变化的插座
2. **智能重试**：根据错误类型调整重试策略
3. **批量日志**：合并多个插座的日志批量写入
4. **缓存预热**：Worker 启动时预加载节假日缓存

---

## 版本历史

### v1.0.0 (2025-11-12)

**新增功能**：
- ✅ 空闲检测与提醒
- ✅ 节假日判定（iCloud 日历）
- ✅ Webhook 发送（超时、重试）
- ✅ 配置管理 API
- ✅ 日志查询与统计
- ✅ 前端管理界面
- ✅ Token 认证

**技术栈**：
- Cloudflare Workers
- D1 Database
- TypeScript
- iCalendar (ICS) 解析

**已知限制**：
- Miniflare 不支持 scheduled 触发器的本地测试
- 节假日数据依赖 iCloud 服务可用性
- 单个 Webhook URL 超时时间固定为 5 秒

---

## 参考资料

- [设计文档](./idle-alert-design.md)
- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [D1 Database 文档](https://developers.cloudflare.com/d1/)
- [iCalendar 规范](https://www.rfc-editor.org/rfc/rfc5545)
- [Apple iCloud 节假日日历](https://calendars.icloud.com/holidays/)
