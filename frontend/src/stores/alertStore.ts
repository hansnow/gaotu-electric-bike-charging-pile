import { create } from 'zustand';
import type { AlertConfig, AlertLog, AlertStats, TestWebhookResult } from '@/types';
import { alertService, type AlertConfigPayload } from '@/services/alertService';

interface AlertState {
  config: AlertConfig | null;
  configLoading: boolean;
  configError: string | null;
  logs: AlertLog[];
  logsLoading: boolean;
  logsError: string | null;
  stats: AlertStats | null;
  statsLoading: boolean;
  statsError: string | null;
  lastLogsDate: string | null;
  loadConfig: () => Promise<void>;
  saveConfig: (payload: AlertConfigPayload, token: string) => Promise<void>;
  loadLogs: (date: string) => Promise<AlertLog[]>;
  loadStats: () => Promise<void>;
  testWebhook: (token: string) => Promise<TestWebhookResult>;
}

export const useAlertStore = create<AlertState>((set, get) => ({
  config: null,
  configLoading: false,
  configError: null,
  logs: [],
  logsLoading: false,
  logsError: null,
  stats: null,
  statsLoading: false,
  statsError: null,
  lastLogsDate: null,
  loadConfig: async () => {
    set({ configLoading: true, configError: null });
    try {
      const config = await alertService.getConfig();
      set({ config, configLoading: false });
    } catch (error) {
      set({
        configLoading: false,
        configError: error instanceof Error ? error.message : '加载配置失败'
      });
      throw error;
    }
  },
  saveConfig: async (payload, token) => {
    await alertService.saveConfig(payload, token);
    await get().loadConfig();
  },
  loadLogs: async (date) => {
    set({ logsLoading: true, logsError: null });
    try {
      const logs = await alertService.getLogs(date);
      set({ logs, logsLoading: false, lastLogsDate: date });
      return logs;
    } catch (error) {
      set({
        logsLoading: false,
        logsError: error instanceof Error ? error.message : '加载日志失败'
      });
      throw error;
    }
  },
  loadStats: async () => {
    set({ statsLoading: true, statsError: null });
    try {
      const stats = await alertService.getStats();
      set({ stats, statsLoading: false });
    } catch (error) {
      set({
        statsLoading: false,
        statsError: error instanceof Error ? error.message : '加载统计失败'
      });
      throw error;
    }
  },
  testWebhook: async (token) => alertService.testWebhook(token)
}));
