import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDeviceDetail } from './util';
import type { ApiResponse, ChargingDeviceDetail, DeviceDetailRequest } from './types';

const baseParams: DeviceDetailRequest = {
  simId: '867997075125699',
  mapType: 2,
  chargeTypeTag: 0,
  appEntrance: 1,
  version: 'new',
};

function createFetchResponse<T>(payload: T, ok: boolean = true) {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? 'OK' : 'Internal Server Error',
    json: vi.fn(async () => payload),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getDeviceDetail', () => {
  it('builds request params and returns detail data', async () => {
    const detail = {
      ports: [0, 0, 1, 0],
      device: {
        freePortCount: 2,
      },
    } as ChargingDeviceDetail;

    const responseBody: ApiResponse<ChargingDeviceDetail> = {
      success: true,
      code: 200,
      message: 'ok',
      data: detail,
    };

    const fetchMock = vi.fn().mockResolvedValue(createFetchResponse(responseBody));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getDeviceDetail(baseParams);

    expect(result).toBe(detail);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('/portDetail');
    expect(String(url)).toContain('channelMessage=');
    expect(options?.method).toBe('POST');

    const body = new URLSearchParams(String(options?.body));
    expect(body.get('simId')).toBe(baseParams.simId);
    expect(body.get('mapType')).toBe(String(baseParams.mapType));
    expect(body.get('chargeTypeTag')).toBe(String(baseParams.chargeTypeTag));
    expect(body.get('appEntrance')).toBe(String(baseParams.appEntrance));
    expect(body.get('version')).toBe(baseParams.version);

    const freePorts = result.ports.slice(1).filter((port) => port === 0).length;
    expect(freePorts).toBe(result.device.freePortCount);
  });

  it('throws when HTTP response is not ok', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(createFetchResponse({} as ApiResponse<ChargingDeviceDetail>, false));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDeviceDetail(baseParams)).rejects.toThrow('HTTP error! status: 500');
  });

  it('throws when API response indicates failure', async () => {
    const responseBody: ApiResponse<ChargingDeviceDetail> = {
      success: false,
      code: 500,
      message: 'API failed',
      data: {} as ChargingDeviceDetail,
    };

    const fetchMock = vi.fn().mockResolvedValue(createFetchResponse(responseBody));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDeviceDetail(baseParams)).rejects.toThrow('API error: API failed');
  });
});
