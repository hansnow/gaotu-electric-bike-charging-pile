import { getNearbyDevices, getDeviceDetail } from './util';
import { NearbyDevicesRequest, DeviceDetailRequest } from './types';
import {
  CHARGING_STATIONS,
  parsePortStatus,
  detectStatusChanges,
  storeSnapshot,
  storeEvents,
  getLatestStatus,
  storeLatestStatus,
  getEvents,
  getTimeString,
  StationStatus,
  StatusChangeEvent,
  StatusSnapshot
} from './status-tracker';

/**
 * Cloudflare Worker 入口文件
 * 提供充电桩查询和统计功能
 */
export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 处理静态资源请求
    if (url.pathname === '/' || url.pathname === '/index.html') {
      try {
        return await env.ASSETS.fetch(new Request(request.url));
      } catch (error) {
        return new Response('静态资源未找到', {
          status: 404,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
          },
        });
      }
    }

    // 处理 CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    try {
      // 提供测试接口
      if (url.pathname === '/test' && request.method === 'GET') {
        const result = await runTestFlow();
        return new Response(JSON.stringify(result), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // 提供充电桩列表查询接口
      if (url.pathname === '/nearby' && request.method === 'POST') {
        const body = await request.json() as NearbyDevicesRequest;
        const devices = await getNearbyDevices(body);
        return new Response(JSON.stringify({ success: true, data: devices }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // 提供充电桩详情查询接口
      if (url.pathname === '/detail' && request.method === 'POST') {
        const rawBody = await request.json() as Partial<DeviceDetailRequest> | null;

        if (!rawBody || rawBody.simId === undefined || rawBody.simId === null) {
          return new Response(JSON.stringify({
            success: false,
            error: 'simId is required'
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        const simId =
          typeof rawBody.simId === 'string'
            ? rawBody.simId.trim()
            : String(rawBody.simId);

        if (!simId) {
          return new Response(JSON.stringify({
            success: false,
            error: 'simId is required'
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        const detailParams: DeviceDetailRequest = {
          simId,
          mapType: normalizeNumber(rawBody.mapType, DEFAULT_DEVICE_DETAIL_PARAMS.mapType),
          chargeTypeTag: normalizeNumber(rawBody.chargeTypeTag, DEFAULT_DEVICE_DETAIL_PARAMS.chargeTypeTag),
          appEntrance: normalizeNumber(rawBody.appEntrance, DEFAULT_DEVICE_DETAIL_PARAMS.appEntrance),
          version: typeof rawBody.version === 'string' && rawBody.version.trim().length > 0
            ? rawBody.version
            : DEFAULT_DEVICE_DETAIL_PARAMS.version
        };

        const detail = await getDeviceDetail(detailParams);
        return new Response(JSON.stringify({ success: true, data: detail }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        });
      }

      // 提供状态变化事件查询接口
      if (url.pathname === '/events' && request.method === 'GET') {
        const date = url.searchParams.get('date');
        const targetDate = date || new Date().toISOString().substring(0, 10);

        try {
          const events = await getEvents(env, targetDate);
          return new Response(JSON.stringify({
            success: true,
            date: targetDate,
            events: events
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        } catch (error) {
          console.error('获取事件失败:', error);
          return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
      }

      // 手动触发状态检查的接口（用于测试）
      if (url.pathname === '/check-status' && request.method === 'POST') {
        try {
          const result = await performStatusCheck(env);
          return new Response(JSON.stringify({
            success: true,
            message: '状态检查完成',
            result
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        } catch (error) {
          console.error('状态检查失败:', error);
          return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 500,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
      }

      // 默认响应
      return new Response(JSON.stringify({
        message: 'Electric Bike Charging Pile API',
        endpoints: [
          { path: '/test', method: 'GET', description: 'Run test flow' },
          { path: '/nearby', method: 'POST', description: 'Get nearby charging devices' },
          { path: '/detail', method: 'POST', description: 'Get device detail' },
          { path: '/events', method: 'GET', description: 'Get status change events' },
          { path: '/check-status', method: 'POST', description: 'Manual status check' },
        ]
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  },

  // 定时任务处理函数（全天24小时，每分钟执行一次）
  async scheduled(event: ScheduledEvent, env: any, ctx: ExecutionContext): Promise<void> {
    const scheduledTime = new Date(event.scheduledTime);
    const beijingTime = new Date(scheduledTime.getTime() + 8 * 60 * 60 * 1000); // UTC+8
    console.log('定时任务开始执行 (UTC):', scheduledTime.toISOString());
    console.log('定时任务开始执行 (北京时间):', beijingTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));

    try {
      await performStatusCheck(env);
      console.log('定时任务执行成功');
    } catch (error) {
      console.error('定时任务执行失败:', error);
    }
  },
};

const DEFAULT_DEVICE_DETAIL_PARAMS: Omit<DeviceDetailRequest, 'simId'> = {
  // 与 test-local.ts 中 runLocalTest 使用的默认参数保持一致
  mapType: 2,
  chargeTypeTag: 0,
  appEntrance: 1,
  version: 'new'
};

function normalizeNumber(value: number | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (value !== undefined) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

// 从 API.md 中获取的中电金信充电桩 simId 列表（按 1、2、3 顺序排序）
const ZHONGDIANJINXIN_DEVICES = [
  {
    name: "中电金信自行车充电1号桩",
    simId: "867997075125699"
  },
  {
    name: "中电金信自行车充电2号桩",
    simId: "863060079195715"
  },
  {
    name: "中电金信自行车充电3号桩",
    simId: "863060079153326"
  }
];

/**
 * 运行测试流程（仅使用详情接口）
 * 直接测试中电金信的充电桩
 * 1. 遍历预定义的中电金信充电桩列表
 * 2. 依次请求详情接口
 * 3. 统计ports中为0的数量
 */
async function runTestFlow(): Promise<any> {
  try {
    console.log('开始运行测试流程（仅详情接口）...');

    let totalZeroPorts = 0;
    let totalFreePortCount = 0;
    let successCount = 0;
    let failureCount = 0;
    const deviceDetails = [];

    for (let i = 0; i < ZHONGDIANJINXIN_DEVICES.length; i++) {
      const device = ZHONGDIANJINXIN_DEVICES[i];

      try {
        console.log(`获取充电桩详情: ${device.name} (simId: ${device.simId})`);

        const detailParams: DeviceDetailRequest = {
          simId: device.simId,
          mapType: 2,
          chargeTypeTag: 0,
          appEntrance: 1,
          version: 'new'
        };

        const detail = await getDeviceDetail(detailParams);

        // 统计ports中为0的数量（空闲端口）
        const zeroPorts = detail.ports.filter(port => port === 0).length;
        totalZeroPorts += zeroPorts;
        totalFreePortCount += detail.device.freePortCount;
        successCount++;

        deviceDetails.push({
          name: device.name,
          simId: device.simId,
          totalPorts: detail.device.portNumber,
          freePortCount: detail.device.freePortCount,
          zeroPorts: zeroPorts,
          ports: detail.ports,
          errorMsg: detail.errorMsg,
          online: detail.device.online,
          address: detail.device.address
        });

        console.log(`充电桩 ${device.name}: 总端口数 ${detail.device.portNumber}, 空闲端口数(freePortCount) ${detail.device.freePortCount}, 空闲端口数(ports数组) ${zeroPorts}`);

      } catch (error) {
        failureCount++;
        console.error(`获取充电桩 ${device.name} 详情失败:`, error);
        deviceDetails.push({
          name: device.name,
          simId: device.simId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const result = {
      success: true,
      message: '测试流程完成',
      summary: {
        totalDevices: ZHONGDIANJINXIN_DEVICES.length,
        successCount: successCount,
        failureCount: failureCount,
        totalFreePortCount: totalFreePortCount,
        totalZeroPorts: totalZeroPorts,
        averageFreePortCount: successCount > 0 ? Math.round((totalFreePortCount / successCount) * 10) / 10 : 0,
        averageZeroPorts: successCount > 0 ? Math.round((totalZeroPorts / successCount) * 10) / 10 : 0
      },
      deviceDetails: deviceDetails
    };

    console.log('测试流程完成:', JSON.stringify(result, null, 2));
    return result;

  } catch (error) {
    console.error('测试流程执行失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 执行状态检查的核心函数
 * 获取所有充电桩的当前状态，检测变化，并存储到KV中
 * 优化策略：只在状态真正变化时才写入KV，以节省免费套餐的写入次数限制
 */
async function performStatusCheck(env: any): Promise<any> {
  const timestamp = Date.now();
  const timeString = getTimeString(new Date(timestamp));

  console.log(`开始执行状态检查: ${timeString}`);

  const currentStations: StationStatus[] = [];
  const allEvents: StatusChangeEvent[] = [];
  let hasAnyChange = false; // 标记是否有任何状态变化

  for (const station of CHARGING_STATIONS) {
    try {
      // 获取充电桩详情
      const detailParams: DeviceDetailRequest = {
        simId: station.simId,
        mapType: 2,
        chargeTypeTag: 0,
        appEntrance: 1,
        version: 'new'
      };

      const detail = await getDeviceDetail(detailParams);

      if (detail && detail.device) {
        const sockets = parsePortStatus(detail.ports, detail.device.portNumber);

        const currentStatus: StationStatus = {
          id: station.id,
          name: station.name,
          simId: station.simId,
          sockets: sockets,
          online: detail.device.online === 1,
          address: detail.device.address || '未知地址',
          timestamp: timestamp
        };

        currentStations.push(currentStatus);

        // 获取上一次的状态
        const previousStatus = await getLatestStatus(env, station.id);

        let stationHasChange = false;

        if (previousStatus && previousStatus.sockets) {
          // 检测状态变化
          const changes = detectStatusChanges(
            previousStatus.sockets,
            currentStatus.sockets,
            station.id,
            station.name,
            timestamp
          );

          if (changes.length > 0) {
            stationHasChange = true;
            hasAnyChange = true;
            allEvents.push(...changes);
            
            console.log(`充电桩 ${station.name} 检测到 ${changes.length} 个状态变化`);
            changes.forEach(change => {
              console.log(`  插座 ${change.socketId}: ${change.oldStatus} → ${change.newStatus} (${change.timeString})`);
            });
          }
        } else {
          // 如果是第一次获取状态，也需要存储
          stationHasChange = true;
          hasAnyChange = true;
          console.log(`充电桩 ${station.name} 首次获取状态`);
        }

        // 只在状态变化时存储最新状态
        if (stationHasChange) {
          await storeLatestStatus(env, currentStatus);
          console.log(`已更新充电桩 ${station.name} 的最新状态到 KV`);
        }

      } else {
        console.warn(`充电桩 ${station.name} 获取详情失败`);
      }

    } catch (error) {
      console.error(`处理充电桩 ${station.name} 时出错:`, error);
    }
  }

  // 只在有任何状态变化时存储状态快照
  if (hasAnyChange && currentStations.length > 0) {
    const snapshot: StatusSnapshot = {
      timestamp: timestamp,
      timeString: timeString,
      stations: currentStations
    };

    await storeSnapshot(env, snapshot);
    console.log(`已存储状态快照到 KV (有 ${allEvents.length} 个状态变化事件)`);
  } else {
    console.log(`无状态变化，跳过快照存储（节省 KV 写入次数）`);
  }

  // 存储状态变化事件（已有检查：allEvents.length > 0）
  if (allEvents.length > 0) {
    await storeEvents(env, allEvents);
    console.log(`已存储 ${allEvents.length} 个状态变化事件到 KV`);
  }

  return {
    timestamp: timestamp,
    timeString: timeString,
    stationsCount: currentStations.length,
    eventsCount: allEvents.length,
    hasAnyChange: hasAnyChange,
    stations: currentStations,
    events: allEvents
  };
}
