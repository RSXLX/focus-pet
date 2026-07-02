# Focus Pet Cloud

Focus Pet Cloud 是 Focus Pet 的公网后端方案，用于让下载用户拥有自己的稳定 ID，并支持两个人之间的文字、语音和视频连接。

## 核心职责

- 用户注册：生成稳定 `userId`、公开 `friendCode` 和设备绑定 auth token。
- 好友配对：通过对方 `friendCode` 建立双向好友关系。
- WebSocket 信令：转发 `call-invite`、`rtc-offer`、`rtc-answer`、`rtc-ice` 等 WebRTC 信令。
- WebRTC 通话：语音和视频媒体由 WebRTC 在客户端之间传输，后端不保存音视频流。
- TURN 配置：复杂 NAT、公司网络、手机流量或跨运营商场景需要 TURN，提高语音/视频接通率。

## 运行

```bash
npm run cloud:serve
```

默认端口为 `47821`：

```bash
FOCUS_PET_CLOUD_PORT=47821 npm run cloud:serve
```

可选环境变量：

```bash
FOCUS_PET_CLOUD_HOST=0.0.0.0
FOCUS_PET_CLOUD_PUBLIC_URL=https://cloud.example.com
FOCUS_PET_CLOUD_DATA_DIR=/data/focus-pet-cloud
FOCUS_PET_CLOUD_RTC_ICE_SERVERS='[
  {
    "urls": ["turn:turn.example.com:3478?transport=tcp"],
    "username": "replace-with-turn-user",
    "credential": "replace-with-turn-password"
  }
]'
```

## HTTP API

### `POST /api/users`

注册一个用户和当前设备。

请求：

```json
{
  "displayName": "Alice",
  "deviceId": "local-random-device-id"
}
```

返回：

```json
{
  "user": {
    "id": "user_xxx",
    "displayName": "Alice",
    "friendCode": "FP-ABCD-1234"
  },
  "authToken": "device-bound-token",
  "deviceId": "local-random-device-id",
  "iceServers": []
}
```

### `GET /api/me`

使用 `Authorization: Bearer <authToken>` 和 `x-focus-pet-device-id` 获取当前用户和好友列表。

### `POST /api/friends`

使用好友码建立双向好友关系。

```json
{
  "friendCode": "FP-WXYZ-5678"
}
```

### `GET /api/ice`

返回客户端创建 `RTCPeerConnection` 所需的 ICE server 配置。该接口需要认证。

## WebSocket 信令

连接格式：

```text
wss://cloud.example.com?token=<authToken>&deviceId=<deviceId>
```

支持事件：

- `call-invite`
- `call-answer`
- `call-reject`
- `call-cancel`
- `call-end`
- `rtc-offer`
- `rtc-answer`
- `rtc-ice`

后端只允许好友之间一对一转发信令。非好友、未知用户或缺少 token 的连接会被拒绝。

## 语音和视频

语音和视频由客户端使用 WebRTC 建立：

1. A 通过 WebSocket 发起 `call-invite`。
2. A 创建 `rtc-offer`。
3. B 创建 `rtc-answer`。
4. 双方交换 `rtc-ice`。
5. 媒体流走 P2P；P2P 失败时走 TURN。

服务端只记录通话生命周期审计，例如事件类型、from、to、callId、mode、是否送达和时间。审计不会保存 SDP、ICE candidate、TURN 地址、TURN username、TURN credential、音频或视频。

## 部署建议

- 生产环境必须使用 HTTPS/WSS，否则浏览器无法稳定调用麦克风和摄像头权限。
- 必须配置 TURN；只靠 STUN 在复杂网络下会有大量连接失败。
- auth token 需要通过 HTTPS 传输，不要写入公开日志。
- `FOCUS_PET_CLOUD_DATA_DIR` 应挂载持久化磁盘。
