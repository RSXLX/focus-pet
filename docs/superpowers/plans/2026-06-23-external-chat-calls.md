# External Chat Calls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an external-ready chat experience where invited online users can exchange messages and start WebRTC audio/video calls with the desktop user.

**Architecture:** Keep the Electron app as the owner endpoint and self-host a lightweight HTTP/WebSocket signaling service. External users join through an invite-code session, receive a scoped session token, and use WebSocket messages for chat presence plus WebRTC signaling. The desktop renderer and browser client both use the same signaling events: `call-invite`, `call-answer`, `call-reject`, `call-end`, `rtc-offer`, `rtc-answer`, and `rtc-ice`.

**Tech Stack:** Electron, Node HTTP, `ws`, browser WebRTC APIs (`RTCPeerConnection`, `getUserMedia`), Node test runner.

---

### Task 1: Scoped External Sessions And Auth

**Files:**
- Modify: `src/chat-service.js`
- Test: `test/core.test.js`

- [ ] **Step 1: Write the failing test**

Add a test that creates a peer session with an invite code, verifies the returned session token is not the owner `authToken`, and verifies a peer state only contains that peer's conversation and no owner token.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern "external chat"`
Expected: FAIL because `createPeerSession()` and scoped state helpers do not exist yet.

- [ ] **Step 3: Implement minimal session helpers**

Add normalized `sessions`, `createPeerSession()`, `resolveAuth()`, `publicStateForToken()`, and `clientStateForAuth()` in `src/chat-service.js`. Keep owner IPC state working, but require HTTP `/api/state` to have a valid owner or peer token.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern "external chat"`
Expected: PASS.

### Task 2: WebSocket Signaling For Calls

**Files:**
- Modify: `src/chat-service.js`
- Test: `test/core.test.js`

- [ ] **Step 1: Write the failing test**

Add static and behavior tests that assert the server forwards real-time call event names and includes ICE server configuration in public client state.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern "WebRTC|external chat"`
Expected: FAIL because call signaling and ICE configuration are missing.

- [ ] **Step 3: Implement signaling forwarding**

Add `rtcIceServers()`, call event validation, recipient resolution, and `sendToPeer()` forwarding. Do not persist call signaling events as messages.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern "WebRTC|external chat"`
Expected: PASS.

### Task 3: Remote Browser Client

**Files:**
- Modify: `src/chat-service.js`
- Test: `test/core.test.js`

- [ ] **Step 1: Write the failing test**

Assert the remote `/client` HTML contains invite-code onboarding, token persistence, text/image/video/voice message controls, and WebRTC audio/video call controls.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern "remote social client|WebRTC"`
Expected: FAIL because the current remote client has no onboarding or call UI.

- [ ] **Step 3: Replace remote client markup/script**

Render a full browser client with invite join form, authenticated state loading, online friend list, text/media/voice messages, audio/video call buttons, local/remote video elements, and WebRTC offer/answer/ICE handling.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern "remote social client|WebRTC"`
Expected: PASS.

### Task 4: Desktop Chat UI And Calls

**Files:**
- Modify: `src/index.html`
- Modify: `src/renderer.js`
- Modify: `src/styles.css`
- Modify: `src/main.js`
- Test: `test/core.test.js`

- [ ] **Step 1: Write the failing test**

Assert the desktop chat UI exposes text/image/video message controls, audio/video call buttons, call status, local/remote media elements, calls `markRead()` when opening chat, and registers WebRTC signaling handlers.

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern "desktop chat|WebRTC"`
Expected: FAIL because desktop call controls and read synchronization are missing.

- [ ] **Step 3: Implement renderer and permission wiring**

Enable media permissions in Electron for app/localhost origins. Update the chat panel, make text compose visible, add image/video picker modes, add call controls, and implement desktop WebRTC signaling.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern "desktop chat|WebRTC"`
Expected: PASS.

### Task 5: Verification And Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/errorThing.md` only if new errors occur

- [ ] **Step 1: Update docs**

Document external chat host configuration, invite link/token behavior, and STUN/TURN configuration.

- [ ] **Step 2: Run full verification**

Run: `npm run check && npm test`
Expected: PASS.

- [ ] **Step 3: Run render QA if practical**

Run: `npm run verify:pet-render`
Expected: PASS, or log the Electron runtime failure to `docs/errorThing.md` if the command fails.
