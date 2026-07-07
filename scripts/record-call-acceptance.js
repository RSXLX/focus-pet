#!/usr/bin/env node
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEFAULT_OUTPUT_DIR = path.join('output', 'call-acceptance');
const SENSITIVE_PATTERNS = [
  { issue: 'friend-code', pattern: /\bfriendCode\b|好友码\s*[：:]\s*\d{4,}/i },
  { issue: 'auth-token', pattern: /\bauthToken\b|\bauth[-_ ]?token\b/i },
  { issue: 'device-id', pattern: /\bdeviceId\b|\bdevice[-_ ]?id\b/i },
  { issue: 'sdp', pattern: /\bsdp\b|v=0\r?\n/i },
  { issue: 'ice-candidate', pattern: /\bcandidate\b|candidate:/i },
  { issue: 'ice-servers', pattern: /\biceServers\b|\bice[-_ ]?servers\b/i },
  { issue: 'turn-url', pattern: /(^|[\s`"'])turns?:[^\s`"']+/i },
  { issue: 'websocket-url', pattern: /\bwss?:\/\/[^\s`"'<>)]+/i },
  { issue: 'http-url', pattern: /\bhttps?:\/\/[^\s`"'<>)]+/i },
  { issue: 'ip-address', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/ }
];

function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    sideA: '',
    sideB: '',
    mode: 'auto',
    out: '',
    requireRelay: true,
    json: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--side-a') {
      options.sideA = argv[index + 1] || '';
      index += 1;
    } else if (arg.startsWith('--side-a=')) {
      options.sideA = arg.slice('--side-a='.length);
    } else if (arg === '--side-b') {
      options.sideB = argv[index + 1] || '';
      index += 1;
    } else if (arg.startsWith('--side-b=')) {
      options.sideB = arg.slice('--side-b='.length);
    } else if (arg === '--mode') {
      options.mode = argv[index + 1] || options.mode;
      index += 1;
    } else if (arg.startsWith('--mode=')) {
      options.mode = arg.slice('--mode='.length);
    } else if (arg === '--out') {
      options.out = argv[index + 1] || '';
      index += 1;
    } else if (arg.startsWith('--out=')) {
      options.out = arg.slice('--out='.length);
    } else if (arg === '--no-require-relay') {
      options.requireRelay = false;
    } else if (arg === '--require-relay') {
      options.requireRelay = true;
    } else if (arg === '--json') {
      options.json = true;
    }
  }
  options.mode = String(options.mode || 'auto').toLowerCase();
  if (!['auto', 'audio', 'video'].includes(options.mode)) options.mode = 'auto';
  return options;
}

function readInputFile(filePath) {
  if (!filePath) throw new Error('missing input file');
  return fs.readFileSync(filePath, 'utf8');
}

function scanSensitiveText(text = '') {
  const issues = [];
  for (const item of SENSITIVE_PATTERNS) {
    if (item.pattern.test(String(text || ''))) issues.push(item.issue);
  }
  return issues;
}

function parseKeyValueLine(line = '') {
  const match = String(line).match(/^([^：:]+)[：:]\s*(.*)$/);
  if (!match) return null;
  return {
    key: match[1].trim().toLowerCase(),
    value: match[2].trim()
  };
}

function parseRemoteKinds(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'none' || raw === '-') return [];
  if (/音视频|audio.*video|video.*audio/.test(raw)) return ['audio', 'video'];
  const kinds = new Set();
  for (const part of raw.split(/[,\s，、/]+/).map(item => item.trim()).filter(Boolean)) {
    if (part === 'audio' || part === '音频') kinds.add('audio');
    if (part === 'video' || part === '视频') kinds.add('video');
  }
  return [...kinds].sort();
}

function normalizeRelay(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'yes' || raw === 'true' || raw === 'relay') return 'yes';
  if (raw === 'no' || raw === 'false') return 'no';
  return raw || 'unknown';
}

function parseCallAcceptanceSummary(text = '') {
  const raw = String(text || '').trim();
  const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const result = {
    headerOk: lines[0] === 'Focus Pet 通话验收状态',
    capturedAt: '',
    mode: '',
    status: '',
    remoteKinds: [],
    connection: '',
    relay: 'unknown',
    source: '',
    sensitiveIssues: scanSensitiveText(raw)
  };
  for (const line of lines.slice(1)) {
    const pair = parseKeyValueLine(line);
    if (!pair) continue;
    if (pair.key === '时间') result.capturedAt = pair.value;
    if (pair.key === '模式') result.mode = pair.value.toLowerCase();
    if (pair.key === '状态') result.status = pair.value;
    if (pair.key === '远端媒体') result.remoteKinds = parseRemoteKinds(pair.value);
    if (pair.key === '连接') result.connection = pair.value.toLowerCase();
    if (pair.key === 'relay') result.relay = normalizeRelay(pair.value);
    if (pair.key === '来源') result.source = pair.value.toLowerCase();
  }
  return result;
}

function connectionLooksReady(summary = {}) {
  const connection = String(summary.connection || '').toLowerCase();
  const status = String(summary.status || '');
  return ['connected', 'completed'].includes(connection)
    || /(?:^|\/)(?:connected|completed)(?:\/|$)/.test(connection)
    || /已连接|通话中|对方已接听/.test(status);
}

function summaryHasRelay(summary = {}) {
  return summary.relay === 'yes' || /\brelay\b/i.test(String(summary.status || ''));
}

function expectedKindsForMode(mode) {
  return mode === 'video' ? ['audio', 'video'] : ['audio'];
}

function missingRemoteKinds(summary, mode) {
  const kinds = new Set(summary.remoteKinds || []);
  return expectedKindsForMode(mode).filter(kind => !kinds.has(kind));
}

function validateOneSummary(summary, label, mode, options = {}) {
  const failures = [];
  if (!summary.headerOk) failures.push(`${label}:missing-header`);
  if (summary.sensitiveIssues.length) failures.push(`${label}:sensitive-${summary.sensitiveIssues.join('+')}`);
  if (summary.mode !== mode) failures.push(`${label}:mode-${summary.mode || 'missing'}`);
  if (summary.source !== 'cloud') failures.push(`${label}:source-${summary.source || 'missing'}`);
  if (!summary.capturedAt || Number.isNaN(Date.parse(summary.capturedAt))) failures.push(`${label}:invalid-time`);
  if (!connectionLooksReady(summary)) failures.push(`${label}:not-connected`);
  const missingKinds = missingRemoteKinds(summary, mode);
  if (missingKinds.length) failures.push(`${label}:missing-remote-${missingKinds.join('+')}`);
  if (options.requireRelay && !summaryHasRelay(summary)) failures.push(`${label}:relay-missing`);
  return failures;
}

function validateCallAcceptancePair(input = {}, options = {}) {
  const sideA = typeof input.sideA === 'string' ? parseCallAcceptanceSummary(input.sideA) : input.sideA;
  const sideB = typeof input.sideB === 'string' ? parseCallAcceptanceSummary(input.sideB) : input.sideB;
  const requestedMode = options.mode && options.mode !== 'auto' ? options.mode : sideA?.mode;
  const mode = ['audio', 'video'].includes(requestedMode) ? requestedMode : 'audio';
  const requireRelay = options.requireRelay !== false;
  const failures = [
    ...validateOneSummary(sideA || {}, 'sideA', mode, { requireRelay }),
    ...validateOneSummary(sideB || {}, 'sideB', mode, { requireRelay })
  ];
  if (sideA?.mode && sideB?.mode && sideA.mode !== sideB.mode) failures.push('mode-mismatch');
  return {
    ok: failures.length === 0,
    mode,
    requireRelay,
    failures,
    sideA,
    sideB
  };
}

function formatSummary(summary = {}) {
  return [
    `- 时间：${summary.capturedAt || 'unknown'}`,
    `- 模式：${summary.mode || 'unknown'}`,
    `- 状态：${summary.status || 'unknown'}`,
    `- 远端媒体：${summary.remoteKinds?.length ? summary.remoteKinds.join(',') : 'none'}`,
    `- 连接：${summary.connection || 'unknown'}`,
    `- Relay：${summary.relay || 'unknown'}`,
    `- 来源：${summary.source || 'unknown'}`
  ].join('\n');
}

function buildCallAcceptanceRecord(result = {}, generatedAt = new Date().toISOString()) {
  return [
    '# Focus Pet 通话人工验收记录',
    '',
    `生成时间：${generatedAt}`,
    `验收结果：${result.ok ? '通过' : '未通过'}`,
    `模式：${result.mode || 'unknown'}`,
    `要求 relay：${result.requireRelay ? '是' : '否'}`,
    '',
    '## 检查项',
    '',
    `- 两端摘要格式有效：${result.failures?.some(item => item.includes('missing-header')) ? '否' : '是'}`,
    `- 两端来源为 Cloud：${result.failures?.some(item => item.includes(':source-')) ? '否' : '是'}`,
    `- 两端连接已建立：${result.failures?.some(item => item.includes(':not-connected')) ? '否' : '是'}`,
    `- 两端收到远端媒体：${result.failures?.some(item => item.includes(':missing-remote-')) ? '否' : '是'}`,
    `- 敏感字段边界通过：${result.failures?.some(item => item.includes(':sensitive-')) ? '否' : '是'}`,
    `- relay 证据通过：${result.failures?.some(item => item.includes(':relay-missing')) ? '否' : '是'}`,
    '',
    '## 失败标签',
    '',
    result.failures?.length ? result.failures.map(item => `- ${item}`).join('\n') : '- 无',
    '',
    '## A 端摘要',
    '',
    formatSummary(result.sideA),
    '',
    '## B 端摘要',
    '',
    formatSummary(result.sideB),
    '',
    '> 本记录只保存状态、模式、远端媒体、连接状态、relay 标记和来源，不保存好友码、token、SDP、ICE candidate、TURN URL、IP 或设备 ID。',
    ''
  ].join('\n');
}

function defaultOutputPath(now = new Date()) {
  const stamp = now.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/[-:]/g, '').replace('T', '-').replace('Z', '');
  return path.join(DEFAULT_OUTPUT_DIR, `focus-pet-call-acceptance-${stamp}.md`);
}

function writeRecord(record, outPath = '') {
  const target = outPath || defaultOutputPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, record, 'utf8');
  return target;
}

function runCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const sideA = readInputFile(options.sideA);
  const sideB = readInputFile(options.sideB);
  const result = validateCallAcceptancePair({ sideA, sideB }, {
    mode: options.mode,
    requireRelay: options.requireRelay
  });
  const outputPath = writeRecord(buildCallAcceptanceRecord(result), options.out);
  const payload = { ok: result.ok, outputPath, mode: result.mode, requireRelay: result.requireRelay, failures: result.failures };
  process.stdout.write(`${JSON.stringify(payload, null, 2)}${os.EOL}`);
  if (!result.ok) process.exitCode = 1;
}

if (require.main === module) {
  try {
    runCli();
  } catch (error) {
    process.stderr.write(`${error.message}${os.EOL}`);
    process.exitCode = 1;
  }
}

module.exports = {
  buildCallAcceptanceRecord,
  parseArgs,
  parseCallAcceptanceSummary,
  scanSensitiveText,
  validateCallAcceptancePair
};
