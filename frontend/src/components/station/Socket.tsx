import type { ChargingEvent, SocketInfo } from '@/types';
import { useDuration } from '@/hooks/useDuration';
import styles from './Socket.module.css';

interface SocketProps {
  stationId: number;
  socket: SocketInfo;
  events: ChargingEvent[];
  disabled?: boolean;
  onClick?: (socket: SocketInfo) => void;
}

export const Socket = ({ stationId, socket, events, disabled, onClick }: SocketProps) => {
  const duration = useDuration(stationId, socket.id, socket.status, events);

  const handleClick = () => {
    if (!disabled && onClick) {
      onClick(socket);
    }
  };

  return (
    <div
      className={`${styles.socket} ${styles[socket.status]} ${disabled ? styles.offline : ''}`}
      data-testid={`socket-${stationId}-${socket.id}`}
      data-socket-id={socket.id}
      role="button"
      aria-label={`插座 ${socket.id} 当前${socket.status === 'available' ? '空闲' : '占用'}`}
      onClick={handleClick}
    >
      <div className={styles.number}>#{socket.id}</div>
      <div className={styles.status}>{socket.status === 'available' ? '空闲' : '占用'}</div>
      <div className={styles.duration}>{disabled ? '--:--' : duration}</div>
    </div>
  );
};
