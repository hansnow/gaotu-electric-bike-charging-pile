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
├── types.ts                   # TypeScript 类型定义
├── util.ts                    # API 工具函数
├── worker.ts                  # Cloudflare Worker 主入口
├── status-tracker.ts          # 状态跟踪器核心逻辑
├── status-tracker.test.ts     # 状态跟踪器单元测试
├── test-local.ts              # 本地测试脚本
├── wrangler.toml              # Cloudflare Workers 配置
├── tsconfig.json              # TypeScript 配置
├── vitest.config.ts           # 测试配置
├── package.json               # 项目配置
├── README.md                  # 项目文档
├── API.md                     # API 文档
├── LOGGING.md                 # 日志系统文档
└── TEST_REPORT.md             # 测试报告
```

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 本地开发

项目提供了两种开发模式，根据需求选择：

#### 模式 1：本地开发模式（默认）

```bash
pnpm dev
```

**适用场景：**
- ✅ 日常开发调试
- ✅ 测试业务逻辑
- ✅ 快速启动和热更新

**特点：**
- Worker 代码在本地 Node.js 环境运行
- KV 数据使用本地模拟存储（内存/文件）
- 无需上传代码到 Cloudflare，启动更快
- 不消耗 Cloudflare Workers 请求配额

#### 模式 2：生产环境连接模式

```bash
pnpm dev:prod
```

**适用场景：**
- ✅ 需要访问真实的生产 KV 数据
- ✅ 验证与线上环境的交互
- ✅ 调试生产数据相关问题

**特点：**
- Worker 代码在 Cloudflare 预览环境运行
- 连接真实的生产 KV namespace
- 可以读取和修改线上真实数据（⚠️ 请谨慎操作）
- 需要网络连接，会消耗少量请求配额

#### 两种模式的技术原理

| 对比项 | 本地模式 `pnpm dev` | 生产连接模式 `pnpm dev:prod` |
|--------|---------------------|------------------------------|
| **Worker 运行环境** | 本地 Node.js | Cloudflare 预览环境 |
| **KV 数据来源** | 本地模拟（假数据） | 生产 KV（真实数据） |
| **启动速度** | 快（~1秒） | 稍慢（~2-5秒，需上传 assets） |
| **网络要求** | 仅 API 请求需要网络 | 必须联网 |
| **数据安全** | 完全隔离 | ⚠️ 可直接操作生产数据 |
| **使用配额** | 不消耗 | 消耗少量配额 |

#### 实现原理说明

**本地模式工作原理：**
- 执行 `wrangler dev`（不带 `--remote`）
- KV 绑定被本地模拟器接管，数据存储在 `.wrangler/state/` 目录
- `preview_id` 配置不生效，因为不会连接远程 KV

**生产连接模式工作原理：**
- 执行 `wrangler dev --remote --env production`
- `--remote`: 让 Worker 在 Cloudflare 环境运行，而非本地
- `--env production`: 使用 `wrangler.toml` 中的 `[env.production]` 配置段
- 该配置段将 `preview_id` 设置为生产 KV 的 ID，从而连接真实数据

**配置文件对应关系：**
```toml
# wrangler.toml

# 默认配置（pnpm dev 使用）
[[kv_namespaces]]
binding = "CHARGING_EVENTS"
id = "be17b03b6713467f9114719918a4efb2"
preview_id = "7b26d5dbec2d4bb7996b0910d5487b78"  # 测试环境 KV

# 生产环境配置（pnpm dev:prod 使用）
[env.production]
[[env.production.kv_namespaces]]
binding = "CHARGING_EVENTS"
id = "be17b03b6713467f9114719918a4efb2"
preview_id = "be17b03b6713467f9114719918a4efb2"  # 生产环境 KV
```

#### 其他开发命令

```bash
# 运行本地测试脚本
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

### 查看实时日志

使用 `wrangler tail` 命令可以实时查看 Worker 的执行日志：

```bash
# 查看实时日志（基本格式）
npx wrangler tail

# 查看实时日志（美化格式）
npx wrangler tail --format pretty

# 查看实时日志（JSON 格式）
npx wrangler tail --format json

# 过滤特定内容
npx wrangler tail --format pretty | grep "状态变化"
```

**日志输出示例：**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 [定时任务] 开始执行状态检查
⏰ UTC时间: 2025-10-11T15:30:00.000Z
🕐 北京时间: 2025-10-11 23:30:00
📍 开始检查状态: 2025-10-11 15:30:00
  🔍 检查 [1号充电桩] (simId: 867997075125699)
     📊 在线: 是 | 插座: 20个 (空闲8/占用12)
     🔔 检测到 2 个状态变化:
        🔌 插座#3: available → occupied
        🔓 插座#5: occupied → available
     💾 已更新最新状态到 KV
  🔍 检查 [2号充电桩] (simId: 863060079195715)
     📊 在线: 是 | 插座: 20个 (空闲10/占用10)
     ✓ 无状态变化
💾 已存储状态快照 (包含 2 个变化事件)
💾 已存储 2 个状态变化事件
📈 本次检查统计:
   - KV 读取次数: 3
   - KV 写入次数: 3
   - 充电桩数量: 3
   - 状态变化数: 2
✅ [定时任务] 执行成功
📊 检查结果: {
  检查耗时: '1234ms',
  充电桩数量: 3,
  状态变化数: 2,
  是否有变化: '是',
  KV写入: '已写入'
}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

日志特点：
- 🎨 **视觉友好**：使用 emoji 和分隔线，易于识别
- 📊 **信息完整**：包含时间、状态、变化详情、KV 操作统计
- 🔍 **便于调试**：每次执行都有清晰的开始和结束标记
- 📈 **性能监控**：记录执行耗时和 KV 读写次数

**详细的日志系统说明请查看 [LOGGING.md](./LOGGING.md)**

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