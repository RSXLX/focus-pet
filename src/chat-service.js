const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const os = require('node:os');
const { WebSocketServer } = require('ws');
const { randomUUID, createHash } = require('node:crypto');
const { createSettingsStore, normalizeSocialActivityShareLevel } = require('./settings-store');
const { readJsonWithRecovery, writeJsonAtomic } = require('./json-storage');

const DEFAULT_DATA_DIR = path.join(os.homedir(), '.hermes', 'focus-watchdog', 'social');
const DATA_DIR = path.resolve(process.env.FOCUS_PET_CHAT_DATA_DIR || DEFAULT_DATA_DIR);
const MEDIA_DIR = path.join(DATA_DIR, 'media');
const STATE_PATH = path.join(DATA_DIR, 'chat-state.json');
const DEFAULT_PORT = readPort(process.env.FOCUS_PET_CHAT_PORT, process.env.PORT, 47321);
const DEFAULT_HOST = process.env.FOCUS_PET_CHAT_HOST || '0.0.0.0';
const CHAT_STATE_VERSION = 1;
const MAX_MEDIA_BYTES = 25 * 1024 * 1024;
const CALL_AUDIT_LOG_LIMIT = 300;
const DAY_MS = 24 * 60 * 60 * 1000;
const INVITE_TTL_MS = 7 * DAY_MS;
const SESSION_TTL_MS = 30 * DAY_MS;
const INVITE_ATTEMPT_LIMIT = 5;
const INVITE_ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const ALLOWED_MEDIA_PREFIXES = ['image/', 'video/', 'audio/'];
const CHAT_FILE_ACCEPT = 'image/*,video/*,audio/*,.pdf,.txt,.md,.csv,.json,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
const ALLOWED_FILE_MIME_TYPES = new Set([
  'application/pdf',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'text/csv'
]);
const ALLOWED_FILE_EXTENSIONS = new Set([
  '.pdf',
  '.txt',
  '.md',
  '.csv',
  '.json',
  '.zip',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx'
]);
const OWNER_ROLE = 'owner';
const PEER_ROLE = 'peer';
const OWNER_APP_MODE = 'owner';
const PEER_APP_MODE = 'peer';
const ACTIVITY_STATUSES = new Set(['work', 'study', 'rest', 'game', 'distracted', 'unknown']);
const DEFAULT_RTC_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];
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
const CALL_AUDIT_EVENTS = new Set([...REALTIME_EVENTS, 'call-unavailable']);

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
  return 47321;
}

function ensureDirs() {
  fs.mkdirSync(MEDIA_DIR, { recursive: true });
}

function makeToken() {
  return randomUUID().replaceAll('-', '') + randomUUID().replaceAll('-', '');
}

function makeInviteCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function normalizeHostForUrl(value) {
  const clean = String(value || '').trim();
  if (clean.includes(':') && !clean.startsWith('[')) return `[${clean}]`;
  return clean;
}

function isWildcardHost(value) {
  const clean = String(value || '').trim();
  return !clean || clean === '0.0.0.0' || clean === '::' || clean === '[::]';
}

function isLoopbackHost(value) {
  return ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(String(value || '').trim());
}

function localNetworkAddress() {
  const addresses = [];
  for (const items of Object.values(os.networkInterfaces())) {
    for (const item of items || []) {
      if (item.family !== 'IPv4' || item.internal || !item.address) continue;
      const privateRank = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(item.address) ? 0 : 1;
      addresses.push({ address: item.address, rank: privateRank });
    }
  }
  addresses.sort((left, right) => left.rank - right.rank || left.address.localeCompare(right.address));
  return addresses[0]?.address || '127.0.0.1';
}

function advertisedHost() {
  const cleanHost = String(host || '').trim();
  if (isWildcardHost(cleanHost) || isLoopbackHost(cleanHost)) return localNetworkAddress();
  return cleanHost;
}

function publicBaseUrl(options = {}) {
  const configured = String(process.env.FOCUS_PET_CHAT_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (/^https?:\/\//i.test(configured)) return configured;
  if (options.requestHost) {
    const protocol = options.protocol || serverProtocol || 'http';
    return `${protocol}://${options.requestHost}`.replace(/\/$/, '');
  }
  return `${serverProtocol}://${normalizeHostForUrl(advertisedHost())}:${currentPort()}`;
}

function nowIso(options = {}) {
  const value = typeof options.now === 'function' ? options.now() : options.now;
  const time = Date.parse(value || '');
  return new Date(Number.isFinite(time) ? time : Date.now()).toISOString();
}

function addDurationIso(value, durationMs) {
  const time = Date.parse(value || '');
  const base = Number.isFinite(time) ? time : Date.now();
  return new Date(base + durationMs).toISOString();
}

function timestampExpired(value, options = {}) {
  if (!value) return false;
  const expiresAt = Date.parse(value);
  if (!Number.isFinite(expiresAt)) return false;
  return expiresAt <= Date.parse(nowIso(options));
}

function timeMs(options = {}) {
  const time = Date.parse(nowIso(options));
  return Number.isFinite(time) ? time : Date.now();
}

function cleanInviteAttemptKey(value) {
  return String(value || '').trim().slice(0, 160);
}

function trustProxyForInviteAttempts(env = process.env) {
  return /^(1|true|yes)$/i.test(String(env.FOCUS_PET_CHAT_TRUST_PROXY || '').trim());
}

function inviteAttemptKeyFromRequest(req = {}, options = {}) {
  const env = options.env || process.env;
  const forwardedFor = trustProxyForInviteAttempts(env)
    ? String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim()
    : '';
  const remoteAddress = String(req.socket?.remoteAddress || '').trim();
  const source = forwardedFor || remoteAddress;
  return source ? `ip:${source}` : '';
}

function inviteAttemptStoreKey(key) {
  const cleanKey = cleanInviteAttemptKey(key);
  return cleanKey ? secretHash(cleanKey) : '';
}

function normalizeInviteAttemptRecord(record = {}) {
  const firstAttemptAtMs = Number(record.firstAttemptAtMs);
  const blockedUntilMs = Number(record.blockedUntilMs);
  const firstAttemptAt = Number.isFinite(Date.parse(record.firstAttemptAt || ''))
    ? new Date(Date.parse(record.firstAttemptAt)).toISOString()
    : Number.isFinite(firstAttemptAtMs)
      ? new Date(firstAttemptAtMs).toISOString()
      : '';
  if (!firstAttemptAt) return null;
  const count = Math.max(0, Math.floor(Number(record.count) || 0));
  if (!count) return null;
  const blockedUntil = Number.isFinite(Date.parse(record.blockedUntil || ''))
    ? new Date(Date.parse(record.blockedUntil)).toISOString()
    : Number.isFinite(blockedUntilMs) && blockedUntilMs > 0
      ? new Date(blockedUntilMs).toISOString()
      : '';
  return { firstAttemptAt, count, blockedUntil };
}

function normalizeInviteAttempts(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const attempts = {};
  for (const [key, record] of Object.entries(input)) {
    const storeKey = /^[a-f0-9]{64}$/i.test(key) ? key.toLowerCase() : inviteAttemptStoreKey(key);
    const normalized = normalizeInviteAttemptRecord(record || {});
    if (storeKey && normalized) attempts[storeKey] = normalized;
  }
  return attempts;
}

function inviteAttemptBucket(state, key, options = {}) {
  const storeKey = inviteAttemptStoreKey(key);
  if (!storeKey || !state) return null;
  state.inviteAttempts = normalizeInviteAttempts(state.inviteAttempts || {});
  const bucket = state.inviteAttempts[storeKey];
  if (!bucket) return null;
  const firstAttemptAtMs = Date.parse(bucket.firstAttemptAt);
  if (!Number.isFinite(firstAttemptAtMs)) {
    delete state.inviteAttempts[storeKey];
    return null;
  }
  const now = timeMs(options);
  if (now - firstAttemptAtMs >= INVITE_ATTEMPT_WINDOW_MS) {
    delete state.inviteAttempts[storeKey];
    return null;
  }
  return bucket;
}

function assertInviteAttemptAllowed(key, state, options = {}) {
  const bucket = inviteAttemptBucket(state, key, options);
  if (!bucket) return;
  const blockedUntilMs = Date.parse(bucket.blockedUntil || '');
  if (Number.isFinite(blockedUntilMs) && blockedUntilMs > timeMs(options)) {
    throw new Error('邀请码尝试过多，请稍后再试');
  }
}

function recordFailedInviteAttempt(key, state, options = {}) {
  const storeKey = inviteAttemptStoreKey(key);
  if (!storeKey || !state) return;
  const now = nowIso(options);
  const bucket = inviteAttemptBucket(state, key, options) || { firstAttemptAt: now, count: 0, blockedUntil: '' };
  bucket.count += 1;
  if (bucket.count >= INVITE_ATTEMPT_LIMIT) {
    bucket.blockedUntil = addDurationIso(bucket.firstAttemptAt, INVITE_ATTEMPT_WINDOW_MS);
  }
  state.inviteAttempts = {
    ...(state.inviteAttempts || {}),
    [storeKey]: normalizeInviteAttemptRecord(bucket)
  };
}

function clearInviteAttempts(key, state) {
  const storeKey = inviteAttemptStoreKey(key);
  if (storeKey && state?.inviteAttempts) delete state.inviteAttempts[storeKey];
}

function syncInviteAttemptsToInputState(inputState, state) {
  if (!inputState || typeof inputState !== 'object') return;
  inputState.inviteAttempts = JSON.parse(JSON.stringify(state.inviteAttempts || {}));
}

function originFromUrl(value = '') {
  try {
    const parsed = new URL(String(value || '').trim());
    if (!/^https?:$/.test(parsed.protocol)) return '';
    return parsed.origin;
  } catch {
    return '';
  }
}

function configuredAllowedOrigins(env = process.env) {
  return String(env.FOCUS_PET_CHAT_ALLOWED_ORIGINS || '')
    .split(/[\n,]/)
    .map(originFromUrl)
    .filter(Boolean);
}

function requestHostOrigin(req = {}) {
  const forwardedProto = String(req.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(req.headers?.['x-forwarded-host'] || '').split(',')[0].trim();
  const hostHeader = forwardedHost || req.headers?.host;
  if (!hostHeader) return '';
  const protocol = forwardedProto || (req.socket?.encrypted ? 'https' : serverProtocol || 'http');
  return originFromUrl(`${protocol}://${hostHeader}`);
}

function isAllowedRequestOrigin(req = {}, options = {}) {
  const rawOrigin = String(req.headers?.origin || '').trim();
  if (!rawOrigin) return true;
  if (options.allowFileOrigin && rawOrigin === 'file://') return true;
  const origin = originFromUrl(rawOrigin);
  if (!origin) return false;
  const allowed = new Set([
    requestHostOrigin(req),
    originFromUrl(publicBaseUrl()),
    ...configuredAllowedOrigins(options.env || process.env),
    ...(Array.isArray(options.allowedOrigins) ? options.allowedOrigins.map(originFromUrl) : [])
  ].filter(Boolean));
  return allowed.has(origin);
}

function corsHeaders(req = {}, options = {}) {
  const rawOrigin = String(req.headers?.origin || '').trim();
  const origin = originFromUrl(rawOrigin);
  const allowOrigin = origin && isAllowedRequestOrigin(req, options)
    ? origin
    : requestHostOrigin(req) || originFromUrl(publicBaseUrl()) || 'http://127.0.0.1';
  return {
    'access-control-allow-origin': allowOrigin,
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type, authorization, x-focus-pet-device-id',
    vary: 'Origin'
  };
}

function currentPort() {
  const address = server?.address?.();
  if (address && typeof address === 'object' && address.port) return address.port;
  return port;
}

function startedInfo() {
  return { port: currentPort(), host, publicUrl: publicBaseUrl(), protocol: serverProtocol };
}

function requestPublicBaseUrl(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const hostHeader = forwardedHost || req.headers.host;
  if (!hostHeader) return publicBaseUrl();
  return publicBaseUrl({
    protocol: forwardedProto || (req.socket.encrypted ? 'https' : serverProtocol),
    requestHost: hostHeader
  });
}

function tlsOptions() {
  const keyPath = String(process.env.FOCUS_PET_CHAT_TLS_KEY || '').trim();
  const certPath = String(process.env.FOCUS_PET_CHAT_TLS_CERT || '').trim();
  if (!keyPath || !certPath) return null;
  return {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
  };
}

function defaultState() {
  const createdAt = new Date().toISOString();
  return {
    version: CHAT_STATE_VERSION,
    authToken: makeToken(),
    inviteCode: makeInviteCode(),
    inviteCreatedAt: createdAt,
    inviteExpiresAt: addDurationIso(createdAt, INVITE_TTL_MS),
    self: { id: 'pet-owner', name: '我' },
    friends: [
      { id: 'demo-friend', name: '学习搭子', status: 'offline', lastSeenAt: null, unread: 0 }
    ],
    sessions: [],
    inviteAttempts: {},
    messages: [],
    activities: {},
    activityLog: [],
    callAuditLog: [],
    settings: {
      maxMediaMb: Math.round(MAX_MEDIA_BYTES / 1024 / 1024),
      popupCooldownMinutes: 8,
      socialActivityShareLevel: 'presence'
    }
  };
}

function normalizeState(state) {
  const fallback = defaultState();
  return {
    ...fallback,
    ...state,
    version: CHAT_STATE_VERSION,
    authToken: state.authToken || fallback.authToken,
    inviteCode: state.inviteCode || fallback.inviteCode,
    inviteCreatedAt: state.inviteCreatedAt || fallback.inviteCreatedAt,
    inviteExpiresAt: state.inviteExpiresAt || fallback.inviteExpiresAt,
    self: normalizeSelf(state.self, fallback.self),
    friends: Array.isArray(state.friends) ? normalizeFriends(state.friends) : fallback.friends,
    sessions: Array.isArray(state.sessions) ? normalizeSessions(state.sessions) : fallback.sessions,
    inviteAttempts: normalizeInviteAttempts(state.inviteAttempts || {}),
    messages: normalizeMessages(state.messages || []),
    activities: normalizeActivities(state.activities || {}),
    activityLog: normalizeActivityLog(state.activityLog || []),
    callAuditLog: normalizeCallAuditLog(state.callAuditLog || []),
    settings: {
      ...fallback.settings,
      ...(state.settings || {}),
      socialActivityShareLevel: normalizeSocialActivityShareLevel(state.settings?.socialActivityShareLevel || fallback.settings.socialActivityShareLevel)
    }
  };
}

function migrateChatState(state = {}) {
  return normalizeState(state || {});
}

function cleanText(value, maxLength = 220) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanNumber(value, min, max, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function sanitizeMedia(media = null) {
  if (!media || typeof media !== 'object') return null;
  return {
    id: String(media.id || '').slice(0, 160),
    name: cleanMediaName(media.name),
    mimeType: String(media.mimeType || '').slice(0, 80),
    size: Number(media.size) || 0,
    url: String(media.url || '').slice(0, 400)
  };
}

function sanitizeTask(task = null) {
  if (!task || typeof task !== 'object') return null;
  return {
    id: String(task.id || '').slice(0, 120),
    text: cleanText(task.text, 180),
    priority: cleanText(task.priority, 30),
    dueDate: cleanText(task.dueDate, 30)
  };
}

function sanitizeFrontmost(frontmost = null) {
  if (!frontmost || typeof frontmost !== 'object') return null;
  return {
    app: cleanText(frontmost.app, 80),
    title: cleanText(frontmost.title, 160)
  };
}

function sanitizeReview(review = null) {
  if (!review || typeof review !== 'object') return null;
  return {
    ok: Boolean(review.ok),
    status: cleanText(review.status, 40),
    summary: cleanText(review.summary, 220),
    insight: cleanText(review.insight, 260),
    petMessage: cleanText(review.petMessage, 220),
    tone: cleanText(review.tone, 40)
  };
}

function sharedReviewForPeer(review = null) {
  const safeReview = sanitizeReview(review);
  if (!safeReview?.insight) return null;
  return { insight: safeReview.insight };
}

function normalizeActivitySnapshot(input = {}, state = loadState(), auth = ownerAuth(state)) {
  const from = auth.role === OWNER_ROLE ? state.self.id : auth.peerId;
  const status = ACTIVITY_STATUSES.has(input.status) ? input.status : 'unknown';
  const activity = cleanText(input.activity, 180) || '暂时还不确定正在做什么';
  const suggestion = cleanText(input.suggestion, 180);
  return {
    id: String(input.id || randomUUID()).slice(0, 120),
    from,
    status,
    activity,
    reason: cleanText(input.reason, 260),
    suggestion,
    confidence: cleanNumber(input.confidence, 0, 1, 0),
    message: cleanText(input.message, 260) || `${activity}${suggestion ? `。${suggestion}` : ''}`,
    sourceName: cleanText(input.sourceName, 120),
    currentTask: sanitizeTask(input.currentTask),
    frontmost: sanitizeFrontmost(input.frontmost),
    review: sanitizeReview(input.review),
    media: sanitizeMedia(input.media),
    time: input.time || new Date().toISOString()
  };
}

function normalizeActivities(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const activities = {};
  for (const [peerId, activity] of Object.entries(input)) {
    const safePeerId = String(peerId || '').slice(0, 120);
    if (!safePeerId || !activity || typeof activity !== 'object') continue;
    const safeActivity = normalizeActivitySnapshot(activity, { ...defaultState(), self: { id: activity.from || safePeerId, name: '' } }, ownerAuth({ ...defaultState(), self: { id: activity.from || safePeerId, name: '' } }));
    activities[safePeerId] = { ...safeActivity, from: String(activity.from || safePeerId).slice(0, 120) };
  }
  return activities;
}

function normalizeSelf(self = {}, fallbackSelf = defaultState().self) {
  const input = self && typeof self === 'object' && !Array.isArray(self) ? self : {};
  return {
    ...fallbackSelf,
    ...input,
    id: String(input.id || fallbackSelf.id).slice(0, 120),
    name: cleanName(input.name, fallbackSelf.name)
  };
}

function normalizeStoredActivity(activity = {}, fallbackPeerId = '') {
  if (!activity || typeof activity !== 'object') return null;
  const safePeerId = String(activity.from || fallbackPeerId || '').slice(0, 120);
  if (!safePeerId) return null;
  return { ...normalizeActivitySnapshot(activity, { ...defaultState(), self: { id: safePeerId, name: '' } }, ownerAuth({ ...defaultState(), self: { id: safePeerId, name: '' } })), from: safePeerId };
}

function normalizeActivityLog(input = []) {
  if (!Array.isArray(input)) return [];
  return input
    .map(activity => normalizeStoredActivity(activity, activity?.from))
    .filter(Boolean)
    .slice(-500);
}

function normalizeFriend(friend = {}) {
  if (!friend || typeof friend !== 'object') return null;
  const id = String(friend.id || '').slice(0, 120);
  if (!id) return null;
  return {
    ...friend,
    id,
    name: cleanName(friend.name, '好友'),
    status: cleanText(friend.status, 30) || 'offline',
    lastSeenAt: cleanText(friend.lastSeenAt, 60) || null,
    unread: Math.max(0, Math.floor(Number(friend.unread) || 0))
  };
}

function normalizeFriends(input = []) {
  if (!Array.isArray(input)) return [];
  return input
    .map(friend => normalizeFriend(friend))
    .filter(Boolean);
}

function normalizeSession(session = {}) {
  if (!session || typeof session !== 'object') return null;
  const token = String(session.token || '').slice(0, 240);
  const peerId = String(session.peerId || '').slice(0, 120);
  if (!token || !peerId) return null;
  const createdAt = cleanText(session.createdAt, 60) || null;
  return {
    ...session,
    token,
    peerId,
    name: cleanName(session.name, '外部用户'),
    createdAt,
    lastSeenAt: cleanText(session.lastSeenAt, 60) || null,
    expiresAt: cleanText(session.expiresAt, 60) || (createdAt ? addDurationIso(createdAt, SESSION_TTL_MS) : null),
    deviceIdHash: String(session.deviceIdHash || deviceIdHash(session.deviceId || '')).slice(0, 64)
  };
}

function normalizeSessions(input = []) {
  if (!Array.isArray(input)) return [];
  return input
    .map(session => normalizeSession(session))
    .filter(Boolean);
}

function normalizeStoredMessage(message = {}) {
  if (!message || typeof message !== 'object') return null;
  const from = String(message.from || '').slice(0, 120);
  const to = String(message.to || '').slice(0, 120);
  if (!from || !to) return null;
  return {
    ...message,
    id: String(message.id || randomUUID()).slice(0, 120),
    clientId: cleanText(message.clientId, 160),
    from,
    to,
    type: cleanText(message.type, 40) || 'text',
    text: cleanText(message.text, 4000),
    media: sanitizeMedia(message.media),
    activity: message.activity && typeof message.activity === 'object'
      ? normalizeStoredActivity(message.activity, message.activity.from || from)
      : null,
    reaction: message.reaction && typeof message.reaction === 'object' ? { ...message.reaction } : null,
    deliveryStatus: cleanText(message.deliveryStatus, 30) || 'sent',
    createdAt: cleanText(message.createdAt, 60) || new Date().toISOString(),
    sentAt: cleanText(message.sentAt, 60) || null,
    deliveredAt: cleanText(message.deliveredAt, 60) || null,
    readAt: cleanText(message.readAt, 60) || null
  };
}

function normalizeMessages(input = []) {
  if (!Array.isArray(input)) return [];
  return input
    .map(message => normalizeStoredMessage(message))
    .filter(Boolean)
    .slice(-700);
}

function normalizeCallAuditEntry(input = {}) {
  if (!input || typeof input !== 'object') return null;
  const event = String(input.event || '');
  if (!CALL_AUDIT_EVENTS.has(event)) return null;
  const from = String(input.from || '').slice(0, 120);
  const to = String(input.to || '').slice(0, 120);
  const callId = String(input.callId || '').slice(0, 80);
  if (!from || !to || !callId) return null;
  const recipientClientCount = Math.max(0, Number(input.recipientClientCount) || 0);
  return {
    id: String(input.id || randomUUID()).slice(0, 120),
    event,
    from,
    to,
    callId,
    mode: input.mode === 'video' ? 'video' : 'audio',
    delivered: Boolean(input.delivered),
    recipientClientCount,
    time: input.time || new Date().toISOString()
  };
}

function normalizeCallAuditLog(input = []) {
  if (!Array.isArray(input)) return [];
  return input
    .map(entry => normalizeCallAuditEntry(entry))
    .filter(Boolean)
    .slice(-CALL_AUDIT_LOG_LIMIT);
}

function activityForPeer(state, peerId) {
  const activity = state.activities?.[peerId];
  return activity ? { ...normalizeActivitySnapshot(activity, state, ownerAuth(state)), from: String(activity.from || peerId).slice(0, 120) } : null;
}

function activityStatusMessage(status) {
  if (status === 'work') return '专注中';
  if (status === 'study') return '学习中';
  if (status === 'rest') return '休息中';
  if (status === 'game') return '游戏中';
  if (status === 'distracted') return '可能偏离';
  return '观察中';
}

function sharedActivityForLevel(activity, shareLevel = 'presence') {
  const level = normalizeSocialActivityShareLevel(shareLevel);
  if (level === 'presence') return null;
  if (!activity || typeof activity !== 'object') return null;
  const safeActivity = normalizeStoredActivity(activity, activity?.from);
  if (!safeActivity) return null;
  const base = {
    id: safeActivity.id,
    from: safeActivity.from,
    status: safeActivity.status,
    message: activityStatusMessage(safeActivity.status),
    shareLevel: level,
    time: safeActivity.time
  };
  if (level === 'status') return base;
  const summary = {
    ...base,
    activity: safeActivity.activity,
    suggestion: safeActivity.suggestion,
    confidence: safeActivity.confidence,
    message: safeActivity.activity || base.message
  };
  if (level === 'summary') return summary;
  return {
    ...summary,
    reason: safeActivity.reason,
    review: sharedReviewForPeer(safeActivity.review)
  };
}

function activitiesForAuth(state, auth, shareLevel = state.settings?.socialActivityShareLevel) {
  if (auth?.role === OWNER_ROLE) return normalizeActivities(state.activities || {});
  return {};
}

function canSeeActivity(auth, activity, state) {
  if (auth?.role === OWNER_ROLE) return true;
  return activity.from === state.self.id || activity.from === auth.peerId;
}

function messageForAuth(message, auth, state, shareLevel = state.settings?.socialActivityShareLevel) {
  if (auth?.role === OWNER_ROLE || !message?.activity) return message;
  return { ...message, activity: null };
}

function activityLogForAuth(state, auth, limit = 160, shareLevel = state.settings?.socialActivityShareLevel) {
  const log = normalizeActivityLog(state.activityLog || []);
  if (auth?.role === OWNER_ROLE) return log.slice(-limit);
  return [];
}

function hasOnlineRecipient(peerId) {
  return [...clients.values()].some(client => client.peerId === peerId && client.socket.readyState === client.socket.OPEN);
}

function normalizeMessage(input, state, options = {}) {
  const now = options.now || (() => new Date().toISOString());
  const id = options.id || randomUUID;
  const from = input.from || state.self.id;
  const to = input.to || state.friends[0]?.id || 'demo-friend';
  const outgoing = from === (options.localSenderId || state.self.id);
  const recipientOnline = Boolean(options.isRecipientOnline?.(to));
  const deliveryStatus = input.deliveryStatus || (outgoing ? (recipientOnline ? 'sent' : 'queued') : 'received');
  const createdAt = input.createdAt || now();
  return {
    id: input.id || id(),
    clientId: input.clientId || '',
    from,
    to,
    type: input.type || 'text',
    text: String(input.text || '').slice(0, 4000),
    media: input.media || null,
    activity: input.activity || null,
    reaction: input.reaction || null,
    deliveryStatus,
    createdAt,
    sentAt: input.sentAt || (['sent', 'delivered', 'read', 'received'].includes(deliveryStatus) ? createdAt : null),
    deliveredAt: input.deliveredAt || (['delivered', 'read'].includes(deliveryStatus) ? createdAt : null),
    readAt: input.readAt || (deliveryStatus === 'read' ? createdAt : null)
  };
}

function reconcileQueuedMessages(state, friendId, deliveryStatus = 'sent', at = new Date().toISOString()) {
  return {
    ...state,
    messages: (state.messages || []).map(message => {
      if (message.to !== friendId || message.deliveryStatus !== 'queued') return message;
      return {
        ...message,
        deliveryStatus,
        sentAt: message.sentAt || at,
        deliveredAt: ['delivered', 'read'].includes(deliveryStatus) ? (message.deliveredAt || at) : message.deliveredAt || null,
        readAt: deliveryStatus === 'read' ? (message.readAt || at) : message.readAt || null
      };
    })
  };
}

function loadState() {
  ensureDirs();
  if (!fs.existsSync(STATE_PATH)) saveState(defaultState());
  const result = readJsonWithRecovery(STATE_PATH, {
    fallback: defaultState(),
    backupLabel: 'chat-state',
    normalize: migrateChatState
  });
  saveState(result.value);
  return result.value;
}

function saveState(state) {
  ensureDirs();
  writeJsonAtomic(STATE_PATH, migrateChatState(state), { backupLabel: 'chat-state', maxBackups: 5 });
}

function tokenHash(token) {
  return createHash('sha256').update(String(token || '')).digest('hex').slice(0, 12);
}

function secretHash(value) {
  return createHash('sha256').update(String(value || '')).digest('hex');
}

function cleanDeviceId(value) {
  return String(value || '').trim().slice(0, 160);
}

function makeDeviceId() {
  return makeToken();
}

function deviceIdHash(value) {
  const clean = cleanDeviceId(value);
  return clean ? secretHash(clean) : '';
}

function cleanName(value, fallback = '外部用户') {
  return String(value || fallback).trim().slice(0, 40) || fallback;
}

function cleanMediaName(value, fallback = '') {
  const normalized = String(value || '').replace(/\\/g, '/');
  const baseName = path.basename(normalized).replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return (baseName || fallback).slice(0, 160);
}

function rtcIceServers(env = process.env) {
  const raw = String(env.FOCUS_PET_RTC_ICE_SERVERS || '').trim();
  if (!raw) return DEFAULT_RTC_ICE_SERVERS;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {}
  return raw.split(/[\n,]/).map(url => url.trim()).filter(Boolean).map(urls => ({ urls }));
}

function rtcIceServerUrls(server) {
  const rawUrls = Array.isArray(server?.urls) ? server.urls : [server?.urls];
  return rawUrls.map(url => String(url || '').trim()).filter(Boolean);
}

function rtcIceServerSummary(env = process.env) {
  const raw = String(env.FOCUS_PET_RTC_ICE_SERVERS || '').trim();
  const servers = rtcIceServers(env);
  const urls = servers.flatMap(rtcIceServerUrls);
  const stunCount = urls.filter(url => /^stuns?:/i.test(url)).length;
  const turnCount = urls.filter(url => /^turns?:/i.test(url)).length;
  const hasTurn = turnCount > 0;
  const usingDefault = !raw;

  return {
    configured: Boolean(raw),
    usingDefault,
    source: usingDefault ? 'default-stun' : 'env',
    serverCount: urls.length,
    stunCount,
    turnCount,
    hasStun: stunCount > 0,
    hasTurn,
    requiresTurn: !hasTurn,
    summary: hasTurn
      ? '已配置 TURN，复杂网络下实时通话更稳。'
      : usingDefault
        ? '当前使用默认 STUN，跨 NAT 或企业网络时通话可能不稳定。'
        : '已配置 ICE 服务器，但未检测到 TURN，复杂网络仍可能连接失败。',
    guidance: hasTurn
      ? '保持 FOCUS_PET_RTC_ICE_SERVERS 由受控环境变量管理；诊断只展示数量和状态，不输出地址、用户名或凭据。'
      : '建议通过 FOCUS_PET_RTC_ICE_SERVERS 配置 turn: 或 turns: 服务器；诊断只展示数量和状态，不输出地址、用户名或凭据。'
  };
}

function ownerAuth(state) {
  return { role: OWNER_ROLE, peerId: state.self.id, name: state.self.name, token: state.authToken };
}

function resolveAuth(token, state = loadState(), options = {}) {
  const cleanToken = String(token || '').trim();
  if (!cleanToken) return null;
  if (cleanToken === state.authToken) return ownerAuth(state);
  const session = (state.sessions || []).find(item => item.token === cleanToken);
  if (!session) return null;
  if (timestampExpired(session.expiresAt, options)) return null;
  if (session.deviceIdHash && session.deviceIdHash !== deviceIdHash(options.deviceId)) return null;
  const friend = state.friends.find(item => item.id === session.peerId);
  return {
    role: PEER_ROLE,
    peerId: session.peerId,
    name: friend?.name || session.name || '外部用户',
    token: cleanToken
  };
}

function onlineStatus(peerId) {
  return [...clients.values()].some(client => client.peerId === peerId && client.socket.readyState === client.socket.OPEN)
    ? 'online'
    : 'offline';
}

function friendWithRuntimeStatus(friend) {
  return {
    ...friend,
    status: onlineStatus(friend.id) === 'online' ? 'online' : friend.status || 'offline'
  };
}

function conversationMessagesForPeer(state, peerId, limit = 160, options = {}) {
  const auth = options.auth || { role: PEER_ROLE, peerId };
  const shareLevel = options.shareLevel || state.settings?.socialActivityShareLevel;
  return (state.messages || [])
    .filter(message => message.from === peerId || message.to === peerId)
    .slice(-limit)
    .map(message => messageForAuth(message, auth, state, shareLevel));
}

function clientStateForAuth(auth, inputState = loadState(), options = {}) {
  const state = normalizeState(inputState);
  const appSettings = createSettingsStore().getSettings();
  const rawSettings = inputState?.settings || {};
  const socialActivityShareLevel = normalizeSocialActivityShareLevel(
    options.settings?.socialActivityShareLevel || appSettings.socialActivityShareLevel || rawSettings.socialActivityShareLevel || state.settings.socialActivityShareLevel
  );
  const settings = {
    ...state.settings,
    maxMediaMb: appSettings.maxMediaMb,
    popupCooldownMinutes: appSettings.popupCooldownMinutes,
    socialActivityShareLevel
  };
  const base = {
    version: state.version || CHAT_STATE_VERSION,
    appMode: auth?.role === PEER_ROLE ? PEER_APP_MODE : OWNER_APP_MODE,
    capabilities: auth?.role === PEER_ROLE
      ? {
          role: PEER_APP_MODE,
          receivesActivitySnapshots: false,
          canPublishOwnActivity: true,
          canUseChatAndCalls: true
        }
      : {
          role: OWNER_APP_MODE,
          receivesRemoteActivitySnapshots: true,
          canViewFullActivitySnapshots: true,
          canUseChatAndCalls: true
        },
    tokenHint: tokenHash(auth?.token || state.authToken),
    settings,
    activities: activitiesForAuth(state, auth, socialActivityShareLevel),
    activityLog: activityLogForAuth(state, auth, 160, socialActivityShareLevel),
    port: options.port || port,
    publicUrl: options.publicUrl || publicBaseUrl(),
    iceServers: rtcIceServers(options.env || process.env)
  };
  if (auth?.role === PEER_ROLE) {
    const peer = state.friends.find(friend => friend.id === auth.peerId) || { id: auth.peerId, name: auth.name || '外部用户' };
    return {
      ...base,
      role: PEER_ROLE,
      self: { id: peer.id, name: peer.name },
      friends: [{ ...state.self, status: onlineStatus(state.self.id), unread: 0, lastSeenAt: null }],
      messages: conversationMessagesForPeer(state, peer.id, 160, { auth, shareLevel: socialActivityShareLevel }),
      inviteCode: '',
      ownerOnline: onlineStatus(state.self.id) === 'online'
    };
  }
  return {
    ...base,
    role: OWNER_ROLE,
    self: state.self,
    friends: state.friends.map(friendWithRuntimeStatus),
    messages: state.messages.slice(-160),
    inviteCode: state.inviteCode,
    authToken: state.authToken,
    inviteUrl: `${base.publicUrl}/client?invite=${encodeURIComponent(state.inviteCode)}`
  };
}

function publicState() {
  const state = loadState();
  return clientStateForAuth(ownerAuth(state), state);
}

function healthState(options = {}) {
  return {
    ok: true,
    service: 'focus-pet-chat',
    protocol: serverProtocol,
    host,
    port: currentPort(),
    publicUrl: options.publicUrl || publicBaseUrl(),
    clients: clients.size,
    websocket: websocketHealthSummary(options),
    rtc: rtcIceServerSummary(options.env || process.env),
    uptimeSeconds: Math.round(process.uptime())
  };
}

function websocketHealthSummary(options = {}) {
  const allowedOriginCount = configuredAllowedOrigins(options.env || process.env).length;
  return {
    enabled: true,
    active: Boolean(wss),
    clients: clients.size,
    originPolicy: allowedOriginCount > 0 ? 'same-origin-plus-configured' : 'same-origin-only',
    allowedOriginsConfigured: allowedOriginCount > 0,
    configuredAllowedOriginCount: allowedOriginCount,
    acceptsNoOrigin: true,
    allowsFileOrigin: true,
    corsWildcard: false
  };
}

function createPeerSession(inviteCode, name = '外部用户', options = {}) {
  const state = normalizeState(options.state || loadState());
  const inviteAttemptKey = cleanInviteAttemptKey(options.inviteAttemptKey);
  assertInviteAttemptAllowed(inviteAttemptKey, state, options);
  if (String(inviteCode || '').trim().toUpperCase() !== String(state.inviteCode || '').trim().toUpperCase()) {
    recordFailedInviteAttempt(inviteAttemptKey, state, options);
    syncInviteAttemptsToInputState(options.state, state);
    if (!options.state) saveState(state);
    throw new Error('邀请码无效');
  }
  if (timestampExpired(state.inviteExpiresAt, options)) throw new Error('邀请码已过期，请重新生成');
  clearInviteAttempts(inviteAttemptKey, state);
  syncInviteAttemptsToInputState(options.state, state);
  const createdAt = nowIso(options);
  const id = options.id || randomUUID;
  const token = options.token || makeToken;
  const peerId = id();
  const cleanPeerName = cleanName(name);
  const friend = { id: peerId, name: cleanPeerName, status: 'offline', lastSeenAt: null, unread: 0 };
  state.friends = state.friends.filter(item => item.id !== peerId);
  state.friends.push(friend);
  const sessionToken = token();
  const deviceId = cleanDeviceId(options.deviceId) || makeDeviceId();
  state.sessions = [
    ...(state.sessions || []).filter(session => session.peerId !== peerId && session.token !== sessionToken),
    { token: sessionToken, peerId, name: cleanPeerName, createdAt, lastSeenAt: null, expiresAt: addDurationIso(createdAt, SESSION_TTL_MS), deviceIdHash: deviceIdHash(deviceId) }
  ];
  if (!options.state) {
    saveState(state);
    broadcastState();
  }
  return { ok: true, sessionToken, deviceId, peer: friend, state };
}

function tokenFromRequest(reqOrUrl) {
  const baseUrl = `${serverProtocol}://${normalizeHostForUrl(host)}:${port}`;
  const url = typeof reqOrUrl === 'string' ? new URL(reqOrUrl, baseUrl) : new URL(reqOrUrl.url, baseUrl);
  const headerToken = typeof reqOrUrl === 'string' ? '' : reqOrUrl.headers.authorization?.replace(/^Bearer\s+/i, '');
  return url.searchParams.get('token') || headerToken;
}

function deviceIdFromRequest(reqOrUrl) {
  const baseUrl = `${serverProtocol}://${normalizeHostForUrl(host)}:${port}`;
  const url = typeof reqOrUrl === 'string' ? new URL(reqOrUrl, baseUrl) : new URL(reqOrUrl.url, baseUrl);
  const headerDeviceId = typeof reqOrUrl === 'string' ? '' : reqOrUrl.headers['x-focus-pet-device-id'];
  return cleanDeviceId(url.searchParams.get('deviceId') || headerDeviceId || '');
}

function authFromRequest(reqOrUrl, state = loadState()) {
  return resolveAuth(tokenFromRequest(reqOrUrl), state, { deviceId: deviceIdFromRequest(reqOrUrl) });
}

function isAuthorized(reqOrUrl) {
  const state = loadState();
  if (!state.authToken) return true;
  return Boolean(authFromRequest(reqOrUrl, state));
}

function jsonResponse(res, status, body, req = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    ...corsHeaders(req)
  });
  res.end(payload);
}

function safeMediaPath(mediaId) {
  return path.join(MEDIA_DIR, path.basename(String(mediaId || '')));
}

function cleanMediaExtension(name = '') {
  return path.extname(String(name || '')).toLowerCase();
}

function isAllowedAttachmentType(name = '', mimeType = '') {
  const type = String(mimeType || '').toLowerCase();
  if (ALLOWED_MEDIA_PREFIXES.some(prefix => type.startsWith(prefix))) return true;
  const extension = cleanMediaExtension(name);
  if (!ALLOWED_FILE_EXTENSIONS.has(extension)) return false;
  if (!type || type === 'application/octet-stream') return true;
  return ALLOWED_FILE_MIME_TYPES.has(type);
}

function bufferStartsWith(buffer, signature) {
  if (!Buffer.isBuffer(buffer) || buffer.length < signature.length) return false;
  return signature.every((byte, index) => buffer[index] === byte);
}

function isExecutableContent(buffer) {
  return bufferStartsWith(buffer, [0x4d, 0x5a])
    || bufferStartsWith(buffer, [0x7f, 0x45, 0x4c, 0x46])
    || bufferStartsWith(buffer, [0xfe, 0xed, 0xfa, 0xce])
    || bufferStartsWith(buffer, [0xfe, 0xed, 0xfa, 0xcf])
    || bufferStartsWith(buffer, [0xce, 0xfa, 0xed, 0xfe])
    || bufferStartsWith(buffer, [0xcf, 0xfa, 0xed, 0xfe]);
}

function contentMatchesDeclaredType(buffer, name = '', mimeType = '') {
  const extension = cleanMediaExtension(name);
  const type = String(mimeType || '').toLowerCase();
  const requiresPdf = extension === '.pdf' || type === 'application/pdf';
  const requiresZip = extension === '.zip' || type === 'application/zip' || type === 'application/x-zip-compressed';
  const requiresOoxml = ['.docx', '.xlsx', '.pptx'].includes(extension) || /openxmlformats-officedocument/.test(type);
  const requiresOle = ['.doc', '.xls', '.ppt'].includes(extension) || [
    'application/msword',
    'application/vnd.ms-excel',
    'application/vnd.ms-powerpoint'
  ].includes(type);
  const requiresPng = extension === '.png' || type === 'image/png';
  const requiresJpeg = ['.jpg', '.jpeg'].includes(extension) || type === 'image/jpeg';
  const requiresGif = extension === '.gif' || type === 'image/gif';
  const requiresWebp = extension === '.webp' || type === 'image/webp';

  if (isExecutableContent(buffer)) return { ok: false, reason: '不支持的文件内容' };
  if (requiresPdf && !bufferStartsWith(buffer, [0x25, 0x50, 0x44, 0x46])) return { ok: false, reason: '文件内容与声明类型不匹配' };
  if ((requiresZip || requiresOoxml) && !bufferStartsWith(buffer, [0x50, 0x4b])) return { ok: false, reason: '文件内容与声明类型不匹配' };
  if (requiresOle && !bufferStartsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return { ok: false, reason: '文件内容与声明类型不匹配' };
  if (requiresPng && !bufferStartsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { ok: false, reason: '文件内容与声明类型不匹配' };
  if (requiresJpeg && !bufferStartsWith(buffer, [0xff, 0xd8, 0xff])) return { ok: false, reason: '文件内容与声明类型不匹配' };
  if (requiresGif && !bufferStartsWith(buffer, [0x47, 0x49, 0x46, 0x38])) return { ok: false, reason: '文件内容与声明类型不匹配' };
  if (requiresWebp && !(bufferStartsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && buffer.slice(8, 12).toString('ascii') === 'WEBP')) return { ok: false, reason: '文件内容与声明类型不匹配' };
  return { ok: true, reason: '' };
}

function collectBody(req, limitBytes = MAX_MEDIA_BYTES + 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > limitBytes) {
        reject(new Error('请求体太大'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function broadcast(event, payload) {
  const message = JSON.stringify({ event, payload });
  for (const client of clients.values()) {
    if (client.socket.readyState === client.socket.OPEN) client.socket.send(message);
  }
}

function sendSocket(socket, event, payload) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify({ event, payload }));
}

function broadcastState() {
  const state = loadState();
  for (const client of clients.values()) {
    if (client.socket.readyState === client.socket.OPEN) {
      sendSocket(client.socket, 'state', clientStateForAuth(client.auth, state));
    }
  }
}

function shouldReceiveMessage(client, message) {
  return client.auth?.role === OWNER_ROLE || message.from === client.peerId || message.to === client.peerId;
}

function broadcastMessage(message) {
  const state = loadState();
  const appSettings = createSettingsStore().getSettings();
  const shareLevel = normalizeSocialActivityShareLevel(appSettings.socialActivityShareLevel || state.settings?.socialActivityShareLevel);
  for (const client of clients.values()) {
    if (client.socket.readyState === client.socket.OPEN && shouldReceiveMessage(client, message)) {
      sendSocket(client.socket, 'message', messageForAuth(message, client.auth, state, shareLevel));
    }
  }
}

function shouldReceiveActivity(client, activity, state = loadState()) {
  if (client.auth?.role === OWNER_ROLE) return true;
  return false;
}

function activityEventForAuth(activity, auth, state = loadState(), shareLevel = state.settings?.socialActivityShareLevel) {
  if (!activity || typeof activity !== 'object' || !auth) return null;
  if (auth.role === OWNER_ROLE) return activity;
  return null;
}

function broadcastActivity(activity) {
  const state = loadState();
  const appSettings = createSettingsStore().getSettings();
  const shareLevel = normalizeSocialActivityShareLevel(appSettings.socialActivityShareLevel || state.settings?.socialActivityShareLevel);
  for (const client of clients.values()) {
    if (client.socket.readyState === client.socket.OPEN && shouldReceiveActivity(client, activity, state)) {
      const payload = activityEventForAuth(activity, client.auth, state, shareLevel);
      if (payload) sendSocket(client.socket, 'activity', payload);
    }
  }
}

function sendToPeer(peerId, event, payload) {
  let sent = 0;
  for (const client of clients.values()) {
    if (client.peerId === peerId && client.socket.readyState === client.socket.OPEN) {
      sendSocket(client.socket, event, payload);
      sent += 1;
    }
  }
  return sent;
}

function disconnectPeerClients(peerId, reason = 'session-revoked') {
  for (const client of clients.values()) {
    if (client.peerId === peerId && client.auth?.role === PEER_ROLE && client.socket.readyState === client.socket.OPEN) {
      sendSocket(client.socket, 'error', reason);
      client.socket.close(1008, reason);
    }
  }
}

function normalizeRealtimeEvent(input = {}, auth = {}, state = loadState()) {
  const event = String(input.type || input.event || '');
  if (!REALTIME_EVENTS.has(event)) throw new Error('不支持的通话信令');
  const from = auth.role === OWNER_ROLE ? state.self.id : auth.peerId;
  const to = auth.role === PEER_ROLE ? state.self.id : String(input.to || '').trim();
  if (!to) throw new Error('缺少通话对象');
  const knownPeer = to === state.self.id || state.friends.some(friend => friend.id === to);
  if (!knownPeer) throw new Error('通话对象不存在');
  return {
    event,
    payload: {
      from,
      to,
      callId: String(input.callId || randomUUID()).slice(0, 80),
      mode: input.mode === 'video' ? 'video' : 'audio',
      sdp: input.sdp || null,
      candidate: input.candidate || null,
      reason: String(input.reason || '').slice(0, 120),
      time: new Date().toISOString()
    }
  };
}

function callAuditEntryForRealtime(realtime = {}, delivered = 0, options = {}) {
  const payload = realtime.payload || {};
  const deliveredCount = Math.max(0, Number(delivered) || 0);
  const time = (typeof options.now === 'function' ? options.now() : options.now) || payload.time || new Date().toISOString();
  return normalizeCallAuditEntry({
    event: realtime.event,
    from: payload.from,
    to: payload.to,
    callId: payload.callId,
    mode: payload.mode,
    delivered: deliveredCount > 0,
    recipientClientCount: deliveredCount,
    time
  });
}

function recordRealtimeAudit(realtime = {}, delivered = 0, options = {}) {
  const state = normalizeState(options.state || loadState());
  const entry = callAuditEntryForRealtime(realtime, delivered, options);
  if (!entry) return { entry: null, state };
  state.callAuditLog = [...normalizeCallAuditLog(state.callAuditLog || []), entry].slice(-CALL_AUDIT_LOG_LIMIT);
  if (!options.state) {
    saveState(state);
    broadcastState();
  }
  return { entry, state };
}

function touchFriend(friendId, status = 'online') {
  const state = loadState();
  if (friendId === state.self.id) {
    broadcastState();
    return state.self;
  }
  const friend = state.friends.find(item => item.id === friendId);
  if (friend) {
    friend.status = status;
    friend.lastSeenAt = new Date().toISOString();
    state.sessions = (state.sessions || []).map(session => session.peerId === friendId ? { ...session, lastSeenAt: friend.lastSeenAt } : session);
    const nextState = status === 'online' ? reconcileQueuedMessages(state, friendId, 'delivered') : state;
    saveState(nextState);
    broadcastState();
  }
  return friend;
}

function addMessage(input, options = {}) {
  const state = loadState();
  const auth = options.auth || ownerAuth(state);
  const safeInput = auth.role === PEER_ROLE
    ? { ...input, from: auth.peerId, to: state.self.id }
    : input;
  const message = normalizeMessage(safeInput, state, {
    isRecipientOnline: hasOnlineRecipient,
    localSenderId: auth.peerId || state.self.id
  });
  state.messages.push(message);
  state.messages = state.messages.slice(-700);
  if (message.to === state.self.id && message.from !== state.self.id) {
    const friend = state.friends.find(item => item.id === message.from);
    if (friend) friend.unread = (friend.unread || 0) + 1;
  }
  saveState(state);
  broadcastMessage(message);
  broadcastState();
  return message;
}

function publishActivitySnapshot(input = {}, options = {}) {
  const state = loadState();
  const auth = options.auth || ownerAuth(state);
  const activity = normalizeActivitySnapshot(input, state, auth);
  state.activities = { ...(state.activities || {}), [activity.from]: activity };
  state.activityLog = [...normalizeActivityLog(state.activityLog || []), activity].slice(-500);
  saveState(state);
  broadcastActivity(activity);
  broadcastState();
  return activity;
}

function updateSelf(patch = {}) {
  const state = loadState();
  state.self = {
    ...state.self,
    name: String(patch.name || state.self.name || '我').trim().slice(0, 40) || '我'
  };
  saveState(state);
  broadcastState();
  return state.self;
}

function updateSettings(patch = {}) {
  const state = loadState();
  state.settings = {
    ...(state.settings || {}),
    socialActivityShareLevel: normalizeSocialActivityShareLevel(patch.socialActivityShareLevel || state.settings?.socialActivityShareLevel),
    maxMediaMb: Number(patch.maxMediaMb) || state.settings?.maxMediaMb || Math.round(MAX_MEDIA_BYTES / 1024 / 1024),
    popupCooldownMinutes: Number(patch.popupCooldownMinutes) || state.settings?.popupCooldownMinutes || 8
  };
  saveState(state);
  broadcastState();
  return state.settings;
}

function addFriend(name, id = randomUUID()) {
  const state = loadState();
  const cleanName = String(name || '新朋友').slice(0, 40);
  const existing = state.friends.find(friend => friend.id === id || friend.name === cleanName);
  if (existing) return existing;
  const friend = { id, name: cleanName, status: 'offline', lastSeenAt: null, unread: 0 };
  state.friends.push(friend);
  saveState(state);
  broadcastState();
  return friend;
}

function removeFriend(friendId) {
  const state = loadState();
  const before = state.friends.length;
  state.friends = state.friends.filter(friend => friend.id !== friendId);
  state.sessions = (state.sessions || []).filter(session => session.peerId !== friendId);
  state.messages = state.messages.filter(message => message.from !== friendId && message.to !== friendId);
  saveState(state);
  broadcastState();
  return { ok: before !== state.friends.length };
}

function revokePeerSessions(friendId, options = {}) {
  const state = normalizeState(options.state || loadState());
  const peerId = String(friendId || '').trim();
  const before = state.sessions.length;
  state.sessions = state.sessions.filter(session => session.peerId !== peerId);
  const revokedSessions = before - state.sessions.length;
  const friend = state.friends.find(item => item.id === peerId) || null;
  if (friend) friend.status = 'offline';
  if (!options.state) {
    saveState(state);
    disconnectPeerClients(peerId);
    broadcastState();
  }
  return { ok: revokedSessions > 0, revokedSessions, friend, state };
}

function addFriendByInvite(inviteCode, name = '邀请码好友') {
  return createPeerSession(inviteCode, name).peer;
}

function markReadForAuth(friendId, options = {}) {
  const state = normalizeState(options.state || loadState());
  const auth = options.auth || ownerAuth(state);
  const readAt = typeof options.now === 'function' ? options.now() : new Date().toISOString();
  const targetId = String(friendId || '').trim();
  if (!targetId) return { ok: false, error: 'missing-friend', friend: null, state };

  if (auth?.role !== OWNER_ROLE) {
    if (targetId !== state.self.id || !auth?.peerId) {
      return { ok: false, error: 'forbidden', friend: null, state };
    }
    state.messages = state.messages.map(message => {
      if (message.from !== state.self.id || message.to !== auth.peerId || message.deliveryStatus === 'read') return message;
      return { ...message, deliveryStatus: 'read', readAt };
    });
    return { ok: true, friend: null, state };
  }

  const friend = state.friends.find(item => item.id === targetId) || null;
  if (friend) friend.unread = 0;
  state.messages = state.messages.map(message => {
    if (message.from !== targetId || message.deliveryStatus === 'read') return message;
    return { ...message, deliveryStatus: 'read', readAt };
  });
  return { ok: Boolean(friend), friend, state };
}

function markRead(friendId, options = {}) {
  const result = markReadForAuth(friendId, options);
  if (!options.state) {
    saveState(result.state);
    broadcastState();
  }
  return result.friend || null;
}

function deleteMessage(messageId) {
  const state = loadState();
  const before = state.messages.length;
  state.messages = state.messages.filter(message => message.id !== messageId);
  saveState(state);
  broadcastState();
  return { ok: before !== state.messages.length };
}

function clearHistory() {
  const state = loadState();
  state.messages = [];
  state.friends = state.friends.map(friend => ({ ...friend, unread: 0 }));
  saveState(state);
  broadcastState();
  return { ok: true };
}

function resetInvite() {
  const state = loadState();
  const createdAt = new Date().toISOString();
  state.inviteCode = makeInviteCode();
  state.inviteCreatedAt = createdAt;
  state.inviteExpiresAt = addDurationIso(createdAt, INVITE_TTL_MS);
  saveState(state);
  broadcastState();
  return state.inviteCode;
}

function saveMedia({ name, mimeType, data }, options = {}) {
  ensureDirs();
  const cleanName = cleanMediaName(name);
  const type = String(mimeType || '').trim().toLowerCase() || 'application/octet-stream';
  if (!isAllowedAttachmentType(cleanName, type)) {
    throw new Error('仅支持图片、视频、音频和常见文件');
  }
  const buffer = Buffer.from(data || '', 'base64');
  const settings = createSettingsStore().getSettings();
  const maxMediaBytes = settings.maxMediaMb * 1024 * 1024;
  if (buffer.length > maxMediaBytes) {
    throw new Error(`文件不能超过 ${settings.maxMediaMb}MB`);
  }
  const contentCheck = contentMatchesDeclaredType(buffer, cleanName, type);
  if (!contentCheck.ok) throw new Error(contentCheck.reason);
  const extension = cleanMediaExtension(cleanName) || mimeToExtension(type);
  const mediaId = `${randomUUID()}${extension}`;
  fs.writeFileSync(safeMediaPath(mediaId), buffer);
  return {
    id: mediaId,
    name: cleanName || mediaId,
    mimeType: type,
    size: buffer.length,
    url: `${options.publicUrl || publicBaseUrl()}/media/${mediaId}`
  };
}

function mimeToExtension(mimeType = '') {
  const type = String(mimeType || '').toLowerCase();
  if (type.includes('png')) return '.png';
  if (type.includes('jpeg')) return '.jpg';
  if (type.includes('gif')) return '.gif';
  if (type.includes('webp')) return '.webp';
  if (type.includes('webm')) return '.webm';
  if (type.includes('mp4')) return '.mp4';
  if (type.includes('pdf')) return '.pdf';
  if (type.includes('zip')) return '.zip';
  if (type.includes('json')) return '.json';
  if (type.includes('csv')) return '.csv';
  if (type.includes('markdown')) return '.md';
  if (type.includes('plain')) return '.txt';
  if (type.includes('wordprocessingml')) return '.docx';
  if (type.includes('msword')) return '.doc';
  if (type.includes('spreadsheetml')) return '.xlsx';
  if (type.includes('ms-excel')) return '.xls';
  if (type.includes('presentationml')) return '.pptx';
  if (type.includes('ms-powerpoint')) return '.ppt';
  if (type.includes('audio')) return '.webm';
  return '.bin';
}

async function parseJson(req) {
  const body = await collectBody(req);
  return body ? JSON.parse(body) : {};
}

async function handleApi(req, res) {
  if (!isAllowedRequestOrigin(req, { allowFileOrigin: true })) {
    return jsonResponse(res, 403, { error: 'origin forbidden' }, req);
  }
  if (req.method === 'OPTIONS') return jsonResponse(res, 204, {}, req);
  const url = new URL(req.url, `${serverProtocol}://${normalizeHostForUrl(host)}:${port}`);

  if (req.method === 'GET' && (url.pathname === '/healthz' || url.pathname === '/api/health')) {
    return jsonResponse(res, 200, healthState({ publicUrl: requestPublicBaseUrl(req) }), req);
  }

  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/client')) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    return res.end(remoteClientHtml());
  }

  if (req.method === 'POST' && url.pathname === '/api/sessions') {
    const body = await parseJson(req);
    const session = createPeerSession(body.inviteCode, body.name, {
      inviteAttemptKey: inviteAttemptKeyFromRequest(req),
      deviceId: body.deviceId
    });
    const auth = resolveAuth(session.sessionToken, session.state, { deviceId: session.deviceId });
    return jsonResponse(res, 200, {
      ok: true,
      sessionToken: session.sessionToken,
      deviceId: session.deviceId,
      peer: session.peer,
      state: clientStateForAuth(auth, session.state, { publicUrl: requestPublicBaseUrl(req) })
    }, req);
  }

  if (req.method === 'GET' && url.pathname.startsWith('/media/')) {
    if (!isAuthorized(req)) return jsonResponse(res, 401, { error: 'unauthorized' }, req);
    const filePath = safeMediaPath(url.pathname.split('/').pop());
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, corsHeaders(req));
    return fs.createReadStream(filePath).pipe(res);
  }

  const state = loadState();
  const auth = authFromRequest(req, state);

  if (req.method === 'GET' && url.pathname === '/api/state') {
    if (!auth) return jsonResponse(res, 401, { error: 'unauthorized' }, req);
    return jsonResponse(res, 200, clientStateForAuth(auth, state, { publicUrl: requestPublicBaseUrl(req) }), req);
  }

  if (!auth) return jsonResponse(res, 401, { error: 'unauthorized' }, req);
  if (auth.role !== OWNER_ROLE && !['/api/media', '/api/messages', '/api/friends/read'].includes(url.pathname)) {
    return jsonResponse(res, 403, { error: 'forbidden' }, req);
  }

  if (req.method === 'POST' && url.pathname === '/api/friends') {
    const body = await parseJson(req);
    return jsonResponse(res, 200, addFriend(body.name, body.id), req);
  }
  if (req.method === 'POST' && url.pathname === '/api/self') {
    const body = await parseJson(req);
    return jsonResponse(res, 200, updateSelf(body), req);
  }
  if (req.method === 'POST' && url.pathname === '/api/friends/invite') {
    const body = await parseJson(req);
    return jsonResponse(res, 200, addFriendByInvite(body.inviteCode, body.name), req);
  }
  if (req.method === 'POST' && url.pathname === '/api/friends/read') {
    const body = await parseJson(req);
    return jsonResponse(res, 200, markRead(body.friendId, { auth }), req);
  }
  if (req.method === 'POST' && url.pathname.startsWith('/api/friends/') && url.pathname.endsWith('/sessions/revoke')) {
    const friendId = url.pathname.split('/')[3];
    return jsonResponse(res, 200, revokePeerSessions(friendId), req);
  }
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/friends/')) return jsonResponse(res, 200, removeFriend(url.pathname.split('/').pop()), req);
  if (req.method === 'POST' && url.pathname === '/api/invite/reset') return jsonResponse(res, 200, { inviteCode: resetInvite() }, req);
  if (req.method === 'POST' && url.pathname === '/api/media') return jsonResponse(res, 200, saveMedia(await parseJson(req), { publicUrl: requestPublicBaseUrl(req) }), req);
  if (req.method === 'POST' && url.pathname === '/api/messages') return jsonResponse(res, 200, addMessage(await parseJson(req), { auth }), req);
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/messages/')) return jsonResponse(res, 200, deleteMessage(url.pathname.split('/').pop()), req);
  if (req.method === 'DELETE' && url.pathname === '/api/history') return jsonResponse(res, 200, clearHistory(), req);

  res.writeHead(404);
  res.end('not found');
}

function start() {
  if (server) return startedInfo();
  port = readPort(process.env.FOCUS_PET_CHAT_PORT, process.env.PORT, port, DEFAULT_PORT);
  host = process.env.FOCUS_PET_CHAT_HOST || host || DEFAULT_HOST;
  ensureDirs();
  loadState();
  const tls = tlsOptions();
  serverProtocol = tls ? 'https' : 'http';
  server = (tls ? https : http).createServer(tls || {}, (req, res) => {
    handleApi(req, res).catch(error => jsonResponse(res, 500, { error: error.message }, req));
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
    if (!isAllowedRequestOrigin(req, { allowFileOrigin: true })) {
      socket.close(1008, 'origin forbidden');
      return;
    }
    const state = loadState();
    const auth = authFromRequest(req, state);
    if (!auth) {
      socket.close(1008, 'unauthorized');
      return;
    }
    const id = randomUUID();
    const peerId = auth.peerId;
    clients.set(id, { socket, peerId, auth });
    touchFriend(peerId, 'online');
    sendSocket(socket, 'state', clientStateForAuth(auth, loadState()));
    socket.on('message', raw => {
      try {
        const input = JSON.parse(raw.toString());
        if (input.type === 'ping') touchFriend(peerId, 'online');
        if (input.type === 'self' && auth.role === OWNER_ROLE) updateSelf(input.self || {});
        if (input.type === 'add-friend' && auth.role === OWNER_ROLE) addFriend(input.name, input.id);
        if (input.type === 'invite' && auth.role === OWNER_ROLE) addFriendByInvite(input.inviteCode, input.name);
        if (input.type === 'mark-read') markRead(input.friendId, { auth });
        if (input.type === 'message') addMessage(input.message || {}, { auth });
        if (input.type === 'activity') publishActivitySnapshot(input.activity || input, { auth });
        if (REALTIME_EVENTS.has(input.type)) {
          const realtime = normalizeRealtimeEvent(input, auth, loadState());
          const delivered = sendToPeer(realtime.payload.to, realtime.event, realtime.payload);
          recordRealtimeAudit(realtime, delivered);
          if (!delivered) sendSocket(socket, 'call-unavailable', realtime.payload);
        }
      } catch (error) {
        sendSocket(socket, 'error', error.message);
      }
    });
    socket.on('close', () => {
      clients.delete(id);
      if (![...clients.values()].some(client => client.peerId === peerId)) touchFriend(peerId, 'offline');
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
}

function remoteClientHtml() {
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Focus Pet 社交端</title>
<style>
:root{font-family:Inter,-apple-system,BlinkMacSystemFont,'SF Pro Display','PingFang SC',sans-serif;--page:#f6f7fb;--panel:#fff;--line:rgba(31,41,55,.12);--text:#182033;--muted:rgba(24,32,51,.56);--blue:#4f7cff;--green:#16a34a;--red:#f43f5e}*{box-sizing:border-box}body{margin:0;height:100vh;overflow:hidden;color:var(--text);background:var(--page)}.app{width:min(1040px,100%);height:100vh;margin:0 auto;padding:18px}.grid{display:grid;grid-template-columns:260px minmax(0,1fr);gap:12px;height:100%;min-height:0}.sidebar,.chat,.join{min-height:0;border:1px solid var(--line);border-radius:8px;background:var(--panel)}.join{position:fixed;inset:18px;z-index:4;display:grid;place-items:center}.join-box{width:min(360px,100%);display:grid;gap:10px}.join-box h1{margin:0;font-size:20px}.join-box input,.compose input{width:100%;border:1px solid var(--line);border-radius:999px;padding:11px 13px;font:inherit}.sidebar{padding:12px;overflow:auto}.sidebar h2{margin:0 0 10px;font-size:14px}.chat{display:flex;flex-direction:column;overflow:hidden;padding:12px}.activity{display:grid;grid-template-columns:140px minmax(0,1fr);gap:10px;align-items:start;margin-top:10px;padding:10px;border:1px solid rgba(79,124,255,.18);border-radius:8px;background:#eff6ff}.activity img{width:140px;aspect-ratio:16/9;object-fit:cover;border-radius:6px;background:#0f172a}.activity div{min-width:0;display:grid;gap:4px}.activity strong,.activity span,.activity small{min-width:0;overflow:hidden;text-overflow:ellipsis}.activity strong{color:#315eb8;font-size:13px}.activity span{display:-webkit-box;color:rgba(24,32,51,.74);font-size:13px;font-weight:700;line-height:1.35;-webkit-line-clamp:2;-webkit-box-orient:vertical}.activity small{color:var(--muted);font-size:12px;white-space:nowrap}.activity ol{grid-column:1/-1;display:grid;gap:5px;max-height:106px;margin:2px 0 0;padding:8px 0 0;overflow:auto;border-top:1px solid rgba(79,124,255,.16);list-style:none}.activity li{display:grid;grid-template-columns:54px minmax(0,1fr) 54px;gap:6px;align-items:center;min-width:0;color:var(--muted);font-size:12px;font-weight:800}.activity li b,.activity li span,.activity li em{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.activity li b{color:#315eb8}.activity li em{font-style:normal;text-align:right}.messages{flex:1 1 auto;min-height:0;overflow:auto;margin-top:10px;padding:10px;border:1px solid var(--line);border-radius:8px;background:#fbfcff}.msg{max-width:72%;margin:8px 0;padding:9px 11px;border:1px solid var(--line);border-radius:8px;background:#fff;line-height:1.42;overflow-wrap:anywhere}.mine{margin-left:auto;color:#fff;border-color:transparent;background:var(--blue)}.msg img,.msg video{display:block;max-width:280px;max-height:210px;border-radius:6px}.msg audio{width:260px;max-width:100%}.file-card{display:grid;grid-template-columns:38px minmax(0,1fr);align-items:center;gap:9px;min-width:210px;color:inherit;text-decoration:none}.file-card b{display:grid;place-items:center;width:38px;height:38px;border-radius:7px;background:rgba(255,255,255,.22);font-size:10px}.file-card span{display:grid;gap:3px;min-width:0}.file-card i,.file-card small{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.file-card i{font-style:normal;font-weight:900}.file-card small{opacity:.72}.row,.compose,.actions,.calls{display:flex;gap:8px;align-items:center}.row+.row,.compose,.actions,.calls{margin-top:8px}select,button{min-width:0;border-radius:999px;padding:10px 12px;font:inherit}select{flex:1;border:1px solid var(--line);background:#fff;color:var(--text);outline:none}button{border:1px solid rgba(79,124,255,.22);background:#fff;color:#1f2a44;font-weight:800;cursor:pointer}.compose input{flex:1}.actions,.calls{flex-wrap:wrap;justify-content:flex-end}.rtc-notice{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;margin-top:8px;padding:9px;border:1px solid rgba(79,124,255,.22);border-radius:8px;background:#eef4ff;color:#23304f;font-size:12px;font-weight:800}.rtc-notice span{min-width:0;overflow-wrap:anywhere}.rtc-notice button{padding:7px 9px}.friend{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 0;border-bottom:1px solid var(--line);font-size:14px}.friend:last-child{border-bottom:0}.friend-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dot{display:inline-block;width:8px;height:8px;margin-right:7px;border-radius:99px;background:#cbd5e1}.online .dot{background:var(--green)}.badge{border-radius:999px;color:#fff;background:var(--red);padding:2px 7px;font-size:11px}.empty,.status{color:var(--muted);font-size:13px}.call-stage{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}.call-stage video{width:100%;max-height:160px;border-radius:8px;background:#0f172a}.hidden{display:none!important}@media(max-width:760px){.app{padding:12px}.grid{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}.sidebar{max-height:156px}.msg{max-width:88%}.activity{grid-template-columns:104px minmax(0,1fr)}.activity img{width:104px}}
</style>
</head>
<body>
<section id="joinPanel" class="join hidden"><div class="join-box"><h1>加入 Focus Pet 聊天</h1><input id="joinName" maxlength="40" placeholder="你的昵称"><input id="joinInvite" maxlength="20" placeholder="邀请码"><button id="joinButton">加入聊天</button><p id="joinStatus" class="status">需要桌面端提供的邀请码。</p></div></section>
<div class="app"><span id="status" class="status">连接中</span><div class="grid"><aside class="sidebar"><h2>好友</h2><div id="friends"></div></aside><main class="chat"><div class="row"><select id="friendSelect" aria-label="好友"></select></div><div id="messages" class="messages"></div><div class="compose"><input id="textMessage" maxlength="4000" placeholder="输入消息"><button id="sendText">发送</button></div><div class="actions"><input id="file" type="file" accept="${CHAT_FILE_ACCEPT}" hidden><button id="pickImage">图片</button><button id="pickFile">文件</button><button id="voice">语音消息</button></div><div class="calls"><button id="callAudio">语音电话</button><button id="callVideo">视频电话</button><button id="callEnd">挂断</button></div><div id="rtcNotice" class="rtc-notice hidden"><span>WebRTC 通话可能向通话对方暴露网络地址；仅与可信联系人通话。</span><button id="rtcContinue">继续通话</button><button id="rtcCancel">取消</button></div><div class="call-stage"><video id="localVideo" muted autoplay playsinline></video><video id="remoteVideo" autoplay playsinline></video></div><p id="callStatus" class="status">未通话</p></main></div></div>
<script>
const params=new URLSearchParams(location.search);const FILE_ACCEPT=${JSON.stringify(CHAT_FILE_ACCEPT)};const RTC_NOTICE_KEY='focusPetRtcNetworkNoticeAccepted:v1';const DEVICE_ID_KEY='focusPetChatDeviceId';let token=params.get('token')||localStorage.getItem('focusPetChatToken')||'';let state={self:{id:'',name:''},friends:[],messages:[],activities:{},activityLog:[],port:${port},iceServers:${JSON.stringify(DEFAULT_RTC_ICE_SERVERS)}};let ws;let pingTimer;let recorder;let chunks=[];let mediaMode='image';let pc;let localStream;let localMediaPromise;let localMediaRequestMode='';let currentCall=null;let pendingRtcAction=null;
const el=id=>document.getElementById(id);function ensureDeviceId(){let deviceId=localStorage.getItem(DEVICE_ID_KEY)||'';if(!deviceId){deviceId='device-'+Date.now()+'-'+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);localStorage.setItem(DEVICE_ID_KEY,deviceId)}return deviceId}const authHeaders=()=>token?{authorization:'Bearer '+token,'x-focus-pet-device-id':ensureDeviceId()}:{};
async function api(path,opt={}){const response=await fetch(path,{...opt,headers:{'content-type':'application/json',...authHeaders(),...(opt.headers||{})}});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.error||response.statusText);return data}
function showJoin(show){el('joinPanel').classList.toggle('hidden',!show)}
async function boot(){const invite=params.get('invite');if(invite)el('joinInvite').value=invite;if(!token){showJoin(true);return}try{state=await api('/api/state');showJoin(false);render();connect()}catch{showJoin(true)}}
async function join(){try{const result=await api('/api/sessions',{method:'POST',body:JSON.stringify({inviteCode:el('joinInvite').value,name:el('joinName').value||'外部用户',deviceId:ensureDeviceId()})});token=result.sessionToken;if(result.deviceId)localStorage.setItem(DEVICE_ID_KEY,result.deviceId);localStorage.setItem('focusPetChatToken',token);state=result.state;showJoin(false);render();connect()}catch(error){el('joinStatus').textContent='加入失败：'+error.message}}
function connect(){if(ws)ws.close();if(pingTimer)clearInterval(pingTimer);pingTimer=null;const scheme=location.protocol==='https:'?'wss':'ws';ws=new WebSocket(scheme+'://'+location.host+'?token='+encodeURIComponent(token)+'&deviceId='+encodeURIComponent(ensureDeviceId()));ws.onopen=()=>{el('status').textContent='在线';if(pingTimer)clearInterval(pingTimer);pingTimer=setInterval(()=>ws.readyState===1&&ws.send(JSON.stringify({type:'ping'})),15000)};ws.onclose=()=>{if(pingTimer)clearInterval(pingTimer);pingTimer=null;el('status').textContent='离线，重连中';setTimeout(connect,2000)};ws.onmessage=e=>handleSocket(JSON.parse(e.data))}
function reportCallError(error){el('callStatus').textContent='通话失败：'+error.message}
function handleSocket(d){if(d.event==='state'){state=d.payload;render()}if(d.event==='message'){syncMessage(d.payload)}if(d.event==='activity'){state.activities={...(state.activities||{}),[d.payload.from]:d.payload};state.activityLog=[...(state.activityLog||[]),d.payload].slice(-500);renderActivity()}if(d.event==='call-invite')incomingInvite(d.payload).catch(reportCallError);if(d.event==='call-answer')el('callStatus').textContent='对方已接听';if(d.event==='call-reject'||d.event==='call-cancel'||d.event==='call-end')endCall('通话已结束',false);if(d.event==='call-unavailable')endCall('对方不在线',false);if(d.event==='rtc-offer')handleOffer(d.payload).catch(reportCallError);if(d.event==='rtc-answer')handleAnswer(d.payload).catch(reportCallError);if(d.event==='rtc-ice')handleIce(d.payload).catch(reportCallError);if(d.event==='error')el('callStatus').textContent='错误：'+d.payload}
function render(){renderFriends();renderActivity();renderMessages()}
function statusLabel(status){return status==='online'?'在线':'离线'}
function selectedPeer(){return el('friendSelect').value||state.friends[0]?.id||'pet-owner'}
function renderFriends(){const friends=el('friends');const select=el('friendSelect');const selected=select.value;friends.innerHTML='';select.innerHTML='';if(!state.friends.length){friends.innerHTML='<div class="empty">暂无好友</div>';const o=document.createElement('option');o.value='';o.textContent='暂无好友';o.disabled=true;select.appendChild(o);return}for(const f of state.friends){const d=document.createElement('div');d.className='friend '+(f.status==='online'?'online':'');const name=document.createElement('span');name.className='friend-name';name.innerHTML='<i class="dot"></i>';name.append(document.createTextNode(f.name+' · '+statusLabel(f.status)));d.appendChild(name);if(f.unread){const badge=document.createElement('b');badge.className='badge';badge.textContent=f.unread;d.appendChild(badge)}friends.appendChild(d);const o=document.createElement('option');o.value=f.id;o.textContent=f.name+' · '+statusLabel(f.status)+(f.unread?' · '+f.unread+'未读':'');o.selected=f.id===selected;select.appendChild(o)}}
function mediaSrc(media){return media?.url?(media.url+(media.url.includes('?')?'&':'?')+'token='+encodeURIComponent(token)+'&deviceId='+encodeURIComponent(ensureDeviceId())):''}
function attachmentTypeForFile(file,type){if(type==='voice')return'voice';const mime=String(file?.type||'').toLowerCase();if(mime.startsWith('image/'))return'image';if(mime.startsWith('video/'))return'video';if(mime.startsWith('audio/'))return'voice';return'file'}
function fileExt(name){const clean=String(name||'');const i=clean.lastIndexOf('.');return i>=0?clean.slice(i).toLowerCase():''}
function fileKind(media){const mime=String(media?.mimeType||'').toLowerCase();const ext=fileExt(media?.name||media?.id);if(mime.includes('pdf')||ext==='.pdf')return'PDF';if(mime.includes('zip')||ext==='.zip')return'ZIP';if(mime.includes('word')||ext==='.doc'||ext==='.docx')return'DOC';if(mime.includes('excel')||mime.includes('spreadsheet')||ext==='.xls'||ext==='.xlsx')return'XLS';if(mime.includes('powerpoint')||mime.includes('presentation')||ext==='.ppt'||ext==='.pptx')return'PPT';if(mime.includes('json')||ext==='.json')return'JSON';if(mime.includes('csv')||ext==='.csv')return'CSV';if(mime.includes('markdown')||ext==='.md')return'MD';if(mime.startsWith('text/')||ext==='.txt')return'TXT';return'文件'}
function fileSize(size){const bytes=Number(size)||0;if(bytes<1024)return bytes+' B';if(bytes<1024*1024)return Math.round(bytes/1024)+' KB';return(bytes/1024/1024).toFixed(bytes<10*1024*1024?1:0)+' MB'}
function appendFile(node,m){const a=document.createElement('a');a.className='file-card';a.href=mediaSrc(m.media);a.target='_blank';a.rel='noreferrer';a.download=m.media?.name||m.text||'';const badge=document.createElement('b');badge.textContent=fileKind(m.media);const copy=document.createElement('span');const name=document.createElement('i');name.textContent=m.media?.name||m.text||'未命名文件';const meta=document.createElement('small');meta.textContent=fileKind(m.media)+' · '+fileSize(m.media?.size);copy.append(name,meta);a.append(badge,copy);node.appendChild(a)}
function activityStatus(status){return status==='work'?'专注中':status==='study'?'学习中':status==='rest'?'休息中':status==='game'?'游戏中':status==='distracted'?'可能偏离':'观察中'}
function activityTime(time){const value=Date.parse(time);if(!Number.isFinite(value))return'刚刚同步';const seconds=Math.max(0,Math.round((Date.now()-value)/1000));if(seconds<60)return'刚刚同步';if(seconds<3600)return Math.round(seconds/60)+'分钟前同步';return new Date(value).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
function renderActivity(){const box=el('activity');if(!box)return;box.classList.add('hidden')}
function appendBody(node,m){if(m.activity){const span=document.createElement('span');span.textContent=m.activity.message||m.text||m.activity.activity||'[屏幕分析]';node.appendChild(span);return}const mediaType=m.media?.url?attachmentTypeForFile({type:m.media.mimeType},m.type):'';if(m.media?.url&&mediaType==='image'){const img=document.createElement('img');img.src=mediaSrc(m.media);img.alt=m.media.name||'image';node.appendChild(img);return}if(m.media?.url&&mediaType==='video'){const video=document.createElement('video');video.src=mediaSrc(m.media);video.controls=true;node.appendChild(video);return}if(m.media?.url&&mediaType==='voice'){const audio=document.createElement('audio');audio.src=mediaSrc(m.media);audio.controls=true;node.appendChild(audio);return}if(m.media?.url){appendFile(node,m);return}const span=document.createElement('span');span.textContent=m.text||'['+m.type+']';node.appendChild(span)}
function renderMessages(){el('messages').innerHTML='';for(const m of state.messages.slice(-120)){const d=document.createElement('div');d.className='msg '+(m.from===state.self.id?'mine':'');d.title=m.from===state.self.id?'我':m.from;appendBody(d,m);el('messages').appendChild(d)}el('messages').scrollTop=el('messages').scrollHeight}
function syncMessage(message){const i=state.messages.findIndex(item=>(message.id&&item.id===message.id)||(message.clientId&&item.clientId===message.clientId));if(i>=0)state.messages[i]={...state.messages[i],...message};else state.messages.push(message);renderMessages()}
function send(partial){const msg={to:selectedPeer(),clientId:'remote-'+Date.now()+'-'+Math.random().toString(36).slice(2),...partial};ws.send(JSON.stringify({type:'message',message:msg}))}
function sendText(){const text=el('textMessage').value.trim();if(!text)return;el('textMessage').value='';send({type:'text',text})}
async function fileBase64(file){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result).split(',')[1]);r.onerror=rej;r.readAsDataURL(file)})}
async function sendFile(file,type){const resolvedType=attachmentTypeForFile(file,type);const media=await api('/api/media',{method:'POST',body:JSON.stringify({name:file.name,mimeType:file.type,data:await fileBase64(file)})});send({type:resolvedType,text:file.name,media})}
function signal(type,payload={}){if(ws?.readyState!==1)return;const event={type,...payload};event.to=event.to||currentCall?.to||selectedPeer();event.callId=event.callId||currentCall?.callId;ws.send(JSON.stringify(event))}
function requireMediaCapture(){if(!navigator.mediaDevices?.getUserMedia)throw new Error('当前浏览器需要 HTTPS 或 localhost 才能使用语音/视频')}
function rtcNoticeAccepted(){return localStorage.getItem(RTC_NOTICE_KEY)==='accepted'}
function hideRtcNotice(){el('rtcNotice').classList.add('hidden')}
function clearPendingRtcNotice(){pendingRtcAction=null;hideRtcNotice()}
function showRtcNotice(action){pendingRtcAction=action;el('rtcNotice').classList.remove('hidden');el('callStatus').textContent='继续前确认 WebRTC 网络提示'}
async function continueRtcNotice(){localStorage.setItem(RTC_NOTICE_KEY,'accepted');const action=pendingRtcAction;clearPendingRtcNotice();if(action)await action()}
function cancelRtcNotice(){clearPendingRtcNotice();if(currentCall)signal('call-reject',{callId:currentCall.callId,mode:currentCall.mode,to:currentCall.to,reason:'network notice declined'});currentCall=null;el('callStatus').textContent='通话已取消'}
function localStreamSupports(mode){if(!localStream)return false;const hasAudio=localStream.getAudioTracks().some(track=>track.readyState!=='ended');const hasVideo=localStream.getVideoTracks().some(track=>track.readyState!=='ended');return hasAudio&&(mode!=='video'||hasVideo)}
function mediaRequestSupports(requestMode,mode){return requestMode==='video'||mode!=='video'}
async function ensureLocalMedia(mode){requireMediaCapture();if(localStreamSupports(mode))return localStream;if(localMediaPromise&&mediaRequestSupports(localMediaRequestMode,mode))return localMediaPromise;if(localMediaPromise){await localMediaPromise.catch(()=>null);if(localStreamSupports(mode))return localStream}if(localStream)localStream.getTracks().forEach(track=>track.stop());localMediaRequestMode=mode;localMediaPromise=navigator.mediaDevices.getUserMedia({audio:true,video:mode==='video'}).then(stream=>{localStream=stream;el('localVideo').srcObject=localStream;return localStream}).finally(()=>{localMediaPromise=null;localMediaRequestMode=''});return localMediaPromise}
function createPeerConnection(call){const peer=new RTCPeerConnection({iceServers:state.iceServers||[]});peer.onicecandidate=e=>{if(e.candidate)signal('rtc-ice',{candidate:e.candidate,callId:call.callId,mode:call.mode,to:call.to})};peer.ontrack=e=>{el('remoteVideo').srcObject=e.streams[0]};return peer}
async function startCall(mode){if(!rtcNoticeAccepted()){showRtcNotice(()=>startCall(mode));return}const call={callId:'call-'+Date.now()+'-'+Math.random().toString(36).slice(2),mode,to:selectedPeer()};currentCall=call;await ensureLocalMedia(mode);pc=createPeerConnection(call);localStream.getTracks().forEach(track=>pc.addTrack(track,localStream));el('callStatus').textContent=mode==='video'?'正在发起视频电话':'正在发起语音电话';signal('call-invite',{mode,callId:call.callId,to:call.to});const offer=await pc.createOffer();await pc.setLocalDescription(offer);signal('rtc-offer',{mode,callId:call.callId,sdp:pc.localDescription,to:call.to})}
async function incomingInvite(payload){if(!rtcNoticeAccepted()){currentCall={callId:payload.callId,mode:payload.mode,to:payload.from};showRtcNotice(()=>incomingInvite(payload));return}currentCall={callId:payload.callId,mode:payload.mode,to:payload.from};el('callStatus').textContent=(payload.mode==='video'?'视频':'语音')+'来电，正在自动接通';try{await ensureLocalMedia(payload.mode);signal('call-answer',{callId:payload.callId,mode:payload.mode,to:payload.from})}catch(error){signal('call-reject',{callId:payload.callId,mode:payload.mode,to:payload.from,reason:error.message});currentCall=null;el('callStatus').textContent='无法接通：'+error.message}}
async function handleOffer(payload){if(!rtcNoticeAccepted()){currentCall={callId:payload.callId,mode:payload.mode,to:payload.from};showRtcNotice(()=>handleOffer(payload));return}currentCall={callId:payload.callId,mode:payload.mode,to:payload.from};await ensureLocalMedia(payload.mode);pc=createPeerConnection(currentCall);localStream.getTracks().forEach(track=>pc.addTrack(track,localStream));await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));const answer=await pc.createAnswer();await pc.setLocalDescription(answer);signal('rtc-answer',{callId:payload.callId,mode:payload.mode,sdp:pc.localDescription,to:payload.from});el('callStatus').textContent='通话中'}
async function handleAnswer(payload){if(!pc)return;await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));el('callStatus').textContent='通话中'}
async function handleIce(payload){if(pc&&payload.candidate)await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))}
function endCall(text='未通话',notify=true){if(notify&&currentCall)signal('call-end',{callId:currentCall.callId,mode:currentCall.mode,to:currentCall.to});if(pc)pc.close();pc=null;if(localStream)localStream.getTracks().forEach(track=>track.stop());localStream=null;localMediaPromise=null;localMediaRequestMode='';currentCall=null;clearPendingRtcNotice();el('localVideo').srcObject=null;el('remoteVideo').srcObject=null;el('callStatus').textContent=text}
el('joinButton').onclick=join;el('sendText').onclick=sendText;el('friendSelect').onchange=renderActivity;el('textMessage').onkeydown=e=>{if(e.key==='Enter')sendText()};el('pickImage').onclick=()=>{mediaMode='image';el('file').accept='image/*';el('file').click()};el('pickFile').onclick=()=>{mediaMode='file';el('file').accept=FILE_ACCEPT;el('file').click()};el('file').onchange=()=>{const file=el('file').files[0];el('file').value='';if(file)sendFile(file,mediaMode).catch(error=>{el('callStatus').textContent='文件发送失败：'+error.message})};el('voice').onclick=async()=>{try{requireMediaCapture();if(recorder?.state==='recording'){recorder.stop();el('voice').textContent='语音消息';return}const stream=await navigator.mediaDevices.getUserMedia({audio:true});chunks=[];recorder=new MediaRecorder(stream);recorder.ondataavailable=e=>{if(e.data?.size)chunks.push(e.data)};recorder.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());if(!chunks.length){el('callStatus').textContent='没有录到声音';return}await sendFile(new File([new Blob(chunks,{type:'audio/webm'})],'voice-'+Date.now()+'.webm',{type:'audio/webm'}),'voice').catch(error=>{el('callStatus').textContent='语音发送失败：'+error.message})};recorder.start();el('voice').textContent='停止录音'}catch(error){el('callStatus').textContent='语音失败：'+error.message}};el('rtcContinue').onclick=()=>continueRtcNotice().catch(error=>el('callStatus').textContent='通话失败：'+error.message);el('rtcCancel').onclick=cancelRtcNotice;el('callAudio').onclick=()=>startCall('audio').catch(error=>el('callStatus').textContent='通话失败：'+error.message);el('callVideo').onclick=()=>startCall('video').catch(error=>el('callStatus').textContent='通话失败：'+error.message);el('callEnd').onclick=()=>endCall('已挂断');
boot();
</script>
</body></html>`;
}

module.exports = {
  DATA_DIR,
  MEDIA_DIR,
  start,
  ready,
  stop,
  publicState,
  addFriend,
  removeFriend,
  updateSelf,
  addFriendByInvite,
  createPeerSession,
  resolveAuth,
  clientStateForAuth,
  migrateChatState,
  addMessage,
  normalizeMessage,
  normalizeRealtimeEvent,
  recordRealtimeAudit,
  normalizeCallAuditLog,
  rtcIceServers,
  rtcIceServerSummary,
  isAllowedRequestOrigin,
  corsHeaders,
  safeMediaPath,
  reconcileQueuedMessages,
  markReadForAuth,
  markRead,
  deleteMessage,
  clearHistory,
  resetInvite,
  revokePeerSessions,
  saveMedia,
  publishActivitySnapshot,
  normalizeActivitySnapshot,
  sharedActivityForLevel,
  activityEventForAuth,
  normalizeSocialActivityShareLevel,
  updateSettings,
  healthState,
  inviteAttemptKeyFromRequest
};
