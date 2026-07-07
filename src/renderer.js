const message = document.querySelector('#message');
const context = document.querySelector('#context');
const pet = document.querySelector('#pet');
const panel = document.querySelector('#panel');
const panelTitle = document.querySelector('#panelTitle');
const tasksArea = document.querySelector('#tasks');
const taskList = document.querySelector('#taskList');
const taskSummary = document.querySelector('#taskSummary');
const taskProgress = document.querySelector('#taskProgress');
const editTasks = document.querySelector('#editTasks');
const taskComposer = document.querySelector('#taskComposer');
const taskComposerFeedback = document.querySelector('#taskComposerFeedback');
const newTaskText = document.querySelector('#newTaskText');
const newTaskPriority = document.querySelector('#newTaskPriority');
const newTaskScene = document.querySelector('#newTaskScene');
const newTaskDue = document.querySelector('#newTaskDue');
const addTaskButton = document.querySelector('#addTask');
const reviewBox = document.querySelector('#review');
const onboardingPanel = document.querySelector('#onboardingPanel');
const completeBasicOnboardingButton = document.querySelector('#completeBasicOnboarding');
const openEnhancedOnboardingButton = document.querySelector('#openEnhancedOnboarding');
const openAdvancedOnboardingButton = document.querySelector('#openAdvancedOnboarding');
const settingsPanel = document.querySelector('#settingsPanel');
const saveSettingsButton = document.querySelector('#saveSettings');
const checkUpdatesButton = document.querySelector('#checkUpdates');
const openPermissionsButton = document.querySelector('#openPermissions');
const openScreenRecordingButton = document.querySelector('#openScreenRecording');
const testLlmConnectivityButton = document.querySelector('#testLlmConnectivity');
const testScreenMonitorButton = document.querySelector('#testScreenMonitor');
const updateResult = document.querySelector('#updateResult');
const llmSelfCheckResult = document.querySelector('#llmSelfCheckResult');
const platformStatus = document.querySelector('#platformStatus');
const permissionGuide = document.querySelector('#permissionGuide');
const permissionGuideTitle = document.querySelector('#permissionGuideTitle');
const permissionGuideStatus = document.querySelector('#permissionGuideStatus');
const permissionGuideList = document.querySelector('#permissionGuideList');
const refreshPermissionsButton = document.querySelector('#refreshPermissions');
const settingGroupButtons = Array.from(document.querySelectorAll('[data-settings-tab]'));
const settingGroups = Array.from(document.querySelectorAll('[data-settings-group]'));
const openDataFromSettingsButton = document.querySelector('#openDataFromSettings');
const runDiagnosticsFromSettingsButton = document.querySelector('#runDiagnosticsFromSettings');
const settingControls = {
  autoPopupEnabled: document.querySelector('#settingAutoPopup'),
  launchAtLogin: document.querySelector('#settingLaunchAtLogin'),
  launchAtLoginStatus: document.querySelector('#launchAtLoginStatus'),
  popupCooldownMinutes: document.querySelector('#settingCooldown'),
  idleNudgeMinutes: document.querySelector('#settingIdle'),
  socialActivityShareLevel: document.querySelector('#settingSocialActivityShareLevel'),
  maxMediaMb: document.querySelector('#settingMediaMb'),
  voiceRecordShortcut: document.querySelector('#settingVoiceShortcut'),
  petBehaviorIntensity: document.querySelector('#settingIntensity'),
  llmCloudMode: document.querySelector('#settingLlmCloudMode'),
  screenMonitorProvider: document.querySelector('#settingScreenMonitorProvider'),
  screenMonitorEnabled: document.querySelector('#settingScreenMonitorEnabled'),
  screenMonitorIntervalSeconds: document.querySelector('#settingScreenMonitorInterval'),
  screenCheckTransport: document.querySelector('#settingScreenCheckTransport'),
  screenCheckCloudUrl: document.querySelector('#settingScreenCheckCloudUrl'),
  screenMonitorEndpoint: document.querySelector('#settingScreenMonitorEndpoint'),
  screenMonitorModel: document.querySelector('#settingScreenMonitorModel'),
  reviewLlmProvider: document.querySelector('#settingReviewLlmProvider'),
  reviewLlmEnabled: document.querySelector('#settingReviewLlmEnabled'),
  reviewLlmEndpoint: document.querySelector('#settingReviewLlmEndpoint'),
  reviewLlmModel: document.querySelector('#settingReviewLlmModel'),
  focusKeywords: document.querySelector('#settingFocusKeywords'),
  studyKeywords: document.querySelector('#settingStudyKeywords'),
  gameKeywords: document.querySelector('#settingGameKeywords'),
  distractionKeywords: document.querySelector('#settingDistractionKeywords'),
  gameApps: document.querySelector('#settingGameApps'),
  workApps: document.querySelector('#settingWorkApps'),
  updateFeedUrl: document.querySelector('#settingUpdateUrl'),
  autoCheckUpdates: document.querySelector('#settingAutoUpdate'),
  activityRetentionDays: document.querySelector('#settingActivityRetentionDays')
};
const saveTasks = document.querySelector('#saveTasks');
const avatar = document.querySelector('.avatar');
const chatPanel = document.querySelector('#chatPanel');
const chatMessages = document.querySelector('#chatMessages');
const peerActivity = document.querySelector('#peerActivity');
const peerActivityImage = document.querySelector('#peerActivityImage');
const peerActivityTitle = document.querySelector('#peerActivityTitle');
const peerActivityText = document.querySelector('#peerActivityText');
const peerActivityMeta = document.querySelector('#peerActivityMeta');
const peerActivityLog = document.querySelector('#peerActivityLog');
const chatCompose = document.querySelector('.chat-compose');
const chatInput = document.querySelector('#chatInput');
const cloudChatAccount = document.querySelector('#cloudChatAccount');
const cloudChatStatus = document.querySelector('#cloudChatStatus');
const cloudFriendCode = document.querySelector('#cloudFriendCode');
const cloudDisplayName = document.querySelector('#cloudDisplayName');
const cloudRegisterButton = document.querySelector('#cloudRegisterButton');
const cloudFriendCodeInput = document.querySelector('#cloudFriendCodeInput');
const cloudAddFriendButton = document.querySelector('#cloudAddFriendButton');
const cloudRefreshButton = document.querySelector('#cloudRefreshButton');
const voiceModeButton = document.querySelector('#voiceModeButton');
const textModeButton = document.querySelector('#textModeButton');
const voiceRecordButton = document.querySelector('#voiceRecordButton');
const friendSelect = document.querySelector('#friendSelect');
const revokeSessionButton = document.querySelector('#revokeSessionButton');
const mediaInput = document.querySelector('#mediaInput');
const imageButton = document.querySelector('#imageButton');
const fileButton = document.querySelector('#fileButton');
const petGifButton = document.querySelector('#petGifButton');
const petGifTray = document.querySelector('#petGifTray');
const chatCallStage = document.querySelector('#chatCallStage');
const chatCallStatus = document.querySelector('#chatCallStatus');
const chatCallAudio = document.querySelector('#chatCallAudio');
const chatCallVideo = document.querySelector('#chatCallVideo');
const chatCallEnd = document.querySelector('#chatCallEnd');
const chatRtcNotice = document.querySelector('#chatRtcNotice');
const chatRtcContinue = document.querySelector('#chatRtcContinue');
const chatRtcCancel = document.querySelector('#chatRtcCancel');
const localCallVideo = document.querySelector('#localCallVideo');
const remoteCallVideo = document.querySelector('#remoteCallVideo');
const petMenu = document.querySelector('#petMenu');
const careMenuTitle = document.querySelector('#careMenuTitle');
const careMenuReason = document.querySelector('#careMenuReason');
const careMenuInsight = document.querySelector('#careMenuInsight');
const careActions = document.querySelector('#careActions');
const expandHint = document.querySelector('#expandHint');
const homeActions = document.querySelector('#homeActions');
const focusNowButton = document.querySelector('#focusNow');
const quickChatButton = document.querySelector('#quickChat');
const homeCareButton = document.querySelector('#careMenu');
const surfaceButtons = {
  chat: document.querySelector('#chatToggle'),
  tasks: document.querySelector('#tasksToggle'),
  review: document.querySelector('#reviewToggle'),
  onboarding: document.querySelector('#onboardingToggle'),
  settings: document.querySelector('#settingsToggle')
};
const petStats = {
  panel: document.querySelector('#petStats'),
  summary: document.querySelector('#petStateSummary'),
  cue: document.querySelector('#petCareCue'),
  mood: document.querySelector('#moodValue'),
  energy: document.querySelector('#energyValue'),
  bond: document.querySelector('#bondValue'),
  moodLabel: document.querySelector('[data-vital="mood"] span'),
  energyLabel: document.querySelector('[data-vital="energy"] span'),
  bondLabel: document.querySelector('[data-vital="bond"] span'),
  moodDelta: document.querySelector('#moodDelta'),
  energyDelta: document.querySelector('#energyDelta'),
  bondDelta: document.querySelector('#bondDelta'),
  moodTarget: document.querySelector('#moodTarget'),
  energyTarget: document.querySelector('#energyTarget'),
  bondTarget: document.querySelector('#bondTarget'),
  moodBar: document.querySelector('#moodBar'),
  energyBar: document.querySelector('#energyBar'),
  bondBar: document.querySelector('#bondBar'),
  feedback: document.querySelector('#petCareFeedback'),
  reason: document.querySelector('#petCareReason'),
  source: document.querySelector('#petCareSource'),
  recent: document.querySelector('#petCareRecent'),
  delta: document.querySelector('#petCareDelta'),
  guidance: document.querySelector('#petCareGuidance'),
  next: document.querySelector('#petCareNext'),
  why: document.querySelector('#petCareWhy'),
  detail: document.querySelector('#petCareDetail'),
  preview: document.querySelector('#petCarePreview'),
  now: document.querySelector('#petCareNow'),
  focusAction: {
    panel: document.querySelector('#petVitalFocusAction'),
    label: document.querySelector('#petVitalFocusLabel'),
    goal: document.querySelector('#petVitalFocusGoal'),
    reason: document.querySelector('#petVitalFocusReason'),
    impact: document.querySelector('#petVitalFocusImpact'),
    button: document.querySelector('#petVitalFocusButton')
  },
  rows: {
    mood: document.querySelector('[data-vital="mood"]'),
    energy: document.querySelector('[data-vital="energy"]'),
    bond: document.querySelector('[data-vital="bond"]')
  },
  chips: {
    mood: document.querySelector('#moodChip'),
    energy: document.querySelector('#energyChip'),
    bond: document.querySelector('#bondChip')
  }
};

const MOOD_CLASSES = ['mood-work', 'mood-study', 'mood-game', 'mood-distracted', 'mood-permission', 'mood-unknown'];
const PET_ACTION_CLASSES = ['action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest', 'action-call'];
const VITAL_KEYS = ['mood', 'energy', 'bond'];
const VITAL_LABELS = { mood: '心情', energy: '精力', bond: '亲密' };
const PET_ANIMATIONS = {
  idle: { row: 0, frames: 6, frameMs: 180 },
  'running-right': { row: 1, frames: 8, frameMs: 90 },
  'running-left': { row: 2, frames: 8, frameMs: 90 },
  waving: { row: 3, frames: 4, frameMs: 150 },
  jumping: { row: 4, frames: 5, frameMs: 120 },
  failed: { row: 5, frames: 8, frameMs: 170 },
  waiting: { row: 6, frames: 6, frameMs: 220 },
  running: { row: 7, frames: 6, frameMs: 110 },
  review: { row: 8, frames: 6, frameMs: 160 },
  sleep: { row: 9, frames: 6, frameMs: 220 },
  eat: { row: 10, frames: 6, frameMs: 140 },
  pat: { row: 11, frames: 6, frameMs: 130 },
  dance: { row: 12, frames: 8, frameMs: 105 },
  celebrate: { row: 13, frames: 8, frameMs: 95 },
  focus: { row: 14, frames: 8, frameMs: 120 },
  sparkle: { row: 15, frames: 6, frameMs: 115 },
  stretch: { row: 16, frames: 6, frameMs: 150 },
  hydrate: { row: 17, frames: 6, frameMs: 135 },
  meditate: { row: 18, frames: 6, frameMs: 190 },
  read: { row: 19, frames: 6, frameMs: 150 },
  cheer: { row: 20, frames: 8, frameMs: 90 },
  morning: { row: 21, frames: 6, frameMs: 140 },
  hug: { row: 22, frames: 6, frameMs: 155 },
  surprise: { row: 23, frames: 6, frameMs: 130 },
  cry: { row: 24, frames: 6, frameMs: 170 },
  angry: { row: 25, frames: 6, frameMs: 150 },
  busy: { row: 26, frames: 6, frameMs: 125 },
  ok: { row: 27, frames: 6, frameMs: 120 },
  love: { row: 28, frames: 6, frameMs: 135 },
  call: { row: 29, frames: 6, frameMs: 130 }
};
const STATUS_ANIMATIONS = {
  work: 'busy',
  study: 'focus',
  game: 'dance',
  distracted: 'cry',
  permission: 'waiting',
  unknown: 'waiting'
};
const ACTION_ANIMATIONS = {
  feed: 'eat',
  clean: 'pat',
  study: 'focus',
  work: 'focus',
  play: 'dance',
  rest: 'sleep',
  call: 'call'
};
const SURFACE_ANIMATIONS = {
  tasks: 'focus',
  review: 'read',
  settings: 'stretch',
  chat: 'morning'
};
const AVATAR_INTERACTION_HINT = '按 Enter 或空格摸摸它，或按住鼠标来回轻抚';
const PET_VIBE_ANIMATIONS = {
  fragile: 'sleep',
  tired: 'sleep',
  down: 'cry',
  guarded: 'hug',
  bright: 'sparkle'
};
const MOOD_STAGES = [
  { key: 'low', label: '低落', min: 0, next: 30, nextLabel: '平稳' },
  { key: 'steady', label: '平稳', min: 30, next: 62, nextLabel: '愉快' },
  { key: 'happy', label: '愉快', min: 62, next: 82, nextLabel: '高涨' },
  { key: 'bright', label: '高涨', min: 82, next: null, nextLabel: '' }
];
const ENERGY_STAGES = [
  { key: 'tired', label: '疲惫', min: 0, next: 25, nextLabel: '低电' },
  { key: 'low', label: '低电', min: 25, next: 58, nextLabel: '充足' },
  { key: 'ready', label: '充足', min: 58, next: 82, nextLabel: '饱满' },
  { key: 'full', label: '饱满', min: 82, next: null, nextLabel: '' }
];
const BOND_STAGES = [
  { key: 'new', label: '试探', min: 0, next: 35, nextLabel: '熟悉' },
  { key: 'familiar', label: '熟悉', min: 35, next: 65, nextLabel: '亲近' },
  { key: 'close', label: '亲近', min: 65, next: 85, nextLabel: '默契' },
  { key: 'trusted', label: '默契', min: 85, next: null, nextLabel: '' }
];
const CARE_ACTIONS = {
  feed: {
    label: '喂食',
    cue: '补充精力',
    delta: { mood: 8, energy: 10, bond: 3 },
    reason: '补一点能量后，它会更稳地陪你。',
    text: '它补了一点能量，眼神亮起来，会更稳地陪你。'
  },
  clean: {
    label: '轻互动',
    cue: '建立安心',
    delta: { mood: 6, energy: 0, bond: 4 },
    reason: '轻轻互动会让关系更安心。',
    text: '它靠近了一点，关系也更安心。'
  },
  study: {
    label: '学习',
    cue: '一起专注',
    delta: { mood: 2, energy: -8, bond: 5 },
    reason: '一起学习会消耗精力，但亲密会提升。',
    text: '一起学习 25 分钟吧，我会在旁边看着你。',
    opensTasks: true
  },
  work: {
    label: '打工',
    cue: '推进任务',
    delta: { mood: 2, energy: -10, bond: 4 },
    reason: '一起推进任务会消耗精力，但亲密会提升。',
    text: '进入打工模式：先推进一个最小任务。',
    opensTasks: true
  },
  play: {
    label: '玩耍',
    cue: '恢复心情',
    delta: { mood: 12, energy: -5, bond: 5 },
    reason: '短暂玩耍让心情回升。',
    text: '它放松了一小会儿，心情先回稳，等下再继续。'
  },
  rest: {
    label: '休息',
    cue: '恢复精力',
    delta: { mood: 4, energy: 15, bond: 2 },
    reason: '休息能恢复精力。',
    text: '它闭眼充电 5 分钟，精力回来后再陪你继续。'
  }
};
const CARE_ACTION_ORDER = ['feed', 'clean', 'study', 'work', 'play', 'rest'];
const CARE_ACTION_FOCUS = { feed: 'energy', clean: 'bond', study: 'bond', work: 'energy', play: 'mood', rest: 'energy' };
const CARE_ACTION_REPEAT_COOLDOWN_MS = 30000;
const CARE_ACTION_GUARDS = {
  lowEnergyWork: {
    actions: ['study', 'work'],
    guard: 'blocked',
    cue: '先休息',
    action: 'rest',
    delta: { energy: 4 },
    reason: '精力太低，先不强撑。',
    text: '它已经很累了，先休息一下再推进任务。'
  },
  lowMoodWork: {
    actions: ['study', 'work'],
    guard: 'blocked',
    cue: '先玩耍',
    action: 'play',
    delta: { mood: 4 },
    reason: '心情太低，先别硬推任务。',
    text: '它现在有点低落，先玩一小会儿再继续任务。'
  },
  newBondFocus: {
    actions: ['study', 'work'],
    guard: 'soft',
    cue: '先熟悉',
    action: 'clean',
    delta: { mood: 1, bond: 2 },
    reason: '关系还在试探，先轻互动会更安心。',
    text: '它还在适应你，先轻轻互动一下再一起推进。'
  },
  fullEnergyFeed: {
    actions: ['feed'],
    guard: 'soft',
    cue: '已饱',
    action: 'clean',
    delta: { mood: 1, bond: 1 },
    reason: '精力已经很满，不需要继续喂食。',
    text: '它已经很有精神了，先不用继续喂。'
  },
  fullEnergyRest: {
    actions: ['rest'],
    guard: 'soft',
    cue: '够精神',
    action: 'clean',
    delta: { mood: 1, bond: 1 },
    reason: '精力已经很饱满，短暂整理节奏就好。',
    text: '它精神不错，整理一下就能继续。'
  }
};
const TASK_VITAL_EVENTS = {
  add: {
    delta: { bond: 1 },
    reason: '你把目标写清楚了，它更知道怎么陪你。'
  },
  addScheduled: {
    delta: { mood: 1, bond: 1 },
    reason: '目标和时间都写清楚了，它会更稳地陪你盯着。'
  },
  reopen: {
    delta: { mood: -1 },
    reason: '任务恢复待办，它继续陪你盯着。'
  },
  prioritize: {
    delta: { mood: 1, bond: 1 },
    reason: '任务优先级更清楚，它更知道先陪你盯哪一步。',
    focus: 'bond',
    action: 'study'
  },
  delete: {
    relief: {
      delta: { mood: 2, energy: 1, bond: 1 },
      reason: '任务减负后，它没那么紧张，会继续看着屏幕守住第一项。',
      focus: 'energy',
      action: 'clean'
    },
    normal: {
      delta: { mood: 1, bond: 1 },
      reason: '清掉一项任务后，路线更清楚了。',
      focus: 'bond',
      action: 'clean'
    }
  },
  complete: {
    low: {
      delta: { mood: 4, energy: -1, bond: 2 },
      reason: '完成一项轻任务，它放松了一点。'
    },
    medium: {
      delta: { mood: 5, energy: -1, bond: 3 },
      reason: '完成一项任务，它明显更开心。'
    },
    high: {
      delta: { mood: 7, energy: -2, bond: 4 },
      reason: '完成高优先级任务，它更有成就感。'
    },
    allDoneBonus: {
      delta: { mood: 2, bond: 1 },
      reason: '今天的任务清单清空了，它安心贴近你。'
    }
  }
};
const TASK_COMPLETION_FEEDBACK_MS = 45000;
const TASK_REOPEN_FEEDBACK_MS = 45000;
const CHAT_VITAL_EVENTS = {
  open: {
    delta: { mood: 1, bond: 1 },
    reason: '打开聊天，它知道你在看消息。'
  },
  sendText: {
    delta: { mood: 1, energy: -1, bond: 2 },
    reason: '发出消息后，它安心陪你等回复。'
  },
  sendMedia: {
    delta: { mood: 1, energy: -2, bond: 2 },
    reason: '分享内容会更亲近，也会消耗一点精力。'
  },
  callAudio: {
    delta: { mood: 1, energy: -2, bond: 3 },
    reason: '语音通话更贴近好友，它会安心陪你接通，也会消耗一点精力。',
    action: 'call'
  },
  callVideo: {
    delta: { mood: 2, energy: -3, bond: 3 },
    reason: '视频通话更贴近好友，它会开心一点，也会多花精力陪你接通。',
    action: 'call'
  },
  activity: {
    delta: { mood: 1, energy: -1, bond: 2 },
    reason: '看到好友同步的屏幕状态，它更知道你们正在一起推进，也会分一点精力留意。',
    action: 'study'
  },
  receive: {
    delta: { mood: 2, bond: 1 },
    reason: '收到新消息，它会更愿意靠近你。'
  }
};
const CHAT_VITAL_COOLDOWN_MS = {
  open: 120000,
  sendText: 30000,
  sendMedia: 45000,
  callAudio: 60000,
  callVideo: 60000,
  activity: 60000,
  receive: 60000
};
const CHAT_VITAL_REPEAT_REASONS = {
  open: '刚刚已经看过消息，它会安静陪你等回复。',
  sendText: '消息刚刚同步过，它继续陪你等回复。',
  sendMedia: '内容刚刚同步过，它会继续留意回复。',
  callAudio: '语音通话刚刚同步过，它继续陪你守着联系。',
  callVideo: '视频通话刚刚同步过，它继续陪你守着联系。',
  activity: '好友屏幕状态刚刚同步过，它继续安静留意对方节奏。',
  receive: '新消息刚刚同步过，它会先安静陪你看。'
};
const VITAL_INSIGHT_COOLDOWN_MS = 30000;
const TOUCH_VITAL_COOLDOWN_MS = 20000;
const PETTING_GESTURE_MIN_TRAVEL = 52;
const PETTING_GESTURE_MIN_BACKTRACK_TRAVEL = 38;
const PETTING_GESTURE_MAX_DISPLACEMENT = 36;
const PETTING_WINDOW_DRAG_DISPLACEMENT = 24;
const PETTING_VISUAL_MS = 900;
const TOUCH_VITAL_EVENTS = {
  fragile: {
    delta: { mood: 1, energy: 2, bond: 1 },
    focus: 'energy',
    reason: '它现在有点脆弱，轻轻摸一下就好，先让精力缓过来。',
    text: '它状态很脆弱，靠过来一下就安静休息。',
    action: 'rest'
  },
  tired: {
    delta: { mood: 1, bond: 1 },
    focus: 'energy',
    reason: '它有点累，只适合轻轻摸一下。',
    text: '它有点累，轻轻靠过来。先让它休息一下。',
    action: 'rest'
  },
  down: {
    delta: { mood: 3, bond: 2 },
    focus: 'mood',
    reason: '低落时被安抚，心情慢慢回升。',
    text: '它被安抚到了，慢慢靠近你。',
    action: 'play'
  },
  guarded: {
    delta: { mood: 1, bond: 3 },
    focus: 'bond',
    reason: '关系还在试探，轻轻互动会更熟悉。',
    text: '它犹豫了一下，还是靠近了一点。',
    action: 'clean'
  },
  focused: {
    delta: { mood: 1, energy: -1, bond: 1 },
    reason: '专注时轻摸会鼓励它继续盯任务。',
    text: '它点点头，继续看着当前任务。',
    action: 'study'
  },
  bright: {
    delta: { mood: 2, bond: 1 },
    reason: '状态很好时摸摸会让它更开心。',
    text: '它开心地回应你，又贴近了一点。',
    action: 'play'
  },
  steady: {
    delta: { mood: 2, bond: 1 },
    reason: '被摸摸以后，它会更亲近你。',
    text: '被摸摸以后，它更愿意贴近你。',
    action: 'play'
  },
  repeat: {
    delta: {},
    reason: '它刚刚已经回应过你，先保持现在的节奏。',
    text: '它眨眨眼，先别太频繁戳它。',
    action: 'rest'
  }
};
const TASK_PRIORITY_RANK = { high: 3, medium: 2, low: 1 };
const TASK_ACTIVE_LIMIT = 8;
const TASK_BUSY_THRESHOLD = 5;
const TASK_OVERLOAD_VISIBLE_ROWS = 4;
const TASK_SURFACE_VITAL_COOLDOWN_MS = 120000;
const TASK_SURFACE_VITAL_EVENTS = {
  empty: {
    delta: { bond: 1 },
    reason: '打开空任务面板，它先安静等你写下一件事。'
  },
  clear: {
    delta: { mood: 3, bond: 2 },
    reason: '今天的任务都完成了，它放松地陪你复盘。'
  },
  normal: {
    delta: { mood: 1, energy: -1, bond: 1 },
    reason: '打开任务面板后，它会花一点精力看着当前任务，也会更信任你。'
  },
  busy: {
    delta: { energy: -1, bond: 1 },
    reason: '任务偏多，它会帮你盯紧第一项。'
  },
  overload: {
    delta: { mood: -2, energy: -1, bond: 1 },
    reason: '待办超过上限，它会有点紧张并守住第一项。'
  }
};
const TASK_SURFACE_REPEAT_REASONS = {
  empty: '任务面板刚刚同步过，它继续等你写下第一件事。',
  clear: '任务清单刚刚同步过，它继续陪你复盘。',
  normal: '当前任务刚刚同步过，它继续看着这一步。',
  busy: '偏多任务刚刚同步过，它继续守住第一项。',
  overload: '超限任务刚刚同步过，它继续紧盯第一项。'
};
const TASK_SURFACE_REPEAT_FOCUS = {
  empty: 'bond',
  clear: 'mood',
  normal: 'bond',
  busy: 'energy',
  overload: 'energy'
};
const REVIEW_VITAL_STORAGE_KEY = 'focusPetReviewVitals:v1';
const RTC_NETWORK_NOTICE_KEY = 'focusPetRtcNetworkNoticeAccepted:v1';
const REVIEW_VITAL_EVENTS = {
  focused: {
    delta: { mood: 4, energy: -2, bond: 3 },
    reason: '今天专注时间很稳，它很有安全感。',
    summary: '专注节奏不错'
  },
  balanced: {
    delta: { mood: 2, energy: -1, bond: 2 },
    reason: '今天有推进也有波动，它会继续陪你调节。',
    summary: '节奏有进展'
  },
  distracted: {
    delta: { mood: -3, energy: -1, bond: 1 },
    reason: '今天分心偏多，它有点担心但还会陪你调整。',
    summary: '需要减少分心'
  },
  quiet: {
    delta: { mood: -1 },
    reason: '今天记录还不够多，它先轻轻观察。',
    summary: '记录偏少'
  }
};
const REVIEW_VITAL_REPEAT_REASONS = {
  focused: '今天的复盘刚刚同步过，它继续按稳定节奏陪你。',
  balanced: '今天的复盘刚刚同步过，它继续陪你调整节奏。',
  distracted: '今天的复盘刚刚同步过，它先陪你把心情稳住。',
  quiet: '今天的复盘刚刚同步过，它继续轻轻观察。'
};
const REVIEW_VITAL_REPEAT_FOCUS = {
  focused: 'bond',
  balanced: 'bond',
  distracted: 'mood',
  quiet: 'mood'
};
const SETTINGS_VITAL_COOLDOWN_MS = 30000;
const SETTINGS_SURFACE_VITAL_COOLDOWN_MS = 120000;
const SETTINGS_SURFACE_VITAL_EVENT = {
  delta: { bond: 1 },
  reason: '打开设置面板，它更理解你想要怎样被陪伴。'
};
const SETTINGS_SURFACE_REPEAT_REASON = '设置面板刚刚同步过，它继续按这个节奏陪你。';
const SETTINGS_VITAL_EVENTS = {
  calm: {
    delta: { mood: 1, bond: 2 },
    reason: '你把陪伴调轻了，它会更安静地贴着节奏。',
    text: '我会轻一点陪你，不抢你的节奏。',
    action: 'rest'
  },
  normal: {
    delta: { mood: 1, bond: 1 },
    reason: '你把陪伴调回正常，它会按稳定节奏提醒。',
    text: '我会按正常节奏陪你，提醒不会太轻也不会太急。',
    action: 'clean'
  },
  active: {
    delta: { mood: 2, energy: -1, bond: 1 },
    reason: '你把陪伴调活跃了，它会更主动，也会多消耗一点精力。',
    text: '我会更主动提醒你，也会多花一点精力。',
    action: 'play'
  },
  saved: {
    delta: { bond: 1 },
    reason: '保存设置后，它更理解你的陪伴偏好。',
    text: '设置已保存，我会按这个节奏陪你。',
    action: 'clean'
  },
  repeat: {
    delta: {},
    reason: '设置刚刚已经同步过，先沿用当前节奏。',
    text: '设置已保存，当前节奏已经同步过了。',
    action: 'rest'
  }
};
const SETTINGS_VITAL_FOCUS = {
  calm: 'bond',
  normal: 'bond',
  active: 'mood',
  saved: 'bond',
  repeat: 'bond'
};
const PET_VITALS_STORAGE_KEY = 'focusPetVitals:v1';
const PET_OFFLINE_REST_MINUTES = 90;
const PET_OFFLINE_RECOVERY_CAP_HOURS = 10;
const CHAT_FILE_ACCEPT = 'image/*,video/*,audio/*,.pdf,.txt,.md,.csv,.json,.zip,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
const PET_GIF_FALLBACKS = [
  { key: 'tap-heart', label: '摸摸爱心', name: 'tap-heart.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/tap-heart.gif' },
  { key: 'feed-loop', label: '喂食补能量', name: 'feed-loop.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/feed-loop.gif' },
  { key: 'focus-mode', label: '一起专注', name: 'focus-mode.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/focus-mode.gif' },
  { key: 'play-dance', label: '开心跳舞', name: 'play-dance.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/play-dance.gif' },
  { key: 'rest-sleep', label: '安静休息', name: 'rest-sleep.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/rest-sleep.gif' },
  { key: 'celebrate-finish', label: '完成庆祝', name: 'celebrate-finish.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/celebrate-finish.gif' },
  { key: 'sparkle-happy', label: '开心闪光', name: 'sparkle-happy.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/sparkle-happy.gif' },
  { key: 'stretch-break', label: '伸展放松', name: 'stretch-break.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/stretch-break.gif' },
  { key: 'hydrate-water', label: '补水一下', name: 'hydrate-water.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/hydrate-water.gif' },
  { key: 'meditate-calm', label: '安静呼吸', name: 'meditate-calm.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/meditate-calm.gif' },
  { key: 'read-review', label: '复盘阅读', name: 'read-review.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/read-review.gif' },
  { key: 'cheer-success', label: '加油好棒', name: 'cheer-success.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/cheer-success.gif' },
  { key: 'morning-wave', label: '早安挥手', name: 'morning-wave.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/morning-wave.gif' },
  { key: 'hug-comfort', label: '抱抱安慰', name: 'hug-comfort.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/hug-comfort.gif' },
  { key: 'surprise-alert', label: '惊讶一下', name: 'surprise-alert.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/surprise-alert.gif' },
  { key: 'cry-sad', label: '哭哭低落', name: 'cry-sad.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/cry-sad.gif' },
  { key: 'angry-pout', label: '生气鼓脸', name: 'angry-pout.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/angry-pout.gif' },
  { key: 'busy-laptop', label: '忙碌工作', name: 'busy-laptop.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/busy-laptop.gif' },
  { key: 'ok-ready', label: 'OK 准备好', name: 'ok-ready.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/ok-ready.gif' },
  { key: 'love-miss', label: '想你爱心', name: 'love-miss.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/love-miss.gif' },
  { key: 'phone-call', label: '通话陪伴', name: 'phone-call.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/phone-call.gif' },
  { key: 'full-body-states-demo', label: '全身状态合集', name: 'full-body-states-demo.gif', sourceType: 'generated-image-pack', previewUrl: 'assets/pets/nervy-sci-fi-kid/gifs/full-body-states-demo.gif' }
];

let expanded = false;
let hoverDepth = 0;
let chatSocket;
let chatPingTimer;
let chatReconnectTimer;
let chatSocketEnabled = false;
let chatState = { source: 'cloud', signedIn: false, friends: [], messages: [], activities: {}, activityLog: [], self: { id: 'cloud-guest', name: '我', friendCode: '' }, authToken: '', websocketUrl: '', iceServers: [] };
let cloudChatConnectionStatus = 'idle';
let petGifItems = [];
let mediaMode = 'image';
let mediaRecorder;
let voiceChunks = [];
let voiceRecordingStartedAt = 0;
let voiceRecordingCancelRequested = false;
let voicePointerCancel = false;
let voiceShortcutActive = false;
let voiceShortcutKey = '';
let voiceShortcutStartToken = 0;
let chatPeerConnection;
let chatLocalStream;
let chatLocalStreamPromise;
let chatLocalStreamRequestMode = '';
let chatCallId = '';
let chatCallPeerId = '';
let pendingChatRtcAction = null;
let pendingChatRtcMode = 'audio';
let lastAutoPopupAt = 0;
let recentAutoPopupAt = [];
let dragState = null;
let pettingVisualTimer = null;
let petVitals = { mood: 80, energy: 70, bond: 50 };
let petVitalsDelta = { mood: 0, energy: 0, bond: 0 };
let petVitalsReason = '刚醒来，正在适应今天的节奏。';
let petVitalsMilestone = '';
let petVitalsMilestoneTone = 'neutral';
let petVitalsMilestoneKind = '';
let petVitalsFocus = '';
let petVitalsFocusSource = '';
let lastVitalsStatusAt = 0;
let lastVitalsStatusKey = '';
let lastChatVitalAt = {};
let lastChatVitalEventName = '';
let lastTaskSurfaceVitalAt = 0;
let lastTaskSurfaceVitalKey = '';
let lastTaskCompletionAt = 0;
let lastTaskCompletionText = '';
let lastTaskReopenAt = 0;
let lastTaskReopenText = '';
let lastTouchVitalAt = 0;
let lastVitalInsightAt = 0;
let lastVitalInsightKey = '';
let lastSettingsVitalAt = 0;
let lastSettingsVitalKey = '';
let lastSettingsSurfaceVitalAt = 0;
let lastCareActionAt = 0;
let lastCareActionName = '';
let lastCareObservation = { reason: '', impact: '', focus: '' };
let lastInteractionAt = Date.now();
let activeSurface = 'home';
let nudge = null;
let lastStatus = { status: 'unknown' };
let taskItems = [];
let taskEditMode = false;
let appSettings = {
  popupCooldownMinutes: 8,
  idleNudgeMinutes: 10,
  autoPopupEnabled: true,
  maxMediaMb: 25,
  voiceRecordShortcut: 'Alt+R',
  socialActivityShareLevel: 'presence',
  petBehaviorIntensity: 'normal',
  screenMonitorEnabled: false,
  screenMonitorIntervalSeconds: 45,
  llmCloudMode: 'allowed',
  screenMonitorProvider: 'stepfun',
  screenMonitorEndpoint: 'https://api.stepfun.com/v1',
  screenMonitorModel: 'step-3.7-flash',
  reviewLlmProvider: 'openai-compatible',
  reviewLlmEnabled: false,
  reviewLlmEndpoint: 'https://api.stepfun.com/step_plan/v1',
  reviewLlmModel: 'step-3.7-flash'
};
let updateCheckTimer = null;
let screenMonitorTimer = null;
let lastScreenMonitorAt = 0;
let currentPetAnimation = '';
let petAnimationFrame = 0;
let petAnimationTimer = null;
let petAnimationLocked = false;
let petActionTimer = null;
const ONBOARDING_MODE_KEY = 'focusPetOnboardingMode';
const PERMISSION_PROMPT_KEY = 'focusPetPermissionPrompted:v1';

function playPetAnimation(name, { locked = false } = {}) {
  const animationName = PET_ANIMATIONS[name] ? name : 'idle';
  const config = PET_ANIMATIONS[animationName];
  petAnimationLocked = locked;
  if (currentPetAnimation === animationName) return;
  currentPetAnimation = animationName;
  petAnimationFrame = 0;
  avatar.style.setProperty('--pet-x', '0px');
  avatar.style.setProperty('--pet-y', `${config.row * -208}px`);
  if (petAnimationTimer) clearInterval(petAnimationTimer);
  petAnimationTimer = setInterval(() => {
    petAnimationFrame = (petAnimationFrame + 1) % config.frames;
    avatar.style.setProperty('--pet-x', `${petAnimationFrame * -192}px`);
  }, config.frameMs);
}

function statusPetAnimation(status) {
  return STATUS_ANIMATIONS[status] || 'idle';
}

function vitalPetAnimation() {
  const vibe = petVibe();
  if (vibe === 'bright' && lastStatus.status === 'work') return null;
  return PET_VIBE_ANIMATIONS[vibe] || null;
}

function surfacePetAnimation() {
  if (!expanded) return null;
  if (activeSurface === 'tasks') return taskSurfacePetAnimation();
  return SURFACE_ANIMATIONS[activeSurface];
}

function syncPetAnimationToStatus() {
  if (petAnimationLocked) return;
  playPetAnimation(surfacePetAnimation() || vitalPetAnimation() || statusPetAnimation(lastStatus.status));
}

function setMood(status) {
  pet.classList.remove(...MOOD_CLASSES);
  pet.classList.add(`mood-${status || 'unknown'}`);
  pet.classList.toggle('compact', !expanded);
  pet.classList.toggle('expanded', expanded);
  syncPetAnimationToStatus();
}

function setActiveSurface(surface) {
  activeSurface = surface;
  if (surface !== 'chat') setPetGifTrayVisible(false);
  pet.dataset.surface = surface;
  syncTaskSurfaceState();
  updateAvatarA11y();
  Object.entries(surfaceButtons).forEach(([name, button]) => {
    button.setAttribute('aria-pressed', String(name === surface));
  });
  updateHomeActions();
  updatePetStats();
  syncPetAnimationToStatus();
}

function updateHomeActions() {
  homeActions.classList.toggle('hidden', !expanded || activeSurface !== 'home');
  updateHomeTaskAction();
  updateHomeChatAction();
  updateHomeCareAction();
}

function setHomeActionContent(button, label, meta = '') {
  const labelNode = document.createElement('span');
  labelNode.className = 'home-action-label';
  labelNode.textContent = label;
  const metaNode = document.createElement('small');
  metaNode.className = 'home-action-meta';
  metaNode.textContent = meta;
  metaNode.hidden = !meta;
  button.replaceChildren(labelNode, metaNode);
  button.dataset.label = label;
  button.dataset.meta = meta;
}

function taskHomeMetaText(load, task = currentTaskItem()) {
  const pendingCount = pendingTaskCount();
  if (load === 'empty') return '还没任务';
  if (load === 'clear') return '清单已清';
  if (load === 'overload') return `待办 ${pendingCount}/${TASK_ACTIVE_LIMIT}`;
  if (load === 'busy') return `待办 ${pendingCount}/${TASK_ACTIVE_LIMIT}`;
  return task ? '当前任务' : '任务面板';
}

function taskHomeTitleText(load, task = currentTaskItem()) {
  const pendingCount = pendingTaskCount();
  const overflowCount = Math.max(0, pendingCount - TASK_ACTIVE_LIMIT);
  if (load === 'empty') return '先写下一件最小任务，我来盯着。';
  if (load === 'clear') return '清单已完成，做个复盘收尾。';
  if (load === 'overload' && task) {
    return `待办超限，超出 ${overflowCount} 个；我会看着屏幕先守住「${shortTaskText(task)}」。`;
  }
  if (load === 'overload') return `待办超限，超出 ${overflowCount} 个；先减掉多余任务。`;
  if (load === 'busy' && task) return `任务偏多，我会看着屏幕先守住「${shortTaskText(task)}」。`;
  if (task) return `先推进「${shortTaskText(task)}」。`;
  return '打开今日任务';
}

function updateHomeTaskAction() {
  const load = taskLoadState();
  const task = currentTaskItem();
  const overflowCount = Math.max(0, pendingTaskCount() - TASK_ACTIVE_LIMIT);
  let text = '看任务';
  let action = 'tasks';

  if (load === 'empty') {
    text = '写任务';
  } else if (load === 'clear') {
    text = '复盘';
    action = 'review';
  } else if (load === 'overload') {
    text = '先减负';
  }

  const meta = taskHomeMetaText(load, task);
  const title = taskHomeTitleText(load, task);
  setHomeActionContent(focusNowButton, text, meta);
  focusNowButton.dataset.action = action;
  focusNowButton.dataset.taskLoad = load;
  focusNowButton.dataset.overflow = String(overflowCount);
  focusNowButton.dataset.taskTarget = task ? shortTaskText(task) : '';
  focusNowButton.title = title;
  focusNowButton.setAttribute('aria-label', title);
}

function shortFriendName(friend) {
  const name = String(friend?.name || '消息').trim() || '消息';
  return name.length > 6 ? `${name.slice(0, 6)}...` : name;
}

function updateHomeChatAction() {
  const friend = chatState.friends.find(item => item.id === friendSelect.value) || chatState.friends[0] || null;
  const unread = Math.max(0, Number(friend?.unread || 0));
  const status = friendStatusLabel(friend?.status);
  const title = friend ? `${friend.name}${status}，打开聊天` : '打开聊天';
  const text = friend
    ? unread ? `${shortFriendName(friend)} ${unread}` : shortFriendName(friend)
    : '消息';
  const meta = friend ? unread ? `${unread} 未读` : status : '暂无好友';

  setHomeActionContent(quickChatButton, text, meta);
  quickChatButton.dataset.status = friend?.status || '';
  quickChatButton.dataset.unread = unread > 0 ? 'true' : 'false';
  quickChatButton.title = title;
  quickChatButton.setAttribute('aria-label', title);
}

function homeCareMetaText(recommendation = careRecommendation()) {
  const reason = recommendation.reason || '状态稳定';
  const impact = homeCareImpactText(recommendation);
  const compactImpact = homeCareCompactImpactText(impact, reason);
  return impact ? `${reason} · ${compactImpact}` : reason;
}

function homeCareImpactText(recommendation = careRecommendation()) {
  if (recommendation.action === 'clean') return careMenuInsightImpactText(recommendation);
  if (['study', 'work'].includes(recommendation.action)) {
    const action = careActionEffect(recommendation.action);
    const focus = CARE_ACTION_FOCUS[action?.name] || CARE_ACTION_FOCUS[recommendation.action] || '';
    const impact = careGuidanceImpactText(action?.delta || {}, focus);
    return impact ? `预计${impact}` : '';
  }
  return careMenuStageInsightText(recommendation);
}

function homeCareCompactImpactText(impact = '', reason = '') {
  const primary = String(impact || '').replace(/^预计/, '').split('，')[0] || '';
  const stageMatch = primary.match(/^(心情|精力|亲密)(回到.+)$/);
  if (stageMatch && String(reason || '').startsWith(stageMatch[1])) return stageMatch[2];
  return primary;
}

function homeCareTitleText(recommendation = careRecommendation(), impact = homeCareImpactText(recommendation)) {
  const title = recommendation.title || '现在适合照料';
  const reason = recommendation.reason || '状态稳定';
  return `${title}：${reason}${impact ? `，${impact}` : ''}。打开照料菜单`;
}

function careCooldownReasonFromLastAction() {
  const label = CARE_ACTIONS[lastCareActionName]?.label || '照料';
  return `刚${label}过`;
}

function homeCareCooldownReasonText() {
  if (careActionCooldownActive() && lastCareObservation.reason) return lastCareObservation.reason;
  return careCooldownReasonFromLastAction();
}

function homeCareCooldownMetaText(impact = '') {
  const reason = homeCareCooldownReasonText();
  const observation = String(impact || '').replace(/^先观察/, '');
  if (!observation || observation === '心情、精力、亲密变化') return reason;
  return `${reason} · ${observation}`;
}

function derivedHomeCareCooldownImpactText() {
  const impact = careFeedbackImpactText(petVitalsDelta, petVitalsFocus);
  const primaryImpact = impact.split(' · ')[0];
  const focusedImpact = {
    心情回升: '先观察心情回升',
    精力回升: '先观察精力回升',
    亲密增加: '先观察亲密增加',
    心情会降: '先观察心情变化',
    会耗精力: '先观察精力变化',
    亲密会降: '先观察亲密变化'
  }[primaryImpact];
  if (petVitalsMilestone && (petVitalsMilestoneKind === petVitalsFocus || petVitalsMilestoneTone === 'warning')) {
    return `先观察${petVitalsMilestone}`;
  }
  return focusedImpact || (petVitalsMilestone ? `先观察${petVitalsMilestone}` : '先观察心情、精力、亲密变化');
}

function homeCareCooldownImpactText() {
  if (careActionCooldownActive() && lastCareObservation.impact) return lastCareObservation.impact;
  return derivedHomeCareCooldownImpactText();
}

function careCooldownRemainingSeconds(now = Date.now()) {
  const remainingMs = Math.max(0, lastCareActionAt + CARE_ACTION_REPEAT_COOLDOWN_MS - now);
  return Math.max(1, Math.ceil(remainingMs / 5000) * 5);
}

function careCooldownWaitText() {
  return `约${careCooldownRemainingSeconds()}秒`;
}

function homeCareCooldownTitleText(reason = homeCareCooldownReasonText(), impact = homeCareCooldownImpactText()) {
  const actionText = reason.replace(/^刚/, '刚刚');
  return `${actionText}，${impact}；${careCooldownWaitText()}后再继续。打开照料菜单`;
}

function careCooldownFocusText(impact = homeCareCooldownImpactText()) {
  if (impact.includes('心情')) return '心情';
  if (impact.includes('精力')) return '精力';
  if (impact.includes('亲密') || impact.includes('关系')) return '亲密';
  return '心情、精力和亲密';
}

function careCooldownObservationText(impact = homeCareCooldownImpactText()) {
  const observation = String(impact || '').replace(/^先观察/, '');
  return observation || `${careCooldownFocusText(impact)}变化`;
}

function careCooldownFocusKind(impact = homeCareCooldownImpactText(), fallback = lastCareObservation.focus || petVitalsFocus) {
  if (impact.includes('心情')) return 'mood';
  if (impact.includes('精力')) return 'energy';
  if (impact.includes('亲密') || impact.includes('关系')) return 'bond';
  return fallback || '';
}

function captureCareCooldownObservation() {
  const impact = derivedHomeCareCooldownImpactText();
  lastCareObservation = {
    reason: careCooldownReasonFromLastAction(),
    impact,
    focus: careCooldownFocusKind(impact, petVitalsFocus)
  };
}

function careCooldownGuardReason(impact = homeCareCooldownImpactText()) {
  return `照料还在观察期，${impact}；${careCooldownWaitText()}后再继续。`;
}

function careCooldownGuardText(impact = homeCareCooldownImpactText()) {
  return `还在观察${careCooldownObservationText(impact)}，${careCooldownWaitText()}后再继续照料。`;
}

function careCooldownMenuInsightText(reason = homeCareCooldownReasonText(), impact = homeCareCooldownImpactText()) {
  const focusText = careCooldownFocusText(impact);
  const verb = impact.includes('回升') || impact.includes('增加') || impact.includes('回到') ? '是否回升' : '是否稳住';
  return `它${reason}，先看${focusText}${verb}，${careCooldownWaitText()}后再继续照料。`;
}

function updateHomeCareAction() {
  if (careActionCooldownActive()) {
    const impact = homeCareCooldownImpactText();
    const reason = homeCareCooldownReasonText();
    const meta = homeCareCooldownMetaText(impact);
    setHomeActionContent(homeCareButton, '观察', meta);
    homeCareButton.dataset.action = 'cooldown';
    homeCareButton.dataset.reason = reason;
    homeCareButton.dataset.impact = impact;
    homeCareButton.title = homeCareCooldownTitleText(reason, impact);
    homeCareButton.setAttribute('aria-label', homeCareButton.title);
    return;
  }

  const recommendation = careRecommendation();
  const action = CARE_ACTIONS[recommendation.action];
  const impact = homeCareImpactText(recommendation);
  setHomeActionContent(homeCareButton, recommendation.label || action?.label || '照料', homeCareMetaText(recommendation));
  homeCareButton.dataset.action = recommendation.action || 'care';
  homeCareButton.dataset.reason = recommendation.reason || '';
  homeCareButton.dataset.impact = impact;
  homeCareButton.title = homeCareTitleText(recommendation, impact);
  homeCareButton.setAttribute('aria-label', homeCareButton.title);
}

function showNudge({ source, target, text, label = '!' }) {
  nudge = { source, target, text, label };
  pet.classList.add('has-nudge');
  pet.dataset.nudgeTarget = target || 'home';
  expandHint.textContent = label;
  expandHint.title = target === 'chat' ? '查看新消息' : target === 'care' ? '查看照料建议' : '查看提醒';
  expandHint.setAttribute('aria-label', expandHint.title);
  message.textContent = text;
}

function clearNudge(source) {
  if (source && nudge?.source !== source) return;
  nudge = null;
  pet.classList.remove('has-nudge');
  delete pet.dataset.nudgeTarget;
  expandHint.textContent = '!';
  expandHint.title = '查看提醒';
  expandHint.setAttribute('aria-label', '查看提醒');
}

function focusRecommendedCareAction() {
  const recommended = careActions.querySelector('.care-action.recommended');
  const firstAction = careActions.querySelector('.care-action');
  (recommended || firstAction)?.focus();
}

function setCareMenuVisible(visible, { restoreFocus = false, focusRecommended = false } = {}) {
  petMenu.classList.toggle('hidden', !visible);
  homeCareButton.setAttribute('aria-expanded', String(visible));
  if (visible && focusRecommended) focusRecommendedCareAction();
  if (!visible && restoreFocus) homeCareButton.focus();
}

async function handleNudgeAction() {
  const target = nudge?.target || (['distracted', 'game', 'unknown', 'permission'].includes(lastStatus.status) ? 'tasks' : 'home');
  const prompt = nudge?.text || '';
  clearNudge();
  if (target === 'chat') {
    await showChat();
    return;
  }
  if (target === 'tasks') {
    await showTasks();
    return;
  }
  if (target === 'settings') {
    await showSettings();
    return;
  }
  if (target === 'care') {
    await setExpanded(true);
    setActiveSurface('home');
    panel.classList.add('hidden');
    chatPanel.classList.add('hidden');
    renderCareMenu();
    setCareMenuVisible(true, { focusRecommended: true });
    if (prompt) message.textContent = prompt;
    return;
  }
  await setExpanded(true);
}

async function setExpanded(nextExpanded) {
  expanded = nextExpanded;
  pet.classList.toggle('compact', !expanded);
  pet.classList.toggle('expanded', expanded);
  if (!expanded) {
    panel.classList.add('hidden');
    chatPanel.classList.add('hidden');
    setPetGifTrayVisible(false);
    setCareMenuVisible(false);
    setActiveSurface('home');
  }
  updateHomeActions();
  await window.focusPet.setExpanded(expanded);
}

function enterInteractiveZone() {
  hoverDepth += 1;
  window.focusPet.setClickThrough(false);
}

function leaveInteractiveZone() {
  hoverDepth = Math.max(0, hoverDepth - 1);
  if (hoverDepth === 0 && !dragState) window.focusPet.setClickThrough(true);
}

function bindInteractiveZones() {
  document.querySelectorAll('.avatar, .bubble, .panel, .chat-panel, #expandHint, .pet-menu, .home-actions').forEach(element => {
    element.addEventListener('mouseenter', enterInteractiveZone);
    element.addEventListener('mouseleave', leaveInteractiveZone);
  });
}

function pointerNumber(event, key, fallback = 0) {
  const value = Number(event[key]);
  return Number.isFinite(value) ? value : fallback;
}

function avatarLocalPoint(event) {
  const rect = avatar.getBoundingClientRect();
  const fallbackX = rect.left + rect.width * 0.5;
  const fallbackY = rect.top + rect.height * 0.42;
  const clientX = pointerNumber(event, 'clientX', fallbackX);
  const clientY = pointerNumber(event, 'clientY', fallbackY);
  return {
    x: Math.max(16, Math.min(rect.width - 16, clientX - rect.left)),
    y: Math.max(18, Math.min(rect.height - 18, clientY - rect.top))
  };
}

function setPettingEffectPoint(event) {
  const point = avatarLocalPoint(event);
  avatar.style.setProperty('--petting-x', `${Math.round(point.x)}px`);
  avatar.style.setProperty('--petting-y', `${Math.round(point.y)}px`);
}

function createPettingGesture(event) {
  const x = pointerNumber(event, 'screenX');
  const y = pointerNumber(event, 'screenY');
  return {
    startX: x,
    startY: y,
    lastX: x,
    lastY: y,
    travel: 0,
    maxDisplacement: 0,
    lastDirectionX: 0,
    reversals: 0
  };
}

function updatePettingGesture(event) {
  if (!dragState?.petting) return null;
  const gesture = dragState.petting;
  const x = pointerNumber(event, 'screenX', gesture.lastX);
  const y = pointerNumber(event, 'screenY', gesture.lastY);
  const stepX = x - gesture.lastX;
  const stepY = y - gesture.lastY;
  const stepDistance = Math.hypot(stepX, stepY);
  if (stepDistance < 1) return gesture;

  const directionX = Math.sign(stepX);
  if (directionX && gesture.lastDirectionX && directionX !== gesture.lastDirectionX) {
    gesture.reversals += 1;
  }
  if (directionX) gesture.lastDirectionX = directionX;
  gesture.travel += stepDistance;
  gesture.maxDisplacement = Math.max(gesture.maxDisplacement, Math.hypot(x - gesture.startX, y - gesture.startY));
  gesture.lastX = x;
  gesture.lastY = y;
  setPettingEffectPoint(event);
  return gesture;
}

function isPettingGestureReady(gesture) {
  if (!gesture || gesture.maxDisplacement > PETTING_GESTURE_MAX_DISPLACEMENT) return false;
  return gesture.travel >= PETTING_GESTURE_MIN_TRAVEL
    || (gesture.reversals > 0 && gesture.travel >= PETTING_GESTURE_MIN_BACKTRACK_TRAVEL);
}

function shouldStartAvatarWindowDrag(dx, dy, gesture) {
  if (!gesture || dragState?.petted) return false;
  if (isPettingGestureReady(gesture)) return false;
  const displacement = Math.hypot(dx, dy);
  if (displacement < PETTING_WINDOW_DRAG_DISPLACEMENT) return false;
  return gesture.reversals === 0 || gesture.maxDisplacement > PETTING_GESTURE_MAX_DISPLACEMENT;
}

function showAvatarPetting(event) {
  setPettingEffectPoint(event);
  if (pettingVisualTimer) clearTimeout(pettingVisualTimer);
  pet.classList.remove('is-petting');
  void pet.offsetWidth;
  pet.classList.add('is-petting');
  pettingVisualTimer = setTimeout(() => {
    pet.classList.remove('is-petting');
    pettingVisualTimer = null;
  }, PETTING_VISUAL_MS);
}

function finishAvatarPetting(event) {
  if (!dragState || dragState.petted) return;
  dragState.petted = true;
  dragState.moved = true;
  showAvatarPetting(event);
  touchPet();
}

async function startAvatarDrag(event) {
  if (event.button !== 0) return;
  event.preventDefault();
  window.focusPet.setClickThrough(false);
  try {
    avatar.setPointerCapture(event.pointerId);
  } catch {}
  const [windowX, windowY] = await window.focusPet.getWindowPosition();
  dragState = {
    pointerId: event.pointerId,
    startScreenX: event.screenX,
    startScreenY: event.screenY,
    windowX,
    windowY,
    moved: false,
    draggingWindow: false,
    petted: false,
    petting: createPettingGesture(event)
  };
  setPettingEffectPoint(event);
}

function moveAvatarDrag(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  const dx = event.screenX - dragState.startScreenX;
  const dy = event.screenY - dragState.startScreenY;
  const gesture = updatePettingGesture(event);
  if (gesture && gesture.travel > 4) dragState.moved = true;
  if (dragState.petted) {
    setPettingEffectPoint(event);
    return;
  }
  if (!dragState.draggingWindow && isPettingGestureReady(gesture)) {
    finishAvatarPetting(event);
    return;
  }
  if (!dragState.draggingWindow && shouldStartAvatarWindowDrag(dx, dy, gesture)) {
    dragState.draggingWindow = true;
    dragState.moved = true;
  }
  if (dragState.draggingWindow) {
    if (Math.abs(dx) > 2) playPetAnimation(dx > 0 ? 'running-right' : 'running-left', { locked: true });
    window.focusPet.setWindowPosition(dragState.windowX + dx, dragState.windowY + dy);
  }
}

function endAvatarDrag(event) {
  if (!dragState || dragState.pointerId !== event.pointerId) return;
  const wasClick = event.type !== 'pointercancel' && !dragState.moved;
  const wasPetting = dragState.petted;
  try {
    avatar.releasePointerCapture(event.pointerId);
  } catch {}
  dragState = null;
  if (hoverDepth === 0) window.focusPet.setClickThrough(true);
  if (wasPetting) return;
  if (!wasClick) {
    petAnimationLocked = false;
    syncPetAnimationToStatus();
  }
  if (wasClick) activateAvatarInteraction({ allowCollapse: true });
}

function activateAvatarInteraction({ allowCollapse = false } = {}) {
  touchPet();
  if (!expanded && nudge) {
    handleNudgeAction();
    return;
  }
  if (allowCollapse) {
    setExpanded(!expanded);
    return;
  }
  if (!expanded) setExpanded(true);
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function loadStoredPetVitals() {
  try {
    const saved = JSON.parse(localStorage.getItem(PET_VITALS_STORAGE_KEY) || '{}');
    if (!saved || typeof saved !== 'object') return;
    setVitalFocus('');
    petVitals = {
      mood: clamp(saved.mood ?? petVitals.mood),
      energy: clamp(saved.energy ?? petVitals.energy),
      bond: clamp(saved.bond ?? petVitals.bond)
    };
    if (saved.reason) petVitalsReason = String(saved.reason).slice(0, 80);
    petVitalsDelta = normalizeVitalDelta(saved.lastDelta);
    petVitalsMilestone = saved.lastMilestone ? String(saved.lastMilestone).slice(0, 48) : '';
    petVitalsMilestoneTone = saved.lastMilestoneTone === 'warning' ? 'warning' : petVitalsMilestone ? 'positive' : 'neutral';
    petVitalsMilestoneKind = VITAL_LABELS[saved.lastMilestoneKind] ? saved.lastMilestoneKind : vitalMilestoneKind(petVitalsMilestone);
    const offlineEffect = offlineRestEffect(saved);
    if (offlineEffect) {
      applyPetVitalsDelta(offlineEffect.delta, offlineEffect.reason, {
        focus: 'energy',
        focusSource: 'offline'
      });
    }
  } catch {}
}

function savePetVitals() {
  try {
    localStorage.setItem(PET_VITALS_STORAGE_KEY, JSON.stringify({
      ...petVitals,
      reason: petVitalsReason,
      lastDelta: petVitalsDelta,
      lastMilestone: petVitalsMilestone,
      lastMilestoneTone: petVitalsMilestoneTone,
      lastMilestoneKind: petVitalsMilestoneKind,
      updatedAt: Date.now()
    }));
  } catch {}
}

function offlineRestEffect(saved, now = Date.now()) {
  const updatedAt = Number(saved.updatedAt || 0);
  if (!Number.isFinite(updatedAt) || updatedAt <= 0 || updatedAt > now) return null;

  const elapsedMinutes = (now - updatedAt) / 60000;
  if (elapsedMinutes < PET_OFFLINE_REST_MINUTES) return null;

  const rawHours = elapsedMinutes / 60;
  const recoveryHours = Math.min(PET_OFFLINE_RECOVERY_CAP_HOURS, rawHours);
  const delta = {
    mood: rawHours >= 6 ? 2 : 1,
    energy: Math.max(1, Math.round(recoveryHours * 3.6)),
    bond: rawHours >= 12 ? -2 : rawHours >= 6 ? -1 : 0
  };
  const reason = rawHours >= 6
    ? '你离开了一段时间，它休息后精力回来了，也有点想你。'
    : '你离开了一会儿，它趁机恢复了精力。';

  return { delta, reason, elapsedMinutes };
}

function vitalTone(value) {
  if (value < 30) return 'low';
  if (value < 62) return 'mid';
  return 'high';
}

function normalizeVitalDelta(delta = {}) {
  return {
    mood: Math.round(delta.mood || 0),
    energy: Math.round(delta.energy || 0),
    bond: Math.round(delta.bond || 0)
  };
}

function vitalDeltaText(delta) {
  const text = Object.entries(normalizeVitalDelta(delta))
    .filter(([, value]) => value)
    .map(([key, value]) => careDeltaLabel(key, value))
    .join(' ');
  return text || '状态稳定';
}

function vitalDeltaBadgeText(value = 0) {
  const normalized = Math.round(value || 0);
  if (!normalized) return '';
  return `${normalized > 0 ? '+' : ''}${normalized}`;
}

function vitalDeltaTone(delta) {
  const values = Object.values(normalizeVitalDelta(delta)).filter(Boolean);
  if (!values.length) return 'neutral';
  if (values.every(value => value > 0)) return 'positive';
  if (values.every(value => value < 0)) return 'negative';
  return 'mixed';
}

function stageFor(value, stages) {
  return [...stages].reverse().find(stage => value >= stage.min) || stages[0];
}

function stageIndex(stage, stages) {
  return Math.max(0, stages.findIndex(item => item.key === stage.key));
}

function stageAdvance(previousValue, nextValue, stages) {
  const previous = stageFor(previousValue, stages);
  const next = stageFor(nextValue, stages);
  return stageIndex(next, stages) > stageIndex(previous, stages) ? { previous, next } : null;
}

function stageDrop(previousValue, nextValue, stages) {
  const previous = stageFor(previousValue, stages);
  const next = stageFor(nextValue, stages);
  return stageIndex(next, stages) < stageIndex(previous, stages) ? { previous, next } : null;
}

function moodStage() {
  return stageFor(petVitals.mood, MOOD_STAGES);
}

function energyStage() {
  return stageFor(petVitals.energy, ENERGY_STAGES);
}

function bondStage() {
  return stageFor(petVitals.bond, BOND_STAGES);
}

function vitalProgress(kind) {
  const config = {
    mood: { label: '心情', value: petVitals.mood, stages: MOOD_STAGES },
    energy: { label: '精力', value: petVitals.energy, stages: ENERGY_STAGES },
    bond: { label: '亲密', value: petVitals.bond, stages: BOND_STAGES }
  }[kind];
  if (!config) return null;

  const stage = stageFor(config.value, config.stages);
  return {
    kind,
    label: config.label,
    value: config.value,
    stage,
    remaining: stage.next ? Math.max(0, stage.next - config.value) : 0
  };
}

function setVitalFocus(kind, source = '') {
  petVitalsFocus = VITAL_LABELS[kind] ? kind : '';
  petVitalsFocusSource = petVitalsFocus ? source : '';
}

function vitalFocusFromDelta(delta = {}, fallback = '') {
  const fallbackKind = VITAL_LABELS[fallback] ? fallback : '';
  const ranked = VITAL_KEYS
    .map((kind, index) => ({
      kind,
      index,
      value: Math.abs(Math.round(delta[kind] || 0)),
      preferred: kind === fallbackKind ? 1 : 0
    }))
    .filter(item => item.value > 0)
    .sort((a, b) => (
      b.value - a.value
      || b.preferred - a.preferred
      || a.index - b.index
    ));
  return ranked[0]?.kind || fallbackKind;
}

function petVitalsSourceKey() {
  if (petVitalsFocusSource && petVitalsFocusSource !== 'auto') return petVitalsFocusSource;
  if (!petVitalsFocusSource && activeSurface === 'tasks' && taskLoadState() === 'overload') return 'tasks';
  if (!petVitalsFocusSource && !vitalDeltaText(petVitalsDelta).includes('+') && !vitalDeltaText(petVitalsDelta).includes('-')) return '';
  if (activeSurface === 'tasks') return 'tasks';
  if (activeSurface === 'review') return 'review';
  if (activeSurface === 'settings') return 'settings';
  if (lastStatus.status && lastStatus.status !== 'unknown') return 'focus';
  return '';
}

function petVitalsSourceLabel(sourceKey = petVitalsSourceKey()) {
  return {
    care: '照料',
    touch: '摸摸',
    inspect: '查看',
    tasks: '任务',
    chat: '聊天',
    review: '复盘',
    settings: '设置',
    offline: '离开',
    focus: '专注'
  }[sourceKey] || '';
}

function taskVitalsSourceDetail() {
  if (taskCompletionFeedbackActive()) return { text: '完成', title: '刚完成任务' };
  if (taskReopenFeedbackActive()) return { text: '恢复', title: '恢复待办' };

  const load = taskLoadState();
  if (load === 'overload') return { text: '超限', title: '待办超限' };
  if (load === 'busy') return { text: '偏多', title: '待办偏多' };
  if (load === 'clear') return { text: '清空', title: '清单已完成' };
  if (load === 'empty') return { text: '空白', title: '还没写任务' };
  if (currentTaskItem()) return { text: '盯屏', title: '正在看着屏幕任务' };
  return null;
}

function petVitalsSourceDetail(sourceKey = petVitalsSourceKey()) {
  if (sourceKey === 'care') {
    const label = CARE_ACTIONS[lastCareActionName]?.label || '照料';
    return { text: label, title: label };
  }
  if (sourceKey === 'tasks') return taskVitalsSourceDetail();
  if (sourceKey === 'inspect') {
    const label = VITAL_LABELS[petVitalsFocus] || '状态';
    return { text: label, title: `查看${label}` };
  }
  if (sourceKey === 'chat') return chatVitalsSourceDetail();
  return {
    touch: { text: '互动', title: '摸摸互动' },
    review: { text: '今日', title: '今日复盘' },
    settings: { text: '同步', title: '设置同步' },
    offline: { text: '恢复', title: '离开后恢复' },
    focus: { text: '屏幕', title: '屏幕专注' }
  }[sourceKey] || null;
}

function chatVitalsSourceDetail() {
  if (lastChatVitalEventName === 'activity') return { text: '屏幕同步', title: '好友屏幕状态同步' };
  if (lastChatVitalEventName === 'receive') return { text: '新消息', title: '收到好友消息' };
  if (lastChatVitalEventName === 'sendText' || lastChatVitalEventName === 'open') return { text: '消息', title: '聊天消息' };
  return { text: '语音视频', title: '语音或视频聊天' };
}

function petVitalsSourceText(sourceKey = petVitalsSourceKey()) {
  const label = petVitalsSourceLabel(sourceKey);
  if (!label) return '';
  const detail = petVitalsSourceDetail(sourceKey)?.text || '';
  if (!detail) return label;
  if (sourceKey === 'tasks' && detail === '超限') return '任务·超限';
  if (sourceKey === 'care') return `照料·${detail}`;
  return `${label}·${detail}`;
}

function petVitalsSourceTitle(sourceKey = petVitalsSourceKey()) {
  const label = petVitalsSourceLabel(sourceKey);
  if (!label) return '';
  const detail = petVitalsSourceDetail(sourceKey)?.title || '';
  if (sourceKey === 'tasks' && detail === '待办超限') return '状态来源：任务 · 待办超限';
  return detail ? `状态来源：${label} · ${detail}` : `状态来源：${label}`;
}

function vitalProgressShortText(progress) {
  return vitalProgressFeelingText(progress);
}

function vitalProgressFeelingText(progress) {
  if (!progress) return '';
  if (!progress.stage.next) {
    return {
      mood: progress.stage.key === 'bright' ? '心情高涨，先轻互动稳住节奏' : '心情很稳',
      energy: '精力很足',
      bond: '默契很稳'
    }[progress.kind] || `${progress.label}${progress.stage.label}`;
  }

  if (progress.kind === 'mood') {
    if (progress.stage.key === 'low') return progress.remaining <= 2 ? '心情快回稳了' : '心情还低，需要轻一点陪伴';
    if (progress.stage.key === 'steady') return '心情平稳，继续轻松互动';
    return '心情不错，轻轻稳住节奏';
  }
  if (progress.kind === 'energy') {
    if (progress.stage.key === 'tired') return progress.remaining <= 8 ? '精力快缓过来了' : '精力已经见底';
    if (progress.stage.key === 'low') return '精力偏低，先补一点';
    return '精力够用，别透支';
  }
  if (progress.kind === 'bond') {
    if (progress.stage.key === 'new') return '关系还在试探，先轻互动';
    if (progress.stage.key === 'familiar') return '关系正在变熟';
    return '关系已经亲近，继续靠近默契';
  }
  return `${progress.label}${progress.stage.label}`;
}

function readyEnergyTaskRiskActive() {
  const task = currentTaskItem();
  const work = careActionEffect('work');
  return Boolean(task && energyStage().key === 'ready' && vitalStageDropImpactText('energy', work?.delta || {}));
}

function fullEnergyTaskActive() {
  const task = currentTaskItem();
  return Boolean(task && energyStage().key === 'full');
}

function happyMoodTaskActive() {
  const task = currentTaskItem();
  const stage = moodStage().key;
  return Boolean(task && petVitals.energy > 35 && (stage === 'happy' || stage === 'bright'));
}

function closeBondTaskActive() {
  const task = currentTaskItem();
  const stage = bondStage().key;
  return Boolean(task && petVitals.energy > 35 && (stage === 'close' || stage === 'trusted'));
}

function trustedBondCompanionActive() {
  return petVitalsFocusSource === 'inspect'
    && petVitalsFocus === 'bond'
    && bondStage().key === 'trusted'
    && !closeBondTaskActive();
}

function newBondReassureActive() {
  return petVitalsFocusSource === 'inspect'
    && petVitalsFocus === 'bond'
    && bondStage().key === 'new';
}

function touchNewBondReassureActive() {
  return petVitalsFocusSource === 'touch'
    && !touchRepeatFeedbackActive()
    && petVitalsFocus === 'bond'
    && bondStage().key === 'new';
}

function lowMoodReassureActive() {
  return petVitalsFocusSource === 'inspect'
    && petVitalsFocus === 'mood'
    && moodStage().key === 'low';
}

function vitalChipActionLabel(kind, progress = vitalProgress(kind)) {
  const stage = progress?.stage?.key || '';
  if (kind === 'mood') {
    if (stage === 'low') return '玩耍';
    if ((stage === 'happy' || stage === 'bright') && happyMoodTaskActive()) return '打工';
    if (stage === 'happy') return '玩耍';
    return '';
  }
  if (kind === 'energy') {
    if (stage === 'tired') return '休息';
    if (stage === 'low') return '喂食';
    if (stage === 'ready' && readyEnergyTaskRiskActive()) return '打工';
    if (stage === 'ready') return '喂食';
    if (stage === 'full' && fullEnergyTaskActive()) return '打工';
    if (stage === 'full') return '学习';
    return '';
  }
  if (kind === 'bond') {
    if (stage === 'new' || stage === 'familiar') return '轻互动';
    if ((stage === 'close' || stage === 'trusted') && closeBondTaskActive()) return '打工';
    if (stage === 'close') return '轻互动';
    if (stage === 'trusted') return '陪伴';
  }
  return '';
}

function vitalChipText(progress, needState = 'stable', focused = false) {
  if (!progress) return '';
  const base = `${progress.label}${progress.stage.label}`;
  const action = needState !== 'stable' || focused ? vitalChipActionLabel(progress.kind, progress) : '';
  return action ? `${base} · ${action}` : base;
}

function vitalChipActionHint(kind, progress = vitalProgress(kind)) {
  const stage = progress?.stage?.key || '';
  if (kind === 'mood') {
    if (stage === 'low') return '点一下，我先陪它缓一下心情。';
    if ((stage === 'happy' || stage === 'bright') && happyMoodTaskActive()) return '点一下，我会让它趁状态推进当前任务。';
    if (stage === 'happy') return '点一下，我会陪它轻松玩一下。';
    if (stage === 'steady') return '点一下，我会帮它稳住轻松节奏。';
    if (stage === 'bright') return '点一下，我会用轻互动稳住节奏。';
    return '点一下，我会帮它守住好心情。';
  }
  if (kind === 'energy') {
    if (stage === 'tired') return '点一下，我会让它先休息。';
    if (stage === 'low') return '点一下，我会先帮它补一点精力。';
    if (stage === 'ready' && readyEnergyTaskRiskActive()) return '点一下，我会帮它守住当前任务但不透支。';
    if (stage === 'ready') return '点一下，我会先补一点精力再进入专注。';
    if (stage === 'full' && fullEnergyTaskActive()) return '点一下，我会让它趁精力饱满推进当前任务。';
    return '点一下，我会安排不透支的节奏。';
  }
  if (kind === 'bond') {
    if (stage === 'new') return '点一下，我会先打个招呼，让它安心靠近。';
    if (stage === 'familiar') return '点一下，我会增加一点安全感。';
    if ((stage === 'close' || stage === 'trusted') && closeBondTaskActive()) return '点一下，我会让它陪你推进当前任务。';
    if (stage === 'close') return '点一下，我会轻互动保持亲近。';
    if (stage === 'trusted') return '点一下，我会安静陪它保持默契。';
    return '点一下，我会陪它保持默契。';
  }
  return '点一下，我会查看状态。';
}

function vitalChipTitle(baseHint, kind, progress = vitalProgress(kind)) {
  const hint = String(baseHint || '').trim();
  const prefix = hint ? `${hint}${/[。.!！]$/.test(hint) ? '' : '。'}` : '';
  return `${prefix}${vitalChipActionHint(kind, progress)}`;
}

function vitalTargetBadgeText(progress) {
  if (!progress?.stage.next || progress.remaining <= 0) return '';
  return `差${progress.remaining}`;
}

function vitalNearNextStageText(kind, maxRemaining = 8) {
  const progress = vitalProgress(kind);
  if (!progress?.stage.nextLabel || progress.remaining <= 0 || progress.remaining > maxRemaining) return '';
  return `差${progress.remaining}到${progress.stage.nextLabel}`;
}

function bondStageText(stage = bondStage()) {
  return vitalProgressFeelingText(vitalProgress('bond')) || `关系${stage.label}`;
}

function vitalNeedContext() {
  const needOrder = vitalNeedOrder();
  const progressItems = needOrder
    .map(kind => vitalProgress(kind))
    .filter(Boolean);
  const compound = compoundVitalState();
  const visibleProgressItems = compound.fragile
    ? progressItems.slice(0, 2)
    : progressItems.slice(0, 1);

  return {
    needOrder,
    progressItems,
    compound,
    visibleKinds: visibleProgressItems.map(item => item.kind)
  };
}

function vitalNeedText(context = vitalNeedContext()) {
  const { progressItems, compound } = context;
  if (compound.fragile) {
    const lowTexts = progressItems
      .slice(0, 2)
      .map(vitalProgressShortText);
    return `先稳住：${lowTexts.join('，')}`;
  }

  const nextProgress = progressItems[0];
  if (!nextProgress) return '状态高位：适合轻复盘';
  return `下一步先照顾${nextProgress.label}，${vitalProgressFeelingText(nextProgress)}`;
}

function homeNextStepFeedbackText(nextStep = petNextStep()) {
  if (activeSurface !== 'home' || petVitalsFocusSource || nextStep.kind !== 'care') return '';
  if (!['study', 'work'].includes(nextStep.action)) return '';
  const preview = careGuidancePreviewDisplayText(nextStep, careGuidancePreviewText(nextStep));
  const actionText = nextStep.action === 'work' ? '盯当前任务' : '一起学习';
  return preview ? `下一步${actionText}：${preview}` : `下一步${actionText}`;
}

function chatFeedbackLeadText() {
  if (petVitalsFocusSource !== 'chat') return '';
  const friend = friendName(selectedChatFriendId());
  const status = chatCallStatus?.textContent || '';
  if (lastChatVitalEventName === 'sendText') return `消息已发出，它在旁边等${friend}回复`;
  if (lastChatVitalEventName === 'sendMedia') return `内容已发出，它在旁边等${friend}回复`;
  if (lastChatVitalEventName === 'callAudio') {
    return status.includes('来电') ? '语音来电接通中，它陪你稳住这次联系' : '语音邀请发出，它陪你守着这次联系';
  }
  if (lastChatVitalEventName === 'callVideo') {
    return status.includes('来电') ? '视频来电接通中，它陪你稳住这次联系' : '视频邀请发出，它陪你守着这次联系';
  }
  if (lastChatVitalEventName === 'activity') return `${friend}同步了屏幕状态，它在旁边帮你留意`;
  if (lastChatVitalEventName === 'receive') return `收到${friend}的新消息，它安静陪你看`;
  if (lastChatVitalEventName === 'open') return '打开聊天，它安静等消息';
  return '';
}

function focusedVitalFeedbackLeadText() {
  if (touchNewBondReassureActive()) return '它愿意靠近一点，先轻轻互动让它安心';
  if (petVitalsFocusSource !== 'inspect') return '';
  if (lowMoodReassureActive()) return '心情低落，先陪它缓一缓';
  if (petVitalsFocus === 'mood' && happyMoodTaskActive()) return `${VITAL_LABELS.mood}${moodStage().label}，适合推进当前任务`;
  if (petVitalsFocus === 'mood' && moodStage().key === 'bright') return '心情高涨，先轻互动稳住节奏';
  if (petVitalsFocus === 'mood' && moodStage().key === 'happy') return '心情愉快，先轻松玩一下';
  if (petVitalsFocus === 'mood' && moodStage().key === 'steady') return '心情平稳，先轻松稳住节奏';
  if (petVitalsFocus === 'energy' && fullEnergyTaskActive()) return '精力饱满，适合推进当前任务';
  if (petVitalsFocus === 'energy' && readyEnergyTaskRiskActive()) return '精力够用，当前任务会降到低电';
  if (petVitalsFocus === 'energy' && energyStage().key === 'tired') return '精力疲惫，先休息恢复';
  if (petVitalsFocus === 'energy' && energyStage().key === 'ready') return '精力充足，先补一点再进入专注';
  if (petVitalsFocus === 'energy' && energyStage().key === 'low') return '精力低电，先补一点能量';
  if (petVitalsFocus === 'bond' && closeBondTaskActive()) return `${VITAL_LABELS.bond}${bondStage().label}，可以一起守住当前任务`;
  if (newBondReassureActive()) return '关系还在试探，先打个招呼让它安心';
  if (petVitalsFocus === 'bond' && bondStage().key === 'close') return '亲密亲近，先轻互动保持默契';
  if (trustedBondCompanionActive()) return '亲密默契，先按你的节奏陪伴';
  return '';
}

function feedbackRelationshipText(stage = bondStage(), context = vitalNeedContext(), milestoneKind = petVitalsMilestoneKind) {
  if (petVitalsFocusSource === 'inspect' && (petVitalsFocus === 'mood' || petVitalsFocus === 'bond' || petVitalsFocus === 'energy')) return '';
  if (context.visibleKinds?.includes('bond') || milestoneKind === 'bond') return '';
  return bondStageText(stage);
}

function feedbackReasonText(reason = petVitalsReason) {
  return String(reason || '').trim().replace(/[。.!！]+$/, '');
}

function petFeedbackText(stage = bondStage(), context = vitalNeedContext(), nextStep = petNextStep()) {
  const leadText = taskFeedbackLeadText() || focusedVitalFeedbackLeadText() || chatFeedbackLeadText() || homeNextStepFeedbackText(nextStep) || vitalNeedText(context);
  const recentReason = feedbackReasonText();
  const parts = [
    leadText
  ];
  if (recentReason && recentReason !== leadText) parts.push(`最近：${recentReason}`);
  if (petVitalsMilestone) parts.push(petVitalsMilestone);
  const relationshipText = feedbackRelationshipText(stage, context);
  if (relationshipText) parts.push(relationshipText);
  return parts.join(' · ');
}

function compactCareRecentText() {
  const text = recentFeedbackBadgeText()
    || String(petVitalsReason || '').trim().replace(/[。.!！]$/, '');
  if (!text) return '';
  return text.length > 12 ? `${text.slice(0, 12)}...` : text;
}

function recentFeedbackBadgeText() {
  if (petVitalsFocusSource === 'care') return careRecentFeedbackBadgeText();
  if (petVitalsMilestone) return petVitalsMilestone;
  if (activeSurface === 'tasks') return '任务同步';
  if (activeSurface === 'review') return '复盘同步';
  if (activeSurface === 'settings') return '设置同步';
  if (petVitalsFocusSource === 'offline') return '离开恢复';
  if (petVitalsFocusSource === 'inspect') {
    if (petVitalsFocus === 'mood') {
      if (happyMoodTaskActive()) return '刚顺状态';
      return moodStage().key === 'low' ? '刚安抚心情' : '刚看心情';
    }
    return {
      energy: '刚看精力',
      bond: '刚看亲密'
    }[petVitalsFocus] || '刚看状态';
  }
  if (petVitalsFocusSource === 'touch') return '刚互动';
  if (petVitalsFocusSource === 'chat') return '消息同步';
  return '';
}

function careRecentFeedbackBadgeText() {
  const label = CARE_ACTIONS[lastCareActionName]?.label || '照料';
  return `刚${label}${careRepeatFeedbackActive() ? '过' : ''}`;
}

function vitalNeedOrder() {
  const compound = compoundVitalState();
  const kinds = compound.fragile ? compound.lowKeys : ['energy', 'mood', 'bond'];
  return kinds
    .map(kind => vitalProgress(kind))
    .filter(item => item?.stage.next)
    .sort((a, b) => {
      const toneWeight = { low: 0, mid: 1, high: 2 };
      const toneDiff = (toneWeight[vitalTone(a.value)] ?? 1) - (toneWeight[vitalTone(b.value)] ?? 1);
      if (toneDiff) return toneDiff;
      return a.value - b.value;
    })
    .map(item => item.kind);
}

function vitalRowHint(kind) {
  const progress = vitalProgress(kind);
  if (!progress) return '';
  const delta = vitalDeltaBadgeText(petVitalsDelta[kind]);
  const deltaText = delta ? `，本次${delta}` : '';
  if (!progress.stage.next) return `${progress.label}${progress.stage.label}，当前 ${progress.value}${deltaText}，已经很稳定。`;
  return `${progress.label}${progress.stage.label}，当前 ${progress.value}${deltaText}，再提升 ${progress.remaining} 到${progress.stage.nextLabel}。`;
}

function vitalAccessibleHint(hint, needState, focused) {
  if (focused) return `刚刚回应：${hint}`;
  if (needState === 'primary') return `当前优先关注：${hint}`;
  if (needState === 'support') return `也需要留意：${hint}`;
  return hint;
}

function vitalStageMilestoneInfo(previousVitals, nextVitals) {
  const bondAdvance = stageAdvance(previousVitals.bond, nextVitals.bond, BOND_STAGES);
  if (bondAdvance) {
    return { text: `关系更${bondAdvance.next.label}了`, tone: 'positive', kind: 'bond' };
  }

  const energyAdvance = stageAdvance(previousVitals.energy, nextVitals.energy, ENERGY_STAGES);
  if (energyAdvance) {
    return { text: `精力回到${energyAdvance.next.label}`, tone: 'positive', kind: 'energy' };
  }

  const moodAdvance = stageAdvance(previousVitals.mood, nextVitals.mood, MOOD_STAGES);
  if (moodAdvance) {
    return { text: `心情回到${moodAdvance.next.label}`, tone: 'positive', kind: 'mood' };
  }

  const energyDrop = stageDrop(previousVitals.energy, nextVitals.energy, ENERGY_STAGES);
  if (energyDrop) {
    return { text: `精力降到${energyDrop.next.label}`, tone: 'warning', kind: 'energy' };
  }

  const moodDrop = stageDrop(previousVitals.mood, nextVitals.mood, MOOD_STAGES);
  if (moodDrop) {
    return { text: `心情降到${moodDrop.next.label}`, tone: 'warning', kind: 'mood' };
  }

  const bondDrop = stageDrop(previousVitals.bond, nextVitals.bond, BOND_STAGES);
  if (bondDrop) {
    return { text: `关系退到${bondDrop.next.label}`, tone: 'warning', kind: 'bond' };
  }

  return { text: '', tone: 'neutral', kind: '' };
}

function vitalStageMilestone(previousVitals, nextVitals) {
  return vitalStageMilestoneInfo(previousVitals, nextVitals).text;
}

function vitalMilestoneKind(text = '') {
  const normalized = String(text || '').trim();
  if (normalized.startsWith('关系')) return 'bond';
  if (normalized.startsWith('精力')) return 'energy';
  if (normalized.startsWith('心情')) return 'mood';
  return '';
}

function setVitalBar(bar, value, delta = 0) {
  bar.style.width = `${value}%`;
  bar.parentElement.dataset.tone = vitalTone(value);
  const row = bar.closest('.vital-row');
  const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  if (row) row.dataset.trend = trend;
  const badge = row?.querySelector('.vital-delta');
  if (!badge) return;
  const label = vitalDeltaBadgeText(delta);
  badge.hidden = !label;
  badge.textContent = label;
  badge.dataset.trend = trend;
}

function compoundVitalState() {
  const lowKeys = [
    petVitals.energy < 30 && 'energy',
    petVitals.mood < 35 && 'mood',
    petVitals.bond < 40 && 'bond'
  ].filter(Boolean);
  return {
    fragile: lowKeys.length >= 2,
    lowKeys
  };
}

function compoundCareAction() {
  const compound = compoundVitalState();
  if (!compound.fragile) return '';
  if (compound.lowKeys.includes('energy') && petVitals.energy < 30) return 'rest';
  if (compound.lowKeys.includes('mood')) return 'play';
  if (compound.lowKeys.includes('bond')) return 'clean';
  return 'rest';
}

function familiarBondCareActive(task = currentTaskItem()) {
  return activeSurface === 'home'
    && !task
    && bondStage().key === 'familiar'
    && petVitals.mood >= 35
    && petVitals.energy >= 58;
}

function petVibe() {
  if (compoundVitalState().fragile) return 'fragile';
  if (petVitals.energy < 25) return 'tired';
  if (petVitals.mood < 30) return 'down';
  if (petVitals.bond < 35) return 'guarded';
  if (activeSurface === 'tasks' && currentTaskItem()) return 'focused';
  if (petVitals.mood > 78 && petVitals.energy > 60 && petVitals.bond > 65) return 'bright';
  return 'steady';
}

function careRecommendation() {
  const compoundAction = compoundCareAction();
  if (compoundAction === 'rest') return { action: 'rest', title: '现在适合缓一缓', reason: '多项状态偏低' };
  if (compoundAction === 'play') return { action: 'play', title: '现在适合轻松一下', reason: '心情还低' };
  if (compoundAction === 'clean') return { action: 'clean', title: '现在适合轻互动', reason: '亲密还低' };
  const task = currentTaskItem();
  if (petVitals.energy < 30) return { action: 'rest', title: '现在适合休息', reason: '精力偏低' };
  if (petVitals.mood < 35) return { action: 'play', title: '现在适合玩耍', reason: '心情偏低' };
  if (petVitals.bond < 40) return { action: 'clean', title: '现在适合轻互动', reason: '亲密偏低' };
  const focusedAction = focusedVitalCareAction();
  if (focusedAction) return {
    action: focusedAction,
    label: focusedVitalCareLabel(focusedAction),
    title: `现在适合${focusedVitalCareLabel(focusedAction)}`,
    reason: focusedVitalReasonText() || `回应${VITAL_LABELS[petVitalsFocus]}`,
    badge: focusedVitalReasonBadgeText() || `回应${VITAL_LABELS[petVitalsFocus]}`
  };
  if (familiarBondCareActive(task)) return { action: 'clean', title: '现在适合轻互动', reason: '亲密正在变熟' };
  if (task && petVitals.energy > 35) return { action: 'work', title: '现在适合打工', reason: '盯当前任务' };
  if (petVitals.energy < 58) return { action: 'feed', title: '现在适合喂食', reason: '补足精力' };
  return { action: 'study', title: '现在适合学习', reason: '稳定陪伴' };
}

function focusedVitalCareAction() {
  if (petVitalsFocusSource !== 'inspect') return '';
  if (petVitalsFocus === 'mood') {
    if (happyMoodTaskActive()) return 'work';
    if (moodStage().key === 'bright') return 'clean';
    return 'play';
  }
  if (petVitalsFocus === 'bond') {
    if (closeBondTaskActive()) return 'work';
    return 'clean';
  }
  if (petVitalsFocus === 'energy') {
    if (energyStage().key === 'tired') return 'rest';
    if (readyEnergyTaskRiskActive()) return 'work';
    if (fullEnergyTaskActive()) return 'work';
    if (energyStage().key === 'full') return 'study';
    return 'feed';
  }
  return '';
}

function focusedVitalSummary() {
  if (petVitalsFocusSource !== 'inspect') return '';
  if (lowMoodReassureActive()) return '刚看过心情，先陪它缓一缓';
  if (petVitalsFocus === 'mood' && happyMoodTaskActive()) return '刚看过心情，趁状态做任务';
  if (petVitalsFocus === 'mood' && moodStage().key === 'bright') return '刚看过心情，收住高涨节奏';
  if (petVitalsFocus === 'mood' && moodStage().key === 'happy') return '刚看过心情，轻松稳住';
  if (petVitalsFocus === 'mood' && moodStage().key === 'steady') return '刚看过心情，稳住节奏';
  if (petVitalsFocus === 'energy' && fullEnergyTaskActive()) return '刚看过精力，趁饱满做任务';
  if (petVitalsFocus === 'energy' && readyEnergyTaskRiskActive()) return '刚看过精力，别透支任务';
  if (petVitalsFocus === 'energy' && energyStage().key === 'tired') return '刚看过精力，先休息恢复';
  if (petVitalsFocus === 'energy' && energyStage().key === 'ready') return '刚看过精力，补足再专注';
  if (petVitalsFocus === 'energy' && energyStage().key === 'low') return '刚看过精力，先补能量';
  if (petVitalsFocus === 'bond' && closeBondTaskActive()) return '刚看过亲密，一起做任务';
  if (newBondReassureActive()) return '刚看过亲密，先建立安全感';
  if (petVitalsFocus === 'bond' && bondStage().key === 'close') return '刚看过亲密，保持亲近';
  if (trustedBondCompanionActive()) return '刚看过亲密，默契陪伴';
  return {
    mood: '刚看过心情，先照顾感受',
    energy: '刚看过精力，先调整节奏',
    bond: '刚看过亲密，适合轻互动'
  }[petVitalsFocus] || '';
}

function focusedVitalNextStepText() {
  if (petVitalsFocusSource !== 'inspect') return '';
  if (petVitalsFocus === 'mood') {
    const stage = moodStage();
    if (happyMoodTaskActive()) return '心情不错，先趁状态做一小步任务。';
    if (stage.key === 'low') return '心情低落，先陪它缓一缓。';
    if (stage.key === 'bright') return '心情高涨，先轻互动稳住节奏。';
    if (stage.key === 'happy') return '心情愉快，先轻松玩一下稳住状态。';
    if (stage.key === 'steady') return '心情平稳，先轻松稳住节奏。';
    return '心情被看见了，先放松一下再继续。';
  }
  if (petVitalsFocus === 'energy') {
    const stage = energyStage();
    if (stage.key === 'tired') return '精力疲惫，先休 5 分钟恢复。';
    if (fullEnergyTaskActive()) return '精力很足，先盯当前任务推进一小步。';
    if (stage.key === 'full') return '精力很足，先一起开始一段专注。';
    if (readyEnergyTaskRiskActive()) return '精力够用，当前任务会降到低电，先只做一小步。';
    if (stage.key === 'low') return '精力低电，先补一点能量再继续。';
    if (stage.key === 'ready') return '精力充足，先补一点再进入专注。';
    return '精力还可以，先补一点再进入专注。';
  }
  if (petVitalsFocus === 'bond') {
    const stage = bondStage();
    if (stage.key === 'new') return '关系还在试探，先打个招呼让它安心。';
    if (stage.key === 'familiar') return '关系正在变熟，先轻互动增加安全感。';
    if (closeBondTaskActive()) {
      if (stage.key === 'trusted') return '默契很稳，先按你的节奏推进当前任务。';
      return '关系已经亲近，先一起做一小步任务。';
    }
    if (stage.key === 'close') return '亲密亲近，先轻互动保持默契。';
    if (stage.key === 'trusted') return '亲密默契，先按你的节奏陪伴。';
    return '默契很稳，先按你的节奏陪伴。';
  }
  return '';
}

function focusedVitalReasonText() {
  if (petVitalsFocusSource !== 'inspect') return '';
  if (lowMoodReassureActive()) return '心情低落，先陪它缓一缓';
  if (petVitalsFocus === 'mood' && happyMoodTaskActive()) return '心情不错，适合推进当前任务';
  if (petVitalsFocus === 'mood' && moodStage().key === 'happy') return '心情愉快，先轻松玩一下';
  if (petVitalsFocus === 'energy' && energyStage().key === 'tired') return '精力疲惫，先休息恢复';
  if (petVitalsFocus === 'energy' && fullEnergyTaskActive()) return '精力很足，适合推进当前任务';
  if (petVitalsFocus === 'energy' && energyStage().key === 'ready' && !readyEnergyTaskRiskActive()) return '精力充足，先补一点再进入专注';
  if (newBondReassureActive()) return '关系还在试探，先打个招呼让它安心';
  if (petVitalsFocus === 'bond' && closeBondTaskActive() && bondStage().key === 'trusted') return '默契很稳，适合推进当前任务';
  if (petVitalsFocus === 'bond' && bondStage().key === 'close' && !closeBondTaskActive()) return '亲密亲近，先轻互动保持默契';
  if (trustedBondCompanionActive()) return '亲密默契，先按你的节奏陪伴';
  const progress = vitalProgress(petVitalsFocus);
  return vitalProgressFeelingText(progress);
}

function focusedVitalCareLabel(actionName) {
  if (trustedBondCompanionActive()) return '陪伴';
  return CARE_ACTIONS[actionName]?.label || '照料';
}

function focusedVitalReasonBadgeText() {
  if (petVitalsFocusSource !== 'inspect') return '';
  const progress = vitalProgress(petVitalsFocus);
  return progress ? `${progress.label}${progress.stage.label}` : '';
}

function focusedVitalStageLabel() {
  const progress = vitalProgress(petVitalsFocus);
  return progress ? `${progress.label}·${progress.stage.label}` : '';
}

function vitalFocusActionLabel() {
  const progress = vitalProgress(petVitalsFocus);
  if (!progress) return '';
  if (petVitalsFocusSource === 'touch') return `摸摸·${progress.stage.label}`;
  return `${progress.label}·${progress.stage.label}`;
}

function vitalFocusGoalText() {
  const progress = vitalProgress(petVitalsFocus);
  if (!progress?.stage.nextLabel || !progress.remaining) return '';
  return `差${progress.remaining}到${progress.stage.nextLabel}`;
}

function careGuidanceReadableImpactText(nextStep) {
  if (nextStep.kind !== 'care') return '';
  const action = careActionEffect(nextStep.action);
  if (!action) return '';
  const focus = CARE_ACTION_FOCUS[nextStep.action] || petVitalsFocus;
  const readable = careGuidanceImpactText(action.delta, focus);
  const detail = careGuidancePreviewDetailText(nextStep) || careGuidancePreviewText(nextStep);
  if (readable && detail) return `${readable}（${detail}）`;
  return readable || detail || '';
}

function vitalFocusActionTitle(nextStep, label = vitalFocusActionLabel(), goal = vitalFocusGoalText()) {
  const stateText = [label, goal].filter(Boolean).join('，');
  const readableImpact = careGuidanceReadableImpactText(nextStep);
  const actionTitle = nextStep.kind === 'care' && readableImpact
    ? `${nextStep.title || nextStep.label || '执行推荐'}。${nextStep.reason ? `${nextStep.reason}，` : ''}预计${readableImpact}。`
    : careGuidanceActionTitle(
      nextStep,
      careGuidancePreviewText(nextStep),
      careGuidancePreviewDetailText(nextStep)
    );
  return stateText ? `${stateText}。${actionTitle}` : actionTitle;
}

function vitalFocusActionReason(nextStep) {
  if (petVitalsFocusSource === 'touch') {
    if (petVitalsFocus === 'energy') return '摸摸让它放松一点，先让它休息。';
    if (petVitalsFocus === 'mood') return '它被安抚到了，先轻松一下。';
    if (touchNewBondReassureActive()) return '它回应了摸摸，先轻轻互动让它安心。';
    return '它回应了摸摸，关系正在靠近。';
  }
  return focusedVitalNextStepText() || nextStep.text || '';
}

function focusedVitalActionText(nextStep) {
  if (!nextStep?.label) return '照料';
  if (petVitalsFocusSource === 'touch') {
    if (nextStep.action === 'clean') return '继续互动';
    if (nextStep.action === 'rest') return '让它休息';
    if (nextStep.action === 'play') return '轻玩一下';
  }
  return nextStep.kind === 'surface' ? nextStep.label : `去${nextStep.label}`;
}

function vitalFocusImpactText(nextStep) {
  const readableImpact = careGuidanceReadableImpactText(nextStep);
  return readableImpact ? `预计${readableImpact}` : '';
}

function updateVitalFocusAction(nextStep = petNextStep()) {
  const focused = (
    petVitalsFocusSource === 'inspect'
    || (petVitalsFocusSource === 'touch' && !touchRepeatFeedbackActive())
  ) && VITAL_LABELS[petVitalsFocus];
  petStats.focusAction.panel.hidden = !focused;
  if (!focused) {
    petStats.focusAction.panel.dataset.vital = '';
    petStats.focusAction.goal.textContent = '';
    petStats.focusAction.goal.hidden = true;
    petStats.focusAction.goal.title = '';
    petStats.focusAction.impact.textContent = '';
    petStats.focusAction.impact.hidden = true;
    petStats.focusAction.impact.title = '';
    petStats.focusAction.impact.dataset.tone = 'neutral';
    petStats.focusAction.button.dataset.kind = '';
    petStats.focusAction.button.dataset.action = '';
    return;
  }

  const label = vitalFocusActionLabel();
  const goal = vitalFocusGoalText();
  const reason = vitalFocusActionReason(nextStep);
  const buttonText = focusedVitalActionText(nextStep);
  const actionTitle = vitalFocusActionTitle(nextStep, label, goal);
  const actionEffect = careActionEffect(nextStep.action);
  const impactText = vitalFocusImpactText(nextStep);
  const impactTitle = careGuidanceReadableImpactText(nextStep) || careGuidancePreviewDetailText(nextStep);
  petStats.focusAction.panel.dataset.vital = petVitalsFocus;
  petStats.focusAction.label.textContent = label;
  petStats.focusAction.goal.textContent = goal;
  petStats.focusAction.goal.hidden = !goal;
  petStats.focusAction.goal.title = goal ? `${label}，${goal}` : '';
  petStats.focusAction.reason.textContent = reason;
  petStats.focusAction.reason.title = reason;
  petStats.focusAction.impact.textContent = impactText;
  petStats.focusAction.impact.hidden = !impactText;
  petStats.focusAction.impact.title = impactTitle || impactText;
  petStats.focusAction.impact.dataset.tone = vitalDeltaTone(actionEffect?.delta || {});
  petStats.focusAction.button.textContent = buttonText;
  petStats.focusAction.button.title = actionTitle;
  petStats.focusAction.button.dataset.kind = nextStep.kind || '';
  petStats.focusAction.button.dataset.action = nextStep.action || '';
  petStats.focusAction.button.setAttribute('aria-label', actionTitle);
}

function touchRepeatFeedbackActive() {
  return petVitalsFocusSource === 'touch'
    && petVitalsReason === TOUCH_VITAL_EVENTS.repeat.reason;
}

function careRepeatFeedbackActive() {
  return petVitalsFocusSource === 'care'
    && (petVitalsReason.includes('刚刚照料过') || petVitalsReason.startsWith('照料还在观察期'));
}

function careActionCooldownActive(now = Date.now()) {
  return petVitalsFocusSource === 'care'
    && Boolean(lastCareActionName)
    && now - lastCareActionAt < CARE_ACTION_REPEAT_COOLDOWN_MS;
}

function offlineRestFeedbackActive() {
  return petVitalsFocusSource === 'offline';
}

function shortTaskText(task) {
  const text = String(task?.text || '当前任务').trim() || '当前任务';
  return text.length > 14 ? `${text.slice(0, 14)}...` : text;
}

function petNextStep() {
  if (careActionCooldownActive()) {
    const reason = homeCareCooldownReasonText();
    const impact = homeCareCooldownImpactText();
    const observation = careCooldownObservationText(impact);
    const wait = careCooldownWaitText();
    return {
      kind: 'observe',
      action: 'cooldown',
      label: '观察',
      text: `先观察${observation}，${wait}后再继续照料。`,
      reason,
      impact,
      wait,
      title: `观察状态：${reason}，${impact}；${wait}后再继续。`
    };
  }

  const recommendation = careRecommendation();
  const recommendedCare = CARE_ACTIONS[recommendation.action];
  const load = taskLoadState();
  const task = currentTaskItem();
  const compoundAction = compoundCareAction();
  const focusedAction = focusedVitalCareAction();
  const focusedTiredEnergyAction = focusedAction && petVitalsFocus === 'energy' && energyStage().key === 'tired';
  const focusedLowMoodAction = focusedAction && lowMoodReassureActive();
  const focusedNewBondAction = focusedAction && newBondReassureActive();
  const focusedTouchNewBondAction = touchNewBondReassureActive();

  if (compoundAction) {
    const compoundCare = CARE_ACTIONS[compoundAction];
    const text = {
      rest: '先稳住状态，休息后再轻互动。',
      play: '缓过一点了，先把心情拉回来。',
      clean: '缓过一点了，轻轻互动建立安全感。'
    }[compoundAction];
    return {
      kind: 'care',
      action: compoundAction,
      label: compoundCare?.label || '照料',
      text,
      reason: recommendation.reason,
      title: `执行推荐：${compoundCare?.label || '照料'}`
    };
  }

  if (focusedTiredEnergyAction) {
    const focusedLabel = focusedVitalCareLabel(focusedAction);
    return {
      kind: 'care',
      action: focusedAction,
      label: focusedLabel,
      text: focusedVitalNextStepText() || `刚刚看了${VITAL_LABELS[petVitalsFocus]}，先回应这一项。`,
      reason: focusedVitalReasonText() || `回应${VITAL_LABELS[petVitalsFocus]}`,
      title: `执行推荐：${focusedLabel}`
    };
  }

  if (focusedLowMoodAction) {
    const focusedLabel = focusedVitalCareLabel(focusedAction);
    return {
      kind: 'care',
      action: focusedAction,
      label: focusedLabel,
      text: focusedVitalNextStepText() || `刚刚看了${VITAL_LABELS[petVitalsFocus]}，先回应这一项。`,
      reason: focusedVitalReasonText() || `回应${VITAL_LABELS[petVitalsFocus]}`,
      title: `执行推荐：${focusedLabel}`
    };
  }

  if (focusedNewBondAction) {
    const focusedLabel = focusedVitalCareLabel(focusedAction);
    return {
      kind: 'care',
      action: focusedAction,
      label: focusedLabel,
      text: focusedVitalNextStepText() || `刚刚看了${VITAL_LABELS[petVitalsFocus]}，先回应这一项。`,
      reason: focusedVitalReasonText() || `回应${VITAL_LABELS[petVitalsFocus]}`,
      title: `执行推荐：${focusedLabel}`
    };
  }

  if (focusedTouchNewBondAction) {
    return {
      kind: 'care',
      action: 'clean',
      label: '轻互动',
      text: '轻轻互动一次，让它安心靠近。',
      reason: '先轻轻互动让它安心',
      title: '执行推荐：轻互动'
    };
  }

  if (petVitals.energy < 30) {
    return {
      kind: 'care',
      action: 'rest',
      label: '休息',
      text: '先休 5 分钟，精力回来再继续。',
      reason: recommendation.reason,
      title: '执行推荐：休息'
    };
  }

  if (petVitals.mood < 35) {
    return {
      kind: 'care',
      action: 'play',
      label: '玩耍',
      text: '先放松一下，把心情拉回来。',
      reason: recommendation.reason,
      title: '执行推荐：玩耍'
    };
  }

  if (petVitals.bond < 40) {
    return {
      kind: 'care',
      action: 'clean',
      label: '轻互动',
      text: '轻轻互动一次，关系会更熟。',
      reason: recommendation.reason,
      title: '执行推荐：轻互动'
    };
  }

  if (focusedAction) {
    const focusedLabel = focusedVitalCareLabel(focusedAction);
    return {
      kind: 'care',
      action: focusedAction,
      label: focusedLabel,
      text: focusedVitalNextStepText() || `刚刚看了${VITAL_LABELS[petVitalsFocus]}，先回应这一项。`,
      reason: focusedVitalReasonText() || `回应${VITAL_LABELS[petVitalsFocus]}`,
      title: `执行推荐：${focusedLabel}`
    };
  }

  if (load === 'empty') {
    return {
      kind: 'surface',
      action: 'tasks',
      label: '写任务',
      text: '先写下一件最小任务，我来盯着。',
      reason: '还没写任务',
      title: '打开今日任务'
    };
  }

  if (load === 'clear') {
    return {
      kind: 'surface',
      action: 'review',
      label: '复盘',
      text: '清单已完成，做个复盘收尾。',
      reason: '清单已清空',
      title: '打开今日复盘'
    };
  }

  if (load === 'overload') {
    return {
      kind: 'surface',
      action: 'tasks',
      label: '减负',
      text: `待办超限，先守住「${shortTaskText(task)}」。`,
      reason: '待办超限',
      title: '打开今日任务'
    };
  }

  if (load === 'busy') {
    return {
      kind: 'surface',
      action: 'tasks',
      label: '任务',
      text: `任务偏多，先推进「${shortTaskText(task)}」。`,
      reason: '任务偏多',
      title: '打开今日任务'
    };
  }

  if (task && petVitals.energy > 35) {
    return {
      kind: 'care',
      action: 'work',
      label: '打工',
      text: `我盯着「${shortTaskText(task)}」，先做一小步。`,
      reason: recommendation.reason,
      title: '执行推荐：打工'
    };
  }

  if (petVitals.energy < 58) {
    return {
      kind: 'care',
      action: 'feed',
      label: '喂食',
      text: '补一点精力，再进入专注。',
      reason: recommendation.reason,
      title: '执行推荐：喂食'
    };
  }

  return {
    kind: 'care',
    action: recommendation.action,
    label: recommendedCare?.label || '照料',
    text: '状态稳定，适合开始一段专注。',
    reason: recommendation.reason,
    title: `执行推荐：${recommendedCare?.label || '照料'}`
  };
}

function scaledCareDelta(baseDelta) {
  const multiplier = { calm: 0.65, normal: 1, active: 1.35 }[appSettings.petBehaviorIntensity] || 1;
  return Object.fromEntries(
    Object.entries(baseDelta).map(([key, value]) => [key, Math.round(value * multiplier)])
  );
}

function careActionGuard(actionName) {
  if (petVitals.energy < 30 && CARE_ACTION_GUARDS.lowEnergyWork.actions.includes(actionName)) {
    return CARE_ACTION_GUARDS.lowEnergyWork;
  }
  if (petVitals.mood < 35 && CARE_ACTION_GUARDS.lowMoodWork.actions.includes(actionName)) {
    return CARE_ACTION_GUARDS.lowMoodWork;
  }
  if (petVitals.bond < 40 && CARE_ACTION_GUARDS.newBondFocus.actions.includes(actionName)) {
    return CARE_ACTION_GUARDS.newBondFocus;
  }
  if (petVitals.energy >= 88 && CARE_ACTION_GUARDS.fullEnergyFeed.actions.includes(actionName)) {
    return CARE_ACTION_GUARDS.fullEnergyFeed;
  }
  if (petVitals.energy >= 88 && CARE_ACTION_GUARDS.fullEnergyRest.actions.includes(actionName)) {
    return CARE_ACTION_GUARDS.fullEnergyRest;
  }
  return null;
}

function careActionEffect(actionName) {
  const action = CARE_ACTIONS[actionName];
  if (!action) return null;

  const guard = careActionGuard(actionName);
  const animationAction = guard?.action || actionName;
  const repeatAction = CARE_ACTIONS[animationAction] || action;
  return {
    ...action,
    name: actionName,
    guard: guard?.guard || 'normal',
    baseCue: action.cue,
    guardCue: guard?.cue || '',
    cue: guard?.cue || action.cue,
    delta: scaledCareDelta(guard?.delta || action.delta),
    reason: guard?.reason || action.reason,
    text: guard?.text || action.text,
    animationAction,
    repeatKey: animationAction,
    repeatLabel: repeatAction.label,
    opensTasks: guard ? false : Boolean(action.opensTasks)
  };
}

function careGuidancePreviewDetailText(nextStep) {
  if (nextStep.kind === 'observe') return nextStep.impact || '';
  if (nextStep.kind !== 'care') return '';
  const action = careActionEffect(nextStep.action);
  if (!action) return '';
  const preview = vitalDeltaText(action.delta);
  if (preview === '状态稳定') return '';
  const stagePreview = actionStagePreview(action.delta);
  if (!stagePreview.length) return preview;
  return `${preview} · ${stagePreview.map(item => item.text).join('，')}`;
}

function vitalImpactText(kind, value) {
  if (value > 0) {
    return {
      mood: '心情回升',
      energy: '精力回升',
      bond: '亲密增加'
    }[kind] || '';
  }
  if (value < 0) {
    return {
      mood: '心情会降',
      energy: '会耗精力',
      bond: '亲密会降'
    }[kind] || '';
  }
  return '';
}

function vitalStageConfig(kind) {
  return {
    mood: { label: '心情', stages: MOOD_STAGES },
    energy: { label: '精力', stages: ENERGY_STAGES },
    bond: { label: '亲密', stages: BOND_STAGES }
  }[kind] || null;
}

function vitalStageDropImpactText(kind, delta = {}) {
  const config = vitalStageConfig(kind);
  const value = Math.round(delta?.[kind] || 0);
  if (!config || value >= 0) return '';
  const nextValue = clamp(petVitals[kind] + value);
  const drop = stageDrop(petVitals[kind], nextValue, config.stages);
  return drop ? `${config.label}降到${drop.next.label}` : '';
}

function readableVitalImpactText(kind, value, delta = {}) {
  return vitalStageDropImpactText(kind, delta) || vitalImpactText(kind, value);
}

function energyCostImpactText(delta = {}, fallback = '会耗精力') {
  return vitalStageDropImpactText('energy', delta) || fallback;
}

function vitalImpactValueText(kind, value) {
  const label = VITAL_LABELS[kind];
  const normalized = Math.round(value || 0);
  if (!label || !normalized) return '';
  return `${label}${normalized > 0 ? '+' : ''}${normalized}`;
}

function careGuidanceImpactText(delta = {}, focus = '') {
  const normalized = normalizeVitalDelta(delta);
  const candidates = VITAL_KEYS
    .map((kind, index) => ({
      kind,
      index,
      value: normalized[kind] || 0,
      focused: kind === focus ? 1 : 0
    }))
    .filter(item => item.value);
  const positives = candidates
    .filter(item => item.value > 0)
    .sort((a, b) => b.focused - a.focused || Math.abs(b.value) - Math.abs(a.value) || a.index - b.index);
  const negatives = candidates
    .filter(item => item.value < 0)
    .sort((a, b) => b.focused - a.focused || Math.abs(b.value) - Math.abs(a.value) || a.index - b.index);
  const primary = (positives.find(item => item.focused) || positives[0] || negatives.find(item => item.focused) || negatives[0]);
  const secondary = negatives.find(item => item.kind !== primary?.kind)
    || positives.find(item => item.kind !== primary?.kind)
    || candidates.find(item => item.kind !== primary?.kind);
  return [primary, secondary]
    .map(item => readableVitalImpactText(item?.kind, item?.value, normalized))
    .filter(Boolean)
    .slice(0, 2)
    .join(' · ');
}

function careFeedbackImpactText(delta = {}, focus = '') {
  const normalized = normalizeVitalDelta(delta);
  const candidates = VITAL_KEYS
    .map((kind, index) => ({
      kind,
      index,
      value: normalized[kind] || 0,
      text: vitalImpactText(kind, normalized[kind] || 0),
      focused: kind === focus ? 1 : 0
    }))
    .filter(item => item.value && item.text);
  const positives = candidates
    .filter(item => item.value > 0)
    .sort((a, b) => b.focused - a.focused || Math.abs(b.value) - Math.abs(a.value) || a.index - b.index);
  const negatives = candidates
    .filter(item => item.value < 0)
    .sort((a, b) => b.focused - a.focused || Math.abs(b.value) - Math.abs(a.value) || a.index - b.index);
  const primary = positives.find(item => item.focused) || positives[0] || negatives.find(item => item.focused) || negatives[0];
  const pending = careFeedbackPendingText(focus, petVitalsFocusSource);
  const nearStage = primary?.value > 0 ? vitalNearNextStageText(primary.kind) : '';
  const impact = [primary?.text, nearStage].filter(Boolean).join(' · ');
  return impact || pending || '状态稳定';
}

function careFeedbackPendingText(focus = '', source = '') {
  if (source === 'settings') {
    return {
      mood: '心情已确认',
      energy: '精力已确认',
      bond: '亲密已确认'
    }[focus] || '';
  }
  if (source === 'care') {
    return {
      mood: '心情观察中',
      energy: '精力观察中',
      bond: '亲密观察中'
    }[focus] || '';
  }
  if (source === 'inspect') {
    return {
      mood: '心情待行动',
      energy: '精力待行动',
      bond: '亲密待行动'
    }[focus] || '';
  }
  if (source === 'touch') {
    return {
      mood: '心情先缓缓',
      energy: '精力先休息',
      bond: '亲密先缓缓'
    }[focus] || '';
  }
  if (source !== 'focus') return '';
  return {
    mood: '心情待安抚',
    energy: '精力待休息',
    bond: '亲密待回应'
  }[focus] || '';
}

function careActionImpactBadges(delta = {}, focus = '') {
  const normalized = normalizeVitalDelta(delta);
  const candidates = VITAL_KEYS
    .map((kind, index) => ({
      kind,
      index,
      value: normalized[kind] || 0,
      text: vitalImpactValueText(kind, normalized[kind] || 0),
      focused: kind === focus ? 1 : 0
    }))
    .filter(item => item.value && item.text);
  const positives = candidates
    .filter(item => item.value > 0)
    .sort((a, b) => b.focused - a.focused || Math.abs(b.value) - Math.abs(a.value) || a.index - b.index);
  const negatives = candidates
    .filter(item => item.value < 0)
    .sort((a, b) => b.focused - a.focused || Math.abs(b.value) - Math.abs(a.value) || a.index - b.index);
  const primary = positives.find(item => item.focused) || positives[0] || negatives.find(item => item.focused) || negatives[0];
  const secondary = negatives.find(item => item.kind !== primary?.kind)
    || positives.find(item => item.kind !== primary?.kind)
    || candidates.find(item => item.kind !== primary?.kind);
  const ordered = [primary, secondary];
  for (const item of [...negatives, ...positives, ...candidates]) {
    if (item && !ordered.some(existing => existing?.kind === item.kind)) ordered.push(item);
  }
  return ordered
    .filter(Boolean)
    .map(item => ({
      kind: item.kind,
      text: item.text,
      tone: item.value > 0 ? 'positive' : 'negative',
      trend: item.value > 0 ? 'up' : 'down'
    }));
}

function careGuidancePreviewText(nextStep) {
  if (nextStep.kind === 'observe') return String(nextStep.impact || '').replace(/^先观察/, '');
  if (nextStep.kind !== 'care') return '';
  const action = careActionEffect(nextStep.action);
  if (!action) return '';
  const preview = vitalDeltaText(action.delta);
  return preview === '状态稳定' ? '' : preview;
}

function careGuidancePreviewDisplayText(nextStep, previewText = careGuidancePreviewText(nextStep)) {
  if (nextStep.kind !== 'care') return previewText;
  const action = careActionEffect(nextStep.action);
  if (!action || !previewText) return previewText;
  const focus = CARE_ACTION_FOCUS[nextStep.action] || petVitalsFocus;
  return careGuidanceImpactText(action.delta, focus) || previewText;
}

function careGuidancePreviewTitleText(nextStep, previewText = careGuidancePreviewText(nextStep), previewDetail = careGuidancePreviewDetailText(nextStep)) {
  const displayText = careGuidancePreviewDisplayText(nextStep, previewText);
  const detail = previewDetail || previewText;
  if (nextStep.kind === 'care' && displayText && detail && displayText !== detail) {
    return `${displayText}（${detail}）`;
  }
  return detail || displayText;
}

function careGuidanceDetailText(nextStep) {
  if (!nextStep) return '';
  if (nextStep.kind === 'observe') {
    const impact = nextStep.impact || homeCareCooldownImpactText();
    const focusText = careCooldownFocusText(impact);
    const observation = String(impact).replace(/^先观察/, '');
    const wait = nextStep.wait || careCooldownWaitText();
    return `它${nextStep.reason || homeCareCooldownReasonText()}，心情、精力和亲密已经变化；先看${observation || focusText}是否稳定，${wait}后再决定下一步。`;
  }
  const load = taskLoadState();
  if (nextStep.kind === 'surface') {
    const pending = pendingTaskCount();
    if (load === 'overload') {
      return `待办 ${pending}/${TASK_ACTIVE_LIMIT}：心情会紧张，精力也会被消耗；亲密会因陪伴守住第一项而增加。`;
    }
    if (load === 'busy') {
      return `待办 ${pending}/${TASK_ACTIVE_LIMIT}：少切换能省精力，先守住第一项也会增加亲密。`;
    }
    if (load === 'empty') return '还没写任务：写下一件小事会让它安心，也能先建立亲密。';
    if (load === 'clear') return '清单已完成：它会放松下来，心情和亲密更稳。';
    return nextStep.reason ? `${nextStep.reason}：先进入对应窗口，它会跟着你的节奏。` : '';
  }
  if (nextStep.kind === 'care') {
    const action = careActionEffect(nextStep.action);
    const focus = CARE_ACTION_FOCUS[nextStep.action] || petVitalsFocus;
    const progress = vitalProgress(focus);
    const focusedState = petVitalsFocusSource === 'inspect' ? focusedVitalReasonText() : '';
    const state = focusedState || (progress ? vitalProgressFeelingText(progress) : nextStep.reason);
    const impact = careGuidanceImpactText(action?.delta || {}, focus);
    const label = nextStep.label || '照料';
    if (state && impact) return `${state}：${label}后${impact}。`;
    if (state) return `${state}：${label}后状态会更稳。`;
    if (impact) return `${label}后${impact}。`;
  }
  return '';
}

function careGuidanceActionTitle(nextStep, previewText = '', previewDetail = '') {
  const base = nextStep.title || nextStep.label || '执行推荐';
  if (nextStep.kind === 'observe') return base;
  if (nextStep.kind !== 'care' || !previewText) return base;
  const reason = nextStep.reason ? `${nextStep.reason}，` : '';
  const preview = careGuidancePreviewTitleText(nextStep, previewText, previewDetail);
  return `${base}。${reason}预计${preview}。`;
}

function careGuidanceReasonTitle(nextStep) {
  if (nextStep.kind === 'observe') return nextStep.reason ? `为什么观察：${nextStep.reason}` : '';
  return nextStep.reason ? `为什么推荐：${nextStep.reason}` : '';
}

function careGuidancePreviewAriaLabel(previewText = '', previewDetail = '') {
  const detail = previewDetail || previewText;
  return detail ? `预计变化：${detail}` : '';
}

function careFeedbackAriaLabel(feedbackText = '', deltaText = '', sourceLabel = '', recentText = '') {
  const feedback = String(feedbackText || '').trim() || '状态稳定';
  const delta = String(deltaText || '').trim();
  const source = String(sourceLabel || '').trim();
  const recent = String(recentText || '').trim();
  const parts = [`状态反馈：${feedback}`];
  if (delta && delta !== '状态稳定') parts.push(`本次变化：${delta}`);
  if (source) parts.push(`来源：${source}`);
  if (recent) parts.push(`最近：${recent}`);
  return parts.join(' · ');
}

function careFeedbackDeltaAriaText(deltaText = '', deltaDetail = '') {
  const display = String(deltaText || '').trim();
  const detail = String(deltaDetail || '').trim();
  if (display && detail && detail !== '状态稳定' && display !== detail) return `${display}（${detail}）`;
  return detail || display;
}

function careDeltaLabel(key, value) {
  const label = { mood: '心', energy: '精', bond: '亲' }[key] || key;
  return `${label}${value > 0 ? '+' : ''}${value}`;
}

function projectedVitals(delta = {}) {
  return {
    mood: clamp(petVitals.mood + (delta.mood || 0)),
    energy: clamp(petVitals.energy + (delta.energy || 0)),
    bond: clamp(petVitals.bond + (delta.bond || 0))
  };
}

function actionStagePreview(delta = {}) {
  const nextVitals = projectedVitals(delta);
  const items = [
    { key: 'mood', label: '心', stages: MOOD_STAGES },
    { key: 'energy', label: '精', stages: ENERGY_STAGES },
    { key: 'bond', label: '亲', stages: BOND_STAGES }
  ];

  return items.flatMap(item => {
    const advance = stageAdvance(petVitals[item.key], nextVitals[item.key], item.stages);
    if (advance) return [{ kind: item.key, tone: 'up', text: `${item.label}到${advance.next.label}` }];

    const drop = stageDrop(petVitals[item.key], nextVitals[item.key], item.stages);
    if (drop) return [{ kind: item.key, tone: 'down', text: `${item.label}降${drop.next.label}` }];

    return [];
  }).slice(0, 2);
}

function careActionStageBadges(stagePreview = [], focus = '') {
  const preferred = stagePreview.find(item => item.kind === focus) || stagePreview[0];
  return preferred ? [preferred] : [];
}

function careActionRank(actionName, action, recommendation) {
  if (recommendation.action === actionName) return 0;
  return {
    normal: 1,
    soft: 2,
    blocked: 3
  }[action.guard] || 2;
}

function orderedCareActions(recommendation) {
  return CARE_ACTION_ORDER
    .map((actionName, index) => ({
      actionName,
      action: careActionEffect(actionName),
      index
    }))
    .filter(item => item.action)
    .sort((a, b) => (
      careActionRank(a.actionName, a.action, recommendation)
      - careActionRank(b.actionName, b.action, recommendation)
      || a.index - b.index
    ));
}

function careMenuInsightFocus(recommendation = careRecommendation()) {
  if (careActionCooldownActive()) return careCooldownFocusKind();
  const compound = compoundVitalState();
  return compound.lowKeys[0] || CARE_ACTION_FOCUS[recommendation.action] || '';
}

function careMenuInsightImpactText(recommendation = careRecommendation()) {
  const action = careActionEffect(recommendation.action);
  if (!action) return '';
  const focus = CARE_ACTION_FOCUS[action.name] || CARE_ACTION_FOCUS[recommendation.action] || '';
  const normalized = normalizeVitalDelta(action.delta);
  const positives = VITAL_KEYS
    .map((kind, index) => ({
      kind,
      index,
      value: normalized[kind] || 0,
      focused: kind === focus ? 1 : 0
    }))
    .filter(item => item.value > 0)
    .sort((a, b) => b.focused - a.focused || Math.abs(b.value) - Math.abs(a.value) || a.index - b.index);
  const primary = positives[0];
  const secondary = positives.find(item => item.kind !== primary?.kind);
  const primaryText = vitalImpactText(primary?.kind, primary?.value);
  const secondaryText = {
    mood: '照顾心情',
    energy: '补一点精力',
    bond: '增加亲密'
  }[secondary?.kind];
  if (!primaryText) return '';
  return [`预计${primaryText}`, secondaryText ? `也会${secondaryText}` : '']
    .filter(Boolean)
    .join('，');
}

function careMenuStageInsightText(recommendation = careRecommendation()) {
  const action = careActionEffect(recommendation.action);
  if (!action) return '';
  const nextVitals = projectedVitals(action.delta);
  const focus = CARE_ACTION_FOCUS[action.name] || CARE_ACTION_FOCUS[recommendation.action] || '';
  const previews = [
    { kind: 'mood', label: '心情', advance: stageAdvance(petVitals.mood, nextVitals.mood, MOOD_STAGES) },
    { kind: 'energy', label: '精力', advance: stageAdvance(petVitals.energy, nextVitals.energy, ENERGY_STAGES) },
    { kind: 'bond', label: '亲密', advance: stageAdvance(petVitals.bond, nextVitals.bond, BOND_STAGES) }
  ]
    .filter(preview => preview.advance)
    .map(preview => ({ ...preview, next: preview.advance.next }));
  const preview = previews.find(item => item.kind === focus) || previews[0];
  return preview ? `预计${preview.label}回到${preview.next.label}` : '';
}

function careMenuInsightText(recommendation = careRecommendation()) {
  if (careActionCooldownActive()) return careCooldownMenuInsightText();
  recommendation = {
    ...recommendation,
    label: recommendation.label || CARE_ACTIONS[recommendation.action]?.label || '照料'
  };
  const impact = careMenuInsightImpactText(recommendation);
  const stageInsight = careMenuStageInsightText(recommendation);

  const compound = compoundVitalState();
  if (compound.fragile) {
    const primary = vitalProgress(compound.lowKeys[0]);
    const secondary = vitalProgress(compound.lowKeys[1]);
    if (primary && secondary) {
      return impact
        ? `先稳住${primary.label}，再轻轻照顾${secondary.label}；建议${recommendation.label}，${impact}。`
        : `先稳住${primary.label}，再轻轻照顾${secondary.label}。`;
    }
    if (primary) return impact
      ? `先稳住${primary.label}；建议${recommendation.label}，${impact}。`
      : `先稳住${primary.label}，再观察状态变化。`;
  }

  if (recommendation.action === 'rest') return stageInsight
    ? `精力偏低时先休息，比硬撑任务更稳；${stageInsight}。`
    : '精力偏低时先休息，比硬撑任务更稳。';
  if (recommendation.action === 'play') return stageInsight
    ? `心情偏低时先放松，回稳后再推进；${stageInsight}。`
    : '心情偏低时先放松，回稳后再推进。';
  if (recommendation.action === 'clean') {
    const relationshipText = recommendation.reason === '亲密正在变熟'
      ? '关系正在变熟，先轻互动增加安全感'
      : '关系还在试探，先轻互动让它安心';
    return stageInsight ? `${relationshipText}；${stageInsight}。` : `${relationshipText}。`;
  }
  if (recommendation.action === 'feed') return stageInsight
    ? `先补一点精力，再开始专注会更顺；${stageInsight}。`
    : '先补一点精力，再开始专注会更顺。';
  if (recommendation.action === 'study') {
    const action = careActionEffect('study');
    return `状态够用，可以一起学习；亲密会增加，但${energyCostImpactText(action?.delta)}。`;
  }
  if (recommendation.action === 'work') {
    const action = careActionEffect('work');
    return `任务明确，可以一起推进；亲密会增加，但${energyCostImpactText(action?.delta)}。`;
  }
  return '按当前状态选一个轻动作，观察它的反馈。';
}

function careActionRecommendationNote(actionName, action, recommendation = careRecommendation()) {
  if (!action) return '';
  if (compoundVitalState().fragile) return '';

  if (action.guard === 'blocked') {
    if (action.reason.includes('精力太低')) {
      return actionName === 'work'
        ? '暂缓：精力太低，先休息再推进任务。'
        : '暂缓：精力太低，先休息再一起专注。';
    }
    if (action.reason.includes('心情太低')) {
      return actionName === 'work'
        ? '暂缓：心情太低，先玩耍再推进任务。'
        : '暂缓：心情太低，先玩耍再一起专注。';
    }
    return `暂缓：${action.reason || '状态还没稳'}，${action.guardCue || '先缓缓'}。`;
  }

  if (action.guard === 'soft') {
    if (action.reason.includes('关系还在试探')) {
      return actionName === 'work'
        ? '轻一点：关系还在试探，先互动再推进任务。'
        : '轻一点：关系还在试探，先互动再一起专注。';
    }
    return `轻一点：${action.reason || '状态已经够用'}，先观察它的反应。`;
  }

  if (recommendation.action === actionName) {
    const defaultEnergyCost = actionName === 'play' ? '会耗一点精力' : '会耗精力';
    const energyCost = energyCostImpactText(action.delta, defaultEnergyCost);
    return {
      rest: '精力偏低，先休息；精力会回升，也会带动亲密。',
      play: `心情偏低，先玩耍；心情会回稳，但${energyCost}。`,
      clean: recommendation.reason === '亲密正在变熟'
        ? '亲密正在变熟，先轻互动；关系会更安心，也会照顾心情。'
        : '亲密偏低，先轻互动；关系会更安心，也会照顾心情。',
      feed: '精力需要补充，先喂食；精力会回升，也会更亲近。',
      study: `状态稳定，可以一起学习；亲密会上升，但${energyCost}。`,
      work: `任务明确，可以一起推进；亲密会上升，但${energyCost}。`
    }[actionName] || '先回应当前最需要照顾的状态。';
  }

  const optionalEnergyCost = actionName === 'play'
    ? energyCostImpactText(action.delta, '会耗一点精力')
    : energyCostImpactText(action.delta, '会明显耗精力');
  return {
    rest: '可选：恢复精力和亲密，适合累了再用。',
    play: `可选：心情会高涨，但${optionalEnergyCost}。`,
    clean: '可选：关系会更安心，不会额外耗精力。',
    feed: '可选：补充精力和亲密，适合休息后再用。',
    study: `可选：亲密会上升，但${optionalEnergyCost}。`,
    work: `可选：能推进任务并增加亲密，但${optionalEnergyCost}。`
  }[actionName] || '先回应当前最需要照顾的状态。';
}

function renderCareMenu() {
  const recommendation = careRecommendation();
  const cooldownActive = careActionCooldownActive();
  const cooldownReason = cooldownActive ? homeCareCooldownReasonText() : '';
  const cooldownImpact = cooldownActive ? homeCareCooldownImpactText() : '';
  const insight = careMenuInsightText(recommendation);
  careMenuTitle.textContent = cooldownActive ? cooldownReason : recommendation.title;
  careMenuReason.textContent = cooldownActive ? cooldownImpact : recommendation.reason;
  careMenuInsight.textContent = insight;
  careMenuInsight.title = insight;
  careMenuInsight.dataset.focus = careMenuInsightFocus(recommendation);
  careActions.innerHTML = '';

  for (const { actionName, action } of orderedCareActions(recommendation)) {
    const stagePreview = actionStagePreview(action.delta);
    const stageBadges = careActionStageBadges(stagePreview, CARE_ACTION_FOCUS[action.name] || CARE_ACTION_FOCUS[actionName]);
    const deltaDetail = vitalDeltaText(action.delta);
    const titleParts = [
      action.reason,
      deltaDetail === '状态稳定' ? '' : deltaDetail,
      stagePreview.length ? stagePreview.map(item => item.text).join('，') : ''
    ].filter(Boolean);
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.action = actionName;
    button.dataset.guard = action.guard;
    button.className = `care-action ${recommendation.action === actionName ? 'recommended' : ''} ${action.guard !== 'normal' ? action.guard : ''}`;
    button.title = `${action.label}：${titleParts.join(' · ')}`;
    button.setAttribute('aria-label', button.title);

    const copy = document.createElement('span');
    copy.className = 'care-action-copy';
    const label = document.createElement('b');
    label.textContent = action.label;
    const cue = document.createElement('small');
    cue.textContent = action.guard === 'normal' ? action.cue : `${action.baseCue} · ${action.reason}`;
    copy.append(label, cue);
    const recommendationNote = careActionRecommendationNote(actionName, action, recommendation);
    if (recommendationNote) {
      const note = document.createElement('small');
      note.className = 'care-action-note';
      note.textContent = recommendationNote;
      copy.appendChild(note);
    }

    const effects = document.createElement('span');
    effects.className = 'care-action-effects';
    for (const badge of careActionImpactBadges(action.delta, CARE_ACTION_FOCUS[action.name] || CARE_ACTION_FOCUS[actionName])) {
      const effect = document.createElement('i');
      effect.dataset.vital = badge.kind;
      effect.dataset.impact = badge.tone;
      effect.dataset.trend = badge.trend;
      effect.textContent = badge.text;
      effects.appendChild(effect);
    }

    for (const preview of stageBadges) {
      const badge = document.createElement('em');
      badge.dataset.stagePreview = preview.tone;
      badge.textContent = preview.text;
      effects.appendChild(badge);
    }

    if (action.guard !== 'normal') {
      const guard = document.createElement('em');
      guard.dataset.guard = action.guard;
      guard.textContent = action.guardCue;
      effects.prepend(guard);
    }

    if (recommendation.action === actionName) {
      const badge = document.createElement('em');
      const reasonBadge = recommendation.badge || (recommendation.reason?.startsWith('回应') ? recommendation.reason : '推荐');
      badge.dataset.recommendationReason = reasonBadge === recommendation.reason || reasonBadge === recommendation.badge ? 'true' : 'false';
      badge.textContent = reasonBadge;
      effects.prepend(badge);
    }

    button.append(copy, effects);
    careActions.appendChild(button);
  }
}

function homeSurfaceSummary(nextStep = petNextStep()) {
  if (activeSurface !== 'home' || nextStep.kind !== 'surface') return '';
  const load = taskLoadState();
  if (load === 'empty') return '状态稳定，先写任务';
  if (load === 'clear') return '清单完成，适合复盘';
  if (load === 'overload') return '待办超限，先减负';
  if (load === 'busy') return '任务偏多，守住第一项';
  return nextStep.text || '';
}

function homeCareStepSummary(nextStep = petNextStep()) {
  if (activeSurface !== 'home' || petVitalsFocusSource || nextStep.kind !== 'care') return '';
  if (nextStep.action === 'work') return '状态稳定，盯当前任务';
  if (nextStep.action === 'study') return '状态稳定，一起学习';
  return '';
}

function vitalsSummary(nextStep = petNextStep()) {
  if (activeSurface === 'tasks') return taskVitalsSummary();
  if (activeSurface === 'settings') return '正在看着设置节奏';
  if (activeSurface === 'review') return '正在复盘今天节奏';
  if (chatCallActive()) return '正在守着这次联系';
  if (touchRepeatFeedbackActive()) return '刚回应过摸摸，先缓一缓';
  if (careActionCooldownActive()) return '刚照料过，先观察状态';
  if (offlineRestFeedbackActive()) return '离开后恢复了精力';
  if (petVibe() === 'fragile') {
    return compoundCareAction() === 'rest' ? '状态有点脆弱，先缓一缓' : '状态刚稳一点，先轻互动';
  }
  if (lowMoodReassureActive()) {
    return focusedVitalSummary();
  }
  if (newBondReassureActive()) {
    return focusedVitalSummary();
  }
  if (petVitalsFocusSource === 'inspect' && petVitalsFocus === 'energy' && energyStage().key === 'tired') {
    return focusedVitalSummary();
  }
  const focusedSummary = petVibe() === 'steady' ? focusedVitalSummary() : '';
  if (focusedSummary) return focusedSummary;
  const careStepSummary = homeCareStepSummary(nextStep);
  if (careStepSummary) return careStepSummary;
  const surfaceSummary = homeSurfaceSummary(nextStep);
  if (surfaceSummary) return surfaceSummary;
  return {
    tired: '有点累，动作会慢下来',
    down: '情绪低，需要轻一点陪伴',
    guarded: '还在熟悉你，会保持一点距离',
    focused: '正在盯当前任务',
    bright: '状态很好，会主动陪你推进',
    steady: activeSurface === 'chat' ? '在旁边守着消息' : '状态稳定，等待下一步'
  }[petVibe()];
}

function careCueText(nextStep = petNextStep()) {
  if (activeSurface === 'tasks') return taskCareCueText();
  if (activeSurface === 'settings') return '调提醒节奏';
  if (activeSurface === 'review') return '看今日复盘';
  if (chatCallActive()) return '守着联系';
  if (touchRepeatFeedbackActive()) return '别频繁戳它';
  if (touchNewBondReassureActive()) return '轻轻靠近';
  if (careActionCooldownActive()) return '观察变化';
  if (offlineRestFeedbackActive()) return '先接回节奏';
  if (lowMoodReassureActive()) return '安抚心情';
  if (newBondReassureActive()) return '建立安全感';
  const compoundAction = compoundCareAction();
  if (compoundAction) {
    return {
      rest: '先稳住',
      play: '先玩耍',
      clean: '先熟悉'
    }[compoundAction];
  }
  if (activeSurface === 'home' && nextStep.kind === 'surface') {
    const load = taskLoadState();
    if (load === 'empty') return '先写任务';
    if (load === 'clear') return '可以复盘';
    if (load === 'overload') return '先减负';
    if (load === 'busy') return '先做第一项';
    return nextStep.label || '下一步';
  }
  return {
    rest: '建议休息',
    play: '摸摸或玩耍',
    clean: '多互动',
    work: '盯当前任务',
    feed: '补充精力',
    study: '一起学习'
  }[careRecommendation().action] || '陪伴中';
}

function chatCallActive() {
  return activeSurface === 'chat'
    && chatCallStage
    && !chatCallStage.hidden
    && !chatCallStage.classList.contains('hidden');
}

function vitalInsightRepeatAction(kind) {
  return focusedVitalCareAction()
    || {
      mood: 'play',
      energy: energyStage().key === 'tired' ? 'rest' : 'feed',
      bond: 'clean'
    }[kind]
    || 'clean';
}

function vitalInsightRepeatText(actionName) {
  const label = CARE_ACTIONS[actionName]?.label || '照料';
  return `我刚刚解释过啦，先按下面的${label}建议行动就好。`;
}

function vitalInsight(kind, { force = false } = {}) {
  const now = Date.now();
  if (!force && lastVitalInsightKey === kind && now - lastVitalInsightAt < VITAL_INSIGHT_COOLDOWN_MS) {
    const repeatAction = vitalInsightRepeatAction(kind);
    return {
      applied: false,
      delta: {},
      reason: '刚刚已经看过这个状态，先照着建议行动。',
      text: vitalInsightRepeatText(repeatAction),
      action: repeatAction
    };
  }

  lastVitalInsightKey = kind;
  lastVitalInsightAt = now;

  if (kind === 'mood') {
    const stage = moodStage();
    if (stage.key === 'low') {
      return {
        applied: true,
        delta: { mood: 1, bond: 1 },
        reason: '你注意到它的心情，它被安抚了一点。',
        text: '我有点低落，先陪我缓一缓，会好一点。',
        action: 'play'
      };
    }
    if (happyMoodTaskActive()) {
      return {
        applied: true,
        delta: { mood: 1, bond: 1 },
        reason: '你确认了心情状态，它会趁状态陪你推进任务',
        text: '心情不错，我陪你趁状态推进当前任务。',
        action: 'work'
      };
    }
    if (stage.key === 'happy') {
      return {
        applied: true,
        delta: { mood: 1, bond: 1 },
        reason: '你确认它心情不错，它会放松一下稳住状态',
        text: '心情不错，我陪它轻松玩一下稳住状态。',
        action: 'play'
      };
    }
    if (stage.key === 'steady') {
      return {
        applied: true,
        delta: { mood: 1, bond: 1 },
        reason: '你确认了它心情平稳，它会放松一点再继续',
        text: '心情还稳，我们先轻松一下再继续。',
        action: 'play'
      };
    }
    if (stage.key === 'bright') {
      return {
        applied: true,
        delta: { bond: 1 },
        reason: '你确认它心情高涨，它愿意先稳住节奏',
        text: '心情有点高，我们先轻轻互动把节奏稳住。',
        action: 'clean'
      };
    }
    return {
      applied: true,
      delta: { bond: 1 },
      reason: '你读懂了它的心情，它会更信任你。',
      text: '我的心情还算稳定，轻轻互动一下就能继续。',
      action: 'clean'
    };
  }

  if (kind === 'energy') {
    const stage = energyStage();
    if (stage.key === 'tired') {
      return {
        applied: true,
        delta: { bond: 1 },
        reason: '你注意到它精力偏低，它会更愿意先休息。',
        text: '我现在很累，先休 5 分钟恢复一下。',
        action: 'rest'
      };
    }
    if (stage.key === 'low') {
      return {
        applied: true,
        delta: { energy: 1, bond: 1 },
        reason: '你检查了它的精力，它愿意先补一点能量',
        text: '精力有点低，我先补一点能量再继续。',
        action: 'feed'
      };
    }
    if (fullEnergyTaskActive()) {
      return {
        applied: true,
        delta: { bond: 1 },
        reason: '你确认它精力很足，它会带着你守住当前任务',
        text: '精力很足，我先盯着当前任务推进一小步。',
        action: 'work'
      };
    }
    if (stage.key === 'full') {
      return {
        applied: true,
        delta: { mood: 1, bond: 1 },
        reason: '你确认它精力很足，它会更主动陪你。',
        text: '我精力很足，可以陪你开始一段专注。',
        action: 'study'
      };
    }
    if (readyEnergyTaskRiskActive()) {
      return {
        applied: true,
        delta: { bond: 1 },
        reason: '你检查了它的精力，它会帮你守住当前任务',
        text: '精力够用，但这一步会降到低电；我先盯着当前任务做一小步。',
        action: 'work'
      };
    }
    if (stage.key === 'ready') {
      return {
        applied: true,
        delta: { energy: 1, bond: 1 },
        reason: '你检查了它的精力，它愿意先补一点能量再进入专注',
        text: '精力够用，我先补一点能量再进入专注。',
        action: 'feed'
      };
    }
    return {
      applied: true,
      delta: { bond: 1 },
      reason: '你检查了它的精力，它会更好配合节奏。',
      text: '我的精力还可以，别一次安排太满。',
      action: 'clean'
    };
  }

  if (kind === 'bond') {
    const stage = bondStage();
    if (stage.key === 'new') {
      return {
        applied: true,
        delta: { mood: 1, bond: 2 },
        reason: '你关注关系状态，它试着更靠近一点。',
        text: '我还在适应你，先打个招呼，轻轻互动会更安心。',
        action: 'clean'
      };
    }
    if (closeBondTaskActive()) {
      if (stage.key === 'trusted') {
        return {
          applied: true,
          delta: { bond: 1 },
          reason: '你确认了默契关系，它会按你的节奏推进任务',
          text: '默契已经很稳了，我陪你一起推进当前任务。',
          action: 'work'
        };
      }
      return {
        applied: true,
        delta: { bond: 1 },
        reason: '你确认了亲密关系，它愿意陪你推进任务',
        text: '关系已经亲近了，我陪你一起推进当前任务。',
        action: 'work'
      };
    }
    if (stage.key === 'close') {
      return {
        applied: true,
        delta: { bond: 1 },
        reason: '你确认了亲近关系，它会安心地陪着',
        text: '关系已经亲近了，轻轻互动就能保持默契。',
        action: 'clean'
      };
    }
    if (stage.key === 'trusted') {
      return {
        applied: true,
        delta: { mood: 1 },
        reason: '你确认了默契关系，它会安静地陪着',
        text: '默契已经很稳了，我会安静陪着你。',
        action: 'clean'
      };
    }
    return {
      applied: true,
      delta: { bond: 1 },
      reason: '你看见了关系进度，它会更愿意贴近你。',
      text: '我们正在变熟，稳定互动会让亲密慢慢上来。',
      action: 'clean'
    };
  }

  return {
    applied: false,
    delta: {},
    reason: '它还在整理自己的状态。',
    text: '我还在整理自己的状态，稍等一下。',
    action: 'rest'
  };
}

function setPetVitals(nextVitals, reason = '') {
  const previousVitals = petVitals;
  petVitals = {
    mood: clamp(nextVitals.mood),
    energy: clamp(nextVitals.energy),
    bond: clamp(nextVitals.bond)
  };
  petVitalsDelta = normalizeVitalDelta({
    mood: petVitals.mood - previousVitals.mood,
    energy: petVitals.energy - previousVitals.energy,
    bond: petVitals.bond - previousVitals.bond
  });
  const milestone = vitalStageMilestoneInfo(previousVitals, petVitals);
  petVitalsMilestone = milestone.text;
  petVitalsMilestoneTone = milestone.tone;
  petVitalsMilestoneKind = milestone.kind || vitalMilestoneKind(milestone.text);
  if (reason) petVitalsReason = reason;
  savePetVitals();
  updatePetStats();
  syncPetAnimationToStatus();
}

function applyPetVitalsDelta(delta, reason, options = {}) {
  const focus = VITAL_LABELS[options.focus] ? options.focus : vitalFocusFromDelta(delta, petVitalsFocus);
  if (focus) setVitalFocus(focus, options.focusSource || 'auto');
  setPetVitals({
    mood: petVitals.mood + (delta.mood || 0),
    energy: petVitals.energy + (delta.energy || 0),
    bond: petVitals.bond + (delta.bond || 0)
  }, reason);
}

function recordPetVitalsFeedback(reason, options = {}) {
  const focus = VITAL_LABELS[options.focus] ? options.focus : '';
  if (focus) setVitalFocus(focus, options.focusSource || 'auto');
  petVitalsDelta = normalizeVitalDelta({});
  petVitalsMilestone = '';
  petVitalsMilestoneTone = 'neutral';
  petVitalsMilestoneKind = '';
  if (reason) petVitalsReason = reason;
  savePetVitals();
  updatePetStats();
  syncPetAnimationToStatus();
}

function mergeVitalDeltas(...deltas) {
  return deltas.reduce((merged, delta = {}) => ({
    mood: merged.mood + (delta.mood || 0),
    energy: merged.energy + (delta.energy || 0),
    bond: merged.bond + (delta.bond || 0)
  }), { mood: 0, energy: 0, bond: 0 });
}

function taskVitalEffect(eventName, task = {}, options = {}) {
  if (eventName === 'add') {
    return task.dueDate ? TASK_VITAL_EVENTS.addScheduled : TASK_VITAL_EVENTS.add;
  }
  if (eventName === 'reopen') return TASK_VITAL_EVENTS.reopen;
  if (eventName === 'prioritize') return TASK_VITAL_EVENTS.prioritize;
  if (eventName === 'delete') {
    const relieved = options.previousLoad === 'overload'
      || Number(options.previousPendingCount || 0) > TASK_ACTIVE_LIMIT;
    return relieved ? TASK_VITAL_EVENTS.delete.relief : TASK_VITAL_EVENTS.delete.normal;
  }
  if (eventName !== 'complete') return null;

  const priority = ['high', 'medium', 'low'].includes(task.priority) ? task.priority : 'medium';
  const base = TASK_VITAL_EVENTS.complete[priority] || TASK_VITAL_EVENTS.complete.medium;
  if (!options.allDone) return base;

  const bonus = TASK_VITAL_EVENTS.complete.allDoneBonus;
  return {
    delta: mergeVitalDeltas(base.delta, bonus.delta),
    reason: bonus.reason
  };
}

function recordTaskCompletionFeedback(task = {}) {
  lastTaskCompletionText = String(task?.text || '这项任务').trim() || '这项任务';
  lastTaskCompletionAt = Date.now();
}

function clearTaskCompletionFeedback(task = {}) {
  const text = String(task?.text || '').trim();
  if (!text || text === lastTaskCompletionText) {
    lastTaskCompletionText = '';
    lastTaskCompletionAt = 0;
  }
}

function taskCompletionFeedbackActive(now = Date.now()) {
  return Boolean(lastTaskCompletionText)
    && now - lastTaskCompletionAt < TASK_COMPLETION_FEEDBACK_MS;
}

function taskCompletionCueText() {
  if (!taskCompletionFeedbackActive()) return '';
  return `刚完成：${shortTaskText({ text: lastTaskCompletionText })}`;
}

function recordTaskReopenFeedback(task = {}) {
  lastTaskReopenText = String(task?.text || '这项任务').trim() || '这项任务';
  lastTaskReopenAt = Date.now();
}

function clearTaskReopenFeedback(task = {}) {
  const text = String(task?.text || '').trim();
  if (!text || text === lastTaskReopenText) {
    lastTaskReopenText = '';
    lastTaskReopenAt = 0;
  }
}

function taskReopenFeedbackActive(now = Date.now()) {
  return Boolean(lastTaskReopenText)
    && now - lastTaskReopenAt < TASK_REOPEN_FEEDBACK_MS;
}

function taskReopenCueText() {
  if (!taskReopenFeedbackActive()) return '';
  return `重新待办：${shortTaskText({ text: lastTaskReopenText })}`;
}

function applyTaskVitalEvent(eventName, task = {}, options = {}) {
  const effect = taskVitalEffect(eventName, task, options);
  if (!effect) return null;
  if (eventName === 'complete') {
    recordTaskCompletionFeedback(task);
    clearTaskReopenFeedback(task);
  }
  if (eventName === 'reopen') {
    clearTaskCompletionFeedback(task);
    recordTaskReopenFeedback(task);
  }
  applyPetVitalsDelta(effect.delta, effect.reason, {
    focus: effect.focus,
    focusSource: 'tasks'
  });
  if (eventName === 'complete' || eventName === 'reopen') renderTaskList();
  return effect;
}

function applyTaskSurfaceVitalEvent({ force = false } = {}) {
  const load = taskLoadState();
  const effect = TASK_SURFACE_VITAL_EVENTS[load] || TASK_SURFACE_VITAL_EVENTS.normal;
  const now = Date.now();
  if (!force && lastTaskSurfaceVitalKey === load && now - lastTaskSurfaceVitalAt < TASK_SURFACE_VITAL_COOLDOWN_MS) {
    recordPetVitalsFeedback(TASK_SURFACE_REPEAT_REASONS[load] || effect.reason, {
      focus: TASK_SURFACE_REPEAT_FOCUS[load] || 'bond',
      focusSource: 'tasks'
    });
    return { ...effect, load, applied: false, repeat: true };
  }

  lastTaskSurfaceVitalKey = load;
  lastTaskSurfaceVitalAt = now;
  applyPetVitalsDelta(effect.delta, effect.reason, {
    focus: TASK_SURFACE_REPEAT_FOCUS[load] || 'bond',
    focusSource: 'tasks'
  });
  return { ...effect, load, applied: true };
}

function applyChatVitalEvent(eventName, { force = false } = {}) {
  const effect = CHAT_VITAL_EVENTS[eventName];
  if (!effect) return null;

  const now = Date.now();
  const cooldown = CHAT_VITAL_COOLDOWN_MS[eventName] || 0;
  lastChatVitalEventName = eventName;
  if (!force && lastChatVitalAt[eventName] && now - lastChatVitalAt[eventName] < cooldown) {
    recordPetVitalsFeedback(CHAT_VITAL_REPEAT_REASONS[eventName] || effect.reason, {
      focus: 'bond',
      focusSource: 'chat'
    });
    return { ...effect, applied: false, repeat: true };
  }

  lastChatVitalAt[eventName] = now;
  applyPetVitalsDelta(effect.delta, effect.reason, {
    focus: 'bond',
    focusSource: 'chat'
  });
  return { ...effect, applied: true };
}

function touchVitalEffect({ force = false } = {}) {
  const now = Date.now();
  if (!force && lastTouchVitalAt && now - lastTouchVitalAt < TOUCH_VITAL_COOLDOWN_MS) {
    return { key: 'repeat', applied: false, ...TOUCH_VITAL_EVENTS.repeat };
  }

  const vibe = petVibe();
  const key = TOUCH_VITAL_EVENTS[vibe] ? vibe : 'steady';
  lastTouchVitalAt = now;
  return { key, applied: true, ...TOUCH_VITAL_EVENTS[key] };
}

function touchVitalFocus(effect = {}) {
  return VITAL_LABELS[effect.focus] ? effect.focus : 'bond';
}

function settingsVitalEffect(previousSettings = {}, nextSettings = {}, { force = false } = {}) {
  const previousIntensity = previousSettings.petBehaviorIntensity || 'normal';
  const nextIntensity = nextSettings.petBehaviorIntensity || 'normal';
  const key = previousIntensity !== nextIntensity ? nextIntensity : 'saved';
  const now = Date.now();

  if (!force && lastSettingsVitalKey === key && now - lastSettingsVitalAt < SETTINGS_VITAL_COOLDOWN_MS) {
    return { key: 'repeat', applied: false, ...SETTINGS_VITAL_EVENTS.repeat };
  }

  lastSettingsVitalKey = key;
  lastSettingsVitalAt = now;
  return { key, applied: true, ...(SETTINGS_VITAL_EVENTS[key] || SETTINGS_VITAL_EVENTS.saved) };
}

function applySettingsVitalEvent(previousSettings, nextSettings, options = {}) {
  const effect = settingsVitalEffect(previousSettings, nextSettings, options);
  const focus = SETTINGS_VITAL_FOCUS[effect.key] || 'bond';
  if (effect.applied) {
    applyPetVitalsDelta(effect.delta, effect.reason, {
      focus,
      focusSource: 'settings'
    });
  } else {
    recordPetVitalsFeedback(effect.reason, {
      focus,
      focusSource: 'settings'
    });
  }
  setPetAction(effect.action, effect.text);
  return effect;
}

function applySettingsSurfaceVitalEvent({ force = false } = {}) {
  const now = Date.now();
  if (!force && lastSettingsSurfaceVitalAt && now - lastSettingsSurfaceVitalAt < SETTINGS_SURFACE_VITAL_COOLDOWN_MS) {
    recordPetVitalsFeedback(SETTINGS_SURFACE_REPEAT_REASON, {
      focus: 'bond',
      focusSource: 'settings'
    });
    return { ...SETTINGS_SURFACE_VITAL_EVENT, applied: false, repeat: true };
  }

  lastSettingsSurfaceVitalAt = now;
  applyPetVitalsDelta(SETTINGS_SURFACE_VITAL_EVENT.delta, SETTINGS_SURFACE_VITAL_EVENT.reason, {
    focus: 'bond',
    focusSource: 'settings'
  });
  return { ...SETTINGS_SURFACE_VITAL_EVENT, applied: true };
}

function reviewNumber(review, key) {
  return Math.max(0, Math.round(Number(review?.[key]) || 0));
}

function reviewTopAppsText(review = {}) {
  const apps = Array.isArray(review.topApps) ? review.topApps : [];
  return apps
    .filter(item => Array.isArray(item) && item[0])
    .slice(0, 3)
    .map(([app, count]) => `${app}×${Math.max(0, Math.round(Number(count) || 0))}`)
    .join('、') || '暂无';
}


const REVIEW_STATUS_META = {
  work: { label: '专注', className: 'work' },
  distracted: { label: '分心', className: 'distracted' },
  unknown: { label: '未知', className: 'unknown' },
  permission: { label: '权限', className: 'permission' }
};

function reviewStatusItems(review = {}) {
  if (Array.isArray(review.statusBreakdown) && review.statusBreakdown.length) {
    return review.statusBreakdown.map(item => ({
      status: item.status,
      label: REVIEW_STATUS_META[item.status]?.label || item.status,
      className: REVIEW_STATUS_META[item.status]?.className || 'unknown',
      minutes: Math.max(0, Math.round(Number(item.minutes) || 0)),
      ratio: Math.max(0, Math.round(Number(item.ratio) || 0))
    }));
  }
  const total = reviewNumber(review, 'workMinutes') + reviewNumber(review, 'distractedMinutes') + reviewNumber(review, 'unknownMinutes');
  return [
    ['work', reviewNumber(review, 'workMinutes')],
    ['distracted', reviewNumber(review, 'distractedMinutes')],
    ['unknown', reviewNumber(review, 'unknownMinutes')]
  ].map(([status, minutes]) => ({
    status,
    label: REVIEW_STATUS_META[status].label,
    className: REVIEW_STATUS_META[status].className,
    minutes,
    ratio: total ? Math.round((minutes / total) * 100) : 0
  }));
}

function reviewFocusScore(review = {}) {
  if (Number.isFinite(Number(review.focusScore))) return Math.max(0, Math.min(100, Math.round(Number(review.focusScore))));
  const work = reviewNumber(review, 'workMinutes');
  const distracted = reviewNumber(review, 'distractedMinutes');
  return work + distracted ? Math.round((work / (work + distracted)) * 100) : 0;
}

function reviewStatusTotalMinutes(review = {}) {
  return reviewStatusItems(review).reduce((sum, item) => sum + item.minutes, 0);
}

function reviewTopAppDetails(review = {}) {
  if (Array.isArray(review.topAppDetails) && review.topAppDetails.length) return review.topAppDetails.slice(0, 5);
  const totalSamples = Math.max(1, reviewNumber(review, 'samples'));
  return (Array.isArray(review.topApps) ? review.topApps : []).slice(0, 5).map(([app, count]) => ({
    app,
    samples: Math.max(0, Math.round(Number(count) || 0)),
    minutes: Math.max(0, Math.round(Number(count) || 0)) * (reviewNumber(review, 'minutesPerSample') || 10),
    ratio: Math.round((Math.max(0, Math.round(Number(count) || 0)) / totalSamples) * 100)
  }));
}

function createReviewEmptyChart(text) {
  const empty = document.createElement('div');
  empty.className = 'review-chart-empty';
  empty.textContent = text;
  return empty;
}

function renderReviewFocusCard(review = {}) {
  const card = document.createElement('section');
  card.className = 'review-focus-card';
  const score = reviewFocusScore(review);
  const scoreNode = document.createElement('strong');
  scoreNode.textContent = `${score}`;
  const suffix = document.createElement('span');
  suffix.textContent = '专注分';
  const meta = document.createElement('small');
  meta.textContent = reviewStatusTotalMinutes(review)
    ? `近 ${review.windowHours || 24}h · ${reviewStatusTotalMinutes(review)} 分钟有效记录`
    : '还没有足够记录，继续陪跑后会更准';
  card.append(scoreNode, suffix, meta);
  return card;
}

function renderReviewDonut(review = {}) {
  const items = reviewStatusItems(review);
  const total = items.reduce((sum, item) => sum + item.minutes, 0);
  const card = document.createElement('section');
  card.className = 'review-chart-card review-donut-card';
  const title = document.createElement('strong');
  title.textContent = '状态占比';
  if (!total) {
    card.append(title, createReviewEmptyChart('暂无专注记录'));
    return card;
  }
  let cursor = 0;
  const angles = {};
  for (const item of items) {
    cursor += (item.minutes / total) * 360;
    angles[item.status] = `${Math.round(cursor)}deg`;
  }
  const donut = document.createElement('div');
  donut.className = 'review-donut';
  donut.style.setProperty('--work-angle', angles.work || '0deg');
  donut.style.setProperty('--distracted-angle', angles.distracted || angles.work || '0deg');
  donut.style.setProperty('--unknown-angle', angles.unknown || angles.distracted || angles.work || '0deg');
  donut.style.setProperty('--permission-angle', angles.permission || '360deg');
  const center = document.createElement('span');
  const centerScore = document.createElement('b');
  centerScore.textContent = String(reviewFocusScore(review));
  const centerLabel = document.createElement('small');
  centerLabel.textContent = '分';
  center.append(centerScore, centerLabel);
  donut.appendChild(center);
  const legend = document.createElement('div');
  legend.className = 'review-chart-legend';
  for (const item of items.filter(item => item.minutes > 0)) {
    const row = document.createElement('span');
    row.className = `review-legend-item ${item.className}`;
    row.textContent = `${item.label} ${item.ratio}%`;
    legend.appendChild(row);
  }
  card.append(title, donut, legend);
  return card;
}

function hourlyBucketTotal(bucket = {}) {
  return reviewNumber(bucket, 'workMinutes')
    + reviewNumber(bucket, 'distractedMinutes')
    + reviewNumber(bucket, 'unknownMinutes')
    + reviewNumber(bucket, 'permissionMinutes');
}

function renderReviewHourlyChart(review = {}) {
  const card = document.createElement('section');
  card.className = 'review-chart-card review-hourly-card';
  const title = document.createElement('strong');
  title.textContent = '24h 节奏';
  const buckets = Array.isArray(review.hourly) ? review.hourly : [];
  const maxMinutes = Math.max(10, ...buckets.map(hourlyBucketTotal));
  if (!buckets.length || !buckets.some(hourlyBucketTotal)) {
    card.append(title, createReviewEmptyChart('暂无小时分布'));
    return card;
  }
  const chart = document.createElement('div');
  chart.className = 'review-hourly-chart';
  buckets.forEach((bucket, index) => {
    const total = hourlyBucketTotal(bucket);
    const cell = document.createElement('div');
    cell.className = 'review-hour';
    const bar = document.createElement('div');
    bar.className = 'review-hour-bar';
    bar.title = `${bucket.label || ''} · ${total} 分钟`;
    bar.style.height = `${Math.max(total ? 10 : 3, Math.round((total / maxMinutes) * 100))}%`;
    for (const status of ['permission', 'unknown', 'distracted', 'work']) {
      const minutes = reviewNumber(bucket, `${status}Minutes`);
      if (!minutes) continue;
      const segment = document.createElement('i');
      segment.className = `review-hour-segment ${REVIEW_STATUS_META[status]?.className || status}`;
      segment.style.height = `${Math.max(12, Math.round((minutes / total) * 100))}%`;
      bar.appendChild(segment);
    }
    const label = document.createElement('small');
    label.textContent = index % 6 === 0 || index === buckets.length - 1 ? String(bucket.label || '').slice(0, 2) : '';
    cell.append(bar, label);
    chart.appendChild(cell);
  });
  card.append(title, chart);
  return card;
}

function renderReviewTopAppsChart(review = {}) {
  const card = document.createElement('section');
  card.className = 'review-chart-card review-app-card';
  const title = document.createElement('strong');
  title.textContent = 'Top App';
  const apps = reviewTopAppDetails(review);
  if (!apps.length) {
    card.append(title, createReviewEmptyChart('暂无 App 数据'));
    return card;
  }
  const list = document.createElement('div');
  list.className = 'review-app-list';
  const maxMinutes = Math.max(10, ...apps.map(item => Math.max(0, Math.round(Number(item.minutes) || 0))));
  for (const item of apps) {
    const row = document.createElement('div');
    row.className = 'review-app-row';
    const name = document.createElement('span');
    name.textContent = item.app || '未知 App';
    const value = document.createElement('b');
    const minutes = Math.max(0, Math.round(Number(item.minutes) || 0));
    value.textContent = `${minutes}m`;
    const track = document.createElement('i');
    const bar = document.createElement('em');
    bar.style.width = `${Math.max(6, Math.round((minutes / maxMinutes) * 100))}%`;
    track.appendChild(bar);
    row.append(name, value, track);
    list.appendChild(row);
  }
  card.append(title, list);
  return card;
}

function renderReviewCharts(review = {}) {
  const charts = document.createElement('div');
  charts.className = 'review-charts';
  charts.append(
    renderReviewFocusCard(review),
    renderReviewDonut(review),
    renderReviewHourlyChart(review),
    renderReviewTopAppsChart(review)
  );
  return charts;
}

function reviewSignature(review = {}) {
  return [
    new Date().toISOString().slice(0, 10),
    reviewNumber(review, 'samples'),
    reviewNumber(review, 'workMinutes'),
    reviewNumber(review, 'distractedMinutes'),
    reviewNumber(review, 'unknownMinutes'),
    reviewTopAppsText(review)
  ].join('|');
}

function reviewVitalEffect(review = {}) {
  const samples = reviewNumber(review, 'samples');
  const workMinutes = reviewNumber(review, 'workMinutes');
  const distractedMinutes = reviewNumber(review, 'distractedMinutes');
  const unknownMinutes = reviewNumber(review, 'unknownMinutes');
  const knownMinutes = workMinutes + distractedMinutes;
  const totalMinutes = knownMinutes + unknownMinutes;
  const focusRatio = knownMinutes ? workMinutes / knownMinutes : 0;
  const distractedRatio = knownMinutes ? distractedMinutes / knownMinutes : 0;
  let key = 'balanced';

  if (samples < 3 || totalMinutes < 10) key = 'quiet';
  else if (workMinutes >= 45 && focusRatio >= 0.65) key = 'focused';
  else if (distractedMinutes >= 15 && distractedRatio >= 0.35) key = 'distracted';

  return {
    key,
    ...REVIEW_VITAL_EVENTS[key],
    focusRatio,
    distractedRatio
  };
}

function reviewNextStep(effect = reviewVitalEffect()) {
  if (taskLoadState() === 'clear') {
    return {
      kind: 'care',
      action: 'rest',
      label: '休息',
      text: '今天收尾了，先休息 5 分钟。',
      reason: '清单已清空',
      title: '执行推荐：休息'
    };
  }

  if (effect.key === 'focused') {
    return {
      kind: 'surface',
      action: 'tasks',
      label: '看任务',
      text: '节奏不错，挑下一件小任务继续。',
      reason: '专注节奏不错',
      title: '打开今日任务'
    };
  }

  if (effect.key === 'distracted') {
    return {
      kind: 'surface',
      action: 'tasks',
      label: '回任务',
      text: '分心偏多，回到第一项收住节奏。',
      reason: '分心偏多',
      title: '打开今日任务'
    };
  }

  if (effect.key === 'quiet') {
    return {
      kind: 'surface',
      action: 'tasks',
      label: '写任务',
      text: '记录还少，先写下一件小任务。',
      reason: '记录还少',
      title: '打开今日任务'
    };
  }

  return {
    kind: 'surface',
    action: 'tasks',
    label: '看任务',
    text: '节奏正常，选一件小任务稳住。',
    reason: '节奏平衡',
    title: '打开今日任务'
  };
}

function reviewLlmOk(review = {}) {
  return Boolean(review?.llm?.ok);
}

function reviewLlmSummary(review = {}, effect = reviewVitalEffect(review)) {
  return reviewLlmOk(review) && review.llm.summary ? review.llm.summary : effect.summary;
}

function reviewLlmTone(review = {}, effect = reviewVitalEffect(review)) {
  const tone = review?.llm?.tone;
  return reviewLlmOk(review) && ['focused', 'balanced', 'distracted', 'quiet'].includes(tone) ? tone : effect.key;
}

function reviewLlmNextStep(review = {}, effect = reviewVitalEffect(review)) {
  const localStep = reviewNextStep(effect);
  const llmStep = review?.llm?.nextAction;
  if (!reviewLlmOk(review) || !llmStep) return localStep;
  const kind = llmStep.kind === 'care' ? 'care' : 'surface';
  const action = kind === 'care' ? (llmStep.action || localStep.action) : 'tasks';
  return {
    kind,
    action,
    label: llmStep.label || localStep.label,
    text: llmStep.text || localStep.text,
    reason: llmStep.reason || localStep.reason,
    title: llmStep.title || localStep.title
  };
}

function loadReviewVitalReceipt() {
  try {
    const saved = JSON.parse(localStorage.getItem(REVIEW_VITAL_STORAGE_KEY) || '{}');
    return saved && typeof saved === 'object' ? saved : {};
  } catch {
    return {};
  }
}

function applyReviewVitalEvent(review = {}) {
  const effect = reviewVitalEffect(review);
  const signature = reviewSignature(review);
  const receipt = loadReviewVitalReceipt();
  if (receipt.signature === signature) {
    recordPetVitalsFeedback(REVIEW_VITAL_REPEAT_REASONS[effect.key] || effect.reason, {
      focus: REVIEW_VITAL_REPEAT_FOCUS[effect.key] || 'bond',
      focusSource: 'review'
    });
    return { ...effect, applied: false, repeat: true };
  }

  applyPetVitalsDelta(effect.delta, effect.reason, {
    focus: REVIEW_VITAL_REPEAT_FOCUS[effect.key] || 'bond',
    focusSource: 'review'
  });
  try {
    localStorage.setItem(REVIEW_VITAL_STORAGE_KEY, JSON.stringify({
      signature,
      key: effect.key,
      at: new Date().toISOString()
    }));
  } catch {}
  return { ...effect, applied: true };
}

function updatePetStats() {
  const vibe = petVibe();
  const mood = moodStage();
  const energy = energyStage();
  const stage = bondStage();
  const nextStep = petNextStep();
  const nextStepPreview = careGuidancePreviewText(nextStep);
  const nextStepPreviewDetail = careGuidancePreviewDetailText(nextStep);
  const nextStepPreviewDisplay = careGuidancePreviewDisplayText(nextStep, nextStepPreview);
  const nextStepPreviewTitle = careGuidancePreviewTitleText(nextStep, nextStepPreview, nextStepPreviewDetail);
  const nextStepDetail = careGuidanceDetailText(nextStep);
  const nextStepActionTitle = careGuidanceActionTitle(nextStep, nextStepPreview, nextStepPreviewDetail);
  const nextStepReasonTitle = careGuidanceReasonTitle(nextStep);
  const nextStepPreviewAriaLabel = careGuidancePreviewAriaLabel(nextStepPreviewDisplay, nextStepPreviewTitle);
  const needContext = vitalNeedContext();
  const compound = needContext.compound;
  const needOrder = needContext.needOrder;
  const feedbackText = petFeedbackText(stage, needContext, nextStep);
  const rowHints = {
    mood: vitalRowHint('mood'),
    energy: vitalRowHint('energy'),
    bond: vitalRowHint('bond')
  };
  const rowProgress = {
    mood: vitalProgress('mood'),
    energy: vitalProgress('energy'),
    bond: vitalProgress('bond')
  };
  pet.dataset.vibe = vibe;
  petStats.mood.textContent = petVitals.mood;
  petStats.energy.textContent = petVitals.energy;
  petStats.bond.textContent = petVitals.bond;
  petStats.moodLabel.textContent = `心情·${mood.label}`;
  petStats.energyLabel.textContent = `精力·${energy.label}`;
  petStats.bondLabel.textContent = `亲密·${stage.label}`;
  petStats.summary.textContent = vitalsSummary(nextStep);
  petStats.cue.textContent = careCueText(nextStep);
  petStats.panel.title = feedbackText;
  petStats.reason.textContent = feedbackText;
  const sourceKey = petVitalsSourceKey();
  const sourceText = petVitalsSourceText(sourceKey);
  const sourceTitle = petVitalsSourceTitle(sourceKey);
  petStats.source.textContent = sourceText;
  petStats.source.hidden = !sourceText;
  petStats.source.title = sourceTitle;
  petStats.recent.textContent = compactCareRecentText();
  petStats.recent.hidden = !petStats.recent.textContent;
  petStats.recent.title = petVitalsMilestone || petVitalsReason || '';
  const deltaDetail = vitalDeltaText(petVitalsDelta);
  const deltaText = careFeedbackImpactText(petVitalsDelta, petVitalsFocus);
  const deltaTitle = deltaDetail === '状态稳定' && deltaText !== '状态稳定' ? deltaText : deltaDetail;
  const deltaAriaText = careFeedbackDeltaAriaText(deltaText, deltaTitle);
  petStats.delta.textContent = deltaText;
  petStats.delta.title = deltaTitle;
  const feedbackAriaLabel = careFeedbackAriaLabel(feedbackText, deltaAriaText, sourceText, petStats.recent.textContent);
  petStats.feedback.title = feedbackAriaLabel;
  petStats.feedback.setAttribute('aria-label', feedbackAriaLabel);
  petStats.next.textContent = nextStep.text;
  petStats.why.textContent = nextStep.reason || '';
  petStats.why.hidden = !nextStep.reason;
  petStats.why.title = nextStepReasonTitle;
  if (nextStepReasonTitle) petStats.why.setAttribute('aria-label', nextStepReasonTitle);
  else petStats.why.removeAttribute('aria-label');
  petStats.detail.textContent = nextStepDetail;
  petStats.detail.hidden = !nextStepDetail;
  petStats.detail.title = nextStepDetail;
  if (nextStepDetail) petStats.detail.setAttribute('aria-label', `照顾理由：${nextStepDetail}`);
  else petStats.detail.removeAttribute('aria-label');
  petStats.preview.textContent = nextStepPreviewDisplay;
  petStats.preview.hidden = !nextStepPreviewDisplay;
  petStats.preview.title = nextStepPreviewTitle || nextStepPreviewDisplay;
  if (nextStepPreviewAriaLabel) petStats.preview.setAttribute('aria-label', nextStepPreviewAriaLabel);
  else petStats.preview.removeAttribute('aria-label');
  petStats.preview.dataset.tone = nextStepPreview && nextStep.kind === 'care'
    ? vitalDeltaTone(careActionEffect(nextStep.action)?.delta || {})
    : 'neutral';
  petStats.now.textContent = nextStep.label;
  petStats.now.title = nextStepActionTitle;
  petStats.now.setAttribute('aria-label', nextStepActionTitle);
  petStats.now.dataset.kind = nextStep.kind;
  petStats.now.dataset.action = nextStep.action;
  petStats.guidance.dataset.kind = nextStep.kind;
  petStats.guidance.dataset.action = nextStep.action;
  petStats.guidance.dataset.reason = nextStep.reason || '';
  petStats.guidance.dataset.detail = nextStepDetail;
  updateVitalFocusAction(nextStep);
  petStats.feedback.dataset.tone = vitalDeltaTone(petVitalsDelta);
  petStats.feedback.dataset.milestone = petVitalsMilestone ? 'true' : 'false';
  petStats.feedback.dataset.milestoneTone = petVitalsMilestone ? petVitalsMilestoneTone : 'neutral';
  petStats.panel.dataset.mood = vitalTone(petVitals.mood);
  petStats.panel.dataset.energy = vitalTone(petVitals.energy);
  petStats.panel.dataset.bond = vitalTone(petVitals.bond);
  petStats.panel.dataset.focus = petVitalsFocus || '';
  petStats.panel.dataset.focusSource = petVitalsFocusSource || '';
  petStats.feedback.dataset.focus = petVitalsFocus || '';
  petStats.feedback.dataset.focusSource = petVitalsFocusSource || '';
  petStats.feedback.dataset.source = sourceKey;
  petStats.feedback.dataset.sourceDetail = petVitalsSourceDetail(sourceKey)?.text || '';
  petStats.panel.dataset.vibe = vibe;
  petStats.panel.dataset.moodStage = mood.key;
  petStats.panel.dataset.energyStage = energy.key;
  petStats.panel.dataset.bondStage = stage.key;
  petStats.rows.mood.dataset.stage = mood.key;
  petStats.rows.energy.dataset.stage = energy.key;
  petStats.rows.bond.dataset.stage = stage.key;
  for (const [kind, hint] of Object.entries(rowHints)) {
    const needIndex = needOrder.indexOf(kind);
    const needState = needIndex === 0 ? 'primary' : compound.fragile && needIndex > 0 ? 'support' : 'stable';
    const focused = petVitalsFocus === kind;
    const accessibleHint = vitalAccessibleHint(hint, needState, focused);
    const target = petStats[`${kind}Target`];
    const targetText = needState === 'stable' || vitalDeltaBadgeText(petVitalsDelta[kind])
      ? ''
      : vitalTargetBadgeText(rowProgress[kind]);
    petStats.rows[kind].dataset.need = needState;
    petStats.rows[kind].dataset.focus = focused ? 'true' : 'false';
    petStats.rows[kind].title = accessibleHint;
    petStats.rows[kind].setAttribute('aria-label', petStats.rows[kind].title);
    petStats.rows[kind].setAttribute('aria-pressed', String(focused));
    const chip = petStats.chips[kind];
    if (chip) {
      chip.textContent = vitalChipText(rowProgress[kind], needState, focused);
      chip.dataset.stage = rowProgress[kind]?.stage.key || '';
      chip.dataset.need = needState;
      chip.dataset.focus = focused ? 'true' : 'false';
      const chipTitle = vitalChipTitle(accessibleHint, kind, rowProgress[kind]);
      chip.title = chipTitle;
      chip.setAttribute('aria-label', chipTitle);
      chip.setAttribute('aria-pressed', String(focused));
    }
    if (target) {
      target.textContent = targetText;
      target.hidden = !targetText;
      target.title = targetText ? rowProgress[kind]?.stage.nextLabel ? `再提升 ${rowProgress[kind].remaining} 到${rowProgress[kind].stage.nextLabel}` : '' : '';
    }
  }
  setVitalBar(petStats.moodBar, petVitals.mood, petVitalsDelta.mood);
  setVitalBar(petStats.energyBar, petVitals.energy, petVitalsDelta.energy);
  setVitalBar(petStats.bondBar, petVitals.bond, petVitalsDelta.bond);
  updateHomeCareAction();
  renderCareMenu();
}

function priorityLabel(priority) {
  return { high: '高', medium: '中', low: '低' }[priority] || '中';
}

function priorityClass(priority) {
  return `priority-${['high', 'medium', 'low'].includes(priority) ? priority : 'medium'}`;
}

function focusSceneTemplateApi() {
  return window.focusPetSceneTemplates || null;
}

function renderFocusSceneTemplateOptions() {
  const api = focusSceneTemplateApi();
  const templates = api?.getFocusSceneTemplates ? api.getFocusSceneTemplates() : [];
  newTaskScene.replaceChildren();
  const fallback = document.createElement('option');
  fallback.value = '';
  fallback.textContent = '场景';
  newTaskScene.appendChild(fallback);
  for (const template of templates) {
    const option = document.createElement('option');
    option.value = template.id;
    option.textContent = `${template.label} · ${template.reminderMinutes}分`;
    newTaskScene.appendChild(option);
  }
}

function selectedFocusSceneTemplate() {
  const api = focusSceneTemplateApi();
  return api?.findFocusSceneTemplate ? api.findFocusSceneTemplate(newTaskScene.value) : null;
}

function taskMetadataText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function taskBlockedReason(task = {}) {
  return taskMetadataText(task.blockedBy);
}

function taskSelectionRank(task = {}) {
  return {
    selected: Boolean(task.selected) ? 1 : 0,
    pinned: Boolean(task.pinned) ? 1 : 0,
    priority: TASK_PRIORITY_RANK[task.priority] || TASK_PRIORITY_RANK.medium,
    dueDate: task.dueDate || '9999-12-31',
    hasNextAction: Boolean(taskMetadataText(task.nextAction)) ? 1 : 0,
    order: Number.isFinite(task.order) ? task.order : Number.MAX_SAFE_INTEGER
  };
}

function taskSelectionReasonText(task = {}) {
  if (task.selected) return '手动选中';
  if (task.pinned) return '置顶任务';
  if (taskMetadataText(task.nextAction)) return `下一步：${taskMetadataText(task.nextAction)}`;
  if (task.dueDate) return `截止：${task.dueDate}`;
  return `${priorityLabel(task.priority)}优先级`;
}

async function selectCurrentTask(item) {
  const selected = await window.focusPet.selectTask(item.id);
  await reloadTasks();
  message.textContent = selected
    ? taskWatchText('已设为当前任务，')
    : taskWatchText('这项暂时不能设为当前任务，');
}

function compareTaskSelection(left, right) {
  const leftRank = taskSelectionRank(left);
  const rightRank = taskSelectionRank(right);
  if (leftRank.selected !== rightRank.selected) return rightRank.selected - leftRank.selected;
  if (leftRank.pinned !== rightRank.pinned) return rightRank.pinned - leftRank.pinned;
  if (leftRank.priority !== rightRank.priority) return rightRank.priority - leftRank.priority;
  if (leftRank.dueDate !== rightRank.dueDate) return leftRank.dueDate.localeCompare(rightRank.dueDate);
  if (leftRank.hasNextAction !== rightRank.hasNextAction) return rightRank.hasNextAction - leftRank.hasNextAction;
  return leftRank.order - rightRank.order;
}

function syncTaskEditor() {
  const rows = taskItems
    .filter(item => item.text.trim())
    .map(item => {
      const meta = [];
      if (item.priority && item.priority !== 'medium') meta.push(item.priority);
      if (item.priority === 'medium' && item.dueDate) meta.push(item.priority);
      if (item.dueDate) meta.push(`due:${item.dueDate}`);
      return `- [${item.done ? 'x' : ' '}]${meta.length ? ` (${meta.join(', ')})` : ''} ${item.text.trim()}`;
    });
  tasksArea.value = `# 今日任务\n\n${rows.join('\n')}${rows.length ? '\n' : ''}`;
}

function updateTaskProgress() {
  const doneCount = taskItems.filter(item => item.done).length;
  const pendingCount = taskItems.length - doneCount;
  const overflowCount = Math.max(0, pendingCount - TASK_ACTIVE_LIMIT);
  taskProgress.textContent = taskItems.length
    ? `${doneCount}/${taskItems.length} 完成 · ${pendingCount} 待办${overflowCount ? ` · 超出 ${overflowCount}` : ''}`
    : '0/0 完成';
  taskProgress.title = overflowCount
    ? `待办 ${pendingCount} 个，超过建议上限 ${TASK_ACTIVE_LIMIT} 个`
    : `待办 ${pendingCount} 个`;
  syncTaskSurfaceState();
}

function pendingTaskCount() {
  return taskItems.filter(item => !item.done).length;
}

function taskLoadState() {
  const pendingCount = pendingTaskCount();
  if (taskItems.length === 0) return 'empty';
  if (pendingCount === 0) return 'clear';
  if (pendingCount > TASK_ACTIVE_LIMIT) return 'overload';
  if (pendingCount >= TASK_BUSY_THRESHOLD) return 'busy';
  return 'normal';
}

function taskBehaviorState(load = taskLoadState()) {
  if (activeSurface !== 'tasks') return '';
  if (load === 'empty') return 'empty';
  if (load === 'clear') return 'clear';
  if (load === 'overload') return 'overload';
  if (load === 'busy') return 'busy';
  return currentTaskItem() ? 'watch' : '';
}

function taskSurfacePetAnimation() {
  const behavior = taskBehaviorState();
  if (behavior === 'empty') return 'stretch';
  if (behavior === 'clear') return 'celebrate';
  if (behavior === 'overload' || behavior === 'busy' || behavior === 'watch') return 'busy';
  return SURFACE_ANIMATIONS.tasks;
}

function taskVitalsSummary() {
  const behavior = taskBehaviorState();
  return {
    empty: '在等你写下第一件事',
    clear: '清单清空，适合复盘',
    watch: '正在看着当前任务',
    busy: '任务偏多，守住第一项',
    overload: '待办超限，紧盯第一项'
  }[behavior] || '看着任务面板';
}

function taskCareCueText() {
  const behavior = taskBehaviorState();
  return {
    empty: '先写一件事',
    clear: '可以复盘',
    watch: '盯当前任务',
    busy: '先做第一项',
    overload: '先减负'
  }[behavior] || '陪伴中';
}

function taskAvatarA11yText() {
  const behavior = taskBehaviorState();
  const task = currentTaskItem();
  if (behavior === 'empty') return '看着任务面板，等你写下第一件事';
  if (behavior === 'clear') return '看着已清空的任务，准备陪你复盘';
  if (behavior === 'overload' && task) return `看着屏幕，待办超限，正盯着「${shortTaskText(task)}」`;
  if (behavior === 'busy' && task) return `看着屏幕，任务偏多，先守住「${shortTaskText(task)}」`;
  if (behavior === 'watch' && task) return `看着屏幕，正在陪你推进「${shortTaskText(task)}」`;
  return '看着任务面板';
}

function avatarSurfaceA11yText() {
  if (activeSurface === 'tasks') return taskAvatarA11yText();
  if (activeSurface === 'review') return '看着今日复盘，帮你收住节奏';
  if (activeSurface === 'settings') return '看着设置面板，等你调整提醒';
  if (activeSurface === 'chat') return '守着聊天消息，等你联系好友';
  return 'Nervy 桌面宠物';
}

function updateAvatarA11y() {
  const label = `${avatarSurfaceA11yText()}。${AVATAR_INTERACTION_HINT}`;
  avatar.title = label;
  avatar.setAttribute('aria-label', label);
}

function taskFeedbackLeadText() {
  if (activeSurface !== 'tasks') return '';
  const task = currentTaskItem();
  const behavior = taskBehaviorState();
  if (
    petVitalsFocusSource === 'tasks'
    && (
      petVitalsReason.startsWith('待办已达')
      || petVitalsReason.startsWith('任务减负后')
      || petVitalsReason.startsWith('任务优先级更清楚')
    )
  ) return feedbackReasonText();
  if (behavior === 'empty') return '先写下一件最小任务';
  if (behavior === 'clear') return '清单已清空，适合复盘';
  if (behavior === 'overload' && task) return `待办超限，先守住「${shortTaskText(task)}」`;
  if (behavior === 'busy' && task) return `任务偏多，先推进「${shortTaskText(task)}」`;
  if (behavior === 'watch' && task) return `当前先推进「${shortTaskText(task)}」`;
  return '';
}

function syncTaskSurfaceState() {
  const load = taskLoadState();
  const behavior = taskBehaviorState(load);
  const task = currentTaskItem();
  const screenWatch = ['watch', 'busy', 'overload'].includes(behavior);
  pet.dataset.taskLoad = load;
  taskSummary.dataset.load = load;
  if (behavior) pet.dataset.taskBehavior = behavior;
  else delete pet.dataset.taskBehavior;
  if (screenWatch) pet.dataset.taskActivity = 'screen-watch';
  else delete pet.dataset.taskActivity;
  if (screenWatch && task) pet.dataset.taskTarget = shortTaskText(task);
  else delete pet.dataset.taskTarget;
  pet.classList.toggle('task-watch', screenWatch);
  updateAvatarA11y();
}

function currentTaskItem() {
  return [...taskItems]
    .filter(item => !item.done && !taskBlockedReason(item))
    .sort(compareTaskSelection)[0] || null;
}

function taskWatchText(prefix = '') {
  const task = currentTaskItem();
  const load = taskLoadState();
  if (task && load === 'overload') return `${prefix}待办超过 ${TASK_ACTIVE_LIMIT} 个，我看着屏幕先盯紧「${task.text}」。`;
  if (task && load === 'busy') return `${prefix}任务偏多，我盯着「${task.text}」先推进一步。`;
  if (task && prefix === '这项完成了，') return `${prefix}它跟着松了一口气，继续盯着「${task.text}」。`;
  if (task && prefix === '已恢复为待办，') return `${prefix}它收住节奏，重新盯着「${task.text}」。`;
  if (task) return `${prefix}我盯着「${task.text}」，先推进一个小步骤。`;
  if (taskItems.length) return `${prefix}今天的任务都完成了，我会放松一点，等你复盘。`;
  return '写下今天最重要的一件事，我会看着任务面板陪你推进。';
}

function taskLoadPetReaction(load = taskLoadState()) {
  return {
    normal: '它会看着屏幕，陪你先推进一小步。',
    busy: '任务有点多，它会收住精力只盯第一项。',
    overload: '屏幕太满会让它紧张，先减掉多余待办。',
    clear: '清单清空后它会放松，亲密也更稳定。'
  }[load] || '';
}

function appendTaskLoadNote(load, labelText, copyText, badgeText = '') {
  const note = document.createElement('div');
  note.className = 'task-load-note';
  note.dataset.load = load;

  const label = document.createElement('b');
  label.textContent = labelText;
  const copy = document.createElement('span');
  copy.textContent = copyText;
  const badge = document.createElement('em');
  badge.textContent = badgeText;
  const completion = document.createElement('strong');
  completion.className = 'task-completion-cue';
  completion.textContent = taskCompletionCueText();
  const reopen = document.createElement('strong');
  reopen.className = 'task-reopen-cue';
  reopen.textContent = taskReopenCueText();
  const reaction = document.createElement('small');
  reaction.textContent = taskLoadPetReaction(load);

  note.append(label, copy);
  if (badge.textContent) note.appendChild(badge);
  if (completion.textContent) note.appendChild(completion);
  if (reopen.textContent) note.appendChild(reopen);
  if (reaction.textContent) note.appendChild(reaction);
  taskList.appendChild(note);
}

function orderedTaskRows(load, currentTask) {
  if (load !== 'overload') {
    return currentTask
      ? [currentTask, ...taskItems.filter(item => item.id !== currentTask.id)]
      : taskItems;
  }

  const pendingRows = taskItems.filter(item => !item.done);
  const focusedRows = currentTask
    ? [currentTask, ...pendingRows.filter(item => item.id !== currentTask.id)]
    : pendingRows;
  const rows = focusedRows.slice(0, TASK_OVERLOAD_VISIBLE_ROWS);
  const hiddenCount = Math.max(0, taskItems.length - rows.length);
  const hiddenPendingCount = Math.max(0, pendingTaskCount() - rows.filter(item => !item.done).length);
  return { rows, hiddenCount, hiddenPendingCount };
}

function appendTaskOverflowNote(hiddenCount, hiddenPendingCount) {
  if (!hiddenCount) return;
  const overflowCount = Math.max(0, pendingTaskCount() - TASK_ACTIVE_LIMIT);
  const note = document.createElement('div');
  note.className = 'task-overflow-note';

  const label = document.createElement('b');
  label.textContent = `收起 ${hiddenCount}`;
  const copy = document.createElement('span');
  copy.textContent = hiddenPendingCount
    ? `还有 ${hiddenPendingCount} 个待办已折叠`
    : '已完成项暂时折叠';
  const hint = document.createElement('small');
  hint.textContent = overflowCount
    ? `超出建议 ${overflowCount} 个，先处理上方任务。`
    : '先处理上方任务，完整清单可用导入查看。';

  note.append(label, copy, hint);
  taskList.appendChild(note);
}

function renderTomorrowPlan(review = {}) {
  const plan = review.tomorrowPlan || {};
  const node = document.createElement('section');
  node.className = 'review-tomorrow';
  if (!Array.isArray(plan.tasks) || !plan.tasks.length) {
    const empty = document.createElement('span');
    empty.textContent = '明日计划会在任务和复盘数据足够后自动生成。';
    node.appendChild(empty);
    return node;
  }

  const header = document.createElement('div');
  header.className = 'review-tomorrow-header';
  const title = document.createElement('strong');
  title.textContent = `${plan.title || '明日计划'} · ${plan.date || '明天'}`;
  const meta = document.createElement('small');
  const completion = plan.completion || {};
  meta.textContent = `完成 ${completion.done || 0}/${completion.total || 0} · 专注分 ${plan.focusScore ?? reviewFocusScore(review)}`;
  header.append(title, meta);

  const summary = document.createElement('p');
  summary.textContent = plan.summary || plan.firstStep || '明天先选一个 25 分钟小步骤。';

  const list = document.createElement('ol');
  list.className = 'review-tomorrow-list';
  plan.tasks.slice(0, 3).forEach(task => {
    const item = document.createElement('li');
    const text = document.createElement('span');
    text.textContent = task.text || '明日任务';
    const badge = document.createElement('em');
    badge.textContent = priorityLabel(task.priority);
    badge.className = priorityClass(task.priority);
    item.append(text, badge);
    list.appendChild(item);
  });

  const actions = document.createElement('div');
  actions.className = 'review-tomorrow-actions';
  const firstStep = document.createElement('span');
  firstStep.textContent = plan.firstStep || '明天第一步：先做 25 分钟。';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = '加入明日任务';
  button.title = '把明日计划加入任务清单，已存在的不会重复添加';
  button.addEventListener('click', () => applyTomorrowPlan(review, button));
  actions.append(firstStep, button);

  node.append(header, summary, list, actions);
  return node;
}

function renderReviewTaskInsights(review = {}) {
  const taskReview = review.taskReview || {};
  const rows = Array.isArray(taskReview.rows) ? taskReview.rows : [];
  if (!rows.length) return null;

  const node = document.createElement('section');
  node.className = 'review-task-insights';
  const header = document.createElement('div');
  header.className = 'review-task-header';
  const title = document.createElement('strong');
  title.textContent = '任务推进';
  const meta = document.createElement('small');
  meta.textContent = taskReview.summary || '任务数据不足，先补一件当前任务。';
  header.append(title, meta);
  node.appendChild(header);

  const list = document.createElement('div');
  list.className = 'review-task-list';
  rows.slice(0, 3).forEach(task => {
    const row = document.createElement('div');
    row.className = 'review-task-row';
    row.dataset.status = task.status || 'open';
    const name = document.createElement('span');
    name.textContent = task.text || '任务';
    const progress = document.createElement('b');
    progress.textContent = task.progressText || '暂无推进记录';
    const friction = document.createElement('small');
    friction.textContent = task.frictionText || '暂无明显阻力';
    row.append(name, progress, friction);
    list.appendChild(row);
  });
  node.appendChild(list);

  const suggestion = Array.isArray(taskReview.suggestions) ? taskReview.suggestions[0] : '';
  if (suggestion) {
    const next = document.createElement('em');
    next.textContent = suggestion;
    node.appendChild(next);
  }
  return node;
}

function renderReviewActionSuggestions(review = {}) {
  const suggestions = Array.isArray(review.actionSuggestions) && review.actionSuggestions.length
    ? review.actionSuggestions
    : Array.isArray(review.actionReview?.suggestions)
      ? review.actionReview.suggestions
      : [];
  const first = suggestions.find(item => item?.text);
  if (!first) return null;

  const node = document.createElement('section');
  node.className = 'review-action-suggestions';
  node.dataset.priority = first.priority || 'medium';
  const label = document.createElement('strong');
  label.textContent = '行动建议';
  const text = document.createElement('span');
  text.textContent = first.text;
  text.title = [first.text, first.reason].filter(Boolean).join(' · ');
  node.append(label, text);
  return node;
}

async function applyTomorrowPlan(review = {}, button) {
  if (!review.tomorrowPlan || !window.focusPet?.applyTomorrowPlan) return;
  const originalText = button?.textContent || '加入明日任务';
  if (button) {
    button.disabled = true;
    button.textContent = '加入中…';
  }
  try {
    const result = await window.focusPet.applyTomorrowPlan(review.tomorrowPlan);
    await reloadTasks();
    const added = result?.addedCount || 0;
    const skipped = result?.skippedCount || 0;
    message.textContent = added
      ? `已加入 ${added} 个明日任务${skipped ? `，跳过 ${skipped} 个重复项` : ''}。`
      : '明日任务已经在清单里了。';
    if (button) button.textContent = added ? '已加入' : '已存在';
    applyTaskVitalEvent('add', { text: '明日计划', priority: 'medium', dueDate: review.tomorrowPlan.date });
  } catch (error) {
    message.textContent = `加入明日任务失败：${error.message}`;
    if (button) button.textContent = originalText;
  } finally {
    if (button) button.disabled = false;
  }
}

function renderReview(review = {}, effect = reviewVitalEffect(review)) {
  const llmOk = reviewLlmOk(review);
  const nextStep = reviewLlmNextStep(review, effect);
  const summaryText = reviewLlmSummary(review, effect);
  const tone = reviewLlmTone(review, effect);
  const rows = [
    ['采样', `${reviewNumber(review, 'samples')} 次`],
    ['工作/学习', `${reviewNumber(review, 'workMinutes')} 分钟`],
    ['疑似分心', `${reviewNumber(review, 'distractedMinutes')} 分钟`],
    ['未知', `${reviewNumber(review, 'unknownMinutes')} 分钟`],
    ['常用 App', reviewTopAppsText(review)]
  ];

  reviewBox.innerHTML = '';
  reviewBox.dataset.llm = String(llmOk);
  const summary = document.createElement('div');
  summary.className = 'review-summary';
  const summaryCopy = document.createElement('span');
  summaryCopy.textContent = summaryText;
  const badge = document.createElement('b');
  badge.dataset.tone = tone;
  badge.textContent = llmOk ? 'StepFun' : (effect.applied ? '已同步状态' : '已同步');
  summary.append(summaryCopy, badge);

  const aiNode = document.createElement('div');
  aiNode.className = 'review-ai';
  if (llmOk) {
    const aiTitle = document.createElement('strong');
    aiTitle.textContent = 'StepFun 复盘';
    const aiCopy = document.createElement('span');
    aiCopy.textContent = review.llm.insight || review.llm.petMessage || summaryText;
    aiNode.append(aiTitle, aiCopy);
  }

  const rowsNode = document.createElement('div');
  rowsNode.className = 'review-rows';
  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'review-row';
    row.dataset.label = label;
    if (label === '常用 App') row.dataset.wide = 'true';
    const labelNode = document.createElement('span');
    labelNode.textContent = label;
    const valueNode = document.createElement('b');
    valueNode.textContent = value;
    row.append(labelNode, valueNode);
    rowsNode.appendChild(row);
  }

  const nextAction = document.createElement('div');
  nextAction.className = 'review-next-action';
  nextAction.dataset.kind = nextStep.kind;
  nextAction.dataset.action = nextStep.action;
  const nextText = document.createElement('span');
  nextText.textContent = nextStep.text;
  const nextReason = document.createElement('small');
  nextReason.textContent = nextStep.reason;
  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.textContent = nextStep.label;
  nextButton.dataset.kind = nextStep.kind;
  nextButton.dataset.action = nextStep.action;
  nextButton.title = nextStep.title;
  nextButton.setAttribute('aria-label', `${nextStep.reason}，${nextStep.label}`);
  nextButton.addEventListener('click', () => {
    if (nextStep.kind === 'surface' && nextStep.action === 'tasks') {
      showTasks();
      return;
    }
    if (nextStep.kind === 'care') runPetAction(nextStep.action);
  });
  nextAction.append(nextText, nextReason, nextButton);

  const chartNode = renderReviewCharts(review);
  const taskInsightsNode = renderReviewTaskInsights(review);
  const actionSuggestionNode = renderReviewActionSuggestions(review);
  const tomorrowNode = renderTomorrowPlan(review);
  const reviewNodes = llmOk ? [summary, aiNode, chartNode, rowsNode] : [summary, chartNode, rowsNode];
  if (taskInsightsNode) reviewNodes.push(taskInsightsNode);
  if (actionSuggestionNode) reviewNodes.push(actionSuggestionNode);
  reviewNodes.push(tomorrowNode, nextAction);
  reviewBox.append(...reviewNodes);
}

function renderTaskList() {
  taskList.innerHTML = '';
  if (taskItems.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'task-empty';
    empty.textContent = '写下今天最重要的一件事，我会看着任务面板陪你推进。';
    taskList.appendChild(empty);
    updateTaskProgress();
    return;
  }
  const currentTask = currentTaskItem();
  const currentTaskId = currentTask?.id;
  const load = taskLoadState();
  const display = orderedTaskRows(load, currentTask);
  const hiddenCount = Array.isArray(display) ? 0 : display.hiddenCount;
  if (load === 'clear') {
    appendTaskLoadNote(load, '已完成', '可以去复盘，或者留一件明天再做。');
  } else if (currentTask) {
    const label = load === 'overload' ? `待办 ${pendingTaskCount()}/${TASK_ACTIVE_LIMIT}` : '正在盯';
    const copy = load === 'overload' ? `先做：${currentTask.text}` : currentTask.text;
    const badge = load === 'overload' && hiddenCount ? `收起 ${hiddenCount}` : '';
    appendTaskLoadNote(load, label, copy, badge);
  }

  const visibleTaskItems = Array.isArray(display) ? display : display.rows;

  visibleTaskItems.forEach(item => {
    const row = document.createElement('article');
    row.className = `task-item ${item.done ? 'done' : ''} ${item.id === currentTaskId ? 'current' : ''}`;
    row.dataset.id = item.id;
    const blockedReason = taskBlockedReason(item);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = item.done;
    checkbox.addEventListener('change', async () => {
      await window.focusPet.toggleTask(item.id, checkbox.checked);
      await reloadTasks();
      const allDone = taskItems.length > 0 && taskItems.every(task => task.done);
      applyTaskVitalEvent(checkbox.checked ? 'complete' : 'reopen', item, { allDone });
      message.textContent = checkbox.checked ? taskWatchText('这项完成了，') : taskWatchText('已恢复为待办，');
    });

    const title = document.createElement('input');
    title.className = 'task-title-input';
    title.value = item.text;
    title.maxLength = 120;
    title.addEventListener('change', async () => {
      await window.focusPet.updateTask(item.id, { text: title.value });
      await reloadTasks();
      message.textContent = taskWatchText('任务标题已更新，');
    });

    const priority = document.createElement('select');
    priority.className = `task-priority ${priorityClass(item.priority)}`;
    for (const [value, label] of [['high', '高'], ['medium', '中'], ['low', '低']]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      priority.appendChild(option);
    }
    priority.value = item.priority || 'medium';
    priority.addEventListener('change', async () => {
      await window.focusPet.updateTask(item.id, { priority: priority.value });
      await reloadTasks();
      const effect = applyTaskVitalEvent('prioritize', item);
      const text = taskWatchText(`优先级已设为${priorityLabel(priority.value)}，`);
      if (effect?.action) setPetAction(effect.action, text);
      else message.textContent = text;
    });

    const due = document.createElement('input');
    due.className = 'task-due';
    due.type = 'date';
    due.value = item.dueDate || '';
    due.addEventListener('change', async () => {
      await window.focusPet.updateTask(item.id, { dueDate: due.value });
      await reloadTasks();
      message.textContent = taskWatchText(due.value ? `截止日期已设为 ${due.value}，` : '已清除截止日期，');
    });

    const selectCurrent = document.createElement('button');
    selectCurrent.type = 'button';
    selectCurrent.className = `task-icon-button ${item.selected ? 'active' : ''}`;
    selectCurrent.textContent = item.selected ? '●' : '○';
    selectCurrent.title = item.selected ? '当前任务' : '设为当前任务';
    selectCurrent.disabled = Boolean(item.done || blockedReason);
    selectCurrent.addEventListener('click', () => selectCurrentTask(item));

    const up = document.createElement('button');
    up.type = 'button';
    up.className = 'task-icon-button';
    up.textContent = '↑';
    up.title = '置顶';
    up.addEventListener('click', async () => {
      await window.focusPet.moveTask(item.id, 'up');
      await reloadTasks();
    });

    const down = document.createElement('button');
    down.type = 'button';
    down.className = 'task-icon-button';
    down.textContent = '↓';
    down.title = '置底';
    down.addEventListener('click', async () => {
      await window.focusPet.moveTask(item.id, 'down');
      await reloadTasks();
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'task-icon-button danger';
    remove.textContent = '×';
    remove.title = '删除';
    remove.addEventListener('click', async () => {
      const previousLoad = taskLoadState();
      const previousPendingCount = pendingTaskCount();
      await window.focusPet.deleteTask(item.id);
      await reloadTasks();
      const effect = applyTaskVitalEvent('delete', item, { previousLoad, previousPendingCount });
      const text = taskWatchText('任务已删除，');
      if (effect?.action) setPetAction(effect.action, text);
      else message.textContent = text;
    });

    const main = document.createElement('div');
    main.className = 'task-main';
    main.append(title);
    const meta = document.createElement('div');
    meta.className = 'task-meta';
    meta.append(priority, due);
    const selectionReason = document.createElement('small');
    selectionReason.className = 'task-selection-reason';
    if (blockedReason) selectionReason.textContent = `阻塞：${blockedReason}`;
    else if (item.id === currentTaskId) selectionReason.textContent = taskSelectionReasonText(item);
    else if (taskMetadataText(item.nextAction)) selectionReason.textContent = `下一步：${taskMetadataText(item.nextAction)}`;
    if (selectionReason.textContent) meta.append(selectionReason);
    main.append(meta);

    const actions = document.createElement('div');
    actions.className = 'task-actions';
    actions.append(selectCurrent, up, down, remove);

    row.append(checkbox, main, actions);
    taskList.appendChild(row);
  });
  if (!Array.isArray(display)) appendTaskOverflowNote(display.hiddenCount, display.hiddenPendingCount);
  updateTaskProgress();
}

function setTaskEditMode(nextEditMode) {
  taskEditMode = nextEditMode;
  taskList.classList.toggle('hidden', taskEditMode);
  taskComposer.classList.toggle('hidden', taskEditMode);
  if (taskEditMode) setTaskComposerFeedback();
  tasksArea.classList.toggle('hidden', !taskEditMode);
  editTasks.textContent = taskEditMode ? '预览' : '导入';
  saveTasks.textContent = taskEditMode ? '导入任务' : '保存状态';
}

function setTaskComposerFeedback(text = '', tone = 'neutral') {
  taskComposerFeedback.textContent = text;
  taskComposerFeedback.hidden = !text;
  taskComposerFeedback.dataset.tone = tone;
  newTaskText.setAttribute('aria-invalid', String(tone === 'error'));
}

async function saveCurrentTasks() {
  if (taskEditMode) {
    await window.focusPet.saveTasks(tasksArea.value);
    await reloadTasks();
    setTaskEditMode(false);
  } else {
    syncTaskEditor();
    await window.focusPet.saveTasks(tasksArea.value);
  }
}

async function reloadTasks() {
  taskItems = await window.focusPet.listTasks();
  syncTaskEditor();
  renderTaskList();
  updatePetStats();
  updateHomeActions();
}

async function addTaskFromComposer() {
  if (addTaskButton.disabled) return;
  const text = newTaskText.value.trim();
  if (!text) {
    setTaskComposerFeedback('先写一句具体任务，再添加。', 'error');
    newTaskText.focus();
    return;
  }
  if (pendingTaskCount() >= TASK_ACTIVE_LIMIT) {
    syncTaskSurfaceState();
    const warning = `待办已达 ${TASK_ACTIVE_LIMIT} 个上限，先完成或删除一项。`;
    const task = currentTaskItem();
    const reason = task
      ? `${warning.replace(/[。.!！]+$/, '')}，它会看着屏幕先守住「${shortTaskText(task)}」。`
      : `${warning.replace(/[。.!！]+$/, '')}，它会先看着任务面板等你减负。`;
    setTaskComposerFeedback(warning, 'error');
    recordPetVitalsFeedback(reason, {
      focus: 'energy',
      focusSource: 'tasks'
    });
    setPetAction('study', warning);
    newTaskText.focus();
    return;
  }
  const priority = newTaskPriority.value;
  const dueDate = newTaskDue.value;
  const sceneTemplate = selectedFocusSceneTemplate();
  const taskInput = focusSceneTemplateApi()?.applyFocusSceneTemplate
    ? focusSceneTemplateApi().applyFocusSceneTemplate({ text, priority, dueDate }, newTaskScene.value)
    : { text, priority, dueDate };
  addTaskButton.disabled = true;
  try {
    await window.focusPet.addTask(taskInput);
    newTaskText.value = '';
    newTaskScene.value = '';
    newTaskDue.value = '';
    setTaskComposerFeedback(sceneTemplate ? `已添加：${text} · ${sceneTemplate.label}` : `已添加：${text}`, 'success');
    await reloadTasks();
    applyTaskVitalEvent('add', taskInput);
    message.textContent = taskWatchText('任务已添加，');
    newTaskText.focus();
  } catch (error) {
    setTaskComposerFeedback('添加失败，稍后再试。', 'error');
    message.textContent = `添加任务失败：${error.message}`;
    newTaskText.focus();
  } finally {
    addTaskButton.disabled = false;
  }
}

function clearTaskComposerFeedback() {
  if (!taskComposerFeedback.hidden) setTaskComposerFeedback();
}

function setPetAction(action, text) {
  lastInteractionAt = Date.now();
  setCareMenuVisible(false);
  pet.classList.remove(...PET_ACTION_CLASSES);
  pet.classList.add(`action-${action}`);
  playPetAnimation(ACTION_ANIMATIONS[action] || 'waving', { locked: true });
  message.textContent = text;
  if (petActionTimer) clearTimeout(petActionTimer);
  petActionTimer = setTimeout(() => {
    pet.classList.remove(`action-${action}`);
    petAnimationLocked = false;
    syncPetAnimationToStatus();
  }, 1800);
}

function careActionFollowUpText(careAction, previousVibe) {
  if (careAction.guard !== 'normal') return careAction.text;
  if (previousVibe !== 'fragile' && petVibe() !== 'fragile') return careAction.text;

  const step = petNextStep();
  if (step.kind !== 'care' || step.action === careAction.name) return careAction.text;
  return `${careAction.text}下一步先${step.label}。`;
}

function careActionRepeatReason(careAction) {
  return `${careAction.repeatLabel || careAction.label}刚刚照料过，它先观察状态变化。`;
}

function careActionRepeatText(careAction) {
  return `刚刚${careAction.repeatLabel || careAction.label}过，先照着现在的节奏。`;
}

function runPetAction(action) {
  const careAction = careActionEffect(action);
  if (!careAction) return;
  const now = Date.now();
  const focus = CARE_ACTION_FOCUS[careAction.animationAction] || CARE_ACTION_FOCUS[careAction.name];
  if (careActionCooldownActive(now)) {
    const impact = homeCareCooldownImpactText();
    recordPetVitalsFeedback(careCooldownGuardReason(impact), {
      focus: careCooldownFocusKind(impact, focus),
      focusSource: 'care'
    });
    setCareMenuVisible(false);
    message.textContent = careCooldownGuardText(impact);
    return;
  }

  const repeatKey = careAction.repeatKey || action;
  if (lastCareActionName === repeatKey && now - lastCareActionAt < CARE_ACTION_REPEAT_COOLDOWN_MS) {
    recordPetVitalsFeedback(careActionRepeatReason(careAction), {
      focus,
      focusSource: 'care'
    });
    setPetAction(careAction.animationAction, careActionRepeatText(careAction));
    return;
  }

  lastCareActionName = repeatKey;
  lastCareActionAt = now;
  lastCareObservation = { reason: '', impact: '', focus: '' };
  const previousVibe = petVibe();
  applyPetVitalsDelta(careAction.delta, careAction.reason, {
    focus,
    focusSource: 'care'
  });
  captureCareCooldownObservation();
  setPetAction(careAction.animationAction, careActionFollowUpText(careAction, previousVibe));
  if (careAction.opensTasks) showTasks();
}

async function runPetNextStep() {
  const step = petNextStep();
  if (step.kind === 'observe') {
    renderCareMenu();
    setCareMenuVisible(true, { focusRecommended: true });
    return;
  }
  if (step.kind === 'surface') {
    if (step.action === 'review') {
      await showReview();
      return;
    }
    if (step.action === 'tasks') {
      await showTasks();
      return;
    }
  }
  runPetAction(step.action);
}

function touchPet(options = {}) {
  const effect = touchVitalEffect(options);
  const focus = touchVitalFocus(effect);
  if (effect.applied) applyPetVitalsDelta(effect.delta, effect.reason, { focus, focusSource: 'touch' });
  else recordPetVitalsFeedback(effect.reason, { focus, focusSource: 'touch' });
  setPetAction(effect.action, effect.text);
}

function inspectVital(kind, options = {}) {
  setVitalFocus(kind, 'inspect');
  const insight = vitalInsight(kind, options);
  if (insight.applied) applyPetVitalsDelta(insight.delta, insight.reason, { focus: kind, focusSource: 'inspect' });
  else recordPetVitalsFeedback(insight.reason, { focus: kind, focusSource: 'inspect' });
  setPetAction(insight.action, insight.text);
  Object.entries(petStats.rows).forEach(([rowKind, row]) => {
    row.setAttribute('aria-pressed', String(rowKind === kind));
  });
  return insight;
}

function togglePetMenu(event) {
  event.preventDefault();
  lastInteractionAt = Date.now();
  clearNudge('focus');
  renderCareMenu();
  const willShow = petMenu.classList.contains('hidden');
  setCareMenuVisible(willShow, { focusRecommended: willShow });
}

function idleNudgeProfile() {
  if (compoundVitalState().fragile) {
    return {
      target: 'care',
      label: '缓',
      text: '我现在状态有点乱，先照料一下再继续。',
      delta: { mood: -1 },
      reason: '多个状态偏低时久等，会更需要先稳住。'
    };
  }
  if (petVitals.energy < 30) {
    return {
      target: 'care',
      label: '息',
      text: '我有点累，先照料一下再继续任务吧。',
      delta: { energy: -1 },
      reason: '精力偏低还等太久，它会先想休息。'
    };
  }
  if (petVitals.mood < 35) {
    return {
      target: 'care',
      label: '心',
      text: '我有点低落，陪我放松一下再继续。',
      delta: { mood: -1 },
      reason: '心情偏低时久等，会更需要安抚。'
    };
  }
  if (petVitals.bond < 40) {
    return {
      target: 'care',
      label: '亲',
      text: '我还在适应你，轻轻互动一下会更熟。',
      delta: {},
      focus: 'bond',
      reason: '关系还在试探，它会先寻求轻互动。'
    };
  }
  if (taskLoadState() === 'clear') {
    return {
      target: 'tasks',
      label: '复',
      text: '今天清单已经清空，要不要做个复盘？',
      delta: { bond: 1 },
      reason: '清单完成后回来复盘，会让陪伴节奏更稳定。'
    };
  }
  return {
    target: 'tasks',
    label: '!',
    text: '我在这儿～要不要继续今天的任务？右键我可以打开照料菜单。',
    delta: { mood: -1, energy: -1 },
    reason: '等太久会有点没精神。'
  };
}

function idleTick() {
  const idleMinutes = (Date.now() - lastInteractionAt) / 60000;
  if (idleMinutes > (appSettings.idleNudgeMinutes || 10) && !expanded && petMenu.classList.contains('hidden')) {
    const profile = idleNudgeProfile();
    showNudge({ source: 'focus', target: profile.target, text: profile.text, label: profile.label });
    applyPetVitalsDelta(profile.delta, profile.reason, { focus: profile.focus, focusSource: 'focus' });
    lastInteractionAt = Date.now();
  }
}

function focusStatusAffectsPetVitals(status) {
  const policyApi = window.focusPetInterventionPolicy;
  if (typeof policyApi?.focusStatusAffectsPetVitals === 'function') {
    return policyApi.focusStatusAffectsPetVitals(status);
  }
  const key = typeof status === 'string' ? status : status?.status;
  return String(key || '').trim() !== 'permission';
}

function syncVitalsWithFocusStatus(status) {
  if (!focusStatusAffectsPetVitals(status)) return;
  const key = status?.status || 'unknown';
  const now = Date.now();
  if (key === lastVitalsStatusKey && now - lastVitalsStatusAt < 5 * 60 * 1000) return;
  lastVitalsStatusKey = key;
  lastVitalsStatusAt = now;
  if (key === 'work') {
    applyPetVitalsDelta({ mood: 1, energy: -1, bond: 1 }, '看到你在推进任务，它更愿意陪着你。', { focusSource: 'focus' });
  } else if (key === 'study') {
    applyPetVitalsDelta({ mood: 1, energy: -2, bond: 2 }, '看到你在学习，它会安静陪着你专注。', { focus: 'bond', focusSource: 'focus' });
  } else if (key === 'game') {
    applyPetVitalsDelta({ mood: 1, energy: -1 }, '识别到游戏状态，先把节奏放轻，记得给自己留一个结束点。', { focus: 'energy', focusSource: 'focus' });
  } else if (key === 'distracted') {
    applyPetVitalsDelta({ energy: -1 }, '发现你可能偏离当前任务，先给你一个轻提醒。', { focus: 'energy', focusSource: 'focus' });
  } else {
    applyPetVitalsDelta({ energy: -1 }, '当前窗口和任务关系还不明确，先观察一下节奏。', { focus: 'energy', focusSource: 'focus' });
  }
}

async function refreshStatus() {
  const status = await window.focusPet.getStatus();
  lastStatus = status;
  setMood(status.status);
  syncVitalsWithFocusStatus(status);
  if (nudge?.source !== 'chat' && (!expanded || activeSurface === 'home')) message.textContent = status.message;
  context.textContent = status.ok
    ? `${status.app}${status.title ? ` · ${status.title}` : ''}｜${status.reason}`
    : status.reason;
  maybeAutoPopup(status);
}

function maybeAutoPopup(status) {
  if (!appSettings.autoPopupEnabled) return;
  const policyApi = window.focusPetInterventionPolicy;
  const decision = policyApi?.shouldShowIntervention
    ? policyApi.shouldShowIntervention({
      status: status.status,
      confidence: status.confidence,
      app: status.app,
      nowMs: Date.now(),
      lastShownAt: lastAutoPopupAt,
      recentShownAt: recentAutoPopupAt
    }, {
      cooldownMinutes: appSettings.popupCooldownMinutes || chatState.settings?.popupCooldownMinutes || 8
    })
    : { shouldShow: ['distracted', 'game', 'unknown', 'permission'].includes(status.status), target: 'tasks' };
  if (!decision.shouldShow) {
    clearNudge('focus');
    return;
  }
  if (nudge?.source === 'chat') return;
  const now = Date.now();
  if (expanded) return;
  lastAutoPopupAt = now;
  recentAutoPopupAt = [...recentAutoPopupAt, now].filter(time => now - time < 60 * 60 * 1000).slice(-12);
  showNudge({ source: 'focus', target: decision.target || 'tasks', text: status.message, label: decision.target === 'settings' ? '权' : '!' });
}

async function showTasks() {
  clearNudge();
  await setExpanded(true);
  setActiveSurface('tasks');
  chatPanel.classList.add('hidden');
  panel.classList.remove('hidden');
  reviewBox.classList.add('hidden');
  onboardingPanel.classList.add('hidden');
  settingsPanel.classList.add('hidden');
  taskComposer.classList.remove('hidden');
  taskSummary.classList.remove('hidden');
  taskList.classList.remove('hidden');
  saveTasks.classList.remove('hidden');
  editTasks.classList.remove('hidden');
  panelTitle.textContent = '今日任务';
  await reloadTasks();
  setTaskEditMode(false);
  applyTaskSurfaceVitalEvent();
  message.textContent = taskWatchText();
}

async function showReview() {
  clearNudge();
  await setExpanded(true);
  setActiveSurface('review');
  chatPanel.classList.add('hidden');
  const review = await window.focusPet.getReview();
  panel.classList.remove('hidden');
  taskComposer.classList.add('hidden');
  taskSummary.classList.add('hidden');
  taskList.classList.add('hidden');
  tasksArea.classList.add('hidden');
  saveTasks.classList.add('hidden');
  onboardingPanel.classList.add('hidden');
  settingsPanel.classList.add('hidden');
  reviewBox.classList.remove('hidden');
  panelTitle.textContent = '今日复盘';
  const reviewEffect = applyReviewVitalEvent(review);
  renderReview(review, reviewEffect);
  message.textContent = reviewLlmOk(review) && review.llm.petMessage
    ? review.llm.petMessage
    : reviewEffect.applied
    ? `${reviewEffect.summary}，我会按今天的节奏调整陪伴。`
    : `${reviewEffect.summary}，刚刚已经同步过状态。`;
}

async function showOnboarding() {
  clearNudge();
  await setExpanded(true);
  setActiveSurface('onboarding');
  chatPanel.classList.add('hidden');
  panel.classList.remove('hidden');
  taskComposer.classList.add('hidden');
  taskSummary.classList.add('hidden');
  taskList.classList.add('hidden');
  tasksArea.classList.add('hidden');
  saveTasks.classList.add('hidden');
  editTasks.classList.add('hidden');
  reviewBox.classList.add('hidden');
  settingsPanel.classList.add('hidden');
  onboardingPanel.classList.remove('hidden');
  panelTitle.textContent = '新手引导';
  message.textContent = '先选一个模式，基础模式三分钟内就能开始用。';
  context.textContent = '新手引导 · 高级能力默认关闭';
}

async function completeBasicOnboarding() {
  const settings = await window.focusPet.updateSettings({
    screenMonitorEnabled: false,
    reviewLlmEnabled: false,
    autoCheckUpdates: false
  });
  renderSettings(settings);
  scheduleUpdateChecks();
  scheduleScreenMonitor();
  onboardingPanel.dataset.onboardingComplete = 'basic';
  try {
    localStorage.setItem(ONBOARDING_MODE_KEY, 'basic');
  } catch (error) {
    // Ignore storage denial; the current session still reflects completion.
  }
  message.textContent = '基础模式已完成。现在可以写下第一件小任务。';
  context.textContent = '新手引导 · 基础模式';
}

async function openOnboardingSettingsGroup(group) {
  await showSettings();
  setSettingsGroup(group);
  message.textContent = group === 'focus'
    ? '先把判断规则调顺，再回到任务继续。'
    : '高级能力保持关闭，确认用途后再手动开启。';
}

function loadStoredOnboardingMode() {
  try {
    const mode = localStorage.getItem(ONBOARDING_MODE_KEY);
    if (mode) onboardingPanel.dataset.onboardingComplete = mode;
  } catch (error) {
    onboardingPanel.dataset.onboardingComplete = 'false';
  }
}

function settingListText(value) {
  if (Array.isArray(value)) return value.join('\n');
  if (typeof value === 'string') return value;
  return '';
}

function setSettingsGroup(requestedGroup = 'basic') {
  const knownGroups = new Set(settingGroups.map(item => item.dataset.settingsGroup));
  const group = knownGroups.has(requestedGroup) ? requestedGroup : 'basic';
  settingsPanel.dataset.activeSettingsGroup = group;
  settingGroupButtons.forEach(button => {
    const active = button.dataset.settingsTab === group;
    button.setAttribute('aria-pressed', String(active));
  });
  settingGroups.forEach(section => {
    section.hidden = section.dataset.settingsGroup !== group;
  });
}

function renderPlatformSettings(platform = {}) {
  const profile = platform || {};
  pet.dataset.platform = profile.platform || 'unknown';
  platformStatus.textContent = `${profile.name || '当前系统'}：${profile.permissionHelpText || '按当前系统能力运行。'} ${profile.screenMonitorHelpText || ''}`.trim();
  openPermissionsButton.textContent = profile.accessibilityButtonLabel || '权限';
  openPermissionsButton.title = profile.permissionHelpText || '打开系统隐私设置';
  openScreenRecordingButton.textContent = profile.screenRecordingButtonLabel || '屏幕权限';
  openScreenRecordingButton.title = profile.screenMonitorHelpText || '打开屏幕权限设置';
  openScreenRecordingButton.hidden = profile.screenRecordingSettingsAvailable === false;
}

function permissionGuideStatusText(steps = []) {
  if (!steps.length) return '当前平台没有可检查的权限步骤。';
  if (steps.every(step => step.status === 'granted')) return '需要的权限已开启。';
  if (steps.some(step => step.status === 'blocked')) return '还有权限需要开启。';
  return '请按步骤确认权限状态。';
}

function openPermissionStepSettings(kind) {
  if (kind === 'screen-recording') return window.focusPet.openScreenRecordingSettings();
  if (kind === 'accessibility') return window.focusPet.openAccessibilitySettings();
  return Promise.resolve(false);
}

function renderPermissionGuide(profile = {}) {
  const steps = Array.isArray(profile.permissionGuideSteps) ? profile.permissionGuideSteps : [];
  permissionGuide.hidden = !steps.length;
  permissionGuideTitle.textContent = profile.permissionGuideTitle || '权限引导';
  permissionGuideStatus.textContent = permissionGuideStatusText(steps);
  permissionGuideList.replaceChildren();

  for (const step of steps) {
    const item = document.createElement('div');
    item.className = `permission-step ${step.status || 'unknown'}`;

    const text = document.createElement('div');
    const title = document.createElement('strong');
    title.textContent = step.title || '权限';
    const summary = document.createElement('span');
    summary.textContent = step.detail || step.summary || '';
    text.append(title, summary);

    const action = document.createElement('button');
    action.type = 'button';
    action.textContent = step.statusText || step.buttonLabel || '查看';
    action.disabled = !step.settingsKind || step.status === 'granted' || step.status === 'unavailable';
    action.addEventListener('click', () => {
      openPermissionStepSettings(step.settingsKind)
        .then(opened => { permissionGuideStatus.textContent = opened === false ? '没有可打开的系统设置入口。' : '已打开系统设置，授权后点“重新检查”。'; })
        .catch(error => { permissionGuideStatus.textContent = `打开权限设置失败：${error.message}`; });
    });

    item.append(text, action);
    permissionGuideList.appendChild(item);
  }
}

async function loadPermissionGuide() {
  if (typeof window.focusPet.getPermissionStatus !== 'function') {
    renderPermissionGuide(appSettings.platform || {});
    permissionGuideStatus.textContent = '当前运行环境不支持自动检查，请按步骤开启后重启或重新打开设置。';
    return;
  }
  try {
    const profile = await window.focusPet.getPermissionStatus();
    renderPermissionGuide(profile);
  } catch (error) {
    permissionGuideStatus.textContent = `权限状态检查失败：${error.message}`;
  }
}

function permissionGuideNeedsAction(profile = {}) {
  const steps = Array.isArray(profile.permissionGuideSteps) ? profile.permissionGuideSteps : [];
  return steps.some(step => step.status === 'blocked');
}

function firstRunPermissionPrompted() {
  try {
    return localStorage.getItem(PERMISSION_PROMPT_KEY) === 'true';
  } catch {
    return true;
  }
}

function markFirstRunPermissionPrompted() {
  try {
    localStorage.setItem(PERMISSION_PROMPT_KEY, 'true');
  } catch {}
}

async function openFirstRunPermissionGuideIfNeeded() {
  if (firstRunPermissionPrompted() || typeof window.focusPet.getPermissionStatus !== 'function') return;
  try {
    const profile = await window.focusPet.getPermissionStatus();
    if (!permissionGuideNeedsAction(profile)) return;
    markFirstRunPermissionPrompted();
    await showSettings();
    setSettingsGroup('advanced');
    renderPermissionGuide(profile);
    message.textContent = '先打开需要的系统权限，再回来继续使用。';
  } catch {
    markFirstRunPermissionPrompted();
  }
}

function renderSettings(settings) {
  appSettings = settings;
  renderPlatformSettings(settings.platform);
  renderPermissionGuide(settings.platform);
  settingControls.autoPopupEnabled.checked = settings.autoPopupEnabled;
  settingControls.launchAtLogin.checked = settings.launchAtLogin;
  settingControls.launchAtLoginStatus.textContent = settings.launchAtLoginSupported === false
    ? settings.launchAtLoginReason || '开发模式下不会写入系统开机启动项。'
    : (settings.launchAtLoginActive ? '已写入系统开机启动项。' : '未写入系统开机启动项。');
  settingControls.popupCooldownMinutes.value = settings.popupCooldownMinutes;
  settingControls.idleNudgeMinutes.value = settings.idleNudgeMinutes;
  settingControls.socialActivityShareLevel.value = settings.socialActivityShareLevel || 'presence';
  settingControls.maxMediaMb.value = settings.maxMediaMb;
  settingControls.voiceRecordShortcut.value = settings.voiceRecordShortcut || 'Alt+R';
  settingControls.petBehaviorIntensity.value = settings.petBehaviorIntensity;
  settingControls.llmCloudMode.value = settings.llmCloudMode || 'allowed';
  settingControls.screenMonitorProvider.value = settings.screenMonitorProvider || 'stepfun';
  settingControls.screenMonitorEnabled.checked = settings.screenMonitorEnabled;
  settingControls.screenMonitorIntervalSeconds.value = settings.screenMonitorIntervalSeconds;
  settingControls.screenCheckTransport.value = settings.screenCheckTransport || 'auto';
  settingControls.screenCheckCloudUrl.value = settings.screenCheckCloudUrl || '';
  settingControls.screenMonitorEndpoint.value = settings.screenMonitorEndpoint || '';
  settingControls.screenMonitorModel.value = settings.screenMonitorModel || '';
  settingControls.reviewLlmProvider.value = settings.reviewLlmProvider || 'openai-compatible';
  settingControls.reviewLlmEnabled.checked = settings.reviewLlmEnabled !== false;
  settingControls.reviewLlmEndpoint.value = settings.reviewLlmEndpoint || 'https://api.stepfun.com/step_plan/v1';
  settingControls.reviewLlmModel.value = settings.reviewLlmModel || 'step-3.7-flash';
  settingControls.focusKeywords.value = settingListText(settings.focusKeywords);
  settingControls.studyKeywords.value = settingListText(settings.studyKeywords);
  settingControls.gameKeywords.value = settingListText(settings.gameKeywords);
  settingControls.distractionKeywords.value = settingListText(settings.distractionKeywords);
  settingControls.gameApps.value = settingListText(settings.gameApps);
  settingControls.workApps.value = settingListText(settings.workApps);
  settingControls.updateFeedUrl.value = settings.updateFeedUrl || '';
  settingControls.autoCheckUpdates.checked = settings.autoCheckUpdates;
  settingControls.activityRetentionDays.value = settings.activityRetentionDays;
}

function collectSettings() {
  return {
    autoPopupEnabled: settingControls.autoPopupEnabled.checked,
    launchAtLogin: settingControls.launchAtLogin.checked,
    popupCooldownMinutes: settingControls.popupCooldownMinutes.value,
    idleNudgeMinutes: settingControls.idleNudgeMinutes.value,
    socialActivityShareLevel: settingControls.socialActivityShareLevel.value,
    maxMediaMb: settingControls.maxMediaMb.value,
    voiceRecordShortcut: settingControls.voiceRecordShortcut.value,
    petBehaviorIntensity: settingControls.petBehaviorIntensity.value,
    llmCloudMode: settingControls.llmCloudMode.value,
    screenMonitorProvider: settingControls.screenMonitorProvider.value,
    screenMonitorEnabled: settingControls.screenMonitorEnabled.checked,
    screenMonitorIntervalSeconds: settingControls.screenMonitorIntervalSeconds.value,
    screenCheckTransport: settingControls.screenCheckTransport.value,
    screenCheckCloudUrl: settingControls.screenCheckCloudUrl.value,
    screenMonitorEndpoint: settingControls.screenMonitorEndpoint.value,
    screenMonitorModel: settingControls.screenMonitorModel.value,
    reviewLlmProvider: settingControls.reviewLlmProvider.value,
    reviewLlmEnabled: settingControls.reviewLlmEnabled.checked,
    reviewLlmEndpoint: settingControls.reviewLlmEndpoint.value,
    reviewLlmModel: settingControls.reviewLlmModel.value,
    focusKeywords: settingControls.focusKeywords.value,
    studyKeywords: settingControls.studyKeywords.value,
    gameKeywords: settingControls.gameKeywords.value,
    distractionKeywords: settingControls.distractionKeywords.value,
    gameApps: settingControls.gameApps.value,
    workApps: settingControls.workApps.value,
    updateFeedUrl: settingControls.updateFeedUrl.value,
    autoCheckUpdates: settingControls.autoCheckUpdates.checked,
    activityRetentionDays: settingControls.activityRetentionDays.value
  };
}

async function saveSettings() {
  const previousSettings = { ...appSettings };
  const settings = await window.focusPet.updateSettings(collectSettings());
  renderSettings(settings);
  scheduleUpdateChecks();
  scheduleScreenMonitor();
  loadPermissionGuide();
  applySettingsVitalEvent(previousSettings, settings);
}

async function showSettings() {
  clearNudge();
  await setExpanded(true);
  setActiveSurface('settings');
  chatPanel.classList.add('hidden');
  panel.classList.remove('hidden');
  reviewBox.classList.add('hidden');
  taskComposer.classList.add('hidden');
  taskSummary.classList.add('hidden');
  taskList.classList.add('hidden');
  tasksArea.classList.add('hidden');
  saveTasks.classList.add('hidden');
  onboardingPanel.classList.add('hidden');
  settingsPanel.classList.remove('hidden');
  panelTitle.textContent = '设置';
  renderSettings(await window.focusPet.getSettings());
  setSettingsGroup(settingsPanel.dataset.activeSettingsGroup || 'basic');
  loadPermissionGuide();
  applySettingsSurfaceVitalEvent();
  message.textContent = '我看着设置面板，提醒节奏调顺就继续任务。';
}

function isCloudChatState(state = chatState) {
  return state?.source === 'cloud';
}

function cloudChatSignedIn(state = chatState) {
  return isCloudChatState(state) && Boolean(state.signedIn && state.authToken && state.self?.id && state.self.id !== 'cloud-guest');
}

function chatSocketOpen() {
  return chatSocket?.readyState === WebSocket.OPEN;
}

function cloudChatConnectionLabel() {
  if (!cloudChatSignedIn()) return '';
  if (cloudChatConnectionStatus === 'connected') return 'Cloud 已连接';
  if (cloudChatConnectionStatus === 'connecting') return 'Cloud 正在连接';
  if (cloudChatConnectionStatus === 'error') return 'Cloud 连接异常';
  if (cloudChatConnectionStatus === 'disconnected') return 'Cloud 已断开，正在重连';
  return 'Cloud 已登录';
}

function normalizeCloudFriend(friend = {}) {
  return {
    id: String(friend.id || ''),
    name: String(friend.name || friend.displayName || friend.id || '好友').trim() || '好友',
    friendCode: String(friend.friendCode || '').trim(),
    status: friend.status || (friend.online ? 'online' : 'offline'),
    unread: Number(friend.unread || 0)
  };
}

function mergeCloudRealtimeState(payload = {}) {
  const self = payload.self
    ? {
        id: String(payload.self.id || ''),
        name: String(payload.self.name || payload.self.displayName || '我').trim() || '我',
        friendCode: String(payload.self.friendCode || '').trim(),
        status: 'online'
      }
    : chatState.self;
  chatState = {
    ...chatState,
    signedIn: Boolean(chatState.authToken && self?.id),
    self,
    friends: Array.isArray(payload.friends) ? payload.friends.map(normalizeCloudFriend).filter(friend => friend.id) : chatState.friends,
    iceServers: Array.isArray(payload.iceServers) ? payload.iceServers : chatState.iceServers
  };
}

function renderCloudChatAccount() {
  if (!cloudChatAccount) return;
  const isCloud = isCloudChatState();
  cloudChatAccount.hidden = !isCloud;
  if (!isCloud) return;
  const signedIn = cloudChatSignedIn();
  const friendCode = chatState.self?.friendCode || '';
  cloudChatStatus.textContent = signedIn
    ? `${chatState.self?.name || '我'} · ${cloudChatConnectionLabel()}`
    : (chatState.error ? `Cloud 需要重新连接：${chatState.error}` : '创建 ID 后显示好友码');
  cloudFriendCode.textContent = friendCode ? `好友码 ${friendCode}` : '好友码 -';
  cloudRegisterButton.disabled = signedIn;
  cloudDisplayName.disabled = signedIn;
  cloudFriendCodeInput.disabled = !signedIn;
  cloudAddFriendButton.disabled = !signedIn;
  cloudRefreshButton.disabled = !signedIn && !chatState.authToken;
}

function syncCloudChatControls() {
  const isCloud = isCloudChatState();
  const signedIn = cloudChatSignedIn();
  const hasFriend = Boolean(selectedChatFriendId());
  const socketReady = !isCloud || chatSocketOpen();
  chatInput.disabled = isCloud;
  chatInput.placeholder = isCloud ? 'Cloud 模式先支持语音/视频' : '发消息';
  imageButton.disabled = isCloud;
  fileButton.disabled = isCloud;
  petGifButton.disabled = isCloud;
  voiceModeButton.disabled = isCloud;
  chatCallAudio.disabled = isCloud ? !signedIn || !hasFriend || !socketReady : false;
  chatCallVideo.disabled = isCloud ? !signedIn || !hasFriend || !socketReady : false;
  revokeSessionButton.hidden = isCloud;
}

async function loadChatState() {
  if (typeof window.focusPet.getCloudState === 'function') {
    chatState = await window.focusPet.getCloudState();
  } else {
    chatState = await window.focusPet.getChatState();
  }
  renderFriends();
  renderMessages();
  renderPeerActivity();
  renderCloudChatAccount();
  syncCloudChatControls();
  if (!isCloudChatState() && friendSelect.value) window.focusPet.markRead(friendSelect.value).catch(() => {});
}

function chatSocketActive() {
  return chatSocket
    && (chatSocket.readyState === WebSocket.OPEN || chatSocket.readyState === WebSocket.CONNECTING);
}

async function ensureChatConnected() {
  chatSocketEnabled = true;
  await loadChatState();
  connectChatSocket();
}

function connectChatSocket() {
  if (!chatSocketEnabled || chatSocketActive()) return;
  if (chatReconnectTimer) {
    clearTimeout(chatReconnectTimer);
    chatReconnectTimer = null;
  }
  let url = '';
  if (isCloudChatState()) {
    if (!cloudChatSignedIn() || !chatState.websocketUrl) {
      cloudChatConnectionStatus = 'idle';
      renderCloudChatAccount();
      syncCloudChatControls();
      return;
    }
    cloudChatConnectionStatus = 'connecting';
    url = chatState.websocketUrl;
  } else {
    const token = encodeURIComponent(chatState.authToken || '');
    const peerId = encodeURIComponent(chatState.self?.id || 'pet-owner');
    url = `ws://127.0.0.1:${chatState.port}?token=${token}&peerId=${peerId}`;
  }
  renderCloudChatAccount();
  syncCloudChatControls();
  chatSocket = new WebSocket(url);
  chatSocket.onopen = () => {
    if (isCloudChatState()) {
      cloudChatConnectionStatus = 'connected';
      renderCloudChatAccount();
      syncCloudChatControls();
    }
    if (chatPingTimer) clearInterval(chatPingTimer);
    chatPingTimer = setInterval(() => chatSocket?.readyState === WebSocket.OPEN && chatSocket.send(JSON.stringify({ type: 'ping' })), 15000);
  };
  chatSocket.onmessage = event => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      return;
    }
    if (data.event === 'state') {
      if (isCloudChatState()) cloudChatConnectionStatus = 'connected';
      if (isCloudChatState()) mergeCloudRealtimeState(data.payload);
      else chatState = data.payload;
      renderFriends();
      renderMessages();
      renderPeerActivity();
      renderCloudChatAccount();
      syncCloudChatControls();
    }
    if (data.event === 'message') {
      syncChatMessage(data.payload);
      if (data.payload?.from !== chatState.self.id) applyChatVitalEvent('receive');
      if (expanded) {
        if (chatPanel.classList.contains('hidden')) showChat({ auto: true, prompt: '收到一条新消息，要不要看一下？' });
      } else {
        showNudge({ source: 'chat', target: 'chat', text: '收到一条新消息，点我查看。', label: '讯' });
      }
    }
    if (data.event === 'friends') {
      chatState.friends = data.payload;
      renderFriends();
      renderPeerActivity();
      renderCloudChatAccount();
      syncCloudChatControls();
    }
    if (data.event === 'activity') {
      handleChatActivityEvent(data.payload);
    }
    if (['call-invite', 'call-answer', 'call-reject', 'call-cancel', 'call-end', 'call-unavailable', 'rtc-offer', 'rtc-answer', 'rtc-ice'].includes(data.event)) {
      handleChatRealtime(data.event, data.payload).catch(error => {
        message.textContent = `通话失败：${error.message}`;
        chatCallStatus.textContent = `通话失败：${error.message}`;
      });
    }
    if (data.event === 'error') message.textContent = `聊天错误：${data.payload}`;
  };
  chatSocket.onerror = () => {
    if (!isCloudChatState()) return;
    cloudChatConnectionStatus = 'error';
    renderCloudChatAccount();
    syncCloudChatControls();
  };
  chatSocket.onclose = () => {
    if (chatPingTimer) clearInterval(chatPingTimer);
    chatPingTimer = null;
    chatSocket = null;
    if (isCloudChatState()) {
      cloudChatConnectionStatus = cloudChatSignedIn() ? 'disconnected' : 'idle';
      renderCloudChatAccount();
      syncCloudChatControls();
    }
    if (!chatSocketEnabled) return;
    chatReconnectTimer = setTimeout(connectChatSocket, 2000);
  };
}

function selectedChatFriendId() {
  return friendSelect.value || chatState.friends[0]?.id || '';
}

function sendChatRealtime(type, payload = {}) {
  if (chatSocket?.readyState !== WebSocket.OPEN) return;
  const to = payload.to || chatCallPeerId || selectedChatFriendId();
  if (!to) return;
  const event = { type, ...payload };
  event.to = to;
  event.callId = event.callId || chatCallId || `call-${Date.now()}`;
  event.mode = event.mode || 'audio';
  chatSocket.send(JSON.stringify(event));
}

function chatLocalStreamSupports(mode = 'audio') {
  if (!chatLocalStream) return false;
  const hasLiveAudio = chatLocalStream.getAudioTracks().some(track => track.readyState !== 'ended');
  const hasLiveVideo = chatLocalStream.getVideoTracks().some(track => track.readyState !== 'ended');
  return hasLiveAudio && (mode !== 'video' || hasLiveVideo);
}

function chatMediaRequestSupports(requestMode, mode) {
  return requestMode === 'video' || mode !== 'video';
}

function createChatPeer(mode = 'audio') {
  chatPeerConnection = new RTCPeerConnection({ iceServers: chatState.iceServers || [] });
  chatPeerConnection.onicecandidate = event => {
    if (event.candidate) sendChatRealtime('rtc-ice', { mode, candidate: event.candidate });
  };
  chatPeerConnection.ontrack = event => {
    remoteCallVideo.srcObject = event.streams[0];
  };
  return chatPeerConnection;
}

async function getChatLocalStream(mode = 'audio') {
  if (chatLocalStreamSupports(mode)) return chatLocalStream;
  if (chatLocalStreamPromise && chatMediaRequestSupports(chatLocalStreamRequestMode, mode)) return chatLocalStreamPromise;
  if (chatLocalStreamPromise) {
    await chatLocalStreamPromise.catch(() => null);
    if (chatLocalStreamSupports(mode)) return chatLocalStream;
  }
  if (chatLocalStream) chatLocalStream.getTracks().forEach(track => track.stop());
  chatLocalStreamRequestMode = mode;
  chatLocalStreamPromise = navigator.mediaDevices.getUserMedia({ audio: true, video: mode === 'video' })
    .then(stream => {
      chatLocalStream = stream;
      localCallVideo.srcObject = chatLocalStream;
      chatCallStage.hidden = false;
      chatCallStage.classList.remove('hidden');
      return chatLocalStream;
    })
    .finally(() => {
      chatLocalStreamPromise = null;
      chatLocalStreamRequestMode = '';
    });
  return chatLocalStreamPromise;
}

function chatRtcNoticeAccepted() {
  return localStorage.getItem(RTC_NETWORK_NOTICE_KEY) === 'accepted';
}

function hideChatRtcNotice() {
  if (chatRtcNotice) chatRtcNotice.hidden = true;
}

function clearPendingChatRtcNotice() {
  pendingChatRtcAction = null;
  pendingChatRtcMode = 'audio';
  hideChatRtcNotice();
}

function showChatRtcNotice(mode = 'audio', action = null) {
  pendingChatRtcMode = mode;
  pendingChatRtcAction = action;
  if (chatRtcNotice) chatRtcNotice.hidden = false;
  chatCallStatus.hidden = false;
  chatCallStatus.textContent = '继续前确认 WebRTC 网络提示';
  message.textContent = 'WebRTC 通话可能向通话对方暴露网络地址；仅与可信联系人通话。';
}

async function continueChatRtcNotice() {
  localStorage.setItem(RTC_NETWORK_NOTICE_KEY, 'accepted');
  const action = pendingChatRtcAction;
  const mode = pendingChatRtcMode || 'audio';
  clearPendingChatRtcNotice();
  if (action) await action();
  else await startChatCall(mode);
}

function cancelChatRtcNotice() {
  const mode = pendingChatRtcMode || 'audio';
  const callId = chatCallId;
  const peerId = chatCallPeerId;
  clearPendingChatRtcNotice();
  if (peerId) sendChatRealtime('call-reject', { mode, callId, to: peerId, reason: 'network notice declined' });
  chatCallId = '';
  chatCallPeerId = '';
  chatCallStatus.textContent = '通话已取消';
  chatCallStatus.hidden = false;
  message.textContent = '通话已取消。';
}

async function requestChatCall(mode) {
  if (isCloudChatState() && !cloudChatSignedIn()) {
    message.textContent = '先创建我的 ID，再发起通话。';
    return;
  }
  if (isCloudChatState() && !chatSocketOpen()) {
    message.textContent = 'Cloud 正在连接，稍后再发起通话。';
    connectChatSocket();
    return;
  }
  if (!selectedChatFriendId()) {
    message.textContent = isCloudChatState() ? '先添加好友码，再发起通话。' : '先添加好友，再发起通话。';
    return;
  }
  if (!chatRtcNoticeAccepted()) {
    showChatRtcNotice(mode, () => startChatCall(mode));
    return;
  }
  await startChatCall(mode);
}

async function startChatCall(mode) {
  if (!selectedChatFriendId()) {
    message.textContent = isCloudChatState() ? '先添加好友码，再发起通话。' : '先添加好友，再发起通话。';
    return;
  }
  chatCallId = `call-${Date.now()}`;
  chatCallPeerId = selectedChatFriendId();
  const stream = await getChatLocalStream(mode);
  const peer = createChatPeer(mode);
  stream.getTracks().forEach(track => peer.addTrack(track, stream));
  sendChatRealtime('call-invite', { mode });
  const offer = await peer.createOffer();
  await peer.setLocalDescription(offer);
  sendChatRealtime('rtc-offer', { mode, sdp: offer });
  const callLabel = mode === 'video' ? '视频' : '语音';
  chatCallStatus.hidden = false;
  chatCallStatus.textContent = `${callLabel}通话邀请已发出`;
  renderMessages();
  const effect = applyChatVitalEvent(mode === 'video' ? 'callVideo' : 'callAudio');
  const text = `${callLabel}通话邀请已发出，我会陪你守住这次联系。`;
  if (effect?.action) setPetAction(effect.action, text);
  else message.textContent = text;
}

async function handleChatRealtime(event, payload = {}) {
  chatCallId = payload.callId || chatCallId || `call-${Date.now()}`;
  if (payload.from) chatCallPeerId = payload.from;
  if (!chatRtcNoticeAccepted()) {
    if (event === 'call-invite' || event === 'rtc-offer') {
      const mode = payload.mode || 'audio';
      const callLabel = mode === 'video' ? '视频' : '语音';
      chatCallStatus.hidden = false;
      chatCallStatus.textContent = `${callLabel}来电，等待确认 WebRTC 网络提示`;
      showChatRtcNotice(mode, () => handleChatRealtime(event, payload));
      renderMessages();
      return;
    }
  }
  if (event === 'call-invite') {
    const mode = payload.mode || 'audio';
    const callId = payload.callId || chatCallId;
    const callLabel = mode === 'video' ? '视频' : '语音';
    chatCallStage.hidden = false;
    chatCallStage.classList.remove('hidden');
    chatCallStatus.hidden = false;
    chatCallStatus.textContent = `${callLabel}来电，正在自动接通`;
    renderMessages();
    message.textContent = `${callLabel}来电，正在自动接通。`;
    try {
      await getChatLocalStream(mode);
      sendChatRealtime('call-answer', { mode, callId, to: payload.from });
      const effect = applyChatVitalEvent(mode === 'video' ? 'callVideo' : 'callAudio');
      const text = `${callLabel}来电，正在自动接通，我会陪你稳住这次联系。`;
      if (effect?.action) setPetAction(effect.action, text);
      else message.textContent = text;
    } catch (error) {
      const status = mode === 'video' ? '无法接通：需要麦克风或摄像头授权' : '无法接通：需要麦克风授权';
      sendChatRealtime('call-reject', { mode, callId, to: payload.from, reason: error.message });
      chatCallStatus.textContent = status;
      renderMessages();
      message.textContent = `${status}。`;
    }
    return;
  }
  if (event === 'call-answer') {
    chatCallStatus.textContent = '对方已接听';
    renderMessages();
  }
  if (event === 'call-reject' || event === 'call-cancel' || event === 'call-end') {
    endChatCall({ notify: false, status: '通话已结束' });
    return;
  }
  if (event === 'call-unavailable') {
    endChatCall({ notify: false, status: '对方不在线' });
    return;
  }
  if (event === 'rtc-offer') {
    const callId = payload.callId || chatCallId;
    const stream = await getChatLocalStream(payload.mode);
    const peer = createChatPeer(payload.mode);
    stream.getTracks().forEach(track => peer.addTrack(track, stream));
    await peer.setRemoteDescription(payload.sdp);
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);
    sendChatRealtime('rtc-answer', { mode: payload.mode, sdp: answer, callId, to: payload.from });
    chatCallStatus.textContent = '通话中';
    renderMessages();
  }
  if (event === 'rtc-answer' && chatPeerConnection) {
    await chatPeerConnection.setRemoteDescription(payload.sdp);
    chatCallStatus.textContent = '通话中';
    renderMessages();
  }
  if (event === 'rtc-ice' && chatPeerConnection && payload.candidate) {
    await chatPeerConnection.addIceCandidate(payload.candidate);
  }
}

function endChatCall(options = {}) {
  const endedCallId = chatCallId;
  if (options.notify !== false) sendChatRealtime('call-end', { callId: endedCallId, mode: 'audio' });
  if (chatPeerConnection) chatPeerConnection.close();
  chatPeerConnection = null;
  if (chatLocalStream) chatLocalStream.getTracks().forEach(track => track.stop());
  chatLocalStream = null;
  chatLocalStreamPromise = null;
  chatLocalStreamRequestMode = '';
  clearPendingChatRtcNotice();
  chatCallId = '';
  chatCallPeerId = '';
  localCallVideo.srcObject = null;
  remoteCallVideo.srcObject = null;
  chatCallStage.hidden = true;
  chatCallStage.classList.add('hidden');
  chatCallStatus.textContent = options.status || '未通话';
  chatCallStatus.hidden = chatCallStatus.textContent === '未通话';
  renderMessages();
}

function renderFriends() {
  const selectedFriendId = friendSelect.value;
  friendSelect.innerHTML = '';
  if (!chatState.friends.length) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = isCloudChatState() ? '先添加好友码' : '暂无好友';
    option.disabled = true;
    friendSelect.appendChild(option);
    revokeSessionButton.disabled = true;
    renderCloudChatAccount();
    syncCloudChatControls();
    updateHomeActions();
    return;
  }
  revokeSessionButton.disabled = isCloudChatState();
  for (const friend of chatState.friends) {
    const option = document.createElement('option');
    option.value = friend.id;
    option.textContent = `${friend.name} · ${friendStatusLabel(friend.status)}${friend.unread ? ` · ${friend.unread}未读` : ''}`;
    option.selected = friend.id === selectedFriendId;
    friendSelect.appendChild(option);
  }
  renderCloudChatAccount();
  syncCloudChatControls();
  updateHomeActions();
}

function friendStatusLabel(status) {
  return status === 'online' ? '在线' : '离线';
}

function syncChatMessage(item) {
  if (!item) return;
  const existingIndex = chatState.messages.findIndex(message => (
    (item.id && message.id === item.id)
    || (item.clientId && message.clientId === item.clientId)
  ));
  if (existingIndex >= 0) chatState.messages[existingIndex] = { ...chatState.messages[existingIndex], ...item };
  else chatState.messages.push(item);
  chatState.messages = chatState.messages.slice(-700);
  renderMessages();
}

function chatMessageTimeText(time) {
  const date = Date.parse(time);
  if (!Number.isFinite(date)) return '';
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function chatMessageMetaText(item) {
  const time = chatMessageTimeText(item.createdAt);
  const status = item.from === chatState.self.id ? messageStatusLabel(item.deliveryStatus) : '';
  return [time, status].filter(Boolean).join(' · ');
}

function activeChatCallNoticeText() {
  const text = String(chatCallStatus?.textContent || '').trim();
  return text && text !== '未通话' ? text : '';
}

function appendChatSystemRow(text, className = 'chat-system') {
  if (!text) return;
  const row = document.createElement('div');
  row.className = className;
  row.textContent = text;
  chatMessages.appendChild(row);
}

function renderMessages() {
  chatMessages.innerHTML = '';
  const visibleMessages = chatState.messages.slice(-80);
  for (const item of visibleMessages) {
    const row = document.createElement('div');
    row.className = `chat-message ${item.from === chatState.self.id ? 'mine' : 'theirs'}`;
    row.dataset.id = item.id;
    const name = item.from === chatState.self.id ? '我' : friendName(item.from);
    const status = item.from === chatState.self.id ? ` · ${messageStatusLabel(item.deliveryStatus)}` : '';
    const metaText = `${name} · ${new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${status}`;
    row.title = metaText;
    row.dataset.attachmentType = attachmentTypeForMessage(item);
    const body = renderMessageBody(item);
    const visibleMeta = chatMessageMetaText(item);
    if (visibleMeta) {
      const statusLine = document.createElement('small');
      statusLine.className = 'chat-message-meta';
      statusLine.textContent = visibleMeta;
      row.append(body, statusLine);
    } else {
      row.appendChild(body);
    }
    chatMessages.appendChild(row);
  }
  const callNotice = activeChatCallNoticeText();
  if (callNotice) appendChatSystemRow(callNotice);
  if (!visibleMessages.length && !callNotice) {
    const emptyText = isCloudChatState()
      ? (cloudChatSignedIn() ? '添加好友码后，可以发起语音或视频。' : '先创建我的 ID，生成好友码。')
      : '还没有消息，先发语音或视频给搭子。';
    appendChatSystemRow(emptyText, 'chat-empty');
  }
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function messageStatusLabel(status) {
  return { queued: '待发送', sent: '已发送', delivered: '已送达', read: '已读', received: '已收到' }[status] || '已发送';
}

function mediaUrl(media) {
  if (!media?.url) return '';
  const token = chatState.authToken || '';
  try {
    const url = new URL(media.url, `http://127.0.0.1:${chatState.port || 47321}`);
    if (url.pathname.startsWith('/media/')) {
      url.protocol = 'http:';
      url.hostname = '127.0.0.1';
      url.port = String(chatState.port || 47321);
    }
    if (token) url.searchParams.set('token', token);
    return url.toString();
  } catch {
    const encodedToken = encodeURIComponent(token);
    return `${media.url}${media.url.includes('?') ? '&' : '?'}token=${encodedToken}`;
  }
}

function fileExtension(name = '') {
  const clean = String(name || '').split('?')[0].split('#')[0];
  const dot = clean.lastIndexOf('.');
  return dot >= 0 ? clean.slice(dot).toLowerCase() : '';
}

function attachmentTypeForFile(file, preferredType = 'file') {
  if (preferredType === 'voice') return 'voice';
  const mimeType = String(file?.type || '').toLowerCase();
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'voice';
  return 'file';
}

function attachmentTypeForMedia(media = {}, preferredType = 'file') {
  if (preferredType === 'image' || preferredType === 'video' || preferredType === 'voice') return preferredType;
  const mimeType = String(media.mimeType || '').toLowerCase();
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'voice';
  return 'file';
}

function attachmentTypeForMessage(item = {}) {
  if (!item.media?.url) return '';
  return attachmentTypeForMedia(item.media, item.type);
}

function fileKindLabel(media = {}) {
  const mimeType = String(media.mimeType || '').toLowerCase();
  const extension = fileExtension(media.name || media.id);
  if (mimeType.includes('pdf') || extension === '.pdf') return 'PDF';
  if (mimeType.includes('zip') || extension === '.zip') return 'ZIP';
  if (mimeType.includes('word') || extension === '.doc' || extension === '.docx') return 'DOC';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || extension === '.xls' || extension === '.xlsx') return 'XLS';
  if (mimeType.includes('powerpoint') || mimeType.includes('presentation') || extension === '.ppt' || extension === '.pptx') return 'PPT';
  if (mimeType.includes('json') || extension === '.json') return 'JSON';
  if (mimeType.includes('csv') || extension === '.csv') return 'CSV';
  if (mimeType.includes('markdown') || extension === '.md') return 'MD';
  if (mimeType.startsWith('text/') || extension === '.txt') return 'TXT';
  return '文件';
}

function fileSizeText(size = 0) {
  const bytes = Number(size) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function renderFileCard(item) {
  const media = item.media || {};
  const link = document.createElement('a');
  link.className = 'chat-file-card';
  link.href = mediaUrl(media);
  link.target = '_blank';
  link.rel = 'noreferrer';
  link.download = media.name || item.text || '';
  link.title = media.name || item.text || '文件';

  const badge = document.createElement('b');
  badge.className = 'chat-file-badge';
  badge.textContent = fileKindLabel(media);

  const copy = document.createElement('span');
  copy.className = 'chat-file-copy';
  const name = document.createElement('span');
  name.className = 'chat-file-name';
  name.textContent = media.name || item.text || '未命名文件';
  const meta = document.createElement('small');
  meta.className = 'chat-file-meta';
  meta.textContent = [fileKindLabel(media), fileSizeText(media.size)].filter(Boolean).join(' · ');
  copy.append(name, meta);
  link.append(badge, copy);
  return link;
}

function selectedPeerActivity() {
  const peerId = selectedChatFriendId();
  return chatState.activities?.[peerId] || null;
}

function selectedPeerActivityLog() {
  const peerId = selectedChatFriendId();
  return (chatState.activityLog || []).filter(activity => activity.from === peerId);
}

function activityStatusLabel(status) {
  if (status === 'work') return '专注中';
  if (status === 'study') return '学习中';
  if (status === 'rest') return '休息中';
  if (status === 'game') return '游戏中';
  if (status === 'distracted') return '可能偏离';
  return '观察中';
}

function activityTimeText(time) {
  const date = Date.parse(time);
  if (!Number.isFinite(date)) return '刚刚同步';
  const seconds = Math.max(0, Math.round((Date.now() - date) / 1000));
  if (seconds < 60) return '刚刚同步';
  if (seconds < 3600) return `${Math.round(seconds / 60)}分钟前同步`;
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderPeerActivity() {
  const log = selectedPeerActivityLog();
  const activity = selectedPeerActivity() || log.at(-1);
  if (!peerActivity || !activity) {
    if (peerActivity) peerActivity.hidden = true;
    return;
  }
  const friend = friendName(activity.from);
  const confidence = Math.round((Number(activity.confidence) || 0) * 100);
  peerActivity.hidden = false;
  peerActivityTitle.textContent = `${friend} · ${activityStatusLabel(activity.status)}`;
  peerActivityText.textContent = activity.review?.insight || activity.message || activity.activity || '等待下一次屏幕分析。';
  peerActivityMeta.textContent = [
    activityTimeText(activity.time),
    confidence ? `${confidence}%` : ''
  ].filter(Boolean).join(' · ');
  peerActivityImage.hidden = true;
  peerActivityImage.removeAttribute('src');
  renderPeerActivityLog(log);
}

function renderPeerActivityLog(log = []) {
  if (!peerActivityLog) return;
  peerActivityLog.innerHTML = '';
  for (const activity of log.slice(-6).reverse()) {
    const item = document.createElement('li');
    const time = document.createElement('b');
    const text = document.createElement('span');
    const status = document.createElement('em');
    time.textContent = activityTimeText(activity.time);
    text.textContent = activity.activity || activity.message || '屏幕采样';
    status.textContent = activityStatusLabel(activity.status);
    item.title = [activity.reason, activity.suggestion].filter(Boolean).join(' · ');
    item.append(time, text, status);
    peerActivityLog.appendChild(item);
  }
}

function handleChatActivityEvent(activity = {}) {
  if (!activity?.from) return;

  chatState.activities = { ...(chatState.activities || {}), [activity.from]: activity };
  chatState.activityLog = [...(chatState.activityLog || []), activity].slice(-500);
  renderPeerActivity();

  if (chatState.self?.id && activity.from === chatState.self.id) return;

  const effect = applyChatVitalEvent('activity');
  const text = `${friendName(activity.from)}同步了屏幕状态，我会帮你留意对方节奏。`;
  if (effect?.action) {
    setPetAction(effect.action, text);
  } else {
    message.textContent = text;
  }
}

function renderMessageBody(item) {
  if (item.activity) {
    const box = document.createElement('span');
    box.textContent = item.activity.message || item.text || item.activity.activity || '[屏幕分析]';
    return box;
  }
  if (item.media?.url && item.type === 'image') {
    const image = document.createElement('img');
    image.src = mediaUrl(item.media);
    image.alt = item.media.name || 'image';
    return image;
  }
  if (item.media?.url && item.type === 'video') {
    const video = document.createElement('video');
    video.src = mediaUrl(item.media);
    video.controls = true;
    return video;
  }
  if (item.media?.url && item.type === 'voice') {
    const voice = document.createElement('div');
    voice.className = 'chat-voice-bubble';
    const label = document.createElement('span');
    label.textContent = '语音消息';
    const audio = document.createElement('audio');
    audio.src = mediaUrl(item.media);
    audio.controls = true;
    voice.append(label, audio);
    return voice;
  }
  if (item.media?.url) return renderFileCard(item);
  const span = document.createElement('span');
  span.textContent = item.text || `[${item.type}]`;
  return span;
}

function friendName(id) {
  return chatState.friends.find(friend => friend.id === id)?.name || id || '好友';
}

async function showChat({ auto = false, prompt = '' } = {}) {
  clearNudge();
  await setExpanded(true);
  setActiveSurface('chat');
  panel.classList.add('hidden');
  chatPanel.classList.remove('hidden');
  if (auto && prompt) message.textContent = prompt;
  else message.textContent = '我在旁边看着消息，不打断你当前任务。';
  await ensureChatConnected();
  if (!auto) applyChatVitalEvent('open');
}

async function revokeSelectedPeerSession() {
  if (isCloudChatState()) return;
  if (!friendSelect.value) return;
  const result = await window.focusPet.revokePeerSession(friendSelect.value);
  await loadChatState();
  const name = friendName(friendSelect.value);
  message.textContent = result?.revokedSessions
    ? `已撤销 ${name} 的外部会话，聊天记录仍保留。`
    : `${name} 当前没有可撤销的外部会话。`;
}

async function refreshCloudChat() {
  if (typeof window.focusPet.refreshCloudState !== 'function') return loadChatState();
  chatState = await window.focusPet.refreshCloudState();
  renderFriends();
  renderMessages();
  renderPeerActivity();
  renderCloudChatAccount();
  syncCloudChatControls();
  connectChatSocket();
}

async function registerCloudChatAccount() {
  const displayName = cloudDisplayName.value.trim();
  chatState = await window.focusPet.registerCloudUser({ displayName });
  renderFriends();
  renderMessages();
  renderPeerActivity();
  renderCloudChatAccount();
  syncCloudChatControls();
  connectChatSocket();
  message.textContent = chatState.self?.friendCode
    ? `我的好友码是 ${chatState.self.friendCode}。`
    : 'Cloud ID 已创建。';
}

async function addCloudChatFriend() {
  const friendCode = cloudFriendCodeInput.value.trim();
  if (!friendCode) {
    message.textContent = '先输入好友码。';
    return;
  }
  chatState = await window.focusPet.addCloudFriend(friendCode);
  cloudFriendCodeInput.value = '';
  renderFriends();
  renderMessages();
  renderPeerActivity();
  renderCloudChatAccount();
  syncCloudChatControls();
  connectChatSocket();
  message.textContent = '好友已添加，可以发起语音或视频。';
}

async function sendTextMessage(textOverride) {
  if (isCloudChatState()) {
    message.textContent = 'Cloud 好友当前用于语音和视频，暂不发送文字消息。';
    return;
  }
  const text = (textOverride || chatInput.value).trim();
  if (!text) return;
  chatInput.value = '';
  await sendMessage({ type: 'text', text });
}

async function sendMessage(partial) {
  if (isCloudChatState()) {
    message.textContent = 'Cloud 好友当前用于语音和视频，暂不发送文字或文件。';
    return;
  }
  if (!chatSocketEnabled) await ensureChatConnected();
  const outgoing = {
    clientId: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    from: chatState.self.id,
    to: friendSelect.value || chatState.friends[0]?.id || 'demo-friend',
    ...partial
  };
  const savedMessage = await window.focusPet.sendChatMessage(outgoing);
  syncChatMessage(savedMessage || { ...outgoing, createdAt: new Date().toISOString(), deliveryStatus: 'sent' });
  applyChatVitalEvent(outgoing.type === 'text' ? 'sendText' : 'sendMedia');
  message.textContent = outgoing.type === 'text'
    ? '消息发出去了，我陪你等回复。'
    : '内容发出去了，我会留意消息回来。';
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function sendFile(file, type) {
  if (isCloudChatState()) {
    message.textContent = 'Cloud 好友当前用于语音和视频，暂不发送文件。';
    return;
  }
  if (file.size > (appSettings.maxMediaMb || chatState.settings?.maxMediaMb || 25) * 1024 * 1024) {
    message.textContent = `文件太大，最多 ${appSettings.maxMediaMb || chatState.settings?.maxMediaMb || 25}MB`;
    return;
  }
  const resolvedType = attachmentTypeForFile(file, type);
  const media = await window.focusPet.saveChatMedia({
    name: file.name,
    mimeType: file.type,
    data: await readFileAsBase64(file)
  });
  await sendMessage({ type: resolvedType, text: file.name, media });
}

async function loadPetGifItems(force = false) {
  if (petGifItems.length && !force) return petGifItems;
  try {
    const items = await window.focusPet.getPetGifs();
    petGifItems = Array.isArray(items) && items.length ? items : PET_GIF_FALLBACKS;
  } catch {
    petGifItems = PET_GIF_FALLBACKS;
  }
  return petGifItems;
}

function setPetGifTrayVisible(visible) {
  petGifTray.hidden = !visible;
  petGifButton.setAttribute('aria-expanded', String(visible));
  if (!visible) releasePetGifTray();
}

function releasePetGifTray() {
  petGifTray.replaceChildren();
}

function petGifPreviewUrl(item = {}) {
  if (item.previewUrl) return item.previewUrl;
  return `assets/pets/nervy-sci-fi-kid/gifs/${item.name || 'tap-heart.gif'}`;
}

function renderPetGifTray(items = petGifItems) {
  petGifTray.replaceChildren();

  const header = document.createElement('div');
  header.className = 'pet-gif-tray-header';
  const title = document.createElement('strong');
  title.textContent = '发送宠物动图';
  const openFolder = document.createElement('button');
  openFolder.type = 'button';
  openFolder.className = 'pet-gif-folder';
  openFolder.dataset.action = 'open-gif-folder';
  openFolder.textContent = '文件夹';
  header.append(title, openFolder);
  petGifTray.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'pet-gif-grid';
  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pet-gif-option';
    button.setAttribute('role', 'menuitem');
    button.setAttribute('data-gif-key', item.key);
    button.dataset.gifKey = item.key;
    button.title = `${item.label || item.name} · 点击发送`;

    const image = document.createElement('img');
    image.src = petGifPreviewUrl(item);
    image.alt = item.label || item.name || '宠物动图';
    image.loading = 'lazy';
    image.decoding = 'async';

    const label = document.createElement('span');
    label.textContent = item.label || item.name || '宠物动图';
    const size = document.createElement('small');
    size.textContent = item.size ? fileSizeText(item.size) : '按需加载';
    button.append(image, label, size);
    grid.appendChild(button);
  }
  petGifTray.appendChild(grid);
}

async function togglePetGifTray() {
  if (isCloudChatState()) {
    message.textContent = 'Cloud 好友当前用于语音和视频，暂不发送宠物动图。';
    return;
  }
  if (!petGifTray.hidden) {
    setPetGifTrayVisible(false);
    return;
  }
  const items = await loadPetGifItems();
  renderPetGifTray(items);
  setPetGifTrayVisible(true);
  message.textContent = '挑一张宠物动图发送，预览只在这里打开时加载。';
}

async function sendPetGif(key) {
  try {
    const media = await window.focusPet.sharePetGif(key);
    const item = petGifItems.find(candidate => candidate.key === key) || media;
    const label = media.label || item.label || '宠物动图';
    await sendMessage({ type: 'image', text: label, media });
    setPetGifTrayVisible(false);
    message.textContent = `${label}发出去了。`;
  } catch (error) {
    message.textContent = `宠物动图发送失败：${error.message}`;
  }
}

async function handlePetGifTrayClick(event) {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.action === 'open-gif-folder') {
    await window.focusPet.openPetGifFolder();
    message.textContent = '已打开宠物动图文件夹。';
    return;
  }
  const key = button.dataset.gifKey;
  if (key) await sendPetGif(key);
}

const VOICE_SHORTCUT_MODIFIERS = ['Ctrl', 'Cmd', 'Alt', 'Shift'];
const VOICE_SHORTCUT_ALIASES = new Map([
  ['control', 'Ctrl'],
  ['ctrl', 'Ctrl'],
  ['command', 'Cmd'],
  ['cmd', 'Cmd'],
  ['meta', 'Cmd'],
  ['option', 'Alt'],
  ['alt', 'Alt'],
  ['shift', 'Shift'],
  ['space', 'Space'],
  [' ', 'Space'],
  ['return', 'Enter'],
  ['enter', 'Enter'],
  ['esc', 'Escape'],
  ['escape', 'Escape']
]);

function voiceShortcutToken(value) {
  const token = String(value || '').trim();
  if (!token) return '';
  const lower = token.toLowerCase();
  if (VOICE_SHORTCUT_ALIASES.has(lower)) return VOICE_SHORTCUT_ALIASES.get(lower);
  if (/^key[a-z]$/i.test(token)) return token.slice(3).toUpperCase();
  if (/^[a-z]$/i.test(token)) return token.toUpperCase();
  if (/^digit[0-9]$/i.test(token)) return token.slice(5);
  if (/^[0-9]$/.test(token)) return token;
  if (/^f([1-9]|1[0-2])$/i.test(token)) return token.toUpperCase();
  return '';
}

function normalizeVoiceShortcut(value, fallback = 'Alt+R') {
  const parts = String(value || '').split('+').map(voiceShortcutToken).filter(Boolean);
  const modifiers = [];
  let key = '';
  for (const part of parts) {
    if (VOICE_SHORTCUT_MODIFIERS.includes(part)) {
      if (!modifiers.includes(part)) modifiers.push(part);
      continue;
    }
    if (key) return fallback;
    key = part;
  }
  if (!key || !modifiers.length) return fallback;
  return [...VOICE_SHORTCUT_MODIFIERS.filter(modifier => modifiers.includes(modifier)), key].join('+');
}

function parseVoiceShortcut(value) {
  const normalized = normalizeVoiceShortcut(value);
  const parts = normalized.split('+');
  return {
    normalized,
    key: parts.find(part => !VOICE_SHORTCUT_MODIFIERS.includes(part)) || '',
    ctrl: parts.includes('Ctrl'),
    meta: parts.includes('Cmd'),
    alt: parts.includes('Alt'),
    shift: parts.includes('Shift')
  };
}

function eventKeyMatchesShortcut(event, expectedKey) {
  const codeToken = event.code ? voiceShortcutToken(event.code) : '';
  const keyToken = voiceShortcutToken(event.key);
  return keyToken === expectedKey || codeToken === expectedKey;
}

function eventMatchesVoiceShortcut(event) {
  const shortcut = parseVoiceShortcut(appSettings.voiceRecordShortcut || 'Alt+R');
  return event.ctrlKey === shortcut.ctrl
    && event.metaKey === shortcut.meta
    && event.altKey === shortcut.alt
    && event.shiftKey === shortcut.shift
    && eventKeyMatchesShortcut(event, shortcut.key);
}

function canUseVoiceShortcut(event) {
  if (activeSurface !== 'chat' || chatPanel.classList.contains('hidden')) return false;
  const editable = event.target?.closest?.('input, textarea, select, [contenteditable="true"]');
  return !editable || editable === chatInput;
}

function clearVoiceShortcutState() {
  voiceShortcutActive = false;
  voiceShortcutKey = '';
  voiceShortcutStartToken += 1;
}

function handleVoiceShortcutKeydown(event) {
  if (event.repeat || voiceShortcutActive || !eventMatchesVoiceShortcut(event) || !canUseVoiceShortcut(event)) return;
  event.preventDefault();
  const shortcut = parseVoiceShortcut(appSettings.voiceRecordShortcut || 'Alt+R');
  voiceShortcutActive = true;
  voiceShortcutKey = shortcut.key;
  const token = voiceShortcutStartToken;
  setVoiceComposeMode(true);
  startVoiceRecording()
    .then(() => {
      if (token !== voiceShortcutStartToken || !voiceShortcutActive) stopVoiceRecording({ send: false });
    })
    .catch(error => {
      clearVoiceShortcutState();
      message.textContent = `语音权限/录制失败：${error.message}`;
    });
}

function handleVoiceShortcutKeyup(event) {
  if (!voiceShortcutActive || !eventKeyMatchesShortcut(event, voiceShortcutKey)) return;
  event.preventDefault();
  clearVoiceShortcutState();
  stopVoiceRecording({ send: true });
}

function cancelActiveVoiceShortcut() {
  if (!voiceShortcutActive) return;
  clearVoiceShortcutState();
  stopVoiceRecording({ send: false });
}

function setVoiceComposeMode(enabled) {
  chatCompose.dataset.mode = enabled ? 'voice' : 'text';
  chatInput.hidden = enabled;
  document.querySelector('#sendChat').hidden = enabled;
  voiceModeButton.hidden = enabled;
  textModeButton.hidden = !enabled;
  voiceRecordButton.hidden = !enabled;
  if (enabled) voiceRecordButton.focus();
  else chatInput.focus();
}

async function startVoiceRecording() {
  if (mediaRecorder?.state === 'recording') return;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  voiceChunks = [];
  voiceRecordingStartedAt = Date.now();
  voiceRecordingCancelRequested = false;
  voicePointerCancel = false;
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = event => {
    if (event.data?.size) voiceChunks.push(event.data);
  };
  mediaRecorder.onstop = async () => {
    stream.getTracks().forEach(track => track.stop());
    voiceRecordButton.classList.remove('recording', 'cancel');
    voiceRecordButton.removeAttribute('data-recording');
    voiceRecordButton.textContent = '按住说话';
    if (voiceRecordingCancelRequested) {
      message.textContent = '语音消息已取消。';
      return;
    }
    const durationMs = Date.now() - voiceRecordingStartedAt;
    if (durationMs < 600 || !voiceChunks.length) {
      message.textContent = '说话时间太短，语音没有发送。';
      return;
    }
    const blob = new Blob(voiceChunks, { type: 'audio/webm' });
    if (!blob.size) {
      message.textContent = '没有录到声音，语音没有发送。';
      return;
    }
    const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
    try {
      await sendFile(file, 'voice');
    } catch (error) {
      message.textContent = `语音发送失败：${error.message}`;
    }
  };
  mediaRecorder.start();
  voiceRecordButton.classList.add('recording');
  voiceRecordButton.dataset.recording = 'true';
  voiceRecordButton.textContent = '松开发送';
  message.textContent = '正在录音，松开发送，移出后松开可取消。';
}

function stopVoiceRecording(options = {}) {
  if (voiceShortcutActive) clearVoiceShortcutState();
  if (mediaRecorder?.state !== 'recording') return;
  voiceRecordingCancelRequested = options.send === false;
  mediaRecorder.stop();
}

function updateVoiceCancelPreview(cancel) {
  if (mediaRecorder?.state !== 'recording') return;
  voicePointerCancel = cancel;
  voiceRecordButton.classList.toggle('cancel', cancel);
  voiceRecordButton.textContent = cancel ? '松开取消' : '松开发送';
}

async function loadSettings() {
  renderSettings(await window.focusPet.getSettings());
  scheduleUpdateChecks();
  scheduleScreenMonitor();
  openFirstRunPermissionGuideIfNeeded();
}

function scheduleUpdateChecks() {
  if (updateCheckTimer) clearInterval(updateCheckTimer);
  updateCheckTimer = null;
  if (!appSettings.autoCheckUpdates) return;
  updateCheckTimer = setInterval(checkUpdates, 6 * 60 * 60 * 1000);
  checkUpdates({ notify: true });
}

async function checkUpdates(options = {}) {
  try {
    const result = await window.focusPet.checkUpdate({ notify: options.notify !== false });
    if (!result.ok) {
      updateResult.textContent = result.reason || '没有可用更新源。';
      return;
    }
    updateResult.textContent = result.available
      ? `发现 ${result.latestVersion}：${result.notes || '可下载新版本'}`
      : `当前已是最新版本 ${result.currentVersion}`;
    if (result.available && result.url && options.manual) await window.focusPet.openUpdateDownload(result);
  } catch (error) {
    updateResult.textContent = `检查失败：${error.message}`;
  }
}

async function runSettingsDiagnostics() {
  if (typeof window.focusPet.getDiagnostics !== 'function') {
    updateResult.textContent = '当前运行环境不支持诊断摘要。';
    return;
  }
  try {
    const summary = await window.focusPet.getDiagnostics();
    const tasks = summary.tasks || {};
    const chat = summary.chat || {};
    const errorCount = Array.isArray(summary.recentErrors) ? summary.recentErrors.length : 0;
    updateResult.textContent = `诊断：任务 ${tasks.done || 0}/${tasks.total || 0}，聊天 ${chat.ok ? '正常' : '需检查'}，近期问题 ${errorCount} 条。`;
  } catch (error) {
    updateResult.textContent = `诊断失败：${error.message}`;
  }
}

function llmCheckStatusText(check = {}) {
  if (check.status === 'connected') return '已连通';
  if (check.status === 'needs-config') return '缺配置';
  if (check.status === 'network-error') return '网络不通';
  if (check.status === 'request-failed') return `请求失败${check.statusCode ? ` ${check.statusCode}` : ''}`;
  if (check.status === 'invalid-response') return '响应异常';
  return check.ok ? '已通过' : '需处理';
}

function appendLlmNextSteps(card, steps = []) {
  if (!steps.length) return;
  const list = document.createElement('ol');
  list.className = 'llm-next-steps';
  steps.forEach(step => {
    const item = document.createElement('li');
    item.textContent = step;
    list.appendChild(item);
  });
  card.appendChild(list);
}

function renderLlmSelfCheckResult(result = {}) {
  if (!llmSelfCheckResult) return;
  llmSelfCheckResult.replaceChildren();

  const checks = Array.isArray(result.checks) ? result.checks : [];
  const summary = document.createElement('div');
  summary.className = 'llm-self-check-summary';
  summary.textContent = result.ok
    ? 'LLM 自检通过。'
    : checks.length ? 'LLM 自检发现需要处理的配置或连通性问题。' : `LLM 自检失败：${result.error || '未知错误'}`;
  llmSelfCheckResult.appendChild(summary);

  checks.forEach(check => {
    const card = document.createElement('section');
    card.className = `llm-check-card ${check.status || 'unknown'}`;
    card.dataset.ok = check.ok ? 'true' : 'false';

    const header = document.createElement('header');
    const title = document.createElement('strong');
    title.textContent = check.title || 'LLM';
    const status = document.createElement('span');
    status.textContent = llmCheckStatusText(check);
    header.append(title, status);

    const summaryText = document.createElement('p');
    summaryText.textContent = check.summary || (check.ok ? '连通性正常。' : '需要检查配置。');

    const meta = document.createElement('small');
    const requestText = check.requestSent ? '已发送最小测试请求' : '未发送测试请求';
    const keyText = check.apiKeyRequired === false
      ? 'API key 无需'
      : `API key ${check.apiKeyPresent ? '已读取' : '缺失'}`;
    const providerText = check.localProvider ? '本地' : (check.provider || 'OpenAI-compatible');
    meta.textContent = `${providerText} · ${requestText} · endpoint ${check.endpoint ? '已填' : '缺失'} · model ${check.model ? '已填' : '缺失'} · ${keyText}`;

    card.append(header, summaryText, meta);

    if (check.detail) {
      const detail = document.createElement('p');
      detail.className = 'llm-check-detail';
      detail.textContent = check.detail;
      card.appendChild(detail);
    }

    appendLlmNextSteps(card, check.nextSteps || []);
    llmSelfCheckResult.appendChild(card);
  });
}

async function testLlmConnectivity() {
  if (typeof window.focusPet.testLlmConnectivity !== 'function') {
    updateResult.textContent = '当前运行环境不支持 LLM 自检。';
    return;
  }

  setSettingsGroup('ai');
  const originalText = testLlmConnectivityButton.textContent;
  testLlmConnectivityButton.disabled = true;
  testLlmConnectivityButton.textContent = '自检中';
  updateResult.textContent = '正在检查 LLM endpoint、model 和 API key。';
  try {
    const result = await window.focusPet.testLlmConnectivity(collectSettings());
    renderLlmSelfCheckResult(result);
    updateResult.textContent = result.ok
      ? 'LLM 自检通过。'
      : 'LLM 自检发现问题，请按下方步骤修复。';
    message.textContent = result.ok
      ? 'LLM 自检通过，屏幕检查和复盘都能连上。'
      : 'LLM 自检发现问题，先按设置里的步骤修好。';
    context.textContent = result.ok ? '设置同步 · LLM 连通' : '设置同步 · LLM 需要处理';
  } catch (error) {
    const result = { ok: false, error: error.message, checks: [] };
    renderLlmSelfCheckResult(result);
    updateResult.textContent = `LLM 自检失败：${error.message}`;
  } finally {
    testLlmConnectivityButton.disabled = false;
    testLlmConnectivityButton.textContent = originalText;
  }
}

function screenMonitorIntervalMs() {
  const seconds = Number(appSettings.screenMonitorIntervalSeconds) || 45;
  return Math.max(15, Math.min(300, Math.round(seconds))) * 1000;
}

function screenMonitorMood(status) {
  if (status === 'work' || status === 'study' || status === 'game' || status === 'distracted' || status === 'permission') return status;
  return 'unknown';
}

function screenMonitorStatusText(result = {}) {
  if (result.pipelineReview?.llm?.ok) {
    return `屏幕复盘：${result.pipelineReview.llm.summary || result.pipelineReview.llm.petMessage || '已完成'}`;
  }
  if (result.pipelineReview?.llm && !result.pipelineReview.llm.ok) {
    if (result.pipelineReview.llm.status === 'needs-config') return '屏幕已分析，复盘 LLM 需要 API key 或配置。';
    if (result.pipelineReview.llm.status === 'disabled') return '屏幕已分析，复盘 LLM 未开启。';
    return `屏幕已分析，复盘失败：${result.pipelineReview.llm.reason || result.pipelineReview.llm.status || '未知错误'}`;
  }
  if (result.ok) {
    const confidence = Math.round((Number(result.confidence) || 0) * 100);
    return `屏幕检查：${result.activity || '已完成采样'}${confidence ? ` · ${confidence}%` : ''}`;
  }
  if (result.status === 'needs-config') return '屏幕检查需要 LLM endpoint、model 和 API key。';
  if (result.status === 'permission') return '屏幕检查需要屏幕录制权限。';
  if (result.status === 'disabled') return '屏幕检查未开启。';
  return `屏幕检查失败：${result.reason || '未知错误'}`;
}

function applyScreenMonitorResult(result = {}, { manual = false } = {}) {
  if (result.status === 'disabled' && !manual) return;
  lastScreenMonitorAt = Date.now();
  pet.dataset.screenMonitor = result.status || 'unknown';

  if (result.ok) {
    const monitorStatus = {
      ok: true,
      status: screenMonitorMood(result.status),
      app: '屏幕检查',
      title: result.activity || '',
      reason: result.reason || '',
      message: result.pipelineReview?.llm?.ok
        ? result.pipelineReview.llm.petMessage
        : (result.message || screenMonitorStatusText(result))
    };
    lastStatus = monitorStatus;
    setMood(monitorStatus.status);
    syncVitalsWithFocusStatus(monitorStatus);
    message.textContent = monitorStatus.message;
    context.textContent = result.pipelineReview?.llm?.ok
      ? `屏幕复盘 · ${result.activity || '当前屏幕'}｜${result.pipelineReview.llm.insight || result.pipelineReview.llm.summary || '已完成复盘'}`
      : `屏幕检查 · ${result.activity || '当前屏幕'}｜${result.reason || '已完成分析'}`;
    maybeAutoPopup(monitorStatus);
  } else {
    const mood = screenMonitorMood(result.status);
    if (result.status === 'permission') {
      lastStatus = { ok: false, status: mood, reason: result.reason || '需要屏幕录制权限', message: screenMonitorStatusText(result) };
      setMood(mood);
      syncVitalsWithFocusStatus(lastStatus);
    }
    if (manual || result.status !== 'needs-config') {
      message.textContent = screenMonitorStatusText(result);
      context.textContent = result.reason || screenMonitorStatusText(result);
    }
  }

  if (manual) updateResult.textContent = screenMonitorStatusText(result);
}

async function sampleScreenMonitor(options = {}) {
  if (!appSettings.screenMonitorEnabled && !options.manual) return null;
  try {
    const result = await window.focusPet.sampleScreenMonitor(options);
    applyScreenMonitorResult(result, options);
    return result;
  } catch (error) {
    const result = {
      ok: false,
      status: 'error',
      reason: error.message
    };
    applyScreenMonitorResult(result, options);
    return result;
  }
}

function scheduleScreenMonitor() {
  if (screenMonitorTimer) clearInterval(screenMonitorTimer);
  screenMonitorTimer = null;
  if (!appSettings.screenMonitorEnabled) {
    delete pet.dataset.screenMonitor;
    return;
  }
  screenMonitorTimer = setInterval(() => sampleScreenMonitor(), screenMonitorIntervalMs());
  sampleScreenMonitor();
}

document.querySelector('#chatToggle').addEventListener('click', () => showChat());
document.querySelector('#tasksToggle').addEventListener('click', showTasks);
document.querySelector('#reviewToggle').addEventListener('click', showReview);
document.querySelector('#onboardingToggle').addEventListener('click', showOnboarding);
document.querySelector('#settingsToggle').addEventListener('click', showSettings);
focusNowButton.addEventListener('click', () => {
  if (focusNowButton.dataset.action === 'review') showReview();
  else showTasks();
});
quickChatButton.addEventListener('click', () => showChat());
petStats.now.addEventListener('click', runPetNextStep);
petStats.focusAction.button.addEventListener('click', runPetNextStep);
Object.entries(petStats.rows).forEach(([kind, row]) => {
  row.addEventListener('click', () => inspectVital(kind));
  row.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      inspectVital(kind);
    }
  });
});
Object.entries(petStats.chips).forEach(([kind, chip]) => {
  chip.addEventListener('click', () => inspectVital(kind));
});
document.querySelector('#careMenu').addEventListener('click', event => {
  event.preventDefault();
  lastInteractionAt = Date.now();
  clearNudge('focus');
  if (petMenu.classList.contains('hidden')) renderCareMenu();
  const willShow = petMenu.classList.contains('hidden');
  setCareMenuVisible(willShow, { focusRecommended: willShow });
});
document.querySelector('#closePanel').addEventListener('click', () => {
  panel.classList.add('hidden');
  setActiveSurface('home');
});
document.querySelector('#closeChat').addEventListener('click', () => {
  chatPanel.classList.add('hidden');
  setPetGifTrayVisible(false);
  setActiveSurface('home');
});
document.querySelector('#collapse').addEventListener('click', () => {
  clearNudge();
  setExpanded(false);
});
expandHint.addEventListener('click', handleNudgeAction);
avatar.addEventListener('pointerdown', startAvatarDrag);
avatar.addEventListener('pointermove', moveAvatarDrag);
avatar.addEventListener('pointerup', endAvatarDrag);
avatar.addEventListener('pointercancel', endAvatarDrag);
avatar.addEventListener('contextmenu', togglePetMenu);
avatar.addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  activateAvatarInteraction();
});
petMenu.addEventListener('click', event => {
  const button = event.target.closest('button[data-action]');
  if (button) runPetAction(button.dataset.action);
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || petMenu.classList.contains('hidden')) return;
  event.preventDefault();
  setCareMenuVisible(false, { restoreFocus: true });
});
document.addEventListener('keydown', handleVoiceShortcutKeydown);
document.addEventListener('keyup', handleVoiceShortcutKeyup);
window.addEventListener('blur', cancelActiveVoiceShortcut);
document.querySelector('#openData').addEventListener('click', () => window.focusPet.openDataDir());
document.querySelector('#quit').addEventListener('click', () => window.focusPet.quit());
document.querySelector('#sendChat').addEventListener('click', () => sendTextMessage());
imageButton.addEventListener('click', () => { mediaMode = 'image'; mediaInput.accept = 'image/*'; mediaInput.click(); });
fileButton.addEventListener('click', () => { mediaMode = 'file'; mediaInput.accept = CHAT_FILE_ACCEPT; mediaInput.click(); });
petGifButton.addEventListener('click', () => togglePetGifTray());
petGifTray.addEventListener('click', event => handlePetGifTrayClick(event));
voiceModeButton.addEventListener('click', () => setVoiceComposeMode(true));
textModeButton.addEventListener('click', () => setVoiceComposeMode(false));
voiceRecordButton.addEventListener('pointerdown', event => {
  event.preventDefault();
  voiceRecordButton.setPointerCapture?.(event.pointerId);
  startVoiceRecording().catch(error => { message.textContent = `语音权限/录制失败：${error.message}`; });
});
voiceRecordButton.addEventListener('pointerenter', () => updateVoiceCancelPreview(false));
voiceRecordButton.addEventListener('pointerleave', () => updateVoiceCancelPreview(true));
voiceRecordButton.addEventListener('pointerup', event => {
  event.preventDefault();
  stopVoiceRecording({ send: !voicePointerCancel });
});
voiceRecordButton.addEventListener('pointercancel', () => stopVoiceRecording({ send: false }));
voiceRecordButton.addEventListener('keydown', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  startVoiceRecording().catch(error => { message.textContent = `语音权限/录制失败：${error.message}`; });
});
voiceRecordButton.addEventListener('keyup', event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  stopVoiceRecording({ send: true });
});
chatCallAudio.addEventListener('click', () => requestChatCall('audio').catch(error => { message.textContent = `语音通话失败：${error.message}`; }));
chatCallVideo.addEventListener('click', () => requestChatCall('video').catch(error => { message.textContent = `视频通话失败：${error.message}`; }));
chatCallEnd.addEventListener('click', endChatCall);
chatRtcContinue.addEventListener('click', () => continueChatRtcNotice().catch(error => { message.textContent = `通话失败：${error.message}`; }));
chatRtcCancel.addEventListener('click', cancelChatRtcNotice);
cloudRegisterButton.addEventListener('click', () => registerCloudChatAccount().catch(error => { message.textContent = `创建 ID 失败：${error.message}`; }));
cloudAddFriendButton.addEventListener('click', () => addCloudChatFriend().catch(error => { message.textContent = `添加好友失败：${error.message}`; }));
cloudRefreshButton.addEventListener('click', () => refreshCloudChat().catch(error => { message.textContent = `Cloud 刷新失败：${error.message}`; }));
cloudFriendCodeInput.addEventListener('keydown', event => { if (event.key === 'Enter') addCloudChatFriend().catch(error => { message.textContent = `添加好友失败：${error.message}`; }); });
cloudDisplayName.addEventListener('keydown', event => { if (event.key === 'Enter') registerCloudChatAccount().catch(error => { message.textContent = `创建 ID 失败：${error.message}`; }); });
revokeSessionButton.addEventListener('click', () => revokeSelectedPeerSession().catch(error => { message.textContent = `撤销会话失败：${error.message}`; }));
friendSelect.addEventListener('change', () => {
  renderPeerActivity();
  syncCloudChatControls();
  if (!isCloudChatState()) window.focusPet.markRead(friendSelect.value).catch(() => {});
});
chatInput.addEventListener('keydown', event => { if (event.key === 'Enter') sendTextMessage(); });
mediaInput.addEventListener('change', async () => {
  const file = mediaInput.files[0];
  mediaInput.value = '';
  if (!file) return;
  try {
    await sendFile(file, mediaMode);
  } catch (error) {
    message.textContent = `文件发送失败：${error.message}`;
  }
});
editTasks.addEventListener('click', async () => {
  if (taskEditMode) {
    await saveCurrentTasks();
    applyPetVitalsDelta({ bond: 1 }, '导入任务后，它更清楚今天的路线。');
    message.textContent = '已导入为任务清单。';
    return;
  }
  setTaskEditMode(true);
});
saveTasks.addEventListener('click', async () => {
  await saveCurrentTasks();
  applyPetVitalsDelta({ mood: 1, bond: 1 }, '保存任务状态让节奏更稳定。');
  message.textContent = '任务已保存。现在挑第一项，开始 25 分钟。';
});
addTaskButton.addEventListener('click', addTaskFromComposer);
newTaskText.addEventListener('keydown', event => { if (event.key === 'Enter') addTaskFromComposer(); });
newTaskText.addEventListener('input', clearTaskComposerFeedback);
newTaskPriority.addEventListener('change', clearTaskComposerFeedback);
newTaskScene.addEventListener('change', clearTaskComposerFeedback);
newTaskDue.addEventListener('input', clearTaskComposerFeedback);
saveSettingsButton.addEventListener('click', saveSettings);
checkUpdatesButton.addEventListener('click', () => checkUpdates({ manual: true }));
testLlmConnectivityButton.addEventListener('click', testLlmConnectivity);
refreshPermissionsButton.addEventListener('click', loadPermissionGuide);
openPermissionsButton.addEventListener('click', () => window.focusPet.openAccessibilitySettings());
openScreenRecordingButton.addEventListener('click', () => window.focusPet.openScreenRecordingSettings());
testScreenMonitorButton.addEventListener('click', () => sampleScreenMonitor({ manual: true, review: true }));
settingGroupButtons.forEach(button => button.addEventListener('click', () => setSettingsGroup(button.dataset.settingsTab)));
openDataFromSettingsButton.addEventListener('click', () => window.focusPet.openDataDir());
runDiagnosticsFromSettingsButton.addEventListener('click', runSettingsDiagnostics);
completeBasicOnboardingButton.addEventListener('click', completeBasicOnboarding);
openEnhancedOnboardingButton.addEventListener('click', () => openOnboardingSettingsGroup('focus'));
openAdvancedOnboardingButton.addEventListener('click', () => openOnboardingSettingsGroup('ai'));

bindInteractiveZones();
renderFocusSceneTemplateOptions();
playPetAnimation('idle');
loadStoredPetVitals();
loadStoredOnboardingMode();
updatePetStats();
setActiveSurface('home');
loadSettings();
refreshStatus();
setInterval(refreshStatus, 60_000);
setInterval(idleTick, 60_000);
