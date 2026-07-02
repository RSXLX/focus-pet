const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { providerSummary } = require('./llm-provider');
const { DATA_DIR, TASK_JSON_PATH, TASK_PATH, parseMarkdown } = require('./task-store');
const { SETTINGS_PATH, DEFAULT_SETTINGS, normalizeSettings } = require('./settings-store');
const { platformSettingsProfile } = require('./platform-support');
const { DEFAULT_RUNTIME_LOG_PATH, LOG_LEVELS, normalizeLogLevel, readRuntimeLogSummary } = require('./runtime-logger');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ERROR_LOG_PATH = path.join(PROJECT_ROOT, 'docs', 'errorThing.md');
const DEFAULT_DIAGNOSTICS_OUTPUT_DIR = path.join(PROJECT_ROOT, 'output', 'diagnostics');
const DEFAULT_DIAGNOSTICS_BUNDLE_RETENTION = 20;
const DIAGNOSTICS_BUNDLE_NAME_PATTERN = /^focus-pet-diagnostics-\d{8}-\d{6}$/;
const SOCIAL_DATA_DIR = path.join(os.homedir(), '.hermes', 'focus-watchdog', 'social');
const CHAT_STATE_PATH = path.join(SOCIAL_DATA_DIR, 'chat-state.json');
const ACTIVITY_LOG_PATH = path.join(DATA_DIR, 'activity.jsonl');
const ACTIVITY_STATUS_VALUES = new Set(['work', 'study', 'game', 'distracted', 'unknown', 'permission', 'rest']);
const ERROR_SUMMARY_KEY = Symbol('errorSummaryKey');
const LOCAL_ABSOLUTE_PATH_PATTERN = /(^|[\s`"'(:=])(?:\/(?:Users|private|tmp|var\/folders)\/[^\s`"')\]}]+|[A-Za-z]:\\{1,2}(?:Users|Documents and Settings|ProgramData|Windows|Temp|tmp)\\{1,2}[^\s`"')\]}]+)/g;
const SECRET_ASSIGNMENT_PATTERN = /\b(?:api[-_]?key|auth[-_]?token|session[-_]?token|invite[-_]?code|token|secret|credential|password)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;|]+)/gi;
const CONTEXT_VALUE_KEYS = new Set([
  'currentTask',
  'frontmost',
  'screenEndpoint',
  'reviewEndpoint',
  'endpoint',
  'model',
  'app',
  'title',
  'windowTitle'
]);
let chatServiceModule = null;

function getChatService() {
  if (!chatServiceModule) chatServiceModule = require('./chat-service');
  return chatServiceModule;
}

function shouldRedactContinuousToken(value = '') {
  const text = String(value || '');
  if (!text) return false;
  if (!/\d/.test(text) && /^[a-z]+(?:[A-Z][a-z]+)+$/.test(text)) return false;
  return true;
}

function cleanDiagnosticText(value, maxLength = 220) {
  return String(value || '')
    .replace(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, '[image-data]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, 'Bearer [redacted]')
    .replace(/\b[A-Z][A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|CREDENTIAL)[A-Z0-9_]*\s*=\s*\S+/g, '[secret]')
    .replace(SECRET_ASSIGNMENT_PATTERN, '[secret]')
    .replace(/\b(?:https?|wss?|ftp):\/\/[^\s`"'<>]+/gi, '[url]')
    .replace(LOCAL_ABSOLUTE_PATH_PATTERN, '$1[local-path]')
    .replace(/\b([A-Za-z][A-Za-z0-9_]*?)=([^,;|]*?)(?=\s+[A-Za-z][A-Za-z0-9_]*=|[,;|]|$)/g, (match, key) => {
      if (!CONTEXT_VALUE_KEYS.has(key)) return match;
      return `${key}=[redacted]`;
    })
    .replace(/\b[A-Za-z0-9_]{24,}\b/g, match => shouldRedactContinuousToken(match) ? '[redacted]' : match)
    .replace(/\b(?=[A-Za-z0-9_-]{24,}\b)(?=[A-Za-z0-9_-]*\d{12,})[A-Za-z0-9_-]+\b/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function readJsonSafe(filePath, fallback = null) {
  try {
    if (!fs.existsSync(filePath)) return fallback;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

function readTasksForDiagnostics(dataDir = DATA_DIR) {
  const taskJsonPath = path.join(dataDir, path.basename(TASK_JSON_PATH));
  const taskMarkdownPath = path.join(dataDir, path.basename(TASK_PATH));
  const payload = readJsonSafe(taskJsonPath, null);
  if (Array.isArray(payload?.tasks)) return payload.tasks;
  try {
    if (fs.existsSync(taskMarkdownPath)) return parseMarkdown(fs.readFileSync(taskMarkdownPath, 'utf8'));
  } catch {}
  return [];
}

function readSettingsForDiagnostics(dataDir = DATA_DIR) {
  const settingsPath = path.join(dataDir, path.basename(SETTINGS_PATH));
  return normalizeSettings(readJsonSafe(settingsPath, DEFAULT_SETTINGS) || DEFAULT_SETTINGS);
}

function readActivityForDiagnostics(dataDir = DATA_DIR) {
  const activityPath = path.join(dataDir, path.basename(ACTIVITY_LOG_PATH));
  try {
    if (!fs.existsSync(activityPath)) return [];
    return fs.readFileSync(activityPath, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map(line => {
        try { return JSON.parse(line); } catch { return null; }
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function bool(value) {
  return Boolean(value);
}

function listLength(value) {
  return Array.isArray(value) ? value.length : 0;
}

function summarizeSettings(settings = {}, env = process.env) {
  const screenProvider = providerSummary({
    provider: settings.screenMonitorProvider,
    endpoint: settings.screenMonitorEndpoint,
    cloudMode: settings.llmCloudMode
  });
  const reviewProvider = providerSummary({
    provider: settings.reviewLlmProvider,
    endpoint: settings.reviewLlmEndpoint,
    cloudMode: settings.llmCloudMode
  });
  return {
    autoPopupEnabled: settings.autoPopupEnabled !== false,
    popupCooldownMinutes: Number(settings.popupCooldownMinutes) || 0,
    idleNudgeMinutes: Number(settings.idleNudgeMinutes) || 0,
    activityRetentionDays: Number(settings.activityRetentionDays) || 0,
    maxMediaMb: Number(settings.maxMediaMb) || 0,
    llmCloudMode: screenProvider.cloudMode,
    rules: {
      focusKeywordCount: listLength(settings.focusKeywords),
      studyKeywordCount: listLength(settings.studyKeywords),
      gameKeywordCount: listLength(settings.gameKeywords),
      distractionKeywordCount: listLength(settings.distractionKeywords),
      workAppCount: listLength(settings.workApps),
      gameAppCount: listLength(settings.gameApps)
    },
    screenMonitor: {
      enabled: bool(settings.screenMonitorEnabled),
      provider: screenProvider.provider,
      localProvider: screenProvider.localProvider,
      endpointConfigured: bool(settings.screenMonitorEndpoint),
      modelConfigured: bool(settings.screenMonitorModel),
      apiKeyRequired: screenProvider.apiKeyRequired,
      apiKeyConfigured: bool(env.FOCUS_PET_LLM_API_KEY || env.OPENAI_API_KEY)
    },
    reviewLlm: {
      enabled: settings.reviewLlmEnabled !== false,
      provider: reviewProvider.provider,
      localProvider: reviewProvider.localProvider,
      endpointConfigured: bool(settings.reviewLlmEndpoint),
      modelConfigured: bool(settings.reviewLlmModel),
      apiKeyRequired: reviewProvider.apiKeyRequired,
      apiKeyConfigured: bool(env.FOCUS_PET_STEPFUN_API_KEY || env.FOCUS_PET_REVIEW_LLM_API_KEY || env.OPENAI_API_KEY)
    },
    updates: {
      autoCheckUpdates: bool(settings.autoCheckUpdates),
      updateFeedConfigured: bool(settings.updateFeedUrl)
    }
  };
}

function summarizePermissions(permissionStatus = {}, platform = process.platform) {
  const steps = {};
  for (const step of Array.isArray(permissionStatus.permissionGuideSteps) ? permissionStatus.permissionGuideSteps : []) {
    const key = step.id === 'screen-recording' ? 'screenRecording' : step.id || 'unknown';
    steps[key] = step.status || 'unknown';
  }
  return {
    platform: permissionStatus.platform || platform,
    checkedAt: permissionStatus.checkedAt || null,
    steps
  };
}

function dateKeyFromNow(now) {
  const value = typeof now === 'function' ? now() : now;
  const text = String(value || '');
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function summarizeTasks(tasks = [], options = {}) {
  const rows = Array.isArray(tasks) ? tasks : [];
  const total = rows.length;
  const done = rows.filter(task => Boolean(task.done)).length;
  const today = dateKeyFromNow(options.now);
  return {
    total,
    done,
    open: Math.max(0, total - done),
    highPriorityOpen: rows.filter(task => !task.done && task.priority === 'high').length,
    dueTodayOrEarlier: rows.filter(task => {
      const dueDate = String(task.dueDate || '');
      return !task.done && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && dueDate <= today;
    }).length
  };
}

function normalizeActivityStatus(value) {
  const status = String(value || '').trim();
  return ACTIVITY_STATUS_VALUES.has(status) ? status : 'unknown';
}

function activityReasonCategory(entry = {}) {
  const status = normalizeActivityStatus(entry.status);
  const reason = String(entry.reason || '');
  if (status === 'permission' || /权限|授权|录制/.test(reason)) return 'permission';
  if (status === 'game' || /游戏/.test(reason)) return 'game-rule';
  if (status === 'distracted' || /分心|偏离|娱乐|跑偏/.test(reason)) return 'distraction-rule';
  if (status === 'study' || /学习|课程|阅读|备考/.test(reason)) return 'study-rule';
  if (/当前任务|任务相关|场景|模板/.test(reason) || entry.currentTask) return 'task-context';
  if (status === 'work' || /工作|专注|App|关键词/.test(reason)) return 'focus-rule';
  return 'unknown-rule';
}

function activityReasonSummary(category) {
  return {
    'task-context': '匹配当前任务、场景模板或任务相关规则。',
    'focus-rule': '匹配工作或专注规则。',
    'study-rule': '匹配学习规则。',
    'game-rule': '匹配游戏规则。',
    'distraction-rule': '匹配疑似偏离规则。',
    permission: '需要权限修复。',
    'unknown-rule': '未能归类到明确规则。'
  }[category] || '未能归类到明确规则。';
}

function normalizeConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(Math.max(0, Math.min(1, number)) * 100) / 100;
}

function summarizeActivityDecision(entry = {}) {
  const category = activityReasonCategory(entry);
  return {
    time: cleanDiagnosticText(entry.time, 80),
    status: normalizeActivityStatus(entry.status),
    reasonCategory: category,
    reasonSummary: activityReasonSummary(category),
    confidence: normalizeConfidence(entry.confidence),
    appKnown: bool(entry.app),
    titleKnown: bool(entry.title),
    taskLinked: bool(entry.currentTask)
  };
}

function summarizeActivity(entries = [], options = {}) {
  const rows = Array.isArray(entries) ? entries.filter(Boolean) : [];
  const recentLimit = Math.max(1, Math.min(10, Number(options.recentLimit) || 5));
  const statusCounts = {};
  for (const entry of rows) {
    const status = normalizeActivityStatus(entry.status);
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }
  return {
    totalSamples: rows.length,
    statusCounts,
    recentDecisions: rows.slice(-recentLimit).map(summarizeActivityDecision)
  };
}

function numberCount(value) {
  return Math.max(0, Number(value) || 0);
}

function summarizeRtc(chatHealth = {}) {
  const rtc = chatHealth.rtc || {};
  const configured = bool(rtc.configured);
  const usingDefault = bool(rtc.usingDefault);
  const hasTurn = bool(rtc.hasTurn);
  const source = ['default-stun', 'env'].includes(rtc.source)
    ? rtc.source
    : configured
      ? 'env'
      : usingDefault
        ? 'default-stun'
        : 'unknown';
  return {
    configured,
    usingDefault,
    source,
    serverCount: numberCount(rtc.serverCount),
    stunCount: numberCount(rtc.stunCount),
    turnCount: numberCount(rtc.turnCount),
    hasStun: bool(rtc.hasStun),
    hasTurn,
    requiresTurn: rtc.requiresTurn === false ? false : !hasTurn,
    summary: hasTurn
      ? '已配置 TURN，复杂网络下实时通话更稳。'
      : usingDefault
        ? '当前使用默认 STUN，跨 NAT 或企业网络时通话可能不稳定。'
        : '未检测到 TURN，复杂网络仍可能连接失败。',
    guidance: hasTurn
      ? '诊断只展示 ICE/TURN 数量和状态，不输出服务器地址、用户名或凭据。'
      : '建议通过 FOCUS_PET_RTC_ICE_SERVERS 配置 turn: 或 turns: 服务器；诊断不输出服务器地址、用户名或凭据。'
  };
}

function summarizeWebSocket(chatHealth = {}) {
  const websocket = chatHealth.websocket || {};
  const configuredCount = numberCount(websocket.configuredAllowedOriginCount);
  const allowedOriginsConfigured = bool(websocket.allowedOriginsConfigured) || configuredCount > 0;
  const originPolicy = ['same-origin-only', 'same-origin-plus-configured'].includes(websocket.originPolicy)
    ? websocket.originPolicy
    : allowedOriginsConfigured
      ? 'same-origin-plus-configured'
      : 'same-origin-only';
  return {
    enabled: websocket.enabled !== false,
    active: bool(websocket.active),
    clients: numberCount(websocket.clients ?? chatHealth.clients),
    originPolicy,
    allowedOriginsConfigured,
    configuredAllowedOriginCount: configuredCount,
    acceptsNoOrigin: websocket.acceptsNoOrigin !== false,
    allowsFileOrigin: websocket.allowsFileOrigin !== false,
    corsWildcard: bool(websocket.corsWildcard)
  };
}

function summarizeChat(chatState = {}, chatHealth = {}) {
  return {
    ok: chatHealth.ok !== false,
    port: Number(chatHealth.port || chatState.port) || 0,
    clients: Number(chatHealth.clients) || 0,
    version: Number(chatState.version) || 0,
    friends: listLength(chatState.friends),
    sessions: listLength(chatState.sessions),
    messages: listLength(chatState.messages),
    activityLog: listLength(chatState.activityLog),
    callAuditLog: listLength(chatState.callAuditLog),
    websocket: summarizeWebSocket(chatHealth),
    rtc: summarizeRtc(chatHealth)
  };
}

function summarizeStorage(storage = {}) {
  const backupName = value => cleanDiagnosticText(path.basename(String(value || '')), 160);
  const corruptBackups = Array.isArray(storage.corruptBackups) ? storage.corruptBackups.map(backupName).filter(Boolean) : [];
  const automaticBackups = Array.isArray(storage.automaticBackups) ? storage.automaticBackups.map(backupName).filter(Boolean) : [];
  return {
    taskJsonExists: bool(storage.taskJsonExists),
    settingsJsonExists: bool(storage.settingsJsonExists),
    chatStateJsonExists: bool(storage.chatStateJsonExists),
    corruptBackupCount: corruptBackups.length,
    latestCorruptBackup: corruptBackups.at(-1) || '',
    automaticBackupCount: automaticBackups.length,
    latestAutomaticBackup: automaticBackups.at(-1) || ''
  };
}

function summarizeLogs(logs = {}) {
  const levelCounts = Object.fromEntries(LOG_LEVELS.map(level => [level, 0]));
  const inputCounts = logs.levelCounts || {};
  for (const level of LOG_LEVELS) {
    levelCounts[level] = numberCount(inputCounts[level]);
  }
  const recent = Array.isArray(logs.recent) ? logs.recent.slice(0, 10).map(entry => ({
    time: cleanDiagnosticText(entry.time, 80),
    level: normalizeLogLevel(entry.level),
    scope: cleanDiagnosticText(entry.scope || 'app', 80) || 'app',
    message: cleanDiagnosticText(entry.message, 220),
    legacy: bool(entry.legacy)
  })) : [];
  return {
    totalEntries: numberCount(logs.totalEntries),
    levelCounts,
    recent
  };
}

function parseErrorSection(section = '') {
  const lines = String(section || '').split('\n');
  const header = lines[0]?.match(/^##\s+\[([^\]]+)\]/);
  if (!header) return null;
  const fields = {};
  for (const line of lines.slice(1)) {
    const match = line.match(/^-\s*([^：:]+)[：:]\s*(.*)$/);
    if (match) fields[match[1].trim()] = match[2].trim();
  }
  const summary = {
    time: cleanDiagnosticText(header[1], 80),
    description: cleanDiagnosticText(fields['问题描述'], 180),
    location: cleanDiagnosticText(fields['发生位置'], 140),
    status: cleanDiagnosticText(fields['解决状态'], 60)
  };
  Object.defineProperty(summary, ERROR_SUMMARY_KEY, {
    value: [
      String(fields['问题描述'] || '').trim(),
      String(fields['发生位置'] || '').trim()
    ].join('\n'),
    enumerable: false
  });
  return summary;
}

function errorSummaryKey(summary = {}) {
  if (summary[ERROR_SUMMARY_KEY]) return summary[ERROR_SUMMARY_KEY];
  return [
    String(summary.description || '').trim(),
    String(summary.location || '').trim()
  ].join('\n');
}

function markClosedErrorSummaries(sections = []) {
  const resolvedKeys = new Set();
  const marked = new Array(sections.length);
  for (let index = sections.length - 1; index >= 0; index -= 1) {
    const section = sections[index];
    const key = errorSummaryKey(section);
    const isUnresolved = section.status === '未解决';
    const closedByLater = Boolean(isUnresolved && key && resolvedKeys.has(key));
    marked[index] = {
      ...section,
      closedByLater,
      open: Boolean(isUnresolved && !closedByLater)
    };
    if (section.status === '已解决' && key) {
      resolvedKeys.add(key);
    }
  }
  return marked;
}

function readRecentErrorSummaries(errorLogPath = ERROR_LOG_PATH, options = {}) {
  const limit = Math.max(1, Math.min(20, Number(options.limit) || 5));
  if (!fs.existsSync(errorLogPath)) return [];
  const sections = fs.readFileSync(errorLogPath, 'utf8')
    .split(/\n(?=##\s+\[[^\]]+\])/)
    .map(parseErrorSection)
    .filter(Boolean);
  return markClosedErrorSummaries(sections).slice(-limit);
}

function listJsonBackups(paths = [], pattern = /\.corrupt-.+\.json$/) {
  const names = [];
  for (const dir of paths) {
    try {
      if (!dir || !fs.existsSync(dir)) continue;
      for (const name of fs.readdirSync(dir)) {
        if (pattern.test(name)) names.push(name);
      }
    } catch {}
  }
  return names.sort();
}

function listCorruptBackups(paths = []) {
  return listJsonBackups(paths, /\.corrupt-.+\.json$/);
}

function listAutomaticBackups(paths = []) {
  return listJsonBackups(paths, /\.backup-.+\.json$/);
}

function buildDiagnosticsSummary(input = {}) {
  const settings = input.settings || {};
  const platform = input.platform || process.platform;
  const generatedAt = (typeof input.now === 'function' ? input.now() : input.now) || new Date().toISOString();
  return {
    schemaVersion: 1,
    version: input.packageJson?.version || '0.0.0',
    generatedAt,
    platform,
    permissions: summarizePermissions(input.permissionStatus, platform),
    settings: summarizeSettings(settings, input.env || process.env),
    tasks: summarizeTasks(input.tasks, { now: generatedAt }),
    activity: summarizeActivity(input.activityEntries),
    chat: summarizeChat(input.chatState, input.chatHealth),
    storage: summarizeStorage(input.storage),
    logs: summarizeLogs(input.logs),
    recentErrors: Array.isArray(input.recentErrors) ? input.recentErrors.slice(0, 5) : []
  };
}

function defaultPermissionStatus(platform = process.platform) {
  const profile = platformSettingsProfile(platform);
  return {
    ...profile,
    checkedAt: new Date().toISOString(),
    permissionGuideSteps: (profile.permissionGuideSteps || []).map(step => ({
      ...step,
      status: platform === 'linux' ? 'unavailable' : 'unknown'
    }))
  };
}

function buildRuntimeDiagnosticsSummary(options = {}) {
  const packageJson = options.packageJson || require('../package.json');
  const dataDir = options.dataDir || DATA_DIR;
  const socialDataDir = options.socialDataDir || SOCIAL_DATA_DIR;
  const env = options.env || process.env;
  const settings = options.settings || readSettingsForDiagnostics(dataDir);
  const tasks = options.tasks || readTasksForDiagnostics(dataDir);
  const activityEntries = options.activityEntries || readActivityForDiagnostics(dataDir);
  const chatState = options.chatState || readJsonSafe(path.join(socialDataDir, 'chat-state.json'), {});
  const baseChatHealth = options.chatHealth || {
    ok: true,
    port: Number(env.FOCUS_PET_CHAT_PORT || env.PORT) || 47321,
    clients: 0
  };
  const chatHealth = {
    ...baseChatHealth,
    rtc: baseChatHealth.rtc || getChatService().rtcIceServerSummary(env)
  };
  const storage = options.storage || {
    taskJsonExists: fs.existsSync(path.join(dataDir, path.basename(TASK_JSON_PATH))),
    settingsJsonExists: fs.existsSync(path.join(dataDir, path.basename(SETTINGS_PATH))),
    chatStateJsonExists: fs.existsSync(path.join(socialDataDir, path.basename(CHAT_STATE_PATH))),
    corruptBackups: listCorruptBackups([dataDir, socialDataDir]),
    automaticBackups: listAutomaticBackups([dataDir, socialDataDir])
  };
  return buildDiagnosticsSummary({
    packageJson,
    now: options.now,
    platform: options.platform || process.platform,
    permissionStatus: options.permissionStatus || defaultPermissionStatus(options.platform || process.platform),
    settings,
    env,
    tasks,
    activityEntries,
    chatState,
    chatHealth,
    storage,
    logs: options.logs || readRuntimeLogSummary(options.runtimeLogPath || DEFAULT_RUNTIME_LOG_PATH, { limit: 5 }),
    recentErrors: options.recentErrors || readRecentErrorSummaries(options.errorLogPath || ERROR_LOG_PATH, { limit: 5 })
  });
}

function diagnosticsBundleName(summary = {}) {
  const raw = String(summary.generatedAt || new Date().toISOString());
  const parsed = new Date(raw);
  const iso = Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
  const compact = iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, '').replace('T', '-');
  return `focus-pet-diagnostics-${compact}`;
}

function renderDiagnosticsBundleManifest(summary = {}, options = {}) {
  const files = options.files || ['summary.json', 'manifest.md'];
  const name = options.name || diagnosticsBundleName(summary);
  return [
    '# Focus Pet 诊断包',
    '',
    `诊断包：${name}`,
    `生成时间：${summary.generatedAt || ''}`,
    `应用版本：${summary.version || '0.0.0'}`,
    `平台：${summary.platform || process.platform}`,
    '',
    '## 包含文件',
    '',
    ...files.map(file => `- \`${file}\``),
    '',
    '## 内容边界',
    '',
    '该诊断包只包含已经脱敏的运行摘要和本说明文件。',
    '',
    '不会包含聊天正文、任务全文、截图、API key、session token、邀请码、LLM endpoint/model 原文、ICE/TURN 地址或通话 SDP/ICE。',
    '',
    '## 摘要计数',
    '',
    `- 任务总数：${summary.tasks?.total ?? 0}`,
    `- 聊天消息数：${summary.chat?.messages ?? 0}`,
    `- 活动日志数：${summary.chat?.activityLog ?? 0}`,
    `- 通话审计数：${summary.chat?.callAuditLog ?? 0}`,
    `- 运行日志数：${summary.logs?.totalEntries ?? 0}`,
    `- 运行错误日志数：${summary.logs?.levelCounts?.error ?? 0}`,
    `- 最近错误摘要数：${Array.isArray(summary.recentErrors) ? summary.recentErrors.length : 0}`,
    ''
  ].join('\n');
}

function buildDiagnosticsBundle(options = {}) {
  const summary = options.summary || buildRuntimeDiagnosticsSummary(options);
  const name = diagnosticsBundleName(summary);
  const manifest = renderDiagnosticsBundleManifest(summary, { files: ['summary.json', 'manifest.md'], name });
  return {
    schemaVersion: 1,
    name,
    generatedAt: summary.generatedAt,
    files: [
      {
        path: 'summary.json',
        contentType: 'application/json',
        content: `${JSON.stringify(summary, null, 2)}\n`
      },
      {
        path: 'manifest.md',
        contentType: 'text/markdown',
        content: manifest
      }
    ],
    excluded: [
      'chat message bodies',
      'task bodies',
      'screenshots',
      'API keys',
      'session tokens',
      'invite codes',
      'LLM endpoints and model names',
      'ICE/TURN URLs and credentials',
      'SDP and ICE candidates',
      'raw runtime logs'
    ]
  };
}

function pruneDiagnosticsBundles(outputDir, maxBundles = DEFAULT_DIAGNOSTICS_BUNDLE_RETENTION) {
  const keep = Math.max(1, Number.parseInt(maxBundles, 10) || DEFAULT_DIAGNOSTICS_BUNDLE_RETENTION);
  if (!fs.existsSync(outputDir)) return { removedBundleCount: 0, retainedBundleCount: 0 };
  const bundleDirs = fs.readdirSync(outputDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && DIAGNOSTICS_BUNDLE_NAME_PATTERN.test(entry.name))
    .map(entry => entry.name)
    .sort((left, right) => right.localeCompare(left));
  const staleBundleDirs = bundleDirs.slice(keep);
  for (const name of staleBundleDirs) {
    fs.rmSync(path.join(outputDir, name), { recursive: true, force: true });
  }
  return {
    removedBundleCount: staleBundleDirs.length,
    retainedBundleCount: Math.min(bundleDirs.length, keep)
  };
}

function writeDiagnosticsBundle(options = {}) {
  const outputDir = options.outputDir || DEFAULT_DIAGNOSTICS_OUTPUT_DIR;
  const bundle = buildDiagnosticsBundle(options);
  const targetDir = path.join(outputDir, bundle.name);
  fs.mkdirSync(targetDir, { recursive: true });
  const files = [];
  for (const file of bundle.files) {
    const filePath = path.join(targetDir, file.path);
    fs.writeFileSync(filePath, file.content, 'utf8');
    files.push(filePath);
  }
  const retention = pruneDiagnosticsBundles(outputDir, options.maxBundles);
  return {
    ok: true,
    dir: targetDir,
    name: bundle.name,
    files,
    ...retention
  };
}

module.exports = {
  buildDiagnosticsBundle,
  buildDiagnosticsSummary,
  buildRuntimeDiagnosticsSummary,
  diagnosticsBundleName,
  writeDiagnosticsBundle,
  readRecentErrorSummaries,
  cleanDiagnosticText
};
