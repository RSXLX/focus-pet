#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const {
  addCloudFriend,
  getCloudMe,
  sendCloudMessage,
  registerCloudUser
} = require('../src/cloud-client');
const { DEFAULT_FOCUS_PET_CLOUD_BASE_URL } = require('../src/llm-provider');

const DEFAULT_TIMEOUT_MS = 20_000;
const ONE_PIXEL_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

function parseArgs(argv = process.argv.slice(2)) {
  const result = {
    baseUrl: process.env.FOCUS_PET_CLOUD_PUBLIC_URL || DEFAULT_FOCUS_PET_CLOUD_BASE_URL,
    timeoutMs: Number(process.env.FOCUS_PET_CLOUD_SMOKE_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    skipScreenCheck: process.env.FOCUS_PET_CLOUD_SMOKE_SKIP_SCREEN_CHECK === '1'
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--skip-screen-check') {
      result.skipScreenCheck = true;
    } else if (arg.startsWith('--base-url=')) {
      result.baseUrl = arg.slice('--base-url='.length);
    } else if (arg === '--base-url') {
      result.baseUrl = argv[index + 1] || result.baseUrl;
      index += 1;
    } else if (arg.startsWith('--timeout-ms=')) {
      result.timeoutMs = Number(arg.slice('--timeout-ms='.length));
    } else if (arg === '--timeout-ms') {
      result.timeoutMs = Number(argv[index + 1] || result.timeoutMs);
      index += 1;
    }
  }
  if (!Number.isFinite(result.timeoutMs) || result.timeoutMs < 1000) result.timeoutMs = DEFAULT_TIMEOUT_MS;
  result.baseUrl = String(result.baseUrl || DEFAULT_FOCUS_PET_CLOUD_BASE_URL).replace(/\/+$/, '');
  return result;
}

function withTimeout(promise, timeoutMs, label) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || body.reason || response.statusText || `HTTP ${response.status}`);
    error.statusCode = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function waitForSocketOpen(socket, timeoutMs, label) {
  if (socket.readyState === WebSocket.OPEN) return Promise.resolve();
  return withTimeout(new Promise((resolve, reject) => {
    socket.addEventListener('open', () => resolve(), { once: true });
    socket.addEventListener('error', () => reject(new Error(`${label} websocket error`)), { once: true });
  }), timeoutMs, `${label} websocket open`);
}

function waitForSocketEvent(socket, expectedEvent, timeoutMs, label) {
  return withTimeout(new Promise((resolve, reject) => {
    const onMessage = event => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data.event === 'error') {
        cleanup();
        reject(new Error(`${label} websocket error event: ${data.payload || data.event}`));
        return;
      }
      if (data.event === expectedEvent) {
        cleanup();
        resolve(data.payload || {});
      }
    };
    const onError = () => {
      cleanup();
      reject(new Error(`${label} websocket error`));
    };
    const cleanup = () => {
      socket.removeEventListener('message', onMessage);
      socket.removeEventListener('error', onError);
    };
    socket.addEventListener('message', onMessage);
    socket.addEventListener('error', onError);
  }), timeoutMs, `${label} wait for ${expectedEvent}`);
}

function waitForSocketState(socket, predicate, timeoutMs, label, description) {
  return withTimeout(new Promise((resolve, reject) => {
    const onMessage = event => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }
      if (data.event === 'error') {
        cleanup();
        reject(new Error(`${label} websocket error event: ${data.payload || data.event}`));
        return;
      }
      if (data.event !== 'state') return;
      const payload = data.payload || {};
      if (!predicate || predicate(payload)) {
        cleanup();
        resolve(payload);
      }
    };
    const onError = () => {
      cleanup();
      reject(new Error(`${label} websocket error`));
    };
    const cleanup = () => {
      socket.removeEventListener('message', onMessage);
      socket.removeEventListener('error', onError);
    };
    socket.addEventListener('message', onMessage);
    socket.addEventListener('error', onError);
  }), timeoutMs, `${label} wait for state${description ? `: ${description}` : ''}`);
}

function stateHasFriendOnline(state = {}, friendId = '', online = true) {
  return (state.friends || []).some(friend => friend.id === friendId && Boolean(friend.online) === online);
}

function stateHasMessage(state = {}, messageId = '') {
  return (state.messages || []).some(message => message.id === messageId);
}

async function runScreenCheck(baseUrl, timeoutMs) {
  const result = await withTimeout(requestJson(`${baseUrl}/api/screen-check`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-focus-pet-device-id': `smoke-${randomUUID()}`
    },
    body: JSON.stringify({
      image: {
        dataUrl: ONE_PIXEL_PNG,
        sourceName: 'Focus Pet Cloud smoke',
        size: { width: 1, height: 1 }
      },
      currentTask: { text: 'Focus Pet Cloud smoke test' },
      frontmost: { app: 'Smoke', title: 'Cloud screen check' }
    })
  }), timeoutMs, 'screen check');
  if (result.ok !== true) {
    throw new Error(`screen check failed: ${result.status || result.reason || 'unknown'}`);
  }
  return {
    ok: true,
    status: result.status,
    source: result.source || ''
  };
}

async function runCloudSmoke(options = {}) {
  const settings = { ...parseArgs([]), ...options };
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'focus-pet-cloud-smoke-'));
  const startedAt = new Date().toISOString();
  const alicePath = path.join(tmpDir, 'alice.json');
  const bobPath = path.join(tmpDir, 'bob.json');
  const suffix = randomUUID().slice(0, 8);
  const screenCheck = settings.skipScreenCheck
    ? { skipped: true }
    : await runScreenCheck(settings.baseUrl, settings.timeoutMs);

  const alice = await registerCloudUser(
    { displayName: `Smoke Alice ${suffix}` },
    { accountPath: alicePath, baseUrl: settings.baseUrl, fetchImpl: fetch }
  );
  const bob = await registerCloudUser(
    { displayName: `Smoke Bob ${suffix}` },
    { accountPath: bobPath, baseUrl: settings.baseUrl, fetchImpl: fetch }
  );
  if (!alice.signedIn || !bob.signedIn) throw new Error('cloud user registration did not sign in both users');
  if (!alice.self.friendCode || !bob.self.friendCode) throw new Error('cloud user registration did not return friend codes');

  let invalidFriendCodeRejected = false;
  try {
    await addCloudFriend(`FP-MISSING-${suffix}`, { accountPath: alicePath, fetchImpl: fetch });
  } catch {
    invalidFriendCodeRejected = true;
  }
  if (!invalidFriendCodeRejected) throw new Error('invalid friend code was accepted');

  const pairedAlice = await addCloudFriend(bob.self.friendCode, { accountPath: alicePath, fetchImpl: fetch });
  const pairedBob = await addCloudFriend(alice.self.friendCode, { accountPath: bobPath, fetchImpl: fetch });
  if (!pairedAlice.friends.some(friend => friend.id === bob.self.id)) throw new Error('Alice does not list Bob after friend pairing');
  if (!pairedBob.friends.some(friend => friend.id === alice.self.id)) throw new Error('Bob does not list Alice after friend pairing');

  const aliceSocket = new WebSocket(pairedAlice.websocketUrl);
  const bobSocket = new WebSocket(pairedBob.websocketUrl);
  let onlineRefresh = false;
  let offlineRefresh = false;
  let textMessage = false;
  let imageMessage = false;
  try {
    const aliceOnlinePromise = waitForSocketState(
      aliceSocket,
      state => stateHasFriendOnline(state, bob.self.id, true),
      settings.timeoutMs,
      'alice',
      'bob online'
    );
    const bobOnlinePromise = waitForSocketState(
      bobSocket,
      state => stateHasFriendOnline(state, alice.self.id, true),
      settings.timeoutMs,
      'bob',
      'alice online'
    );
    await Promise.all([
      waitForSocketOpen(aliceSocket, settings.timeoutMs, 'alice'),
      waitForSocketOpen(bobSocket, settings.timeoutMs, 'bob')
    ]);
    await Promise.all([
      aliceOnlinePromise,
      bobOnlinePromise
    ]);
    onlineRefresh = true;

    const textEventPromise = waitForSocketEvent(bobSocket, 'message', settings.timeoutMs, 'bob');
    const sentText = await sendCloudMessage({
      to: bob.self.id,
      type: 'text',
      text: `Smoke text ${suffix}`
    }, { accountPath: alicePath, fetchImpl: fetch });
    const textEvent = await textEventPromise;
    if (textEvent.id !== sentText.id || textEvent.from !== alice.self.id || textEvent.to !== bob.self.id || textEvent.type !== 'text') {
      throw new Error('cloud text message realtime payload did not match expected users');
    }
    textMessage = true;

    const imageEventPromise = waitForSocketEvent(aliceSocket, 'message', settings.timeoutMs, 'alice');
    const sentImage = await sendCloudMessage({
      to: alice.self.id,
      type: 'image',
      media: {
        url: ONE_PIXEL_PNG,
        name: 'smoke.png',
        mimeType: 'image/png',
        size: ONE_PIXEL_PNG.length
      }
    }, { accountPath: bobPath, fetchImpl: fetch });
    const imageEvent = await imageEventPromise;
    if (imageEvent.id !== sentImage.id || imageEvent.from !== bob.self.id || imageEvent.to !== alice.self.id || imageEvent.type !== 'image') {
      throw new Error('cloud image message realtime payload did not match expected users');
    }
    imageMessage = true;

    const [aliceAfterMessages, bobAfterMessages] = await Promise.all([
      getCloudMe({ accountPath: alicePath, fetchImpl: fetch }),
      getCloudMe({ accountPath: bobPath, fetchImpl: fetch })
    ]);
    for (const messageId of [sentText.id, sentImage.id]) {
      if (!stateHasMessage(aliceAfterMessages, messageId)) throw new Error(`Alice cloud state did not include smoke message ${messageId}`);
      if (!stateHasMessage(bobAfterMessages, messageId)) throw new Error(`Bob cloud state did not include smoke message ${messageId}`);
    }

    const callId = `smoke-call-${suffix}`;
    const invitePromise = waitForSocketEvent(bobSocket, 'call-invite', settings.timeoutMs, 'bob');
    aliceSocket.send(JSON.stringify({
      type: 'call-invite',
      to: bob.self.id,
      callId,
      mode: 'audio'
    }));
    const invite = await invitePromise;
    if (invite.from !== alice.self.id || invite.to !== bob.self.id || invite.callId !== callId) {
      throw new Error('call invite payload did not match expected users');
    }

    const aliceSeesBobOffline = waitForSocketState(
      aliceSocket,
      state => stateHasFriendOnline(state, bob.self.id, false),
      settings.timeoutMs,
      'alice',
      'bob offline'
    );
    bobSocket.close();
    await aliceSeesBobOffline;
    offlineRefresh = true;
  } finally {
    aliceSocket.close();
    bobSocket.close();
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
  return {
    ok: true,
    baseUrl: settings.baseUrl,
    startedAt,
    screenCheck,
    users: {
      alice: { id: alice.self.id, friendCode: alice.self.friendCode },
      bob: { id: bob.self.id, friendCode: bob.self.friendCode }
    },
    invalidFriendCodeRejected,
    friendPairing: true,
    messages: {
      text: textMessage,
      image: imageMessage
    },
    onlineRefresh,
    offlineRefresh,
    websocketSignaling: true,
    note: 'Smoke users are production Cloud users; run this command intentionally.'
  };
}

if (require.main === module) {
  runCloudSmoke(parseArgs())
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(error => {
      console.error(JSON.stringify({
        ok: false,
        error: error.message
      }, null, 2));
      process.exitCode = 1;
    });
}

module.exports = {
  parseArgs,
  runCloudSmoke,
  runScreenCheck
};
