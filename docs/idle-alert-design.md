# 充电桩空闲提醒功能 – Coding Agent 执行指引

本指引基于现有 Cloudflare Worker 项目（`worker.ts` + D1）整理，已经修正此前方案中的接口、运行时限制等问题，按可执行的任务顺序编写，Coding Agent 可直接依照步骤落地。

---

## 1. 功能目标与范围
- 每分钟定时任务统计各充电桩插座的连续空闲时长，超过阈值且满足时间/工作日条件时触发提醒。
- 支持多 Webhook 渠道、失败重试、按日去重与完整日志记录。
- 提供配置查询/修改、提醒日志、测试提醒等 API，并在前端新增“空闲提醒”标签页展示与管理。
- 避免影响既有状态采集流程，定时任务失败不阻塞 `performStatusCheck`。

约束说明：
- 仍运行在 Cloudflare Worker 运行时，Cron 频率 1 分钟；免费版 CPU 10ms/次，付费版 30ms/次；利用 `ctx.waitUntil` 延迟处理非关键逻辑。
- 需兼容当前 D1 结构（`latest_status` / `status_events`），新增表通过迁移文件维护。
- 访问 Apple iCloud ics 链接属于外网请求，Worker 允许直接 `fetch`。

---

## 2. 总体方案速览
1. **定时流程**（`scheduled()` 内）：
   - 调用 `performStatusCheck`（既有逻辑）。
   - 读取提醒配置 → 判断时间窗口与是否工作日 → 计算需要提醒的插座 → 并行发送 Webhook → 落库日志。
2. **模块拆分**（建议放在 `idle-alert/` 目录）：
   - `config.ts`：加载/更新提醒配置（数据库 + 环境变量/Secret 兜底）。
   - `holiday-checker.ts`：封装节假日缓存与 iCloud ics 拉取。
   - `idle-detector.ts`：基于 `latest_status` + `status_events` 计算空闲时长并做每日去重。
   - `alert-sender.ts`：发送 Webhook（自实现超时控制）、失败重试、批量结果格式化。
   - `service.ts`：组合上述能力供 `scheduled()` 和 API 复用。
3. **持久化**：新增三张表 `idle_alert_config` / `idle_alert_logs` / `holiday_cache`。
4. **API**：统一挂载在 `/api/alert/*`，写操作使用 `X-Admin-Token` 头（读取 `env.ADMIN_API_TOKEN`）进行校验。
5. **前端**：在 `public/index.html` 增加标签页、表格、测试按钮，对接新接口。

---

## 3. 任务拆解

### 3.1 数据库迁移
1. 新建 `migrations/0002_idle-alert.sql`（文件名保持时间戳/递增即可），内容包含：
   ```sql
   -- 提醒配置
   CREATE TABLE idle_alert_config (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     idle_threshold_minutes INTEGER NOT NULL DEFAULT 30,
     time_range_start TEXT NOT NULL DEFAULT '08:00',
     time_range_end TEXT NOT NULL DEFAULT '17:00',
     webhook_urls TEXT NOT NULL DEFAULT '[]',
     enabled_station_ids TEXT, -- JSON 数组，null 表示全部
     enabled INTEGER NOT NULL DEFAULT 1,
     retry_times INTEGER NOT NULL DEFAULT 2,
     retry_interval_seconds INTEGER NOT NULL DEFAULT 60,
     created_at INTEGER NOT NULL,
     updated_at INTEGER NOT NULL
   );

   INSERT INTO idle_alert_config (
     idle_threshold_minutes,
     time_range_start,
     time_range_end,
     webhook_urls,
     enabled,
     created_at,
     updated_at
   ) VALUES (30, '08:00', '17:00', '[]', 1, unixepoch(), unixepoch());

   -- 提醒日志
   CREATE TABLE idle_alert_logs (
     id TEXT PRIMARY KEY,
     station_id INTEGER NOT NULL,
     station_name TEXT NOT NULL,
     socket_id INTEGER NOT NULL,
     idle_minutes INTEGER NOT NULL,
     idle_start_time INTEGER NOT NULL,
     webhook_url TEXT NOT NULL,
     request_payload TEXT NOT NULL,
     response_status INTEGER,
     response_body TEXT,
     response_time_ms INTEGER,
     success INTEGER NOT NULL,
     error_message TEXT,
     retry_count INTEGER NOT NULL DEFAULT 0,
     triggered_at INTEGER NOT NULL,
     sent_at INTEGER NOT NULL,
     log_date TEXT NOT NULL
   );
   CREATE INDEX idx_alert_logs_date ON idle_alert_logs(log_date);
   CREATE INDEX idx_alert_logs_station ON idle_alert_logs(station_id, socket_id);
   CREATE INDEX idx_alert_logs_success ON idle_alert_logs(success);

   -- 节假日缓存
   CREATE TABLE holiday_cache (
     date TEXT PRIMARY KEY,
     is_holiday INTEGER NOT NULL,
     holiday_name TEXT,
     cached_at INTEGER NOT NULL,
     source TEXT NOT NULL DEFAULT 'apple_ical'
   );
   CREATE INDEX idx_holiday_cached_at ON holiday_cache(cached_at);
   ```
2. 更新 `README` 或 `STORAGE_MIGRATION_GUIDE`（若需要）提示运行 `wrangler d1 migrations apply`。

### 3.2 Worker 端实现（新模块 + 集成）
1. **`idle-alert/config.ts`**：
   - `export interface IdleAlertConfig` 定义字段。
   - `loadConfig(db: D1Database, env: Env): Promise<IdleAlertConfig>`：先读表，若 `webhook_urls` 为空使用 `env.IDLE_ALERT_WEBHOOK_URLS`（JSON 数组字符串）兜底；确保时间字符串为 `HH:mm`。
   - `updateConfig(db, payload): Promise<void>`：写表并更新时间戳；更新前校验时间段与阈值有效。
2. **`idle-alert/holiday-checker.ts`**：
   - `export function createHolidayChecker(db: D1Database, fetchImpl = fetch)` → 返回 `{ isWorkday(date: Date): Promise<boolean>; refresh(days?: number): Promise<void> }`。
   - `isWorkday` 内部负责读取/刷新缓存，刷新逻辑：当缓存缺失或超 30 天时调用 `refresh(days)`；`refresh` 拉取 `https://calendars.icloud.com/holidays/cn_zh.ics`，解析 ICS（可借助轻量解析器或手动正则），生成未来 365 天的工作日/休息日信息，使用事务批量写入 `holiday_cache`。
   - 容错：当外部请求失败或解析异常时，回退到 `date.getDay()` 周末逻辑并写日志。
3. **`idle-alert/idle-detector.ts`**：
   - `detectIdleSockets(db, config, now: Date): Promise<IdleSocket[]>`。
   - 读取 `latest_status`，筛选 `status === 'available'` 的插座。
   - 对每个插座查询最近一次 `status_events.new_status = 'available'` 事件计算空闲分钟数。
   - 如 `config.enabled_station_ids` 非空，仅保留被启用的充电桩。
   - 去重检查：若 `idle_alert_logs` 存在同日成功记录（`success = 1`）则跳过。
   - 返回对象包含 `stationId/name/socketId/idleMinutes/idleStartTime`。
4. **`idle-alert/alert-sender.ts`**：
   - 实现 `withTimeout(fetchPromise, timeoutMs)`：使用 `AbortController` + `setTimeout`，避免 `AbortSignal.timeout`（Workers 不支持）。
   - `sendWebhook(url, payload, retryConfig): Promise<SendResult>`：最多 `retry_times + 1` 次，间隔 `retry_interval_seconds`，失败时记录最后错误信息。
   - `sendToAll(urls, payload, retryConfig)` 使用 `Promise.all` 并返回包含原始 URL 的结果数组。
5. **`idle-alert/service.ts`**：
   - 整合 `loadConfig`、`holidayChecker`、`detectIdleSockets`、`alert-sender`、`saveLogs`。
   - `runIdleAlertFlow(env, ctx, now = new Date())`：提供给 `scheduled()`、测试接口调用。
   - `saveLogs(db, socket, results, now)`：为每个 URL 写入日志，`log_date` 使用北京时间（`toLocaleString` with `Asia/Shanghai` + `slice(0,10)`）。
6. **日志与错误处理**：为关键步骤打印结构化日志（如 `[IDLE_ALERT]` 前缀）。任何抛错需 catch 住并记录，但不影响定时任务主流程。

### 3.3 Worker 入口集成（`worker.ts`）
1. 在模块顶部初始化 `const idleAlertService = createIdleAlertService();`（如果 service 里需要注入 env/fetch，可在调用时传入）。
2. 在 `scheduled()` 里：
   ```ts
   try {
     const alertResult = await runIdleAlertFlow(env, ctx);
     console.log('[IDLE_ALERT] finished', alertResult);
   } catch (error) {
     console.error('[IDLE_ALERT] failed', error);
   }
   ```
   - 使用 `ctx.waitUntil(saveLogsPromise)` 方式避免阻塞。
3. 新增 API 路由：
   - `GET /api/alert/config`
   - `POST /api/alert/config`（需 `X-Admin-Token`，对比 `env.ADMIN_API_TOKEN`）。
   - `GET /api/alert/logs`
   - `POST /api/alert/test`（同样需要 Token，直接使用 `sendToAll`，不落库）。
   - `GET /api/alert/stats`
   以上路由放在 `fetch` 入口中，沿用现有 JSON 响应格式 `{ success: boolean, data?, error? }`。

### 3.4 前端改造（`public/index.html` + 内联 JS/CSS）
1. 新增 Tab 按钮 `data-tab="alerts"` 与对应内容容器。
2. 配置表单：加载 `/api/alert/config` 数据，调用 `POST /api/alert/config` 保存（需要在请求头添加 `X-Admin-Token`，前端可从 `localStorage` 中读取，若无则提示用户输入）。
3. 提醒记录表格：调用 `/api/alert/logs?date=YYYY-MM-DD&stationId=&socketId=&success=`，渲染分页或滚动列表。
4. “测试 Webhook” 按钮：触发 `POST /api/alert/test`，展示响应信息。
5. 统计图表可暂用简单占位（例如近 7 天的成功/失败数折线）。

### 3.5 配置与 Secret
- `wrangler.toml` 新增默认值：
  ```toml
  [vars]
  IDLE_ALERT_THRESHOLD_MINUTES = "30"
  IDLE_ALERT_TIME_START = "08:00"
  IDLE_ALERT_TIME_END = "17:00"
  IDLE_ALERT_RETRY_TIMES = "2"
  IDLE_ALERT_RETRY_INTERVAL = "60"
  TIMEZONE = "Asia/Shanghai"
  ```
- 通过 Secret 设置：
  - `IDLE_ALERT_WEBHOOK_URLS`（JSON 数组字符串，可为空）。
  - `ADMIN_API_TOKEN`（前端与 API 写操作共用）。
- 读取顺序：数据库 > Secret/环境变量 > 代码默认值。

---

## 4. 核心实现细节

### 4.1 时间窗口与工作日判定
- 在 `runIdleAlertFlow` 中统一转换当前时间为北京时间字符串：
  ```ts
  const now = new Date();
  const bjFormatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  ```
- `isInTimeRange(currentHHmm, start, end)` 支持跨日（例如 22:00-02:00）。
- `isWorkday` 先查缓存，缓存 miss 或超期才刷新；刷新失败时记录 warning 并回退到周末规则。

### 4.2 去重策略
- 仅当某插座当天存在成功提醒时才跳过；失败记录不阻止下一轮继续尝试。
- `log_date` 一律使用北京时间 `YYYY-MM-DD`，保证和业务预期一致。

### 4.3 Webhook 发送
- `payload` 字段示例：
  ```json
  {
    "alertType": "socket_idle",
    "timestamp": 1730793600,
    "timeString": "2025-11-05 14:30:00",
    "station": {"id": 1, "name": "1号充电桩"},
    "socket": {
      "id": 3,
      "status": "available",
      "idleMinutes": 35,
      "idleStartTime": 1730791500,
      "idleStartTimeString": "2025-11-05 13:55:00"
    },
    "config": {"threshold": 30, "timeRange": "08:00-17:00"}
  }
  ```
- 日志中截断 `response_body` 到 1024 字符，避免超出 D1 限制。
- `SendResult` 结构：`{ url, success, status, body, error, retryCount, elapsedMs }`。

### 4.4 API 输入输出
- `GET /api/alert/logs` 支持查询参数：`date`（必填）、`stationId`、`socketId`、`success`、`limit`（默认 100）、`offset`（默认 0）。
- `GET /api/alert/stats` 返回：总次数、成功率、按充电桩/插座聚合、近 7 天趋势。
- 写接口返回值：`{ success: true, message?: string }` 或 4xx 错误码附带 `error` 描述。

---

## 5. 监控与告警
- Worker 日志统一以 `[IDLE_ALERT]` 为前缀，区分 `INFO/WARN/ERROR`。
- 关键指标（可通过日志分析或自建监控）：
  - 成功率 `success / total`，阈值 < 95% 告警。
  - 平均响应时间 > 3000ms 告警。
  - 节假日缓存刷新失败次数。
- 对外部依赖（Apple ics）失败时在日志中打印 `WARN` 并包含重试次数、下次刷新时间。

---

## 6. 测试计划
1. **单元测试**（可用 Vitest）：
   - `isInTimeRange` 跨日与边界值。
   - `detectIdleSockets` 对不同事件序列的处理（可用内存 sqlite/模拟数据）。
   - `holidayChecker` 的缓存回退逻辑（mock fetch）。
   - `alert-sender` 重试与超时（利用 fake timers）。
2. **集成测试**（`test-local.ts` 或新增脚本）：
   - 通过 `wrangler dev --local` 启动，注入测试数据后调用 `/api/alert/*` 验证。
   - 使用 Webhook.site 验证请求体。
3. **手工验收**：
   - 在前端配置阈值、时间段，观察保存成功。
   - 人工修改 `latest_status` / `status_events` 测试去重与重试。
   - 变更系统日期测试节假日与周末拦截。

---

## 7. 部署 Checklist
1. `pnpm install`（若新增依赖如 `ical.js`）。
2. `pnpm run lint && pnpm run test`。
3. `wrangler d1 migrations apply gaotu-electric-bike-charging-pile-db --local` 验证。
4. `wrangler secret put IDLE_ALERT_WEBHOOK_URLS`（如需）。
5. `wrangler secret put ADMIN_API_TOKEN`。
6. `wrangler deploy`。
7. 通过 `/api/alert/config`、前端页面验证配置生效。

---

## 8. 未决事项 / 后续可选项
- 支持为不同充电桩设置独立阈值：可在 `idle_alert_config` 增加 `station_id` 字段并在 `detectIdleSockets` 中按桩匹配。
- Webhook 签名校验：在配置中存储 `signing_secret`，发送时添加 `X-Signature` 头。
- 提供导出 CSV/Excel 的接口供运营下载提醒日志。

---

以上内容即为实施“充电桩空闲提醒”功能的可执行步骤与技术细节，若执行中遇到新的约束，请在本文件补充记录。
