/**
 * Webhook 发送模块
 *
 * @remarks
 * 负责向 Webhook URL 发送空闲提醒，支持超时控制、失败重试、并行发送
 */

/**
 * Webhook 发送结果接口
 */
export interface SendResult {
  /** Webhook URL */
  url: string;
  /** 是否成功 */
  success: boolean;
  /** HTTP 状态码 */
  status?: number;
  /** 响应体（截断到 1024 字符） */
  body?: string;
  /** 错误信息 */
  error?: string;
  /** 重试次数 */
  retryCount: number;
  /** 耗时（毫秒） */
  elapsedMs: number;
}

/**
 * 重试配置接口
 */
export interface RetryConfig {
  /** 重试次数 */
  retryTimes: number;
  /** 重试间隔（秒） */
  retryIntervalSeconds: number;
}

/**
 * Webhook Payload 接口
 */
export interface WebhookPayload {
  alertType: 'socket_idle';
  timestamp: number;
  timeString: string;
  station: {
    id: number;
    name: string;
  };
  socket: {
    id: number;
    status: string;
    idleMinutes: number;
    idleStartTime: number;
    idleStartTimeString: string;
  };
  config: {
    threshold: number;
    timeRange: string;
  };
}

/**
 * 发送 Webhook 到单个 URL（支持重试）
 *
 * @param url Webhook URL
 * @param payload 请求体
 * @param retryConfig 重试配置
 * @param fetchImpl fetch 实现（默认使用全局 fetch）
 * @returns 发送结果
 */
export async function sendWebhook(
  url: string,
  payload: WebhookPayload,
  retryConfig: RetryConfig,
  fetchImpl: typeof fetch = fetch
): Promise<SendResult> {
  const startTime = Date.now();
  let lastError: string | undefined;
  let retryCount = 0;

  const maxAttempts = retryConfig.retryTimes + 1; // 首次尝试 + 重试次数

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // 如果是重试，等待指定时间
      if (attempt > 0) {
        await sleep(retryConfig.retryIntervalSeconds * 1000);
        retryCount++;
      }

      // 发送请求（带超时控制）
      const response = await withTimeout(
        fetchImpl(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Cloudflare-Worker/Idle-Alert',
          },
          body: JSON.stringify(payload),
        }),
        5000 // 5 秒超时
      );

      const status = response.status;
      let body = '';

      try {
        const text = await response.text();
        body = text.substring(0, 1024); // 截断到 1024 字符
      } catch (e) {
        body = '(响应体读取失败)';
      }

      const elapsedMs = Date.now() - startTime;

      // 判断是否成功（2xx 状态码）
      if (status >= 200 && status < 300) {
        return {
          url,
          success: true,
          status,
          body,
          retryCount,
          elapsedMs,
        };
      } else {
        lastError = `HTTP ${status}: ${body}`;

        // 如果是 4xx 错误，不重试
        if (status >= 400 && status < 500) {
          console.warn(`[IDLE_ALERT] Webhook 客户端错误，不重试: ${url} ${lastError}`);
          return {
            url,
            success: false,
            status,
            body,
            error: lastError,
            retryCount,
            elapsedMs,
          };
        }

        // 5xx 错误或其他错误，继续重试
        console.warn(
          `[IDLE_ALERT] Webhook 发送失败 (尝试 ${attempt + 1}/${maxAttempts}): ${url} ${lastError}`
        );
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      console.warn(
        `[IDLE_ALERT] Webhook 请求异常 (尝试 ${attempt + 1}/${maxAttempts}): ${url} ${lastError}`
      );
    }
  }

  // 所有尝试都失败
  const elapsedMs = Date.now() - startTime;
  return {
    url,
    success: false,
    error: lastError,
    retryCount,
    elapsedMs,
  };
}

/**
 * 发送 Webhook 到多个 URL（并行）
 *
 * @param urls Webhook URLs
 * @param payload 请求体
 * @param retryConfig 重试配置
 * @param fetchImpl fetch 实现（默认使用全局 fetch）
 * @returns 发送结果数组
 */
export async function sendToAll(
  urls: string[],
  payload: WebhookPayload,
  retryConfig: RetryConfig,
  fetchImpl: typeof fetch = fetch
): Promise<SendResult[]> {
  if (urls.length === 0) {
    console.warn('[IDLE_ALERT] Webhook URLs 为空，跳过发送');
    return [];
  }

  console.log(`[IDLE_ALERT] 开始发送 Webhook 到 ${urls.length} 个 URL`);

  // 并行发送到所有 URL
  const results = await Promise.all(
    urls.map((url) => sendWebhook(url, payload, retryConfig, fetchImpl))
  );

  // 统计成功和失败数量
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;

  console.log(`[IDLE_ALERT] Webhook 发送完成: 成功 ${successCount}, 失败 ${failureCount}`);

  return results;
}

/**
 * 为 fetch 请求添加超时控制
 *
 * @param fetchPromise fetch Promise
 * @param timeoutMs 超时时间（毫秒）
 * @returns 带超时控制的 Response
 *
 * @remarks
 * 使用 AbortController + setTimeout 实现，避免使用 AbortSignal.timeout（Workers 不支持）
 */
async function withTimeout(
  fetchPromise: Promise<Response>,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const signal = controller.signal;

  // 创建超时 Promise
  const timeoutPromise = new Promise<Response>((_, reject) => {
    setTimeout(() => {
      controller.abort();
      reject(new Error(`请求超时 (${timeoutMs}ms)`));
    }, timeoutMs);
  });

  // 竞争：fetch 或超时
  try {
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    controller.abort();
    throw error;
  }
}

/**
 * 异步睡眠
 *
 * @param ms 毫秒数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
