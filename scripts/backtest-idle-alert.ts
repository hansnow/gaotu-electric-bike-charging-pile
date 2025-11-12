#!/usr/bin/env node
/**
 * 空闲提醒功能历史数据回溯脚本
 *
 * 用途：
 * - 回溯任意历史日期的空闲插座检测情况
 * - Dry-run 模式，不发送通知，不修改数据库
 * - 验证功能逻辑和配置效果
 *
 * 使用方法：
 * ```bash
 * # 回溯指定日期（YYYY-MM-DD格式），使用远程数据库（推荐）
 * pnpm backtest 2025-11-11 --remote
 *
 * # 回溯指定日期和时间（YYYY-MM-DD HH:mm格式）
 * pnpm backtest "2025-11-11 14:30" --remote
 *
 * # 使用本地数据库（需要先运行migrations）
 * pnpm backtest 2025-11-11
 * ```
 *
 * 注意：
 * - 推荐使用 --remote 参数查询线上真实数据
 * - 本地数据库需要先运行: wrangler d1 migrations apply gaotu-electric-bike-charging-pile-db --local
 */

import { getPlatformProxy } from 'wrangler';

interface BacktestResult {
  targetDate: string;
  targetTime: string;
  config: {
    enabled: boolean;
    idle_threshold_minutes: number;
    time_range_start: string;
    time_range_end: string;
    webhook_urls: string[];
    enabled_station_ids: number[] | null;
  };
  timeWindowCheck: {
    inWindow: boolean;
    currentTime: string;
    windowRange: string;
  };
  holidayCheck: {
    isWorkday: boolean;
    dateInfo: string;
  };
  idleSockets: Array<{
    stationId: number;
    stationName: string;
    socketId: number;
    idleMinutes: number;
    idleStartTime: string;
    shouldAlert: boolean;
    skipReason?: string;
  }>;
  summary: {
    totalOnlineStations: number;
    totalIdleSockets: number;
    shouldAlertCount: number;
    skippedCount: number;
  };
}

/**
 * 格式化北京时间
 */
function formatBeijingTime(date: Date): {
  dateString: string;
  timeString: string;
  timeHHmm: string;
} {
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
 * 判断当前时间是否在时间窗口内
 */
function isInTimeRange(currentHHmm: string, start: string, end: string): boolean {
  const timeToMinutes = (timeHHmm: string): number => {
    const [hour, minute] = timeHHmm.split(':').map(Number);
    return hour * 60 + minute;
  };

  const current = timeToMinutes(currentHHmm);
  const startMin = timeToMinutes(start);
  const endMin = timeToMinutes(end);

  if (startMin <= endMin) {
    return current >= startMin && current <= endMin;
  } else {
    return current >= startMin || current <= endMin;
  }
}

/**
 * 检查是否为工作日
 */
async function checkIsWorkday(db: D1Database, date: Date): Promise<boolean> {
  const bjTime = formatBeijingTime(date);
  const dateStr = bjTime.dateString;

  // 1. 查询节假日缓存
  const cached = await db
    .prepare('SELECT is_holiday FROM holiday_cache WHERE date = ?')
    .bind(dateStr)
    .first<{ is_holiday: number }>();

  if (cached) {
    return cached.is_holiday === 0;
  }

  // 2. 如果没有缓存，默认按周末判断
  const dayOfWeek = date.getDay();
  return dayOfWeek !== 0 && dayOfWeek !== 6;
}

/**
 * 执行回溯分析
 */
async function backtestIdleAlert(
  db: D1Database,
  targetDate: Date
): Promise<BacktestResult> {
  console.log('\n========== 空闲提醒回溯分析 ==========\n');

  const bjTime = formatBeijingTime(targetDate);
  console.log(`📅 回溯日期: ${bjTime.timeString}`);

  // 1. 读取配置
  console.log('\n--- 步骤 1: 读取配置 ---');
  const configRow = await db
    .prepare('SELECT * FROM idle_alert_config ORDER BY id DESC LIMIT 1')
    .first();

  if (!configRow) {
    throw new Error('未找到空闲提醒配置');
  }

  const config = {
    enabled: configRow.enabled === 1,
    idle_threshold_minutes: configRow.idle_threshold_minutes as number,
    time_range_start: configRow.time_range_start as string,
    time_range_end: configRow.time_range_end as string,
    webhook_urls: JSON.parse(configRow.webhook_urls as string),
    enabled_station_ids: configRow.enabled_station_ids
      ? JSON.parse(configRow.enabled_station_ids as string)
      : null,
  };

  console.log('配置信息:', {
    enabled: config.enabled ? '✅ 已启用' : '❌ 已禁用',
    threshold: `${config.idle_threshold_minutes} 分钟`,
    timeRange: `${config.time_range_start} - ${config.time_range_end}`,
    webhookCount: config.webhook_urls.length,
    stationFilter: config.enabled_station_ids
      ? `仅监控: ${config.enabled_station_ids.join(', ')}`
      : '监控所有充电桩',
  });

  // 2. 检查是否启用
  if (!config.enabled) {
    console.log('\n⚠️  功能已禁用，跳过检测');
    return {
      targetDate: bjTime.dateString,
      targetTime: bjTime.timeString,
      config,
      timeWindowCheck: { inWindow: false, currentTime: '', windowRange: '' },
      holidayCheck: { isWorkday: false, dateInfo: '' },
      idleSockets: [],
      summary: {
        totalOnlineStations: 0,
        totalIdleSockets: 0,
        shouldAlertCount: 0,
        skippedCount: 0,
      },
    };
  }

  // 3. 检查时间窗口
  console.log('\n--- 步骤 2: 检查时间窗口 ---');
  const inTimeWindow = isInTimeRange(
    bjTime.timeHHmm,
    config.time_range_start,
    config.time_range_end
  );
  const timeWindowCheck = {
    inWindow: inTimeWindow,
    currentTime: bjTime.timeHHmm,
    windowRange: `${config.time_range_start} - ${config.time_range_end}`,
  };

  console.log(
    inTimeWindow
      ? `✅ 在时间窗口内 (${bjTime.timeHHmm})`
      : `❌ 不在时间窗口内 (${bjTime.timeHHmm})`
  );

  // 4. 检查是否为工作日
  console.log('\n--- 步骤 3: 检查工作日 ---');
  const isWorkday = await checkIsWorkday(db, targetDate);
  const holidayCheck = {
    isWorkday,
    dateInfo: bjTime.dateString,
  };

  console.log(isWorkday ? '✅ 工作日' : '❌ 非工作日（周末或节假日）');

  // 5. 检测空闲插座
  console.log('\n--- 步骤 4: 检测空闲插座 ---');

  // 5.1 读取所有在线充电桩的最新状态
  const statusResult = await db
    .prepare('SELECT * FROM latest_status WHERE online = 1')
    .all();

  console.log(`找到 ${statusResult.results?.length || 0} 个在线充电桩`);

  const idleSockets: BacktestResult['idleSockets'] = [];
  const targetTimestamp = targetDate.getTime();

  for (const row of statusResult.results || []) {
    const stationId = row.station_id as number;
    const stationName = row.station_name as string;
    const socketsJson = row.sockets as string;

    let sockets: Array<{ id: number; status: string }>;
    try {
      sockets = JSON.parse(socketsJson);
    } catch (e) {
      console.warn(`⚠️  解析充电桩 ${stationId} 的 sockets 失败`);
      continue;
    }

    // 筛选 available 插座
    const availableSockets = sockets.filter((s) => s.status === 'available');

    for (const socket of availableSockets) {
      const socketId = socket.id;

      // 查询最近一次变为 available 的事件（在目标日期之前或当天）
      const eventResult = await db
        .prepare(
          `SELECT timestamp FROM status_events
           WHERE station_id = ? AND socket_id = ? AND new_status = 'available'
             AND timestamp <= ?
           ORDER BY timestamp DESC
           LIMIT 1`
        )
        .bind(stationId, socketId, targetTimestamp)
        .first<{ timestamp: number }>();

      if (!eventResult) {
        continue;
      }

      const idleStartTime = eventResult.timestamp;
      const idleMinutes = Math.floor((targetTimestamp - idleStartTime) / 60000);

      // 判断是否超过阈值
      const exceedsThreshold = idleMinutes >= config.idle_threshold_minutes;

      // 判断是否在充电桩筛选范围内
      const inStationFilter =
        !config.enabled_station_ids ||
        config.enabled_station_ids.includes(stationId);

      // 判断是否已提醒过（查询日志）
      const logResult = await db
        .prepare(
          `SELECT COUNT(*) as count FROM idle_alert_logs
           WHERE station_id = ? AND socket_id = ? AND log_date = ? AND success = 1`
        )
        .bind(stationId, socketId, bjTime.dateString)
        .first<{ count: number }>();

      const alreadyAlerted = logResult && logResult.count > 0;

      // 决定是否应该提醒
      let shouldAlert = false;
      let skipReason: string | undefined;

      if (!exceedsThreshold) {
        skipReason = `未达到阈值 (${idleMinutes}/${config.idle_threshold_minutes}分钟)`;
      } else if (!inStationFilter) {
        skipReason = '不在监控范围内';
      } else if (alreadyAlerted) {
        skipReason = '当天已提醒过';
      } else if (!inTimeWindow) {
        skipReason = '不在时间窗口内';
      } else if (!isWorkday) {
        skipReason = '非工作日';
      } else {
        shouldAlert = true;
      }

      idleSockets.push({
        stationId,
        stationName,
        socketId,
        idleMinutes,
        idleStartTime: formatBeijingTime(new Date(idleStartTime)).timeString,
        shouldAlert,
        skipReason,
      });
    }
  }

  // 6. 统计结果
  const summary = {
    totalOnlineStations: statusResult.results?.length || 0,
    totalIdleSockets: idleSockets.length,
    shouldAlertCount: idleSockets.filter((s) => s.shouldAlert).length,
    skippedCount: idleSockets.filter((s) => !s.shouldAlert).length,
  };

  console.log('\n--- 回溯结果统计 ---');
  console.log(`在线充电桩: ${summary.totalOnlineStations} 个`);
  console.log(`空闲插座总数: ${summary.totalIdleSockets} 个`);
  console.log(`应发送提醒: ${summary.shouldAlertCount} 个`);
  console.log(`跳过提醒: ${summary.skippedCount} 个`);

  // 7. 输出详细结果
  if (idleSockets.length > 0) {
    console.log('\n--- 详细列表 ---');

    const shouldAlertSockets = idleSockets.filter((s) => s.shouldAlert);
    if (shouldAlertSockets.length > 0) {
      console.log('\n✅ 应发送提醒的插座:');
      shouldAlertSockets.forEach((s) => {
        console.log(
          `  - ${s.stationName} 插座${s.socketId}: 空闲 ${s.idleMinutes} 分钟 (自 ${s.idleStartTime})`
        );
      });
    }

    const skippedSockets = idleSockets.filter((s) => !s.shouldAlert);
    if (skippedSockets.length > 0) {
      console.log('\n⏭️  跳过提醒的插座:');
      skippedSockets.forEach((s) => {
        console.log(
          `  - ${s.stationName} 插座${s.socketId}: ${s.skipReason} (空闲 ${s.idleMinutes} 分钟)`
        );
      });
    }
  }

  console.log('\n========================================\n');

  return {
    targetDate: bjTime.dateString,
    targetTime: bjTime.timeString,
    config,
    timeWindowCheck,
    holidayCheck,
    idleSockets,
    summary,
  };
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ 错误: 请提供回溯日期');
    console.log('\n使用方法:');
    console.log('  pnpm backtest 2025-11-11 --remote');
    console.log('  pnpm backtest "2025-11-11 14:30" --remote');
    console.log('\n推荐使用 --remote 参数查询线上真实数据');
    process.exit(1);
  }

  // 检查是否使用远程数据库
  const useRemote = args.includes('--remote');
  const dateArg = args.find((arg) => !arg.startsWith('--')) || args[0];
  let targetDate: Date;

  try {
    // 解析日期参数
    if (dateArg.includes(' ')) {
      // 包含时间
      const [datePart, timePart] = dateArg.split(' ');
      const [year, month, day] = datePart.split('-').map(Number);
      const [hour, minute] = timePart.split(':').map(Number);
      targetDate = new Date(year, month - 1, day, hour, minute, 0);
    } else {
      // 只有日期，默认使用中午 12:00
      const [year, month, day] = dateArg.split('-').map(Number);
      targetDate = new Date(year, month - 1, day, 12, 0, 0);
    }

    if (isNaN(targetDate.getTime())) {
      throw new Error('无效的日期格式');
    }
  } catch (error) {
    console.error(`❌ 错误: 无法解析日期 "${dateArg}"`);
    console.log('请使用格式: YYYY-MM-DD 或 "YYYY-MM-DD HH:mm"');
    process.exit(1);
  }

  if (useRemote) {
    console.log('⏳ 正在连接到远程数据库...');
  } else {
    console.log('⏳ 正在连接到本地数据库...');
    console.log('💡 提示: 使用 --remote 参数可查询线上真实数据\n');
  }

  // 获取 Cloudflare Workers 环境
  const { env, dispose } = await getPlatformProxy<{
    DB: D1Database;
  }>({
    configPath: 'wrangler.toml',
    persist: useRemote ? { path: '.wrangler/state/v3' } : true,
  });

  try {
    await backtestIdleAlert(env.DB, targetDate);
  } catch (error) {
    if (error instanceof Error && error.message.includes('no such table')) {
      console.error('\n❌ 数据库表不存在');
      console.log('\n解决方法:');
      if (useRemote) {
        console.log('  请确认远程数据库已运行 migrations');
      } else {
        console.log('  1. 运行本地 migrations:');
        console.log(
          '     wrangler d1 migrations apply gaotu-electric-bike-charging-pile-db --local'
        );
        console.log('  2. 或使用 --remote 参数查询线上数据:');
        console.log(`     pnpm backtest ${dateArg} --remote`);
      }
    } else {
      console.error('❌ 回溯失败:', error);
    }
    process.exit(1);
  } finally {
    await dispose();
  }
}

main();
