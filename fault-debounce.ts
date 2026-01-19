/**
 * 故障状态防抖模块
 * 
 * @remarks
 * 用于过滤短暂的瞬时故障（硬件抖动），只有当故障持续超过阈值时才记录事件
 * 
 * 工作流程：
 * 1. 检测到状态变为 fault 时，先存入 pending_faults 表，不立即记录事件
 * 2. 如果故障持续超过阈值（如3分钟），则确认并记录故障事件
 * 3. 如果故障快速恢复（在阈值内），则丢弃，不记录任何事件
 */

import type { SocketStatus, StatusChangeEvent } from './status-tracker';
import { getTimeString } from './status-tracker';

/**
 * 待确认故障记录
 */
export interface PendingFault {
  station_id: number;
  socket_id: number;
  old_status: SocketStatus;
  detected_at: number;
}

/**
 * 故障防抖配置
 */
export interface FaultDebounceConfig {
  /** 故障确认阈值（分钟），默认3分钟 */
  fault_debounce_minutes: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: FaultDebounceConfig = {
  fault_debounce_minutes: 3
};

/**
 * 添加待确认故障
 * 
 * @param db D1 数据库实例
 * @param stationId 充电桩ID
 * @param socketId 插座ID
 * @param oldStatus 故障前的状态
 * @param detectedAt 检测到故障的时间戳（毫秒）
 */
export async function addPendingFault(
  db: D1Database,
  stationId: number,
  socketId: number,
  oldStatus: SocketStatus,
  detectedAt: number
): Promise<void> {
  await db.prepare(`
    INSERT OR REPLACE INTO pending_faults
    (station_id, socket_id, old_status, detected_at)
    VALUES (?, ?, ?, ?)
  `).bind(stationId, socketId, oldStatus, detectedAt).run();
}

/**
 * 移除待确认故障
 * 
 * @param db D1 数据库实例
 * @param stationId 充电桩ID
 * @param socketId 插座ID
 */
export async function removePendingFault(
  db: D1Database,
  stationId: number,
  socketId: number
): Promise<void> {
  await db.prepare(`
    DELETE FROM pending_faults
    WHERE station_id = ? AND socket_id = ?
  `).bind(stationId, socketId).run();
}

/**
 * 检查是否在待确认中
 * 
 * @param db D1 数据库实例
 * @param stationId 充电桩ID
 * @param socketId 插座ID
 * @returns 如果存在待确认记录，返回记录；否则返回 null
 */
export async function isPendingFault(
  db: D1Database,
  stationId: number,
  socketId: number
): Promise<PendingFault | null> {
  const result = await db.prepare(`
    SELECT * FROM pending_faults
    WHERE station_id = ? AND socket_id = ?
  `).bind(stationId, socketId).first();

  if (!result) {
    return null;
  }

  return {
    station_id: result.station_id as number,
    socket_id: result.socket_id as number,
    old_status: result.old_status as SocketStatus,
    detected_at: result.detected_at as number
  };
}

/**
 * 确认超时的故障
 * 
 * @param db D1 数据库实例
 * @param currentTimestamp 当前时间戳（毫秒）
 * @param config 防抖配置
 * @param stationNameMap 充电桩ID到名称的映射
 * @returns 确认的故障事件列表
 * 
 * @remarks
 * 查询所有超过阈值的待确认故障，生成对应的故障事件
 * 注意：此函数只生成事件，不删除待确认记录（由调用方决定是否删除）
 */
export async function confirmPendingFaults(
  db: D1Database,
  currentTimestamp: number,
  config: FaultDebounceConfig = DEFAULT_CONFIG,
  stationNameMap: Map<number, string> = new Map()
): Promise<StatusChangeEvent[]> {
  const thresholdMs = config.fault_debounce_minutes * 60 * 1000;
  const cutoffTime = currentTimestamp - thresholdMs;

  // 查询所有超过阈值的待确认故障
  const result = await db.prepare(`
    SELECT * FROM pending_faults
    WHERE detected_at <= ?
    ORDER BY detected_at ASC
  `).bind(cutoffTime).all();

  const confirmedEvents: StatusChangeEvent[] = [];

  for (const row of result.results) {
    const pendingFault: PendingFault = {
      station_id: row.station_id as number,
      socket_id: row.socket_id as number,
      old_status: row.old_status as SocketStatus,
      detected_at: row.detected_at as number
    };

    // 根据 station_id 查找正确的 stationName
    const stationName = stationNameMap.get(pendingFault.station_id) || `充电桩${pendingFault.station_id}`;

    // 生成故障事件（使用检测到故障的时间戳）
    confirmedEvents.push({
      id: `${pendingFault.station_id}-${pendingFault.socket_id}-${pendingFault.detected_at}`,
      stationId: pendingFault.station_id,
      stationName: stationName,
      socketId: pendingFault.socket_id,
      oldStatus: pendingFault.old_status,
      newStatus: 'fault',
      timestamp: pendingFault.detected_at,
      timeString: getTimeString(new Date(pendingFault.detected_at))
    });
  }

  return confirmedEvents;
}

/**
 * 清理已恢复的待确认故障
 * 
 * @param db D1 数据库实例
 * @param currentSockets 当前所有插座状态（Map<stationId, Map<socketId, status>>）
 * 
 * @remarks
 * 检查所有待确认故障，如果当前状态已经不是 fault，则删除待确认记录
 */
export async function cleanupRecoveredFaults(
  db: D1Database,
  currentSockets: Map<number, Map<number, SocketStatus>>
): Promise<void> {
  // 获取所有待确认故障
  const result = await db.prepare(`
    SELECT * FROM pending_faults
  `).all();

  const toDelete: Array<{ stationId: number; socketId: number }> = [];

  for (const row of result.results) {
    const stationId = row.station_id as number;
    const socketId = row.socket_id as number;

    const stationSockets = currentSockets.get(stationId);
    if (!stationSockets) {
      continue;
    }

    const currentStatus = stationSockets.get(socketId);
    // 如果当前状态不是 fault，说明已恢复，需要删除待确认记录
    if (currentStatus !== 'fault') {
      toDelete.push({ stationId, socketId });
    }
  }

  // 批量删除已恢复的待确认故障
  if (toDelete.length > 0) {
    await db.batch(
      toDelete.map(({ stationId, socketId }) =>
        db.prepare(`
          DELETE FROM pending_faults
          WHERE station_id = ? AND socket_id = ?
        `).bind(stationId, socketId)
      )
    );
  }
}

/**
 * 获取防抖配置
 * 
 * @param env 环境变量（可选）
 * @returns 防抖配置
 */
export function getFaultDebounceConfig(env?: any): FaultDebounceConfig {
  if (env?.FAULT_DEBOUNCE_MINUTES) {
    const minutes = parseInt(env.FAULT_DEBOUNCE_MINUTES, 10);
    if (!isNaN(minutes) && minutes > 0) {
      return {
        fault_debounce_minutes: minutes
      };
    }
  }

  return DEFAULT_CONFIG;
}
