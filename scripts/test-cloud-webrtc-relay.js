#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const {
  addCloudFriend,
  registerCloudUser
} = require('../src/cloud-client');
const { DEFAULT_FOCUS_PET_CLOUD_BASE_URL } = require('../src/llm-provider');

const DEFAULT_TIMEOUT_MS = 30_000;
const MODES = new Set(['audio', 'video', 'both']);

function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const options = {
    baseUrl: env.FOCUS_PET_CLOUD_PUBLIC_URL || DEFAULT_FOCUS_PET_CLOUD_BASE_URL,
    timeoutMs: Number(env.FOCUS_PET_CLOUD_WEBRTC_VERIFY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    mode: env.FOCUS_PET_CLOUD_WEBRTC_VERIFY_MODE || 'both',
    relayOnly: env.FOCUS_PET_CLOUD_WEBRTC_VERIFY_RELAY_ONLY !== '0',
    electronChild: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--electron-child') {
      options.electronChild = true;
    } else if (arg === '--base-url') {
      options.baseUrl = argv[index + 1] || options.baseUrl;
      index += 1;
    } else if (arg.startsWith('--base-url=')) {
      options.baseUrl = arg.slice('--base-url='.length);
    } else if (arg === '--timeout-ms') {
      options.timeoutMs = Number(argv[index + 1] || options.timeoutMs);
      index += 1;
    } else if (arg.startsWith('--timeout-ms=')) {
      options.timeoutMs = Number(arg.slice('--timeout-ms='.length));
    } else if (arg === '--mode') {
      options.mode = argv[index + 1] || options.mode;
      index += 1;
    } else if (arg.startsWith('--mode=')) {
      options.mode = arg.slice('--mode='.length);
    } else if (arg === '--no-relay-only') {
      options.relayOnly = false;
    } else if (arg === '--relay-only') {
      options.relayOnly = true;
    }
  }
  options.baseUrl = String(options.baseUrl || DEFAULT_FOCUS_PET_CLOUD_BASE_URL).replace(/\/+$/, '');
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1000) options.timeoutMs = DEFAULT_TIMEOUT_MS;
  if (!MODES.has(options.mode)) options.mode = 'both';
  return options;
}

function cleanEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('npm_')) delete env[key];
  }
  delete env.INIT_CWD;
  return env;
}

function runElectronChild(argv = process.argv.slice(2)) {
  const root = path.resolve(__dirname, '..');
  const electronPath = path.join(root, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron');
  const options = parseArgs(argv, process.env);
  const args = [__filename, ...argv.filter(arg => arg !== '--electron-child'), '--electron-child'];
  const result = spawnSync(electronPath, args, {
    cwd: root,
    env: cleanEnv(),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: options.timeoutMs * (options.mode === 'both' ? 4 : 3) + 30_000,
    killSignal: 'SIGTERM'
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    process.stderr.write(`${result.error.stack || result.error}\n`);
    process.exit(1);
  }
  process.exit(typeof result.status === 'number' ? result.status : 1);
}

function timedFetch(timeoutMs) {
  return async (url, options = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } catch (error) {
      if (error?.name === 'AbortError') {
        const pathname = (() => {
          try {
            return new URL(url).pathname || String(url);
          } catch {
            return String(url);
          }
        })();
        throw new Error(`fetch ${pathname} timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
}

function withTimeout(promise, timeoutMs, label) {
  let timer;
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    })
  ]);
}

function hasTurnIce(iceServers = []) {
  return (Array.isArray(iceServers) ? iceServers : [])
    .flatMap(server => Array.isArray(server?.urls) ? server.urls : [server?.urls])
    .filter(Boolean)
    .some(url => /^turns?:/i.test(String(url)));
}

async function prepareCloudAccounts(options = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'focus-pet-webrtc-relay-'));
  const suffix = randomUUID().slice(0, 8);
  const alicePath = path.join(tmpDir, 'alice.json');
  const bobPath = path.join(tmpDir, 'bob.json');
  const fetchImpl = timedFetch(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const alice = await registerCloudUser(
    { displayName: `Relay Alice ${suffix}` },
    { accountPath: alicePath, baseUrl: options.baseUrl, fetchImpl }
  );
  const bob = await registerCloudUser(
    { displayName: `Relay Bob ${suffix}` },
    { accountPath: bobPath, baseUrl: options.baseUrl, fetchImpl }
  );
  if (!alice.signedIn || !bob.signedIn) throw new Error('cloud users were not signed in');
  if (!alice.self?.friendCode || !bob.self?.friendCode) throw new Error('cloud users did not receive friend codes');
  const pairedAlice = await addCloudFriend(bob.self.friendCode, { accountPath: alicePath, fetchImpl });
  const pairedBob = await addCloudFriend(alice.self.friendCode, { accountPath: bobPath, fetchImpl });
  if (!pairedAlice.websocketUrl || !pairedBob.websocketUrl) throw new Error('cloud accounts did not return websocket URLs');
  const iceServers = pairedAlice.iceServers?.length ? pairedAlice.iceServers : pairedBob.iceServers;
  if (options.relayOnly && !hasTurnIce(iceServers)) throw new Error('relay-only WebRTC verification requires TURN ICE servers');
  return {
    tmpDir,
    users: {
      alice: {
        id: pairedAlice.self.id,
        websocketUrl: pairedAlice.websocketUrl,
        peerId: pairedBob.self.id
      },
      bob: {
        id: pairedBob.self.id,
        websocketUrl: pairedBob.websocketUrl,
        peerId: pairedAlice.self.id
      }
    },
    iceServers
  };
}

function rendererRelaySmoke() {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  function withTimeoutInRenderer(promise, timeoutMs, label) {
    let timer;
    return Promise.race([
      Promise.resolve(promise).finally(() => clearTimeout(timer)),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  }
  function waitForSocketOpen(socket, timeoutMs, label) {
    if (socket.readyState === WebSocket.OPEN) return Promise.resolve();
    return withTimeoutInRenderer(new Promise((resolve, reject) => {
      socket.addEventListener('open', () => resolve(), { once: true });
      socket.addEventListener('error', () => reject(new Error(`${label} websocket error`)), { once: true });
    }), timeoutMs, `${label} websocket open`);
  }
  function waitForPeerConnected(pc, timeoutMs, label) {
    const connected = () => ['connected', 'completed'].includes(pc.iceConnectionState)
      || pc.connectionState === 'connected';
    if (connected()) return Promise.resolve();
    return withTimeoutInRenderer(new Promise((resolve, reject) => {
      const done = () => {
        pc.removeEventListener('iceconnectionstatechange', onChange);
        pc.removeEventListener('connectionstatechange', onChange);
      };
      const onChange = () => {
        if (connected()) {
          done();
          resolve();
        } else if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)
          || ['failed', 'disconnected', 'closed'].includes(pc.iceConnectionState)) {
          done();
          reject(new Error(`${label} peer state ${pc.connectionState}/${pc.iceConnectionState}`));
        }
      };
      pc.addEventListener('iceconnectionstatechange', onChange);
      pc.addEventListener('connectionstatechange', onChange);
    }), timeoutMs, `${label} peer connected`);
  }
  function waitForRemoteTracks(tracks, expectedKinds, timeoutMs, label) {
    const enough = () => expectedKinds.every(kind => tracks.some(track => track.kind === kind));
    if (enough()) return Promise.resolve();
    return withTimeoutInRenderer(new Promise(resolve => {
      const timer = setInterval(() => {
        if (!enough()) return;
        clearInterval(timer);
        resolve();
      }, 100);
    }), timeoutMs, `${label} remote tracks`);
  }
  async function createSyntheticStream(mode) {
    const tracks = [];
    const audioContext = new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const destination = audioContext.createMediaStreamDestination();
    gain.gain.value = 0.01;
    oscillator.frequency.value = 440;
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start();
    const audioTrack = destination.stream.getAudioTracks()[0];
    if (!audioTrack) throw new Error('synthetic audio track unavailable');
    tracks.push(audioTrack);
    if (mode === 'video') {
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const context = canvas.getContext('2d');
      context.fillStyle = '#0066cc';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#ffffff';
      context.font = '18px sans-serif';
      context.fillText('Focus Pet', 18, 48);
      const stream = canvas.captureStream(5);
      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) throw new Error('synthetic video track unavailable');
      tracks.push(videoTrack);
    }
    return {
      stream: new MediaStream(tracks),
      stop: async () => {
        tracks.forEach(track => track.stop());
        oscillator.stop();
        await audioContext.close().catch(() => {});
      }
    };
  }
  async function selectedPairSummary(pc) {
    const stats = await pc.getStats();
    let pair = null;
    for (const report of stats.values()) {
      if (report.type === 'transport' && report.selectedCandidatePairId) {
        pair = stats.get(report.selectedCandidatePairId);
        break;
      }
    }
    if (!pair) {
      for (const report of stats.values()) {
        if (report.type === 'candidate-pair' && (report.selected || (report.nominated && report.state === 'succeeded'))) {
          pair = report;
          break;
        }
      }
    }
    const local = pair ? stats.get(pair.localCandidateId) : null;
    const remote = pair ? stats.get(pair.remoteCandidateId) : null;
    return {
      selected: Boolean(pair),
      pairState: pair?.state || '',
      localCandidateType: local?.candidateType || '',
      remoteCandidateType: remote?.candidateType || '',
      protocol: local?.protocol || remote?.protocol || '',
      relay: local?.candidateType === 'relay' || remote?.candidateType === 'relay'
    };
  }
  async function runOneMode(input, mode) {
    const expectedKinds = mode === 'video' ? ['audio', 'video'] : ['audio'];
    const aliceSocket = new WebSocket(input.users.alice.websocketUrl);
    const bobSocket = new WebSocket(input.users.bob.websocketUrl);
    const aliceRemoteTracks = [];
    const bobRemoteTracks = [];
    const aliceCandidates = [];
    const bobCandidates = [];
    let alicePc;
    let bobPc;
    let aliceMedia;
    let bobMedia;
    let aliceRemoteSet = false;
    let bobRemoteSet = false;
    let fatalError = null;
    const raiseFatal = error => {
      fatalError = fatalError || error;
    };
    const failIfFatal = () => {
      if (fatalError) throw fatalError;
    };
    const createFatalWatch = () => {
      let timer;
      const promise = new Promise((_, reject) => {
        timer = setInterval(() => {
          if (!fatalError) return;
          clearInterval(timer);
          reject(fatalError);
        }, 100);
      });
      return {
        promise,
        stop: () => clearInterval(timer)
      };
    };
    const flushCandidates = async (pc, queue) => {
      while (queue.length) await pc.addIceCandidate(queue.shift());
    };
    const send = (socket, type, payload) => {
      socket.send(JSON.stringify({ type, callId: input.callId, mode, ...payload }));
    };
    const handleSignal = async (recipient, data) => {
      const payload = data.payload || {};
      if (data.event === 'error') {
        throw new Error(`cloud websocket error: ${payload || data.payload || 'unknown'}`);
      }
      if (data.event === 'rtc-offer' && recipient === 'bob') {
        await bobPc.setRemoteDescription(payload.sdp);
        bobRemoteSet = true;
        await flushCandidates(bobPc, bobCandidates);
        const answer = await bobPc.createAnswer();
        await bobPc.setLocalDescription(answer);
        send(bobSocket, 'rtc-answer', { to: input.users.alice.id, sdp: bobPc.localDescription });
      } else if (data.event === 'rtc-answer' && recipient === 'alice') {
        await alicePc.setRemoteDescription(payload.sdp);
        aliceRemoteSet = true;
        await flushCandidates(alicePc, aliceCandidates);
      } else if (data.event === 'rtc-ice' && payload.candidate) {
        const candidate = new RTCIceCandidate(payload.candidate);
        if (recipient === 'alice') {
          if (aliceRemoteSet) await alicePc.addIceCandidate(candidate);
          else aliceCandidates.push(candidate);
        } else {
          if (bobRemoteSet) await bobPc.addIceCandidate(candidate);
          else bobCandidates.push(candidate);
        }
      }
    };
    aliceSocket.addEventListener('message', event => {
      const data = JSON.parse(event.data);
      handleSignal('alice', data).catch(raiseFatal);
    });
    bobSocket.addEventListener('message', event => {
      const data = JSON.parse(event.data);
      handleSignal('bob', data).catch(raiseFatal);
    });
    try {
      await Promise.all([
        waitForSocketOpen(aliceSocket, input.timeoutMs, 'alice'),
        waitForSocketOpen(bobSocket, input.timeoutMs, 'bob')
      ]);
      const peerConfig = {
        iceServers: input.iceServers,
        iceTransportPolicy: input.relayOnly ? 'relay' : 'all'
      };
      alicePc = new RTCPeerConnection(peerConfig);
      bobPc = new RTCPeerConnection(peerConfig);
      alicePc.onicecandidate = event => {
        if (event.candidate) send(aliceSocket, 'rtc-ice', { to: input.users.bob.id, candidate: event.candidate });
      };
      bobPc.onicecandidate = event => {
        if (event.candidate) send(bobSocket, 'rtc-ice', { to: input.users.alice.id, candidate: event.candidate });
      };
      alicePc.ontrack = event => aliceRemoteTracks.push(event.track);
      bobPc.ontrack = event => bobRemoteTracks.push(event.track);
      aliceMedia = await createSyntheticStream(mode);
      bobMedia = await createSyntheticStream(mode);
      aliceMedia.stream.getTracks().forEach(track => alicePc.addTrack(track, aliceMedia.stream));
      bobMedia.stream.getTracks().forEach(track => bobPc.addTrack(track, bobMedia.stream));
      send(aliceSocket, 'call-invite', { to: input.users.bob.id });
      const offer = await alicePc.createOffer();
      await alicePc.setLocalDescription(offer);
      send(aliceSocket, 'rtc-offer', { to: input.users.bob.id, sdp: alicePc.localDescription });
      const fatal = createFatalWatch();
      try {
        await Promise.race([
          Promise.all([
            waitForPeerConnected(alicePc, input.timeoutMs, 'alice'),
            waitForPeerConnected(bobPc, input.timeoutMs, 'bob'),
            waitForRemoteTracks(aliceRemoteTracks, expectedKinds, input.timeoutMs, 'alice'),
            waitForRemoteTracks(bobRemoteTracks, expectedKinds, input.timeoutMs, 'bob')
          ]),
          fatal.promise
        ]);
      } finally {
        fatal.stop();
      }
      failIfFatal();
      await sleep(250);
      const alicePair = await selectedPairSummary(alicePc);
      const bobPair = await selectedPairSummary(bobPc);
      if (input.relayOnly && (!alicePair.relay || !bobPair.relay)) {
        throw new Error('selected WebRTC candidate pair did not use relay candidates');
      }
      return {
        mode,
        ok: true,
        relayOnly: input.relayOnly,
        aliceRemoteKinds: [...new Set(aliceRemoteTracks.map(track => track.kind))].sort(),
        bobRemoteKinds: [...new Set(bobRemoteTracks.map(track => track.kind))].sort(),
        alicePair,
        bobPair
      };
    } finally {
      aliceSocket.close();
      bobSocket.close();
      if (alicePc) alicePc.close();
      if (bobPc) bobPc.close();
      if (aliceMedia) await aliceMedia.stop();
      if (bobMedia) await bobMedia.stop();
    }
  }
  return async function runRendererRelaySmoke(input) {
    const modes = input.mode === 'both' ? ['audio', 'video'] : [input.mode];
    const results = [];
    for (const mode of modes) {
      results.push(await runOneMode({ ...input, callId: `relay-${mode}-${Date.now()}` }, mode));
    }
    return { ok: true, results };
  };
}

async function runInElectron(options = {}) {
  const { app, BrowserWindow } = require('electron');
  await app.whenReady();
  let cloud;
  let win;
  try {
    cloud = await prepareCloudAccounts(options);
    win = new BrowserWindow({
      show: false,
      width: 640,
      height: 480,
      webPreferences: {
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    });
    await win.loadURL('data:text/html;charset=utf-8,<html><body><p>Focus Pet WebRTC relay verification</p></body></html>');
    const input = {
      users: cloud.users,
      iceServers: cloud.iceServers,
      timeoutMs: options.timeoutMs,
      mode: options.mode,
      relayOnly: options.relayOnly
    };
    const result = await withTimeout(win.webContents.executeJavaScript(
      `(${rendererRelaySmoke.toString()})()(${JSON.stringify(input)})`,
      true
    ), options.timeoutMs * (options.mode === 'both' ? 3 : 2), 'electron WebRTC relay smoke');
    return {
      ok: true,
      baseUrl: options.baseUrl,
      relayOnly: options.relayOnly,
      modes: result.results.map(item => item.mode),
      iceServerCount: Array.isArray(cloud.iceServers) ? cloud.iceServers.length : 0,
      results: result.results,
      note: 'This verifies Cloud signaling and browser WebRTC media over relay candidates on this machine; final release still needs two real computers on different networks.'
    };
  } finally {
    if (win && !win.isDestroyed()) win.close();
    if (cloud?.tmpDir) fs.rmSync(cloud.tmpDir, { recursive: true, force: true });
    app.quit();
  }
}

async function main() {
  const options = parseArgs();
  if (!process.versions.electron) {
    runElectronChild(process.argv.slice(2));
    return;
  }
  const result = await runInElectron(options);
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module || process.versions.electron) {
  main().catch(error => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    if (process.versions.electron) {
      try {
        require('electron').app.quit();
      } catch {}
    }
    process.exitCode = 1;
  });
}

module.exports = {
  hasTurnIce,
  parseArgs,
  prepareCloudAccounts
};
