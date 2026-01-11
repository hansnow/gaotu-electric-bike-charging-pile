/**
 * 空闲提醒服务整合层
 *
 * @remarks
 * 整合配置管理、节假日判定、空闲检测、Webhook 发送等模块，
 * 提供统一的服务接口供 scheduled() 和 API 调用
 */

import { loadConfig, type IdleAlertConfig, type IdleAlertEnv } from './config';
import { createHolidayChecker } from './holiday-checker';
import {
  detectIdleSockets,
  getAllAvailableSockets,
  type IdleSocket,
} from './idle-detector';
import {
  sendToAll,
  sendSummaryWebhook,
  type SendResult,
  type WebhookPayload,
  type SummaryWebhookPayload,
} from './alert-sender';
import {
  sendLarkMessage,
  sendSummaryToLark,
  sendBatchAggregatedLarkMessage,
  type LarkSendResult,
  type LarkConfig,
  type BatchAggregatedMessageContent,
} from './lark-sender';

/**
 * 空闲提醒流程执行结果
 */
export interface IdleAlertFlowResult {
  /** 是否执行成功 */
  success: boolean;
  /** 执行时间 */
  executedAt: number;
  /** 是否在时间窗口内 */
  inTimeWindow: boolean;
  /** 是否为工作日 */
  isWorkday: boolean;
  /** 检测到的空闲插座数量 */
  idleSocketCount: number;
  /** 发送的提醒数量 */
  sentAlertCount: number;
  /** 成功的提醒数量 */
  successAlertCount: number;
  /** 失败的提醒数量 */
  failedAlertCount: number;
  /** 错误信息 */
  error?: string;
}

/**
 * 运行空闲提醒流程
 *
 * @param env 环境变量
 * @param ctx 执行上下文（保留以兼容现有调用，但不再使用）
 * @param now 当前时间（可注入用于测试）
 * @returns 执行结果
 *
 * @remarks
 * 执行流程：
 * 1. 加载配置
 * 2. 判断是否启用
 * 3. 判断是否在时间窗口内
 * 4. 判断是否为工作日
 * 5. 检测空闲插座
 * 6. 发送 Webhook 和飞书消息
 * 7. 同步保存日志（确保去重有效，防止并发执行时重复发送）
 */
export async function runIdleAlertFlow(
  env: IdleAlertEnv,
  ctx?: ExecutionContext,
  now: Date = new Date()
): Promise<IdleAlertFlowResult> {
  const executedAt = Math.floor(now.getTime() / 1000);

  try {
    console.log('[IDLE_ALERT] ===== 开始空闲提醒流程 =====');

    // 1. 加载配置
    const config = await loadConfig(env.DB, env);

    // 2. 判断是否启用
    if (!config.enabled) {
      console.log('[IDLE_ALERT] 空闲提醒功能已禁用');
      return {
        success: true,
        executedAt,
        inTimeWindow: false,
        isWorkday: false,
        idleSocketCount: 0,
        sentAlertCount: 0,
        successAlertCount: 0,
        failedAlertCount: 0,
      };
    }

    // 3. 判断是否在时间窗口内
    const bjTime = getBeijingTime(now);
    const inTimeWindow = isInTimeRange(
      bjTime.timeHHmm,
      config.time_range_start,
      config.time_range_end
    );

    if (!inTimeWindow) {
      console.log(
        `[IDLE_ALERT] 不在时间窗口内 (当前: ${bjTime.timeHHmm}, 窗口: ${config.time_range_start}-${config.time_range_end})`
      );
      return {
        success: true,
        executedAt,
        inTimeWindow: false,
        isWorkday: false,
        idleSocketCount: 0,
        sentAlertCount: 0,
        successAlertCount: 0,
        failedAlertCount: 0,
      };
    }

    console.log(
      `[IDLE_ALERT] 在时间窗口内 (当前: ${bjTime.timeHHmm}, 窗口: ${config.time_range_start}-${config.time_range_end})`
    );

    // 4. 判断是否为工作日（提前检查，避免在非工作日发送窗口汇总消息）
    const holidayChecker = createHolidayChecker(env.DB);
    const isWorkday = await holidayChecker.isWorkday(now);

    if (!isWorkday) {
      console.log('[IDLE_ALERT] 今天是非工作日，跳过提醒');
      return {
        success: true,
        executedAt,
        inTimeWindow: true,
        isWorkday: false,
        idleSocketCount: 0,
        sentAlertCount: 0,
        successAlertCount: 0,
        failedAlertCount: 0,
      };
    }

    console.log('[IDLE_ALERT] 今天是工作日');

    // 3.5. 判断是否是窗口开始/结束的精确时间点
    const isWindowStart = isExactTime(bjTime.timeHHmm, config.time_range_start);
    const isWindowEnd = isExactTime(bjTime.timeHHmm, config.time_range_end);

    // 如果是窗口开始或结束时间，发送汇总消息
    if (isWindowStart || isWindowEnd) {
      console.log(
        `[IDLE_ALERT] 检测到时间窗口${isWindowStart ? '开始' : '结束'}时间，准备发送汇总消息`
      );

      const messageType = isWindowStart ? 'window_start' : 'window_end';

      // 【去重检查】检查最近5分钟内是否已发送过相同类型的消息
      const hasDuplicate = await hasRecentSummaryMessage(env.DB, messageType, 5);
      if (hasDuplicate) {
        console.log(
          `[IDLE_ALERT] 跳过重复发送：最近5分钟内已发送过 ${messageType} 消息`
        );
        return {
          success: true,
          executedAt,
          inTimeWindow: true,
          isWorkday: true,
          idleSocketCount: 0,
          sentAlertCount: 0,
          successAlertCount: 0,
          failedAlertCount: 0,
        };
      }

      // 获取所有空闲插座（不考虑阈值）
      const allAvailableSockets = await getAllAvailableSockets(env.DB, config, now);
      const socketCount = allAvailableSockets.length;

      console.log(`[IDLE_ALERT] 当前共有 ${socketCount} 个空闲插座`);

      // 解析 Webhook URLs
      let webhookUrls: string[] = [];
      try {
        webhookUrls = JSON.parse(config.webhook_urls);
      } catch (error) {
        console.error('[IDLE_ALERT] Webhook URLs 配置无效:', error);
      }

      // 构建飞书配置
      const larkConfig: LarkConfig = {
        enabled: config.lark_enabled === 1,
        authToken: config.lark_auth_token || '',
        chatId: config.lark_chat_id || undefined,
      };

      // 发送飞书汇总消息
      let larkResult: LarkSendResult | undefined;
      if (larkConfig.enabled) {
        larkResult = await sendSummaryToLark(larkConfig, socketCount, messageType);
      }

      // 发送 Webhook 汇总消息
      if (webhookUrls.length > 0) {
        const summaryPayload: SummaryWebhookPayload = {
          alertType: messageType,
          timestamp: Math.floor(Date.now() / 1000),
          timeString: bjTime.timeString,
          totalAvailableSockets: socketCount,
          sockets: allAvailableSockets.map((s) => ({
            stationId: s.stationId,
            stationName: s.stationName,
            socketId: s.socketId,
            idleMinutes: s.idleMinutes,
            idleStartTime: Math.floor(s.idleStartTime / 1000),
            status: 'available',
          })),
          config: {
            threshold: config.idle_threshold_minutes,
            timeRange: `${config.time_range_start}-${config.time_range_end}`,
          },
        };

        await sendSummaryWebhook(webhookUrls, summaryPayload, {
          retryTimes: config.retry_times,
          retryIntervalSeconds: config.retry_interval_seconds,
        });
      }

      // 【记录发送历史】无论成功失败都记录，用于去重
      await recordSummaryMessage(
        env.DB,
        messageType,
        socketCount,
        bjTime.timeHHmm,
        larkResult,
        webhookUrls.length > 0
      );

      // 【窗口开始时】为所有空闲插座创建"已提醒"标记，避免后续再次单独提醒
      if (isWindowStart) {
        await markSocketsAsNotified(
          env.DB,
          allAvailableSockets,
          bjTime,
          messageType
        );
        console.log(
          `[IDLE_ALERT] 已为窗口开始时的 ${allAvailableSockets.length} 个空闲插座创建已提醒标记`
        );
      }

      // 窗口开始或结束时间，发送汇总后直接返回，不发送单条提醒
      const windowType = isWindowStart ? '开始' : '结束';
      console.log(`[IDLE_ALERT] 窗口${windowType}时间，跳过单条提醒，流程结束`);
      return {
        success: true,
        executedAt,
        inTimeWindow: true,
        isWorkday: true,
        idleSocketCount: socketCount,
        sentAlertCount: 0,
        successAlertCount: 0,
        failedAlertCount: 0,
      };
    }

    // 4.5. 检查是否在窗口边界冷静期内
    // 如果在窗口开始/结束附近（±3分钟），跳过单条提醒，避免与汇总消息冲突
    if (
      isNearWindowBoundary(
        bjTime.timeHHmm,
        config.time_range_start,
        config.time_range_end
      )
    ) {
      console.log(
        '[IDLE_ALERT] 当前时间在窗口边界冷静期内，跳过单条提醒，流程结束'
      );
      return {
        success: true,
        executedAt,
        inTimeWindow: true,
        isWorkday: true,
        idleSocketCount: 0,
        sentAlertCount: 0,
        successAlertCount: 0,
        failedAlertCount: 0,
      };
    }

    // 5. 检测空闲插座
    const idleSockets = await detectIdleSockets(env.DB, config, now);

    if (idleSockets.length === 0) {
      console.log('[IDLE_ALERT] 没有需要提醒的空闲插座');
      return {
        success: true,
        executedAt,
        inTimeWindow: true,
        isWorkday: true,
        idleSocketCount: 0,
        sentAlertCount: 0,
        successAlertCount: 0,
        failedAlertCount: 0,
      };
    }

    console.log(`[IDLE_ALERT] 找到 ${idleSockets.length} 个需要提醒的空闲插座`);

    // 6. 解析 Webhook URLs
    let webhookUrls: string[];
    try {
      webhookUrls = JSON.parse(config.webhook_urls);
      if (!Array.isArray(webhookUrls) || webhookUrls.length === 0) {
        throw new Error('Webhook URLs 为空');
      }
    } catch (error) {
      console.error('[IDLE_ALERT] Webhook URLs 配置无效:', error);
      return {
        success: false,
        executedAt,
        inTimeWindow: true,
        isWorkday: true,
        idleSocketCount: idleSockets.length,
        sentAlertCount: 0,
        successAlertCount: 0,
        failedAlertCount: 0,
        error: 'Webhook URLs 配置无效',
      };
    }

    // 7. 为每个空闲插座发送 Webhook 和飞书消息
    let totalSent = 0;
    let totalSuccess = 0;
    let totalFailed = 0;

    // 构建飞书配置
    const larkConfig: LarkConfig = {
      enabled: config.lark_enabled === 1,
      authToken: config.lark_auth_token || '',
      chatId: config.lark_chat_id || undefined,
    };

    // 7.1. 判断是否使用批量聚合消息（当同一分钟内有多个插座需要提醒时）
    const useBatchAggregation = idleSockets.length >= 2;
    let batchLarkResult: LarkSendResult | undefined;

    if (useBatchAggregation && larkConfig.enabled) {
      console.log(
        `[IDLE_ALERT] 检测到 ${idleSockets.length} 个插座需要提醒，使用批量聚合消息`
      );

      // 按充电桩分组插座
      const socketsByStation = new Map<
        number,
        { stationName: string; socketIds: number[] }
      >();

      for (const socket of idleSockets) {
        if (!socketsByStation.has(socket.stationId)) {
          socketsByStation.set(socket.stationId, {
            stationName: socket.stationName,
            socketIds: [],
          });
        }
        socketsByStation.get(socket.stationId)!.socketIds.push(socket.socketId);
      }

      // 构建批量聚合消息内容
      const batchContent: BatchAggregatedMessageContent = {
        totalCount: idleSockets.length,
        thresholdMinutes: config.idle_threshold_minutes,
        socketsByStation: Array.from(socketsByStation.entries()).map(
          ([stationId, data]) => ({
            stationId,
            stationName: data.stationName,
            socketIds: data.socketIds,
          })
        ),
      };

      // 发送批量聚合飞书消息
      batchLarkResult = await sendBatchAggregatedLarkMessage(larkConfig, batchContent);
      console.log(
        `[IDLE_ALERT] 批量聚合飞书消息发送${batchLarkResult.success ? '成功' : '失败'}，` +
          `涵盖 ${idleSockets.length} 个插座`
      );
    }

    // 7.2. 为每个插座发送 Webhook 并保存日志
    for (const socket of idleSockets) {
      console.log(
        `[IDLE_ALERT] 开始处理插座: ${socket.stationName} 插座 ${socket.socketId}，` +
          `空闲时长 ${socket.idleMinutes} 分钟，` +
          `空闲开始时间 ${new Date(socket.idleStartTime).toISOString()}`
      );

      // 构建 Webhook Payload
      const payload = buildWebhookPayload(socket, config, bjTime);

      // 发送到所有 Webhook URLs
      const results = await sendToAll(webhookUrls, payload, {
        retryTimes: config.retry_times,
        retryIntervalSeconds: config.retry_interval_seconds,
      });

      totalSent += results.length;
      totalSuccess += results.filter((r) => r.success).length;
      totalFailed += results.filter((r) => !r.success).length;

      // 单条消息模式：为每个插座单独发送飞书消息
      let larkResult: LarkSendResult | undefined;
      if (!useBatchAggregation && larkConfig.enabled) {
        larkResult = await sendLarkMessage(larkConfig, {
          stationId: socket.stationId,
          stationName: socket.stationName,
          socketId: socket.socketId,
          idleMinutes: socket.idleMinutes,
        });

        console.log(
          `[IDLE_ALERT] 飞书消息发送${larkResult.success ? '成功' : '失败'}: ${socket.stationName} 插座 ${socket.socketId}`
        );
      } else if (useBatchAggregation) {
        // 批量聚合模式：使用批量消息的结果
        larkResult = batchLarkResult;
      }

      // 8. 保存日志（同步执行，确保去重查询有效，避免并发执行时重复发送）
      await saveLogs(env.DB, socket, results, bjTime, larkResult);
      console.log(
        `[IDLE_ALERT] 日志保存完成: ${socket.stationName} 插座 ${socket.socketId}，` +
          `idle_start_time=${Math.floor(socket.idleStartTime / 1000)}`
      );
    }

    console.log(
      `[IDLE_ALERT] ===== 空闲提醒流程完成 (发送: ${totalSent}, 成功: ${totalSuccess}, 失败: ${totalFailed}) =====`
    );

    return {
      success: true,
      executedAt,
      inTimeWindow: true,
      isWorkday: true,
      idleSocketCount: idleSockets.length,
      sentAlertCount: totalSent,
      successAlertCount: totalSuccess,
      failedAlertCount: totalFailed,
    };
  } catch (error) {
    console.error('[IDLE_ALERT] 空闲提醒流程异常:', error);
    return {
      success: false,
      executedAt,
      inTimeWindow: false,
      isWorkday: false,
      idleSocketCount: 0,
      sentAlertCount: 0,
      successAlertCount: 0,
      failedAlertCount: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * 构建 Webhook Payload
 */
function buildWebhookPayload(
  socket: IdleSocket,
  config: IdleAlertConfig,
  bjTime: BeijingTime
): WebhookPayload {
  return {
    alertType: 'socket_idle',
    timestamp: Math.floor(Date.now() / 1000),
    timeString: bjTime.timeString,
    station: {
      id: socket.stationId,
      name: socket.stationName,
    },
    socket: {
      id: socket.socketId,
      status: 'available',
      idleMinutes: socket.idleMinutes,
      idleStartTime: Math.floor(socket.idleStartTime / 1000),
      idleStartTimeString: formatBeijingTimestamp(socket.idleStartTime),
    },
    config: {
      threshold: config.idle_threshold_minutes,
      timeRange: `${config.time_range_start}-${config.time_range_end}`,
    },
  };
}

/**
 * 保存提醒日志到数据库
 */
async function saveLogs(
  db: D1Database,
  socket: IdleSocket,
  results: SendResult[],
  bjTime: BeijingTime,
  larkResult?: LarkSendResult
): Promise<void> {
  try {
    const triggeredAt = Math.floor(Date.now() / 1000);

    // 为每个 Webhook URL 创建一条日志
    const statements = results.map((result) => {
      const logId = `${socket.stationId}-${socket.socketId}-${result.url}-${triggeredAt}`;

      return db
        .prepare(
          `INSERT INTO idle_alert_logs
          (id, station_id, station_name, socket_id, idle_minutes, idle_start_time,
           webhook_url, request_payload, response_status, response_body, response_time_ms,
           success, error_message, retry_count, triggered_at, sent_at, log_date,
           lark_message_id, lark_success, lark_error_message, lark_response_time_ms)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          logId,
          socket.stationId,
          socket.stationName,
          socket.socketId,
          socket.idleMinutes,
          Math.floor(socket.idleStartTime / 1000),
          result.url,
          '', // request_payload 暂时为空，避免存储过大数据
          result.status || null,
          result.body ? result.body.substring(0, 1024) : null,
          result.elapsedMs,
          result.success ? 1 : 0,
          result.error || null,
          result.retryCount,
          triggeredAt,
          triggeredAt,
          bjTime.dateString,
          larkResult?.messageId || null,
          larkResult ? (larkResult.success ? 1 : 0) : null,
          larkResult?.error || null,
          larkResult?.elapsedMs || null
        );
    });

    // 批量写入
    await db.batch(statements);

    console.log(`[IDLE_ALERT] 保存 ${results.length} 条提醒日志成功`);
  } catch (error) {
    console.error('[IDLE_ALERT] 保存提醒日志失败:', error);
    // 不抛出异常，避免影响主流程
  }
}

/**
 * 在窗口开始时为所有空闲插座创建"已提醒"标记
 *
 * @param db 数据库实例
 * @param sockets 需要标记的空闲插座列表
 * @param bjTime 北京时间信息
 * @param messageType 消息类型（window_start 或 window_end）
 *
 * @remarks
 * 这个函数在窗口开始发送汇总消息后调用，为所有已经空闲的插座创建标记
 * 避免后续时间点再次为这些插座发送单独提醒
 * 只有当插座从"空闲"变成"占用"再变回"空闲"时，才会触发新的提醒
 */
async function markSocketsAsNotified(
  db: D1Database,
  sockets: IdleSocket[],
  bjTime: BeijingTime,
  messageType: 'window_start' | 'window_end'
): Promise<void> {
  if (sockets.length === 0) {
    return;
  }

  try {
    const triggeredAt = Math.floor(Date.now() / 1000);

    // 为每个插座创建一条"已通过汇总消息提醒"的日志记录
    const statements = sockets.map((socket) => {
      const logId = `${socket.stationId}-${socket.socketId}-summary-${messageType}-${triggeredAt}`;

      return db
        .prepare(
          `INSERT INTO idle_alert_logs
          (id, station_id, station_name, socket_id, idle_minutes, idle_start_time,
           webhook_url, request_payload, response_status, response_body, response_time_ms,
           success, error_message, retry_count, triggered_at, sent_at, log_date,
           lark_message_id, lark_success, lark_error_message, lark_response_time_ms)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          logId,
          socket.stationId,
          socket.stationName,
          socket.socketId,
          socket.idleMinutes,
          Math.floor(socket.idleStartTime / 1000),
          `summary_${messageType}`, // 使用特殊标识表示这是汇总消息的标记
          '',
          null,
          null,
          null,
          1, // success = 1 表示已成功提醒（通过汇总消息）
          null,
          0,
          triggeredAt,
          triggeredAt,
          bjTime.dateString,
          null,
          1, // lark_success = 1 表示已成功提醒（通过汇总消息）
          null,
          null
        );
    });

    // 批量写入
    await db.batch(statements);

    console.log(
      `[IDLE_ALERT] 为 ${sockets.length} 个插座创建汇总消息提醒标记成功`
    );
  } catch (error) {
    console.error('[IDLE_ALERT] 创建汇总消息提醒标记失败:', error);
    // 不抛出异常，避免影响主流程
  }
}

/**
 * 北京时间信息接口
 */
interface BeijingTime {
  /** 日期字符串 YYYY-MM-DD */
  dateString: string;
  /** 时间字符串 YYYY-MM-DD HH:mm:ss */
  timeString: string;
  /** 时间 HH:mm */
  timeHHmm: string;
}

/**
 * 获取北京时间信息
 */
function getBeijingTime(date: Date): BeijingTime {
  const bjFormatter = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const parts = bjFormatter.formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value || '';
  const month = parts.find((p) => p.type === 'month')?.value || '';
  const day = parts.find((p) => p.type === 'day')?.value || '';
  const hour = parts.find((p) => p.type === 'hour')?.value || '';
  const minute = parts.find((p) => p.type === 'minute')?.value || '';
  const second = parts.find((p) => p.type === 'second')?.value || '';

  return {
    dateString: `${year}-${month}-${day}`,
    timeString: `${year}-${month}-${day} ${hour}:${minute}:${second}`,
    timeHHmm: `${hour}:${minute}`,
  };
}

/**
 * 格式化时间戳为北京时间字符串
 */
function formatBeijingTimestamp(timestamp: number): string {
  return getBeijingTime(new Date(timestamp)).timeString;
}

/**
 * 判断当前时间是否在时间窗口内
 *
 * @param currentHHmm 当前时间 HH:mm
 * @param start 开始时间 HH:mm
 * @param end 结束时间 HH:mm
 * @returns true=在窗口内，false=不在窗口内
 *
 * @remarks
 * 支持跨日时间段（例如 22:00-02:00）
 */
function isInTimeRange(currentHHmm: string, start: string, end: string): boolean {
  const current = timeToMinutes(currentHHmm);
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);

  if (startMin <= endMin) {
    // 不跨日：08:00-17:00
    return current >= startMin && current <= endMin;
  } else {
    // 跨日：22:00-02:00
    return current >= startMin || current <= endMin;
  }
}

/**
 * 将 HH:mm 转换为分钟数
 */
function timeToMinutes(timeHHmm: string): number {
  const [hour, minute] = timeHHmm.split(':').map(Number);
  return hour * 60 + minute;
}

/**
 * 判断当前时间是否在目标时间的容差范围内
 *
 * @param currentHHmm 当前时间 HH:mm
 * @param targetHHmm 目标时间 HH:mm
 * @param toleranceMinutes 容差分钟数（默认 1 分钟）
 * @returns true=在容差范围内，false=不在范围内
 *
 * @remarks
 * 例如：目标时间 08:00，容差 1 分钟
 * - 07:59 → true（在 08:00-1 范围内）
 * - 08:00 → true
 * - 08:01 → true（在 08:00+1 范围内）
 * - 08:02 → false
 *
 * 用于判断是否是窗口开始/结束的精确时间点，避免重复发送汇总消息
 */
function isExactTime(
  currentHHmm: string,
  targetHHmm: string,
  toleranceMinutes: number = 1
): boolean {
  const current = timeToMinutes(currentHHmm);
  const target = timeToMinutes(targetHHmm);

  // 计算差值（考虑跨日情况）
  let diff = Math.abs(current - target);

  // 跨日场景：例如 23:59 和 00:01 的差值应该是 2 分钟，而不是 1439 分钟
  if (diff > 720) {
    // 720 = 12 * 60（半天）
    diff = 1440 - diff; // 1440 = 24 * 60（一天）
  }

  return diff <= toleranceMinutes;
}

/**
 * 判断当前时间是否在窗口边界附近（冷静期）
 *
 * @param currentHHmm 当前时间 HH:mm
 * @param windowStart 窗口开始时间 HH:mm
 * @param windowEnd 窗口结束时间 HH:mm
 * @param cooldownMinutes 冷静期分钟数（默认 3 分钟）
 * @returns true=在冷静期内，false=不在冷静期内
 *
 * @remarks
 * 用于在窗口开始/结束附近跳过单条提醒，避免与汇总消息冲突。
 * 例如：窗口 08:00-17:00，冷静期 3 分钟
 * - 08:02 → true（距离窗口开始 2 分钟）→ 跳过单条提醒
 * - 08:04 → false（距离窗口开始 4 分钟）→ 正常发送单条提醒
 * - 17:02 → true（距离窗口结束 2 分钟）→ 跳过单条提醒
 */
function isNearWindowBoundary(
  currentHHmm: string,
  windowStart: string,
  windowEnd: string,
  cooldownMinutes: number = 3
): boolean {
  const current = timeToMinutes(currentHHmm);
  const start = timeToMinutes(windowStart);
  const end = timeToMinutes(windowEnd);

  // 检查是否接近窗口开始时间
  let diffFromStart = Math.abs(current - start);
  if (diffFromStart > 720) {
    diffFromStart = 1440 - diffFromStart;
  }
  if (diffFromStart <= cooldownMinutes) {
    return true;
  }

  // 检查是否接近窗口结束时间
  let diffFromEnd = Math.abs(current - end);
  if (diffFromEnd > 720) {
    diffFromEnd = 1440 - diffFromEnd;
  }
  if (diffFromEnd <= cooldownMinutes) {
    return true;
  }

  return false;
}

/**
 * 检查最近是否已发送过相同类型的汇总消息
 *
 * @param db 数据库实例
 * @param messageType 消息类型（'window_start' 或 'window_end'）
 * @param withinMinutes 时间范围（分钟），默认5分钟
 * @returns true=已发送过，false=未发送过
 *
 * @remarks
 * 用于防止汇总消息在短时间内重复发送
 * 检查逻辑：查询最近N分钟内是否有成功发送的相同类型消息
 */
async function hasRecentSummaryMessage(
  db: D1Database,
  messageType: 'window_start' | 'window_end',
  withinMinutes: number = 5
): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const thresholdTime = now - withinMinutes * 60;

  try {
    const result = await db
      .prepare(
        `
        SELECT id, sent_at, sent_time_str
        FROM idle_alert_summary_logs
        WHERE message_type = ?
          AND sent_at >= ?
          AND (lark_success = 1 OR webhook_success = 1)
        ORDER BY sent_at DESC
        LIMIT 1
      `
      )
      .bind(messageType, thresholdTime)
      .first();

    if (result) {
      console.log(
        `[IDLE_ALERT] 检测到重复：最近${withinMinutes}分钟内已发送过 ${messageType} 消息`,
        `(上次发送时间: ${result.sent_time_str}, ID: ${result.id})`
      );
      return true;
    }

    return false;
  } catch (error) {
    console.error('[IDLE_ALERT] 检查汇总消息去重失败:', error);
    // 出错时保守处理，允许发送
    return false;
  }
}

/**
 * 记录汇总消息发送历史
 *
 * @param db 数据库实例
 * @param messageType 消息类型
 * @param socketCount 空闲插座数量
 * @param sentTimeStr 发送时间字符串（HH:mm）
 * @param larkResult 飞书发送结果（可选）
 * @param webhookEnabled Webhook 是否启用
 *
 * @remarks
 * 记录每次汇总消息的发送情况，用于去重和审计
 */
async function recordSummaryMessage(
  db: D1Database,
  messageType: 'window_start' | 'window_end',
  socketCount: number,
  sentTimeStr: string,
  larkResult?: LarkSendResult,
  webhookEnabled: boolean = false
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();

  try {
    await db
      .prepare(
        `
        INSERT INTO idle_alert_summary_logs (
          id,
          message_type,
          socket_count,
          sent_at,
          sent_time_str,
          lark_enabled,
          lark_success,
          lark_message_id,
          lark_error_message,
          lark_response_time_ms,
          webhook_enabled,
          webhook_success,
          webhook_error_message,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      )
      .bind(
        id,
        messageType,
        socketCount,
        now,
        sentTimeStr,
        larkResult ? 1 : 0,
        larkResult?.success ? 1 : 0,
        larkResult?.messageId || null,
        larkResult?.error || null,
        larkResult?.elapsedMs || null,
        webhookEnabled ? 1 : 0,
        null, // webhook_success - 暂时不跟踪
        null, // webhook_error_message
        now
      )
      .run();

    console.log(
      `[IDLE_ALERT] 汇总消息发送记录已保存 (ID: ${id}, Type: ${messageType}, Time: ${sentTimeStr})`
    );
  } catch (error) {
    console.error('[IDLE_ALERT] 保存汇总消息记录失败:', error);
    // 记录失败不影响主流程
  }
}
