import type { ChargingEvent, SocketInfo } from '@/types';
import { Socket } from './Socket';
import styles from './SocketGrid.module.css';

interface SocketGridProps {
  stationId: number;
  sockets: SocketInfo[];
  events: ChargingEvent[];
  offline?: boolean;
  onSocketClick?: (socket: SocketInfo) => void;
}

export const SocketGrid = ({ stationId, sockets, events, offline, onSocketClick }: SocketGridProps) => (
  <div className={styles.grid}>
    {sockets.map((socket) => (
      <Socket
        key={socket.id}
        stationId={stationId}
        socket={socket}
        events={events}
        disabled={offline}
        onClick={onSocketClick}
      />
    ))}
  </div>
);
