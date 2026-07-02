const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { appendJsonlWithRetention } = require('./jsonl-retention');

const LOG_LEVELS = ['debug', 'info', 'warn', 'error'];
const DEFAULT_RUNTIME_LOG_PATH = path.join(os.homedir(), '.hermes', 'focus-watchdog', 'focus-pet.log');
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
const LOCAL_ABSOLUTE_PATH_PATTERN = /(^|[\s`"'(:=])(?:\/(?:Users|private|tmp|var\/folders)\/[^\s`"')\]}]+|[A-Za-z]:\\{1,2}(?:Users|Documents and Settings|ProgramData|Windows|Temp|tmp)\\{1,2}[^\s`"')\]}]+)/g;
const SECRET_ASSIGNMENT_PATTERN = /\b(?:api[-_]?key|auth[-_]?token|session[-_]?token|invite[-_]?code|token|secret|credential|password)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;|]+)/gi;

function normalizeLogLevel(level) {
  const value = String(level || '').trim().toLowerCase();
  return LOG_LEVELS.includes(value) ? value : 'info';
}

function sanitizeLogText(value, maxLength = 600) {
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
    .replace(/\b[A-Za-z0-9_-]{24,}\b/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function sanitizeScope(value) {
  return sanitizeLogText(value || 'app', 80) || 'app';
}

function resolveLogTime(now) {
  if (typeof now === 'function') return sanitizeLogText(now(), 80) || new Date().toISOString();
  if (now) return sanitizeLogText(now, 80) || new Date().toISOString();
  return new Date().toISOString();
}

function buildRuntimeLogEntry({ level = 'info', message = '', scope = 'app', now } = {}) {
  return {
    schemaVersion: 1,
    time: resolveLogTime(now),
    level: normalizeLogLevel(level),
    scope: sanitizeScope(scope),
    message: sanitizeLogText(message)
  };
}

function formatRuntimeLogEntry(entry = {}) {
  return JSON.stringify(buildRuntimeLogEntry(entry));
}

function writeRuntimeLog(options = {}) {
  const logPath = options.logPath || DEFAULT_RUNTIME_LOG_PATH;
  const entry = buildRuntimeLogEntry(options);
  if (Object.prototype.hasOwnProperty.call(options, 'retentionDays')) {
    appendJsonlWithRetention(entry, {
      logPath,
      retentionDays: options.retentionDays,
      now: entry.time,
      parseLine: parseRuntimeLogLine
    });
  } else {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`, 'utf8');
  }
  return entry;
}

function parseLegacyRuntimeLogLine(line) {
  const match = String(line || '').match(/^\[([^\]]+)\]\s*(.*)$/);
  return {
    time: sanitizeLogText(match ? match[1] : '', 80),
    level: 'info',
    scope: 'legacy',
    message: sanitizeLogText(match ? match[2] : line),
    legacy: true
  };
}

function parseRuntimeLogLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      return {
        time: sanitizeLogText(parsed.time, 80),
        level: normalizeLogLevel(parsed.level),
        scope: sanitizeScope(parsed.scope),
        message: sanitizeLogText(parsed.message),
        legacy: false
      };
    }
  } catch {}
  return parseLegacyRuntimeLogLine(trimmed);
}

function emptyRuntimeLogSummary() {
  return {
    totalEntries: 0,
    levelCounts: Object.fromEntries(LOG_LEVELS.map(level => [level, 0])),
    recent: []
  };
}

function readRuntimeLogSummary(logPath = DEFAULT_RUNTIME_LOG_PATH, options = {}) {
  const limit = Math.max(1, Math.min(20, Number(options.limit) || 5));
  const summary = emptyRuntimeLogSummary();
  try {
    if (!logPath || !fs.existsSync(logPath)) return summary;
    const entries = fs.readFileSync(logPath, 'utf8')
      .split('\n')
      .map(parseRuntimeLogLine)
      .filter(Boolean);
    summary.totalEntries = entries.length;
    for (const entry of entries) {
      const level = normalizeLogLevel(entry.level);
      summary.levelCounts[level] = (summary.levelCounts[level] || 0) + 1;
    }
    summary.recent = entries.slice(-limit);
    return summary;
  } catch {
    return summary;
  }
}

module.exports = {
  DEFAULT_RUNTIME_LOG_PATH,
  LOG_LEVELS,
  buildRuntimeLogEntry,
  formatRuntimeLogEntry,
  normalizeLogLevel,
  readRuntimeLogSummary,
  sanitizeLogText,
  writeRuntimeLog
};
