# Focus Pet 任务模型与当前任务选择

## 1. 范围

本文记录当前任务系统的数据字段、字段清洗、当前任务选择规则和状态判断接入点。

不包含：

- 隐私模式。
- 敏感 App 列表。
- 窗口标题脱敏。
- 用户纠错机制。

## 2. 存储位置

任务主数据保存在：

```text
~/.hermes/focus-watchdog/tasks.json
```

兼容导入/导出的 Markdown 视图保存在：

```text
~/.hermes/focus-watchdog/today_tasks.md
```

Markdown 只表达标题、完成状态、优先级和截止日期。增强字段以 `tasks.json` 为准。

## 3. Schema

当前 `tasks.json` schema version 为 `2`。

任务字段：

- `id`：任务 ID。
- `text`：任务标题。
- `description`：任务描述。
- `done`：完成状态。
- `priority`：`low`、`medium`、`high`。
- `dueDate`：`YYYY-MM-DD` 截止日期。
- `estimatedMinutes`：预计分钟数，最大 480。
- `energyLevel`：`low`、`medium`、`high`。
- `contextTags`：任务标签。
- `relatedApps`：与任务相关的 App 名称。
- `relatedKeywords`：与任务相关的关键词。
- `focusSceneTemplate`：专注场景模板 ID，例如 `coding`。
- `focusSceneLabel`：专注场景展示名，例如 `写代码`。
- `reminderMinutes`：该场景建议提醒间隔分钟数，最大 240。
- `petAnimationPreference`：该场景建议宠物动画偏好，例如 `work`、`study` 或 `rest`。
- `reviewMetrics`：该场景建议复盘指标。
- `blockedBy`：阻塞原因；非空时不会被自动选为当前任务。
- `nextAction`：下一步动作。
- `pinned`：置顶标记。
- `selected`：手动选中标记；桌面任务面板可将某个未完成、未阻塞任务设为当前任务。
- `createdAt`：创建时间。
- `updatedAt`：最近更新时间。
- `completedAt`：完成时间，未完成时为 `null`。
- `order`：列表顺序。

## 4. 字段清洗

实现位置：`src/task-store.js`。

- 文本字段会压缩空白并截断到对应长度。
- `priority` 不合法时回落到 `medium`。
- `energyLevel` 不合法时回落到 `medium`。
- `estimatedMinutes` 小于等于 0 时为 0，大于 480 时截断到 480。
- `reminderMinutes` 小于等于 0 时为 0，大于 240 时截断到 240。
- `contextTags`、`relatedApps`、`relatedKeywords` 会移除空值并去重。
- `focusSceneTemplate`、`focusSceneLabel`、`petAnimationPreference` 会压缩空白并截断。
- `reviewMetrics` 会移除空值并去重。
- 旧版 `version: 1` 任务会在读取后规范化并重写为 `version: 2`。

## 5. 专注场景模板

实现位置：`src/focus-scene-templates.js`。

新增任务时，桌面端会在任务输入区展示场景下拉框。选择模板后，`applyFocusSceneTemplate()` 会把模板合并到任务输入中，再通过原有 `addTask` 流程保存。

内置模板：

- `coding`：写代码。
- `paper`：论文。
- `exam`：备考。
- `meeting`：会议。
- `reading`：阅读。
- `creation`：创作。
- `light-rest`：轻休息。

每个模板包含：

- `appRules`：场景相关 App。
- `keywordRules`：场景相关关键词。
- `reminderMinutes`：建议提醒间隔。
- `petAnimationPreference`：宠物动画偏好。
- `reviewMetrics`：复盘指标。
- `taskDefaults`：预计时间、精力等级、标签和下一步动作等默认任务字段。

合并规则：

- 用户已经输入的任务标题、优先级、截止日期和显式字段优先。
- 模板补充 `contextTags`、`relatedApps`、`relatedKeywords` 和 `reviewMetrics`，并去重。
- 模板写入 `focusSceneTemplate`、`focusSceneLabel`、`reminderMinutes` 和 `petAnimationPreference`，供状态判断、复盘和后续提醒策略使用。

## 6. 当前任务选择

当前任务选择由 `getCurrentTaskDecision()` 负责，`getCurrentTask()` 返回该决策中的任务。

选择流程：

1. 排除已完成任务。
2. 排除带 `blockedBy` 的阻塞任务。
3. `selected` 优先。
4. `pinned` 优先。
5. 高优先级优先。
6. 截止日期更早优先。
7. 有 `nextAction` 的任务优先。
8. 列表顺序靠前优先。

决策结果包含：

- `task`：当前任务。
- `reasons`：选择原因，例如 `pinned`、`high-priority`、`due:2026-06-30`、`has-next-action`。
- `skippedBlockedCount`：因阻塞被跳过的待办数量。
- `candidateCount`：参与选择的待办数量。

Electron 侧通过 `window.focusPet.getCurrentTaskDecision()` 暴露该结果。桌面端调用 `window.focusPet.selectTask(id)` 设定手动当前任务；后端 `selectTask()` 会清除其他任务的 `selected` 标记，保证同一时间只有一个手动选中任务。任务被标记完成或重新打开时会清除 `selected`，避免已完成项或重新打开项自动抢回当前任务。旧数据或导入数据在保存时也会归一化：只保留第一条未完成、未阻塞任务的 `selected`，并清除已完成、阻塞或重复任务上的 `selected`。当 `updateTask()` 的修改让手动当前任务变为不可执行时，返回值也会使用保存后的归一化状态，保证 UI 收到的 `selected` 与落盘数据一致。

## 7. 状态判断接入

实现位置：`src/focus-rules.js`。

状态判断会使用：

- 当前任务标题的语义词。
- 当前任务声明的 `relatedApps`。
- 当前任务声明的 `relatedKeywords`。
- 当前任务由专注场景模板补充的 App 和关键词。

当当前 App 或窗口标题命中任务声明的相关 App/关键词时，分类结果会进入 `work`。如果任务带有 `focusSceneLabel`，原因会说明命中的是对应场景相关 App 或场景相关关键词，例如“匹配写代码场景相关 App：Code”。

## 8. 桌面端展示

实现位置：`src/renderer.js`。

任务面板本地排序与后端当前任务选择保持一致：

- 阻塞任务不会成为当前任务。
- 当前任务优先显示在列表前方。
- 每个未完成、未阻塞任务行提供“设为当前任务”图标按钮，点击后该任务会排他成为手动当前任务。
- 当前任务行展示选择依据，例如置顶、下一步、截止日期或优先级。
- 阻塞任务行展示阻塞原因。

## 9. 任务维度复盘

实现位置：`src/focus.js` 的 `buildTaskReview()`。

每日复盘会生成 `taskReview`，并进入桌面端复盘面板。

匹配任务的依据：

- 活动记录中的 `currentTask.id`。
- 活动记录中的 `currentTask.text`。
- 任务声明的 `relatedApps`。
- 任务声明的 `relatedKeywords`。

输出内容：

- `completion`：任务完成数、总数和完成率。
- `openCount`：未完成任务数。
- `blockedCount`：有阻塞原因的任务数。
- `withoutNextActionCount`：未阻塞但缺少下一步的任务数。
- `activeTaskCount`：近 24 小时有相关活动记录的任务数。
- `rows`：每个任务的推进分钟、疑似偏离分钟、未知相关性分钟、进展文案和阻力文案。
- `suggestions`：最多 3 条可执行建议。

复盘文案原则：

- 说“疑似偏离”，不说“拖延”。
- 说“缺少下一步”，不做心理归因。
- 优先建议处理阻塞和补下一步。

桌面端复盘面板在存在任务复盘行时显示任务推进卡片，包括完成概况、任务行和一条建议；没有任务数据时跳过该卡片，避免挤压桌面宠物小窗口。

## 10. 复盘行动建议

实现位置：`src/focus.js` 的 `buildReviewActionSuggestions()`。

每日复盘会生成：

- `actionReview`：行动建议的结构化依据。
- `actionSuggestions`：最多 5 条可执行建议。

`actionReview` 包含：

- `hourlyAppSwitches`：每小时 App 切换次数。
- `qualityFocusBlocks`：连续工作/学习采样形成的高质量专注块。
- `driftWindows`：疑似偏离或切换较多的时段。
- `staleTasks`：长期未完成或超过一周未更新的任务。
- `interruptedTasks`：推进中从工作/学习切到非工作状态的任务。
- `suggestions`：按偏离时段、任务打断、长期未完成、缺少下一步和高质量专注块生成的行动建议。

桌面端复盘面板只展示一条紧凑行动建议；完整建议保留在复盘数据中。

文案原则：

- 给具体动作，例如“设一个规避动作”“补一个 25 分钟下一步”。
- 不使用惩罚、羞辱或心理归因文案。

## 11. 验证

自动化测试覆盖：

- 增强字段规范化。
- `tasks.json` 写入 `version: 2`。
- 阻塞任务不会自动成为当前任务。
- 当前任务决策会返回选择原因。
- 手动设为当前任务会排他清除其他 `selected` 标记。
- 完成或重新打开手动当前任务会清除 `selected` 标记。
- 旧数据或导入数据中的多个 `selected` 会归一化为一个可执行当前任务。
- 更新使任务不可执行时，返回值和落盘状态都会清除 `selected`。
- 桌面任务面板暴露手动设为当前任务入口。
- 任务相关 App/关键词参与状态判断。
- 专注场景模板定义、任务字段合并、任务存储保留和状态判断原因。
- Electron IPC 暴露当前任务决策。
- 桌面任务面板识别阻塞、置顶和下一步字段。
- 任务维度复盘摘要包含推进情况和阻力。
- 桌面复盘面板渲染任务维度复盘卡片。
- 复盘行动建议覆盖偏离时段、任务打断、长期未完成、缺少下一步和高质量专注块。
- 复盘行动建议不出现惩罚、羞辱或过度心理归因文案。
- 桌面复盘面板渲染紧凑行动建议卡片。
