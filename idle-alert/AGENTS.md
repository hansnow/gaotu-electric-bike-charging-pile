# 空闲提醒模块

**Generated:** 2026-01-14 17:15:07 CST
**Commit:** 0012adc
**Branch:** master

## OVERVIEW
负责判定插座空闲并发送 Webhook 与飞书通知，具备节假日感知与时间窗口控制功能的子系统。

## WHERE TO LOOK
| 任务 | 位置 | 备注 |
|------|------|------|
| 编排入口 | `idle-alert/service.ts` | 由 `worker.ts` 调度 |
| 配置加载 | `idle-alert/config.ts` | D1 配置优先于环境默认值 |
| 空闲周期检测 | `idle-alert/idle-detector.ts` | 生成空闲周期 ID 并去重 |
| 节假日/工作日判断 | `idle-alert/holiday-checker.ts` | iCalendar 解析 |
| Webhook 发送 | `idle-alert/alert-sender.ts` | Payload 组装 + 重试 + D1 日志 |
| 飞书发送 | `idle-alert/lark-sender.ts` | 飞书消息发送与记录 |

## CONVENTIONS
- 空闲周期 ID 格式：`{stationId}-{socketId}-{startTimestamp}`，每周期仅允许发送一次提醒。
- 配置优先级：D1 > `wrangler.toml` 环境默认值。
- 窗口汇总：窗口开始发送汇总并抑制单条提醒，窗口结束发送汇总并恢复单条提醒。
- 节假日识别以 iCalendar 为准，节气不算假期。

## ANTI-PATTERNS
- 同一空闲周期重复发送提醒。
- 绕过节假日/时间窗口校验直接发送。
- 发送外部通知但不写 D1 日志。
- 在代码中硬编码配置值。
