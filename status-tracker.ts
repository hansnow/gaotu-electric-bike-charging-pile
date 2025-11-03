/**
 * 充电桩状态跟踪器
 * 负责记录和检测充电桩插座状态变化
 */

// 充电桩配置
export const CHARGING_STATIONS = [
  {
    id: 1,
    name: "1号充电桩",
    simId: "867997075125699"
  },
  {
    id: 2,
    name: "2号充电桩",
    simId: "863060079195715"
  },
  {
    id: 3,
    name: "3号充电桩",
    simId: "863060079153326"
  }
];

// 插座状态
export type SocketStatus = 'available' | 'occupied';

// 插座信息
export interface Socket {
  id: number;
  status: SocketStatus;
}

// 充电桩状态
export interface StationStatus {
  id: number;
  name: string;
  simId: string;
  sockets: Socket[];
  online: boolean;
  address: string;
  timestamp: number;
}

// 状态变化事件
export interface StatusChangeEvent {
  id: string;
  stationId: number;
  stationName: string;
  socketId: number;
  oldStatus: SocketStatus;
  newStatus: SocketStatus;
  timestamp: number;
  timeString: string;
}

// 每分钟状态快照
export interface StatusSnapshot {
  timestamp: number;
  timeString: string;
  stations: StationStatus[];
}

/**
 * 解析充电桩端口状态
 */
export function parsePortStatus(ports: number[], totalPorts: number): Socket[] {
  const sockets: Socket[] = [];
  // ports[0] 固定为0，无意义；ports[1]开始代表插座状态，0=空闲，1=占用
  const portStatuses = ports.slice(1);

  for (let i = 0; i < Math.min(totalPorts, portStatuses.length); i++) {
    sockets.push({
      id: i + 1,
      status: portStatuses[i] === 0 ? 'available' : 'occupied'
    });
  }

  // 如果端口数量超过数组长度，剩余端口设为空闲
  for (let i = portStatuses.length; i < totalPorts; i++) {
    sockets.push({
      id: i + 1,
      status: 'available'
    });
  }

  return sockets;
}

/**
 * 获取格式化的时间字符串
 */
export function getTimeString(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').substring(0, 19);
}

/**
 * 获取日期字符串（用于KV键）
 */
export function getDateString(date: Date = new Date()): string {
  return date.toISOString().substring(0, 10); // YYYY-MM-DD
}

/**
 * 比较两个状态数组，找出变化
 */
export function detectStatusChanges(
  oldSockets: Socket[],
  newSockets: Socket[],
  stationId: number,
  stationName: string,
  timestamp: number
): StatusChangeEvent[] {
  const changes: StatusChangeEvent[] = [];

  // 创建旧状态的映射
  const oldStatusMap = new Map(oldSockets.map(s => [s.id, s.status]));

  // 检查新状态中的每个插座
  for (const newSocket of newSockets) {
    const oldStatus = oldStatusMap.get(newSocket.id);

    if (oldStatus && oldStatus !== newSocket.status) {
      changes.push({
        id: `${stationId}-${newSocket.id}-${timestamp}`,
        stationId,
        stationName,
        socketId: newSocket.id,
        oldStatus,
        newStatus: newSocket.status,
        timestamp,
        timeString: getTimeString(new Date(timestamp))
      });
    }
  }

  return changes;
}

/**
 * 存储状态快照到KV
 */
export async function storeSnapshot(env: any, snapshot: StatusSnapshot): Promise<void> {
  const dateKey = getDateString(new Date(snapshot.timestamp));
  const snapshotKey = `snapshot:${dateKey}:${snapshot.timestamp}`;

  // 设置过期时间：保留7天
  const expirationTtl = 7 * 24 * 60 * 60; // 7 days
  await env.CHARGING_EVENTS.put(snapshotKey, JSON.stringify(snapshot), {
    expirationTtl
  });
}

/**
 * 存储状态变化事件到KV
 */
export async function storeEvents(env: any, events: StatusChangeEvent[]): Promise<void> {
  if (events.length === 0) return;

  const dateKey = getDateString(new Date(events[0].timestamp));
  const eventsKey = `events:${dateKey}`;

  try {
    // 获取现有事件
    const existingEventsStr = await env.CHARGING_EVENTS.get(eventsKey);
    let existingEvents: StatusChangeEvent[] = [];

    if (existingEventsStr) {
      existingEvents = JSON.parse(existingEventsStr);
    }

    // 添加新事件
    const allEvents = [...existingEvents, ...events];

    // 按时间戳排序（最新的在前）
    allEvents.sort((a, b) => b.timestamp - a.timestamp);

    // 限制事件数量（保留最近1000个事件）
    const limitedEvents = allEvents.slice(0, 1000);

    // 设置过期时间：保留7天
    const expirationTtl = 7 * 24 * 60 * 60; // 7 days
    await env.CHARGING_EVENTS.put(eventsKey, JSON.stringify(limitedEvents), {
      expirationTtl
    });

  } catch (error) {
    console.error('存储事件失败:', error);
    throw error;
  }
}

/**
 * 获取指定日期的事件
 */
export async function getEvents(env: any, date: string): Promise<StatusChangeEvent[]> {
  const eventsKey = `events:${date}`;
  const eventsStr = await env.CHARGING_EVENTS.get(eventsKey);

  if (!eventsStr) {
    return [];
  }

  try {
    return JSON.parse(eventsStr);
  } catch (error) {
    console.error('解析事件失败:', error);
    return [];
  }
}

/**
 * 获取最新状态
 */
export async function getLatestStatus(env: any, stationId: number): Promise<StationStatus | null> {
  const latestKey = `latest:${stationId}`;
  const statusStr = await env.CHARGING_EVENTS.get(latestKey);

  if (!statusStr) {
    return null;
  }

  try {
    return JSON.parse(statusStr);
  } catch (error) {
    console.error('解析最新状态失败:', error);
    return null;
  }
}

/**
 * 存储最新状态
 */
export async function storeLatestStatus(env: any, status: StationStatus): Promise<void> {
  const latestKey = `latest:${status.id}`;
  await env.CHARGING_EVENTS.put(latestKey, JSON.stringify(status));
}

/**
 * 获取当日写入计数
 */
export async function getWriteCount(env: any, date?: string): Promise<number> {
  const dateKey = date || getDateString();
  const counterKey = `quota:writes:${dateKey}`;
  const countStr = await env.CHARGING_EVENTS.get(counterKey);
  
  if (!countStr) {
    return 0;
  }
  
  try {
    return parseInt(countStr, 10);
  } catch (error) {
    console.error('解析写入计数失败:', error);
    return 0;
  }
}

/**
 * 增加写入计数
 */
export async function incrementWriteCount(env: any, count: number = 1, date?: string): Promise<number> {
  const dateKey = date || getDateString();
  const counterKey = `quota:writes:${dateKey}`;
  
  // 获取当前计数
  const currentCount = await getWriteCount(env, dateKey);
  const newCount = currentCount + count;
  
  // 更新计数（设置过期时间为 7 天）
  const expirationTtl = 7 * 24 * 60 * 60;
  await env.CHARGING_EVENTS.put(counterKey, newCount.toString(), {
    expirationTtl
  });
  
  // 接近配额限制时发出警告
  const QUOTA_LIMIT = 1000;
  const WARN_THRESHOLD = 0.8; // 80% 时警告
  const CRITICAL_THRESHOLD = 0.95; // 95% 时严重警告
  
  if (newCount >= QUOTA_LIMIT * CRITICAL_THRESHOLD) {
    console.warn(`🚨 [配额预警] KV 写入配额即将耗尽: ${newCount}/${QUOTA_LIMIT} (${Math.round(newCount/QUOTA_LIMIT*100)}%)`);
  } else if (newCount >= QUOTA_LIMIT * WARN_THRESHOLD) {
    console.warn(`⚠️  [配额警告] KV 写入配额使用较高: ${newCount}/${QUOTA_LIMIT} (${Math.round(newCount/QUOTA_LIMIT*100)}%)`);
  }
  
  return newCount;
}