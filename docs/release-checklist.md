# Focus Pet Release Checklist

更新时间：2026-07-06

## 本机门禁

发布前先跑本机基础检查：

```bash
npm test
npm run check
npm run verify:pet-render
npm run release:preflight -- --run fast
```

## Cloud 门禁

生产发布前必须确认 Focus Pet Cloud 可用：

```bash
node scripts/release-preflight.js --check cloud-health
npm run cloud:turn:verify
npm run cloud:smoke
```

该检查要求：

- `/healthz` 返回 `ok=true`。
- `screenCheck.enabled=true`。
- `rtc.configValid=true`。
- `rtc.hasTurn=true`。
- `cloud:turn:verify` 能确认客户端实际拿到 TURN ICE 配置；若配置包含 `turns:` 或 `turn:?transport=tcp`，本机 TCP 探测至少有一个地址可达。
- `cloud:smoke` 注册两个临时生产 Cloud 用户，互加好友，连接 WSS，转发一次通话邀请，并调用 `/api/screen-check`。

如果 `rtc.configValid=false`，先修正 TURN Secret JSON；如果 `rtc.hasTurn=false`，先配置 TURN，再重新部署 Modal。
`cloud:turn:verify` 和 `cloud:smoke` 会真实写入生产 Cloud 用户数据，所以不放进自动 preflight 组，发布前人工运行。

Modal 用来部署 Focus Pet Cloud 和保存/下发 TURN ICE 配置；不要把 Modal Web Endpoint 当作生产 TURN relay。真正的 TURN relay 需要可稳定开放 TURN TCP/UDP 和 relay 端口的托管 TURN 或 coturn 服务。
当前线上部署使用 `focus-pet-cloud-turn` Secret 保存 `FOCUS_PET_CLOUD_RTC_ICE_SERVERS`，与 `focus-pet-cloud-stepfun` 分离，避免更新 TURN 时覆盖 StepFun key。

## macOS 门禁

如果要发布 Apple-notarized build，固定执行：

```bash
npm run release:preflight -- --run full
npm run release:mac
npm run sign:mac
npm run notarize:mac
npm run verify:mac
```

`verify:mac` 必须验证 codesign、Gatekeeper 和 stapled notarization ticket；任一失败都应阻断公开发布。

没有 Developer ID 和 notarization 凭据时，不允许把 README 写成“下载即无拦截使用”。
如果明确选择发布 ad-hoc signed / not notarized build，可以跳过 `notarize:mac` 和 `verify:mac`，但 Release notes 和 README 必须写明 macOS Gatekeeper 可能需要用户手动允许。

## GitHub Release

Release 必须包含：

- DMG。
- ZIP。
- SHA-256 manifest。
- 对应版本说明。
- 当前签名和 notarization 状态。

## 当前外部阻塞

- TURN 服务需要有效的 `focus-pet-cloud-turn` Secret。
- notarization 需要 Apple Developer ID、Team ID 和 app-specific password。
