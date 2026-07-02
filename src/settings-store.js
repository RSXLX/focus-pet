const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { readJsonWithRecovery, writeJsonAtomic } = require('./json-storage');
const {
  DEFAULT_SCREEN_CHECK_CLOUD_URL,
  DEFAULT_STEPFUN_ENDPOINT,
  DEFAULT_STEPFUN_SCREEN_MODEL,
  normalizeLlmCloudMode,
  normalizeLlmProvider,
  normalizeScreenCheckCloudUrl
} = require('./llm-provider');
const { DEFAULT_UPDATE_FEED_URL, normalizeUpdateFeedUrl } = require('./update-service');

const DATA_DIR = path.join(os.homedir(), '.hermes', 'focus-watchdog');
const SETTINGS_PATH = path.join(DATA_DIR, 'settings.json');
const SETTINGS_SCHEMA_VERSION = 1;
const DEFAULT_REVIEW_LLM_ENDPOINT = 'https://api.stepfun.com/step_plan/v1';
const DEFAULT_REVIEW_LLM_MODEL = 'step-3.7-flash';
const DEFAULT_VOICE_RECORD_SHORTCUT = 'Alt+R';
const SOCIAL_ACTIVITY_SHARE_LEVELS = new Set(['presence', 'status', 'summary', 'screen-summary']);
const SCREEN_CHECK_TRANSPORTS = new Set(['auto', 'cloud', 'direct']);

const DEFAULT_SETTINGS = {
  popupCooldownMinutes: 8,
  idleNudgeMinutes: 10,
  activityRetentionDays: 30,
  autoPopupEnabled: true,
  maxMediaMb: 25,
  petBehaviorIntensity: 'normal',
  launchAtLogin: false,
  autoCheckUpdates: true,
  updateFeedUrl: DEFAULT_UPDATE_FEED_URL,
  llmCloudMode: 'allowed',
  screenMonitorProvider: 'stepfun',
  screenMonitorEnabled: false,
  screenMonitorIntervalSeconds: 45,
  screenMonitorEndpoint: DEFAULT_STEPFUN_ENDPOINT,
  screenMonitorModel: DEFAULT_STEPFUN_SCREEN_MODEL,
  screenCheckTransport: 'auto',
  screenCheckCloudUrl: DEFAULT_SCREEN_CHECK_CLOUD_URL,
  screenCheckDeviceId: '',
  reviewLlmProvider: 'openai-compatible',
  reviewLlmEnabled: true,
  reviewLlmEndpoint: DEFAULT_REVIEW_LLM_ENDPOINT,
  reviewLlmModel: DEFAULT_REVIEW_LLM_MODEL,
  voiceRecordShortcut: DEFAULT_VOICE_RECORD_SHORTCUT,
  socialActivityShareLevel: 'presence',
  focusKeywords: ['hermes', 'agent', 'python', 'fastapi', 'github', 'docs', 'notion', 'obsidian', '选品', '电商', '学习', '工作', 'code', 'cursor'],
  studyKeywords: ['学习', '课程', '网课', '复习', '作业', '考试', '教材', '论文', '笔记', 'anki', 'leetcode'],
  gameKeywords: ['游戏', 'steam', 'epic games', 'battle.net', 'hades', 'minecraft', 'roblox', 'valorant', 'league of legends', 'lol', '原神', '王者荣耀', '崩坏'],
  distractionKeywords: ['bilibili', 'youtube', '抖音', 'douyin', 'x.com', 'twitter', 'reddit', 'netflix', '小红书', 'xiaohongshu'],
  gameApps: ['Steam', 'Epic Games Launcher', 'Battle.net', 'Riot Client'],
  workApps: ['Hermes', 'Terminal', 'iTerm2', 'Code', 'Cursor', 'Visual Studio Code', 'Safari', 'Google Chrome', 'Chrome', 'Notion', 'Obsidian']
};

const SHORTCUT_MODIFIERS = ['Ctrl', 'Cmd', 'Alt', 'Shift'];
const SHORTCUT_ALIASES = new Map([
  ['control', 'Ctrl'],
  ['ctrl', 'Ctrl'],
  ['command', 'Cmd'],
  ['cmd', 'Cmd'],
  ['meta', 'Cmd'],
  ['option', 'Alt'],
  ['alt', 'Alt'],
  ['shift', 'Shift'],
  ['space', 'Space'],
  ['return', 'Enter'],
  ['enter', 'Enter'],
  ['esc', 'Escape'],
  ['escape', 'Escape']
]);

function ensureDir(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function cleanList(value, fallback) {
  const raw = Array.isArray(value)
    ? value
    : String(value || '').split(/[\n,，]/);
  const list = raw.map(item => String(item || '').trim()).filter(Boolean);
  return list.length ? [...new Set(list)].slice(0, 80) : fallback;
}

function cleanEndpoint(value, fallback = '') {
  const endpoint = String(value || '').trim();
  if (/^https?:\/\//.test(endpoint)) return endpoint;
  return fallback;
}

function cleanShortcutToken(value) {
  const token = String(value || '').trim();
  if (!token) return '';
  const lower = token.toLowerCase();
  if (SHORTCUT_ALIASES.has(lower)) return SHORTCUT_ALIASES.get(lower);
  if (/^key[a-z]$/i.test(token)) return token.slice(3).toUpperCase();
  if (/^[a-z]$/i.test(token)) return token.toUpperCase();
  if (/^digit[0-9]$/i.test(token)) return token.slice(5);
  if (/^[0-9]$/.test(token)) return token;
  if (/^f([1-9]|1[0-2])$/i.test(token)) return token.toUpperCase();
  return '';
}

function cleanVoiceRecordShortcut(value, fallback = DEFAULT_VOICE_RECORD_SHORTCUT) {
  const parts = String(value || '').split('+').map(cleanShortcutToken).filter(Boolean);
  const modifiers = [];
  let key = '';
  for (const part of parts) {
    if (SHORTCUT_MODIFIERS.includes(part)) {
      if (!modifiers.includes(part)) modifiers.push(part);
      continue;
    }
    if (key) return fallback;
    key = part;
  }
  if (!key || !modifiers.length) return fallback;
  return [...SHORTCUT_MODIFIERS.filter(modifier => modifiers.includes(modifier)), key].join('+');
}

function normalizeSocialActivityShareLevel(value) {
  const level = String(value || '').trim();
  return SOCIAL_ACTIVITY_SHARE_LEVELS.has(level) ? level : DEFAULT_SETTINGS.socialActivityShareLevel;
}

function normalizeScreenCheckTransport(value) {
  const transport = String(value || '').trim();
  return SCREEN_CHECK_TRANSPORTS.has(transport) ? transport : DEFAULT_SETTINGS.screenCheckTransport;
}

function makeScreenCheckDeviceId() {
  return `screen-${randomUUID().replaceAll('-', '').slice(0, 24)}`;
}

function normalizeScreenCheckDeviceId(value) {
  const deviceId = String(value || '').trim();
  return /^[A-Za-z0-9._:-]{8,120}$/.test(deviceId) ? deviceId : makeScreenCheckDeviceId();
}

function isLegacyEmptyScreenCheckConfig(input = {}) {
  return input.screenMonitorProvider === 'openai-compatible'
    && !String(input.screenMonitorEndpoint || '').trim()
    && !String(input.screenMonitorModel || '').trim();
}

function stripTrailingSlashes(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function isHalfMigratedStepFunScreenCheckConfig(input = {}) {
  return input.screenMonitorProvider === 'openai-compatible'
    && stripTrailingSlashes(input.screenMonitorEndpoint) === DEFAULT_STEPFUN_ENDPOINT
    && String(input.screenMonitorModel || '').trim() === DEFAULT_STEPFUN_SCREEN_MODEL;
}

function normalizeSettings(input = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...input };
  const upgradeLegacyScreenCheck = isLegacyEmptyScreenCheckConfig(input) || isHalfMigratedStepFunScreenCheckConfig(input);
  return {
    popupCooldownMinutes: clampNumber(settings.popupCooldownMinutes, 1, 120, DEFAULT_SETTINGS.popupCooldownMinutes),
    idleNudgeMinutes: clampNumber(settings.idleNudgeMinutes, 1, 60, DEFAULT_SETTINGS.idleNudgeMinutes),
    activityRetentionDays: clampNumber(settings.activityRetentionDays, 1, 365, DEFAULT_SETTINGS.activityRetentionDays),
    autoPopupEnabled: settings.autoPopupEnabled !== false,
    maxMediaMb: clampNumber(settings.maxMediaMb, 1, 100, DEFAULT_SETTINGS.maxMediaMb),
    petBehaviorIntensity: ['calm', 'normal', 'active'].includes(settings.petBehaviorIntensity) ? settings.petBehaviorIntensity : DEFAULT_SETTINGS.petBehaviorIntensity,
    launchAtLogin: Boolean(settings.launchAtLogin),
    autoCheckUpdates: Boolean(settings.autoCheckUpdates),
    updateFeedUrl: normalizeUpdateFeedUrl(settings.updateFeedUrl),
    llmCloudMode: normalizeLlmCloudMode(settings.llmCloudMode),
    screenMonitorProvider: upgradeLegacyScreenCheck ? DEFAULT_SETTINGS.screenMonitorProvider : normalizeLlmProvider(settings.screenMonitorProvider),
    screenMonitorEnabled: Boolean(settings.screenMonitorEnabled),
    screenMonitorIntervalSeconds: clampNumber(settings.screenMonitorIntervalSeconds, 15, 300, DEFAULT_SETTINGS.screenMonitorIntervalSeconds),
    screenMonitorEndpoint: upgradeLegacyScreenCheck ? DEFAULT_SETTINGS.screenMonitorEndpoint : cleanEndpoint(settings.screenMonitorEndpoint),
    screenMonitorModel: upgradeLegacyScreenCheck ? DEFAULT_SETTINGS.screenMonitorModel : String(settings.screenMonitorModel || '').trim().slice(0, 120),
    screenCheckTransport: normalizeScreenCheckTransport(settings.screenCheckTransport),
    screenCheckCloudUrl: normalizeScreenCheckCloudUrl(settings.screenCheckCloudUrl),
    screenCheckDeviceId: normalizeScreenCheckDeviceId(settings.screenCheckDeviceId),
    reviewLlmProvider: normalizeLlmProvider(settings.reviewLlmProvider),
    reviewLlmEnabled: settings.reviewLlmEnabled !== false,
    reviewLlmEndpoint: cleanEndpoint(settings.reviewLlmEndpoint, DEFAULT_SETTINGS.reviewLlmEndpoint),
    reviewLlmModel: String(settings.reviewLlmModel || DEFAULT_SETTINGS.reviewLlmModel).trim().slice(0, 120) || DEFAULT_SETTINGS.reviewLlmModel,
    voiceRecordShortcut: cleanVoiceRecordShortcut(settings.voiceRecordShortcut),
    socialActivityShareLevel: normalizeSocialActivityShareLevel(settings.socialActivityShareLevel),
    focusKeywords: cleanList(settings.focusKeywords, DEFAULT_SETTINGS.focusKeywords),
    studyKeywords: cleanList(settings.studyKeywords, DEFAULT_SETTINGS.studyKeywords),
    gameKeywords: cleanList(settings.gameKeywords, DEFAULT_SETTINGS.gameKeywords),
    distractionKeywords: cleanList(settings.distractionKeywords, DEFAULT_SETTINGS.distractionKeywords),
    gameApps: cleanList(settings.gameApps, DEFAULT_SETTINGS.gameApps),
    workApps: cleanList(settings.workApps, DEFAULT_SETTINGS.workApps)
  };
}

function migrateSettingsState(payload = {}) {
  const input = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  return {
    ...input,
    version: SETTINGS_SCHEMA_VERSION,
    ...normalizeSettings(input)
  };
}

function createSettingsStore({ dataDir = DATA_DIR } = {}) {
  const settingsPath = path.join(dataDir, 'settings.json');

  function save(settings) {
    ensureDir(dataDir);
    const normalized = migrateSettingsState(settings);
    writeJsonAtomic(settingsPath, normalized, { backupLabel: 'settings', maxBackups: 5 });
    return normalized;
  }

  function getSettings() {
    ensureDir(dataDir);
    if (!fs.existsSync(settingsPath)) return save(DEFAULT_SETTINGS);
    const result = readJsonWithRecovery(settingsPath, {
      fallback: DEFAULT_SETTINGS,
      backupLabel: 'settings',
      normalize: migrateSettingsState
    });
    return save(result.value);
  }

  function updateSettings(patch) {
    return save({ ...getSettings(), ...patch });
  }

  return { getSettings, updateSettings };
}

module.exports = {
  DATA_DIR,
  SETTINGS_PATH,
  SETTINGS_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  createSettingsStore,
  normalizeSettings,
  migrateSettingsState,
  normalizeSocialActivityShareLevel
};
