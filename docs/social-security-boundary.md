# Focus Pet 社交服务安全边界

## 1. 范围

本文记录 Focus Pet 内置 HTTP/WebSocket 聊天与 WebRTC 信令服务的当前安全边界，覆盖邀请码、session token、Origin、媒体上传、媒体访问和通话信令。

本文不包含以下能力：

- 隐私模式。
- 敏感 App 列表。
- 窗口标题脱敏。
- 用户纠错机制。

## 2. 服务入口

默认入口：

- HTTP/WS 服务：`FOCUS_PET_CHAT_HOST`，默认 `0.0.0.0`。
- 端口：`FOCUS_PET_CHAT_PORT` 或 `PORT`，默认 `47321`。
- 对外 URL：`FOCUS_PET_CHAT_PUBLIC_URL`，未配置时使用当前请求 Host 或局域网地址。
- 数据目录：`FOCUS_PET_CHAT_DATA_DIR`，默认 `~/.hermes/focus-watchdog/social`。
- 代理来源信任：`FOCUS_PET_CHAT_TRUST_PROXY=true` 时，邀请码限流来源才会读取 `x-forwarded-for`。

服务默认可能暴露到局域网，因此所有状态、消息、媒体和信令接口都必须经过 token 或邀请码边界。

Node-only 部署入口启动时只会在 stdout 输出服务监听信息、公开 URL、数据目录和 `hasInviteUrl` 布尔摘要，不输出完整 owner `publicState()`（包括直接调用、声明初始化或后续赋值变量中转后的完整状态、完整状态变量二次别名链、非首个 console 参数、对象包装或模板字符串输出）、`publicState` 变量上的敏感属性及其声明初始化、后续赋值或二次别名链得到的变量（包括非首个 console 参数、对象包装或模板字符串输出）、从 owner 状态解构出的敏感字段及其派生别名链（包括非首个 console 参数、对象包装和模板字符串输出）、完整 `inviteUrl`、邀请码、owner token 或 peer session token；`uncaughtException` / `unhandledRejection` 会先经过 `sanitizeLogText()` 再写入 stderr，避免容器平台持久化日志后暴露加入链接、token 或异常上下文。

## 3. 邀请码

邀请码用于外部用户首次加入：

- 状态字段：`inviteCode`、`inviteCreatedAt`、`inviteExpiresAt`。
- 新状态默认生成 7 天有效的邀请码。
- 重置邀请码会生成新 `inviteCode`，并刷新 `inviteCreatedAt` 和 `inviteExpiresAt`。
- 过期邀请码不能创建新的 peer session。
- 同一来源 10 分钟内最多允许 5 次错误邀请码尝试；超过后会拒绝继续换取 peer session，直到窗口结束。
- 错误尝试会写入 `chat-state.json` 的 `inviteAttempts`，来源 key 使用 SHA-256 哈希，不保存原始 IP 或 `x-forwarded-for` 值。
- 服务重启后，窗口内的错误尝试记录仍会继续生效。
- 成功使用邀请码加入后，会清除该来源的失败尝试记录。
- 容器或 Node-only 启动日志不输出完整 owner `publicState()`（包括直接调用、声明初始化或后续赋值变量中转后的完整状态、完整状态变量二次别名链、非首个 console 参数、对象包装或模板字符串输出）、`publicState` 变量上的敏感属性及其声明初始化、后续赋值或二次别名链得到的变量（包括非首个 console 参数、对象包装或模板字符串输出）、从 owner 状态解构出的敏感字段及其派生别名链（包括非首个 console 参数、对象包装和模板字符串输出）、完整邀请链接、邀请码、owner token 或 peer session token；部署者需要通过桌面端或 owner 状态接口查看 `inviteUrl`。

重置邀请码只阻止后续新用户继续使用旧邀请码，不会踢出现有 peer session。现有 peer session 可以通过聊天面板的“撤销会话”入口或 owner API 显式撤销；撤销只删除该 peer 的 session token、关闭已连接的 peer WebSocket，并保留好友和聊天记录。移除好友仍会同时删除对应 session 和聊天记录，session 自身也会在过期后认证失败。

邀请码尝试限流默认按 socket remote address 识别来源。只有配置 `FOCUS_PET_CHAT_TRUST_PROXY=true` 时，才会优先取 `x-forwarded-for` 首个地址，以适配可信反向代理后的云端部署。单进程本地服务、局域网使用和服务重启场景可直接生效；云端多实例部署仍需要在反向代理、网关或共享存储层补充全局限流。

## 4. Session Token

session token 分为两类：

- Owner token：桌面端所有者 token，仅桌面端完整状态可见。
- Peer session token：外部用户通过邀请码换取，只能访问自己的会话视图。

当前边界：

- Peer session 包含 `createdAt`、`lastSeenAt`、`expiresAt`。
- 新 peer session 默认 30 天有效。
- 过期 peer session token 认证失败。
- 新 peer session 会绑定一个浏览器本地随机 `deviceId`；服务端只保存 `deviceIdHash`，不保存明文设备 id。
- Peer HTTP API 通过 `x-focus-pet-device-id` 传递本地 device id，WebSocket 和媒体读取通过 `deviceId` 查询参数传递；token 与 device id 不匹配时认证失败。
- 旧版本中没有 `deviceIdHash` 的历史 session 会保留到过期或被移除；新创建 session 默认启用设备绑定。
- Owner 可通过桌面端 `chat:revoke-peer-session` IPC 或 HTTP `POST /api/friends/:friendId/sessions/revoke` 撤销某个 peer 的所有 session；撤销后旧 token 立即无法认证。
- 移除好友会同时删除该好友对应的 session。
- Peer 无法读取 owner token。
- Peer 默认只能读取自己与 owner 的消息、自己的状态、owner 共享给自己的状态。
- Peer 触发 HTTP `/api/friends/read` 或 WebSocket `mark-read` 时，只能把 owner 发给自己的消息标记为已读；不能清理 owner 侧其他好友的未读数，也不能把其他 peer 发给 owner 的消息标为已读。

## 5. Origin 与 CORS

服务会检查浏览器请求的 `Origin`：

- 无 `Origin` 的本地进程、服务端或非浏览器请求允许通过。
- 与当前请求 Host 同源的浏览器请求允许通过。
- `FOCUS_PET_CHAT_ALLOWED_ORIGINS` 中显式配置的 Origin 允许通过。
- Electron 桌面端的 `file://` Origin 在服务入口中允许通过。
- 其他 Origin 返回 `403 origin forbidden`。

CORS 响应不再使用 `*`，而是回写允许的 Origin，并设置 `Vary: Origin`。

示例：

```bash
FOCUS_PET_CHAT_ALLOWED_ORIGINS="https://chat.example.com,https://app.example.com" npm run chat:serve
```

## 6. 媒体上传

媒体上传接口要求已认证。

限制：

- 默认大小上限来自设置项 `maxMediaMb`。
- 支持图片、视频、音频。
- 支持常见文档和压缩包：PDF、TXT、MD、CSV、JSON、ZIP、DOC/DOCX、XLS/XLSX、PPT/PPTX。
- 拒绝可执行文件和不在白名单中的 MIME/扩展名组合。
- 保存前会做轻量内容嗅探：拒绝 `MZ`、ELF、Mach-O 等可执行文件头，并校验 PDF、ZIP/OOXML、PNG、JPEG、GIF、WEBP 和旧 Office OLE 文件头是否与声明类型一致。
- 文本类文件和音视频容器不做深度解析；该嗅探用于阻断明显伪装文件，不等同于病毒扫描。
- 保存文件名使用随机 UUID，不使用用户上传文件名作为磁盘路径。
- 展示文件名会规整为 basename，去掉 `../`、子目录和反斜杠路径片段。
- 媒体读取路径会限制在 `media/` 目录内。

## 7. 媒体访问

`/media/:id` 需要有效 token。

当前边界：

- 无 token 或 token 无效时返回 `401 unauthorized`。
- 媒体 ID 只取 basename 后映射到 `media/` 目录。
- 媒体 URL 可带 `token` 查询参数，供浏览器图片、音频和视频标签读取。

## 8. 控制端 / 被控制端活动边界

Focus Pet 的公开分发边界改为两端模型：

- 控制端：owner，本机运行在开发者/监督者设备上，可以查看被控制端提交的完整活动快照、屏幕分析摘要、截图媒体引用和本机复盘数据。
- 被控制端：peer，面向公开下载用户，只用于加入会话、文字/媒体消息、语音消息和 WebRTC 语音/视频；不接收任何对方活动快照、截图分析摘要或活动历史。

服务端强制执行该边界，不依赖前端隐藏字段：

- peer 调用 `/api/state` 时，`activities` 恒为空对象，`activityLog` 恒为空数组。
- peer 接收 WebSocket 时，不发送 `activity` 事件。
- peer 的 `messages[*].activity` 恒为 `null`，避免通过消息列表绕过活动边界。
- peer 即使自己提交活动快照，也不会从服务端回读活动结果；该结果只进入 owner 本机视图。
- owner 调用本机状态接口或 WebSocket 时，仍保留完整活动数据，用于本机监督、复盘和诊断。
- 被控制端发布包不渲染“对方正在做什么”或截图分析面板。
- 公开发布使用 `npm run release:mac:controlled` 生成被控制端 DMG/ZIP/manifest；完整桌面端保留为控制端/开发端，不作为普通公开下载包。

本文档不引入隐私模式、敏感 App 列表、窗口标题脱敏或用户纠错机制。

## 9. WebRTC 信令

WebRTC 只由服务转发信令，不在服务端保存音视频流。

当前边界：

- WebSocket 连接需要有效 token。
- WebSocket 同样执行 Origin 校验。
- Peer 只能向 owner 发起信令。
- Owner 只能向已知好友发起信令。
- 不认识的通话对象会被拒绝。
- ICE 服务器来自 `FOCUS_PET_RTC_ICE_SERVERS`，未配置时使用默认 STUN；复杂 NAT、公司网络、手机流量或跨运营商场景建议配置 TURN。
- 桌面端和远端浏览器端首次发起或接收 WebRTC 通话前，会显示网络地址暴露提示；用户点击继续后才会请求麦克风/摄像头或创建 PeerConnection。
- 提示确认状态仅保存在当前端本机 `localStorage`，不会上传到聊天服务。
- 通话取消或结束时，桌面端和远端浏览器端都会清空待确认的 WebRTC 提示回调和模式，避免隐藏提示后残留旧通话动作。
- 通话结束由客户端停止本地媒体轨道、关闭 peer connection，并清空本地/远端 video 的 `srcObject`。
- 服务端记录通话生命周期审计 `callAuditLog`，仅包含事件类型、from、to、callId、mode、是否送达、送达客户端数量和时间。
- `callAuditLog` 不保存音视频、SDP、ICE candidate、TURN 地址、TURN username 或 TURN credential。

TURN 配置示例：

```bash
FOCUS_PET_RTC_ICE_SERVERS='[
  {
    "urls": ["turn:turn.example.com:3478?transport=tcp"],
    "username": "replace-with-turn-user",
    "credential": "replace-with-turn-password"
  }
]'
```

诊断边界：

- `healthState().rtc` 和诊断摘要只输出配置来源、STUN/TURN 数量、是否需要 TURN 和固定引导文案。
- 诊断摘要不输出 ICE/TURN URL、TURN username 或 TURN credential。
- 未配置 `FOCUS_PET_RTC_ICE_SERVERS` 时，诊断会标记 `usingDefault: true`、`hasTurn: false`、`requiresTurn: true`。
- 已配置 `turn:` 或 `turns:` 时，诊断会标记 `hasTurn: true`、`requiresTurn: false`。

## 10. 当前未覆盖风险

以下内容尚未进入本阶段实现：

- 病毒扫描。
- 压缩包内部文件枚举、宏检测或深度内容扫描。
- 跨进程或多实例之间共享同一邀请码失败尝试计数；云端多实例部署仍需要在反向代理、网关或共享存储层补充全局限流。单进程服务重启后窗口内错误尝试记录已由 `chat-state.json` 持久化覆盖。

这些属于后续安全硬化项，不影响当前已落地的 P0 第一阶段边界。
