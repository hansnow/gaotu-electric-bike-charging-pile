import { useCallback, useMemo, useState } from 'react';
import { Legend } from '@/components/common/Legend';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { ErrorMessage } from '@/components/common/ErrorMessage';
import { ChargingStation } from '@/components/station/ChargingStation';
import { EventList } from '@/components/event/EventList';
import { SocketEventModal } from '@/components/modal/SocketEventModal';
import { useStationStore } from '@/stores/stationStore';
import { useEventStore } from '@/stores/eventStore';
import { usePolling } from '@/hooks/usePolling';
import { useModal } from '@/hooks/useModal';
import { STATION_POLL_INTERVAL_MS, EVENT_POLL_INTERVAL_MS } from '@/utils/constants';
import type { SocketModalPayload } from '@/types';
import styles from './StatusView.module.css';

export const StatusView = () => {
  const { stations, loading, error, fetchStations } = useStationStore();
  const {
    events,
    loading: eventsLoading,
    error: eventsError,
    selectedDate,
    setSelectedDate,
    fetchEvents,
    getEventsBySocket
  } = useEventStore();

  const modal = useModal<SocketModalPayload>();
  const [refreshing, setRefreshing] = useState(false);
  const [modalRefreshing, setModalRefreshing] = useState(false);

  const loadStations = useCallback(async () => {
    try {
      await fetchStations();
    } catch (err) {
      console.error(err);
    }
  }, [fetchStations]);

  const loadEvents = useCallback(async (date?: string) => {
    try {
      await fetchEvents(date ?? selectedDate);
    } catch (err) {
      console.error(err);
    }
  }, [fetchEvents, selectedDate]);

  usePolling(loadStations, { interval: STATION_POLL_INTERVAL_MS, enabled: true });
  usePolling(loadEvents, { interval: EVENT_POLL_INTERVAL_MS, enabled: true });

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadStations();
    setRefreshing(false);
  };

  const handleSocketClick = (payload: SocketModalPayload) => {
    modal.open(payload);
  };

  const modalEvents = useMemo(() => {
    if (!modal.payload) return [];
    return getEventsBySocket(modal.payload.station.id, modal.payload.socket.id);
  }, [modal.payload, getEventsBySocket]);

  const refreshModalEvents = async () => {
    setModalRefreshing(true);
    await loadEvents();
    setModalRefreshing(false);
  };

  const handleDateChange = async (value: string) => {
    setSelectedDate(value);
    await loadEvents(value);
  };

  return (
    <div className={styles.section}>
      <Legend />

      {loading && stations.length === 0 ? (
        <LoadingSpinner message="正在加载充电桩状态..." />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : (
        <>
          <div className={styles.stationGrid}>
            {stations.map((station) => (
              <ChargingStation
                key={station.id}
                station={station}
                events={events}
                onSocketClick={(st, socket) => handleSocketClick({ station: st, socket })}
              />
            ))}
          </div>
          <button type="button" className={styles.refreshBtn} onClick={handleManualRefresh} disabled={refreshing}>
            {refreshing ? '刷新中...' : '刷新状态'}
          </button>
        </>
      )}

      <EventList
        events={events}
        loading={eventsLoading}
        error={eventsError}
        selectedDate={selectedDate}
        onDateChange={handleDateChange}
        onRefresh={() => loadEvents()}
      />

      <SocketEventModal
        isOpen={modal.isOpen}
        station={modal.payload?.station ?? null}
        socket={modal.payload?.socket ?? null}
        events={modalEvents}
        loading={modalRefreshing}
        onClose={modal.close}
        onRefresh={refreshModalEvents}
      />
    </div>
  );
};
