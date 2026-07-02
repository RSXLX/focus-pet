const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const os = require('node:os');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { WebSocketServer } = require('ws');
const { readJsonWithRecovery, writeJsonAtomic } = require('./json-storage');

const DEFAULT_DATA_DIR = path.join(os.homedir(), '.hermes', 'focus-pet-cloud');
const DATA_DIR = path.resolve(process.env.FOCUS_PET_CLOUD_DATA_DIR || DEFAULT_DATA_DIR);
const STATE_PATH = path.join(DATA_DIR, 'cloud-state.json');
const DEFAULT_HOST = process.env.FOCUS_PET_CLOUD_HOST || '0.0.0.0';
const DEFAULT_PORT = readPort(process.env.FOCUS_PET_CLOUD_PORT, process.env.PORT, 47821);
const CLOUD_STATE_VERSION = 1;
const DEFAULT_RTC_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
const CALL_AUDIT_LOG_LIMIT = 500;
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

function readPort(...values) {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    const candidate = Number(value);
    if (Number.isInteger(candidate) && candidate >= 0 && candidate <= 65535) return candidate;
  }
  return 47821;
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

function rtcIceServers(env = process.env) {
  const raw = String(env.FOCUS_PET_CLOUD_RTC_ICE_SERVERS || env.FOCUS_PET_RTC_ICE_SERVERS || '').trim();
  if (!raw) return DEFAULT_RTC_ICE_SERVERS;
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
    return normalized.length ? normalized : DEFAULT_RTC_ICE_SERVERS;
  } catch {
    return DEFAULT_RTC_ICE_SERVERS;
  }
}

function flattenIceUrls(serverList) {
  return serverList.flatMap(item => Array.isArray(item.urls) ? item.urls : [item.urls]).filter(Boolean).map(String);
}

function rtcIceServerSummary(env = process.env) {
  const configured = Boolean(String(env.FOCUS_PET_CLOUD_RTC_ICE_SERVERS || env.FOCUS_PET_RTC_ICE_SERVERS || '').trim());
  const servers = rtcIceServers(env);
  const urls = flattenIceUrls(servers);
  const stunCount = urls.filter(url => /^stuns?:/i.test(url)).length;
  const turnCount = urls.filter(url => /^turns?:/i.test(url)).length;
  return {
    configured,
    usingDefault: !configured,
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

async function parseJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
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
  return {
    service: 'focus-pet-cloud',
    ok: true,
    users: (state.users || []).length,
    friendships: (state.friendships || []).length,
    websocket: {
      enabled: true,
      clients: clients.size
    },
    rtc: rtcIceServerSummary(options.env || process.env)
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
  const state = loadState();
  const auth = authFromRequest(req, state);
  if (!auth) return jsonResponse(res, 401, { error: 'unauthorized' });
  if (req.method === 'GET' && url.pathname === '/api/me') return jsonResponse(res, 200, clientStateForUser(auth, state, { env: process.env }));
  if (req.method === 'GET' && url.pathname === '/api/ice') return jsonResponse(res, 200, { iceServers: rtcIceServers() });
  if (req.method === 'POST' && url.pathname === '/api/friends') {
    const body = await parseJson(req);
    const result = addFriendByCode(body.friendCode, { state, auth });
    saveState(result.state);
    return jsonResponse(res, 200, result);
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
  rtcIceServers,
  rtcIceServerSummary,
  healthState,
  start,
  ready,
  stop
};
