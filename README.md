# 高途电动车充电桩 API 服务

基于 Cloudflare Workers 构建的电动车充电桩查询服务，提供充电桩列表查询、详情查询等功能。

## 项目特性

- 🚀 基于 Cloudflare Workers 部署，全球边缘计算
- 🔧 完整的 TypeScript 类型定义
- 📡 RESTful API 接口
- 🧪 内置测试流程
- 📊 充电桩状态统计
- 🌐 CORS 支持

## 项目结构

```
gaotu-electric-bike-charging-pile/
├── types.ts              # TypeScript 类型定义
├── util.ts               # API 工具函数
├── worker.ts             # Cloudflare Worker 主入口
├── test-local.ts         # 本地测试脚本
├── wrangler.toml         # Cloudflare Workers 配置
├── tsconfig.json         # TypeScript 配置
├── package.json          # 项目配置
├── API.md               # API 文档
└── README.md            # 项目文档
```

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 本地开发

```bash
# 启动本地开发服务器
pnpm run dev

# 运行本地测试
npx tsx test-local.ts
```

### 部署到 Cloudflare Workers

```bash
# 登录 Cloudflare
npx wrangler login

# 部署
pnpm run deploy
```

## API 接口

### 1. 获取附近充电桩列表

**接口地址：** `POST /nearby`

**请求参数：**
```typescript
{
  positioningFlag: number,  // 定位标志
  deviceFamily: number,     // 设备类型
  lat: number,             // 纬度
  lng: number,             // 经度
  name: string,            // 搜索名称
  mapType: number          // 地图类型
}
```

**响应示例：**
```json
{
  "success": true,
  "data": [
    {
      "id": 773288,
      "name": "中电金信自行车充电2号桩",
      "simId": "863060079195715",
      "portNumber": 20,
      "freePortCount": 8,
      "address": "北京市海淀区旺科东路",
      "lat": 40.044545,
      "lng": 116.282972
    }
  ]
}
```

### 2. 获取充电桩详情

**接口地址：** `POST /detail`

**请求参数：**
```typescript
{
  simId: string,           // 设备 SIM 卡号
  mapType: number,         // 地图类型
  chargeTypeTag: number,   // 充电类型标签
  appEntrance: number,     // 应用入口
  version: string          // 版本
}
```

**响应示例：**
```json
{
  "success": true,
  "data": {
    "ports": [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 0],
    "chargingFlag": false,
    "errorMsg": "设备维护中",
    "device": {
      "id": 773285,
      "name": "中电金信自行车充电1号桩"
    }
  }
}
```

### 3. 测试流程

**接口地址：** `GET /test`

**功能：**
- 获取附近充电桩列表
- 筛选名称包含"中电金信"的充电桩
- 依次获取这些充电桩的详情
- 统计空闲端口数量

**响应示例：**
```json
{
  "success": true,
  "message": "测试流程完成",
  "summary": {
    "totalDevices": 10,
    "targetDevices": 3,
    "totalZeroPorts": 8
  },
  "deviceDetails": [
    {
      "name": "中电金信自行车充电1号桩",
      "simId": "867997075125699",
      "totalPorts": 21,
      "zeroPorts": 3,
      "errorMsg": "设备维护中"
    }
  ]
}
```

## 核心函数

### getNearbyDevices(params)

获取附近充电桩列表。

**参数：**
- `params: NearbyDevicesRequest` - 查询参数

**返回：**
- `Promise<ChargingDevice[]>` - 充电桩列表

### getDeviceDetail(params)

获取充电桩详情信息。

**参数：**
- `params: DeviceDetailRequest` - 详情查询参数

**返回：**
- `Promise<ChargingDeviceDetail>` - 充电桩详情

## 测试流程说明

测试流程完整实现了以下步骤：

1. **获取充电桩列表**：使用示例坐标获取附近充电桩
2. **筛选目标充电桩**：找到名称包含"中电金信"的充电桩
3. **获取详情信息**：依次请求每个目标充电桩的详情
4. **统计空闲端口**：计算 `ports` 数组中值为 0 的元素数量

### 端口状态说明

- `0`: 空闲/可用端口
- `1`: 占用/不可用端口

## 开发说明

### TypeScript 类型系统

项目采用完整的 TypeScript 类型定义：

- `ChargingDevice`: 充电桩设备信息
- `ChargingDeviceDetail`: 充电桩详情信息
- `ApiResponse`: API 响应格式
- `NearbyDevicesRequest`: 附近设备查询参数
- `DeviceDetailRequest`: 设备详情查询参数

### 错误处理

- 统一的错误处理机制
- 详细的错误信息返回
- HTTP 状态码规范

### CORS 支持

所有接口均支持跨域请求，便于前端集成。

## 许可证

ISC License

## 更新日志

### v1.0.0 (2024-01-01)

- ✅ 初始版本发布
- ✅ 实现充电桩列表查询
- ✅ 实现充电桩详情查询
- ✅ 完整的 TypeScript 类型定义
- ✅ 测试流程实现
- ✅ Cloudflare Workers 部署配置