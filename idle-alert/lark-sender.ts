/**
 * 飞书消息发送模块
 *
 * @remarks
 * 负责向飞书发送空闲提醒消息
 */

/**
 * 飞书消息发送配置
 */
export interface LarkConfig {
  /** 飞书鉴权令牌 */
  authToken: string;
  /** 飞书群组 ID（可选，如果配置了默认群组可不传） */
  chatId?: string;
  /** 是否启用飞书提醒 */
  enabled: boolean;
}

/**
 * 飞书消息发送结果
 */
export interface LarkSendResult {
  /** 是否成功 */
  success: boolean;
  /** 飞书消息 ID */
  messageId?: string;
  /** 错误信息 */
  error?: string;
  /** 耗时（毫秒） */
  elapsedMs: number;
}

/**
 * 飞书消息内容
 */
export interface LarkMessageContent {
  /** 充电桩编号 */
  stationId: number;
  /** 充电桩名称 */
  stationName: string;
  /** 插座编号 */
  socketId: number;
  /** 空闲分钟数 */
  idleMinutes: number;
}

/**
 * 飞书 API 请求体
 */
interface LarkApiRequest {
  auth_token: string;
  chat_id?: string;
  msg_type?: string;
  content: string;
}

/**
 * 飞书 API 响应体
 */
interface LarkApiResponse {
  success: boolean;
  message?: string;
  data?: {
    message_id: string;
  };
  error?: string;
}

/**
 * 飞书消息 API 地址
 */
const LARK_API_URL = 'https://lark-messager.hansnow.me';

/**
 * 构建飞书消息文本
 *
 * @param content 消息内容
 * @returns 消息文本
 *
 * @remarks
 * 消息模板：x号充电桩y号插座已经空闲z分钟啦
 */
function buildLarkMessage(content: LarkMessageContent): string {
  return `${content.stationId}号充电桩${content.socketId}号插座已经空闲${content.idleMinutes}分钟啦`;
}

/**
 * 发送飞书消息
 *
 * @param config 飞书配置
 * @param content 消息内容
 * @param fetchImpl fetch 实现（默认使用全局 fetch）
 * @returns 发送结果
 */
export async function sendLarkMessage(
  config: LarkConfig,
  content: LarkMessageContent,
  fetchImpl: typeof fetch = fetch
): Promise<LarkSendResult> {
  const startTime = Date.now();

  // 如果未启用，直接返回成功
  if (!config.enabled) {
    console.log('[IDLE_ALERT] 飞书提醒未启用，跳过发送');
    return {
      success: true,
      elapsedMs: 0,
    };
  }

  // 验证配置
  if (!config.authToken) {
    console.error('[IDLE_ALERT] 飞书 auth_token 未配置');
    return {
      success: false,
      error: '飞书 auth_token 未配置',
      elapsedMs: 0,
    };
  }

  try {
    // 构建消息文本
    const messageText = buildLarkMessage(content);
    console.log(`[IDLE_ALERT] 准备发送飞书消息: ${messageText}`);

    // 构建请求体
    const requestBody: LarkApiRequest = {
      auth_token: config.authToken,
      content: JSON.stringify({ text: messageText }),
    };

    // 如果配置了 chat_id，添加到请求体
    if (config.chatId) {
      requestBody.chat_id = config.chatId;
    }

    // 发送请求
    const response = await fetchImpl(LARK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Cloudflare-Worker/Idle-Alert',
      },
      body: JSON.stringify(requestBody),
    });

    const elapsedMs = Date.now() - startTime;

    // 解析响应
    let responseData: LarkApiResponse;
    try {
      responseData = await response.json();
    } catch (e) {
      console.error('[IDLE_ALERT] 飞书 API 响应解析失败:', e);
      return {
        success: false,
        error: '飞书 API 响应解析失败',
        elapsedMs,
      };
    }

    // 判断是否成功
    if (responseData.success && responseData.data?.message_id) {
      console.log(`[IDLE_ALERT] 飞书消息发送成功: ${responseData.data.message_id}`);
      return {
        success: true,
        messageId: responseData.data.message_id,
        elapsedMs,
      };
    } else {
      console.error('[IDLE_ALERT] 飞书消息发送失败:', responseData.error);
      return {
        success: false,
        error: responseData.error || '飞书消息发送失败',
        elapsedMs,
      };
    }
  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[IDLE_ALERT] 飞书消息发送异常:', errorMessage);
    return {
      success: false,
      error: errorMessage,
      elapsedMs,
    };
  }
}

/**
 * 批量发送飞书消息（用于多个空闲插座）
 *
 * @param config 飞书配置
 * @param contents 消息内容数组
 * @param fetchImpl fetch 实现（默认使用全局 fetch）
 * @returns 发送结果数组
 */
export async function sendLarkMessages(
  config: LarkConfig,
  contents: LarkMessageContent[],
  fetchImpl: typeof fetch = fetch
): Promise<LarkSendResult[]> {
  if (!config.enabled) {
    console.log('[IDLE_ALERT] 飞书提醒未启用，跳过发送');
    return [];
  }

  if (contents.length === 0) {
    console.log('[IDLE_ALERT] 没有需要发送的飞书消息');
    return [];
  }

  console.log(`[IDLE_ALERT] 准备发送 ${contents.length} 条飞书消息`);

  // 顺序发送（避免并发导致的消息顺序混乱）
  const results: LarkSendResult[] = [];
  for (const content of contents) {
    const result = await sendLarkMessage(config, content, fetchImpl);
    results.push(result);

    // 每条消息之间间隔 100ms，避免频率限制
    if (contents.length > 1) {
      await sleep(100);
    }
  }

  // 统计结果
  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.length - successCount;
  console.log(`[IDLE_ALERT] 飞书消息发送完成: 成功 ${successCount}, 失败 ${failureCount}`);

  return results;
}

/**
 * 异步睡眠
 *
 * @param ms 毫秒数
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
