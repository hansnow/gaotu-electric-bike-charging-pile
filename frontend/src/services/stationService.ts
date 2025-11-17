import type { StationDetailResponse, StationSummary, SocketInfo } from '@/types';
import { CHARGING_STATIONS, DEFAULT_PORT_COUNT } from '@/utils/constants';

const DEFAULT_DETAIL_PARAMS = {
  mapType: 2,
  chargeTypeTag: 0,
  appEntrance: 1,
  version: 'new'
};

const buildFallbackSockets = (count = DEFAULT_PORT_COUNT): SocketInfo[] =>
  Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    status: 'available'
  }));

const parsePortStatus = (ports: number[], totalPorts: number): SocketInfo[] => {
  const sockets: SocketInfo[] = [];
  const normalizedPorts = ports.slice(1); // index 0 无意义
  const size = totalPorts || DEFAULT_PORT_COUNT;

  for (let i = 0; i < Math.min(size, normalizedPorts.length); i += 1) {
    sockets.push({
      id: i + 1,
      status: normalizedPorts[i] === 0 ? 'available' : 'occupied'
    });
  }

  for (let i = normalizedPorts.length; i < size; i += 1) {
    sockets.push({ id: i + 1, status: 'available' });
  }

  return sockets;
};

const buildStationFromResponse = (
  stationId: number,
  name: string,
  simId: string,
  payload: StationDetailResponse
): StationSummary => {
  if (!payload.success || !payload.data) {
    return {
      id: stationId,
      name,
      simId,
      sockets: buildFallbackSockets(),
      online: false,
      address: '未知',
      error: true,
      errorMsg: payload.error || '获取数据失败'
    };
  }

  const { device, ports = [], errorMsg } = payload.data;
  const sockets = parsePortStatus(ports, device.portNumber);

  return {
    id: stationId,
    name,
    simId,
    sockets,
    online: device.online === 1,
    address: device.address || '未知地址',
    errorMsg
  };
};

const fetchDetail = async (simId: string): Promise<StationDetailResponse> => {
  const response = await fetch('/detail', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...DEFAULT_DETAIL_PARAMS,
      simId
    })
  });

  if (!response.ok) {
    throw new Error(`获取充电桩 ${simId} 失败 (${response.status})`);
  }

  return response.json();
};

const fetchStations = async (): Promise<StationSummary[]> => {
  const result = await Promise.all(
    CHARGING_STATIONS.map(async (station) => {
      try {
        const detail = await fetchDetail(station.simId);
        return buildStationFromResponse(station.id, station.name, station.simId, detail);
      } catch (error) {
        return {
          id: station.id,
          name: station.name,
          simId: station.simId,
          sockets: [],
          online: false,
          address: '未知',
          error: true,
          errorMsg: error instanceof Error ? error.message : '未知错误'
        } satisfies StationSummary;
      }
    })
  );

  return result;
};

export const stationService = {
  fetchStations
};
