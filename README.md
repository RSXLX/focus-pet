# Focus Pet

一个中隐私桌面宠物 MVP：透明置顶窗口，只读取当前前台 App 和窗口标题，用来轻提醒、任务提醒和每日复盘。

系统基本内容与功能说明见 [docs/system-overview.md](docs/system-overview.md)。任务模型见 [docs/task-model.md](docs/task-model.md)。社交服务安全边界见 [docs/social-security-boundary.md](docs/social-security-boundary.md)。数据存储恢复机制见 [docs/storage-recovery.md](docs/storage-recovery.md)。诊断摘要见 [docs/diagnostics.md](docs/diagnostics.md)。

## 功能

- 透明无边框、置顶、可拖动的桌面宠物窗口。
- 默认系统级 click-through，只有鼠标进入宠物、气泡或面板时才接管点击。
- 每分钟读取一次当前前台 App/窗口标题。
- 根据分心关键词、工作/学习/游戏关键词、工作/游戏 App、“当前任务”内容以及任务声明的相关 App/关键词判断 `work`、`study`、`game`、`distracted`、`unknown`、`permission` 状态。
- 绿色状态点表示工作，蓝紫色表示学习，紫色表示游戏/娱乐，红色表示疑似分心，黄色表示未知或权限问题。
- Nervy 宠物 spritesheet 内置 30 行全身动画，覆盖基础状态、工作/学习/游戏、照料动作、复盘阅读、补水、冥想、早安、抱抱、惊讶、哭哭、生气、OK、想你和通话陪伴等动作；聊天中可发送 21 个独立宠物动图和一个组合演示动图，素材来自短发毛衣、浅色洞洞鞋小人形象的独立 PNG 图片包，当前包含 24 张源图和 190 张动作帧图。
- 内置结构化任务系统，支持新增、完成、编辑、删除、置顶/置底、优先级、截止日期、下一步、阻塞原因、相关 App/关键词和当前任务选择解释；同时兼容导入/导出 `~/.hermes/focus-watchdog/today_tasks.md`。
- 内置近 24 小时复盘，读取 `~/.hermes/focus-watchdog/activity.jsonl`，按任务维度汇总推进分钟、疑似偏离、阻塞原因和缺少下一步的任务，并生成长期未完成、打断、App 切换、高质量专注块和偏离时段的行动建议。
- 新手引导提供基础、增强、高级三层模式；基础模式可一键完成，并保持屏幕监控、复盘 LLM、自动更新等高级能力关闭。
- 设置面板按基础、判断、AI、社交、高级分层，支持提醒冷却、自动弹出、空闲提醒、媒体上限、宠物行为强度、开机启动、关键词/App 规则、LLM 自检、数据目录、诊断摘要和更新源配置。
- 可选屏幕监控任务：开启后按设定间隔截取低细节屏幕缩略图，发送到 OpenAI-compatible 视觉 LLM，按结构化 schema 返回状态、任务相关性、依据、置信度和建议干预；无效 schema 会降级为 `unknown`，低置信度不会主动强提醒。
- 内置 HTTP/WebSocket 聊天与 WebRTC 信令服务，支持桌面端和浏览器外部用户互相通信。
- 桌面端低内存启动：社交聊天服务、诊断模块、屏幕监控、LLM 自检、聊天 WebSocket 和宠物 GIF 预览都按需加载；关闭聊天动图托盘会释放图片节点，减少长时间运行后的图片解码占用。
- 支持邀请码入群、外部用户 scoped session token、昵称、在线状态、未读计数、文本、图片、文件、语音消息和 queued/sent/delivered/read 发送状态。
- 支持一对一实时语音聊天、实时视频聊天、媒体大小限制、Token 本地认证、清空历史和重置邀请码。
- 聊天框默认不常驻，点击聊天、收到消息或疑似偏离任务时智能弹出。
- 浏览器完整聊天页：桌面端状态里会生成带邀请码的 `inviteUrl`；默认会优先使用本机局域网 IP，方便第二台设备直接打开。

## 运行

```bash
cd ~/focus-pet
npm start
```

## 测试

```bash
npm test
npm run check
npm run diagnostics
npm run diagnostics:bundle
```

## 可选屏幕监控

默认关闭。开启前需要在“设置”里填写 LLM Endpoint 和 Model，并通过环境变量提供密钥：

```bash
FOCUS_PET_LLM_API_KEY="..." npm start
```

也支持使用 `OPENAI_API_KEY`、`FOCUS_PET_LLM_ENDPOINT`、`FOCUS_PET_LLM_MODEL` 或 `OPENAI_CHAT_COMPLETIONS_URL`。

macOS 第一次使用需要授予“屏幕录制”权限。设置面板里的“屏幕权限”按钮可以打开对应系统设置页。

## 外部聊天和通话

默认聊天服务监听 `0.0.0.0`，桌面端会自动生成形如 `http://192.168.x.x:47321/client?invite=...` 的局域网邀请链接。第二台设备需要和桌面端处在同一局域网，并允许 macOS 防火墙放行 Node/Electron 对应端口。

如果只需要启动外部聊天服务，例如部署到 Modal、Docker 或其他 Node 容器，不需要启动 Electron：

```bash
npm run chat:serve
```

该入口的启动日志只输出监听信息、公开 URL、数据目录和 `hasInviteUrl` 布尔摘要，不输出完整 owner `publicState()`（包括直接调用、声明初始化或后续赋值变量中转后的完整状态、完整状态变量二次别名链、非首个 console 参数、对象包装或模板字符串输出）、`publicState` 变量上的敏感属性及其声明初始化、后续赋值或二次别名链得到的派生别名变量（包括非首个 console 参数、对象包装或模板字符串输出）、从 owner 状态解构出的敏感字段及其派生别名链（包括非首个 console 参数、对象包装和模板字符串输出）、完整 `inviteUrl`、邀请码、owner token 或 peer session token；`uncaughtException` / `unhandledRejection` 异常日志会复用 `sanitizeLogText()` 清洗后再写入 stderr，且不会在同一 `console.*(...)` 调用中混合清洗后的提示文本和原始异常对象。邀请链接仍通过桌面端状态或 owner 状态接口查看。

如果需要固定监听地址、端口，或放到反向代理后面，可以显式设置：

```bash
FOCUS_PET_CHAT_HOST="0.0.0.0" npm start
```

可选环境变量：

```bash
FOCUS_PET_CHAT_PORT="47321"
PORT="47321"
FOCUS_PET_CHAT_PUBLIC_URL="https://chat.example.com"
FOCUS_PET_CHAT_ALLOWED_ORIGINS="https://chat.example.com"
FOCUS_PET_CHAT_DATA_DIR="/data/focus-pet-social"
FOCUS_PET_CHAT_TLS_KEY="/path/to/key.pem"
FOCUS_PET_CHAT_TLS_CERT="/path/to/cert.pem"
FOCUS_PET_RTC_ICE_SERVERS='[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example.com","username":"user","credential":"pass"}]'
```

外部用户打开 `/client` 后输入邀请码和昵称，会换取仅能访问自己会话的 session token。文本、图片附件和屏幕分析记录可以直接走局域网 HTTP/WebSocket；浏览器实时语音/视频采集通常要求 HTTPS 或 localhost，所以第二台设备要稳定打语音/视频电话时，建议使用 `FOCUS_PET_CHAT_PUBLIC_URL` 配合 HTTPS 反向代理，或提供 `FOCUS_PET_CHAT_TLS_KEY` / `FOCUS_PET_CHAT_TLS_CERT` 启用 HTTPS/WSS。跨复杂 NAT 的稳定视频/语音通话通常还需要 TURN；没有 TURN 时，部分网络环境下 WebRTC 只能在局域网或 NAT 条件较宽松的网络中连通。

### 微信式小聊天窗口协议

小聊天窗口按微信式使用习惯拆成四类能力：文本消息、图片/文件附件、语音消息、实时语音/视频聊天。文本和实时事件走 WebSocket；图片、文件、语音消息先走 HTTPS 上传，再用 WebSocket 发送引用；实时语音/视频聊天不上传文件，走 WebSocket 信令加 WebRTC 媒体流。

文本消息：

- 输入框常驻在底部，回车或点击“发送”后通过 WebSocket 发送 `type: "text"`。
- 服务端保存消息并广播给会话对方。
- 对方收到 WebSocket `message` 事件后立即追加到聊天窗口。

图片附件：

- 图片作为聊天附件处理，不直接塞进 WebSocket。
- 客户端可先压缩或缩放图片，也可以上传原图。
- 通过 HTTPS 上传到 `/api/media`，服务端校验 MIME 类型和大小后保存。
- 服务端返回可访问的媒体 URL。
- 客户端通过 WebSocket 发送 `type: "image"` 的消息，消息体只带媒体引用。
- 接收方用 `<img src="...">` 展示，URL 需要携带当前 session token 或走授权请求。

```json
{
  "type": "message",
  "message": {
    "to": "peer-id",
    "type": "image",
    "text": "图片",
    "media": {
      "id": "media-id.png",
      "url": "https://chat.example.com/media/media-id.png",
      "mimeType": "image/png",
      "size": 123456
    }
  }
}
```

语音消息：

- 语音消息是“按住说话，松开发送”的短录音消息，不是实时电话。
- 桌面端支持语音快捷键录音，默认 `Alt+R`：聊天窗口打开时按住开始录音，松开主键发送。
- 语音快捷键可在设置面板修改，格式类似 `Alt+R`、`Ctrl+Shift+V` 或 `Cmd+Shift+R`，至少需要一个修饰键避免误触发。
- 浏览器通过 `MediaRecorder` 录制麦克风，默认保存为 `audio/webm`。
- 松开后把录音文件通过 HTTPS 上传到 `/api/media`，服务端返回 `media.url`。
- 客户端通过 WebSocket 发送 `type: "voice"` 的消息，消息体只带音频媒体引用。
- 接收方收到消息后显示语音气泡，并用 `<audio controls src="...">` 播放。
- 如果录音太短、没有采集到音频、用户移出按钮取消，客户端不发送消息。

实时语音聊天：

- 语音聊天不是“录一段音频文件发过去”，而是实时通话。
- WebSocket 只负责通话信令，例如 `call-invite`、`call-answer`、`call-reject`、`call-end`、`rtc-offer`、`rtc-answer`、`rtc-ice`。
- 双方浏览器通过 `getUserMedia({ audio: true })` 获取麦克风权限。
- 音频流通过 WebRTC 的 `RTCPeerConnection` 实时传输。
- 同网段或 NAT 条件较宽松时，WebRTC 可以点对点直连。
- 跨运营商、公司网络、手机流量等复杂网络时，需要配置 TURN；直连失败时由 TURN 中继音频流。

实时视频聊天：

- 视频聊天也不是上传视频文件，而是实时音视频通话。
- WebSocket 继续只做信令转发，不传输摄像头画面。
- 双方浏览器通过 `getUserMedia({ audio: true, video: true })` 获取麦克风和摄像头权限。
- 音频和视频轨道都通过 WebRTC 实时传输。
- 本地画面用 `<video muted autoplay playsinline>` 预览，对方画面用 `<video autoplay playsinline>` 播放远端媒体流。
- 正式跨网络使用必须准备 STUN/TURN，尤其是手机流量、公司网络、不同运营商之间的视频聊天。

自动接通规则：

- 每台设备首次仍然需要浏览器/系统授权麦克风和摄像头。
- 授权完成后，可信联系人发起语音或视频来电时，应用可以自动发送 `call-answer` 并接通。
- 如果设备没有权限、没有摄像头/麦克风，或浏览器不是 HTTPS 安全上下文，应用应发送 `call-reject` 并提示原因。

因此整体协议分工是：文本和通话信令走 WebSocket，图片/文件/语音消息走 HTTPS 上传加 WebSocket 引用，实时语音/视频聊天走 WebSocket 信令加 WebRTC 媒体流。语音消息和实时语音聊天都支持，但一个是短录音消息，一个是实时媒体流，不能混成同一条链路。

Modal 或其他云平台测试时建议先固定单实例/单容器运行，因为当前在线用户、WebSocket 连接和通话信令在单进程内存中维护。`/healthz` 和 `/api/health` 可用于健康检查。聊天历史、媒体和活动采样记录默认写入 `~/.hermes/focus-watchdog/social`，云端需要持久化时设置 `FOCUS_PET_CHAT_DATA_DIR` 到挂载卷目录。

## macOS 分发

发布前先打印检查清单：

```bash
npm run release:preflight
```

执行本机基础 gate：

```bash
npm run release:preflight -- --run fast
```

CLI 参数同时支持等号写法，例如 `npm run release:preflight -- --run=fast`、`node scripts/release-preflight.js --check=error-log`。

该 gate 会先运行 `node scripts/release-preflight.js --check diagnostics-summary-output`，生成诊断摘要并做 schema 与边界扫描；检查输出只输出是否生成、JSON 是否有效、`summarySchemaValid`、`summaryGeneratedAtValid`、缺失顶层区块、未知顶层字段数量和问题标签，不打印完整诊断摘要，也不回显未知字段名或内容。`summaryGeneratedAtValid` 要求 `summary.generatedAt` 是可解析时间；不可解析时 `summarySchemaValid` 也会失败。若序列化 JSON 内部出现 secret 字段名和值组合，只返回 `json-secret-field` 标签；若出现 `apiKey=...`、`authToken=...`、`sessionToken=...` 或 `inviteCode=...` 等文本 secret key 赋值，只返回 `secret-assignment` 标签；若出现 raw 任务、聊天、窗口、内部上下文字段（`currentTask`、`frontmost`、`sourceName`）、错误内部键 `rawIssueKey`、截图、endpoint 或 model 等字段名，只返回 `json-raw-field` 标签；若出现普通 http/https URL 值，只返回 `url` 标签；若出现 WebSocket URL，只返回 `websocket-url` 标签，不回显字段名或值。
随后会生成一份安全诊断包到 `output/diagnostics/preflight`，诊断包目录会自动轮转并保留最新 20 个标准命名诊断包。
随后会运行 `node scripts/release-preflight.js --check diagnostics-bundle-output`，确认最新诊断包目录只包含 `summary.json` 和 `manifest.md`，`summary.json` 可解析且顶层 schema 完整，manifest 引用了 summary 和当前包名，且 `summary.generatedAt` 能推导出当前包名；并对 `summary.json` 和 `manifest.md` 做边界扫描。若发现本地路径（含 Windows drive-letter 路径）、Bearer token、env secret、secret key 赋值、图片 data URL、TURN URL、普通 http/https URL、WebSocket URL、JSON secret 字段和值组合或 JSON raw 字段名，只输出 `summaryBoundaryIssues`、`manifestBoundaryIssues`、`summarySchemaValid`、`manifestReferencesBundle`、`summaryMatchesBundleName` 等问题标签或布尔结果，不回显诊断内容。
随后会运行 `node scripts/release-preflight.js --check package-scripts`，确认打包、签名、验证脚本入口存在，指向的脚本文件存在，并已通过 `npm run check` 中的真实语法检查命令覆盖；仅在 check 命令中用 `echo` 或普通文本提到脚本路径不会视为已覆盖。该检查不执行真实打包、签名或公证。
随后会运行 `node scripts/release-preflight.js --check chat-backend-deploy`，静态确认社交后端容器部署入口仍可用：`Dockerfile` 使用生产依赖安装、配置 `0.0.0.0` 监听和持久化数据目录、包含 `/healthz` healthcheck、通过 `npm run chat:serve` 启动，且 Node 入口接入 chat service 并处理 `SIGTERM` 关闭。该 gate 还会阻断启动脚本通过 `console.log/error/warn/info/debug/trace(...)` 直接打印完整 `chatService.publicState()`（包括非首个 console 参数、对象包装和模板字符串输出）、声明初始化或后续赋值变量中转后的完整 owner 状态及其二次别名链（包括非首个 console 参数、对象包装和模板字符串输出）、`publicState` 变量敏感属性及其声明初始化、后续赋值或二次别名链得到的派生别名变量（包括非首个 console 参数、对象包装和模板字符串输出），或从 owner 状态解构敏感字段后直接输出、非首参数输出、对象包装输出、模板字符串输出及二次别名链输出；`hasInviteUrl: Boolean(state.inviteUrl)` 这类布尔摘要允许保留。它也会阻断重新输出 `inviteUrl:`、`inviteCode:`、`authToken:`、`sessionToken:` 字段；也会平衡解析 `console.error/warn/log/info/debug/trace(...)` 的完整参数列表，逐个参数判断是否仍输出固定异常变量名，或输出 `uncaughtException`、`unhandledRejection`、`warning`、`rejectionHandled` 回调参数名对应的未清洗对象；只有单个参数整体包在 `sanitizeLogText(...)` 中才视为已清洗，`console.error(sanitizeLogText('startup failed'), failure)` 这类混合清洗文本和原始异常对象的输出会被阻断，避免云端容器日志暴露邀请链接、邀请码、token 或异常上下文。
同时会运行 `node scripts/release-preflight.js --check docs-boundary`，确认必需边界文档存在，且本轮排除项没有以中文、camelCase、snake_case 或 kebab-case 等常见命名形态进入源码实现；该 gate 还会检查社交安全边界文档保留服务重启持久化与多实例全局限流 caveat，并阻断把已实现的重启持久化能力继续列为未覆盖风险。
还会运行 `node scripts/release-preflight.js --check optimization-plan`，确认优化计划必需章节和验收状态段完整，且没有空验收段或未完成验收项；空验收段只返回 `emptyAcceptanceSections` 的章节编号，冒号、括号、破折号或空格后的“未完成”“部分完成”“待完成”“进行中”“尚未完成”“未达成”“未通过”都会被视为未达成状态，检查输出只包含章节编号和行号。
还会运行 `node scripts/release-preflight.js --check error-log`，确认 `docs/errorThing.md` 存在、最新记录格式完整、最新状态为已解决，且 `openUnresolvedEntries` 为空；检查输出不回显错误正文。

执行完整本机 QA gate：

```bash
npm run release:preflight -- --run full
```

完整 gate 会在基础 gate 之后运行桌面渲染 QA 和 `npm run test:screen-pipeline`，用于确认手动屏幕分析、结构化 LLM 输出和复盘 LLM 串联。该管线需要屏幕监控和复盘 LLM 配置可用。

本地打包：

```bash
npm run package:mac
```

远端社交客户端 mac 包是条件发布步骤。部署 HTTPS 远端客户端后再执行，`REMOTE_CLIENT_URL` 必须指向 `/client` 或 `/client/...` 路径：

```bash
REMOTE_CLIENT_URL="https://example.com/client" npm run package:mac:remote-client
```

该步骤会出现在 `npm run release:preflight` 清单中，但不随 `--run package` 自动执行，避免缺少部署 URL 时阻断主应用打包、公证流程。
打包出的远端客户端只会向与 `REMOTE_CLIENT_URL` 精确同源的页面授予麦克风/摄像头权限；相似域名不会通过前缀匹配获得权限。
远端客户端内嵌窗口只保留同源 `/client` 页面，跳出该范围的 http/https 导航会交给系统浏览器；非 http/https 外链会被拒绝打开。

签名需要 Apple Developer 的 Developer ID 证书：

```bash
MAC_CODESIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)" npm run sign:mac
```

公证需要 Apple ID、Team ID 和 App 专用密码：

```bash
APPLE_ID="you@example.com" \
APPLE_TEAM_ID="TEAMID" \
APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx" \
npm run notarize:mac
```

`npm run release:preflight -- --run package` 在 macOS 上会把本地打包、签名校验、公证和公证后验证都列为 package 运行组步骤；公证仍需要上面的 Apple 凭据。远端社交客户端包因依赖 `REMOTE_CLIENT_URL`，作为清单条件项单独执行。

验证本地 bundle：

```bash
npm run verify:mac
```

## Windows 分发

Windows 版沿用同一套 Electron 前端和 `src/main.js` 主进程。需要在 Windows 机器上安装依赖后打包，因为 Electron 会按当前系统下载对应运行时：

```powershell
npm install
npm run package:win
```

产物会写入 `dist/win-unpacked/Focus Pet/Focus Pet.exe`。Windows 版会通过 PowerShell 读取当前前台窗口标题；如果被安全策略拦截，设置页里的“隐私设置”按钮会打开 Windows 隐私设置页。屏幕监控在 Windows 下没有单独的“屏幕录制”设置入口，设置页会隐藏该按钮。

## 权限

如果宠物提示看不到当前窗口：

macOS 请到：

`系统设置 → 隐私与安全性 → 辅助功能`

允许 Focus Pet、Electron、Terminal 或 Hermes 控制电脑。授权后重启应用。

Windows 请确认 Focus Pet 正在桌面运行，并允许 Focus Pet / PowerShell 读取前台窗口标题。也可以在应用的“设置 → 隐私设置”打开 Windows 隐私设置页。

## 隐私边界

默认不会截屏、不会读取网页正文、不会记录键盘输入、不会读浏览器历史。默认记录前台 App 名称、窗口标题、分类、当前任务摘要和时间。

只有在手动开启“屏幕监控”后，应用才会截取屏幕缩略图并发送给你配置的 LLM endpoint。截图不写入本地文件；本地只记录 LLM 返回的状态、活动摘要、原因、置信度、当前任务和前台窗口摘要。

## 开发资料结论

- Electron `BrowserWindow` 支持透明、无边框、置顶窗口，适合桌面宠物。
- Electron 窗口自定义文档：`https://www.electronjs.org/docs/latest/tutorial/window-customization`
- Electron `BrowserWindow` API：`https://www.electronjs.org/docs/latest/api/browser-window`
- Web 拖拽可用 HTML Drag and Drop API；Electron 桌面窗口拖动更适合用 CSS `-webkit-app-region: drag`。
