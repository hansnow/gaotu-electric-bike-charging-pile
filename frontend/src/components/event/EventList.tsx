import type { ChargingEvent } from '@/types';
import { formatTimestamp } from '@/utils/timeFormat';
import styles from './EventList.module.css';

interface EventListProps {
  events: ChargingEvent[];
  loading: boolean;
  error?: string | null;
  selectedDate: string;
  onDateChange: (value: string) => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
}

export const EventList = ({ events, loading, error, selectedDate, onDateChange, onRefresh }: EventListProps) => (
  <div className={styles.container}>
    <div className={styles.header}>
      <div className={styles.title}>📊 状态变化事件</div>
      <div className={styles.controls}>
        <input
          type="date"
          value={selectedDate}
          onChange={(event) => onDateChange(event.target.value)}
          className={styles.dateInput}
          data-testid="event-date-input"
        />
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={onRefresh}
          disabled={loading}
          data-testid="load-events-btn"
        >
          {loading ? '查询中...' : '查询事件'}
        </button>
      </div>
    </div>

    {events.length === 0 ? (
      <div className={styles.empty}>
        {loading ? '正在加载事件...' : error || '暂无事件数据'}
      </div>
    ) : (
      <div className={styles.list}>
        {events.map((event) => (
          <div
            className={styles.item}
            key={event.id}
            data-testid={`event-item-${event.id}`}
          >
            <div>
              <div className={styles.itemStatus}>
                {event.stationName} · 插座 {event.socketId}
              </div>
              <div className={styles.itemMeta}>
                <span>{formatTimestamp(event.timestamp)}</span>
                <span>
                  {event.oldStatus === 'available' ? '空闲' : '占用'} →{' '}
                  {event.newStatus === 'available' ? '空闲' : '占用'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);
