# Focus Pet 系统基本内容与功能说明

## 1. 系统概述

Focus Pet 是一个中隐私桌面宠物系统。它以透明置顶的桌面宠物窗口作为入口，通过读取当前前台 App、窗口标题、任务清单和可选屏幕分析结果，帮助用户维持工作、学习和任务推进节奏。

系统默认不读取网页正文、不记录键盘输入、不截屏。只有用户手动触发屏幕检查，或明确开启定时屏幕检查后，才会截取屏幕缩略图并发送到 StepFun 或用户配置的兼容视觉模型。

## 2. 系统目标

- 降低任务推进中的分心成本。
- 用轻量桌面宠物替代强打扰提醒。
- 将任务、复盘、陪伴反馈和社交监督集中在一个入口。
- 在尽量少采集隐私数据的前提下，判断用户当前状态。
- 支持本地桌面端和浏览器第二端之间的聊天、提醒和通话信令。

## 3. 主要组成

### 3.1 桌面宠物端

桌面宠物端基于 Electron 实现，主要包含：

- 透明、无边框、置顶窗口。
- 默认 click-through，只有鼠标进入宠物、气泡或面板时才接管点击。
- 宠物本体、消息气泡、任务面板、复盘面板、设置面板和聊天面板。
- 心情、精力、亲密三项宠物体征。
- 喂食、轻互动、学习、打工、玩耍、休息等照料动作。
- 不同状态和照料动作对应的宠物动画；Nervy spritesheet 当前包含 30 行全身动作，额外覆盖伸展、补水、冥想、复盘阅读、成功欢呼、早安、抱抱、惊讶、哭哭、生气、OK、想你和通话陪伴等轻互动反馈。
- 独立宠物图片包用于聊天分享素材，当前包含 24 张短发毛衣、浅色洞洞鞋小人源 PNG 和 190 张动作帧 PNG；互动 GIF 从该图片包派生，不再从旧 spritesheet 裁帧生成；标准视觉 QA 接触表位于 `output/hatch-pet/nervy/qa/contact-sheet.png`。

低内存运行策略：

- 桌面端启动时只初始化主窗口、基础状态判断和当前宠物动画，不主动启动社交聊天 HTTP/WebSocket 服务。
- 首次打开聊天、发送聊天消息、分享宠物动图或发布屏幕活动摘要时，主进程才通过 `getChatService()` 和 `ensureChatServiceStarted()` 加载并启动聊天服务。
- 诊断摘要、屏幕检查和 LLM 连通性自检不在主进程启动时加载；只有用户打开诊断、手动测试屏幕检查、开启定时屏幕检查或点击 LLM 自检时，才加载对应模块。
- 保存设置不会为了同步社交共享档位而加载聊天服务；只有聊天服务已加载时才同步运行态设置，未加载时由聊天服务首次使用时读取当前设置。
- 渲染端聊天 WebSocket 不随应用启动连接，只有进入聊天面板或发送消息时才读取聊天状态并建立连接。
- 宠物动图托盘只在打开时创建 GIF 预览图片节点；关闭托盘、切换出聊天面板或折叠桌宠时会清空托盘节点，让浏览器释放 GIF 解码资源。
- Electron 窗口启用后台节流并关闭拼写检查，避免低频后台面板额外占用渲染资源。

应用更新策略：

- 桌面端内置 GitHub Release 更新源，默认自动检查是否存在新版本。
- 自动检查由主进程定时执行，发现新版本时使用系统通知提醒用户。
- 通知点击和手动“检查更新”都会打开 Release 下载页；应用不会静默下载、替换或重启安装包。
- 用户可以在高级设置中修改更新源 URL 或关闭自动检查更新；基础模式引导完成时会关闭自动更新，以保留完全本地低打扰使用方式。

### 3.2 专注状态判断模块

系统每分钟读取一次当前前台 App 和窗口标题，并结合任务与规则判断状态：

- `work`：工作状态。
- `study`：学习状态。
- `game`：游戏或娱乐状态。
- `distracted`：疑似分心状态。
- `unknown`：无法确定是否与任务相关。
- `permission`：系统权限不足，无法读取窗口信息。

判断依据包括：

- 当前任务文本。
- 当前任务声明的相关 App 和关键词。
- 工作关键词。
- 学习关键词。
- 游戏关键词。
- 分心关键词。
- 工作 App 列表。
- 游戏 App 列表。
- 可选屏幕 LLM 分析结果。

### 3.3 任务系统

任务系统用于维护当天的可执行清单，支持：

- 新增任务。
- 完成或重新打开任务。
- 编辑任务标题。
- 删除任务。
- 置顶或置底任务。
- 设置优先级。
- 设置截止日期。
- 设置任务描述、预计时间、精力等级、标签、下一步动作和阻塞原因。
- 声明任务相关 App 和关键词，用于辅助判断当前活动是否与任务相关。
- 选择专注场景模板，让任务自动带上场景 App 规则、关键词规则、提醒频率、宠物动画偏好和复盘指标。
- 自动选择当前最可执行任务。
- 返回当前任务选择原因，例如置顶、高优先级、截止日期或下一步动作。
- 兼容导入和导出 Markdown 任务文件。

默认任务数据保存在：

```text
~/.hermes/focus-watchdog/today_tasks.md
~/.hermes/focus-watchdog/tasks.json
```

专注场景模板内置：

- 写代码。
- 论文。
- 备考。
- 会议。
- 阅读。
- 创作。
- 轻休息。

用户在新增任务时选择模板后，系统会把模板的 App 规则和关键词规则写入任务元数据。状态判断命中这些规则时，会显示类似“匹配写代码场景相关 App”的原因，帮助用户理解宠物为什么认为当前活动与任务相关。

`getStatus()` 返回给桌面端和命令行的状态消息同样采用低打扰文案：`game`、`distracted`、`unknown` 只表达“可能偏离”“结束点”“观察节奏”等提示，不使用“收回来”“切回任务”或惩罚式措辞。

屏幕检查 LLM 成功返回后的用户可见消息也沿用同一口径：`distracted` 表达为“可能偏离当前任务”，低置信度结果只展示状态，不主动触发强提醒。

### 3.4 宠物状态系统

宠物有三项核心体征：

- 心情：反映用户节奏、分心、互动和完成反馈。
- 精力：反映工作、学习、游戏、照料和休息消耗。
- 亲密：反映用户与宠物之间的互动和持续陪伴关系。

状态绑定逻辑：

- 工作会轻微提升心情和亲密，同时消耗少量精力。
- 学习会提升亲密，宠物进入安静陪伴状态，同时消耗精力。
- 游戏会轻微提升心情并消耗少量精力，以低打扰方式提示给自己留结束点，不扣亲密。
- 疑似分心只轻微消耗精力，文案表达节奏提醒，不扣心情或亲密。
- 未知状态会让宠物表现为不确定或观察中，只轻微消耗精力，不扣心情或亲密。
- 权限不足只显示修复提示和等待动画，不扣减心情、精力或亲密。

### 3.5 复盘系统

复盘系统读取最近 24 小时活动记录，生成专注统计：

- 工作/学习分钟数。
- 疑似分心分钟数。
- 未知分钟数。
- 权限异常分钟数。
- 专注分数。
- 状态占比。
- 每小时分布。
- 常用 App 统计。
- 明日任务建议。
- 任务维度推进情况。
- 任务维度阻力摘要，包括阻塞原因、缺少下一步、疑似偏离分钟和未知相关性分钟。
- 每小时 App 切换次数。
- 高质量专注块。
- 最容易偏离的时段。
- 长期未完成和被打断的任务。
- 可执行行动建议。

统计兼容规则：

- `study` 计入工作/学习分钟。
- `game` 计入疑似分心分钟。

活动日志默认保存在：

```text
~/.hermes/focus-watchdog/activity.jsonl
```

本地日志默认保留 30 天，可在高级设置中调整为 1-365 天。系统每次写入新的活动样本、屏幕检查样本或运行日志条目后会按保留周期裁剪旧记录；时间字段缺失或无法解析的历史 JSONL 行会保留，旧的 `[time] message` 运行日志行会按兼容格式解析并参与同一保留窗口。

### 3.6 可选屏幕检查

屏幕检查默认关闭。用户可以手动“测试检查”，也可以明确开启定时检查。触发后系统会按低细节策略截取屏幕缩略图。默认发布配置可以优先发送到 Focus Pet Cloud 的 `/api/screen-check`，由后端持有 StepFun key 并返回结构化判断；如果本机配置了可用 LLM key 或选择本机直连，则桌面端也可以直接调用 StepFun、Ollama 或用户配置的视觉 LLM。

LLM 提供方支持：

- StepFun 视觉检查，默认 endpoint 为 `https://api.stepfun.com/v1`，运行请求会规范化到 `/chat/completions`，默认模型为 `step-3.7-flash`。
- Ollama 本地服务，默认按 `http://127.0.0.1:11434/v1/chat/completions` 兼容接口请求。
- 本机 OpenAI-compatible 服务。
- 云端 OpenAI-compatible 服务。

AI 设置中可以切换“允许云端”或“仅本地”。在“仅本地”模式下，非 `localhost`、`127.0.0.1` 或本机回环地址的 LLM endpoint 会被视为未满足配置。Ollama 和本机 OpenAI-compatible provider 不要求 API key；StepFun 默认读取 `FOCUS_PET_SCREEN_LLM_API_KEY`、`FOCUS_PET_STEPFUN_API_KEY`、`STEPFUN_API_KEY` 或 `STEP_API_KEY`，请求头不会发送空的 `Authorization`。

Cloud 检查模式下，桌面端不会保存 StepFun key，只会把用户自己的低细节截图、当前任务摘要和前台 App 摘要发送到 Cloud。Cloud 读取 `FOCUS_PET_CLOUD_STEPFUN_API_KEY` 等后端环境变量调用 StepFun，并且不把截图原文或 key 返回给桌面端。桌面端设置中可通过“检查通道”和“Cloud 检查 URL”切换自动、Cloud 或本机直连。

屏幕检查返回内容包括：

- 当前状态。
- 当前活动摘要。
- 当前任务相关性。
- 判断依据。
- 置信度。
- 用户可见解释。
- 建议干预级别。
- 截图策略摘要。

支持状态：

- `work`
- `study`
- `game`
- `distracted`
- `unknown`

屏幕截图本身不写入本地文件；本地记录的是模型返回的状态摘要和上下文。

视觉 LLM 输出使用结构化 schema：`state`、`activity_summary`、`task_relevance`、`evidence`、`confidence`、`privacy_risk`、`suggested_intervention`、`reasoning_visible`。如果返回内容不符合 schema，系统会降级为 `unknown`。当置信度低于 `0.75` 时，系统只展示状态，`suggested_intervention` 会降为 `none`，不会主动强提醒。

截图请求策略：

- 使用低细节缩略图请求，默认缩略图尺寸上限为 `960x540`。
- 请求超时会丢弃本次截图结果并返回 `timeout`。
- 检查日志只保存状态、摘要、结构化字段和截图策略摘要，不保存截图 data URL。

### 3.7 新手引导

桌面端提供“引导”入口，帮助用户在三种模式里选择初始使用方式：

- 基础模式：任务 + 宠物 + 前台 App 判断。用户可以一键完成基础模式，系统会关闭屏幕检查、复盘 LLM 和自动更新，保持本地低打扰使用。
- 增强模式：引导用户进入判断设置，配置工作/学习/娱乐关键词和复盘相关判断。
- 高级模式：说明屏幕 LLM、社交监督和 WebRTC 能力，并保持默认关闭；用户需要进入对应设置后手动开启。

每个模式都会说明会采集什么、不会采集什么、数据保存在哪里、是否会外发。基础模式完成状态保存在本机 `localStorage`，不写入外部服务。

### 3.8 设置系统

设置面板按使用风险和频率分层：

- 基础：自动弹出开关、开机启动、提醒冷却时间、空闲提醒时间、宠物行为强度。
- 判断：工作关键词、学习关键词、游戏关键词、分心关键词、工作 App、游戏 App。
- AI：云端请求模式、屏幕检查开关和间隔、屏幕模型提供方、LLM Endpoint 和 Model、复盘 LLM 提供方和配置、LLM 连通性自检、手动测试检查、屏幕权限入口。
- 社交：媒体大小上限、语音消息快捷键；邀请码、外部会话和通话配置由聊天面板管理。
- 高级：更新源 URL、自动检查更新、本地日志保留天数、数据目录、诊断摘要、权限引导。

首次打开设置时默认显示基础分组。AI、社交和高级分组集中承载屏幕检查、外部会话、通话、诊断和存储相关能力，避免低频高风险配置混在基础设置里。

设置默认保存在：

```text
~/.hermes/focus-watchdog/settings.json
```

### 3.9 社交聊天与通话

系统内置本地 HTTP/WebSocket 聊天服务，支持桌面端和浏览器第二端通信。桌面端默认不在应用启动时常驻该服务；只有用户进入聊天、发送社交内容或开启需要同步的屏幕活动摘要时才按需启动。

主要能力：

- 邀请码加入。
- 错误邀请码尝试限流，失败来源以哈希形式持久化。
- scoped session token。
- 新 peer session token 的本地随机 deviceId 绑定。
- Owner 显式撤销 peer 外部会话 token，保留好友和聊天记录。
- 昵称。
- 在线/离线状态。
- 未读计数。
- 文本消息。
- 图片消息。
- 文件消息。
- 上传媒体的扩展名、MIME 和固定文件头校验。
- 语音消息。
- 宠物动图发送，内置 21 个独立动作 GIF 和一个全身状态组合演示 GIF；这些 GIF 由短发毛衣、浅色洞洞鞋小人形象的独立图片包生成，并在 manifest 中标记 `identity: elys-short-haired-sweater-girl`、`fullBody: true`、`sourceType: generated-image-pack` 和 `usesBaseSpritesheet: false`。
- 消息发送状态：queued、sent、delivered、read。
- 屏幕活动摘要同步。
- 实时语音/视频通话信令。
- WebRTC offer、answer、ICE 转发。
- 首次通话前的 WebRTC 网络地址暴露提示。
- 通话取消、拒绝、不可用或结束时的本地媒体轨道、peer connection、pending 提示和 video 清理。
- ICE/TURN 配置摘要与诊断引导。
- 服务端通话生命周期审计。

默认聊天服务端口：

```text
47321
```

WebRTC ICE 服务器配置：

```text
FOCUS_PET_RTC_ICE_SERVERS
```

该环境变量支持 JSON 数组，也支持逗号或换行分隔的 URL。未配置时系统使用默认 STUN；跨复杂 NAT、公司网络、手机流量或跨运营商实时通话时，建议配置 `turn:` 或 `turns:`。诊断摘要只输出是否配置、STUN/TURN 数量和是否建议补 TURN，不输出 ICE/TURN 地址、用户名或凭据。

通话生命周期审计保存在聊天状态中，只记录事件类型、双方 id、callId、mode、送达状态、送达客户端数量和时间，不保存音视频、SDP 或 ICE candidate。诊断摘要只输出审计条数。

聊天数据默认保存在：

```text
~/.hermes/focus-watchdog/social/
```

### 3.10 诊断与运行日志

系统提供运行诊断摘要和安全诊断包，用于排查权限、配置、聊天服务、存储健康、状态判断和运行日志等级。

诊断摘要包含：

- 应用版本、生成时间和平台。
- 权限状态。
- 设置摘要、活动日志保留天数、LLM 配置是否存在以及 API key 是否必需。
- 任务计数。
- 最近状态判断原因分类。
- 聊天服务、WebSocket 和 WebRTC ICE/TURN 摘要。
- 存储健康。
- 运行日志等级计数。
- 最近错误摘要，并标记历史“未解决”项是否已被后续同问题记录关闭。

运行日志默认写入：

```text
~/.hermes/focus-watchdog/focus-pet.log
```

主进程和启动监督脚本写入 `debug`、`info`、`warn`、`error` 四级 JSONL 日志。`focus-pet.log` 跟随高级设置中的本地日志保留天数裁剪旧记录，默认保留 30 天；旧的 `[time] message` 文本行会按 `info` 兼容解析。诊断摘要只读取可解析条数、等级计数和最近少量已清洗日志，不包含原始日志文件。运行日志和 `appendErrorThing()` 错误日志写入都会复用 `sanitizeLogText()`：替换 Bearer token、连续长 token、带长数字段的 token、env secret 赋值、`apiKey`/`authToken`/`sessionToken`/`inviteCode` 等 secret key 赋值、URL、图片 data URL、当前任务/前台上下文键值和本地绝对路径（含 Windows drive-letter 路径）；`currentTask`、`frontmost`、`screenEndpoint`、`reviewEndpoint`、`endpoint` 等键只保留键名和值已遮盖，同时保留短横线技术标识和无数字的典型 camelCase 函数名，便于定位 gate、脚本或模块名称。

安全诊断包只包含 `summary.json` 和 `manifest.md`。它不会包含聊天正文、任务全文、截图、API key、session token、邀请码、LLM endpoint/model 原文、ICE/TURN 地址或原始运行日志。诊断包写入后会自动轮转同一输出目录下匹配标准命名的旧诊断包，默认保留最新 20 个，避免发布前预检反复执行后无限累积产物。

## 4. 用户主要使用流程

### 4.1 日常专注流程

1. 启动 Focus Pet。
2. 在任务面板写下当天任务；需要时选择写代码、论文、备考、会议、阅读、创作或轻休息等专注场景模板。
3. 系统跳过阻塞任务，并按手动选中、置顶、优先级、截止日期、下一步和列表顺序选择当前最可执行任务。
4. 宠物每分钟读取当前前台 App 和窗口标题。
5. 系统结合当前任务文本、任务相关 App/关键词、专注场景模板和全局规则，判断用户处于工作、学习、游戏、分心、未知或权限状态。
6. 宠物通过状态点、动画、气泡和体征变化反馈当前状态；权限异常只显示修复提示，不改变体征。
7. 当用户游戏、分心或未知时，宠物低频提醒回到任务；权限异常会低频提示打开对应设置。

### 4.2 任务复盘流程

1. 用户打开复盘面板。
2. 系统读取近 24 小时活动记录。
3. 生成工作/学习、分心、未知和权限占比。
4. 汇总常用 App 和小时分布。
5. 汇总任务推进和阻力。
6. 汇总 App 切换、高质量专注块、最容易偏离时段、长期未完成任务和任务打断次数。
7. 生成可执行行动建议。
8. 根据未完成任务和专注情况生成明日建议。

### 4.3 社交监督流程

1. 桌面端生成邀请链接。
2. 第二台设备或外部用户通过浏览器打开链接。
3. 输入邀请码和昵称加入会话；同一来源 10 分钟内 5 次错误邀请码尝试后会被短时间阻断，服务重启后窗口内阻断仍生效。
4. 双方可以发送文本、图片、文件、语音消息和宠物动图；宠物动图包括摸摸、喂食、专注、跳舞、休息、完成庆祝、哈哈开心、伸展、补水、冥想、复盘阅读、加油好棒、早安挥手、抱抱安慰、惊讶、哭哭、生气、忙碌、OK、想你和通话陪伴，素材来自短发毛衣、浅色洞洞鞋小人形象的独立图片包。
5. 可按社交共享档位同步在线状态、状态枚举、状态摘要或屏幕分析摘要。
6. 桌面端可以撤销某个好友的外部会话 token；撤销后旧 token 失效，好友和历史消息保留。
7. 首次通话前确认 WebRTC 网络提示。
8. 可通过 WebRTC 进行实时语音或视频通话。

控制端 / 被控制端边界：

- 控制端是 owner，本机可查看被控制端提交的完整活动快照和屏幕分析结果。
- 被控制端是 peer，公开下载包只提供加入会话、文字/媒体消息、语音消息和 WebRTC 语音/视频。
- 被控制端的 `/api/state` 中 `activities` 恒为空对象，`activityLog` 恒为空数组。
- 被控制端不会收到 WebSocket `activity` 事件。
- 被控制端消息列表里的 `messages[*].activity` 恒为 `null`，不能通过消息回读对方或自己的截图分析。
- 被控制端发布包不渲染“对方正在做什么”或截图分析面板。
- 公开发布使用 `npm run release:mac:controlled` 生成被控制端 DMG/ZIP/manifest；完整桌面端保留为本地控制端/开发端。

## 5. 权限与隐私边界

默认采集内容：

- 前台 App 名称。
- 窗口标题。
- 当前任务摘要。
- 分类状态。
- 时间。

默认不采集内容：

- 键盘输入。
- 浏览器历史。
- 网页正文。
- 邮件正文。
- 聊天全文。
- 屏幕截图。

只有手动触发屏幕检查或开启定时屏幕检查后，才会截取屏幕缩略图并发送给 StepFun 或用户配置的 LLM endpoint。用户需要自行确认该 endpoint 的数据策略。

社交监督的活动与截图分析只进入控制端本机视图。被控制端不会从 `/api/state`、WebSocket `activity` 事件或消息列表回读对方或自己的截图分析结果；出站过滤在聊天服务端执行。

macOS 需要辅助功能权限读取前台窗口；屏幕检查还需要屏幕录制权限。

## 6. 运行与维护

### 6.1 启动桌面端

```bash
npm start
```

### 6.2 仅启动聊天服务

```bash
npm run chat:serve
```

### 6.3 测试与检查

```bash
npm test
npm run check
npm run diagnostics
npm run diagnostics:bundle
npm run release:preflight
npm run verify:pet-render
```

`npm run release:preflight` 默认打印发布前检查清单，不执行长耗时命令。需要执行本机基础 gate 时使用：

```bash
npm run release:preflight -- --run fast
```

CLI 参数同时支持等号写法，例如 `npm run release:preflight -- --run=fast` 和 `node scripts/release-preflight.js --check=error-log`。

`npm run diagnostics` 会输出包含运行日志等级计数的安全摘要。`npm run diagnostics:bundle` 会生成只包含 `summary.json` 和 `manifest.md` 的安全诊断包，默认写入 `output/diagnostics/`，并在写入后只保留最新 20 个标准命名诊断包目录。发布前 fast 预检不会直接打印完整诊断摘要，而是通过 `node scripts/release-preflight.js --check diagnostics-summary-output` 生成并扫描摘要，只输出是否生成、JSON 是否有效、schema 是否完整、`summaryGeneratedAtValid`、缺失顶层区块、未知顶层字段数量和问题标签；`summaryGeneratedAtValid` 要求 `summary.generatedAt` 是可解析时间，不可解析时 schema 校验失败。若出现 JSON secret 字段和值组合，只返回 `json-secret-field` 标签；若出现 `apiKey=...`、`authToken=...`、`sessionToken=...` 或 `inviteCode=...` 等文本 secret key 赋值，只返回 `secret-assignment` 标签；若出现 raw 任务、聊天、窗口、内部上下文字段（`currentTask`、`frontmost`、`sourceName`）、错误内部键 `rawIssueKey`、截图、endpoint 或 model 等字段名，只返回 `json-raw-field` 标签；若出现普通 http/https URL 值，只返回 `url` 标签；若出现 WebSocket URL，只返回 `websocket-url` 标签，不回显字段名或字段值。

`release:preflight` 的 fast 模式会顺序执行 `npm test`、`npm run check`、`node scripts/release-preflight.js --check diagnostics-summary-output`、`npm run diagnostics:bundle -- --output-dir output/diagnostics/preflight`、`node scripts/release-preflight.js --check diagnostics-bundle-output`、`node scripts/release-preflight.js --check package-scripts`、`node scripts/release-preflight.js --check chat-backend-deploy`、`node scripts/release-preflight.js --check docs-boundary`、`node scripts/release-preflight.js --check optimization-plan` 和 `node scripts/release-preflight.js --check error-log`。诊断包产物 gate 会确认最新预检诊断包只包含 `summary.json` 和 `manifest.md`，`summary.json` 可解析且顶层 schema 完整，manifest 引用了 summary 和当前包名，`summary.generatedAt` 能推导出当前包名，并对 `summary.json` 和 `manifest.md` 做边界扫描；若发现本地绝对路径、Bearer token、env secret、secret key 赋值、图片 data URL、TURN URL、普通 http/https URL、WebSocket URL、JSON secret 字段和值组合或 JSON raw 字段名，只输出问题标签和布尔检查结果，不回显诊断内容、未知顶层字段名或敏感值。打包脚本 gate 会静态确认打包、签名、验证脚本入口、文件和 `npm run check` 语法检查命令覆盖一致；只把路径写进 `echo` 或普通文本不会视为覆盖，不执行真实打包、签名或公证。社交后端容器部署 gate 会静态确认 `Dockerfile` 使用生产依赖安装、配置容器监听和持久化数据目录、包含 `/healthz` healthcheck、通过 `npm run chat:serve` 启动，且 Node 入口接入 chat service、处理 `SIGTERM` 关闭，并且启动日志不会通过 `console.log/error/warn/info/debug/trace(...)` 直接打印完整 `chatService.publicState()`（包括非首个 console 参数、对象包装和模板字符串输出）、声明初始化或后续赋值变量中转后的完整 owner 状态及其二次别名链（包括非首个 console 参数、对象包装和模板字符串输出）、`publicState` 变量敏感属性及其声明初始化、后续赋值或二次别名链得到的派生别名变量（包括非首个 console 参数、对象包装和模板字符串输出），或从 owner 状态解构出的敏感字段及其派生别名链（包括非首个 console 参数、对象包装和模板字符串输出），只允许 `hasInviteUrl` 这类布尔摘要；也不会输出 `inviteUrl:`、`inviteCode:`、`authToken:` 或 `sessionToken:` 字段，也不会通过 `console.error/warn/log/info/debug/trace(...)` 在任意参数位置或对象包装中输出固定异常变量名，或输出 `uncaughtException`、`unhandledRejection`、`warning`、`rejectionHandled` 回调参数名对应的未清洗对象；该异常日志检测会平衡解析完整 console 参数列表并逐参数判断，允许单个 `sanitizeLogText(...)` 参数，但会阻断同一调用中混合清洗提示文本与原始异常对象。文档边界 gate 会确认必需边界文档存在，且本轮排除项没有以中文、camelCase、snake_case 或 kebab-case 等常见命名形态进入源码实现；还会检查社交安全边界文档保留服务重启持久化与多实例全局限流 caveat，并阻断把已实现的重启持久化能力继续列为未覆盖风险。优化计划 gate 会确认必需章节和验收状态段完整、每个验收状态段至少有一条列表项，空验收段只返回 `emptyAcceptanceSections` 的章节编号；验收项没有“未完成”“部分完成”“待完成”“进行中”“尚未完成”“未达成”“未通过”等未达成状态；这些状态即使写在冒号、括号、破折号或空格后也会被识别，检查输出只包含章节编号和行号。错误日志 gate 会确认 `docs/errorThing.md` 存在、跳过顶部 `## [时间]` 模板、校验全部真实记录字段完整、最新状态为已解决，且不存在未被后续同问题已解决记录关闭的开放未解决项；QA 已通过时的 Electron/Chromium GPU 退出噪声作为非阻断观察项处理。检查输出不回显错误正文。完整发布仍需要按清单执行桌面渲染 QA、对应平台打包、签名校验和 macOS 公证。

`release:preflight` 的 full 模式在 fast gate 之后继续执行 `npm run verify:pet-render` 和 `npm run test:screen-pipeline`。后者用于发布前确认手动屏幕分析、结构化 LLM 输出和复盘 LLM 串联；运行时需要屏幕检查和复盘 LLM 配置可用。

`release:preflight` 的 package 模式在 macOS 上包含 `npm run package:mac`、`npm run sign:mac && npm run verify:mac` 和 `npm run notarize:mac && npm run verify:mac`；公证需要 Apple ID、Team ID 和 App 专用密码，staple 后会再次执行 Gatekeeper/签名验证。公开分发应使用被控制端 release：部署 HTTPS 客户端并设置 `REMOTE_CLIENT_URL` 后单独执行 `npm run release:mac:controlled`，其中 URL 必须指向 `/client` 或 `/client/...` 路径；打包出的客户端只向与该 URL 精确同源的页面授予麦克风/摄像头权限，内嵌导航只保留同源 `/client` 页面，跳出范围的 http/https 导航交给系统浏览器，非 http/https 外链会被拒绝打开；该步骤不随 `--run package` 自动运行。`npm run package:mac:controlled` 仍可单独生成 `.app`，`npm run package:mac:remote-client` 作为同一打包器的兼容别名保留。Windows package 模式包含 `npm run package:win`，需要在 Windows 环境执行。

### 6.4 打包

macOS：

```bash
npm run package:mac
```

Windows：

```bash
npm run package:win
```

## 7. 错误记录机制

系统要求在发生异常、错误或关键问题时追加记录到：

```text
docs/errorThing.md
```

记录格式：

```text
## [时间]
- 问题描述：
- 发生位置：
- 上下文：
- 可能原因：
- 解决状态：（未解决 / 已解决）
```

该机制用于形成可追溯的问题记录体系，便于后续定位和维护。

## 8. 数据存储可靠性

关键 JSON 文件包括 `tasks.json`、`settings.json` 和 `chat-state.json`。

- 写入时先写同目录临时文件，再通过 `rename` 替换目标文件。
- 替换已有关键 JSON 前会生成 `.backup-*` 自动备份，每类最多保留 5 份。
- 读取到损坏 JSON 时，会先保留 `.corrupt-*` 副本，再恢复可运行状态。
- `tasks.json` 使用 schema version 2，`settings.json` 和 `chat-state.json` 使用 schema version 1。
- `migrateTasksState()`、`migrateSettingsState()` 和 `migrateChatState()` 提供显式迁移入口，读取旧 payload 时会升级 schema 并保留未知顶层字段。
- 诊断摘要只输出自动备份数量和最新备份文件名，不输出备份目录路径或备份内容。

## 9. 当前系统边界

- 当前状态判断以 App、窗口标题、任务文本和可选 LLM 分析为主，不读取具体网页正文。
- 屏幕检查依赖外部 LLM 配置和系统屏幕录制权限。
- WebRTC 跨复杂网络时通常需要 STUN/TURN；系统会在诊断摘要中标记当前是否检测到 TURN，但不会主动探测网络连通性。
- 社交聊天服务默认是单进程本地服务，云端部署时需要额外考虑持久化、认证、限流和反向代理。
- 邀请码失败尝试限流会写入 `chat-state.json`，来源 key 只保存 SHA-256 哈希；默认按 socket 地址识别来源，只有配置 `FOCUS_PET_CHAT_TRUST_PROXY=true` 时才信任 `x-forwarded-for`。单进程服务重启后窗口内阻断仍有效，多实例云部署仍需要在网关、反向代理或共享存储层补充全局限流。
- 新 peer session 会绑定浏览器本地随机 `deviceId`；服务端只保存 `deviceIdHash`。旧版本历史 session 可能没有绑定字段，会保留到过期或被移除。
- 撤销 peer session 只让外部设备重新加入，不等同于删除好友、清空聊天或暂停社交共享。
- 媒体上传会在写盘前做轻量内容嗅探，但不执行病毒扫描、宏检测或压缩包深度扫描。
- 当前目录未初始化 Git 时，无法使用 Git 状态和差异命令进行变更追踪。
