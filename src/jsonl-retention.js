const fs = require('node:fs');
const path = require('node:path');

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_RETENTION_DAYS = 30;

function normalizeRetentionDays(value, fallback = DEFAULT_RETENTION_DAYS) {
  const fallbackNumber = Number(fallback);
  const number = Number(value);
  const days = Number.isFinite(number)
    ? number
    : (Number.isFinite(fallbackNumber) ? fallbackNumber : DEFAULT_RETENTION_DAYS);
  return Math.min(365, Math.max(1, Math.round(days)));
}

function parseTimeMs(value) {
  const time = Date.parse(String(value || ''));
  return Number.isFinite(time) ? time : null;
}

function resolveNowMs(now, fallbackTime) {
  const value = typeof now === 'function' ? now() : now;
  return parseTimeMs(value) ?? parseTimeMs(fallbackTime) ?? Date.now();
}

function defaultParseJsonLine(line) {
  try { return JSON.parse(line); } catch { return null; }
}

function readJsonLines(filePath, options = {}) {
  if (!fs.existsSync(filePath)) return [];
  const parseLine = typeof options.parseLine === 'function' ? options.parseLine : defaultParseJsonLine;
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(parseLine)
    .filter(Boolean);
}

function shouldRetainJsonlEntry(entry, cutoffMs) {
  const time = parseTimeMs(entry && entry.time);
  return time === null || time >= cutoffMs;
}

function writeJsonLinesAtomic(filePath, entries, options = {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  const serializeEntry = typeof options.serializeEntry === 'function' ? options.serializeEntry : JSON.stringify;
  const body = entries.map(serializeEntry).join('\n');
  fs.writeFileSync(tmpPath, body ? `${body}\n` : '', 'utf8');
  fs.renameSync(tmpPath, filePath);
}

function appendJsonlWithRetention(entry, options = {}) {
  if (!options.logPath) throw new Error('logPath is required');
  const retentionDays = normalizeRetentionDays(options.retentionDays, options.fallbackRetentionDays);
  const cutoffMs = resolveNowMs(options.now, entry && entry.time) - retentionDays * DAY_MS;
  const entries = [...readJsonLines(options.logPath, { parseLine: options.parseLine }), entry].filter(item => shouldRetainJsonlEntry(item, cutoffMs));
  writeJsonLinesAtomic(options.logPath, entries, { serializeEntry: options.serializeEntry });
  return entries;
}

module.exports = {
  appendJsonlWithRetention,
  normalizeRetentionDays,
  readJsonLines,
  shouldRetainJsonlEntry
};
