import { getNearbyDevices, getDeviceDetail } from './util';
import { NearbyDevicesRequest, DeviceDetailRequest } from './types';

/**
 * Cloudflare Worker 入口文件
 * 提供充电桩查询和统计功能
 */
export default {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

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

      // 默认响应
      return new Response(JSON.stringify({
        message: 'Electric Bike Charging Pile API',
        endpoints: [
          { path: '/test', method: 'GET', description: 'Run test flow' },
          { path: '/nearby', method: 'POST', description: 'Get nearby charging devices' },
          { path: '/detail', method: 'POST', description: 'Get device detail' },
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
