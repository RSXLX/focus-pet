# Focus Pet Cloud

Focus Pet Cloud 是 Focus Pet 的公网后端方案，用于让下载用户拥有自己的稳定 ID，并支持两个人之间的文字、图片、语音和视频连接。

## 核心职责

- 用户注册：生成稳定 `userId`、公开 6 位数字 `friendCode` 和设备绑定 auth token。
- 好友配对：通过对方 6 位数字 `friendCode` 建立双向好友关系。
- 在线刷新：用户上线、下线或添加好友后，Cloud 会向本人和好友广播最新 state。
- 错误反馈：无效好友码会返回明确错误，桌面端不会把失败显示成添加成功。
- Cloud 消息：桌面端可发送文字和图片消息；图片当前以内联 data URL 存储，并限制大小，后续需要大文件时再接对象存储。
- WebSocket 信令：转发 `call-invite`、`rtc-offer`、`rtc-answer`、`rtc-ice` 等 WebRTC 信令。
- WebRTC 通话：语音和视频媒体由 WebRTC 在客户端之间传输，后端不保存音视频流。
- TURN 配置：复杂 NAT、公司网络、手机流量或跨运营商场景需要 TURN，提高语音/视频接通率。
- 屏幕检查代理：桌面端上传自己的低细节截图到 Cloud，Cloud 用后端环境变量中的 StepFun key 调用视觉模型，并只返回结构化判断结果。

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
FOCUS_PET_CLOUD_STEPFUN_API_KEY=replace-with-server-side-stepfun-key
FOCUS_PET_CLOUD_SCREEN_LLM_MODEL=step-3.7-flash
FOCUS_PET_CLOUD_SCREEN_CHECK_RATE_LIMIT_MAX=20
FOCUS_PET_CLOUD_RTC_ICE_SERVERS='[
  {
    "urls": ["turn:turn.example.com:3478?transport=tcp"],
    "username": "replace-with-turn-user",
    "credential": "replace-with-turn-password"
  }
]'
```

## Modal 部署和 TURN

Focus Pet Cloud 可以部署在 Modal，并由 Modal Secret 下发 `FOCUS_PET_CLOUD_RTC_ICE_SERVERS`。当前线上部署使用两个独立 Secret：

- `focus-pet-cloud-stepfun`：保存后端 StepFun key。
- `focus-pet-cloud-turn`：保存 Metered TURN ICE 配置。

需要注意：Modal 的 Web Endpoint 适合 HTTP/WebSocket 服务，Modal tunnel 可以暴露运行时 TCP 端口，但不是稳定的生产 TURN relay。TURN 服务本身仍建议使用托管 TURN 或自建 coturn，并确保开放客户端连接端口和 relay 端口；然后把生成的 ICE server JSON 配进 Focus Pet Cloud。

配置后执行：

```bash
modal secret create --force focus-pet-cloud-turn --from-dotenv /tmp/focus-pet-turn.env
npm run cloud:deploy:modal
node scripts/release-preflight.js --check cloud-health
npm run cloud:turn:verify
```

`cloud:turn:verify` 会读取线上 `/healthz`，注册一个临时 Cloud 用户读取 `/api/ice`，并对 `turns:` 或 `turn:?transport=tcp` 地址做本机 TCP 连通性探测。该脚本不会输出 TURN URL、username 或 credential；如果未加 `--skip-api-ice`，它会像 `cloud:smoke` 一样写入一个生产临时用户。

## HTTP API

### `GET /client`

公开 Cloud Web 客户端入口，不需要预置 token。用户打开后可以创建自己的稳定 ID、查看好友码、添加好友码，并通过 Cloud WebSocket 建立一对一 WebRTC 语音/视频通话。

该入口用于可选的聊天/通话客户端包。如果需要把 Cloud `/client` 包成一个只负责账号、好友和通话的远端客户端，可使用：

```bash
REMOTE_CLIENT_URL="https://cloud.example.com/client" npm run release:mac:remote-client
```

该客户端只包含账号、好友和通话能力，不展示对方活动快照或截图分析结果。

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
    "friendCode": "123456"
  },
  "authToken": "device-bound-token",
  "deviceId": "local-random-device-id",
  "iceServers": []
}
```

### `GET /api/me`

使用 `Authorization: Bearer <authToken>` 和 `x-focus-pet-device-id` 获取当前用户、好友列表和最近 Cloud 消息。

### `POST /api/friends`

使用好友码建立双向好友关系。

```json
{
  "friendCode": "654321"
}
```

### `POST /api/messages`

使用认证 token 向已配对好友发送文字或图片消息。

文字消息：

```json
{
  "to": "user_friend",
  "type": "text",
  "text": "今晚 8 点一起复盘"
}
```

图片消息：

```json
{
  "to": "user_friend",
  "type": "image",
  "text": "截图",
  "media": {
    "name": "screen.png",
    "mimeType": "image/png",
    "size": 1024,
    "url": "data:image/png;base64,..."
  }
}
```

### `GET /api/ice`

返回客户端创建 `RTCPeerConnection` 所需的 ICE server 配置。该接口需要认证。

发布前可用 `npm run cloud:turn:verify` 检查 `/healthz` 和认证后的 ICE 下发结果；可用 `npm run cloud:webrtc:verify` 注册两名临时 Cloud 用户，连接生产 WebSocket 信令，并在隐藏 Electron 浏览器里强制 `iceTransportPolicy: 'relay'` 建立 WebRTC 媒体连接。该脚本会用合成音频/视频轨道验证远端轨道到达和 relay candidate pair，但仍不能替代两台真实电脑、不同网络下的人工语音/视频验收。真实双机验收时，两端可点击桌面端通话状态行复制摘要，再用 `npm run call:acceptance -- --side-a alice.txt --side-b bob.txt --mode video` 生成本地 Markdown 记录；该记录只保存模式、状态、远端媒体、连接和 relay 结果，不保存好友码、token、SDP、ICE candidate、TURN URL、IP 或设备 ID。

### `POST /api/screen-check`

桌面端屏幕检查代理入口。该接口不要求桌面端携带 StepFun key；Cloud 会读取后端环境变量 `FOCUS_PET_CLOUD_STEPFUN_API_KEY`、`FOCUS_PET_CLOUD_SCREEN_LLM_API_KEY`、`FOCUS_PET_SCREEN_LLM_API_KEY`、`FOCUS_PET_STEPFUN_API_KEY`、`STEPFUN_API_KEY` 或 `STEP_API_KEY`。

请求：

```json
{
  "image": {
    "dataUrl": "data:image/png;base64,...",
    "sourceName": "Screen 1"
  },
  "currentTask": {
    "text": "完成论文阅读笔记"
  },
  "frontmost": {
    "app": "Preview",
    "title": "paper.pdf"
  }
}
```

返回：

```json
{
  "ok": true,
  "source": "focus-pet-cloud-stepfun",
  "status": "study",
  "taskRelevance": "on_task",
  "confidence": 0.91,
  "screenshotPolicy": {
    "storedToDisk": false,
    "returnedToClient": false
  }
}
```

安全边界：

- Cloud 不把截图原文返回给桌面端。
- Cloud 不把 StepFun key 返回给桌面端，也不要求桌面端保存 key。
- 默认限制单张图片大小，并按 IP/device 做请求限流。
- 生产环境建议只在 HTTPS 下开放该接口。

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
- StepFun key 只放在后端环境变量或 Modal Secret 中，不要写入仓库、README、打包脚本或桌面端安装包。
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

StepFun key 建议用 Modal Secret 注入：

```bash
umask 077
cat > /tmp/focus-pet-stepfun.env <<'EOF'
FOCUS_PET_CLOUD_STEPFUN_API_KEY=replace-with-stepfun-key
FOCUS_PET_CLOUD_SCREEN_LLM_ENDPOINT=https://api.stepfun.com/step_plan/v1
FOCUS_PET_CLOUD_SCREEN_LLM_MODEL=step-3.7-flash
EOF
modal secret create --force focus-pet-cloud-stepfun --from-dotenv /tmp/focus-pet-stepfun.env
rm -f /tmp/focus-pet-stepfun.env

npm run cloud:deploy:modal
```

TURN 也可以通过 Modal Secret 配置：

```bash
umask 077
cat > /tmp/focus-pet-stepfun.env <<'EOF'
FOCUS_PET_CLOUD_STEPFUN_API_KEY=replace-with-stepfun-key
FOCUS_PET_CLOUD_SCREEN_LLM_ENDPOINT=https://api.stepfun.com/step_plan/v1
FOCUS_PET_CLOUD_SCREEN_LLM_MODEL=step-3.7-flash
FOCUS_PET_CLOUD_RTC_ICE_SERVERS=[{"urls":["turn:turn.example.com:3478?transport=tcp"],"username":"user","credential":"password"}]
EOF
modal secret create --force focus-pet-cloud-stepfun --from-dotenv /tmp/focus-pet-stepfun.env
rm -f /tmp/focus-pet-stepfun.env
```

当前 `modal_app.py` 固定挂载 `focus-pet-cloud-stepfun`，这样本地部署和远端容器 import 时 Modal 依赖图保持一致。Secret 不存在时部署会失败；Secret 存在但缺少 StepFun key 时，`/api/screen-check` 会返回 `needs-config`。`/healthz` 会返回非敏感的 `rtc.configValid`、`rtc.configError` 和 `rtc.hasTurn` 字段，用来区分 TURN JSON 写错和 TURN 尚未配置；不会返回 TURN 地址、用户名或 credential。

## GitHub 托管边界

GitHub 适合继续承担三件事：

- 公开源码仓库；
- GitHub Releases 下载 DMG/ZIP；
- GitHub Pages 托管官网、下载页或静态文档。

GitHub Pages 不能承载 Node/WebSocket 后端，也不能作为 Focus Pet Cloud 的语音/视频信令服务。它可以承载静态 HTML、CSS 和 JavaScript，但不能长期运行 `npm run cloud:serve` 这样的 Node 进程。GitHub Actions 适合 CI/CD 和自动打包，不适合作为常驻生产后端；GitHub Codespaces 是开发环境，也不适合给普通用户当稳定公网服务。

## 用户下载即用路径

要让用户“下载好就可以用上”，推荐拆成两个发布面：

1. 默认公开下载由 GitHub Release 提供完整桌宠 DMG/ZIP，构建命令为 `npm run release:mac`。
2. Modal 提供统一 Focus Pet Cloud 后端，并通过 Secret 持有 StepFun key。
3. 桌面端内置默认 Cloud 检查 URL，首次启动自动生成本机 `screenCheckDeviceId`。
4. 桌面端调用 `POST /api/users` 注册，保存 `userId`、6 位数字 `friendCode` 和设备绑定 `authToken` 到本机。
5. 用户只需要复制 `friendCode` 发给对方，双方即可建立好友关系。
6. 双方可以通过 `POST /api/messages` 发送 Cloud 文字和图片消息。
7. 发起语音/视频时，桌面端通过 Cloud WebSocket 交换 WebRTC offer、answer 和 ICE candidate。
8. 开启屏幕检查时，桌面端调用 Cloud `/api/screen-check`，不需要用户配置或持有 StepFun key。
9. 如果只需要账号、好友和通话能力，可单独构建轻量聊天/通话客户端：`REMOTE_CLIENT_URL="https://cloud.example.com/client" npm run release:mac:remote-client`。

生产 Cloud 的非破坏性健康检查使用 `node scripts/release-preflight.js --check cloud-health`。发布前人工 smoke test 使用 `npm run cloud:smoke`；它会注册两个临时生产 Cloud 用户、互加好友、连接 WSS、发送并持久化 Cloud 文字/图片消息、转发一次通话邀请，并调用 `/api/screen-check`，因此不会自动加入 `release:preflight -- --run full`。

当前仓库已经具备 Cloud 后端、Modal 部署入口、公开 `/client` 聊天/通话客户端入口、完整桌宠内的 Cloud 账号/好友入口、稳定 ID、6 位数字好友码、文字/图片消息、认证 WebSocket 信令、WebRTC TURN 配置接口、后端屏幕检查代理，以及完整桌宠 macOS DMG/ZIP release 脚本。聊天/通话客户端 release 脚本仅作为可选发布面保留。
