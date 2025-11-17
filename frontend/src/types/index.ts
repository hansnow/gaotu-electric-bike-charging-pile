export type SocketStatus = 'available' | 'occupied';

export interface SocketInfo {
  id: number;
  status: SocketStatus;
}

export interface StationSummary {
  id: number;
  name: string;
  simId: string;
  sockets: SocketInfo[];
  online: boolean;
  address: string;
  errorMsg?: string;
  error?: boolean;
}

export interface ChargingEvent {
  id: string;
  stationId: number;
  stationName: string;
  socketId: number;
  oldStatus: SocketStatus;
  newStatus: SocketStatus;
  timestamp: number;
  timeString: string;
}

export interface EventsResponse {
  success: boolean;
  date: string;
  events: ChargingEvent[];
  error?: string;
}

export interface StationDetailDevice {
  name: string;
  portNumber: number;
  online: number;
  address: string;
  freePortCount: number;
}

export interface StationDetailPayload {
  simId: string;
  mapType: number;
  chargeTypeTag: number;
  appEntrance: number;
  version: string;
}

export interface StationDetailResponse {
  success: boolean;
  data?: {
    device: StationDetailDevice;
    ports: number[];
    errorMsg?: string;
  };
  error?: string;
}

export interface AlertConfig {
  idle_threshold_minutes: number;
  time_range_start: string;
  time_range_end: string;
  webhook_urls: string;
  enabled: number;
}

export interface AlertLog {
  id?: number;
  log_date: string;
  station_id: number;
  station_name: string;
  socket_id: number;
  idle_minutes: number;
  webhook_url: string;
  success: number;
  response_time_ms: number;
  triggered_at: number;
}

export interface AlertStatsSummary {
  total: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  avgResponseTime: number;
}

export interface AlertStatsByStation {
  station_id: number;
  station_name: string;
  total: number;
  success_count: number;
}

export interface AlertStatsTrendItem {
  log_date: string;
  total: number;
  success_count: number;
}

export interface AlertStats {
  summary: AlertStatsSummary;
  byStation: AlertStatsByStation[];
  trend: AlertStatsTrendItem[];
}

export interface TestWebhookResult {
  success: boolean;
  message: string;
  results?: Array<{
    url?: string;
    success: boolean;
    error?: string;
  }>;
}

export interface SocketModalPayload {
  station: StationSummary;
  socket: SocketInfo;
}
