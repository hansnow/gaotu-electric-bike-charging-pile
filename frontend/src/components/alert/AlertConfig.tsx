import { useEffect, useState } from 'react';
import type { AlertConfig as AlertConfigType } from '@/types';
import styles from './AlertConfig.module.css';

interface AlertConfigProps {
  config: AlertConfigType | null;
  loading?: boolean;
  saving?: boolean;
  testing?: boolean;
  token: string;
  onTokenChange: (value: string) => void;
  onRefresh: () => void;
  onSave: (payload: AlertConfigType) => void;
  onTest: () => void;
}

const DEFAULT_FORM: AlertConfigType = {
  idle_threshold_minutes: 30,
  time_range_start: '08:00',
  time_range_end: '17:00',
  webhook_urls: '[]',
  enabled: 1
};

export const AlertConfig = ({
  config,
  loading,
  saving,
  testing,
  token,
  onTokenChange,
  onRefresh,
  onSave,
  onTest
}: AlertConfigProps) => {
  const [form, setForm] = useState<AlertConfigType>(config || DEFAULT_FORM);

  useEffect(() => {
    if (config) {
      setForm(config);
    }
  }, [config]);

  const handleChange = (key: keyof AlertConfigType, value: string | number) => {
    setForm((prev) => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSubmit = () => {
    onSave(form);
  };

  return (
    <div className={styles.card}>
      <div className={styles.title}>⚙️ 提醒配置</div>
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <label className={styles.field}>
          <span className={styles.sectionTitle}>空闲阈值（分钟）</span>
          <input
            type="number"
            min={1}
            max={1440}
            className={styles.input}
            value={form.idle_threshold_minutes}
            onChange={(event) => handleChange('idle_threshold_minutes', Number(event.target.value))}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.sectionTitle}>时间窗口开始</span>
          <input
            type="time"
            className={styles.input}
            value={form.time_range_start}
            onChange={(event) => handleChange('time_range_start', event.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.sectionTitle}>时间窗口结束</span>
          <input
            type="time"
            className={styles.input}
            value={form.time_range_end}
            onChange={(event) => handleChange('time_range_end', event.target.value)}
          />
        </label>
        <label className={`${styles.field} ${styles.fullWidth}`}>
          <span className={styles.sectionTitle}>Webhook URLs（JSON 数组）</span>
          <textarea
            className={`${styles.input} ${styles.textarea}`}
            value={form.webhook_urls}
            onChange={(event) => handleChange('webhook_urls', event.target.value)}
          />
        </label>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={form.enabled === 1}
            onChange={(event) => handleChange('enabled', event.target.checked ? 1 : 0)}
          />
          启用空闲提醒
        </label>
      </form>

      <div className={styles.field}>
        <span className={styles.sectionTitle}>管理员 Token</span>
        <input
          type="password"
          placeholder="用于保存/测试操作"
          className={`${styles.input} ${styles.tokenInput}`}
          value={token}
          onChange={(event) => onTokenChange(event.target.value)}
        />
      </div>

      <div className={styles.actions}>
        <button type="button" className={styles.buttonPrimary} onClick={handleSubmit} disabled={saving || loading}>
          {saving ? '保存中...' : '保存配置'}
        </button>
        <button type="button" className={styles.buttonSecondary} onClick={onRefresh} disabled={loading}>
          刷新配置
        </button>
        <button type="button" className={styles.buttonSecondary} onClick={onTest} disabled={testing || !token}>
          {testing ? '测试中...' : '测试 Webhook'}
        </button>
      </div>
    </div>
  );
};
