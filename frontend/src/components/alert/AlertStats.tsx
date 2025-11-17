import type { AlertStats } from '@/types';
import styles from './AlertStats.module.css';

interface AlertStatsProps {
  stats: AlertStats | null;
  loading?: boolean;
  onRefresh: () => void;
}

const formatRate = (value: number) => `${value ?? 0}%`;

export const AlertStatsPanel = ({ stats, loading, onRefresh }: AlertStatsProps) => (
  <div className={styles.card}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
      <h2>📊 统计信息（近7天）</h2>
      <button type="button" onClick={onRefresh} style={{ border: 'none', background: '#4f46e5', color: '#fff', borderRadius: 10, padding: '8px 16px', fontWeight: 600 }}>
        {loading ? '刷新中...' : '刷新统计'}
      </button>
    </div>

    {!stats ? (
      <div className={styles.empty}>{loading ? '统计信息加载中...' : '暂无统计数据'}</div>
    ) : (
      <>
        <div className={styles.grid}>
          <div className={styles.stat}>
            <div className={styles.statTitle}>总提醒次数</div>
            <div className={styles.statValue}>{stats.summary.total}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statTitle}>成功次数</div>
            <div className={styles.statValue}>{stats.summary.successCount}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statTitle}>失败次数</div>
            <div className={styles.statValue}>{stats.summary.failedCount}</div>
          </div>
          <div className={styles.stat}>
            <div className={styles.statTitle}>成功率</div>
            <div className={styles.statValue}>{formatRate(stats.summary.successRate)}</div>
          </div>
        </div>

        {stats.byStation.length > 0 && (
          <div className={styles.table}>
            <h3>按充电桩统计</h3>
            <table>
              <thead>
                <tr>
                  <th>充电桩</th>
                  <th>总次数</th>
                  <th>成功次数</th>
                  <th>成功率</th>
                </tr>
              </thead>
              <tbody>
                {stats.byStation.map((station) => (
                  <tr key={station.station_id}>
                    <td>{station.station_name}</td>
                    <td>{station.total}</td>
                    <td>{station.success_count}</td>
                    <td>{station.total > 0 ? `${Math.round((station.success_count / station.total) * 100)}%` : '0%'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    )}
  </div>
);
