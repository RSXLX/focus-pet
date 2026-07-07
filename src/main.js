const { app, BrowserWindow, Notification, desktopCapturer, ipcMain, screen, session, shell, systemPreferences } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const focus = require('./focus');
const { writeRuntimeLog, sanitizeLogText } = require('./runtime-logger');
const { appendJsonlWithRetention } = require('./jsonl-retention');
const { applyLaunchAtLogin, launchAtLoginState } = require('./launch-login');
const { platformSettingsProfile, platformSettingsTarget } = require('./platform-support');
const { DEFAULT_UPDATE_FEED_URL, DEFAULT_UPDATE_PAGE_URL, checkLatestVersion } = require('./update-service');
const packageJson = require('../package.json');

let mainWindow;
let isQuitting = false;
let keepAliveTimer;
let chatServiceModule = null;
let chatRuntime = null;
let diagnosticsModule = null;
let screenMonitorModule = null;
let llmSelfCheckModule = null;
let cloudClientModule = null;
let updateCheckTimer = null;
let updateStartupTimer = null;
let lastNotifiedUpdateVersion = '';
const STOP_MARKER_PATH = path.join(focus.DATA_DIR, 'focus-pet.stop');
const ERROR_LOG_PATH = path.join(path.resolve(__dirname, '..'), 'docs', 'errorThing.md');
const APP_ICON_PNG = path.join(__dirname, 'assets', 'app-icon', 'icon.png');
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const UPDATE_STARTUP_DELAY_MS = 15_000;
const PET_GIF_DIR = path.join(__dirname, 'assets', 'pets', 'nervy-sci-fi-kid', 'gifs');
const PET_GIF_ASSETS = [
  { key: 'tap-heart', label: '摸摸爱心', file: 'tap-heart.gif', sourceType: 'generated-image-pack' },
  { key: 'feed-loop', label: '喂食补能量', file: 'feed-loop.gif', sourceType: 'generated-image-pack' },
  { key: 'focus-mode', label: '一起专注', file: 'focus-mode.gif', sourceType: 'generated-image-pack' },
  { key: 'play-dance', label: '开心跳舞', file: 'play-dance.gif', sourceType: 'generated-image-pack' },
  { key: 'rest-sleep', label: '安静休息', file: 'rest-sleep.gif', sourceType: 'generated-image-pack' },
  { key: 'celebrate-finish', label: '完成庆祝', file: 'celebrate-finish.gif', sourceType: 'generated-image-pack' },
  { key: 'sparkle-happy', label: '开心闪光', file: 'sparkle-happy.gif', sourceType: 'generated-image-pack' },
  { key: 'stretch-break', label: '伸展放松', file: 'stretch-break.gif', sourceType: 'generated-image-pack' },
  { key: 'hydrate-water', label: '补水一下', file: 'hydrate-water.gif', sourceType: 'generated-image-pack' },
  { key: 'meditate-calm', label: '安静呼吸', file: 'meditate-calm.gif', sourceType: 'generated-image-pack' },
  { key: 'read-review', label: '复盘阅读', file: 'read-review.gif', sourceType: 'generated-image-pack' },
  { key: 'cheer-success', label: '加油好棒', file: 'cheer-success.gif', sourceType: 'generated-image-pack' },
  { key: 'morning-wave', label: '早安挥手', file: 'morning-wave.gif', sourceType: 'generated-image-pack' },
  { key: 'hug-comfort', label: '抱抱安慰', file: 'hug-comfort.gif', sourceType: 'generated-image-pack' },
  { key: 'surprise-alert', label: '惊讶一下', file: 'surprise-alert.gif', sourceType: 'generated-image-pack' },
  { key: 'cry-sad', label: '哭哭低落', file: 'cry-sad.gif', sourceType: 'generated-image-pack' },
  { key: 'angry-pout', label: '生气鼓脸', file: 'angry-pout.gif', sourceType: 'generated-image-pack' },
  { key: 'busy-laptop', label: '忙碌工作', file: 'busy-laptop.gif', sourceType: 'generated-image-pack' },
  { key: 'ok-ready', label: 'OK 准备好', file: 'ok-ready.gif', sourceType: 'generated-image-pack' },
  { key: 'love-miss', label: '想你爱心', file: 'love-miss.gif', sourceType: 'generated-image-pack' },
  { key: 'phone-call', label: '通话陪伴', file: 'phone-call.gif', sourceType: 'generated-image-pack' },
  { key: 'full-body-states-demo', label: '全身状态合集', file: 'full-body-states-demo.gif', sourceType: 'generated-image-pack' }
];

const WINDOW_SIZES = {
  compact: { width: 220, height: 270 },
  expanded: { width: 540, height: 520 }
};

function getChatService() {
  if (!chatServiceModule) chatServiceModule = require('./chat-service');
  return chatServiceModule;
}

function ensureChatServiceStarted() {
  if (!chatRuntime) chatRuntime = getChatService().start();
  return chatRuntime;
}

function stopChatService() {
  if (!chatServiceModule) return;
  getChatService().stop();
  chatRuntime = null;
}

function syncChatSettingsIfLoaded(settings) {
  if (chatServiceModule) getChatService().updateSettings(settings);
}

function getDiagnosticsModule() {
  if (!diagnosticsModule) diagnosticsModule = require('./diagnostics');
  return diagnosticsModule;
}

function getScreenMonitor() {
  if (!screenMonitorModule) screenMonitorModule = require('./screen-monitor');
  return screenMonitorModule;
}

function getLlmSelfCheck() {
  if (!llmSelfCheckModule) llmSelfCheckModule = require('./llm-self-check');
  return llmSelfCheckModule;
}

function getCloudClient() {
  if (!cloudClientModule) cloudClientModule = require('./cloud-client');
  return cloudClientModule;
}

function logMain(message, level = 'info') {
  writeRuntimeLog({ level, scope: 'main', message, retentionDays: focus.getSettings().activityRetentionDays });
}

function requestSupervisorStop(reason = 'quit') {
  try {
    fs.mkdirSync(path.dirname(STOP_MARKER_PATH), { recursive: true });
    fs.writeFileSync(STOP_MARKER_PATH, reason);
  } catch (error) {
    logMain(`write stop marker failed: ${error.stack || error.message}`, 'error');
  }
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

function screenPermissionStatus() {
  if (process.platform !== 'darwin') return 'granted';
  return systemPreferences.getMediaAccessStatus('screen');
}

function permissionStepStatus(step, platform = process.platform) {
  if (platform === 'darwin' && step.id === 'accessibility') {
    const granted = typeof systemPreferences.isTrustedAccessibilityClient === 'function'
      ? systemPreferences.isTrustedAccessibilityClient(false)
      : false;
    return {
      status: granted ? 'granted' : 'blocked',
      statusText: granted ? '已开启' : '待开启',
      detail: granted ? '已允许读取当前 App 和窗口标题。' : '请打开辅助功能并允许 Focus Pet / Electron / Terminal。'
    };
  }
  if (platform === 'darwin' && step.id === 'screen-recording') {
    const status = screenPermissionStatus();
    const granted = status === 'granted';
    return {
      status: granted ? 'granted' : 'blocked',
      statusText: granted ? '已开启' : '待开启',
      detail: granted ? '已允许屏幕录制。' : `当前系统状态：${status || 'unknown'}，请打开屏幕录制并允许当前应用。`
    };
  }
  if (platform === 'win32') {
    return {
      status: 'unknown',
      statusText: '需确认',
      detail: 'Windows 不提供可靠的前台窗口读取授权状态，请按安全软件或系统提示放行。'
    };
  }
  return {
    status: 'unavailable',
    statusText: '不可用',
    detail: '当前平台暂未提供自动权限检测。'
  };
}

function buildPermissionStatus() {
  const profile = platformSettingsProfile(process.platform);
  return {
    ...profile,
    checkedAt: new Date().toISOString(),
    permissionGuideSteps: (profile.permissionGuideSteps || []).map(step => ({
      ...step,
      ...permissionStepStatus(step, process.platform)
    }))
  };
}

async function openPlatformSettings(kind) {
  const target = platformSettingsTarget(kind, process.platform);
  if (!target?.url) return false;
  try {
    await shell.openExternal(target.url);
    return true;
  } catch (error) {
    logMain(`open ${kind} settings failed: ${error.stack || error.message}`, 'warn');
    appendErrorThing({
      description: `打开系统设置失败：${error.message}`,
      location: 'src/main.js openPlatformSettings',
      context: `platform=${process.platform}, kind=${kind}, url=${target.url}`,
      possibleCause: '系统设置 URI 不可用、shell.openExternal 被系统拦截，或当前运行环境不支持打开外部设置页。',
      status: '未解决'
    });
    return false;
  }
}

function appendScreenMonitorLog(entry, retentionDays) {
  const safeEntry = {
    time: entry.time || new Date().toISOString(),
    ok: Boolean(entry.ok),
    status: entry.status,
    activity: entry.activity || '',
    reason: entry.reason || '',
    confidence: entry.confidence || 0,
    schemaVersion: entry.schemaVersion || 0,
    schemaValid: Boolean(entry.schemaValid),
    taskRelevance: entry.taskRelevance || '',
    evidence: Array.isArray(entry.evidence) ? entry.evidence.slice(0, 5) : [],
    privacyRisk: entry.privacyRisk || '',
    suggestedIntervention: entry.suggestedIntervention || '',
    reasoningVisible: entry.reasoningVisible || '',
    lowConfidence: Boolean(entry.lowConfidence),
    screenshotPolicy: entry.screenshotPolicy || entry.screenshot?.policy || null,
    sourceName: entry.sourceName || '',
    currentTask: entry.currentTask || null,
    frontmost: entry.frontmost || null,
    pipelineReview: entry.pipelineReview?.llm ? {
      ok: Boolean(entry.pipelineReview.llm.ok),
      status: entry.pipelineReview.llm.status || '',
      summary: entry.pipelineReview.llm.summary || '',
      insight: entry.pipelineReview.llm.insight || '',
      tone: entry.pipelineReview.llm.tone || ''
    } : null,
    sharedActivity: entry.sharedActivity ? {
      id: entry.sharedActivity.id || '',
      from: entry.sharedActivity.from || '',
      status: entry.sharedActivity.status || '',
      activity: entry.sharedActivity.activity || '',
      mediaId: entry.sharedActivity.media?.id || ''
    } : null
  };
  appendJsonlWithRetention(safeEntry, {
    logPath: path.join(focus.DATA_DIR, 'screen-monitor.jsonl'),
    retentionDays
  });
}

function parseDataUrl(dataUrl = '') {
  const match = String(dataUrl || '').match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) return null;
  return {
    mimeType: match[1],
    data: match[2]
  };
}

function publicScreenshot(screenshot = null, media = null) {
  if (!screenshot) return null;
  return {
    mimeType: screenshot.mimeType || media?.mimeType || 'image/png',
    sourceName: screenshot.sourceName || '',
    size: screenshot.size || null,
    media: media || null
  };
}

function shouldPublishScreenActivity(settings = {}) {
  return settings.socialActivityShareLevel === 'screen-summary';
}

function publishScreenActivity(result = {}, options = {}) {
  if (!result.ok) return null;
  try {
    ensureChatServiceStarted();
    const chatService = getChatService();
    let media = null;
    if (options.includeScreenshot && result.screenshot?.dataUrl) {
      const image = parseDataUrl(result.screenshot.dataUrl);
      if (!image) throw new Error('屏幕截图 data URL 格式无效');
      media = chatService.saveMedia({
        name: `screen-analysis-${new Date(result.time || Date.now()).toISOString().replace(/[:.]/g, '-')}.png`,
        mimeType: image.mimeType || result.screenshot.mimeType || 'image/png',
        data: image.data
      });
    }
    return chatService.publishActivitySnapshot({
      status: result.status,
      activity: result.activity,
      reason: result.reason,
      taskRelevance: result.taskRelevance,
      evidence: result.evidence,
      privacyRisk: result.privacyRisk,
      suggestedIntervention: result.suggestedIntervention,
      reasoningVisible: result.reasoningVisible,
      lowConfidence: result.lowConfidence,
      suggestion: result.suggestion,
      confidence: result.confidence,
      message: result.pipelineReview?.llm?.petMessage || result.message,
      sourceName: result.sourceName || result.screenshot.sourceName,
      currentTask: result.currentTask,
      frontmost: result.frontmost,
      review: result.pipelineReview?.llm || null,
      media,
      time: result.time
    });
  } catch (error) {
    logMain(`screen activity publish failed: ${error.stack || error.message}`, 'warn');
    appendErrorThing({
      description: `屏幕分析结果同步到聊天失败：${error.message}`,
      location: 'src/main.js publishScreenActivity',
      context: `status=${result.status || 'unknown'}, activity=${result.activity || '无'}, hasScreenshot=${Boolean(result.screenshot?.dataUrl)}, includeScreenshot=${Boolean(options.includeScreenshot)}`,
      possibleCause: '截图 data URL 异常、聊天媒体目录写入失败、媒体大小超过限制，或聊天状态文件不可写。',
      status: '未解决'
    });
    return null;
  }
}

function clampWindowBounds(x, y, width, height) {
  const display = screen.getDisplayNearestPoint({ x: Math.round(x), y: Math.round(y) });
  const { x: minX, y: minY, width: areaWidth, height: areaHeight } = display.workArea;
  const maxX = minX + Math.max(0, areaWidth - width);
  const maxY = minY + Math.max(0, areaHeight - height);
  return {
    x: Math.min(Math.max(Math.round(x), minX), maxX),
    y: Math.min(Math.max(Math.round(y), minY), maxY),
    width,
    height
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_SIZES.compact.width,
    height: WINDOW_SIZES.compact.height,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    icon: APP_ICON_PNG,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: true,
      spellcheck: false
    }
  });

  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(['media', 'audioCapture', 'videoCapture'].includes(permission));
  });
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  mainWindow.setAlwaysOnTop(true, 'floating');
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('close', event => {
    if (isQuitting) return;
    event.preventDefault();
    mainWindow.hide();
    logMain('window close prevented; hidden instead');
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => logMain(`renderer gone: ${JSON.stringify(details)}`, 'error'));
  mainWindow.webContents.on('unresponsive', () => logMain('renderer unresponsive', 'warn'));
}

function installMediaPermissionHandler() {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details = {}) => {
    if (!['media', 'microphone', 'camera'].includes(permission)) {
      callback(false);
      return;
    }
    const url = details.requestingUrl || webContents.getURL() || '';
    const allowed = url.startsWith('file://')
      || /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url)
      || /^https?:\/\/(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?\//.test(url);
    callback(allowed);
  });
}

function safeExternalUrl(value) {
  const text = String(value || '').trim();
  if (!/^https?:\/\//i.test(text)) return '';
  try {
    return new URL(text).toString();
  } catch {
    return '';
  }
}

async function openUpdateDownload(update = {}) {
  const url = safeExternalUrl(update.url || update.pageUrl || update.downloadUrl || DEFAULT_UPDATE_PAGE_URL);
  if (!url) return false;
  await shell.openExternal(url);
  return true;
}

function showUpdateNotification(result = {}) {
  if (!result.available || !result.latestVersion) return false;
  if (lastNotifiedUpdateVersion === result.latestVersion) return false;
  lastNotifiedUpdateVersion = result.latestVersion;
  if (typeof Notification.isSupported === 'function' && !Notification.isSupported()) return false;

  const notification = new Notification({
    title: 'Focus Pet 有新版本',
    body: `${result.latestVersion} 已发布，点击打开下载页。`,
    icon: APP_ICON_PNG
  });
  notification.on('click', () => {
    openUpdateDownload(result).catch(error => logMain(`open update download failed: ${error.stack || error.message}`, 'warn'));
  });
  notification.show();
  return true;
}

async function checkForUpdate(options = {}) {
  const settings = focus.getSettings();
  const result = await checkLatestVersion({
    currentVersion: packageJson.version,
    feedUrl: settings.updateFeedUrl || DEFAULT_UPDATE_FEED_URL,
    platform: process.platform,
    arch: process.arch
  });
  const notified = options.notify ? showUpdateNotification(result) : false;
  return { ...result, notified };
}

function scheduleAutomaticUpdateChecks(settings = focus.getSettings()) {
  if (updateCheckTimer) clearInterval(updateCheckTimer);
  if (updateStartupTimer) clearTimeout(updateStartupTimer);
  updateCheckTimer = null;
  updateStartupTimer = null;
  if (!settings.autoCheckUpdates) return;

  const run = () => {
    checkForUpdate({ notify: true, source: 'auto' })
      .catch(error => logMain(`auto update check failed: ${error.stack || error.message}`, 'warn'));
  };
  updateCheckTimer = setInterval(run, UPDATE_CHECK_INTERVAL_MS);
  updateStartupTimer = setTimeout(run, UPDATE_STARTUP_DELAY_MS);
  if (typeof updateCheckTimer.unref === 'function') updateCheckTimer.unref();
  if (typeof updateStartupTimer.unref === 'function') updateStartupTimer.unref();
}

function petGifAssetPath(asset) {
  return path.join(PET_GIF_DIR, asset.file);
}

function petGifPublicPath(asset) {
  return `assets/pets/nervy-sci-fi-kid/gifs/${asset.file}`;
}

function listPetGifs() {
  return PET_GIF_ASSETS
    .map(asset => {
      const filePath = petGifAssetPath(asset);
      if (!fs.existsSync(filePath)) return null;
      return {
        key: asset.key,
        label: asset.label,
        name: asset.file,
        mimeType: 'image/gif',
        size: fs.statSync(filePath).size,
        sourceType: asset.sourceType,
        previewUrl: petGifPublicPath(asset)
      };
    })
    .filter(Boolean);
}

function sharePetGif(key) {
  ensureChatServiceStarted();
  const chatService = getChatService();
  const asset = PET_GIF_ASSETS.find(item => item.key === String(key || '').trim());
  if (!asset) throw new Error('未找到这个宠物动图');
  const filePath = petGifAssetPath(asset);
  if (!fs.existsSync(filePath)) throw new Error(`宠物动图文件不存在：${asset.file}`);
  const media = chatService.saveMedia({
    name: asset.file,
    mimeType: 'image/gif',
    data: fs.readFileSync(filePath).toString('base64')
  });
  return {
    ...media,
    key: asset.key,
    label: asset.label,
    sourceType: asset.sourceType
  };
}

async function openPetGifFolder() {
  fs.mkdirSync(PET_GIF_DIR, { recursive: true });
  return shell.openPath(PET_GIF_DIR);
}

async function testLlmConnectivity(patch = {}) {
  const settings = { ...focus.getSettings(), ...(patch || {}) };
  try {
    return await getLlmSelfCheck().runLlmConnectivitySelfCheck({
      settings,
      env: process.env,
      fetchImpl: fetch
    });
  } catch (error) {
    logMain(`llm connectivity self-check failed: ${error.stack || error.message}`, 'warn');
    appendErrorThing({
      description: `LLM 连通性自检入口异常：${error.message}`,
      location: 'src/main.js testLlmConnectivity',
      context: `screenEndpoint=${settings.screenMonitorEndpoint || '未配置'}, reviewEndpoint=${settings.reviewLlmEndpoint || '未配置'}`,
      possibleCause: '自检模块、fetch 实现或 IPC 参数异常。',
      status: '未解决'
    });
    return {
      ok: false,
      checkedAt: new Date().toISOString(),
      checks: [],
      error: error.message
    };
  }
}

async function sampleScreenMonitor(options = {}) {
  const manual = Boolean(options?.manual);
  const settings = focus.getSettings();
  if (!settings.screenMonitorEnabled && !manual) {
    return getScreenMonitor().analyzeScreenActivity({ settings });
  }
  let currentTask = null;
  let frontmost = null;
  try {
    currentTask = focus.getCurrentTask();
    frontmost = focus.getStatus();
    const result = await getScreenMonitor().analyzeScreenActivity({
      settings: manual ? { ...settings, screenMonitorEnabled: true } : settings,
      currentTask,
      frontmost,
      getScreenPermissionStatus: screenPermissionStatus,
      captureScreen: () => getScreenMonitor().capturePrimaryScreen(desktopCapturer),
      fetchImpl: fetch,
      manual
    });
    const pipelineReview = options?.review && result.ok
      ? await focus.getDailyReview({ screenAnalysis: result, fetchImpl: fetch })
      : null;
    const withContext = { ...result, currentTask, frontmost, pipelineReview };
    const sharedActivity = shouldPublishScreenActivity(settings)
      ? publishScreenActivity(withContext, { includeScreenshot: false })
      : null;
    const publicResult = {
      ...withContext,
      screenshot: publicScreenshot(withContext.screenshot, sharedActivity?.media),
      sharedActivity
    };
    if (settings.screenMonitorEnabled || manual) appendScreenMonitorLog(publicResult, settings.activityRetentionDays);
    return publicResult;
  } catch (error) {
    const result = {
      ok: false,
      status: 'error',
      reason: error.message,
      time: new Date().toISOString(),
      currentTask,
      frontmost
    };
    if (settings.screenMonitorEnabled || manual) appendScreenMonitorLog(result, settings.activityRetentionDays);
    logMain(`screen monitor failed: ${error.stack || error.message}`, 'warn');
    appendErrorThing({
      description: `屏幕截图上传 LLM 异常：${error.message}`,
      location: 'src/main.js sampleScreenMonitor',
      context: `manual=${manual}, screenMonitorEnabled=${settings.screenMonitorEnabled}, currentTask=${currentTask?.text || '未设置'}, frontmost=${frontmost?.app || '未知'}`,
      possibleCause: '屏幕录制权限、LLM endpoint/model/API key 配置、网络连接，或视觉模型服务返回异常。',
      status: '未解决'
    });
    return result;
  }
}

app.whenReady().then(() => {
  keepAliveTimer = setInterval(() => {}, 60_000);
  installMediaPermissionHandler();
  applyLaunchAtLogin(app, focus.getSettings(), { path: process.execPath });
  createWindow();
  scheduleAutomaticUpdateChecks(focus.getSettings());

  ipcMain.handle('focus:get-status', () => focus.getStatus());
  ipcMain.handle('focus:get-review', () => focus.getDailyReview());
  ipcMain.handle('focus:get-tasks', () => focus.getTasks());
  ipcMain.handle('focus:save-tasks', (_event, text) => focus.saveTasks(text));
  ipcMain.handle('tasks:list', () => focus.listTasks());
  ipcMain.handle('tasks:add', (_event, input) => focus.addTask(input));
  ipcMain.handle('tasks:update', (_event, id, patch) => focus.updateTask(id, patch));
  ipcMain.handle('tasks:toggle', (_event, id, done) => focus.toggleTask(id, done));
  ipcMain.handle('tasks:select', (_event, id) => focus.selectTask(id));
  ipcMain.handle('tasks:delete', (_event, id) => focus.deleteTask(id));
  ipcMain.handle('tasks:move', (_event, id, direction) => focus.moveTask(id, direction));
  ipcMain.handle('tasks:apply-tomorrow-plan', (_event, plan) => focus.applyTomorrowPlan(plan));
  ipcMain.handle('tasks:current', () => focus.getCurrentTask());
  ipcMain.handle('tasks:current-decision', () => focus.getCurrentTaskDecision());
  ipcMain.handle('settings:get', () => {
    const settings = focus.getSettings();
    return {
      ...settings,
      ...launchAtLoginState(app, settings),
      platform: platformSettingsProfile(process.platform)
    };
  });
  ipcMain.handle('settings:update', (_event, patch) => {
    const settings = focus.updateSettings(patch);
    syncChatSettingsIfLoaded(settings);
    const launchState = applyLaunchAtLogin(app, settings, { path: process.execPath });
    scheduleAutomaticUpdateChecks(settings);
    return {
      ...settings,
      ...launchState,
      platform: platformSettingsProfile(process.platform)
    };
  });
  ipcMain.handle('settings:test-llm-connectivity', (_event, patch) => testLlmConnectivity(patch));
  ipcMain.handle('app:get-platform', () => platformSettingsProfile(process.platform));
  ipcMain.handle('app:permission-status', () => buildPermissionStatus());
  ipcMain.handle('app:get-diagnostics', () => {
    const chatService = chatServiceModule ? getChatService() : null;
    return getDiagnosticsModule().buildRuntimeDiagnosticsSummary({
      permissionStatus: buildPermissionStatus(),
      settings: focus.getSettings(),
      tasks: focus.listTasks(),
      chatState: chatService ? chatService.publicState() : undefined,
      chatHealth: chatService ? chatService.healthState({ publicUrl: chatRuntime?.publicUrl }) : undefined
    });
  });
  ipcMain.handle('app:open-accessibility-settings', () => openPlatformSettings('accessibility'));
  ipcMain.handle('app:open-screen-recording-settings', () => openPlatformSettings('screen-recording'));
  ipcMain.handle('app:check-update', (_event, options = {}) => checkForUpdate(options));
  ipcMain.handle('app:open-update-download', (_event, update = {}) => openUpdateDownload(update));
  ipcMain.handle('app:get-pet-gifs', () => listPetGifs());
  ipcMain.handle('app:share-pet-gif', (_event, key) => sharePetGif(key));
  ipcMain.handle('app:open-pet-gif-folder', () => openPetGifFolder());
  ipcMain.handle('app:open-external', (_event, url) => {
    if (!/^https?:\/\//.test(String(url || ''))) return false;
    shell.openExternal(url);
    return true;
  });
  ipcMain.handle('app:open-data-dir', () => shell.openPath(focus.DATA_DIR));
  ipcMain.handle('app:set-expanded', (_event, expanded) => {
    if (!mainWindow) return;
    const { width, height } = expanded ? WINDOW_SIZES.expanded : WINDOW_SIZES.compact;
    const bounds = mainWindow.getBounds();
    mainWindow.setBounds(clampWindowBounds(bounds.x, bounds.y, width, height), true);
  });
  ipcMain.handle('app:set-click-through', (_event, clickThrough) => {
    if (!mainWindow) return;
    mainWindow.setIgnoreMouseEvents(Boolean(clickThrough), { forward: true });
  });
  ipcMain.handle('app:get-position', () => (mainWindow ? mainWindow.getPosition() : [0, 0]));
  ipcMain.handle('app:set-position', (_event, x, y) => {
    if (!mainWindow) return;
    const { width, height } = mainWindow.getBounds();
    const bounds = clampWindowBounds(x, y, width, height);
    mainWindow.setPosition(bounds.x, bounds.y, false);
  });
  ipcMain.handle('screen-monitor:sample', (_event, options) => sampleScreenMonitor(options));
  ipcMain.handle('cloud:get-state', () => getCloudClient().getCloudMe({ fetchImpl: fetch, settings: focus.getSettings() }));
  ipcMain.handle('cloud:register', (_event, input) => getCloudClient().registerCloudUser(input, { fetchImpl: fetch, settings: focus.getSettings() }));
  ipcMain.handle('cloud:add-friend', (_event, friendCode) => getCloudClient().addCloudFriend(friendCode, { fetchImpl: fetch, settings: focus.getSettings() }));
  ipcMain.handle('cloud:refresh', () => getCloudClient().getCloudMe({ fetchImpl: fetch, settings: focus.getSettings() }));
  ipcMain.handle('cloud:clear-account', () => getCloudClient().accountToChatState(getCloudClient().clearCloudAccount({ settings: focus.getSettings() }), null, { settings: focus.getSettings() }));
  ipcMain.handle('chat:get-state', () => {
    ensureChatServiceStarted();
    return getChatService().publicState();
  });
  ipcMain.handle('chat:update-self', (_event, patch) => getChatService().updateSelf(patch));
  ipcMain.handle('chat:add-friend', (_event, name) => getChatService().addFriend(name));
  ipcMain.handle('chat:add-friend-by-invite', (_event, inviteCode, name) => {
    ensureChatServiceStarted();
    return getChatService().addFriendByInvite(inviteCode, name);
  });
  ipcMain.handle('chat:remove-friend', (_event, friendId) => getChatService().removeFriend(friendId));
  ipcMain.handle('chat:revoke-peer-session', (_event, friendId) => getChatService().revokePeerSessions(friendId));
  ipcMain.handle('chat:mark-read', (_event, friendId) => getChatService().markRead(friendId));
  ipcMain.handle('chat:clear-history', () => getChatService().clearHistory());
  ipcMain.handle('chat:reset-invite', () => {
    ensureChatServiceStarted();
    return getChatService().resetInvite();
  });
  ipcMain.handle('chat:send-message', (_event, message) => {
    ensureChatServiceStarted();
    return getChatService().addMessage(message);
  });
  ipcMain.handle('chat:save-media', (_event, media) => {
    ensureChatServiceStarted();
    return getChatService().saveMedia(media);
  });
  ipcMain.handle('chat:get-port', () => ensureChatServiceStarted().port);
  ipcMain.handle('app:quit', () => {
    requestSupervisorStop('quit');
    isQuitting = true;
    app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => {
  requestSupervisorStop('quit');
  isQuitting = true;
  if (keepAliveTimer) clearInterval(keepAliveTimer);
  if (updateCheckTimer) clearInterval(updateCheckTimer);
  if (updateStartupTimer) clearTimeout(updateStartupTimer);
  stopChatService();
});

app.on('window-all-closed', event => {
  if (isQuitting) return;
  event.preventDefault();
});
