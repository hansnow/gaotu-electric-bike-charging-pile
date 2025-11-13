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
  getDateString,
  getWriteCount,
  incrementWriteCount,
  dayDiff,
  StationStatus,
  StatusChangeEvent,
  StatusSnapshot
} from './status-tracker';
import {
  storeLatestStatusD1,
  getLatestStatusD1,
  storeEventsD1,
  getEventsD1,
  getEventsInRangeD1,
  getStatisticsD1,
  incrementQuotaStatsD1,
  getQuotaStatsD1
} from './d1-storage';
import { runIdleAlertFlow } from './idle-alert/service';
import { loadConfig, updateConfig, type UpdateConfigPayload } from './idle-alert/config';
import { sendToAll, type WebhookPayload } from './idle-alert/alert-sender';

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
          'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Token',
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
          const events = await getEventsD1(env.DB, targetDate);

          // 修正历史数据的 timeString，确保使用北京时间
          // 旧数据的 timeString 可能是 UTC 时间，这里根据 timestamp 重新生成
          const fixedEvents = events.map(event => ({
            ...event,
            timeString: getTimeString(new Date(event.timestamp))
          }));

          return new Response(JSON.stringify({
            success: true,
            date: targetDate,
            events: fixedEvents
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

      // 统计 API 接口
      if (url.pathname === '/statistics' && request.method === 'GET') {
        const startDate = url.searchParams.get('start') || getDateString();
        const endDate = url.searchParams.get('end') || getDateString();
        const maxRangeDays = 31;

        if (dayDiff(startDate, endDate) > maxRangeDays) {
          return new Response(JSON.stringify({
            success: false,
            error: `date range must be <= ${maxRangeDays} days`
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }

        try {
          const stats = await getStatisticsD1(env.DB, startDate, endDate);
          return new Response(JSON.stringify({
            success: true,
            startDate,
            endDate,
            statistics: stats
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        } catch (error) {
          console.error('获取统计失败:', error);
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

      // ========== 空闲提醒 API ==========

      // 查询空闲提醒配置
      if (url.pathname === '/api/alert/config' && request.method === 'GET') {
        try {
          const config = await loadConfig(env.DB, env);
          return new Response(JSON.stringify({
            success: true,
            data: config
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        } catch (error) {
          console.error('[IDLE_ALERT] 查询配置失败:', error);
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

      // 更新空闲提醒配置（需要 Token）
      if (url.pathname === '/api/alert/config' && request.method === 'POST') {
        // 校验 Token
        const authError = checkAdminToken(request, env);
        if (authError) {
          return authError;
        }

        try {
          const payload = await request.json() as UpdateConfigPayload;
          await updateConfig(env.DB, payload);
          return new Response(JSON.stringify({
            success: true,
            message: '配置更新成功'
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        } catch (error) {
          console.error('[IDLE_ALERT] 更新配置失败:', error);
          return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          }), {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        }
      }

      // 查询空闲提醒日志
      if (url.pathname === '/api/alert/logs' && request.method === 'GET') {
        try {
          const date = url.searchParams.get('date');
          const stationId = url.searchParams.get('stationId');
          const socketId = url.searchParams.get('socketId');
          const success = url.searchParams.get('success');
          const limit = parseInt(url.searchParams.get('limit') || '100');
          const offset = parseInt(url.searchParams.get('offset') || '0');

          // 构建查询条件
          const conditions: string[] = [];
          const params: any[] = [];

          if (date) {
            conditions.push('log_date = ?');
            params.push(date);
          }

          if (stationId) {
            conditions.push('station_id = ?');
            params.push(parseInt(stationId));
          }

          if (socketId) {
            conditions.push('socket_id = ?');
            params.push(parseInt(socketId));
          }

          if (success !== null && success !== undefined) {
            conditions.push('success = ?');
            params.push(success === 'true' || success === '1' ? 1 : 0);
          }

          const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
          const sql = `
            SELECT * FROM idle_alert_logs
            ${whereClause}
            ORDER BY triggered_at DESC
            LIMIT ? OFFSET ?
          `;

          params.push(limit, offset);

          const result = await env.DB.prepare(sql).bind(...params).all();

          return new Response(JSON.stringify({
            success: true,
            data: result.results || [],
            count: result.results?.length || 0
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        } catch (error) {
          console.error('[IDLE_ALERT] 查询日志失败:', error);
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

      // 测试 Webhook（需要 Token）
      if (url.pathname === '/api/alert/test' && request.method === 'POST') {
        // 校验 Token
        const authError = checkAdminToken(request, env);
        if (authError) {
          return authError;
        }

        try {
          const config = await loadConfig(env.DB, env);
          const webhookUrls = JSON.parse(config.webhook_urls);

          if (webhookUrls.length === 0) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Webhook URLs 为空，请先配置'
            }), {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
              },
            });
          }

          // 构建测试 Payload
          const now = new Date();
          const testPayload: WebhookPayload = {
            alertType: 'socket_idle',
            timestamp: Math.floor(now.getTime() / 1000),
            timeString: now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
            station: {
              id: 999,
              name: '测试充电桩',
            },
            socket: {
              id: 1,
              status: 'available',
              idleMinutes: 60,
              idleStartTime: Math.floor((now.getTime() - 60 * 60 * 1000) / 1000),
              idleStartTimeString: new Date(now.getTime() - 60 * 60 * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
            },
            config: {
              threshold: config.idle_threshold_minutes,
              timeRange: `${config.time_range_start}-${config.time_range_end}`,
            },
          };

          // 发送测试
          const results = await sendToAll(webhookUrls, testPayload, {
            retryTimes: 0, // 测试不重试
            retryIntervalSeconds: 0,
          });

          return new Response(JSON.stringify({
            success: true,
            message: '测试完成',
            results: results
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        } catch (error) {
          console.error('[IDLE_ALERT] 测试 Webhook 失败:', error);
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

      // 查询空闲提醒统计
      if (url.pathname === '/api/alert/stats' && request.method === 'GET') {
        try {
          // 查询近 7 天的统计
          const today = new Date();
          const sevenDaysAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

          const formatDate = (date: Date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
          };

          const startDate = formatDate(sevenDaysAgo);
          const endDate = formatDate(today);

          // 总次数和成功率
          const totalResult = await env.DB.prepare(`
            SELECT
              COUNT(*) as total,
              SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
              AVG(response_time_ms) as avg_response_time
            FROM idle_alert_logs
            WHERE log_date >= ? AND log_date <= ?
          `).bind(startDate, endDate).first();

          // 按充电桩聚合
          const stationResult = await env.DB.prepare(`
            SELECT
              station_id,
              station_name,
              COUNT(*) as total,
              SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count
            FROM idle_alert_logs
            WHERE log_date >= ? AND log_date <= ?
            GROUP BY station_id, station_name
            ORDER BY total DESC
          `).bind(startDate, endDate).all();

          // 按日期趋势
          const trendResult = await env.DB.prepare(`
            SELECT
              log_date,
              COUNT(*) as total,
              SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count
            FROM idle_alert_logs
            WHERE log_date >= ? AND log_date <= ?
            GROUP BY log_date
            ORDER BY log_date ASC
          `).bind(startDate, endDate).all();

          const total = (totalResult?.total as number) || 0;
          const successCount = (totalResult?.success_count as number) || 0;
          const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;

          return new Response(JSON.stringify({
            success: true,
            data: {
              summary: {
                total: total,
                successCount: successCount,
                failedCount: total - successCount,
                successRate: successRate,
                avgResponseTime: totalResult?.avg_response_time || 0,
              },
              byStation: stationResult.results || [],
              trend: trendResult.results || [],
            }
          }), {
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
          });
        } catch (error) {
          console.error('[IDLE_ALERT] 查询统计失败:', error);
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
          { path: '/statistics', method: 'GET', description: 'Get statistics (query params: start, end)' },
          { path: '/api/alert/config', method: 'GET', description: 'Get idle alert config' },
          { path: '/api/alert/config', method: 'POST', description: 'Update idle alert config (requires X-Admin-Token)' },
          { path: '/api/alert/logs', method: 'GET', description: 'Get idle alert logs (query params: date, stationId, socketId, success, limit, offset)' },
          { path: '/api/alert/test', method: 'POST', description: 'Test webhook (requires X-Admin-Token)' },
          { path: '/api/alert/stats', method: 'GET', description: 'Get idle alert statistics' },
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
    const startTime = Date.now();
    const scheduledTime = new Date(event.scheduledTime);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔄 [定时任务] 开始执行状态检查');
    console.log('⏰ UTC时间:', scheduledTime.toISOString());
    console.log('🕐 北京时间:', scheduledTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }));

    try {
      const result = await performStatusCheck(env);
      const duration = Date.now() - startTime;

      console.log('✅ [定时任务] 执行成功');
      console.log('📊 检查结果:', {
        检查耗时: `${duration}ms`,
        充电桩数量: result.stationsCount,
        状态变化数: result.eventsCount,
        是否有变化: result.hasAnyChange ? '是' : '否',
        KV写入: result.hasAnyChange ? '已写入' : '跳过写入'
      });
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('❌ [定时任务] 执行失败');
      console.error('⏱️  耗时:', `${duration}ms`);
      console.error('💥 错误:', error instanceof Error ? error.message : String(error));
      console.error('📋 错误堆栈:', error instanceof Error ? error.stack : 'N/A');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    }

    // 执行空闲提醒流程（独立于状态检查，失败不影响主流程）
    try {
      const alertResult = await runIdleAlertFlow(env, ctx);
      console.log('[IDLE_ALERT] 空闲提醒流程完成:', {
        成功: alertResult.success,
        在时间窗口内: alertResult.inTimeWindow,
        是工作日: alertResult.isWorkday,
        空闲插座数: alertResult.idleSocketCount,
        发送提醒数: alertResult.sentAlertCount,
        成功数: alertResult.successAlertCount,
        失败数: alertResult.failedAlertCount,
      });
    } catch (error) {
      console.error('[IDLE_ALERT] 空闲提醒流程异常:', error);
      // 不抛出异常，避免影响定时任务
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
 * 校验管理员 Token
 * @param request 请求对象
 * @param env 环境变量
 * @returns 如果校验失败，返回错误响应；如果成功，返回 null
 */
function checkAdminToken(request: Request, env: any): Response | null {
  const token = request.headers.get('X-Admin-Token');

  if (!token) {
    return new Response(JSON.stringify({
      success: false,
      error: '缺少 X-Admin-Token 请求头'
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  const adminToken = env.ADMIN_API_TOKEN;

  if (!adminToken) {
    console.error('[AUTH] ADMIN_API_TOKEN 环境变量未配置');
    return new Response(JSON.stringify({
      success: false,
      error: '服务器配置错误'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  if (token !== adminToken) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Token 无效'
    }), {
      status: 403,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  return null; // 校验成功
}

/**
 * 执行状态检查的核心函数
 * 获取所有充电桩的当前状态，检测变化，并存储到D1中
 * 优化策略：只在状态真正变化时才写入，以节省配额
 */
async function performStatusCheck(env: any): Promise<any> {
  const timestamp = Date.now();
  const timeString = getTimeString(new Date(timestamp));
  const dateString = getDateString(new Date(timestamp));

  console.log(`📍 开始检查状态: ${timeString}`);

  const currentStations: StationStatus[] = [];
  const allEvents: StatusChangeEvent[] = [];
  let hasAnyChange = false; // 标记是否有任何状态变化
  let d1ReadCount = 0;
  let d1WriteCount = 0;

  for (const station of CHARGING_STATIONS) {
    try {
      console.log(`  🔍 检查 [${station.name}] (simId: ${station.simId})`);

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
        const availableCount = sockets.filter(s => s.status === 'available').length;
        const occupiedCount = sockets.filter(s => s.status === 'occupied').length;

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
        console.log(`     📊 在线: ${currentStatus.online ? '是' : '否'} | 插座: ${sockets.length}个 (空闲${availableCount}/占用${occupiedCount})`);

        // 获取上一次的状态（从 D1）
        const previousStatus = await getLatestStatusD1(env.DB, station.id);
        d1ReadCount++;

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

            console.log(`     🔔 检测到 ${changes.length} 个状态变化:`);
            changes.forEach(change => {
              const statusEmoji = change.newStatus === 'occupied' ? '🔌' : '🔓';
              console.log(`        ${statusEmoji} 插座#${change.socketId}: ${change.oldStatus} → ${change.newStatus}`);
            });
          } else {
            console.log(`     ✓ 无状态变化`);
          }
        } else {
          // 如果是第一次获取状态，也需要存储
          stationHasChange = true;
          hasAnyChange = true;
          console.log(`     🆕 首次获取状态，将写入 D1`);
        }

        // 只在状态变化时存储最新状态
        if (stationHasChange) {
          await storeLatestStatusD1(env.DB, currentStatus);
          d1WriteCount++;
          console.log(`     💾 已更新最新状态到 D1`);
        }

      } else {
        console.warn(`     ⚠️  获取详情失败`);
      }

    } catch (error) {
      console.error(`     ❌ 处理出错:`, error instanceof Error ? error.message : String(error));
    }
  }

  // 存储状态变化事件到 D1
  if (allEvents.length > 0) {
    await storeEventsD1(env.DB, allEvents);
    d1WriteCount++;
    console.log(`💾 已存储 ${allEvents.length} 个状态变化事件到 D1`);
  } else {
    console.log(`⏭️  无状态变化，跳过存储`);
  }

  // 更新配额统计到 D1
  if (d1ReadCount > 0 || d1WriteCount > 0) {
    await incrementQuotaStatsD1(env.DB, dateString, {
      reads: d1ReadCount,
      writes: d1WriteCount
    });
  }

  // 输出统计信息
  console.log(`📈 本次检查统计:`);
  console.log(`   - D1 读取次数: ${d1ReadCount}`);
  console.log(`   - D1 写入次数: ${d1WriteCount}`);
  console.log(`   - 充电桩数量: ${currentStations.length}`);
  console.log(`   - 状态变化数: ${allEvents.length}`);

  return {
    timestamp: timestamp,
    timeString: timeString,
    stationsCount: currentStations.length,
    eventsCount: allEvents.length,
    hasAnyChange: hasAnyChange,
    d1ReadCount: d1ReadCount,
    d1WriteCount: d1WriteCount,
    stations: currentStations,
    events: allEvents
  };
}
