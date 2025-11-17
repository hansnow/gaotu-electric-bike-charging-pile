import type { ChargingEvent, StationSummary, SocketInfo } from '@/types';
import { SocketGrid } from './SocketGrid';
import styles from './ChargingStation.module.css';

interface ChargingStationProps {
  station: StationSummary;
  events: ChargingEvent[];
  onSocketClick?: (station: StationSummary, socket: SocketInfo) => void;
}

export const ChargingStation = ({ station, events, onSocketClick }: ChargingStationProps) => {
  const available = station.sockets.filter((socket) => socket.status === 'available').length;
  const occupied = station.sockets.length - available;
  const offline = station.error || !station.online;

  const handleSocketClick = (socket: SocketInfo) => {
    if (onSocketClick) {
      onSocketClick(station, socket);
    }
  };

  return (
    <div className={styles.card} data-testid={`station-${station.id}`}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span>{station.name}</span>
          <span className={offline ? styles.statusOffline : styles.statusOnline}>
            {offline ? '离线' : '在线'}
          </span>
        </div>
        <div className={styles.stats}>
          <span>空闲：{available}</span>
          <span>占用：{occupied}</span>
          <span>总计：{station.sockets.length || 0}</span>
        </div>
        <div className={styles.address}>📍 {station.address}</div>
      </div>

      {offline && station.errorMsg ? (
        <div className={styles.offlineMessage}>{station.errorMsg}</div>
      ) : null}

      <SocketGrid
        stationId={station.id}
        sockets={station.sockets}
        events={events}
        offline={offline}
        onSocketClick={handleSocketClick}
      />
    </div>
  );
};
