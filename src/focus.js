const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { createTaskStore, DATA_DIR, TASK_PATH } = require('./task-store');
const { createSettingsStore, DEFAULT_SETTINGS } = require('./settings-store');
const { classifyActivity } = require('./focus-rules');
const { summarizeDailyReview } = require('./review-llm');
const { appendJsonlWithRetention } = require('./jsonl-retention');
const { sanitizeLogText } = require('./runtime-logger');
const {
  parseWindowsFrontmost,
  platformFocusPermission,
  windowsFrontmostScript
} = require('./platform-support');

const LOG_PATH = path.join(DATA_DIR, 'activity.jsonl');
const ERROR_LOG_PATH = path.join(path.resolve(__dirname, '..'), 'docs', 'errorThing.md');
const REVIEW_MINUTES_PER_SAMPLE = 10;
const REVIEW_WINDOW_HOURS = 24;
const TOMORROW_PLAN_TASK_LIMIT = 4;
const TASK_REVIEW_ROW_LIMIT = 6;
const REVIEW_ACTION_SUGGESTION_LIMIT = 5;
const QUALITY_FOCUS_MINUTES = 25;
const STALE_TASK_DAYS = 7;
const TASK_PRIORITY_RANK = { high: 3, medium: 2, low: 1 };
const taskStore = createTaskStore();
const settingsStore = createSettingsStore();

function runOsa(script) {
  return execFileSync('osascript', ['-e', script], { encoding: 'utf8', timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function getFrontmost() {
  if (process.platform === 'win32') return getWindowsFrontmost();
  if (process.platform !== 'darwin') {
    throw new Error(`${process.platform} 前台窗口读取暂不可用`);
  }
  const app = runOsa('tell application "System Events" to get name of first application process whose frontmost is true');
  const title = runOsa(`
    tell application "System Events"
      tell (first application process whose frontmost is true)
        if exists front window then
          return name of front window
        else
          return ""
        end if
      end tell
    end tell
  `);
  return { app, title };
}

function getWindowsFrontmost() {
  const command = process.env.FOCUS_PET_POWERSHELL || 'powershell.exe';
  const output = execFileSync(command, [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    windowsFrontmostScript()
  ], {
    encoding: 'utf8',
    timeout: 5000,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  return parseWindowsFrontmost(output);
}

function readJsonLines(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); } catch { return null; }
    })
    .filter(Boolean);
}

function appendActivityLog(entry, options = {}) {
  const logPath = options.logPath || LOG_PATH;
  appendJsonlWithRetention(entry, {
    logPath,
    retentionDays: Object.prototype.hasOwnProperty.call(options, 'retentionDays')
      ? options.retentionDays
      : settingsStore.getSettings().activityRetentionDays,
    fallbackRetentionDays: DEFAULT_SETTINGS.activityRetentionDays,
    now: options.now
  });
}

function cleanErrorLogText(value) {
  return sanitizeLogText(value, 600);
}

function appendErrorThing({ description, location, context, possibleCause, status = '未解决' }) {
  try {
    fs.mkdirSync(path.dirname(ERROR_LOG_PATH), { recursive: true });
    const time = new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
      hour12: false
    });
    const entry = [
      `## [${time}]`,
      `- 问题描述：${cleanErrorLogText(description)}`,
      `- 发生位置：${cleanErrorLogText(location)}`,
      `- 上下文：${cleanErrorLogText(context)}`,
      `- 可能原因：${cleanErrorLogText(possibleCause)}`,
      `- 解决状态：${status}`
    ].join('\n');
    fs.appendFileSync(ERROR_LOG_PATH, `${entry}\n`, 'utf8');
  } catch {}
}

function getStatus() {
  try {
    const frontmost = getFrontmost();
    const settings = settingsStore.getSettings();
    const currentTask = taskStore.getCurrentTask();
    const classification = classifyActivity({
      app: frontmost.app,
      title: frontmost.title,
      settings,
      currentTask
    });
    const entry = {
      time: new Date().toISOString(),
      app: frontmost.app,
      title: frontmost.title,
      currentTask: currentTask ? { id: currentTask.id, text: currentTask.text, priority: currentTask.priority, dueDate: currentTask.dueDate } : null,
      ...classification
    };
    appendActivityLog(entry, { retentionDays: settings.activityRetentionDays });
    return {
      ok: true,
      ...entry,
      message: makeStatusMessage(entry)
    };
  } catch (error) {
    const permission = platformFocusPermission(process.platform);
    appendErrorThing({
      description: `读取前台窗口失败：${error.message}`,
      location: 'src/focus.js getStatus',
      context: `platform=${process.platform}, command=${process.platform === 'win32' ? 'powershell.exe' : 'osascript'}`,
      possibleCause: permission.reason,
      status: '未解决'
    });
    return {
      ok: false,
      status: 'permission',
      app: '未知',
      title: '',
      reason: permission.reason,
      message: permission.message
    };
  }
}

function makeStatusMessage(entry) {
  const task = entry.currentTask?.text;
  if (entry.status === 'distracted') return task ? `可能和当前任务有点偏离，先轻轻看一眼「${task}」的下一步。` : '可能和当前节奏有点偏离，先轻轻看一眼今天最重要的一步。';
  if (entry.status === 'game') return task ? `我看到你在游戏，给自己留一个结束点，再回到「${task}」。` : '我看到你在游戏，可以先给自己留一个结束点。';
  if (entry.status === 'study') return task ? `学习状态已同步，这和「${task}」有关，继续保持。` : `我看到你在学习，继续保持 25 分钟。`;
  if (entry.status === 'work') return task ? `不错！这和「${task}」有关，继续保持。` : `不错！我看到你在 ${entry.app}，继续保持 25 分钟。`;
  return task ? `我还不确定 ${entry.app} 和「${task}」的关系，先观察一下节奏。` : `我还不确定 ${entry.app} 和当前任务的关系，先观察一下节奏。`;
}

function getTasks() {
  return taskStore.exportMarkdown();
}

function saveTasks(text) {
  taskStore.importMarkdown(String(text || ''));
  return { ok: true };
}

function listTasks() {
  return taskStore.listTasks();
}

function addTask(input) {
  return taskStore.addTask(input || {});
}

function updateTask(id, patch) {
  return taskStore.updateTask(id, patch || {});
}

function toggleTask(id, done) {
  return taskStore.toggleTask(id, done);
}

function selectTask(id) {
  return taskStore.selectTask(id);
}

function deleteTask(id) {
  return taskStore.deleteTask(id);
}

function moveTask(id, direction) {
  return taskStore.moveTask(id, direction);
}

function getCurrentTask() {
  return taskStore.getCurrentTask();
}

function getCurrentTaskDecision() {
  return taskStore.getCurrentTaskDecision();
}

function getSettings() {
  return settingsStore.getSettings();
}

function updateSettings(patch) {
  return settingsStore.updateSettings(patch || {});
}

function reviewStatus(entry) {
  if (entry?.status === 'study') return 'work';
  if (entry?.status === 'game') return 'distracted';
  return ['work', 'distracted', 'unknown', 'permission'].includes(entry?.status) ? entry.status : 'unknown';
}

function reviewMinuteCount(count) {
  return Math.max(0, Math.round(Number(count) || 0)) * REVIEW_MINUTES_PER_SAMPLE;
}

function reviewEntryTime(entry = {}) {
  const time = Date.parse(entry.time);
  return Number.isFinite(time) ? time : 0;
}

function recentReviewEntries(rawEntries = [], nowMs = Date.now()) {
  const cutoff = nowMs - REVIEW_WINDOW_HOURS * 60 * 60 * 1000;
  return (Array.isArray(rawEntries) ? rawEntries : [])
    .filter(entry => {
      const time = reviewEntryTime(entry);
      return time >= cutoff && time <= nowMs;
    })
    .sort((left, right) => reviewEntryTime(left) - reviewEntryTime(right));
}

function hourLabelFromMs(ms) {
  const date = new Date(ms);
  return `${String(date.getHours()).padStart(2, '0')}:00`;
}

function statusBreakdown(counts, totalSamples) {
  return ['work', 'distracted', 'unknown', 'permission'].map(status => {
    const samples = Math.max(0, Math.round(Number(counts[status]) || 0));
    return {
      status,
      samples,
      minutes: reviewMinuteCount(samples),
      ratio: totalSamples ? Math.round((samples / totalSamples) * 100) : 0
    };
  });
}

function buildHourlyBuckets(entries, nowMs) {
  const start = new Date(nowMs);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() - (REVIEW_WINDOW_HOURS - 1));
  const startMs = start.getTime();
  const buckets = Array.from({ length: REVIEW_WINDOW_HOURS }, (_, index) => {
    const bucketDate = new Date(startMs + index * 60 * 60 * 1000);
    return {
      hour: bucketDate.getHours(),
      label: `${String(bucketDate.getHours()).padStart(2, '0')}:00`,
      samples: 0,
      workMinutes: 0,
      distractedMinutes: 0,
      unknownMinutes: 0,
      permissionMinutes: 0,
      appSwitches: 0,
      appCount: 0
    };
  });
  const appSets = buckets.map(() => new Set());
  const lastAppByBucket = new Map();
  for (const entry of [...entries].sort((left, right) => reviewEntryTime(left) - reviewEntryTime(right))) {
    const time = Date.parse(entry.time);
    if (!Number.isFinite(time) || time < startMs) continue;
    const index = Math.floor((time - startMs) / (60 * 60 * 1000));
    if (index < 0 || index >= buckets.length) continue;
    const bucket = buckets[index];
    const status = reviewStatus(entry);
    const app = cleanReviewTaskText(entry.app || '未知 App', 80);
    bucket.samples += 1;
    bucket[`${status}Minutes`] = (bucket[`${status}Minutes`] || 0) + REVIEW_MINUTES_PER_SAMPLE;
    if (app) {
      appSets[index].add(app);
      const lastApp = lastAppByBucket.get(index);
      if (lastApp && lastApp !== app) bucket.appSwitches += 1;
      lastAppByBucket.set(index, app);
    }
  }
  buckets.forEach((bucket, index) => {
    bucket.appCount = appSets[index].size;
  });
  return buckets;
}

function buildReviewFromEntries(rawEntries = [], { nowMs = Date.now() } = {}) {
  const entries = recentReviewEntries(rawEntries, nowMs);
  const counts = entries.reduce((acc, entry) => {
    const status = reviewStatus(entry);
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  const appCounts = entries.reduce((acc, entry) => {
    const app = String(entry.app || '未知 App').slice(0, 80);
    acc[app] = (acc[app] || 0) + 1;
    return acc;
  }, {});
  const topApps = Object.entries(appCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const topAppDetails = topApps.map(([app, count]) => ({
    app,
    samples: count,
    minutes: reviewMinuteCount(count),
    ratio: entries.length ? Math.round((count / entries.length) * 100) : 0
  }));
  const workMinutes = reviewMinuteCount(counts.work || 0);
  const distractedMinutes = reviewMinuteCount(counts.distracted || 0);
  const unknownMinutes = reviewMinuteCount(counts.unknown || 0);
  const permissionMinutes = reviewMinuteCount(counts.permission || 0);
  const knownMinutes = workMinutes + distractedMinutes;
  const totalMinutes = workMinutes + distractedMinutes + unknownMinutes + permissionMinutes;
  const focusScore = knownMinutes ? Math.round((workMinutes / knownMinutes) * 100) : 0;
  return {
    samples: entries.length,
    workMinutes,
    distractedMinutes,
    unknownMinutes,
    permissionMinutes,
    totalMinutes,
    focusScore,
    statusBreakdown: statusBreakdown(counts, entries.length),
    hourly: buildHourlyBuckets(entries, nowMs),
    topApps,
    topAppDetails,
    generatedAt: new Date(nowMs).toISOString(),
    windowHours: REVIEW_WINDOW_HOURS,
    minutesPerSample: REVIEW_MINUTES_PER_SAMPLE
  };
}

function localDateString(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function tomorrowDateString(nowMs = Date.now()) {
  const date = new Date(nowMs);
  date.setDate(date.getDate() + 1);
  return localDateString(date);
}

function cleanTomorrowTaskText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function cleanReviewTaskText(text, maxLength = 80) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeMatchText(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normalizeTomorrowPriority(priority) {
  return ['high', 'medium', 'low'].includes(priority) ? priority : 'medium';
}

function taskCompletion(tasks = []) {
  const total = Array.isArray(tasks) ? tasks.length : 0;
  const done = Array.isArray(tasks) ? tasks.filter(task => Boolean(task.done)).length : 0;
  return {
    done,
    total,
    rate: total ? Math.round((done / total) * 100) : 0
  };
}

function sortedCarryOverTasks(tasks = []) {
  return [...(Array.isArray(tasks) ? tasks : [])]
    .filter(task => !task.done && cleanTomorrowTaskText(task.text))
    .sort((left, right) => {
      const priority = (TASK_PRIORITY_RANK[normalizeTomorrowPriority(right.priority)] || 2)
        - (TASK_PRIORITY_RANK[normalizeTomorrowPriority(left.priority)] || 2);
      if (priority) return priority;
      const leftDue = left.dueDate || '9999-12-31';
      const rightDue = right.dueDate || '9999-12-31';
      if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);
      return String(left.text || '').localeCompare(String(right.text || ''));
    });
}

function topDistractingApp(review = {}) {
  const rows = Array.isArray(review.topApps) ? review.topApps : [];
  const ignored = new Set(['Code', 'Visual Studio Code', 'Cursor', 'Terminal', 'iTerm2', 'Finder', '未知 App']);
  const [app] = rows.find(([name]) => !ignored.has(String(name || ''))) || rows[0] || ['分心入口'];
  return String(app || '分心入口').slice(0, 24);
}

function taskMatchesEntry(task = {}, entry = {}) {
  const currentTask = entry.currentTask || {};
  if (task.id && currentTask.id && task.id === currentTask.id) return true;
  if (
    cleanReviewTaskText(task.text)
    && cleanReviewTaskText(currentTask.text)
    && cleanReviewTaskText(task.text) === cleanReviewTaskText(currentTask.text)
  ) return true;
  const app = normalizeMatchText(entry.app);
  const relatedApp = (Array.isArray(task.relatedApps) ? task.relatedApps : [])
    .some(item => normalizeMatchText(item) === app);
  if (relatedApp) return true;
  const haystack = normalizeMatchText(`${entry.app || ''} ${entry.title || ''} ${entry.reason || ''} ${entry.activity || ''}`);
  return (Array.isArray(task.relatedKeywords) ? task.relatedKeywords : [])
    .some(keyword => {
      const clean = normalizeMatchText(keyword);
      return clean && haystack.includes(clean);
    });
}

function buildTaskReview({ tasks = [], entries = [], nowMs = Date.now() } = {}) {
  const cutoff = nowMs - REVIEW_WINDOW_HOURS * 60 * 60 * 1000;
  const recentEntries = (Array.isArray(entries) ? entries : []).filter(entry => {
    const time = Date.parse(entry?.time);
    return Number.isFinite(time) && time >= cutoff && time <= nowMs;
  });
  const rows = (Array.isArray(tasks) ? tasks : [])
    .filter(task => cleanReviewTaskText(task?.text))
    .map(task => {
      const taskEntries = recentEntries.filter(entry => taskMatchesEntry(task, entry));
      const counts = taskEntries.reduce((acc, entry) => {
        const status = reviewStatus(entry);
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {});
      const workMinutes = reviewMinuteCount(counts.work || 0);
      const distractedMinutes = reviewMinuteCount(counts.distracted || 0);
      const unknownMinutes = reviewMinuteCount(counts.unknown || 0);
      const blockedBy = cleanReviewTaskText(task.blockedBy, 120);
      const nextAction = cleanReviewTaskText(task.nextAction, 120);
      const done = Boolean(task.done);
      const lastActiveAt = taskEntries
        .map(entry => Date.parse(entry.time))
        .filter(Number.isFinite)
        .sort((a, b) => b - a)[0] || 0;
      const status = done
        ? 'done'
        : blockedBy
          ? 'blocked'
          : (workMinutes || distractedMinutes || unknownMinutes)
            ? 'in_progress'
            : nextAction
              ? 'open'
              : 'needs_next_action';
      const progressText = done
        ? '已完成'
        : workMinutes
          ? `推进 ${workMinutes} 分钟`
          : nextAction
            ? `下一步：${nextAction}`
            : '今天还没有明确推进记录';
      const frictionText = blockedBy
        ? `阻塞：${blockedBy}`
        : !done && !nextAction
          ? '缺少下一步'
          : distractedMinutes
            ? `疑似偏离 ${distractedMinutes} 分钟`
            : unknownMinutes
              ? `有 ${unknownMinutes} 分钟未确认相关性`
              : '暂无明显阻力';
      return {
        id: task.id || '',
        text: cleanReviewTaskText(task.text),
        status,
        priority: normalizeTomorrowPriority(task.priority),
        dueDate: task.dueDate || '',
        done,
        blockedBy,
        nextAction,
        workMinutes,
        distractedMinutes,
        unknownMinutes,
        lastActiveAt: lastActiveAt ? new Date(lastActiveAt).toISOString() : '',
        progressText,
        frictionText
      };
    });
  const completion = taskCompletion(rows);
  const openRows = rows.filter(task => !task.done);
  const blockedRows = openRows.filter(task => task.blockedBy);
  const withoutNextActionRows = openRows.filter(task => !task.blockedBy && !task.nextAction);
  const suggestions = [
    ...blockedRows.slice(0, 1).map(task => `先处理「${task.text}」的阻塞：${task.blockedBy}。`),
    ...withoutNextActionRows.slice(0, 1).map(task => `给「${task.text}」补一个下一步。`),
    ...openRows.filter(task => task.distractedMinutes > 0).slice(0, 1).map(task => `「${task.text}」有疑似偏离 ${task.distractedMinutes} 分钟，明天先设一个规避动作。`),
    ...openRows.filter(task => task.nextAction && task.workMinutes > 0).slice(0, 1).map(task => `继续「${task.text}」：${task.nextAction}。`)
  ].slice(0, 3);
  return {
    completion,
    openCount: openRows.length,
    blockedCount: blockedRows.length,
    withoutNextActionCount: withoutNextActionRows.length,
    activeTaskCount: rows.filter(task => task.workMinutes > 0 || task.distractedMinutes > 0 || task.unknownMinutes > 0).length,
    summary: `完成 ${completion.done}/${completion.total}，${openRows.length} 个待办；${blockedRows.length} 个阻塞，${withoutNextActionRows.length} 个缺少下一步。`,
    rows: rows
      .sort((left, right) => {
        const statusRank = { blocked: 0, needs_next_action: 1, in_progress: 2, open: 3, done: 4 };
        const status = (statusRank[left.status] ?? 9) - (statusRank[right.status] ?? 9);
        if (status) return status;
        const priority = (TASK_PRIORITY_RANK[right.priority] || 2) - (TASK_PRIORITY_RANK[left.priority] || 2);
        if (priority) return priority;
        return String(left.text).localeCompare(String(right.text));
      })
      .slice(0, TASK_REVIEW_ROW_LIMIT),
    suggestions
  };
}

function buildQualityFocusBlocks(entries = []) {
  const blocks = [];
  let current = null;
  const maxGapMs = REVIEW_MINUTES_PER_SAMPLE * 60 * 1000 * 1.5;
  const flush = () => {
    if (!current) return;
    current.minutes = reviewMinuteCount(current.samples);
    if (current.minutes >= QUALITY_FOCUS_MINUTES) {
      blocks.push({
        label: hourLabelFromMs(current.startMs),
        startAt: new Date(current.startMs).toISOString(),
        endAt: new Date(current.endMs).toISOString(),
        minutes: current.minutes,
        samples: current.samples,
        apps: Array.from(current.apps).slice(0, 4)
      });
    }
    current = null;
  };

  for (const entry of entries) {
    const status = reviewStatus(entry);
    const time = reviewEntryTime(entry);
    if (status !== 'work') {
      flush();
      continue;
    }
    if (current && time - current.endMs > maxGapMs) flush();
    if (!current) {
      current = {
        startMs: time,
        endMs: time,
        samples: 0,
        apps: new Set()
      };
    }
    current.endMs = time;
    current.samples += 1;
    const app = cleanReviewTaskText(entry.app || '', 40);
    if (app) current.apps.add(app);
  }
  flush();

  return blocks.sort((left, right) => {
    if (right.minutes !== left.minutes) return right.minutes - left.minutes;
    return Date.parse(left.startAt) - Date.parse(right.startAt);
  }).slice(0, 3);
}

function buildDriftWindows(review = {}) {
  return (Array.isArray(review.hourly) ? review.hourly : [])
    .filter(bucket => (Number(bucket.distractedMinutes) || 0) > 0 || (Number(bucket.appSwitches) || 0) >= 2)
    .map(bucket => ({
      label: bucket.label || `${String(bucket.hour || 0).padStart(2, '0')}:00`,
      distractedMinutes: Math.max(0, Math.round(Number(bucket.distractedMinutes) || 0)),
      appSwitches: Math.max(0, Math.round(Number(bucket.appSwitches) || 0)),
      samples: Math.max(0, Math.round(Number(bucket.samples) || 0))
    }))
    .sort((left, right) => {
      if (right.distractedMinutes !== left.distractedMinutes) return right.distractedMinutes - left.distractedMinutes;
      if (right.appSwitches !== left.appSwitches) return right.appSwitches - left.appSwitches;
      return left.label.localeCompare(right.label);
    })
    .slice(0, 3);
}

function buildHourlyAppSwitches(review = {}) {
  return (Array.isArray(review.hourly) ? review.hourly : [])
    .filter(bucket => (Number(bucket.appSwitches) || 0) > 0)
    .map(bucket => ({
      label: bucket.label || `${String(bucket.hour || 0).padStart(2, '0')}:00`,
      switches: Math.max(0, Math.round(Number(bucket.appSwitches) || 0)),
      appCount: Math.max(0, Math.round(Number(bucket.appCount) || 0))
    }))
    .sort((left, right) => {
      if (right.switches !== left.switches) return right.switches - left.switches;
      return left.label.localeCompare(right.label);
    })
    .slice(0, 4);
}

function buildStaleTasks(tasks = [], nowMs = Date.now()) {
  const today = localDateString(new Date(nowMs));
  const staleAfterMs = nowMs - STALE_TASK_DAYS * 24 * 60 * 60 * 1000;
  return (Array.isArray(tasks) ? tasks : [])
    .filter(task => !task.done && cleanReviewTaskText(task?.text))
    .map(task => {
      const updatedAt = reviewEntryTime({ time: task.updatedAt });
      const overdue = task.dueDate && task.dueDate < today;
      const staleUpdatedAt = updatedAt > 0 && updatedAt <= staleAfterMs;
      return {
        id: task.id || '',
        text: cleanReviewTaskText(task.text),
        priority: normalizeTomorrowPriority(task.priority),
        dueDate: task.dueDate || '',
        updatedAt: updatedAt ? new Date(updatedAt).toISOString() : '',
        reason: overdue ? 'past_due' : staleUpdatedAt ? 'stale_update' : ''
      };
    })
    .filter(task => task.reason)
    .sort((left, right) => {
      const priority = (TASK_PRIORITY_RANK[right.priority] || 2) - (TASK_PRIORITY_RANK[left.priority] || 2);
      if (priority) return priority;
      return (left.dueDate || '9999-12-31').localeCompare(right.dueDate || '9999-12-31');
    })
    .slice(0, 4);
}

function buildInterruptedTasks({ tasks = [], entries = [] } = {}) {
  return (Array.isArray(tasks) ? tasks : [])
    .filter(task => !task.done && cleanReviewTaskText(task?.text))
    .map(task => {
      let wasWorking = false;
      let interruptions = 0;
      const matched = entries.filter(entry => taskMatchesEntry(task, entry));
      for (const entry of matched) {
        const status = reviewStatus(entry);
        if (wasWorking && status !== 'work') interruptions += 1;
        wasWorking = status === 'work';
      }
      return {
        id: task.id || '',
        text: cleanReviewTaskText(task.text),
        interruptions
      };
    })
    .filter(task => task.interruptions > 0)
    .sort((left, right) => {
      if (right.interruptions !== left.interruptions) return right.interruptions - left.interruptions;
      return left.text.localeCompare(right.text);
    })
    .slice(0, 4);
}

function suggestionItem(kind, text, reason, priority = 'medium') {
  return { kind, text, reason, priority };
}

function buildReviewActionSuggestions({ review = {}, taskReview = {}, tasks = [], entries = [], nowMs = Date.now() } = {}) {
  const recentEntries = recentReviewEntries(entries, nowMs);
  const qualityFocusBlocks = buildQualityFocusBlocks(recentEntries);
  const driftWindows = buildDriftWindows(review);
  const hourlyAppSwitches = buildHourlyAppSwitches(review);
  const staleTasks = buildStaleTasks(tasks, nowMs);
  const interruptedTasks = buildInterruptedTasks({ tasks, entries: recentEntries });
  const missingNextAction = (Array.isArray(taskReview.rows) ? taskReview.rows : [])
    .find(task => !task.done && !task.blockedBy && !task.nextAction);
  const suggestions = [];

  const drift = driftWindows[0];
  if (drift) {
    suggestions.push(suggestionItem(
      'drift-window',
      `${drift.label} 疑似偏离 ${drift.distractedMinutes} 分钟，明天先为这个时段设一个规避动作。`,
      drift.appSwitches ? `该时段 App 切换 ${drift.appSwitches} 次` : '该时段偏离记录最多',
      'high'
    ));
  }

  const interrupted = interruptedTasks[0];
  if (interrupted) {
    suggestions.push(suggestionItem(
      'task-interruption',
      `「${interrupted.text}」被打断 ${interrupted.interruptions} 次，下次先把切换入口收起来再开始。`,
      '任务推进中出现状态切换',
      'high'
    ));
  }

  const stale = staleTasks[0];
  if (stale) {
    suggestions.push(suggestionItem(
      'stale-task',
      `「${stale.text}」长期未完成，先补一个 25 分钟下一步。`,
      stale.dueDate ? `截止 ${stale.dueDate}` : '超过一周未更新',
      'medium'
    ));
  }

  if (missingNextAction) {
    suggestions.push(suggestionItem(
      'missing-next-action',
      `给「${missingNextAction.text}」补一个下一步，再决定是否继续推进。`,
      '任务缺少下一步',
      'medium'
    ));
  }

  const focusBlock = qualityFocusBlocks[0];
  if (focusBlock) {
    suggestions.push(suggestionItem(
      'quality-focus-block',
      `${focusBlock.label} 有 ${focusBlock.minutes} 分钟高质量专注块，明天复用这段节奏做 25 分钟。`,
      focusBlock.apps.length ? `主要在 ${focusBlock.apps.join('、')}` : '连续工作/学习记录',
      'low'
    ));
  }

  if (!suggestions.length) {
    const fallbackText = review.workMinutes
      ? '保留今天最稳定的一段节奏，明天先做一个 25 分钟任务。'
      : '先写下一件小任务，并安排一个 25 分钟开始点。';
    suggestions.push(suggestionItem('starter-step', fallbackText, '复盘数据不足时先建立启动动作', 'medium'));
  }

  return {
    suggestions: suggestions.slice(0, REVIEW_ACTION_SUGGESTION_LIMIT),
    qualityFocusBlocks,
    driftWindows,
    hourlyAppSwitches,
    staleTasks,
    interruptedTasks
  };
}

function buildTomorrowPlan({ review = {}, tasks = [], nowMs = Date.now() } = {}) {
  const date = tomorrowDateString(nowMs);
  const completion = taskCompletion(tasks);
  const carryOver = sortedCarryOverTasks(tasks);
  const planTasks = carryOver.slice(0, 2).map(task => ({
    text: `继续推进：${cleanTomorrowTaskText(task.text)}`,
    priority: normalizeTomorrowPriority(task.priority),
    dueDate: date,
    source: 'carry-over',
    sourceTaskId: task.id || ''
  }));
  if ((Number(review.distractedMinutes) || 0) >= REVIEW_MINUTES_PER_SAMPLE) {
    const app = topDistractingApp(review);
    planTasks.push({
      text: `收束分心入口：为 ${app} 设一个规避动作`,
      priority: 'medium',
      dueDate: date,
      source: 'focus-reset'
    });
  }
  planTasks.push({
    text: '晚上复盘明日节奏并选出下一步',
    priority: 'low',
    dueDate: date,
    source: 'daily-review'
  });
  const trimmedTasks = planTasks.slice(0, TOMORROW_PLAN_TASK_LIMIT - 1);
  const dailyReviewTask = planTasks.find(task => task.source === 'daily-review');
  const finalTasks = dailyReviewTask && !trimmedTasks.some(task => task.source === 'daily-review')
    ? [...trimmedTasks, dailyReviewTask].slice(0, TOMORROW_PLAN_TASK_LIMIT)
    : trimmedTasks;
  const primary = finalTasks.find(task => task.source === 'carry-over') || finalTasks[0];
  const focusScore = Math.max(0, Math.min(100, Math.round(Number(review.focusScore) || 0)));
  const carryOverCount = carryOver.length;
  const summary = carryOverCount
    ? `今天还有 ${carryOverCount} 个未完成，明天先接住最高优先级，再复盘收尾。`
    : `今天完成率 ${completion.rate}%，明天从一个轻量启动任务开始。`;
  return {
    date,
    title: '明日计划',
    focusScore,
    completion,
    carryOverCount,
    summary,
    firstStep: primary ? `明天第一步：${primary.text.replace(/^继续推进：/, '')}，先做 25 分钟。` : '明天第一步：先写下一个 25 分钟小任务。',
    tasks: finalTasks
  };
}

function tomorrowTaskKey(task = {}) {
  return `${cleanTomorrowTaskText(task.text).toLowerCase()}::${String(task.dueDate || '')}`;
}

function mergeTomorrowPlanTasks(existingTasks = [], plan = {}) {
  const existing = Array.isArray(existingTasks) ? existingTasks : [];
  const existingKeys = new Set(existing.map(tomorrowTaskKey));
  const tasks = existing.map(task => ({ ...task }));
  let addedCount = 0;
  let skippedCount = 0;
  for (const planTask of Array.isArray(plan.tasks) ? plan.tasks : []) {
    const text = cleanTomorrowTaskText(planTask.text);
    if (!text) continue;
    const dueDate = planTask.dueDate || plan.date || tomorrowDateString();
    const key = tomorrowTaskKey({ text, dueDate });
    if (existingKeys.has(key)) {
      skippedCount += 1;
      continue;
    }
    existingKeys.add(key);
    tasks.push({
      text,
      done: false,
      priority: normalizeTomorrowPriority(planTask.priority),
      dueDate,
      order: tasks.length,
      source: planTask.source || 'tomorrow-plan',
      sourceTaskId: planTask.sourceTaskId || ''
    });
    addedCount += 1;
  }
  return { tasks, addedCount, skippedCount };
}

function applyTomorrowPlan(plan) {
  const existing = taskStore.listTasks();
  const result = mergeTomorrowPlanTasks(existing, plan);
  return {
    ...result,
    tasks: taskStore.replaceTasks(result.tasks)
  };
}

function buildDailyReview() {
  const entries = readJsonLines(LOG_PATH);
  const tasks = taskStore.listTasks();
  const review = buildReviewFromEntries(entries);
  const taskReview = buildTaskReview({ tasks, entries });
  const actionReview = buildReviewActionSuggestions({ review, taskReview, tasks, entries });
  return {
    ...review,
    taskReview,
    actionReview,
    actionSuggestions: actionReview.suggestions,
    tomorrowPlan: buildTomorrowPlan({ review, tasks })
  };
}

async function getDailyReview(options = {}) {
  const review = buildDailyReview();
  const settings = settingsStore.getSettings();
  if (!settings.reviewLlmEnabled) {
    return {
      ...review,
      llm: { ok: false, source: 'stepfun', status: 'disabled' }
    };
  }

  try {
    const llm = await summarizeDailyReview({
      review,
      settings,
      currentTask: taskStore.getCurrentTask(),
      tasks: taskStore.listTasks(),
      screenAnalysis: options.screenAnalysis || null,
      fetchImpl: options.fetchImpl || globalThis.fetch
    });
    return { ...review, llm };
  } catch (error) {
    appendErrorThing({
      description: `StepFun 复盘 LLM 调用异常：${error.message}`,
      location: 'src/focus.js getDailyReview',
      context: `samples=${review.samples}, workMinutes=${review.workMinutes}, distractedMinutes=${review.distractedMinutes}`,
      possibleCause: '网络异常、StepFun endpoint/model/API key 配置不正确，或服务返回非 2xx。',
      status: '未解决'
    });
    return {
      ...review,
      llm: {
        ok: false,
        source: 'stepfun',
        status: 'error',
        reason: error.message
      }
    };
  }
}

module.exports = {
  DATA_DIR,
  TASK_PATH,
  getStatus,
  getDailyReview,
  getTasks,
  saveTasks,
  listTasks,
  addTask,
  updateTask,
  toggleTask,
  selectTask,
  deleteTask,
  moveTask,
  getCurrentTask,
  getCurrentTaskDecision,
  getSettings,
  updateSettings,
  appendActivityLog,
  makeStatusMessage,
  buildReviewFromEntries,
  buildReviewActionSuggestions,
  buildTaskReview,
  buildTomorrowPlan,
  mergeTomorrowPlanTasks,
  applyTomorrowPlan
};
