const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function ensureDirForFile(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeLabel(value, fallback = 'state') {
  return String(value || fallback).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '') || fallback;
}

function timestampForPath(now = () => new Date()) {
  const value = typeof now === 'function' ? now() : now;
  const time = value instanceof Date ? value : new Date(value || Date.now());
  return time.toISOString().replace(/[:.]/g, '-');
}

function uniquePath(dir, nameForIndex) {
  let index = 0;
  let candidate = path.join(dir, nameForIndex(index));
  while (fs.existsSync(candidate)) {
    index += 1;
    candidate = path.join(dir, nameForIndex(index));
  }
  return candidate;
}

function backupPathFor(filePath, label = '', options = {}) {
  const dir = path.dirname(filePath);
  const base = safeLabel(label || path.basename(filePath, path.extname(filePath)));
  const stamp = timestampForPath(options.now);
  return uniquePath(dir, index => `${base}.corrupt-${stamp}${index ? `-${index}` : ''}.json`);
}

function automaticBackupPathFor(filePath, label = '', options = {}) {
  const dir = path.dirname(filePath);
  const base = safeLabel(label || path.basename(filePath, path.extname(filePath)));
  const stamp = timestampForPath(options.now);
  return uniquePath(dir, index => `${base}.backup-${stamp}${index ? `-${index}` : ''}.json`);
}

function listAutomaticBackups(filePath, label = '') {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) return [];
  const base = safeLabel(label || path.basename(filePath, path.extname(filePath)));
  const pattern = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.backup-.+\\.json$`);
  return fs.readdirSync(dir)
    .filter(name => pattern.test(name))
    .map(name => path.join(dir, name))
    .sort();
}

function rotateAutomaticBackups(filePath, label = '', maxBackups = 5) {
  const limit = Math.max(0, Math.floor(Number(maxBackups) || 0));
  if (!limit) return;
  const backups = listAutomaticBackups(filePath, label);
  for (const backup of backups.slice(0, Math.max(0, backups.length - limit))) {
    fs.rmSync(backup, { force: true });
  }
}

function preserveAutomaticBackup(filePath, options = {}) {
  if (!fs.existsSync(filePath)) return '';
  const maxBackups = Math.max(0, Math.floor(Number(options.maxBackups) || 0));
  if (!maxBackups) return '';
  const backupPath = automaticBackupPathFor(filePath, options.backupLabel, options);
  fs.copyFileSync(filePath, backupPath);
  rotateAutomaticBackups(filePath, options.backupLabel, maxBackups);
  return backupPath;
}

function writeJsonAtomic(filePath, value, options = {}) {
  ensureDirForFile(filePath);
  const dir = path.dirname(filePath);
  const tempPath = path.join(dir, `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    preserveAutomaticBackup(filePath, options);
    fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    fs.rmSync(tempPath, { force: true });
    throw error;
  }
}

function preserveCorruptFile(filePath, label) {
  if (!fs.existsSync(filePath)) return '';
  const backupPath = backupPathFor(filePath, label);
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

function readJsonWithRecovery(filePath, options = {}) {
  const normalize = typeof options.normalize === 'function' ? options.normalize : value => value;
  const fallback = cloneJson(options.fallback);
  ensureDirForFile(filePath);

  if (!fs.existsSync(filePath)) {
    const value = normalize(fallback);
    writeJsonAtomic(filePath, value);
    return { value, recovered: false, backupPath: '' };
  }

  try {
    return {
      value: normalize(JSON.parse(fs.readFileSync(filePath, 'utf8'))),
      recovered: false,
      backupPath: ''
    };
  } catch {
    const backupPath = preserveCorruptFile(filePath, options.backupLabel);
    const value = normalize(fallback);
    writeJsonAtomic(filePath, value);
    return { value, recovered: true, backupPath };
  }
}

module.exports = {
  readJsonWithRecovery,
  writeJsonAtomic,
  automaticBackupPathFor,
  backupPathFor
};
