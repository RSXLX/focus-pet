const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { readJsonWithRecovery, writeJsonAtomic } = require('./json-storage');
const { DEFAULT_FOCUS_PET_CLOUD_BASE_URL } = require('./llm-provider');

const DATA_DIR = path.join(os.homedir(), '.hermes', 'focus-watchdog');
const ACCOUNT_PATH = path.join(DATA_DIR, 'cloud-account.json');
const CLOUD_ACCOUNT_SCHEMA_VERSION = 1;

function cleanText(value, maxLength = 120) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function ensureDir(dataDir = DATA_DIR) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function makeDeviceId() {
  return `device-${randomUUID().replaceAll('-', '').slice(0, 24)}`;
}

function normalizeCloudBaseUrl(value, fallback = DEFAULT_FOCUS_PET_CLOUD_BASE_URL) {
  const raw = String(value || fallback || '').trim().replace(/\/+$/, '');
  if (!/^https?:\/\//i.test(raw)) return DEFAULT_FOCUS_PET_CLOUD_BASE_URL;
  try {
    const url = new URL(raw);
    const pathname = url.pathname.replace(/\/+$/, '');
    if (!pathname || pathname === '/' || pathname === '/client' || pathname.startsWith('/api/')) {
      url.pathname = '';
      url.search = '';
      url.hash = '';
      return url.toString().replace(/\/+$/, '');
    }
    return raw;
  } catch {
    return DEFAULT_FOCUS_PET_CLOUD_BASE_URL;
  }
}

function cloudApiUrl(baseUrl, pathname) {
  const url = new URL(pathname, `${normalizeCloudBaseUrl(baseUrl)}/`);
  return url.toString();
}

function cloudWebSocketUrl({ baseUrl, authToken, deviceId }) {
  if (!authToken || !deviceId) return '';
  const url = new URL(normalizeCloudBaseUrl(baseUrl));
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/';
  url.search = '';
  url.searchParams.set('token', authToken);
  url.searchParams.set('deviceId', deviceId);
  return url.toString();
}

function defaultAccount(options = {}) {
  return {
    version: CLOUD_ACCOUNT_SCHEMA_VERSION,
    baseUrl: normalizeCloudBaseUrl(options.baseUrl),
    deviceId: cleanText(options.deviceId, 120) || makeDeviceId(),
    authToken: '',
    user: null,
    friends: [],
    iceServers: [],
    lastSyncedAt: ''
  };
}

function migrateCloudAccountState(input = {}, options = {}) {
  const fallback = defaultAccount(options);
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  return {
    ...source,
    version: CLOUD_ACCOUNT_SCHEMA_VERSION,
    baseUrl: normalizeCloudBaseUrl(source.baseUrl || fallback.baseUrl),
    deviceId: cleanText(source.deviceId, 120) || fallback.deviceId,
    authToken: cleanText(source.authToken, 512),
    user: source.user && typeof source.user === 'object' ? source.user : null,
    friends: Array.isArray(source.friends) ? source.friends : [],
    iceServers: Array.isArray(source.iceServers) ? source.iceServers : [],
    lastSyncedAt: cleanText(source.lastSyncedAt, 40)
  };
}

function readAccount(options = {}) {
  const accountPath = options.accountPath || ACCOUNT_PATH;
  ensureDir(path.dirname(accountPath));
  if (!fs.existsSync(accountPath)) {
    const account = defaultAccount(options);
    writeJsonAtomic(accountPath, account, { backupLabel: 'cloud-account', maxBackups: 3 });
    return account;
  }
  const result = readJsonWithRecovery(accountPath, {
    fallback: defaultAccount(options),
    backupLabel: 'cloud-account',
    normalize: value => migrateCloudAccountState(value, options)
  });
  const account = migrateCloudAccountState(result.value, options);
  writeJsonAtomic(accountPath, account, { backupLabel: 'cloud-account', maxBackups: 3 });
  return account;
}

function saveAccount(account, options = {}) {
  const accountPath = options.accountPath || ACCOUNT_PATH;
  ensureDir(path.dirname(accountPath));
  const normalized = migrateCloudAccountState(account, options);
  writeJsonAtomic(accountPath, normalized, { backupLabel: 'cloud-account', maxBackups: 3 });
  return normalized;
}

function clearCloudAccount(options = {}) {
  const account = defaultAccount(options);
  return saveAccount(account, options);
}

function authHeaders(account, extra = {}) {
  return {
    ...extra,
    authorization: `Bearer ${account.authToken}`,
    'x-focus-pet-device-id': account.deviceId
  };
}

async function requestJson(url, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const response = await fetchImpl(url, {
    method: options.method || 'GET',
    headers: options.headers || {},
    body: options.body
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(body.error || body.reason || response.statusText || `HTTP ${response.status}`);
    error.statusCode = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function cloudUserToFriend(user = {}) {
  return {
    id: String(user.id || ''),
    name: cleanText(user.displayName || user.name || user.id || '好友', 60),
    friendCode: cleanText(user.friendCode, 30),
    status: user.online ? 'online' : 'offline',
    unread: 0
  };
}

function accountToChatState(account = {}, remote = null, options = {}) {
  const signedIn = Boolean(account.authToken && remote?.self);
  const selfUser = signedIn ? remote.self : account.user;
  const self = selfUser
    ? {
        id: String(selfUser.id || ''),
        name: cleanText(selfUser.displayName || selfUser.name || '我', 60),
        friendCode: cleanText(selfUser.friendCode, 30),
        status: 'online'
      }
    : { id: 'cloud-guest', name: '我', friendCode: '', status: 'offline' };
  const friends = (remote?.friends || account.friends || []).map(cloudUserToFriend).filter(friend => friend.id);
  const iceServers = remote?.iceServers || account.iceServers || [];
  const messages = Array.isArray(remote?.messages) ? remote.messages : [];
  return {
    source: 'cloud',
    signedIn,
    baseUrl: account.baseUrl,
    deviceId: account.deviceId,
    authToken: account.authToken,
    websocketUrl: signedIn ? cloudWebSocketUrl(account) : '',
    self,
    friends,
    messages,
    activities: {},
    activityLog: [],
    iceServers,
    settings: options.settings || {}
  };
}

async function getCloudMe(options = {}) {
  let account = readAccount(options);
  if (!account.authToken) return accountToChatState(account);
  try {
    const remote = await requestJson(cloudApiUrl(account.baseUrl, '/api/me'), {
      fetchImpl: options.fetchImpl,
      headers: authHeaders(account)
    });
    account = saveAccount({
      ...account,
      user: remote.self || account.user,
      friends: remote.friends || [],
      iceServers: remote.iceServers || account.iceServers,
      lastSyncedAt: new Date().toISOString()
    }, options);
    return accountToChatState(account, remote, options);
  } catch (error) {
    if (error.statusCode === 401) {
      account = saveAccount({ ...account, authToken: '', user: null, friends: [], iceServers: [] }, options);
    }
    const state = accountToChatState(account, null, options);
    state.error = error.message;
    return state;
  }
}

async function registerCloudUser(input = {}, options = {}) {
  const account = readAccount(options);
  const displayName = cleanText(input.displayName, 40) || 'Focus Pet User';
  const result = await requestJson(cloudApiUrl(account.baseUrl, '/api/users'), {
    fetchImpl: options.fetchImpl,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ displayName, deviceId: account.deviceId })
  });
  saveAccount({
    ...account,
    authToken: result.authToken || '',
    user: result.user || null,
    iceServers: result.iceServers || [],
    lastSyncedAt: new Date().toISOString()
  }, options);
  return getCloudMe(options);
}

async function addCloudFriend(friendCode, options = {}) {
  const account = readAccount(options);
  if (!account.authToken) throw new Error('请先创建我的 ID');
  const result = await requestJson(cloudApiUrl(account.baseUrl, '/api/friends'), {
    fetchImpl: options.fetchImpl,
    method: 'POST',
    headers: authHeaders(account, { 'content-type': 'application/json' }),
    body: JSON.stringify({ friendCode: cleanText(friendCode, 30) })
  });
  if (result?.ok === false) throw new Error(result.error || '添加好友失败');
  return getCloudMe(options);
}

async function sendCloudMessage(message = {}, options = {}) {
  const account = readAccount(options);
  if (!account.authToken) throw new Error('请先创建我的 ID');
  const result = await requestJson(cloudApiUrl(account.baseUrl, '/api/messages'), {
    fetchImpl: options.fetchImpl,
    method: 'POST',
    headers: authHeaders(account, { 'content-type': 'application/json' }),
    body: JSON.stringify(message)
  });
  return result.message || result;
}

module.exports = {
  ACCOUNT_PATH,
  CLOUD_ACCOUNT_SCHEMA_VERSION,
  accountToChatState,
  addCloudFriend,
  clearCloudAccount,
  cloudApiUrl,
  cloudWebSocketUrl,
  defaultAccount,
  getCloudMe,
  migrateCloudAccountState,
  normalizeCloudBaseUrl,
  readAccount,
  registerCloudUser,
  saveAccount,
  sendCloudMessage
};
