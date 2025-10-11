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

1. **状态变化检测**
   - 每次检查时读取上一次的状态
   - 对比当前状态与历史状态
   - 仅在检测到变化时写入 KV

2. **存储策略**
   - **最新状态** (`latest:{stationId}`): 只在该充电桩状态变化时更新
   - **状态快照** (`snapshot:{date}:{timestamp}`): 只在有任何状态变化时存储
   - **变化事件** (`events:{date}`): 只在有状态变化时追加事件

3. **写入次数估算**
   - 假设每天有 N 次状态变化
   - 最新状态写入：最多 N 次
   - 状态快照写入：最多 N 次
   - 事件记录写入：最多 N 次
   - **总计**: 最多 3N 次写入
   - 在正常使用情况下（每天状态变化不超过 300 次）不会超过免费套餐限制

### 数据保留策略
- **最新状态**: 无限期保存
- **状态快照**: 保留 7 天
- **变化事件**: 保留 7 天，每天最多保存 1000 个事件