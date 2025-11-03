// d1-storage.ts
import type { StationStatus, StatusChangeEvent, SocketStatus } from './status-tracker';

const EVENT_BATCH_SIZE = 40;

/**
 * 存储最新状态到 D1
 */
export async function storeLatestStatusD1(
  db: D1Database,
  status: StationStatus
): Promise<void> {
  await db.prepare(`
    INSERT OR REPLACE INTO latest_status
    (station_id, station_name, sim_id, sockets, online, address, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    status.id,
    status.name,
    status.simId,
    JSON.stringify(status.sockets),
    status.online ? 1 : 0,
    status.address,
    status.timestamp
  ).run();
}

/**
 * 获取最新状态从 D1
 */
export async function getLatestStatusD1(
  db: D1Database,
  stationId: number
): Promise<StationStatus | null> {
  const result = await db.prepare(`
    SELECT * FROM latest_status WHERE station_id = ?
  `).bind(stationId).first();

  if (!result) return null;

  return {
    id: result.station_id as number,
    name: result.station_name as string,
    simId: result.sim_id as string,
    sockets: JSON.parse(result.sockets as string),
    online: (result.online as number) === 1,
    address: result.address as string,
    timestamp: result.timestamp as number
  };
}

/**
 * 批量存储事件到 D1
 */
export async function storeEventsD1(
  db: D1Database,
  events: StatusChangeEvent[]
): Promise<void> {
  if (events.length === 0) return;

  // D1 对 batch 长度有限制，这里分批执行
  for (let i = 0; i < events.length; i += EVENT_BATCH_SIZE) {
    const chunk = events.slice(i, i + EVENT_BATCH_SIZE);
    await db.batch(
      chunk.map(event =>
        db.prepare(`
          INSERT INTO status_events
          (id, station_id, station_name, socket_id, old_status, new_status, timestamp, event_date, time_string)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          event.id,
          event.stationId,
          event.stationName,
          event.socketId,
          event.oldStatus,
          event.newStatus,
          event.timestamp,
          event.timeString.substring(0, 10),
          event.timeString
        )
      )
    );
  }
}

/**
 * 查询指定日期的事件
 */
export async function getEventsD1(
  db: D1Database,
  date: string
): Promise<StatusChangeEvent[]> {
  // date 格式: YYYY-MM-DD
  const startTimestamp = new Date(`${date}T00:00:00Z`).getTime();
  const endTimestamp = startTimestamp + 24 * 60 * 60 * 1000;

  const result = await db.prepare(`
    SELECT * FROM status_events
    WHERE timestamp >= ? AND timestamp < ?
    ORDER BY timestamp DESC
    LIMIT 1000
  `).bind(startTimestamp, endTimestamp).all();

  return result.results.map(row => ({
    id: row.id as string,
    stationId: row.station_id as number,
    stationName: row.station_name as string,
    socketId: row.socket_id as number,
    oldStatus: row.old_status as SocketStatus,
    newStatus: row.new_status as SocketStatus,
    timestamp: row.timestamp as number,
    timeString: row.time_string as string
  }));
}

/**
 * 查询时间范围内的事件（新功能）
 */
export async function getEventsInRangeD1(
  db: D1Database,
  startDate: string,
  endDate: string
): Promise<StatusChangeEvent[]> {
  const startTimestamp = new Date(`${startDate}T00:00:00Z`).getTime();
  const endTimestamp = new Date(`${endDate}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000;

  const result = await db.prepare(`
    SELECT * FROM status_events
    WHERE timestamp >= ? AND timestamp < ?
    ORDER BY timestamp DESC
  `).bind(startTimestamp, endTimestamp).all();

  return result.results.map(row => ({
    id: row.id as string,
    stationId: row.station_id as number,
    stationName: row.station_name as string,
    socketId: row.socket_id as number,
    oldStatus: row.old_status as SocketStatus,
    newStatus: row.new_status as SocketStatus,
    timestamp: row.timestamp as number,
    timeString: row.time_string as string
  }));
}

/**
 * 统计功能（D1 独有）
 */
export async function getStatisticsD1(
  db: D1Database,
  startDate: string,
  endDate: string
) {
  const startTimestamp = new Date(`${startDate}T00:00:00Z`).getTime();
  const endTimestamp = new Date(`${endDate}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000;

  // 每天的变化统计
  const dailyStats = await db.prepare(`
    SELECT
      DATE(timestamp/1000, 'unixepoch') as date,
      station_id,
      station_name,
      COUNT(*) as changes,
      SUM(CASE WHEN new_status = 'occupied' THEN 1 ELSE 0 END) as occupied_count,
      SUM(CASE WHEN new_status = 'available' THEN 1 ELSE 0 END) as available_count
    FROM status_events
    WHERE timestamp >= ? AND timestamp < ?
    GROUP BY date, station_id, station_name
    ORDER BY date DESC
  `).bind(startTimestamp, endTimestamp).all();

  // 每小时的变化统计
  const hourlyStats = await db.prepare(`
    SELECT
      strftime('%H', timestamp/1000, 'unixepoch') as hour,
      COUNT(*) as changes
    FROM status_events
    WHERE timestamp >= ? AND timestamp < ?
    GROUP BY hour
    ORDER BY hour
  `).bind(startTimestamp, endTimestamp).all();

  return {
    daily: dailyStats.results,
    hourly: hourlyStats.results
  };
}

/**
 * 替换 KV 计数器的配额统计
 */
export async function incrementQuotaStatsD1(
  db: D1Database,
  date: string,
  delta: { reads?: number; writes?: number }
): Promise<void> {
  await db.prepare(`
    INSERT INTO quota_stats (date, write_count, read_count, last_updated)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      write_count = write_count + ?,
      read_count = read_count + ?,
      last_updated = excluded.last_updated
  `).bind(
    date,
    delta.writes ?? 0,
    delta.reads ?? 0,
    Date.now(),
    delta.writes ?? 0,
    delta.reads ?? 0
  ).run();
}

export async function getQuotaStatsD1(
  db: D1Database,
  date: string
): Promise<{ writes: number; reads: number } | null> {
  const row = await db.prepare(`
    SELECT write_count, read_count FROM quota_stats WHERE date = ?
  `).bind(date).first();

  if (!row) return null;
  return {
    writes: row.write_count as number,
    reads: row.read_count as number
  };
}

/**
 * 清理过期数据（自动维护）
 */
export async function cleanupOldDataD1(
  db: D1Database,
  daysToKeep: number = 7
): Promise<void> {
  const cutoffTimestamp = Date.now() - daysToKeep * 24 * 60 * 60 * 1000;

  await db.prepare(`
    DELETE FROM status_events WHERE timestamp < ?
  `).bind(cutoffTimestamp).run();
}
