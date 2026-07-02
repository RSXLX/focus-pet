const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { buildRuntimeDiagnosticsSummary, diagnosticsBundleName } = require('../src/diagnostics');

const REQUIRED_BOUNDARY_DOCS = [
  'docs/optimization-plan.md',
  'docs/system-overview.md',
  'docs/social-security-boundary.md',
  'docs/diagnostics.md',
  'docs/storage-recovery.md',
  'docs/task-model.md'
];
const EXCLUDED_SCOPE_TERMS = ['隐私模式', '敏感 App', '窗口标题脱敏', '用户纠错'];
const SOURCE_BOUNDARY_TARGETS = ['src', 'scripts', 'README.md', 'package.json'];
const SOURCE_TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.md', '.mjs', '.py', '.txt']);
const SOURCE_BOUNDARY_IGNORE = new Set(['scripts/release-preflight.js']);
const FORBIDDEN_SOURCE_PATTERNS = [
  { term: '隐私模式', pattern: /隐私模式/ },
  { term: '敏感 App', pattern: /敏感\s*App/ },
  { term: '窗口标题脱敏', pattern: /窗口标题脱敏|标题脱敏/ },
  { term: '用户纠错', pattern: /用户纠错/ },
  { term: 'privacyMode', pattern: /\bprivacyMode\b/ },
  { term: 'privacy_mode', pattern: /\bprivacy_mode\b/ },
  { term: 'privacy-mode', pattern: /\bprivacy-mode\b/ },
  { term: 'sensitiveApps', pattern: /\bsensitiveApps\b/ },
  { term: 'sensitive_apps', pattern: /\bsensitive_apps\b/ },
  { term: 'sensitive-apps', pattern: /\bsensitive-apps\b/ },
  { term: 'titleRedaction', pattern: /\btitleRedaction\b/ },
  { term: 'title_redaction', pattern: /\btitle_redaction\b/ },
  { term: 'title-redaction', pattern: /\btitle-redaction\b/ },
  { term: 'userCorrection', pattern: /\buserCorrection\b/ },
  { term: 'user_correction', pattern: /\buser_correction\b/ },
  { term: 'user-correction', pattern: /\buser-correction\b/ }
];
const SOCIAL_BOUNDARY_REQUIRED_CAVEATS = [
  {
    id: 'invite-attempts-persist-across-service-restart',
    pattern: /服务重启后[^。\n]*错误尝试记录仍会继续生效/
  },
  {
    id: 'multi-instance-rate-limit-caveat',
    pattern: /云端多实例部署仍需要[\s\S]{0,120}(?:全局限流|共享存储)/
  }
];
const SOCIAL_BOUNDARY_STALE_RISK_PATTERNS = [
  {
    id: 'restart-persistent-invite-attempts-listed-as-uncovered',
    pattern: /重启后仍保留的邀请码尝试限流/
  }
];
const ERROR_LOG_FIELDS = [
  { key: 'description', label: '问题描述' },
  { key: 'location', label: '发生位置' },
  { key: 'context', label: '上下文' },
  { key: 'possibleCause', label: '可能原因' },
  { key: 'status', label: '解决状态' }
];
const DEFAULT_PREFLIGHT_DIAGNOSTICS_DIR = path.join('output', 'diagnostics', 'preflight');
const DIAGNOSTICS_BUNDLE_REQUIRED_FILES = ['manifest.md', 'summary.json'];
const DIAGNOSTICS_BUNDLE_NAME_PATTERN = /^focus-pet-diagnostics-\d{8}-\d{6}$/;
const DIAGNOSTICS_SUMMARY_REQUIRED_TOP_LEVEL_KEYS = [
  'schemaVersion',
  'version',
  'generatedAt',
  'platform',
  'permissions',
  'settings',
  'tasks',
  'activity',
  'chat',
  'storage',
  'logs',
  'recentErrors'
];
const LOCAL_ABSOLUTE_PATH_PATTERN = /(^|[\s`"'(:=])(?:\/(?:Users|private|tmp|var\/folders)\/|[A-Za-z]:\\{1,2}(?:Users|Documents and Settings|ProgramData|Windows|Temp|tmp)\\{1,2})/m;
const DIAGNOSTICS_BUNDLE_BOUNDARY_PATTERNS = [
  { issue: 'absolute-path', pattern: LOCAL_ABSOLUTE_PATH_PATTERN },
  { issue: 'bearer-token', pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{12,}/i },
  { issue: 'data-url', pattern: /data:image\/[a-z0-9.+-]+;base64,/i },
  { issue: 'env-secret', pattern: /\b[A-Z][A-Z0-9_]*(?:API_KEY|TOKEN|SECRET|CREDENTIAL)[A-Z0-9_]*\s*=\s*\S+/ },
  { issue: 'secret-assignment', pattern: /\b(?:api[-_]?key|auth[-_]?token|session[-_]?token|invite[-_]?code|token|secret|credential|password)\b\s*[:=]\s*(?:"[^"]*"|'[^']*'|[^\s,;|]+)/i },
  { issue: 'json-secret-field', pattern: /"(?:[^"]*(?:apiKey|api_key|token|secret|credential|password|inviteCode|sessionToken)[^"]*)"\s*:\s*"[A-Za-z0-9._~+/\-=]{8,}"/i },
  { issue: 'json-raw-field', pattern: /"(?:rawDiagnosticPayload|taskText|taskTitle|currentTask|chatText|messageText|windowTitle|frontmostApp|frontmost|sourceName|rawIssueKey|rawReason|screenshot|dataUrl|endpoint|model)"\s*:/i },
  { issue: 'turn-url', pattern: /(^|[\s`"'])turns?:[^\s`"']+/i },
  { issue: 'url', pattern: /\bhttps?:\/\/[^\s`"'<>)]+/i },
  { issue: 'websocket-url', pattern: /\bwss?:\/\/[^\s`"'<>)]+/i }
];
const OPTIMIZATION_PLAN_SECTIONS = [
  '3.1',
  '3.2',
  '3.3',
  '3.4',
  '4.1',
  '4.2',
  '4.3',
  '4.4',
  '4.5',
  '5.1',
  '5.2',
  '5.3'
];
const INCOMPLETE_ACCEPTANCE_STATUS_PATTERN = /(?:[：:\-—–（(]\s*|\s)(?:未完成|部分完成|待完成|进行中|尚未完成|未达成|未通过)(?:[。；;，,）)\s]|$)/;
const PACKAGE_SCRIPT_REQUIREMENTS = [
  { script: 'package:mac', command: 'node scripts/package-macos.js', file: 'scripts/package-macos.js' },
  { script: 'package:win', command: 'node scripts/package-windows.js', file: 'scripts/package-windows.js' },
  { script: 'package:mac:controlled', command: 'node scripts/package-remote-client-macos.js', file: 'scripts/package-remote-client-macos.js' },
  { script: 'sign:mac', command: 'node scripts/sign-macos.js', file: 'scripts/sign-macos.js' },
  { script: 'notarize:mac', command: 'node scripts/notarize-macos.js', file: 'scripts/notarize-macos.js' },
  { script: 'verify:mac', command: 'node scripts/verify-macos.js', file: 'scripts/verify-macos.js' },
  { script: 'verify:pet-render', command: 'node scripts/run-pet-render-verify.js', file: 'scripts/run-pet-render-verify.js' },
  { script: 'test:screen-pipeline', command: 'electron scripts/test-screen-review-pipeline.js', file: 'scripts/test-screen-review-pipeline.js' }
];
const CHAT_BACKEND_REQUIRED_FILES = [
  'Dockerfile',
  'package.json',
  'scripts/run-chat-service.js',
  'src/chat-service.js'
];
const CHAT_BACKEND_DOCKERFILE_REQUIREMENTS = [
  { id: 'production-dependency-install', pattern: /\bnpm\s+ci\s+--omit=dev\b/ },
  { id: 'chat-host-all-interfaces', pattern: /FOCUS_PET_CHAT_HOST=0\.0\.0\.0/ },
  { id: 'persistent-data-dir', pattern: /FOCUS_PET_CHAT_DATA_DIR=\/data\/focus-pet-social/ },
  { id: 'data-dir-created', pattern: /mkdir\s+-p\s+\/data\/focus-pet-social/ },
  { id: 'healthcheck-healthz', pattern: /HEALTHCHECK[\s\S]*\/healthz/ },
  { id: 'chat-serve-cmd', pattern: /CMD\s+\[\s*"npm"\s*,\s*"run"\s*,\s*"chat:serve"\s*\]/ }
];
const CHAT_BACKEND_RUNTIME_REQUIREMENTS = [
  { id: 'chat-service-require', pattern: /require\(['"]\.\.\/src\/chat-service['"]\)/ },
  { id: 'sigterm-shutdown', pattern: /SIGTERM/ }
];
const CHAT_BACKEND_CONSOLE_OUTPUT_METHODS = 'log|error|warn|info|debug|trace';
const CHAT_BACKEND_RUNTIME_FORBIDDEN_PATTERNS = [
  { id: 'startup-invite-url-output', pattern: /inviteUrl\s*:/ },
  { id: 'startup-invite-code-output', pattern: /inviteCode\s*:/ },
  { id: 'startup-auth-token-output', pattern: /authToken\s*:/ },
  { id: 'startup-session-token-output', pattern: /sessionToken\s*:/ },
  { id: 'startup-public-state-output', predicate: hasDirectPublicStateOutput },
  { id: 'startup-public-state-variable-output', predicate: hasPublicStateVariableOutput },
  { id: 'startup-public-state-sensitive-property-output', predicate: hasPublicStateSensitivePropertyOutput },
  { id: 'startup-public-state-destructured-sensitive-output', predicate: hasDestructuredPublicStateSensitiveOutput },
  { id: 'unsanitized-startup-error-output', predicate: hasUnsanitizedStartupErrorOutput }
];
const CHAT_BACKEND_PUBLIC_STATE_SENSITIVE_FIELDS = new Set(['inviteUrl', 'inviteCode', 'authToken', 'sessions']);
const JS_IDENTIFIER_PATTERN = /^[A-Za-z_$][\w$]*$/;
const CHAT_BACKEND_DEFAULT_ERROR_VARIABLE_NAMES = ['error', 'err', 'e', 'ex', 'reason', 'exception'];
const CHAT_BACKEND_ERROR_EVENT_PATTERN = /process\.on\(\s*['"](?:uncaughtException|unhandledRejection|warning|rejectionHandled)['"]\s*,\s*(?:async\s*)?(?:(?:\(\s*)?([A-Za-z_$][\w$]*)\s*(?:,[^)]*)?(?:\)\s*)?=>|function\s*(?:[A-Za-z_$][\w$]*)?\s*\(\s*([A-Za-z_$][\w$]*))/g;

function readTextIfExists(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function listPublicStateVariableNames(text = '') {
  const names = new Set();
  const assignmentPatterns = [
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*chatService\.publicState\(\);?/g,
    /(?:^|[;\n])\s*([A-Za-z_$][\w$]*)\s*=\s*chatService\.publicState\(\);?/g
  ];
  for (const assignmentPattern of assignmentPatterns) {
    let match;
    while ((match = assignmentPattern.exec(text)) !== null) {
      if (JS_IDENTIFIER_PATTERN.test(match[1])) {
        names.add(match[1]);
      }
    }
  }
  return expandAliasNames(listSimpleAssignments(text), names);
}

function addDestructuredPublicStateSensitiveNames(rawBindings = '', names) {
  for (const rawBinding of rawBindings.split(',')) {
    const binding = rawBinding.trim().replace(/\s*=.*$/, '').trim();
    if (!binding) continue;
    const [rawSourceName, rawAliasName] = binding.split(':').map(part => part.trim());
    const sourceName = rawSourceName.replace(/^\.{3}/, '');
    if (!CHAT_BACKEND_PUBLIC_STATE_SENSITIVE_FIELDS.has(sourceName)) continue;
    const outputName = (rawAliasName || sourceName).replace(/\s*=.*$/, '').trim();
    if (JS_IDENTIFIER_PATTERN.test(outputName)) {
      names.add(outputName);
    }
  }
}

function buildPublicStateSensitivePropertyPattern(variableName) {
  const fields = [...CHAT_BACKEND_PUBLIC_STATE_SENSITIVE_FIELDS].map(escapeRegExp).join('|');
  const escapedName = escapeRegExp(variableName);
  return new RegExp(`\\b${escapedName}\\s*(?:\\?\\.|\\.)\\s*(?:${fields})\\b|\\b${escapedName}\\s*(?:\\?\\.)?\\[\\s*['"](?:${fields})['"]\\s*\\]`);
}

function listSimpleAssignments(text = '') {
  const assignments = [];
  const aliasPatterns = [
    /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+);?/g,
    /(?:^|[;\n])\s*([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+);?/g
  ];
  for (const aliasPattern of aliasPatterns) {
    let match;
    while ((match = aliasPattern.exec(text)) !== null) {
      if (JS_IDENTIFIER_PATTERN.test(match[1])) {
        assignments.push({ name: match[1], value: match[2].trim() });
      }
    }
  }
  return assignments;
}

function expandAliasNames(assignments = [], initialNames = []) {
  const names = new Set(initialNames);
  let changed = true;
  while (changed) {
    changed = false;
    for (const assignment of assignments) {
      if (names.has(assignment.name)) continue;
      if ([...names].some(name => assignment.value === name)) {
        names.add(assignment.name);
        changed = true;
      }
    }
  }
  return names;
}

function listPublicStateSensitiveAliasNames(text = '') {
  const names = new Set();
  const assignments = listSimpleAssignments(text);

  for (const publicStateName of listPublicStateVariableNames(text)) {
    const propertyPattern = buildPublicStateSensitivePropertyPattern(publicStateName);
    for (const assignment of assignments) {
      if (propertyPattern.test(assignment.value)) {
        names.add(assignment.name);
      }
    }
  }

  return expandAliasNames(assignments, names);
}

function listDestructuredPublicStateSensitiveNames(text = '') {
  const names = new Set();
  const directDestructuringPattern = /(?:const|let|var)\s*\{([^}]+)\}\s*=\s*chatService\.publicState\(\);?/g;
  let match;
  while ((match = directDestructuringPattern.exec(text)) !== null) {
    addDestructuredPublicStateSensitiveNames(match[1], names);
  }
  for (const publicStateName of listPublicStateVariableNames(text)) {
    const variableDestructuringPattern = new RegExp(`(?:const|let|var)\\s*\\{([^}]+)\\}\\s*=\\s*${escapeRegExp(publicStateName)}\\s*;?`, 'g');
    while ((match = variableDestructuringPattern.exec(text)) !== null) {
      addDestructuredPublicStateSensitiveNames(match[1], names);
    }
  }
  return expandAliasNames(listSimpleAssignments(text), names);
}

function hasSensitiveNameOutput(text = '', names = []) {
  for (const args of listConsoleCallArguments(text)) {
    for (const arg of args) {
      if ([...names].some(name => hasSensitiveNameArgumentOutput(arg, name))) {
        return true;
      }
    }
  }
  return false;
}

function hasSensitiveNameArgumentOutput(arg = '', name = '') {
  const escapedName = escapeRegExp(name);
  const checkedArg = String(arg).trim();
  const outputPatterns = [
    new RegExp(`^${escapedName}$`),
    new RegExp(`^JSON\\.stringify\\(\\s*${escapedName}(?:\\s*[,)]|\\s*$)`),
    new RegExp(`^\\{\\s*${escapedName}\\s*(?:[,}])`),
    new RegExp(`^\\{[\\s\\S]*,\\s*${escapedName}\\s*(?:[,}])`),
    new RegExp(`^\\{[\\s\\S]*:\\s*(?:JSON\\.stringify\\(\\s*)?${escapedName}(?:\\s*[,})]|\\s*\\)\\s*[,}])[\\s\\S]*\\}$`),
    new RegExp(`^\`[^\`]*\\$\\{\\s*${escapedName}\\s*\\}[^\`]*\`$`)
  ];
  return outputPatterns.some(pattern => pattern.test(checkedArg));
}

function hasDirectPublicStateOutput(text = '') {
  const directPublicStatePattern = /chatService\.publicState\(\)/;
  for (const args of listConsoleCallArguments(text)) {
    if (args.some(arg => directPublicStatePattern.test(arg))) {
      return true;
    }
  }
  return false;
}

function hasPublicStateVariableOutput(text = '') {
  const publicStateNames = [...listPublicStateVariableNames(text)];
  if (!publicStateNames.length) return false;
  for (const args of listConsoleCallArguments(text)) {
    for (const arg of args) {
      const checkedArg = stripAllowedPublicStateBooleanSummaries(arg, publicStateNames);
      if (publicStateNames.some(name => hasSensitiveNameArgumentOutput(checkedArg, name))) {
        return true;
      }
    }
  }
  return false;
}

function hasDestructuredPublicStateSensitiveOutput(text = '') {
  return hasSensitiveNameOutput(text, listDestructuredPublicStateSensitiveNames(text));
}

function stripAllowedPublicStateBooleanSummaries(arg = '', publicStateNames = []) {
  let cleaned = String(arg);
  for (const publicStateName of publicStateNames) {
    const escapedName = escapeRegExp(publicStateName);
    cleaned = cleaned.replace(
      new RegExp(`Boolean\\(\\s*${escapedName}\\s*(?:\\?\\.|\\.)\\s*inviteUrl\\s*\\)`, 'g'),
      'true'
    );
  }
  return cleaned;
}

function hasPublicStateSensitivePropertyOutput(text = '') {
  const publicStateNames = [...listPublicStateVariableNames(text)];
  if (!publicStateNames.length) return false;
  const propertyPatterns = publicStateNames.map(buildPublicStateSensitivePropertyPattern);
  for (const args of listConsoleCallArguments(text)) {
    for (const arg of args) {
      const checkedArg = stripAllowedPublicStateBooleanSummaries(arg, publicStateNames);
      if (propertyPatterns.some(pattern => pattern.test(checkedArg))) return true;
    }
  }
  return hasSensitiveNameOutput(text, listPublicStateSensitiveAliasNames(text));
}

function listStartupErrorVariableNames(text = '') {
  const names = new Set(CHAT_BACKEND_DEFAULT_ERROR_VARIABLE_NAMES);
  let match;
  while ((match = CHAT_BACKEND_ERROR_EVENT_PATTERN.exec(text)) !== null) {
    const name = match[1] || match[2];
    if (JS_IDENTIFIER_PATTERN.test(name)) {
      names.add(name);
    }
  }
  return [...names];
}

function buildErrorVariablePattern(names = []) {
  const alternation = names.map(escapeRegExp).join('|');
  return new RegExp(`(?:^|[^\\w$])(?:${alternation})(?:\\s*(?:[),}]|$)|\\s*(?:\\?\\.|\\.)\\s*(?:stack|message)\\b)`);
}

function readBalancedCallArguments(text = '', openParenIndex = -1) {
  if (openParenIndex < 0 || text[openParenIndex] !== '(') return null;
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = openParenIndex; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = '';
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(') {
      depth += 1;
      continue;
    }
    if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(openParenIndex + 1, index);
      }
    }
  }
  return null;
}

function splitTopLevelArguments(args = '') {
  const parts = [];
  let start = 0;
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = 0; index < args.length; index += 1) {
    const char = args[index];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = '';
      }
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '(' || char === '{' || char === '[') {
      depth += 1;
      continue;
    }
    if (char === ')' || char === '}' || char === ']') {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (char === ',' && depth === 0) {
      parts.push(args.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(args.slice(start).trim());
  return parts.filter(Boolean);
}

function listConsoleCallArguments(text = '') {
  const calls = [];
  const consolePattern = /console\.(?:error|warn|log|info|debug|trace)\s*\(/g;
  let match;
  while ((match = consolePattern.exec(text)) !== null) {
    const openParenIndex = match.index + match[0].lastIndexOf('(');
    const args = readBalancedCallArguments(text, openParenIndex);
    if (args !== null) {
      calls.push(splitTopLevelArguments(args));
    }
  }
  return calls;
}

function hasUnsanitizedStartupErrorOutput(text = '') {
  const errorVariablePattern = buildErrorVariablePattern(listStartupErrorVariableNames(text));
  for (const args of listConsoleCallArguments(text)) {
    for (const arg of args) {
      if (/^\s*sanitizeLogText\s*\(/.test(arg)) continue;
      if (errorVariablePattern.test(arg)) return true;
    }
  }
  return false;
}

function listSourceBoundaryFiles(projectRoot, target) {
  const targetPath = path.join(projectRoot, target);
  if (!fs.existsSync(targetPath)) return [];
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    return SOURCE_TEXT_EXTENSIONS.has(path.extname(targetPath)) ? [targetPath] : [];
  }
  if (!stat.isDirectory()) return [];

  const files = [];
  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    const entryPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceBoundaryFiles(projectRoot, path.relative(projectRoot, entryPath)));
      continue;
    }
    if (entry.isFile() && SOURCE_TEXT_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(entryPath);
    }
  }
  return files;
}

function findForbiddenSourceMatches(projectRoot) {
  const files = SOURCE_BOUNDARY_TARGETS.flatMap(target => listSourceBoundaryFiles(projectRoot, target));
  const matches = [];
  for (const filePath of files) {
    const relativeFile = path.relative(projectRoot, filePath);
    if (SOURCE_BOUNDARY_IGNORE.has(relativeFile)) continue;
    const lines = readTextIfExists(filePath).split(/\r?\n/);
    lines.forEach((line, index) => {
      for (const { term, pattern } of FORBIDDEN_SOURCE_PATTERNS) {
        if (pattern.test(line)) {
          matches.push({ file: relativeFile, line: index + 1, term });
        }
      }
    });
  }
  return matches;
}

function runDocsBoundaryCheck(projectRoot = path.resolve(__dirname, '..')) {
  const missingDocs = REQUIRED_BOUNDARY_DOCS.filter(file => !fs.existsSync(path.join(projectRoot, file)));
  const optimizationPlan = readTextIfExists(path.join(projectRoot, 'docs', 'optimization-plan.md'));
  const socialBoundary = readTextIfExists(path.join(projectRoot, 'docs', 'social-security-boundary.md'));
  const missingExclusions = EXCLUDED_SCOPE_TERMS.filter(term => !optimizationPlan.includes(term));
  const forbiddenSourceMatches = findForbiddenSourceMatches(projectRoot);
  const socialBoundaryMissingCaveats = SOCIAL_BOUNDARY_REQUIRED_CAVEATS
    .filter(requirement => !requirement.pattern.test(socialBoundary))
    .map(requirement => requirement.id);
  const socialBoundaryStaleRisks = SOCIAL_BOUNDARY_STALE_RISK_PATTERNS
    .filter(requirement => requirement.pattern.test(socialBoundary))
    .map(requirement => requirement.id);

  return {
    ok: missingDocs.length === 0
      && missingExclusions.length === 0
      && forbiddenSourceMatches.length === 0
      && socialBoundaryMissingCaveats.length === 0
      && socialBoundaryStaleRisks.length === 0,
    missingDocs,
    missingExclusions,
    forbiddenSourceMatches,
    socialBoundaryMissingCaveats,
    socialBoundaryStaleRisks
  };
}

function normalizeErrorLogStatus(status = '') {
  if (status.includes('已解决')) return '已解决';
  if (status.includes('未解决')) return '未解决';
  return status.trim();
}

function parseErrorLogEntries(markdown = '') {
  const entries = [];
  let current = null;
  const lines = String(markdown).split(/\r?\n/);

  lines.forEach((line, index) => {
    const heading = line.match(/^## \[(.+)]\s*$/);
    if (heading) {
      if (current) entries.push(current);
      if (heading[1] === '时间') {
        current = null;
        return;
      }
      current = {
        time: heading[1],
        line: index + 1,
        description: '',
        location: '',
        context: '',
        possibleCause: '',
        status: '',
        rawStatus: ''
      };
      return;
    }
    if (!current) return;

    for (const field of ERROR_LOG_FIELDS) {
      const prefix = `- ${field.label}：`;
      if (line.startsWith(prefix)) {
        const value = line.slice(prefix.length).trim();
        if (field.key === 'status') {
          current.rawStatus = value;
          current.status = normalizeErrorLogStatus(value);
        } else {
          current[field.key] = value;
        }
      }
    }
  });

  if (current) entries.push(current);
  return entries;
}

function latestErrorLogFormatIssues(entry) {
  if (!entry) return ['missing-entry'];
  return ERROR_LOG_FIELDS
    .map(field => field.key)
    .filter(key => !String(entry[key] || '').trim());
}

function allErrorLogFormatIssues(entries = []) {
  return entries.flatMap(entry => ERROR_LOG_FIELDS
    .map(field => ({ field, value: String(entry[field.key] || '').trim() }))
    .filter(item => !item.value)
    .map(item => ({ line: entry.line, field: item.field.key })));
}

function errorLogIssueKey(entry = {}) {
  return [
    String(entry.description || '').trim(),
    String(entry.location || '').trim()
  ].join('\n');
}

function normalizeErrorLogComparableText(value = '') {
  return String(value)
    .replace(/[`"'“”‘’]/g, '')
    .replace(/[，。；;：:、,.()[\]（）【】\s/\\-]/g, '')
    .replace(/^新增/, '')
    .replace(/后处于红灯状态|红灯状态|红灯|测试已转绿|已转绿|失败已修复|均已修复|已修复|修复/g, '')
    .trim();
}

function longestCommonSubstringLength(left = '', right = '') {
  if (!left || !right) return 0;
  const previous = new Array(right.length + 1).fill(0);
  let best = 0;
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = 0;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const nextDiagonal = previous[rightIndex];
      if (left[leftIndex - 1] === right[rightIndex - 1]) {
        previous[rightIndex] = diagonal + 1;
        best = Math.max(best, previous[rightIndex]);
      } else {
        previous[rightIndex] = 0;
      }
      diagonal = nextDiagonal;
    }
  }
  return best;
}

function hasOppositeCompletionPrefix(left = '', right = '') {
  const leftOpen = left.startsWith('未') ? left.slice(1) : '';
  const rightResolved = right.startsWith('已') ? right.slice(1) : '';
  if (leftOpen && rightResolved && leftOpen === rightResolved) return true;
  const rightOpen = right.startsWith('未') ? right.slice(1) : '';
  const leftResolved = left.startsWith('已') ? left.slice(1) : '';
  return Boolean(rightOpen && leftResolved && rightOpen === leftResolved);
}

function extractErrorLogLocationTokens(value = '') {
  const genericTokens = new Set(['src', 'test', 'tests', 'docs', 'scripts']);
  const matches = String(value)
    .match(/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*|[\u4e00-\u9fff]{2,}/g) || [];
  return new Set(matches
    .map(token => token.toLowerCase().replace(/^[./]+|[.,;:]+$/g, ''))
    .filter(token => token.length >= 3 && !genericTokens.has(token)));
}

function errorLogLocationsCompatible(left = {}, right = {}) {
  const leftLocation = normalizeErrorLogComparableText(left.location);
  const rightLocation = normalizeErrorLogComparableText(right.location);
  if (!leftLocation || !rightLocation) return false;
  if (leftLocation === rightLocation) return true;

  const leftTokens = extractErrorLogLocationTokens(left.location);
  const rightTokens = extractErrorLogLocationTokens(right.location);
  for (const token of leftTokens) {
    if (rightTokens.has(token)) return true;
  }

  return leftLocation.length >= 8
    && rightLocation.length >= 8
    && (leftLocation.includes(rightLocation) || rightLocation.includes(leftLocation));
}

function errorLogEntriesReferToSameIssue(left = {}, right = {}) {
  if (errorLogIssueKey(left) === errorLogIssueKey(right)) return true;
  if (!errorLogLocationsCompatible(left, right)) return false;
  const leftDescription = normalizeErrorLogComparableText(left.description);
  const rightDescription = normalizeErrorLogComparableText(right.description);
  if (!leftDescription || !rightDescription) return false;
  if (hasOppositeCompletionPrefix(leftDescription, rightDescription)) return false;
  if (leftDescription.length >= 5 && rightDescription.includes(leftDescription)) return true;
  if (rightDescription.length >= 5 && leftDescription.includes(rightDescription)) return true;
  return longestCommonSubstringLength(leftDescription, rightDescription) >= 5;
}

function isKnownNonBlockingErrorLogEntry(entry = {}) {
  const text = [
    entry.description,
    entry.location,
    entry.context,
    entry.possibleCause
  ].map(value => String(value || '')).join('\n');
  return /SharedImageManager|GPU command buffer/.test(text)
    && (/ok:\s*true/.test(text) || /failedChecks\s*为空/.test(text) || /完整.*通过/.test(text));
}

function findOpenUnresolvedErrorLogEntries(entries = []) {
  const resolvedEntries = [];
  const open = [];
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry.status === '已解决') {
      resolvedEntries.push(entry);
      continue;
    }
    if (
      entry.rawStatus?.trim() === '未解决'
      && !isKnownNonBlockingErrorLogEntry(entry)
      && !resolvedEntries.some(resolved => errorLogEntriesReferToSameIssue(entry, resolved))
    ) {
      open.push({ line: entry.line, time: entry.time });
    }
  }
  return open.reverse();
}

function runErrorLogCheck(projectRoot = path.resolve(__dirname, '..')) {
  const errorLogPath = path.join(projectRoot, 'docs', 'errorThing.md');
  const exists = fs.existsSync(errorLogPath);
  const entries = exists ? parseErrorLogEntries(readTextIfExists(errorLogPath)) : [];
  const latest = entries.at(-1) || null;
  const formatIssues = latestErrorLogFormatIssues(latest);
  const allFormatIssues = allErrorLogFormatIssues(entries);
  const latestStatus = latest?.status || '';
  const openUnresolvedEntries = findOpenUnresolvedErrorLogEntries(entries);
  return {
    ok: exists
      && entries.length > 0
      && formatIssues.length === 0
      && allFormatIssues.length === 0
      && latestStatus === '已解决'
      && openUnresolvedEntries.length === 0,
    exists,
    entryCount: entries.length,
    latestTime: latest?.time || '',
    latestStatus,
    formatIssues,
    allFormatIssues,
    openUnresolvedEntries
  };
}

function listDiagnosticsBundleDirs(outputDir) {
  if (!fs.existsSync(outputDir)) return [];
  return fs.readdirSync(outputDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && DIAGNOSTICS_BUNDLE_NAME_PATTERN.test(entry.name))
    .map(entry => {
      const dir = path.join(outputDir, entry.name);
      let mtimeMs = 0;
      try {
        mtimeMs = fs.statSync(dir).mtimeMs;
      } catch {
        mtimeMs = 0;
      }
      return { name: entry.name, dir, mtimeMs };
    })
    .sort((left, right) => right.name.localeCompare(left.name) || right.mtimeMs - left.mtimeMs);
}

function diagnosticsBundleBoundaryIssues(text = '') {
  const value = String(text || '');
  return DIAGNOSTICS_BUNDLE_BOUNDARY_PATTERNS
    .filter(({ pattern }) => pattern.test(value))
    .map(({ issue }) => issue);
}

function diagnosticsSummarySchemaStatus(summary) {
  const isObject = summary !== null && typeof summary === 'object' && !Array.isArray(summary);
  const keys = isObject ? Object.keys(summary) : [];
  const required = new Set(DIAGNOSTICS_SUMMARY_REQUIRED_TOP_LEVEL_KEYS);
  const generatedAtTime = isObject && typeof summary.generatedAt === 'string'
    ? new Date(summary.generatedAt).getTime()
    : NaN;
  const summaryGeneratedAtValid = Number.isFinite(generatedAtTime);
  const summaryMissingTopLevelKeys = isObject
    ? DIAGNOSTICS_SUMMARY_REQUIRED_TOP_LEVEL_KEYS.filter(key => !Object.hasOwn(summary, key))
    : [...DIAGNOSTICS_SUMMARY_REQUIRED_TOP_LEVEL_KEYS];
  const summaryUnexpectedTopLevelKeyCount = keys
    .filter(key => !required.has(key))
    .length;
  const objectSectionsValid = isObject
    && ['permissions', 'settings', 'tasks', 'activity', 'chat', 'storage', 'logs']
      .every(key => summary[key] !== null && typeof summary[key] === 'object' && !Array.isArray(summary[key]))
    && Array.isArray(summary.recentErrors);
  const summarySchemaValid = isObject
    && summary.schemaVersion === 1
    && typeof summary.version === 'string'
    && summaryGeneratedAtValid
    && typeof summary.platform === 'string'
    && summaryMissingTopLevelKeys.length === 0
    && summaryUnexpectedTopLevelKeyCount === 0
    && objectSectionsValid;

  return {
    summarySchemaValid,
    summaryGeneratedAtValid,
    summaryMissingTopLevelKeys,
    summaryUnexpectedTopLevelKeyCount
  };
}

function runDiagnosticsSummaryOutputCheck(projectRoot = path.resolve(__dirname, '..'), options = {}) {
  let summaryJsonText = '';
  let summaryGenerated = false;
  let summaryJsonValid = false;
  let schemaStatus = diagnosticsSummarySchemaStatus(null);

  try {
    const summary = Object.hasOwn(options, 'summary')
      ? options.summary
      : buildRuntimeDiagnosticsSummary();
    summaryJsonValid = summary !== null && typeof summary === 'object' && !Array.isArray(summary);
    schemaStatus = diagnosticsSummarySchemaStatus(summary);
    summaryJsonText = JSON.stringify(summary);
    summaryGenerated = true;
  } catch {
    summaryJsonText = '';
    summaryGenerated = false;
    summaryJsonValid = false;
    schemaStatus = diagnosticsSummarySchemaStatus(null);
  }

  const summaryBoundaryIssues = diagnosticsBundleBoundaryIssues(summaryJsonText);

  return {
    ok: summaryGenerated
      && summaryJsonValid
      && schemaStatus.summarySchemaValid
      && summaryBoundaryIssues.length === 0,
    summaryGenerated,
    summaryJsonValid,
    ...schemaStatus,
    summaryBoundaryIssues
  };
}

function runDiagnosticsBundleOutputCheck(projectRoot = path.resolve(__dirname, '..'), options = {}) {
  const outputDir = path.resolve(projectRoot, options.outputDir || DEFAULT_PREFLIGHT_DIAGNOSTICS_DIR);
  const exists = fs.existsSync(outputDir);
  const bundleDirs = listDiagnosticsBundleDirs(outputDir);
  const latest = bundleDirs[0] || null;
  const latestName = latest?.name || '';
  const latestDir = latest?.dir || '';
  const entries = latestDir ? fs.readdirSync(latestDir, { withFileTypes: true }) : [];
  const files = entries.map(entry => entry.name).sort();
  const fileEntryNames = entries.filter(entry => entry.isFile()).map(entry => entry.name);
  const missingFiles = DIAGNOSTICS_BUNDLE_REQUIRED_FILES
    .filter(file => !fileEntryNames.includes(file))
    .sort();
  const unexpectedFiles = files
    .filter(file => !DIAGNOSTICS_BUNDLE_REQUIRED_FILES.includes(file))
    .sort();

  let summaryJsonText = '';
  let summaryJsonValid = false;
  let schemaStatus = diagnosticsSummarySchemaStatus(null);
  let summaryMatchesBundleName = false;
  if (!missingFiles.includes('summary.json')) {
    summaryJsonText = readTextIfExists(path.join(latestDir, 'summary.json'));
    try {
      const summary = JSON.parse(summaryJsonText);
      summaryJsonValid = summary !== null && typeof summary === 'object' && !Array.isArray(summary);
      schemaStatus = diagnosticsSummarySchemaStatus(summary);
      summaryMatchesBundleName = Boolean(summaryJsonValid && latestName && diagnosticsBundleName(summary) === latestName);
    } catch {
      summaryJsonValid = false;
      schemaStatus = diagnosticsSummarySchemaStatus(null);
      summaryMatchesBundleName = false;
    }
  }

  const manifestText = missingFiles.includes('manifest.md')
    ? ''
    : readTextIfExists(path.join(latestDir, 'manifest.md'));
  const manifestReferencesSummary = /\bsummary\.json\b/.test(manifestText);
  const manifestReferencesBundle = Boolean(latestName && manifestText.includes(latestName));
  const manifestBoundaryIssues = diagnosticsBundleBoundaryIssues(manifestText);
  const summaryBoundaryIssues = diagnosticsBundleBoundaryIssues(summaryJsonText);

  return {
    ok: exists
      && Boolean(latest)
      && missingFiles.length === 0
      && unexpectedFiles.length === 0
      && summaryJsonValid
      && schemaStatus.summarySchemaValid
      && manifestReferencesSummary
      && manifestReferencesBundle
      && summaryMatchesBundleName
      && manifestBoundaryIssues.length === 0
      && summaryBoundaryIssues.length === 0,
    exists,
    outputDir: path.relative(projectRoot, outputDir) || '.',
    latestName,
    files,
    missingFiles,
    unexpectedFiles,
    summaryJsonValid,
    ...schemaStatus,
    manifestReferencesSummary,
    manifestReferencesBundle,
    summaryMatchesBundleName,
    manifestBoundaryIssues,
    summaryBoundaryIssues
  };
}

function findOptimizationPlanSectionLines(lines) {
  const sectionLines = new Map();
  lines.forEach((line, index) => {
    const heading = line.match(/^###\s+(\d+\.\d+)\s+/);
    if (heading) {
      sectionLines.set(heading[1], index + 1);
    }
  });
  return sectionLines;
}

function findOptimizationPlanAcceptanceRanges(lines) {
  const ranges = new Map();
  let current = null;
  lines.forEach((line, index) => {
    const heading = line.match(/^当前\s+(\d+\.\d+)\s+验收状态[：:]\s*$/);
    if (heading) {
      if (current) current.end = index;
      current = { section: heading[1], start: index + 1, end: lines.length };
      ranges.set(current.section, current);
      return;
    }
    if (current && /^#{2,3}\s+/.test(line)) {
      current.end = index;
      current = null;
    }
  });
  return ranges;
}

function runOptimizationPlanCheck(projectRoot = path.resolve(__dirname, '..')) {
  const planPath = path.join(projectRoot, 'docs', 'optimization-plan.md');
  const exists = fs.existsSync(planPath);
  const markdown = exists ? readTextIfExists(planPath) : '';
  const lines = markdown.split(/\r?\n/);
  const sectionLines = findOptimizationPlanSectionLines(lines);
  const acceptanceRanges = findOptimizationPlanAcceptanceRanges(lines);
  const missingSections = OPTIMIZATION_PLAN_SECTIONS
    .filter(section => !sectionLines.has(section));
  const missingAcceptanceSections = OPTIMIZATION_PLAN_SECTIONS
    .filter(section => !acceptanceRanges.has(section));
  const missingExclusions = EXCLUDED_SCOPE_TERMS
    .filter(term => !markdown.includes(term));
  const emptyAcceptanceSections = [];
  const incompleteAcceptanceItems = [];

  for (const [section, range] of acceptanceRanges.entries()) {
    let itemCount = 0;
    for (let index = range.start; index < range.end; index += 1) {
      const line = lines[index];
      if (!/^-\s+/.test(line)) continue;
      itemCount += 1;
      if (INCOMPLETE_ACCEPTANCE_STATUS_PATTERN.test(line)) {
        incompleteAcceptanceItems.push({ section, line: index + 1 });
      }
    }
    if (itemCount === 0) {
      emptyAcceptanceSections.push(section);
    }
  }

  return {
    ok: exists
      && missingSections.length === 0
      && missingAcceptanceSections.length === 0
      && emptyAcceptanceSections.length === 0
      && incompleteAcceptanceItems.length === 0
      && missingExclusions.length === 0,
    exists,
    checkedSections: OPTIMIZATION_PLAN_SECTIONS.length,
    missingSections,
    missingAcceptanceSections,
    emptyAcceptanceSections,
    incompleteAcceptanceItems,
    missingExclusions
  };
}

function readPackageJson(projectRoot) {
  const packagePath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(packagePath)) {
    return { exists: false, value: null, parseError: true };
  }
  try {
    return { exists: true, value: JSON.parse(readTextIfExists(packagePath)), parseError: false };
  } catch {
    return { exists: true, value: null, parseError: true };
  }
}

function packageScriptFileFromCommand(command = '') {
  const match = String(command).trim().match(/^(?:node|electron)\s+([^\s]+\.js)\b/);
  return match ? match[1] : '';
}

function normalizeCommandFilePath(file = '') {
  return String(file)
    .replace(/\\/g, '/')
    .replace(/^\.\//, '');
}

function commandSegmentChecksFile(segment = '', file = '') {
  const normalizedFile = escapeRegExp(normalizeCommandFilePath(file));
  const filePattern = `["']?(?:\\./)?${normalizedFile}["']?`;
  const text = String(segment).trim();
  return new RegExp(`^node\\s+--check\\s+${filePattern}(?:\\s|$)`).test(text)
    || new RegExp(`^python3\\s+-m\\s+py_compile\\s+${filePattern}(?:\\s|$)`).test(text);
}

function checkCommandCoversFile(checkCommand = '', file = '') {
  return String(checkCommand)
    .split(/\s*(?:&&|;)\s*/)
    .some(segment => commandSegmentChecksFile(segment, file));
}

function runPackageScriptsCheck(projectRoot = path.resolve(__dirname, '..')) {
  const packageJson = readPackageJson(projectRoot);
  const scripts = packageJson.value?.scripts || {};
  const checkCommand = scripts.check || '';
  const checkedScripts = PACKAGE_SCRIPT_REQUIREMENTS.map(item => item.script);
  const missingScripts = [];
  const mismatchedCommands = [];
  const missingFiles = [];
  const missingCheckEntries = [];

  for (const requirement of PACKAGE_SCRIPT_REQUIREMENTS) {
    const actualCommand = scripts[requirement.script];
    if (!actualCommand) {
      missingScripts.push(requirement.script);
      continue;
    }

    if (actualCommand !== requirement.command) {
      mismatchedCommands.push({
        script: requirement.script,
        expected: requirement.command,
        actual: actualCommand
      });
    }

    const actualFile = packageScriptFileFromCommand(actualCommand) || requirement.file;
    if (!fs.existsSync(path.join(projectRoot, actualFile))) {
      missingFiles.push({ script: requirement.script, file: actualFile });
    }
    if (!checkCommandCoversFile(checkCommand, actualFile)) {
      missingCheckEntries.push({ script: requirement.script, file: actualFile });
    }
  }

  return {
    ok: packageJson.exists
      && !packageJson.parseError
      && missingScripts.length === 0
      && mismatchedCommands.length === 0
      && missingFiles.length === 0
      && missingCheckEntries.length === 0,
    packageJsonExists: packageJson.exists,
    packageJsonParseError: packageJson.parseError,
    checkedScripts,
    missingScripts,
    mismatchedCommands,
    missingFiles,
    missingCheckEntries
  };
}

function runChatBackendDeployCheck(projectRoot = path.resolve(__dirname, '..')) {
  const dockerfilePath = path.join(projectRoot, 'Dockerfile');
  const runtimeScriptPath = path.join(projectRoot, 'scripts', 'run-chat-service.js');
  const packageJson = readPackageJson(projectRoot);
  const scripts = packageJson.value?.scripts || {};
  const dockerfileText = readTextIfExists(dockerfilePath);
  const runtimeScriptText = readTextIfExists(runtimeScriptPath);
  const expectedChatServeCommand = 'node scripts/run-chat-service.js';
  const actualChatServeCommand = scripts['chat:serve'];
  const missingFiles = CHAT_BACKEND_REQUIRED_FILES
    .filter(file => !fs.existsSync(path.join(projectRoot, file)));
  const missingScripts = actualChatServeCommand ? [] : ['chat:serve'];
  const mismatchedScripts = actualChatServeCommand && actualChatServeCommand !== expectedChatServeCommand
    ? [{
      script: 'chat:serve',
      expected: expectedChatServeCommand,
      actual: actualChatServeCommand
    }]
    : [];
  const missingDockerfileRequirements = CHAT_BACKEND_DOCKERFILE_REQUIREMENTS
    .filter(requirement => !requirement.pattern.test(dockerfileText))
    .map(requirement => requirement.id);
  const missingRuntimeRequirements = CHAT_BACKEND_RUNTIME_REQUIREMENTS
    .filter(requirement => !requirement.pattern.test(runtimeScriptText))
    .map(requirement => requirement.id);
  const forbiddenRuntimeMatches = CHAT_BACKEND_RUNTIME_FORBIDDEN_PATTERNS
    .filter(requirement => requirement.pattern ? requirement.pattern.test(runtimeScriptText) : requirement.predicate?.(runtimeScriptText))
    .map(requirement => requirement.id);

  return {
    ok: fs.existsSync(dockerfilePath)
      && packageJson.exists
      && !packageJson.parseError
      && missingFiles.length === 0
      && missingScripts.length === 0
      && mismatchedScripts.length === 0
      && missingDockerfileRequirements.length === 0
      && missingRuntimeRequirements.length === 0
      && forbiddenRuntimeMatches.length === 0,
    dockerfileExists: fs.existsSync(dockerfilePath),
    packageJsonExists: packageJson.exists,
    packageJsonParseError: packageJson.parseError,
    chatServeScript: actualChatServeCommand || null,
    missingFiles,
    missingScripts,
    mismatchedScripts,
    missingDockerfileRequirements,
    missingRuntimeRequirements,
    forbiddenRuntimeMatches
  };
}

function buildReleasePreflightChecklist(options = {}) {
  const platform = options.platform || process.platform;
  return [
    {
      id: 'node-tests',
      title: 'Node 回归测试',
      command: 'npm test',
      runGroup: 'fast',
      required: true,
      note: '覆盖核心数据、判断、社交、诊断和打包契约。'
    },
    {
      id: 'syntax-check',
      title: '语法和脚本检查',
      command: 'npm run check',
      runGroup: 'fast',
      required: true,
      note: '覆盖主进程、渲染端、脚本和动画生成脚本的静态语法。'
    },
    {
      id: 'diagnostics-summary',
      title: '诊断摘要冒烟',
      command: 'node scripts/release-preflight.js --check diagnostics-summary-output',
      runGroup: 'fast',
      required: true,
      note: '确认诊断摘要可生成，且预检日志只输出边界检查结果。'
    },
    {
      id: 'diagnostics-bundle',
      title: '安全诊断包生成',
      command: 'npm run diagnostics:bundle -- --output-dir output/diagnostics/preflight',
      runGroup: 'fast',
      required: true,
      note: '确认可生成只包含 summary.json 和 manifest.md 的脱敏诊断包。'
    },
    {
      id: 'diagnostics-bundle-output',
      title: '诊断包产物校验',
      command: 'node scripts/release-preflight.js --check diagnostics-bundle-output',
      runGroup: 'fast',
      required: true,
      note: '确认最新诊断包只包含 summary.json 和 manifest.md，summary 可解析且产物不含边界泄露。'
    },
    {
      id: 'render-qa',
      title: '桌面渲染 QA',
      command: 'npm run verify:pet-render',
      runGroup: 'full',
      required: true,
      note: '发布前完整确认桌面宠物、任务、设置、复盘和聊天场景。'
    },
    {
      id: 'screen-pipeline',
      title: '屏幕分析复盘管线 QA',
      command: 'npm run test:screen-pipeline',
      runGroup: 'full',
      required: true,
      note: '发布前确认手动屏幕分析、结构化 LLM 输出和复盘 LLM 串联。'
    },
    {
      id: 'package-scripts',
      title: '打包脚本静态审计',
      command: 'node scripts/release-preflight.js --check package-scripts',
      runGroup: 'fast',
      required: true,
      note: '确认打包、签名、验证脚本入口存在，且纳入语法检查。'
    },
    {
      id: 'chat-backend-deploy',
      title: '社交后端容器部署静态审计',
      command: 'node scripts/release-preflight.js --check chat-backend-deploy',
      runGroup: 'fast',
      required: true,
      note: '确认 Dockerfile、chat:serve、健康检查、持久化数据目录和 SIGTERM 关闭入口可用于容器部署。'
    },
    {
      id: 'mac-package',
      title: 'macOS 本地打包',
      command: 'npm run package:mac',
      runGroup: 'package',
      platform: 'darwin',
      required: platform === 'darwin',
      note: 'macOS 发布前生成本机 app 产物。'
    },
    {
      id: 'mac-controlled-client-release',
      title: 'macOS 被控制端发布资产',
      command: 'npm run release:mac:controlled',
      runGroup: 'package',
      platform: 'darwin',
      manual: true,
      required: false,
      note: '部署 HTTPS /client 被控制端入口后设置 REMOTE_CLIENT_URL 再执行，生成 DMG/ZIP/manifest；条件项，不随 package 自动组运行。'
    },
    {
      id: 'mac-signing',
      title: 'macOS 签名和校验',
      command: 'npm run sign:mac && npm run verify:mac',
      runGroup: 'package',
      platform: 'darwin',
      required: platform === 'darwin',
      note: '发布签名环境准备好后执行。'
    },
    {
      id: 'mac-notarization',
      title: 'macOS 公证',
      command: 'npm run notarize:mac && npm run verify:mac',
      runGroup: 'package',
      platform: 'darwin',
      required: platform === 'darwin',
      note: 'Apple ID、Team ID 和 App 专用密码准备好后执行，并在 staple 后再次验证。'
    },
    {
      id: 'windows-package',
      title: 'Windows 本地打包',
      command: 'npm run package:win',
      runGroup: 'package',
      platform: 'win32',
      required: platform === 'win32',
      note: '需要在 Windows 环境执行。'
    },
    {
      id: 'docs-boundary',
      title: '边界文档复核',
      command: 'node scripts/release-preflight.js --check docs-boundary',
      runGroup: 'fast',
      manual: false,
      required: true,
      note: '自动确认必需边界文档存在，且本轮排除项没有进入源码实现。'
    },
    {
      id: 'optimization-plan',
      title: '优化计划审计',
      command: 'node scripts/release-preflight.js --check optimization-plan',
      runGroup: 'fast',
      manual: false,
      required: true,
      note: '确认优化计划必需章节和验收状态完整，且没有未完成验收项。'
    },
    {
      id: 'error-log',
      title: '错误日志复核',
      command: 'node scripts/release-preflight.js --check error-log',
      runGroup: 'fast',
      manual: false,
      required: true,
      note: '确认错误日志存在、最新记录格式完整、最新状态为已解决，且没有历史开放未解决项。'
    }
  ];
}

function platformMatches(item, platform = process.platform) {
  return !item.platform || item.platform === platform;
}

function selectReleasePreflightItems(checklist, options = {}) {
  const run = options.run || 'list';
  const platform = options.platform || process.platform;
  const groups = {
    fast: new Set(['fast']),
    full: new Set(['fast', 'full']),
    package: new Set(['package']),
    all: new Set(['fast', 'full', 'package'])
  }[run] || new Set();
  return checklist.filter(item => !item.manual && groups.has(item.runGroup) && platformMatches(item, platform));
}

function renderReleasePreflightMarkdown(checklist, options = {}) {
  const platform = options.platform || process.platform;
  const lines = [
    '# Focus Pet 发布前检查清单',
    '',
    `当前平台：\`${platform}\``,
    '',
    '默认只打印清单；执行 `npm run release:preflight -- --run fast` 可运行本机基础 gate。',
    '',
    '| 状态 | 检查项 | 命令 | 说明 |',
    '| --- | --- | --- | --- |'
  ];
  for (const item of checklist) {
    const status = item.manual
      ? '人工'
      : platformMatches(item, platform)
        ? (item.required ? '必跑' : '可选')
        : `需 ${item.platform}`;
    lines.push(`| ${status} | ${item.title} | \`${item.command}\` | ${item.note} |`);
  }
  return `${lines.join('\n')}\n`;
}

function runReleasePreflightItems(items) {
  for (const item of items) {
    process.stdout.write(`\n[release-preflight] ${item.id}: ${item.command}\n`);
    const result = spawnSync(item.command, {
      shell: true,
      stdio: 'inherit',
      env: process.env
    });
    if (result.status !== 0) {
      return { ok: false, failed: item.id, status: result.status || 1 };
    }
  }
  return { ok: true };
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = { json: false, run: '', check: '' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--json') options.json = true;
    if (arg.startsWith('--run=')) {
      options.run = arg.slice('--run='.length);
      continue;
    }
    if (arg.startsWith('--check=')) {
      options.check = arg.slice('--check='.length);
      continue;
    }
    if (arg === '--run') {
      options.run = argv[index + 1] || '';
      index += 1;
    }
    if (arg === '--check') {
      options.check = argv[index + 1] || '';
      index += 1;
    }
  }
  return options;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.check) {
    const checks = {
      'diagnostics-summary-output': runDiagnosticsSummaryOutputCheck,
      'diagnostics-bundle-output': runDiagnosticsBundleOutputCheck,
      'docs-boundary': runDocsBoundaryCheck,
      'optimization-plan': runOptimizationPlanCheck,
      'package-scripts': runPackageScriptsCheck,
      'chat-backend-deploy': runChatBackendDeployCheck,
      'error-log': runErrorLogCheck
    };
    if (!checks[options.check]) {
      process.stderr.write(`Unknown release preflight check: ${options.check}\n`);
      return 1;
    }
    const result = checks[options.check]();
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result.ok ? 0 : 1;
  }

  const checklist = buildReleasePreflightChecklist();
  if (options.run) {
    const items = selectReleasePreflightItems(checklist, { run: options.run });
    if (!items.length) {
      process.stderr.write(`No runnable release preflight items for --run ${options.run}\n`);
      return 1;
    }
    const result = runReleasePreflightItems(items);
    if (!result.ok) return result.status;
    return 0;
  }
  process.stdout.write(options.json
    ? `${JSON.stringify(checklist, null, 2)}\n`
    : renderReleasePreflightMarkdown(checklist));
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  buildReleasePreflightChecklist,
  parseErrorLogEntries,
  renderReleasePreflightMarkdown,
  runDiagnosticsBundleOutputCheck,
  runDiagnosticsSummaryOutputCheck,
  runDocsBoundaryCheck,
  runErrorLogCheck,
  runChatBackendDeployCheck,
  runOptimizationPlanCheck,
  runPackageScriptsCheck,
  selectReleasePreflightItems,
  runReleasePreflightItems,
  parseArgs,
  main
};
