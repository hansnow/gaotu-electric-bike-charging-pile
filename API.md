# 获取附近充电桩列表

请求
```
curl 'https://appapi.lvcchong.com/appBaseApi/nearbyDeviceList?channelMessage=LVCC-WO-PH_2025.09.12_Tencent-H10'  -H 'Host: appapi.lvcchong.com'  -H 'Accept: */*'  -H 'Sec-Fetch-Site: same-site'  -H 'Accept-Language: zh-CN,zh-Hans;q=0.9'  -H 'Accept-Encoding: gzip, deflate'  -H 'Sec-Fetch-Mode: cors'  -H 'token: eyJhbGciOiJSUzI1NiIsImtpZCI6ImJmYmE3ZjNkZGQ3YTRlMmI4NjJjZDIyMGY3NWZhMWI5In0.eyJqdGkiOiI2d2NwVVhMcDVLVXdnYjV0c2lxQ1J3IiwiaWF0IjoxNzYwMTY1MzE1LCJleHAiOjE3NjAxNjUzNDUsIm5iZiI6MTc2MDE2NTI1NSwic3ViIjoiMSIsImF1ZCI6IklfRE9OT1RfQ0FSRSIsInVzZXJJZCI6Ijc3MDMzMTIxIn0.IXdmjYaP9Hr8XVUqQ0NTsr2qjcCo1z2rqxU28HLQvQ1pMeVC-1MiYoC2xvUdFQb9G-P-VHck1JVNEVNnWQxBTSy0R9vgJ5KbumM77n2Z6lG5DZ1wrnHVboEefIA1Vwe5RCd3ALGAr2hv13N85_Tz_MvwCgebWUcLEaa6PjfCVKlrheLlIn2DRczd728_WEgrNZm8ytQ19JkrxGjgvjEJn1tencHzObfDmMDuNcnH6OPwcFukoheRKDs_IFmj_AshQJu_eVmpyfGreA4YLo5J0gM6a4vFYw_QJOXt6Ta_tJY36ExT6gsZjJ29VHdwcCjEQZjteSk6Olui-4LNDYxheg'  -H 'Origin: https://h5.lvcchong.com'  -H 'Content-Length: 77'  -H 'User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.63(0x18003f2f) NetType/WIFI Language/zh_CN'  -H 'Referer: https://h5.lvcchong.com/'  -H 'Connection: keep-alive'  -H 'Content-Type: application/x-www-form-urlencoded'  -H 'Sec-Fetch-Dest: empty'   --data 'positioningFlag=1&deviceFamily=0&lat=40.043910&lng=116.283760&name=&mapType=2' --compressed 
```

响应
```json
{
    "code": 200,
    "data": [
        {
            "id": 773288,
            "name": "中电金信自行车充电2号桩",
            "simId": "863060079195715",
            "simProvide": null,
            "ownerId": 1315,
            "portNumber": 20,
            "freePortCount": 8,
            "protocolType": null,
            "provinceId": 1,
            "provinceName": null,
            "cityId": 2,
            "cityName": null,
            "countyId": 1692,
            "countyName": null,
            "estateId": 177063,
            "estateName": null,
            "factory": null,
            "online": 1,
            "status": 1,
            "address": "北京市海淀区旺科东路",
            "chargePriceId": 143131,
            "chargePriceName": null,
            "payWay": null,
            "place": null,
            "inTime": 1734322303625,
            "updateTime": null,
            "lat": 40.044545,
            "lng": 116.282972,
            "hardwareId": null,
            "deviceType": 96,
            "deviceFamily": 0,
            "electricType": 0,
            "cooperationType": 99,
            "settlementType": null,
            "estateContact": null,
            "estateTel": null,
            "iccid": null,
            "moduleType": null,
            "occupancyFee": null,
            "priceStandardId": null,
            "mainVersion": null,
            "userDeviceType": null,
            "userDeviceTypeName": null,
            "maxWatt": null,
            "addEntranceType": null,
            "switchCabInfoDTO": null,
            "queryPriceStandardResult": null,
            "isMjDevice": null,
            "routeType": 4,
            "vdNo": null,
            "productSn": null,
            "investmentMoney": null,
            "isUnion": null,
            "totalAmount": null,
            "unionServiceFee": null,
            "serviceFeeStatus": null,
            "serviceFeeTime": null,
            "remark": null,
            "checkTime": null,
            "deviceMaxWatt": null,
            "baiduLat": null,
            "baiduLng": null,
            "tencentLat": null,
            "tencentLng": null,
            "estateAddressTypeId": null,
            "repairNum": null,
            "manufacturerName": null,
            "warrantyTime": null,
            "orderEndTime": null,
            "entryTime": null,
            "warrantyStatus": null,
            "warranty": null,
            "removeTime": null,
            "estateType": null,
            "peakPlainValley": null,
            "chargePriceType": null,
            "jumpMoudleFlag": null,
            "priceStandard": "",
            "payAccountId": null,
            "partner": null,
            "distance": 0.1,
            "isMerchantBears": 0,
            "isElectronicChargeCard": false,
            "minChargePrice": null,
            "priceStandardUnitType": null,
            "isOpen": null,
            "electronicChargeCardValue": null,
            "isSetPurchaseGift": null,
            "payChannel": null,
            "electronicChargeCard": false,
            "supportBlueTooth": null
        },
        {
            "id": 773289,
            "name": "中电金信自行车充电3号桩",
            "simId": "863060079153326",
            "simProvide": null,
            "ownerId": 1315,
            "portNumber": 20,
            "freePortCount": 3,
            "protocolType": null,
            "provinceId": 1,
            "provinceName": null,
            "cityId": 2,
            "cityName": null,
            "countyId": 1692,
            "countyName": null,
            "estateId": 177063,
            "estateName": null,
            "factory": null,
            "online": 1,
            "status": 1,
            "address": "北京市海淀区旺科东路",
            "chargePriceId": 143131,
            "chargePriceName": null,
            "payWay": null,
            "place": null,
            "inTime": 1734322376145,
            "updateTime": null,
            "lat": 40.044545,
            "lng": 116.282972,
            "hardwareId": null,
            "deviceType": 96,
            "deviceFamily": 0,
            "electricType": 0,
            "cooperationType": 99,
            "settlementType": null,
            "estateContact": null,
            "estateTel": null,
            "iccid": null,
            "moduleType": null,
            "occupancyFee": null,
            "priceStandardId": null,
            "mainVersion": null,
            "userDeviceType": null,
            "userDeviceTypeName": null,
            "maxWatt": null,
            "addEntranceType": null,
            "switchCabInfoDTO": null,
            "queryPriceStandardResult": null,
            "isMjDevice": null,
            "routeType": 4,
            "vdNo": null,
            "productSn": null,
            "investmentMoney": null,
            "isUnion": null,
            "totalAmount": null,
            "unionServiceFee": null,
            "serviceFeeStatus": null,
            "serviceFeeTime": null,
            "remark": null,
            "checkTime": null,
            "deviceMaxWatt": null,
            "baiduLat": null,
            "baiduLng": null,
            "tencentLat": null,
            "tencentLng": null,
            "estateAddressTypeId": null,
            "repairNum": null,
            "manufacturerName": null,
            "warrantyTime": null,
            "orderEndTime": null,
            "entryTime": null,
            "warrantyStatus": null,
            "warranty": null,
            "removeTime": null,
            "estateType": null,
            "peakPlainValley": null,
            "chargePriceType": null,
            "jumpMoudleFlag": null,
            "priceStandard": "",
            "payAccountId": null,
            "partner": null,
            "distance": 0.1,
            "isMerchantBears": 0,
            "isElectronicChargeCard": false,
            "minChargePrice": null,
            "priceStandardUnitType": null,
            "isOpen": null,
            "electronicChargeCardValue": null,
            "isSetPurchaseGift": null,
            "payChannel": null,
            "electronicChargeCard": false,
            "supportBlueTooth": null
        },
        {
            "id": 773285,
            "name": "中电金信自行车充电1号桩",
            "simId": "867997075125699",
            "simProvide": null,
            "ownerId": 1315,
            "portNumber": 20,
            "freePortCount": 3,
            "protocolType": null,
            "provinceId": 1,
            "provinceName": null,
            "cityId": 2,
            "cityName": null,
            "countyId": 1692,
            "countyName": null,
            "estateId": 177063,
            "estateName": null,
            "factory": null,
            "online": 1,
            "status": 1,
            "address": "北京市海淀区旺科东路",
            "chargePriceId": 143131,
            "chargePriceName": null,
            "payWay": null,
            "place": null,
            "inTime": 1734322216091,
            "updateTime": null,
            "lat": 40.044616,
            "lng": 116.282966,
            "hardwareId": null,
            "deviceType": 96,
            "deviceFamily": 0,
            "electricType": 0,
            "cooperationType": 99,
            "settlementType": null,
            "estateContact": null,
            "estateTel": null,
            "iccid": null,
            "moduleType": null,
            "occupancyFee": null,
            "priceStandardId": null,
            "mainVersion": null,
            "userDeviceType": null,
            "userDeviceTypeName": null,
            "maxWatt": null,
            "addEntranceType": null,
            "switchCabInfoDTO": null,
            "queryPriceStandardResult": null,
            "isMjDevice": null,
            "routeType": 4,
            "vdNo": null,
            "productSn": null,
            "investmentMoney": null,
            "isUnion": null,
            "totalAmount": null,
            "unionServiceFee": null,
            "serviceFeeStatus": null,
            "serviceFeeTime": null,
            "remark": null,
            "checkTime": null,
            "deviceMaxWatt": null,
            "baiduLat": null,
            "baiduLng": null,
            "tencentLat": null,
            "tencentLng": null,
            "estateAddressTypeId": null,
            "repairNum": null,
            "manufacturerName": null,
            "warrantyTime": null,
            "orderEndTime": null,
            "entryTime": null,
            "warrantyStatus": null,
            "warranty": null,
            "removeTime": null,
            "estateType": null,
            "peakPlainValley": null,
            "chargePriceType": null,
            "jumpMoudleFlag": null,
            "priceStandard": "",
            "payAccountId": null,
            "partner": null,
            "distance": 0.1,
            "isMerchantBears": 0,
            "isElectronicChargeCard": false,
            "minChargePrice": null,
            "priceStandardUnitType": null,
            "isOpen": null,
            "electronicChargeCardValue": null,
            "isSetPurchaseGift": null,
            "payChannel": null,
            "electronicChargeCard": false,
            "supportBlueTooth": null
        }
    ],
    "success": true,
    "message": "查询成功"
}
```

# 获取某个充电桩详情

请求
```
curl 'https://appapi.lvcchong.com/portDetail?channelMessage=LVCC-WO-PH_2025.09.12_Tencent-H10'  -H 'Host: appapi.lvcchong.com'  -H 'Accept: */*'  -H 'Sec-Fetch-Site: same-site'  -H 'Accept-Language: zh-CN,zh-Hans;q=0.9'  -H 'Accept-Encoding: gzip, deflate'  -H 'Sec-Fetch-Mode: cors'  -H 'token: eyJhbGciOiJSUzI1NiIsImtpZCI6ImJmYmE3ZjNkZGQ3YTRlMmI4NjJjZDIyMGY3NWZhMWI5In0.eyJqdGkiOiI2d2NwVVhMcDVLVXdnYjV0c2lxQ1J3IiwiaWF0IjoxNzYwMTY1MzE1LCJleHAiOjE3NjAxNjUzNDUsIm5iZiI6MTc2MDE2NTI1NSwic3ViIjoiMSIsImF1ZCI6IklfRE9OT1RfQ0FSRSIsInVzZXJJZCI6Ijc3MDMzMTIxIn0.IXdmjYaP9Hr8XVUqQ0NTsr2qjcCo1z2rqxU28HLQvQ1pMeVC-1MiYoC2xvUdFQb9G-P-VHck1JVNEVNnWQxBTSy0R9vgJ5KbumM77n2Z6lG5DZ1wrnHVboEefIA1Vwe5RCd3ALGAr2hv13N85_Tz_MvwCgebWUcLEaa6PjfCVKlrheLlIn2DRczd728_WEgrNZm8ytQ19JkrxGjgvjEJn1tencHzObfDmMDuNcnH6OPwcFukoheRKDs_IFmj_AshQJu_eVmpyfGreA4YLo5J0gM6a4vFYw_QJOXt6Ta_tJY36ExT6gsZjJ29VHdwcCjEQZjteSk6Olui-4LNDYxheg'  -H 'Origin: https://h5.lvcchong.com'  -H 'Content-Length: 73'  -H 'User-Agent: Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.63(0x18003f2f) NetType/WIFI Language/zh_CN'  -H 'Referer: https://h5.lvcchong.com/'  -H 'Connection: keep-alive'  -H 'Content-Type: application/x-www-form-urlencoded'  -H 'Sec-Fetch-Dest: empty'   --data 'simId=867997075125699&mapType=2&chargeTypeTag=0&appEntrance=1&version=new' --compressed
```

响应
```json
{"code":200,"data":{"isMerchantBears":0,"businessInvoiceFlag":true,"scramDeviceFlag":0,"accessJudgmentFlag":0,"ports":[0,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,0,1,1,0],"chargingFlag":false,"errorMsg":"设备维护中","accessWithApp":0,"machineFault":0,"userEstateCardBalance":null,"isOfficialAccountFlag":null,"updateLatLng":1,"isElectronicChargeCard":false,"isBgDevice":false,"device":{"id":773285,"name":"中电金信自行车充电1号桩","simId":"867997075125699","simProvide":0,"ownerId":1315,"portNumber":20,"freePortCount":3,"protocolType":null,"provinceId":1,"provinceName":"北京市","cityId":2,"cityName":"北京市","countyId":1692,"countyName":"海淀区","estateId":177063,"estateName":"中电金信大厦自行车充电站","factory":3,"online":1,"status":1,"address":"北京市海淀区旺科东路","chargePriceId":143131,"chargePriceName":null,"payWay":3,"place":0,"inTime":1734322216000,"updateTime":1757950620000,"lat":40.044616,"lng":116.282966,"hardwareId":0,"deviceType":96,"deviceFamily":0,"electricType":0,"cooperationType":99,"settlementType":null,"estateContact":null,"estateTel":null,"iccid":"898608411124D2174500","moduleType":13,"occupancyFee":null,"priceStandardId":-1,"mainVersion":268,"userDeviceType":4,"userDeviceTypeName":"二轮车-20路设备","maxWatt":0.0,"addEntranceType":null,"switchCabInfoDTO":null,"queryPriceStandardResult":null,"isMjDevice":null,"routeType":null,"vdNo":null,"productSn":null,"investmentMoney":null,"isUnion":0,"totalAmount":0.00,"unionServiceFee":0.00,"serviceFeeStatus":0,"serviceFeeTime":null,"remark":null,"checkTime":null,"deviceMaxWatt":null,"baiduLat":40.050955,"baiduLng":116.289329,"tencentLat":40.044616,"tencentLng":116.282966,"estateAddressTypeId":null,"repairNum":null,"manufacturerName":null,"warrantyTime":null,"orderEndTime":null,"entryTime":null,"warrantyStatus":null,"warranty":null,"removeTime":null,"estateType":null,"peakPlainValley":null,"chargePriceType":null}},"success":true,"message":"成功"}
```

---

# Workers 实现的 API 接口

以下是我们基于 Cloudflare Workers 实现的 API 接口：

## 1. 获取状态变化事件

**接口地址：** `GET /events?date=YYYY-MM-DD`

**功能：** 查询指定日期的充电桩状态变化事件

**请求参数：**
- `date` (可选): 日期字符串，格式为 `YYYY-MM-DD`，不传则默认当天

**请求示例：**
```bash
curl 'https://your-worker.workers.dev/events?date=2025-10-11'
```

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
    },
    {
      "id": "2-5-1728645000000",
      "stationId": 2,
      "stationName": "2号充电桩",
      "socketId": 5,
      "oldStatus": "occupied",
      "newStatus": "available",
      "timestamp": 1728645000000,
      "timeString": "2025-10-11 14:30:00"
    }
  ]
}
```

**状态说明：**
- `available`: 插座空闲，可使用
- `occupied`: 插座占用，正在充电

## 2. 手动触发状态检查

**接口地址：** `POST /check-status`

**功能：** 手动触发一次充电桩状态检查（用于测试和调试）

**请求示例：**
```bash
curl -X POST 'https://your-worker.workers.dev/check-status'
```

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
    "stations": [
      {
        "id": 1,
        "name": "1号充电桩",
        "simId": "867997075125699",
        "sockets": [
          { "id": 1, "status": "available" },
          { "id": 2, "status": "occupied" },
          { "id": 3, "status": "available" }
        ],
        "online": true,
        "address": "北京市海淀区旺科东路",
        "timestamp": 1728648600000
      }
    ],
    "events": [
      {
        "id": "1-2-1728648600000",
        "stationId": 1,
        "stationName": "1号充电桩",
        "socketId": 2,
        "oldStatus": "available",
        "newStatus": "occupied",
        "timestamp": 1728648600000,
        "timeString": "2025-10-11 15:30:00"
      }
    ]
  }
}
```

## 状态监控说明

### 监控配置
- **监控频率**: 每分钟检查一次（通过 Cron 触发器 `* * * * *`）
- **监控时间**: 全天24小时不间断监控
- **监控范围**: 3个充电桩（中电金信1、2、3号桩）

### KV 存储优化

为适应 Cloudflare Workers KV 免费套餐限制（每天 1000 次写入），采用智能写入策略：

#### v2.0 优化策略 (2025-11-03)

1. **状态变化检测**
   - 每次检查时读取上一次的状态
   - 对比当前状态与历史状态
   - 仅在检测到变化时写入 KV

2. **精简存储**
   - **最新状态** (`latest:{stationId}`): 只在该充电桩状态变化时更新
   - **变化事件** (`events:{date}`): 只在有状态变化时追加事件
   - ~~**状态快照**~~: 已移除（可从事件列表重建历史状态）

3. **配额监控**
   - **配额计数** (`quota:writes:{date}`): 追踪每日累计写入次数
   - 达到 80% 配额时发出 ⚠️ 警告
   - 达到 95% 配额时发出 🚨 严重预警

4. **写入次数估算**
   - 假设每天有 N 次状态变化
   - 最新状态写入：最多 N 次
   - 事件记录写入：最多 N 次
   - 配额计数写入：最多 N 次
   - **总计**: 最多 3N 次写入

5. **优化效果**
   - v1.0 策略：约 1,010 次/天（超限 ⚠️）
   - v2.0 策略：约 675 次/天（节省 33% ✅）
   - 在正常使用情况下（每天状态变化不超过 330 次）不会超过免费套餐限制

### 数据保留策略
- **最新状态**: 无限期保存
- **变化事件**: 保留 7 天，每天最多保存 1000 个事件
- **配额计数**: 保留 7 天

---

# Worker API 接口

以下是充电桩监控系统提供的内部 API 接口。

## 基础信息

**Base URL**: `https://electric-bike-charging-pile.hansnow.me`

**认证方式**: 部分接口需要在请求头中提供 `X-Admin-Token`

## 状态监控接口

### 1. 查询附近充电桩

```http
POST /nearby
Content-Type: application/json

{
  "positioningFlag": 1,
  "deviceFamily": 0,
  "lat": 40.043910,
  "lng": 116.283760,
  "name": "",
  "mapType": 2
}
```

**响应**:
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
      "online": 1,
      "address": "北京市海淀区旺科东路",
      // ... 更多字段
    }
  ]
}
```

### 2. 查询充电桩详情

```http
POST /detail
Content-Type: application/json

{
  "simId": "867997075125699",
  "mapType": 2,
  "chargeTypeTag": 0,
  "appEntrance": 1,
  "version": "new"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "ports": [
      { "status": 0, "statusSince": null },
      { "status": 1, "statusSince": 1762938823000 }
    ],
    "device": {
      "id": 773287,
      "name": "中电金信自行车充电1号桩",
      "simId": "867997075125699",
      "portNumber": 20,
      "freePortCount": 10,
      "online": 1,
      // ... 更多字段
    }
  }
}
```

### 3. 查询状态变化事件

```http
GET /events?date=2025-11-12
```

**参数**:
- `date` (可选): 日期，格式 YYYY-MM-DD，默认今天

**响应**:
```json
{
  "success": true,
  "date": "2025-11-12",
  "events": [
    {
      "id": "1-2-1762938823000",
      "stationId": 1,
      "stationName": "1号充电桩",
      "socketId": 2,
      "oldStatus": "occupied",
      "newStatus": "available",
      "timestamp": 1762938823000,
      "timeString": "2025-11-12 16:13:43"
    }
  ]
}
```

### 4. 手动触发状态检查

```http
POST /check-status
```

**响应**:
```json
{
  "success": true,
  "message": "状态检查完成",
  "result": {
    "timestamp": 1762938823000,
    "timeString": "2025-11-12 16:13:43",
    "stationsCount": 3,
    "eventsCount": 15,
    "hasAnyChange": true
  }
}
```

### 5. 查询统计数据

```http
GET /statistics?start=2025-11-01&end=2025-11-12
```

**参数**:
- `start` (可选): 开始日期，默认今天
- `end` (可选): 结束日期，默认今天
- 日期范围不能超过 31 天

**响应**:
```json
{
  "success": true,
  "startDate": "2025-11-01",
  "endDate": "2025-11-12",
  "statistics": {
    "daily": [...],
    "hourly": [...]
  }
}
```

---

## 空闲提醒接口

### 1. 查询空闲提醒配置

```http
GET /api/alert/config
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "idle_threshold_minutes": 30,
    "time_range_start": "08:00",
    "time_range_end": "17:00",
    "webhook_urls": "[\"https://webhook.site/xxx\"]",
    "enabled_station_ids": null,
    "enabled": 1,
    "retry_times": 2,
    "retry_interval_seconds": 60,
    "lark_enabled": 0,
    "lark_auth_token": null,
    "lark_chat_id": null,
    "created_at": 1762938823,
    "updated_at": 1762938823
  }
}
```

### 2. 更新空闲提醒配置

```http
POST /api/alert/config
X-Admin-Token: your-admin-token
Content-Type: application/json

{
  "idle_threshold_minutes": 45,
  "time_range_start": "09:00",
  "time_range_end": "18:00",
  "webhook_urls": "[\"https://webhook.site/xxx\"]",
  "enabled": 1,
  "lark_enabled": 1,
  "lark_auth_token": "your-lark-auth-token",
  "lark_chat_id": "oc_xxx"
}
```

**参数校验**:
- `idle_threshold_minutes`: 1-1440 之间
- `time_range_start/end`: HH:mm 格式
- `webhook_urls`: JSON 数组，每个 URL 必须以 http/https 开头
- `enabled`: 0 或 1
- `retry_times`: 0-10 之间
- `retry_interval_seconds`: 1-300 之间
- `enabled_station_ids`: JSON 数组或 null
- `lark_enabled`: 0（禁用）或 1（启用）
- `lark_auth_token`: 飞书鉴权令牌（字符串）
- `lark_chat_id`: 飞书群组 ID（可选，如果配置了默认群组可不传）

**响应**:
```json
{
  "success": true,
  "message": "配置更新成功"
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "缺少 X-Admin-Token 请求头"
}
```

### 3. 查询空闲提醒日志

```http
GET /api/alert/logs?date=2025-11-12&limit=100&offset=0
```

**查询参数**:
- `date` (可选): 日期过滤（YYYY-MM-DD）
- `stationId` (可选): 充电桩ID
- `socketId` (可选): 插座ID
- `success` (可选): 成功状态（'true'/'false'）
- `limit` (可选): 返回数量，默认 100
- `offset` (可选): 偏移量，默认 0

**响应**:
```json
{
  "success": true,
  "data": [
    {
      "id": "1-2-https://webhook.site/xxx-1762938823",
      "station_id": 1,
      "station_name": "1号充电桩",
      "socket_id": 2,
      "idle_minutes": 60,
      "idle_start_time": 1762935223,
      "webhook_url": "https://webhook.site/xxx",
      "response_status": 200,
      "response_body": "OK",
      "response_time_ms": 234,
      "success": 1,
      "error_message": null,
      "retry_count": 0,
      "triggered_at": 1762938823,
      "sent_at": 1762938823,
      "log_date": "2025-11-12",
      "lark_message_id": "om_xxx",
      "lark_success": 1,
      "lark_error_message": null,
      "lark_response_time_ms": 156
    }
  ],
  "count": 1
}
```

### 4. 测试 Webhook

```http
POST /api/alert/test
X-Admin-Token: your-admin-token
```

发送测试消息到所有配置的 Webhook URL。

**响应**:
```json
{
  "success": true,
  "message": "测试完成",
  "results": [
    {
      "url": "https://webhook.site/xxx",
      "success": true,
      "status": 200,
      "body": "OK",
      "retryCount": 0,
      "elapsedMs": 234
    }
  ]
}
```

### 5. 查询空闲提醒统计

```http
GET /api/alert/stats
```

返回近 7 天的统计数据。

**响应**:
```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 150,
      "successCount": 145,
      "failedCount": 5,
      "successRate": 97,
      "avgResponseTime": 235.5
    },
    "byStation": [
      {
        "station_id": 1,
        "station_name": "1号充电桩",
        "total": 50,
        "success_count": 48
      }
    ],
    "trend": [
      {
        "log_date": "2025-11-12",
        "total": 25,
        "success_count": 24
      }
    ]
  }
}
```

### Webhook Payload 格式

当检测到插座空闲超过阈值时，系统会向配置的 Webhook URL 发送 POST 请求：

```json
{
  "alertType": "socket_idle",
  "timestamp": 1762938823,
  "timeString": "2025-11-12 16:13:43",
  "station": {
    "id": 1,
    "name": "1号充电桩"
  },
  "socket": {
    "id": 2,
    "status": "available",
    "idleMinutes": 60,
    "idleStartTime": 1762935223,
    "idleStartTimeString": "2025-11-12 15:13:43"
  },
  "config": {
    "threshold": 30,
    "timeRange": "08:00-17:00"
  }
}
```

---

## 错误响应格式

所有接口在发生错误时返回统一格式：

```json
{
  "success": false,
  "error": "错误描述信息"
}
```

HTTP 状态码：
- `200` - 成功
- `400` - 请求参数错误
- `401` - 缺少认证 Token
- `403` - Token 无效
- `500` - 服务器内部错误

---

## 飞书消息发送

空闲提醒功能支持通过飞书消息通知。当检测到空闲插座时，系统会同时：
1. 发送 Webhook 请求到配置的 URL
2. 发送飞书消息到配置的群组（如果启用）

### 消息格式

飞书消息使用固定模板：`x号充电桩y号插座已经空闲z分钟啦`

例如：`1号充电桩2号插座已经空闲30分钟啦`

### 配置方式

通过更新配置接口启用飞书提醒：

```json
{
  "lark_enabled": 1,
  "lark_auth_token": "your-lark-auth-token",
  "lark_chat_id": "oc_xxx"
}
```

- `lark_enabled`: 设置为 1 启用，0 禁用
- `lark_auth_token`: 飞书消息服务的鉴权令牌（必填）
- `lark_chat_id`: 飞书群组 ID（可选，如果服务端配置了默认群组）

### 日志记录

飞书消息发送结果会记录在日志中：
- `lark_message_id`: 飞书消息 ID
- `lark_success`: 发送是否成功（1=成功，0=失败）
- `lark_error_message`: 错误信息（如果失败）
- `lark_response_time_ms`: 响应时间（毫秒）

---

## 相关文档

- [空闲提醒功能实现文档](./docs/idle-alert-implementation.md)
- [空闲提醒功能设计文档](./docs/idle-alert-design.md)
- [飞书消息集成文档](./docs/lark-integration.md)