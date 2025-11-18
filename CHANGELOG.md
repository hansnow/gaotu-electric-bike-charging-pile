# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.3.1]: https://github.com/hansnow/gaotu-electric-bike-charging-pile/compare/v1.3.0...v1.3.1
[1.3.0]: https://github.com/hansnow/gaotu-electric-bike-charging-pile/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/hansnow/gaotu-electric-bike-charging-pile/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/hansnow/gaotu-electric-bike-charging-pile/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/hansnow/gaotu-electric-bike-charging-pile/releases/tag/v1.0.0
