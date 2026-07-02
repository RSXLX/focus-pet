# Focus Pet

> A lightweight desktop companion for focus, tasks, review, and optional social accountability.

**Language:** English | [简体中文](README.zh-CN.md)

[![Release](https://img.shields.io/github/v/release/RSXLX/focus-pet?label=release)](https://github.com/RSXLX/focus-pet/releases/latest)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey)](#downloads)
[![Electron](https://img.shields.io/badge/Electron-39-47848F)](https://www.electronjs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue)](#license)

Focus Pet is a medium-privacy desktop pet app for people who want lightweight focus support without turning their computer into a surveillance tool. It stays on top of your desktop, reads lightweight local context such as the current foreground app and window title, helps you manage today's tasks, and gives low-disruption nudges when your activity may drift away from your current work.

<p align="center">
  <img src="src/assets/pets/nervy-sci-fi-kid/gifs/full-body-states-demo.gif" width="360" alt="Focus Pet full-body animation demo">
</p>

## Project Status

- Public repository: [RSXLX/focus-pet](https://github.com/RSXLX/focus-pet)
- Current release: [v1.0.1](https://github.com/RSXLX/focus-pet/releases/tag/v1.0.1)
- Published binary: macOS Apple Silicon DMG and ZIP
- Source support: macOS and Windows development scripts are included
- Signing status: public macOS builds are ad-hoc signed and not Apple-notarized yet

## Downloads

Latest release: [v1.0.1](https://github.com/RSXLX/focus-pet/releases/tag/v1.0.1)

| Platform | Download | Notes |
| --- | --- | --- |
| macOS Apple Silicon | [Release assets](https://github.com/RSXLX/focus-pet/releases/tag/v1.0.1) | Download the DMG for normal installation. |
| macOS Apple Silicon | [Release assets](https://github.com/RSXLX/focus-pet/releases/tag/v1.0.1) | ZIP archive is also available. |
| Checksums | [Release assets](https://github.com/RSXLX/focus-pet/releases/tag/v1.0.1) | SHA-256 manifest is included. |

macOS note: the current public build is ad-hoc signed but not Apple-notarized. On first launch, macOS Gatekeeper may require manual approval in System Settings or via right-click Open.

## What It Does

- Desktop pet window: transparent, always-on-top, draggable, and click-through when idle.
- Focus state detection: classifies work, study, game, distracted, unknown, or permission states.
- Task system: current task, priority, deadline, next step, blocker, related apps, and related keywords.
- Pet feedback: mood, energy, bond, care actions, full-body animations, and chat GIF sharing.
- Daily review: local 24-hour review with focus minutes, drift windows, task friction, and next actions.
- Optional screen check: disabled by default; can use Focus Pet Cloud as a server-side StepFun proxy so downloaded apps do not embed API keys; sends low-detail screenshots only when explicitly enabled or manually tested.
- Optional local social chat: invite links, web client, media messages, pet GIFs, and WebRTC signaling.
- Optional Focus Pet Cloud backend: stable user IDs, friend codes, authenticated WebSocket signaling, one-to-one WebRTC voice/video calls, and server-side screen check proxying.
- Update notifications: checks the GitHub Release feed and notifies when a newer DMG/ZIP is available; installation remains user-driven.
- Low-memory runtime: optional chat, diagnostics, screen check, LLM self-check, WebSocket, and GIF previews load on demand.

## Privacy Model

Focus Pet is designed around medium privacy rather than hidden monitoring.

By default, it does not:

- read webpage content;
- record keyboard input;
- capture screenshots;
- read browser history;
- upload your current task or window context to a remote service.

By default, it may store locally:

- foreground app name;
- window title;
- focus classification;
- task metadata;
- activity timestamps;
- pet state;
- review summaries.

Optional capabilities such as screen check, LLM review, external chat, and WebRTC must be enabled or configured by the user. Details are documented in [system overview](docs/system-overview.md), [social security boundary](docs/social-security-boundary.md), and [diagnostics](docs/diagnostics.md).

## Social Chat Modes

Focus Pet separates asynchronous companion chat from realtime calls:

- WeChat-style compact chat window (`微信式小聊天窗口`): supports text, media messages, pet GIF sharing, and voice messages (`语音消息`) recorded through `MediaRecorder`. The desktop UI supports press-and-hold recording (`按住说话`) and the voice shortcut (`语音快捷键`) `Alt+R`.
- Realtime calls: realtime voice chat (`实时语音聊天`) and realtime video chat (`实时视频聊天`) use WebRTC. Session setup uses WebSocket signaling (`WebSocket 信令`), and TURN can be configured for NAT traversal.

For public multi-user distribution, use Focus Pet Cloud instead of exposing each desktop directly. It provides stable user IDs, friend-code pairing, device-bound auth tokens, authenticated WebSocket signaling, and ICE/TURN configuration for one-to-one WebRTC voice/video. See [Focus Pet Cloud](docs/focus-pet-cloud.md).

## Quick Start From Source

Requirements:

- Node.js 20+ recommended
- npm
- macOS or Windows

```bash
git clone https://github.com/RSXLX/focus-pet.git
cd focus-pet
npm install
npm start
```

Useful commands:

```bash
npm test
npm run check
npm run verify:pet-render
npm run diagnostics
npm run cloud:serve
npm run cloud:deploy:modal
```

`npm run cloud:deploy:modal` deploys the optional Focus Pet Cloud backend to Modal for public HTTPS/WSS signaling and server-side screen checks. Store StepFun keys in Modal secrets or backend environment variables, never in the desktop app. GitHub Pages can host a static website or download page, but it cannot run the Node/WebSocket backend used for realtime voice/video signaling. See [Focus Pet Cloud](docs/focus-pet-cloud.md).

## Release And Diagnostics Gates

Release preflight keeps the public build, diagnostics output, and privacy boundary auditable. Useful gates:

```bash
node scripts/release-preflight.js --check diagnostics-summary-output
node scripts/release-preflight.js --check diagnostics-bundle-output
node scripts/release-preflight.js --check error-log
node scripts/release-preflight.js --run=fast
```

The `diagnostics-summary-output` gate validates `summarySchemaValid`, `summaryGeneratedAtValid`, `未知顶层字段数量`, secret-field checks such as `json-secret-field`, raw-field protection from `rawIssueKey` to `json-raw-field`, empty acceptance checks such as `emptyAcceptanceSections`, and key naming consistency between `snake_case` and `kebab-case`. Output marked `未通过` must be fixed before release, including diagnostic labels that contain 冒号、括号、破折号或空格.

The `diagnostics-bundle-output` gate checks `summaryBoundaryIssues` and `summarySchemaValid`. The `error-log` gate reports `openUnresolvedEntries`. The 诊断包 includes the 最新 20 个 relevant error records for review without exposing high-sensitivity content.

## Build Release Assets

macOS app bundle:

```bash
npm run package:mac
```

macOS DMG, ZIP, and checksum manifest:

```bash
npm run release:mac
```

Developer ID signing and notarization are optional but recommended for public distribution:

```bash
MAC_CODESIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)" npm run sign:mac

APPLE_ID="you@example.com" \
APPLE_TEAM_ID="TEAMID" \
APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx" \
npm run notarize:mac
```

Windows unpacked build:

```powershell
npm install
npm run package:win
```

## App Permissions

On macOS, Focus Pet needs Accessibility permission to read the current foreground app/window title:

```text
System Settings -> Privacy & Security -> Accessibility
```

If optional screen check is enabled, macOS also requires Screen Recording permission:

```text
System Settings -> Privacy & Security -> Screen Recording
```

Windows support uses PowerShell to read the foreground window title. If blocked by security software or policy, allow Focus Pet / PowerShell in system privacy or security settings.

## Pet Assets

The current pet identity is a full-body short-haired character with a cream sweater and light shoes. The repository includes:

- 30-row desktop spritesheet: `src/assets/pets/nervy-sci-fi-kid/spritesheet.webp`
- 24 source PNGs: `src/assets/pets/nervy-sci-fi-kid/images/source/`
- 190 animation frames: `src/assets/pets/nervy-sci-fi-kid/images/frames/`
- 22 chat/share GIFs: `src/assets/pets/nervy-sci-fi-kid/gifs/`

## Project Structure

```text
src/
  main.js                 Electron main process
  renderer.js             Desktop pet UI logic
  focus.js                Task, state, review, and app context logic
  chat-service.js         Local HTTP/WebSocket chat service
  screen-monitor.js       Optional screenshot + vision LLM pipeline
  assets/pets/            Pet sprites, PNG frames, and GIFs
scripts/
  package-macos.js        macOS app bundle build
  create-mac-release-assets.js
                           DMG/ZIP/manifest release assets
  verify-pet-render.js    Electron visual QA scenarios
docs/
  system-overview.md      System behavior and capability map
  social-security-boundary.md
  diagnostics.md
  storage-recovery.md
```

## Documentation

| Topic | Document |
| --- | --- |
| System overview | [docs/system-overview.md](docs/system-overview.md) |
| Task model | [docs/task-model.md](docs/task-model.md) |
| Social security boundary | [docs/social-security-boundary.md](docs/social-security-boundary.md) |
| Data recovery | [docs/storage-recovery.md](docs/storage-recovery.md) |
| Diagnostics | [docs/diagnostics.md](docs/diagnostics.md) |
| Focus Pet Cloud | [docs/focus-pet-cloud.md](docs/focus-pet-cloud.md) |
| Optimization plan | [docs/optimization-plan.md](docs/optimization-plan.md) |
| Release notes | [docs/releases/v1.0.1.md](docs/releases/v1.0.1.md) |

## Development Notes

- Optional modules are intentionally lazy-loaded to keep startup memory lower.
- Chat service is local-first and starts only when chat/social features are used.
- GIF previews are mounted only when the GIF tray is open and are released on close.
- Error and troubleshooting records are appended to `docs/errorThing.md`.
- Release assets are not committed; they are generated under `dist/release/`.

## License

MIT
