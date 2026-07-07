# Focus Pet 开发闭环方案

更新时间：2026-07-07

## 目标

Focus Pet 下一阶段不继续堆功能，而是把普通用户“下载后真的能用”的核心闭环做完整。

v1.1 只闭合三条主线：

1. 桌宠陪伴：宠物能根据任务、学习、游戏、分心、未知状态变化。
2. 自我检查：用户主动或开启后，通过 Focus Pet Cloud 里的 StepFun key 检查自己的屏幕，不需要用户配置 key。
3. 好友陪伴：用户下载后拥有自己的 ID / 好友码，可以和另一个人语音、视频。

## 当前落地状态

更新时间：2026-07-07

- Phase 1 已闭合：桌面端默认使用 `screenCheckTransport: 'auto'` 和线上 Focus Pet Cloud `/api/screen-check`，新用户不需要本机 StepFun key；屏幕检查默认只回到本机，不启动本地聊天服务，不保存截图到聊天媒体。只有用户把“好友可见性”显式改成“好友记录屏幕分析摘要”时，才会发布屏幕摘要。
- Phase 2 已接入完整桌面 Pet：聊天面板默认使用 Cloud 账号，支持创建 ID、显示/复制 6 位数字好友码、添加好友码、Cloud 文字/图片消息、持久化本机账号、Cloud WebSocket 信令、语音和视频按钮。Cloud 模式会显示“正在连接 / 已连接 / 已断开 / 连接异常”，通话点击时会主动连接 Cloud socket。
- Phase 2 可靠性补齐：无效好友码会返回明确错误，不再显示成添加成功；Cloud 用户上线、下线和添加好友后会向本人和好友广播最新 state，用于刷新在线状态。
- Phase 3 自动门禁已部署：Modal `focus-pet-cloud` 已挂载 StepFun Secret 和独立 TURN Secret；`/healthz` 返回 `screenCheck.enabled=true`、`rtc.configValid=true`、`rtc.hasTurn=true`。新增 `npm run cloud:webrtc:verify` 会注册两名临时 Cloud 用户、复用生产 WSS 信令、强制 `iceTransportPolicy: 'relay'`，并用合成音频/视频轨道验证浏览器 WebRTC 媒体能走 TURN relay。不同网络下两台真实电脑语音/视频仍是发布前人工实机验收项，不能只用本机脚本替代；两端点击通话状态行复制摘要后，可用 `npm run call:acceptance` 合并生成本地 Markdown 验收记录。
- Phase 4 已按产品决策跳过 Apple Developer ID 签名和 notarization，完成 ad-hoc signed DMG/ZIP/manifest GitHub Release 路径；公开文档继续说明 macOS 首次打开可能出现 Gatekeeper 提示。
- v1.1.3 已发布到 GitHub Release：`https://github.com/RSXLX/focus-pet/releases/tag/v1.1.3`，资产包含 `Focus-Pet-1.1.3-mac-arm64.dmg`、`Focus-Pet-1.1.3-mac-arm64.zip` 和 SHA-256 manifest；这版收敛更大的设置客户端面板、Cloud relay-only WebRTC 验证、Cloud 文字/图片 smoke 增强和通话人工验收记录工具。
- 线上验证已跑通并在 2026-07-07 14:54 CST 复验通过：`cloud-health`、完整 `npm run cloud:turn:verify`、完整 `npm run cloud:webrtc:verify`、完整 `npm run cloud:smoke` 均通过；`cloud:smoke` 覆盖注册、无效好友码拒绝、互加好友、在线/离线刷新、Cloud 文字/图片消息、WebSocket 通话邀请和 `/api/screen-check`。`cloud:webrtc:verify` 已覆盖 audio/video 两种模式、远端轨道到达和 relay candidate pair；仍不能替代两台真实电脑跨网人工验收。

## 暂缓范围

以下内容先不做，避免继续扩大复杂度：

- 暂停继续生成更多 GIF / 更多动作，等核心闭环完成后再补。
- 暂停 Windows 正式发布承诺，先把 macOS Apple Silicon 做稳定。
- 暂停 Apple Developer ID 签名和 notarization；当前用户要求只做无需公证的正式 GitHub Release 包。
- 暂停后台管理台、团队系统、订阅、排行榜、复杂数据分析。
- 暂停 Postgres / Redis，多用户量没有起来前继续单 Modal 容器。
- 不做隐藏监控，不做内部角色命名的公开产品逻辑，只保留“自我检查 + 可选好友陪伴”。

## Phase 1：屏幕检查下载即用

目标：用户不配置 API key，也能在本地 Pet 点一次“屏幕检查”并得到结果。

### 问题

当前 `sampleScreenMonitor()` 做完屏幕分析后会调用 `publishScreenActivity()`，这会把自我检查和社交分享混在一起。对“自己检查自己”来说，默认启动聊天服务和保存截图媒体都太重。

相关位置：

- `src/main.js`：`sampleScreenMonitor()`
- `src/settings-store.js`：默认设置
- `src/renderer.js`：设置页和权限引导

### 开发内容

1. 修改 `sampleScreenMonitor()`：
   - 默认只在本机返回检查结果。
   - 只有用户显式开启“分享屏幕摘要给好友”时，才调用社交发布逻辑。
   - 默认不启动本地聊天服务。
   - 默认不保存截图到聊天媒体。

2. 调整默认 LLM 设置：
   - 保留 `screenCheckTransport: 'auto'`。
   - 保留默认 Cloud URL。
   - 建议把 `reviewLlmEnabled` 默认改成 `false`，避免 daily review 继续要求本机 LLM key。

3. 补首启权限引导：
   - 没有辅助功能权限时，引导打开 macOS 辅助功能设置。
   - 没有屏幕录制权限时，引导打开屏幕录制设置。
   - 不写长说明，只保留状态、按钮和短提示。

### 验收标准

- 新用户本机没有 StepFun key。
- 点击手动屏幕检查，走 Focus Pet Cloud `/api/screen-check`。
- 不自动启动本地聊天服务。
- 不保存截图到聊天媒体。
- `npm test` 通过。
- `npm run check` 通过。
- `npm run verify:pet-render` 通过。

## Phase 2：Cloud ID / 好友码 / 通话接入完整桌面 Pet

目标：发布的完整桌宠 App 里就能创建 ID、显示/复制 6 位数字好友码、加好友、发文字、发图片、语音、视频，不再依赖单独 `/client` 页面。

### 问题

当前能力分裂成两条线：

- 完整桌面 Pet 主要走本地聊天服务。
- Cloud `/client` 页面拥有注册、好友码、WebSocket、WebRTC。

这导致“下载完整桌宠后拥有自己的 ID 并能通话”的产品体验没有闭合。

相关位置：

- `src/preload.js`：当前暴露的是本地聊天 IPC。
- `src/renderer.js`：聊天 WebSocket 连接本机端口。
- `src/cloud-service.js`：Cloud `/client` 内已有注册、好友码、WebRTC 逻辑。

### 开发内容

1. 新增 `src/cloud-client.js`：
   - `registerCloudUser()`
   - `getCloudMe()`
   - `addCloudFriend()`
   - `sendCloudMessage()`
   - `clearCloudAccount()`
   - 只做 REST 包装，不新增依赖，不做复杂 SDK。

2. 新增 Cloud IPC：
   - `cloud:get-state`
   - `cloud:register`
   - `cloud:add-friend`
   - `cloud:send-message`
   - `cloud:refresh`
   - `cloud:clear-account`

3. 复用现有聊天 UI：
   - `chatState` 增加来源字段：`local` / `cloud`。
   - 公开版本默认使用 Cloud 模式。
   - 本地聊天保留为开发和离线 fallback。

4. 改造 `connectChatSocket()`：
   - 本地模式继续连接 `ws://127.0.0.1:${port}`。
   - Cloud 模式连接 `wss://<cloud-host>?token=<authToken>&deviceId=<deviceId>`。

5. 复用现有 WebRTC 函数：
   - 不重写 `RTCPeerConnection` 逻辑。
   - 只适配 Cloud event payload。

6. 收敛公开 UI：
   - 公开版本主推 Cloud 6 位数字好友码。
   - 不再主推本地 invite URL。
   - 不出现内部角色旧称。

### 验收标准

- 新装 App 打开聊天页，能创建我的 ID。
- 显示并复制 6 位数字好友码。
- 两台机器可以互加好友码。
- 两台机器可以发送 Cloud 文字和图片消息。
- 好友在线状态能刷新。
- 语音通话可以建立。
- 视频通话可以建立。
- 退出重开后 ID 不丢。

## Phase 3：配置 TURN

目标：语音/视频跨网络稳定可用。

### 问题

线上 Cloud `/healthz` 当前显示 RTC 没有 TURN。没有 TURN 时，同一局域网可能可用，但跨 NAT、校园网、公司网会不稳定。

### 开发内容

1. 准备 TURN 服务。
2. 将 TURN ICE 配置加入 `focus-pet-cloud-turn` Modal Secret。Modal 负责部署 Focus Pet Cloud 和下发配置；真正的 TURN relay 需要托管 TURN 或自建 coturn，不能只依赖 Modal Web Endpoint。

```env
FOCUS_PET_CLOUD_RTC_ICE_SERVERS=[{"urls":["turn:your.turn.host:3478?transport=tcp"],"username":"xxx","credential":"xxx"}]
```

3. 重新部署：

```bash
npm run cloud:deploy:modal
```

4. 本地验证：

```bash
node scripts/release-preflight.js --check cloud-health
npm run cloud:turn:verify
npm run cloud:webrtc:verify
npm run call:acceptance -- --side-a path/to/alice-summary.txt --side-b path/to/bob-summary.txt --mode video
```

5. 修改 release preflight：
   - 生产发布时 `/healthz` 必须满足 `ok=true`。
   - `screenCheck.enabled=true`。
   - `rtc.hasTurn=true`。

### 验收标准

- 不同网络下两台电脑语音可通。
- 不同网络下两台电脑视频可通。
- `/healthz` 返回 `rtc.hasTurn=true`。
- `npm run cloud:turn:verify` 能确认桌面端可拿到 TURN ICE 配置，并在 TCP TURN 配置存在时验证本机 TCP 可达。
- `npm run cloud:webrtc:verify` 能强制 relay-only 建立浏览器 WebRTC，并收到合成音频/视频远端轨道。
- 两台真实电脑人工验收时，桌面端通话状态行能显示远端音频/视频已到达；跨复杂网络时优先确认显示 `relay`。
- 两台真实电脑人工验收时，可点击通话状态行复制无敏感信息的验收摘要，便于保留双方证据。
- 两台真实电脑复制出来的验收摘要可通过 `npm run call:acceptance` 生成本地记录；记录不得包含好友码、token、SDP、ICE candidate、TURN URL、IP 或设备 ID。

## Phase 4：macOS 发布闭环

目标：用户下载 DMG / ZIP 后可以拿到正式 GitHub Release 包，发布说明不夸大。

当前产品决策是不做 Apple Developer ID 签名和 notarization，因此 Phase 4 只闭合 ad-hoc signed 发布包、checksum 和真实下载说明。Developer ID 签名、公证和“无痕下载即用”文案后移到单独版本。

### 开发内容

1. 使用 ad-hoc signing 生成 macOS Apple Silicon DMG / ZIP。
2. Release 附带 manifest / checksum。
3. 当前 ad-hoc Release 前固定执行：

```bash
npm test
npm run check
npm run verify:pet-render
node scripts/release-preflight.js --check cloud-health
npm run cloud:turn:verify
npm run cloud:webrtc:verify
npm run cloud:smoke
npm run release:preflight -- --run fast
npm run release:mac
```

4. README 只写真实状态：
   - 没 notarize 就不能写“无痕下载即用”。
   - 已 notarize 后再更新下载说明。
   - 当前版本必须说明首次打开可能有 Gatekeeper 提示。

### 验收标准

- DMG / ZIP 都能构建成功。
- ad-hoc 签名路径构建成功。
- GitHub Release 附带 checksum。
- README 下载说明和真实发布状态一致。

## Phase 5：文档和版本管理

目标：公开文档、内部文档、Release 说明保持一致。

### 需要更新

- `README.md`
- `README.zh-CN.md`
- `docs/focus-pet-cloud.md`
- `docs/releases/v1.0.4.md`
- `docs/releases/v1.1.0.md`
- `docs/release-checklist.md`

### 版本建议

- `v1.0.4`：屏幕检查默认 Cloud 可用，关闭默认社交副作用。
- `v1.1.0`：完整桌面 Pet 内置 Cloud ID / 好友码 / 语音 / 视频。
- `v1.1.1`：Cloud 好友状态刷新、无效好友码错误反馈、线上 smoke 增强、TURN 配置验证和 ad-hoc signed GitHub Release。
- `v1.1.2`：宠物气泡和系统通知提示更新，用户确认后直接下载并打开最新安装包；Cloud 好友码改为 6 位数字，桌面端支持 Cloud 文字/图片消息，设置类页面使用更大的客户端面板。
- `v1.1.3`：Cloud relay-only WebRTC 自动门禁、Cloud 文字/图片 smoke 持久化验证、通话状态复制验收摘要和 `call:acceptance` 本地验收记录。
- `v1.2.0` 或后续版本：在需要“免 Gatekeeper 提示”分发时，再做 Apple Developer ID 签名和 notarization。

## 最小开发顺序

1. 修 `sampleScreenMonitor()` 的默认分享副作用。
2. 把 `reviewLlmEnabled` 默认关掉。
3. 加首启权限引导。
4. 做 `src/cloud-client.js`。
5. 把 Cloud 账号接进桌面聊天面板。
6. 复用现有 WebRTC，切换本地 / Cloud socket。
7. 配 TURN。
8. 做 ad-hoc signed GitHub Release。
9. Apple Developer ID 签名和 notarization 后移到后续版本。

## 原则

这条路线复用现有 Cloud 后端、现有聊天 UI、现有 WebRTC 逻辑，不重做客户端，不新增数据库，不新增复杂后台。

只有当真实用户量、连接稳定性或数据一致性成为实际问题时，再升级到 Postgres、Redis 或托管实时消息服务。
