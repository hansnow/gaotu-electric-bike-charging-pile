/**
 * 空闲提醒配置管理模块
 *
 * @remarks
 * 负责从数据库和环境变量加载配置、更新配置
 * 配置读取顺序：数据库 > Secret/环境变量 > 代码默认值
 */

/**
 * 空闲提醒配置接口
 */
export interface IdleAlertConfig {
  /** 配置ID */
  id: number;
  /** 空闲阈值（分钟） */
  idle_threshold_minutes: number;
  /** 时间窗口开始时间（HH:mm 格式） */
  time_range_start: string;
  /** 时间窗口结束时间（HH:mm 格式） */
  time_range_end: string;
  /** Webhook URLs（JSON 数组字符串） */
  webhook_urls: string;
  /** 启用的充电桩ID列表（JSON 数组字符串，null 表示全部） */
  enabled_station_ids: string | null;
  /** 是否启用：1=启用，0=禁用 */
  enabled: number;
  /** 重试次数 */
  retry_times: number;
  /** 重试间隔（秒） */
  retry_interval_seconds: number;
  /** 创建时间（Unix 时间戳） */
  created_at: number;
  /** 更新时间（Unix 时间戳） */
  updated_at: number;
}

/**
 * 配置更新参数接口
 */
export interface UpdateConfigPayload {
  idle_threshold_minutes?: number;
  time_range_start?: string;
  time_range_end?: string;
  webhook_urls?: string;
  enabled_station_ids?: string | null;
  enabled?: number;
  retry_times?: number;
  retry_interval_seconds?: number;
}

/**
 * 环境变量接口（扩展原有 Env）
 */
export interface IdleAlertEnv {
  DB: D1Database;
  IDLE_ALERT_WEBHOOK_URLS?: string;
  IDLE_ALERT_THRESHOLD_MINUTES?: string;
  IDLE_ALERT_TIME_START?: string;
  IDLE_ALERT_TIME_END?: string;
  IDLE_ALERT_RETRY_TIMES?: string;
  IDLE_ALERT_RETRY_INTERVAL?: string;
  ADMIN_API_TOKEN?: string;
}

/**
 * 加载空闲提醒配置
 *
 * @param db D1 数据库实例
 * @param env 环境变量
 * @returns 配置对象
 *
 * @remarks
 * 配置读取顺序：
 * 1. 从数据库读取配置
 * 2. 如果 webhook_urls 为空，从环境变量 IDLE_ALERT_WEBHOOK_URLS 读取
 * 3. 确保时间字符串为 HH:mm 格式
 */
export async function loadConfig(
  db: D1Database,
  env: IdleAlertEnv
): Promise<IdleAlertConfig> {
  try {
    // 从数据库读取配置（取第一条记录）
    const result = await db
      .prepare('SELECT * FROM idle_alert_config ORDER BY id LIMIT 1')
      .first<IdleAlertConfig>();

    if (!result) {
      throw new Error('空闲提醒配置未初始化');
    }

    // 如果数据库中的 webhook_urls 为空数组，尝试从环境变量读取
    let webhookUrls = result.webhook_urls;
    if (webhookUrls === '[]' && env.IDLE_ALERT_WEBHOOK_URLS) {
      webhookUrls = env.IDLE_ALERT_WEBHOOK_URLS;
    }

    // 构建最终配置
    const config: IdleAlertConfig = {
      ...result,
      webhook_urls: webhookUrls,
    };

    // 验证时间格式（HH:mm）
    if (!isValidTimeFormat(config.time_range_start)) {
      console.warn(
        `[IDLE_ALERT] 无效的开始时间格式: ${config.time_range_start}，使用默认值 08:00`
      );
      config.time_range_start = '08:00';
    }

    if (!isValidTimeFormat(config.time_range_end)) {
      console.warn(
        `[IDLE_ALERT] 无效的结束时间格式: ${config.time_range_end}，使用默认值 17:00`
      );
      config.time_range_end = '17:00';
    }

    console.log('[IDLE_ALERT] 配置加载成功:', {
      threshold: config.idle_threshold_minutes,
      timeRange: `${config.time_range_start}-${config.time_range_end}`,
      enabled: config.enabled,
      webhookCount: JSON.parse(webhookUrls).length,
    });

    return config;
  } catch (error) {
    console.error('[IDLE_ALERT] 配置加载失败:', error);
    throw error;
  }
}

/**
 * 更新空闲提醒配置
 *
 * @param db D1 数据库实例
 * @param payload 更新参数
 * @returns 无返回值
 *
 * @remarks
 * 更新前会校验时间格式和阈值有效性
 */
export async function updateConfig(
  db: D1Database,
  payload: UpdateConfigPayload
): Promise<void> {
  try {
    // 验证参数
    if (payload.time_range_start && !isValidTimeFormat(payload.time_range_start)) {
      throw new Error(`无效的开始时间格式: ${payload.time_range_start}，应为 HH:mm`);
    }

    if (payload.time_range_end && !isValidTimeFormat(payload.time_range_end)) {
      throw new Error(`无效的结束时间格式: ${payload.time_range_end}，应为 HH:mm`);
    }

    if (
      payload.idle_threshold_minutes !== undefined &&
      (payload.idle_threshold_minutes < 1 || payload.idle_threshold_minutes > 1440)
    ) {
      throw new Error('空闲阈值必须在 1-1440 分钟之间');
    }

    if (
      payload.retry_times !== undefined &&
      (payload.retry_times < 0 || payload.retry_times > 10)
    ) {
      throw new Error('重试次数必须在 0-10 之间');
    }

    if (
      payload.retry_interval_seconds !== undefined &&
      (payload.retry_interval_seconds < 1 || payload.retry_interval_seconds > 300)
    ) {
      throw new Error('重试间隔必须在 1-300 秒之间');
    }

    // 验证 webhook_urls 格式
    if (payload.webhook_urls !== undefined) {
      try {
        const urls = JSON.parse(payload.webhook_urls);
        if (!Array.isArray(urls)) {
          throw new Error('webhook_urls 必须是 JSON 数组');
        }
        // 验证每个 URL 格式
        for (const url of urls) {
          if (typeof url !== 'string' || !url.startsWith('http')) {
            throw new Error(`无效的 Webhook URL: ${url}`);
          }
        }
      } catch (e) {
        throw new Error(`webhook_urls 格式错误: ${e}`);
      }
    }

    // 验证 enabled_station_ids 格式
    if (payload.enabled_station_ids !== undefined && payload.enabled_station_ids !== null) {
      try {
        const ids = JSON.parse(payload.enabled_station_ids);
        if (!Array.isArray(ids)) {
          throw new Error('enabled_station_ids 必须是 JSON 数组或 null');
        }
        // 验证每个 ID 是数字
        for (const id of ids) {
          if (typeof id !== 'number') {
            throw new Error(`无效的充电桩 ID: ${id}`);
          }
        }
      } catch (e) {
        throw new Error(`enabled_station_ids 格式错误: ${e}`);
      }
    }

    // 构建更新语句
    const updateFields: string[] = [];
    const params: any[] = [];

    if (payload.idle_threshold_minutes !== undefined) {
      updateFields.push('idle_threshold_minutes = ?');
      params.push(payload.idle_threshold_minutes);
    }

    if (payload.time_range_start !== undefined) {
      updateFields.push('time_range_start = ?');
      params.push(payload.time_range_start);
    }

    if (payload.time_range_end !== undefined) {
      updateFields.push('time_range_end = ?');
      params.push(payload.time_range_end);
    }

    if (payload.webhook_urls !== undefined) {
      updateFields.push('webhook_urls = ?');
      params.push(payload.webhook_urls);
    }

    if (payload.enabled_station_ids !== undefined) {
      updateFields.push('enabled_station_ids = ?');
      params.push(payload.enabled_station_ids);
    }

    if (payload.enabled !== undefined) {
      updateFields.push('enabled = ?');
      params.push(payload.enabled);
    }

    if (payload.retry_times !== undefined) {
      updateFields.push('retry_times = ?');
      params.push(payload.retry_times);
    }

    if (payload.retry_interval_seconds !== undefined) {
      updateFields.push('retry_interval_seconds = ?');
      params.push(payload.retry_interval_seconds);
    }

    if (updateFields.length === 0) {
      throw new Error('没有需要更新的字段');
    }

    // 添加更新时间
    updateFields.push('updated_at = ?');
    params.push(Math.floor(Date.now() / 1000));

    // 执行更新
    const sql = `UPDATE idle_alert_config SET ${updateFields.join(', ')} WHERE id = 1`;
    await db.prepare(sql).bind(...params).run();

    console.log('[IDLE_ALERT] 配置更新成功:', payload);
  } catch (error) {
    console.error('[IDLE_ALERT] 配置更新失败:', error);
    throw error;
  }
}

/**
 * 验证时间格式是否为 HH:mm
 *
 * @param time 时间字符串
 * @returns 是否有效
 */
function isValidTimeFormat(time: string): boolean {
  const regex = /^([0-1]\d|2[0-3]):([0-5]\d)$/;
  return regex.test(time);
}
