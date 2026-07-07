# Focus Pet 数据存储版本化与恢复

## 1. 范围

本文记录当前 Focus Pet 对关键 JSON 文件的写入、版本化和损坏恢复策略。

覆盖文件：

- `tasks.json`
- `settings.json`
- `chat-state.json`

不覆盖：

- `activity.jsonl`：JSONL 活动日志由 `appendActivityLog()` 和 `appendJsonlWithRetention()` 负责保留周期和原子裁剪，不纳入关键 JSON schema/version 机制。
- `screen-monitor.jsonl`：屏幕检查 JSONL 日志由 `appendJsonlWithRetention()` 负责保留周期和原子裁剪，不纳入关键 JSON schema/version 机制。
- `focus-pet.log`：分级运行日志由 `writeRuntimeLog()` 和 `appendJsonlWithRetention()` 负责保留周期和原子裁剪，不纳入关键 JSON schema/version 机制。
- 媒体文件。
- Markdown 任务导出文件 `today_tasks.md`。

## 2. 共享 JSON 存储工具

实现位置：`src/json-storage.js`。

能力：

- `writeJsonAtomic(filePath, value, options)`：先写入同目录临时文件，再 `rename` 到目标路径。
- 当 `options.maxBackups > 0` 时，替换已有文件前会自动复制一份 `.backup-*` 快照，并按 `maxBackups` 轮转清理旧快照。
- `readJsonWithRecovery(filePath, options)`：读取 JSON 并执行 normalize；如果解析或 normalize 失败，会先保留损坏文件副本，再写入 fallback。
- `migrateTasksState(payload)`、`migrateSettingsState(payload)`、`migrateChatState(payload)`：三个关键 JSON 的显式迁移入口。
- 自动备份命名：`<label>.backup-<timestamp>.json`。
- 损坏备份命名：`<label>.corrupt-<timestamp>.json`。
- 临时文件写入失败时会清理 `.tmp` 文件。

## 2.1 本地 JSONL 日志保留周期

`activity.jsonl`、`screen-monitor.jsonl` 和 `focus-pet.log` 默认保留 30 天，可在高级设置中配置为 1-365 天。每次追加新的活动样本、屏幕检查样本或运行日志条目时，系统会读取现有日志、保留窗口内记录、追加新记录，然后写入同目录 `.tmp` 文件并 `rename` 到目标路径。

时间字段缺失或无法解析的历史 JSONL 行会保留，避免旧格式或手工导入数据被静默删除；活动日志和屏幕检查日志中无法解析为 JSON 的行仍会被读取逻辑忽略。运行日志会额外兼容旧的 `[time] message` 文本行，窗口内旧格式行会继续保留并在诊断中标记为 `legacy`。

## 3. 原子写策略

关键 JSON 写入不再直接覆盖目标文件。

写入流程：

1. 确保目标目录存在。
2. 如果目标文件已存在且写入方启用了自动备份，先复制现有文件为 `.backup-*`。
3. 自动备份数量超过上限时删除最旧的备份。
4. 在目标目录写入隐藏临时文件。
5. 写入完整 JSON 内容。
6. 使用 `rename` 替换目标文件。
7. 写入失败时删除临时文件并抛出错误。

这样可以降低进程中断、磁盘短写或异常退出导致半文件的概率。

## 4. 自动备份策略

关键 JSON 文件在正常替换已有文件前会保留旧版本快照。

当前接入：

- `tasks.json`：最多保留 5 份 `tasks.backup-*.json`。
- `settings.json`：最多保留 5 份 `settings.backup-*.json`。
- `chat-state.json`：最多保留 5 份 `chat-state.backup-*.json`。

自动备份只保存 JSON 文件本身，不包含截图、媒体文件、运行日志或诊断包。首次创建文件时不会生成备份；只有替换已有文件时才会生成。

## 5. 损坏恢复策略

读取 JSON 时，如果遇到以下情况，会进入恢复路径：

- JSON 语法错误。
- normalize 过程抛错。

恢复流程：

1. 将原文件复制为 `.corrupt-<timestamp>.json` 备份。
2. 使用 fallback 状态恢复可运行文件。
3. 返回恢复后的状态。

当前不会静默删除损坏文件；备份会留在同目录，便于后续诊断。

## 6. 各存储文件现状

### 6.1 `tasks.json`

写入位置：`src/task-store.js`。

当前 schema：

```json
{
  "version": 2,
  "tasks": [
    {
      "id": "",
      "text": "",
      "description": "",
      "done": false,
      "priority": "medium",
      "dueDate": "",
      "estimatedMinutes": 0,
      "energyLevel": "medium",
      "contextTags": [],
      "relatedApps": [],
      "relatedKeywords": [],
      "blockedBy": "",
      "nextAction": "",
      "pinned": false,
      "selected": false,
      "createdAt": "",
      "updatedAt": "",
      "completedAt": null,
      "order": 0
    }
  ]
}
```

恢复行为：

- 正常替换已有 `tasks.json` 前会生成 `tasks.backup-*.json`，最多保留 5 份。
- `tasks.json` 损坏时，会生成 `tasks.corrupt-*.json`。
- 如果存在可用 `today_tasks.md`，会从 Markdown 迁移。
- 如果没有可用 Markdown，会恢复默认任务。
- 旧版 `version: 1` 任务会在读取后规范化并重写为 `version: 2`。
- Markdown 兼容视图只保留标题、完成状态、优先级和截止日期；增强字段以 `tasks.json` 为准。

### 6.2 `settings.json`

写入位置：`src/settings-store.js`。

当前行为：

- 文件内容保持扁平 settings 结构，避免破坏现有读取路径。
- 当前 schema version 为 `version: 1`。
- 读取时会执行 `migrateSettingsState()` 和 `normalizeSettings()`。
- 正常替换已有 `settings.json` 前会生成 `settings.backup-*.json`，最多保留 5 份。
- 损坏时生成 `settings.corrupt-*.json`，并恢复默认设置。

### 6.3 `chat-state.json`

写入位置：`src/chat-service.js`。

当前 schema：

```json
{
  "version": 1,
  "authToken": "",
  "inviteCode": "",
  "inviteCreatedAt": "",
  "inviteExpiresAt": "",
  "self": {},
  "friends": [],
  "sessions": [],
  "messages": [],
  "activities": {},
  "activityLog": [],
  "settings": {}
}
```

恢复行为：

- 正常替换已有 `chat-state.json` 前会生成 `chat-state.backup-*.json`，最多保留 5 份。
- `chat-state.json` 损坏时，会生成 `chat-state.corrupt-*.json`。
- 恢复默认聊天状态。
- 新状态会带 `version: 1`。
- 桌面端和外部端的公开 state 也会带 `version`，用于后续诊断和迁移判断。
- 迁移 `self` 时会对非对象、空 `id` 或空 `name` 回填默认本机身份，同时保留 `self` 上的未知字段，避免 owner 身份为空。
- 迁移 `friends` 时会跳过 `null`、字符串、缺少 `id` 的异常好友项，并归一化保留好友的名称、在线状态、未读数和最近在线时间，避免好友列表坏项进入 owner/peer 状态。
- 迁移 `sessions` 时会跳过 `null`、字符串、缺少 `token/peerId` 的异常会话项，并归一化保留 session 的名称、时间、过期时间和设备绑定哈希；旧 session 缺少 `expiresAt` 但带 `createdAt` 时仍会补齐默认 30 天过期时间。
- 迁移 `activityLog` 时会跳过 `null`、字符串、缺少来源等无法归一化的异常活动项，避免旧数据或局部损坏阻断聊天状态恢复。
- 迁移 `messages` 时会跳过 `null`、字符串、缺少 `from/to` 的异常消息项，并归一化保留消息的文本、媒体、活动、发送状态和时间字段，避免旧聊天记录中的坏项阻断 owner/peer 状态构建。
- 迁移 `callAuditLog` 时会跳过 `null`、字符串、未知事件、缺少 `from/to/callId` 的异常审计项，并只保留事件、双方 id、callId、mode、送达状态、送达客户端数量和时间，不保留 SDP 或 ICE candidate。

## 7. 迁移入口

当前已具备 schema version 和显式迁移入口。

当前入口：

- `migrateTasksState(payload)`：将旧任务 payload 升级到 `TASK_SCHEMA_VERSION`，并允许读取旧版 `tasks` 数组。
- `migrateSettingsState(payload)`：将设置 payload 升级到 `version: 1`，同时执行设置值归一化。
- `migrateChatState(payload)`：将聊天状态升级到 `CHAT_STATE_VERSION`，补齐本机身份、邀请码/session/好友/消息/活动日志/通话审计等默认字段，并跳过无法归一化的历史异常项。

迁移入口遵循：

- 先利用写前自动备份保留原文件，再迁移。
- 迁移失败时保留原文件并恢复 fallback。
- 迁移过程不得丢弃未知顶层字段，未知字段会保留到下一版本确认。

## 8. 验证

当前自动化测试覆盖：

- JSON 原子写后不残留 `.tmp` 文件。
- 替换已有 JSON 前会生成 `.backup-*` 自动备份。
- 自动备份会按上限轮转，避免无限增长。
- 损坏 JSON 会生成 `.corrupt-*.json` 备份。
- 任务、设置和聊天状态均有显式迁移入口。
- 迁移入口会升级 schema 并保留未知顶层字段。
- 诊断摘要会统计 `.backup-*` 自动备份数量和最新文件名，但不输出目录路径或备份内容。
- `tasks.json` 损坏后可恢复可用任务状态，并写回 `version: 2`。
- `settings.json` 损坏后可恢复默认设置。
- chat state 会携带 `version: 1`。
- chat state 迁移会归一化 `self`，跳过无法归一化的 `friends`、`sessions`、`activityLog`、`messages` 和 `callAuditLog` 历史项，保留有效本机身份、好友、会话、聊天消息与通话生命周期审计并防止坏数据阻断状态读取。
