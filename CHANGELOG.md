# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-01-11

### Fixed
- **周末误判为工作日**：修复节假日缓存逻辑，普通周末（未被 iCloud 日历标注的日期）现在能正确识别为非工作日，不再发送飞书通知
- **同一分钟大量飞书通知**：新增批量聚合消息功能，当同一分钟内有多个插座超过空闲阈值时，只发送一条聚合消息，避免刷屏
- **批量消息缺少配置验证**：补充 `sendBatchAggregatedLarkMessage` 的 `auth_token` 验证逻辑，与单条消息保持一致

### Added
- **批量聚合飞书消息**：当检测到 ≥2 个插座需要提醒时，发送聚合消息（如："🔔 检测到 13 个充电桩插座空闲超过 5 分钟：\n- 3号充电桩：插座3,4,6,7,8,9,10,11,14,16,17,18,19"）

### Changed
- **日志保存策略**：将日志保存从异步改为同步执行，确保去重机制在并发场景下有效工作

### Technical Details
- 修改文件：
  - `idle-alert/holiday-checker.ts`: 修复周末判断逻辑，增加周末检测
  - `idle-alert/lark-sender.ts`: 新增 `sendBatchAggregatedLarkMessage` 函数和相关接口
  - `idle-alert/service.ts`: 修改发送逻辑，当有多个插座时使用批量聚合消息
  - `package.json`: 版本号更新至 1.5.0
  - `public/index.html`: 前端版本号更新至 v1.5.0

## [1.4.3] - 2026-01-05

### Fixed
- **节气误判为节假日**：仅在摘要包含“（休）/（班）”时才识别为节假日或补班日，避免节气导致工作日提醒被跳过

### Technical Details
- 修改文件：
  - `idle-alert/holiday-checker.ts`: 仅解析标注（休/班）的节假日事件，忽略节气等无标注事件
  - `package.json`: 版本号更新至 1.4.3
  - `public/index.html`: 前端版本号更新至 v1.4.3

## [1.4.2] - 2026-01-04

### Fixed
- **下班汇总消息漏发**：定时任务触发延迟时，改用 `scheduledTime` 作为空闲提醒时间基准，避免错过 17:00 下班窗口

### Technical Details
- 修改文件：
  - `worker.ts`: `scheduled()` 使用 `event.scheduledTime` 调用 `runIdleAlertFlow`
  - `package.json`: 版本号更新至 1.4.2
  - `public/index.html`: 前端版本号更新至 v1.4.2

## [1.4.1] - 2026-01-03

### Added
- **单元测试补充**：新增节假日解析/时区/缓存判断的测试，以及 `getDeviceDetail` 的请求参数与响应处理测试

### Changed
- **测试对齐北京时间逻辑**：`getTimeString` 测试使用北京时间期望值，并在预期 JSON 解析失败场景中静默错误日志
- **节假日解析可测试化**：导出 `parseICS`、`formatDate`、`isWeekend` 以便单元测试复用

### Removed
- **临时测试脚本清理**：移除 `scripts/test-2026-newyear.ts`、`scripts/test-parseics-fix.ts`、`scripts/test-holiday-fix.ts`、`test-local.ts`

### Technical Details
- 修改文件：
  - `idle-alert/holiday-checker.ts`: 导出 `parseICS`、`formatDate`、`isWeekend`
  - `idle-alert/holiday-checker.test.ts`: 新增节假日解析与时区/缓存测试
  - `test-local.test.ts`: 新增 `getDeviceDetail` 单元测试（mock fetch）
  - `status-tracker.test.ts`: 更新北京时间期望值并静默预期错误日志
  - `package.json`: 版本号更新至 1.4.1
  - `public/index.html`: 前端版本号更新至 v1.4.1

## [1.4.0] - 2026-01-03

### Fixed
- **节假日判断时区问题修复**：修复了空闲提醒在节假日仍然发送的时区问题
  - 问题场景：2026-01-01 和 2026-01-02 虽然是元旦假期，但系统在北京时间早上 00:00-07:59 仍然发送了提醒
  - 问题根因：`formatDate()` 和 `isWeekend()` 函数使用 UTC 时区而非北京时间，导致日期判断错误
  - 修复方案：
    - `formatDate()` 现在将 UTC 时间转换为北京时间（UTC+8）后再格式化日期
    - `isWeekend()` 现在将 UTC 时间转换为北京时间（UTC+8）后再判断星期几
  - 影响范围：所有节假日和周末的判断逻辑

- **节假日解析时间段支持**：修复了 ICS 文件解析只识别单日节假日的问题
  - 问题场景：2026 年元旦放假 3 天（1月1-3日），但系统只识别了 1 月 1 日，导致 1 月 2 日仍然发送提醒
  - 问题根因：`parseICS()` 函数只提取 `DTSTART`，完全忽略 `DTEND`，无法处理多天假期
  - 修复方案：
    - `parseICS()` 现在支持 `DTSTART` + `DTEND` 时间段，自动展开为多个日期
    - 例如：`DTSTART=20260101, DTEND=20260104` 会展开为 2026-01-01, 01-02, 01-03 三个日期
  - 影响范围：所有多天节假日的识别

- **调休补班日识别**：新增对调休补班日的正确识别和处理
  - 问题场景：2026-01-04 是周日但需要调休补班，系统之前会将其识别为周末不发送提醒
  - 修复方案：
    - `parseICS()` 通过 SUMMARY 字段区分"元旦（休）"和"元旦（班）"
    - 节假日（休）→ `is_holiday=1` → 不发送提醒
    - 调休补班日（班）→ `is_holiday=0` → 发送提醒
  - 影响范围：所有调休补班日的处理

### Changed
- **节假日数据结构扩展**：`parseICS()` 返回值新增 `isHoliday` 字段
  - `isHoliday=true`：节假日（休），不发送提醒
  - `isHoliday=false`：调休补班日（班），需要发送提醒

### Technical Details
- 修改文件：
  - `idle-alert/holiday-checker.ts`:
    - 修改 `formatDate()` 函数（第 259-268 行）：使用北京时间而非 UTC 时间
    - 修改 `isWeekend()` 函数（第 280-287 行）：使用北京时间而非 UTC 时间
    - 重构 `parseICS()` 函数（第 182-293 行）：支持时间段展开和节假日类型识别
    - 新增 `formatDateStr()` 辅助函数（第 277-282 行）：UTC 时间格式化
    - 修改 `refresh()` 函数（第 134-175 行）：使用新的节假日映射逻辑
  - `package.json`: 版本号更新至 1.4.0
- 新增测试脚本：
  - `scripts/test-holiday-fix.ts`: 时区修复验证测试
  - `scripts/test-parseics-fix.ts`: parseICS 功能测试
  - `scripts/test-2026-newyear.ts`: 2026 年元旦完整场景测试

### 2026 年元旦测试验证
- 2026-01-01 (周四)：元旦（休），is_holiday=1 → ✅ 不发送提醒
- 2026-01-02 (周五)：元旦（休），is_holiday=1 → ✅ 不发送提醒
- 2026-01-03 (周六)：元旦（休），is_holiday=1 → ✅ 不发送提醒
- 2026-01-04 (周日)：元旦（班），is_holiday=0 → ✅ 发送提醒（调休补班）

---

## [1.3.5] - 2025-12-15

### Fixed
- **窗口开始时重复提醒问题修复**：解决在通知窗口开放时发送汇总消息后，仍然对所有空闲插座发送单独提醒的问题
  - 问题场景：09:00 窗口开始发送"🔔充电桩小助手开始上班啦！当前还剩 19 个空闲充电桩"，但 09:04 再次为这 19 个插座发送单独的"已经空闲X分钟"提醒
  - 问题根因：窗口开始发送汇总消息后，未在 `idle_alert_logs` 表中为空闲插座创建"已提醒"标记，导致去重检查失效
  - 修复方案：在窗口开始发送汇总消息后，为所有当前空闲的插座创建已提醒标记
  - 工作机制：
    - 窗口开始时发送汇总消息，同时为所有空闲插座创建 `idle_alert_logs` 记录
    - 后续检测到这些插座时，因为找到已提醒记录而跳过发送
    - 只有插座从"空闲"→"占用"→"空闲"后，`idle_start_time` 改变，才会触发新的提醒
  - 影响范围：仅影响窗口开始时间，窗口结束时间不受影响

### Added
- **窗口开始标记功能**：新增 `markSocketsAsNotified()` 函数，为窗口开始时的空闲插座批量创建已提醒标记

### Technical Details
- 修改文件：
  - `idle-alert/service.ts`:
    - 新增 `markSocketsAsNotified()` 函数（第 503-564 行）：批量创建已提醒标记
    - 修改 `runIdleAlertFlow()` 函数（第 242-253 行）：在窗口开始时调用标记函数
  - `package.json`: 版本号更新至 1.3.5
- 标记特征：
  - 使用特殊 `webhook_url` 标识：`summary_window_start`
  - 设置 `success = 1` 和 `lark_success = 1`，表示已成功提醒
  - 基于 `idle_start_time` 去重，确保插座状态变化后能重新提醒

---

## [1.3.4] - 2025-12-09

### Fixed
- **汇总消息重复发送问题修复**：解决上班/下班汇总消息在短时间内重复发送 2-3 次的问题
  - 问题原因：`isExactTime()` 函数使用 ±1 分钟容差，导致在 08:59、09:00、09:01 三个时间点都可能触发发送，且没有去重机制
  - 修复方案：实现基于数据库的去重机制，检查最近 5 分钟内是否已发送过相同类型的消息
  - 实现方式：
    - 新增 `idle_alert_summary_logs` 表记录所有汇总消息发送历史
    - 新增 `hasRecentSummaryMessage()` 函数在发送前检查去重
    - 新增 `recordSummaryMessage()` 函数在发送后记录历史
  - 优势：数据库持久化、容错性好、支持多实例并发、完整审计记录

### Added
- **汇总消息去重功能文档**：新增 `docs/summary-message-dedup.md` 详细设计文档
  - 包含问题背景分析、解决方案设计、技术实现细节
  - 提供工作流程示例、监控日志、测试验证方法
  - 包含常见问题 FAQ 和相关文件索引

### Technical Details
- 新增文件：
  - `migrations/0004_summary-message-dedup.sql`: 创建汇总消息日志表和索引
  - `docs/summary-message-dedup.md`: 功能设计文档（约 500+ 行）
- 修改文件：
  - `idle-alert/service.ts`:
    - 新增 `hasRecentSummaryMessage()` 函数（第 639-677 行）：去重检查
    - 新增 `recordSummaryMessage()` 函数（第 692-750 行）：记录发送历史
    - 修改 `runIdleAlertFlow()` 函数（第 160-240 行）：集成去重逻辑
  - `package.json`: 版本号更新至 1.3.4

### Database Changes
- 新增表：`idle_alert_summary_logs`
  - 记录字段：消息类型、插座数量、发送时间、飞书结果、Webhook 状态
  - 索引：`idx_summary_logs_type_time`（消息类型 + 发送时间）
  - 索引：`idx_summary_logs_sent_at`（发送时间，用于清理旧数据）

---

## [1.3.3] - 2025-12-08

### Fixed
- **空闲提醒去重逻辑缺陷修复**：修复当 Webhook 失败但飞书成功时，导致重复发送飞书提醒的问题
  - 问题原因：ntfy.sh 免费配额用尽导致 Webhook 持续失败（HTTP 429），去重逻辑仅检查 Webhook 成功状态
  - 修复方案：去重检查改为「Webhook 或飞书任一成功即视为提醒成功」
  - 影响范围：避免在 Webhook 服务不可用时产生大量重复飞书消息

### Technical Details
- 修改文件：
  - `idle-alert/idle-detector.ts`:
    - 修改去重 SQL 查询条件：`AND success = 1` → `AND (success = 1 OR lark_success = 1)`
    - 更新去重逻辑注释说明

---

## [1.3.2] - 2025-11-18

### Added
- **前端版本号显示**：在前端页面底部添加版本号显示
  - 以浅灰色小字显示在页面底部
  - 不显眼的设计，不影响用户体验
  - 版本号会随 package.json 同步更新

### Technical Details
- 修改文件：
  - `public/index.html`:
    - 新增 `.version` 样式类（11px 小字，浅灰色）
    - 在页面底部添加版本号显示元素

---

## [1.3.1] - 2025-11-18

### Fixed
- **空闲提醒窗口汇总消息优化**：解决窗口时间附近的消息重复和冲突问题
  - 修复窗口结束时同时发送汇总消息和单条消息的问题
  - 修复容差过大导致汇总消息重复发送的问题（08:00 和 08:02 各发送一次）
  - 新增窗口边界冷静期机制（±3分钟），避免汇总消息和单条消息冲突

### Changed
- **窗口汇总策略调整**：
  - 窗口开始时（如 08:00）：只发送汇总消息，不发送单条消息 ✅
  - 窗口结束时（如 17:00）：只发送汇总消息，不发送单条消息 ✅（**新增**）
  - 窗口内其他时间：正常发送单条空闲提醒 ✅

- **双重去重机制**：
  - **汇总消息去重**：时间容差保持 ±1 分钟，确保汇总消息只发送一次
  - **单条消息抑制**：窗口边界冷静期 ±3 分钟，在窗口开始/结束附近跳过单条提醒

### Technical Details
- 修改文件：
  - `idle-alert/service.ts`:
    - 新增 `isNearWindowBoundary()` 函数：判断是否在窗口边界冷静期内
    - 修改窗口结束时的逻辑：发送汇总后直接返回，不再继续发送单条消息
    - 在单条消息发送前增加冷静期检查，避免与汇总消息冲突
  - `docs/idle-alert-window-summary.md`:
    - 更新去重策略说明（双重机制）
    - 更新执行流程图
    - 更新测试场景和验证方法

### 执行时间线示例
```
08:00 → 发送汇总消息："充电桩小助手开始上班啦！" ✅
08:02 → 跳过（在冷静期内）✅
08:04 → 恢复正常单条提醒 ✅
10:00 → 正常单条提醒 ✅
17:00 → 发送汇总消息："充电桩小助手下班啦！" ✅
17:02 → 跳过（在冷静期内）✅
```

---

## [1.3.0] - 2025-11-17

### Added
- **窗口汇总消息功能**：优化空闲提醒体验，解决时间窗口开始时的消息轰炸问题
  - 新增 `getAllAvailableSockets()` 函数：查询所有空闲插座（不考虑阈值）
  - 新增 `isExactTime()` 函数：精确判断窗口开始/结束时间（±1分钟容差）
  - 新增 `sendSummaryWebhook()` 函数：发送汇总 Webhook 消息
  - 新增 `sendSummaryToLark()` 函数：发送汇总飞书消息

- **窗口开始汇总**（如 08:00）：
  - 飞书消息：`🔔充电桩小助手开始上班啦！当前还剩 x 个空闲充电桩，有需要的小伙伴快去充电哟~`
  - Webhook 消息：包含所有空闲插座的详细列表
  - 发送汇总后跳过单条提醒，避免消息轰炸

- **窗口结束汇总**（如 17:00）：
  - 飞书消息：`🥳充电桩小助手下班啦，当前共有 x 个空闲充电桩，有需要的小伙伴快去充电吧！`
  - Webhook 消息：包含所有空闲插座的详细列表
  - 发送汇总后继续执行单条提醒

### Changed
- **主流程优化**：
  - `runIdleAlertFlow()` 增加窗口开始/结束时间检测
  - 窗口内其他时间保持原有单条提醒逻辑不变

- **Webhook Payload 扩展**：
  - 新增 `SummaryWebhookPayload` 接口
  - 支持 `window_start` 和 `window_end` 两种新的 `alertType`
  - 提供 `totalAvailableSockets` 快速统计字段
  - 提供 `sockets` 数组包含所有空闲插座详情

### Documentation
- 新增 [窗口汇总功能文档](./docs/idle-alert-window-summary.md)
  - 详细的问题背景和优化目标
  - 完整的实现方案和技术细节
  - 测试方法和验证步骤
  - Before/After 效果对比

### Technical Details
- 修改文件：
  - `idle-alert/idle-detector.ts`: 新增 `getAllAvailableSockets()` 函数
  - `idle-alert/service.ts`: 新增 `isExactTime()` 函数，改造主流程
  - `idle-alert/alert-sender.ts`: 新增 `SummaryWebhookPayload` 接口和 `sendSummaryWebhook()` 函数
  - `idle-alert/lark-sender.ts`: 新增 `sendSummaryToLark()` 函数
  - `docs/idle-alert-window-summary.md`: 新增窗口汇总功能文档

### Performance
- **消息数量优化**：时间窗口开始时，从发送 N 条单条提醒减少到 1 条汇总消息
- **用户体验提升**：消除消息轰炸，提供友好的汇总提示
- **信息完整性保证**：Webhook 中仍包含所有插座的详细信息，不丢失任何数据

## [1.2.0] - 2025-11-13

### Added
- **飞书消息集成**：空闲提醒功能新增飞书消息发送支持
  - 新增 `idle-alert/lark-sender.ts` 模块，实现飞书消息发送
  - 支持向飞书群组发送空闲提醒消息
  - 消息使用固定模板：`x号充电桩y号插座已经空闲z分钟啦`
  - 飞书消息与 Webhook 并行发送，互不影响
  - 完整的发送日志记录和错误处理

### Changed
- **数据库结构变更**：
  - `idle_alert_config` 表新增字段：`lark_enabled`、`lark_auth_token`、`lark_chat_id`
  - `idle_alert_logs` 表新增字段：`lark_message_id`、`lark_success`、`lark_error_message`、`lark_response_time_ms`
  - 应用数据库迁移脚本 `0003_add-lark-support.sql`

- **API 更新**：
  - 配置查询接口返回飞书相关字段
  - 配置更新接口支持飞书配置参数
  - 日志查询接口返回飞书发送结果

- **服务层优化**：
  - `idle-alert/service.ts` 集成飞书消息发送流程
  - `idle-alert/config.ts` 扩展配置接口支持飞书字段

### Documentation
- 新增 [飞书消息集成文档](./docs/lark-integration.md)
  - 详细的功能特性和架构设计说明
  - 完整的 API 使用示例和错误处理说明
  - 性能考虑、安全性和监控建议
- 更新 [API 文档](./API.md)，添加飞书配置和日志字段说明
- 更新 [README](./README.md)，完善项目结构和功能特性说明

### Technical Details
- 修改文件：
  - `idle-alert/lark-sender.ts`: 新增飞书消息发送模块
  - `idle-alert/config.ts`: 扩展配置接口，新增飞书相关字段
  - `idle-alert/service.ts`: 集成飞书消息发送到空闲提醒流程
  - `migrations/0003_add-lark-support.sql`: 数据库迁移脚本
  - `API.md`: 更新 API 文档
  - `README.md`: 更新项目文档
  - `docs/lark-integration.md`: 新增飞书集成文档

## [1.1.0] - 2025-11-13

### Fixed
- **时区问题修复**：修复了事件查询和显示的时区问题
  - 查询逻辑：修正了日期查询的时间范围计算，从 UTC 时区改为北京时区（UTC+8）
  - 时间存储：`getTimeString()` 和 `getDateString()` 函数现在返回北京时间而不是 UTC 时间
  - 历史数据兼容：查询 API 动态修正历史数据的 `timeString` 字段，确保返回北京时间
  - 前端显示：简化了时间格式化逻辑，直接使用北京时间字符串

### Changed
- 事件查询现在能够返回完整的 00:00-24:00 时间范围内的数据（之前只能从 08:00 开始）
- 所有时间相关的显示统一使用北京时间（Asia/Shanghai）

### Technical Details
- 修改文件：
  - `d1-storage.ts`: 修正了 `getEventsD1()`, `getEventsInRangeD1()`, `getStatisticsD1()` 的时间范围计算
  - `status-tracker.ts`: 修正了 `getTimeString()` 和 `getDateString()` 的时区处理
  - `worker.ts`: 在 `/events` API 中动态修正历史数据的时间字符串
  - `public/index.html`: 简化了前端时间格式化逻辑

## [1.0.0] - 2025-10-12

### Added
- 初始版本发布
- 充电桩状态监控功能
  - 支持 3 个充电桩的实时状态查询
  - 每分钟自动抓取充电桩状态
  - 状态变化事件记录和查询
- 空闲提醒功能
  - 可配置的空闲时长阈值
  - 可配置的时间窗口和工作日判断
  - Webhook 通知支持
  - 提醒日志和统计功能
- 数据存储
  - 使用 Cloudflare D1 数据库存储事件和配置
  - 使用 Cloudflare KV 作为备份存储
- Web 界面
  - 充电桩状态实时显示
  - 状态变化事件查询
  - 空闲提醒配置管理
  - 统计数据展示

[1.4.3]: https://github.com/hansnow/gaotu-electric-bike-charging-pile/compare/v1.4.2...v1.4.3
[1.4.2]: https://github.com/hansnow/gaotu-electric-bike-charging-pile/compare/v1.4.1...v1.4.2
[1.4.1]: https://github.com/hansnow/gaotu-electric-bike-charging-pile/compare/v1.4.0...v1.4.1
[1.4.0]: https://github.com/hansnow/gaotu-electric-bike-charging-pile/compare/v1.3.5...v1.4.0
[1.3.5]: https://github.com/hansnow/gaotu-electric-bike-charging-pile/compare/v1.3.4...v1.3.5
[1.3.4]: https://github.com/hansnow/gaotu-electric-bike-charging-pile/compare/v1.3.3...v1.3.4
[1.3.3]: https://github.com/hansnow/gaotu-electric-bike-charging-pile/compare/v1.3.2...v1.3.3
[1.3.2]: https://github.com/hansnow/gaotu-electric-bike-charging-pile/compare/v1.3.1...v1.3.2
[1.3.1]: https://github.com/hansnow/gaotu-electric-bike-charging-pile/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/hansnow/gaotu-electric-bike-charging-pile/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/hansnow/gaotu-electric-bike-charging-pile/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/hansnow/gaotu-electric-bike-charging-pile/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/hansnow/gaotu-electric-bike-charging-pile/releases/tag/v1.0.0
