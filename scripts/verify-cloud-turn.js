#!/usr/bin/env node
const net = require('node:net');
const { createHash, randomUUID } = require('node:crypto');
const { DEFAULT_FOCUS_PET_CLOUD_BASE_URL } = require('../src/llm-provider');

const DEFAULT_TIMEOUT_MS = 10_000;

function parseArgs(argv = process.argv.slice(2), env = process.env) {
  const options = {
    baseUrl: env.FOCUS_PET_CLOUD_PUBLIC_URL || DEFAULT_FOCUS_PET_CLOUD_BASE_URL,
    timeoutMs: Number(env.FOCUS_PET_CLOUD_TURN_VERIFY_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    skipApiIce: env.FOCUS_PET_CLOUD_TURN_VERIFY_SKIP_API_ICE === '1'
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--skip-api-ice') {
      options.skipApiIce = true;
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
    }
  }
  if (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1000) options.timeoutMs = DEFAULT_TIMEOUT_MS;
  options.baseUrl = String(options.baseUrl || DEFAULT_FOCUS_PET_CLOUD_BASE_URL).replace(/\/+$/, '');
  return options;
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

function flattenIceServers(iceServers = []) {
  return (Array.isArray(iceServers) ? iceServers : [])
    .flatMap(server => Array.isArray(server?.urls) ? server.urls : [server?.urls])
    .filter(Boolean)
    .map(String);
}

function hashHost(host = '') {
  return createHash('sha256').update(String(host || '')).digest('hex').slice(0, 12);
}

function parseIceUrl(value = '') {
  const raw = String(value || '').trim();
  const match = raw.match(/^(turns?|stuns?):(?:\/\/)?([^?]+)(?:\?(.+))?$/i);
  if (!match) return null;
  const scheme = match[1].toLowerCase();
  const target = match[2].trim();
  const query = match[3] || '';
  let host = target;
  let port = scheme === 'turns' || scheme === 'stuns' ? 5349 : 3478;
  if (target.startsWith('[')) {
    const closeIndex = target.indexOf(']');
    if (closeIndex >= 0) {
      host = target.slice(1, closeIndex);
      const rest = target.slice(closeIndex + 1);
      if (/^:\d+$/.test(rest)) port = Number(rest.slice(1));
    }
  } else {
    const lastColon = target.lastIndexOf(':');
    if (lastColon > 0 && /^\d+$/.test(target.slice(lastColon + 1))) {
      host = target.slice(0, lastColon);
      port = Number(target.slice(lastColon + 1));
    }
  }
  const params = new URLSearchParams(query);
  const transport = String(params.get('transport') || '').trim().toLowerCase();
  return {
    scheme,
    host,
    hostHash: hashHost(host),
    port,
    transport,
    isTurn: scheme === 'turn' || scheme === 'turns',
    tcpTestable: scheme === 'turns' || transport === 'tcp'
  };
}

function summarizeIceUrls(urls = []) {
  const parsed = urls.map(parseIceUrl).filter(Boolean);
  const turn = parsed.filter(item => item.isTurn);
  return {
    urlCount: parsed.length,
    stunUrlCount: parsed.filter(item => !item.isTurn).length,
    turnUrlCount: turn.length,
    tcpTurnUrlCount: turn.filter(item => item.tcpTestable).length,
    udpOrUnspecifiedTurnUrlCount: turn.filter(item => !item.tcpTestable).length,
    hasTurn: turn.length > 0,
    parsed
  };
}

function testTcpConnection(host, port, timeoutMs) {
  return new Promise(resolve => {
    const socket = net.connect({ host, port });
    let settled = false;
    const done = result => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => done({ reachable: true, reason: '' }));
    socket.once('timeout', () => done({ reachable: false, reason: 'timeout' }));
    socket.once('error', error => done({ reachable: false, reason: error.code || error.message || 'socket-error' }));
  });
}

async function registerProbeUser(baseUrl, timeoutMs) {
  const deviceId = `turn-verify-${randomUUID()}`;
  const registered = await withTimeout(requestJson(`${baseUrl}/api/users`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-focus-pet-device-id': deviceId
    },
    body: JSON.stringify({
      displayName: `TURN Verify ${randomUUID().slice(0, 8)}`,
      deviceId
    })
  }), timeoutMs, 'register probe user');
  const authToken = registered.authToken || '';
  if (!authToken) throw new Error('cloud registration did not return authToken');
  const authHeaders = {
    authorization: `Bearer ${authToken}`,
    'x-focus-pet-device-id': deviceId
  };
  const me = await withTimeout(requestJson(`${baseUrl}/api/me`, { headers: authHeaders }), timeoutMs, 'fetch /api/me');
  const ice = await withTimeout(requestJson(`${baseUrl}/api/ice`, { headers: authHeaders }), timeoutMs, 'fetch /api/ice');
  return {
    userCreated: true,
    userId: registered.user?.id || me.self?.id || '',
    iceServers: ice.iceServers || me.iceServers || registered.iceServers || []
  };
}

async function verifyCloudTurn(options = {}) {
  const settings = { ...parseArgs([], {}), ...options };
  const baseUrl = String(settings.baseUrl || DEFAULT_FOCUS_PET_CLOUD_BASE_URL).replace(/\/+$/, '');
  const health = await withTimeout(requestJson(`${baseUrl}/healthz`), settings.timeoutMs, 'fetch /healthz');
  const apiIce = settings.skipApiIce
    ? { skipped: true, userCreated: false, iceServers: [] }
    : await registerProbeUser(baseUrl, settings.timeoutMs);

  const healthRtc = health.rtc || {};
  const healthConfigured = health.ok === true
    && healthRtc.configValid !== false
    && healthRtc.hasTurn === true;
  const apiIceUrls = flattenIceServers(apiIce.iceServers);
  const apiIceSummary = summarizeIceUrls(apiIceUrls);
  const tcpTurn = apiIceSummary.parsed.filter(item => item.isTurn && item.tcpTestable);
  const tcpChecks = [];
  for (const item of tcpTurn) {
    const checked = await testTcpConnection(item.host, item.port, Math.min(settings.timeoutMs, 8000));
    tcpChecks.push({
      scheme: item.scheme,
      transport: item.transport || (item.scheme === 'turns' ? 'tls' : 'unspecified'),
      port: item.port,
      hostHash: item.hostHash,
      reachable: checked.reachable,
      reason: checked.reason
    });
  }
  const apiIceConfigured = settings.skipApiIce || apiIceSummary.hasTurn;
  const tcpReachable = tcpChecks.length === 0 ? null : tcpChecks.some(item => item.reachable);
  const failures = [];
  if (health.ok !== true) failures.push('cloud-not-ok');
  if (healthRtc.configValid === false) failures.push('turn-config-invalid');
  if (healthRtc.hasTurn !== true) failures.push('turn-missing-health');
  if (!apiIceConfigured) failures.push('turn-missing-api-ice');
  if (tcpChecks.length > 0 && !tcpReachable) failures.push('turn-tcp-unreachable');
  return {
    ok: failures.length === 0,
    baseUrl,
    failures,
    health: {
      ok: health.ok === true,
      screenCheckEnabled: health.screenCheck?.enabled === true,
      rtc: {
        configured: Boolean(healthRtc.configured),
        configValid: healthRtc.configValid !== false,
        usingDefault: Boolean(healthRtc.usingDefault),
        serverCount: Number(healthRtc.serverCount) || 0,
        turnCount: Number(healthRtc.turnCount) || 0,
        hasTurn: healthRtc.hasTurn === true
      }
    },
    apiIce: {
      skipped: Boolean(settings.skipApiIce),
      userCreated: Boolean(apiIce.userCreated),
      userId: apiIce.userId || '',
      urlCount: apiIceSummary.urlCount,
      stunUrlCount: apiIceSummary.stunUrlCount,
      turnUrlCount: apiIceSummary.turnUrlCount,
      tcpTurnUrlCount: apiIceSummary.tcpTurnUrlCount,
      udpOrUnspecifiedTurnUrlCount: apiIceSummary.udpOrUnspecifiedTurnUrlCount
    },
    tcpChecks,
    notes: [
      'This verifies Cloud TURN configuration and TCP reachability only.',
      'A full WebRTC relay proof still requires two clients on restrictive or separate networks.'
    ]
  };
}

if (require.main === module) {
  verifyCloudTurn(parseArgs())
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exitCode = result.ok ? 0 : 1;
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
  flattenIceServers,
  parseArgs,
  parseIceUrl,
  summarizeIceUrls,
  testTcpConnection,
  verifyCloudTurn
};
