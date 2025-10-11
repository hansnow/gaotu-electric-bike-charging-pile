# 高途电动车充电桩 API 服务

基于 Cloudflare Workers 构建的电动车充电桩查询服务，提供充电桩列表查询、详情查询等功能。

## 项目特性

- 🚀 基于 Cloudflare Workers 部署，全球边缘计算
- 🔧 完整的 TypeScript 类型定义
- 📡 RESTful API 接口
- 🧪 内置测试流程
- 📊 充电桩状态统计
- 🌐 CORS 支持
- ⏰ 全天24小时状态监控（每分钟检查一次）
- 💾 智能 KV 存储优化（仅在状态变化时写入）
- 📈 状态变化事件追踪

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

### 4. 获取状态变化事件

**接口地址：** `GET /events?date=YYYY-MM-DD`

**功能：** 查询指定日期的充电桩状态变化事件

**请求参数：**
- `date` (可选): 日期字符串，格式为 `YYYY-MM-DD`，不传则默认当天

**响应示例：**
```json
{
  "success": true,
  "date": "2025-10-11",
  "events": [
    {
      "id": "1-3-1728648600000",
      "stationId": 1,
      "stationName": "1号充电桩",
      "socketId": 3,
      "oldStatus": "available",
      "newStatus": "occupied",
      "timestamp": 1728648600000,
      "timeString": "2025-10-11 15:30:00"
    }
  ]
}
```

### 5. 手动触发状态检查

**接口地址：** `POST /check-status`

**功能：** 手动触发一次状态检查（用于测试）

**响应示例：**
```json
{
  "success": true,
  "message": "状态检查完成",
  "result": {
    "timestamp": 1728648600000,
    "timeString": "2025-10-11 15:30:00",
    "stationsCount": 3,
    "eventsCount": 2,
    "hasAnyChange": true,
    "stations": [...],
    "events": [...]
  }
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

## 状态监控功能

### 监控策略

项目实现了全天24小时的充电桩状态监控功能：

- **监控频率**: 每分钟检查一次所有充电桩的插座状态
- **监控时间**: 全天24小时不间断监控（已移除时间窗口限制）
- **状态检测**: 自动检测插座从 `available`（空闲）到 `occupied`（占用）的状态变化
- **事件记录**: 记录所有状态变化事件，包含时间戳、充电桩信息、插座编号等

### KV 存储优化

为了适应 Cloudflare Workers KV 免费套餐的限制（每天 1000 次写入），我们采用了智能写入策略：

#### 写入限制
- 免费套餐：每天 1000 次写入
- 写入同一个 key：每秒最多 1 次

#### 优化策略
1. **状态变化检测**: 每次检查时先读取上一次的状态，与当前状态对比
2. **按需写入**: 仅在检测到状态变化时才写入 KV，避免无意义的写入
3. **智能存储**:
   - **最新状态** (`latest:{stationId}`): 只在该充电桩状态变化时更新
   - **状态快照** (`snapshot:{date}:{timestamp}`): 只在有任何状态变化时存储
   - **变化事件** (`events:{date}`): 只在有状态变化时追加事件

#### 写入次数估算

假设平均每天有 N 次状态变化：
- 最新状态写入：最多 N 次（每次变化时更新）
- 状态快照写入：最多 N 次（每次有变化时存储）
- 事件记录写入：最多 N 次（批量追加事件）
- **总计**: 最多 3N 次写入

这种策略确保在正常使用情况下（每天状态变化不超过 300 次）不会超过免费套餐限制。

### 定时任务配置

在 `wrangler.toml` 中配置了 Cron 触发器：

```toml
[triggers]
crons = ["* * * * *"]  # 每分钟执行一次
```

### 存储结构

#### 1. 最新状态 (Latest Status)
- **Key**: `latest:{stationId}`
- **用途**: 存储每个充电桩的最新状态，用于状态变化对比
- **过期时间**: 无限期（需要持久保存）

#### 2. 状态快照 (Snapshot)
- **Key**: `snapshot:{date}:{timestamp}`
- **用途**: 记录特定时刻所有充电桩的完整状态
- **过期时间**: 7天

#### 3. 状态变化事件 (Events)
- **Key**: `events:{date}`
- **用途**: 记录某一天的所有状态变化事件（按时间戳倒序）
- **限制**: 每天最多保存 1000 个事件
- **过期时间**: 7天

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

### v1.1.0 (2025-10-11)

- ✅ 实现全天24小时状态监控（移除时间窗口限制）
- ✅ 优化 KV 存储策略，仅在状态变化时写入
- ✅ 添加状态变化事件查询接口
- ✅ 添加手动触发状态检查接口
- ✅ 完善文档说明 KV 写入优化策略

### v1.0.0 (2024-01-01)

- ✅ 初始版本发布
- ✅ 实现充电桩列表查询
- ✅ 实现充电桩详情查询
- ✅ 完整的 TypeScript 类型定义
- ✅ 测试流程实现
- ✅ Cloudflare Workers 部署配置