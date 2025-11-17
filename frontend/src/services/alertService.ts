import type {
  AlertConfig,
  AlertLog,
  AlertStats,
  TestWebhookResult
} from '@/types';

interface AlertConfigResponse {
  success: boolean;
  data?: AlertConfig;
  error?: string;
}

interface AlertLogsResponse {
  success: boolean;
  data: AlertLog[];
  count: number;
  error?: string;
}

interface AlertStatsResponse {
  success: boolean;
  data?: AlertStats;
  error?: string;
}

export type AlertConfigPayload = Partial<AlertConfig>;

const ensureOk = async (response: Response): Promise<void> => {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`请求失败 (${response.status}): ${text}`);
  }
};

const getConfig = async (): Promise<AlertConfig> => {
  const response = await fetch('/api/alert/config');
  await ensureOk(response);
  const payload = (await response.json()) as AlertConfigResponse;
  if (!payload.success || !payload.data) {
    throw new Error(payload.error || '空闲提醒配置加载失败');
  }
  return payload.data;
};

const saveConfig = async (payload: AlertConfigPayload, token: string): Promise<void> => {
  const response = await fetch('/api/alert/config', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': token
    },
    body: JSON.stringify(payload)
  });
  await ensureOk(response);
  const result = (await response.json()) as { success: boolean; error?: string };
  if (!result.success) {
    throw new Error(result.error || '配置保存失败');
  }
};

const testWebhook = async (token: string): Promise<TestWebhookResult> => {
  const response = await fetch('/api/alert/test', {
    method: 'POST',
    headers: {
      'X-Admin-Token': token
    }
  });
  await ensureOk(response);
  return response.json() as Promise<TestWebhookResult>;
};

const getLogs = async (date: string): Promise<AlertLog[]> => {
  const response = await fetch(`/api/alert/logs?date=${date}&limit=100`);
  await ensureOk(response);
  const payload = (await response.json()) as AlertLogsResponse;
  if (!payload.success) {
    throw new Error(payload.error || '提醒日志加载失败');
  }
  return payload.data;
};

const getStats = async (): Promise<AlertStats> => {
  const response = await fetch('/api/alert/stats');
  await ensureOk(response);
  const payload = (await response.json()) as AlertStatsResponse;
  if (!payload.success || !payload.data) {
    throw new Error(payload.error || '提醒统计加载失败');
  }
  return payload.data;
};

export const alertService = {
  getConfig,
  saveConfig,
  testWebhook,
  getLogs,
  getStats
};
