# Focus Pet Cloud Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a minimal Focus Pet Cloud backend that gives each downloaded client a stable user ID and supports one-to-one voice/video calls through authenticated WebSocket WebRTC signaling.

**Architecture:** Add a separate Node-only `cloud-service` beside the existing local `chat-service`. The cloud service owns global users, device-bound auth tokens, reciprocal friendships, ICE/TURN configuration, and sanitized call audit records; WebRTC media still flows peer-to-peer or through TURN, never through the app backend.

**Tech Stack:** Node.js built-in HTTP, `ws`, JSON storage helpers, existing runtime log sanitizer, Node test runner.

---

### Task 1: Cloud Identity And Friend Graph

**Files:**
- Create: `src/cloud-service.js`
- Modify: `test/core.test.js`

- [ ] **Step 1: Write failing tests**

Add tests that require:

```js
const cloudService = require('../src/cloud-service');

test('Focus Pet Cloud registers device-bound users with stable public ids', () => {
  const state = cloudService.createInitialCloudState({ now: () => '2026-07-02T10:00:00.000Z' });
  const result = cloudService.registerUser({ displayName: '小林', deviceId: 'device-A' }, {
    state,
    id: () => 'user_abc123',
    token: () => 'cloud-token-a',
    friendCode: () => 'FP-ABCD-1234',
    now: () => '2026-07-02T10:00:00.000Z'
  });

  assert.equal(result.user.id, 'user_abc123');
  assert.equal(result.user.friendCode, 'FP-ABCD-1234');
  assert.equal(result.authToken, 'cloud-token-a');
  assert.equal(result.state.users[0].deviceId, undefined);
  assert.match(result.state.users[0].deviceIdHash, /^[a-f0-9]{64}$/);
  assert.equal(cloudService.resolveUserAuth('cloud-token-a', result.state, { deviceId: 'device-A' }).userId, 'user_abc123');
  assert.equal(cloudService.resolveUserAuth('cloud-token-a', result.state, { deviceId: 'device-B' }), null);
});

test('Focus Pet Cloud pairs users by friend code with reciprocal friendship', () => {
  const state = cloudService.createInitialCloudState();
  const alice = cloudService.registerUser({ displayName: 'Alice', deviceId: 'device-A' }, { state, id: () => 'user_alice', token: () => 'token-a', friendCode: () => 'FP-ALICE' });
  const bob = cloudService.registerUser({ displayName: 'Bob', deviceId: 'device-B' }, { state: alice.state, id: () => 'user_bob', token: () => 'token-b', friendCode: () => 'FP-BOB' });
  const pair = cloudService.addFriendByCode('FP-BOB', { state: bob.state, auth: { userId: 'user_alice' } });

  assert.equal(pair.ok, true);
  assert.deepEqual(pair.state.friendships.map(item => [item.userId, item.friendId]), [
    ['user_alice', 'user_bob'],
    ['user_bob', 'user_alice']
  ]);
  assert.deepEqual(cloudService.clientStateForUser({ userId: 'user_alice' }, pair.state).friends.map(friend => friend.id), ['user_bob']);
});
```

- [ ] **Step 2: Run tests to verify red**

Run: `node --test --test-name-pattern='Focus Pet Cloud' test/core.test.js`

Expected: fails because `../src/cloud-service` does not exist.

- [ ] **Step 3: Implement minimal identity functions**

Create `src/cloud-service.js` with `createInitialCloudState`, `registerUser`, `resolveUserAuth`, `addFriendByCode`, and `clientStateForUser`.

- [ ] **Step 4: Run tests to verify green**

Run: `node --test --test-name-pattern='Focus Pet Cloud' test/core.test.js`

Expected: both tests pass.

### Task 2: WebRTC Signaling Contract

**Files:**
- Modify: `src/cloud-service.js`
- Modify: `test/core.test.js`

- [ ] **Step 1: Write failing tests**

Add tests that require:

```js
test('Focus Pet Cloud validates one-to-one WebRTC signaling between friends', () => {
  const state = cloudService.createInitialCloudState();
  state.users = [
    { id: 'user_alice', displayName: 'Alice', friendCode: 'FP-ALICE', tokens: [] },
    { id: 'user_bob', displayName: 'Bob', friendCode: 'FP-BOB', tokens: [] },
    { id: 'user_eve', displayName: 'Eve', friendCode: 'FP-EVE', tokens: [] }
  ];
  state.friendships = [
    { userId: 'user_alice', friendId: 'user_bob', createdAt: '2026-07-02T10:00:00.000Z' },
    { userId: 'user_bob', friendId: 'user_alice', createdAt: '2026-07-02T10:00:00.000Z' }
  ];

  const offer = cloudService.normalizeCloudRealtimeEvent({
    type: 'rtc-offer',
    to: 'user_bob',
    callId: 'call-1',
    mode: 'video',
    sdp: { type: 'offer', sdp: 'v=0' }
  }, { userId: 'user_alice' }, state);

  assert.equal(offer.event, 'rtc-offer');
  assert.equal(offer.payload.from, 'user_alice');
  assert.equal(offer.payload.to, 'user_bob');
  assert.equal(offer.payload.mode, 'video');
  assert.throws(() => cloudService.normalizeCloudRealtimeEvent({ type: 'rtc-offer', to: 'user_eve', callId: 'call-2', mode: 'audio' }, { userId: 'user_alice' }, state), /not friends/);
});

test('Focus Pet Cloud call audit omits SDP ICE and TURN details', () => {
  const state = cloudService.createInitialCloudState();
  const event = {
    event: 'rtc-offer',
    payload: {
      from: 'user_alice',
      to: 'user_bob',
      callId: 'call-1',
      mode: 'video',
      sdp: { type: 'offer', sdp: 'secret-sdp' },
      candidate: { candidate: 'candidate turn.example.com secret' }
    }
  };
  const result = cloudService.recordCloudRealtimeAudit(event, 1, { state, now: () => '2026-07-02T10:00:00.000Z' });

  assert.equal(result.entry.event, 'rtc-offer');
  assert.equal(result.entry.mode, 'video');
  assert.doesNotMatch(JSON.stringify(result.state.callAuditLog), /secret-sdp|candidate|turn\.example\.com/);
});
```

- [ ] **Step 2: Run tests to verify red**

Run: `node --test --test-name-pattern='Focus Pet Cloud' test/core.test.js`

Expected: fails because signaling functions are missing.

- [ ] **Step 3: Implement signaling helpers**

Add event validation for `call-invite`, `call-answer`, `call-reject`, `call-cancel`, `call-end`, `rtc-offer`, `rtc-answer`, and `rtc-ice`; require friendship for delivery; add sanitized call audit records.

- [ ] **Step 4: Run tests to verify green**

Run: `node --test --test-name-pattern='Focus Pet Cloud' test/core.test.js`

Expected: all Focus Pet Cloud tests pass.

### Task 3: Cloud Server Entrypoint And Docs

**Files:**
- Modify: `src/cloud-service.js`
- Create: `scripts/run-cloud-service.js`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `README.zh-CN.md`
- Create: `docs/focus-pet-cloud.md`

- [ ] **Step 1: Write failing tests**

Add tests that require:

```js
test('Focus Pet Cloud exposes a Node-only backend entrypoint for public deployment', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  const runner = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts', 'run-cloud-service.js'), 'utf8');
  const docs = fs.readFileSync(path.join(PROJECT_ROOT, 'docs', 'focus-pet-cloud.md'), 'utf8');

  assert.equal(packageJson.scripts['cloud:serve'], 'node scripts/run-cloud-service.js');
  assert.match(packageJson.scripts.check, /src\/cloud-service\.js/);
  assert.match(packageJson.scripts.check, /scripts\/run-cloud-service\.js/);
  assert.match(runner, /cloudService\.start\(\)/);
  assert.match(runner, /SIGTERM/);
  assert.match(runner, /sanitizeLogText/);
  assert.match(docs, /Focus Pet Cloud/);
  assert.match(docs, /WebSocket 信令/);
  assert.match(docs, /WebRTC/);
  assert.match(docs, /TURN/);
});
```

- [ ] **Step 2: Run tests to verify red**

Run: `node --test --test-name-pattern='Focus Pet Cloud' test/core.test.js`

Expected: fails because script and docs are missing.

- [ ] **Step 3: Implement server and docs**

Add HTTP endpoints for `/healthz`, `POST /api/users`, `GET /api/me`, `POST /api/friends`, `GET /api/ice`; add WebSocket auth and signaling relay; add `cloud:serve`; document deployment and TURN requirements.

- [ ] **Step 4: Run all verification**

Run:

```bash
git diff --check
npm run check
npm test
```

Expected: all pass.
