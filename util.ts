import {
  ChargingDevice,
  ChargingDeviceDetail,
  ApiResponse,
  NearbyDevicesRequest,
  DeviceDetailRequest
} from './types';

const API_BASE_URL = 'https://appapi.lvcchong.com';
const CHANNEL_MESSAGE = 'LVCC-WO-PH_2025.09.12_Tencent-H10';
const TOKEN = 'eyJhbGciOiJSUzI1NiIsImtpZCI6ImJmYmE3ZjNkZGQ3YTRlMmI4NjJjZDIyMGY3NWZhMWI5In0.eyJqdGkiOiI2d2NwVVhMcDVLVXdnYjV0c2lxQ1J3IiwiaWF0IjoxNzYwMTY1MzE1LCJleHAiOjE3NjAxNjUzNDUsIm5iZiI6MTc2MDE2NTI1NSwic3ViIjoiMSIsImF1ZCI6IklfRE9OT1RfQ0FSRSIsInVzZXJJZCI6Ijc3MDMzMTIxIn0.IXdmjYaP9Hr8XVUqQ0NTsr2qjcCo1z2rqxU28HLQvQ1pMeVC-1MiYoC2xvUdFQb9G-P-VHck1JVNEVNnWQxBTSy0R9vgJ5KbumM77n2Z6lG5DZ1wrnHVboEefIA1Vwe5RCd3ALGAr2hv13N85_Tz_MvwCgebWUcLEaa6PjfCVKlrheLlIn2DRczd728_WEgrNZm8ytQ19JkrxGjgvjEJn1tencHzObfDmMDuNcnH6OPwcFukoheRKDs_IFmj_AshQJu_eVmpyfGreA4YLo5J0gM6a4vFYw_QJOXt6Ta_tJY36ExT6gsZjJ29VHdwcCjEQZjteSk6Olui-4LNDYxheg';

/**
 * 获取附近充电桩列表
 * @param params 查询参数
 * @returns 充电桩列表
 */
export async function getNearbyDevices(params: NearbyDevicesRequest): Promise<ChargingDevice[]> {
  const url = new URL('/appBaseApi/nearbyDeviceList', API_BASE_URL);
  url.searchParams.append('channelMessage', CHANNEL_MESSAGE);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Host': 'appapi.lvcchong.com',
      'Accept': '*/*',
      'Sec-Fetch-Site': 'same-site',
      'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
      'Accept-Encoding': 'gzip, deflate',
      'Sec-Fetch-Mode': 'cors',
      'token': TOKEN,
      'Origin': 'https://h5.lvcchong.com',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Sec-Fetch-Dest': 'empty',
      'Connection': 'keep-alive',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.63(0x18003f2f) NetType/WIFI Language/zh_CN',
      'Referer': 'https://h5.lvcchong.com/',
    },
    body: new URLSearchParams({
      positioningFlag: params.positioningFlag.toString(),
      deviceFamily: params.deviceFamily.toString(),
      lat: params.lat.toString(),
      lng: params.lng.toString(),
      name: params.name,
      mapType: params.mapType.toString()
    }).toString()
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result: ApiResponse<ChargingDevice[]> = await response.json();

  if (!result.success || result.code !== 200) {
    throw new Error(`API error: ${result.message}`);
  }

  return result.data;
}

/**
 * 获取充电桩详情
 * @param params 充电桩详情请求参数
 * @returns 充电桩详情
 */
export async function getDeviceDetail(params: DeviceDetailRequest): Promise<ChargingDeviceDetail> {
  const url = new URL('/portDetail', API_BASE_URL);
  url.searchParams.append('channelMessage', CHANNEL_MESSAGE);

  const response = await fetch(url.toString(), {
    method: 'POST',
    headers: {
      'Host': 'appapi.lvcchong.com',
      'Accept': '*/*',
      'Sec-Fetch-Site': 'same-site',
      'Accept-Language': 'zh-CN,zh-Hans;q=0.9',
      'Accept-Encoding': 'gzip, deflate',
      'Sec-Fetch-Mode': 'cors',
      // 对于充电桩详情接口 token 是不必要的
      // 'token': TOKEN,
      'Origin': 'https://h5.lvcchong.com',
      'Content-Type': 'application/x-www-form-urlencoded',
      'Sec-Fetch-Dest': 'empty',
      'Connection': 'keep-alive',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.63(0x18003f2f) NetType/WIFI Language/zh_CN',
      'Referer': 'https://h5.lvcchong.com/',
    },
    body: new URLSearchParams({
      simId: params.simId,
      mapType: params.mapType.toString(),
      chargeTypeTag: params.chargeTypeTag.toString(),
      appEntrance: params.appEntrance.toString(),
      version: params.version
    }).toString()
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result: ApiResponse<ChargingDeviceDetail> = await response.json();

  if (!result.success || result.code !== 200) {
    throw new Error(`API error: ${result.message}`);
  }

  return result.data;
}