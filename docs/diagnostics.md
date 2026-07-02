# Focus Pet 诊断摘要

## 1. 范围

诊断摘要用于快速判断 Focus Pet 的运行状态、关键配置、权限状态、最近状态判断原因、聊天服务状态、存储健康、运行日志等级和最近错误概览。

当前实现支持两种形式：

- 诊断摘要：直接在终端、设置页或 IPC 中查看 JSON 摘要。
- 安全诊断包：写出 `summary.json` 和 `manifest.md`，用于发布前或问题排查时归档。

明确不包含：

- 聊天正文。
- 任务全文。
- 前台 App 名称、窗口标题原文、原始状态判断 reason。
- 原始运行日志全文。
- 截图、截图 data URL 或媒体内容。
- LLM API key、session token、邀请码。
- LLM endpoint/model 具体值。
- ICE/TURN 服务器地址、TURN 用户名或 TURN 凭据。

## 2. 入口

命令行入口：

```bash
npm run diagnostics
```

发布前诊断摘要输出校验：

```bash
node scripts/release-preflight.js --check diagnostics-summary-output
```

该 gate 会生成运行时诊断摘要，并对序列化后的摘要做顶层 schema 校验和标签化边界扫描；输出只包含是否生成、JSON 是否有效、`summarySchemaValid`、`summaryGeneratedAtValid`、缺失顶层区块、未知顶层字段数量和问题标签，不回显诊断摘要正文、未知字段名或未知字段内容。`summaryGeneratedAtValid` 要求 `summary.generatedAt` 是可解析时间；不可解析时 `summarySchemaValid` 也会失败。若序列化 JSON 内部出现 secret 字段名和值组合，检查结果只返回 `json-secret-field` 标签；若出现 `apiKey=...`、`authToken=...`、`sessionToken=...` 或 `inviteCode=...` 等文本 secret key 赋值，只返回 `secret-assignment` 标签；若出现 raw 任务、聊天、窗口、内部上下文字段（`currentTask`、`frontmost`、`sourceName`）、错误内部键 `rawIssueKey`、截图、endpoint 或 model 等字段名，只返回 `json-raw-field` 标签；若出现普通 http/https URL 值，只返回 `url` 标签；若出现 WebSocket URL，只返回 `websocket-url` 标签，不返回字段名或字段值。

诊断包入口：

```bash
npm run diagnostics:bundle
```

发布前诊断包产物校验：

```bash
node scripts/release-preflight.js --check diagnostics-bundle-output
```

该 gate 会检查最新预检诊断包只包含 `summary.json` 和 `manifest.md`、`summary.json` 可解析且顶层 schema 完整、`summaryGeneratedAtValid` 为 true、manifest 引用 summary 和当前包名，且 `summary.generatedAt` 能推导出当前包名；同时对 `summary.json` 与 `manifest.md` 做标签化边界扫描。若任一文件出现本地绝对路径、Bearer token、env secret、secret key 赋值、图片 data URL、TURN URL、普通 http/https URL、WebSocket URL、JSON secret 字段和值组合或 JSON raw 字段名，检查结果只返回问题标签、`summarySchemaValid`、`summaryGeneratedAtValid`、`summaryMissingTopLevelKeys`、`summaryUnexpectedTopLevelKeyCount`、`manifestReferencesBundle`、`summaryMatchesBundleName` 等安全结果，不返回原始内容或敏感值。

默认输出目录：

```text
output/diagnostics/focus-pet-diagnostics-YYYYMMDD-HHMMSS/
```

诊断包输出目录会自动轮转：每次写出新诊断包后，只保留同一输出目录下最新 20 个匹配 `focus-pet-diagnostics-YYYYMMDD-HHMMSS` 命名的诊断包目录；手工备注、临时目录或其他非匹配目录不会被清理。程序化调用 `writeDiagnosticsBundle()` 时可通过 `maxBundles` 覆盖保留数量，并会返回 `removedBundleCount` 与 `retainedBundleCount` 便于发布前检查记录实际清理结果。

Electron IPC：

```js
window.focusPet.getDiagnostics()
```

主进程 IPC channel：

```text
app:get-diagnostics
```

## 3. 输出结构

摘要结构版本：

```json
{
  "schemaVersion": 1,
  "version": "1.0.0",
  "generatedAt": "2026-06-30T00:00:00.000Z",
  "platform": "darwin",
  "permissions": {},
  "settings": {},
  "tasks": {},
  "activity": {},
  "chat": {},
  "storage": {},
  "logs": {},
  "recentErrors": []
}
```

## 4. 字段说明

### 4.1 `permissions`

包含平台、检查时间和权限步骤状态。

示例：

```json
{
  "platform": "darwin",
  "checkedAt": "2026-06-30T00:00:00.000Z",
  "steps": {
    "accessibility": "granted",
    "screenRecording": "blocked"
  }
}
```

### 4.2 `settings`

只输出配置是否存在和规则数量，不输出 endpoint、model 或密钥。

包括：

- 自动提醒开关。
- 冷却时间。
- 本地 JSONL 日志保留天数。
- 媒体大小上限。
- LLM 云端请求模式。
- 规则数量。
- 屏幕检查是否开启、provider、是否本地 provider、endpoint/model 是否已配置、API key 是否必需以及是否已配置。
- 复盘 LLM 是否开启、provider、是否本地 provider、endpoint/model 是否已配置、API key 是否必需以及是否已配置。
- 更新源是否配置。

诊断摘要只输出 provider、本地/云端状态和 API key 是否必需，不输出 endpoint、model 原文。即使使用 Ollama 或本机 OpenAI-compatible endpoint，也不会输出端口、路径或模型名。

### 4.3 `tasks`

只输出任务计数：

- 总数。
- 已完成数。
- 未完成数。
- 未完成高优先级数。
- 今天或更早截止的未完成任务数。

不会输出任务标题或任务正文。

### 4.4 `activity`

从本机 `activity.jsonl` 读取最近状态判断记录，输出安全摘要：

- `totalSamples`：活动日志样本总数。
- `statusCounts`：各状态数量。
- `recentDecisions`：最近最多 5 条状态判断摘要。

本地日志默认保留 30 天，可在高级设置中配置 1-365 天；诊断摘要只输出保留天数和安全统计，不输出原始活动日志、屏幕检查日志内容或运行日志全文。

`recentDecisions` 只包含：

- `time`：采样时间。
- `status`：状态枚举。
- `reasonCategory`：固定原因分类，例如 `task-context`、`focus-rule`、`study-rule`、`game-rule`、`distraction-rule`、`permission` 或 `unknown-rule`。
- `reasonSummary`：固定说明文案。
- `confidence`：0 到 1 的置信度；无置信度时为 `null`。
- `appKnown`：是否有前台 App 信息。
- `titleKnown`：是否有窗口标题信息。
- `taskLinked`：是否有关联当前任务。

该摘要不输出前台 App 名称、窗口标题原文、当前任务文本、状态判断原始 reason 或屏幕内容。

### 4.5 `chat`

只输出聊天状态计数和 WebRTC 配置摘要：

- 服务是否可用。
- 端口。
- 当前客户端数量。
- chat state version。
- 好友数。
- session 数。
- 消息数。
- activity log 数。
- call audit log 数。
- WebSocket 连接与 Origin 策略摘要。
- WebRTC ICE/TURN 配置摘要。

不会输出消息正文、好友聊天内容、session token、邀请码或通话审计详情。

`callAuditLog` 只输出条数。审计日志本体用于服务端追踪通话生命周期，条目只记录事件类型、from、to、callId、mode、送达状态、送达客户端数量和时间；诊断摘要不输出这些条目的具体内容。

`chat.websocket` 只包含：

- `enabled`：聊天服务是否支持 WebSocket。
- `active`：当前进程是否已经创建 WebSocket server。
- `clients`：当前 WebSocket 客户端数量。
- `originPolicy`：Origin 策略，可能是 `same-origin-only` 或 `same-origin-plus-configured`。
- `allowedOriginsConfigured`：是否配置了额外允许 Origin。
- `configuredAllowedOriginCount`：额外允许 Origin 数量。
- `acceptsNoOrigin`：是否允许无 Origin 的本地或非浏览器请求。
- `allowsFileOrigin`：是否允许 Electron 桌面端 `file://` Origin。
- `corsWildcard`：CORS 是否使用通配。

该摘要不输出 `FOCUS_PET_CHAT_ALLOWED_ORIGINS` 的具体 Origin，不输出 WebSocket URL、token 或 peer id。

`chat.rtc` 只包含：

- `configured`：是否配置了 `FOCUS_PET_RTC_ICE_SERVERS`。
- `usingDefault`：是否正在使用默认 STUN。
- `source`：配置来源，可能是 `default-stun`、`env` 或 `unknown`。
- `serverCount`：ICE URL 数量。
- `stunCount`：STUN URL 数量。
- `turnCount`：TURN URL 数量。
- `hasStun`：是否检测到 STUN。
- `hasTurn`：是否检测到 TURN。
- `requiresTurn`：当前是否建议补 TURN。
- `summary`：固定状态文案。
- `guidance`：固定配置引导。

该摘要不输出 ICE/TURN URL、TURN username、TURN credential，也不透传健康对象里的自定义 `summary` 或 `guidance`。

### 4.6 `storage`

输出关键 JSON 文件是否存在，以及 `.corrupt-*.json` 损坏备份和 `.backup-*.json` 自动备份数量。

包括：

- `tasks.json`
- `settings.json`
- `chat-state.json`
- corrupt backup 数量。
- 最近一个 corrupt backup 文件名。
- automatic backup 数量。
- 最近一个 automatic backup 文件名。

备份字段只输出文件名，不输出目录路径或备份内容。

### 4.7 `logs`

从默认运行日志读取等级化摘要，默认文件为：

```text
~/.hermes/focus-watchdog/focus-pet.log
```

输出内容：

- `totalEntries`：可解析日志条数。
- `levelCounts`：`debug`、`info`、`warn`、`error` 计数。
- `recent`：最近最多 5 条安全摘要。

`recent` 只包含：

- `time`：日志时间。
- `level`：日志等级。
- `scope`：日志来源，例如 `main` 或 `supervisor`。
- `message`：清洗后的短消息。
- `legacy`：是否来自旧格式日志。

主进程和启动监督脚本会写入 JSONL 格式的分级日志。`focus-pet.log` 跟随同一个本地日志保留周期，默认保留 30 天；诊断读取时只统计当前保留文件，兼容旧的 `[time] message` 文本行，并按 `info` 级别归类为 `legacy`。

日志写入、日志摘要读取和 `appendErrorThing()` 写入错误日志前都会对 Bearer token、连续长 token、带长数字段的 token、env secret 赋值、`apiKey`/`authToken`/`sessionToken`/`inviteCode` 等 secret key 赋值、URL、图片 data URL、当前任务/前台上下文键值和本地绝对路径（含 Windows drive-letter 路径）做替换，同时保留 `diagnostics-bundle-output`、`release-preflight`、`runDiagnosticsBundleOutputCheck` 这类可读技术标识，避免降低排障可解释性。`currentTask`、`frontmost`、`screenEndpoint`、`reviewEndpoint`、`endpoint` 等上下文键只保留键名和值已遮盖；本地绝对路径会显示为 `[local-path]`。诊断包不会包含原始运行日志文件。发布前诊断包产物 gate 还会扫描 `summary.json` 和 `manifest.md` 是否意外包含本地绝对路径、Bearer token、env secret、图片 data URL、TURN URL、普通 http/https URL 或 WebSocket URL，输出仅保留标签。

### 4.8 `recentErrors`

从 `docs/errorThing.md` 读取最近错误摘要。

只保留：

- 时间。
- 问题描述。
- 发生位置。
- 解决状态。
- `closedByLater`：该历史“未解决”项是否已被后续同问题“已解决”记录关闭。
- `open`：该条记录是否仍代表开放问题。

会对 Bearer token、连续长 token、带长数字段的 token、env secret 赋值、`apiKey`/`authToken`/`sessionToken`/`inviteCode` 等 secret key 赋值、URL、图片 data URL、当前任务/前台上下文键值和本地绝对路径（含 Windows drive-letter 路径）做基本替换；普通短横线技术标识和无数字的典型 camelCase 函数名会保留，用于定位 gate、脚本或模块名称。

`closedByLater` 的判定使用内部完整“问题描述 + 发生位置”key，避免被摘要截断导致两个长描述前缀相同的问题互相误闭环；该内部 key 不会写入诊断输出。

## 5. 实现位置

- 诊断摘要模块：`src/diagnostics.js`
- 分级运行日志模块：`src/runtime-logger.js`
- 命令行脚本：`scripts/diagnostics.js`
- 诊断包脚本：`scripts/diagnostics-bundle.js`
- 主进程 IPC：`src/main.js`
- preload 暴露：`src/preload.js`

## 6. 当前限制

- 命令行权限状态无法调用 Electron 的 macOS 权限 API，因此只给出平台默认步骤状态。
- 诊断包当前是目录形式，不做 zip 压缩。
- 诊断包输出目录默认只轮转匹配标准命名的最新 20 个包；如果外部工具改名或移动目录，系统不会主动处理。
- 当前不做网络连通性主动探测，只报告 LLM 配置是否存在以及 API key 是否必需；主动连通性测试仍由设置页 LLM 自检触发。
- 最近状态判断只输出固定原因分类和是否存在 App/标题/任务关联，不输出原始证据详情。
- 运行日志摘要只按当前日志文件统计；如果日志文件被外部轮转或清理，历史计数不会保留。
