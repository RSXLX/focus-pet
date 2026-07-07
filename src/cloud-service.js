const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { WebSocketServer } = require('ws');
const { readJsonWithRecovery, writeJsonAtomic } = require('./json-storage');
const {
  DEFAULT_STEPFUN_ENDPOINT,
  DEFAULT_STEPFUN_SCREEN_MODEL,
  normalizeChatEndpoint
} = require('./llm-provider');
const {
  callVisionModel,
  statusMessage
} = require('./screen-monitor');

const DEFAULT_DATA_DIR = path.join(os.homedir(), '.hermes', 'focus-pet-cloud');
const DATA_DIR = path.resolve(process.env.FOCUS_PET_CLOUD_DATA_DIR || DEFAULT_DATA_DIR);
const STATE_PATH = path.join(DATA_DIR, 'cloud-state.json');
const DEFAULT_HOST = process.env.FOCUS_PET_CLOUD_HOST || '0.0.0.0';
const DEFAULT_PORT = readPort(process.env.FOCUS_PET_CLOUD_PORT, process.env.PORT, 47821);
const CLOUD_STATE_VERSION = 1;
const DEFAULT_RTC_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const CALL_AUDIT_LOG_LIMIT = 500;
const DEFAULT_SCREEN_CHECK_MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const DEFAULT_SCREEN_CHECK_TIMEOUT_MS = 15_000;
const DEFAULT_SCREEN_CHECK_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_SCREEN_CHECK_RATE_LIMIT_MAX = 20;
const REALTIME_EVENTS = new Set([
  'call-invite',
  'call-answer',
  'call-reject',
  'call-cancel',
  'call-end',
  'rtc-offer',
  'rtc-answer',
  'rtc-ice'
]);

let server;
let wss;
let port = DEFAULT_PORT;
let host = DEFAULT_HOST;
let serverProtocol = 'http';
let readyPromise = Promise.resolve(null);
const clients = new Map();
const screenCheckRateBuckets = new Map();

function readPort(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    const candidate = Number(value);
    if (Number.isInteger(candidate) && candidate >= 0 && candidate <= 65535) return candidate;
  }
  return 47821;
}

function readBoundedInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function nowIso(options = {}) {
  const value = typeof options.now === 'function' ? options.now() : options.now;
  const time = Date.parse(value || '');
  return new Date(Number.isFinite(time) ? time : Date.now()).toISOString();
}

function makeToken() {
  return randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
}

function makeUserId() {
  return `user_${randomUUID().replaceAll('-', '').slice(0, 20)}`;
}

function makeFriendCode() {
  const left = Math.random().toString(36).slice(2, 6).toUpperCase();
  const right = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FP-${left}-${right}`;
}

function secretHash(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

function cleanDisplayName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 40) || 'Focus Pet User';
}

function cleanText(value, maxLength = 200) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanCode(value) {
  return String(value || '').trim().toUpperCase();
}

function createInitialCloudState(options = {}) {
  return {
    version: CLOUD_STATE_VERSION,
    createdAt: nowIso(options),
    users: [],
    friendships: [],
    callAuditLog: []
  };
}

function normalizeUser(user = {}) {
  const id = String(user.id || '').trim();
  if (!id) return null;
  const tokens = Array.isArray(user.tokens)
    ? user.tokens
      .filter(token => token && typeof token === 'object' && token.token)
      .map(token => ({
        token: String(token.token),
        createdAt: String(token.createdAt || ''),
        lastSeenAt: String(token.lastSeenAt || ''),
        deviceIdHash: String(token.deviceIdHash || '')
      }))
    : [];
  return {
    id,
    displayName: cleanDisplayName(user.displayName),
    friendCode: cleanCode(user.friendCode) || makeFriendCode(),
    deviceIdHash: String(user.deviceIdHash || ''),
    createdAt: String(user.createdAt || ''),
    lastSeenAt: String(user.lastSeenAt || ''),
    tokens
  };
}

function normalizeFriendship(friendship = {}) {
  const userId = String(friendship.userId || '').trim();
  const friendId = String(friendship.friendId || '').trim();
  if (!userId || !friendId || userId === friendId) return null;
  return {
    userId,
    friendId,
    createdAt: String(friendship.createdAt || '')
  };
}

function migrateCloudState(input = {}, options = {}) {
  const fallback = createInitialCloudState(options);
  const state = input && typeof input === 'object' ? input : fallback;
  return {
    version: CLOUD_STATE_VERSION,
    createdAt: String(state.createdAt || fallback.createdAt),
    users: Array.isArray(state.users) ? state.users.map(normalizeUser).filter(Boolean) : [],
    friendships: Array.isArray(state.friendships) ? state.friendships.map(normalizeFriendship).filter(Boolean) : [],
    callAuditLog: normalizeCallAuditLog(state.callAuditLog || [])
  };
}

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadState(options = {}) {
  ensureDirs();
  return readJsonWithRecovery(STATE_PATH, {
    fallback: createInitialCloudState(options),
    backupLabel: 'cloud-state',
    normalize: value => migrateCloudState(value, options)
  }).value;
}

function saveState(state) {
  const normalized = migrateCloudState(state);
  ensureDirs();
  writeJsonAtomic(STATE_PATH, normalized);
  return normalized;
}

function publicUser(user = {}, options = {}) {
  return {
    id: user.id,
    displayName: user.displayName,
    friendCode: user.friendCode,
    createdAt: user.createdAt,
    lastSeenAt: user.lastSeenAt,
    online: Boolean(options.online)
  };
}

function findUserById(state, userId) {
  return (state.users || []).find(user => user.id === userId) || null;
}

function findUserByCode(state, friendCode) {
  const code = cleanCode(friendCode);
  return (state.users || []).find(user => cleanCode(user.friendCode) === code) || null;
}

function userOnline(userId) {
  return [...clients.values()].some(client => client.userId === userId);
}

function registerUser(input = {}, options = {}) {
  const state = migrateCloudState(options.state || loadState(options), options);
  const deviceId = String(input.deviceId || options.deviceId || '').trim();
  if (!deviceId) throw new Error('deviceId required');
  const createdAt = nowIso(options);
  const user = {
    id: typeof options.id === 'function' ? options.id() : makeUserId(),
    displayName: cleanDisplayName(input.displayName),
    friendCode: cleanCode(typeof options.friendCode === 'function' ? options.friendCode() : makeFriendCode()),
    deviceIdHash: secretHash(deviceId),
    createdAt,
    lastSeenAt: createdAt,
    tokens: [{
      token: typeof options.token === 'function' ? options.token() : makeToken(),
      deviceIdHash: secretHash(deviceId),
      createdAt,
      lastSeenAt: createdAt
    }]
  };
  state.users.push(user);
  if (!options.state) saveState(state);
  return {
    user: publicUser(user),
    authToken: user.tokens[0].token,
    deviceId,
    state
  };
}

function resolveUserAuth(token, state = loadState(), options = {}) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) return null;
  const deviceId = String(options.deviceId || '').trim();
  for (const user of state.users || []) {
    for (const authToken of user.tokens || []) {
      if (authToken.token !== cleanToken) continue;
      if (authToken.deviceIdHash && (!deviceId || authToken.deviceIdHash !== secretHash(deviceId))) return null;
      authToken.lastSeenAt = nowIso(options);
      user.lastSeenAt = authToken.lastSeenAt;
      return {
        role: 'user',
        userId: user.id,
        displayName: user.displayName,
        token: cleanToken
      };
    }
  }
  return null;
}

function friendshipExists(state, userId, friendId) {
  return (state.friendships || []).some(item => item.userId === userId && item.friendId === friendId);
}

function areFriends(state, userId, friendId) {
  return friendshipExists(state, userId, friendId) && friendshipExists(state, friendId, userId);
}

function addFriendship(state, userId, friendId, options = {}) {
  if (!friendshipExists(state, userId, friendId)) {
    state.friendships.push({ userId, friendId, createdAt: nowIso(options) });
  }
}

function addFriendByCode(friendCode, options = {}) {
  const state = migrateCloudState(options.state || loadState(options), options);
  const auth = options.auth || {};
  const user = findUserById(state, auth.userId);
  if (!user) return { ok: false, error: 'unauthorized', state };
  const friend = findUserByCode(state, friendCode);
  if (!friend) return { ok: false, error: 'friend not found', state };
  if (friend.id === user.id) return { ok: false, error: 'cannot add self', state };
  addFriendship(state, user.id, friend.id, options);
  addFriendship(state, friend.id, user.id, options);
  if (!options.state) saveState(state);
  return { ok: true, friend: publicUser(friend, { online: userOnline(friend.id) }), state };
}

function clientStateForUser(auth = {}, state = loadState(), options = {}) {
  const user = findUserById(state, auth.userId);
  if (!user) return null;
  const friends = (state.friendships || [])
    .filter(item => item.userId === user.id)
    .map(item => findUserById(state, item.friendId))
    .filter(Boolean)
    .map(friend => publicUser(friend, { online: userOnline(friend.id) }));
  return {
    version: CLOUD_STATE_VERSION,
    self: publicUser(user, { online: true }),
    friends,
    iceServers: rtcIceServers(options.env || process.env)
  };
}

function friendIdsForUser(state = loadState(), userId = '') {
  const id = String(userId || '').trim();
  if (!id) return [];
  return [...new Set((state.friendships || [])
    .filter(item => item.userId === id)
    .map(item => item.friendId)
    .filter(Boolean))];
}

function broadcastClientState(userId, state = loadState()) {
  const payload = clientStateForUser({ userId }, state, { env: process.env });
  if (!payload) return 0;
  return sendToUser(userId, 'state', payload);
}

function broadcastStateToUserAndFriends(userId, state = loadState()) {
  const ids = [String(userId || '').trim(), ...friendIdsForUser(state, userId)].filter(Boolean);
  let delivered = 0;
  for (const id of [...new Set(ids)]) delivered += broadcastClientState(id, state);
  return delivered;
}

function normalizeMode(value) {
  return value === 'video' ? 'video' : 'audio';
}

function normalizeCloudRealtimeEvent(input = {}, auth = {}, state = loadState()) {
  const event = String(input.type || input.event || '').trim();
  if (!REALTIME_EVENTS.has(event)) throw new Error('unsupported realtime event');
  const from = String(auth.userId || input.from || '').trim();
  const to = String(input.to || '').trim();
  if (!from || !to) throw new Error('missing realtime participant');
  if (!findUserById(state, from) || !findUserById(state, to)) throw new Error('unknown realtime participant');
  if (!areFriends(state, from, to)) throw new Error('not friends');
  const payload = {
    from,
    to,
    callId: String(input.callId || '').trim() || `call-${Date.now()}`,
    mode: normalizeMode(input.mode)
  };
  if (event === 'rtc-offer' || event === 'rtc-answer') payload.sdp = input.sdp;
  if (event === 'rtc-ice') payload.candidate = input.candidate;
  if (input.reason) payload.reason = String(input.reason).slice(0, 120);
  return { event, payload };
}

function normalizeCallAuditLog(input = []) {
  if (!Array.isArray(input)) return [];
  return input
    .filter(item => item && typeof item === 'object')
    .map(item => ({
      event: String(item.event || ''),
      from: String(item.from || ''),
      to: String(item.to || ''),
      callId: String(item.callId || ''),
      mode: normalizeMode(item.mode),
      delivered: Boolean(item.delivered),
      recipientClientCount: Math.max(0, Math.floor(Number(item.recipientClientCount) || 0)),
      createdAt: String(item.createdAt || '')
    }))
    .filter(item => item.event && item.from && item.to)
    .slice(-CALL_AUDIT_LOG_LIMIT);
}

function recordCloudRealtimeAudit(event = {}, deliveredCount = 0, options = {}) {
  const state = migrateCloudState(options.state || loadState(options), options);
  const payload = event.payload || {};
  const entry = {
    event: String(event.event || payload.event || ''),
    from: String(payload.from || ''),
    to: String(payload.to || ''),
    callId: String(payload.callId || ''),
    mode: normalizeMode(payload.mode),
    delivered: Number(deliveredCount) > 0,
    recipientClientCount: Math.max(0, Math.floor(Number(deliveredCount) || 0)),
    createdAt: nowIso(options)
  };
  state.callAuditLog = normalizeCallAuditLog([...(state.callAuditLog || []), entry]);
  if (!options.state) saveState(state);
  return { entry, state };
}

function parseRtcIceServers(env = process.env) {
  const raw = String(env.FOCUS_PET_CLOUD_RTC_ICE_SERVERS || env.FOCUS_PET_RTC_ICE_SERVERS || '').trim();
  if (!raw) {
    return {
      configured: false,
      configValid: true,
      configError: '',
      servers: DEFAULT_RTC_ICE_SERVERS
    };
  }
  try {
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    const normalized = list
      .filter(item => item && typeof item === 'object')
      .map(item => ({
        urls: item.urls,
        ...(item.username ? { username: String(item.username) } : {}),
        ...(item.credential ? { credential: String(item.credential) } : {})
      }))
      .filter(item => typeof item.urls === 'string' || Array.isArray(item.urls));
    if (!normalized.length) {
      return {
        configured: true,
        configValid: false,
        configError: 'no-valid-ice-servers',
        servers: DEFAULT_RTC_ICE_SERVERS
      };
    }
    return {
      configured: true,
      configValid: true,
      configError: '',
      servers: normalized
    };
  } catch {
    return {
      configured: true,
      configValid: false,
      configError: 'invalid-json',
      servers: DEFAULT_RTC_ICE_SERVERS
    };
  }
}

function rtcIceServers(env = process.env) {
  return parseRtcIceServers(env).servers;
}

function flattenIceUrls(serverList) {
  return serverList.flatMap(item => Array.isArray(item.urls) ? item.urls : [item.urls]).filter(Boolean).map(String);
}

function rtcIceServerSummary(env = process.env) {
  const config = parseRtcIceServers(env);
  const servers = config.servers;
  const urls = flattenIceUrls(servers);
  const stunCount = urls.filter(url => /^stuns?:/i.test(url)).length;
  const turnCount = urls.filter(url => /^turns?:/i.test(url)).length;
  return {
    configured: config.configured,
    configValid: config.configValid,
    configError: config.configError,
    usingDefault: !config.configured || !config.configValid,
    serverCount: urls.length,
    stunCount,
    turnCount,
    hasTurn: turnCount > 0,
    requiresTurn: turnCount === 0,
    guidance: turnCount > 0
      ? 'TURN is configured for more reliable voice/video calls.'
      : 'Configure FOCUS_PET_CLOUD_RTC_ICE_SERVERS with TURN for reliable cross-network voice/video calls.'
  };
}

function cloudScreenCheckTimeoutMs(env = process.env) {
  return readBoundedInteger(
    env.FOCUS_PET_CLOUD_SCREEN_CHECK_TIMEOUT_MS,
    DEFAULT_SCREEN_CHECK_TIMEOUT_MS,
    1000,
    60_000
  );
}

function cloudScreenCheckMaxImageBytes(env = process.env) {
  return readBoundedInteger(
    env.FOCUS_PET_CLOUD_SCREEN_CHECK_MAX_IMAGE_BYTES,
    DEFAULT_SCREEN_CHECK_MAX_IMAGE_BYTES,
    64 * 1024,
    12 * 1024 * 1024
  );
}

function cloudScreenCheckMaxBodyBytes(env = process.env) {
  return readBoundedInteger(
    env.FOCUS_PET_CLOUD_SCREEN_CHECK_MAX_BODY_BYTES,
    cloudScreenCheckMaxImageBytes(env) + 32 * 1024,
    128 * 1024,
    16 * 1024 * 1024
  );
}

function cloudScreenCheckRateLimitConfig(env = process.env) {
  return {
    windowMs: readBoundedInteger(
      env.FOCUS_PET_CLOUD_SCREEN_CHECK_RATE_LIMIT_WINDOW_MS,
      DEFAULT_SCREEN_CHECK_RATE_LIMIT_WINDOW_MS,
      1000,
      10 * 60_000
    ),
    max: readBoundedInteger(
      env.FOCUS_PET_CLOUD_SCREEN_CHECK_RATE_LIMIT_MAX,
      DEFAULT_SCREEN_CHECK_RATE_LIMIT_MAX,
      1,
      240
    )
  };
}

function cloudScreenCheckLlmConfig(env = process.env) {
  const endpoint = normalizeChatEndpoint(
    env.FOCUS_PET_CLOUD_SCREEN_LLM_ENDPOINT
    || env.FOCUS_PET_CLOUD_STEPFUN_ENDPOINT
    || DEFAULT_STEPFUN_ENDPOINT,
    { provider: 'stepfun' }
  );
  const model = cleanText(
    env.FOCUS_PET_CLOUD_SCREEN_LLM_MODEL
    || env.FOCUS_PET_SCREEN_LLM_MODEL
    || DEFAULT_STEPFUN_SCREEN_MODEL,
    120
  );
  const apiKey = String(
    env.FOCUS_PET_CLOUD_STEPFUN_API_KEY
    || env.FOCUS_PET_CLOUD_SCREEN_LLM_API_KEY
    || env.FOCUS_PET_SCREEN_LLM_API_KEY
    || env.FOCUS_PET_STEPFUN_API_KEY
    || env.STEPFUN_API_KEY
    || env.STEP_API_KEY
    || ''
  ).trim();
  const missing = [];
  if (!endpoint) missing.push('endpoint');
  if (!model) missing.push('model');
  if (!apiKey) missing.push('apiKey');
  return {
    provider: 'stepfun',
    endpoint,
    model,
    apiKey,
    configured: missing.length === 0,
    missing
  };
}

function normalizeCloudScreenCheckPayload(input = {}, options = {}) {
  const imageInput = input.image && typeof input.image === 'object' ? input.image : input;
  const dataUrl = String(imageInput.dataUrl || input.dataUrl || '').trim();
  if (!/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/i.test(dataUrl)) {
    const error = new Error('image dataUrl required');
    error.statusCode = 400;
    throw error;
  }
  const maxImageBytes = options.maxImageBytes || DEFAULT_SCREEN_CHECK_MAX_IMAGE_BYTES;
  if (Buffer.byteLength(dataUrl, 'utf8') > maxImageBytes) {
    const error = new Error('image dataUrl too large');
    error.statusCode = 413;
    throw error;
  }
  const currentTask = input.currentTask && typeof input.currentTask === 'object'
    ? { text: cleanText(input.currentTask.text, 160) }
    : null;
  const frontmost = input.frontmost && typeof input.frontmost === 'object'
    ? {
      app: cleanText(input.frontmost.app, 80),
      title: cleanText(input.frontmost.title, 140)
    }
    : {};
  return {
    image: {
      dataUrl,
      sourceName: cleanText(imageInput.sourceName, 80) || 'Screen',
      size: imageInput.size && typeof imageInput.size === 'object'
        ? {
          width: Math.max(0, Math.round(Number(imageInput.size.width) || 0)),
          height: Math.max(0, Math.round(Number(imageInput.size.height) || 0))
        }
        : null
    },
    currentTask,
    frontmost
  };
}

function screenCheckClientAddress(req = {}) {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || String(req.socket?.remoteAddress || 'unknown');
}

function screenCheckRateLimitKey(req = {}) {
  const deviceId = deviceIdFromRequest(req);
  return secretHash(`${deviceId || 'anonymous'}|${screenCheckClientAddress(req)}`);
}

function consumeCloudScreenCheckRateLimit(key, options = {}) {
  const config = cloudScreenCheckRateLimitConfig(options.env || process.env);
  const nowMs = Date.parse(nowIso(options));
  const currentMs = Number.isFinite(nowMs) ? nowMs : Date.now();
  const existing = screenCheckRateBuckets.get(key);
  if (!existing || currentMs - existing.windowStartMs >= config.windowMs) {
    screenCheckRateBuckets.set(key, { windowStartMs: currentMs, count: 1 });
    return { allowed: true, remaining: Math.max(0, config.max - 1), limit: config.max, windowMs: config.windowMs };
  }
  if (existing.count >= config.max) {
    const retryAfterMs = Math.max(0, config.windowMs - (currentMs - existing.windowStartMs));
    return {
      allowed: false,
      remaining: 0,
      limit: config.max,
      windowMs: config.windowMs,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000)
    };
  }
  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, config.max - existing.count),
    limit: config.max,
    windowMs: config.windowMs
  };
}

async function handleCloudScreenCheck({
  body = {},
  env = process.env,
  fetchImpl = fetch,
  now = () => new Date(),
  requestTimeoutMs = cloudScreenCheckTimeoutMs(env)
} = {}) {
  const time = nowIso({ now });
  const config = cloudScreenCheckLlmConfig(env);
  if (!config.configured) {
    return {
      ok: false,
      status: 'needs-config',
      reason: 'Focus Pet Cloud 需要在后端配置 StepFun API key 后才能进行屏幕检查',
      missing: config.missing,
      time
    };
  }
  let payload;
  try {
    payload = normalizeCloudScreenCheckPayload(body, { maxImageBytes: cloudScreenCheckMaxImageBytes(env) });
  } catch (error) {
    return {
      ok: false,
      status: error.statusCode === 413 ? 'payload-too-large' : 'bad-request',
      reason: error.message,
      time
    };
  }
  try {
    const analysis = await callVisionModel({
      config,
      image: payload.image,
      currentTask: payload.currentTask,
      frontmost: payload.frontmost,
      fetchImpl,
      requestTimeoutMs
    });
    return {
      ok: true,
      source: 'focus-pet-cloud-stepfun',
      time,
      screenshotPolicy: {
        detail: 'low',
        storedToDisk: false,
        returnedToClient: false,
        requestTimeoutMs
      },
      ...analysis,
      message: statusMessage(analysis)
    };
  } catch (error) {
    if (error?.name === 'ScreenMonitorTimeoutError') {
      return {
        ok: false,
        status: 'timeout',
        reason: 'StepFun 屏幕检查请求超时，已丢弃本次结果',
        time
      };
    }
    throw error;
  }
}

function bearerToken(reqOrUrl = {}) {
  const header = String(reqOrUrl.headers?.authorization || '').trim();
  if (/^Bearer\s+/i.test(header)) return header.replace(/^Bearer\s+/i, '').trim();
  try {
    const url = new URL(reqOrUrl.url || '', 'http://127.0.0.1');
    return String(url.searchParams.get('token') || '').trim();
  } catch {
    return '';
  }
}

function deviceIdFromRequest(reqOrUrl = {}) {
  if (reqOrUrl.headers?.['x-focus-pet-device-id']) return String(reqOrUrl.headers['x-focus-pet-device-id']);
  try {
    const url = new URL(reqOrUrl.url || '', 'http://127.0.0.1');
    return String(url.searchParams.get('deviceId') || '');
  } catch {
    return '';
  }
}

function authFromRequest(req, state = loadState()) {
  return resolveUserAuth(bearerToken(req), state, { deviceId: deviceIdFromRequest(req) });
}

async function parseJson(req, options = {}) {
  const chunks = [];
  let totalBytes = 0;
  const maxBytes = Number(options.maxBytes) || 0;
  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (maxBytes && totalBytes > maxBytes) {
      const error = new Error('request body too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : {};
}

function jsonResponse(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type, authorization, x-focus-pet-device-id',
    'access-control-allow-methods': 'GET,POST,OPTIONS'
  });
  res.end(JSON.stringify(body));
}

function htmlResponse(res, status, body) {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'content-security-policy': "default-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; media-src 'self' blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline'"
  });
  res.end(body);
}

function cloudClientHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Focus Pet</title>
<style>
:root{color-scheme:light dark;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#f7f8fb;color:#15171c}
body{margin:0;min-height:100vh;background:#f7f8fb;color:#15171c}
button,input,select{font:inherit}
.shell{max-width:1120px;margin:0 auto;padding:28px;display:grid;gap:18px}
.top{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid #d9dde6;padding-bottom:14px}
.brand{font-size:22px;font-weight:700}
.status{color:#667085;font-size:13px}
.grid{display:grid;grid-template-columns:280px 1fr;gap:18px;align-items:start}
.panel{background:#fff;border:1px solid #d9dde6;border-radius:8px;padding:16px;box-shadow:0 8px 24px rgba(20,28,45,.06)}
.stack{display:grid;gap:12px}
.row{display:flex;gap:10px;align-items:center}
.row>*{min-width:0}
input,select{width:100%;box-sizing:border-box;border:1px solid #c7cfdd;border-radius:6px;padding:10px 11px;background:#fff;color:#15171c}
button{border:0;border-radius:6px;padding:10px 12px;background:#246bfe;color:#fff;cursor:pointer;white-space:nowrap}
button.secondary{background:#edf1f7;color:#1f2937}
button.danger{background:#d92d20}
button:disabled{opacity:.45;cursor:not-allowed}
.identity{display:grid;gap:6px;font-size:13px}
.identity b{font-size:20px;letter-spacing:.02em}
.friends{display:grid;gap:8px}
.friend{display:flex;justify-content:space-between;gap:10px;border:1px solid #e3e8f2;border-radius:6px;padding:10px;background:#fbfcff}
.friend span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.friend em{font-style:normal;color:#667085;font-size:12px}
.stage{display:grid;grid-template-columns:1fr 1fr;gap:12px}
video{width:100%;aspect-ratio:16/10;background:#111827;border-radius:8px;object-fit:cover}
.hidden{display:none!important}
@media(max-width:760px){.shell{padding:18px}.grid{grid-template-columns:1fr}.top{align-items:flex-start;flex-direction:column}.stage{grid-template-columns:1fr}}
</style>
</head>
<body>
<main class="shell">
  <div class="top"><div class="brand">Focus Pet</div><div id="status" class="status">未连接</div></div>
  <section id="registerPanel" class="panel stack">
    <input id="displayName" maxlength="40" placeholder="昵称">
    <button id="registerButton">创建我的 ID</button>
  </section>
  <section id="appPanel" class="grid hidden">
    <aside class="panel stack">
      <div class="identity"><span>我的好友码</span><b id="friendCode">-</b><span id="selfName">-</span></div>
      <div class="row"><input id="addFriendCode" maxlength="20" placeholder="输入好友码"><button id="addFriendButton">添加</button></div>
      <div id="friends" class="friends"></div>
    </aside>
    <section class="panel stack">
      <div class="row"><select id="friendSelect" aria-label="好友"></select></div>
      <div class="row"><button id="callAudio">语音</button><button id="callVideo">视频</button><button id="callEnd" class="danger">挂断</button><button id="refreshButton" class="secondary">刷新</button></div>
      <div class="stage"><video id="localVideo" muted autoplay playsinline></video><video id="remoteVideo" autoplay playsinline></video></div>
      <div id="callStatus" class="status">未通话</div>
    </section>
  </section>
</main>
<script>
const TOKEN_KEY='focusPetCloudAuthToken';const DEVICE_KEY='focusPetCloudDeviceId';let token=localStorage.getItem(TOKEN_KEY)||'';let state={self:null,friends:[],iceServers:[]};let ws;let pc;let localStream;let currentCall=null;
const el=id=>document.getElementById(id);function deviceId(){let value=localStorage.getItem(DEVICE_KEY);if(!value){value='device-'+Date.now()+'-'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);localStorage.setItem(DEVICE_KEY,value)}return value}
function setStatus(text){el('status').textContent=text}function authHeaders(extra={}){return{...extra,authorization:'Bearer '+token,'x-focus-pet-device-id':deviceId()}}
async function api(path,options={}){const headers=options.auth===false?options.headers||{}:authHeaders(options.headers||{});const res=await fetch(path,{...options,headers});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||res.statusText);return data}
function render(){const signedIn=Boolean(token&&state.self);el('registerPanel').classList.toggle('hidden',signedIn);el('appPanel').classList.toggle('hidden',!signedIn);if(!signedIn)return;el('friendCode').textContent=state.self.friendCode||'-';el('selfName').textContent=state.self.displayName||state.self.id||'-';const friends=state.friends||[];el('friends').innerHTML='';el('friendSelect').innerHTML='';for(const friend of friends){const option=document.createElement('option');option.value=friend.id;option.textContent=friend.displayName+(friend.online?' · 在线':' · 离线');el('friendSelect').appendChild(option);const row=document.createElement('div');row.className='friend';const name=document.createElement('span');name.textContent=friend.displayName;const online=document.createElement('em');online.textContent=friend.online?'在线':'离线';row.append(name,online);el('friends').appendChild(row)}}
async function register(){const displayName=el('displayName').value.trim()||'Focus Pet User';const data=await fetch('/api/users',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({displayName,deviceId:deviceId()})}).then(res=>res.json());token=data.authToken||'';if(!token)throw new Error('注册失败');localStorage.setItem(TOKEN_KEY,token);state={self:data.user,friends:[],iceServers:data.iceServers||[]};render();await refresh();connect()}
async function refresh(){if(!token){render();return}state=await api('/api/me');render();connect()}
async function addFriend(){const friendCode=el('addFriendCode').value.trim();if(!friendCode)return;await api('/api/friends',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({friendCode})});el('addFriendCode').value='';await refresh()}
function selectedFriend(){return el('friendSelect').value||''}function wsUrl(){const url=new URL(location.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.search='?token='+encodeURIComponent(token)+'&deviceId='+encodeURIComponent(deviceId());return url.toString()}
function connect(){if(!token||ws&&ws.readyState<=1)return;ws=new WebSocket(wsUrl());ws.onopen=()=>setStatus('已连接');ws.onclose=()=>setStatus('已断开');ws.onmessage=event=>{const data=JSON.parse(event.data);handleSignal(data.event,data.payload||{})}}
function send(type,payload={}){if(!ws||ws.readyState!==1)return;ws.send(JSON.stringify({type,to:payload.to||selectedFriend(),callId:payload.callId||currentCall?.callId,mode:payload.mode||currentCall?.mode||'audio',...payload}))}
async function ensurePeer(mode){pc=new RTCPeerConnection({iceServers:state.iceServers||[]});pc.onicecandidate=event=>{if(event.candidate)send('rtc-ice',{candidate:event.candidate})};pc.ontrack=event=>{el('remoteVideo').srcObject=event.streams[0]};localStream=await navigator.mediaDevices.getUserMedia({audio:true,video:mode==='video'});el('localVideo').srcObject=localStream;for(const track of localStream.getTracks())pc.addTrack(track,localStream)}
async function startCall(mode){const to=selectedFriend();if(!to)return;currentCall={to,callId:'call-'+Date.now()+'-'+Math.random().toString(36).slice(2),mode};await ensurePeer(mode);send('call-invite',{to,callId:currentCall.callId,mode});const offer=await pc.createOffer();await pc.setLocalDescription(offer);send('rtc-offer',{to,callId:currentCall.callId,mode,sdp:offer});el('callStatus').textContent='呼叫中'}
async function answerCall(payload){currentCall={to:payload.from,callId:payload.callId,mode:payload.mode||'audio'};await ensurePeer(currentCall.mode);await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));const answer=await pc.createAnswer();await pc.setLocalDescription(answer);send('rtc-answer',{to:payload.from,callId:payload.callId,mode:currentCall.mode,sdp:answer});el('callStatus').textContent='通话中'}
async function handleSignal(event,payload){if(event==='state'){state=payload;render();return}if(event==='call-invite'){currentCall={to:payload.from,callId:payload.callId,mode:payload.mode};el('callStatus').textContent='来电'}if(event==='rtc-offer')return answerCall(payload);if(event==='rtc-answer'&&pc){await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));el('callStatus').textContent='通话中'}if(event==='rtc-ice'&&pc&&payload.candidate)await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));if(event==='call-end'||event==='call-cancel'||event==='call-unavailable')endCall(false)}
function endCall(notify=true){if(notify&&currentCall)send('call-end',{to:currentCall.to,callId:currentCall.callId,mode:currentCall.mode});if(pc)pc.close();pc=null;if(localStream)localStream.getTracks().forEach(track=>track.stop());localStream=null;el('localVideo').srcObject=null;el('remoteVideo').srcObject=null;currentCall=null;el('callStatus').textContent='未通话'}
el('registerButton').onclick=()=>register().catch(error=>setStatus(error.message));el('addFriendButton').onclick=()=>addFriend().catch(error=>setStatus(error.message));el('refreshButton').onclick=()=>refresh().catch(error=>setStatus(error.message));el('callAudio').onclick=()=>startCall('audio').catch(error=>setStatus(error.message));el('callVideo').onclick=()=>startCall('video').catch(error=>setStatus(error.message));el('callEnd').onclick=()=>endCall(true);refresh().catch(()=>{token='';localStorage.removeItem(TOKEN_KEY);render()});
</script>
</body>
</html>`;
}

function requestPublicBaseUrl(req = {}) {
  const configured = String(process.env.FOCUS_PET_CLOUD_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (/^https?:\/\//i.test(configured)) return configured;
  const requestHost = String(req.headers?.host || '').trim();
  if (requestHost) return `${req.socket?.encrypted ? 'https' : serverProtocol}://${requestHost}`.replace(/\/$/, '');
  return `${serverProtocol}://127.0.0.1:${currentPort()}`;
}

function currentPort() {
  return port;
}

function healthState(options = {}) {
  const state = options.state || loadState(options);
  const env = options.env || process.env;
  const screenCheck = cloudScreenCheckLlmConfig(env);
  const rateLimit = cloudScreenCheckRateLimitConfig(env);
  return {
    service: 'focus-pet-cloud',
    ok: true,
    users: (state.users || []).length,
    friendships: (state.friendships || []).length,
    websocket: {
      enabled: true,
      clients: clients.size
    },
    rtc: rtcIceServerSummary(env),
    screenCheck: {
      enabled: screenCheck.configured,
      provider: screenCheck.provider,
      endpointConfigured: Boolean(screenCheck.endpoint),
      modelConfigured: Boolean(screenCheck.model),
      apiKeyConfigured: Boolean(screenCheck.apiKey),
      maxImageBytes: cloudScreenCheckMaxImageBytes(env),
      timeoutMs: cloudScreenCheckTimeoutMs(env),
      rateLimit
    }
  };
}

function sendSocket(socket, event, payload) {
  if (!socket || socket.readyState !== 1) return false;
  socket.send(JSON.stringify({ event, payload }));
  return true;
}

function sendToUser(userId, event, payload) {
  let delivered = 0;
  for (const client of clients.values()) {
    if (client.userId !== userId) continue;
    if (sendSocket(client.socket, event, payload)) delivered += 1;
  }
  return delivered;
}

async function handleApi(req, res) {
  if (req.method === 'OPTIONS') return jsonResponse(res, 204, {});
  const url = new URL(req.url || '/', requestPublicBaseUrl(req));
  if (req.method === 'GET' && url.pathname === '/client') return htmlResponse(res, 200, cloudClientHtml());
  if (req.method === 'GET' && url.pathname === '/healthz') return jsonResponse(res, 200, healthState());
  if (req.method === 'POST' && url.pathname === '/api/users') {
    const body = await parseJson(req);
    const result = registerUser(body);
    return jsonResponse(res, 200, {
      user: result.user,
      authToken: result.authToken,
      deviceId: result.deviceId,
      iceServers: rtcIceServers()
    });
  }
  if (req.method === 'POST' && url.pathname === '/api/screen-check') {
    const rateLimit = consumeCloudScreenCheckRateLimit(screenCheckRateLimitKey(req), { env: process.env });
    if (!rateLimit.allowed) {
      return jsonResponse(res, 429, {
        ok: false,
        status: 'rate-limited',
        reason: '屏幕检查请求过于频繁，请稍后重试',
        retryAfterSeconds: rateLimit.retryAfterSeconds
      });
    }
    let body;
    try {
      body = await parseJson(req, { maxBytes: cloudScreenCheckMaxBodyBytes(process.env) });
    } catch (error) {
      return jsonResponse(res, error.statusCode === 413 ? 413 : 400, {
        ok: false,
        status: error.statusCode === 413 ? 'payload-too-large' : 'bad-request',
        reason: error.message
      });
    }
    let result;
    try {
      result = await handleCloudScreenCheck({
        body,
        env: process.env,
        fetchImpl: fetch,
        requestTimeoutMs: cloudScreenCheckTimeoutMs(process.env)
      });
    } catch {
      return jsonResponse(res, 502, {
        ok: false,
        status: 'upstream-error',
        reason: '屏幕检查服务暂时不可用'
      });
    }
    const status = result.status === 'payload-too-large'
      ? 413
      : result.status === 'bad-request'
        ? 400
        : result.status === 'timeout'
          ? 504
          : 200;
    return jsonResponse(res, status, result);
  }
  const state = loadState();
  const auth = authFromRequest(req, state);
  if (!auth) return jsonResponse(res, 401, { error: 'unauthorized' });
  if (req.method === 'GET' && url.pathname === '/api/me') return jsonResponse(res, 200, clientStateForUser(auth, state, { env: process.env }));
  if (req.method === 'GET' && url.pathname === '/api/ice') return jsonResponse(res, 200, { iceServers: rtcIceServers() });
  if (req.method === 'POST' && url.pathname === '/api/friends') {
    const body = await parseJson(req);
    const result = addFriendByCode(body.friendCode, { state, auth });
    if (!result.ok) {
      const status = result.error === 'friend not found' ? 404 : 400;
      return jsonResponse(res, status, { ok: false, error: result.error });
    }
    const saved = saveState(result.state);
    broadcastStateToUserAndFriends(auth.userId, saved);
    if (result.friend?.id) broadcastStateToUserAndFriends(result.friend.id, saved);
    return jsonResponse(res, 200, { ok: true, friend: result.friend });
  }
  return jsonResponse(res, 404, { error: 'not found' });
}

function tlsOptions() {
  const keyPath = process.env.FOCUS_PET_CLOUD_TLS_KEY;
  const certPath = process.env.FOCUS_PET_CLOUD_TLS_CERT;
  if (!keyPath || !certPath) return null;
  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
}

function startedInfo() {
  return {
    service: 'focus-pet-cloud',
    host,
    port: currentPort(),
    protocol: serverProtocol,
    publicUrl: process.env.FOCUS_PET_CLOUD_PUBLIC_URL || `${serverProtocol}://127.0.0.1:${currentPort()}`,
    dataDir: DATA_DIR
  };
}

function start() {
  if (server) return startedInfo();
  port = readPort(process.env.FOCUS_PET_CLOUD_PORT, process.env.PORT, port, DEFAULT_PORT);
  host = process.env.FOCUS_PET_CLOUD_HOST || host || DEFAULT_HOST;
  ensureDirs();
  loadState();
  const tls = tlsOptions();
  serverProtocol = tls ? 'https' : 'http';
  server = (tls ? https : http).createServer(tls || {}, (req, res) => {
    handleApi(req, res).catch(error => jsonResponse(res, 500, { error: error.message }));
  });
  let resolveReady;
  let rejectReady;
  readyPromise = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  server.once('listening', () => {
    const address = server.address();
    if (address && typeof address === 'object' && address.port) port = address.port;
    resolveReady(startedInfo());
  });
  server.on('error', error => {
    if (error.code === 'EADDRINUSE') {
      port += 1;
      server.listen(port, host);
      return;
    }
    rejectReady(error);
    throw error;
  });
  wss = new WebSocketServer({ server });
  wss.on('connection', (socket, req) => {
    const state = loadState();
    const auth = authFromRequest(req, state);
    if (!auth) {
      socket.close(1008, 'unauthorized');
      return;
    }
    const id = randomUUID();
    clients.set(id, { socket, userId: auth.userId, auth });
    sendSocket(socket, 'state', clientStateForUser(auth, state, { env: process.env }));
    broadcastStateToUserAndFriends(auth.userId, state);
    socket.on('message', raw => {
      try {
        const input = JSON.parse(raw.toString());
        if (!REALTIME_EVENTS.has(input.type)) return;
        const currentState = loadState();
        const realtime = normalizeCloudRealtimeEvent(input, auth, currentState);
        const delivered = sendToUser(realtime.payload.to, realtime.event, realtime.payload);
        recordCloudRealtimeAudit(realtime, delivered);
        if (!delivered) sendSocket(socket, 'call-unavailable', realtime.payload);
      } catch (error) {
        sendSocket(socket, 'error', error.message);
      }
    });
    socket.on('close', () => {
      clients.delete(id);
      broadcastStateToUserAndFriends(auth.userId, loadState());
    });
  });
  server.listen(port, host);
  return startedInfo();
}

function ready() {
  return readyPromise.then(() => startedInfo());
}

function stop() {
  if (wss) wss.close();
  if (server) server.close();
  wss = null;
  server = null;
  readyPromise = Promise.resolve(null);
  clients.clear();
}

module.exports = {
  CLOUD_STATE_VERSION,
  DATA_DIR,
  STATE_PATH,
  createInitialCloudState,
  migrateCloudState,
  registerUser,
  resolveUserAuth,
  addFriendByCode,
  clientStateForUser,
  normalizeCloudRealtimeEvent,
  recordCloudRealtimeAudit,
  normalizeCallAuditLog,
  cloudScreenCheckLlmConfig,
  handleCloudScreenCheck,
  normalizeCloudScreenCheckPayload,
  consumeCloudScreenCheckRateLimit,
  rtcIceServers,
  rtcIceServerSummary,
  healthState,
  start,
  ready,
  stop
};
