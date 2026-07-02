# Focus Pet

> 面向专注工作、学习、任务复盘和可选社交监督的轻量桌面陪伴应用。

**语言：** [English](README.md) | 简体中文

[![Release](https://img.shields.io/github/v/release/RSXLX/focus-pet?label=release)](https://github.com/RSXLX/focus-pet/releases/latest)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey)](#下载)
[![Electron](https://img.shields.io/badge/Electron-39-47848F)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](#许可证)

Focus Pet 是一款中隐私桌宠应用，适合希望获得轻量专注陪伴、但不希望电脑变成隐性监控工具的用户。它以透明置顶桌宠作为入口，读取本机轻量上下文，例如当前前台 App 和窗口标题，帮助用户维护当天任务，并在活动可能偏离当前目标时给出低打扰提醒。

<p align="center">
  <img src="src/assets/pets/nervy-sci-fi-kid/gifs/full-body-states-demo.gif" width="360" alt="Focus Pet 全身桌宠动画演示">
</p>

## 项目状态

- 公开仓库：[RSXLX/focus-pet](https://github.com/RSXLX/focus-pet)
- 当前版本：[v1.0.0](https://github.com/RSXLX/focus-pet/releases/tag/v1.0.0)
- 已发布安装包：macOS Apple Silicon DMG 和 ZIP
- 源码支持：仓库包含 macOS 与 Windows 的开发和打包脚本
- 签名状态：当前公开 macOS 构建为 ad-hoc 签名，尚未通过 Apple notarization

## 下载

最新版本：[v1.0.0](https://github.com/RSXLX/focus-pet/releases/tag/v1.0.0)

| 平台 | 下载 | 说明 |
| --- | --- | --- |
| macOS Apple Silicon | [DMG](https://github.com/RSXLX/focus-pet/releases/download/v1.0.0/Focus-Pet-1.0.0-mac-arm64.dmg) | 推荐普通用户安装。 |
| macOS Apple Silicon | [ZIP](https://github.com/RSXLX/focus-pet/releases/download/v1.0.0/Focus-Pet-1.0.0-mac-arm64.zip) | 直接解压 `.app` 的归档包。 |
| 校验信息 | [manifest.json](https://github.com/RSXLX/focus-pet/releases/download/v1.0.0/Focus-Pet-1.0.0-mac-arm64-manifest.json) | 包含 SHA-256 和文件大小。 |

macOS 提示：当前公开构建尚未经过 Apple notarization。首次启动时，Gatekeeper 可能要求在“系统设置”中手动允许，或通过右键“打开”启动。

## 核心能力

- 桌面宠物窗口：透明、置顶、可拖动，空闲时支持点击穿透。
- 专注状态判断：识别工作、学习、游戏、疑似分心、未知和权限不足等状态。
- 任务系统：支持当前任务、优先级、截止日期、下一步、阻塞原因、相关 App 和相关关键词。
- 宠物反馈：包含心情、精力、亲密度、照料动作、全身动画和聊天 GIF 分享。
- 每日复盘：本地生成 24 小时复盘，包括专注分钟、偏离窗口、任务阻力和下一步行动。
- 可选屏幕监控：默认关闭；仅在用户明确开启后，才发送低细节截图到用户配置的视觉模型。
- 可选本地社交聊天：支持邀请链接、浏览器第二端、媒体消息、宠物 GIF 和 WebRTC 信令。
- 低内存运行：聊天、诊断、屏幕监控、LLM 自检、WebSocket 和 GIF 预览均按需加载。

## 隐私模型

Focus Pet 采用中隐私设计，目标是提供可解释的专注陪伴，而不是隐性监控。

默认情况下，它不会：

- 读取网页正文；
- 记录键盘输入；
- 截取屏幕截图；
- 读取浏览器历史；
- 将当前任务或窗口上下文上传到远程服务。

默认情况下，它可能在本地保存：

- 前台 App 名称；
- 窗口标题；
- 专注状态分类；
- 任务元数据；
- 活动时间戳；
- 宠物状态；
- 复盘摘要。

屏幕监控、LLM 复盘、外部聊天和 WebRTC 等能力都属于可选功能，需要用户主动开启或配置。详细边界见 [系统说明](docs/system-overview.md)、[社交安全边界](docs/social-security-boundary.md) 和 [诊断说明](docs/diagnostics.md)。

## 社交聊天模式

Focus Pet 将异步陪伴聊天和实时通话分开处理：

- 微信式小聊天窗口：支持文字、媒体消息、宠物 GIF 分享，以及通过 `MediaRecorder` 录制的语音消息。桌面端支持按住说话，也支持语音快捷键 `Alt+R`。
- 实时通话：实时语音聊天和实时视频聊天使用 WebRTC；会话建立依赖 WebSocket 信令，可按部署需要配置 TURN 以提升复杂网络下的连通性。

## 从源码运行

环境要求：

- 推荐 Node.js 20+
- npm
- macOS 或 Windows

```bash
git clone https://github.com/RSXLX/focus-pet.git
cd focus-pet
npm install
npm start
```

常用命令：

```bash
npm test
npm run check
npm run verify:pet-render
npm run diagnostics
```

## 发布与诊断 Gate

release preflight 用于让公开构建、诊断输出和隐私边界保持可审计。常用检查项：

```bash
node scripts/release-preflight.js --check diagnostics-summary-output
node scripts/release-preflight.js --check diagnostics-bundle-output
node scripts/release-preflight.js --check error-log
node scripts/release-preflight.js --run=fast
```

`diagnostics-summary-output` 会验证 `summarySchemaValid`、`summaryGeneratedAtValid`、`未知顶层字段数量`、`json-secret-field` 等敏感字段检查、从 `rawIssueKey` 到 `json-raw-field` 的原始字段保护、`emptyAcceptanceSections` 等验收空段检查，以及 `snake_case` 与 `kebab-case` 的键名一致性。标记为 `未通过` 的项目必须在发布前修复，包括包含冒号、括号、破折号或空格的诊断标签。

`diagnostics-bundle-output` 会检查 `summaryBoundaryIssues` 和 `summarySchemaValid`；`error-log` 会报告 `openUnresolvedEntries`。诊断包只包含最新 20 个相关错误记录，用于排查问题，同时避免暴露高敏感内容。

## 构建发布产物

macOS `.app`：

```bash
npm run package:mac
```

macOS DMG、ZIP 和校验 manifest：

```bash
npm run release:mac
```

Developer ID 签名和 notarization 不是本地开发必需项，但公开分发时建议配置：

```bash
MAC_CODESIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)" npm run sign:mac

APPLE_ID="you@example.com" \
APPLE_TEAM_ID="TEAMID" \
APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx" \
npm run notarize:mac
```

Windows 解包构建：

```powershell
npm install
npm run package:win
```

## 系统权限

macOS 需要“辅助功能”权限来读取当前前台 App 和窗口标题：

```text
系统设置 -> 隐私与安全性 -> 辅助功能
```

如果启用可选屏幕监控，还需要“屏幕录制”权限：

```text
系统设置 -> 隐私与安全性 -> 屏幕录制
```

Windows 支持通过 PowerShell 读取前台窗口标题。如果被安全软件或系统策略拦截，需要在系统隐私或安全设置中允许 Focus Pet / PowerShell。

## 宠物资源

当前宠物形象是短发、米色毛衣、浅色鞋子的全身小人。仓库内包含：

- 30 行桌面 spritesheet：`src/assets/pets/nervy-sci-fi-kid/spritesheet.webp`
- 24 张源 PNG：`src/assets/pets/nervy-sci-fi-kid/images/source/`
- 190 张动画帧：`src/assets/pets/nervy-sci-fi-kid/images/frames/`
- 22 个聊天和分享 GIF：`src/assets/pets/nervy-sci-fi-kid/gifs/`

## 项目结构

```text
src/
  main.js                 Electron 主进程
  renderer.js             桌宠界面逻辑
  focus.js                任务、状态、复盘和 App 上下文逻辑
  chat-service.js         本地 HTTP/WebSocket 聊天服务
  screen-monitor.js       可选截图和视觉 LLM 流程
  assets/pets/            宠物 spritesheet、PNG 帧和 GIF
scripts/
  package-macos.js        macOS 应用打包
  create-mac-release-assets.js
                           DMG/ZIP/manifest 发布产物生成
  verify-pet-render.js    Electron 视觉 QA 场景
docs/
  system-overview.md      系统行为和能力地图
  social-security-boundary.md
  diagnostics.md
  storage-recovery.md
```

## 文档

| 主题 | 文档 |
| --- | --- |
| 系统说明 | [docs/system-overview.md](docs/system-overview.md) |
| 任务模型 | [docs/task-model.md](docs/task-model.md) |
| 社交安全边界 | [docs/social-security-boundary.md](docs/social-security-boundary.md) |
| 数据恢复 | [docs/storage-recovery.md](docs/storage-recovery.md) |
| 诊断说明 | [docs/diagnostics.md](docs/diagnostics.md) |
| 优化方案 | [docs/optimization-plan.md](docs/optimization-plan.md) |
| 发布说明 | [docs/releases/v1.0.0.md](docs/releases/v1.0.0.md) |

## 开发说明

- 可选模块会延迟加载，以降低启动内存占用。
- 聊天服务采用 local-first 设计，只在使用聊天或社交能力时启动。
- GIF 预览只在 GIF 托盘打开时挂载，关闭后会释放对应节点。
- 错误和排障记录追加写入 `docs/errorThing.md`。
- 发布产物不提交到仓库，会在构建时生成到 `dist/release/`。

## 许可证

MIT
