/**
 * 充电桩设备类型定义
 *
 * @remarks
 * 包含充电桩的基本信息、状态、位置、价格等完整数据
 * 数据来源：高途电动车充电桩API
 */
export interface ChargingDevice {
  /** 充电桩唯一标识ID */
  id: number;

  /** 充电桩名称，如"中电金信自行车充电1号桩" */
  name: string;

  /** 设备SIM卡号，用于详情查询 */
  simId: string;

  /** SIM卡供应商，null表示未知 */
  simProvide: number | null;

  /** 设备所有者ID */
  ownerId: number;

  /** 总端口数量，表示该充电桩有多少个充电口 */
  portNumber: number;

  /** 空闲端口数量，当前可用的充电口数量 */
  freePortCount: number;

  /** 通信协议类型，通常为null */
  protocolType: null;

  /** 省份ID，如1表示北京 */
  provinceId: number;

  /** 省份名称，如"北京市" */
  provinceName: string | null;

  /** 城市ID，如2表示北京 */
  cityId: number;

  /** 城市名称，如"北京市" */
  cityName: string | null;

  /** 区县ID，如1692表示海淀区 */
  countyId: number;

  /** 区县名称，如"海淀区" */
  countyName: string | null;

  /** 小区/楼盘ID */
  estateId: number;

  /** 小区/楼盘名称，如"中电金信大厦自行车充电站" */
  estateName: string | null;

  /** 设备厂商编号，如3表示特定厂商 */
  factory: number | null;

  /** 在线状态：1=在线，0=离线 */
  online: number;

  /** 设备状态：1=正常，0=异常 */
  status: number;

  /** 设备详细地址，如"北京市海淀区旺科东路" */
  address: string;

  /** 计费方案ID */
  chargePriceId: number;

  /** 计费方案名称，通常为null */
  chargePriceName: null;

  /** 支付方式：3=微信等 */
  payWay: number | null;

  /** 设备位置类型：0=普通位置 */
  place: number | null;

  /** 设备入场时间，Unix时间戳（毫秒） */
  inTime: number;

  /** 设备信息更新时间，Unix时间戳（毫秒），null表示未更新 */
  updateTime: number | null;

  /** 纬度，用于地图定位 */
  lat: number;

  /** 经度，用于地图定位 */
  lng: number;

  /** 硬件ID，通常为0 */
  hardwareId: number | null;

  /** 设备类型：96=二轮车充电设备 */
  deviceType: number;

  /** 设备系列：0=标准设备 */
  deviceFamily: number;

  /** 电动车类型：0=二轮车 */
  electricType: number;

  /** 合作类型：99=标准合作 */
  cooperationType: number;

  /** 结算类型，通常为null */
  settlementType: null;

  /** 小区联系人 */
  estateContact: string | null;

  /** 小区联系电话 */
  estateTel: string | null;

  /** SIM卡ICCID号 */
  iccid: string | null;

  /** 通信模块类型：13=4G模块等 */
  moduleType: number | null;

  /** 占位费用，通常为null */
  occupancyFee: null;

  /** 价格标准ID，-1表示未设置 */
  priceStandardId: number | null;

  /** 主版本号：268等 */
  mainVersion: number | null;

  /** 用户设备类型：4=二轮车-20路设备 */
  userDeviceType: number | null;

  /** 用户设备类型名称，如"二轮车-20路设备" */
  userDeviceTypeName: string | null;

  /** 最大功率（瓦），通常为0.0表示未限制 */
  maxWatt: number | null;

  /** 入口类型，通常为null */
  addEntranceType: null;

  /** 交换机柜信息，通常为null */
  switchCabInfoDTO: null;

  /** 查询价格标准结果，通常为null */
  queryPriceStandardResult: null;

  /** 是否为特殊设备，通常为null */
  isMjDevice: null;

  /** 路由类型：4=标准路由 */
  routeType: number;

  /** 虚拟设备号，通常为null */
  vdNo: string | null;

  /** 产品序列号，通常为null */
  productSn: string | null;

  /** 投资金额，通常为null */
  investmentMoney: null;

  /** 是否联盟：0=非联盟 */
  isUnion: number | null;

  /** 总金额，通常为0.00 */
  totalAmount: number | null;

  /** 联盟服务费，通常为0.00 */
  unionServiceFee: number | null;

  /** 服务费状态：0=正常 */
  serviceFeeStatus: number | null;

  /** 服务费时间，通常为null */
  serviceFeeTime: number | null;

  /** 备注信息，通常为null */
  remark: string | null;

  /** 检查时间，通常为null */
  checkTime: number | null;

  /** 设备最大功率，通常为null */
  deviceMaxWatt: number | null;

  /** 百度地图纬度，通常为null */
  baiduLat: number | null;

  /** 百度地图经度，通常为null */
  baiduLng: number | null;

  /** 腾讯地图纬度，通常为null */
  tencentLat: number | null;

  /** 腾讯地图经度，通常为null */
  tencentLng: number | null;

  /** 小区地址类型ID，通常为null */
  estateAddressTypeId: number | null;

  /** 维修次数，通常为null */
  repairNum: number | null;

  /** 制造商名称，通常为null */
  manufacturerName: string | null;

  /** 保修时间，通常为null */
  warrantyTime: number | null;

  /** 订单结束时间，通常为null */
  orderEndTime: number | null;

  /** 入场时间，通常为null */
  entryTime: number | null;

  /** 保修状态，通常为null */
  warrantyStatus: number | null;

  /** 保修信息，通常为null */
  warranty: number | null;

  /** 移除时间，通常为null */
  removeTime: number | null;

  /** 小区类型，通常为null */
  estateType: number | null;

  /** 峰平谷设置，通常为null */
  peakPlainValley: number | null;

  /** 充电价格类型，通常为null */
  chargePriceType: number | null;

  /** 跳转模块标志，通常为null */
  jumpMoudleFlag: number | null;

  /** 价格标准，通常为空字符串 */
  priceStandard: string;

  /** 支付账户ID，通常为null */
  payAccountId: number | null;

  /** 合作伙伴，通常为null */
  partner: number | null;

  /** 距离（公里），如0.1表示100米 */
  distance: number;

  /** 商户承担费用：0=否，1=是 */
  isMerchantBears: number;

  /** 是否电子充电卡：false=否 */
  isElectronicChargeCard: boolean;

  /** 最低充电价格，通常为null */
  minChargePrice: number | null;

  /** 价格标准单位类型，通常为null */
  priceStandardUnitType: number | null;

  /** 是否开放：null表示未知 */
  isOpen: number | null;

  /** 电子充电卡余额，通常为null */
  electronicChargeCardValue: number | null;

  /** 是否设置购买赠品，通常为null */
  isSetPurchaseGift: number | null;

  /** 支付渠道，通常为null */
  payChannel: number | null;

  /** 支持蓝牙：null表示未知 */
  supportBlueTooth: number | null;
}

/**
 * 充电桩详情响应数据类型
 *
 * @remarks
 * 包含充电桩的详细信息、端口状态、错误信息等
 * 最重要的是 ports 数组和 device 对象
 */
export interface ChargingDeviceDetail {
  /** 商户承担费用：0=否，1=是 */
  isMerchantBears: number;

  /** 是否可以开具发票：true=可以，false=不可以 */
  businessInvoiceFlag: boolean;

  /** 扰码设备标志：0=正常，其他=扰码设备 */
  scramDeviceFlag: number;

  /** 访问判断标志：0=正常访问 */
  accessJudgmentFlag: number;

  /**
   * 端口状态数组
   *
   * @remarks
   * **重要约定**：
   * - ports[0]: 固定为0，无实际意义，仅作占位符
   * - ports[1]: 1号插座状态，0=空闲，1=占用
   * - ports[2]: 2号插座状态，0=空闲，1=占用
   * - ...
   * - ports[n]: n号插座状态，0=空闲，1=占用
   *
   * **使用示例**：
   * ```typescript
   * // 统计空闲端口数量（跳过ports[0]）
   * const freePorts = detail.ports.slice(1).filter(port => port === 0).length;
   *
   * // 获取1号插座状态
   * const socket1Status = detail.ports[1]; // 0=空闲，1=占用
   * ```
   */
  ports: number[];

  /** 是否正在充电：true=正在充电，false=未充电 */
  chargingFlag: boolean;

  /** 设备错误消息，如"设备维护中"，空字符串表示正常 */
  errorMsg: string;

  /** 是否需要通过App访问：0=不需要，1=需要 */
  accessWithApp: number;

  /** 设备故障标志：0=正常，其他=故障 */
  machineFault: number;

  /** 用户小区卡余额，null表示无余额或未设置 */
  userEstateCardBalance: number | null;

  /** 是否为公众号用户：null表示非公众号用户 */
  isOfficialAccountFlag: number | null;

  /** 是否更新经纬度：1=已更新，其他=未更新 */
  updateLatLng: number;

  /** 是否为电子充电卡：false=否 */
  isElectronicChargeCard: boolean;

  /** 是否为背景设备：false=否 */
  isBgDevice: boolean;

  /** 设备详细信息，包含位置、状态、价格等完整数据 */
  device: ChargingDevice;
}

/**
 * API 响应类型定义
 *
 * @remarks
 * 所有API接口的统一响应格式
 *
 * @template T 响应数据的类型
 */
export interface ApiResponse<T> {
  /** 响应状态码：200=成功，其他=失败 */
  code: number;

  /** 响应数据，具体类型由泛型T决定 */
  data: T;

  /** 请求是否成功：true=成功，false=失败 */
  success: boolean;

  /** 响应消息，如"查询成功"、"成功"等 */
  message: string;
}

/**
 * 查询附近充电桩列表请求参数
 *
 * @remarks
 * 用于根据地理位置查询附近的充电桩设备
 */
export interface NearbyDevicesRequest {
  /** 定位标志：1=启用定位，其他=不启用 */
  positioningFlag: number;

  /** 设备系列：0=标准设备 */
  deviceFamily: number;

  /** 纬度，用于地理位置定位 */
  lat: number;

  /** 经度，用于地理位置定位 */
  lng: number;

  /** 设备名称搜索关键词，空字符串表示不筛选 */
  name: string;

  /** 地图类型：2=标准地图 */
  mapType: number;
}

/**
 * 充电桩详情请求参数
 *
 * @remarks
 * 用于获取特定充电桩的详细信息，包括端口状态
 */
export interface DeviceDetailRequest {
  /** 设备SIM卡号，唯一标识充电桩 */
  simId: string;

  /** 地图类型：2=标准地图 */
  mapType: number;

  /** 充电类型标签：0=标准充电 */
  chargeTypeTag: number;

  /** 应用入口：1=标准应用 */
  appEntrance: number;

  /** 版本号：通常使用"new"表示最新版本 */
  version: string;
}

/**
 * Cloudflare Worker 环境变量类型
 *
 * @remarks
 * 定义Worker运行时所需的环境变量
 */
export interface Env {
  /** 如果需要添加环境变量，可以在这里定义 */
  // 示例：
  // API_BASE_URL?: string;
  // AUTH_TOKEN?: string;
  // KV_NAMESPACE?: KVNamespace;
}