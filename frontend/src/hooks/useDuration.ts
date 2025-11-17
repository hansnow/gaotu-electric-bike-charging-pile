import { useEffect, useState } from 'react';
import type { ChargingEvent, SocketStatus } from '@/types';
import { DURATION_REFRESH_INTERVAL_MS } from '@/utils/constants';
import { formatDurationFromMs } from '@/utils/timeFormat';

const computeDuration = (
  stationId: number,
  socketId: number,
  status: SocketStatus,
  events: ChargingEvent[]
): string => {
  if (!events.length) {
    return '--';
  }

  const socketEvents = events
    .filter((event) => event.stationId === stationId && event.socketId === socketId)
    .sort((a, b) => b.timestamp - a.timestamp);

  if (!socketEvents.length) {
    return '--';
  }

  const latest = socketEvents[0];
  if (latest.newStatus !== status) {
    return '--';
  }

  const durationMs = Date.now() - latest.timestamp;
  return formatDurationFromMs(durationMs);
};

export const useDuration = (
  stationId: number,
  socketId: number,
  status: SocketStatus,
  events: ChargingEvent[],
  refreshInterval = DURATION_REFRESH_INTERVAL_MS
): string => {
  const [value, setValue] = useState('--');

  useEffect(() => {
    const update = () => {
      setValue(computeDuration(stationId, socketId, status, events));
    };

    update();
    const timer = setInterval(update, refreshInterval);
    return () => clearInterval(timer);
  }, [stationId, socketId, status, events, refreshInterval]);

  return value;
};
