/**
 * 空闲检测模块
 *
 * @remarks
 * 负责检测哪些插座处于空闲状态超过阈值时间，并进行去重检查
 */

import type { IdleAlertConfig } from './config';

/**
 * 空闲插座信息接口
 */
export interface IdleSocket {
  /** 充电桩ID */
  stationId: number;
  /** 充电桩名称 */
  stationName: string;
  /** 插座ID */
  socketId: number;
  /** 空闲分钟数 */
  idleMinutes: number;
  /** 空闲开始时间（Unix 时间戳，毫秒） */
  idleStartTime: number;
}

/**
 * 检测空闲插座
 *
 * @param db D1 数据库实例
 * @param config 提醒配置
 * @param now 当前时间
 * @returns 需要提醒的空闲插座列表
 *
 * @remarks
 * 检测流程：
 * 1. 从 latest_status 读取所有充电桩状态
 * 2. 筛选 status === 'available' 的插座
 * 3. 查询每个插座最近一次变为 'available' 的事件时间（idle_start_time）
 * 4. 计算空闲时长，超过阈值的保留
 * 5. 如果配置了 enabled_station_ids，只保留指定充电桩
 * 6. 去重：查询 idle_alert_logs，如果本次空闲周期已成功提醒过则跳过
 *    - 去重基于 (station_id, socket_id, idle_start_time)
 *    - 如果插座中间被占用过，再次空闲时会产生新的 idle_start_time，会重新提醒
 */
export async function detectIdleSockets(
  db: D1Database,
  config: IdleAlertConfig,
  now: Date = new Date()
): Promise<IdleSocket[]> {
  try {
    console.log('[IDLE_ALERT] 开始检测空闲插座');

    // 1. 读取所有充电桩的最新状态
    const statusResult = await db
      .prepare('SELECT * FROM latest_status WHERE online = 1')
      .all();

    if (!statusResult.results || statusResult.results.length === 0) {
      console.log('[IDLE_ALERT] 没有在线的充电桩');
      return [];
    }

    console.log(`[IDLE_ALERT] 找到 ${statusResult.results.length} 个在线充电桩`);

    const idleSockets: IdleSocket[] = [];

    // 2. 遍历每个充电桩，检测空闲插座
    for (const row of statusResult.results) {
      const stationId = row.station_id as number;
      const stationName = row.station_name as string;
      const socketsJson = row.sockets as string;

      // 解析 sockets JSON
      let sockets: Array<{ id: number; status: string }>;
      try {
        sockets = JSON.parse(socketsJson);
      } catch (e) {
        console.error(`[IDLE_ALERT] 解析充电桩 ${stationId} 的 sockets 失败:`, e);
        continue;
      }

      // 3. 筛选空闲插座
      const availableSockets = sockets.filter((s) => s.status === 'available');

      if (availableSockets.length === 0) {
        continue;
      }

      console.log(
        `[IDLE_ALERT] 充电桩 ${stationName} 有 ${availableSockets.length} 个空闲插座`
      );

      // 4. 对每个空闲插座，查询最近一次变为 available 的事件
      for (const socket of availableSockets) {
        const socketId = socket.id;

        // 查询最近一次 new_status = 'available' 的事件
        const eventResult = await db
          .prepare(
            `SELECT timestamp FROM status_events
             WHERE station_id = ? AND socket_id = ? AND new_status = 'available'
             ORDER BY timestamp DESC
             LIMIT 1`
          )
          .bind(stationId, socketId)
          .first<{ timestamp: number }>();

        if (!eventResult) {
          console.warn(
            `[IDLE_ALERT] 充电桩 ${stationName} 插座 ${socketId} 没有找到 available 事件`
          );
          continue;
        }

        const idleStartTime = eventResult.timestamp;
        const idleMinutes = Math.floor((now.getTime() - idleStartTime) / 60000);

        // 5. 判断是否超过阈值
        if (idleMinutes >= config.idle_threshold_minutes) {
          idleSockets.push({
            stationId,
            stationName,
            socketId,
            idleMinutes,
            idleStartTime,
          });
        }
      }
    }

    console.log(`[IDLE_ALERT] 找到 ${idleSockets.length} 个超过阈值的空闲插座`);

    // 6. 如果配置了 enabled_station_ids，只保留指定充电桩
    let filteredSockets = idleSockets;
    if (config.enabled_station_ids) {
      try {
        const enabledIds: number[] = JSON.parse(config.enabled_station_ids);
        if (enabledIds.length > 0) {
          filteredSockets = idleSockets.filter((s) => enabledIds.includes(s.stationId));
          console.log(
            `[IDLE_ALERT] 应用充电桩筛选后剩余 ${filteredSockets.length} 个插座`
          );
        }
      } catch (e) {
        console.error('[IDLE_ALERT] 解析 enabled_station_ids 失败:', e);
      }
    }

    // 7. 去重检查：过滤掉本次空闲周期已成功提醒过的插座
    // 注意：基于 idle_start_time 去重，而不是 log_date
    // 这样如果插座中间被占用过，再次空闲时会重新提醒
    const dedupedSockets: IdleSocket[] = [];

    for (const socket of filteredSockets) {
      const idleStartTimeSec = Math.floor(socket.idleStartTime / 1000);

      const logResult = await db
        .prepare(
          `SELECT COUNT(*) as count FROM idle_alert_logs
           WHERE station_id = ? AND socket_id = ? AND idle_start_time = ? AND success = 1`
        )
        .bind(socket.stationId, socket.socketId, idleStartTimeSec)
        .first<{ count: number }>();

      if (logResult && logResult.count > 0) {
        console.log(
          `[IDLE_ALERT] 充电桩 ${socket.stationName} 插座 ${socket.socketId} 本次空闲周期已提醒，跳过`
        );
        continue;
      }

      dedupedSockets.push(socket);
    }

    console.log(`[IDLE_ALERT] 去重后剩余 ${dedupedSockets.length} 个需要提醒的插座`);

    return dedupedSockets;
  } catch (error) {
    console.error('[IDLE_ALERT] 空闲检测失败:', error);
    throw error;
  }
}

