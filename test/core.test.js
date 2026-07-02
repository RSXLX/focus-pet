const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  buildDiagnosticsBundle,
  buildDiagnosticsSummary,
  buildRuntimeDiagnosticsSummary,
  cleanDiagnosticText,
  readRecentErrorSummaries,
  writeDiagnosticsBundle
} = require('../src/diagnostics');
const { readJsonWithRecovery, writeJsonAtomic } = require('../src/json-storage');
const { createTaskStore, migrateTasksState, TASK_SCHEMA_VERSION } = require('../src/task-store');
const { createSettingsStore, migrateSettingsState } = require('../src/settings-store');
const { classifyActivity } = require('../src/focus-rules');
const {
  applyFocusSceneTemplate,
  findFocusSceneTemplate,
  getFocusSceneTemplates
} = require('../src/focus-scene-templates');
const { DEFAULT_INTERVENTION_POLICY, focusStatusAffectsPetVitals, shouldShowIntervention } = require('../src/intervention-policy');
const { appendActivityLog, buildReviewFromEntries, buildReviewActionSuggestions, buildTaskReview, buildTomorrowPlan, makeStatusMessage, mergeTomorrowPlanTasks } = require('../src/focus');
const chatService = require('../src/chat-service');
const { normalizeMessage, reconcileQueuedMessages } = chatService;
const { applyLaunchAtLogin, launchAtLoginState } = require('../src/launch-login');
const { reviewLlmConfig, summarizeDailyReview } = require('../src/review-llm');
const { isLocalEndpoint, normalizeChatEndpoint } = require('../src/llm-provider');
const { parseFocusPetProcesses } = require('../scripts/process-utils');
const { shouldRestartAfterExit } = require('../scripts/run-electron');
const {
  parseWindowsFrontmost,
  platformFocusPermission,
  platformSettingsProfile,
  platformSettingsTarget,
  windowsFrontmostScript
} = require('../src/platform-support');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function tempDir(name) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `focus-pet-${name}-`));
}

test('json storage writes atomically and backs up corrupt files before fallback', () => {
  const dataDir = tempDir('json-storage');
  const filePath = path.join(dataDir, 'state.json');
  const fallback = { version: 1, value: 'fallback' };

  writeJsonAtomic(filePath, { version: 1, value: 'ok' });
  assert.deepEqual(JSON.parse(fs.readFileSync(filePath, 'utf8')), { version: 1, value: 'ok' });
  assert.equal(fs.readdirSync(dataDir).filter(name => name.includes('.tmp')).length, 0);

  fs.writeFileSync(filePath, '{"broken"', 'utf8');
  const recovered = readJsonWithRecovery(filePath, {
    fallback,
    backupLabel: 'state',
    normalize: value => value
  });

  assert.equal(recovered.recovered, true);
  assert.deepEqual(recovered.value, fallback);
  const backups = fs.readdirSync(dataDir).filter(name => /^state\.corrupt-.+\.json$/.test(name));
  assert.equal(backups.length, 1);
  assert.equal(fs.readFileSync(path.join(dataDir, backups[0]), 'utf8'), '{"broken"');
  assert.deepEqual(JSON.parse(fs.readFileSync(filePath, 'utf8')), fallback);
});

test('json storage creates rotating automatic backups before replacing existing files', () => {
  const dataDir = tempDir('json-storage-backup');
  const filePath = path.join(dataDir, 'state.json');
  const nowValues = [
    new Date('2026-06-30T12:00:00.000Z'),
    new Date('2026-06-30T12:01:00.000Z'),
    new Date('2026-06-30T12:02:00.000Z')
  ];
  let nowIndex = 0;
  const now = () => nowValues[nowIndex++];

  writeJsonAtomic(filePath, { version: 1, value: 'first' }, { backupLabel: 'state', maxBackups: 2, now });
  assert.equal(fs.readdirSync(dataDir).filter(name => /\.backup-/.test(name)).length, 0);

  writeJsonAtomic(filePath, { version: 1, value: 'second' }, { backupLabel: 'state', maxBackups: 2, now });
  writeJsonAtomic(filePath, { version: 1, value: 'third' }, { backupLabel: 'state', maxBackups: 2, now });
  writeJsonAtomic(filePath, { version: 1, value: 'fourth' }, { backupLabel: 'state', maxBackups: 2, now });

  const backups = fs.readdirSync(dataDir).filter(name => /^state\.backup-.+\.json$/.test(name)).sort();
  assert.equal(backups.length, 2);
  assert.deepEqual(
    backups.map(name => JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8')).value),
    ['second', 'third']
  );
  assert.deepEqual(JSON.parse(fs.readFileSync(filePath, 'utf8')), { version: 1, value: 'fourth' });
  assert.equal(fs.readdirSync(dataDir).filter(name => name.includes('.tmp')).length, 0);
});

test('task storage migration upgrades legacy payloads through an explicit entrypoint', () => {
  const legacyPayload = {
    version: 1,
    migratedFrom: 'legacy-task-export',
    tasks: [
      { text: '  整理迁移入口  ', done: false, customNote: '保留未知字段' }
    ]
  };

  const migrated = migrateTasksState(legacyPayload);
  assert.equal(migrated.version, TASK_SCHEMA_VERSION);
  assert.equal(migrated.migratedFrom, 'legacy-task-export');
  assert.equal(migrated.tasks[0].customNote, '保留未知字段');

  const dataDir = tempDir('task-migration');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'tasks.json'), JSON.stringify(legacyPayload), 'utf8');
  const tasks = createTaskStore({
    dataDir,
    now: () => new Date('2026-06-30T12:00:00.000Z')
  }).listTasks();
  assert.equal(tasks[0].text, '整理迁移入口');
  assert.equal(JSON.parse(fs.readFileSync(path.join(dataDir, 'tasks.json'), 'utf8')).version, TASK_SCHEMA_VERSION);
});

test('settings storage migration normalizes values while preserving unknown fields', () => {
  const migrated = migrateSettingsState({
    version: 0,
    popupCooldownMinutes: '20',
    reviewLlmEndpoint: 'not-a-url',
    unknownSetting: '保留'
  });

  assert.equal(migrated.version, 1);
  assert.equal(migrated.popupCooldownMinutes, 20);
  assert.equal(migrated.reviewLlmEndpoint, 'https://api.stepfun.com/step_plan/v1');
  assert.equal(migrated.unknownSetting, '保留');
});

test('chat storage migration upgrades legacy state and preserves unknown sections', () => {
  const migrated = chatService.migrateChatState({
    version: 0,
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    self: { id: 'pet-owner', name: '我' },
    friends: [],
    sessions: [
      { token: 'peer-token', peerId: 'peer-1', name: '小林', createdAt: '2026-06-30T12:00:00.000Z' }
    ],
    settings: { maxMediaMb: 40 },
    unknownSection: { preserved: true }
  });

  assert.equal(migrated.version, 1);
  assert.deepEqual(migrated.unknownSection, { preserved: true });
  assert.equal(migrated.sessions[0].expiresAt, '2026-07-30T12:00:00.000Z');
  assert.equal(migrated.settings.maxMediaMb, 40);
});

test('chat storage migration skips malformed activity log entries', () => {
  const migrated = chatService.migrateChatState({
    version: 0,
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    self: { id: 'pet-owner', name: '我' },
    friends: [],
    sessions: [],
    activityLog: [
      null,
      undefined,
      'not an activity',
      { id: 'missing-from', status: 'work', activity: '缺少来源' },
      { id: 'activity-1', from: 'pet-owner', status: 'study', activity: '正在阅读资料' }
    ],
    settings: { maxMediaMb: 25 }
  });

  assert.deepEqual(migrated.activityLog.map(activity => activity.id), ['activity-1']);
  assert.equal(migrated.activityLog[0].activity, '正在阅读资料');
});

test('chat storage migration skips malformed messages', () => {
  const migrated = chatService.migrateChatState({
    version: 0,
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    self: { id: 'pet-owner', name: '我' },
    friends: [{ id: 'peer-1', name: '小林', status: 'offline', unread: 0 }],
    sessions: [],
    messages: [
      null,
      'not a message',
      { id: 'missing-to', from: 'pet-owner', text: '缺少接收方' },
      {
        id: 'message-1',
        from: 'pet-owner',
        to: 'peer-1',
        type: 'text',
        text: '保留消息',
        createdAt: '2026-06-30T10:00:00.000Z'
      }
    ],
    settings: { socialActivityShareLevel: 'presence' }
  });

  assert.deepEqual(migrated.messages.map(message => message.id), ['message-1']);
  assert.equal(migrated.messages[0].text, '保留消息');

  const peerState = chatService.clientStateForAuth(
    { role: 'peer', peerId: 'peer-1', name: '小林', token: 'peer-token' },
    migrated,
    { port: 47321, settings: { socialActivityShareLevel: 'presence' } }
  );
  assert.deepEqual(peerState.messages.map(message => message.id), ['message-1']);
});

test('chat storage migration skips malformed friends', () => {
  const migrated = chatService.migrateChatState({
    version: 0,
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    self: { id: 'pet-owner', name: '我' },
    friends: [
      null,
      'not a friend',
      { name: '缺少 id' },
      { id: 'peer-1', name: ' 小林 ', status: 'online', unread: '3', customFlag: true }
    ],
    sessions: [],
    settings: { socialActivityShareLevel: 'presence' }
  });

  assert.deepEqual(migrated.friends.map(friend => friend.id), ['peer-1']);
  assert.equal(migrated.friends[0].name, '小林');
  assert.equal(migrated.friends[0].status, 'online');
  assert.equal(migrated.friends[0].unread, 3);
  assert.equal(migrated.friends[0].customFlag, true);
});

test('chat storage migration skips malformed sessions', () => {
  const deviceHash = crypto.createHash('sha256').update('device-A').digest('hex');
  const migrated = chatService.migrateChatState({
    version: 0,
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    self: { id: 'pet-owner', name: '我' },
    friends: [{ id: 'peer-1', name: '小林', status: 'offline', unread: 0 }],
    sessions: [
      null,
      'not a session',
      { token: 'missing-peer', name: '缺少 peer' },
      { peerId: 'peer-1', name: '缺少 token' },
      {
        token: 'peer-token',
        peerId: 'peer-1',
        name: ' 小林 ',
        createdAt: '2026-06-30T12:00:00.000Z',
        deviceIdHash: deviceHash
      }
    ],
    settings: { socialActivityShareLevel: 'presence' }
  });

  assert.deepEqual(migrated.sessions.map(session => session.token), ['peer-token']);
  assert.equal(migrated.sessions[0].peerId, 'peer-1');
  assert.equal(migrated.sessions[0].name, '小林');
  assert.equal(migrated.sessions[0].expiresAt, '2026-07-30T12:00:00.000Z');
  assert.equal(migrated.sessions[0].deviceIdHash, deviceHash);
  assert.equal(chatService.resolveAuth('peer-token', migrated, { deviceId: 'device-A' })?.peerId, 'peer-1');
  assert.equal(chatService.resolveAuth('peer-token', migrated, { deviceId: 'device-B' }), null);
});

test('chat storage migration skips malformed call audit entries', () => {
  const migrated = chatService.migrateChatState({
    version: 0,
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    self: { id: 'pet-owner', name: '我' },
    friends: [{ id: 'peer-1', name: '小林', status: 'offline', unread: 0 }],
    sessions: [],
    callAuditLog: [
      null,
      'not an audit entry',
      { event: 'unknown-event', from: 'pet-owner', to: 'peer-1', callId: 'call-0' },
      { event: 'rtc-offer', from: 'pet-owner', to: 'peer-1' },
      {
        id: 'audit-1',
        event: 'rtc-offer',
        from: 'pet-owner',
        to: 'peer-1',
        callId: 'call-1',
        mode: 'video',
        delivered: true,
        recipientClientCount: '2',
        time: '2026-06-30T12:10:00.000Z',
        sdp: 'secret-sdp',
        candidate: 'secret-ice'
      }
    ],
    settings: { socialActivityShareLevel: 'presence' }
  });

  assert.deepEqual(migrated.callAuditLog.map(entry => entry.id), ['audit-1']);
  assert.equal(migrated.callAuditLog[0].event, 'rtc-offer');
  assert.equal(migrated.callAuditLog[0].mode, 'video');
  assert.equal(migrated.callAuditLog[0].recipientClientCount, 2);
  assert.equal(migrated.callAuditLog[0].delivered, true);
  assert.equal(migrated.callAuditLog[0].sdp, undefined);
  assert.equal(migrated.callAuditLog[0].candidate, undefined);
});

test('chat storage migration normalizes malformed self identity', () => {
  const migrated = chatService.migrateChatState({
    version: 0,
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    self: { id: '', name: '', customFlag: true },
    friends: [{ id: 'peer-1', name: '小林', status: 'offline', unread: 0 }],
    sessions: [],
    settings: { socialActivityShareLevel: 'presence' }
  });

  assert.equal(migrated.self.id, 'pet-owner');
  assert.equal(migrated.self.name, '我');
  assert.equal(migrated.self.customFlag, true);

  const nonObject = chatService.migrateChatState({
    version: 0,
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    self: 'not a self object',
    friends: [],
    sessions: []
  });
  assert.deepEqual(nonObject.self, { id: 'pet-owner', name: '我' });
});

test('daily review builds chart-ready focus metrics for the last 24 hours', () => {
  const nowMs = Date.parse('2026-06-22T08:30:00.000Z');
  const review = buildReviewFromEntries([
    { time: '2026-06-22T08:05:00.000Z', status: 'work', app: 'Code' },
    { time: '2026-06-22T07:20:00.000Z', status: 'distracted', app: 'YouTube' },
    { time: '2026-06-22T07:40:00.000Z', status: 'unknown', app: 'Safari' },
    { time: '2026-06-22T02:10:00.000Z', status: 'permission', app: 'Code' },
    { time: '2026-06-20T08:05:00.000Z', status: 'work', app: 'Old' }
  ], { nowMs });

  assert.equal(review.samples, 4);
  assert.equal(review.workMinutes, 10);
  assert.equal(review.distractedMinutes, 10);
  assert.equal(review.unknownMinutes, 10);
  assert.equal(review.permissionMinutes, 10);
  assert.equal(review.totalMinutes, 40);
  assert.equal(review.focusScore, 50);
  assert.equal(review.windowHours, 24);
  assert.equal(review.minutesPerSample, 10);
  assert.equal(review.statusBreakdown.find(item => item.status === 'work').ratio, 25);
  assert.equal(review.statusBreakdown.find(item => item.status === 'permission').minutes, 10);
  assert.equal(review.hourly.length, 24);
  assert.equal(review.hourly.filter(bucket => bucket.samples > 0).length, 3);
  assert.equal(review.hourly.find(bucket => bucket.workMinutes === 10).samples, 1);
  assert.equal(review.hourly.find(bucket => bucket.distractedMinutes === 10).unknownMinutes, 10);
  assert.equal(review.topAppDetails[0].app, 'Code');
  assert.equal(review.topAppDetails[0].minutes, 20);
  assert.equal(review.topAppDetails[0].ratio, 50);
});

test('daily review rolls study into focus and game into distraction metrics', () => {
  const nowMs = Date.parse('2026-06-22T08:30:00.000Z');
  const review = buildReviewFromEntries([
    { time: '2026-06-22T08:05:00.000Z', status: 'work', app: 'Code' },
    { time: '2026-06-22T08:15:00.000Z', status: 'study', app: 'Preview' },
    { time: '2026-06-22T08:25:00.000Z', status: 'game', app: 'Steam' }
  ], { nowMs });

  assert.equal(review.samples, 3);
  assert.equal(review.workMinutes, 20);
  assert.equal(review.distractedMinutes, 10);
  assert.equal(review.unknownMinutes, 0);
  assert.equal(review.focusScore, 67);
  assert.equal(review.statusBreakdown.find(item => item.status === 'work').minutes, 20);
  assert.equal(review.statusBreakdown.find(item => item.status === 'distracted').minutes, 10);
});

test('daily review builds task-level progress and friction summary', () => {
  const nowMs = Date.parse('2026-06-22T08:30:00.000Z');
  const taskReview = buildTaskReview({
    nowMs,
    entries: [
      { time: '2026-06-22T08:05:00.000Z', status: 'work', app: 'Code', title: '任务维度复盘', currentTask: { id: 't1', text: '完成任务维度复盘' } },
      { time: '2026-06-22T08:15:00.000Z', status: 'distracted', app: 'YouTube', title: '无关视频', currentTask: { id: 't1', text: '完成任务维度复盘' } },
      { time: '2026-06-20T08:15:00.000Z', status: 'work', app: 'Code', title: '旧记录', currentTask: { id: 't1', text: '完成任务维度复盘' } }
    ],
    tasks: [
      { id: 't1', text: '完成任务维度复盘', priority: 'high', done: false, dueDate: '2026-06-22', nextAction: '补任务摘要', relatedApps: ['Code'], relatedKeywords: ['任务维度'] },
      { id: 't2', text: '等待设计确认', priority: 'medium', done: false, blockedBy: '设计稿未确认' },
      { id: 't3', text: '补复盘样式', priority: 'medium', done: false },
      { id: 't4', text: '跑完 QA', priority: 'low', done: true, completedAt: '2026-06-22T07:30:00.000Z' }
    ]
  });

  assert.deepEqual(taskReview.completion, { done: 1, total: 4, rate: 25 });
  assert.equal(taskReview.openCount, 3);
  assert.equal(taskReview.blockedCount, 1);
  assert.equal(taskReview.withoutNextActionCount, 1);
  assert.match(taskReview.summary, /完成 1\/4/);
  assert.match(taskReview.summary, /1 个阻塞/);

  const active = taskReview.rows.find(task => task.id === 't1');
  assert.equal(active.status, 'in_progress');
  assert.equal(active.workMinutes, 10);
  assert.equal(active.distractedMinutes, 10);
  assert.match(active.progressText, /推进 10 分钟/);
  assert.match(active.frictionText, /疑似偏离 10 分钟/);

  const blocked = taskReview.rows.find(task => task.id === 't2');
  assert.equal(blocked.status, 'blocked');
  assert.equal(blocked.blockedBy, '设计稿未确认');
  assert.match(blocked.frictionText, /阻塞/);

  assert.ok(taskReview.suggestions.some(text => text.includes('等待设计确认') && text.includes('设计稿未确认')));
  assert.ok(taskReview.suggestions.some(text => text.includes('补复盘样式') && text.includes('下一步')));
  assert.doesNotMatch(JSON.stringify(taskReview), /拖延|不自律|懒/);
});

test('daily review builds actionable suggestions from focus quality and friction signals', () => {
  const nowMs = Date.parse('2026-06-22T18:30:00.000');
  const entries = [
    { time: '2026-06-22T15:05:00.000', status: 'work', app: 'Code', title: '行动建议', currentTask: { id: 't1', text: '写复盘行动建议' } },
    { time: '2026-06-22T15:15:00.000', status: 'work', app: 'Code', title: '行动建议', currentTask: { id: 't1', text: '写复盘行动建议' } },
    { time: '2026-06-22T15:25:00.000', status: 'distracted', app: 'YouTube', title: '视频', currentTask: { id: 't1', text: '写复盘行动建议' } },
    { time: '2026-06-22T15:35:00.000', status: 'work', app: 'Code', title: '行动建议', currentTask: { id: 't1', text: '写复盘行动建议' } },
    { time: '2026-06-22T16:05:00.000', status: 'work', app: 'Code', title: '验证证据', currentTask: { id: 't2', text: '整理验证证据' } },
    { time: '2026-06-22T16:15:00.000', status: 'work', app: 'Code', title: '验证证据', currentTask: { id: 't2', text: '整理验证证据' } },
    { time: '2026-06-22T16:25:00.000', status: 'work', app: 'Code', title: '验证证据', currentTask: { id: 't2', text: '整理验证证据' } },
    { time: '2026-06-22T17:05:00.000', status: 'distracted', app: 'Steam', title: '游戏' },
    { time: '2026-06-22T17:15:00.000', status: 'distracted', app: 'Safari', title: '视频' },
    { time: '2026-06-22T17:25:00.000', status: 'unknown', app: 'Chat', title: '消息' }
  ];
  const tasks = [
    { id: 't1', text: '写复盘行动建议', done: false, nextAction: '补桌面卡片' },
    { id: 't2', text: '整理验证证据', done: false, nextAction: '跑 QA' },
    { id: 't3', text: '长期未完成文档', done: false, dueDate: '2026-06-10', updatedAt: '2026-06-10T00:00:00.000Z' },
    { id: 't4', text: '补下一步', done: false }
  ];
  const review = buildReviewFromEntries(entries, { nowMs });
  const taskReview = buildTaskReview({ tasks, entries, nowMs });
  const actionReview = buildReviewActionSuggestions({ review, taskReview, tasks, entries, nowMs });

  assert.equal(review.hourly.find(bucket => bucket.label === '15:00').appSwitches, 2);
  assert.equal(actionReview.qualityFocusBlocks[0].minutes, 30);
  assert.equal(actionReview.driftWindows[0].label, '17:00');
  assert.equal(actionReview.interruptedTasks.find(task => task.id === 't1').interruptions, 1);
  assert.ok(actionReview.staleTasks.some(task => task.id === 't3'));
  assert.ok(actionReview.suggestions.length >= 1);
  assert.ok(actionReview.suggestions.some(item => item.text.includes('17:00') && item.text.includes('规避动作')));
  assert.ok(actionReview.suggestions.some(item => item.text.includes('长期未完成文档') && item.text.includes('下一步')));
  assert.ok(actionReview.suggestions.some(item => item.text.includes('16:00') && item.text.includes('25 分钟')));
  assert.doesNotMatch(JSON.stringify(actionReview), /拖延|不自律|懒|沉迷|自控力|心理归因/);
});

test('desktop review panel renders task-level progress and friction insights', () => {
  const renderer = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'renderer.js'), 'utf8');

  assert.match(renderer, /function renderReviewTaskInsights/);
  assert.match(renderer, /const taskInsightsNode = renderReviewTaskInsights\(review\)/);
  assert.match(renderer, /review\.taskReview/);
  assert.match(renderer, /review-task-insights/);
  assert.match(renderer, /review-task-row/);
  assert.match(renderer, /if \(!rows\.length\) return null/);
  assert.match(renderer, /if \(taskInsightsNode\) reviewNodes\.push\(taskInsightsNode\)/);
  assert.match(renderer, /reviewBox\.append\(\.\.\.reviewNodes\)/);
});

test('desktop review panel renders compact actionable review suggestions', () => {
  const renderer = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'renderer.js'), 'utf8');
  const styles = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'styles.css'), 'utf8');

  assert.match(renderer, /function renderReviewActionSuggestions/);
  assert.match(renderer, /review\.actionSuggestions/);
  assert.match(renderer, /review-action-suggestions/);
  assert.match(renderer, /const actionSuggestionNode = renderReviewActionSuggestions\(review\)/);
  assert.match(renderer, /if \(actionSuggestionNode\) reviewNodes\.push\(actionSuggestionNode\)/);
  assert.match(styles, /\.review-action-suggestions/);
});

test('daily review suggests a tomorrow plan from carry-over tasks and focus metrics', () => {
  const nowMs = Date.parse('2026-06-22T08:30:00.000Z');
  const review = buildReviewFromEntries([
    { time: '2026-06-22T06:05:00.000Z', status: 'work', app: 'Code' },
    { time: '2026-06-22T06:25:00.000Z', status: 'work', app: 'Code' },
    { time: '2026-06-22T07:20:00.000Z', status: 'distracted', app: 'YouTube' }
  ], { nowMs });

  const plan = buildTomorrowPlan({
    review,
    nowMs,
    tasks: [
      { id: 't1', text: '完成复盘图表', priority: 'high', done: false, dueDate: '2026-06-22' },
      { id: 't2', text: '整理产品路线图', priority: 'medium', done: false, dueDate: '' },
      { id: 't3', text: '跑完 QA', priority: 'low', done: true, dueDate: '2026-06-22' }
    ]
  });

  assert.equal(plan.date, '2026-06-23');
  assert.equal(plan.focusScore, 67);
  assert.deepEqual(plan.completion, { done: 1, total: 3, rate: 33 });
  assert.equal(plan.carryOverCount, 2);
  assert.match(plan.summary, /2 个未完成/);
  assert.match(plan.firstStep, /完成复盘图表/);
  assert.equal(plan.tasks[0].text, '继续推进：完成复盘图表');
  assert.equal(plan.tasks[0].priority, 'high');
  assert.equal(plan.tasks[0].dueDate, '2026-06-23');
  assert.equal(plan.tasks[0].sourceTaskId, 't1');
  assert.ok(plan.tasks.some(task => task.source === 'focus-reset' && task.text.includes('收束分心入口')));
  assert.equal(plan.tasks.at(-1).source, 'daily-review');
});

test('tomorrow plan tasks merge into the task list without duplicates', () => {
  const existing = [
    { id: 'today-1', text: '继续推进：完成复盘图表', priority: 'high', dueDate: '2026-06-23', done: false, order: 0 },
    { id: 'today-2', text: '今天遗留任务', priority: 'medium', dueDate: '', done: false, order: 1 }
  ];
  const plan = {
    date: '2026-06-23',
    tasks: [
      { text: '继续推进：完成复盘图表', priority: 'high', dueDate: '2026-06-23', source: 'carry-over' },
      { text: '收束分心入口：为 YouTube 设一个规避动作', priority: 'medium', dueDate: '2026-06-23', source: 'focus-reset' },
      { text: '晚上复盘明日节奏并选出下一步', priority: 'low', dueDate: '2026-06-23', source: 'daily-review' }
    ]
  };

  const result = mergeTomorrowPlanTasks(existing, plan);

  assert.equal(result.addedCount, 2);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.tasks.length, 4);
  assert.equal(result.tasks[2].text, '收束分心入口：为 YouTube 设一个规避动作');
  assert.equal(result.tasks[2].priority, 'medium');
  assert.equal(result.tasks[2].dueDate, '2026-06-23');
  assert.equal(result.tasks[3].priority, 'low');
});

function readWebpSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  assert.equal(buffer.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(buffer.subarray(8, 12).toString('ascii'), 'WEBP');
  const chunkType = buffer.subarray(12, 16).toString('ascii');
  assert.equal(chunkType, 'VP8L');
  assert.equal(buffer[20], 0x2f);
  const b0 = buffer[21];
  const b1 = buffer[22];
  const b2 = buffer[23];
  const b3 = buffer[24];
  return {
    width: 1 + (((b1 & 0x3f) << 8) | b0),
    height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6))
  };
}

test('task store migrates markdown and supports CRUD metadata', () => {
  const dataDir = tempDir('tasks');
  fs.writeFileSync(
    path.join(dataDir, 'today_tasks.md'),
    '# 今日任务\n\n- [ ] 联系供应商整理库存\n- [x] 写日报\n',
    'utf8'
  );
  const store = createTaskStore({
    dataDir,
    now: () => new Date('2026-06-22T09:00:00.000Z')
  });

  const migrated = store.listTasks();
  assert.equal(migrated.length, 2);
  assert.equal(migrated[0].text, '联系供应商整理库存');
  assert.equal(migrated[0].done, false);
  assert.equal(migrated[1].done, true);

  const added = store.addTask({ text: '发版检查', priority: 'high', dueDate: '2026-06-23' });
  store.updateTask(added.id, { text: '发版检查清单', priority: 'medium' });
  store.toggleTask(migrated[0].id, true);
  store.moveTask(added.id, 'up');
  const afterCrud = store.listTasks();

  assert.equal(afterCrud[0].text, '发版检查清单');
  assert.equal(afterCrud[0].priority, 'medium');
  assert.equal(afterCrud[0].dueDate, '2026-06-23');
  assert.equal(afterCrud.find(task => task.text === '联系供应商整理库存').done, true);
  assert.match(fs.readFileSync(path.join(dataDir, 'today_tasks.md'), 'utf8'), /- \[ \] \(medium, due:2026-06-23\) 发版检查清单/);

  store.deleteTask(added.id);
  assert.equal(store.listTasks().some(task => task.id === added.id), false);
});

test('task store picks the most actionable incomplete task', () => {
  const dataDir = tempDir('current-task');
  const store = createTaskStore({
    dataDir,
    now: () => new Date('2026-06-22T09:00:00.000Z')
  });
  store.replaceTasks([
    { text: '低优先级无期限', priority: 'low', dueDate: '' },
    { text: '高优先级明天', priority: 'high', dueDate: '2026-06-23' },
    { text: '高优先级今天', priority: 'high', dueDate: '2026-06-22' }
  ]);

  assert.equal(store.getCurrentTask().text, '高优先级今天');
});

test('task store normalizes enhanced task metadata and writes schema version 2', () => {
  const dataDir = tempDir('enhanced-task-metadata');
  const store = createTaskStore({
    dataDir,
    now: () => new Date('2026-06-22T09:00:00.000Z')
  });

  const added = store.addTask({
    text: '  设计任务模型增强   ',
    description: '  支持下一步、相关应用和关键词  ',
    estimatedMinutes: 999,
    energyLevel: 'high',
    contextTags: ['  产品 ', '', '任务', '产品'],
    relatedApps: [' Code ', 'code', '', 'Safari'],
    relatedKeywords: [' 当前任务 ', '', '选择解释', '当前任务'],
    blockedBy: '  等待评审 ',
    nextAction: '  写字段规范化测试  ',
    pinned: true
  });

  assert.equal(added.text, '设计任务模型增强');
  assert.equal(added.description, '支持下一步、相关应用和关键词');
  assert.equal(added.estimatedMinutes, 480);
  assert.equal(added.energyLevel, 'high');
  assert.deepEqual(added.contextTags, ['产品', '任务']);
  assert.deepEqual(added.relatedApps, ['Code', 'Safari']);
  assert.deepEqual(added.relatedKeywords, ['当前任务', '选择解释']);
  assert.equal(added.blockedBy, '等待评审');
  assert.equal(added.nextAction, '写字段规范化测试');
  assert.equal(added.pinned, true);
  assert.equal(added.updatedAt, '2026-06-22T09:00:00.000Z');

  const payload = JSON.parse(fs.readFileSync(path.join(dataDir, 'tasks.json'), 'utf8'));
  assert.equal(payload.version, 2);
  assert.equal(payload.tasks.find(task => task.id === added.id).nextAction, '写字段规范化测试');
});

test('focus scene templates define task defaults, rules, pet preference, and review metrics', () => {
  const templates = getFocusSceneTemplates();
  assert.deepEqual(templates.map(template => template.id), [
    'coding',
    'paper',
    'exam',
    'meeting',
    'reading',
    'creation',
    'light-rest'
  ]);

  for (const template of templates) {
    assert.ok(template.label);
    assert.ok(Array.isArray(template.appRules) && template.appRules.length > 0);
    assert.ok(Array.isArray(template.keywordRules) && template.keywordRules.length > 0);
    assert.ok(Number.isInteger(template.reminderMinutes) && template.reminderMinutes > 0);
    assert.ok(template.petAnimationPreference);
    assert.ok(Array.isArray(template.reviewMetrics) && template.reviewMetrics.length > 0);
  }

  assert.equal(findFocusSceneTemplate('coding').label, '写代码');
});

test('focus scene template metadata survives task storage and feeds activity classification', () => {
  const dataDir = tempDir('scene-template-task');
  const store = createTaskStore({
    dataDir,
    now: () => new Date('2026-06-30T09:00:00.000Z')
  });
  const taskInput = applyFocusSceneTemplate({
    text: '实现专注场景模板',
    priority: 'medium',
    contextTags: ['产品'],
    relatedApps: ['Terminal'],
    relatedKeywords: ['场景模板']
  }, 'coding');

  assert.equal(taskInput.focusSceneTemplate, 'coding');
  assert.equal(taskInput.focusSceneLabel, '写代码');
  assert.equal(taskInput.reminderMinutes, 25);
  assert.equal(taskInput.petAnimationPreference, 'work');
  assert.ok(taskInput.contextTags.includes('产品'));
  assert.ok(taskInput.contextTags.includes('写代码'));
  assert.ok(taskInput.relatedApps.includes('Terminal'));
  assert.ok(taskInput.relatedApps.includes('Code'));
  assert.ok(taskInput.relatedKeywords.includes('场景模板'));
  assert.ok(taskInput.relatedKeywords.includes('代码'));
  assert.ok(taskInput.reviewMetrics.includes('testRuns'));

  const saved = store.addTask(taskInput);
  assert.equal(saved.focusSceneTemplate, 'coding');
  assert.equal(saved.focusSceneLabel, '写代码');
  assert.equal(saved.reminderMinutes, 25);
  assert.equal(saved.petAnimationPreference, 'work');
  assert.ok(saved.reviewMetrics.includes('testRuns'));

  const result = classifyActivity({
    app: 'Code',
    title: 'focus-scene-templates.js',
    currentTask: saved,
    settings: {
      workApps: [],
      gameApps: [],
      focusKeywords: [],
      studyKeywords: [],
      gameKeywords: [],
      distractionKeywords: []
    }
  });

  assert.equal(result.status, 'work');
  assert.match(result.reason, /写代码/);
  assert.match(result.reason, /Code/);
});

test('task store explains current task selection and skips blocked tasks', () => {
  const dataDir = tempDir('current-task-explanation');
  const store = createTaskStore({
    dataDir,
    now: () => new Date('2026-06-22T09:00:00.000Z')
  });
  const tasks = store.replaceTasks([
    { text: '高优先级但被阻塞', priority: 'high', dueDate: '2026-06-22', blockedBy: '等待接口' },
    { text: '高优先级明天无下一步', priority: 'high', dueDate: '2026-06-23' },
    { text: '高优先级明天有下一步', priority: 'high', dueDate: '2026-06-23', nextAction: '打开设计稿' },
    { text: '低优先级置顶', priority: 'low', dueDate: '', pinned: true }
  ]);

  const firstDecision = store.getCurrentTaskDecision();
  assert.equal(firstDecision.task.text, '低优先级置顶');
  assert.ok(firstDecision.reasons.includes('pinned'));
  assert.equal(firstDecision.skippedBlockedCount, 1);

  store.updateTask(tasks.find(task => task.text === '低优先级置顶').id, { pinned: false });
  const secondDecision = store.getCurrentTaskDecision();
  assert.equal(secondDecision.task.text, '高优先级明天有下一步');
  assert.ok(secondDecision.reasons.includes('has-next-action'));
  assert.equal(store.getCurrentTask().id, secondDecision.task.id);
});

test('task store keeps manual current task selection exclusive', () => {
  const dataDir = tempDir('current-task-manual-selection');
  const store = createTaskStore({
    dataDir,
    now: () => new Date('2026-06-22T09:00:00.000Z')
  });
  const tasks = store.replaceTasks([
    { text: '高优先级默认任务', priority: 'high' },
    { text: '低优先级手动任务', priority: 'low' },
    { text: '另一个手动任务', priority: 'medium' }
  ]);

  const low = tasks.find(task => task.text === '低优先级手动任务');
  const other = tasks.find(task => task.text === '另一个手动任务');

  const selectedLow = store.selectTask(low.id);
  assert.equal(selectedLow.selected, true);
  assert.equal(store.getCurrentTaskDecision().task.text, '低优先级手动任务');
  assert.ok(store.getCurrentTaskDecision().reasons.includes('selected'));

  const selectedOther = store.selectTask(other.id);
  assert.equal(selectedOther.selected, true);
  const afterSecondSelection = store.listTasks();
  assert.equal(afterSecondSelection.find(task => task.id === low.id).selected, false);
  assert.equal(afterSecondSelection.filter(task => task.selected).length, 1);
  assert.equal(store.getCurrentTaskDecision().task.text, '另一个手动任务');
});

test('task store clears manual current selection when the task is completed or reopened', () => {
  const dataDir = tempDir('current-task-selection-complete');
  const store = createTaskStore({
    dataDir,
    now: () => new Date('2026-06-22T09:00:00.000Z')
  });
  const tasks = store.replaceTasks([
    { text: '默认高优先级', priority: 'high' },
    { text: '手动当前任务', priority: 'low' }
  ]);
  const manual = tasks.find(task => task.text === '手动当前任务');

  store.selectTask(manual.id);
  const completed = store.toggleTask(manual.id, true);
  assert.equal(completed.done, true);
  assert.equal(completed.selected, false);
  assert.equal(store.listTasks().filter(task => task.selected).length, 0);

  const reopened = store.toggleTask(manual.id, false);
  assert.equal(reopened.done, false);
  assert.equal(reopened.selected, false);
  assert.equal(store.getCurrentTaskDecision().task.text, '默认高优先级');
  assert.doesNotMatch(store.getCurrentTaskDecision().reasons.join(','), /selected/);
});

test('task store normalizes legacy selected flags to one actionable current task', () => {
  const dataDir = tempDir('current-task-selected-normalize');
  const store = createTaskStore({
    dataDir,
    now: () => new Date('2026-06-22T09:00:00.000Z')
  });

  const tasks = store.replaceTasks([
    { text: '已完成旧选择', done: true, selected: true },
    { text: '阻塞旧选择', blockedBy: '等待确认', selected: true },
    { text: '第一个可执行旧选择', priority: 'low', selected: true },
    { text: '第二个可执行旧选择', priority: 'high', selected: true }
  ]);

  assert.equal(tasks.find(task => task.text === '已完成旧选择').selected, false);
  assert.equal(tasks.find(task => task.text === '阻塞旧选择').selected, false);
  assert.equal(tasks.find(task => task.text === '第一个可执行旧选择').selected, true);
  assert.equal(tasks.find(task => task.text === '第二个可执行旧选择').selected, false);
  assert.equal(tasks.filter(task => task.selected).length, 1);
  assert.equal(store.getCurrentTaskDecision().task.text, '第一个可执行旧选择');
});

test('task store returns normalized selection when updates make selected task unactionable', () => {
  const dataDir = tempDir('current-task-selected-update-normalize');
  const store = createTaskStore({
    dataDir,
    now: () => new Date('2026-06-22T09:00:00.000Z')
  });
  const tasks = store.replaceTasks([
    { text: '默认高优先级', priority: 'high' },
    { text: '手动当前任务', priority: 'low' }
  ]);
  const manual = tasks.find(task => task.text === '手动当前任务');

  store.selectTask(manual.id);
  const updated = store.updateTask(manual.id, { blockedBy: '等待确认' });
  assert.equal(updated.blockedBy, '等待确认');
  assert.equal(updated.selected, false);
  assert.equal(store.listTasks().find(task => task.id === manual.id).selected, false);
  assert.equal(store.getCurrentTaskDecision().task.text, '默认高优先级');
});

test('desktop task panel mirrors actionable task selection metadata', () => {
  const renderer = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'renderer.js'), 'utf8');

  assert.match(renderer, /function taskBlockedReason/);
  assert.match(renderer, /function taskSelectionRank/);
  assert.match(renderer, /\.filter\(item => !item\.done && !taskBlockedReason\(item\)\)/);
  assert.match(renderer, /Boolean\(task\.pinned\)/);
  assert.match(renderer, /async function selectCurrentTask/);
  assert.match(renderer, /window\.focusPet\.selectTask\(item\.id\)/);
  assert.match(renderer, /selectCurrent\.title = item\.selected \? '当前任务' : '设为当前任务'/);
  assert.match(renderer, /Boolean\(taskMetadataText\(task\.nextAction\)\)/);
  assert.match(renderer, /task-selection-reason/);
});

test('desktop task composer exposes focus scene templates', () => {
  const indexHtml = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'index.html'), 'utf8');
  const renderer = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'renderer.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));

  assert.match(indexHtml, /id="newTaskScene"/);
  assert.match(indexHtml, /focus-scene-templates\.js/);
  assert.match(renderer, /const newTaskScene = document\.querySelector\('#newTaskScene'\)/);
  assert.match(renderer, /function renderFocusSceneTemplateOptions/);
  assert.match(renderer, /applyFocusSceneTemplate/);
  assert.match(renderer, /newTaskScene\.addEventListener\('change', clearTaskComposerFeedback\)/);
  assert.match(packageJson.scripts.check, /src\/focus-scene-templates\.js/);
});

test('current task decision is exposed through Electron IPC', () => {
  const main = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'preload.js'), 'utf8');

  assert.match(main, /ipcMain\.handle\('tasks:current-decision', \(\) => focus\.getCurrentTaskDecision\(\)\)/);
  assert.match(preload, /getCurrentTaskDecision: \(\) => ipcRenderer\.invoke\('tasks:current-decision'\)/);
});

test('task and settings stores back up corrupt JSON before restoring usable state', () => {
  const taskDir = tempDir('task-recovery');
  const taskJsonPath = path.join(taskDir, 'tasks.json');
  fs.mkdirSync(taskDir, { recursive: true });
  fs.writeFileSync(taskJsonPath, '{"tasks"', 'utf8');

  const taskStore = createTaskStore({
    dataDir: taskDir,
    now: () => new Date('2026-06-30T09:00:00.000Z')
  });
  const tasks = taskStore.listTasks();
  const taskBackups = fs.readdirSync(taskDir).filter(name => /^tasks\.corrupt-.+\.json$/.test(name));

  assert.ok(tasks.length > 0);
  assert.equal(taskBackups.length, 1);
  assert.equal(fs.readFileSync(path.join(taskDir, taskBackups[0]), 'utf8'), '{"tasks"');
  assert.equal(JSON.parse(fs.readFileSync(taskJsonPath, 'utf8')).version, 2);

  const settingsDir = tempDir('settings-recovery');
  const settingsPath = path.join(settingsDir, 'settings.json');
  fs.mkdirSync(settingsDir, { recursive: true });
  fs.writeFileSync(settingsPath, '{"settings"', 'utf8');

  const settings = createSettingsStore({ dataDir: settingsDir }).getSettings();
  const settingsBackups = fs.readdirSync(settingsDir).filter(name => /^settings\.corrupt-.+\.json$/.test(name));

  assert.equal(settings.popupCooldownMinutes, 8);
  assert.equal(settingsBackups.length, 1);
  assert.equal(fs.readFileSync(path.join(settingsDir, settingsBackups[0]), 'utf8'), '{"settings"');
  assert.equal(JSON.parse(fs.readFileSync(settingsPath, 'utf8')).popupCooldownMinutes, 8);
});

test('settings store normalizes configurable behavior', () => {
  const store = createSettingsStore({ dataDir: tempDir('settings') });
  const saved = store.updateSettings({
    popupCooldownMinutes: 0,
    idleNudgeMinutes: 120,
    maxMediaMb: 300,
    autoPopupEnabled: false,
    petBehaviorIntensity: 'active',
    launchAtLogin: true,
    updateFeedUrl: 'https://example.com/focus-pet/latest.json',
    screenMonitorEnabled: true,
    screenMonitorIntervalSeconds: 3,
    screenMonitorEndpoint: 'https://llm.example.com/v1/chat/completions',
    screenMonitorModel: 'vision-model',
    reviewLlmEnabled: true,
    reviewLlmEndpoint: 'https://api.stepfun.com/step_plan/v1',
    reviewLlmModel: 'step-3.7-flash',
    voiceRecordShortcut: ' ctrl + shift + v ',
    socialActivityShareLevel: 'screen-summary',
    activityRetentionDays: 0
  });

  assert.equal(saved.popupCooldownMinutes, 1);
  assert.equal(saved.idleNudgeMinutes, 60);
  assert.equal(saved.maxMediaMb, 100);
  assert.equal(saved.autoPopupEnabled, false);
  assert.equal(saved.petBehaviorIntensity, 'active');
  assert.equal(saved.launchAtLogin, true);
  assert.equal(saved.updateFeedUrl, 'https://example.com/focus-pet/latest.json');
  assert.equal(saved.screenMonitorEnabled, true);
  assert.equal(saved.screenMonitorIntervalSeconds, 15);
  assert.equal(saved.screenMonitorEndpoint, 'https://llm.example.com/v1/chat/completions');
  assert.equal(saved.screenMonitorModel, 'vision-model');
  assert.equal(saved.reviewLlmEnabled, true);
  assert.equal(saved.reviewLlmEndpoint, 'https://api.stepfun.com/step_plan/v1');
  assert.equal(saved.reviewLlmModel, 'step-3.7-flash');
  assert.equal(saved.voiceRecordShortcut, 'Ctrl+Shift+V');
  assert.equal(saved.socialActivityShareLevel, 'screen-summary');
  assert.equal(saved.activityRetentionDays, 1);

  const defaults = store.updateSettings({
    screenMonitorEndpoint: 'file:///tmp/not-allowed',
    screenMonitorModel: '  ',
    reviewLlmEndpoint: 'file:///tmp/not-allowed',
    reviewLlmModel: '  ',
    voiceRecordShortcut: 'Alt',
    socialActivityShareLevel: 'full',
    activityRetentionDays: 9999
  });
  assert.equal(defaults.screenMonitorEndpoint, '');
  assert.equal(defaults.screenMonitorModel, '');
  assert.equal(defaults.reviewLlmEndpoint, 'https://api.stepfun.com/step_plan/v1');
  assert.equal(defaults.reviewLlmModel, 'step-3.7-flash');
  assert.equal(defaults.voiceRecordShortcut, 'Alt+R');
  assert.equal(defaults.socialActivityShareLevel, 'presence');
  assert.equal(defaults.activityRetentionDays, 365);
});

test('activity log appends with a configurable retention window', () => {
  const dataDir = tempDir('activity-retention');
  const logPath = path.join(dataDir, 'activity.jsonl');
  fs.writeFileSync(logPath, [
    JSON.stringify({ time: '2026-05-20T10:00:00.000Z', status: 'work', app: 'Old' }),
    JSON.stringify({ time: '2026-06-15T10:00:00.000Z', status: 'work', app: 'Recent' }),
    JSON.stringify({ time: '', status: 'unknown', app: 'NoTime' })
  ].join('\n') + '\n', 'utf8');

  appendActivityLog(
    { time: '2026-06-30T10:00:00.000Z', status: 'study', app: 'Code' },
    {
      logPath,
      retentionDays: 30,
      now: () => '2026-06-30T12:00:00.000Z'
    }
  );

  const entries = fs.readFileSync(logPath, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(entries.map(entry => entry.app), ['Recent', 'NoTime', 'Code']);
  assert.equal(fs.existsSync(`${logPath}.tmp`), false);
});

test('jsonl retention helper prunes screen monitor logs with the same local retention window', () => {
  const { appendJsonlWithRetention } = require('../src/jsonl-retention');
  const dataDir = tempDir('screen-monitor-retention');
  const logPath = path.join(dataDir, 'screen-monitor.jsonl');
  fs.writeFileSync(logPath, [
    JSON.stringify({ time: '2026-05-20T10:00:00.000Z', status: 'work', activity: 'Old monitor sample' }),
    JSON.stringify({ time: '2026-06-15T10:00:00.000Z', status: 'work', activity: 'Recent monitor sample' }),
    JSON.stringify({ time: '', status: 'unknown', activity: 'Legacy monitor sample' })
  ].join('\n') + '\n', 'utf8');

  appendJsonlWithRetention(
    { time: '2026-06-30T10:00:00.000Z', status: 'study', activity: 'New monitor sample' },
    {
      logPath,
      retentionDays: 30,
      now: () => '2026-06-30T12:00:00.000Z'
    }
  );

  const entries = fs.readFileSync(logPath, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(entries.map(entry => entry.activity), ['Recent monitor sample', 'Legacy monitor sample', 'New monitor sample']);
  assert.equal(fs.existsSync(`${logPath}.tmp`), false);
});

test('screen monitor logging uses retained jsonl writes instead of unbounded append', () => {
  const main = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));

  assert.match(main, /const \{ appendJsonlWithRetention \} = require\('\.\/jsonl-retention'\)/);
  assert.match(main, /appendScreenMonitorLog\(publicResult, settings\.activityRetentionDays\)/);
  assert.match(main, /appendScreenMonitorLog\(result, settings\.activityRetentionDays\)/);
  assert.match(main, /appendJsonlWithRetention\(safeEntry,[\s\S]*screen-monitor\.jsonl[\s\S]*retentionDays/);
  assert.doesNotMatch(main, /appendFileSync\(path\.join\(focus\.DATA_DIR, 'screen-monitor\.jsonl'\)/);
  assert.match(packageJson.scripts.check, /src\/jsonl-retention\.js/);
});

test('settings store normalizes local-first LLM provider controls', () => {
  const store = createSettingsStore({ dataDir: tempDir('local-llm-settings') });
  const saved = store.updateSettings({
    llmCloudMode: 'local-only',
    screenMonitorProvider: 'ollama',
    screenMonitorEndpoint: 'http://127.0.0.1:11434',
    screenMonitorModel: 'llava',
    reviewLlmProvider: 'local-openai-compatible',
    reviewLlmEndpoint: 'http://localhost:1234/v1/chat/completions',
    reviewLlmModel: 'llama3.2'
  });

  assert.equal(saved.llmCloudMode, 'local-only');
  assert.equal(saved.screenMonitorProvider, 'ollama');
  assert.equal(saved.screenMonitorEndpoint, 'http://127.0.0.1:11434');
  assert.equal(saved.screenMonitorModel, 'llava');
  assert.equal(saved.reviewLlmProvider, 'local-openai-compatible');
  assert.equal(saved.reviewLlmEndpoint, 'http://localhost:1234/v1/chat/completions');
  assert.equal(saved.reviewLlmModel, 'llama3.2');

  const defaults = store.updateSettings({
    llmCloudMode: 'internet',
    screenMonitorProvider: 'unknown',
    reviewLlmProvider: 'unknown'
  });
  assert.equal(defaults.llmCloudMode, 'allowed');
  assert.equal(defaults.screenMonitorProvider, 'openai-compatible');
  assert.equal(defaults.reviewLlmProvider, 'openai-compatible');
});

test('focus classifier can match current task context semantically', () => {
  const settings = createSettingsStore({ dataDir: tempDir('focus-settings') }).getSettings();
  const result = classifyActivity({
    app: 'Safari',
    title: '供应商库存表 - Numbers',
    currentTask: { text: '联系供应商整理库存', priority: 'high' },
    settings
  });

  assert.equal(result.status, 'work');
  assert.match(result.reason, /当前任务/);

  const distraction = classifyActivity({
    app: 'Google Chrome',
    title: 'YouTube - 供应商库存教程',
    currentTask: { text: '联系供应商整理库存' },
    settings
  });
  assert.equal(distraction.status, 'distracted');
});

test('focus classifier uses task related apps and keywords as task context', () => {
  const result = classifyActivity({
    app: 'Miro',
    title: 'Sprint map',
    currentTask: {
      text: '写周报',
      relatedApps: ['Miro'],
      relatedKeywords: ['Sprint map']
    },
    settings: {
      workApps: [],
      gameApps: [],
      focusKeywords: [],
      studyKeywords: [],
      gameKeywords: [],
      distractionKeywords: []
    }
  });

  assert.equal(result.status, 'work');
  assert.match(result.reason, /任务相关/);
});

test('focus classifier distinguishes study and game activity states', () => {
  const settings = createSettingsStore({ dataDir: tempDir('activity-mode-settings') }).getSettings();

  const study = classifyActivity({
    app: 'Preview',
    title: '线性代数课程笔记.pdf',
    currentTask: { text: '复习线性代数' },
    settings
  });
  assert.equal(study.status, 'study');
  assert.match(study.reason, /学习/);

  const game = classifyActivity({
    app: 'Steam',
    title: 'Hades II',
    currentTask: { text: '复习线性代数' },
    settings
  });
  assert.equal(game.status, 'game');
  assert.match(game.reason, /游戏/);
});

test('intervention policy only nudges eligible off-task states', () => {
  const policy = {
    ...DEFAULT_INTERVENTION_POLICY,
    minConfidenceToInterrupt: 0.75,
    cooldownMinutes: 15,
    maxInterruptionsPerHour: 3,
    neverInterruptApps: ['Zoom']
  };
  const nowMs = Date.parse('2026-06-30T08:00:00.000Z');

  assert.equal(shouldShowIntervention({ status: 'work', confidence: 1, nowMs }, policy).shouldShow, false);
  assert.equal(shouldShowIntervention({ status: 'study', confidence: 1, nowMs }, policy).shouldShow, false);
  assert.equal(shouldShowIntervention({ status: 'game', confidence: 0.5, nowMs }, policy).shouldShow, false);
  assert.equal(shouldShowIntervention({ status: 'game', confidence: 0.9, app: 'Zoom', nowMs }, policy).shouldShow, false);

  const allowed = shouldShowIntervention({ status: 'game', confidence: 0.9, app: 'Steam', nowMs }, policy);
  assert.equal(allowed.shouldShow, true);
  assert.equal(allowed.target, 'tasks');
  assert.equal(allowed.level, 'bubble_action');
});

test('intervention policy respects cooldown and hourly limits', () => {
  const policy = {
    ...DEFAULT_INTERVENTION_POLICY,
    minConfidenceToInterrupt: 0.75,
    cooldownMinutes: 15,
    maxInterruptionsPerHour: 2
  };
  const nowMs = Date.parse('2026-06-30T09:00:00.000Z');

  const coolingDown = shouldShowIntervention({
    status: 'distracted',
    confidence: 0.9,
    nowMs,
    lastShownAt: nowMs - 5 * 60 * 1000
  }, policy);
  assert.equal(coolingDown.shouldShow, false);
  assert.equal(coolingDown.reason, 'cooldown');

  const hourlyLimited = shouldShowIntervention({
    status: 'distracted',
    confidence: 0.9,
    nowMs,
    recentShownAt: [
      nowMs - 50 * 60 * 1000,
      nowMs - 10 * 60 * 1000
    ]
  }, policy);
  assert.equal(hourlyLimited.shouldShow, false);
  assert.equal(hourlyLimited.reason, 'hourly-limit');

  const permission = shouldShowIntervention({ status: 'permission', confidence: 0, nowMs }, policy);
  assert.equal(permission.shouldShow, true);
  assert.equal(permission.target, 'settings');
  assert.equal(permission.reason, 'permission');
});

test('permission repair prompts do not change pet vitals', () => {
  const renderer = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'renderer.js'), 'utf8');

  assert.equal(focusStatusAffectsPetVitals({ status: 'permission' }), false);
  assert.equal(focusStatusAffectsPetVitals('permission'), false);
  assert.equal(focusStatusAffectsPetVitals({ status: 'unknown' }), true);
  assert.equal(focusStatusAffectsPetVitals({ status: 'game' }), true);
  assert.match(renderer, /function focusStatusAffectsPetVitals/);
  assert.match(renderer, /if \(!focusStatusAffectsPetVitals\(status\)\) return;/);
  assert.doesNotMatch(renderer, /key === 'permission'[\s\S]{0,160}applyPetVitalsDelta/);
});

test('focus-linked pet vitals avoid punitive game and distraction feedback', () => {
  const renderer = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'renderer.js'), 'utf8');
  const gameEffect = renderer.match(/key === 'game'[\s\S]*?applyPetVitalsDelta\(\{([^}]*)\},\s*'([^']*)'/);
  const distractedEffect = renderer.match(/key === 'distracted'[\s\S]*?applyPetVitalsDelta\(\{([^}]*)\},\s*'([^']*)'/);

  assert.ok(gameEffect, 'game status pet feedback should be explicit');
  assert.ok(distractedEffect, 'distracted status pet feedback should be explicit');
  assert.doesNotMatch(gameEffect[1], /\bmood\s*:\s*-/);
  assert.doesNotMatch(gameEffect[1], /\bbond\s*:\s*-/);
  assert.doesNotMatch(distractedEffect[1], /\bmood\s*:\s*-/);
  assert.doesNotMatch(distractedEffect[1], /\bbond\s*:\s*-/);
  assert.doesNotMatch(gameEffect[2], /心情会受影响|精力会下降|不自律|拖延|惩罚/);
  assert.doesNotMatch(distractedEffect[2], /心情会受影响|精力会下降|不自律|拖延|惩罚/);
});

test('unknown focus status keeps pet feedback observational instead of punitive', () => {
  const renderer = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'renderer.js'), 'utf8');
  const unknownEffect = renderer.match(/key === 'distracted'[\s\S]*?\} else \{\s*applyPetVitalsDelta\(\{([^}]*)\},\s*'([^']*)'/);

  assert.ok(unknownEffect, 'unknown status pet feedback should be explicit');
  assert.doesNotMatch(unknownEffect[1], /\bmood\s*:\s*-/);
  assert.doesNotMatch(unknownEffect[1], /\bbond\s*:\s*-/);
  assert.match(unknownEffect[2], /观察|等待|不明确/);
  assert.doesNotMatch(unknownEffect[2], /心情会受影响|不自律|拖延|惩罚/);
});

test('focus status messages keep attention states low-disruption and non-punitive', () => {
  assert.equal(typeof makeStatusMessage, 'function');

  const task = { id: 't1', text: '写优化方案' };
  const messages = [
    makeStatusMessage({ status: 'distracted', app: 'Safari', currentTask: task }),
    makeStatusMessage({ status: 'game', app: 'Steam', currentTask: task }),
    makeStatusMessage({ status: 'unknown', app: 'Finder', currentTask: task })
  ];

  for (const message of messages) {
    assert.doesNotMatch(message, /喂|跑偏啦|收回来|切回任务|不自律|拖延|惩罚|强制/);
    assert.match(message, /可能|节奏|观察|结束点|任务/);
  }
});

test('screen monitor does not capture until explicitly enabled and configured', async () => {
  const { analyzeScreenActivity } = require('../src/screen-monitor');
  let captures = 0;
  const captureScreen = async () => {
    captures += 1;
    return { dataUrl: 'data:image/png;base64,screen', sourceName: 'Screen 1' };
  };

  const disabled = await analyzeScreenActivity({
    settings: { screenMonitorEnabled: false },
    captureScreen
  });
  assert.equal(disabled.ok, false);
  assert.equal(disabled.status, 'disabled');
  assert.equal(captures, 0);

  const needsConfig = await analyzeScreenActivity({
    settings: { screenMonitorEnabled: true },
    env: {},
    getScreenPermissionStatus: () => 'granted',
    captureScreen
  });
  assert.equal(needsConfig.ok, false);
  assert.equal(needsConfig.status, 'needs-config');
  assert.equal(captures, 0);
});

test('screen monitor accepts study and game status from vision analysis', () => {
  const { normalizeScreenAnalysis } = require('../src/screen-monitor');

  assert.equal(normalizeScreenAnalysis({ status: 'study', activity: '阅读课程笔记' }).status, 'study');
  assert.equal(normalizeScreenAnalysis({ status: 'game', activity: '运行 Steam 游戏' }).status, 'game');
});

test('screen monitor enforces structured LLM schema and request timeout discard policy', async () => {
  const { analyzeScreenActivity, buildVisionPrompt, normalizeScreenAnalysis } = require('../src/screen-monitor');

  const structured = normalizeScreenAnalysis({
    state: 'work',
    activity_summary: '正在实现屏幕 LLM schema',
    task_relevance: 'on_task',
    evidence: ['Code 正在编辑 screen-monitor.js', '当前任务提到 schema'],
    confidence: 0.86,
    privacy_risk: 'low',
    suggested_intervention: 'gentle',
    reasoning_visible: '屏幕内容和当前任务直接相关'
  });
  assert.equal(structured.schemaVersion, 1);
  assert.equal(structured.schemaValid, true);
  assert.equal(structured.status, 'work');
  assert.equal(structured.activity, '正在实现屏幕 LLM schema');
  assert.equal(structured.taskRelevance, 'on_task');
  assert.deepEqual(structured.evidence, ['Code 正在编辑 screen-monitor.js', '当前任务提到 schema']);
  assert.equal(structured.privacyRisk, 'low');
  assert.equal(structured.suggestedIntervention, 'gentle');
  assert.equal(structured.reasoningVisible, '屏幕内容和当前任务直接相关');

  const invalid = normalizeScreenAnalysis({
    state: 'calendar',
    activity_summary: '无效状态',
    task_relevance: 'on_task',
    evidence: 'not-an-array',
    confidence: 0.9,
    privacy_risk: 'low',
    suggested_intervention: 'return_to_task',
    reasoning_visible: '状态不在 schema 内'
  });
  assert.equal(invalid.schemaValid, false);
  assert.equal(invalid.status, 'unknown');
  assert.equal(invalid.suggestedIntervention, 'none');
  assert.equal(invalid.reasoningVisible, 'LLM 输出不符合结构化 schema');

  const lowConfidence = normalizeScreenAnalysis({
    state: 'distracted',
    activity_summary: '疑似离开当前任务',
    task_relevance: 'uncertain',
    evidence: ['画面信息不足'],
    confidence: 0.42,
    privacy_risk: 'low',
    suggested_intervention: 'return_to_task',
    reasoning_visible: '证据不足，只展示状态'
  });
  assert.equal(lowConfidence.status, 'distracted');
  assert.equal(lowConfidence.lowConfidence, true);
  assert.equal(lowConfidence.suggestedIntervention, 'none');

  const distractedResult = await analyzeScreenActivity({
    settings: {
      screenMonitorEnabled: true,
      screenMonitorEndpoint: 'https://llm.example.com/v1/chat/completions',
      screenMonitorModel: 'vision-model'
    },
    env: { FOCUS_PET_LLM_API_KEY: 'test-key' },
    now: () => new Date('2026-06-23T09:03:00.000Z'),
    getScreenPermissionStatus: () => 'granted',
    captureScreen: async () => ({ dataUrl: 'data:image/png;base64,screen', sourceName: 'Screen 1' }),
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              state: 'distracted',
              activity_summary: '疑似离开当前任务',
              task_relevance: 'uncertain',
              evidence: ['画面信息不足'],
              confidence: 0.42,
              privacy_risk: 'low',
              suggested_intervention: 'return_to_task',
              reasoning_visible: '证据不足，只展示状态'
            })
          }
        }]
      })
    }),
    requestTimeoutMs: 500
  });
  assert.equal(distractedResult.ok, true);
  assert.match(distractedResult.message, /可能偏离/);
  assert.doesNotMatch(distractedResult.message, /可能跑偏/);
  assert.doesNotMatch(fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'screen-monitor.js'), 'utf8'), /可能跑偏/);

  const prompt = buildVisionPrompt({ currentTask: { text: '实现 schema' }, frontmost: { app: 'Code', title: 'screen-monitor.js' } });
  assert.match(prompt, /state/);
  assert.match(prompt, /task_relevance/);
  assert.match(prompt, /privacy_risk/);
  assert.match(prompt, /reasoning_visible/);

  const timedOut = await analyzeScreenActivity({
    settings: {
      screenMonitorEnabled: true,
      screenMonitorEndpoint: 'https://llm.example.com/v1/chat/completions',
      screenMonitorModel: 'vision-model'
    },
    env: { FOCUS_PET_LLM_API_KEY: 'test-key' },
    now: () => new Date('2026-06-23T09:05:00.000Z'),
    getScreenPermissionStatus: () => 'granted',
    captureScreen: async () => ({ dataUrl: 'data:image/png;base64,timeout-screen', sourceName: 'Screen 1' }),
    fetchImpl: () => new Promise(() => {}),
    requestTimeoutMs: 5
  });
  assert.equal(timedOut.ok, false);
  assert.equal(timedOut.status, 'timeout');
  assert.match(timedOut.reason, /超时/);
  assert.match(timedOut.reason, /丢弃/);
  assert.equal(timedOut.screenshot, undefined);
});

test('screen monitor respects macOS screen recording permission', async () => {
  const { analyzeScreenActivity } = require('../src/screen-monitor');
  let captures = 0;

  const result = await analyzeScreenActivity({
    settings: {
      screenMonitorEnabled: true,
      screenMonitorEndpoint: 'https://llm.example.com/v1/chat/completions',
      screenMonitorModel: 'vision-model'
    },
    env: { FOCUS_PET_LLM_API_KEY: 'test-key' },
    getScreenPermissionStatus: () => 'denied',
    captureScreen: async () => {
      captures += 1;
      return { dataUrl: 'data:image/png;base64,screen', sourceName: 'Screen 1' };
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 'permission');
  assert.match(result.reason, /屏幕录制/);
  assert.equal(captures, 0);
});

test('screen monitor sends screenshots to an OpenAI-compatible vision model', async () => {
  const { analyzeScreenActivity } = require('../src/screen-monitor');
  const requests = [];

  const result = await analyzeScreenActivity({
    settings: {
      screenMonitorEnabled: true,
      screenMonitorEndpoint: 'https://llm.example.com/v1/chat/completions',
      screenMonitorModel: 'vision-model'
    },
    env: { FOCUS_PET_LLM_API_KEY: 'test-key' },
    now: () => new Date('2026-06-23T09:00:00.000Z'),
    getScreenPermissionStatus: () => 'granted',
    currentTask: { text: '实现屏幕监控功能' },
    frontmost: { app: 'Code', title: 'focus-pet' },
    captureScreen: async () => ({ dataUrl: 'data:image/png;base64,screen', sourceName: 'Screen 1' }),
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                status: 'work',
                activity: '正在编辑 Electron 代码',
                reason: '屏幕中是代码编辑器，内容和当前任务相关',
                confidence: 0.82,
                suggestion: '继续推进当前实现'
              })
            }
          }]
        })
      };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'work');
  assert.equal(result.activity, '正在编辑 Electron 代码');
  assert.equal(result.confidence, 0.82);
  assert.equal(result.screenshot.dataUrl, 'data:image/png;base64,screen');
  assert.equal(result.screenshot.mimeType, 'image/png');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://llm.example.com/v1/chat/completions');
  assert.equal(requests[0].options.headers.authorization, 'Bearer test-key');
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.model, 'vision-model');
  assert.match(body.messages[1].content[0].text, /实现屏幕监控功能/);
  assert.equal(body.messages[1].content[1].image_url.url, 'data:image/png;base64,screen');
});

test('screen monitor supports local Ollama-compatible vision without API key', async () => {
  const { analyzeScreenActivity, monitorConfig } = require('../src/screen-monitor');
  const requests = [];
  const settings = {
    screenMonitorEnabled: true,
    screenMonitorProvider: 'ollama',
    screenMonitorEndpoint: 'http://127.0.0.1:11434',
    screenMonitorModel: 'llava'
  };
  const config = monitorConfig(settings, {});

  assert.equal(isLocalEndpoint('http://127.0.0.1:11434'), true);
  assert.equal(normalizeChatEndpoint('http://127.0.0.1:11434', { provider: 'ollama' }), 'http://127.0.0.1:11434/v1/chat/completions');
  assert.equal(config.provider, 'ollama');
  assert.equal(config.localProvider, true);
  assert.equal(config.apiKeyRequired, false);
  assert.equal(config.endpoint, 'http://127.0.0.1:11434/v1/chat/completions');
  assert.equal(config.configured, true);
  assert.deepEqual(config.missing, []);

  const result = await analyzeScreenActivity({
    settings,
    env: {},
    now: () => new Date('2026-06-30T10:00:00.000Z'),
    getScreenPermissionStatus: () => 'granted',
    currentTask: { text: '接入本地视觉模型' },
    frontmost: { app: 'Code', title: 'focus-pet' },
    captureScreen: async () => ({ dataUrl: 'data:image/png;base64,local-screen', sourceName: 'Screen 1' }),
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                state: 'work',
                activity_summary: '正在接入本地视觉模型',
                task_relevance: 'on_task',
                evidence: ['代码编辑器中是本地模型配置'],
                confidence: 0.88,
                privacy_risk: 'low',
                suggested_intervention: 'gentle',
                reasoning_visible: '画面和当前任务直接相关'
              })
            }
          }]
        })
      };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'work');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'http://127.0.0.1:11434/v1/chat/completions');
  assert.equal(Object.prototype.hasOwnProperty.call(requests[0].options.headers, 'authorization'), false);
});

test('screen monitor can upload one screenshot manually while automatic monitoring is disabled', async () => {
  const { analyzeScreenActivity } = require('../src/screen-monitor');
  let captures = 0;
  let uploads = 0;

  const result = await analyzeScreenActivity({
    settings: {
      screenMonitorEnabled: false,
      screenMonitorEndpoint: 'https://llm.example.com/v1/chat/completions',
      screenMonitorModel: 'vision-model'
    },
    env: { FOCUS_PET_LLM_API_KEY: 'test-key' },
    manual: true,
    getScreenPermissionStatus: () => 'granted',
    currentTask: { text: '接通手动截图上传' },
    frontmost: { app: 'Code', title: 'focus-pet' },
    captureScreen: async () => {
      captures += 1;
      return { dataUrl: 'data:image/png;base64,manual-screen', sourceName: 'Screen 1' };
    },
    fetchImpl: async (_url, options) => {
      uploads += 1;
      const body = JSON.parse(options.body);
      assert.equal(body.messages[1].content[1].image_url.url, 'data:image/png;base64,manual-screen');
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                status: 'work',
                activity: '正在完善手动截图上传',
                reason: '屏幕显示代码编辑器和相关任务',
                confidence: 0.9,
                suggestion: '完成 IPC 透传后运行验证'
              })
            }
          }]
        })
      };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'work');
  assert.equal(result.activity, '正在完善手动截图上传');
  assert.equal(result.screenshot.dataUrl, 'data:image/png;base64,manual-screen');
  assert.equal(captures, 1);
  assert.equal(uploads, 1);
});

test('daily review uses StepFun-compatible chat completions without storing secrets', async () => {
  const requests = [];
  const config = reviewLlmConfig({
    reviewLlmEnabled: true,
    reviewLlmEndpoint: 'https://api.stepfun.com/step_plan/v1',
    reviewLlmModel: 'step-3.7-flash'
  }, { FOCUS_PET_STEPFUN_API_KEY: 'test-key' });

  assert.equal(config.configured, true);
  assert.equal(config.endpoint, 'https://api.stepfun.com/step_plan/v1/chat/completions');
  assert.equal(config.model, 'step-3.7-flash');

  const result = await summarizeDailyReview({
    settings: {
      reviewLlmEnabled: true,
      reviewLlmEndpoint: 'https://api.stepfun.com/step_plan/v1',
      reviewLlmModel: 'step-3.7-flash'
    },
    env: { FOCUS_PET_STEPFUN_API_KEY: 'test-key' },
    review: {
      samples: 12,
      workMinutes: 68,
      distractedMinutes: 12,
      unknownMinutes: 4,
      topApps: [['Code', 7], ['Safari', 3]]
    },
    currentTask: { text: '推进 StepFun 复盘', priority: 'high', dueDate: '2026-06-23' },
    tasks: [
      { text: '推进 StepFun 复盘', priority: 'high', dueDate: '2026-06-23', done: false },
      { text: '修复任务布局', priority: 'medium', dueDate: '', done: true }
    ],
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: 'StepFun 建议先收束到一个小步骤',
                insight: '当前任务明确，继续推进比切换上下文更合适。',
                tone: 'focused',
                petMessage: 'StepFun 看完节奏，先推进一小步。',
                nextAction: {
                  kind: 'surface',
                  action: 'tasks',
                  label: '看任务',
                  text: '按 StepFun 建议先推进当前任务。',
                  reason: 'StepFun 复盘',
                  title: '打开今日任务'
                }
              })
            }
          }]
        })
      };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.source, 'stepfun');
  assert.equal(result.tone, 'focused');
  assert.equal(result.nextAction.action, 'tasks');
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.stepfun.com/step_plan/v1/chat/completions');
  assert.equal(requests[0].options.headers.authorization, 'Bearer test-key');
  const body = JSON.parse(requests[0].options.body);
  assert.equal(body.model, 'step-3.7-flash');
  assert.match(body.messages[1].content, /推进 StepFun 复盘/);
  assert.doesNotMatch(fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'review-llm.js'), 'utf8'), /test-key/);
});

test('daily review supports local LLM providers and local-only cloud blocking', async () => {
  const requests = [];
  const config = reviewLlmConfig({
    reviewLlmEnabled: true,
    reviewLlmProvider: 'ollama',
    reviewLlmEndpoint: 'http://127.0.0.1:11434',
    reviewLlmModel: 'llama3.2'
  }, {});

  assert.equal(config.provider, 'ollama');
  assert.equal(config.localProvider, true);
  assert.equal(config.apiKeyRequired, false);
  assert.equal(config.endpoint, 'http://127.0.0.1:11434/v1/chat/completions');
  assert.equal(config.configured, true);

  const blocked = reviewLlmConfig({
    reviewLlmEnabled: true,
    llmCloudMode: 'local-only',
    reviewLlmProvider: 'openai-compatible',
    reviewLlmEndpoint: 'https://api.stepfun.com/step_plan/v1',
    reviewLlmModel: 'step-3.7-flash'
  }, { FOCUS_PET_STEPFUN_API_KEY: 'cloud-key' });
  assert.equal(blocked.configured, false);
  assert.deepEqual(blocked.missing, ['localEndpoint']);

  const result = await summarizeDailyReview({
    settings: {
      reviewLlmEnabled: true,
      reviewLlmProvider: 'ollama',
      reviewLlmEndpoint: 'http://127.0.0.1:11434',
      reviewLlmModel: 'llama3.2'
    },
    env: {},
    review: {
      samples: 3,
      workMinutes: 25,
      distractedMinutes: 0,
      unknownMinutes: 0,
      topApps: [['Code', 3]]
    },
    currentTask: { text: '验证本地复盘模型' },
    tasks: [{ text: '验证本地复盘模型', done: false }],
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: '本地复盘模型已接通',
                insight: '当前任务明确，可以继续推进。',
                tone: 'focused',
                petMessage: '本地模型看完节奏，继续推进当前任务。',
                nextAction: {
                  kind: 'surface',
                  action: 'tasks',
                  label: '看任务',
                  text: '先完成本地模型验证。',
                  reason: '本地复盘',
                  title: '打开今日任务'
                }
              })
            }
          }]
        })
      };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'http://127.0.0.1:11434/v1/chat/completions');
  assert.equal(Object.prototype.hasOwnProperty.call(requests[0].options.headers, 'authorization'), false);
});

test('daily review includes current screen LLM analysis for the review pipeline', async () => {
  const requests = [];

  const result = await summarizeDailyReview({
    settings: {
      reviewLlmEnabled: true,
      reviewLlmEndpoint: 'https://api.stepfun.com/step_plan/v1',
      reviewLlmModel: 'step-3.7-flash'
    },
    env: { FOCUS_PET_STEPFUN_API_KEY: 'test-key' },
    review: {
      samples: 3,
      workMinutes: 20,
      distractedMinutes: 0,
      unknownMinutes: 0,
      topApps: [['Chrome', 2]]
    },
    currentTask: { text: '规划微信小程序开发', priority: 'high' },
    tasks: [{ text: '规划微信小程序开发', priority: 'high', done: false }],
    screenAnalysis: {
      ok: true,
      time: '2026-06-23T15:42:00.000Z',
      sourceName: 'Screen 1',
      status: 'work',
      activity: '正在搜索微信小程序开发资料',
      reason: '浏览器搜索内容和当前任务相关',
      confidence: 0.91,
      suggestion: '把调研目标写成一个小任务'
    },
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                summary: '当前正在围绕小程序开发做资料调研',
                insight: '搜索内容和任务一致，下一步应该收束成具体清单。',
                tone: 'focused',
                petMessage: '我看到你在查小程序开发，先把调研目标写清楚。',
                nextAction: {
                  kind: 'surface',
                  action: 'tasks',
                  label: '写任务',
                  text: '把小程序调研拆成一个最小任务。',
                  reason: '屏幕分析',
                  title: '打开今日任务'
                }
              })
            }
          }]
        })
      };
    }
  });

  assert.equal(result.ok, true);
  assert.equal(requests.length, 1);
  const body = JSON.parse(requests[0].options.body);
  const prompt = body.messages[1].content;
  assert.match(prompt, /本次屏幕 LLM 分析/);
  assert.match(prompt, /正在搜索微信小程序开发资料/);
  assert.match(prompt, /浏览器搜索内容和当前任务相关/);
  assert.match(prompt, /把调研目标写成一个小任务/);
  assert.match(prompt, /置信度：91%/);
  assert.match(prompt, /截图来源：Screen 1/);
  assert.match(prompt, /截图时间：2026-06-23T15:42:00.000Z/);
});

test('LLM connectivity self-check reports missing config without sending requests', async () => {
  const { runLlmConnectivitySelfCheck } = require('../src/llm-self-check');
  let calls = 0;

  const result = await runLlmConnectivitySelfCheck({
    settings: {
      screenMonitorEndpoint: '',
      screenMonitorModel: 'vision-model',
      reviewLlmEndpoint: 'https://api.stepfun.com/step_plan/v1',
      reviewLlmModel: 'step-3.7-flash'
    },
    env: {},
    fetchImpl: async () => {
      calls += 1;
      throw new Error('fetch should not run when config is incomplete');
    }
  });

  assert.equal(result.ok, false);
  assert.equal(calls, 0);
  assert.equal(result.checks.length, 2);

  const screenCheck = result.checks.find(check => check.id === 'screen-monitor');
  assert.equal(screenCheck.ok, false);
  assert.equal(screenCheck.status, 'needs-config');
  assert.deepEqual(screenCheck.missing, ['endpoint', 'apiKey']);
  assert.match(screenCheck.summary, /屏幕监控 LLM 缺少 endpoint、API key/);
  assert.match(screenCheck.nextSteps.join('\n'), /FOCUS_PET_LLM_API_KEY|OPENAI_API_KEY/);
  assert.match(screenCheck.nextSteps.join('\n'), /Chat Completions/);

  const reviewCheck = result.checks.find(check => check.id === 'review-llm');
  assert.equal(reviewCheck.ok, false);
  assert.equal(reviewCheck.status, 'needs-config');
  assert.deepEqual(reviewCheck.missing, ['apiKey']);
  assert.match(reviewCheck.summary, /复盘 LLM 缺少 API key/);
  assert.match(reviewCheck.nextSteps.join('\n'), /FOCUS_PET_REVIEW_LLM_API_KEY|FOCUS_PET_STEPFUN_API_KEY|STEPFUN_API_KEY|STEP_API_KEY/);
});

test('LLM connectivity self-check sends minimal requests and explains HTTP failures', async () => {
  const { runLlmConnectivitySelfCheck } = require('../src/llm-self-check');
  const requests = [];

  const result = await runLlmConnectivitySelfCheck({
    settings: {
      screenMonitorEndpoint: 'https://llm.example.com/v1/chat/completions',
      screenMonitorModel: 'vision-model',
      reviewLlmEndpoint: 'https://api.stepfun.com/step_plan/v1',
      reviewLlmModel: 'step-3.7-flash'
    },
    env: {
      FOCUS_PET_LLM_API_KEY: 'vision-key',
      FOCUS_PET_STEPFUN_API_KEY: 'review-key'
    },
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      if (url.includes('stepfun')) {
        return {
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
          text: async () => 'invalid api key'
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] })
      };
    }
  });

  assert.equal(result.ok, false);
  assert.equal(requests.length, 2);

  const screenRequest = requests[0];
  assert.equal(screenRequest.url, 'https://llm.example.com/v1/chat/completions');
  assert.equal(screenRequest.options.headers.authorization, 'Bearer vision-key');
  const screenBody = JSON.parse(screenRequest.options.body);
  assert.equal(screenBody.model, 'vision-model');
  assert.equal(screenBody.max_tokens, 8);
  assert.doesNotMatch(JSON.stringify(screenBody), /image_url/);

  const reviewRequest = requests[1];
  assert.equal(reviewRequest.url, 'https://api.stepfun.com/step_plan/v1/chat/completions');
  assert.equal(reviewRequest.options.headers.authorization, 'Bearer review-key');
  const reviewBody = JSON.parse(reviewRequest.options.body);
  assert.equal(reviewBody.model, 'step-3.7-flash');
  assert.match(reviewBody.messages[1].content, /ping/i);

  const screenCheck = result.checks.find(check => check.id === 'screen-monitor');
  assert.equal(screenCheck.ok, true);
  assert.equal(screenCheck.status, 'connected');
  assert.match(screenCheck.summary, /屏幕监控 LLM 连通/);

  const reviewCheck = result.checks.find(check => check.id === 'review-llm');
  assert.equal(reviewCheck.ok, false);
  assert.equal(reviewCheck.status, 'request-failed');
  assert.equal(reviewCheck.statusCode, 401);
  assert.match(reviewCheck.summary, /复盘 LLM 请求失败：401/);
  assert.match(reviewCheck.detail, /invalid api key/);
  assert.match(reviewCheck.nextSteps.join('\n'), /API key/);
});

test('LLM connectivity self-check treats local providers as no-key services', async () => {
  const { runLlmConnectivitySelfCheck } = require('../src/llm-self-check');
  const requests = [];

  const result = await runLlmConnectivitySelfCheck({
    settings: {
      screenMonitorProvider: 'ollama',
      screenMonitorEndpoint: 'http://127.0.0.1:11434',
      screenMonitorModel: 'llava',
      reviewLlmProvider: 'ollama',
      reviewLlmEndpoint: 'http://127.0.0.1:11434',
      reviewLlmModel: 'llama3.2'
    },
    env: {},
    fetchImpl: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: 'ok' } }] })
      };
    },
    now: () => new Date('2026-06-30T10:30:00.000Z')
  });

  assert.equal(result.ok, true);
  assert.equal(result.checkedAt, '2026-06-30T10:30:00.000Z');
  assert.equal(requests.length, 2);
  assert.ok(requests.every(request => request.url === 'http://127.0.0.1:11434/v1/chat/completions'));
  assert.ok(requests.every(request => !Object.prototype.hasOwnProperty.call(request.options.headers, 'authorization')));

  const screenCheck = result.checks.find(check => check.id === 'screen-monitor');
  assert.equal(screenCheck.localProvider, true);
  assert.equal(screenCheck.apiKeyRequired, false);
  assert.equal(screenCheck.apiKeyPresent, false);
  assert.match(screenCheck.summary, /本地/);
  assert.match(screenCheck.detail, /无需 API key/);
});

test('chat messages expose queued and sent delivery states', () => {
  const state = {
    self: { id: 'me', name: '我' },
    friends: [{ id: 'friend-1', name: '搭子', status: 'offline', unread: 0 }],
    messages: []
  };
  const queued = normalizeMessage(
    { from: 'me', to: 'friend-1', text: '推进一下', clientId: 'local-1' },
    state,
    { now: () => '2026-06-22T09:00:00.000Z', id: () => 'server-1', isRecipientOnline: () => false }
  );
  assert.equal(queued.deliveryStatus, 'queued');
  assert.equal(queued.clientId, 'local-1');

  const reconciled = reconcileQueuedMessages({ ...state, messages: [queued] }, 'friend-1', 'delivered');
  assert.equal(reconciled.messages[0].deliveryStatus, 'delivered');
  assert.ok(reconciled.messages[0].deliveredAt);
});

test('external chat defaults to presence-only activity sharing for peers', () => {
  const state = {
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    self: { id: 'pet-owner', name: '我' },
    friends: [
      { id: 'peer-1', name: '小林', status: 'online', unread: 0 },
      { id: 'peer-2', name: '其他人', status: 'online', unread: 0 }
    ],
    sessions: [{ token: 'peer-token', peerId: 'peer-1', name: '小林' }],
    messages: [],
    activities: {
      'pet-owner': {
        id: 'activity-1',
        from: 'pet-owner',
        status: 'work',
        activity: '正在编辑 Focus Pet 聊天功能',
        reason: '屏幕中是代码编辑器',
        suggestion: '继续完成同步窗口',
        confidence: 0.87,
        media: { id: 'screen.png', name: 'screen.png', mimeType: 'image/png', size: 1200, url: 'http://127.0.0.1:47321/media/screen.png' },
        currentTask: { id: 'task-1', text: '完善屏幕分析同步' },
        frontmost: { app: 'Code', title: 'secret-title.md' },
        review: { ok: true, insight: '保持当前节奏' },
        time: '2026-06-23T10:02:00.000Z'
      },
      'peer-2': {
        id: 'activity-2',
        from: 'peer-2',
        status: 'distracted',
        activity: '不该给 peer-1 看到',
        time: '2026-06-23T10:03:00.000Z'
      },
      'peer-1': {
        id: 'activity-peer-self',
        from: 'peer-1',
        status: 'study',
        activity: 'peer 自己的私密活动',
        currentTask: { id: 'peer-task', text: 'peer 私密任务' },
        frontmost: { app: 'PeerSecretApp', title: 'peer-secret-title.md' },
        media: { id: 'peer-screen.png', name: 'peer-screen.png', mimeType: 'image/png', size: 1200, url: 'http://127.0.0.1:47321/media/peer-screen.png' },
        time: '2026-06-23T10:04:00.000Z'
      }
    },
    activityLog: [
      {
        id: 'activity-0',
        from: 'pet-owner',
        status: 'work',
        activity: '正在查看任务计划',
        time: '2026-06-23T09:58:00.000Z'
      },
      {
        id: 'activity-1',
        from: 'pet-owner',
        status: 'work',
        activity: '正在编辑 Focus Pet 聊天功能',
        media: { id: 'screen.png', name: 'screen.png', mimeType: 'image/png', size: 1200, url: 'http://127.0.0.1:47321/media/screen.png' },
        currentTask: { id: 'task-1', text: '完善屏幕分析同步' },
        frontmost: { app: 'Code', title: 'secret-title.md' },
        time: '2026-06-23T10:02:00.000Z'
      },
      {
        id: 'activity-2',
        from: 'peer-2',
        status: 'distracted',
        activity: '不该给 peer-1 看到',
        time: '2026-06-23T10:03:00.000Z'
      },
      {
        id: 'activity-peer-self',
        from: 'peer-1',
        status: 'study',
        activity: 'peer 自己的私密活动',
        currentTask: { id: 'peer-task', text: 'peer 私密任务' },
        frontmost: { app: 'PeerSecretApp', title: 'peer-secret-title.md' },
        media: { id: 'peer-screen.png', name: 'peer-screen.png', mimeType: 'image/png', size: 1200, url: 'http://127.0.0.1:47321/media/peer-screen.png' },
        time: '2026-06-23T10:04:00.000Z'
      }
    ],
    settings: { maxMediaMb: 25, popupCooldownMinutes: 8 }
  };
  const peerState = chatService.clientStateForAuth({ role: 'peer', peerId: 'peer-1', name: '小林' }, state, {
    port: 47321,
    settings: { socialActivityShareLevel: 'presence' }
  });
  const ownerState = chatService.clientStateForAuth(chatService.resolveAuth('owner-token', state), state, { port: 47321 });

  assert.equal(peerState.settings.socialActivityShareLevel, 'presence');
  assert.deepEqual(peerState.activities, {});
  assert.deepEqual(peerState.activityLog, []);
  assert.equal(ownerState.activities['peer-2'].activity, '不该给 peer-1 看到');
  assert.deepEqual(ownerState.activityLog.map(activity => activity.id), ['activity-0', 'activity-1', 'activity-2', 'activity-peer-self']);

  const serializedPeerState = JSON.stringify(peerState);
  assert.doesNotMatch(serializedPeerState, /正在编辑 Focus Pet 聊天功能|完善屏幕分析同步|"Code"|secret-title|screen\.png|保持当前节奏|peer 自己的私密活动|peer 私密任务|PeerSecretApp|peer-secret-title|peer-screen\.png/);
});

test('external chat handles missing owner activity across sharing levels', () => {
  const state = {
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    self: { id: 'pet-owner', name: '我' },
    friends: [{ id: 'peer-1', name: '小林', status: 'online', unread: 0 }],
    sessions: [{ token: 'peer-token', peerId: 'peer-1', name: '小林' }],
    messages: [],
    activities: {},
    activityLog: [],
    settings: { maxMediaMb: 25, popupCooldownMinutes: 8 }
  };
  const peerAuth = { role: 'peer', peerId: 'peer-1', name: '小林' };

  for (const socialActivityShareLevel of ['status', 'summary', 'screen-summary']) {
    const peerState = chatService.clientStateForAuth(peerAuth, state, {
      port: 47321,
      settings: { socialActivityShareLevel }
    });

    assert.equal(peerState.settings.socialActivityShareLevel, socialActivityShareLevel);
    assert.deepEqual(peerState.activities, {});
    assert.deepEqual(peerState.activityLog, []);
  }
});

test('external chat sanitizes peer-owned activity before returning peer state', () => {
  const peerOwnActivity = {
    id: 'peer-own-activity',
    from: 'peer-1',
    status: 'study',
    activity: 'peer 可共享学习状态',
    reason: 'peer 屏幕里有私密课程',
    suggestion: '继续学习',
    confidence: 0.74,
    sourceName: 'peer confidential source',
    message: 'peer 内部 message 提到了 PeerSecretApp 和 peer-secret-title.md',
    currentTask: { id: 'peer-task', text: 'peer 私密任务' },
    frontmost: { app: 'PeerSecretApp', title: 'peer-secret-title.md' },
    media: { id: 'peer-screen.png', name: 'peer-screen.png', mimeType: 'image/png', size: 1200, url: 'http://127.0.0.1:47321/media/peer-screen.png' },
    review: {
      ok: true,
      status: 'aligned',
      summary: 'peer 复盘完整摘要',
      insight: 'peer 学习节奏稳定',
      petMessage: 'peer 私密宠物消息',
      tone: 'calm'
    },
    time: '2026-06-23T10:05:00.000Z'
  };
  const state = {
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    self: { id: 'pet-owner', name: '我' },
    friends: [{ id: 'peer-1', name: '小林', status: 'online', unread: 0 }],
    sessions: [{ token: 'peer-token', peerId: 'peer-1', name: '小林' }],
    messages: [],
    activities: { 'peer-1': peerOwnActivity },
    activityLog: [peerOwnActivity],
    settings: { maxMediaMb: 25, popupCooldownMinutes: 8 }
  };
  const peerAuth = { role: 'peer', peerId: 'peer-1', name: '小林' };

  for (const socialActivityShareLevel of ['status', 'summary', 'screen-summary']) {
    const peerState = chatService.clientStateForAuth(peerAuth, state, {
      port: 47321,
      settings: { socialActivityShareLevel }
    });
    const serialized = JSON.stringify(peerState);
    assert.doesNotMatch(serialized, /currentTask|frontmost|sourceName|media|PeerSecretApp|peer-secret-title|peer-screen\.png|peer 私密任务|peer 内部 message|peer 复盘完整摘要|peer 私密宠物消息|calm/);
  }
});

test('external chat sanitizes WebSocket activity events for peer-owned activity', () => {
  assert.equal(typeof chatService.activityEventForAuth, 'function');
  const peerOwnActivity = {
    id: 'peer-ws-activity',
    from: 'peer-1',
    status: 'study',
    activity: 'peer WebSocket 可共享学习状态',
    reason: 'peer WebSocket 屏幕里有私密课程',
    suggestion: '继续学习',
    confidence: 0.76,
    sourceName: 'peer websocket confidential source',
    message: 'peer websocket 内部 message 提到了 PeerSecretApp 和 peer-secret-title.md',
    currentTask: { id: 'peer-task', text: 'peer websocket 私密任务' },
    frontmost: { app: 'PeerSecretApp', title: 'peer-secret-title.md' },
    media: { id: 'peer-ws-screen.png', name: 'peer-ws-screen.png', mimeType: 'image/png', size: 1200, url: 'http://127.0.0.1:47321/media/peer-ws-screen.png' },
    review: {
      ok: true,
      status: 'aligned',
      summary: 'peer websocket 复盘完整摘要',
      insight: 'peer websocket 学习节奏稳定',
      petMessage: 'peer websocket 私密宠物消息',
      tone: 'calm'
    },
    time: '2026-06-23T10:06:00.000Z'
  };
  const state = {
    self: { id: 'pet-owner', name: '我' },
    friends: [{ id: 'peer-1', name: '小林', status: 'online', unread: 0 }],
    settings: { socialActivityShareLevel: 'screen-summary' }
  };
  const peerAuth = { role: 'peer', peerId: 'peer-1', name: '小林' };
  const ownerAuth = { role: 'owner', peerId: 'pet-owner', name: '我' };

  assert.equal(chatService.activityEventForAuth(peerOwnActivity, peerAuth, state, 'presence'), null);
  const peerPayload = chatService.activityEventForAuth(peerOwnActivity, peerAuth, state, 'screen-summary');
  assert.equal(peerPayload.activity, 'peer WebSocket 可共享学习状态');
  assert.equal(peerPayload.reason, 'peer WebSocket 屏幕里有私密课程');
  assert.deepEqual(peerPayload.review, { insight: 'peer websocket 学习节奏稳定' });
  assert.doesNotMatch(JSON.stringify(peerPayload), /currentTask|frontmost|sourceName|media|PeerSecretApp|peer-secret-title|peer-ws-screen\.png|peer websocket 私密任务|peer websocket 内部 message|peer websocket 复盘完整摘要|peer websocket 私密宠物消息|calm/);

  const ownerPayload = chatService.activityEventForAuth(peerOwnActivity, ownerAuth, state, 'presence');
  assert.equal(ownerPayload.currentTask.text, 'peer websocket 私密任务');
  assert.equal(ownerPayload.frontmost.app, 'PeerSecretApp');
});

test('external chat applies social activity sharing levels before peer state exposure', () => {
  const ownerActivity = {
    id: 'activity-1',
    from: 'pet-owner',
    status: 'study',
    activity: '正在复习线性代数',
    reason: '屏幕中是课程笔记和习题',
    suggestion: '继续完成本节练习',
    confidence: 0.82,
    sourceName: '外接屏幕 - confidential deck',
    message: '私密 message 提到了完成线代错题本、Obsidian、linear-algebra-private.md 和 study-screen.png',
    media: { id: 'study-screen.png', name: 'study-screen.png', mimeType: 'image/png', size: 1200, url: 'http://127.0.0.1:47321/media/study-screen.png' },
    currentTask: { id: 'task-1', text: '完成线代错题本' },
    frontmost: { app: 'Obsidian', title: 'linear-algebra-private.md' },
    review: {
      ok: true,
      status: 'aligned',
      summary: '复盘摘要包含不该进入 peer 的长期上下文',
      insight: '学习内容和任务一致',
      petMessage: '宠物反馈里提到了当前任务和私人节奏',
      tone: 'calm'
    },
    time: '2026-06-23T10:02:00.000Z'
  };
  const peerAuth = { role: 'peer', peerId: 'peer-1', name: '小林' };
  const baseState = {
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    self: { id: 'pet-owner', name: '我' },
    friends: [{ id: 'peer-1', name: '小林', status: 'online', unread: 0 }],
    sessions: [{ token: 'peer-token', peerId: 'peer-1', name: '小林' }],
    messages: [],
    activities: { 'pet-owner': ownerActivity },
    activityLog: [ownerActivity],
    settings: { maxMediaMb: 25, popupCooldownMinutes: 8 }
  };

  assert.deepEqual(chatService.sharedActivityForLevel(ownerActivity, 'presence'), null);

  const status = chatService.sharedActivityForLevel(ownerActivity, 'status');
  assert.equal(status.status, 'study');
  assert.equal(status.message, '学习中');
  assert.equal(status.activity, undefined);
  assert.equal(status.reason, undefined);
  assert.equal(status.currentTask, undefined);
  assert.equal(status.frontmost, undefined);
  assert.equal(status.media, undefined);
  assert.equal(status.review, undefined);

  const distractedStatus = chatService.sharedActivityForLevel({ ...ownerActivity, status: 'distracted' }, 'status');
  assert.equal(distractedStatus.status, 'distracted');
  assert.equal(distractedStatus.message, '可能偏离');
  assert.doesNotMatch(fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'chat-service.js'), 'utf8'), /可能跑偏/);

  const summary = chatService.sharedActivityForLevel(ownerActivity, 'summary');
  assert.equal(summary.activity, '正在复习线性代数');
  assert.equal(summary.suggestion, '继续完成本节练习');
  assert.equal(summary.message, '正在复习线性代数');
  assert.equal(summary.sourceName, undefined);
  assert.equal(summary.reason, undefined);
  assert.equal(summary.currentTask, undefined);
  assert.equal(summary.frontmost, undefined);
  assert.equal(summary.media, undefined);
  assert.equal(summary.review, undefined);

  const screenSummaryState = chatService.clientStateForAuth(peerAuth, {
    ...baseState,
    settings: { ...baseState.settings, socialActivityShareLevel: 'screen-summary' }
  }, {
    port: 47321,
    settings: { socialActivityShareLevel: 'screen-summary' }
  });
  assert.equal(screenSummaryState.activities['pet-owner'].activity, '正在复习线性代数');
  assert.equal(screenSummaryState.activities['pet-owner'].message, '正在复习线性代数');
  assert.equal(screenSummaryState.activities['pet-owner'].sourceName, undefined);
  assert.equal(screenSummaryState.activities['pet-owner'].reason, '屏幕中是课程笔记和习题');
  assert.deepEqual(screenSummaryState.activities['pet-owner'].review, { insight: '学习内容和任务一致' });
  assert.deepEqual(screenSummaryState.activityLog.map(activity => activity.id), ['activity-1']);

  const serialized = JSON.stringify(screenSummaryState);
  assert.doesNotMatch(serialized, /私密 message|confidential deck|完成线代错题本|Obsidian|linear-algebra-private|study-screen\.png|长期上下文|私人节奏|calm/);
});

test('external chat applies social activity sharing levels to activity messages', () => {
  const ownerActivity = {
    id: 'activity-message-1',
    from: 'pet-owner',
    status: 'work',
    activity: '正在整理产品优化方案',
    reason: '屏幕中是优化方案和任务清单',
    suggestion: '先收敛社交边界',
    confidence: 0.91,
    sourceName: '主屏幕 - confidential roadmap',
    message: '内部 message 提到了 Notion、focus-pet-roadmap.md 和 roadmap-screen.png',
    media: { id: 'roadmap-screen.png', name: 'roadmap-screen.png', mimeType: 'image/png', size: 2048, url: 'http://127.0.0.1:47321/media/roadmap-screen.png' },
    currentTask: { id: 'task-roadmap', text: '重排 Focus Pet 路线图' },
    frontmost: { app: 'Notion', title: 'focus-pet-roadmap.md' },
    review: {
      ok: true,
      status: 'aligned',
      summary: '复盘全文包含内部计划上下文',
      insight: '方案整理和当前目标一致',
      petMessage: '宠物消息包含私人计划节奏',
      tone: 'calm'
    },
    time: '2026-06-30T10:20:00.000Z'
  };
  const peerActivity = {
    id: 'peer-message-activity',
    from: 'peer-1',
    status: 'study',
    activity: 'peer 消息可共享学习状态',
    reason: 'peer 消息屏幕中是课程笔记',
    suggestion: '继续学习',
    confidence: 0.79,
    sourceName: 'peer message confidential source',
    message: 'peer 消息内部 message 提到了 PeerSecretApp、peer-secret-title.md 和 peer-message-screen.png',
    media: { id: 'peer-message-screen.png', name: 'peer-message-screen.png', mimeType: 'image/png', size: 2048, url: 'http://127.0.0.1:47321/media/peer-message-screen.png' },
    currentTask: { id: 'peer-task-message', text: 'peer 消息私密任务' },
    frontmost: { app: 'PeerSecretApp', title: 'peer-secret-title.md' },
    review: {
      ok: true,
      status: 'aligned',
      summary: 'peer 消息复盘完整摘要',
      insight: 'peer 消息学习节奏稳定',
      petMessage: 'peer 消息私密宠物反馈',
      tone: 'calm'
    },
    time: '2026-06-30T10:21:00.000Z'
  };
  const state = {
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    self: { id: 'pet-owner', name: '我' },
    friends: [{ id: 'peer-1', name: '小林', status: 'online', unread: 0 }],
    sessions: [{ token: 'peer-token', peerId: 'peer-1', name: '小林' }],
    messages: [
      {
        id: 'm-activity-1',
        from: 'pet-owner',
        to: 'peer-1',
        type: 'activity',
        text: '屏幕摘要',
        activity: ownerActivity,
        createdAt: '2026-06-30T10:20:05.000Z'
      },
      {
        id: 'm-peer-activity-1',
        from: 'peer-1',
        to: 'pet-owner',
        type: 'activity',
        text: 'peer 屏幕摘要',
        activity: peerActivity,
        createdAt: '2026-06-30T10:21:05.000Z'
      }
    ],
    activities: { 'pet-owner': ownerActivity },
    activityLog: [],
    settings: { maxMediaMb: 25, popupCooldownMinutes: 8, socialActivityShareLevel: 'screen-summary' }
  };
  const peerAuth = { role: 'peer', peerId: 'peer-1', name: '小林' };
  const ownerAuth = chatService.resolveAuth('owner-token', state);
  const peerState = chatService.clientStateForAuth(peerAuth, state, {
    port: 47321,
    settings: { socialActivityShareLevel: 'screen-summary' }
  });
  const ownerState = chatService.clientStateForAuth(ownerAuth, state, {
    port: 47321,
    settings: { socialActivityShareLevel: 'screen-summary' }
  });
  const peerMessageActivity = peerState.messages[0].activity;

  assert.equal(peerMessageActivity.activity, '正在整理产品优化方案');
  assert.equal(peerMessageActivity.message, '正在整理产品优化方案');
  assert.equal(peerMessageActivity.reason, '屏幕中是优化方案和任务清单');
  assert.deepEqual(peerMessageActivity.review, { insight: '方案整理和当前目标一致' });
  assert.equal(peerMessageActivity.sourceName, undefined);
  assert.equal(peerMessageActivity.currentTask, undefined);
  assert.equal(peerMessageActivity.frontmost, undefined);
  assert.equal(peerMessageActivity.media, undefined);
  assert.equal(ownerState.messages[0].activity.currentTask.text, '重排 Focus Pet 路线图');
  assert.equal(ownerState.messages[0].activity.frontmost.app, 'Notion');
  assert.equal(ownerState.messages[1].activity.currentTask.text, 'peer 消息私密任务');
  assert.equal(ownerState.messages[1].activity.frontmost.app, 'PeerSecretApp');

  const peerOwnMessageActivity = peerState.messages[1].activity;
  assert.equal(peerOwnMessageActivity.activity, 'peer 消息可共享学习状态');
  assert.equal(peerOwnMessageActivity.reason, 'peer 消息屏幕中是课程笔记');
  assert.deepEqual(peerOwnMessageActivity.review, { insight: 'peer 消息学习节奏稳定' });
  assert.equal(peerOwnMessageActivity.sourceName, undefined);
  assert.equal(peerOwnMessageActivity.currentTask, undefined);
  assert.equal(peerOwnMessageActivity.frontmost, undefined);
  assert.equal(peerOwnMessageActivity.media, undefined);

  const presencePeerState = chatService.clientStateForAuth(peerAuth, state, {
    port: 47321,
    settings: { socialActivityShareLevel: 'presence' }
  });
  assert.equal(presencePeerState.messages[0].activity, null);
  assert.equal(presencePeerState.messages[1].activity, null);

  const serializedPeerState = JSON.stringify(peerState);
  assert.doesNotMatch(serializedPeerState, /confidential roadmap|内部 message|Notion|focus-pet-roadmap|roadmap-screen\.png|task-roadmap|复盘全文|私人计划节奏|peer message confidential|peer 消息内部 message|PeerSecretApp|peer-secret-title|peer-message-screen\.png|peer-task-message|peer 消息复盘完整摘要|peer 消息私密宠物反馈|calm/);
});

test('external chat creates scoped invite sessions without leaking owner token', () => {
  const state = {
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    self: { id: 'pet-owner', name: '我' },
    friends: [{ id: 'other-peer', name: '其他人', status: 'offline', unread: 0 }],
    sessions: [],
    messages: [
      { id: 'm1', from: 'pet-owner', to: 'peer-1', type: 'text', text: '给小林', createdAt: '2026-06-23T10:00:00.000Z' },
      { id: 'm2', from: 'other-peer', to: 'pet-owner', type: 'text', text: '不该看到', createdAt: '2026-06-23T10:01:00.000Z' }
    ],
    settings: { maxMediaMb: 25, popupCooldownMinutes: 8 }
  };

  const session = chatService.createPeerSession('JOIN-ROOM', '小林', {
    state,
    id: () => 'peer-1',
    token: () => 'peer-session-token',
    deviceId: 'device-A',
    now: () => '2026-06-23T10:02:00.000Z'
  });
  const auth = chatService.resolveAuth('peer-session-token', session.state, { deviceId: 'device-A' });
  const scoped = chatService.clientStateForAuth(auth, session.state, { port: 47321 });

  assert.equal(session.sessionToken, 'peer-session-token');
  assert.notEqual(session.sessionToken, state.authToken);
  assert.equal(auth.role, 'peer');
  assert.equal(auth.peerId, 'peer-1');
  assert.equal(scoped.authToken, undefined);
  assert.equal(scoped.self.id, 'peer-1');
  assert.deepEqual(scoped.friends.map(friend => friend.id), ['pet-owner']);
  assert.deepEqual(scoped.messages.map(message => message.id), ['m1']);
});

test('external chat binds new peer session tokens to a local device id', () => {
  const state = {
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    inviteExpiresAt: '2026-07-01T00:00:00.000Z',
    self: { id: 'pet-owner', name: '我' },
    friends: [],
    sessions: [],
    messages: [],
    settings: { maxMediaMb: 25, popupCooldownMinutes: 8 }
  };

  const session = chatService.createPeerSession('JOIN-ROOM', '小林', {
    state,
    id: () => 'peer-1',
    token: () => 'peer-session-token',
    deviceId: 'device-A',
    now: () => '2026-06-30T10:00:00.000Z'
  });
  const storedSession = session.state.sessions.find(item => item.token === 'peer-session-token');

  assert.equal(session.deviceId, 'device-A');
  assert.equal(storedSession.deviceId, undefined);
  assert.match(storedSession.deviceIdHash, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(storedSession), /device-A/);
  assert.equal(chatService.resolveAuth('peer-session-token', session.state, { deviceId: 'device-A' }).peerId, 'peer-1');
  assert.equal(chatService.resolveAuth('peer-session-token', session.state, { deviceId: 'device-B' }), null);
  assert.equal(chatService.resolveAuth('peer-session-token', session.state), null);
  assert.equal(chatService.resolveAuth('owner-token', session.state).role, 'owner');
});

test('external chat revokes peer sessions without deleting friends or messages', () => {
  const state = {
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    self: { id: 'pet-owner', name: '我' },
    friends: [
      { id: 'peer-1', name: '小林', status: 'online', unread: 2 },
      { id: 'peer-2', name: '小周', status: 'online', unread: 0 }
    ],
    sessions: [
      { token: 'peer-1-token-a', peerId: 'peer-1', name: '小林', createdAt: '2026-06-30T09:00:00.000Z', expiresAt: '2026-07-30T09:00:00.000Z', deviceIdHash: crypto.createHash('sha256').update('device-A').digest('hex') },
      { token: 'peer-1-token-b', peerId: 'peer-1', name: '小林', createdAt: '2026-06-30T09:05:00.000Z', expiresAt: '2026-07-30T09:05:00.000Z', deviceIdHash: crypto.createHash('sha256').update('device-B').digest('hex') },
      { token: 'peer-2-token', peerId: 'peer-2', name: '小周', createdAt: '2026-06-30T09:10:00.000Z', expiresAt: '2026-07-30T09:10:00.000Z', deviceIdHash: crypto.createHash('sha256').update('device-C').digest('hex') }
    ],
    messages: [
      { id: 'm1', from: 'peer-1', to: 'pet-owner', type: 'text', text: '保留聊天', createdAt: '2026-06-30T10:00:00.000Z' },
      { id: 'm2', from: 'pet-owner', to: 'peer-2', type: 'text', text: '也保留', createdAt: '2026-06-30T10:01:00.000Z' }
    ],
    settings: { maxMediaMb: 25, popupCooldownMinutes: 8 }
  };

  const result = chatService.revokePeerSessions('peer-1', { state });

  assert.equal(result.ok, true);
  assert.equal(result.revokedSessions, 2);
  assert.deepEqual(result.state.sessions.map(session => session.token), ['peer-2-token']);
  assert.deepEqual(result.state.friends.map(friend => friend.id), ['peer-1', 'peer-2']);
  assert.equal(result.state.friends.find(friend => friend.id === 'peer-1').status, 'offline');
  assert.deepEqual(result.state.messages.map(message => message.id), ['m1', 'm2']);
  assert.equal(chatService.resolveAuth('peer-1-token-a', result.state, { deviceId: 'device-A' }), null);
  assert.equal(chatService.resolveAuth('peer-2-token', result.state, { deviceId: 'device-C' }).peerId, 'peer-2');
});

test('external chat scopes mark-read permissions for peers', () => {
  assert.equal(typeof chatService.markReadForAuth, 'function');
  const state = {
    self: { id: 'pet-owner', name: '我' },
    friends: [
      { id: 'peer-1', name: '小林', status: 'online', unread: 2 },
      { id: 'peer-2', name: '小周', status: 'online', unread: 3 }
    ],
    messages: [
      { id: 'owner-to-peer-1', from: 'pet-owner', to: 'peer-1', text: '给 peer-1', deliveryStatus: 'delivered' },
      { id: 'peer-1-to-owner', from: 'peer-1', to: 'pet-owner', text: 'peer-1 给 owner', deliveryStatus: 'delivered' },
      { id: 'peer-2-to-owner', from: 'peer-2', to: 'pet-owner', text: 'peer-2 给 owner', deliveryStatus: 'delivered' }
    ]
  };
  const peerAuth = { role: 'peer', peerId: 'peer-1', name: '小林' };
  const ownerAuth = { role: 'owner', peerId: 'pet-owner', name: '我' };

  const forbidden = chatService.markReadForAuth('peer-2', { state, auth: peerAuth, now: () => '2026-06-30T11:00:00.000Z' });
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.error, 'forbidden');
  assert.equal(forbidden.state.friends.find(friend => friend.id === 'peer-2').unread, 3);
  assert.equal(forbidden.state.messages.find(message => message.id === 'peer-2-to-owner').deliveryStatus, 'delivered');

  const peerReadOwner = chatService.markReadForAuth('pet-owner', { state, auth: peerAuth, now: () => '2026-06-30T11:01:00.000Z' });
  assert.equal(peerReadOwner.ok, true);
  assert.equal(peerReadOwner.friend, null);
  assert.equal(peerReadOwner.state.friends.find(friend => friend.id === 'peer-1').unread, 2);
  assert.equal(peerReadOwner.state.messages.find(message => message.id === 'owner-to-peer-1').deliveryStatus, 'read');
  assert.equal(peerReadOwner.state.messages.find(message => message.id === 'owner-to-peer-1').readAt, '2026-06-30T11:01:00.000Z');
  assert.equal(peerReadOwner.state.messages.find(message => message.id === 'peer-1-to-owner').deliveryStatus, 'delivered');

  const ownerReadPeer = chatService.markReadForAuth('peer-1', { state, auth: ownerAuth, now: () => '2026-06-30T11:02:00.000Z' });
  assert.equal(ownerReadPeer.ok, true);
  assert.equal(ownerReadPeer.friend.unread, 0);
  assert.equal(ownerReadPeer.state.messages.find(message => message.id === 'peer-1-to-owner').deliveryStatus, 'read');

  const source = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'chat-service.js'), 'utf8');
  assert.match(source, /markRead\(body\.friendId,\s*\{\s*auth\s*\}\)/);
  assert.match(source, /markRead\(input\.friendId,\s*\{\s*auth\s*\}\)/);
});

test('external chat state carries a schema version through session normalization', () => {
  const state = {
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    inviteExpiresAt: '2026-07-01T00:00:00.000Z',
    self: { id: 'pet-owner', name: '我' },
    friends: [],
    sessions: [],
    messages: [],
    settings: { maxMediaMb: 25, popupCooldownMinutes: 8 }
  };

  const session = chatService.createPeerSession('JOIN-ROOM', '小林', {
    state,
    id: () => 'peer-1',
    token: () => 'peer-session-token',
    deviceId: 'device-A',
    now: () => '2026-06-30T10:00:00.000Z'
  });
  const scoped = chatService.clientStateForAuth(
    chatService.resolveAuth('peer-session-token', session.state, { deviceId: 'device-A', now: () => '2026-06-30T10:00:00.000Z' }),
    session.state,
    { port: 47321 }
  );

  assert.equal(session.state.version, 1);
  assert.equal(scoped.version, 1);
});

test('external chat expires invite codes and peer session tokens', () => {
  const state = {
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    inviteExpiresAt: '2026-07-01T00:00:00.000Z',
    self: { id: 'pet-owner', name: '我' },
    friends: [
      { id: 'peer-valid', name: '有效搭子', status: 'offline', unread: 0 },
      { id: 'peer-expired', name: '过期搭子', status: 'offline', unread: 0 }
    ],
    sessions: [
      { token: 'valid-peer-token', peerId: 'peer-valid', name: '有效搭子', createdAt: '2026-06-29T00:00:00.000Z', expiresAt: '2026-07-30T00:00:00.000Z' },
      { token: 'expired-peer-token', peerId: 'peer-expired', name: '过期搭子', createdAt: '2026-05-01T00:00:00.000Z', expiresAt: '2026-06-01T00:00:00.000Z' }
    ],
    messages: [],
    settings: { maxMediaMb: 25, popupCooldownMinutes: 8 }
  };

  assert.equal(chatService.resolveAuth('expired-peer-token', state, { now: () => '2026-06-30T12:00:00.000Z' }), null);
  assert.equal(chatService.resolveAuth('valid-peer-token', state, { now: () => '2026-06-30T12:00:00.000Z' }).peerId, 'peer-valid');

  assert.throws(() => chatService.createPeerSession('JOIN-ROOM', '小林', {
    state: { ...state, inviteExpiresAt: '2026-06-29T23:59:59.000Z' },
    now: () => '2026-06-30T12:00:00.000Z',
    id: () => 'peer-new',
    token: () => 'new-peer-token'
  }), /邀请码已过期/);

  const session = chatService.createPeerSession('JOIN-ROOM', '小林', {
    state,
    now: () => '2026-06-30T12:00:00.000Z',
    id: () => 'peer-new',
    token: () => 'new-peer-token'
  });

  assert.equal(session.sessionToken, 'new-peer-token');
  assert.equal(session.state.sessions.find(item => item.token === 'new-peer-token').expiresAt, '2026-07-30T12:00:00.000Z');
});

test('external chat rate limits repeated invalid invite attempts by source', () => {
  const state = {
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    inviteExpiresAt: '2026-07-01T00:00:00.000Z',
    self: { id: 'pet-owner', name: '我' },
    friends: [],
    sessions: [],
    messages: [],
    settings: { maxMediaMb: 25, popupCooldownMinutes: 8 }
  };
  const options = {
    state,
    inviteAttemptKey: 'ip:192.168.1.9',
    now: () => '2026-06-30T12:00:00.000Z',
    id: () => 'peer-new',
    token: () => 'new-peer-token'
  };

  for (let index = 0; index < 5; index += 1) {
    assert.throws(() => chatService.createPeerSession('WRONG-CODE', '小林', options), /邀请码无效/);
  }
  assert.throws(() => chatService.createPeerSession('JOIN-ROOM', '小林', options), /邀请码尝试过多/);

  const otherSource = chatService.createPeerSession('JOIN-ROOM', '小林', {
    ...options,
    inviteAttemptKey: 'ip:192.168.1.10'
  });
  assert.equal(otherSource.sessionToken, 'new-peer-token');

  const afterWindow = chatService.createPeerSession('JOIN-ROOM', '小林', {
    ...options,
    now: () => '2026-06-30T12:11:00.000Z'
  });
  assert.equal(afterWindow.sessionToken, 'new-peer-token');
});

test('external chat persists invalid invite attempts without storing raw source keys', () => {
  const state = {
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    inviteExpiresAt: '2026-07-01T00:00:00.000Z',
    self: { id: 'pet-owner', name: '我' },
    friends: [],
    sessions: [],
    messages: [],
    settings: { maxMediaMb: 25, popupCooldownMinutes: 8 }
  };
  const options = {
    state,
    inviteAttemptKey: 'ip:198.51.100.12',
    now: () => '2026-06-30T12:00:00.000Z',
    id: () => 'peer-new',
    token: () => 'new-peer-token'
  };

  for (let index = 0; index < 5; index += 1) {
    assert.throws(() => chatService.createPeerSession('WRONG-CODE', '小林', options), /邀请码无效/);
  }

  const persistedAttempts = JSON.parse(JSON.stringify(state.inviteAttempts));
  assert.equal(Object.keys(persistedAttempts).length, 1);
  assert.doesNotMatch(JSON.stringify(persistedAttempts), /198\.51\.100\.12/);

  assert.throws(() => chatService.createPeerSession('JOIN-ROOM', '小林', {
    ...options,
    state: { ...state, inviteAttempts: persistedAttempts },
    now: () => '2026-06-30T12:05:00.000Z'
  }), /邀请码尝试过多/);

  const afterWindow = chatService.createPeerSession('JOIN-ROOM', '小林', {
    ...options,
    state: { ...state, inviteAttempts: persistedAttempts },
    now: () => '2026-06-30T12:11:00.000Z'
  });
  assert.equal(afterWindow.sessionToken, 'new-peer-token');
  assert.deepEqual(afterWindow.state.inviteAttempts, {});
});

test('external chat invite attempt source only trusts forwarded address when proxy trust is enabled', () => {
  const request = {
    headers: { 'x-forwarded-for': '203.0.113.10, 198.51.100.7' },
    socket: { remoteAddress: '192.168.1.9' }
  };

  assert.equal(chatService.inviteAttemptKeyFromRequest(request, { env: {} }), 'ip:192.168.1.9');
  assert.equal(
    chatService.inviteAttemptKeyFromRequest(request, { env: { FOCUS_PET_CHAT_TRUST_PROXY: 'true' } }),
    'ip:203.0.113.10'
  );
});

test('external chat validates browser origins before writing CORS headers', () => {
  const sameOriginReq = {
    headers: { origin: 'http://127.0.0.1:47321', host: '127.0.0.1:47321' },
    socket: { encrypted: false }
  };
  const configuredReq = {
    headers: { origin: 'https://focus.example', host: '127.0.0.1:47321' },
    socket: { encrypted: false }
  };
  const evilReq = {
    headers: { origin: 'https://evil.example', host: '127.0.0.1:47321' },
    socket: { encrypted: false }
  };

  assert.equal(chatService.isAllowedRequestOrigin({ headers: {}, socket: {} }), true);
  assert.equal(chatService.isAllowedRequestOrigin(sameOriginReq), true);
  assert.equal(chatService.isAllowedRequestOrigin(configuredReq, { allowedOrigins: ['https://focus.example'] }), true);
  assert.equal(chatService.isAllowedRequestOrigin(evilReq), false);

  const cors = chatService.corsHeaders(sameOriginReq);
  assert.equal(cors['access-control-allow-origin'], 'http://127.0.0.1:47321');
  assert.equal(cors.vary, 'Origin');
  assert.notEqual(cors['access-control-allow-origin'], '*');
});

test('external chat health reports WebSocket origin policy without leaking allowed origins', () => {
  const env = {
    FOCUS_PET_CHAT_ALLOWED_ORIGINS: 'https://focus.example,https://secret-chat.example'
  };
  const health = chatService.healthState({ env });

  assert.equal(health.websocket.enabled, true);
  assert.equal(health.websocket.clients, health.clients);
  assert.equal(health.websocket.originPolicy, 'same-origin-plus-configured');
  assert.equal(health.websocket.allowedOriginsConfigured, true);
  assert.equal(health.websocket.configuredAllowedOriginCount, 2);
  assert.equal(health.websocket.acceptsNoOrigin, true);
  assert.equal(health.websocket.allowsFileOrigin, true);
  assert.equal(health.websocket.corsWildcard, false);

  const serialized = JSON.stringify(health);
  assert.doesNotMatch(serialized, /focus\.example|secret-chat\.example/);
});

test('external chat advertises device-reachable URLs for another device', () => {
  const state = {
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    self: { id: 'pet-owner', name: '我' },
    friends: [{ id: 'peer-1', name: '小林', status: 'offline', unread: 0 }],
    sessions: [],
    messages: [],
    settings: { maxMediaMb: 25, popupCooldownMinutes: 8 }
  };
  const ownerState = chatService.clientStateForAuth(
    { role: 'owner', peerId: 'pet-owner', name: '我', token: 'owner-token' },
    state,
    { port: 47321, publicUrl: 'http://192.168.1.8:47321' }
  );
  const source = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'chat-service.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'renderer.js'), 'utf8');

  assert.equal(ownerState.publicUrl, 'http://192.168.1.8:47321');
  assert.equal(ownerState.inviteUrl, 'http://192.168.1.8:47321/client?invite=JOIN-ROOM');
  assert.match(source, /const DEFAULT_HOST = process\.env\.FOCUS_PET_CHAT_HOST \|\| '0\.0\.0\.0'/);
  assert.match(source, /process\.env\.PORT/);
  assert.match(source, /FOCUS_PET_CHAT_DATA_DIR/);
  assert.match(source, /function localNetworkAddress/);
  assert.match(source, /requestPublicBaseUrl\(req\)/);
  assert.match(source, /\/healthz/);
  assert.match(source, /saveMedia\(await parseJson\(req\), \{ publicUrl: requestPublicBaseUrl\(req\) \}\)/);
  assert.doesNotMatch(source, /url: `http:\/\/127\.0\.0\.1:\$\{port\}\/media\/\$\{mediaId\}`/);
  assert.match(renderer, /url\.hostname = '127\.0\.0\.1'/);
});

test('chat media upload accepts common document and archive attachments', () => {
  const savedIds = [];
  try {
    const pdf = chatService.saveMedia({
      name: 'focus-plan.pdf',
      mimeType: 'application/pdf',
      data: Buffer.from('%PDF').toString('base64')
    }, { publicUrl: 'http://127.0.0.1:47321' });
    savedIds.push(pdf.id);

    assert.equal(pdf.name, 'focus-plan.pdf');
    assert.equal(pdf.mimeType, 'application/pdf');
    assert.equal(pdf.size, 4);
    assert.match(pdf.id, /\.pdf$/);
    assert.match(pdf.url, /^http:\/\/127\.0\.0\.1:47321\/media\/.+\.pdf$/);

    const zip = chatService.saveMedia({
      name: 'archive.zip',
      mimeType: 'application/zip',
      data: Buffer.from('PK\x03\x04').toString('base64')
    }, { publicUrl: 'http://127.0.0.1:47321' });
    savedIds.push(zip.id);

    assert.equal(zip.name, 'archive.zip');
    assert.equal(zip.mimeType, 'application/zip');
    assert.match(zip.id, /\.zip$/);

    const nestedName = chatService.saveMedia({
      name: '../reports/focus-plan.pdf',
      mimeType: 'application/pdf',
      data: Buffer.from('%PDF').toString('base64')
    }, { publicUrl: 'http://127.0.0.1:47321' });
    savedIds.push(nestedName.id);
    assert.equal(nestedName.name, 'focus-plan.pdf');
    assert.doesNotMatch(nestedName.name, /[\\/]/);

    const boundedPath = chatService.safeMediaPath('../chat-state.json');
    assert.equal(path.dirname(boundedPath), chatService.MEDIA_DIR);

    assert.throws(() => chatService.saveMedia({
      name: 'installer.exe',
      mimeType: 'application/x-msdownload',
      data: Buffer.from('MZ').toString('base64')
    }), /仅支持图片、视频、音频和常见文件/);

    assert.throws(() => chatService.saveMedia({
      name: 'renamed.pdf',
      mimeType: 'application/pdf',
      data: Buffer.from('MZfake executable').toString('base64')
    }), /文件内容与声明类型不匹配|不支持的文件内容/);
  } finally {
    for (const id of savedIds) {
      fs.rmSync(path.join(chatService.MEDIA_DIR, id), { force: true });
    }
  }
});

test('external chat has a Node-only deployment entrypoint for cloud hosts', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  const runner = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts', 'run-chat-service.js'), 'utf8');

  assert.equal(packageJson.scripts['chat:serve'], 'node scripts/run-chat-service.js');
  assert.match(packageJson.scripts.check, /scripts\/run-chat-service\.js/);
  assert.match(runner, /chatService\.start\(\)/);
  assert.match(runner, /chatService\.ready\(\)/);
  assert.match(runner, /SIGTERM/);
  assert.match(runner, /publicState\(\)/);
  assert.match(runner, /hasInviteUrl/);
  assert.match(runner, /const \{ sanitizeLogText \} = require\('\.\.\/src\/runtime-logger'\)/);
  assert.match(runner, /function printStartupError\(error\)/);
  assert.match(runner, /console\.error\(sanitizeLogText\(error\?\.stack \|\| error\?\.message \|\| error\)\)/);
  assert.doesNotMatch(runner, /inviteUrl\s*:/);
  assert.doesNotMatch(runner, /console\.error\(error(?:\?|\.)/);
  assert.doesNotMatch(runner, /run-electron|Electron\.app/);
});

test('remote client mac packaging wraps the deployed HTTPS client', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  const packager = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts', 'package-remote-client-macos.js'), 'utf8');

  assert.equal(packageJson.scripts['package:mac:remote-client'], 'node scripts/package-remote-client-macos.js');
  assert.match(packager, /REMOTE_CLIENT_URL/);
  assert.match(packager, /if \(require\.main === module\)/);
  assert.match(packager, /parsed\.protocol !== 'https:'/);
  assert.match(packager, /parsed\.pathname !== '\/client'/);
  assert.match(packager, /!parsed\.pathname\.startsWith\('\/client\/'\)/);
  assert.match(packager, /mainWindow\.loadURL\(config\.clientUrl\)/);
  assert.match(packager, /setPermissionRequestHandler/);
  assert.match(packager, /const requestingOrigin = new URL\(requestingUrl\)\.origin/);
  assert.match(packager, /requestingOrigin === allowedOrigin/);
  assert.doesNotMatch(packager, /requestingUrl\.startsWith\(allowedOrigin\)/);
  assert.match(packager, /function isSafeExternalUrl\(url\)/);
  assert.match(packager, /\['http:', 'https:'\]\.includes\(parsed\.protocol\)/);
  assert.match(packager, /function isAllowedClientUrl\(url\)/);
  assert.match(packager, /target\.origin === allowed\.origin/);
  assert.match(packager, /target\.pathname === '\/client' \|\| target\.pathname\.startsWith\('\/client\/'\)/);
  assert.match(packager, /if \(isSafeExternalUrl\(url\)\) shell\.openExternal\(url\)/);
  assert.match(packager, /if \(isSafeExternalUrl\(event\.url\)\) shell\.openExternal\(event\.url\)/);
  assert.doesNotMatch(packager, /\n\s*shell\.openExternal\(url\);\n\s*return \{ action: 'deny' \}/);
  assert.doesNotMatch(packager, /chatService\.start\(\)/);

  const { assertHttpsClientUrl } = require('../scripts/package-remote-client-macos');
  assert.equal(assertHttpsClientUrl('https://example.com/client'), 'https://example.com/client');
  assert.equal(assertHttpsClientUrl('https://example.com/client/invite?code=abc'), 'https://example.com/client/invite?code=abc');
  assert.throws(() => assertHttpsClientUrl('http://example.com/client'), /HTTPS/);
  assert.throws(() => assertHttpsClientUrl('https://example.com/client-evil'), /\/client/);
});

test('external chat exposes WebRTC signaling and ICE configuration', () => {
  const state = {
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    self: { id: 'pet-owner', name: '我' },
    friends: [{ id: 'peer-1', name: '小林', status: 'online', unread: 0 }],
    sessions: [{ token: 'peer-token', peerId: 'peer-1', name: '小林' }],
    messages: []
  };
  const auth = { role: 'peer', peerId: 'peer-1', name: '小林' };
  const event = chatService.normalizeRealtimeEvent({
    type: 'rtc-offer',
    to: 'pet-owner',
    callId: 'call-1',
    mode: 'video',
    sdp: { type: 'offer', sdp: 'v=0' }
  }, auth, state);
  const iceServers = chatService.rtcIceServers({
    FOCUS_PET_RTC_ICE_SERVERS: JSON.stringify([{ urls: 'turn:turn.example.com', username: 'u', credential: 'p' }])
  });

  assert.equal(event.event, 'rtc-offer');
  assert.equal(event.payload.from, 'peer-1');
  assert.equal(event.payload.to, 'pet-owner');
  assert.equal(event.payload.callId, 'call-1');
  assert.equal(event.payload.mode, 'video');
  assert.deepEqual(iceServers, [{ urls: 'turn:turn.example.com', username: 'u', credential: 'p' }]);
});

test('external chat reports TURN readiness without leaking ICE credentials', () => {
  const defaultSummary = chatService.rtcIceServerSummary({});
  assert.equal(defaultSummary.configured, false);
  assert.equal(defaultSummary.usingDefault, true);
  assert.equal(defaultSummary.hasStun, true);
  assert.equal(defaultSummary.hasTurn, false);
  assert.equal(defaultSummary.requiresTurn, true);
  assert.match(defaultSummary.guidance, /FOCUS_PET_RTC_ICE_SERVERS/);

  const env = {
    FOCUS_PET_RTC_ICE_SERVERS: JSON.stringify([
      {
        urls: ['turn:turn.example.com?transport=tcp', 'stun:stun.example.com'],
        username: 'secret-user-1234567890',
        credential: 'secret-pass-1234567890'
      }
    ])
  };
  const turnSummary = chatService.rtcIceServerSummary(env);
  const health = chatService.healthState({ env });

  assert.equal(turnSummary.configured, true);
  assert.equal(turnSummary.usingDefault, false);
  assert.equal(turnSummary.serverCount, 2);
  assert.equal(turnSummary.stunCount, 1);
  assert.equal(turnSummary.turnCount, 1);
  assert.equal(turnSummary.hasTurn, true);
  assert.equal(turnSummary.requiresTurn, false);
  assert.equal(health.rtc.hasTurn, true);
  assert.equal(health.rtc.turnCount, 1);

  const serialized = JSON.stringify({ turnSummary, health });
  assert.doesNotMatch(serialized, /turn\.example\.com|stun\.example\.com|secret-user|secret-pass/);
});

test('external chat records call lifecycle audit without storing SDP or ICE details', () => {
  const state = {
    authToken: 'owner-token',
    inviteCode: 'JOIN-ROOM',
    self: { id: 'pet-owner', name: '我' },
    friends: [{ id: 'peer-1', name: '小林', status: 'online', unread: 0 }],
    sessions: [{ token: 'peer-token', peerId: 'peer-1', name: '小林' }],
    messages: [],
    callAuditLog: []
  };
  const ownerAuth = { role: 'owner', peerId: 'pet-owner', name: '我' };
  const peerAuth = { role: 'peer', peerId: 'peer-1', name: '小林' };
  const offer = chatService.normalizeRealtimeEvent({
    type: 'rtc-offer',
    to: 'peer-1',
    callId: 'call-1',
    mode: 'video',
    sdp: { type: 'offer', sdp: 'v=0 secret-sdp-body' },
    candidate: { candidate: 'candidate:secret-ice-address turn.example.com secret-pass' }
  }, ownerAuth, state);
  const started = chatService.recordRealtimeAudit(offer, 1, {
    state,
    now: () => '2026-06-30T12:00:00.000Z'
  });
  const endedEvent = chatService.normalizeRealtimeEvent({
    type: 'call-end',
    callId: 'call-1',
    mode: 'video'
  }, peerAuth, started.state);
  const ended = chatService.recordRealtimeAudit(endedEvent, 0, {
    state: started.state,
    now: () => '2026-06-30T12:02:00.000Z'
  });

  assert.equal(started.entry.event, 'rtc-offer');
  assert.equal(started.entry.from, 'pet-owner');
  assert.equal(started.entry.to, 'peer-1');
  assert.equal(started.entry.mode, 'video');
  assert.equal(started.entry.delivered, true);
  assert.equal(started.entry.recipientClientCount, 1);
  assert.equal(ended.entry.event, 'call-end');
  assert.equal(ended.entry.delivered, false);
  assert.equal(ended.state.callAuditLog.length, 2);

  const serialized = JSON.stringify(ended.state.callAuditLog);
  assert.doesNotMatch(serialized, /secret-sdp-body|candidate:secret|turn\.example\.com|secret-pass|\"sdp\"|\"candidate\"/);
});

test('remote social client supports invite onboarding, messaging, and WebRTC calls', () => {
  const chatService = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'chat-service.js'), 'utf8');

  assert.doesNotMatch(chatService, /<header class="topbar"/);
  assert.doesNotMatch(chatService, /<strong>\'\+\(m\.from===\'remote-friend\'\?\'我\':m\.from\)\+\'<\/strong>/);
  assert.match(chatService, /id="joinInvite"/);
  assert.match(chatService, /id="joinName"/);
  assert.match(chatService, /focusPetChatDeviceId/);
  assert.match(chatService, /function ensureDeviceId/);
  assert.match(chatService, /x-focus-pet-device-id/);
  assert.match(chatService, /id="sendText"/);
  assert.match(chatService, /id="pickImage"/);
  assert.doesNotMatch(chatService, /id="pickVideo"/);
  assert.match(chatService, /id="pickFile"/);
  assert.match(chatService, />语音消息<\/button>/);
  assert.match(chatService, /FILE_ACCEPT/);
  assert.match(chatService, /className='file-card'/);
  assert.match(chatService, /id="activity"/);
  assert.match(chatService, /id="activityImage"/);
  assert.match(chatService, /id="activityLog"/);
  assert.match(chatService, /<aside class="sidebar">[\s\S]*<h2>好友<\/h2>[\s\S]*<div id="friends"><\/div>[\s\S]*<\/aside>/);
  assert.match(chatService, /<div id="messages" class="messages"><\/div>/);
  assert.match(chatService, /id="callAudio"/);
  assert.match(chatService, /id="callVideo"/);
  assert.match(chatService, /id="rtcNotice"/);
  assert.match(chatService, /id="rtcContinue"/);
  assert.match(chatService, /id="rtcCancel"/);
  assert.match(chatService, /id="localVideo"/);
  assert.match(chatService, /id="remoteVideo"/);
  assert.match(chatService, /RTCPeerConnection/);
  assert.match(chatService, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(chatService, /requireMediaCapture/);
  assert.match(chatService, /HTTPS 或 localhost/);
  assert.match(chatService, /RTC_NOTICE_KEY/);
  assert.match(chatService, /WebRTC 通话可能向通话对方暴露网络地址/);
  assert.match(chatService, /function rtcNoticeAccepted/);
  assert.match(chatService, /function showRtcNotice/);
  assert.match(chatService, /async function continueRtcNotice/);
  assert.match(chatService, /async function startCall\(mode\)\{if\(!rtcNoticeAccepted\(\)\)/);
  assert.match(chatService, /async function incomingInvite\(payload\)\{if\(!rtcNoticeAccepted\(\)\)/);
  assert.match(chatService, /async function handleOffer\(payload\)\{if\(!rtcNoticeAccepted\(\)\)/);
  assert.match(chatService, /let ws;let pingTimer;/);
  assert.match(chatService, /deviceId:ensureDeviceId\(\)/);
  assert.match(chatService, /\+'\&deviceId='\+encodeURIComponent\(ensureDeviceId\(\)\)/);
  assert.match(chatService, /media\.url\.includes\('\?'\)\?'\&':'\?'\)\+'token='\+encodeURIComponent\(token\)\+'\&deviceId='\+encodeURIComponent\(ensureDeviceId\(\)\)/);
  assert.match(chatService, /clearInterval\(pingTimer\)/);
  assert.match(chatService, /call-invite/);
  assert.match(chatService, /正在自动接通/);
  assert.match(chatService, /call-reject/);
  assert.match(chatService, /rtc-offer/);
  assert.match(chatService, /rtc-ice/);
  assert.match(chatService, /d\.event===['"]activity['"]/);
  assert.match(chatService, /sessions\/revoke/);
  assert.match(chatService, /activityLog/);
  assert.match(chatService, /renderActivity/);
  assert.doesNotMatch(chatService, /activity\.currentTask/);
  assert.doesNotMatch(chatService, /activity\.frontmost/);
  assert.doesNotMatch(chatService, /mediaSrc\(activity\.media\)/);
  assert.doesNotMatch(chatService, /confirm\(/);
});

test('desktop chat UI keeps a minimal toolbar with hidden media and WebRTC support', () => {
  const indexHtml = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'styles.css'), 'utf8');
  const renderer = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'renderer.js'), 'utf8');
  const main = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'preload.js'), 'utf8');

  assert.match(indexHtml, /id="chatInput"/);
  assert.match(indexHtml, /id="sendChat"/);
  assert.match(indexHtml, /id="revokeSessionButton"/);
  assert.match(indexHtml, /id="voiceModeButton"/);
  assert.match(indexHtml, /id="voiceRecordButton"[^>]*>按住说话<\/button>/);
  assert.match(indexHtml, /id="textModeButton"/);
  assert.match(indexHtml, /id="settingVoiceShortcut"/);
  assert.match(indexHtml, /id="imageButton"/);
  assert.doesNotMatch(indexHtml, /id="videoButton"/);
  assert.match(indexHtml, /id="fileButton"/);
  assert.match(indexHtml, /id="mediaInput"[^>]+accept="[^"]*\.pdf[^"]*\.zip/);
  assert.match(indexHtml, /id="peerActivity"/);
  assert.match(indexHtml, /id="peerActivityImage"/);
  assert.match(indexHtml, /id="peerActivityLog"/);
  assert.match(indexHtml, /id="chatCallAudio"/);
  assert.match(indexHtml, /id="chatCallVideo"/);
  assert.match(indexHtml, /id="chatCallEnd"/);
  assert.match(indexHtml, /id="chatRtcNotice"/);
  assert.match(indexHtml, /id="chatRtcContinue"/);
  assert.match(indexHtml, /id="chatRtcCancel"/);
  assert.match(indexHtml, /id="localCallVideo"/);
  assert.match(indexHtml, /id="remoteCallVideo"/);
  assert.doesNotMatch(styles, /\.chat-compose\s*\{[^}]*display:\s*none/);
  assert.match(styles, /\.chat-tools\s*\{[\s\S]*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(styles, /#chatCallAudio,\s*#chatCallVideo\s*\{[\s\S]*display:\s*none/);
  assert.match(styles, /\.chat-voice-record/);
  assert.match(styles, /\.chat-compose\[data-mode="voice"\]/);
  assert.match(styles, /\.chat-file-card/);
  assert.match(styles, /\.chat-call-stage/);
  assert.match(styles, /\.chat-rtc-notice/);
  assert.match(styles, /\.peer-activity/);
  assert.match(styles, /\.peer-activity-log/);
  assert.match(renderer, /window\.focusPet\.markRead/);
  assert.match(preload, /revokePeerSession: friendId => ipcRenderer\.invoke\('chat:revoke-peer-session', friendId\)/);
  assert.match(main, /chat:revoke-peer-session/);
  assert.match(renderer, /const revokeSessionButton = document\.querySelector\('#revokeSessionButton'\)/);
  assert.match(renderer, /async function revokeSelectedPeerSession\(\)/);
  assert.match(renderer, /window\.focusPet\.revokePeerSession\(friendSelect\.value\)/);
  assert.match(renderer, /revokeSessionButton\.addEventListener\('click', \(\) => revokeSelectedPeerSession\(\)/);
  assert.match(renderer, /renderPeerActivity/);
  assert.match(renderer, /selectedPeerActivityLog/);
  assert.match(renderer, /if \(status === 'distracted'\) return '可能偏离';/);
  assert.doesNotMatch(renderer, /可能跑偏/);
  assert.doesNotMatch(renderer, /activity\.currentTask/);
  assert.doesNotMatch(renderer, /activity\.frontmost/);
  assert.doesNotMatch(renderer, /mediaUrl\(activity\.media\)/);
  assert.match(renderer, /data\.event === 'activity'/);
  assert.match(renderer, /new RTCPeerConnection/);
  assert.match(renderer, /navigator\.mediaDevices\.getUserMedia/);
  assert.match(renderer, /RTC_NETWORK_NOTICE_KEY/);
  assert.match(renderer, /function chatRtcNoticeAccepted/);
  assert.match(renderer, /function showChatRtcNotice/);
  assert.match(renderer, /async function continueChatRtcNotice/);
  assert.match(renderer, /async function requestChatCall\(mode\)/);
  assert.match(renderer, /startChatCall\(mode\)/);
  assert.match(renderer, /handleChatRealtime\(event, payload = \{\}\)[\s\S]*if \(!chatRtcNoticeAccepted\(\)\)/);
  assert.match(renderer, /chatCallAudio\.addEventListener\('click', \(\) => requestChatCall\('audio'\)/);
  assert.match(renderer, /chatCallVideo\.addEventListener\('click', \(\) => requestChatCall\('video'\)/);
  assert.match(renderer, /CHAT_FILE_ACCEPT/);
  assert.match(renderer, /function attachmentTypeForFile/);
  assert.match(renderer, /function renderFileCard/);
  assert.match(renderer, /function setVoiceComposeMode/);
  assert.match(renderer, /function startVoiceRecording/);
  assert.match(renderer, /function stopVoiceRecording/);
  assert.match(renderer, /voiceRecordShortcut/);
  assert.match(renderer, /settingControls\.voiceRecordShortcut/);
  assert.match(renderer, /function eventMatchesVoiceShortcut/);
  assert.match(renderer, /function handleVoiceShortcutKeydown/);
  assert.match(renderer, /document\.addEventListener\('keydown', handleVoiceShortcutKeydown\)/);
  assert.match(renderer, /document\.addEventListener\('keyup', handleVoiceShortcutKeyup\)/);
  assert.match(renderer, /voiceRecordButton\.addEventListener\('pointerdown'/);
  assert.match(renderer, /call-invite/);
  assert.match(renderer, /正在自动接通/);
  assert.match(renderer, /call-reject/);
  assert.match(renderer, /rtc-offer/);
  assert.match(renderer, /rtc-answer/);
  assert.match(renderer, /rtc-ice/);
  assert.doesNotMatch(renderer, /confirm\(/);
  assert.match(main, /setPermissionRequestHandler/);
  assert.match(main, /192\\.168/);
  assert.match(main, /publishScreenActivity/);
  assert.match(main, /publishActivitySnapshot/);
});

test('WebRTC call cleanup clears pending notices and media state on both clients', () => {
  const chatService = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'chat-service.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'renderer.js'), 'utf8');

  assert.match(chatService, /function clearPendingRtcNotice\(\)\{pendingRtcAction=null;hideRtcNotice\(\)\}/);
  assert.match(chatService, /function cancelRtcNotice\(\)[\s\S]*clearPendingRtcNotice\(\)[\s\S]*currentCall=null/);
  assert.match(chatService, /function endCall\(text='未通话',notify=true\)[\s\S]*clearPendingRtcNotice\(\)[\s\S]*el\('localVideo'\)\.srcObject=null[\s\S]*el\('remoteVideo'\)\.srcObject=null/);
  assert.match(chatService, /if\(pc\)pc\.close\(\)/);
  assert.match(chatService, /if\(localStream\)localStream\.getTracks\(\)\.forEach\(track=>track\.stop\(\)\)/);

  assert.match(renderer, /function clearPendingChatRtcNotice\(\)\s*\{[\s\S]*pendingChatRtcAction = null;[\s\S]*pendingChatRtcMode = 'audio';[\s\S]*hideChatRtcNotice\(\);[\s\S]*\}/);
  assert.match(renderer, /function cancelChatRtcNotice\(\)[\s\S]*clearPendingChatRtcNotice\(\)[\s\S]*chatCallId = ''[\s\S]*chatCallPeerId = ''/);
  assert.match(renderer, /function endChatCall\(options = \{\}\)[\s\S]*clearPendingChatRtcNotice\(\)[\s\S]*chatCallId = ''[\s\S]*localCallVideo\.srcObject = null[\s\S]*remoteCallVideo\.srcObject = null/);
  assert.match(renderer, /if \(chatPeerConnection\) chatPeerConnection\.close\(\)/);
  assert.match(renderer, /if \(chatLocalStream\) chatLocalStream\.getTracks\(\)\.forEach\(track => track\.stop\(\)\)/);
});

test('settings page exposes one-click LLM connectivity self-check', () => {
  const indexHtml = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'styles.css'), 'utf8');
  const renderer = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'renderer.js'), 'utf8');
  const preload = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'preload.js'), 'utf8');
  const main = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));

  assert.match(indexHtml, /id="testLlmConnectivity"/);
  assert.match(indexHtml, /id="llmSelfCheckResult" class="llm-self-check-result"/);
  assert.match(styles, /\.llm-self-check-result/);
  assert.match(styles, /\.llm-check-card/);
  assert.match(styles, /\.llm-check-card\.connected/);
  assert.match(styles, /\.llm-check-card\.needs-config/);
  assert.match(renderer, /const testLlmConnectivityButton = document\.querySelector\('#testLlmConnectivity'\)/);
  assert.match(renderer, /const llmSelfCheckResult = document\.querySelector\('#llmSelfCheckResult'\)/);
  assert.match(renderer, /function renderLlmSelfCheckResult/);
  assert.match(renderer, /window\.focusPet\.testLlmConnectivity\(collectSettings\(\)\)/);
  assert.match(renderer, /testLlmConnectivityButton\.addEventListener\('click', testLlmConnectivity\)/);
  assert.match(preload, /testLlmConnectivity: patch => ipcRenderer\.invoke\('settings:test-llm-connectivity', patch\)/);
  assert.match(main, /require\('\.\/llm-self-check'\)/);
  assert.match(main, /ipcMain\.handle\('settings:test-llm-connectivity'/);
  assert.match(packageJson.scripts.check, /src\/llm-self-check\.js/);
});

test('settings page is layered into basic focus AI social and advanced groups', () => {
  const indexHtml = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'styles.css'), 'utf8');
  const renderer = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'renderer.js'), 'utf8');

  assert.match(indexHtml, /id="settingsPanel" class="settings-panel hidden" data-active-settings-group="basic"/);
  assert.match(indexHtml, /class="settings-tabs" aria-label="设置分组"/);
  for (const group of ['basic', 'focus', 'ai', 'social', 'advanced']) {
    assert.match(indexHtml, new RegExp(`data-settings-tab="${group}"`));
    assert.match(indexHtml, new RegExp(`data-settings-group="${group}"`));
  }

  assert.match(indexHtml, /id="settingsGroupBasic"[\s\S]*id="settingLaunchAtLogin"[\s\S]*id="settingCooldown"[\s\S]*id="settingIdle"[\s\S]*id="settingIntensity"/);
  assert.match(indexHtml, /id="settingsGroupFocus"[\s\S]*id="settingFocusKeywords"[\s\S]*id="settingStudyKeywords"[\s\S]*id="settingGameKeywords"[\s\S]*id="settingDistractionKeywords"[\s\S]*id="settingGameApps"[\s\S]*id="settingWorkApps"/);
  assert.match(indexHtml, /id="settingsGroupAi"[\s\S]*data-setting-risk="ai"[\s\S]*id="settingScreenMonitorEnabled"[\s\S]*id="settingScreenMonitorEndpoint"[\s\S]*id="settingReviewLlmEnabled"[\s\S]*id="testLlmConnectivity"[\s\S]*id="testScreenMonitor"/);
  assert.match(indexHtml, /id="settingsGroupSocial"[\s\S]*data-setting-risk="social"[\s\S]*id="settingSocialActivityShareLevel"[\s\S]*id="settingMediaMb"[\s\S]*id="settingVoiceShortcut"[\s\S]*邀请码[\s\S]*通话配置/);
  assert.match(indexHtml, /value="presence"[\s\S]*只共享在线状态/);
  assert.match(indexHtml, /value="status"[\s\S]*共享工作\/学习\/休息状态/);
  assert.match(indexHtml, /value="summary"[\s\S]*共享状态摘要/);
  assert.match(indexHtml, /value="screen-summary"[\s\S]*共享屏幕分析摘要/);
  assert.match(indexHtml, /id="settingsGroupAdvanced"[\s\S]*data-setting-risk="advanced"[\s\S]*id="settingUpdateUrl"[\s\S]*id="settingActivityRetentionDays"[\s\S]*id="openDataFromSettings"[\s\S]*id="runDiagnosticsFromSettings"[\s\S]*id="permissionGuide"/);

  assert.match(renderer, /const settingGroupButtons = Array\.from\(document\.querySelectorAll\('\[data-settings-tab\]'\)\)/);
  assert.match(renderer, /function setSettingsGroup/);
  assert.match(renderer, /settingsPanel\.dataset\.activeSettingsGroup = group/);
  assert.match(renderer, /settingGroupButtons\.forEach\(button => button\.addEventListener\('click'/);
  assert.match(renderer, /openDataFromSettingsButton\.addEventListener\('click'/);
  assert.match(renderer, /runDiagnosticsFromSettingsButton\.addEventListener\('click', runSettingsDiagnostics\)/);
  assert.match(renderer, /socialActivityShareLevel: document\.querySelector\('#settingSocialActivityShareLevel'\)/);
  assert.match(renderer, /settingControls\.socialActivityShareLevel\.value = settings\.socialActivityShareLevel/);
  assert.match(renderer, /socialActivityShareLevel: settingControls\.socialActivityShareLevel\.value/);
  assert.match(renderer, /activityRetentionDays: document\.querySelector\('#settingActivityRetentionDays'\)/);
  assert.match(renderer, /settingControls\.activityRetentionDays\.value = settings\.activityRetentionDays/);
  assert.match(renderer, /activityRetentionDays: settingControls\.activityRetentionDays\.value/);

  assert.match(styles, /\.settings-tabs/);
  assert.match(styles, /\.settings-tab\[aria-pressed="true"\]/);
  assert.match(styles, /\.settings-group\[hidden\]/);
  assert.match(styles, /\.settings-risk-note/);
});

test('settings page exposes local-first LLM provider controls', () => {
  const indexHtml = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'index.html'), 'utf8');
  const renderer = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'renderer.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));

  assert.match(indexHtml, /id="settingLlmCloudMode"/);
  assert.match(indexHtml, /value="local-only"[\s\S]*仅本地/);
  assert.match(indexHtml, /id="settingScreenMonitorProvider"[\s\S]*value="ollama"[\s\S]*Ollama/);
  assert.match(indexHtml, /id="settingReviewLlmProvider"[\s\S]*value="local-openai-compatible"[\s\S]*本地 OpenAI-compatible/);
  assert.match(indexHtml, /http:\/\/127\.0\.0\.1:11434/);

  assert.match(renderer, /llmCloudMode: document\.querySelector\('#settingLlmCloudMode'\)/);
  assert.match(renderer, /screenMonitorProvider: document\.querySelector\('#settingScreenMonitorProvider'\)/);
  assert.match(renderer, /reviewLlmProvider: document\.querySelector\('#settingReviewLlmProvider'\)/);
  assert.match(renderer, /settingControls\.llmCloudMode\.value = settings\.llmCloudMode/);
  assert.match(renderer, /screenMonitorProvider: settingControls\.screenMonitorProvider\.value/);
  assert.match(renderer, /reviewLlmProvider: settingControls\.reviewLlmProvider\.value/);
  assert.match(renderer, /apiKeyRequired/);
  assert.match(packageJson.scripts.check, /src\/llm-provider\.js/);
});

test('onboarding guide offers three modes and keeps advanced capabilities opt-in', () => {
  const indexHtml = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'styles.css'), 'utf8');
  const renderer = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'renderer.js'), 'utf8');
  const settings = createSettingsStore({ dataDir: tempDir('onboarding-default-settings') }).getSettings();

  assert.match(indexHtml, /id="onboardingToggle"/);
  assert.match(indexHtml, /id="onboardingPanel" class="onboarding-panel hidden"/);
  assert.match(indexHtml, /data-onboarding-mode="basic" data-onboarding-duration="under-3-minutes"[\s\S]*基础模式[\s\S]*任务 \+ 宠物 \+ 前台 App 判断[\s\S]*会采集什么[\s\S]*不会采集什么[\s\S]*数据保存在哪里[\s\S]*是否会外发[\s\S]*id="completeBasicOnboarding"/);
  assert.match(indexHtml, /data-onboarding-mode="enhanced"[\s\S]*增强模式[\s\S]*工作\/学习\/娱乐关键词[\s\S]*复盘[\s\S]*id="openEnhancedOnboarding"/);
  assert.match(indexHtml, /data-onboarding-mode="advanced" data-onboarding-default="off"[\s\S]*高级模式[\s\S]*屏幕 LLM[\s\S]*社交监督[\s\S]*WebRTC[\s\S]*id="openAdvancedOnboarding"/);

  assert.match(renderer, /const onboardingPanel = document\.querySelector\('#onboardingPanel'\)/);
  assert.match(renderer, /const ONBOARDING_MODE_KEY = 'focusPetOnboardingMode'/);
  assert.match(renderer, /function showOnboarding/);
  assert.match(renderer, /function completeBasicOnboarding/);
  assert.match(renderer, /window\.focusPet\.updateSettings\(\{\s*screenMonitorEnabled:\s*false,\s*reviewLlmEnabled:\s*false,\s*autoCheckUpdates:\s*false\s*\}\)/);
  assert.match(renderer, /localStorage\.setItem\(ONBOARDING_MODE_KEY, 'basic'\)/);
  assert.match(renderer, /openOnboardingSettingsGroup\('focus'\)/);
  assert.match(renderer, /openOnboardingSettingsGroup\('ai'\)/);
  assert.match(renderer, /onboardingToggle'\)\.addEventListener\('click', showOnboarding\)/);

  assert.match(styles, /\.onboarding-panel/);
  assert.match(styles, /\.onboarding-card/);
  assert.match(styles, /\.onboarding-card\[data-onboarding-default="off"\]/);
  assert.equal(settings.screenMonitorEnabled, false);
  assert.equal(settings.autoCheckUpdates, false);
});

test('LLM self-check styles constrain long diagnostic text inside settings cards', () => {
  const styles = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'styles.css'), 'utf8');

  assert.match(styles, /\.llm-check-card\s*\{[\s\S]*min-width:\s*0/);
  assert.match(styles, /\.llm-check-card\s*\{[\s\S]*max-width:\s*100%/);
  assert.match(styles, /\.llm-check-card p\s*\{[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(styles, /\.llm-check-detail\s*\{[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(styles, /\.llm-next-steps\s*\{[\s\S]*min-width:\s*0/);
  assert.match(styles, /\.llm-next-steps li\s*\{[\s\S]*overflow-wrap:\s*anywhere/);
  assert.match(styles, /\.settings-actions button\s*\{[\s\S]*min-width:\s*0/);
});

test('diagnostics summary reports operational state without high-sensitivity content', () => {
  const errorDir = tempDir('diagnostics-errors');
  const errorLogPath = path.join(errorDir, 'errorThing.md');
  fs.writeFileSync(errorLogPath, [
    '# Error Log',
    '## [2026-06-30 10:00:00]',
    '- 问题描述：调用失败 Bearer secret-token-12345678901234567890123456789012',
    '- 发生位置：src/secret.js',
    '- 上下文：当前任务 Secret launch task，聊天 private chat body，截图 data:image/png;base64,abc',
    '- 可能原因：测试',
    '- 解决状态：未解决'
  ].join('\n'), 'utf8');

  const errors = readRecentErrorSummaries(errorLogPath, { limit: 2 });
  const summary = buildDiagnosticsSummary({
    packageJson: { version: '1.2.3' },
    now: () => '2026-06-30T10:30:00.000Z',
    platform: 'darwin',
    permissionStatus: {
      permissionGuideSteps: [
        { id: 'accessibility', status: 'granted' },
        { id: 'screen-recording', status: 'blocked' }
      ]
    },
    settings: {
      autoPopupEnabled: true,
      popupCooldownMinutes: 8,
      idleNudgeMinutes: 10,
      activityRetentionDays: 30,
      maxMediaMb: 25,
      screenMonitorEnabled: true,
      screenMonitorEndpoint: 'https://llm.example.com/v1/chat/completions',
      screenMonitorModel: 'vision-secret-model',
      reviewLlmEnabled: true,
      reviewLlmEndpoint: 'https://api.stepfun.com/step_plan/v1',
      reviewLlmModel: 'step-secret-model',
      focusKeywords: ['Secret launch task'],
      workApps: ['SecretApp']
    },
    env: {
      FOCUS_PET_LLM_API_KEY: 'screen-key',
      FOCUS_PET_STEPFUN_API_KEY: 'review-key'
    },
    tasks: [
      { text: 'Secret launch task', done: false },
      { text: 'Done task', done: true }
    ],
    activityEntries: [
      {
        time: '2026-06-30T10:01:00.000Z',
        status: 'work',
        reason: '匹配当前任务 Secret launch task 和窗口 Secret launch title',
        app: 'SecretApp',
        title: 'Secret launch title',
        confidence: 0.93,
        currentTask: { text: 'Secret launch task' }
      },
      {
        time: '2026-06-30T10:02:00.000Z',
        status: 'game',
        reason: '匹配游戏 App Steam Secret',
        app: 'Steam Secret',
        title: 'Secret Game Window',
        confidence: 0.82
      },
      {
        time: '2026-06-30T10:03:00.000Z',
        status: 'distracted',
        reason: '命中分心关键词 private chat body',
        app: 'Safari Secret',
        title: 'private chat body'
      }
    ],
    chatState: {
      version: 1,
      friends: [{ id: 'friend-1', name: '搭子' }],
      sessions: [{ token: 'peer-token' }],
      messages: [{ text: 'private chat body' }],
      activityLog: [{ media: { url: 'data:image/png;base64,abc' } }],
      callAuditLog: [{ event: 'rtc-offer', sdp: 'secret-sdp-body', candidate: 'secret-ice-candidate' }]
    },
    chatHealth: {
      ok: true,
      port: 47321,
      clients: 1,
      websocket: {
        enabled: true,
        active: true,
        clients: 1,
        originPolicy: 'same-origin-plus-configured',
        allowedOriginsConfigured: true,
        configuredAllowedOriginCount: 2,
        acceptsNoOrigin: true,
        allowsFileOrigin: true,
        corsWildcard: false,
        allowedOrigins: ['https://secret-chat.example']
      },
      rtc: {
        configured: true,
        usingDefault: false,
        source: 'env',
        serverCount: 2,
        stunCount: 1,
        turnCount: 1,
        hasStun: true,
        hasTurn: true,
        requiresTurn: false,
        urls: ['turn:turn.example.com?transport=tcp'],
        username: 'secret-user-1234567890',
        credential: 'secret-pass-1234567890',
        summary: 'turn.example.com secret-user-1234567890',
        guidance: 'secret-pass-1234567890'
      }
    },
    storage: {
      taskJsonExists: true,
      settingsJsonExists: true,
      chatStateJsonExists: true,
      corruptBackups: ['tasks.corrupt-2026.json'],
      automaticBackups: [
        '/tmp/secret-path/tasks.backup-2026.json',
        'settings.backup-2026.json'
      ]
    },
    recentErrors: errors
  });

  assert.equal(summary.version, '1.2.3');
  assert.equal(summary.generatedAt, '2026-06-30T10:30:00.000Z');
  assert.equal(summary.permissions.steps.screenRecording, 'blocked');
  assert.equal(summary.settings.screenMonitor.endpointConfigured, true);
  assert.equal(summary.settings.screenMonitor.apiKeyConfigured, true);
  assert.equal(summary.settings.screenMonitor.modelConfigured, true);
  assert.equal(summary.settings.screenMonitor.provider, 'openai-compatible');
  assert.equal(summary.settings.llmCloudMode, 'allowed');
  assert.equal(summary.settings.activityRetentionDays, 30);
  assert.equal(summary.settings.screenMonitor.model, undefined);
  assert.equal(summary.tasks.total, 2);
  assert.equal(summary.tasks.open, 1);
  assert.equal(summary.activity.totalSamples, 3);
  assert.equal(summary.activity.recentDecisions.length, 3);
  assert.equal(summary.activity.recentDecisions[0].status, 'work');
  assert.equal(summary.activity.recentDecisions[0].reasonCategory, 'task-context');
  assert.equal(summary.activity.recentDecisions[0].taskLinked, true);
  assert.equal(summary.activity.recentDecisions[0].appKnown, true);
  assert.equal(summary.activity.recentDecisions[0].titleKnown, true);
  assert.equal(summary.activity.recentDecisions[0].confidence, 0.93);
  assert.equal(summary.activity.recentDecisions[1].reasonCategory, 'game-rule');
  assert.equal(summary.activity.recentDecisions[2].reasonCategory, 'distraction-rule');
  assert.equal(summary.chat.messages, 1);
  assert.equal(summary.chat.sessions, 1);
  assert.equal(summary.chat.callAuditLog, 1);
  assert.equal(summary.chat.websocket.enabled, true);
  assert.equal(summary.chat.websocket.active, true);
  assert.equal(summary.chat.websocket.clients, 1);
  assert.equal(summary.chat.websocket.originPolicy, 'same-origin-plus-configured');
  assert.equal(summary.chat.websocket.allowedOriginsConfigured, true);
  assert.equal(summary.chat.websocket.configuredAllowedOriginCount, 2);
  assert.equal(summary.chat.websocket.acceptsNoOrigin, true);
  assert.equal(summary.chat.websocket.allowsFileOrigin, true);
  assert.equal(summary.chat.websocket.corsWildcard, false);
  assert.equal(summary.chat.rtc.configured, true);
  assert.equal(summary.chat.rtc.hasTurn, true);
  assert.equal(summary.chat.rtc.requiresTurn, false);
  assert.equal(summary.chat.rtc.serverCount, 2);
  assert.equal(summary.chat.rtc.turnCount, 1);
  assert.equal(summary.storage.corruptBackupCount, 1);
  assert.equal(summary.storage.automaticBackupCount, 2);
  assert.equal(summary.storage.latestAutomaticBackup, 'settings.backup-2026.json');
  assert.match(summary.recentErrors[0].description, /\[redacted\]/);

  const serialized = JSON.stringify(summary);
  assert.doesNotMatch(serialized, /Secret launch task/);
  assert.doesNotMatch(serialized, /private chat body/);
  assert.doesNotMatch(serialized, /SecretApp|Secret launch title|Steam Secret|Secret Game Window|Safari Secret/);
  assert.doesNotMatch(serialized, /data:image/);
  assert.doesNotMatch(serialized, /vision-secret-model|step-secret-model|screen-key|review-key|peer-token/);
  assert.doesNotMatch(serialized, /secret-chat\.example/);
  assert.doesNotMatch(serialized, /turn\.example\.com|stun\.example\.com|secret-user|secret-pass/);
  assert.doesNotMatch(serialized, /secret-sdp-body|secret-ice-candidate/);
  assert.doesNotMatch(serialized, /secret-path/);
});

test('diagnostics task summary counts only open tasks due today or earlier', () => {
  const summary = buildDiagnosticsSummary({
    packageJson: { version: '1.2.3' },
    now: () => '2026-06-30T12:00:00.000Z',
    tasks: [
      { text: 'past due', done: false, dueDate: '2026-06-29' },
      { text: 'today due', done: false, dueDate: '2026-06-30' },
      { text: 'future due', done: false, dueDate: '2026-07-01' },
      { text: 'done past due', done: true, dueDate: '2026-06-28' },
      { text: 'no due', done: false, dueDate: '' }
    ],
    storage: {}
  });

  assert.equal(summary.tasks.open, 4);
  assert.equal(summary.tasks.dueTodayOrEarlier, 2);
  assert.doesNotMatch(JSON.stringify(summary), /past due|today due|future due|done past due|no due/);
});

test('recent error summaries mark older unresolved entries closed by later fixes', () => {
  const errorDir = tempDir('diagnostics-errors-closed-by-later');
  const errorLogPath = path.join(errorDir, 'errorThing.md');
  const longSharedPrefix = '诊断摘要长描述边界'.repeat(30);
  fs.writeFileSync(errorLogPath, [
    '# Error Log',
    '## [2026-06-30 10:00:00]',
    '- 问题描述：诊断包 gate 失败',
    '- 发生位置：scripts/release-preflight.js runDiagnosticsBundleOutputCheck',
    '- 上下文：测试红灯',
    '- 可能原因：缺少边界检查',
    '- 解决状态：未解决',
    '## [2026-06-30 10:05:00]',
    '- 问题描述：诊断包 gate 失败',
    '- 发生位置：scripts/release-preflight.js runDiagnosticsBundleOutputCheck',
    '- 上下文：测试转绿',
    '- 可能原因：缺少边界检查',
    '- 解决状态：已解决',
    '## [2026-06-30 10:10:00]',
    '- 问题描述：另一个开放问题',
    '- 发生位置：src/diagnostics.js cleanDiagnosticText',
    '- 上下文：尚未修复',
    '- 可能原因：测试',
    '- 解决状态：未解决',
    '## [2026-06-30 10:15:00]',
    `- 问题描述：${longSharedPrefix}A 问题仍开放`,
    '- 发生位置：src/diagnostics.js markClosedErrorSummaries',
    '- 上下文：同前缀不同后缀',
    '- 可能原因：测试',
    '- 解决状态：未解决',
    '## [2026-06-30 10:20:00]',
    `- 问题描述：${longSharedPrefix}B 问题已修`,
    '- 发生位置：src/diagnostics.js markClosedErrorSummaries',
    '- 上下文：同前缀不同后缀',
    '- 可能原因：测试',
    '- 解决状态：未解决',
    '## [2026-06-30 10:25:00]',
    `- 问题描述：${longSharedPrefix}B 问题已修`,
    '- 发生位置：src/diagnostics.js markClosedErrorSummaries',
    '- 上下文：同前缀不同后缀已解决',
    '- 可能原因：测试',
    '- 解决状态：已解决'
  ].join('\n'), 'utf8');

  const errors = readRecentErrorSummaries(errorLogPath, { limit: 6 });

  assert.equal(errors[0].status, '未解决');
  assert.equal(errors[0].closedByLater, true);
  assert.equal(errors[0].open, false);
  assert.equal(errors[1].status, '已解决');
  assert.equal(errors[1].closedByLater, false);
  assert.equal(errors[1].open, false);
  assert.equal(errors[2].status, '未解决');
  assert.equal(errors[2].closedByLater, false);
  assert.equal(errors[2].open, true);
  assert.equal(errors[3].closedByLater, false);
  assert.equal(errors[3].open, true);
  assert.equal(errors[4].closedByLater, true);
  assert.equal(errors[4].open, false);
  assert.equal(errors[5].status, '已解决');
  assert.equal(Object.hasOwn(errors[5], 'rawIssueKey'), false);
});

test('diagnostic text cleaning preserves technical labels while redacting sensitive values', () => {
  const cleaned = cleanDiagnosticText([
    'diagnostics-bundle-output gate failed in release-preflight',
    'location scripts/release-preflight.js runDiagnosticsBundleOutputCheck diagnosticsManifestBoundaryIssues',
    'raw token abcdefghijklmnopqrstuvwxyz1234567890',
    'session token sk_123456789012345678901234',
    'Authorization: Bearer secret-token-12345678901234567890',
    'screenshot data:image/png;base64,abcdefghijklmnopqrstuvwxyz123456',
    'local paths /tmp/focus-pet-fast-preflight-summary-scan.log /Users/sxlx/focus-pet/secret.log /var/folders/abc/secret C:\\Users\\Alice\\AppData\\Local\\FocusPet\\secret.log',
    'endpoint=https://llm.example.com/v1/chat/completions reviewEndpoint=https://review.example.com/v1 screenEndpoint=http://127.0.0.1:11434/v1/chat/completions',
    'FOCUS_PET_API_KEY=abcdefghijklmnopqrstuvwxyz123456',
    'apiKey=screen-key-123 authToken=owner-token-456 sessionToken=peer-token-789 inviteCode=ROOM-SECRET',
    'currentTask=写上市计划 frontmost=SecretDeck windowTitle=Board deck title'
  ].join(' '), 500);

  assert.match(cleaned, /diagnostics-bundle-output/);
  assert.match(cleaned, /release-preflight/);
  assert.match(cleaned, /runDiagnosticsBundleOutputCheck/);
  assert.match(cleaned, /diagnosticsManifestBoundaryIssues/);
  assert.doesNotMatch(cleaned, /abcdefghijklmnopqrstuvwxyz1234567890/);
  assert.doesNotMatch(cleaned, /sk_123456789012345678901234/);
  assert.doesNotMatch(cleaned, /secret-token-12345678901234567890/);
  assert.doesNotMatch(cleaned, /data:image/);
  assert.doesNotMatch(cleaned, /llm\.example\.com|review\.example\.com|127\.0\.0\.1/);
  assert.doesNotMatch(cleaned, /FOCUS_PET_API_KEY|apiKey|authToken|sessionToken|inviteCode|screen-key|owner-token|peer-token|ROOM-SECRET|写上市计划|SecretDeck|Board deck title/);
  assert.doesNotMatch(cleaned, /\/tmp\/focus-pet-fast-preflight-summary-scan\.log/);
  assert.doesNotMatch(cleaned, /\/Users\/sxlx\/focus-pet\/secret\.log/);
  assert.doesNotMatch(cleaned, /\/var\/folders\/abc\/secret/);
  assert.doesNotMatch(cleaned, /C:\\Users\\Alice\\AppData\\Local\\FocusPet\\secret\.log/);
  assert.match(cleaned, /Bearer \[redacted\]/);
  assert.match(cleaned, /\[image-data\]/);
  assert.match(cleaned, /\[local-path\]/);
  assert.match(cleaned, /currentTask=\[redacted\]/);
  assert.match(cleaned, /frontmost=\[redacted\]/);
  assert.match(cleaned, /windowTitle=\[redacted\]/);
});

test('diagnostics summary reports local LLM mode without leaking local endpoints or models', () => {
  const summary = buildDiagnosticsSummary({
    packageJson: { version: '1.2.3' },
    now: () => '2026-06-30T11:00:00.000Z',
    settings: {
      llmCloudMode: 'local-only',
      screenMonitorProvider: 'ollama',
      screenMonitorEnabled: true,
      screenMonitorEndpoint: 'http://127.0.0.1:11434',
      screenMonitorModel: 'llava-secret-local',
      reviewLlmProvider: 'local-openai-compatible',
      reviewLlmEnabled: true,
      reviewLlmEndpoint: 'http://localhost:1234/v1/chat/completions',
      reviewLlmModel: 'llama-secret-local'
    },
    env: {},
    tasks: [],
    chatState: {},
    chatHealth: {},
    storage: {}
  });

  assert.equal(summary.settings.llmCloudMode, 'local-only');
  assert.equal(summary.settings.screenMonitor.provider, 'ollama');
  assert.equal(summary.settings.screenMonitor.localProvider, true);
  assert.equal(summary.settings.screenMonitor.apiKeyConfigured, false);
  assert.equal(summary.settings.screenMonitor.apiKeyRequired, false);
  assert.equal(summary.settings.reviewLlm.provider, 'local-openai-compatible');
  assert.equal(summary.settings.reviewLlm.localProvider, true);
  assert.equal(summary.settings.reviewLlm.apiKeyRequired, false);

  const serialized = JSON.stringify(summary);
  assert.doesNotMatch(serialized, /127\.0\.0\.1|localhost|11434|1234|llava-secret-local|llama-secret-local/);
});

test('runtime diagnostics reports default WebRTC TURN guidance without chat service health', () => {
  const summary = buildRuntimeDiagnosticsSummary({
    packageJson: { version: '1.2.3' },
    now: () => '2026-06-30T11:30:00.000Z',
    platform: 'darwin',
    permissionStatus: { permissionGuideSteps: [] },
    settings: {},
    env: {},
    tasks: [],
    chatState: {},
    storage: {},
    recentErrors: []
  });

  assert.equal(summary.chat.rtc.configured, false);
  assert.equal(summary.chat.rtc.usingDefault, true);
  assert.equal(summary.chat.rtc.source, 'default-stun');
  assert.equal(summary.chat.rtc.serverCount, 1);
  assert.equal(summary.chat.rtc.stunCount, 1);
  assert.equal(summary.chat.rtc.turnCount, 0);
  assert.equal(summary.chat.rtc.hasStun, true);
  assert.equal(summary.chat.rtc.hasTurn, false);
  assert.equal(summary.chat.rtc.requiresTurn, true);
});

test('runtime diagnostics includes recent status decision reasons without raw activity text', () => {
  const dataDir = tempDir('runtime-activity-diagnostics');
  const socialDataDir = tempDir('runtime-activity-social');
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, 'activity.jsonl'), [
    JSON.stringify({
      time: '2026-06-30T12:01:00.000Z',
      status: 'work',
      reason: '匹配当前任务 Secret runtime task 和窗口 Secret runtime title',
      app: 'SecretRuntimeApp',
      title: 'Secret runtime title',
      confidence: 0.88,
      currentTask: { text: 'Secret runtime task' }
    }),
    JSON.stringify({
      time: '2026-06-30T12:02:00.000Z',
      status: 'study',
      reason: '匹配学习关键词 Secret course',
      app: 'SecretStudyApp',
      title: 'Secret course note',
      confidence: 0.77
    })
  ].join('\n'), 'utf8');

  const summary = buildRuntimeDiagnosticsSummary({
    packageJson: { version: '1.2.3' },
    now: () => '2026-06-30T12:30:00.000Z',
    platform: 'darwin',
    dataDir,
    socialDataDir,
    permissionStatus: { permissionGuideSteps: [] },
    settings: {},
    env: {},
    chatState: {},
    chatHealth: {},
    storage: {},
    recentErrors: []
  });

  assert.equal(summary.activity.totalSamples, 2);
  assert.equal(summary.activity.recentDecisions.length, 2);
  assert.equal(summary.activity.recentDecisions[0].reasonCategory, 'task-context');
  assert.equal(summary.activity.recentDecisions[0].reasonSummary, '匹配当前任务、场景模板或任务相关规则。');
  assert.equal(summary.activity.recentDecisions[1].reasonCategory, 'study-rule');

  const serialized = JSON.stringify(summary);
  assert.doesNotMatch(serialized, /Secret runtime task|Secret runtime title|SecretRuntimeApp|SecretStudyApp|Secret course/);
});

test('runtime logger writes leveled sanitized entries and summarizes recent levels', () => {
  const modulePath = path.join(PROJECT_ROOT, 'src', 'runtime-logger.js');
  assert.equal(fs.existsSync(modulePath), true);
  const { readRuntimeLogSummary, writeRuntimeLog } = require(modulePath);
  const dataDir = tempDir('runtime-logger');
  const logPath = path.join(dataDir, 'focus-pet.log');

  writeRuntimeLog({
    logPath,
    level: 'warn',
    scope: 'diagnostics',
    message: 'upload failed Bearer secret-token-123456789012345678901234567890 data:image/png;base64,abc123 endpoint=https://llm.example.com/v1/chat/completions FOCUS_PET_API_KEY=abcdefghijklmnopqrstuvwxyz apiKey=screen-key-123 authToken=owner-token-456 sessionToken=peer-token-789 inviteCode=ROOM-SECRET currentTask=写方案细节 frontmost=Code path=/Users/sxlx/focus-pet/secret.log tmp=/tmp/focus-pet-debug.log cache=/var/folders/abc/secret win=C:\\Users\\Alice\\AppData\\Local\\FocusPet\\secret.log',
    now: () => '2026-06-30T13:01:00.000Z'
  });
  writeRuntimeLog({
    logPath,
    level: 'not-a-level',
    scope: 'main',
    message: 'started',
    now: () => '2026-06-30T13:02:00.000Z'
  });

  const summary = readRuntimeLogSummary(logPath, { limit: 5 });
  assert.equal(summary.totalEntries, 2);
  assert.equal(summary.levelCounts.warn, 1);
  assert.equal(summary.levelCounts.info, 1);
  assert.equal(summary.recent.length, 2);
  assert.equal(summary.recent[0].level, 'warn');
  assert.equal(summary.recent[0].scope, 'diagnostics');
  assert.equal(summary.recent[1].level, 'info');

  const serialized = JSON.stringify(summary);
  assert.match(serialized, /\[redacted\]/);
  assert.match(serialized, /\[image-data\]/);
  assert.match(serialized, /\[local-path\]/);
  assert.doesNotMatch(serialized, /secret-token|data:image|abc123|llm\.example\.com|FOCUS_PET_API_KEY|abcdefghijklmnopqrstuvwxyz|apiKey|authToken|sessionToken|inviteCode|screen-key|owner-token|peer-token|ROOM-SECRET|写方案细节|Code/);
  assert.doesNotMatch(serialized, /\/Users\/sxlx\/focus-pet\/secret\.log|\/tmp\/focus-pet-debug\.log|\/var\/folders\/abc\/secret/);
  assert.doesNotMatch(serialized, /C:\\\\Users\\\\Alice\\\\AppData\\\\Local\\\\FocusPet\\\\secret\.log/);
});

test('runtime logger applies local retention without dropping recent legacy lines', () => {
  const modulePath = path.join(PROJECT_ROOT, 'src', 'runtime-logger.js');
  const { readRuntimeLogSummary, writeRuntimeLog } = require(modulePath);
  const dataDir = tempDir('runtime-logger-retention');
  const logPath = path.join(dataDir, 'focus-pet.log');
  fs.writeFileSync(logPath, [
    JSON.stringify({ time: '2026-05-20T10:00:00.000Z', level: 'info', scope: 'main', message: 'old json entry' }),
    '[2026-06-15T10:00:00.000Z] recent legacy entry'
  ].join('\n') + '\n', 'utf8');

  writeRuntimeLog({
    logPath,
    level: 'warn',
    scope: 'main',
    message: 'new retained entry',
    retentionDays: 30,
    now: () => '2026-06-30T12:00:00.000Z'
  });

  const summary = readRuntimeLogSummary(logPath, { limit: 5 });
  assert.equal(summary.totalEntries, 2);
  assert.deepEqual(summary.recent.map(entry => entry.message), ['recent legacy entry', 'new retained entry']);
  assert.equal(fs.existsSync(`${logPath}.tmp`), false);
});

test('runtime logging entrypoints pass the configurable local retention window', () => {
  const main = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');
  const focus = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'focus.js'), 'utf8');
  const runElectron = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts', 'run-electron.js'), 'utf8');

  assert.match(main, /writeRuntimeLog\(\{ level, scope: 'main', message, retentionDays: focus\.getSettings\(\)\.activityRetentionDays \}\)/);
  assert.match(main, /const \{ writeRuntimeLog, sanitizeLogText \} = require\('\.\/runtime-logger'\)/);
  assert.match(main, /function cleanErrorLogText\(value\) \{\s*return sanitizeLogText\(value, 600\);\s*\}/);
  assert.match(focus, /const \{ sanitizeLogText \} = require\('\.\/runtime-logger'\)/);
  assert.match(focus, /function cleanErrorLogText\(value\) \{\s*return sanitizeLogText\(value, 600\);\s*\}/);
  assert.match(runElectron, /const \{ createSettingsStore, DEFAULT_SETTINGS \} = require\('\.\.\/src\/settings-store'\)/);
  assert.match(runElectron, /function runtimeLogRetentionDays\(\)/);
  assert.match(runElectron, /writeRuntimeLog\(\{ logPath, level, scope: 'supervisor', message, retentionDays: runtimeLogRetentionDays\(\) \}\)/);
});

test('runtime diagnostics reports runtime log levels without raw log secrets', () => {
  const dataDir = tempDir('runtime-log-diagnostics');
  const socialDataDir = tempDir('runtime-log-social');
  const logPath = path.join(dataDir, 'focus-pet.log');
  fs.writeFileSync(logPath, [
    JSON.stringify({
      time: '2026-06-30T13:10:00.000Z',
      level: 'error',
      scope: 'main',
      message: 'failed with Bearer secret-token-123456789012345678901234567890'
    }),
    '[2026-06-30T13:11:00.000Z] legacy startup data:image/png;base64,abc123'
  ].join('\n'), 'utf8');

  const summary = buildRuntimeDiagnosticsSummary({
    packageJson: { version: '1.2.3' },
    now: () => '2026-06-30T13:30:00.000Z',
    platform: 'darwin',
    dataDir,
    socialDataDir,
    runtimeLogPath: logPath,
    permissionStatus: { permissionGuideSteps: [] },
    settings: {},
    env: {},
    chatState: {},
    chatHealth: {},
    storage: {},
    recentErrors: []
  });

  assert.equal(summary.logs.totalEntries, 2);
  assert.equal(summary.logs.levelCounts.error, 1);
  assert.equal(summary.logs.levelCounts.info, 1);
  assert.equal(summary.logs.recent.length, 2);
  assert.equal(summary.logs.recent[0].level, 'error');
  assert.equal(summary.logs.recent[1].legacy, true);

  const serialized = JSON.stringify(summary.logs);
  assert.match(serialized, /\[redacted\]/);
  assert.match(serialized, /\[image-data\]/);
  assert.doesNotMatch(serialized, /secret-token|data:image|abc123/);
});

test('diagnostics command and IPC are wired without exposing diagnostic packages by default', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  const main = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'preload.js'), 'utf8');
  const script = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts', 'diagnostics.js'), 'utf8');

  assert.equal(packageJson.scripts.diagnostics, 'node scripts/diagnostics.js');
  assert.match(packageJson.scripts.check, /src\/diagnostics\.js/);
  assert.match(packageJson.scripts.check, /scripts\/diagnostics\.js/);
  assert.match(main, /require\('\.\/diagnostics'\)/);
  assert.match(main, /ipcMain\.handle\('app:get-diagnostics'/);
  assert.match(preload, /getDiagnostics: \(\) => ipcRenderer\.invoke\('app:get-diagnostics'\)/);
  assert.match(script, /buildRuntimeDiagnosticsSummary/);
  assert.doesNotMatch(script, /chatState\.messages\.map|task\.text|screenshot|dataUrl/);
});

test('diagnostics bundle writes sanitized summary and manifest only', () => {
  const outputDir = tempDir('diagnostics-bundle');
  const summary = buildDiagnosticsSummary({
    packageJson: { version: '1.2.3' },
    now: () => '2026-06-30T12:00:00.000Z',
    platform: 'darwin',
    permissionStatus: { permissionGuideSteps: [{ id: 'screen-recording', status: 'blocked' }] },
    settings: {
      screenMonitorEndpoint: 'https://llm.example.com/v1/chat/completions',
      screenMonitorModel: 'vision-secret-model',
      reviewLlmEndpoint: 'http://localhost:1234/v1/chat/completions',
      reviewLlmModel: 'llama-secret-local',
      focusKeywords: ['Secret launch task']
    },
    env: {
      FOCUS_PET_LLM_API_KEY: 'screen-key',
      FOCUS_PET_STEPFUN_API_KEY: 'review-key'
    },
    tasks: [{ text: 'Secret launch task', done: false }],
    chatState: {
      messages: [{ text: 'private chat body' }],
      activityLog: [{ media: { url: 'data:image/png;base64,abc' } }],
      callAuditLog: [{ sdp: 'secret-sdp-body', candidate: 'secret-ice-candidate' }]
    },
    chatHealth: {
      rtc: {
        configured: true,
        source: 'env',
        serverCount: 1,
        turnCount: 1,
        hasTurn: true,
        urls: ['turn:turn.example.com'],
        username: 'secret-user',
        credential: 'secret-pass'
      }
    },
    storage: {}
  });
  const bundle = buildDiagnosticsBundle({ summary });
  const result = writeDiagnosticsBundle({ summary, outputDir });

  assert.equal(bundle.schemaVersion, 1);
  assert.equal(bundle.name, 'focus-pet-diagnostics-20260630-120000');
  assert.deepEqual(bundle.files.map(file => file.path), ['summary.json', 'manifest.md']);
  assert.equal(result.ok, true);
  assert.ok(fs.existsSync(path.join(result.dir, 'summary.json')));
  assert.ok(fs.existsSync(path.join(result.dir, 'manifest.md')));

  const summaryFile = fs.readFileSync(path.join(result.dir, 'summary.json'), 'utf8');
  const manifestFile = fs.readFileSync(path.join(result.dir, 'manifest.md'), 'utf8');
  assert.match(manifestFile, /# Focus Pet 诊断包/);
  assert.match(manifestFile, /summary\.json/);
  assert.match(manifestFile, /不会包含聊天正文、任务全文、截图、API key、session token、邀请码、LLM endpoint\/model 原文、ICE\/TURN 地址或通话 SDP\/ICE/);

  const serialized = `${JSON.stringify(bundle)}\n${summaryFile}\n${manifestFile}`;
  assert.doesNotMatch(serialized, /Secret launch task|private chat body|data:image/);
  assert.doesNotMatch(serialized, /vision-secret-model|llama-secret-local|screen-key|review-key/);
  assert.doesNotMatch(serialized, /llm\.example\.com|localhost|turn\.example\.com|secret-user|secret-pass/);
  assert.doesNotMatch(serialized, /secret-sdp-body|secret-ice-candidate/);
});

test('diagnostics bundle output rotates old bundle directories', () => {
  const outputDir = tempDir('diagnostics-bundle-retention');
  const oldNames = [
    'focus-pet-diagnostics-20260630-115700',
    'focus-pet-diagnostics-20260630-115800',
    'focus-pet-diagnostics-20260630-115900'
  ];
  for (const name of oldNames) {
    fs.mkdirSync(path.join(outputDir, name), { recursive: true });
    fs.writeFileSync(path.join(outputDir, name, 'summary.json'), '{}', 'utf8');
  }
  fs.mkdirSync(path.join(outputDir, 'manual-notes'), { recursive: true });

  const result = writeDiagnosticsBundle({
    outputDir,
    maxBundles: 3,
    summary: buildDiagnosticsSummary({
      packageJson: { version: '1.2.3' },
      now: () => '2026-06-30T12:00:00.000Z',
      storage: {}
    })
  });

  assert.equal(result.ok, true);
  assert.equal(result.removedBundleCount, 1);
  assert.equal(result.retainedBundleCount, 3);
  assert.deepEqual(
    fs.readdirSync(outputDir)
      .filter(name => /^focus-pet-diagnostics-\d{8}-\d{6}$/.test(name))
      .sort(),
    [
      'focus-pet-diagnostics-20260630-115800',
      'focus-pet-diagnostics-20260630-115900',
      'focus-pet-diagnostics-20260630-120000'
    ]
  );
  assert.ok(fs.existsSync(path.join(outputDir, 'manual-notes')));
});

test('diagnostics bundle command is wired and avoids raw diagnostic data access', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  const script = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts', 'diagnostics-bundle.js'), 'utf8');

  assert.equal(packageJson.scripts['diagnostics:bundle'], 'node scripts/diagnostics-bundle.js');
  assert.match(packageJson.scripts.check, /scripts\/diagnostics-bundle\.js/);
  assert.match(script, /writeDiagnosticsBundle/);
  assert.doesNotMatch(script, /chatState\.messages|task\.text|screenshot|dataUrl|process\.env\.[A-Z_]*KEY/);
});

test('release preflight checklist documents required gates and supports fast local run', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  const scriptPath = path.join(PROJECT_ROOT, 'scripts', 'release-preflight.js');

  assert.equal(packageJson.scripts['release:preflight'], 'node scripts/release-preflight.js');
  assert.match(packageJson.scripts.check, /scripts\/release-preflight\.js/);
  assert.ok(fs.existsSync(scriptPath));

  const {
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
    parseArgs,
    selectReleasePreflightItems
  } = require('../scripts/release-preflight');
  const checklist = buildReleasePreflightChecklist({ platform: 'darwin' });
  const ids = checklist.map(item => item.id);

  assert.deepEqual(ids, [
    'node-tests',
    'syntax-check',
    'diagnostics-summary',
    'diagnostics-bundle',
    'diagnostics-bundle-output',
    'render-qa',
    'screen-pipeline',
    'package-scripts',
    'chat-backend-deploy',
    'mac-package',
    'mac-remote-client-package',
    'mac-signing',
    'mac-notarization',
    'windows-package',
    'docs-boundary',
    'optimization-plan',
    'error-log'
  ]);
  assert.equal(checklist.find(item => item.id === 'node-tests').command, 'npm test');
  assert.equal(checklist.find(item => item.id === 'syntax-check').command, 'npm run check');
  assert.equal(checklist.find(item => item.id === 'diagnostics-summary').command, 'node scripts/release-preflight.js --check diagnostics-summary-output');
  assert.equal(checklist.find(item => item.id === 'diagnostics-bundle').command, 'npm run diagnostics:bundle -- --output-dir output/diagnostics/preflight');
  assert.equal(checklist.find(item => item.id === 'diagnostics-bundle-output').command, 'node scripts/release-preflight.js --check diagnostics-bundle-output');
  assert.equal(checklist.find(item => item.id === 'diagnostics-bundle-output').runGroup, 'fast');
  assert.equal(checklist.find(item => item.id === 'docs-boundary').command, 'node scripts/release-preflight.js --check docs-boundary');
  assert.equal(checklist.find(item => item.id === 'docs-boundary').manual, false);
  assert.equal(checklist.find(item => item.id === 'docs-boundary').runGroup, 'fast');
  assert.equal(checklist.find(item => item.id === 'optimization-plan').command, 'node scripts/release-preflight.js --check optimization-plan');
  assert.equal(checklist.find(item => item.id === 'optimization-plan').manual, false);
  assert.equal(checklist.find(item => item.id === 'optimization-plan').runGroup, 'fast');
  assert.equal(checklist.find(item => item.id === 'error-log').command, 'node scripts/release-preflight.js --check error-log');
  assert.equal(checklist.find(item => item.id === 'error-log').manual, false);
  assert.equal(checklist.find(item => item.id === 'error-log').runGroup, 'fast');
  assert.match(checklist.find(item => item.id === 'error-log').note, /开放未解决项/);
  assert.equal(checklist.find(item => item.id === 'render-qa').command, 'npm run verify:pet-render');
  assert.equal(checklist.find(item => item.id === 'screen-pipeline').command, 'npm run test:screen-pipeline');
  assert.equal(checklist.find(item => item.id === 'screen-pipeline').runGroup, 'full');
  assert.equal(checklist.find(item => item.id === 'package-scripts').command, 'node scripts/release-preflight.js --check package-scripts');
  assert.equal(checklist.find(item => item.id === 'package-scripts').runGroup, 'fast');
  assert.equal(checklist.find(item => item.id === 'chat-backend-deploy').command, 'node scripts/release-preflight.js --check chat-backend-deploy');
  assert.equal(checklist.find(item => item.id === 'chat-backend-deploy').runGroup, 'fast');
  assert.equal(checklist.find(item => item.id === 'mac-package').platform, 'darwin');
  assert.equal(checklist.find(item => item.id === 'mac-remote-client-package').command, 'npm run package:mac:remote-client');
  assert.equal(checklist.find(item => item.id === 'mac-remote-client-package').platform, 'darwin');
  assert.equal(checklist.find(item => item.id === 'mac-remote-client-package').runGroup, 'package');
  assert.equal(checklist.find(item => item.id === 'mac-remote-client-package').manual, true);
  assert.equal(checklist.find(item => item.id === 'mac-notarization').command, 'npm run notarize:mac && npm run verify:mac');
  assert.equal(checklist.find(item => item.id === 'mac-notarization').platform, 'darwin');
  assert.equal(checklist.find(item => item.id === 'mac-notarization').runGroup, 'package');
  assert.equal(checklist.find(item => item.id === 'windows-package').platform, 'win32');

  const fastIds = selectReleasePreflightItems(checklist, { run: 'fast' }).map(item => item.id);
  assert.deepEqual(fastIds, ['node-tests', 'syntax-check', 'diagnostics-summary', 'diagnostics-bundle', 'diagnostics-bundle-output', 'package-scripts', 'chat-backend-deploy', 'docs-boundary', 'optimization-plan', 'error-log']);
  const fullIds = selectReleasePreflightItems(checklist, { run: 'full' }).map(item => item.id);
  assert.deepEqual(fullIds, ['node-tests', 'syntax-check', 'diagnostics-summary', 'diagnostics-bundle', 'diagnostics-bundle-output', 'render-qa', 'screen-pipeline', 'package-scripts', 'chat-backend-deploy', 'docs-boundary', 'optimization-plan', 'error-log']);
  const packageIds = selectReleasePreflightItems(checklist, { run: 'package' }).map(item => item.id);
  assert.deepEqual(packageIds, ['mac-package', 'mac-signing', 'mac-notarization']);
  assert.deepEqual(parseArgs(['--json', '--run=fast', '--check=error-log']), {
    json: true,
    run: 'fast',
    check: 'error-log'
  });

  const cleanSummary = {
    schemaVersion: 1,
    version: '1.0.0',
    generatedAt: '2026-06-30T10:00:00.000Z',
    platform: 'darwin',
    permissions: {},
    settings: {},
    tasks: {},
    activity: {},
    chat: {},
    storage: {},
    logs: {},
    recentErrors: []
  };
  const cleanSummaryOutput = runDiagnosticsSummaryOutputCheck(PROJECT_ROOT, {
    summary: cleanSummary
  });
  assert.equal(cleanSummaryOutput.ok, true);
  assert.equal(cleanSummaryOutput.summaryJsonValid, true);
  assert.equal(cleanSummaryOutput.summarySchemaValid, true);
  assert.equal(cleanSummaryOutput.summaryGeneratedAtValid, true);
  assert.deepEqual(cleanSummaryOutput.summaryMissingTopLevelKeys, []);
  assert.equal(cleanSummaryOutput.summaryUnexpectedTopLevelKeyCount, 0);
  assert.deepEqual(cleanSummaryOutput.summaryBoundaryIssues, []);

  const windowsPathSummaryOutput = runDiagnosticsSummaryOutputCheck(PROJECT_ROOT, {
    summary: {
      ...cleanSummary,
      logs: {
        recent: [{
          level: 'error',
          message: 'failed at C:\\Users\\Alice\\AppData\\Local\\FocusPet\\secret.log'
        }]
      }
    }
  });
  assert.equal(windowsPathSummaryOutput.ok, false);
  assert.equal(windowsPathSummaryOutput.summarySchemaValid, true);
  assert.deepEqual(windowsPathSummaryOutput.summaryBoundaryIssues, ['absolute-path']);
  assert.doesNotMatch(JSON.stringify(windowsPathSummaryOutput), /C:\\Users\\Alice\\AppData\\Local\\FocusPet\\secret\.log/);

  const invalidTimeSummaryOutput = runDiagnosticsSummaryOutputCheck(PROJECT_ROOT, {
    summary: { ...cleanSummary, generatedAt: 'not-a-date' }
  });
  assert.equal(invalidTimeSummaryOutput.ok, false);
  assert.equal(invalidTimeSummaryOutput.summarySchemaValid, false);
  assert.equal(invalidTimeSummaryOutput.summaryGeneratedAtValid, false);

  const incompleteSummaryOutput = runDiagnosticsSummaryOutputCheck(PROJECT_ROOT, {
    summary: {
      schemaVersion: 1,
      generatedAt: '2026-06-30T10:00:00.000Z'
    }
  });
  assert.equal(incompleteSummaryOutput.ok, false);
  assert.equal(incompleteSummaryOutput.summaryJsonValid, true);
  assert.equal(incompleteSummaryOutput.summarySchemaValid, false);
  assert.deepEqual(incompleteSummaryOutput.summaryMissingTopLevelKeys, [
    'version',
    'platform',
    'permissions',
    'settings',
    'tasks',
    'activity',
    'chat',
    'storage',
    'logs',
    'recentErrors'
  ]);
  assert.equal(incompleteSummaryOutput.summaryUnexpectedTopLevelKeyCount, 0);

  const unexpectedSummaryOutput = runDiagnosticsSummaryOutputCheck(PROJECT_ROOT, {
    summary: { ...cleanSummary, rawDiagnosticPayload: { taskText: 'hidden raw task text' } }
  });
  assert.equal(unexpectedSummaryOutput.ok, false);
  assert.equal(unexpectedSummaryOutput.summarySchemaValid, false);
  assert.deepEqual(unexpectedSummaryOutput.summaryMissingTopLevelKeys, []);
  assert.equal(unexpectedSummaryOutput.summaryUnexpectedTopLevelKeyCount, 1);
  assert.doesNotMatch(JSON.stringify(unexpectedSummaryOutput), /rawDiagnosticPayload|hidden raw task text/);

  const jsonSecretSummaryOutput = runDiagnosticsSummaryOutputCheck(PROJECT_ROOT, {
    summary: {
      ...cleanSummary,
      settings: { apiKey: 'abcdefghijklmnopqrstuvwxyz123456' },
      chat: { sessionToken: 'session-token-abcdefghijklmnopqrstuvwxyz123456' }
    }
  });
  assert.equal(jsonSecretSummaryOutput.ok, false);
  assert.equal(jsonSecretSummaryOutput.summarySchemaValid, true);
  assert.deepEqual(jsonSecretSummaryOutput.summaryBoundaryIssues, ['json-secret-field']);
  assert.doesNotMatch(JSON.stringify(jsonSecretSummaryOutput), /apiKey|sessionToken|abcdefghijklmnopqrstuvwxyz123456/);

  const rawFieldSummaryOutput = runDiagnosticsSummaryOutputCheck(PROJECT_ROOT, {
    summary: {
      ...cleanSummary,
      activity: { recentDecisions: [{ windowTitle: 'Secret launch window', rawReason: 'Secret raw reason' }] },
      settings: { endpoint: 'https://llm.example.com/v1/chat/completions', model: 'secret-model-name' },
      tasks: { taskText: 'Secret launch task' }
    }
  });
  assert.equal(rawFieldSummaryOutput.ok, false);
  assert.equal(rawFieldSummaryOutput.summarySchemaValid, true);
  assert.deepEqual(rawFieldSummaryOutput.summaryBoundaryIssues, ['json-raw-field', 'url']);
  assert.doesNotMatch(JSON.stringify(rawFieldSummaryOutput), /windowTitle|rawReason|endpoint|secret-model-name|Secret launch/);

  const internalRawFieldSummaryOutput = runDiagnosticsSummaryOutputCheck(PROJECT_ROOT, {
    summary: {
      ...cleanSummary,
      activity: { recentDecisions: [{ currentTask: { text: 'Secret launch task' }, frontmost: { app: 'SecretApp' }, sourceName: 'Secret Screen' }] },
      recentErrors: [{ rawIssueKey: 'Secret issue key' }]
    }
  });
  assert.equal(internalRawFieldSummaryOutput.ok, false);
  assert.equal(internalRawFieldSummaryOutput.summarySchemaValid, true);
  assert.deepEqual(internalRawFieldSummaryOutput.summaryBoundaryIssues, ['json-raw-field']);
  assert.doesNotMatch(JSON.stringify(internalRawFieldSummaryOutput), /currentTask|frontmost|sourceName|rawIssueKey|Secret launch task|SecretApp|Secret Screen|Secret issue key/);

  const leakySummaryCheck = runDiagnosticsSummaryOutputCheck(PROJECT_ROOT, {
    summary: {
      schemaVersion: 1,
      leakedPath: '/Users/sxlx/focus-pet/secret.log',
      leakedBearer: 'Bearer abcdefghijklmnopqrstuvwxyz123456',
      leakedEnv: 'FOCUS_PET_API_KEY=abcdefghijklmnopqrstuvwxyz123456',
      leakedPlainAssignment: 'apiKey=screen-key-123',
      leakedImage: 'data:image/png;base64,abcdefghijklmnopqrstuvwxyz123456',
      leakedTurn: 'turn:example.invalid?transport=udp',
      leakedUrl: 'https://llm.example.com/v1/chat/completions',
      leakedWebSocketUrl: 'wss://chat.example.com/socket?token=SECRET'
    }
  });
  assert.equal(leakySummaryCheck.ok, false);
  assert.deepEqual(leakySummaryCheck.summaryBoundaryIssues, [
    'absolute-path',
    'bearer-token',
    'data-url',
    'env-secret',
    'secret-assignment',
    'turn-url',
    'url',
    'websocket-url'
  ]);
  assert.doesNotMatch(JSON.stringify(leakySummaryCheck), /secret\.log|abcdefghijklmnopqrstuvwxyz123456|apiKey|screen-key|example\.invalid|llm\.example\.com|chat\.example\.com/);

  const bundleOutputDir = tempDir('release-preflight-diagnostics-bundle-output');
  const bundleDir = path.join(bundleOutputDir, 'focus-pet-diagnostics-20260630-100000');
  fs.mkdirSync(bundleDir, { recursive: true });
  fs.writeFileSync(path.join(bundleDir, 'summary.json'), JSON.stringify(cleanSummary), 'utf8');
  fs.writeFileSync(path.join(bundleDir, 'manifest.md'), '# Focus Pet 诊断包\n\n诊断包：focus-pet-diagnostics-20260630-100000\n\n- summary.json\n', 'utf8');
  const bundleOutput = runDiagnosticsBundleOutputCheck(PROJECT_ROOT, { outputDir: bundleOutputDir });
  assert.equal(bundleOutput.ok, true);
  assert.equal(bundleOutput.latestName, 'focus-pet-diagnostics-20260630-100000');
  assert.deepEqual(bundleOutput.files, ['manifest.md', 'summary.json']);
  assert.equal(bundleOutput.summarySchemaValid, true);
  assert.deepEqual(bundleOutput.summaryMissingTopLevelKeys, []);
  assert.equal(bundleOutput.summaryUnexpectedTopLevelKeyCount, 0);
  assert.equal(bundleOutput.manifestReferencesBundle, true);
  assert.equal(bundleOutput.summaryMatchesBundleName, true);

  const staleManifestOutputDir = tempDir('release-preflight-diagnostics-bundle-output-stale-manifest');
  const staleManifestDir = path.join(staleManifestOutputDir, 'focus-pet-diagnostics-20260630-100000');
  fs.mkdirSync(staleManifestDir, { recursive: true });
  fs.writeFileSync(path.join(staleManifestDir, 'summary.json'), JSON.stringify(cleanSummary), 'utf8');
  fs.writeFileSync(path.join(staleManifestDir, 'manifest.md'), '# Focus Pet 诊断包\n\n诊断包：focus-pet-diagnostics-20260630-095959\n\n- summary.json\n', 'utf8');
  const staleManifestOutput = runDiagnosticsBundleOutputCheck(PROJECT_ROOT, { outputDir: staleManifestOutputDir });
  assert.equal(staleManifestOutput.ok, false);
  assert.equal(staleManifestOutput.manifestReferencesBundle, false);
  assert.equal(staleManifestOutput.summaryMatchesBundleName, true);

  const staleSummaryOutputDir = tempDir('release-preflight-diagnostics-bundle-output-stale-summary');
  const staleSummaryDir = path.join(staleSummaryOutputDir, 'focus-pet-diagnostics-20260630-100000');
  fs.mkdirSync(staleSummaryDir, { recursive: true });
  fs.writeFileSync(path.join(staleSummaryDir, 'summary.json'), JSON.stringify({ ...cleanSummary, generatedAt: '2026-06-30T09:59:59.000Z' }), 'utf8');
  fs.writeFileSync(path.join(staleSummaryDir, 'manifest.md'), '# Focus Pet 诊断包\n\n诊断包：focus-pet-diagnostics-20260630-100000\n\n- summary.json\n', 'utf8');
  const staleSummaryOutput = runDiagnosticsBundleOutputCheck(PROJECT_ROOT, { outputDir: staleSummaryOutputDir });
  assert.equal(staleSummaryOutput.ok, false);
  assert.equal(staleSummaryOutput.manifestReferencesBundle, true);
  assert.equal(staleSummaryOutput.summaryMatchesBundleName, false);

  const incompleteBundleOutputDir = tempDir('release-preflight-diagnostics-bundle-output-incomplete-summary');
  const incompleteBundleDir = path.join(incompleteBundleOutputDir, 'focus-pet-diagnostics-20260630-100000');
  fs.mkdirSync(incompleteBundleDir, { recursive: true });
  fs.writeFileSync(path.join(incompleteBundleDir, 'summary.json'), JSON.stringify({ schemaVersion: 1, generatedAt: '2026-06-30T10:00:00.000Z' }), 'utf8');
  fs.writeFileSync(path.join(incompleteBundleDir, 'manifest.md'), '# Focus Pet 诊断包\n\n诊断包：focus-pet-diagnostics-20260630-100000\n\n- summary.json\n', 'utf8');
  const incompleteBundleOutput = runDiagnosticsBundleOutputCheck(PROJECT_ROOT, { outputDir: incompleteBundleOutputDir });
  assert.equal(incompleteBundleOutput.ok, false);
  assert.equal(incompleteBundleOutput.summaryJsonValid, true);
  assert.equal(incompleteBundleOutput.summarySchemaValid, false);
  assert.ok(incompleteBundleOutput.summaryMissingTopLevelKeys.includes('tasks'));

  const unexpectedBundleOutputDir = tempDir('release-preflight-diagnostics-bundle-output-unexpected-summary-key');
  const unexpectedBundleDir = path.join(unexpectedBundleOutputDir, 'focus-pet-diagnostics-20260630-100000');
  fs.mkdirSync(unexpectedBundleDir, { recursive: true });
  fs.writeFileSync(path.join(unexpectedBundleDir, 'summary.json'), JSON.stringify({ ...cleanSummary, rawDiagnosticPayload: { taskText: 'hidden raw task text' } }), 'utf8');
  fs.writeFileSync(path.join(unexpectedBundleDir, 'manifest.md'), '# Focus Pet 诊断包\n\n诊断包：focus-pet-diagnostics-20260630-100000\n\n- summary.json\n', 'utf8');
  const unexpectedBundleOutput = runDiagnosticsBundleOutputCheck(PROJECT_ROOT, { outputDir: unexpectedBundleOutputDir });
  assert.equal(unexpectedBundleOutput.ok, false);
  assert.equal(unexpectedBundleOutput.summarySchemaValid, false);
  assert.equal(unexpectedBundleOutput.summaryUnexpectedTopLevelKeyCount, 1);
  assert.doesNotMatch(JSON.stringify(unexpectedBundleOutput), /rawDiagnosticPayload|hidden raw task text/);

  const jsonSecretBundleOutputDir = tempDir('release-preflight-diagnostics-bundle-output-json-secret');
  const jsonSecretBundleDir = path.join(jsonSecretBundleOutputDir, 'focus-pet-diagnostics-20260630-100000');
  fs.mkdirSync(jsonSecretBundleDir, { recursive: true });
  fs.writeFileSync(path.join(jsonSecretBundleDir, 'summary.json'), JSON.stringify({
    ...cleanSummary,
    settings: { apiKey: 'abcdefghijklmnopqrstuvwxyz123456' },
    chat: { inviteCode: 'INVITE-abcdefghijklmnopqrstuvwxyz123456' }
  }), 'utf8');
  fs.writeFileSync(path.join(jsonSecretBundleDir, 'manifest.md'), '# Focus Pet 诊断包\n\n诊断包：focus-pet-diagnostics-20260630-100000\n\n- summary.json\n', 'utf8');
  const jsonSecretBundleOutput = runDiagnosticsBundleOutputCheck(PROJECT_ROOT, { outputDir: jsonSecretBundleOutputDir });
  assert.equal(jsonSecretBundleOutput.ok, false);
  assert.equal(jsonSecretBundleOutput.summarySchemaValid, true);
  assert.deepEqual(jsonSecretBundleOutput.summaryBoundaryIssues, ['json-secret-field']);
  assert.doesNotMatch(JSON.stringify(jsonSecretBundleOutput), /apiKey|inviteCode|abcdefghijklmnopqrstuvwxyz123456/);

  const rawFieldBundleOutputDir = tempDir('release-preflight-diagnostics-bundle-output-raw-field');
  const rawFieldBundleDir = path.join(rawFieldBundleOutputDir, 'focus-pet-diagnostics-20260630-100000');
  fs.mkdirSync(rawFieldBundleDir, { recursive: true });
  fs.writeFileSync(path.join(rawFieldBundleDir, 'summary.json'), JSON.stringify({
    ...cleanSummary,
    activity: { recentDecisions: [{ windowTitle: 'Secret launch window', rawReason: 'Secret raw reason' }] },
    settings: { endpoint: 'https://llm.example.com/v1/chat/completions', model: 'secret-model-name' },
    tasks: { taskText: 'Secret launch task' }
  }), 'utf8');
  fs.writeFileSync(path.join(rawFieldBundleDir, 'manifest.md'), '# Focus Pet 诊断包\n\n诊断包：focus-pet-diagnostics-20260630-100000\n\n- summary.json\n', 'utf8');
  const rawFieldBundleOutput = runDiagnosticsBundleOutputCheck(PROJECT_ROOT, { outputDir: rawFieldBundleOutputDir });
  assert.equal(rawFieldBundleOutput.ok, false);
  assert.equal(rawFieldBundleOutput.summarySchemaValid, true);
  assert.deepEqual(rawFieldBundleOutput.summaryBoundaryIssues, ['json-raw-field', 'url']);
  assert.doesNotMatch(JSON.stringify(rawFieldBundleOutput), /windowTitle|rawReason|endpoint|secret-model-name|Secret launch/);

  const internalRawFieldBundleOutputDir = tempDir('release-preflight-diagnostics-bundle-output-internal-raw-field');
  const internalRawFieldBundleDir = path.join(internalRawFieldBundleOutputDir, 'focus-pet-diagnostics-20260630-100000');
  fs.mkdirSync(internalRawFieldBundleDir, { recursive: true });
  fs.writeFileSync(path.join(internalRawFieldBundleDir, 'summary.json'), JSON.stringify({
    ...cleanSummary,
    activity: { recentDecisions: [{ currentTask: { text: 'Secret launch task' }, frontmost: { app: 'SecretApp' }, sourceName: 'Secret Screen' }] },
    recentErrors: [{ rawIssueKey: 'Secret issue key' }]
  }), 'utf8');
  fs.writeFileSync(path.join(internalRawFieldBundleDir, 'manifest.md'), '# Focus Pet 诊断包\n\n诊断包：focus-pet-diagnostics-20260630-100000\n\n- summary.json\n', 'utf8');
  const internalRawFieldBundleOutput = runDiagnosticsBundleOutputCheck(PROJECT_ROOT, { outputDir: internalRawFieldBundleOutputDir });
  assert.equal(internalRawFieldBundleOutput.ok, false);
  assert.equal(internalRawFieldBundleOutput.summarySchemaValid, true);
  assert.deepEqual(internalRawFieldBundleOutput.summaryBoundaryIssues, ['json-raw-field']);
  assert.doesNotMatch(JSON.stringify(internalRawFieldBundleOutput), /currentTask|frontmost|sourceName|rawIssueKey|Secret launch task|SecretApp|Secret Screen|Secret issue key/);

  const badBundleOutputDir = tempDir('release-preflight-diagnostics-bundle-output-bad');
  const badBundleDir = path.join(badBundleOutputDir, 'focus-pet-diagnostics-20260630-100000');
  fs.mkdirSync(badBundleDir, { recursive: true });
  fs.writeFileSync(path.join(badBundleDir, 'summary.json'), '{"schemaVersion":1}', 'utf8');
  fs.writeFileSync(path.join(badBundleDir, 'manifest.md'), '# Focus Pet 诊断包\n\n- summary.json\n', 'utf8');
  fs.writeFileSync(path.join(badBundleDir, 'raw.log'), 'should not ship', 'utf8');
  const badBundleOutput = runDiagnosticsBundleOutputCheck(PROJECT_ROOT, { outputDir: badBundleOutputDir });
  assert.equal(badBundleOutput.ok, false);
  assert.deepEqual(badBundleOutput.unexpectedFiles, ['raw.log']);

  const leakyManifestOutputDir = tempDir('release-preflight-diagnostics-bundle-output-leaky-manifest');
  const leakyManifestDir = path.join(leakyManifestOutputDir, 'focus-pet-diagnostics-20260630-100000');
  fs.mkdirSync(leakyManifestDir, { recursive: true });
  fs.writeFileSync(path.join(leakyManifestDir, 'summary.json'), JSON.stringify({ schemaVersion: 1 }), 'utf8');
  fs.writeFileSync(path.join(leakyManifestDir, 'manifest.md'), [
    '# Focus Pet 诊断包',
    '',
    '- summary.json',
    '/Users/sxlx/focus-pet/secret.log',
    'Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456',
    'FOCUS_PET_API_KEY=abcdefghijklmnopqrstuvwxyz123456',
    'authToken=owner-token-456',
    'data:image/png;base64,abcdefghijklmnopqrstuvwxyz123456',
    'turn:example.invalid?transport=udp',
    'https://chat.example.com/client?invite=SECRET',
    'wss://chat.example.com/socket?token=SECRET',
    ''
  ].join('\n'), 'utf8');
  const leakyManifestOutput = runDiagnosticsBundleOutputCheck(PROJECT_ROOT, { outputDir: leakyManifestOutputDir });
  assert.equal(leakyManifestOutput.ok, false);
  assert.deepEqual(leakyManifestOutput.manifestBoundaryIssues, [
    'absolute-path',
    'bearer-token',
    'data-url',
    'env-secret',
    'secret-assignment',
    'turn-url',
    'url',
    'websocket-url'
  ]);

  const leakySummaryOutputDir = tempDir('release-preflight-diagnostics-bundle-output-leaky-summary');
  const leakySummaryDir = path.join(leakySummaryOutputDir, 'focus-pet-diagnostics-20260630-100000');
  fs.mkdirSync(leakySummaryDir, { recursive: true });
  fs.writeFileSync(path.join(leakySummaryDir, 'summary.json'), JSON.stringify({
    schemaVersion: 1,
    generatedAt: '2026-06-30T10:00:00.000Z',
    leakedPath: '/Users/sxlx/focus-pet/secret.log',
    leakedBearer: 'Bearer abcdefghijklmnopqrstuvwxyz123456',
    leakedEnv: 'FOCUS_PET_API_KEY=abcdefghijklmnopqrstuvwxyz123456',
    leakedPlainAssignment: 'sessionToken=peer-token-789',
    leakedImage: 'data:image/png;base64,abcdefghijklmnopqrstuvwxyz123456',
    leakedTurn: 'turn:example.invalid?transport=udp',
    leakedUrl: 'https://llm.example.com/v1/chat/completions',
    leakedWebSocketUrl: 'ws://127.0.0.1:47321/socket?token=SECRET'
  }), 'utf8');
  fs.writeFileSync(path.join(leakySummaryDir, 'manifest.md'), '# Focus Pet 诊断包\n\n- summary.json\n', 'utf8');
  const leakySummaryOutput = runDiagnosticsBundleOutputCheck(PROJECT_ROOT, { outputDir: leakySummaryOutputDir });
  assert.equal(leakySummaryOutput.ok, false);
  assert.deepEqual(leakySummaryOutput.summaryBoundaryIssues, [
    'absolute-path',
    'bearer-token',
    'data-url',
    'env-secret',
    'secret-assignment',
    'turn-url',
    'url',
    'websocket-url'
  ]);
  assert.doesNotMatch(JSON.stringify(leakySummaryOutput), /secret\.log|abcdefghijklmnopqrstuvwxyz123456|sessionToken|peer-token|example\.invalid|llm\.example\.com|127\.0\.0\.1/);

  const docsBoundary = runDocsBoundaryCheck(PROJECT_ROOT);
  assert.equal(docsBoundary.ok, true);
  assert.deepEqual(docsBoundary.missingDocs, []);
  assert.deepEqual(docsBoundary.missingExclusions, []);
  assert.deepEqual(docsBoundary.forbiddenSourceMatches, []);

  const excludedSourceBoundaryRoot = tempDir('release-preflight-docs-boundary-excluded-source-names');
  for (const docPath of [
    'docs/optimization-plan.md',
    'docs/system-overview.md',
    'docs/social-security-boundary.md',
    'docs/diagnostics.md',
    'docs/storage-recovery.md',
    'docs/task-model.md'
  ]) {
    fs.mkdirSync(path.dirname(path.join(excludedSourceBoundaryRoot, docPath)), { recursive: true });
    fs.writeFileSync(path.join(excludedSourceBoundaryRoot, docPath), docPath === 'docs/optimization-plan.md'
      ? ['- 隐私模式。', '- 敏感 App。', '- 窗口标题脱敏。', '- 用户纠错。'].join('\n')
      : '# Boundary doc\n', 'utf8');
  }
  fs.mkdirSync(path.join(excludedSourceBoundaryRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(excludedSourceBoundaryRoot, 'src', 'excluded-names.txt'), [
    'privacy_mode',
    'sensitive-apps',
    'title_redaction',
    'user-correction'
  ].join('\n'), 'utf8');
  const excludedSourceBoundary = runDocsBoundaryCheck(excludedSourceBoundaryRoot);
  assert.equal(excludedSourceBoundary.ok, false);
  assert.deepEqual(excludedSourceBoundary.missingDocs, []);
  assert.deepEqual(excludedSourceBoundary.missingExclusions, []);
  assert.deepEqual(excludedSourceBoundary.forbiddenSourceMatches, [
    { file: 'src/excluded-names.txt', line: 1, term: 'privacy_mode' },
    { file: 'src/excluded-names.txt', line: 2, term: 'sensitive-apps' },
    { file: 'src/excluded-names.txt', line: 3, term: 'title_redaction' },
    { file: 'src/excluded-names.txt', line: 4, term: 'user-correction' }
  ]);

  const optimizationPlan = runOptimizationPlanCheck(PROJECT_ROOT);
  assert.equal(optimizationPlan.ok, true);
  assert.equal(optimizationPlan.exists, true);
  assert.deepEqual(optimizationPlan.missingSections, []);
  assert.deepEqual(optimizationPlan.missingAcceptanceSections, []);
  assert.deepEqual(optimizationPlan.emptyAcceptanceSections, []);
  assert.deepEqual(optimizationPlan.incompleteAcceptanceItems, []);
  assert.deepEqual(optimizationPlan.missingExclusions, []);

  const incompletePlanRoot = tempDir('release-preflight-optimization-plan-incomplete');
  fs.mkdirSync(path.join(incompletePlanRoot, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(incompletePlanRoot, 'docs', 'optimization-plan.md'), [
    '# Focus Pet 优化方案',
    '',
    '- 隐私模式。',
    '- 敏感 App。',
    '- 标题脱敏。',
    '- 用户纠错。',
    '',
    '### 3.1 干预策略引擎',
    '',
    '当前 3.1 验收状态：',
    '',
    '- 低打扰策略：未完成',
    '- 诊断包新鲜度：部分完成',
    '- package 清单：待完成',
    '- full gate：进行中',
    '- 渲染 QA - 尚未完成',
    '- screen pipeline（未达成）',
    '- 公证验证 未通过'
  ].join('\n'), 'utf8');
  const incompletePlan = runOptimizationPlanCheck(incompletePlanRoot);
  assert.equal(incompletePlan.ok, false);
  assert.ok(incompletePlan.missingSections.includes('3.2'));
  assert.ok(incompletePlan.missingAcceptanceSections.includes('3.2'));
  assert.deepEqual(incompletePlan.incompleteAcceptanceItems, [
    { section: '3.1', line: 12 },
    { section: '3.1', line: 13 },
    { section: '3.1', line: 14 },
    { section: '3.1', line: 15 },
    { section: '3.1', line: 16 },
    { section: '3.1', line: 17 },
    { section: '3.1', line: 18 }
  ]);

  const emptyAcceptancePlanRoot = tempDir('release-preflight-optimization-plan-empty-acceptance');
  fs.mkdirSync(path.join(emptyAcceptancePlanRoot, 'docs'), { recursive: true });
  const emptyAcceptancePlanLines = [
    '# Focus Pet 优化方案',
    '',
    '- 隐私模式。',
    '- 敏感 App。',
    '- 标题脱敏。',
    '- 用户纠错。',
    ''
  ];
  for (const section of ['3.1', '3.2', '3.3', '3.4', '4.1', '4.2', '4.3', '4.4', '4.5', '5.1', '5.2', '5.3']) {
    emptyAcceptancePlanLines.push(
      `### ${section} 测试章节`,
      '',
      `当前 ${section} 验收状态：`,
      ''
    );
    if (section !== '3.1') {
      emptyAcceptancePlanLines.push('- 基础验收：已完成', '');
    }
  }
  fs.writeFileSync(path.join(emptyAcceptancePlanRoot, 'docs', 'optimization-plan.md'), emptyAcceptancePlanLines.join('\n'), 'utf8');
  const emptyAcceptancePlan = runOptimizationPlanCheck(emptyAcceptancePlanRoot);
  assert.equal(emptyAcceptancePlan.ok, false);
  assert.deepEqual(emptyAcceptancePlan.missingSections, []);
  assert.deepEqual(emptyAcceptancePlan.missingAcceptanceSections, []);
  assert.deepEqual(emptyAcceptancePlan.emptyAcceptanceSections, ['3.1']);

  const packageScripts = runPackageScriptsCheck(PROJECT_ROOT);
  assert.equal(packageScripts.ok, true);
  assert.deepEqual(packageScripts.missingScripts, []);
  assert.deepEqual(packageScripts.mismatchedCommands, []);
  assert.deepEqual(packageScripts.missingFiles, []);
  assert.deepEqual(packageScripts.missingCheckEntries, []);
  assert.deepEqual(packageScripts.checkedScripts, [
    'package:mac',
    'package:win',
    'package:mac:remote-client',
    'sign:mac',
    'notarize:mac',
    'verify:mac',
    'verify:pet-render',
    'test:screen-pipeline'
  ]);

  const chatBackendDeploy = runChatBackendDeployCheck(PROJECT_ROOT);
  assert.equal(chatBackendDeploy.ok, true);
  assert.equal(chatBackendDeploy.dockerfileExists, true);
  assert.deepEqual(chatBackendDeploy.missingFiles, []);
  assert.deepEqual(chatBackendDeploy.missingScripts, []);
  assert.deepEqual(chatBackendDeploy.mismatchedScripts, []);
  assert.deepEqual(chatBackendDeploy.missingDockerfileRequirements, []);
  assert.deepEqual(chatBackendDeploy.missingRuntimeRequirements, []);
  assert.deepEqual(chatBackendDeploy.forbiddenRuntimeMatches, []);

  const incompleteChatDeployRoot = tempDir('release-preflight-chat-backend-deploy-incomplete');
  fs.mkdirSync(path.join(incompleteChatDeployRoot, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(incompleteChatDeployRoot, 'Dockerfile'), [
    'FROM node:22-alpine',
    'WORKDIR /app',
    'CMD ["npm", "start"]'
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(incompleteChatDeployRoot, 'package.json'), JSON.stringify({
    scripts: {
      start: 'node scripts/run-chat-service.js'
    }
  }), 'utf8');
  fs.writeFileSync(path.join(incompleteChatDeployRoot, 'scripts', 'run-chat-service.js'), 'console.log("start");\n', 'utf8');
  const incompleteChatBackendDeploy = runChatBackendDeployCheck(incompleteChatDeployRoot);
  assert.equal(incompleteChatBackendDeploy.ok, false);
  assert.ok(incompleteChatBackendDeploy.missingFiles.includes('src/chat-service.js'));
  assert.ok(incompleteChatBackendDeploy.missingScripts.includes('chat:serve'));
  assert.ok(incompleteChatBackendDeploy.missingDockerfileRequirements.includes('production-dependency-install'));
  assert.ok(incompleteChatBackendDeploy.missingDockerfileRequirements.includes('healthcheck-healthz'));
  assert.ok(incompleteChatBackendDeploy.missingDockerfileRequirements.includes('chat-serve-cmd'));
  assert.ok(incompleteChatBackendDeploy.missingRuntimeRequirements.includes('chat-service-require'));
  assert.ok(incompleteChatBackendDeploy.missingRuntimeRequirements.includes('sigterm-shutdown'));

  const leakyChatDeployRoot = tempDir('release-preflight-chat-backend-deploy-leaky-startup-log');
  fs.mkdirSync(path.join(leakyChatDeployRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(leakyChatDeployRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(leakyChatDeployRoot, 'Dockerfile'), [
    'FROM node:22-alpine AS deps',
    'WORKDIR /app',
    'RUN npm ci --omit=dev',
    'FROM node:22-alpine AS runtime',
    'ENV FOCUS_PET_CHAT_HOST=0.0.0.0 FOCUS_PET_CHAT_DATA_DIR=/data/focus-pet-social',
    'RUN mkdir -p /data/focus-pet-social',
    'HEALTHCHECK CMD node -e "fetch(`http://127.0.0.1:47321/healthz`).then(r=>process.exit(r.ok?0:1))"',
    'CMD ["npm", "run", "chat:serve"]'
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(leakyChatDeployRoot, 'package.json'), JSON.stringify({
    scripts: {
      'chat:serve': 'node scripts/run-chat-service.js'
    }
  }), 'utf8');
  fs.writeFileSync(path.join(leakyChatDeployRoot, 'src', 'chat-service.js'), '', 'utf8');
  fs.writeFileSync(path.join(leakyChatDeployRoot, 'scripts', 'run-chat-service.js'), [
    "const chatService = require('../src/chat-service');",
    "process.on('SIGTERM', () => chatService.stop());",
    "process.on('unhandledRejection', error => console.error(error?.stack || error));",
    "console.log(JSON.stringify(chatService.publicState()));",
    "const state = chatService.publicState();",
    "console.log(JSON.stringify(state));",
    "const { inviteUrl } = chatService.publicState();",
    "console.log(inviteUrl);",
    "const { authToken: ownerToken, sessions } = chatService.publicState();",
    "console.error(ownerToken);",
    "console.log(JSON.stringify(sessions));",
    "console.log(JSON.stringify({ inviteUrl: state.inviteUrl, inviteCode: state.inviteCode, authToken: state.authToken, sessionToken: state.sessions?.[0]?.token }));"
  ].join('\n'), 'utf8');
  const leakyChatBackendDeploy = runChatBackendDeployCheck(leakyChatDeployRoot);
  assert.equal(leakyChatBackendDeploy.ok, false);
  assert.deepEqual(leakyChatBackendDeploy.forbiddenRuntimeMatches, [
    'startup-invite-url-output',
    'startup-invite-code-output',
    'startup-auth-token-output',
    'startup-session-token-output',
    'startup-public-state-output',
    'startup-public-state-variable-output',
    'startup-public-state-sensitive-property-output',
    'startup-public-state-destructured-sensitive-output',
    'unsanitized-startup-error-output'
  ]);

  const alternateConsolePublicStateChatDeployRoot = tempDir('release-preflight-chat-backend-deploy-alternate-console-public-state');
  fs.mkdirSync(path.join(alternateConsolePublicStateChatDeployRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(alternateConsolePublicStateChatDeployRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(alternateConsolePublicStateChatDeployRoot, 'Dockerfile'), [
    'FROM node:22-alpine AS deps',
    'WORKDIR /app',
    'RUN npm ci --omit=dev',
    'FROM node:22-alpine AS runtime',
    'ENV FOCUS_PET_CHAT_HOST=0.0.0.0 FOCUS_PET_CHAT_DATA_DIR=/data/focus-pet-social',
    'RUN mkdir -p /data/focus-pet-social',
    'HEALTHCHECK CMD node -e "fetch(`http://127.0.0.1:47321/healthz`).then(r=>process.exit(r.ok?0:1))"',
    'CMD ["npm", "run", "chat:serve"]'
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(alternateConsolePublicStateChatDeployRoot, 'package.json'), JSON.stringify({
    scripts: {
      'chat:serve': 'node scripts/run-chat-service.js'
    }
  }), 'utf8');
  fs.writeFileSync(path.join(alternateConsolePublicStateChatDeployRoot, 'src', 'chat-service.js'), '', 'utf8');
  fs.writeFileSync(path.join(alternateConsolePublicStateChatDeployRoot, 'scripts', 'run-chat-service.js'), [
    "const chatService = require('../src/chat-service');",
    "process.on('SIGTERM', () => chatService.stop());",
    "console.info(JSON.stringify(chatService.publicState()));",
    "const state = chatService.publicState();",
    "console.warn(state);",
    "const { inviteUrl } = chatService.publicState();",
    "console.debug({ inviteUrl });",
    "console.trace(`invite ${inviteUrl}`);"
  ].join('\n'), 'utf8');
  const alternateConsolePublicStateChatBackendDeploy = runChatBackendDeployCheck(alternateConsolePublicStateChatDeployRoot);
  assert.equal(alternateConsolePublicStateChatBackendDeploy.ok, false);
  assert.deepEqual(alternateConsolePublicStateChatBackendDeploy.forbiddenRuntimeMatches, [
    'startup-public-state-output',
    'startup-public-state-variable-output',
    'startup-public-state-destructured-sensitive-output'
  ]);

  const wrappedDirectPublicStateChatDeployRoot = tempDir('release-preflight-chat-backend-deploy-wrapped-direct-public-state-output');
  fs.mkdirSync(path.join(wrappedDirectPublicStateChatDeployRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(wrappedDirectPublicStateChatDeployRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(wrappedDirectPublicStateChatDeployRoot, 'Dockerfile'), [
    'FROM node:22-alpine AS deps',
    'WORKDIR /app',
    'RUN npm ci --omit=dev',
    'FROM node:22-alpine AS runtime',
    'ENV FOCUS_PET_CHAT_HOST=0.0.0.0 FOCUS_PET_CHAT_DATA_DIR=/data/focus-pet-social',
    'RUN mkdir -p /data/focus-pet-social',
    'HEALTHCHECK CMD node -e "fetch(`http://127.0.0.1:47321/healthz`).then(r=>process.exit(r.ok?0:1))"',
    'CMD ["npm", "run", "chat:serve"]'
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(wrappedDirectPublicStateChatDeployRoot, 'package.json'), JSON.stringify({
    scripts: {
      'chat:serve': 'node scripts/run-chat-service.js'
    }
  }), 'utf8');
  fs.writeFileSync(path.join(wrappedDirectPublicStateChatDeployRoot, 'src', 'chat-service.js'), '', 'utf8');
  fs.writeFileSync(path.join(wrappedDirectPublicStateChatDeployRoot, 'scripts', 'run-chat-service.js'), [
    "const chatService = require('../src/chat-service');",
    "process.on('SIGTERM', () => chatService.stop());",
    "console.log('owner state', chatService.publicState());",
    "console.info({ state: chatService.publicState() });",
    "console.trace(`state ${chatService.publicState()}`);"
  ].join('\n'), 'utf8');
  const wrappedDirectPublicStateChatBackendDeploy = runChatBackendDeployCheck(wrappedDirectPublicStateChatDeployRoot);
  assert.equal(wrappedDirectPublicStateChatBackendDeploy.ok, false);
  assert.deepEqual(wrappedDirectPublicStateChatBackendDeploy.forbiddenRuntimeMatches, [
    'startup-public-state-output'
  ]);

  const wrappedPublicStateVariableChatDeployRoot = tempDir('release-preflight-chat-backend-deploy-wrapped-public-state-variable-output');
  fs.mkdirSync(path.join(wrappedPublicStateVariableChatDeployRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(wrappedPublicStateVariableChatDeployRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(wrappedPublicStateVariableChatDeployRoot, 'Dockerfile'), [
    'FROM node:22-alpine AS deps',
    'WORKDIR /app',
    'RUN npm ci --omit=dev',
    'FROM node:22-alpine AS runtime',
    'ENV FOCUS_PET_CHAT_HOST=0.0.0.0 FOCUS_PET_CHAT_DATA_DIR=/data/focus-pet-social',
    'RUN mkdir -p /data/focus-pet-social',
    'HEALTHCHECK CMD node -e "fetch(`http://127.0.0.1:47321/healthz`).then(r=>process.exit(r.ok?0:1))"',
    'CMD ["npm", "run", "chat:serve"]'
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(wrappedPublicStateVariableChatDeployRoot, 'package.json'), JSON.stringify({
    scripts: {
      'chat:serve': 'node scripts/run-chat-service.js'
    }
  }), 'utf8');
  fs.writeFileSync(path.join(wrappedPublicStateVariableChatDeployRoot, 'src', 'chat-service.js'), '', 'utf8');
  fs.writeFileSync(path.join(wrappedPublicStateVariableChatDeployRoot, 'scripts', 'run-chat-service.js'), [
    "const chatService = require('../src/chat-service');",
    "process.on('SIGTERM', () => chatService.stop());",
    "const state = chatService.publicState();",
    "console.log('owner state', state);",
    "console.info({ state });",
    "console.trace(`state ${state}`);"
  ].join('\n'), 'utf8');
  const wrappedPublicStateVariableChatBackendDeploy = runChatBackendDeployCheck(wrappedPublicStateVariableChatDeployRoot);
  assert.equal(wrappedPublicStateVariableChatBackendDeploy.ok, false);
  assert.deepEqual(wrappedPublicStateVariableChatBackendDeploy.forbiddenRuntimeMatches, [
    'startup-public-state-variable-output'
  ]);

  const assignedPublicStateVariableChatDeployRoot = tempDir('release-preflight-chat-backend-deploy-assigned-public-state-variable-output');
  fs.mkdirSync(path.join(assignedPublicStateVariableChatDeployRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(assignedPublicStateVariableChatDeployRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(assignedPublicStateVariableChatDeployRoot, 'Dockerfile'), [
    'FROM node:22-alpine AS deps',
    'WORKDIR /app',
    'RUN npm ci --omit=dev',
    'FROM node:22-alpine AS runtime',
    'ENV FOCUS_PET_CHAT_HOST=0.0.0.0 FOCUS_PET_CHAT_DATA_DIR=/data/focus-pet-social',
    'RUN mkdir -p /data/focus-pet-social',
    'HEALTHCHECK CMD node -e "fetch(`http://127.0.0.1:47321/healthz`).then(r=>process.exit(r.ok?0:1))"',
    'CMD ["npm", "run", "chat:serve"]'
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(assignedPublicStateVariableChatDeployRoot, 'package.json'), JSON.stringify({
    scripts: {
      'chat:serve': 'node scripts/run-chat-service.js'
    }
  }), 'utf8');
  fs.writeFileSync(path.join(assignedPublicStateVariableChatDeployRoot, 'src', 'chat-service.js'), '', 'utf8');
  fs.writeFileSync(path.join(assignedPublicStateVariableChatDeployRoot, 'scripts', 'run-chat-service.js'), [
    "const chatService = require('../src/chat-service');",
    "process.on('SIGTERM', () => chatService.stop());",
    "let state;",
    "state = chatService.publicState();",
    "console.log('owner state', state);",
    "console.warn(state.inviteUrl);",
    "const { sessions } = state;",
    "console.info({ sessions });"
  ].join('\n'), 'utf8');
  const assignedPublicStateVariableChatBackendDeploy = runChatBackendDeployCheck(assignedPublicStateVariableChatDeployRoot);
  assert.equal(assignedPublicStateVariableChatBackendDeploy.ok, false);
  assert.deepEqual(assignedPublicStateVariableChatBackendDeploy.forbiddenRuntimeMatches, [
    'startup-public-state-variable-output',
    'startup-public-state-sensitive-property-output',
    'startup-public-state-destructured-sensitive-output'
  ]);

  const aliasedPublicStateVariableChatDeployRoot = tempDir('release-preflight-chat-backend-deploy-aliased-public-state-variable-output');
  fs.mkdirSync(path.join(aliasedPublicStateVariableChatDeployRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(aliasedPublicStateVariableChatDeployRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(aliasedPublicStateVariableChatDeployRoot, 'Dockerfile'), [
    'FROM node:22-alpine AS deps',
    'WORKDIR /app',
    'RUN npm ci --omit=dev',
    'FROM node:22-alpine AS runtime',
    'ENV FOCUS_PET_CHAT_HOST=0.0.0.0 FOCUS_PET_CHAT_DATA_DIR=/data/focus-pet-social',
    'RUN mkdir -p /data/focus-pet-social',
    'HEALTHCHECK CMD node -e "fetch(`http://127.0.0.1:47321/healthz`).then(r=>process.exit(r.ok?0:1))"',
    'CMD ["npm", "run", "chat:serve"]'
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(aliasedPublicStateVariableChatDeployRoot, 'package.json'), JSON.stringify({
    scripts: {
      'chat:serve': 'node scripts/run-chat-service.js'
    }
  }), 'utf8');
  fs.writeFileSync(path.join(aliasedPublicStateVariableChatDeployRoot, 'src', 'chat-service.js'), '', 'utf8');
  fs.writeFileSync(path.join(aliasedPublicStateVariableChatDeployRoot, 'scripts', 'run-chat-service.js'), [
    "const chatService = require('../src/chat-service');",
    "process.on('SIGTERM', () => chatService.stop());",
    "const state = chatService.publicState();",
    "const ownerState = state;",
    "let leakedState;",
    "leakedState = ownerState;",
    "console.log('owner state', leakedState);",
    "console.warn(leakedState.inviteUrl);",
    "const { sessions } = leakedState;",
    "console.info({ sessions });"
  ].join('\n'), 'utf8');
  const aliasedPublicStateVariableChatBackendDeploy = runChatBackendDeployCheck(aliasedPublicStateVariableChatDeployRoot);
  assert.equal(aliasedPublicStateVariableChatBackendDeploy.ok, false);
  assert.deepEqual(aliasedPublicStateVariableChatBackendDeploy.forbiddenRuntimeMatches, [
    'startup-public-state-variable-output',
    'startup-public-state-sensitive-property-output',
    'startup-public-state-destructured-sensitive-output'
  ]);

  const publicStatePropertyChatDeployRoot = tempDir('release-preflight-chat-backend-deploy-public-state-property-output');
  fs.mkdirSync(path.join(publicStatePropertyChatDeployRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(publicStatePropertyChatDeployRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(publicStatePropertyChatDeployRoot, 'Dockerfile'), [
    'FROM node:22-alpine AS deps',
    'WORKDIR /app',
    'RUN npm ci --omit=dev',
    'FROM node:22-alpine AS runtime',
    'ENV FOCUS_PET_CHAT_HOST=0.0.0.0 FOCUS_PET_CHAT_DATA_DIR=/data/focus-pet-social',
    'RUN mkdir -p /data/focus-pet-social',
    'HEALTHCHECK CMD node -e "fetch(`http://127.0.0.1:47321/healthz`).then(r=>process.exit(r.ok?0:1))"',
    'CMD ["npm", "run", "chat:serve"]'
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(publicStatePropertyChatDeployRoot, 'package.json'), JSON.stringify({
    scripts: {
      'chat:serve': 'node scripts/run-chat-service.js'
    }
  }), 'utf8');
  fs.writeFileSync(path.join(publicStatePropertyChatDeployRoot, 'src', 'chat-service.js'), '', 'utf8');
  fs.writeFileSync(path.join(publicStatePropertyChatDeployRoot, 'scripts', 'run-chat-service.js'), [
    "const chatService = require('../src/chat-service');",
    "process.on('SIGTERM', () => chatService.stop());",
    "const state = chatService.publicState();",
    "console.log(state.inviteUrl);",
    "console.info(JSON.stringify(state.sessions));",
    "const { sessions } = state;",
    "console.warn(sessions);"
  ].join('\n'), 'utf8');
  const publicStatePropertyChatBackendDeploy = runChatBackendDeployCheck(publicStatePropertyChatDeployRoot);
  assert.equal(publicStatePropertyChatBackendDeploy.ok, false);
  assert.deepEqual(publicStatePropertyChatBackendDeploy.forbiddenRuntimeMatches, [
    'startup-public-state-sensitive-property-output',
    'startup-public-state-destructured-sensitive-output'
  ]);

  const publicStateAliasChatDeployRoot = tempDir('release-preflight-chat-backend-deploy-public-state-alias-output');
  fs.mkdirSync(path.join(publicStateAliasChatDeployRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(publicStateAliasChatDeployRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(publicStateAliasChatDeployRoot, 'Dockerfile'), [
    'FROM node:22-alpine AS deps',
    'WORKDIR /app',
    'RUN npm ci --omit=dev',
    'FROM node:22-alpine AS runtime',
    'ENV FOCUS_PET_CHAT_HOST=0.0.0.0 FOCUS_PET_CHAT_DATA_DIR=/data/focus-pet-social',
    'RUN mkdir -p /data/focus-pet-social',
    'HEALTHCHECK CMD node -e "fetch(`http://127.0.0.1:47321/healthz`).then(r=>process.exit(r.ok?0:1))"',
    'CMD ["npm", "run", "chat:serve"]'
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(publicStateAliasChatDeployRoot, 'package.json'), JSON.stringify({
    scripts: {
      'chat:serve': 'node scripts/run-chat-service.js'
    }
  }), 'utf8');
  fs.writeFileSync(path.join(publicStateAliasChatDeployRoot, 'src', 'chat-service.js'), '', 'utf8');
  fs.writeFileSync(path.join(publicStateAliasChatDeployRoot, 'scripts', 'run-chat-service.js'), [
    "const chatService = require('../src/chat-service');",
    "process.on('SIGTERM', () => chatService.stop());",
    "const state = chatService.publicState();",
    "const invite = state.inviteUrl;",
    "const firstSession = state.sessions?.[0];",
    "console.log(invite);",
    "console.info({ firstSession });"
  ].join('\n'), 'utf8');
  const publicStateAliasChatBackendDeploy = runChatBackendDeployCheck(publicStateAliasChatDeployRoot);
  assert.equal(publicStateAliasChatBackendDeploy.ok, false);
  assert.deepEqual(publicStateAliasChatBackendDeploy.forbiddenRuntimeMatches, [
    'startup-public-state-sensitive-property-output'
  ]);

  const nonFirstArgSensitiveAliasChatDeployRoot = tempDir('release-preflight-chat-backend-deploy-non-first-arg-sensitive-alias-output');
  fs.mkdirSync(path.join(nonFirstArgSensitiveAliasChatDeployRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(nonFirstArgSensitiveAliasChatDeployRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(nonFirstArgSensitiveAliasChatDeployRoot, 'Dockerfile'), [
    'FROM node:22-alpine AS deps',
    'WORKDIR /app',
    'RUN npm ci --omit=dev',
    'FROM node:22-alpine AS runtime',
    'ENV FOCUS_PET_CHAT_HOST=0.0.0.0 FOCUS_PET_CHAT_DATA_DIR=/data/focus-pet-social',
    'RUN mkdir -p /data/focus-pet-social',
    'HEALTHCHECK CMD node -e "fetch(`http://127.0.0.1:47321/healthz`).then(r=>process.exit(r.ok?0:1))"',
    'CMD ["npm", "run", "chat:serve"]'
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(nonFirstArgSensitiveAliasChatDeployRoot, 'package.json'), JSON.stringify({
    scripts: {
      'chat:serve': 'node scripts/run-chat-service.js'
    }
  }), 'utf8');
  fs.writeFileSync(path.join(nonFirstArgSensitiveAliasChatDeployRoot, 'src', 'chat-service.js'), '', 'utf8');
  fs.writeFileSync(path.join(nonFirstArgSensitiveAliasChatDeployRoot, 'scripts', 'run-chat-service.js'), [
    "const chatService = require('../src/chat-service');",
    "process.on('SIGTERM', () => chatService.stop());",
    "const state = chatService.publicState();",
    "const invite = state.inviteUrl;",
    "const { sessions } = state;",
    "console.log('invite', invite);",
    "console.warn('sessions', { sessions });"
  ].join('\n'), 'utf8');
  const nonFirstArgSensitiveAliasChatBackendDeploy = runChatBackendDeployCheck(nonFirstArgSensitiveAliasChatDeployRoot);
  assert.equal(nonFirstArgSensitiveAliasChatBackendDeploy.ok, false);
  assert.deepEqual(nonFirstArgSensitiveAliasChatBackendDeploy.forbiddenRuntimeMatches, [
    'startup-public-state-sensitive-property-output',
    'startup-public-state-destructured-sensitive-output'
  ]);

  const publicStateAssignedAliasChatDeployRoot = tempDir('release-preflight-chat-backend-deploy-public-state-assigned-alias-output');
  fs.mkdirSync(path.join(publicStateAssignedAliasChatDeployRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(publicStateAssignedAliasChatDeployRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(publicStateAssignedAliasChatDeployRoot, 'Dockerfile'), [
    'FROM node:22-alpine AS deps',
    'WORKDIR /app',
    'RUN npm ci --omit=dev',
    'FROM node:22-alpine AS runtime',
    'ENV FOCUS_PET_CHAT_HOST=0.0.0.0 FOCUS_PET_CHAT_DATA_DIR=/data/focus-pet-social',
    'RUN mkdir -p /data/focus-pet-social',
    'HEALTHCHECK CMD node -e "fetch(`http://127.0.0.1:47321/healthz`).then(r=>process.exit(r.ok?0:1))"',
    'CMD ["npm", "run", "chat:serve"]'
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(publicStateAssignedAliasChatDeployRoot, 'package.json'), JSON.stringify({
    scripts: {
      'chat:serve': 'node scripts/run-chat-service.js'
    }
  }), 'utf8');
  fs.writeFileSync(path.join(publicStateAssignedAliasChatDeployRoot, 'src', 'chat-service.js'), '', 'utf8');
  fs.writeFileSync(path.join(publicStateAssignedAliasChatDeployRoot, 'scripts', 'run-chat-service.js'), [
    "const chatService = require('../src/chat-service');",
    "process.on('SIGTERM', () => chatService.stop());",
    "const state = chatService.publicState();",
    "let invite;",
    "let firstSession;",
    "invite = state.inviteUrl;",
    "firstSession = state.sessions?.[0];",
    "console.log(`invite ${invite}`);",
    "console.info({ firstSession });"
  ].join('\n'), 'utf8');
  const publicStateAssignedAliasChatBackendDeploy = runChatBackendDeployCheck(publicStateAssignedAliasChatDeployRoot);
  assert.equal(publicStateAssignedAliasChatBackendDeploy.ok, false);
  assert.deepEqual(publicStateAssignedAliasChatBackendDeploy.forbiddenRuntimeMatches, [
    'startup-public-state-sensitive-property-output'
  ]);

  const publicStateChainedAliasChatDeployRoot = tempDir('release-preflight-chat-backend-deploy-public-state-chained-alias-output');
  fs.mkdirSync(path.join(publicStateChainedAliasChatDeployRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(publicStateChainedAliasChatDeployRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(publicStateChainedAliasChatDeployRoot, 'Dockerfile'), [
    'FROM node:22-alpine AS deps',
    'WORKDIR /app',
    'RUN npm ci --omit=dev',
    'FROM node:22-alpine AS runtime',
    'ENV FOCUS_PET_CHAT_HOST=0.0.0.0 FOCUS_PET_CHAT_DATA_DIR=/data/focus-pet-social',
    'RUN mkdir -p /data/focus-pet-social',
    'HEALTHCHECK CMD node -e "fetch(`http://127.0.0.1:47321/healthz`).then(r=>process.exit(r.ok?0:1))"',
    'CMD ["npm", "run", "chat:serve"]'
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(publicStateChainedAliasChatDeployRoot, 'package.json'), JSON.stringify({
    scripts: {
      'chat:serve': 'node scripts/run-chat-service.js'
    }
  }), 'utf8');
  fs.writeFileSync(path.join(publicStateChainedAliasChatDeployRoot, 'src', 'chat-service.js'), '', 'utf8');
  fs.writeFileSync(path.join(publicStateChainedAliasChatDeployRoot, 'scripts', 'run-chat-service.js'), [
    "const chatService = require('../src/chat-service');",
    "process.on('SIGTERM', () => chatService.stop());",
    "const state = chatService.publicState();",
    "const invite = state.inviteUrl;",
    "let leakedInvite;",
    "leakedInvite = invite;",
    "const session = state.sessions?.[0];",
    "const leakedSession = session;",
    "console.log(leakedInvite);",
    "console.info({ leakedSession });"
  ].join('\n'), 'utf8');
  const publicStateChainedAliasChatBackendDeploy = runChatBackendDeployCheck(publicStateChainedAliasChatDeployRoot);
  assert.equal(publicStateChainedAliasChatBackendDeploy.ok, false);
  assert.deepEqual(publicStateChainedAliasChatBackendDeploy.forbiddenRuntimeMatches, [
    'startup-public-state-sensitive-property-output'
  ]);

  const wrappedDestructuredChatDeployRoot = tempDir('release-preflight-chat-backend-deploy-wrapped-destructured-startup-log');
  fs.mkdirSync(path.join(wrappedDestructuredChatDeployRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(wrappedDestructuredChatDeployRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(wrappedDestructuredChatDeployRoot, 'Dockerfile'), [
    'FROM node:22-alpine AS deps',
    'WORKDIR /app',
    'RUN npm ci --omit=dev',
    'FROM node:22-alpine AS runtime',
    'ENV FOCUS_PET_CHAT_HOST=0.0.0.0 FOCUS_PET_CHAT_DATA_DIR=/data/focus-pet-social',
    'RUN mkdir -p /data/focus-pet-social',
    'HEALTHCHECK CMD node -e "fetch(`http://127.0.0.1:47321/healthz`).then(r=>process.exit(r.ok?0:1))"',
    'CMD ["npm", "run", "chat:serve"]'
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(wrappedDestructuredChatDeployRoot, 'package.json'), JSON.stringify({
    scripts: {
      'chat:serve': 'node scripts/run-chat-service.js'
    }
  }), 'utf8');
  fs.writeFileSync(path.join(wrappedDestructuredChatDeployRoot, 'src', 'chat-service.js'), '', 'utf8');
  fs.writeFileSync(path.join(wrappedDestructuredChatDeployRoot, 'scripts', 'run-chat-service.js'), [
    "const chatService = require('../src/chat-service');",
    "process.on('SIGTERM', () => chatService.stop());",
    "const { inviteUrl } = chatService.publicState();",
    "console.log({ inviteUrl });",
    "console.error(`invite ${inviteUrl}`);"
  ].join('\n'), 'utf8');
  const wrappedDestructuredChatBackendDeploy = runChatBackendDeployCheck(wrappedDestructuredChatDeployRoot);
  assert.equal(wrappedDestructuredChatBackendDeploy.ok, false);
  assert.deepEqual(wrappedDestructuredChatBackendDeploy.forbiddenRuntimeMatches, [
    'startup-public-state-destructured-sensitive-output'
  ]);

  const chainedDestructuredChatDeployRoot = tempDir('release-preflight-chat-backend-deploy-chained-destructured-startup-log');
  fs.mkdirSync(path.join(chainedDestructuredChatDeployRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(chainedDestructuredChatDeployRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(chainedDestructuredChatDeployRoot, 'Dockerfile'), [
    'FROM node:22-alpine AS deps',
    'WORKDIR /app',
    'RUN npm ci --omit=dev',
    'FROM node:22-alpine AS runtime',
    'ENV FOCUS_PET_CHAT_HOST=0.0.0.0 FOCUS_PET_CHAT_DATA_DIR=/data/focus-pet-social',
    'RUN mkdir -p /data/focus-pet-social',
    'HEALTHCHECK CMD node -e "fetch(`http://127.0.0.1:47321/healthz`).then(r=>process.exit(r.ok?0:1))"',
    'CMD ["npm", "run", "chat:serve"]'
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(chainedDestructuredChatDeployRoot, 'package.json'), JSON.stringify({
    scripts: {
      'chat:serve': 'node scripts/run-chat-service.js'
    }
  }), 'utf8');
  fs.writeFileSync(path.join(chainedDestructuredChatDeployRoot, 'src', 'chat-service.js'), '', 'utf8');
  fs.writeFileSync(path.join(chainedDestructuredChatDeployRoot, 'scripts', 'run-chat-service.js'), [
    "const chatService = require('../src/chat-service');",
    "process.on('SIGTERM', () => chatService.stop());",
    "const { inviteUrl } = chatService.publicState();",
    "const leakedInvite = inviteUrl;",
    "const state = chatService.publicState();",
    "const { sessions } = state;",
    "let leakedSessions;",
    "leakedSessions = sessions;",
    "console.log(leakedInvite);",
    "console.info({ leakedSessions });"
  ].join('\n'), 'utf8');
  const chainedDestructuredChatBackendDeploy = runChatBackendDeployCheck(chainedDestructuredChatDeployRoot);
  assert.equal(chainedDestructuredChatBackendDeploy.ok, false);
  assert.deepEqual(chainedDestructuredChatBackendDeploy.forbiddenRuntimeMatches, [
    'startup-public-state-destructured-sensitive-output'
  ]);

  const rawErrorChatDeployRoot = tempDir('release-preflight-chat-backend-deploy-raw-error-output');
  fs.mkdirSync(path.join(rawErrorChatDeployRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(rawErrorChatDeployRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(rawErrorChatDeployRoot, 'Dockerfile'), [
    'FROM node:22-alpine AS deps',
    'WORKDIR /app',
    'RUN npm ci --omit=dev',
    'FROM node:22-alpine AS runtime',
    'ENV FOCUS_PET_CHAT_HOST=0.0.0.0 FOCUS_PET_CHAT_DATA_DIR=/data/focus-pet-social',
    'RUN mkdir -p /data/focus-pet-social',
    'HEALTHCHECK CMD node -e "fetch(`http://127.0.0.1:47321/healthz`).then(r=>process.exit(r.ok?0:1))"',
    'CMD ["npm", "run", "chat:serve"]'
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(rawErrorChatDeployRoot, 'package.json'), JSON.stringify({
    scripts: {
      'chat:serve': 'node scripts/run-chat-service.js'
    }
  }), 'utf8');
  fs.writeFileSync(path.join(rawErrorChatDeployRoot, 'src', 'chat-service.js'), '', 'utf8');
  fs.writeFileSync(path.join(rawErrorChatDeployRoot, 'scripts', 'run-chat-service.js'), [
    "const chatService = require('../src/chat-service');",
    "process.on('SIGTERM', () => chatService.stop());",
    "process.on('unhandledRejection', err => console.error(err));",
    "process.on('uncaughtException', reason => console.error(reason?.stack || reason));"
  ].join('\n'), 'utf8');
  const rawErrorChatBackendDeploy = runChatBackendDeployCheck(rawErrorChatDeployRoot);
  assert.equal(rawErrorChatBackendDeploy.ok, false);
  assert.deepEqual(rawErrorChatBackendDeploy.forbiddenRuntimeMatches, [
    'unsanitized-startup-error-output'
  ]);

  const shortErrorVarChatDeployRoot = tempDir('release-preflight-chat-backend-deploy-short-error-var-output');
  fs.mkdirSync(path.join(shortErrorVarChatDeployRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(shortErrorVarChatDeployRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(shortErrorVarChatDeployRoot, 'Dockerfile'), [
    'FROM node:22-alpine AS deps',
    'WORKDIR /app',
    'RUN npm ci --omit=dev',
    'FROM node:22-alpine AS runtime',
    'ENV FOCUS_PET_CHAT_HOST=0.0.0.0 FOCUS_PET_CHAT_DATA_DIR=/data/focus-pet-social',
    'RUN mkdir -p /data/focus-pet-social',
    'HEALTHCHECK CMD node -e "fetch(`http://127.0.0.1:47321/healthz`).then(r=>process.exit(r.ok?0:1))"',
    'CMD ["npm", "run", "chat:serve"]'
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(shortErrorVarChatDeployRoot, 'package.json'), JSON.stringify({
    scripts: {
      'chat:serve': 'node scripts/run-chat-service.js'
    }
  }), 'utf8');
  fs.writeFileSync(path.join(shortErrorVarChatDeployRoot, 'src', 'chat-service.js'), '', 'utf8');
  fs.writeFileSync(path.join(shortErrorVarChatDeployRoot, 'scripts', 'run-chat-service.js'), [
    "const chatService = require('../src/chat-service');",
    "process.on('SIGTERM', () => chatService.stop());",
    "process.on('unhandledRejection', e => console.error(e?.stack || e));",
    "process.on('uncaughtException', ex => console.warn(ex));"
  ].join('\n'), 'utf8');
  const shortErrorVarChatBackendDeploy = runChatBackendDeployCheck(shortErrorVarChatDeployRoot);
  assert.equal(shortErrorVarChatBackendDeploy.ok, false);
  assert.deepEqual(shortErrorVarChatBackendDeploy.forbiddenRuntimeMatches, [
    'unsanitized-startup-error-output'
  ]);

  const stdoutErrorChatDeployRoot = tempDir('release-preflight-chat-backend-deploy-stdout-error-output');
  fs.mkdirSync(path.join(stdoutErrorChatDeployRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(stdoutErrorChatDeployRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(stdoutErrorChatDeployRoot, 'Dockerfile'), [
    'FROM node:22-alpine AS deps',
    'WORKDIR /app',
    'RUN npm ci --omit=dev',
    'FROM node:22-alpine AS runtime',
    'ENV FOCUS_PET_CHAT_HOST=0.0.0.0 FOCUS_PET_CHAT_DATA_DIR=/data/focus-pet-social',
    'RUN mkdir -p /data/focus-pet-social',
    'HEALTHCHECK CMD node -e "fetch(`http://127.0.0.1:47321/healthz`).then(r=>process.exit(r.ok?0:1))"',
    'CMD ["npm", "run", "chat:serve"]'
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(stdoutErrorChatDeployRoot, 'package.json'), JSON.stringify({
    scripts: {
      'chat:serve': 'node scripts/run-chat-service.js'
    }
  }), 'utf8');
  fs.writeFileSync(path.join(stdoutErrorChatDeployRoot, 'src', 'chat-service.js'), '', 'utf8');
  fs.writeFileSync(path.join(stdoutErrorChatDeployRoot, 'scripts', 'run-chat-service.js'), [
    "const chatService = require('../src/chat-service');",
    "process.on('SIGTERM', () => chatService.stop());",
    "process.on('unhandledRejection', error => console.log(error));",
    "process.on('uncaughtException', err => console.info(err?.message || err));",
    "process.on('warning', reason => console.debug(reason));",
    "process.on('rejectionHandled', exception => console.trace(exception));"
  ].join('\n'), 'utf8');
  const stdoutErrorChatBackendDeploy = runChatBackendDeployCheck(stdoutErrorChatDeployRoot);
  assert.equal(stdoutErrorChatBackendDeploy.ok, false);
  assert.deepEqual(stdoutErrorChatBackendDeploy.forbiddenRuntimeMatches, [
    'unsanitized-startup-error-output'
  ]);

  const wrappedErrorArgChatDeployRoot = tempDir('release-preflight-chat-backend-deploy-wrapped-error-arg-output');
  fs.mkdirSync(path.join(wrappedErrorArgChatDeployRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(wrappedErrorArgChatDeployRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(wrappedErrorArgChatDeployRoot, 'Dockerfile'), [
    'FROM node:22-alpine AS deps',
    'WORKDIR /app',
    'RUN npm ci --omit=dev',
    'FROM node:22-alpine AS runtime',
    'ENV FOCUS_PET_CHAT_HOST=0.0.0.0 FOCUS_PET_CHAT_DATA_DIR=/data/focus-pet-social',
    'RUN mkdir -p /data/focus-pet-social',
    'HEALTHCHECK CMD node -e "fetch(`http://127.0.0.1:47321/healthz`).then(r=>process.exit(r.ok?0:1))"',
    'CMD ["npm", "run", "chat:serve"]'
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(wrappedErrorArgChatDeployRoot, 'package.json'), JSON.stringify({
    scripts: {
      'chat:serve': 'node scripts/run-chat-service.js'
    }
  }), 'utf8');
  fs.writeFileSync(path.join(wrappedErrorArgChatDeployRoot, 'src', 'chat-service.js'), '', 'utf8');
  fs.writeFileSync(path.join(wrappedErrorArgChatDeployRoot, 'scripts', 'run-chat-service.js'), [
    "const chatService = require('../src/chat-service');",
    "process.on('SIGTERM', () => chatService.stop());",
    "process.on('unhandledRejection', error => console.error('startup failed', error));",
    "process.on('uncaughtException', err => console.warn({ err }));"
  ].join('\n'), 'utf8');
  const wrappedErrorArgChatBackendDeploy = runChatBackendDeployCheck(wrappedErrorArgChatDeployRoot);
  assert.equal(wrappedErrorArgChatBackendDeploy.ok, false);
  assert.deepEqual(wrappedErrorArgChatBackendDeploy.forbiddenRuntimeMatches, [
    'unsanitized-startup-error-output'
  ]);

  const arbitraryErrorParamChatDeployRoot = tempDir('release-preflight-chat-backend-deploy-arbitrary-error-param-output');
  fs.mkdirSync(path.join(arbitraryErrorParamChatDeployRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(arbitraryErrorParamChatDeployRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(arbitraryErrorParamChatDeployRoot, 'Dockerfile'), [
    'FROM node:22-alpine AS deps',
    'WORKDIR /app',
    'RUN npm ci --omit=dev',
    'FROM node:22-alpine AS runtime',
    'ENV FOCUS_PET_CHAT_HOST=0.0.0.0 FOCUS_PET_CHAT_DATA_DIR=/data/focus-pet-social',
    'RUN mkdir -p /data/focus-pet-social',
    'HEALTHCHECK CMD node -e "fetch(`http://127.0.0.1:47321/healthz`).then(r=>process.exit(r.ok?0:1))"',
    'CMD ["npm", "run", "chat:serve"]'
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(arbitraryErrorParamChatDeployRoot, 'package.json'), JSON.stringify({
    scripts: {
      'chat:serve': 'node scripts/run-chat-service.js'
    }
  }), 'utf8');
  fs.writeFileSync(path.join(arbitraryErrorParamChatDeployRoot, 'src', 'chat-service.js'), '', 'utf8');
  fs.writeFileSync(path.join(arbitraryErrorParamChatDeployRoot, 'scripts', 'run-chat-service.js'), [
    "const chatService = require('../src/chat-service');",
    "process.on('SIGTERM', () => chatService.stop());",
    "process.on('unhandledRejection', failure => console.error('startup failed', failure));",
    "process.on('uncaughtException', payload => console.warn({ payload }));"
  ].join('\n'), 'utf8');
  const arbitraryErrorParamChatBackendDeploy = runChatBackendDeployCheck(arbitraryErrorParamChatDeployRoot);
  assert.equal(arbitraryErrorParamChatBackendDeploy.ok, false);
  assert.deepEqual(arbitraryErrorParamChatBackendDeploy.forbiddenRuntimeMatches, [
    'unsanitized-startup-error-output'
  ]);

  const mixedSanitizeErrorChatDeployRoot = tempDir('release-preflight-chat-backend-deploy-mixed-sanitize-error-output');
  fs.mkdirSync(path.join(mixedSanitizeErrorChatDeployRoot, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(mixedSanitizeErrorChatDeployRoot, 'src'), { recursive: true });
  fs.writeFileSync(path.join(mixedSanitizeErrorChatDeployRoot, 'Dockerfile'), [
    'FROM node:22-alpine AS deps',
    'WORKDIR /app',
    'RUN npm ci --omit=dev',
    'FROM node:22-alpine AS runtime',
    'ENV FOCUS_PET_CHAT_HOST=0.0.0.0 FOCUS_PET_CHAT_DATA_DIR=/data/focus-pet-social',
    'RUN mkdir -p /data/focus-pet-social',
    'HEALTHCHECK CMD node -e "fetch(`http://127.0.0.1:47321/healthz`).then(r=>process.exit(r.ok?0:1))"',
    'CMD ["npm", "run", "chat:serve"]'
  ].join('\n'), 'utf8');
  fs.writeFileSync(path.join(mixedSanitizeErrorChatDeployRoot, 'package.json'), JSON.stringify({
    scripts: {
      'chat:serve': 'node scripts/run-chat-service.js'
    }
  }), 'utf8');
  fs.writeFileSync(path.join(mixedSanitizeErrorChatDeployRoot, 'src', 'chat-service.js'), '', 'utf8');
  fs.writeFileSync(path.join(mixedSanitizeErrorChatDeployRoot, 'scripts', 'run-chat-service.js'), [
    "const chatService = require('../src/chat-service');",
    "const { sanitizeLogText } = require('../src/runtime-logger');",
    "process.on('SIGTERM', () => chatService.stop());",
    "process.on('unhandledRejection', failure => console.error(sanitizeLogText('startup failed'), failure));",
    "process.on('uncaughtException', payload => console.warn(sanitizeLogText(payload?.message), { payload }));"
  ].join('\n'), 'utf8');
  const mixedSanitizeErrorChatBackendDeploy = runChatBackendDeployCheck(mixedSanitizeErrorChatDeployRoot);
  assert.equal(mixedSanitizeErrorChatBackendDeploy.ok, false);
  assert.deepEqual(mixedSanitizeErrorChatBackendDeploy.forbiddenRuntimeMatches, [
    'unsanitized-startup-error-output'
  ]);

  const incompletePackageRoot = tempDir('release-preflight-package-scripts-incomplete');
  fs.mkdirSync(path.join(incompletePackageRoot, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(incompletePackageRoot, 'scripts', 'package-macos.js'), '', 'utf8');
  fs.writeFileSync(path.join(incompletePackageRoot, 'package.json'), JSON.stringify({
    scripts: {
      check: 'node --check scripts/package-macos.js',
      'package:mac': 'node scripts/package-macos.js',
      'package:win': 'node scripts/missing-package-windows.js'
    }
  }), 'utf8');
  const incompletePackageScripts = runPackageScriptsCheck(incompletePackageRoot);
  assert.equal(incompletePackageScripts.ok, false);
  assert.ok(incompletePackageScripts.missingScripts.includes('sign:mac'));
  assert.deepEqual(incompletePackageScripts.missingFiles, [
    { script: 'package:win', file: 'scripts/missing-package-windows.js' }
  ]);
  assert.ok(incompletePackageScripts.missingCheckEntries.some(item => item.script === 'package:win'));

  const weakCheckPackageRoot = tempDir('release-preflight-package-scripts-weak-check');
  fs.mkdirSync(path.join(weakCheckPackageRoot, 'scripts'), { recursive: true });
  for (const scriptFile of [
    'package-macos.js',
    'package-windows.js',
    'package-remote-client-macos.js',
    'sign-macos.js',
    'notarize-macos.js',
    'verify-macos.js',
    'run-pet-render-verify.js',
    'test-screen-review-pipeline.js'
  ]) {
    fs.writeFileSync(path.join(weakCheckPackageRoot, 'scripts', scriptFile), '', 'utf8');
  }
  fs.writeFileSync(path.join(weakCheckPackageRoot, 'package.json'), JSON.stringify({
    scripts: {
      check: [
        'node --check scripts/package-macos.js',
        'echo scripts/package-windows.js',
        'node --check scripts/package-remote-client-macos.js',
        'node --check scripts/sign-macos.js',
        'node --check scripts/notarize-macos.js',
        'node --check scripts/verify-macos.js',
        'node --check scripts/run-pet-render-verify.js',
        'echo scripts/test-screen-review-pipeline.js'
      ].join(' && '),
      'package:mac': 'node scripts/package-macos.js',
      'package:win': 'node scripts/package-windows.js',
      'package:mac:remote-client': 'node scripts/package-remote-client-macos.js',
      'sign:mac': 'node scripts/sign-macos.js',
      'notarize:mac': 'node scripts/notarize-macos.js',
      'verify:mac': 'node scripts/verify-macos.js',
      'verify:pet-render': 'node scripts/run-pet-render-verify.js',
      'test:screen-pipeline': 'electron scripts/test-screen-review-pipeline.js'
    }
  }), 'utf8');
  const weakCheckPackageScripts = runPackageScriptsCheck(weakCheckPackageRoot);
  assert.equal(weakCheckPackageScripts.ok, false);
  assert.deepEqual(weakCheckPackageScripts.missingCheckEntries, [
    { script: 'package:win', file: 'scripts/package-windows.js' },
    { script: 'test:screen-pipeline', file: 'scripts/test-screen-review-pipeline.js' }
  ]);

  const errorLog = runErrorLogCheck(PROJECT_ROOT);
  assert.equal(errorLog.ok, true);
  assert.equal(errorLog.exists, true);
  assert.equal(errorLog.latestStatus, '已解决');
  assert.deepEqual(errorLog.formatIssues, []);

  const parsedEntries = parseErrorLogEntries([
    '## [2026-06-30 10:00:00 +0800]',
    '- 问题描述：测试红灯',
    '- 发生位置：test',
    '- 上下文：上下文',
    '- 可能原因：原因',
    '- 解决状态：未解决'
  ].join('\n'));
  assert.equal(parsedEntries.length, 1);
  assert.equal(parsedEntries[0].status, '未解决');

  const templatedEntries = parseErrorLogEntries([
    '## [时间]',
    '- 问题描述：',
    '- 发生位置：',
    '- 上下文：',
    '- 可能原因：',
    '- 解决状态：（未解决 / 已解决）',
    '## [2026-06-30 10:00:00 +0800]',
    '- 问题描述：真实记录',
    '- 发生位置：test',
    '- 上下文：上下文',
    '- 可能原因：原因',
    '- 解决状态：已解决'
  ].join('\n'));
  assert.equal(templatedEntries.length, 1);
  assert.equal(templatedEntries[0].time, '2026-06-30 10:00:00 +0800');

  const openLogDir = tempDir('release-preflight-error-log');
  fs.mkdirSync(path.join(openLogDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(openLogDir, 'docs', 'errorThing.md'), [
    '## [2026-06-30 10:00:00 +0800]',
    '- 问题描述：测试红灯',
    '- 发生位置：test',
    '- 上下文：上下文',
    '- 可能原因：原因',
    '- 解决状态：未解决'
  ].join('\n'), 'utf8');
  const openLog = runErrorLogCheck(openLogDir);
  assert.equal(openLog.ok, false);
  assert.equal(openLog.latestStatus, '未解决');

  const malformedHistoryLogDir = tempDir('release-preflight-error-log-malformed-history');
  fs.mkdirSync(path.join(malformedHistoryLogDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(malformedHistoryLogDir, 'docs', 'errorThing.md'), [
    '## [2026-06-30 10:00:00 +0800]',
    '- 问题描述：历史记录缺上下文',
    '- 发生位置：test',
    '- 可能原因：原因',
    '- 解决状态：已解决',
    '## [2026-06-30 10:05:00 +0800]',
    '- 问题描述：最新记录完整',
    '- 发生位置：test',
    '- 上下文：上下文',
    '- 可能原因：原因',
    '- 解决状态：已解决'
  ].join('\n'), 'utf8');
  const malformedHistoryLog = runErrorLogCheck(malformedHistoryLogDir);
  assert.equal(malformedHistoryLog.ok, false);
  assert.deepEqual(malformedHistoryLog.allFormatIssues, [
    { line: 1, field: 'context' }
  ]);

  const staleOpenLogDir = tempDir('release-preflight-error-log-stale-open');
  fs.mkdirSync(path.join(staleOpenLogDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(staleOpenLogDir, 'docs', 'errorThing.md'), [
    '## [2026-06-30 10:00:00 +0800]',
    '- 问题描述：未关闭的问题',
    '- 发生位置：src/a.js',
    '- 上下文：仍然开放',
    '- 可能原因：原因 A',
    '- 解决状态：未解决',
    '## [2026-06-30 10:05:00 +0800]',
    '- 问题描述：已关闭的问题',
    '- 发生位置：src/b.js',
    '- 上下文：先红灯',
    '- 可能原因：原因 B',
    '- 解决状态：未解决',
    '## [2026-06-30 10:06:00 +0800]',
    '- 问题描述：已关闭的问题',
    '- 发生位置：src/b.js',
    '- 上下文：已修复',
    '- 可能原因：原因 B',
    '- 解决状态：已解决',
    '## [2026-06-30 10:07:00 +0800]',
    '- 问题描述：新增诊断包测试后，npm test 出现预期红灯。',
    '- 发生位置：test/core.test.js / src/diagnostics.js',
    '- 上下文：先红灯',
    '- 可能原因：原因 C',
    '- 解决状态：未解决',
    '## [2026-06-30 10:08:00 +0800]',
    '- 问题描述：诊断包测试红灯已修复。',
    '- 发生位置：src/diagnostics.js / test/core.test.js',
    '- 上下文：已修复',
    '- 可能原因：原因 C',
    '- 解决状态：已解决',
    '## [2026-06-30 10:09:00 +0800]',
    '- 问题描述：完整宠物渲染验证通过后，Electron 退出阶段输出 GPU SharedImageManager ERROR。',
    '- 发生位置：npm run verify:pet-render / Electron GPU command buffer',
    '- 上下文：脚本返回 ok: true，所有渲染场景 failedChecks 为空。',
    '- 可能原因：Electron/Chromium GPU 资源在测试窗口关闭期间释放顺序产生的非阻塞退出噪声。',
    '- 解决状态：未解决',
    '## [2026-06-30 10:10:00 +0800]',
    '- 问题描述：最后一个检查项已解决。',
    '- 发生位置：test',
    '- 上下文：用于保持 latestStatus 已解决',
    '- 可能原因：原因 D',
    '- 解决状态：已解决'
  ].join('\n'), 'utf8');
  const staleOpenLog = runErrorLogCheck(staleOpenLogDir);
  assert.equal(staleOpenLog.ok, false);
  assert.deepEqual(staleOpenLog.openUnresolvedEntries, [
    { line: 1, time: '2026-06-30 10:00:00 +0800' }
  ]);

  const sameDescriptionDifferentLocationLogDir = tempDir('release-preflight-error-log-location-boundary');
  fs.mkdirSync(path.join(sameDescriptionDifferentLocationLogDir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(sameDescriptionDifferentLocationLogDir, 'docs', 'errorThing.md'), [
    '## [2026-06-30 10:00:00 +0800]',
    '- 问题描述：相同摘要测试失败',
    '- 发生位置：src/a.js',
    '- 上下文：仍然开放',
    '- 可能原因：原因 A',
    '- 解决状态：未解决',
    '## [2026-06-30 10:05:00 +0800]',
    '- 问题描述：相同摘要测试失败',
    '- 发生位置：src/b.js',
    '- 上下文：另一个位置已修复',
    '- 可能原因：原因 B',
    '- 解决状态：已解决',
    '## [2026-06-30 10:10:00 +0800]',
    '- 问题描述：最后一个检查项已解决。',
    '- 发生位置：test',
    '- 上下文：用于保持 latestStatus 已解决',
    '- 可能原因：原因 C',
    '- 解决状态：已解决'
  ].join('\n'), 'utf8');
  const sameDescriptionDifferentLocationLog = runErrorLogCheck(sameDescriptionDifferentLocationLogDir);
  assert.equal(sameDescriptionDifferentLocationLog.ok, false);
  assert.deepEqual(sameDescriptionDifferentLocationLog.openUnresolvedEntries, [
    { line: 1, time: '2026-06-30 10:00:00 +0800' }
  ]);

  const markdown = renderReleasePreflightMarkdown(checklist);
  assert.match(markdown, /# Focus Pet 发布前检查清单/);
  assert.match(markdown, /npm run verify:pet-render/);
  assert.match(markdown, /npm run test:screen-pipeline/);
  assert.match(markdown, /node scripts\/release-preflight\.js --check diagnostics-bundle-output/);
  assert.match(markdown, /node scripts\/release-preflight\.js --check package-scripts/);
  assert.match(markdown, /node scripts\/release-preflight\.js --check docs-boundary/);
  assert.match(markdown, /node scripts\/release-preflight\.js --check optimization-plan/);
  assert.match(markdown, /node scripts\/release-preflight\.js --check error-log/);
  assert.doesNotMatch(markdown, /FOCUS_PET_.*KEY|secret|token/i);
});

test('release preflight docs boundary detects stale social risk caveats', () => {
  const { runDocsBoundaryCheck } = require('../scripts/release-preflight');

  const docsBoundary = runDocsBoundaryCheck(PROJECT_ROOT);
  assert.equal(docsBoundary.ok, true);
  assert.deepEqual(docsBoundary.socialBoundaryMissingCaveats, []);
  assert.deepEqual(docsBoundary.socialBoundaryStaleRisks, []);

  const staleSocialBoundaryRoot = tempDir('release-preflight-social-boundary-stale-risk');
  for (const docPath of [
    'docs/optimization-plan.md',
    'docs/system-overview.md',
    'docs/social-security-boundary.md',
    'docs/diagnostics.md',
    'docs/storage-recovery.md',
    'docs/task-model.md'
  ]) {
    fs.mkdirSync(path.dirname(path.join(staleSocialBoundaryRoot, docPath)), { recursive: true });
    const body = docPath === 'docs/optimization-plan.md'
      ? ['- 隐私模式。', '- 敏感 App。', '- 窗口标题脱敏。', '- 用户纠错。'].join('\n')
      : docPath === 'docs/social-security-boundary.md'
        ? [
          '# Focus Pet 社交服务安全边界',
          '',
          '## 10. 当前未覆盖风险',
          '',
          '- 跨进程、跨实例、重启后仍保留的邀请码尝试限流。'
        ].join('\n')
        : '# Boundary doc\n';
    fs.writeFileSync(path.join(staleSocialBoundaryRoot, docPath), body, 'utf8');
  }

  const staleSocialBoundary = runDocsBoundaryCheck(staleSocialBoundaryRoot);
  assert.equal(staleSocialBoundary.ok, false);
  assert.deepEqual(staleSocialBoundary.socialBoundaryMissingCaveats, [
    'invite-attempts-persist-across-service-restart',
    'multi-instance-rate-limit-caveat'
  ]);
  assert.deepEqual(staleSocialBoundary.socialBoundaryStaleRisks, [
    'restart-persistent-invite-attempts-listed-as-uncovered'
  ]);
});

test('chat docs separate WeChat-like voice messages from realtime calls', () => {
  const readme = fs.readFileSync(path.join(PROJECT_ROOT, 'README.md'), 'utf8');

  assert.match(readme, /微信式小聊天窗口/);
  assert.match(readme, /语音消息.*MediaRecorder/s);
  assert.match(readme, /按住说话/);
  assert.match(readme, /语音快捷键/);
  assert.match(readme, /Alt\+R/);
  assert.match(readme, /实时语音聊天.*WebRTC/s);
  assert.match(readme, /实时视频聊天.*WebRTC/s);
  assert.match(readme, /WebSocket 信令/);
  assert.match(readme, /TURN/);
});

test('release and local LLM docs describe current diagnostics gates', () => {
  const readme = fs.readFileSync(path.join(PROJECT_ROOT, 'README.md'), 'utf8');
  const diagnosticsDoc = fs.readFileSync(path.join(PROJECT_ROOT, 'docs', 'diagnostics.md'), 'utf8');
  const optimizationPlan = fs.readFileSync(path.join(PROJECT_ROOT, 'docs', 'optimization-plan.md'), 'utf8');
  const systemOverview = fs.readFileSync(path.join(PROJECT_ROOT, 'docs', 'system-overview.md'), 'utf8');

  assert.match(readme, /node scripts\/release-preflight\.js --check diagnostics-summary-output/);
  assert.match(readme, /diagnostics-summary-output[\s\S]*summarySchemaValid/);
  assert.match(readme, /summaryGeneratedAtValid/);
  assert.match(readme, /diagnostics-summary-output[\s\S]*未知顶层字段数量/);
  assert.match(readme, /json-secret-field/);
  assert.match(readme, /rawIssueKey[\s\S]*json-raw-field/);
  assert.match(readme, /diagnostics-bundle-output[\s\S]*summaryBoundaryIssues|summaryBoundaryIssues[\s\S]*diagnostics-bundle-output/);
  assert.match(readme, /diagnostics-bundle-output[\s\S]*summarySchemaValid|summarySchemaValid[\s\S]*diagnostics-bundle-output/);
  assert.match(readme, /error-log[\s\S]*openUnresolvedEntries|openUnresolvedEntries[\s\S]*error-log/);
  assert.match(readme, /emptyAcceptanceSections/);
  assert.match(readme, /冒号、括号、破折号或空格/);
  assert.match(readme, /未通过/);
  assert.match(readme, /snake_case[\s\S]*kebab-case|kebab-case[\s\S]*snake_case/);
  assert.match(readme, /--run=fast/);
  assert.match(readme, /诊断包[\s\S]*最新 20 个/);

  assert.match(optimizationPlan, /apiKeyRequired/);
  assert.match(optimizationPlan, /json-secret-field/);
  assert.match(optimizationPlan, /rawIssueKey[\s\S]*json-raw-field/);
  assert.match(optimizationPlan, /emptyAcceptanceSections/);
  assert.match(optimizationPlan, /冒号、括号、破折号或空格/);
  assert.match(optimizationPlan, /未通过/);
  assert.match(optimizationPlan, /snake_case[\s\S]*kebab-case|kebab-case[\s\S]*snake_case/);
  assert.match(optimizationPlan, /summaryGeneratedAtValid/);
  assert.match(optimizationPlan, /--run=fast/);
  assert.match(optimizationPlan, /运行日志[\s\S]*currentTask/);
  assert.match(optimizationPlan, /appendErrorThing\(\)[\s\S]*sanitizeLogText/);
  assert.match(optimizationPlan, /诊断摘要只输出 provider、本地\/云端状态、API key 是否必需和配置是否存在/);

  assert.match(diagnosticsDoc, /运行日志[\s\S]*currentTask/);
  assert.match(diagnosticsDoc, /appendErrorThing\(\)[\s\S]*错误日志/);
  assert.match(diagnosticsDoc, /env secret[\s\S]*URL/);
  assert.match(diagnosticsDoc, /summaryGeneratedAtValid/);
  assert.match(diagnosticsDoc, /rawIssueKey[\s\S]*json-raw-field/);
  assert.match(systemOverview, /运行日志[\s\S]*currentTask/);
  assert.match(systemOverview, /appendErrorThing\(\)[\s\S]*sanitizeLogText/);
  assert.match(systemOverview, /--run=fast/);
  assert.match(systemOverview, /summaryGeneratedAtValid/);
  assert.match(systemOverview, /rawIssueKey[\s\S]*json-raw-field/);
  assert.match(systemOverview, /emptyAcceptanceSections/);
  assert.match(systemOverview, /冒号、括号、破折号或空格/);
  assert.match(systemOverview, /未通过/);
  assert.match(systemOverview, /snake_case[\s\S]*kebab-case|kebab-case[\s\S]*snake_case/);
});

test('Nervy pet spritesheet is wired to the renderer contract', () => {
  const spritePath = path.join(PROJECT_ROOT, 'src', 'assets', 'pets', 'nervy-sci-fi-kid', 'spritesheet.webp');
  assert.ok(fs.existsSync(spritePath));
  assert.deepEqual(readWebpSize(spritePath), { width: 1536, height: 6240 });

  const indexHtml = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'index.html'), 'utf8');
  const styles = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'styles.css'), 'utf8');
  const renderer = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'renderer.js'), 'utf8');
  const preload = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'preload.js'), 'utf8');
  const main = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');

  assert.match(indexHtml, /class="avatar" aria-label="[^"]+" role="button" tabindex="0"/);
  assert.match(indexHtml, /class="pet-sprite"/);
  assert.match(indexHtml, /id="petStateSummary"/);
  assert.match(indexHtml, /id="moodBar"/);
  assert.match(indexHtml, /id="moodTarget" class="vital-target"/);
  assert.match(indexHtml, /id="moodDelta" class="vital-delta"/);
  assert.match(indexHtml, /id="energyTarget" class="vital-target"/);
  assert.match(indexHtml, /id="energyDelta" class="vital-delta"/);
  assert.match(indexHtml, /id="bondTarget" class="vital-target"/);
  assert.match(indexHtml, /id="bondDelta" class="vital-delta"/);
  assert.match(indexHtml, /data-vital="mood" role="button" tabindex="0" aria-pressed="false"/);
  assert.match(indexHtml, /data-vital="energy" role="button" tabindex="0" aria-pressed="false"/);
  assert.match(indexHtml, /data-vital="bond" role="button" tabindex="0" aria-pressed="false"/);
  assert.match(indexHtml, /id="vitalChips" class="vital-chips"/);
  assert.match(indexHtml, /id="moodChip" class="vital-chip" data-vital-chip="mood"/);
  assert.match(indexHtml, /id="careActions"/);
  assert.match(indexHtml, /id="careMenu" aria-controls="petMenu" aria-expanded="false"/);
  assert.match(indexHtml, /id="careMenuInsight" class="care-menu-insight"/);
  assert.match(indexHtml, /id="petCareFeedback" class="care-feedback" role="status" aria-live="polite"/);
  assert.match(indexHtml, /id="petCareRecent"/);
  assert.match(indexHtml, /id="petCareGuidance"/);
  assert.match(indexHtml, /id="petVitalFocusAction" class="vital-focus-action" hidden/);
  assert.match(indexHtml, /id="petVitalFocusButton" type="button"/);
  assert.match(indexHtml, /id="petVitalFocusGoal"/);
  assert.match(indexHtml, /id="petVitalFocusImpact"/);
  assert.match(indexHtml, /id="petCareWhy"/);
  assert.match(indexHtml, /id="petCareDetail" class="care-guidance-detail"/);
  assert.match(indexHtml, /id="petCarePreview"/);
  assert.match(indexHtml, /id="petCareNow"/);
  assert.match(indexHtml, /class="chat-compose"/);
  assert.match(indexHtml, /id="newTaskText"[^>]+aria-describedby="taskComposerFeedback"/);
  assert.match(indexHtml, /id="taskComposerFeedback" class="task-composer-feedback" role="status" aria-live="polite" hidden/);
  assert.match(styles, /assets\/pets\/nervy-sci-fi-kid\/spritesheet\.webp/);
  assert.match(styles, /background-size:\s*1536px 6240px/);
  assert.match(styles, /\.pet-stats-header/);
  assert.match(styles, /\.vital-track/);
  assert.match(styles, /\.vital-target/);
  assert.match(styles, /\.vital-target\[hidden\]/);
  assert.match(styles, /\.vital-delta/);
  assert.match(styles, /\.vital-delta\[data-trend="up"\]/);
  assert.match(styles, /\.vital-row\[data-need="primary"\]/);
  assert.match(styles, /\.vital-row\[data-need="support"\]/);
  assert.match(styles, /\.vital-row\[data-need="primary"\] span::after/);
  assert.match(styles, /content:\s*"优先"/);
  assert.match(styles, /content:\s*"留意"/);
  assert.match(styles, /\.vital-row\[data-focus="true"\]/);
  assert.match(styles, /\.vital-row\[data-vital="mood"\]\[data-stage=/);
  assert.match(styles, /\.vital-row\[data-vital="energy"\]\[data-stage=/);
  assert.match(styles, /\.vital-row:focus-visible/);
  assert.match(styles, /\.vital-chips/);
  assert.match(styles, /\.vital-chip\[data-need="primary"\]/);
  assert.match(styles, /\.vital-focus-action/);
  assert.match(styles, /\.vital-focus-action\[hidden\]/);
  assert.match(styles, /\.pet-stats\[data-focus-source="inspect"\] \.vital-focus-action/);
  assert.match(styles, /\.pet-stats\[data-focus-source="touch"\] \.vital-focus-action/);
  assert.match(styles, /\.vital-focus-action\[data-vital="mood"\]/);
  assert.match(styles, /\.vital-focus-action em/);
  assert.match(styles, /\.vital-focus-action em\[hidden\]/);
  assert.match(styles, /\.vital-focus-impact/);
  assert.match(styles, /\.vital-focus-impact\[data-tone="positive"\]/);
  assert.match(styles, /\.care-feedback/);
  assert.match(styles, /\.care-feedback span \{[\s\S]*display:\s*-webkit-box;[\s\S]*-webkit-line-clamp:\s*2;[\s\S]*white-space:\s*normal;/);
  assert.match(styles, /\.care-feedback small/);
  assert.match(styles, /\.care-feedback em/);
  assert.match(styles, /\.care-feedback small\[hidden\]/);
  assert.match(styles, /\.care-feedback em\[hidden\]/);
  assert.match(styles, /\.care-feedback\[data-focus="mood"\]/);
  assert.match(styles, /\.care-feedback\[data-milestone="true"\]/);
  assert.match(styles, /\.care-feedback\[data-milestone-tone="warning"\]/);
  assert.match(styles, /\.care-guidance/);
  assert.match(styles, /\.care-guidance b/);
  assert.match(styles, /\.care-guidance-detail/);
  assert.match(styles, /\.care-guidance small/);
  assert.match(styles, /\.care-guidance small\[data-tone="positive"\]/);
  assert.match(styles, /\.pet\[data-surface="home"\] \.care-guidance/);
  assert.match(styles, /\.home-action-label/);
  assert.match(styles, /\.home-action-meta/);
  assert.match(styles, /\.home-actions #focusNow\[data-action="review"\]/);
  assert.match(styles, /\.home-actions #quickChat\[data-unread="true"\]/);
  assert.match(styles, /\.home-actions #careMenu\[data-action="rest"\]/);
  assert.match(styles, /\.home-actions #careMenu\[data-action="clean"\]/);
  assert.match(styles, /\.care-action\.recommended/);
  assert.match(styles, /\.care-action\.blocked/);
  assert.match(styles, /\.care-action\.soft/);
  assert.match(styles, /\.care-action\[data-guard="blocked"\] \.care-action-copy small/);
  assert.match(styles, /\.care-action-effects em\[data-recommendation-reason="true"\]/);
  assert.match(styles, /\.care-action-effects em\[data-stage-preview="up"\]/);
  assert.match(styles, /\.care-action-effects i\[data-impact="positive"\]/);
  assert.match(styles, /\.care-menu-insight/);
  assert.match(styles, /\.care-menu-insight\[data-focus="energy"\]/);
  assert.match(styles, /\.review-summary/);
  assert.match(styles, /\.review-ai/);
  assert.match(styles, /\.review-row/);
  assert.match(styles, /\.review-next-action/);
  assert.match(styles, /\.review-next-action\[data-action="rest"\] button/);
  assert.match(styles, /\.chat-header\s*\{[\s\S]*display:\s*none/);
  assert.match(styles, /\.chat-tools\s*\{[\s\S]*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(styles, /\.chat-file-card/);
  assert.match(styles, /\.chat-compose\[data-mode="voice"\]/);
  assert.match(styles, /\.chat-voice-bubble/);
  assert.match(styles, /\.pet\[data-surface="chat"\] #context/);
  assert.match(styles, /\.pet\[data-surface="tasks"\] #context/);
  assert.match(styles, /\.pet\[data-surface="settings"\] #context/);
  assert.match(styles, /\.pet:has\(\.pet-menu:not\(\.hidden\)\) #context/);
  assert.match(styles, /\.task-item\.done \.task-meta/);
  assert.match(styles, /\.task-composer-feedback/);
  assert.match(styles, /\.task-composer-feedback\[data-tone="error"\]/);
  assert.match(styles, /\.task-load-note/);
  assert.match(styles, /\.task-load-note small/);
  assert.match(styles, /\.task-load-note em/);
  assert.match(styles, /\.task-load-note\[data-load="clear"\]/);
  assert.match(styles, /\.task-completion-cue/);
  assert.match(styles, /\.task-reopen-cue/);
  assert.match(styles, /\.task-overflow-note/);
  assert.match(styles, /\.task-overflow-note small/);
  assert.match(styles, /\.pet\[data-task-load="overload"\] \.task-item/);
  assert.match(styles, /\.pet\[data-task-load="overload"\] \.task-composer/);
  assert.match(styles, /\.pet\[data-task-activity="screen-watch"\] \.avatar::after/);
  assert.match(styles, /\.pet\.task-watch\.expanded\[data-surface="tasks"\]/);
  assert.match(styles, /\.pet\.expanded\[data-surface="tasks"\]\[data-task-behavior="empty"\]/);
  assert.match(styles, /\.pet\.expanded\[data-surface="tasks"\]\[data-task-behavior="clear"\]/);
  assert.match(styles, /\.pet\.has-nudge\[data-nudge-target="care"\]/);
  assert.match(styles, /\.pet\[data-vibe="tired"\]/);
  assert.match(styles, /\.pet-stats\[data-vibe="fragile"\]/);
  assert.match(styles, /\.pet\[data-vibe="fragile"\]/);
  assert.match(renderer, /PET_VITALS_STORAGE_KEY/);
  assert.match(renderer, /PET_OFFLINE_REST_MINUTES/);
  assert.match(renderer, /PET_OFFLINE_RECOVERY_CAP_HOURS/);
  assert.match(renderer, /CARE_ACTIONS/);
  assert.match(renderer, /CARE_ACTION_GUARDS/);
  assert.match(renderer, /CARE_ACTION_REPEAT_COOLDOWN_MS/);
  assert.match(renderer, /lowMoodWork/);
  assert.match(renderer, /newBondFocus/);
  assert.match(renderer, /TASK_VITAL_EVENTS/);
  assert.match(renderer, /TASK_ACTIVE_LIMIT/);
  assert.match(renderer, /TASK_SURFACE_VITAL_EVENTS/);
  assert.match(renderer, /TASK_SURFACE_REPEAT_REASONS/);
  assert.match(renderer, /TASK_SURFACE_REPEAT_FOCUS/);
  assert.match(renderer, /recordPetVitalsFeedback\(TASK_SURFACE_REPEAT_REASONS\[load\]/);
  assert.match(renderer, /empty:\s*\{\s*delta:\s*\{\s*bond:\s*1\s*\}/);
  assert.match(renderer, /clear:\s*\{\s*delta:\s*\{\s*mood:\s*3,\s*bond:\s*2\s*\}/);
  assert.match(renderer, /REVIEW_VITAL_STORAGE_KEY/);
  assert.match(renderer, /REVIEW_VITAL_EVENTS/);
  assert.match(renderer, /CHAT_VITAL_EVENTS/);
  assert.match(renderer, /CHAT_VITAL_REPEAT_REASONS/);
  assert.match(renderer, /recordPetVitalsFeedback\(CHAT_VITAL_REPEAT_REASONS\[eventName\]/);
  assert.match(renderer, /TOUCH_VITAL_EVENTS/);
  assert.match(renderer, /TOUCH_VITAL_COOLDOWN_MS/);
  assert.match(renderer, /fragile:\s*\{\s*delta:\s*\{\s*mood:\s*1,\s*energy:\s*2,\s*bond:\s*1\s*\}/);
  assert.match(renderer, /function touchVitalFocus/);
  assert.match(renderer, /touchVitalFocus\(effect\)/);
  assert.match(renderer, /SETTINGS_VITAL_EVENTS/);
  assert.match(renderer, /SETTINGS_VITAL_FOCUS/);
  assert.match(renderer, /SETTINGS_VITAL_COOLDOWN_MS/);
  assert.match(renderer, /lowEnergyWork:[\s\S]*delta:\s*\{\s*energy:\s*4\s*\}/);
  assert.match(renderer, /lowMoodWork:[\s\S]*delta:\s*\{\s*mood:\s*4\s*\}/);
  assert.match(renderer, /petVitals\.energy < 30 && CARE_ACTION_GUARDS\.lowEnergyWork/);
  assert.match(renderer, /petVitals\.mood < 35 && CARE_ACTION_GUARDS\.lowMoodWork/);
  assert.match(renderer, /petVitals\.bond < 40 && CARE_ACTION_GUARDS\.newBondFocus/);
  assert.match(renderer, /function careRecommendation/);
  assert.match(renderer, /function updateHomeCareAction/);
  assert.match(renderer, /function homeCareMetaText/);
  assert.match(renderer, /function homeCareTitleText/);
  assert.match(renderer, /function homeCareCooldownReasonText/);
  assert.match(renderer, /function homeCareCooldownMetaText/);
  assert.match(renderer, /function homeCareCooldownImpactText/);
  assert.match(renderer, /function homeCareCooldownTitleText/);
  assert.match(renderer, /homeCareButton\.dataset\.action/);
  assert.match(renderer, /homeCareButton\.dataset\.impact = impact/);
  assert.match(renderer, /homeCareButton\.dataset\.reason = reason/);
  assert.match(renderer, /homeCareCooldownTitleText\(reason, impact\)/);
  assert.match(renderer, /`\$\{reason\} · \$\{observation\}`/);
  assert.match(renderer, /petVitalsMilestoneKind === petVitalsFocus/);
  assert.match(renderer, /petVitalsMilestoneTone === 'warning'/);
  assert.match(renderer, /先观察精力回升/);
  assert.match(renderer, /先观察心情回升/);
  assert.match(renderer, /先观察亲密增加/);
  assert.match(renderer, /function updateHomeTaskAction/);
  assert.match(renderer, /function taskHomeMetaText/);
  assert.match(renderer, /function taskHomeTitleText/);
  assert.match(renderer, /focusNowButton\.dataset\.taskLoad = load/);
  assert.match(renderer, /focusNowButton\.dataset\.overflow = String\(overflowCount\)/);
  assert.match(renderer, /pet\.dataset\.taskTarget = shortTaskText\(task\)/);
  assert.match(renderer, /function updateHomeChatAction/);
  assert.match(renderer, /function setHomeActionContent/);
  assert.match(renderer, /home-action-label/);
  assert.match(renderer, /home-action-meta/);
  assert.match(renderer, /quickChatButton\.dataset\.status/);
  assert.match(renderer, /function orderedCareActions/);
  assert.match(renderer, /function careActionRank/);
  assert.match(renderer, /function careMenuInsightImpactText/);
  assert.match(renderer, /function careMenuStageInsightText/);
  assert.match(renderer, /function careMenuInsightText/);
  assert.match(renderer, /function setCareMenuVisible/);
  assert.match(renderer, /function focusRecommendedCareAction/);
  assert.match(renderer, /careMenuInsight\.textContent/);
  assert.match(renderer, /careMenuInsight\.dataset\.focus/);
  assert.match(renderer, /homeCareButton\.setAttribute\('aria-expanded', String\(visible\)\)/);
  assert.match(renderer, /setCareMenuVisible\(true, \{ focusRecommended: true \}\)/);
  assert.match(renderer, /建议\$\{recommendation\.label\}/);
  assert.match(renderer, /预计\$\{preview\.label\}回到\$\{preview\.next\.label\}/);
  assert.match(renderer, /先稳住\$\{primary\.label\}，再轻轻照顾\$\{secondary\.label\}；建议\$\{recommendation\.label\}，\$\{impact\}/);
  assert.match(renderer, /function compoundVitalState/);
  assert.match(renderer, /function compoundCareAction/);
  assert.match(renderer, /function careActionFollowUpText/);
  assert.match(renderer, /function careActionRepeatReason/);
  assert.match(renderer, /function careActionRepeatText/);
  assert.match(renderer, /function petVitalsSourceLabel/);
  assert.match(renderer, /activeSurface === 'tasks' && taskLoadState\(\) === 'overload'/);
  assert.match(renderer, /function petVitalsSourceText/);
  assert.match(renderer, /function petVitalsSourceTitle/);
  assert.match(renderer, /任务·超限/);
  assert.match(renderer, /状态来源：任务 · 待办超限/);
  assert.match(renderer, /`照料·\$\{detail\}`/);
  assert.match(renderer, /petStats\.source\.textContent/);
  assert.match(renderer, /function careActionCooldownActive/);
  assert.match(renderer, /homeCareButton\.dataset\.action = 'cooldown'/);
  assert.match(renderer, /repeatKey:\s*animationAction/);
  assert.match(renderer, /repeatLabel:\s*repeatAction\.label/);
  assert.match(renderer, /lastCareActionName === repeatKey/);
  assert.match(renderer, /function actionStagePreview/);
  assert.match(renderer, /function careActionStageBadges/);
  assert.match(renderer, /stagePreview/);
  assert.match(renderer, /function vitalNeedOrder/);
  assert.match(renderer, /function vitalTargetBadgeText/);
  assert.match(renderer, /function vitalChipText/);
  assert.match(renderer, /function vitalChipActionHint\(kind, progress/);
  assert.match(renderer, /点一下，我先陪它缓一下心情。/);
  assert.match(renderer, /点一下，我会让它先休息。/);
  assert.match(renderer, /点一下，我会先打个招呼，让它安心靠近。/);
  assert.match(renderer, /function vitalAccessibleHint/);
  assert.match(renderer, /moodTarget:\s*document\.querySelector\('#moodTarget'\)/);
  assert.match(renderer, /chips:\s*\{/);
  assert.match(renderer, /dataset\.need\s*=\s*needState/);
  assert.match(renderer, /petStats\.rows\[kind\]\.setAttribute\('aria-pressed', String\(focused\)\)/);
  assert.match(renderer, /chip\.setAttribute\('aria-pressed', String\(focused\)\)/);
  assert.match(renderer, /function vitalFocusFromDelta/);
  assert.match(renderer, /function focusedVitalCareAction/);
  assert.match(renderer, /function focusedVitalSummary/);
  assert.match(renderer, /function focusedVitalNextStepText/);
  assert.match(renderer, /function focusedVitalReasonText/);
  assert.match(renderer, /function focusedVitalReasonBadgeText/);
  assert.match(renderer, /function focusedVitalActionText/);
  assert.match(renderer, /function vitalFocusActionLabel/);
  assert.match(renderer, /function vitalFocusGoalText/);
  assert.match(renderer, /function vitalFocusActionTitle/);
  assert.match(renderer, /function vitalFocusActionReason/);
  assert.match(renderer, /function careGuidanceReadableImpactText/);
  assert.match(renderer, /return `\$\{readable\}（\$\{detail\}）`/);
  assert.match(renderer, /function vitalFocusImpactText/);
  assert.match(renderer, /const readableImpact = careGuidanceReadableImpactText\(nextStep\)/);
  assert.match(renderer, /return readableImpact \? `预计\$\{readableImpact\}` : ''/);
  assert.match(renderer, /function updateVitalFocusAction/);
  assert.match(renderer, /petStats\.focusAction\.impact\.textContent = impactText/);
  assert.match(renderer, /petStats\.focusAction\.goal\.textContent/);
  assert.match(renderer, /focusAction\.button\.title = actionTitle/);
  assert.match(renderer, /focusAction\.button\.setAttribute\('aria-label', actionTitle\)/);
  assert.match(renderer, /petVitalsFocusSource === 'touch' && !touchRepeatFeedbackActive\(\)/);
  assert.match(renderer, /return `摸摸·\$\{progress\.stage\.label\}`/);
  assert.match(renderer, /return '继续互动'/);
  assert.match(renderer, /focusAction:\s*\{/);
  assert.match(renderer, /petStats\.focusAction\.button\.dataset\.action/);
  assert.match(renderer, /刚看过亲密，适合轻互动/);
  assert.match(renderer, /关系正在变熟，先轻互动增加安全感/);
  assert.match(renderer, /function vitalProgressFeelingText/);
  assert.doesNotMatch(renderer, /reason:\s*`回应\$\{VITAL_LABELS\[petVitalsFocus\]\}`/);
  assert.match(renderer, /dataset\.recommendationReason/);
  assert.match(renderer, /let petVitalsFocus/);
  assert.match(renderer, /let petVitalsFocusSource/);
  assert.match(renderer, /dataset\.focus\s*=\s*focused \? 'true' : 'false'/);
  assert.doesNotMatch(renderer, /focused \? `刚刚回应：\$\{needHint\}` : needHint/);
  assert.match(renderer, /focusSource:\s*'inspect'/);
  assert.match(renderer, /function vitalNeedText/);
  assert.match(renderer, /心情快回稳了/);
  assert.match(renderer, /关系已经亲近，继续靠近默契/);
  assert.match(renderer, /function compactCareRecentText/);
  assert.match(renderer, /function recentFeedbackBadgeText/);
  assert.match(renderer, /function careRecentFeedbackBadgeText/);
  assert.match(renderer, /刚\$\{label\}\$\{careRepeatFeedbackActive\(\) \? '过' : ''\}/);
  assert.match(renderer, /刚安抚心情/);
  assert.match(renderer, /任务同步/);
  assert.match(renderer, /function feedbackReasonText/);
  assert.match(renderer, /recent:\s*document\.querySelector\('#petCareRecent'\)/);
  assert.match(renderer, /function vitalRowHint/);
  assert.match(renderer, /下一步先照顾\$\{nextProgress\.label\}，\$\{vitalProgressFeelingText\(nextProgress\)\}/);
  assert.match(renderer, /下一步先/);
  assert.match(renderer, /fragile:\s*'sleep'/);
  assert.match(renderer, /状态有点脆弱，先缓一缓/);
  assert.match(renderer, /多项状态偏低/);
  assert.match(renderer, /function petNextStep/);
  assert.match(renderer, /function taskFeedbackLeadText/);
  assert.match(renderer, /待办超限，先守住/);
  assert.match(renderer, /function careGuidanceImpactText/);
  assert.match(renderer, /function vitalImpactValueText/);
  assert.match(renderer, /function careActionImpactBadges/);
  assert.match(renderer, /vitalImpactValueText\(kind, normalized\[kind\]/);
  assert.match(renderer, /careActionImpactBadges\(action\.delta,\s*CARE_ACTION_FOCUS/);
  assert.match(renderer, /function careGuidancePreviewDetailText/);
  assert.match(renderer, /function careGuidancePreviewText/);
  assert.match(renderer, /function careGuidancePreviewDisplayText/);
  assert.match(renderer, /function careGuidancePreviewTitleText/);
  assert.match(renderer, /return `\$\{displayText\}（\$\{detail\}）`/);
  assert.match(renderer, /function careGuidanceActionTitle/);
  assert.match(renderer, /function careGuidanceActionTitle\(nextStep, previewText = '', previewDetail = ''\)/);
  assert.match(renderer, /const preview = careGuidancePreviewTitleText\(nextStep, previewText, previewDetail\)/);
  assert.match(renderer, /function careGuidanceReasonTitle/);
  assert.match(renderer, /function careGuidanceDetailText/);
  assert.match(renderer, /function careGuidancePreviewAriaLabel/);
  assert.match(renderer, /const preview = vitalDeltaText\(action\.delta\)/);
  assert.match(renderer, /预计\$\{preview\}/);
  assert.match(renderer, /now\.title = nextStepActionTitle/);
  assert.match(renderer, /why\.setAttribute\('aria-label', nextStepReasonTitle\)/);
  assert.match(renderer, /preview\.setAttribute\('aria-label', nextStepPreviewAriaLabel\)/);
  assert.match(renderer, /心情回升/);
  assert.match(renderer, /会耗精力/);
  assert.match(renderer, /preview\.title = nextStepPreviewTitle \|\| nextStepPreviewDisplay/);
  assert.match(renderer, /preview:\s*document\.querySelector\('#petCarePreview'\)/);
  assert.match(renderer, /why:\s*document\.querySelector\('#petCareWhy'\)/);
  assert.match(renderer, /dataset\.impact/);
  assert.match(renderer, /reason:\s*recommendation\.reason/);
  assert.match(renderer, /function runPetNextStep/);
  assert.match(renderer, /VITAL_INSIGHT_COOLDOWN_MS/);
  assert.match(renderer, /function vitalInsightRepeatAction/);
  assert.match(renderer, /function vitalInsightRepeatText/);
  assert.match(renderer, /function vitalInsight/);
  assert.match(renderer, /function inspectVital/);
  assert.match(renderer, /function idleNudgeProfile/);
  assert.match(renderer, /delta:\s*\{\s*energy:\s*-1\s*\}[\s\S]*reason:\s*'精力偏低还等太久/);
  assert.match(renderer, /focus:\s*'bond'/);
  assert.match(renderer, /applyPetVitalsDelta\(profile\.delta, profile\.reason, \{ focus: profile\.focus, focusSource: 'focus' \}\)/);
  assert.match(renderer, /function offlineRestEffect/);
  assert.match(renderer, /focusSource:\s*'offline'/);
  assert.match(renderer, /function offlineRestFeedbackActive/);
  assert.match(renderer, /return '离开后恢复了精力'/);
  assert.match(renderer, /return '先接回节奏'/);
  assert.match(renderer, /function settingsVitalEffect/);
  assert.match(renderer, /function applySettingsVitalEvent/);
  assert.match(renderer, /focusSource:\s*'settings'/);
  assert.match(renderer, /SETTINGS_SURFACE_VITAL_EVENT/);
  assert.match(renderer, /function applySettingsSurfaceVitalEvent/);
  assert.match(renderer, /applyPetVitalsDelta\(SETTINGS_SURFACE_VITAL_EVENT\.delta/);
  assert.match(renderer, /activeSurface === 'review'\) return '正在复盘今天节奏'/);
  assert.match(renderer, /activeSurface === 'review'\) return '看今日复盘'/);
  assert.match(renderer, /function settingListText/);
  assert.match(renderer, /function careActionGuard/);
  assert.match(renderer, /function careActionEffect/);
  assert.match(renderer, /function petVibe/);
  assert.match(renderer, /MOOD_STAGES/);
  assert.match(renderer, /ENERGY_STAGES/);
  assert.match(renderer, /function moodStage/);
  assert.match(renderer, /function energyStage/);
  assert.match(renderer, /BOND_STAGES/);
  assert.match(renderer, /function bondStageText/);
  assert.match(renderer, /return vitalProgressFeelingText\(vitalProgress\('bond'\)\)/);
  assert.match(renderer, /function feedbackRelationshipText/);
  assert.doesNotMatch(renderer, /feedbackText = `\$\{vitalNeedText\(\)\} · 最近：\$\{petVitalsReason\}\$\{petVitalsMilestone \? ` · \$\{petVitalsMilestone\}` : ''\} · \$\{bondStageText\(stage\)\}`/);
  assert.match(renderer, /function stageAdvance/);
  assert.match(renderer, /function stageDrop/);
  assert.match(renderer, /function vitalStageMilestoneInfo/);
  assert.match(renderer, /function vitalStageMilestone/);
  assert.match(renderer, /function vitalMilestoneKind/);
  assert.match(renderer, /let petVitalsMilestoneKind = ''/);
  assert.match(renderer, /kind: 'bond'/);
  assert.match(renderer, /lastMilestoneKind: petVitalsMilestoneKind/);
  assert.match(renderer, /milestoneKind === 'bond'/);
  assert.match(renderer, /关系更\$\{bondAdvance\.next\.label\}了/);
  assert.match(renderer, /精力回到\$\{energyAdvance\.next\.label\}/);
  assert.match(renderer, /心情回到\$\{moodAdvance\.next\.label\}/);
  assert.match(renderer, /function vitalDeltaText/);
  assert.match(renderer, /function careFeedbackImpactText/);
  assert.match(renderer, /function careFeedbackPendingText/);
  assert.match(renderer, /careFeedbackPendingText\(focus, petVitalsFocusSource\)/);
  assert.match(renderer, /bond:\s*'亲密待回应'/);
  assert.match(renderer, /source === 'inspect'/);
  assert.match(renderer, /bond:\s*'亲密待行动'/);
  assert.match(renderer, /source === 'touch'/);
  assert.match(renderer, /bond:\s*'亲密先缓缓'/);
  assert.match(renderer, /source === 'care'/);
  assert.match(renderer, /energy:\s*'精力观察中'/);
  assert.match(renderer, /source === 'settings'/);
  assert.match(renderer, /bond:\s*'亲密已确认'/);
  assert.match(renderer, /function careFeedbackAriaLabel/);
  assert.match(renderer, /petStats\.feedback\.setAttribute\('aria-label', feedbackAriaLabel\)/);
  assert.match(renderer, /const deltaTitle = deltaDetail === '状态稳定' && deltaText !== '状态稳定' \? deltaText : deltaDetail/);
  assert.match(renderer, /petStats\.delta\.title = deltaTitle/);
  assert.match(renderer, /function vitalDeltaBadgeText/);
  assert.match(renderer, /PET_VIBE_ANIMATIONS/);
  assert.match(renderer, /function renderCareMenu/);
  assert.match(renderer, /function applyPetVitalsDelta/);
  assert.match(renderer, /function recordPetVitalsFeedback/);
  assert.match(renderer, /applyPetVitalsDelta\(effect\.delta, effect\.reason, \{ focus, focusSource: 'touch' \}\)/);
  assert.match(renderer, /recordPetVitalsFeedback\(effect\.reason, \{ focus, focusSource: 'touch' \}\)/);
  assert.match(renderer, /function touchRepeatFeedbackActive/);
  assert.match(renderer, /return '刚回应过摸摸，先缓一缓'/);
  assert.match(renderer, /return '别频繁戳它'/);
  assert.match(renderer, /function careRepeatFeedbackActive/);
  assert.match(renderer, /return '刚照料过，先观察状态'/);
  assert.match(renderer, /return '观察变化'/);
  assert.match(renderer, /recordPetVitalsFeedback\(insight\.reason, \{ focus: kind, focusSource: 'inspect' \}\)/);
  assert.match(renderer, /updatedAt:\s*Date\.now\(\)/);
  assert.match(renderer, /function taskVitalEffect/);
  assert.match(renderer, /function applyTaskVitalEvent/);
  assert.match(renderer, /function recordTaskCompletionFeedback/);
  assert.match(renderer, /function taskCompletionFeedbackActive/);
  assert.match(renderer, /function taskCompletionCueText/);
  assert.match(renderer, /function recordTaskReopenFeedback/);
  assert.match(renderer, /function setTaskComposerFeedback/);
  assert.match(renderer, /newTaskText\.setAttribute\('aria-invalid'/);
  assert.match(renderer, /addTaskButton\.disabled = true/);
  assert.match(renderer, /addTaskButton\.disabled = false/);
  assert.match(renderer, /function clearTaskComposerFeedback/);
  assert.match(renderer, /newTaskText\.addEventListener\('input', clearTaskComposerFeedback\)/);
  assert.match(renderer, /newTaskText\.focus\(\)/);
  assert.match(renderer, /function taskReopenFeedbackActive/);
  assert.match(renderer, /function taskReopenCueText/);
  assert.match(renderer, /function taskLoadState/);
  assert.match(renderer, /function taskBehaviorState/);
  assert.match(renderer, /function taskLoadPetReaction/);
  assert.match(renderer, /function taskAvatarA11yText/);
  assert.match(renderer, /function updateAvatarA11y/);
  assert.match(renderer, /看着屏幕，待办超限/);
  assert.match(renderer, /const TASK_OVERLOAD_VISIBLE_ROWS = 4;/);
  assert.match(renderer, /function orderedTaskRows/);
  assert.match(renderer, /function appendTaskOverflowNote/);
  assert.match(renderer, /pet\.dataset\.taskActivity = 'screen-watch'/);
  assert.match(renderer, /delete pet\.dataset\.taskTarget/);
  assert.match(renderer, /delete pet\.dataset\.taskActivity/);
  assert.match(renderer, /屏幕太满会让它紧张/);
  assert.match(renderer, /function taskSurfacePetAnimation/);
  assert.match(renderer, /function taskVitalsSummary/);
  assert.match(renderer, /function applyTaskSurfaceVitalEvent/);
  assert.match(renderer, /function reviewVitalEffect/);
  assert.match(renderer, /function reviewNextStep/);
  assert.match(renderer, /function reviewLlmNextStep/);
  assert.match(renderer, /taskLoadState\(\) === 'clear'/);
  assert.match(renderer, /function applyReviewVitalEvent/);
  assert.match(renderer, /REVIEW_VITAL_REPEAT_REASONS/);
  assert.match(renderer, /REVIEW_VITAL_REPEAT_FOCUS/);
  assert.match(renderer, /recordPetVitalsFeedback\(REVIEW_VITAL_REPEAT_REASONS\[effect\.key\]/);
  assert.match(renderer, /function renderReview/);
  assert.match(renderer, /function renderReviewCharts/);
  assert.match(renderer, /function renderReviewDonut/);
  assert.match(renderer, /function renderReviewHourlyChart/);
  assert.match(renderer, /function renderReviewTopAppsChart/);
  assert.match(renderer, /function renderReviewTaskInsights/);
  assert.match(renderer, /function renderTomorrowPlan/);
  assert.match(renderer, /async function applyTomorrowPlan/);
  assert.match(renderer, /window\.focusPet\.applyTomorrowPlan\(review\.tomorrowPlan\)/);
  assert.match(renderer, /if \(taskInsightsNode\) reviewNodes\.push\(taskInsightsNode\)/);
  assert.match(renderer, /reviewBox\.append\(\.\.\.reviewNodes\)/);
  assert.match(preload, /applyTomorrowPlan: plan => ipcRenderer\.invoke\('tasks:apply-tomorrow-plan', plan\)/);
  assert.match(main, /ipcMain\.handle\('tasks:apply-tomorrow-plan', \(_event, plan\) => focus\.applyTomorrowPlan\(plan\)\)/);
  assert.match(styles, /\.review-task-insights/);
  assert.match(styles, /\.review-tomorrow/);
  assert.match(styles, /\.review-tomorrow-actions/);
  assert.match(styles, /\.review-charts/);
  assert.match(styles, /\.review-donut/);
  assert.match(styles, /\.review-hourly-chart/);
  assert.match(styles, /\.review-app-row/);
  assert.match(styles, /conic-gradient/);
  assert.match(renderer, /function applyChatVitalEvent/);
  assert.match(renderer, /row\.title = metaText/);
  assert.doesNotMatch(renderer, /row\.appendChild\(meta\)/);
  assert.match(renderer, /function touchVitalEffect/);
  assert.match(renderer, /function touchPet/);
  assert.match(renderer, /function activateAvatarInteraction/);
  assert.match(renderer, /avatar\.addEventListener\('keydown'/);
  assert.match(renderer, /function syncChatMessage/);

  for (const [state, row, frames] of [
    ['idle', 0, 6],
    ['running-right', 1, 8],
    ['running-left', 2, 8],
    ['waving', 3, 4],
    ['jumping', 4, 5],
    ['failed', 5, 8],
    ['waiting', 6, 6],
    ['running', 7, 6],
    ['review', 8, 6]
  ]) {
    assert.match(renderer, new RegExp(`${state.replace('-', '\\-')}['"]?: \\{ row: ${row}, frames: ${frames}, frameMs: \\d+ \\}`));
  }

  assert.match(renderer, /work:\s*'busy'/);
  assert.match(renderer, /study:\s*'focus'/);
  assert.match(renderer, /game:\s*'dance'/);
  assert.match(renderer, /distracted:\s*'cry'/);
  assert.match(renderer, /permission:\s*'waiting'/);
  assert.match(renderer, /unknown:\s*'waiting'/);
  assert.match(renderer, /mood-study/);
  assert.match(renderer, /mood-game/);
  assert.match(renderer, /\['distracted', 'game', 'unknown', 'permission'\]\.includes\(lastStatus\.status\)/);
  assert.match(indexHtml, /src="intervention-policy\.js"/);
  assert.match(renderer, /window\.focusPetInterventionPolicy/);
  assert.match(renderer, /shouldShowIntervention/);
});

test('desktop page defines a strict Electron CSP', () => {
  const indexHtml = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'index.html'), 'utf8');
  assert.match(indexHtml, /http-equiv="Content-Security-Policy"/);
  assert.match(indexHtml, /script-src 'self'/);
  assert.match(indexHtml, /object-src 'none'/);
  assert.doesNotMatch(indexHtml, /unsafe-eval/);
  assert.doesNotMatch(indexHtml, /unsafe-inline/);
});

test('screen monitor is wired through Electron and settings UI', () => {
  const packageJson = fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8');
  const main = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'preload.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'index.html'), 'utf8');
  const renderer = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'renderer.js'), 'utf8');
  const focus = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'focus.js'), 'utf8');
  const pipelineScript = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts', 'test-screen-review-pipeline.js'), 'utf8');

  assert.match(packageJson, /node --check src\/screen-monitor\.js/);
  assert.match(packageJson, /node --check src\/review-llm\.js/);
  assert.match(packageJson, /node --check scripts\/test-screen-review-pipeline\.js/);
  assert.match(packageJson, /"test:screen-pipeline": "electron scripts\/test-screen-review-pipeline\.js"/);
  assert.match(main, /desktopCapturer/);
  assert.match(main, /systemPreferences/);
  assert.match(main, /require\('\.\/screen-monitor'\)/);
  assert.match(main, /screen-monitor:sample/);
  assert.match(main, /screen-monitor:sample', \(_event, options\) => sampleScreenMonitor\(options\)/);
  assert.match(main, /options\?\.review/);
  assert.match(main, /focus\.getDailyReview\(\{ screenAnalysis: result, fetchImpl: fetch \}\)/);
  assert.match(main, /pipelineReview/);
  assert.match(main, /app:open-screen-recording-settings/);
  assert.match(preload, /sampleScreenMonitor: options => ipcRenderer\.invoke\('screen-monitor:sample', options\)/);
  assert.match(preload, /openScreenRecordingSettings/);
  assert.match(indexHtml, /id="settingScreenMonitorEnabled"/);
  assert.match(indexHtml, /id="settingScreenMonitorInterval"/);
  assert.match(indexHtml, /id="settingScreenMonitorEndpoint"/);
  assert.match(indexHtml, /id="settingScreenMonitorModel"/);
  assert.match(indexHtml, /id="settingReviewLlmEnabled"/);
  assert.match(indexHtml, /id="settingReviewLlmEndpoint"/);
  assert.match(indexHtml, /id="settingReviewLlmModel"/);
  assert.match(indexHtml, /id="testScreenMonitor"/);
  assert.match(focus, /require\('\.\/review-llm'\)/);
  assert.match(focus, /summarizeDailyReview/);
  assert.match(focus, /docs', 'errorThing\.md'/);
  assert.match(renderer, /screenMonitorTimer/);
  assert.match(renderer, /function scheduleScreenMonitor/);
  assert.match(renderer, /async function sampleScreenMonitor/);
  assert.match(renderer, /window\.focusPet\.sampleScreenMonitor\(options\)/);
  assert.match(renderer, /result\.pipelineReview\?\.llm\?\.ok/);
  assert.match(renderer, /result\.pipelineReview\?\.llm && !result\.pipelineReview\.llm\.ok/);
  assert.match(renderer, /sampleScreenMonitor\(\{ manual: true, review: true \}\)/);
  assert.match(renderer, /settingControls\.screenMonitorEnabled/);
  assert.match(renderer, /settingControls\.screenMonitorIntervalSeconds/);
  assert.match(renderer, /settingControls\.reviewLlmEnabled/);
  assert.match(renderer, /settingControls\.reviewLlmEndpoint/);
  assert.match(renderer, /settingControls\.reviewLlmModel/);
  assert.match(pipelineScript, /desktopCapturer/);
  assert.match(pipelineScript, /monitorConfig\(settings, process\.env\)/);
  assert.match(pipelineScript, /reviewLlmConfig\(settings, process\.env\)/);
  assert.match(pipelineScript, /capturePrimaryScreen\(desktopCapturer\)/);
  assert.match(pipelineScript, /analyzeScreenActivity\(/);
  assert.match(pipelineScript, /focus\.getDailyReview\(\{ screenAnalysis, fetchImpl: fetch \}\)/);
  assert.match(pipelineScript, /process\.exitCode = review\.llm\?\.ok \? 0 : 3/);
  assert.match(pipelineScript, /app\.exit\(process\.exitCode \|\| 0\)/);
});

test('permission onboarding guides users through required system permissions', () => {
  const main = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');
  const preload = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'preload.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'index.html'), 'utf8');
  const renderer = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'renderer.js'), 'utf8');
  const styles = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'styles.css'), 'utf8');
  const renderVerifier = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts', 'verify-pet-render.js'), 'utf8');

  const macProfile = platformSettingsProfile('darwin');
  assert.match(macProfile.permissionGuideTitle, /权限引导/);
  assert.ok(macProfile.permissionGuideSteps.some(step => /辅助功能/.test(step.title)));
  assert.ok(macProfile.permissionGuideSteps.some(step => /屏幕录制/.test(step.title)));

  assert.match(main, /function buildPermissionStatus/);
  assert.match(main, /app:permission-status/);
  assert.match(preload, /getPermissionStatus: \(\) => ipcRenderer\.invoke\('app:permission-status'\)/);

  assert.match(indexHtml, /id="permissionGuide"/);
  assert.match(indexHtml, /id="permissionGuideList"/);
  assert.match(indexHtml, /id="refreshPermissions"/);
  assert.match(indexHtml, /id="permissionGuideStatus"/);

  assert.match(renderer, /function renderPermissionGuide/);
  assert.match(renderer, /function loadPermissionGuide/);
  assert.match(renderer, /window\.focusPet\.getPermissionStatus\(\)/);
  assert.match(renderer, /typeof window\.focusPet\.getPermissionStatus !== 'function'/);
  assert.match(renderer, /permissionGuideList/);
  assert.match(renderer, /refreshPermissionsButton\.addEventListener\('click', loadPermissionGuide\)/);
  assert.match(styles, /\.permission-guide/);
  assert.match(styles, /\.permission-step/);
  assert.match(styles, /\.permission-step\.granted/);
  assert.match(styles, /\.permission-step\.blocked/);
  assert.match(renderVerifier, /permissionGuideSteps/);
  assert.match(renderVerifier, /getPermissionStatus: async/);
});

test('launch-at-login skips system calls in development mode', () => {
  let setCalls = 0;
  let getCalls = 0;
  const devApp = {
    isPackaged: false,
    isReady: () => true,
    setLoginItemSettings: () => { setCalls += 1; },
    getLoginItemSettings: () => {
      getCalls += 1;
      return { openAtLogin: true };
    }
  };

  const state = applyLaunchAtLogin(devApp, { launchAtLogin: true }, { env: {}, path: '/tmp/Focus Pet.app' });

  assert.equal(setCalls, 0);
  assert.equal(getCalls, 0);
  assert.equal(state.launchAtLogin, true);
  assert.equal(state.launchAtLoginRequested, true);
  assert.equal(state.launchAtLoginActive, false);
  assert.equal(state.launchAtLoginSupported, false);
  assert.match(state.launchAtLoginReason, /开发模式/);
});

test('platform support exposes Windows-specific desktop frontend behavior', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  const indexHtml = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'index.html'), 'utf8');
  const renderer = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'renderer.js'), 'utf8');
  const main = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');
  const focus = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'focus.js'), 'utf8');
  const packager = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts', 'package-windows.js'), 'utf8');

  const profile = platformSettingsProfile('win32');
  assert.equal(profile.platform, 'win32');
  assert.equal(profile.name, 'Windows');
  assert.equal(profile.screenRecordingSettingsAvailable, false);
  assert.equal(profile.accessibilityButtonLabel, '隐私设置');
  assert.match(profile.permissionHelpText, /Windows/);
  assert.match(profile.screenMonitorHelpText, /Windows/);

  assert.deepEqual(platformSettingsTarget('accessibility', 'win32'), {
    kind: 'external',
    url: 'ms-settings:privacy'
  });
  assert.deepEqual(platformSettingsTarget('screen-recording', 'win32'), {
    kind: 'external',
    url: 'ms-settings:privacy'
  });

  assert.match(windowsFrontmostScript(), /GetForegroundWindow/);
  assert.match(windowsFrontmostScript(), /ConvertTo-Json -Compress/);
  assert.deepEqual(parseWindowsFrontmost('{"app":"Code","title":"focus-pet"}'), {
    app: 'Code',
    title: 'focus-pet'
  });
  assert.deepEqual(platformFocusPermission('win32'), {
    reason: 'Windows 前台窗口读取失败',
    message: '我还看不到当前窗口。请确认 Focus Pet 正在桌面运行；如果 Windows 安全策略拦截了前台窗口读取，请允许 Focus Pet 或 PowerShell。'
  });

  assert.equal(packageJson.scripts['package:win'], 'node scripts/package-windows.js');
  assert.match(packageJson.scripts.check, /scripts\/package-windows\.js/);
  assert.match(packager, /process\.platform !== 'win32'/);
  assert.match(packager, /electron\.exe/);
  assert.match(packager, /win-unpacked/);
  assert.match(packager, /latest-windows\.json/);
  assert.doesNotMatch(packager, /Electron\.app|PlistBuddy/);

  assert.match(indexHtml, /id="platformStatus"/);
  assert.match(renderer, /function renderPlatformSettings/);
  assert.match(renderer, /platformStatus/);
  assert.match(renderer, /screenRecordingSettingsAvailable === false/);
  assert.match(main, /require\('\.\/platform-support'\)/);
  assert.match(main, /app:get-platform/);
  assert.match(focus, /windowsFrontmostScript/);
  assert.match(focus, /platformFocusPermission/);
});

test('launch-at-login applies system settings for packaged builds', () => {
  let appliedOptions;
  const packagedApp = {
    isPackaged: true,
    isReady: () => true,
    setLoginItemSettings: options => { appliedOptions = options; },
    getLoginItemSettings: () => ({ openAtLogin: true })
  };

  const state = applyLaunchAtLogin(packagedApp, { launchAtLogin: true }, { env: {}, path: '/Applications/Focus Pet.app' });

  assert.deepEqual(appliedOptions, {
    openAtLogin: true,
    openAsHidden: true,
    path: '/Applications/Focus Pet.app'
  });
  assert.equal(state.launchAtLoginActive, true);
  assert.equal(state.launchAtLoginSupported, true);
  assert.equal(state.launchAtLoginApplied, true);
  assert.equal(launchAtLoginState(packagedApp, { launchAtLogin: true }, { env: {} }).launchAtLoginActive, true);
});

test('process filters include only managed Focus Pet Electron processes', () => {
  const projectRoot = '/Users/sxlx/focus-pet';
  const electronAppRoot = `${projectRoot}/node_modules/electron/dist/Electron.app`;
  const electronMain = `${electronAppRoot}/Contents/MacOS/Electron`;
  const appSupportDir = '/Users/sxlx/Library/Application Support/focus-pet';
  const output = `
25843 ${electronMain} .
25844 ${electronAppRoot}/Contents/Frameworks/Electron Helper (GPU).app/Contents/MacOS/Electron Helper (GPU) --type=gpu-process --user-data-dir=${appSupportDir}
25846 ${electronAppRoot}/Contents/Frameworks/Electron Helper (Renderer).app/Contents/MacOS/Electron Helper (Renderer) --type=renderer --app-path=${projectRoot}
31254 /Applications/Codex.app/Contents/Resources/cua_node/bin/node --working-dir ${projectRoot}
40001 ${electronMain} scripts/verify-pet-render.js
`;

  const processes = parseFocusPetProcesses(output, {
    projectRoot,
    electronAppRoot,
    electronMain,
    appSupportDir
  });

  assert.deepEqual(processes.map(processInfo => processInfo.pid), [25843, 25844, 25846]);
});

test('pet supervisor does not reopen after an intentional quit', () => {
  assert.equal(shouldRestartAfterExit({ code: 0, signal: null, stopRequested: false }), false);
  assert.equal(shouldRestartAfterExit({ code: null, signal: 'SIGTERM', stopRequested: false }), false);
  assert.equal(shouldRestartAfterExit({ code: 1, signal: null, stopRequested: false }), true);
  assert.equal(shouldRestartAfterExit({ code: null, signal: 'SIGSEGV', stopRequested: false }), true);
  assert.equal(shouldRestartAfterExit({ code: 1, signal: null, stopRequested: true }), false);

  const main = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');
  assert.match(main, /requestSupervisorStop\('quit'\)/);
  assert.match(main, /app\.on\('window-all-closed',[\s\S]*if \(isQuitting\) return;[\s\S]*event\.preventDefault\(\)/);
});

test('desktop runtime keeps optional social and GIF resources lazy for lower memory use', () => {
  const main = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'renderer.js'), 'utf8');

  assert.doesNotMatch(main, /const chatService = require\('\.\/chat-service'\)/);
  assert.match(main, /function getChatService\(\)/);
  assert.match(main, /function ensureChatServiceStarted\(\)/);
  assert.doesNotMatch(main, /app\.whenReady\(\)\.then\(\(\) => \{[\s\S]*chatService\.start\(\)/);
  assert.match(main, /ipcMain\.handle\('chat:get-state'[\s\S]*ensureChatServiceStarted\(\)/);
  assert.match(main, /ipcMain\.handle\('chat:get-port'[\s\S]*ensureChatServiceStarted\(\)\.port/);
  assert.match(main, /backgroundThrottling: true/);
  assert.match(main, /spellcheck: false/);

  assert.doesNotMatch(renderer, /loadChatState\(\)\.then\(connectChatSocket\)/);
  assert.match(renderer, /async function ensureChatConnected\(\)/);
  assert.match(renderer, /async function showChat[\s\S]*await ensureChatConnected\(\)/);
  assert.match(renderer, /function releasePetGifTray\(\)[\s\S]*petGifTray\.replaceChildren\(\)/);
  assert.match(renderer, /function setPetGifTrayVisible\(visible\)[\s\S]*if \(!visible\) releasePetGifTray\(\)/);
});

test('desktop startup keeps diagnostics and screen monitor modules lazy', () => {
  const main = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');
  const diagnostics = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'diagnostics.js'), 'utf8');

  assert.doesNotMatch(main, /const \{ buildRuntimeDiagnosticsSummary \} = require\('\.\/diagnostics'\)/);
  assert.doesNotMatch(main, /const screenMonitor = require\('\.\/screen-monitor'\)/);
  assert.doesNotMatch(main, /const llmSelfCheck = require\('\.\/llm-self-check'\)/);
  assert.match(main, /function getDiagnosticsModule\(\)/);
  assert.match(main, /function getScreenMonitor\(\)/);
  assert.match(main, /function getLlmSelfCheck\(\)/);
  assert.match(main, /function syncChatSettingsIfLoaded\(settings\)/);
  assert.match(main, /if \(chatServiceModule\) getChatService\(\)\.updateSettings\(settings\)/);
  assert.match(main, /ipcMain\.handle\('settings:update'[\s\S]*syncChatSettingsIfLoaded\(settings\)/);
  assert.match(main, /ipcMain\.handle\('app:get-diagnostics'[\s\S]*getDiagnosticsModule\(\)\.buildRuntimeDiagnosticsSummary/);
  assert.match(main, /async function testLlmConnectivity[\s\S]*getLlmSelfCheck\(\)\.runLlmConnectivitySelfCheck/);
  assert.match(main, /async function sampleScreenMonitor[\s\S]*getScreenMonitor\(\)\.analyzeScreenActivity/);
  assert.match(main, /captureScreen: \(\) => getScreenMonitor\(\)\.capturePrimaryScreen\(desktopCapturer\)/);

  assert.doesNotMatch(diagnostics, /const \{ rtcIceServerSummary \} = require\('\.\/chat-service'\)/);
  assert.match(diagnostics, /function getChatService\(\)/);
  assert.match(diagnostics, /getChatService\(\)\.rtcIceServerSummary/);
});

test('expanded pet animations and interaction GIF exports are wired', () => {
  const renderer = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'renderer.js'), 'utf8');
  const styles = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'styles.css'), 'utf8');
  const renderVerifier = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts', 'verify-pet-render.js'), 'utf8');
  const packageJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'output', 'hatch-pet', 'nervy', 'qa', 'animation-manifest.json'), 'utf8'));

  const expectedNewAnimations = {
    sleep: 9,
    eat: 10,
    pat: 11,
    dance: 12,
    celebrate: 13,
    focus: 14,
    sparkle: 15,
    stretch: 16,
    hydrate: 17,
    meditate: 18,
    read: 19,
    cheer: 20,
    morning: 21,
    hug: 22,
    surprise: 23,
    cry: 24,
    angry: 25,
    busy: 26,
    ok: 27,
    love: 28,
    call: 29
  };
  for (const [name, row] of Object.entries(expectedNewAnimations)) {
    assert.match(renderer, new RegExp(`${name}: \\{ row: ${row}, frames:`));
    assert.equal(manifest.newAnimations[name].row, row);
  }
  const expectedPetIdentity = 'elys-short-haired-sweater-girl';
  const expectedPetReference = 'src/assets/pets/nervy-sci-fi-kid/reference/elys-sticker-reference.jpg';
  assert.ok(fs.statSync(path.join(PROJECT_ROOT, expectedPetReference)).size > 1024);
  assert.equal(manifest.petIdentity.identity, expectedPetIdentity);
  assert.equal(manifest.petIdentity.generatedFromReference, true);
  assert.equal(manifest.petIdentity.characterReference, expectedPetReference);
  for (const surface of ['spritesheet', 'imagePack', 'interactionGifs']) {
    assert.ok(manifest.petIdentity.appliesTo.includes(surface));
  }
  assert.equal(manifest.spritesheet.rows, 30);
  assert.equal(manifest.spritesheet.identity, expectedPetIdentity);
  assert.equal(manifest.spritesheet.generatedFromReference, true);
  assert.equal(manifest.spritesheet.characterReference, expectedPetReference);
  assert.match(renderer, /review:\s*'read'/);
  assert.match(renderer, /work:\s*'busy'/);
  assert.match(renderer, /distracted:\s*'cry'/);
  assert.match(renderer, /callAudio:[\s\S]*action:\s*'call'/);
  assert.match(renderer, /feed: 'eat'/);
  assert.match(renderer, /play: 'dance'/);
  assert.match(renderer, /rest: 'sleep'/);
  assert.match(renderer, /behavior === 'clear'\) return 'celebrate'/);
  assert.match(styles, /background-size: 1536px 6240px;/);
  assert.match(renderVerifier, /spriteBackgroundSize === '1536px 6240px'/);
  assert.match(renderVerifier, /spriteBackgroundPosition\.endsWith\('-3952px'\)/);
  assert.match(renderVerifier, /spriteBackgroundPosition\.endsWith\('-5408px'\)/);
  assert.match(renderVerifier, /spriteBackgroundPosition\.endsWith\('-6032px'\)/);
  assert.match(renderVerifier, /petClasses\.includes\('action-call'\)/);
  assert.match(renderVerifier, /activityMeta === '刚刚同步 · 88%'/);
  assert.doesNotMatch(renderVerifier, /activityMeta\.includes\('任务：完善宠物互动'\)/);
  assert.doesNotMatch(renderVerifier, /activityMeta\.includes\('App：Code'\)/);
  assert.equal(packageJson.scripts['pet:generate-animations'], 'node scripts/run-pet-animation-generator.js');
  assert.match(packageJson.scripts.check, /node --check scripts\/run-pet-animation-generator\.js/);
  assert.ok(Object.keys(manifest.interactionGifs).length >= 22);
  for (const gifPath of Object.values(manifest.interactionGifs)) {
    assert.ok(fs.statSync(path.join(PROJECT_ROOT, gifPath)).size > 1024);
  }
  assert.equal(manifest.imagePack.sourceType, 'generated-image-pack');
  assert.equal(manifest.imagePack.usesBaseSpritesheet, false);
  assert.equal(manifest.imagePack.identity, expectedPetIdentity);
  assert.equal(manifest.imagePack.generatedFromReference, true);
  assert.equal(manifest.imagePack.characterReference, expectedPetReference);
  for (const trait of ['short black bob hair', 'cream knit sweater', 'light cream rubber clogs with visible round holes', 'warm sticker girl face', 'white sticker outline']) {
    assert.ok(manifest.imagePack.identityTraits.includes(trait));
  }
  for (const avoided of ['star-core robot', 'round teal glasses', 'mint hoodie', 'teal satchel', 'different person']) {
    assert.ok(manifest.imagePack.avoidIdentity.includes(avoided));
  }
  assert.doesNotMatch(manifest.imagePack.identityTraits.join('|'), /round teal glasses|mint hoodie|teal satchel|coral shorts/);
  assert.match(manifest.imagePack.sourceDir, /src\/assets\/pets\/nervy-sci-fi-kid\/images\/source/);
  assert.match(manifest.imagePack.frameDir, /src\/assets\/pets\/nervy-sci-fi-kid\/images\/frames/);
  assert.equal(manifest.imagePack.fullBody, true);
  assert.ok(Object.keys(manifest.imagePack.sources).length >= 24);
  const expectedImageSources = [
    'idle-standing.png',
    'run-right.png',
    'wave-morning.png',
    'jump-happy.png',
    'cry-sad.png',
    'waiting-question.png',
    'busy-laptop.png',
    'review-read.png',
    'hydrate-water.png',
    'focus-mode.png',
    'feed-loop.png',
    'meditate-calm.png',
    'celebrate-finish.png',
    'rest-sleep.png',
    'play-dance.png',
    'cheer-success.png',
    'hug-comfort.png',
    'surprise-alert.png',
    'angry-pout.png',
    'love-miss.png',
    'ok-ready.png',
    'stretch-break.png',
    'sparkle-happy.png',
    'phone-call.png'
  ];
  for (const name of expectedImageSources) {
    const sourcePath = manifest.imagePack.sources[name];
    assert.match(sourcePath, /src\/assets\/pets\/nervy-sci-fi-kid\/images\/source\/.+\.png/);
    assert.ok(fs.statSync(path.join(PROJECT_ROOT, sourcePath)).size > 1024);
  }
  for (const [name, gifPath] of Object.entries(manifest.interactionGifs)) {
    const source = manifest.interactionGifSources[name];
    assert.equal(source.sourceType, 'generated-image-pack');
    assert.equal(source.usesBaseSpritesheet, false);
    assert.ok(source.sourceImages.length >= 1);
    assert.ok(source.frameImages.length >= 4);
    for (const imagePath of [...source.sourceImages, ...source.frameImages]) {
      assert.match(imagePath, /src\/assets\/pets\/nervy-sci-fi-kid\/images\//);
      assert.ok(fs.statSync(path.join(PROJECT_ROOT, imagePath)).size > 1024);
    }
    assert.ok(fs.statSync(path.join(PROJECT_ROOT, gifPath)).size > 1024);
  }
});

test('chat can share exported pet GIFs without preloading them', () => {
  const html = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'index.html'), 'utf8');
  const preload = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'preload.js'), 'utf8');
  const main = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'main.js'), 'utf8');
  const renderer = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'renderer.js'), 'utf8');
  const styles = fs.readFileSync(path.join(PROJECT_ROOT, 'src', 'styles.css'), 'utf8');
  const gifDir = path.join(PROJECT_ROOT, 'src', 'assets', 'pets', 'nervy-sci-fi-kid', 'gifs');
  const imageDir = path.join(PROJECT_ROOT, 'src', 'assets', 'pets', 'nervy-sci-fi-kid', 'images', 'source');

  assert.match(html, /id="petGifButton"/);
  assert.match(html, /id="petGifTray"[^>]*hidden/);
  assert.doesNotMatch(html, /assets\/pets\/nervy-sci-fi-kid\/gifs\/[a-z-]+\.gif/);

  assert.match(preload, /getPetGifs: \(\) => ipcRenderer\.invoke\('app:get-pet-gifs'\)/);
  assert.match(preload, /sharePetGif: key => ipcRenderer\.invoke\('app:share-pet-gif', key\)/);
  assert.match(preload, /openPetGifFolder: \(\) => ipcRenderer\.invoke\('app:open-pet-gif-folder'\)/);

  assert.match(main, /const PET_GIF_ASSETS = \[/);
  assert.match(main, /sourceType: 'generated-image-pack'/);
  assert.match(main, /function listPetGifs\(\)/);
  assert.match(main, /function sharePetGif\(key\)/);
  assert.match(main, /mimeType: 'image\/gif'/);
  assert.match(main, /chatService\.saveMedia/);
  assert.match(main, /app:get-pet-gifs/);
  assert.match(main, /app:share-pet-gif/);
  assert.match(main, /app:open-pet-gif-folder/);

  assert.match(renderer, /const petGifButton = document\.querySelector\('#petGifButton'\)/);
  assert.match(renderer, /const PET_GIF_FALLBACKS = \[/);
  assert.match(renderer, /sourceType: 'generated-image-pack'/);
  assert.match(renderer, /async function togglePetGifTray/);
  assert.match(renderer, /async function sendPetGif\(key\)/);
  assert.match(renderer, /window\.focusPet\.sharePetGif\(key\)/);
  assert.match(renderer, /loading = 'lazy'/);
  assert.match(renderer, /data-gif-key/);
  assert.match(styles, /\.pet-gif-tray/);

  const expectedGifNames = [
    'tap-heart.gif',
    'feed-loop.gif',
    'focus-mode.gif',
    'play-dance.gif',
    'rest-sleep.gif',
    'celebrate-finish.gif',
    'sparkle-happy.gif',
    'stretch-break.gif',
    'hydrate-water.gif',
    'meditate-calm.gif',
    'read-review.gif',
    'cheer-success.gif',
    'morning-wave.gif',
    'hug-comfort.gif',
    'surprise-alert.gif',
    'cry-sad.gif',
    'angry-pout.gif',
    'busy-laptop.gif',
    'ok-ready.gif',
    'love-miss.gif',
    'phone-call.gif',
    'full-body-states-demo.gif'
  ];
  for (const name of expectedGifNames) {
    assert.match(main, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(renderer, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.ok(fs.statSync(path.join(gifDir, name)).size > 1024);
  }
  for (const name of [
    'hydrate-water.png',
    'focus-mode.png',
    'feed-loop.png',
    'meditate-calm.png',
    'celebrate-finish.png',
    'rest-sleep.png',
    'play-dance.png',
    'cheer-success.png',
    'hug-comfort.png',
    'surprise-alert.png',
    'cry-sad.png',
    'angry-pout.png',
    'love-miss.png',
    'ok-ready.png',
    'stretch-break.png',
    'sparkle-happy.png',
    'phone-call.png',
    'idle-standing.png',
    'run-right.png',
    'wave-morning.png',
    'jump-happy.png',
    'waiting-question.png',
    'busy-laptop.png',
    'review-read.png'
  ]) {
    assert.ok(fs.statSync(path.join(imageDir, name)).size > 1024);
  }
});

test('mac packaging preserves Electron framework symlink targets', () => {
  const source = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts', 'package-macos.js'), 'utf8');
  assert.match(source, /fs\.cpSync\(sourceApp,\s*outApp,\s*\{[^}]*verbatimSymlinks:\s*true/s);
  assert.match(source, /fs\.rmSync\(resourcesApp,\s*\{\s*recursive:\s*true,\s*force:\s*true\s*\}\)/);
  assert.match(source, /Object\.keys\(packageJson\.dependencies \|\| \{\}\)/);
  assert.doesNotMatch(source, /fs\.cpSync\(path\.join\(root,\s*'node_modules'\),\s*path\.join\(resourcesApp,\s*'node_modules'\)/);
});

test('mac release assets script plans dmg zip and checksum manifest names', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8'));
  const releaseScriptPath = path.join(PROJECT_ROOT, 'scripts', 'create-mac-release-assets.js');
  assert.equal(packageJson.scripts['release:mac'], 'node scripts/create-mac-release-assets.js');
  assert.match(packageJson.scripts.check, /node --check scripts\/create-mac-release-assets\.js/);

  const { buildReleaseAssetPlan } = require(releaseScriptPath);
  const plan = buildReleaseAssetPlan({
    root: '/tmp/focus-pet',
    appName: 'Focus Pet',
    version: '2.3.4',
    arch: 'arm64'
  });

  assert.equal(path.basename(plan.releaseDir), 'v2.3.4');
  assert.equal(path.basename(plan.appPath), 'Focus Pet.app');
  assert.equal(path.basename(plan.zipPath), 'Focus-Pet-2.3.4-mac-arm64.zip');
  assert.equal(path.basename(plan.dmgPath), 'Focus-Pet-2.3.4-mac-arm64.dmg');
  assert.equal(path.basename(plan.manifestPath), 'Focus-Pet-2.3.4-mac-arm64-manifest.json');
  assert.equal(path.basename(plan.stagedApplicationsLink), 'Applications');
});

test('mac release assets script signs the app before archiving', () => {
  const releaseScript = fs.readFileSync(path.join(PROJECT_ROOT, 'scripts', 'create-mac-release-assets.js'), 'utf8');

  assert.match(releaseScript, /function signAppForRelease\(plan/);
  assert.match(releaseScript, /process\.env\.MAC_CODESIGN_IDENTITY \|\| '-'/);
  assert.match(releaseScript, /codesign', \[[\s\S]*'--force'[\s\S]*'--deep'[\s\S]*'--sign'/);
  assert.match(releaseScript, /signAppForRelease\(plan\)[\s\S]*createZip\(plan\)/);
});
