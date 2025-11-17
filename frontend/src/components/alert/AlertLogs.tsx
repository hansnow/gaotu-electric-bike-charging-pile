import type { AlertLog } from '@/types';
import { formatTimestamp } from '@/utils/timeFormat';
import styles from './AlertLogs.module.css';

interface AlertLogsProps {
  logs: AlertLog[];
  loading?: boolean;
  selectedDate: string;
  onDateChange: (value: string) => void;
  onRefresh: () => void;
}

export const AlertLogs = ({ logs, loading, selectedDate, onDateChange, onRefresh }: AlertLogsProps) => (
  <div className={styles.card}>
    <div className={styles.header}>
      <h2>📋 提醒日志</h2>
      <div style={{ display: 'flex', gap: '12px' }}>
        <input
          type="date"
          value={selectedDate}
          onChange={(event) => onDateChange(event.target.value)}
          className={styles.dateInput}
        />
        <button type="button" className={styles.actionBtn} onClick={onRefresh} disabled={loading}>
          {loading ? '查询中...' : '查询日志'}
        </button>
      </div>
    </div>

    {logs.length === 0 ? (
      <div className={styles.empty}>{loading ? '正在加载日志...' : '该日期暂无提醒日志'}</div>
    ) : (
      <div className={styles.tableWrapper}>
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>充电桩</th>
              <th>插座</th>
              <th>空闲时长</th>
              <th>Webhook</th>
              <th>状态</th>
              <th>响应时间</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log) => (
              <tr key={`${log.station_id}-${log.socket_id}-${log.triggered_at}`}>
                <td>{formatTimestamp(log.triggered_at * 1000)}</td>
                <td>{log.station_name}</td>
                <td>{log.socket_id}</td>
                <td>{log.idle_minutes} 分钟</td>
                <td title={log.webhook_url}>{log.webhook_url}</td>
                <td>
                  <span className={`${styles.badge} ${log.success ? styles.success : styles.failed}`}>
                    {log.success ? '成功' : '失败'}
                  </span>
                </td>
                <td>{log.response_time_ms} ms</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
