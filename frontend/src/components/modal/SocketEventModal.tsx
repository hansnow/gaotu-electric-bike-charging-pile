import type { ChargingEvent, SocketInfo, StationSummary } from '@/types';
import styles from './SocketEventModal.module.css';
import { formatTimestamp } from '@/utils/timeFormat';

interface SocketEventModalProps {
  isOpen: boolean;
  station: StationSummary | null;
  socket: SocketInfo | null;
  events: ChargingEvent[];
  loading?: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export const SocketEventModal = ({
  isOpen,
  station,
  socket,
  events,
  loading,
  onClose,
  onRefresh
}: SocketEventModalProps) => {
  if (!isOpen || !station || !socket) {
    return null;
  }

  return (
    <div className={styles.backdrop} data-testid="socket-modal">
      <div className={styles.modal} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <div>
            <div className={styles.title} data-testid="modal-title">
              {station.name} · 插座 {socket.id}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>SIM: {station.simId}</div>
          </div>
          <div className={styles.actions}>
            <button type="button" className={styles.refreshBtn} onClick={onRefresh} disabled={loading}>
              {loading ? '刷新中...' : '刷新'}
            </button>
            <button type="button" className={styles.closeBtn} onClick={onClose}>
              关闭
            </button>
          </div>
        </div>
        <div className={styles.body}>
          <div className={styles.infoGrid}>
            <div>当前状态：{socket.status === 'available' ? '空闲' : '占用'}</div>
            <div>地址：{station.address}</div>
          </div>
          <div>
            <h3>状态变化历史（当天）</h3>
            <div className={styles.eventsList}>
              {events.length === 0 ? (
                <div style={{ color: '#94a3b8', padding: '16px 0' }}>暂无状态变化记录</div>
              ) : (
                events.map((event) => (
                  <div key={event.id} className={styles.eventCard}>
                    <div style={{ fontWeight: 600 }}>
                      {event.oldStatus === 'available' ? '空闲' : '占用'} →{' '}
                      {event.newStatus === 'available' ? '空闲' : '占用'}
                    </div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{formatTimestamp(event.timestamp)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
