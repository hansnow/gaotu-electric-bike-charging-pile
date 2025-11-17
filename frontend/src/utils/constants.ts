export const CHARGING_STATIONS = [
  { id: 1, name: '1号充电桩', simId: '867997075125699' },
  { id: 2, name: '2号充电桩', simId: '863060079195715' },
  { id: 3, name: '3号充电桩', simId: '863060079153326' }
] as const;

export const DEFAULT_PORT_COUNT = 20;
export const STATION_POLL_INTERVAL_MS = 30_000;
export const EVENT_POLL_INTERVAL_MS = 5 * 60_000;
export const DURATION_REFRESH_INTERVAL_MS = 30_000;
