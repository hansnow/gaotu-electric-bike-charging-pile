# 空闲提醒模块

**生成时间:** 2026-01-12
**提交:** 868d388
**分支:** master

## 概述
空闲提醒子系统，负责判定插座空闲并发送 Webhook/飞书通知，具备节假日与时间窗口感知。

## 位置索引
| 任务 | 位置 | 备注 |
|------|------|------|
| 编排入口 | `idle-alert/service.ts` | 由 `worker.ts` 调用 |
| 配置加载 | `idle-alert/config.ts` | D1 配置优先于环境默认值 |
| 空闲周期检测 | `idle-alert/idle-detector.ts` | 每个插座空闲周期 ID |
| 节假日/工作日判断 | `idle-alert/holiday-checker.ts` | iCalendar 解析与工作日逻辑 |
| Webhook 发送 | `idle-alert/alert-sender.ts` | 重试与 payload 组装 |
| 飞书发送 | `idle-alert/lark-sender.ts` | Feishu 集成 |

## 约定
- 空闲周期 ID 使用 `{stationId}-{socketId}-{startTimestamp}` 去重。
- 窗口汇总消息可能在窗口边界抑制单条提醒。
- 节假日判断不把节气视为假期。
- 配置优先级：D1 > `wrangler.toml` 默认值。

## 禁止事项
- 不得对同一空闲周期重复发送提醒。
- 不得绕过节假日/时间窗口校验直接发送。
- 不得在发送副作用时缺少 D1 日志记录。
