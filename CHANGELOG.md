# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[1.2.0]: https://github.com/hansnow/gaotu-electric-bike-charging-pile/compare/v1.1.0...v1.2.0
[1.1.0]: https://github.com/hansnow/gaotu-electric-bike-charging-pile/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/hansnow/gaotu-electric-bike-charging-pile/releases/tag/v1.0.0
