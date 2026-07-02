const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { readJsonWithRecovery, writeJsonAtomic } = require('./json-storage');

const DATA_DIR = path.join(os.homedir(), '.hermes', 'focus-watchdog');
const TASK_PATH = path.join(DATA_DIR, 'today_tasks.md');
const TASK_JSON_PATH = path.join(DATA_DIR, 'tasks.json');
const TASK_SCHEMA_VERSION = 2;
const PRIORITIES = ['low', 'medium', 'high'];
const PRIORITY_RANK = { low: 1, medium: 2, high: 3 };
const ENERGY_LEVELS = ['low', 'medium', 'high'];
const MAX_ESTIMATED_MINUTES = 480;
const MAX_REMINDER_MINUTES = 240;

function ensureDir(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
}

function cleanText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, 240);
}

function cleanMetadataText(text, maxLength = 240) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanPriority(priority) {
  return PRIORITIES.includes(priority) ? priority : 'medium';
}

function cleanEnergyLevel(energyLevel) {
  return ENERGY_LEVELS.includes(energyLevel) ? energyLevel : 'medium';
}

function cleanEstimatedMinutes(value) {
  const minutes = Math.round(Number(value) || 0);
  if (minutes <= 0) return 0;
  return Math.min(MAX_ESTIMATED_MINUTES, minutes);
}

function cleanReminderMinutes(value) {
  const minutes = Math.round(Number(value) || 0);
  if (minutes <= 0) return 0;
  return Math.min(MAX_REMINDER_MINUTES, minutes);
}

function cleanDueDate(dueDate) {
  const value = String(dueDate || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : '';
}

function cleanList(value, { maxItems = 12, maxLength = 48 } = {}) {
  const rows = Array.isArray(value)
    ? value
    : String(value || '').split(/[,\n]/);
  const seen = new Set();
  const cleaned = [];
  for (const row of rows) {
    const item = cleanMetadataText(row, maxLength);
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    cleaned.push(item);
    if (cleaned.length >= maxItems) break;
  }
  return cleaned;
}

function parseMarkdown(text) {
  const tasks = [];
  for (const line of String(text || '').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s+(?:(\(([^)]*)\))\s+)?(.+)$/)
      || trimmed.match(/^(?:[-*+]|\d+[.)])\s+(?:(\(([^)]*)\))\s+)?(.+)$/);
    if (!match) {
      tasks.push({ text: trimmed, done: false });
      continue;
    }
    const hasCheckbox = match.length === 5;
    const metadata = hasCheckbox ? match[3] : match[2];
    const body = hasCheckbox ? match[4] : match[3];
    const task = {
      text: cleanText(body),
      done: hasCheckbox ? match[1].toLowerCase() === 'x' : false,
      priority: 'medium',
      dueDate: ''
    };
    if (metadata) {
      for (const part of metadata.split(',')) {
        const value = part.trim();
        if (PRIORITIES.includes(value)) task.priority = value;
        if (value.startsWith('due:')) task.dueDate = cleanDueDate(value.slice(4));
      }
    }
    if (task.text) tasks.push(task);
  }
  return tasks;
}

function serializeMarkdown(tasks) {
  const rows = [...tasks]
    .sort((a, b) => a.order - b.order)
    .filter(task => cleanText(task.text))
    .map(task => {
      const meta = [];
      if (task.priority && task.priority !== 'medium') meta.push(task.priority);
      if (task.priority === 'medium' && task.dueDate) meta.push(task.priority);
      if (task.dueDate) meta.push(`due:${task.dueDate}`);
      const metadata = meta.length ? ` (${meta.join(', ')})` : '';
      return `- [${task.done ? 'x' : ' '}]${metadata} ${cleanText(task.text)}`;
    });
  return `# 今日任务\n\n${rows.join('\n')}${rows.length ? '\n' : ''}`;
}

function clone(task) {
  return JSON.parse(JSON.stringify(task));
}

function normalizeTask(input, index, now) {
  const timestamp = now().toISOString();
  const done = Boolean(input.done);
  const completedAt = done
    ? (input.completedAt || timestamp)
    : null;
  return {
    id: input.id || randomUUID(),
    text: cleanText(input.text),
    description: cleanMetadataText(input.description, 1000),
    done,
    priority: cleanPriority(input.priority),
    dueDate: cleanDueDate(input.dueDate),
    estimatedMinutes: cleanEstimatedMinutes(input.estimatedMinutes),
    energyLevel: cleanEnergyLevel(input.energyLevel),
    contextTags: cleanList(input.contextTags, { maxItems: 10, maxLength: 32 }),
    relatedApps: cleanList(input.relatedApps, { maxItems: 12, maxLength: 60 }),
    relatedKeywords: cleanList(input.relatedKeywords, { maxItems: 16, maxLength: 60 }),
    focusSceneTemplate: cleanMetadataText(input.focusSceneTemplate, 60),
    focusSceneLabel: cleanMetadataText(input.focusSceneLabel, 60),
    reminderMinutes: cleanReminderMinutes(input.reminderMinutes),
    petAnimationPreference: cleanMetadataText(input.petAnimationPreference, 40),
    reviewMetrics: cleanList(input.reviewMetrics, { maxItems: 12, maxLength: 48 }),
    blockedBy: cleanMetadataText(input.blockedBy, 160),
    nextAction: cleanMetadataText(input.nextAction, 240),
    pinned: Boolean(input.pinned),
    selected: Boolean(input.selected),
    createdAt: input.createdAt || timestamp,
    updatedAt: input.updatedAt || timestamp,
    completedAt,
    order: Number.isFinite(input.order) ? input.order : index
  };
}

function taskBlockedReason(task = {}) {
  return cleanMetadataText(task.blockedBy, 160);
}

function taskSelectionRank(task = {}) {
  return {
    selected: Boolean(task.selected) ? 1 : 0,
    pinned: Boolean(task.pinned) ? 1 : 0,
    priority: PRIORITY_RANK[cleanPriority(task.priority)] || PRIORITY_RANK.medium,
    dueDate: cleanDueDate(task.dueDate) || '9999-12-31',
    hasNextAction: cleanMetadataText(task.nextAction, 240) ? 1 : 0,
    order: Number.isFinite(task.order) ? task.order : Number.MAX_SAFE_INTEGER
  };
}

function compareActionableTasks(left, right) {
  const leftRank = taskSelectionRank(left);
  const rightRank = taskSelectionRank(right);
  if (leftRank.selected !== rightRank.selected) return rightRank.selected - leftRank.selected;
  if (leftRank.pinned !== rightRank.pinned) return rightRank.pinned - leftRank.pinned;
  if (leftRank.priority !== rightRank.priority) return rightRank.priority - leftRank.priority;
  if (leftRank.dueDate !== rightRank.dueDate) return leftRank.dueDate.localeCompare(rightRank.dueDate);
  if (leftRank.hasNextAction !== rightRank.hasNextAction) return rightRank.hasNextAction - leftRank.hasNextAction;
  return leftRank.order - rightRank.order;
}

function taskSelectionReasons(task = {}) {
  const reasons = [];
  if (task.selected) reasons.push('selected');
  if (task.pinned) reasons.push('pinned');
  if (task.priority === 'high') reasons.push('high-priority');
  if (task.dueDate) reasons.push(`due:${task.dueDate}`);
  if (cleanMetadataText(task.nextAction, 240)) reasons.push('has-next-action');
  if (!reasons.length) reasons.push('list-order');
  return reasons;
}

function normalizeTaskSelection(tasks = []) {
  let selectedSeen = false;
  return tasks.map(task => {
    const selected = Boolean(task.selected) && !task.done && !taskBlockedReason(task) && !selectedSeen;
    if (selected) selectedSeen = true;
    return task.selected === selected ? task : { ...task, selected };
  });
}

function migrateTasksState(payload = {}) {
  const input = Array.isArray(payload)
    ? { version: 1, tasks: payload }
    : (payload && typeof payload === 'object' ? payload : {});
  return {
    ...input,
    version: TASK_SCHEMA_VERSION,
    tasks: Array.isArray(input.tasks) ? input.tasks : null
  };
}

function createTaskStore({ dataDir = DATA_DIR, now = () => new Date() } = {}) {
  const taskPath = path.join(dataDir, 'today_tasks.md');
  const taskJsonPath = path.join(dataDir, 'tasks.json');

  function saveTasks(tasks) {
    ensureDir(dataDir);
    let normalized = tasks
      .map((task, index) => normalizeTask({ ...task, order: index }, index, now))
      .filter(task => task.text);
    normalized = normalizeTaskSelection(normalized);
    normalized.sort((a, b) => a.order - b.order).forEach((task, index) => { task.order = index; });
    writeJsonAtomic(taskJsonPath, { version: TASK_SCHEMA_VERSION, tasks: normalized }, { backupLabel: 'tasks', maxBackups: 5 });
    fs.writeFileSync(taskPath, serializeMarkdown(normalized), 'utf8');
    return normalized.map(clone);
  }

  function loadTasks() {
    ensureDir(dataDir);
    if (fs.existsSync(taskJsonPath)) {
      const result = readJsonWithRecovery(taskJsonPath, {
        fallback: { version: TASK_SCHEMA_VERSION, tasks: null },
        backupLabel: 'tasks',
        normalize: migrateTasksState
      });
      if (Array.isArray(result.value.tasks)) return saveTasks(result.value.tasks);
    }
    if (fs.existsSync(taskPath)) return saveTasks(parseMarkdown(fs.readFileSync(taskPath, 'utf8')));
    return saveTasks([
      { text: '写下今天最重要的一件事', priority: 'high' },
      { text: '推进电商系统的一个小步骤', priority: 'medium' },
      { text: '晚上复盘今天完成了什么', priority: 'low' }
    ]);
  }

  function listTasks() {
    return loadTasks();
  }

  function replaceTasks(nextTasks) {
    return saveTasks(nextTasks);
  }

  function importMarkdown(text) {
    return saveTasks(parseMarkdown(text));
  }

  function exportMarkdown() {
    return serializeMarkdown(loadTasks());
  }

  function addTask(input) {
    const tasks = loadTasks();
    const task = normalizeTask({ ...input, order: tasks.length }, tasks.length, now);
    return saveTasks([...tasks, task]).find(item => item.id === task.id);
  }

  function updateTask(id, patch) {
    let updated = null;
    const tasks = loadTasks().map(task => {
      if (task.id !== id) return task;
      updated = normalizeTask({
        ...task,
        ...patch,
        id: task.id,
        createdAt: task.createdAt,
        order: task.order,
        updatedAt: now().toISOString()
      }, task.order, now);
      return updated;
    });
    const saved = saveTasks(tasks);
    return updated ? (saved.find(task => task.id === id) || clone(updated)) : null;
  }

  function toggleTask(id, done) {
    return updateTask(id, { done: Boolean(done), completedAt: done ? now().toISOString() : null, selected: false });
  }

  function selectTask(id) {
    const tasks = loadTasks();
    const target = tasks.find(task => task.id === id);
    if (!target || target.done || taskBlockedReason(target)) return null;
    const timestamp = now().toISOString();
    const saved = saveTasks(tasks.map(task => {
      const selected = task.id === id;
      if (task.selected === selected) return task;
      return { ...task, selected, updatedAt: timestamp };
    }));
    return saved.find(task => task.id === id) || null;
  }

  function deleteTask(id) {
    const tasks = loadTasks();
    const nextTasks = tasks.filter(task => task.id !== id);
    saveTasks(nextTasks);
    return { ok: nextTasks.length !== tasks.length };
  }

  function moveTask(id, direction) {
    const tasks = loadTasks().sort((a, b) => a.order - b.order);
    const index = tasks.findIndex(task => task.id === id);
    if (index === -1) return null;
    const [task] = tasks.splice(index, 1);
    if (direction === 'down') tasks.push(task);
    else tasks.unshift(task);
    return saveTasks(tasks).find(task => task.id === id) || null;
  }

  function getCurrentTask() {
    return getCurrentTaskDecision().task;
  }

  function getCurrentTaskDecision() {
    const tasks = loadTasks();
    const blocked = tasks.filter(item => !item.done && taskBlockedReason(item));
    const task = tasks
      .filter(item => !item.done && !taskBlockedReason(item))
      .sort(compareActionableTasks)[0] || null;
    return {
      task: task ? clone(task) : null,
      reasons: task ? taskSelectionReasons(task) : [],
      skippedBlockedCount: blocked.length,
      candidateCount: tasks.filter(item => !item.done && !taskBlockedReason(item)).length
    };
  }

  return {
    listTasks,
    replaceTasks,
    importMarkdown,
    exportMarkdown,
    addTask,
    updateTask,
    toggleTask,
    selectTask,
    deleteTask,
    moveTask,
    getCurrentTask,
    getCurrentTaskDecision
  };
}

module.exports = {
  DATA_DIR,
  TASK_PATH,
  TASK_JSON_PATH,
  TASK_SCHEMA_VERSION,
  PRIORITIES,
  createTaskStore,
  parseMarkdown,
  serializeMarkdown,
  migrateTasksState,
  taskBlockedReason,
  taskSelectionRank,
  compareActionableTasks
};
