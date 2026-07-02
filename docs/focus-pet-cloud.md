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

## Modal 托管部署

当前仓库提供 `modal_app.py`，用于把 Focus Pet Cloud 部署成一个 Modal Web Server。Modal 负责提供公网 HTTPS/WSS 入口，Node 服务仍然监听容器内 `47821` 端口。

```bash
modal deploy modal_app.py
```

也可以使用 npm 脚本：

```bash
npm run cloud:deploy:modal
```

部署配置：

- App 名称：`focus-pet-cloud`
- 容器镜像：`node:22-slim`
- 对外端口：`47821`
- 持久化目录：`/data/focus-pet-cloud`
- Modal Volume：`focus-pet-cloud-data`
- 保温策略：`min_containers=1`
- 扩容策略：`max_containers=1`

这里刻意限制为单容器。当前 Cloud 后端使用本地 JSON 文件保存用户、好友和审计数据，同时 WebSocket 连接也在当前进程内存里维护。如果直接横向扩容，两个用户可能被分配到不同容器，实时信令会断开；多个容器同时写同一个 JSON 文件也会有覆盖风险。后续如果需要承载更多用户，应把用户/好友/审计迁移到 Postgres，把 WebSocket 在线状态和信令路由迁移到 Redis、NATS 或托管实时消息服务。

TURN 需要通过环境变量配置，例如：

```bash
modal secret create focus-pet-cloud-turn \
  FOCUS_PET_CLOUD_RTC_ICE_SERVERS='[{"urls":["turn:turn.example.com:3478?transport=tcp"],"username":"user","credential":"password"}]'
```

如果接入 Modal Secret，需要在 `modal_app.py` 的 `@app.function(...)` 中增加 `secrets=[modal.Secret.from_name("focus-pet-cloud-turn")]`。

## GitHub 托管边界

GitHub 适合继续承担三件事：

- 公开源码仓库；
- GitHub Releases 下载 DMG/ZIP；
- GitHub Pages 托管官网、下载页或静态文档。

GitHub Pages 不能承载 Node/WebSocket 后端，也不能作为 Focus Pet Cloud 的语音/视频信令服务。它可以承载静态 HTML、CSS 和 JavaScript，但不能长期运行 `npm run cloud:serve` 这样的 Node 进程。GitHub Actions 适合 CI/CD 和自动打包，不适合作为常驻生产后端；GitHub Codespaces 是开发环境，也不适合给普通用户当稳定公网服务。

## 用户下载即用路径

要让用户“下载好就可以用上”，推荐拆成两个发布面：

1. GitHub Release 提供桌面端 DMG/ZIP。
2. Modal 提供统一 Focus Pet Cloud 后端。
3. 桌面端内置默认 Cloud URL，首次启动自动生成本机 `deviceId`。
4. 桌面端调用 `POST /api/users` 注册，保存 `userId`、`friendCode` 和设备绑定 `authToken` 到本机。
5. 用户只需要把 `friendCode` 发给对方，双方即可建立好友关系。
6. 发起语音/视频时，桌面端通过 Cloud WebSocket 交换 WebRTC offer、answer 和 ICE candidate。

当前仓库已经具备 Cloud 后端、Modal 部署入口、稳定 ID、好友码、认证 WebSocket 信令和 WebRTC TURN 配置接口。桌面端还需要继续补默认 Cloud URL、首次启动自动注册、账号面板和好友码输入流程，才能做到真正面向普通用户的零配置体验。
