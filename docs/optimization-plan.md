# Focus Pet 优化方案

## 1. 本轮范围

本方案基于系统评审意见整理，目标是把 Focus Pet 从“功能清单型桌面宠物”推进到“可信、可解释、低打扰、可维护的专注陪伴系统”。

本轮明确不做以下四项：

- 隐私模式。
- 敏感 App 列表。
- 窗口标题脱敏。
- 用户纠错机制。

这些能力后续仍有价值，但本轮不进入设计和实现范围，避免偏离当前要求。

## 2. 优化原则

### 2.1 先稳定可信，再扩展功能

当前系统已经具备桌面宠物、任务、复盘、状态判断、可选屏幕 LLM、社交聊天和 WebRTC 信令。下一步不应继续堆功能，而应优先补齐策略、边界、数据可靠性、诊断和发布安全。

### 2.2 识别和干预分离

状态判断只回答“用户当前可能在做什么”，干预策略才决定“是否应该提醒”。不能把 `game`、`distracted`、`unknown` 直接等同于必须弹出提醒。

### 2.3 宠物反馈避免惩罚感

宠物体征应表达节奏状态，不表达道德评价。游戏、分心或权限异常不应让用户感到被审判。

### 2.4 社交监督必须自愿

社交监督应强调用户主动共享和随时停止，不做隐藏式监控、静默记录或远程强制开启。

## 3. P0 优先级

### 3.1 干预策略引擎

现状：系统已有自动弹出和冷却时间，但规则仍较粗。

目标：增加一个明确的 `intervention_policy`，统一决定是否提示、提示强度和提示原因。

建议策略字段：

```json
{
  "minConfidenceToInterrupt": 0.75,
  "cooldownMinutes": 15,
  "maxInterruptionsPerHour": 3,
  "respectFocusMode": true,
  "neverInterruptApps": ["Zoom", "Keynote", "PowerPoint"],
  "levels": ["none", "dot", "bubble", "bubble_action", "panel", "system"]
}
```

第一阶段可落地范围：

- 保留现有自动弹出开关。
- 保留现有冷却时间设置。
- 新增低置信度不强提醒。
- 新增每小时最大提醒次数。
- 新增会议/演示场景的低打扰保护，仅用于抑制弹窗；不做隐私模式、敏感 App 标记或窗口标题处理。
- 权限异常只给修复提示，不影响宠物体征。

验收标准：

- `work`、`study` 默认不主动打扰。
- `game`、`distracted`、`unknown` 只有达到置信度和冷却条件才提醒。
- 一小时内超过上限后静默。
- `permission` 只走权限修复提示。

当前执行进展（2026-06-30）：

- 已新增 `src/intervention-policy.js`，统一判断提示强度、提示目标和提示原因。
- 已将 `maybeAutoPopup` 接入干预策略，保留自动弹出开关和提醒冷却设置。
- `work`、`study` 默认不主动打扰。
- `game`、`distracted`、`unknown` 需要达到置信度、冷却时间和每小时上限条件才显示提醒。
- Zoom、Keynote、PowerPoint 等会议/演示 App 默认抑制弹窗；该能力只用于低打扰，不做隐私模式、敏感 App 标记或窗口标题处理。
- 已新增 `focusStatusAffectsPetVitals()`，权限异常仍显示修复提示和等待动画，但不扣减宠物心情、精力或亲密。
- 已将 `game` 和 `distracted` 的宠物体征反馈调整为非惩罚式节奏提示：不扣减心情或亲密，只表达轻量精力消耗和回到任务节奏的提醒。
- 已将 `unknown` 的宠物体征反馈调整为观察式节奏提示：不扣减心情或亲密，只表达当前关系不明确并轻量观察节奏。
- 已将 `getStatus()` 返回的 `game`、`distracted`、`unknown` 状态消息调整为低打扰文案：使用“可能偏离”“结束点”“观察节奏”，避免“跑偏啦”“收回来”“切回任务”等强提醒措辞。

当前 3.1 验收状态：

- `work`、`study` 默认不主动打扰：已完成。
- `game`、`distracted`、`unknown` 只有达到置信度和冷却条件才提醒：已完成。
- 一小时内超过上限后静默：已完成。
- `permission` 只走权限修复提示：已完成。
- `game`、`distracted`、`unknown` 宠物反馈不表达惩罚感：已完成。
- `game`、`distracted`、`unknown` 状态消息不表达强提醒或惩罚感：已完成。

### 3.2 社交服务安全边界

现状：已有邀请码、session token、媒体上传、WebSocket、WebRTC 信令。

需要补齐：

- 邀请码有效期和撤销策略。
- token 过期和撤销策略。
- peer session token 设备绑定。
- 局域网开放时的 Origin 校验。
- 文件大小和 MIME 类型策略。
- 禁止可执行文件类型。
- 文件名路径穿越防护。
- 服务端媒体内容嗅探。
- 邀请码失败尝试限流。
- WebRTC IP 暴露提示和通话结束清理。

第一阶段可落地范围：

- 文档化当前安全边界。
- 增加服务端 Origin 校验。
- 增加 token 过期字段设计。
- 增加媒体文件类型白名单和拒绝原因。

验收标准：

- 未授权请求无法读写聊天状态。
- 非允许 Origin 的浏览器请求被拒绝。
- 可执行文件不会被保存。
- 媒体路径不能逃逸 `media/` 目录。
- 声明类型与固定文件头明显不匹配的媒体上传会在写盘前被拒绝。
- 同一来源重复输入错误邀请码达到阈值后，会被短时间阻断。
- 服务重启后，窗口内的邀请码失败尝试仍会继续阻断。
- 新 peer session token 被复制到其他设备时无法单独通过认证。
- Owner 可以撤销某个 peer 的外部 session，旧 token 立即失效，且不删除好友和聊天记录。

当前执行进展（2026-06-30）：

- 已新增 `docs/social-security-boundary.md` 记录当前社交服务安全边界。
- 已为 peer session 增加 `expiresAt`，默认 30 天有效，过期 token 无法认证。
- 已为新 peer session 增加设备绑定：远端浏览器生成本地随机 `deviceId`，服务端只存 `deviceIdHash`；HTTP、媒体读取和 WebSocket 都需要 token 与 device id 匹配。
- 旧版本未带 `deviceIdHash` 的历史 session 保持兼容，直到过期或被移除；新创建 session 默认启用绑定。
- 已新增 peer session 显式撤销：桌面端聊天面板提供“撤销会话”，owner IPC 和 HTTP `POST /api/friends/:friendId/sessions/revoke` 会删除该 peer 的 session token、关闭已连接 peer WebSocket，并保留好友和聊天记录。
- 已收紧 peer 可触发的已读状态写入：HTTP `/api/friends/read` 和 WebSocket `mark-read` 都会带上当前认证上下文；peer 只能把 owner 发给自己的消息标记为已读，不能清理 owner 侧其他好友的未读数或把其他 peer 发给 owner 的消息标为已读。
- 已为邀请码增加 `inviteCreatedAt` 和 `inviteExpiresAt`，默认 7 天有效，过期邀请码无法创建新 session。
- 已为邀请码增加按来源的失败尝试限流：同一来源 10 分钟内 5 次错误后会被阻断，成功加入后清除该来源失败记录。
- 邀请码失败尝试已持久化到 `chat-state.json`：来源 key 只保存 SHA-256 哈希，不保存原始 IP；服务重启后窗口内阻断仍生效。
- 已增加 HTTP/WebSocket Origin 校验，支持同源、无 Origin 本地请求、Electron `file://` 和 `FOCUS_PET_CHAT_ALLOWED_ORIGINS` 显式白名单。
- 已取消 CORS 通配 `*`，改为回写允许的 Origin。
- 已清理媒体展示文件名为 basename，媒体磁盘路径仍使用随机 ID 并限制在 `media/` 目录。
- 已新增轻量服务端媒体内容嗅探：拒绝 `MZ`、ELF、Mach-O 等可执行文件头，并校验 PDF、ZIP/OOXML、PNG、JPEG、GIF、WEBP 和旧 Office OLE 文件头是否与声明类型一致。
- 媒体内容嗅探在写盘前执行；它用于阻断明显伪装文件，不等同于病毒扫描、宏检测或压缩包深度扫描。
- 已在桌面端和远端浏览器端增加 WebRTC 网络地址暴露提示，首次发起或接收通话前必须点击继续，之后才会请求麦克风/摄像头或创建 PeerConnection。
- WebRTC 提示确认只保存在当前端本机 `localStorage`，不上传到聊天服务。
- 已补齐 WebRTC 通话结束清理：取消、拒绝、不可用或结束通话时，桌面端和远端浏览器端都会清空 pending 提示回调/模式、关闭 peer connection、停止本地媒体轨道，并清空本地/远端 video。
- 已新增 WebRTC ICE/TURN 配置摘要：健康检查和诊断摘要会报告是否使用默认 STUN、是否检测到 TURN、STUN/TURN 数量和 TURN 配置引导。
- TURN 诊断不输出 ICE/TURN URL、TURN username 或 TURN credential。
- 已新增服务端通话生命周期审计 `callAuditLog`，记录事件类型、双方 id、callId、mode、送达状态、送达客户端数量和时间。
- 通话审计不保存音视频、SDP、ICE candidate、TURN 地址、TURN username 或 TURN credential。

当前 3.2 验收状态：

- 未授权请求无法读写聊天状态：已完成。
- 非允许 Origin 的浏览器请求被拒绝：已完成。
- 可执行文件不会被保存：已完成。
- 媒体路径不能逃逸 `media/` 目录：已完成。
- 声明类型与固定文件头明显不匹配的媒体上传会在写盘前被拒绝：已完成。
- 同一来源重复输入错误邀请码达到阈值后短时间阻断：已完成。
- 服务重启后，窗口内的邀请码失败尝试仍会继续阻断：已完成。
- 新 peer session token 被复制到其他设备时无法单独通过认证：已完成。
- Owner 显式撤销 peer session 后旧 token 立即失效，且不删除好友和聊天记录：已完成。
- Peer 通过 HTTP/WebSocket 标记已读时不能越权修改非自身会话：已完成。
- WebRTC IP 暴露提示和通话结束清理：已完成。

### 3.3 数据存储版本化与恢复

现状：任务和设置使用 JSON，活动日志使用 JSONL，聊天状态使用 JSON。

需要补齐：

- schema version。
- temp file + rename 原子写。
- 文件损坏恢复。
- 自动备份。
- 后续迁移入口。
- 本地日志保留周期，避免 `activity.jsonl`、`screen-monitor.jsonl` 和 `focus-pet.log` 无限增长。

第一阶段可落地范围：

- 为聊天状态补 `version`。
- 为关键 JSON 写入封装原子写。
- 加载失败时保留损坏文件副本并恢复默认状态。
- 活动日志、屏幕监控日志和运行日志默认保留 30 天，并允许用户在高级设置中调整 1-365 天。

验收标准：

- JSON 写入不会留下半文件。
- 读取损坏状态时应用仍可启动。
- 用户数据不会被静默覆盖。
- 活动日志、屏幕监控日志和运行日志不会无限增长，旧记录会按保留周期裁剪。

当前执行进展（2026-06-30）：

- 已新增 `src/json-storage.js`，提供 JSON 原子写入与损坏文件备份恢复。
- 已将 `tasks.json`、`settings.json`、`chat-state.json` 接入原子写入。
- 已将 `tasks.json`、`settings.json`、`chat-state.json` 接入写前自动备份，替换已有文件前生成 `.backup-*` 快照，每类最多保留 5 份。
- 已为 `tasks.json` 和 `settings.json` 增加损坏备份与 fallback 恢复。
- 已为 chat state 增加 `version: 1`，并在桌面端/外部端公开 state 中带出版本。
- 已新增 `migrateTasksState()`、`migrateSettingsState()` 和 `migrateChatState()` 三个显式迁移入口，读取旧 payload 时会升级 schema 并保留未知顶层字段。
- `migrateChatState()` 会归一化 `self`：非对象 self、空 `id` 或空 `name` 会回填默认本机身份，同时保留 self 上的未知字段，避免 owner 身份为空。
- `migrateChatState()` 会跳过 `friends` 中 `null`、字符串、缺少 `id` 的异常好友项，并归一化保留好友的名称、在线状态、未读数和最近在线时间，避免好友列表坏项进入 owner/peer 状态。
- `migrateChatState()` 会跳过 `sessions` 中 `null`、字符串、缺少 `token/peerId` 的异常会话项，并归一化保留 session 的名称、时间、过期时间和设备绑定哈希；旧 session 缺少 `expiresAt` 但带 `createdAt` 时仍会补齐默认 30 天过期时间。
- `migrateChatState()` 会跳过 `activityLog` 中 `null`、字符串、缺少来源等无法归一化的异常活动项，避免旧数据或局部损坏阻断聊天状态恢复。
- `migrateChatState()` 会跳过 `messages` 中 `null`、字符串、缺少 `from/to` 的异常消息项，并归一化保留消息的文本、媒体、活动、发送状态和时间字段，避免旧聊天记录坏项阻断 owner/peer 状态构建。
- `migrateChatState()` 会跳过 `callAuditLog` 中 `null`、字符串、未知事件、缺少 `from/to/callId` 的异常审计项，并只保留通话生命周期审计字段，不保留 SDP 或 ICE candidate。
- 已新增 `docs/storage-recovery.md` 记录当前存储恢复机制和后续迁移入口。
- 已新增 `src/jsonl-retention.js`，为本地 JSONL 日志和分级运行日志提供按保留周期原子裁剪的通用写入 helper。
- 已为 `activity.jsonl`、`screen-monitor.jsonl` 和 `focus-pet.log` 增加本地保留周期：默认 30 天，高级设置可配置 1-365 天；每次追加活动样本、屏幕监控样本或运行日志条目后会按保留窗口原子重写日志，时间不可解析的历史 JSONL 行会保留，避免因旧数据格式不完整而静默丢弃。
- `focus-pet.log` 通过 `writeRuntimeLog()` 接入保留周期，主进程和启动监督脚本都会传入当前 `activityRetentionDays`；旧的 `[time] message` 文本行会被解析为兼容日志，保留窗口内的旧格式行不会被丢弃。

当前 3.3 验收状态：

- JSON 写入不会留下半文件：已完成。
- 读取损坏状态时应用仍可启动：已完成。
- 用户数据不会被静默覆盖：已完成。
- schema version、显式迁移入口和自动备份：已完成。
- 活动日志、屏幕监控日志和运行日志默认 30 天保留且可配置 1-365 天：已完成。

### 3.4 可观测性和诊断

现状：有 `docs/errorThing.md` 错误记录和部分运行日志。

需要补齐：

- 运行日志分级。
- 最近状态判断原因。
- 权限诊断。
- LLM 连通性诊断。
- WebSocket 诊断。
- 存储健康检查。
- 生成诊断包。

第一阶段可落地范围：

- 增加诊断摘要 API。
- 返回版本、权限、设置摘要、聊天服务状态、LLM 配置状态、最近错误摘要。
- 诊断包不包含聊天正文、任务全文或截图。

验收标准：

- 设置页或命令行可以获取诊断摘要。
- 摘要不包含高敏正文内容。

当前执行进展（2026-06-30）：

- 已新增 `src/diagnostics.js`，生成诊断摘要。
- 已新增 `src/runtime-logger.js`，统一输出 `debug`、`info`、`warn`、`error` 四级 JSONL 运行日志。
- 已新增 `npm run diagnostics` 命令行入口。
- 已新增 `npm run diagnostics:bundle`，生成只包含 `summary.json` 和 `manifest.md` 的安全诊断包。
- 已新增 `app:get-diagnostics` IPC 和 `window.focusPet.getDiagnostics()` preload API。
- 摘要包含版本、权限状态、设置摘要、任务计数、最近状态判断原因摘要、聊天服务计数、存储健康和最近错误摘要。
- 摘要新增 `logs`，从默认运行日志读取可解析条数、等级计数和最近最多 5 条安全日志摘要。
- `logs.recent` 只输出时间、等级、来源、清洗后的短消息和是否旧格式，不输出原始日志文件。
- 主进程 `logMain` 和启动监督脚本已接入分级日志；异常退出和重启记录为 `warn`，渲染进程崩溃记录为 `error`。
- 日志诊断兼容旧的 `[time] message` 文本行，并按 `info` 级别标记为 `legacy`。
- 运行日志写入已接入本地日志保留周期，跟随高级设置中的 `activityRetentionDays` 裁剪旧记录。
- 摘要新增 `activity`，从 `activity.jsonl` 输出样本总数、状态计数和最近最多 5 条状态判断摘要。
- `activity.recentDecisions` 只输出状态、时间、原因分类、固定说明、置信度和是否存在 App/标题/任务关联，不输出前台 App 名称、窗口标题原文、当前任务文本或原始 reason。
- 摘要不输出任务全文、聊天正文、截图 data URL、API key、session token、邀请码或 LLM endpoint/model 原文。
- 摘要中的屏幕监控和复盘 LLM 配置会区分 `apiKeyRequired` 和 `apiKeyConfigured`，避免 Ollama、本机 OpenAI-compatible 或 `local-only` 模式被误读为缺少 API key。
- 运行日志写入、摘要读取和 `appendErrorThing()` 错误日志写入都会复用 `sanitizeLogText()`，替换 Bearer token、长 token、env secret 赋值、URL、图片 data URL、当前任务/前台上下文键值（如 `currentTask`、`frontmost`、`screenEndpoint`、`reviewEndpoint`、`endpoint`）和本地绝对路径；诊断包不会包含原始运行日志。
- 诊断包输出目录默认只保留最新 20 个标准命名诊断包，避免发布前预检和排障重复执行后产物无限累积。
- 摘要新增 `chat.websocket`，只输出 WebSocket 是否启用/活跃、客户端数量、Origin 策略、额外允许 Origin 数量、是否允许无 Origin/`file://` 和 CORS 是否通配，不输出具体 Origin、WebSocket URL、token 或 peer id。
- 摘要新增 `chat.rtc`，只输出 ICE/TURN 配置来源、数量、是否建议补 TURN 和固定引导文案，不输出服务器地址、用户名或凭据。
- 摘要新增 `chat.callAuditLog`，只输出服务端通话生命周期审计条数，不输出审计条目详情。
- 摘要新增 `storage.automaticBackupCount` 和 `storage.latestAutomaticBackup`，只输出 `.backup-*` 自动备份数量和最新文件名，不输出目录路径或备份内容。
- 已新增 `docs/diagnostics.md` 记录诊断摘要结构和边界。

当前 3.4 验收状态：

- 设置页或命令行可以获取诊断摘要：已完成。
- 摘要不包含高敏正文内容：已完成。
- 运行日志分级：已完成。
- 最近状态判断原因：已完成。
- WebSocket、WebRTC、存储健康和诊断包：已完成。

## 4. P1 优先级

### 4.1 当前任务模型增强

现状：任务支持标题、完成状态、优先级、截止日期和排序。

建议新增字段：

- `description`
- `estimatedMinutes`
- `energyLevel`
- `contextTags`
- `relatedApps`
- `relatedKeywords`
- `blockedBy`
- `nextAction`
- `updatedAt`
- `completedAt`

选择规则：

- 用户手动选择优先。
- 置顶任务优先。
- 截止时间近优先。
- 有 `nextAction` 的任务优先。
- blocked 任务不自动选。

验收标准：

- 当前任务选择可解释。
- 任务可声明相关 App 和关键词。
- 复盘能按任务维度输出阻力和推进情况。

当前执行进展（2026-06-30）：

- 已将 `tasks.json` schema 提升到 `version: 2`，新增 `description`、`estimatedMinutes`、`energyLevel`、`contextTags`、`relatedApps`、`relatedKeywords`、`blockedBy`、`nextAction`、`pinned`、`selected`、`updatedAt` 等字段。
- 已新增当前任务决策结果 `getCurrentTaskDecision()`，返回当前任务、选择原因、被阻塞跳过数量和候选数量。
- 当前任务选择会跳过 `blockedBy` 非空的任务，并按手动选中、置顶、优先级、截止日期、下一步和列表顺序排序。
- 已新增 `selectTask()` 手动当前任务入口，选择某个未完成、未阻塞任务时会排他清除其他任务的 `selected` 标记；任务被标记完成或重新打开时会清除 `selected`，避免已完成项或重新打开项自动抢回当前任务；旧数据或导入数据也会在保存时归一化，只保留一个可执行手动当前任务；`updateTask()` 会返回保存后的归一化任务，保证编辑导致任务不可执行时返回值和落盘状态同步清除 `selected`。
- 已通过 `tasks:current-decision` IPC 和 `window.focusPet.getCurrentTaskDecision()` 暴露选择解释。
- 已通过 `tasks:select` IPC 和 `window.focusPet.selectTask()` 暴露手动选择当前任务能力。
- 状态判断已接入任务声明的 `relatedApps` 和 `relatedKeywords`，命中后会作为任务相关上下文进入 `work`。
- 桌面任务面板已同步阻塞跳过、手动选择当前任务、置顶/下一步排序和选择依据展示。
- 已新增 `buildTaskReview()`，每日复盘会输出任务完成率、推进分钟、疑似偏离分钟、阻塞数量、缺少下一步数量和最多 3 条任务建议。
- 桌面复盘面板已新增任务推进卡片，展示完成概况、任务行和优先建议。
- 已新增 `docs/task-model.md` 记录任务模型、选择规则和验证范围。

当前 4.1 验收状态：

- 当前任务选择可解释，且用户可手动设定当前任务：已完成。
- 任务可声明相关 App 和关键词：已完成。
- 复盘能按任务维度输出阻力和推进情况：已完成。

### 4.2 复盘从统计升级为行动建议

现状：复盘已有分钟数、状态占比、小时分布、常用 App 和明日建议。

建议增加：

- 任务推进情况。
- 长期未完成任务。
- 任务被打断次数。
- 缺少下一步的任务。
- 每小时 App 切换次数。
- 高质量专注块。
- 最容易偏离时段。
- 具体建议。

文案原则：

- 说“疑似偏离任务”，不说“拖延”。
- 说“下午切换娱乐 App 增多”，不说“你不自律”。
- 给具体动作，不给空泛评价。

验收标准：

- 复盘至少输出一个可执行建议。
- 复盘不出现惩罚、羞辱或过度心理归因文案。

当前执行进展（2026-06-30）：

- 已新增 `buildReviewActionSuggestions()`，复盘会输出 `actionReview` 和 `actionSuggestions`。
- `actionReview` 已覆盖每小时 App 切换次数、高质量专注块、最容易偏离时段、长期未完成任务和任务被打断次数。
- 行动建议会优先处理偏离时段、任务打断、长期未完成、缺少下一步，并复用高质量专注块。
- 桌面复盘面板已新增紧凑行动建议卡片；没有建议时不渲染，避免撑高小窗口。
- 已补充测试，覆盖至少一个可执行建议，以及不出现惩罚、羞辱或过度心理归因文案。

当前 4.2 验收状态：

- 复盘至少输出一个可执行建议：已完成。
- 复盘不出现惩罚、羞辱或过度心理归因文案：已完成。

### 4.3 设置分层

本项不包含：隐私模式、敏感 App 规则、标题脱敏、用户纠错入口。

建议分为：

- 基础：开机启动、提醒频率、宠物强度。
- 专注判断：工作/学习/娱乐规则、App 列表。
- AI：屏幕监控、截图间隔、LLM、连通性测试。
- 社交：邀请码、共享范围、文件大小、通话配置。
- 高级：更新源、日志、诊断包、存储路径、实验功能。

验收标准：

- 用户首次打开设置不会看到一整页混合配置。
- 高风险能力集中在 AI、社交和高级分组。

当前执行进展（2026-06-30）：

- 设置面板已拆为基础、判断、AI、社交和高级五个分组，首次打开默认停留在基础分组。
- 基础分组保留自动弹提醒、开机启动、提醒冷却、空闲提醒和宠物强度。
- 判断分组集中工作/学习/游戏/分心关键词，以及工作 App、游戏 App 列表。
- AI 分组集中屏幕监控、监控间隔、LLM endpoint/model、复盘 LLM、LLM 自检、测试监控和屏幕权限入口，并标记为高风险能力组。
- 社交分组集中媒体上限、语音快捷键，并提示邀请码、外部会话和通话配置由聊天面板管理。
- 高级分组集中更新源、自动检查更新、数据目录、诊断摘要和权限引导，并标记为高风险能力组。
- 已补充测试，覆盖分组 DOM、默认激活分组、高风险分组标记、分组切换逻辑、数据目录入口、诊断摘要入口和样式约束。

当前 4.3 验收状态：

- 用户首次打开设置不会看到一整页混合配置：已完成。
- 高风险能力集中在 AI、社交和高级分组：已完成。

### 4.4 新手引导

本项不包含：隐私模式、敏感 App 规则、标题脱敏、用户纠错入口。

建议三层模式：

1. 基础模式：任务 + 宠物 + 前台 App 判断。
2. 增强模式：配置工作/学习/娱乐关键词和复盘。
3. 高级模式：开启屏幕 LLM、社交监督、WebRTC。

每一步说明：

- 会采集什么。
- 不会采集什么。
- 数据保存在哪里。
- 是否会外发。

验收标准：

- 用户能在 3 分钟内完成基础模式。
- 高级能力不会默认打开。

当前执行进展（2026-06-30）：

- 已新增 toolbar 的“引导”入口，打开后进入独立新手引导面板。
- 新手引导包含基础、增强、高级三张模式卡片。
- 每个模式都说明“会采集什么”“不会采集什么”“数据保存在哪里”“是否会外发”。
- 基础模式聚焦任务、宠物和前台 App 判断，提供一键完成按钮；完成时会关闭屏幕监控、复盘 LLM 和自动更新，并把完成状态写入本地 `localStorage`。
- 增强模式只跳转到“判断”设置分组，引导用户配置工作/学习/娱乐关键词和复盘相关判断，不自动开启高级能力。
- 高级模式标记为默认关闭，只跳转到 AI 设置分组查看屏幕 LLM、社交监督和 WebRTC 相关入口，不主动启用。
- 已补充测试，覆盖三层模式文案、四项说明、基础模式完成动作、高级默认关闭和默认设置中的高级开关状态。

当前 4.4 验收状态：

- 用户能在 3 分钟内完成基础模式：已完成。
- 高级能力不会默认打开：已完成。

### 4.5 LLM 输出 Schema 和截图策略

本项不包含：隐私模式、敏感 App 规则、标题脱敏、用户纠错入口。

建议 schema：

```json
{
  "state": "work | study | game | distracted | unknown",
  "activity_summary": "string",
  "task_relevance": "on_task | adjacent | off_task | uncertain",
  "evidence": ["string"],
  "confidence": 0.0,
  "privacy_risk": "low | medium | high",
  "suggested_intervention": "none | gentle | ask_user | return_to_task",
  "reasoning_visible": "short user-safe explanation"
}
```

截图策略：

- 限制缩略图分辨率。
- 不写入磁盘。
- 请求超时丢弃。
- LLM 返回内容只存摘要。
- 低置信度不触发强提醒。

验收标准：

- LLM 返回不符合 schema 时降级为 `unknown`。
- 低置信度只显示状态，不主动打扰。

当前执行进展（2026-06-30）：

- 屏幕监控 prompt 已改为要求视觉 LLM 只输出结构化 JSON，字段包含 `state`、`activity_summary`、`task_relevance`、`evidence`、`confidence`、`privacy_risk`、`suggested_intervention`、`reasoning_visible`。
- `normalizeScreenAnalysis()` 已支持新 schema，同时保留旧 `status/activity/reason/suggestion` 输出兼容。
- 新 schema 校验失败时会降级为 `unknown`，`suggestedIntervention` 固定为 `none`，用户可见解释为“LLM 输出不符合结构化 schema”。
- 当 `confidence < 0.75` 时会标记 `lowConfidence: true`，并把 `suggestedIntervention` 降为 `none`，只展示状态，不主动触发强提醒。
- 屏幕监控成功结果中的 `distracted` 用户可见消息已统一为“可能偏离当前任务”，避免重新出现“跑偏”等强提醒措辞。
- LLM 请求增加超时策略；超时返回 `status: timeout`，并丢弃本次截图结果，不把截图 data URL 带入返回值。
- 成功结果会记录截图策略摘要：缩略图尺寸、低细节请求、不写入磁盘、请求超时时间。
- 主进程屏幕监控日志只记录状态、活动摘要、结构化字段、截图策略和共享媒体 id，不写入截图 data URL。
- 已补充测试，覆盖结构化 schema、无效 schema 降级、低置信度降级、低打扰最终消息、prompt 字段、请求超时丢弃。

当前 4.5 验收状态：

- LLM 返回不符合 schema 时降级为 `unknown`：已完成。
- 低置信度只显示状态，不主动打扰：已完成。

## 5. P2 优先级

### 5.1 专注场景模板

场景示例：

- 写代码。
- 论文。
- 备考。
- 会议。
- 阅读。
- 创作。
- 轻休息。

每个模板包含：

- App 规则。
- 关键词规则。
- 提醒频率。
- 宠物动画偏好。
- 复盘指标。

当前执行进展（2026-06-30）：

- 已新增 `src/focus-scene-templates.js`，以同构模块暴露 `getFocusSceneTemplates()`、`findFocusSceneTemplate()` 和 `applyFocusSceneTemplate()`。
- 已内置 7 个模板：写代码、论文、备考、会议、阅读、创作、轻休息。
- 每个模板已包含 App 规则、关键词规则、提醒频率、宠物动画偏好、复盘指标和任务默认字段。
- 任务输入区已增加“专注场景”下拉框，选中模板后新增任务会自动写入 `focusSceneTemplate`、`focusSceneLabel`、`reminderMinutes`、`petAnimationPreference`、`reviewMetrics`、`relatedApps`、`relatedKeywords` 和 `contextTags`。
- `task-store` 已保留并清洗模板元数据，保持 `tasks.json` schema version 2 兼容。
- 状态判断已接入模板补充的任务相关 App/关键词；命中后原因会展示为“匹配某场景相关 App/关键词”。
- 渲染验证脚本已更新，兼容任务输入区的 5 控件布局。

当前 5.1 验收状态：

- 场景模板数据完整：已完成。
- 任务新增时可选择场景模板：已完成。
- 模板元数据能随任务入库存储：已完成。
- 模板 App/关键词能参与工作状态判断：已完成。
- 未补隐私模式、敏感 App、标题脱敏和用户纠错：按当前范围保持不做。

### 5.2 本地模型优先

现有 OpenAI-compatible endpoint 可以延展为：

- Ollama。
- 本地文本分类模型。
- 本地视觉模型。
- 无云端模式。

目标是把“本地模型优先”作为隐私卖点。

当前执行进展（2026-06-30）：

- 已新增 `src/llm-provider.js`，集中处理 LLM provider、local-only 模式、本地 endpoint 判断、Chat Completions endpoint 归一化和请求鉴权头。
- 设置系统已新增 `llmCloudMode`、`screenMonitorProvider`、`reviewLlmProvider` 字段。
- AI 设置页已增加“云端请求”模式，以及屏幕模型/复盘模型 provider 选择。
- 已支持 Ollama 本地、本机 OpenAI-compatible、云端 OpenAI-compatible 三种 provider。
- Ollama endpoint 可从 `http://127.0.0.1:11434` 自动归一化到 `/v1/chat/completions`。
- Ollama 和本机 provider 不要求 API key，请求不会发送空的 `Authorization` 头。
- `local-only` 模式会拒绝非本机回环地址的 LLM endpoint。
- 屏幕监控、复盘 LLM、LLM 连通性自检和诊断摘要均已接入 provider 信息。
- 诊断摘要只输出 provider、本地/云端状态、API key 是否必需和配置是否存在，不输出 endpoint/model 原文。

当前 5.2 验收状态：

- Ollama：已完成基础 OpenAI-compatible 接入。
- 本地文本分类模型：由现有本地规则判断承载，LLM 侧已补本机 OpenAI-compatible provider。
- 本地视觉模型：已完成屏幕监控本机 provider 接入。
- 无云端模式：已完成 `local-only` 配置拦截。
- 本地优先作为隐私卖点：已在 AI 设置、系统文档和诊断摘要中体现。

### 5.3 社交监督权限分级

权限级别：

- 只共享在线状态。
- 共享工作/学习/休息状态。
- 共享状态摘要。
- 共享屏幕分析摘要。

默认只共享最小状态，不共享 App 名称、窗口标题或历史摘要。

详细方案：

- 设置项：新增 `socialActivityShareLevel`，默认 `presence`。
- `presence`：只让对端看到在线/离线，不下发活动快照，不下发活动历史。
- `status`：只共享当前状态枚举和通用文案，例如专注中、学习中、休息中、游戏中、可能偏离。
- `summary`：共享当前状态摘要、建议和置信度，但不共享当前任务、前台 App、窗口标题、截图媒体或历史。
- `screen-summary`：共享屏幕分析摘要、原因、建议、复盘 insight 和最近活动历史；仍不向 peer 暴露当前任务、前台 App、窗口标题和截图媒体。
- 服务端统一在 `clientStateForAuth()` 和 WebSocket `activity` 事件出站前降级，不依赖前端隐藏字段。
- owner 本机状态和本地 activity log 保留完整数据，用于本机复盘和调试。
- 本阶段不实现隐私模式、敏感 App 列表、窗口标题脱敏和用户纠错机制。

当前执行进展（2026-06-30）：

- 设置系统已新增 `socialActivityShareLevel`，并在社交设置页提供四档选择。
- 聊天服务已新增 `sharedActivityForLevel()`，统一处理 peer 端活动快照降级。
- Peer 默认 `presence` 下只保留消息会话和在线状态，`activities` 与 `activityLog` 为空。
- `status`、`summary`、`screen-summary` 三档已分别限制字段范围。
- Peer 自身活动出站也已复用同一共享契约降级：`presence` 始终不下发活动快照或历史；`status`、`summary` 不下发活动历史；`screen-summary` 只下发降级后的摘要历史，不透传 `currentTask`、`frontmost`、`sourceName`、`media` 或完整 review。
- Peer 端不接收内部采集源名称 `sourceName`。
- `summary` 和 `screen-summary` 的 peer 可见 `message` 只由允许共享的活动摘要生成，不使用内部活动快照的自定义 `message`。
- `screen-summary` 的复盘信息只向 peer 下发 `review.insight`，不会共享复盘 `summary`、`petMessage`、`tone`、`status` 或 `ok`。
- 桌面端和远端社交端的 peer 活动视图已收敛到共享契约字段，不再渲染当前任务、前台 App、窗口标题或截图媒体。
- 聊天消息内的结构化 `messages[*].activity` 已复用同一共享级别降级规则，避免通过消息列表或 WebSocket `message` 事件绕过活动边界；peer 自己发送的 activity 消息返回给该 peer 时也只保留共享契约字段。
- Owner 尚无活动快照时，`status`、`summary` 和 `screen-summary` 档位会返回空活动，不会产生服务端错误或占位泄露。
- WebSocket 活动事件已按同一 peer 出站契约过滤，避免绕过 `/api/state` 的权限边界；`presence` 不发送 activity 事件，peer 自身活动也不会通过完整 payload 快捷分支绕过字段白名单。
- `distracted` 的 peer 侧通用状态文案已统一为“可能偏离”，避免社交监督里出现更强的“跑偏”措辞。
- 活动状态已支持 `work`、`study`、`rest`、`game`、`distracted`、`unknown`。
- 已补单元测试覆盖默认最小共享、四档共享字段边界、设置归一化和设置页接线。

当前 5.3 验收状态：

- 默认只共享在线状态：已完成。
- 共享工作/学习/休息状态：已完成。
- 共享状态摘要：已完成。
- 共享屏幕分析摘要：已完成。
- 不共享 App 名称、窗口标题、截图媒体或当前任务给 peer：已完成。
- 不共享内部采集源名称 `sourceName` 给 peer：已完成。
- 不共享内部活动自定义 message 给 peer：已完成。
- 不共享复盘 summary、petMessage、tone、status 或 ok 给 peer：已完成。
- Peer 活动 UI 不消费当前任务、前台 App、窗口标题或截图媒体字段：已完成。
- 消息内结构化 activity 不绕过社交共享级别：已完成。
- 缺失 owner 活动快照时各共享档位稳定返回空活动：已完成。
- Peer 自身活动不绕过共享契约字段白名单：已完成。

## 6. 不建议早期投入

- 云端账户系统。
- 团队监督。
- 家长/教育控制场景。
- 企业部署。
- 移动端。
- 订阅体系。
- 大型数据看板。

原因：这些方向会显著放大隐私、安全、合规和产品边界风险。

## 7. 执行顺序

### 阶段 1：低打扰与可信策略

1. 实现干预策略引擎。
2. 接入现有自动弹出逻辑。
3. 增加低置信度和每小时上限测试。
4. 调整权限异常不影响宠物体征。

### 阶段 2：社交安全硬化

1. 梳理当前 token 和邀请码生命周期。
2. 增加 Origin 校验。
3. 增加媒体上传白名单。
4. 增加服务端媒体内容嗅探。
5. 增加 peer session token 设备绑定。
6. 增加邀请码失败尝试限流。
7. 明确 WebRTC 通话边界。

### 阶段 3：数据可靠性

1. 原子写入。
2. schema version。
3. 损坏恢复。
4. 备份策略。
5. 活动日志保留周期。

### 阶段 4：复盘和任务增强

1. 当前任务模型增强。
2. 任务相关 App/关键词。
3. 高质量专注块统计。
4. 行动建议生成。

### 阶段 5：体验整理

1. 设置分层。
2. 新手引导。
3. 诊断包。
4. 发布前检查清单。

## 8. 当前开始执行项

本次先执行阶段 1 的一部分：

- 新增干预策略模块。
- 为低置信度、冷却时间、每小时最大提醒数、会议/演示低打扰保护建立测试。
- 将现有 `maybeAutoPopup` 接入该策略。
- 已继续执行阶段 1 的一部分：权限异常只显示修复提示和等待动画，不影响宠物心情、精力或亲密。
- 已继续执行阶段 1 的一部分：游戏和疑似偏离状态的宠物反馈改为轻提醒式节奏反馈，不扣减心情或亲密。
- 已继续执行阶段 1 的一部分：未知状态的宠物反馈改为观察式节奏反馈，不扣减心情或亲密。
- 已继续执行阶段 1 的一部分：`getStatus()` 状态消息改为低打扰文案，避免把游戏、疑似偏离或未知直接表达成强制回到任务。
- 已继续执行阶段 2 的一部分：社交安全边界文档、邀请码/session 过期、Origin 校验、媒体文件名和路径边界。
- 已继续执行阶段 2 的一部分：服务端媒体内容嗅探，阻断可执行文件头和固定文件头不匹配的伪装上传。
- 已继续执行阶段 2 的一部分：peer session token 设备绑定，新 session 会校验本地随机 device id 的哈希匹配。
- 已继续执行阶段 2 的一部分：peer session 显式撤销，owner 可撤销某个好友的外部会话 token，保留好友和聊天记录并关闭在线 peer WebSocket。
- 已继续执行阶段 2 的一部分：邀请码失败尝试限流，同一来源 10 分钟内 5 次错误后短时间阻断，并将来源哈希记录持久化到 chat state 以覆盖服务重启。
- 已继续执行阶段 2 的一部分：WebRTC 网络地址暴露提示、TURN 配置摘要和不泄露凭据的诊断引导。
- 已继续执行阶段 2 的一部分：服务端通话生命周期审计，并确保不落库音视频、SDP 或 ICE candidate。
- 已继续执行阶段 3 的一部分：JSON 原子写、写前自动备份轮转、损坏备份恢复、显式迁移入口、chat state version 和存储恢复文档。
- 已继续执行阶段 3 的一部分：`activity.jsonl`、`screen-monitor.jsonl` 和 `focus-pet.log` 默认保留 30 天，高级设置可调 1-365 天，追加本地样本或运行日志条目时按保留窗口原子裁剪，诊断摘要只输出保留天数。
- 已继续执行 P0 3.4 的一部分：诊断摘要模块、命令行入口、IPC 暴露和诊断文档。
- 已继续执行 P0 3.4 的一部分：存储健康诊断纳入 `.backup-*` 自动备份数量和最新文件名。
- 已继续执行 P0 3.4 的一部分：运行日志分级、主进程/启动监督脚本日志接入、诊断 `logs` 摘要、旧日志格式兼容和运行日志保留周期。
- 已继续执行 P0 3.4 的一部分：诊断文本、运行日志和 `appendErrorThing()` 错误日志清洗保留 `diagnostics-bundle-output`、`release-preflight`、`runDiagnosticsBundleOutputCheck` 等可读技术标识和无数字的典型 camelCase 函数名，同时继续替换 Bearer token、连续长 token、带长数字段的 token、env secret 赋值、secret key 赋值、URL、图片 data URL、当前任务/前台上下文键值（如 `currentTask`、`frontmost`、`screenEndpoint`、`reviewEndpoint`、`endpoint`）和本地绝对路径，兼顾安全边界和排障可解释性。
- 已继续执行 P0 3.4 的一部分：`cleanDiagnosticText()` 已补齐 URL、env secret 赋值和 `currentTask`、`frontmost`、`screenEndpoint`、`reviewEndpoint`、`endpoint` 等上下文键值清洗，避免最近错误摘要或日志摘要在进入诊断包前保留原始 endpoint、任务或前台上下文。
- 已继续执行 P0 3.4 的一部分：`cleanDiagnosticText()` 和 `sanitizeLogText()` 已补齐 `apiKey`、`authToken`、`sessionToken`、`inviteCode` 等 camelCase/snake_case/kebab-case secret key 赋值清洗，避免非 env 命名的本地密钥、owner token、peer session token 或邀请码进入诊断文本与运行日志摘要。
- 已继续执行 P0 3.4 的一部分：`sanitizeLogText()` 已覆盖 `/Users`、`/private`、`/tmp`、`/var/folders` 和 Windows drive-letter 本地绝对路径，运行日志与 `appendErrorThing()` 只保留 `[local-path]` 标签，避免错误日志或运行日志回显本机目录结构。
- 已继续执行 P0 3.4 的一部分：诊断摘要 `recentErrors` 新增 `closedByLater` 和 `open` 标记，被后续同问题已解决记录关闭的历史“未解决”项不会再被误读为仍开放；闭环判定优先使用内部完整“问题描述 + 发生位置”key，描述模糊匹配只允许在发生位置兼容时作为兜底，避免相同摘要但不同文件/位置的问题被误闭环，且内部 key 不输出。
- 已继续执行 P0 3.4 的一部分：诊断摘要的屏幕监控和复盘 LLM 配置新增 `apiKeyRequired`，和 `apiKeyConfigured` 分开输出；本地模型、Ollama 和 `local-only` 模式会明确标记 API key 非必需，同时仍不输出 endpoint、model 或 key 原文。
- 已继续执行阶段 4 的一部分：任务模型增强、当前任务选择解释、手动设为当前任务入口、任务相关 App/关键词参与状态判断、任务维度复盘、行动建议生成和任务模型文档。
- 已继续执行阶段 5 的一部分：设置面板分层、AI/社交/高级高风险能力归组、设置内数据目录和诊断摘要入口、新手引导三层模式和基础模式一键完成。
- 已继续执行阶段 5 的一部分：新增 `npm run release:preflight`，默认打印发布前检查清单，`--run fast` 执行 `npm test`、`npm run check`、`node scripts/release-preflight.js --check diagnostics-summary-output`、`npm run diagnostics:bundle -- --output-dir output/diagnostics/preflight`、`node scripts/release-preflight.js --check diagnostics-bundle-output`、`node scripts/release-preflight.js --check package-scripts`、`node scripts/release-preflight.js --check docs-boundary`、`node scripts/release-preflight.js --check optimization-plan` 和 `node scripts/release-preflight.js --check error-log`；CLI 也兼容 `--run=fast` 与 `--check=error-log` 等号写法，避免常见参数形式被误解析为空。
- 已继续执行阶段 5 的一部分：`diagnostics-summary-output` 作为诊断摘要 fast 自动 gate，会生成运行时诊断摘要并对序列化结果做顶层 schema 校验和标签化边界扫描，检查输出只包含是否生成、JSON 是否有效、`summarySchemaValid`、`summaryGeneratedAtValid`、缺失顶层区块、未知顶层字段数量和问题标签；其中 `summaryGeneratedAtValid` 要求 `summary.generatedAt` 是可解析时间，不可解析时 `summarySchemaValid` 也会失败。若出现 JSON secret 字段和值组合，只返回 `json-secret-field` 标签；若出现文本 secret key 赋值，只返回 `secret-assignment` 标签；若出现 raw 任务、聊天、窗口、内部上下文字段（`currentTask`、`frontmost`、`sourceName`）、错误内部键 `rawIssueKey`、截图、endpoint 或 model 等字段名，只返回 `json-raw-field` 标签，不回显诊断摘要正文、未知字段名或字段内容。
- 已继续执行阶段 5 的一部分：`diagnostics-bundle-output` 作为诊断包生成后的 fast 自动 gate，会检查最新预检诊断包只包含 `summary.json` 和 `manifest.md`、`summary.json` 可解析且顶层 schema 完整、manifest 引用 summary 和当前包名、`summary.generatedAt` 能推导出当前包名，并对 `summary.json` 和 `manifest.md` 做标签化边界扫描；若出现本地绝对路径（含 Windows drive-letter 路径）、Bearer token、env secret、secret key 赋值、图片 data URL、TURN URL、JSON secret 字段和值组合或 JSON raw 字段名（含任务、聊天、窗口、内部上下文、错误内部键、截图、endpoint、model），只返回 `absolute-path`、`bearer-token`、`env-secret`、`secret-assignment`、`data-url`、`turn-url`、`json-secret-field`、`json-raw-field` 这类标签和布尔检查结果，不回显诊断内容、未知字段名或敏感值。
- 已继续执行阶段 5 的一部分：诊断摘要和诊断包边界扫描已新增普通 http/https URL 标签，若 URL 值通过非 endpoint 字段或 manifest 文本泄露，只返回 `url` 标签，不回显 URL 原文。
- 已继续执行阶段 5 的一部分：诊断摘要和诊断包边界扫描已新增 WebSocket URL 标签，若 `ws://` 或 `wss://` 通过摘要或 manifest 泄露，只返回 `websocket-url` 标签，不回显 URL 原文。
- 已继续执行阶段 5 的一部分：诊断包写入后会自动轮转同一输出目录下匹配 `focus-pet-diagnostics-YYYYMMDD-HHMMSS` 的旧诊断包目录，默认保留最新 20 个，非匹配目录不清理；`writeDiagnosticsBundle()` 会返回保留和清理数量，便于预检记录。
- 已继续执行阶段 5 的一部分：`package-scripts` 作为 fast 自动 gate，会静态检查打包、签名、验证脚本入口存在，实际命令指向的脚本文件存在，并已通过 `npm run check` 中的真实语法检查命令覆盖；只在 `check` 中 `echo` 脚本路径或以普通文本提到路径不会视为覆盖，该 gate 不执行真实打包、签名或公证。
- 已继续执行阶段 5 的一部分：`docs-boundary` 从人工复核升级为 fast 自动 gate，会检查必需边界文档存在，并确认本轮排除项没有以中文、camelCase、snake_case 或 kebab-case 等常见命名形态进入源码实现；该 gate 也会校验社交安全边界文档保留服务重启持久化与多实例全局限流 caveat，且不会把已实现的重启持久化能力继续列为未覆盖风险。
- 已继续执行阶段 5 的一部分：`optimization-plan` 作为 fast 自动 gate，会检查必需优化章节、验收状态段、空验收段、未完成验收项和本轮排除项；空验收段只返回 `emptyAcceptanceSections` 的章节编号；验收项中的“未完成”“部分完成”“待完成”“进行中”“尚未完成”“未达成”“未通过”都会被视为未达成，即使写在冒号、括号、破折号或空格后也会被识别，且检查输出只包含章节编号和行号，不回显计划正文。
- 已继续执行阶段 5 的一部分：`error-log` 从人工复核升级为 fast 自动 gate，会检查 `docs/errorThing.md` 存在、跳过顶部 `## [时间]` 模板、校验全部真实记录字段完整、确认最新状态为已解决，并扫描是否存在未被后续同问题已解决记录关闭的开放未解决项；QA 已通过时的 Electron/Chromium GPU 退出噪声作为非阻断观察项处理，检查输出只返回行号、字段名和时间，不回显错误正文。
- 已继续执行阶段 5 的一部分：`--run full` 新增 `screen-pipeline` gate，会在桌面渲染 QA 后执行 `npm run test:screen-pipeline`，用于发布前确认手动屏幕分析、结构化 LLM 输出和复盘 LLM 串联。
- 已继续执行阶段 5 的一部分：`--run package` 的 macOS package 清单显式包含 `mac-notarization`，在本地打包、签名校验之外列出 `npm run notarize:mac && npm run verify:mac`，避免发布流程漏掉已有公证脚本，并在 staple 后再次执行 Gatekeeper/签名验证。
- 已继续执行阶段 5 的一部分：发布前清单新增 `mac-remote-client-package` 人工条件项，显式列出 `npm run package:mac:remote-client`；该步骤依赖部署后的 HTTPS `REMOTE_CLIENT_URL`，因此只在清单展示并由发布执行者单独运行，不随 `--run package` 自动执行。
- 已继续执行阶段 5 的一部分：远端社交客户端 mac 包的 `REMOTE_CLIENT_URL` 校验收紧为 HTTPS 且路径必须是 `/client` 或 `/client/...`，避免 `/client-...` 这类相似路径被误打包；校验函数已可导入测试。
- 已继续执行阶段 5 的一部分：远端社交客户端 mac 包内的媒体权限校验从字符串前缀匹配改为解析请求 URL origin 后与 `REMOTE_CLIENT_URL` 精确同源比较，避免相似域名获得麦克风/摄像头权限。
- 已继续执行阶段 5 的一部分：远端社交客户端 mac 包内的外链和导航边界已收紧，内嵌窗口只保留同源 `/client` 页面，跳出该范围的 http/https 导航交给系统浏览器，非 http/https 外链不会调用 `shell.openExternal()`。
- 已继续执行阶段 5 的一部分：`chat-backend-deploy` 作为 fast 自动 gate，会静态检查社交后端容器部署入口，确认 `Dockerfile` 使用生产依赖安装、配置 `0.0.0.0` 监听和持久化数据目录、包含 `/healthz` healthcheck、通过 `npm run chat:serve` 启动，且 Node 入口接入 chat service 并处理 `SIGTERM` 关闭。
- 已继续执行阶段 2/5 的一部分：Node-only 社交后端启动日志不再输出完整 `inviteUrl` 或邀请码，只输出 `hasInviteUrl` 布尔摘要；`chat-backend-deploy` gate 已增加 `startup-invite-url-output` 禁止项，避免云端容器日志暴露邀请链接。
- 已继续执行阶段 2/5 的一部分：Node-only 社交后端异常日志已复用 `sanitizeLogText()`，并由 `chat-backend-deploy` 的 `unsanitized-startup-error-output` 禁止项阻断直接 `console.error(error...)` 输出未清洗异常。
- 已继续执行阶段 2/5 的一部分：`unsanitized-startup-error-output` 已扩展到 `err`、`reason` 和 `exception` 等常见异常参数名，阻断 `console.error(err)`、`console.error(reason?.stack || reason)` 这类启动日志绕过。
- 已继续执行阶段 2/5 的一部分：`unsanitized-startup-error-output` 已继续扩展到 `e`、`ex` 短异常参数名和 `console.warn(...)`，阻断 `console.error(e?.stack || e)`、`console.warn(ex)` 这类同样进入容器日志的未清洗异常输出。
- 已继续执行阶段 2/5 的一部分：`unsanitized-startup-error-output` 已覆盖 `console.log(...)`、`console.info(...)`、`console.debug(...)` 和 `console.trace(...)` 输出原始异常对象或异常 `.stack/.message`，避免 stdout 类容器日志绕过清洗边界。
- 已继续执行阶段 2/5 的一部分：`unsanitized-startup-error-output` 已从首参数匹配升级为控制台调用参数扫描，阻断 `console.error('startup failed', error)` 和 `console.warn({ err })` 这类带前缀参数或对象包装的未清洗异常输出。
- 已继续执行阶段 2/5 的一部分：`unsanitized-startup-error-output` 会从 `uncaughtException`、`unhandledRejection`、`warning` 和 `rejectionHandled` 的回调中提取异常参数名，阻断 `failure => console.error('startup failed', failure)`、`payload => console.warn({ payload })` 这类任意参数名绕过。
- 已继续执行阶段 2/5 的一部分：`unsanitized-startup-error-output` 已改为平衡解析 `console.*(...)` 参数列表并逐参数判断，允许单个 `sanitizeLogText(...)` 参数，但会阻断 `console.error(sanitizeLogText('startup failed'), failure)` 和 `console.warn(sanitizeLogText(payload?.message), { payload })` 这类混合清洗文本与原始异常对象的启动日志输出。
- 已继续执行阶段 2/5 的一部分：社交安全边界文档已修正“当前未覆盖风险”，明确单进程服务重启后的邀请码失败尝试限流已由 `chat-state.json` 持久化覆盖，多实例全局限流仍需在网关、反向代理或共享存储层补充，并由 `docs-boundary` gate 防止该边界再次漂移。
- 已继续执行阶段 2/5 的一部分：`chat-backend-deploy` gate 已增加 `startup-invite-code-output`、`startup-auth-token-output` 和 `startup-session-token-output` 禁止项，避免 Node-only 容器 stdout 暴露邀请码、owner token 或 peer session token。
- 已继续执行阶段 2 的一部分：peer 侧 `mark-read` 已读状态写入改为认证上下文作用域，避免外部 peer 清理 owner 侧其他好友未读数或篡改其他 peer 发给 owner 的消息已读状态。
- 已继续执行阶段 2/5 的一部分：`chat-backend-deploy` gate 已增加 `startup-public-state-output` 禁止项，阻断直接 `console.log(JSON.stringify(chatService.publicState()))`、`console.log('owner state', chatService.publicState())`、`console.info({ state: chatService.publicState() })`、`console.trace(\`state ${chatService.publicState()}\`)` 这类完整 owner 状态输出，避免绕过逐字段日志扫描。
- 已继续执行阶段 2/5 的一部分：`chat-backend-deploy` gate 已增加 `startup-public-state-variable-output` 禁止项，阻断 `const state = chatService.publicState(); console.log(JSON.stringify(state))`、`let state; state = chatService.publicState(); console.log('owner state', state)`、`const ownerState = state; leakedState = ownerState; console.info({ leakedState })`、`console.trace(\`state ${state}\`)` 这类声明初始化、后续赋值或完整状态二次别名链中转后的完整 owner 状态输出；`hasInviteUrl: Boolean(state.inviteUrl)` 这类布尔摘要仍允许。
- 已继续执行阶段 2/5 的一部分：`chat-backend-deploy` gate 已增加 `startup-public-state-sensitive-property-output` 禁止项，阻断 `const state = chatService.publicState(); console.log(state.inviteUrl)`、`JSON.stringify(state.sessions)`、对象包装中的敏感属性访问，以及 `const invite = state.inviteUrl; console.log(invite)`、`console.log('invite', invite)`、`invite = state.inviteUrl; console.log(\`invite ${invite}\`)`、`leakedInvite = invite; console.log(leakedInvite)` 这类敏感属性派生别名链输出；`hasInviteUrl: Boolean(state.inviteUrl)` 这类布尔摘要仍允许。
- 已继续执行阶段 2/5 的一部分：`chat-backend-deploy` gate 已增加 `startup-public-state-destructured-sensitive-output` 禁止项，阻断 `const { inviteUrl } = chatService.publicState(); console.log(inviteUrl)`、对象包装输出、非首参数对象包装输出、模板字符串插值、`authToken` 别名解构、`sessions` 解构输出，以及 `const leakedInvite = inviteUrl; console.log(leakedInvite)`、`leakedSessions = sessions; console.info({ leakedSessions })` 这类解构敏感字段派生别名链绕过。
- 已继续执行阶段 2/5 的一部分：完整 owner 状态、变量中转状态、敏感属性访问、敏感属性声明初始化、后续赋值和二次别名链得到的派生别名，以及解构敏感字段和其派生别名链的启动日志检测已覆盖 `console.warn(...)`、`console.info(...)`、`console.debug(...)` 和 `console.trace(...)` 的所有参数位置，避免这些同样进入容器日志的方法绕过 `chat-backend-deploy`。
- 已继续执行体验优化的一部分：Nervy spritesheet 已从 21 行扩展到 30 行全身动画，新增 `morning`、`hug`、`surprise`、`cry`、`angry`、`busy`、`ok`、`love`、`call` 九类动作；工作和任务看板会使用 `busy`，分心/低落会使用 `cry`，通话会使用 `call`，聊天面板会使用 `morning`。
- 已继续执行体验优化的一部分：`pet:generate-animations` 改为通过 `scripts/run-pet-animation-generator.js` 启动，优先使用带 Pillow 的 Python，系统 `python3` 缺 Pillow 时会自动回退到 Codex bundled Python，避免资源生成命令在当前环境不可执行。
- 已继续执行体验优化的一部分：宠物分享素材已重构为短发黑发、米白针织毛衣、浅色洞洞鞋小人形象的全身图片包，`src/assets/pets/nervy-sci-fi-kid/images/source` 保存 24 张由参考图特征生成得到的源 PNG，`images/frames` 保存 190 张由这些新图生成的动作帧；聊天动图托盘和主进程分享清单已扩展到 21 个独立 GIF 和一个全身状态合集 GIF；`animation-manifest.json` 对 spritesheet、imagePack 和 interactionGifs 统一标记 `identity: elys-short-haired-sweater-girl`、`fullBody: true`、`sourceType: generated-image-pack` 和 `usesBaseSpritesheet: false`，并将标准 QA 接触表刷新到 `output/hatch-pet/nervy/qa/contact-sheet.png`，避免继续把旧 spritesheet 裁帧当作新增图片，也避免再混入旧小人、星核机器人或动物形象。
- 已继续执行架构优化的一部分：桌面主进程的 `chat-service` 从顶层常驻依赖改为 `getChatService()` 懒加载，并通过 `ensureChatServiceStarted()` 在聊天、宠物动图分享和屏幕活动摘要同步时按需启动；渲染端取消启动即连接聊天 WebSocket，改为打开聊天或发送消息时连接；宠物 GIF 托盘关闭、切换面板或折叠桌宠时会释放预览图片节点；Electron 窗口启用后台节流并关闭拼写检查，降低基础运行内存占用。
- 已继续执行架构优化的一部分：主进程的 diagnostics、screen-monitor 和 llm-self-check 从顶层依赖改为 getter 懒加载，只有诊断、屏幕监控采样或 LLM 自检触发时才加载；`settings:update` 只在聊天服务已加载时同步社交运行态设置，避免保存设置拉起社交模块；diagnostics 内部的 chat-service 依赖也改为按需获取，避免诊断模块导入阶段间接加载社交服务。

不触碰：

- 隐私模式。
- 敏感 App。
- 标题脱敏。
- 用户纠错。
