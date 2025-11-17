import { useState } from 'react';
import { StatusView } from '@/views/StatusView';
import { AlertView } from '@/views/AlertView';
import styles from './App.module.css';

const TABS = [
  { id: 'status', label: '充电桩状态' },
  { id: 'alerts', label: '空闲提醒' }
] as const;

type TabId = (typeof TABS)[number]['id'];

export const App = () => {
  const [tab, setTab] = useState<TabId>('status');

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div className={styles.title}>充电桩状态监控（新版本）</div>
        <p className={styles.subtitle}>React + Vite 驱动的全新前端，支持实时状态、事件追踪与空闲提醒管理。</p>
        <div className={styles.versionBadge}>
          <span>⚡</span>
          <span>Beta 版本</span>
        </div>
      </header>

      <div className={styles.tabs}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={`${styles.tabButton} ${tab === id ? styles.tabActive : ''}`}
            onClick={() => setTab(id)}
            data-testid={`tab-${id}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'status' ? <StatusView /> : <AlertView />}
    </div>
  );
};
