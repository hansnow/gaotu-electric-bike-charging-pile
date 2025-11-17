import { useEffect, useState } from 'react';
import { AlertConfig } from '@/components/alert/AlertConfig';
import { AlertLogs } from '@/components/alert/AlertLogs';
import { AlertStatsPanel } from '@/components/alert/AlertStats';
import { useAlertStore } from '@/stores/alertStore';
import { getTodayDateString } from '@/utils/timeFormat';
import styles from './AlertView.module.css';
import type { AlertConfig as AlertConfigType } from '@/types';

export const AlertView = () => {
  const {
    config,
    configLoading,
    logs,
    logsLoading,
    stats,
    statsLoading,
    loadConfig,
    saveConfig,
    loadLogs,
    loadStats,
    testWebhook
  } = useAlertStore();

  const [token, setToken] = useState('');
  const [selectedLogDate, setSelectedLogDate] = useState(getTodayDateString());
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const savedToken = localStorage.getItem('adminToken');
    if (savedToken) {
      setToken(savedToken);
    }
    void loadConfig();
    void loadStats();
  }, [loadConfig, loadStats]);

  const handleTokenChange = (value: string) => {
    setToken(value);
    localStorage.setItem('adminToken', value);
  };

  const handleSaveConfig = async (payload: AlertConfigType) => {
    if (!token) {
      alert('请先填写管理员 Token');
      return;
    }
    setSaving(true);
    try {
      await saveConfig(payload, token);
      alert('配置保存成功');
    } catch (error) {
      alert(error instanceof Error ? error.message : '配置保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadLogs = async () => {
    try {
      await loadLogs(selectedLogDate);
    } catch (error) {
      alert(error instanceof Error ? error.message : '日志加载失败');
    }
  };

  const handleTestWebhook = async () => {
    if (!token) {
      alert('请先填写管理员 Token');
      return;
    }
    setTesting(true);
    try {
      const result = await testWebhook(token);
      const successCount = result.results?.filter((item) => item.success).length ?? 0;
      const total = result.results?.length ?? 0;
      alert(`测试完成：${successCount}/${total} 成功`);
    } catch (error) {
      alert(error instanceof Error ? error.message : '测试失败');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className={styles.layout}>
      <AlertConfig
        config={config}
        loading={configLoading}
        saving={saving}
        testing={testing}
        token={token}
        onTokenChange={handleTokenChange}
        onRefresh={() => void loadConfig()}
        onSave={handleSaveConfig}
        onTest={handleTestWebhook}
      />

      <AlertLogs
        logs={logs}
        loading={logsLoading}
        selectedDate={selectedLogDate}
        onDateChange={setSelectedLogDate}
        onRefresh={handleLoadLogs}
      />

      <AlertStatsPanel stats={stats} loading={statsLoading} onRefresh={() => void loadStats()} />
    </div>
  );
};
