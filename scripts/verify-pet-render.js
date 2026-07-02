#!/usr/bin/env node
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'output', 'qa');
const legacyScreenshotPath = path.join(outputDir, 'nervy-render.png');
const summaryPath = path.join(outputDir, 'nervy-render-summary.json');
const preloadPath = path.join(os.tmpdir(), `focus-pet-render-preload-${process.pid}.js`);
let exitCode = 0;
const scenarios = [
  {
    name: 'compact',
    windowSize: { width: 220, height: 270 },
    expectedVibe: 'steady',
    setup: `
      (() => {
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 80, energy: 70, bond: 50, reason: 'qa steady' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
      })();
    `
  },
  {
    name: 'expanded',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 80, energy: 70, bond: 50, reason: 'qa steady' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
      })();
    `
  },
  {
    name: 'home-action-shortcuts',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectHomeActions: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 80, energy: 70, bond: 50, reason: 'qa home actions' }));
        loadStoredPetVitals();
        taskItems = [];
        chatState.friends = [{ id: 'qa-friend', name: '搭子', status: 'online', unread: 0 }];
        chatState.messages = [];
        setActiveSurface('home');
        updateHomeActions();
        updatePetStats();
        syncPetAnimationToStatus();
      })();
    `
  },
  {
    name: 'home-study-energy-tradeoff',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'bright',
    expectHomeStudyEnergyTradeoff: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        taskItems = [];
        appSettings = { ...appSettings, petBehaviorIntensity: 'normal' };
        chatState.friends = [{ id: 'qa-friend', name: '搭子', status: 'online', unread: 0 }];
        chatState.messages = [];
        setActiveSurface('home');
        document.querySelector('#homeActions').classList.remove('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 80, energy: 70, bond: 70, reason: 'qa study tradeoff' }));
        loadStoredPetVitals();
        updateHomeActions();
        updatePetStats();
        syncPetAnimationToStatus();
        const homeCareButton = document.querySelector('#careMenu');
        const homeCareMeta = homeCareButton.querySelector('small');
        window.__qaHomeCareBeforeMenu = {
          text: homeCareButton.dataset.label || homeCareButton.querySelector('.home-action-label')?.textContent || homeCareButton.querySelector('strong')?.textContent || '',
          meta: homeCareMeta?.textContent || '',
          metaHidden: homeCareMeta?.hidden ?? true,
          action: homeCareButton.dataset.action || '',
          reason: homeCareButton.dataset.reason || '',
          impact: homeCareButton.dataset.impact || '',
          title: homeCareButton.title || ''
        };
        homeCareButton.click();
      })();
    `
  },
  {
    name: 'home-work-energy-drop-preview',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectHomeWorkEnergyDropPreview: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        taskItems = [
          { id: 'qa-home-work-1', text: '整理状态提示', priority: 'high', dueDate: '', done: false, order: 1 }
        ];
        window.__qaTaskStore.set(taskItems);
        appSettings = { ...appSettings, petBehaviorIntensity: 'normal' };
        chatState.friends = [{ id: 'qa-friend', name: '搭子', status: 'online', unread: 0 }];
        chatState.messages = [];
        setActiveSurface('home');
        document.querySelector('#homeActions').classList.remove('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 66, bond: 62, reason: 'qa home work drop' }));
        loadStoredPetVitals();
        updateHomeActions();
        updatePetStats();
        syncPetAnimationToStatus();
        const homeCareButton = document.querySelector('#careMenu');
        const homeCareMeta = homeCareButton.querySelector('small');
        window.__qaHomeCareBeforeMenu = {
          text: homeCareButton.dataset.label || homeCareButton.querySelector('.home-action-label')?.textContent || homeCareButton.querySelector('strong')?.textContent || '',
          meta: homeCareMeta?.textContent || '',
          metaHidden: homeCareMeta?.hidden ?? true,
          action: homeCareButton.dataset.action || '',
          reason: homeCareButton.dataset.reason || '',
          impact: homeCareButton.dataset.impact || '',
          title: homeCareButton.title || ''
        };
        homeCareButton.click();
      })();
    `
  },
  {
    name: 'idle-care-nudge-action',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'tired',
    expectIdleCareNudge: true,
    setup: `
      await (async () => {
        const pet = document.querySelector('#pet');
        expanded = false;
        pet.classList.add('compact');
        pet.classList.remove('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 70, energy: 18, bond: 62, reason: 'qa idle low energy' }));
        loadStoredPetVitals();
        appSettings = { ...appSettings, idleNudgeMinutes: 10, autoPopupEnabled: false };
        lastInteractionAt = Date.now() - 11 * 60 * 1000;
        updatePetStats();
        syncPetAnimationToStatus();
        idleTick();
        window.__qaIdleNudge = {
          target: pet.dataset.nudgeTarget || '',
          label: document.querySelector('#expandHint').textContent,
          title: document.querySelector('#expandHint').title,
          message: document.querySelector('#message').textContent,
          hasNudge: pet.classList.contains('has-nudge')
        };
        await handleNudgeAction();
        syncPetAnimationToStatus();
      })();
    `
  },
  {
    name: 'idle-bond-nudge-action',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'guarded',
    expectIdleBondNudge: true,
    setup: `
      await (async () => {
        const pet = document.querySelector('#pet');
        expanded = false;
        pet.classList.add('compact');
        pet.classList.remove('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 68, bond: 22, reason: 'qa idle low bond' }));
        loadStoredPetVitals();
        appSettings = { ...appSettings, idleNudgeMinutes: 10, autoPopupEnabled: false };
        lastInteractionAt = Date.now() - 11 * 60 * 1000;
        updatePetStats();
        syncPetAnimationToStatus();
        idleTick();
        window.__qaIdleNudge = {
          target: pet.dataset.nudgeTarget || '',
          label: document.querySelector('#expandHint').textContent,
          title: document.querySelector('#expandHint').title,
          message: document.querySelector('#message').textContent,
          hasNudge: pet.classList.contains('has-nudge')
        };
        await handleNudgeAction();
        syncPetAnimationToStatus();
      })();
    `
  },
  {
    name: 'offline-rest-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectOfflineRestFeedback: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({
          mood: 55,
          energy: 24,
          bond: 66,
          reason: 'qa offline before rest',
          lastDelta: {},
          updatedAt: Date.now() - 10 * 60 * 60 * 1000
        }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
      })();
    `
  },
  {
    name: 'settings-intensity-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectSettingsFeedback: true,
    setup: `
      expanded = true;
      const pet = document.querySelector('#pet');
      pet.classList.remove('compact');
      pet.classList.add('expanded');
      pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
      if (petActionTimer) {
        clearTimeout(petActionTimer);
        petActionTimer = null;
      }
      petAnimationLocked = false;
      localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 70, energy: 70, bond: 50, reason: 'qa settings ready' }));
      loadStoredPetVitals();
      lastSettingsVitalAt = 0;
      lastSettingsVitalKey = '';
      await showSettings();
      document.querySelector('#settingIntensity').value = 'active';
      await saveSettings();
      syncPetAnimationToStatus();
    `
  },
  {
    name: 'settings-save-repeat-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectSettingsRepeatFeedback: true,
    setup: `
      expanded = true;
      const pet = document.querySelector('#pet');
      pet.classList.remove('compact');
      pet.classList.add('expanded');
      pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
      if (petActionTimer) {
        clearTimeout(petActionTimer);
        petActionTimer = null;
      }
      petAnimationLocked = false;
      localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 70, energy: 70, bond: 50, reason: 'qa settings repeat ready' }));
      loadStoredPetVitals();
      lastSettingsVitalAt = 0;
      lastSettingsVitalKey = '';
      await showSettings();
      await saveSettings();
      await saveSettings();
      syncPetAnimationToStatus();
    `
  },
  {
    name: 'settings-open-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectSettingsOpenFeedback: true,
    setup: `
      expanded = true;
      const pet = document.querySelector('#pet');
      pet.classList.remove('compact');
      pet.classList.add('expanded');
      pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
      if (petActionTimer) {
        clearTimeout(petActionTimer);
        petActionTimer = null;
      }
      petAnimationLocked = false;
      localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 70, energy: 70, bond: 50, reason: 'qa settings open ready' }));
      loadStoredPetVitals();
      await showSettings();
      syncPetAnimationToStatus();
    `
  },
  {
    name: 'onboarding-guide',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectOnboardingGuide: true,
    setup: `
      expanded = true;
      const pet = document.querySelector('#pet');
      pet.classList.remove('compact');
      pet.classList.add('expanded');
      pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
      if (petActionTimer) {
        clearTimeout(petActionTimer);
        petActionTimer = null;
      }
      petAnimationLocked = false;
      localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 70, energy: 70, bond: 50, reason: 'qa onboarding ready' }));
      localStorage.removeItem('focusPetOnboardingMode');
      loadStoredPetVitals();
      loadStoredOnboardingMode();
      await showOnboarding();
      syncPetAnimationToStatus();
    `
  },
  {
    name: 'settings-llm-self-check-missing-config',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectSettingsLlmSelfCheck: true,
    setup: `
      expanded = true;
      const pet = document.querySelector('#pet');
      pet.classList.remove('compact');
      pet.classList.add('expanded');
      pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
      if (petActionTimer) {
        clearTimeout(petActionTimer);
        petActionTimer = null;
      }
      petAnimationLocked = false;
      localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 70, energy: 70, bond: 50, reason: 'qa llm self check ready' }));
      loadStoredPetVitals();
      await showSettings();
      await testLlmConnectivity();
      document.querySelector('#llmSelfCheckResult')?.scrollIntoView({ block: 'start' });
      syncPetAnimationToStatus();
    `
  },
  {
    name: 'chat-minimal-media-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectChatFeedback: true,
    setup: `
      expanded = true;
      const pet = document.querySelector('#pet');
      pet.classList.remove('compact');
      pet.classList.add('expanded');
      localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 70, energy: 70, bond: 50, reason: 'qa chat ready' }));
      loadStoredPetVitals();
      lastChatVitalAt = {};
      await showChat();
      const file = new File([new Uint8Array([1, 2, 3, 4])], 'qa-video.webm', { type: 'video/webm' });
      await sendFile(file, 'video');
      syncPetAnimationToStatus();
    `
  },
  {
    name: 'chat-file-card-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectChatFileCardFeedback: true,
    setup: `
      expanded = true;
      const pet = document.querySelector('#pet');
      pet.classList.remove('compact');
      pet.classList.add('expanded');
      localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 70, energy: 70, bond: 50, reason: 'qa chat file ready' }));
      loadStoredPetVitals();
      lastChatVitalAt = {};
      await showChat();
      const file = new File([new Uint8Array([37, 80, 68, 70])], 'focus-plan.pdf', { type: 'application/pdf' });
      await sendFile(file, 'file');
      syncPetAnimationToStatus();
    `
  },
  {
    name: 'chat-repeat-media-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectChatRepeatFeedback: true,
    setup: `
      expanded = true;
      const pet = document.querySelector('#pet');
      pet.classList.remove('compact');
      pet.classList.add('expanded');
      localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 70, energy: 70, bond: 50, reason: 'qa chat repeat ready' }));
      loadStoredPetVitals();
      lastChatVitalAt = {};
      await showChat();
      const first = new File([new Uint8Array([1, 2, 3, 4])], 'qa-video-a.webm', { type: 'video/webm' });
      const second = new File([new Uint8Array([5, 6, 7, 8])], 'qa-video-b.webm', { type: 'video/webm' });
      await sendFile(first, 'video');
      await sendFile(second, 'video');
      syncPetAnimationToStatus();
    `
  },
  {
    name: 'chat-video-call-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectChatCallFeedback: true,
    setup: `
      expanded = true;
      const pet = document.querySelector('#pet');
      pet.classList.remove('compact');
      pet.classList.add('expanded');
      pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
      if (petActionTimer) {
        clearTimeout(petActionTimer);
        petActionTimer = null;
      }
      petAnimationLocked = false;
      localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 70, energy: 70, bond: 50, reason: 'qa chat call ready' }));
      loadStoredPetVitals();
      lastChatVitalAt = {};
      await showChat();
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: async () => new MediaStream() }
      });
      window.RTCPeerConnection = class {
        constructor() {
          this.localDescription = null;
          this.onicecandidate = null;
          this.ontrack = null;
        }
        addTrack() {}
        async createOffer() { return { type: 'offer', sdp: 'qa-offer' }; }
        async setLocalDescription(description) { this.localDescription = description; }
        close() {}
      };
      await startChatCall('video');
      syncPetAnimationToStatus();
    `
  },
  {
    name: 'chat-incoming-video-call-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectChatIncomingCallFeedback: true,
    setup: `
      expanded = true;
      const pet = document.querySelector('#pet');
      pet.classList.remove('compact');
      pet.classList.add('expanded');
      pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
      if (petActionTimer) {
        clearTimeout(petActionTimer);
        petActionTimer = null;
      }
      petAnimationLocked = false;
      localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 70, energy: 70, bond: 50, reason: 'qa incoming call ready' }));
      loadStoredPetVitals();
      lastChatVitalAt = {};
      await showChat();
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: async () => new MediaStream() }
      });
      window.__qaRealtimeCalls = [];
      chatSocket = {
        readyState: 1,
        send: value => window.__qaRealtimeCalls.push(JSON.parse(value))
      };
      await handleChatRealtime('call-invite', { mode: 'video', from: 'qa-friend', callId: 'qa-incoming-call' });
      syncPetAnimationToStatus();
    `
  },
  {
    name: 'chat-peer-activity-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectChatPeerActivityFeedback: true,
    setup: `
      expanded = true;
      const pet = document.querySelector('#pet');
      pet.classList.remove('compact');
      pet.classList.add('expanded');
      pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
      if (petActionTimer) {
        clearTimeout(petActionTimer);
        petActionTimer = null;
      }
      petAnimationLocked = false;
      localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 68, energy: 66, bond: 54, reason: 'qa peer activity ready' }));
      loadStoredPetVitals();
      lastChatVitalAt = {};
      await showChat();
      const activity = {
        id: 'qa-peer-activity',
        from: 'qa-friend',
        status: 'work',
        activity: '正在推进 Focus Pet 复盘',
        message: '正在推进 Focus Pet 复盘',
        confidence: 0.88,
        time: new Date().toISOString(),
        currentTask: { id: 'qa-task', text: '完善宠物互动' },
        frontmost: { app: 'Code', title: 'focus-pet' },
        review: { insight: '搭子正在专注推进任务' }
      };
      if (typeof handleChatActivityEvent === 'function') {
        handleChatActivityEvent(activity);
      } else {
        chatState.activities = { ...(chatState.activities || {}), [activity.from]: activity };
        chatState.activityLog = [...(chatState.activityLog || []), activity].slice(-500);
        renderPeerActivity();
      }
      syncPetAnimationToStatus();
    `
  },
  {
    name: 'review-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectReviewFeedback: true,
    setup: `
      expanded = true;
      const pet = document.querySelector('#pet');
      pet.classList.remove('compact');
      pet.classList.add('expanded');
      pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
      if (petActionTimer) {
        clearTimeout(petActionTimer);
        petActionTimer = null;
      }
      petAnimationLocked = false;
      localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 70, energy: 70, bond: 50, reason: 'qa review ready' }));
      localStorage.removeItem('focusPetReviewVitals:v1');
      loadStoredPetVitals();
      await showReview();
      syncPetAnimationToStatus();
    `
  },
  {
    name: 'review-stepfun-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectReviewLlmFeedback: true,
    setup: `
      expanded = true;
      const pet = document.querySelector('#pet');
      pet.classList.remove('compact');
      pet.classList.add('expanded');
      pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
      if (petActionTimer) {
        clearTimeout(petActionTimer);
        petActionTimer = null;
      }
      petAnimationLocked = false;
      localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 70, energy: 70, bond: 50, reason: 'qa stepfun review ready' }));
      localStorage.removeItem('focusPetReviewVitals:v1');
      loadStoredPetVitals();
      await window.focusPet.setQaReview({
        samples: 12,
        workMinutes: 68,
        distractedMinutes: 12,
        unknownMinutes: 4,
        topApps: [['Code', 7], ['Safari', 3]],
        llm: {
          ok: true,
          source: 'stepfun',
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
        }
      });
      await showReview();
      syncPetAnimationToStatus();
    `
  },
  {
    name: 'review-repeat-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectReviewRepeatFeedback: true,
    setup: `
      expanded = true;
      const pet = document.querySelector('#pet');
      pet.classList.remove('compact');
      pet.classList.add('expanded');
      pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
      if (petActionTimer) {
        clearTimeout(petActionTimer);
        petActionTimer = null;
      }
      petAnimationLocked = false;
      localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 70, energy: 70, bond: 50, reason: 'qa review repeat ready' }));
      localStorage.removeItem('focusPetReviewVitals:v1');
      loadStoredPetVitals();
      await showReview();
      await showReview();
      syncPetAnimationToStatus();
    `
  },
  {
    name: 'review-clear-rest-action',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectReviewClearRestAction: true,
    setup: `
      expanded = true;
      const pet = document.querySelector('#pet');
      pet.classList.remove('compact');
      pet.classList.add('expanded');
      pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
      if (petActionTimer) {
        clearTimeout(petActionTimer);
        petActionTimer = null;
      }
      petAnimationLocked = false;
      localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 62, bond: 70, reason: 'qa review clear ready' }));
      localStorage.removeItem('focusPetReviewVitals:v1');
      loadStoredPetVitals();
      taskItems = [
        { id: 'qa-review-clear-1', text: '完成早间专注', priority: 'high', dueDate: '2026-06-23', done: true, order: 1 },
        { id: 'qa-review-clear-2', text: '整理复盘截图', priority: 'medium', dueDate: '', done: true, order: 2 }
      ];
      await showReview();
      syncPetAnimationToStatus();
    `
  },
  {
    name: 'care-menu-low-energy',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'tired',
    expectCareMenu: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 18, bond: 64, reason: 'qa low energy' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('#careMenu').click();
      })();
    `
  },
  {
    name: 'care-menu-low-mood',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'down',
    expectCareMenuLowMood: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 22, energy: 70, bond: 64, reason: 'qa low mood menu' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('#careMenu').click();
      })();
    `
  },
  {
    name: 'care-menu-low-bond',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'guarded',
    expectCareMenuLowBond: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 60, energy: 70, bond: 22, reason: 'qa low bond menu' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('#careMenu').click();
      })();
    `
  },
  {
    name: 'care-menu-familiar-bond-priority',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectCareMenuFamiliarBondPriority: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        taskItems = [];
        appSettings = { ...appSettings, petBehaviorIntensity: 'normal' };
        document.querySelector('#homeActions').classList.remove('hidden');
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 70, bond: 50, reason: 'qa familiar bond priority' }));
        loadStoredPetVitals();
        lastVitalInsightAt = 0;
        lastVitalInsightKey = '';
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('#careMenu').click();
      })();
    `
  },
  {
    name: 'care-menu-escape-close',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'tired',
    expectCareMenuEscapeClose: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        document.querySelector('#panel').classList.add('hidden');
        document.querySelector('#chatPanel').classList.add('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 64, energy: 18, bond: 52, reason: 'qa care escape' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('#careMenu').click();
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      })();
    `
  },
  {
    name: 'compound-fragile-care',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'fragile',
    expectCompoundFragile: true,
    expectCareMenuInsight: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        document.querySelector('#homeActions').classList.remove('hidden');
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 24, energy: 18, bond: 28, reason: 'qa compound fragile' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('#careMenu').click();
      })();
    `
  },
  {
    name: 'compound-fragile-rest-followup',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'fragile',
    expectCompoundRestFollowup: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        document.querySelector('#homeActions').classList.remove('hidden');
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 24, energy: 18, bond: 28, reason: 'qa compound fragile rest' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('#careMenu').click();
        document.querySelector('#careActions button[data-action="rest"]').click();
      })();
    `
  },
  {
    name: 'care-guidance-quick-rest',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectCareGuidanceShortcut: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 18, bond: 64, reason: 'qa quick rest' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        const nextButton = document.querySelector('#petCareNow');
        const previewNode = document.querySelector('#petCarePreview');
        const previewRect = previewNode.getBoundingClientRect();
        const previewStyle = getComputedStyle(previewNode);
        window.__qaCareGuidance = {
          text: document.querySelector('#petCareNext').textContent,
          reason: document.querySelector('#petCareWhy')?.textContent || '',
          reasonTitle: document.querySelector('#petCareWhy')?.title || '',
          reasonAria: document.querySelector('#petCareWhy')?.getAttribute('aria-label') || '',
          detail: document.querySelector('#petCareDetail')?.textContent || '',
          detailTitle: document.querySelector('#petCareDetail')?.title || '',
          detailAria: document.querySelector('#petCareDetail')?.getAttribute('aria-label') || '',
          preview: document.querySelector('#petCarePreview')?.textContent || '',
          previewTitle: document.querySelector('#petCarePreview')?.title || '',
          previewAria: document.querySelector('#petCarePreview')?.getAttribute('aria-label') || '',
          previewTone: document.querySelector('#petCarePreview')?.dataset.tone || '',
          previewClientWidth: previewNode.clientWidth,
          previewScrollWidth: previewNode.scrollWidth,
          previewWhiteSpace: previewStyle.whiteSpace,
          previewOverflow: previewStyle.overflow,
          previewRect: {
            left: previewRect.left,
            top: previewRect.top,
            right: previewRect.right,
            bottom: previewRect.bottom,
            width: previewRect.width,
            height: previewRect.height
          },
          button: nextButton.textContent,
          kind: nextButton.dataset.kind,
          action: nextButton.dataset.action,
          title: nextButton.title,
          display: getComputedStyle(document.querySelector('#petCareGuidance')).display
        };
        nextButton.click();
      })();
    `
  },
  {
    name: 'vital-chip-energy-shortcut',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'tired',
    expectVitalChipEnergyShortcut: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        taskItems = [];
        window.__qaTaskStore.set(taskItems);
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 18, bond: 54, reason: 'qa energy chip shortcut' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('[data-vital-chip="energy"]').click();
      })();
    `
  },
  {
    name: 'vital-insight-low-energy-feed',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectVitalInsightLowEnergyFeed: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 50, bond: 62, reason: 'qa low energy feed' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('[data-vital-chip="energy"]').click();
      })();
    `
  },
  {
    name: 'vital-insight-ready-energy-feed',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectVitalInsightReadyEnergyFeed: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        taskItems = [];
        window.__qaTaskStore.set(taskItems);
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 64, bond: 70, reason: 'qa ready energy feed' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('[data-vital-chip="energy"]').click();
      })();
    `
  },
  {
    name: 'vital-insight-ready-energy-task-risk',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectVitalInsightReadyEnergyTaskRisk: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        taskItems = [
          { id: 'qa-ready-energy-1', text: '整理精力提示', priority: 'high', dueDate: '', done: false, order: 1 }
        ];
        window.__qaTaskStore.set(taskItems);
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 66, bond: 62, reason: 'qa ready energy risk' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('[data-vital-chip="energy"]').click();
      })();
    `
  },
  {
    name: 'vital-insight-full-energy-task',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectVitalInsightFullEnergyTask: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        taskItems = [
          { id: 'qa-full-energy-1', text: '整理饱满精力反馈', priority: 'high', dueDate: '', done: false, order: 1 }
        ];
        window.__qaTaskStore.set(taskItems);
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 88, bond: 62, reason: 'qa full energy task' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('[data-vital-chip="energy"]').click();
      })();
    `
  },
  {
    name: 'vital-insight-low-mood',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'down',
    expectVitalInsightMood: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 28, energy: 64, bond: 50, reason: 'qa low mood insight' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('[data-vital="mood"]').click();
      })();
    `
  },
  {
    name: 'vital-insight-steady-mood-play',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectVitalInsightSteadyMoodPlay: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        taskItems = [];
        window.__qaTaskStore.set(taskItems);
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 50, energy: 64, bond: 62, reason: 'qa steady mood insight' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('[data-vital="mood"]').click();
      })();
    `
  },
  {
    name: 'vital-insight-happy-mood-play',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectVitalInsightHappyMoodPlay: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        taskItems = [];
        window.__qaTaskStore.set(taskItems);
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 70, energy: 64, bond: 62, reason: 'qa happy mood play' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('[data-vital="mood"]').click();
      })();
    `
  },
  {
    name: 'vital-insight-bright-mood-calm',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectVitalInsightBrightMoodCalm: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        taskItems = [];
        window.__qaTaskStore.set(taskItems);
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 86, energy: 64, bond: 62, reason: 'qa bright mood calm' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('[data-vital="mood"]').click();
      })();
    `
  },
  {
    name: 'vital-insight-happy-mood-task',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectVitalInsightHappyMoodTask: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        taskItems = [
          { id: 'qa-happy-mood-1', text: '整理心情反馈', priority: 'high', dueDate: '', done: false, order: 1 }
        ];
        window.__qaTaskStore.set(taskItems);
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 66, bond: 62, reason: 'qa happy mood task' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('[data-vital="mood"]').click();
      })();
    `
  },
  {
    name: 'vital-insight-bond-followup',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectVitalInsightBondFollowup: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 64, bond: 50, reason: 'qa bond insight' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('[data-vital="bond"]').click();
      })();
    `
  },
  {
    name: 'vital-insight-new-bond-reassure',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'guarded',
    expectVitalInsightNewBondReassure: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        taskItems = [];
        window.__qaTaskStore.set(taskItems);
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 64, bond: 22, reason: 'qa new bond reassurance' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('[data-vital="bond"]').click();
      })();
    `
  },
  {
    name: 'vital-insight-close-bond-calm',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectVitalInsightCloseBondCalm: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        taskItems = [];
        window.__qaTaskStore.set(taskItems);
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 64, bond: 70, reason: 'qa close bond calm' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('[data-vital="bond"]').click();
      })();
    `
  },
  {
    name: 'vital-insight-close-bond-task',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectVitalInsightCloseBondTask: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        taskItems = [
          { id: 'qa-close-bond-1', text: '整理亲密反馈', priority: 'high', dueDate: '', done: false, order: 1 }
        ];
        window.__qaTaskStore.set(taskItems);
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 66, bond: 78, reason: 'qa close bond task' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('[data-vital="bond"]').click();
      })();
    `
  },
  {
    name: 'vital-insight-trusted-bond-companion',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectVitalInsightTrustedBondCompanion: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        taskItems = [];
        window.__qaTaskStore.set(taskItems);
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 70, energy: 64, bond: 88, reason: 'qa trusted bond companion' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('[data-vital="bond"]').click();
      })();
    `
  },
  {
    name: 'vital-insight-trusted-bond-task',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectVitalInsightTrustedBondTask: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        taskItems = [
          { id: 'qa-trusted-bond-1', text: '整理默契反馈', priority: 'high', dueDate: '', done: false, order: 1 }
        ];
        window.__qaTaskStore.set(taskItems);
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 66, bond: 88, reason: 'qa trusted bond task' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('[data-vital="bond"]').click();
      })();
    `
  },
  {
    name: 'vital-insight-bond-menu',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectVitalInsightBondMenu: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 64, bond: 50, reason: 'qa bond menu' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('[data-vital="bond"]').click();
        petMenu.classList.remove('hidden');
        renderCareMenu();
      })();
    `
  },
  {
    name: 'vital-insight-repeat-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectVitalInsightRepeat: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        setActiveSurface('home');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 64, bond: 50, reason: 'qa repeat insight' }));
        loadStoredPetVitals();
        lastVitalInsightAt = 0;
        lastVitalInsightKey = '';
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('[data-vital="bond"]').click();
        document.querySelector('[data-vital="bond"]').click();
      })();
    `
  },
  {
    name: 'care-action-low-energy-guard',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'tired',
    expectCareGuardFeedback: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 18, bond: 64, reason: 'qa low energy guard' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('#careMenu').click();
        document.querySelector('#careActions button[data-action="study"]').click();
      })();
    `
  },
  {
    name: 'care-action-guard-repeat-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'tired',
    expectCareGuardRepeatFeedback: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 18, bond: 64, reason: 'qa guard repeat' }));
        loadStoredPetVitals();
        lastCareActionAt = 0;
        lastCareActionName = '';
        updatePetStats();
        syncPetAnimationToStatus();
        runPetAction('study');
        runPetAction('work');
      })();
    `
  },
  {
    name: 'care-action-low-mood-guard',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'down',
    expectCareMoodGuardFeedback: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 22, energy: 70, bond: 64, reason: 'qa low mood guard' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('#careMenu').click();
        document.querySelector('#careActions button[data-action="work"]').click();
      })();
    `
  },
  {
    name: 'care-action-new-bond-soft-guard',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'guarded',
    expectCareBondSoftGuardFeedback: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 60, energy: 70, bond: 22, reason: 'qa new bond guard' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('#careMenu').click();
        document.querySelector('#careActions button[data-action="work"]').click();
      })();
    `
  },
  {
    name: 'care-action-feed-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectFeedFeedback: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        taskItems = [];
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        setActiveSurface('home');
        document.querySelector('#homeActions').classList.remove('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 68, energy: 50, bond: 66, reason: 'qa feed energy' }));
        loadStoredPetVitals();
        lastCareActionAt = 0;
        lastCareActionName = '';
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('#careMenu').click();
        document.querySelector('#careActions button[data-action="feed"]').click();
      })();
    `
  },
  {
    name: 'care-action-rest-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectCareFeedback: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 18, bond: 64, reason: 'qa low energy' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('#careMenu').click();
        document.querySelector('#careActions button[data-action="rest"]').click();
      })();
    `
  },
  {
    name: 'care-menu-cooldown-observation',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectCareMenuCooldownObservation: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 18, bond: 64, reason: 'qa cooldown observation' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('#careMenu').click();
        document.querySelector('#careActions button[data-action="rest"]').click();
        document.querySelector('#careMenu').click();
      })();
    `
  },
  {
    name: 'care-cooldown-action-guard',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectCareCooldownActionGuard: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        taskItems = [];
        panel.classList.add('hidden');
        chatPanel.classList.add('hidden');
        petMenu.classList.add('hidden');
        setActiveSurface('home');
        document.querySelector('#homeActions').classList.remove('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 68, energy: 62, bond: 66, reason: 'qa cooldown guard' }));
        loadStoredPetVitals();
        lastCareActionAt = 0;
        lastCareActionName = '';
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('#careMenu').click();
        document.querySelector('#careActions button[data-action="rest"]').click();
        document.querySelector('#careMenu').click();
        document.querySelector('#careActions button[data-action="feed"]').click();
      })();
    `
  },
  {
    name: 'care-action-repeat-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectCareRepeatFeedback: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 72, energy: 18, bond: 64, reason: 'qa repeat care' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        runPetAction('rest');
        runPetAction('rest');
      })();
    `
  },
  {
    name: 'care-action-play-energy-drop-warning',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectEnergyDropWarning: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 45, energy: 62, bond: 70, reason: 'qa play energy warning' }));
        loadStoredPetVitals();
        updatePetStats();
        syncPetAnimationToStatus();
        document.querySelector('#careMenu').click();
        document.querySelector('#careActions button[data-action="play"]').click();
      })();
    `
  },
  {
    name: 'touch-guarded-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'guarded',
    expectTouchFeedback: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 56, energy: 52, bond: 22, reason: 'qa guarded touch' }));
        loadStoredPetVitals();
        lastTouchVitalAt = 0;
        updatePetStats();
        touchPet({ force: true });
      })();
    `
  },
  {
    name: 'avatar-keyboard-touch',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'guarded',
    expectAvatarKeyboardTouch: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 56, energy: 52, bond: 22, reason: 'qa avatar keyboard touch' }));
        loadStoredPetVitals();
        lastTouchVitalAt = 0;
        updatePetStats();
        document.querySelector('.avatar').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      })();
    `
  },
  {
    name: 'avatar-petting-gesture',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'guarded',
    expectPettingGesture: true,
    setup: `
      await (async () => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest', 'is-petting');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 56, energy: 52, bond: 22, reason: 'qa avatar petting gesture' }));
        loadStoredPetVitals();
        lastTouchVitalAt = 0;
        updatePetStats();
        window.__qaFocusPetCalls.clear();
        await startAvatarDrag({
          button: 0,
          pointerId: 41,
          pointerType: 'mouse',
          screenX: 92,
          screenY: 128,
          clientX: 92,
          clientY: 128,
          preventDefault() {}
        });
        moveAvatarDrag({ pointerId: 41, pointerType: 'mouse', screenX: 110, screenY: 126, clientX: 110, clientY: 126 });
        moveAvatarDrag({ pointerId: 41, pointerType: 'mouse', screenX: 88, screenY: 130, clientX: 88, clientY: 130 });
        moveAvatarDrag({ pointerId: 41, pointerType: 'mouse', screenX: 112, screenY: 127, clientX: 112, clientY: 127 });
        moveAvatarDrag({ pointerId: 41, pointerType: 'mouse', screenX: 90, screenY: 129, clientX: 90, clientY: 129 });
        endAvatarDrag({ type: 'pointerup', pointerId: 41 });
      })();
    `
  },
  {
    name: 'touch-fragile-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'fragile',
    expectTouchFragileFeedback: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 24, energy: 18, bond: 28, reason: 'qa fragile touch' }));
        loadStoredPetVitals();
        lastTouchVitalAt = 0;
        updatePetStats();
        touchPet({ force: true });
      })();
    `
  },
  {
    name: 'touch-repeat-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'guarded',
    expectTouchRepeatFeedback: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 56, energy: 52, bond: 22, reason: 'qa touch repeat' }));
        loadStoredPetVitals();
        lastTouchVitalAt = 0;
        updatePetStats();
        touchPet({ force: true });
        touchPet();
      })();
    `
  },
  {
    name: 'bond-milestone-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'steady',
    expectBondMilestone: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 70, energy: 70, bond: 63, reason: 'qa near close bond' }));
        loadStoredPetVitals();
        applyPetVitalsDelta({ mood: 1, bond: 4 }, '连续陪伴以后，它明显更信任你。');
        syncPetAnimationToStatus();
      })();
    `
  },
  {
    name: 'task-surface-first-watch-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'focused',
    expectTaskSurfaceWatch: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        document.querySelector('#panel').classList.remove('hidden');
        document.querySelector('#taskComposer').classList.remove('hidden');
        document.querySelector('#taskSummary').classList.remove('hidden');
        document.querySelector('#taskList').classList.remove('hidden');
        document.querySelector('#chatPanel').classList.add('hidden');
        document.querySelector('#review').classList.add('hidden');
        document.querySelector('#settingsPanel').classList.add('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 70, energy: 68, bond: 50, reason: 'qa task surface first watch' }));
        loadStoredPetVitals();
        taskItems = [
          { id: 'qa-watch-1', text: '回复用户反馈', priority: 'medium', dueDate: '', done: false, order: 1 }
        ];
        setActiveSurface('tasks');
        renderTaskList();
        applyTaskSurfaceVitalEvent({ force: true });
        message.textContent = taskWatchText();
        syncPetAnimationToStatus();
      })();
    `
  },
  {
    name: 'task-complete-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'focused',
    expectTaskFeedback: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        document.querySelector('#panel').classList.remove('hidden');
        document.querySelector('#taskComposer').classList.remove('hidden');
        document.querySelector('#taskSummary').classList.remove('hidden');
        document.querySelector('#taskList').classList.remove('hidden');
        document.querySelector('#chatPanel').classList.add('hidden');
        document.querySelector('#review').classList.add('hidden');
        document.querySelector('#settingsPanel').classList.add('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 64, energy: 62, bond: 64, reason: 'qa task focus' }));
        loadStoredPetVitals();
        taskItems = [
          { id: 'qa-task-1', text: '发版检查清单', priority: 'high', dueDate: '2026-06-23', done: true, order: 1 },
          { id: 'qa-task-2', text: '回复用户反馈', priority: 'medium', dueDate: '', done: false, order: 2 }
        ];
        setActiveSurface('tasks');
        renderTaskList();
        applyTaskVitalEvent('complete', taskItems[0], { allDone: false });
        message.textContent = taskWatchText('这项完成了，');
        syncPetAnimationToStatus();
      })();
    `
  },
  {
    name: 'task-reopen-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'focused',
    expectTaskReopenFeedback: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        document.querySelector('#panel').classList.remove('hidden');
        document.querySelector('#taskComposer').classList.remove('hidden');
        document.querySelector('#taskSummary').classList.remove('hidden');
        document.querySelector('#taskList').classList.remove('hidden');
        document.querySelector('#chatPanel').classList.add('hidden');
        document.querySelector('#review').classList.add('hidden');
        document.querySelector('#settingsPanel').classList.add('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 64, energy: 62, bond: 64, reason: 'qa task reopen' }));
        loadStoredPetVitals();
        taskItems = [
          { id: 'qa-reopen-1', text: '补充验收说明', priority: 'high', dueDate: '2026-06-23', done: false, order: 1 },
          { id: 'qa-reopen-2', text: '整理后续问题', priority: 'medium', dueDate: '', done: true, order: 2 }
        ];
        setActiveSurface('tasks');
        renderTaskList();
        applyTaskVitalEvent('reopen', taskItems[0]);
        message.textContent = taskWatchText('已恢复为待办，');
        syncPetAnimationToStatus();
      })();
    `
  },
  {
    name: 'task-surface-repeat-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'focused',
    expectTaskSurfaceRepeat: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        document.querySelector('#panel').classList.remove('hidden');
        document.querySelector('#taskComposer').classList.remove('hidden');
        document.querySelector('#taskSummary').classList.remove('hidden');
        document.querySelector('#taskList').classList.remove('hidden');
        document.querySelector('#chatPanel').classList.add('hidden');
        document.querySelector('#review').classList.add('hidden');
        document.querySelector('#settingsPanel').classList.add('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 64, energy: 62, bond: 64, reason: 'qa task repeat' }));
        loadStoredPetVitals();
        lastTaskSurfaceVitalAt = 0;
        lastTaskSurfaceVitalKey = '';
        taskItems = [
          { id: 'qa-repeat-1', text: '回复用户反馈', priority: 'high', dueDate: '2026-06-23', done: false, order: 1 }
        ];
        setActiveSurface('tasks');
        renderTaskList();
        applyTaskSurfaceVitalEvent({ force: true });
        applyTaskSurfaceVitalEvent();
        message.textContent = taskWatchText();
        syncPetAnimationToStatus();
      })();
    `
  },
  {
    name: 'task-clear-celebrate',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'bright',
    expectTaskClear: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        document.querySelector('#panel').classList.remove('hidden');
        document.querySelector('#taskComposer').classList.remove('hidden');
        document.querySelector('#taskSummary').classList.remove('hidden');
        document.querySelector('#taskList').classList.remove('hidden');
        document.querySelector('#tasks').classList.add('hidden');
        document.querySelector('#chatPanel').classList.add('hidden');
        document.querySelector('#review').classList.add('hidden');
        document.querySelector('#settingsPanel').classList.add('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 79, energy: 66, bond: 70, reason: 'qa task clear' }));
        loadStoredPetVitals();
        lastTaskSurfaceVitalAt = 0;
        lastTaskSurfaceVitalKey = '';
        taskItems = [
          { id: 'qa-clear-1', text: '完成早间专注', priority: 'high', dueDate: '2026-06-23', done: true, order: 1 },
          { id: 'qa-clear-2', text: '整理复盘截图', priority: 'medium', dueDate: '', done: true, order: 2 }
        ];
        setActiveSurface('tasks');
        renderTaskList();
        applyTaskSurfaceVitalEvent({ force: true });
        message.textContent = taskWatchText();
        syncPetAnimationToStatus();
      })();
    `
  },
  {
    name: 'task-overload-watch',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'focused',
    expectTaskOverload: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        document.querySelector('#panel').classList.remove('hidden');
        document.querySelector('#taskComposer').classList.remove('hidden');
        document.querySelector('#taskSummary').classList.remove('hidden');
        document.querySelector('#taskList').classList.remove('hidden');
        document.querySelector('#tasks').classList.add('hidden');
        document.querySelector('#chatPanel').classList.add('hidden');
        document.querySelector('#review').classList.add('hidden');
        document.querySelector('#settingsPanel').classList.add('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 70, energy: 68, bond: 66, reason: 'qa task overload' }));
        loadStoredPetVitals();
        taskItems = [
          { id: 'qa-done-1', text: '整理早间记录', priority: 'medium', dueDate: '', done: true, order: 0 },
          { id: 'qa-over-1', text: '高优先级屏幕检查', priority: 'high', dueDate: '2026-06-23', done: false, order: 1 },
          { id: 'qa-over-2', text: '修复任务面板超限', priority: 'high', dueDate: '', done: false, order: 2 },
          { id: 'qa-over-3', text: '整理窗口状态反馈', priority: 'medium', dueDate: '', done: false, order: 3 },
          { id: 'qa-over-4', text: '确认宠物观察动作', priority: 'medium', dueDate: '', done: false, order: 4 },
          { id: 'qa-over-5', text: '补充截图验证', priority: 'medium', dueDate: '', done: false, order: 5 },
          { id: 'qa-over-6', text: '检查紧凑行显示', priority: 'low', dueDate: '', done: false, order: 6 },
          { id: 'qa-over-7', text: '清理多余交互', priority: 'low', dueDate: '', done: false, order: 7 },
          { id: 'qa-over-8', text: '记录剩余风险', priority: 'low', dueDate: '', done: false, order: 8 },
          { id: 'qa-over-9', text: '复测保存按钮位置', priority: 'low', dueDate: '', done: false, order: 9 },
          { id: 'qa-over-10', text: '复测收起按钮位置', priority: 'low', dueDate: '', done: false, order: 10 }
        ];
        setActiveSurface('tasks');
        renderTaskList();
        message.textContent = taskWatchText();
        syncPetAnimationToStatus();
      })();
    `
  },
  {
    name: 'task-delete-relief',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'focused',
    expectTaskDeleteRelief: true,
    setup: `
      await (async () => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        document.querySelector('#panel').classList.remove('hidden');
        document.querySelector('#taskComposer').classList.remove('hidden');
        document.querySelector('#taskSummary').classList.remove('hidden');
        document.querySelector('#taskList').classList.remove('hidden');
        document.querySelector('#tasks').classList.add('hidden');
        document.querySelector('#chatPanel').classList.add('hidden');
        document.querySelector('#review').classList.add('hidden');
        document.querySelector('#settingsPanel').classList.add('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 70, energy: 68, bond: 66, reason: 'qa task delete relief' }));
        loadStoredPetVitals();
        taskItems = [
          { id: 'qa-relief-1', text: '高优先级屏幕检查', priority: 'high', dueDate: '2026-06-23', done: false, order: 1 },
          { id: 'qa-relief-2', text: '修复任务面板超限', priority: 'high', dueDate: '', done: false, order: 2 },
          { id: 'qa-relief-3', text: '整理窗口状态反馈', priority: 'medium', dueDate: '', done: false, order: 3 },
          { id: 'qa-relief-4', text: '确认宠物观察动作', priority: 'medium', dueDate: '', done: false, order: 4 },
          { id: 'qa-relief-5', text: '补充截图验证', priority: 'medium', dueDate: '', done: false, order: 5 },
          { id: 'qa-relief-6', text: '检查紧凑行显示', priority: 'low', dueDate: '', done: false, order: 6 },
          { id: 'qa-relief-7', text: '清理多余交互', priority: 'low', dueDate: '', done: false, order: 7 },
          { id: 'qa-relief-8', text: '记录剩余风险', priority: 'low', dueDate: '', done: false, order: 8 },
          { id: 'qa-relief-9', text: '复测保存按钮位置', priority: 'low', dueDate: '', done: false, order: 9 }
        ];
        window.__qaTaskStore.set(taskItems);
        setActiveSurface('tasks');
        renderTaskList();
        window.__qaFocusPetCalls.clear();
        document.querySelector('.task-item[data-id="qa-relief-4"] .task-icon-button.danger').click();
        await new Promise(resolve => setTimeout(resolve, 80));
        syncPetAnimationToStatus();
      })();
    `
  },
  {
    name: 'task-layout-density',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'focused',
    expectTaskLayoutDensity: true,
    setup: `
      (() => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        document.querySelector('#panel').classList.remove('hidden');
        document.querySelector('#taskComposer').classList.remove('hidden');
        document.querySelector('#taskSummary').classList.remove('hidden');
        document.querySelector('#taskList').classList.remove('hidden');
        document.querySelector('#tasks').classList.add('hidden');
        document.querySelector('#chatPanel').classList.add('hidden');
        document.querySelector('#review').classList.add('hidden');
        document.querySelector('#settingsPanel').classList.add('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 76, energy: 58, bond: 64, reason: 'qa task dense layout' }));
        loadStoredPetVitals();
        taskItems = [
          { id: 'qa-layout-1', text: '学习/工作：写下今天最重要的一件事', priority: 'medium', dueDate: '', done: true, order: 1 },
          { id: 'qa-layout-2', text: '电商系统：推进一个可验证的小步骤', priority: 'medium', dueDate: '2026-06-23', done: false, order: 2 },
          { id: 'qa-layout-3', text: '复盘：晚上记录今天完成了什么', priority: 'medium', dueDate: '2026-06-24', done: false, order: 3 }
        ];
        setActiveSurface('tasks');
        renderTaskList();
        message.textContent = taskWatchText();
        syncPetAnimationToStatus();
      })();
    `
  },
  {
    name: 'task-priority-focus-feedback',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'focused',
    expectTaskPriorityFocus: true,
    setup: `
      await (async () => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        document.querySelector('#panel').classList.remove('hidden');
        document.querySelector('#taskComposer').classList.remove('hidden');
        document.querySelector('#taskSummary').classList.remove('hidden');
        document.querySelector('#taskList').classList.remove('hidden');
        document.querySelector('#tasks').classList.add('hidden');
        document.querySelector('#chatPanel').classList.add('hidden');
        document.querySelector('#review').classList.add('hidden');
        document.querySelector('#settingsPanel').classList.add('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 68, energy: 66, bond: 62, reason: 'qa priority focus' }));
        loadStoredPetVitals();
        taskItems = [
          { id: 'qa-priority-1', text: '整理窗口状态反馈', priority: 'medium', dueDate: '', done: false, order: 1 },
          { id: 'qa-priority-2', text: '复测聊天按钮', priority: 'low', dueDate: '', done: false, order: 2 }
        ];
        window.__qaTaskStore.set(taskItems);
        setActiveSurface('tasks');
        renderTaskList();
        window.__qaFocusPetCalls.clear();
        const priority = document.querySelector('.task-item.current .task-priority');
        priority.value = 'high';
        priority.dispatchEvent(new Event('change', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 100));
        syncPetAnimationToStatus();
      })();
    `
  },
  {
    name: 'task-quick-add-flow',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'focused',
    expectTaskQuickAdd: true,
    setup: `
      await (async () => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        document.querySelector('#panel').classList.remove('hidden');
        document.querySelector('#taskComposer').classList.remove('hidden');
        document.querySelector('#taskSummary').classList.remove('hidden');
        document.querySelector('#taskList').classList.remove('hidden');
        document.querySelector('#tasks').classList.add('hidden');
        document.querySelector('#chatPanel').classList.add('hidden');
        document.querySelector('#review').classList.add('hidden');
        document.querySelector('#settingsPanel').classList.add('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 76, energy: 58, bond: 64, reason: 'qa quick add' }));
        loadStoredPetVitals();
        taskItems = [
          { id: 'qa-add-base', text: '已有任务', priority: 'medium', dueDate: '', done: false, order: 1 }
        ];
        window.__qaTaskStore.set(taskItems);
        setActiveSurface('tasks');
        renderTaskList();
        window.__qaFocusPetCalls.clear();
        document.querySelector('#newTaskText').value = '写验收说明';
        document.querySelector('#newTaskPriority').value = 'high';
        document.querySelector('#newTaskDue').value = '2026-06-24';
        await addTaskFromComposer();
        syncPetAnimationToStatus();
      })();
    `
  },
  {
    name: 'task-limit-add-guard',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'focused',
    expectTaskLimitGuard: true,
    setup: `
      await (async () => {
        const pet = document.querySelector('#pet');
        expanded = true;
        pet.classList.remove('compact');
        pet.classList.add('expanded');
        pet.classList.remove('action-feed', 'action-clean', 'action-study', 'action-work', 'action-play', 'action-rest');
        if (petActionTimer) {
          clearTimeout(petActionTimer);
          petActionTimer = null;
        }
        petAnimationLocked = false;
        document.querySelector('#homeActions').classList.remove('hidden');
        document.querySelector('#panel').classList.remove('hidden');
        document.querySelector('#taskComposer').classList.remove('hidden');
        document.querySelector('#taskSummary').classList.remove('hidden');
        document.querySelector('#taskList').classList.remove('hidden');
        document.querySelector('#tasks').classList.add('hidden');
        document.querySelector('#chatPanel').classList.add('hidden');
        document.querySelector('#review').classList.add('hidden');
        document.querySelector('#settingsPanel').classList.add('hidden');
        localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 76, energy: 58, bond: 64, reason: 'qa task limit guard' }));
        loadStoredPetVitals();
        taskItems = [
          { id: 'qa-limit-1', text: '高优先级屏幕检查', priority: 'high', dueDate: '2026-06-23', done: false, order: 1 },
          { id: 'qa-limit-2', text: '修复任务面板超限', priority: 'high', dueDate: '', done: false, order: 2 },
          { id: 'qa-limit-3', text: '整理窗口状态反馈', priority: 'medium', dueDate: '', done: false, order: 3 },
          { id: 'qa-limit-4', text: '确认宠物观察动作', priority: 'medium', dueDate: '', done: false, order: 4 },
          { id: 'qa-limit-5', text: '补充截图验证', priority: 'medium', dueDate: '', done: false, order: 5 },
          { id: 'qa-limit-6', text: '检查紧凑行显示', priority: 'low', dueDate: '', done: false, order: 6 },
          { id: 'qa-limit-7', text: '清理多余交互', priority: 'low', dueDate: '', done: false, order: 7 },
          { id: 'qa-limit-8', text: '记录剩余风险', priority: 'low', dueDate: '', done: false, order: 8 }
        ];
        window.__qaTaskStore.set(taskItems);
        setActiveSurface('tasks');
        renderTaskList();
        window.__qaFocusPetCalls.clear();
        document.querySelector('#newTaskText').value = '不应新增的第九项';
        document.querySelector('#newTaskPriority').value = 'medium';
        await addTaskFromComposer();
        syncPetAnimationToStatus();
      })();
    `
  },
  {
    name: 'expanded-task-drag-clickthrough',
    windowSize: { width: 540, height: 520 },
    expectedVibe: 'focused',
    expectTaskDragLock: true,
    setup: `
      expanded = true;
      const pet = document.querySelector('#pet');
      pet.classList.remove('compact');
      pet.classList.add('expanded');
      localStorage.setItem('focusPetVitals:v1', JSON.stringify({ mood: 78, energy: 76, bond: 58, reason: 'qa drag ready' }));
      loadStoredPetVitals();
      const dragTasks = [
        { id: 'qa-drag-1', text: '验证展开任务页拖动', priority: 'high', dueDate: '2026-06-23', done: false, order: 1 }
      ];
      taskItems = dragTasks;
      await showTasks();
      taskItems = dragTasks;
      renderTaskList();
      message.textContent = taskWatchText();
      updatePetStats();
      syncPetAnimationToStatus();
      hoverDepth = 0;
      window.__qaFocusPetCalls.clear();
      enterInteractiveZone();
      await startAvatarDrag({
        button: 0,
        pointerId: 97,
        screenX: 120,
        screenY: 120,
        preventDefault() {}
      });
      leaveInteractiveZone();
      moveAvatarDrag({ pointerId: 97, screenX: 150, screenY: 142 });
      endAvatarDrag({ type: 'pointerup', pointerId: 97 });
      window.__qaDragCalls = window.__qaFocusPetCalls.list();
    `
  }
];

const preloadSource = `
const { contextBridge } = require('electron');
const renderErrors = [];
window.addEventListener('error', event => {
  renderErrors.push(event.message || String(event.error || 'renderer error'));
});
window.addEventListener('unhandledrejection', event => {
  renderErrors.push(event.reason?.message || String(event.reason || 'unhandled rejection'));
});
const settings = {
  autoPopupEnabled: false,
  launchAtLogin: false,
  popupCooldownMinutes: 8,
  idleNudgeMinutes: 10,
  maxMediaMb: 25,
  petBehaviorIntensity: 'normal',
  screenMonitorEnabled: false,
  screenMonitorIntervalSeconds: 45,
  screenMonitorEndpoint: '',
  screenMonitorModel: '',
  reviewLlmEnabled: true,
  reviewLlmEndpoint: 'https://api.stepfun.com/step_plan/v1',
  reviewLlmModel: 'step-3.7-flash',
  focusKeywords: [],
  distractionKeywords: [],
  workApps: [],
  updateFeedUrl: '',
  autoCheckUpdates: false,
  platform: {
    platform: 'darwin',
    name: 'macOS',
    accessibilityButtonLabel: '权限',
    screenRecordingButtonLabel: '屏幕权限',
    screenRecordingSettingsAvailable: true,
    permissionHelpText: 'macOS 需要辅助功能权限读取当前 App 和窗口标题。',
    screenMonitorHelpText: '开启屏幕监控前，需要在 macOS 隐私设置里允许屏幕录制。',
    permissionGuideTitle: '权限引导',
    permissionGuideSteps: [
      {
        id: 'accessibility',
        title: '辅助功能',
        summary: '允许 Focus Pet / Electron / Terminal 读取当前 App 和窗口标题。',
        settingsKind: 'accessibility',
        buttonLabel: '打开辅助功能'
      },
      {
        id: 'screen-recording',
        title: '屏幕录制',
        summary: '开启屏幕监控和 LLM 截图分析前，需要允许屏幕录制权限。',
        settingsKind: 'screen-recording',
        buttonLabel: '打开屏幕录制'
      }
    ]
  }
};
const permissionStatus = {
  ...settings.platform,
  checkedAt: '2026-06-29T10:00:00.000Z',
  permissionGuideSteps: settings.platform.permissionGuideSteps.map(step => ({
    ...step,
    status: step.id === 'accessibility' ? 'blocked' : 'granted',
    statusText: step.id === 'accessibility' ? '待开启' : '已开启',
    detail: step.id === 'accessibility'
      ? '请打开辅助功能并允许 Focus Pet / Electron / Terminal。'
      : '已允许屏幕录制。'
  }))
};
const chatStubState = {
  port: 47321,
  authToken: 'qa-token',
  inviteCode: 'TEST',
  self: { id: 'pet-owner', name: '我' },
  friends: [{ id: 'qa-friend', name: '搭子', status: 'online', unread: 0 }],
  messages: [],
  settings
};
const focusPetCalls = [];
const taskStubItems = [];
const cloneTask = task => ({ ...task });
const recordFocusPetCall = (name, args = []) => {
  focusPetCalls.push({ name, args });
  return true;
};
contextBridge.exposeInMainWorld('__qaFocusPetCalls', {
  clear: () => {
    focusPetCalls.length = 0;
  },
  list: () => focusPetCalls.slice()
});
contextBridge.exposeInMainWorld('__qaTaskStore', {
  clear: () => {
    taskStubItems.length = 0;
  },
  set: items => {
    taskStubItems.length = 0;
    taskStubItems.push(...items.map(cloneTask));
  },
  list: () => taskStubItems.map(cloneTask)
});
contextBridge.exposeInMainWorld('focusPet', {
  getStatus: async () => ({
    ok: true,
    status: 'work',
    message: 'Nervy 渲染验证中。',
    app: 'Focus Pet',
    title: 'render verification',
    reason: 'pet render verification'
  }),
  getSettings: async () => settings,
  getPermissionStatus: async () => permissionStatus,
  getChatState: async () => chatStubState,
  setExpanded: async () => true,
  setClickThrough: async enabled => recordFocusPetCall('setClickThrough', [enabled]),
  getWindowPosition: async () => [0, 0],
  setWindowPosition: async (x, y) => recordFocusPetCall('setWindowPosition', [x, y]),
  setQaReview: async review => {
    globalThis.__qaReview = review;
    return true;
  },
  getReview: async () => globalThis.__qaReview || ({
    samples: 12,
    workMinutes: 68,
    distractedMinutes: 12,
    unknownMinutes: 4,
    topApps: [['Code', 7], ['Safari', 3]]
  }),
  getTasks: async () => '# 今日任务\\n',
  saveTasks: async () => true,
  listTasks: async () => taskStubItems.map(cloneTask),
  addTask: async input => {
    recordFocusPetCall('addTask', [input]);
    const saved = {
      id: input.id || \`qa-added-\${taskStubItems.length + 1}\`,
      text: input.text,
      priority: input.priority || 'medium',
      dueDate: input.dueDate || '',
      done: false,
      order: taskStubItems.length + 1
    };
    taskStubItems.push(saved);
    return cloneTask(saved);
  },
  updateTask: async (id, patch) => {
    recordFocusPetCall('updateTask', [id, patch]);
    const index = taskStubItems.findIndex(task => task.id === id);
    if (index >= 0) taskStubItems[index] = { ...taskStubItems[index], ...patch };
    return true;
  },
  toggleTask: async (id, done) => {
    const index = taskStubItems.findIndex(task => task.id === id);
    if (index >= 0) taskStubItems[index] = { ...taskStubItems[index], done };
    return true;
  },
  deleteTask: async id => {
    const index = taskStubItems.findIndex(task => task.id === id);
    if (index >= 0) taskStubItems.splice(index, 1);
    return true;
  },
  moveTask: async (id, direction) => {
    const index = taskStubItems.findIndex(task => task.id === id);
    if (index < 0) return true;
    const swapIndex = direction === 'up' ? Math.max(0, index - 1) : Math.min(taskStubItems.length - 1, index + 1);
    [taskStubItems[index], taskStubItems[swapIndex]] = [taskStubItems[swapIndex], taskStubItems[index]];
    taskStubItems.forEach((task, orderIndex) => {
      task.order = orderIndex + 1;
    });
    return true;
  },
  updateSettings: async patch => ({ ...settings, ...patch }),
  testLlmConnectivity: async patch => {
    recordFocusPetCall('testLlmConnectivity', [patch]);
    return {
      ok: false,
      checkedAt: '2026-06-29T10:00:00.000Z',
      checks: [
        {
          id: 'screen-monitor',
          title: '屏幕监控 LLM',
          ok: false,
          status: 'needs-config',
          endpoint: patch.screenMonitorEndpoint || '',
          model: patch.screenMonitorModel || 'vision-model',
          apiKeyPresent: false,
          missing: ['endpoint', 'apiKey'],
          requestSent: false,
          summary: '屏幕监控 LLM 缺少 endpoint、API key。',
          detail: '没有发送测试请求，因为配置还不完整。',
          nextSteps: [
            '在屏幕监控的 LLM Endpoint 填入完整 Chat Completions 地址，例如 https://api.example.com/v1/chat/completions。',
            '在启动应用前设置 FOCUS_PET_LLM_API_KEY；如果使用 OpenAI-compatible 默认 key，也可以设置 OPENAI_API_KEY。'
          ]
        },
        {
          id: 'review-llm',
          title: '复盘 LLM',
          ok: false,
          status: 'needs-config',
          endpoint: 'https://api.stepfun.com/step_plan/v1/chat/completions',
          model: patch.reviewLlmModel || 'step-3.7-flash',
          apiKeyPresent: false,
          missing: ['apiKey'],
          requestSent: false,
          summary: '复盘 LLM 缺少 API key。',
          detail: '没有发送测试请求，因为配置还不完整。',
          nextSteps: [
            '在启动应用前设置 FOCUS_PET_REVIEW_LLM_API_KEY、FOCUS_PET_STEPFUN_API_KEY、STEPFUN_API_KEY 或 STEP_API_KEY。'
          ]
        }
      ]
    };
  },
  checkUpdate: async () => ({ ok: false, reason: 'verification stub' }),
  openAccessibilitySettings: async () => true,
  openScreenRecordingSettings: async () => true,
  openExternal: async () => true,
  openDataDir: async () => true,
  quit: async () => true,
  updateSelf: async patch => patch,
  addFriend: async name => ({ name }),
  joinInvite: async () => true,
  removeFriend: async () => true,
  markRead: async () => true,
  clearHistory: async () => true,
  resetInvite: async () => 'TEST',
  sendChatMessage: async message => {
    const saved = { id: message.id || 'qa-message-1', createdAt: new Date().toISOString(), deliveryStatus: 'sent', ...message };
    chatStubState.messages.push(saved);
    return saved;
  },
  saveChatMedia: async media => ({ id: 'qa-media-1', url: '/media/qa-media-1', ...media, size: Buffer.from(String(media.data || ''), 'base64').length }),
  sendMessage: async message => message,
  saveMedia: async media => media
});
contextBridge.exposeInMainWorld('focusPetRenderErrors', {
  list: () => renderErrors.slice()
});
`;

const scenarioFilter = String(process.env.FOCUS_PET_RENDER_SCENARIO || '').trim();
const activeScenarios = scenarioFilter
  ? scenarios.filter(scenario => scenario.name === scenarioFilter)
  : scenarios;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function destroyBrowserWindow(browserWindow) {
  if (!browserWindow || browserWindow.isDestroyed()) return Promise.resolve();
  return new Promise(resolve => {
    const timeout = setTimeout(resolve, 1000);
    timeout.unref?.();
    browserWindow.once('closed', () => {
      clearTimeout(timeout);
      resolve();
    });
    browserWindow.destroy();
  });
}

function countOpaquePixels(nativeImage, rect, windowSize) {
  const size = nativeImage.getSize();
  const bitmap = nativeImage.toBitmap();
  const scaleX = size.width / windowSize.width;
  const scaleY = size.height / windowSize.height;
  const left = Math.max(0, Math.floor(rect.left * scaleX));
  const top = Math.max(0, Math.floor(rect.top * scaleY));
  const right = Math.min(size.width, Math.ceil(rect.right * scaleX));
  const bottom = Math.min(size.height, Math.ceil(rect.bottom * scaleY));
  let opaquePixels = 0;
  let coloredPixels = 0;

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const offset = (y * size.width + x) * 4;
      const blue = bitmap[offset];
      const green = bitmap[offset + 1];
      const red = bitmap[offset + 2];
      const alpha = bitmap[offset + 3];
      if (alpha > 16) opaquePixels += 1;
      if (alpha > 16 && (Math.abs(red - green) > 8 || Math.abs(red - blue) > 8 || Math.abs(green - blue) > 8)) coloredPixels += 1;
    }
  }

  return {
    rectPixels: Math.max(0, right - left) * Math.max(0, bottom - top),
    opaquePixels,
    coloredPixels
  };
}

function rectRangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

async function verifyScenario(browserWindow, scenario, { reload = false } = {}) {
  const screenshotPath = path.join(outputDir, `nervy-render-${scenario.name}.png`);
  browserWindow.setSize(scenario.windowSize.width, scenario.windowSize.height, false);
  if (reload) {
    await browserWindow.loadFile(path.join(root, 'src', 'index.html'));
    await delay(900);
  }
  if (scenario.setup) {
    try {
      const setupResult = await browserWindow.webContents.executeJavaScript(`
        (async () => {
          try {
            ${scenario.setup}
            return { ok: true };
          } catch (error) {
            return { ok: false, message: error?.stack || error?.message || String(error) };
          }
        })()
      `);
      if (!setupResult?.ok) throw new Error(setupResult?.message || 'setup returned failure');
    } catch (error) {
      const renderErrors = await browserWindow.webContents.executeJavaScript('window.focusPetRenderErrors?.list?.() || []').catch(() => []);
      throw new Error(`${scenario.name} setup failed: ${error.message}${renderErrors.length ? `; renderer errors: ${renderErrors.join(' | ')}` : ''}`);
    }
  }
  await delay(120);

  const domState = await browserWindow.webContents.executeJavaScript(`
    (() => {
      const pet = document.querySelector('#pet');
      const bubbleNode = document.querySelector('.bubble');
      const panelNode = document.querySelector('#panel');
      const chatPanelNode = document.querySelector('#chatPanel');
      const avatar = document.querySelector('.avatar');
      const sprite = document.querySelector('.pet-sprite');
      const petStats = document.querySelector('#petStats');
      const petMenu = document.querySelector('#petMenu');
      const careFeedback = document.querySelector('#petCareFeedback');
      const careReason = document.querySelector('#petCareReason');
      const careReasonStyle = getComputedStyle(careReason);
      const careGuidance = document.querySelector('#petCareGuidance');
      const careNow = document.querySelector('#petCareNow');
      const contextLine = document.querySelector('#context');
      const messageLine = document.querySelector('#message');
      const taskSummary = document.querySelector('#taskSummary');
      const taskList = document.querySelector('#taskList');
      const taskComposer = document.querySelector('#taskComposer');
      const taskComposerFeedback = document.querySelector('#taskComposerFeedback');
      const panelActions = document.querySelector('.panel-actions');
      const reviewSummary = document.querySelector('.review-summary');
      const reviewBadge = document.querySelector('.review-summary b');
      const reviewBox = document.querySelector('#review');
      const reviewAi = document.querySelector('.review-ai');
      const chatCompose = document.querySelector('.chat-compose');
      const chatTools = document.querySelector('.chat-tools');
      const chatHeader = document.querySelector('.chat-header');
      const chatCallStageNode = document.querySelector('#chatCallStage');
      const chatCallStatusNode = document.querySelector('#chatCallStatus');
      const chatRtcNoticeNode = document.querySelector('#chatRtcNotice');
      const peerActivityNode = document.querySelector('#peerActivity');
      const peerActivityStyle = getComputedStyle(peerActivityNode);
      const settingIntensity = document.querySelector('#settingIntensity');
      const onboardingPanelNode = document.querySelector('#onboardingPanel');
      const onboardingCards = Array.from(document.querySelectorAll('.onboarding-card'));
      const expandHint = document.querySelector('#expandHint');
      const reviewRect = reviewBox.getBoundingClientRect();
      const reviewLastRowRect = Array.from(document.querySelectorAll('.review-row')).at(-1)?.getBoundingClientRect();
      const spriteStyle = getComputedStyle(sprite);
      const avatarStyle = getComputedStyle(avatar);
      const avatarGazeStyle = getComputedStyle(avatar, '::after');
      const panelStyle = getComputedStyle(panelNode);
      const chatPanelStyle = getComputedStyle(chatPanelNode);
      const contextStyle = getComputedStyle(contextLine);
      const bubbleRect = bubbleNode.getBoundingClientRect();
      const avatarRect = avatar.getBoundingClientRect();
      const panelRect = panelNode.getBoundingClientRect();
      const chatPanelRect = chatPanelNode.getBoundingClientRect();
      const messageRect = messageLine.getBoundingClientRect();
      const contextRect = contextLine.getBoundingClientRect();
      const statsRect = petStats.getBoundingClientRect();
      const menuRect = petMenu.getBoundingClientRect();
      const guidanceRect = careGuidance.getBoundingClientRect();
      const taskListRect = taskList.getBoundingClientRect();
      const taskComposerRect = taskComposer.getBoundingClientRect();
      const panelActionsRect = panelActions.getBoundingClientRect();
      const homeActionsNode = document.querySelector('#homeActions');
      const homeActionsRect = homeActionsNode.getBoundingClientRect();
      const pseudoContent = (element, pseudo) => (
        getComputedStyle(element, pseudo).content || ''
      ).replace(/^["']|["']$/g, '').replace(/^none$|^normal$/, '');
      const homeActionState = selector => {
        const button = document.querySelector(selector);
        return {
          text: button.querySelector('.home-action-label')?.textContent || button.textContent,
          meta: button.querySelector('.home-action-meta')?.textContent || '',
          metaHidden: button.querySelector('.home-action-meta')?.hidden ?? true
        };
      };
      const careButtons = Array.from(document.querySelectorAll('#careActions button')).map(button => ({
        action: button.dataset.action,
        guard: button.dataset.guard || '',
        recommended: button.classList.contains('recommended'),
        title: button.title,
        cueText: button.querySelector('.care-action-copy small')?.textContent || '',
        noteText: button.querySelector('.care-action-note')?.textContent || '',
        reasonBadges: Array.from(button.querySelectorAll('.care-action-effects em[data-recommendation-reason="true"]')).map(item => item.textContent),
        guardLabels: Array.from(button.querySelectorAll('.care-action-effects em[data-guard]')).map(item => item.textContent),
        impactBadges: Array.from(button.querySelectorAll('.care-action-effects i[data-impact]')).map(item => ({
          text: item.textContent,
          tone: item.dataset.impact
        })),
        stageBadges: Array.from(button.querySelectorAll('.care-action-effects em[data-stage-preview]')).map(item => ({
          text: item.textContent,
          tone: item.dataset.stagePreview
        })),
        text: button.textContent,
        effectCount: button.querySelectorAll('.care-action-effects i').length
      }));
      const careMenuInsight = document.querySelector('#careMenuInsight');
      const careMenuInsightStyle = getComputedStyle(careMenuInsight || document.createElement('p'));
      const vitalFocusReason = document.querySelector('#petVitalFocusReason');
      const vitalFocusReasonStyle = getComputedStyle(vitalFocusReason || document.createElement('small'));
      const chatRows = Array.from(document.querySelectorAll('.chat-message'));
      const chatSystemRows = Array.from(document.querySelectorAll('.chat-system'));
      const chatEmpty = document.querySelector('.chat-empty');
      const chatMessageMeta = Array.from(document.querySelectorAll('.chat-message-meta'));
      const firstMineBubble = document.querySelector('.chat-message.mine');
      const firstTheirsBubble = document.querySelector('.chat-message.theirs');
      const mineStyle = firstMineBubble ? getComputedStyle(firstMineBubble) : null;
      const theirsStyle = firstTheirsBubble ? getComputedStyle(firstTheirsBubble) : null;
      const messagesStyle = getComputedStyle(chatMessages);
      const rectState = rect => ({
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      });
      const taskRowStates = Array.from(document.querySelectorAll('.task-item')).map(row => {
        const rowRect = row.getBoundingClientRect();
        const meta = row.querySelector('.task-meta');
        const actions = row.querySelector('.task-actions');
        const title = row.querySelector('.task-title-input');
        return {
          done: row.classList.contains('done'),
          current: row.classList.contains('current'),
          rect: rectState(rowRect),
          metaRect: meta ? rectState(meta.getBoundingClientRect()) : null,
          actionsRect: actions ? rectState(actions.getBoundingClientRect()) : null,
          titleRect: title ? rectState(title.getBoundingClientRect()) : null
        };
      });
      return {
        petClasses: Array.from(pet.classList),
        bubble: {
          rect: {
            left: bubbleRect.left,
            top: bubbleRect.top,
            right: bubbleRect.right,
            bottom: bubbleRect.bottom,
            width: bubbleRect.width,
            height: bubbleRect.height
          }
        },
        avatarRect: {
          left: avatarRect.left,
          top: avatarRect.top,
          right: avatarRect.right,
          bottom: avatarRect.bottom,
          width: avatarRect.width,
          height: avatarRect.height
        },
        avatarA11y: {
          role: avatar.getAttribute('role') || '',
          tabIndex: avatar.tabIndex,
          aria: avatar.getAttribute('aria-label') || '',
          title: avatar.title || ''
        },
        panel: {
          hidden: panelNode.classList.contains('hidden'),
          display: panelStyle.display,
          rect: {
            left: panelRect.left,
            top: panelRect.top,
            right: panelRect.right,
            bottom: panelRect.bottom,
            width: panelRect.width,
            height: panelRect.height
          }
        },
        chatPanelRect: {
          hidden: chatPanelNode.classList.contains('hidden'),
          display: chatPanelStyle.display,
          rect: {
            left: chatPanelRect.left,
            top: chatPanelRect.top,
            right: chatPanelRect.right,
            bottom: chatPanelRect.bottom,
            width: chatPanelRect.width,
            height: chatPanelRect.height
          }
        },
        spriteBackgroundImage: spriteStyle.backgroundImage,
        spriteBackgroundSize: spriteStyle.backgroundSize,
        spriteBackgroundPosition: spriteStyle.backgroundPosition,
        message: document.querySelector('#message').textContent,
        activeElement: {
          id: document.activeElement?.id || '',
          action: document.activeElement?.dataset?.action || '',
          className: document.activeElement?.className || '',
          text: document.activeElement?.textContent || ''
        },
        messageRect: {
          left: messageRect.left,
          top: messageRect.top,
          right: messageRect.right,
          bottom: messageRect.bottom,
          width: messageRect.width,
          height: messageRect.height
        },
        contextDisplay: contextStyle.display,
        contextRect: {
          left: contextRect.left,
          top: contextRect.top,
          right: contextRect.right,
          bottom: contextRect.bottom,
          width: contextRect.width,
          height: contextRect.height
        },
        petStatsDisplay: getComputedStyle(petStats).display,
        vibe: pet.dataset.vibe,
        surface: pet.dataset.surface,
        nudge: {
          before: window.__qaIdleNudge || null,
          target: pet.dataset.nudgeTarget || '',
          label: expandHint.textContent,
          title: expandHint.title,
          display: getComputedStyle(expandHint).display
        },
        petStateSummary: document.querySelector('#petStateSummary').textContent,
        petCareCue: document.querySelector('#petCareCue').textContent,
        taskProgress: document.querySelector('#taskProgress').textContent,
        review: {
          hidden: document.querySelector('#review').classList.contains('hidden'),
          summary: reviewSummary?.textContent || '',
          tone: reviewBadge?.dataset.tone || '',
          ai: {
            text: reviewAi?.textContent || '',
            display: getComputedStyle(reviewAi || document.createElement('div')).display
          },
          rows: Array.from(document.querySelectorAll('.review-row')).map(row => row.textContent),
          nextAction: {
            text: document.querySelector('.review-next-action span')?.textContent || '',
            reason: document.querySelector('.review-next-action small')?.textContent || '',
            button: document.querySelector('.review-next-action button')?.textContent || '',
            action: document.querySelector('.review-next-action button')?.dataset.action || '',
            kind: document.querySelector('.review-next-action button')?.dataset.kind || '',
            title: document.querySelector('.review-next-action button')?.title || '',
            display: getComputedStyle(document.querySelector('.review-next-action') || document.createElement('div')).display
          },
          clientHeight: reviewBox.clientHeight,
          scrollHeight: reviewBox.scrollHeight,
          rect: {
            left: reviewRect.left,
            top: reviewRect.top,
            right: reviewRect.right,
            bottom: reviewRect.bottom,
            width: reviewRect.width,
            height: reviewRect.height
          },
          lastRowRect: reviewLastRowRect ? {
            left: reviewLastRowRect.left,
            top: reviewLastRowRect.top,
            right: reviewLastRowRect.right,
            bottom: reviewLastRowRect.bottom,
            width: reviewLastRowRect.width,
            height: reviewLastRowRect.height
          } : null
        },
        task: {
          load: pet.dataset.taskLoad,
          behavior: pet.dataset.taskBehavior || '',
          activity: pet.dataset.taskActivity || '',
          target: pet.dataset.taskTarget || '',
          summaryLoad: taskSummary.dataset.load,
          composerDisplay: getComputedStyle(taskComposer).display,
          composerFeedback: {
            text: taskComposerFeedback?.textContent || '',
            hidden: taskComposerFeedback?.hidden ?? true,
            tone: taskComposerFeedback?.dataset.tone || '',
            inputValue: document.querySelector('#newTaskText')?.value || '',
            dueValue: document.querySelector('#newTaskDue')?.value || '',
            invalid: document.querySelector('#newTaskText')?.getAttribute('aria-invalid') || ''
          },
          note: document.querySelector('.task-load-note')?.textContent || '',
          noteReaction: document.querySelector('.task-load-note small')?.textContent || '',
          overflowNote: document.querySelector('.task-overflow-note')?.textContent || '',
          rowCount: document.querySelectorAll('.task-item').length,
          currentText: document.querySelector('.task-item.current .task-title-input')?.value || '',
          composerRect: {
            left: taskComposerRect.left,
            top: taskComposerRect.top,
            right: taskComposerRect.right,
            bottom: taskComposerRect.bottom,
            width: taskComposerRect.width,
            height: taskComposerRect.height
          },
          composerItems: Array.from(taskComposer.children).map(child => rectState(child.getBoundingClientRect())),
          rows: taskRowStates,
          listRect: {
            left: taskListRect.left,
            top: taskListRect.top,
            right: taskListRect.right,
            bottom: taskListRect.bottom,
            width: taskListRect.width,
            height: taskListRect.height
          },
          actionsRect: {
            left: panelActionsRect.left,
            top: panelActionsRect.top,
            right: panelActionsRect.right,
            bottom: panelActionsRect.bottom,
            width: panelActionsRect.width,
            height: panelActionsRect.height
          },
          gaze: {
            lookX: avatarStyle.getPropertyValue('--pet-look-x').trim(),
            lookY: avatarStyle.getPropertyValue('--pet-look-y').trim(),
            animationName: avatarGazeStyle.animationName,
            width: avatarGazeStyle.width
          }
        },
        chat: {
          hidden: chatPanelNode.classList.contains('hidden'),
          friendText: document.querySelector('#friendSelect').selectedOptions[0]?.textContent || '',
          messageCount: chatRows.length,
          lastMessage: chatRows.at(-1)?.textContent || '',
          emptyText: chatEmpty?.textContent || '',
          systemTexts: chatSystemRows.map(row => row.textContent || ''),
          headerDisplay: getComputedStyle(chatHeader).display,
          metaCount: chatMessages.querySelectorAll('.chat-message strong').length,
          visibleMetaTexts: chatMessageMeta.map(item => item.textContent || ''),
          messageTitles: chatRows.map(row => row.title || ''),
          mediaCount: chatMessages.querySelectorAll('video, audio, img').length,
          fileCardCount: chatMessages.querySelectorAll('.chat-file-card').length,
          fileCardTexts: Array.from(chatMessages.querySelectorAll('.chat-file-card')).map(card => card.textContent || ''),
          fileCardHrefs: Array.from(chatMessages.querySelectorAll('.chat-file-card')).map(card => card.getAttribute('href') || ''),
          attachmentTypes: chatRows.map(row => row.dataset.attachmentType || ''),
          fileInputAccept: document.querySelector('#mediaInput')?.accept || '',
          messagesBackground: messagesStyle.backgroundColor,
          messagesRadius: messagesStyle.borderRadius,
          mineBackground: mineStyle?.backgroundColor || '',
          mineColor: mineStyle?.color || '',
          theirsBackground: theirsStyle?.backgroundColor || '',
          composeDisplay: getComputedStyle(chatCompose).display,
          toolsDisplay: getComputedStyle(chatTools).display,
          toolButtons: Array.from(chatTools.querySelectorAll('button')).map(button => button.textContent),
          callStageHidden: chatCallStageNode.hidden || chatCallStageNode.classList.contains('hidden'),
          callStageDisplay: getComputedStyle(chatCallStageNode).display,
          callStatus: chatCallStatusNode.textContent,
          callStatusHidden: chatCallStatusNode.hidden,
          callStatusDisplay: getComputedStyle(chatCallStatusNode).display,
          rtcNoticeHidden: chatRtcNoticeNode?.hidden ?? true,
          rtcNoticeDisplay: getComputedStyle(chatRtcNoticeNode || document.createElement('div')).display,
          rtcNoticeText: chatRtcNoticeNode?.textContent || '',
          callButtons: Array.from(chatCallStageNode.querySelectorAll('button')).map(button => button.textContent),
          visibleCallButtons: Array.from(chatCallStageNode.querySelectorAll('button'))
            .filter(button => !button.hidden && getComputedStyle(button).display !== 'none')
            .map(button => button.textContent),
          activityHidden: peerActivityNode.hidden,
          activityDisplay: peerActivityStyle.display,
          activityTitle: document.querySelector('#peerActivityTitle')?.textContent || '',
          activityText: document.querySelector('#peerActivityText')?.textContent || '',
          activityMeta: document.querySelector('#peerActivityMeta')?.textContent || '',
          activityLogText: document.querySelector('#peerActivityLog')?.textContent || ''
        },
        settings: {
          hidden: settingsPanel.classList.contains('hidden'),
          intensity: settingIntensity.value,
          llmSelfCheck: (() => {
            const result = document.querySelector('#llmSelfCheckResult');
            const cards = Array.from(document.querySelectorAll('.llm-check-card'));
            const measuredNodes = [
              result,
              ...cards,
              ...Array.from(document.querySelectorAll('.llm-check-card p, .llm-check-card small, .llm-check-detail, .llm-next-steps, .llm-next-steps li'))
            ].filter(Boolean);
            return {
              text: result?.textContent || '',
              cardCount: cards.length,
              statuses: cards.map(card => card.className),
              summaries: cards.map(card => card.querySelector('p')?.textContent || ''),
              details: cards.map(card => card.querySelector('.llm-check-detail')?.textContent || ''),
              steps: Array.from(document.querySelectorAll('.llm-next-steps li')).map(item => item.textContent),
              overflowingNodes: measuredNodes
                .filter(node => node.scrollWidth > node.clientWidth + 1)
                .map(node => ({
                  tag: node.tagName,
                  className: node.className || '',
                  clientWidth: node.clientWidth,
                  scrollWidth: node.scrollWidth,
                  text: String(node.textContent || '').slice(0, 80)
                }))
            };
          })()
        },
        onboarding: (() => {
          const measuredNodes = [
            ...onboardingCards,
            ...Array.from(document.querySelectorAll('.onboarding-summary, .onboarding-facts, .onboarding-facts dd, .onboarding-card button'))
          ].filter(Boolean);
          return {
            hidden: onboardingPanelNode.classList.contains('hidden'),
            complete: onboardingPanelNode.dataset.onboardingComplete || '',
            cardCount: onboardingCards.length,
            modes: onboardingCards.map(card => card.dataset.onboardingMode || ''),
            text: onboardingPanelNode.textContent || '',
            overflowingNodes: measuredNodes
              .filter(node => getComputedStyle(node).display !== 'none' && node.scrollWidth > node.clientWidth + 1)
              .map(node => ({
                tag: node.tagName,
                className: node.className || '',
                clientWidth: node.clientWidth,
                scrollWidth: node.scrollWidth,
                text: String(node.textContent || '').slice(0, 80)
              }))
          };
        })(),
        focusPetCalls: window.__qaFocusPetCalls?.list?.() || [],
        realtimeCalls: window.__qaRealtimeCalls || [],
        dragCalls: window.__qaDragCalls || [],
        careFeedback: {
          reason: careReason.textContent,
          aria: careFeedback.getAttribute('aria-label') || '',
          title: careFeedback.title || '',
          role: careFeedback.getAttribute('role') || '',
          live: careFeedback.getAttribute('aria-live') || '',
          reasonStyle: {
            display: careReasonStyle.display,
            overflow: careReasonStyle.overflow,
            textOverflow: careReasonStyle.textOverflow,
            whiteSpace: careReasonStyle.whiteSpace,
            webkitLineClamp: careReasonStyle.webkitLineClamp
          },
          source: document.querySelector('#petCareSource')?.textContent || '',
          sourceHidden: document.querySelector('#petCareSource')?.hidden ?? true,
          sourceTitle: document.querySelector('#petCareSource')?.title || '',
          sourceData: careFeedback.dataset.source || '',
          sourceDetail: careFeedback.dataset.sourceDetail || '',
          recent: document.querySelector('#petCareRecent')?.textContent || '',
          recentHidden: document.querySelector('#petCareRecent')?.hidden ?? true,
          delta: document.querySelector('#petCareDelta').title || document.querySelector('#petCareDelta').textContent,
          deltaText: document.querySelector('#petCareDelta').textContent,
          deltaDetail: document.querySelector('#petCareDelta').title || '',
          tone: careFeedback.dataset.tone,
          milestone: careFeedback.dataset.milestone || '',
          milestoneTone: careFeedback.dataset.milestoneTone || '',
          moodLabel: document.querySelector('[data-vital="mood"] span').textContent,
          moodStage: petStats.dataset.moodStage,
          energyLabel: document.querySelector('[data-vital="energy"] span').textContent,
          energyStage: petStats.dataset.energyStage,
          bondLabel: document.querySelector('[data-vital="bond"] span').textContent,
          bondStage: petStats.dataset.bondStage,
          focus: petStats.dataset.focus || '',
          focusSource: petStats.dataset.focusSource || '',
          feedbackFocus: careFeedback.dataset.focus || '',
          feedbackFocusSource: careFeedback.dataset.focusSource || '',
          vitalHints: {
            mood: document.querySelector('[data-vital="mood"]').getAttribute('aria-label') || '',
            energy: document.querySelector('[data-vital="energy"]').getAttribute('aria-label') || '',
            bond: document.querySelector('[data-vital="bond"]').getAttribute('aria-label') || ''
          },
          vitalDeltas: {
            mood: {
              text: document.querySelector('#moodDelta')?.textContent || '',
              hidden: document.querySelector('#moodDelta')?.hidden ?? true,
              trend: document.querySelector('#moodDelta')?.dataset.trend || ''
            },
            energy: {
              text: document.querySelector('#energyDelta')?.textContent || '',
              hidden: document.querySelector('#energyDelta')?.hidden ?? true,
              trend: document.querySelector('#energyDelta')?.dataset.trend || ''
            },
            bond: {
              text: document.querySelector('#bondDelta')?.textContent || '',
              hidden: document.querySelector('#bondDelta')?.hidden ?? true,
              trend: document.querySelector('#bondDelta')?.dataset.trend || ''
            }
          },
          vitalTargets: {
            mood: {
              text: document.querySelector('#moodTarget')?.textContent || '',
              hidden: document.querySelector('#moodTarget')?.hidden ?? true
            },
            energy: {
              text: document.querySelector('#energyTarget')?.textContent || '',
              hidden: document.querySelector('#energyTarget')?.hidden ?? true
            },
            bond: {
              text: document.querySelector('#bondTarget')?.textContent || '',
              hidden: document.querySelector('#bondTarget')?.hidden ?? true
            }
          },
          trends: Object.fromEntries(Array.from(document.querySelectorAll('.vital-row')).map(row => [row.dataset.vital, row.dataset.trend])),
          needs: Object.fromEntries(Array.from(document.querySelectorAll('.vital-row')).map(row => [row.dataset.vital, row.dataset.need || ''])),
          needBadges: Object.fromEntries(Array.from(document.querySelectorAll('.vital-row')).map(row => [row.dataset.vital, pseudoContent(row.querySelector('span'), '::after')])),
          focusedRows: Object.fromEntries(Array.from(document.querySelectorAll('.vital-row')).map(row => [row.dataset.vital, row.dataset.focus || 'false'])),
          pressedRows: Object.fromEntries(Array.from(document.querySelectorAll('.vital-row')).map(row => [row.dataset.vital, row.getAttribute('aria-pressed') || ''])),
          vitalChips: Object.fromEntries(Array.from(document.querySelectorAll('[data-vital-chip]')).map(chip => [chip.dataset.vitalChip, {
            text: chip.textContent,
            need: chip.dataset.need || '',
            focus: chip.dataset.focus || 'false',
            stage: chip.dataset.stage || '',
            title: chip.title || '',
            aria: chip.getAttribute('aria-label') || '',
            pressed: chip.getAttribute('aria-pressed') || ''
          }]))
        },
        vitalFocusAction: {
          hidden: document.querySelector('#petVitalFocusAction')?.hidden ?? true,
          vital: document.querySelector('#petVitalFocusAction')?.dataset.vital || '',
          action: document.querySelector('#petVitalFocusButton')?.dataset.action || '',
          kind: document.querySelector('#petVitalFocusButton')?.dataset.kind || '',
          label: document.querySelector('#petVitalFocusLabel')?.textContent || '',
          goal: document.querySelector('#petVitalFocusGoal')?.textContent || '',
          goalHidden: document.querySelector('#petVitalFocusGoal')?.hidden ?? true,
          goalTitle: document.querySelector('#petVitalFocusGoal')?.title || '',
          reason: document.querySelector('#petVitalFocusReason')?.textContent || '',
          reasonStyle: {
            display: vitalFocusReasonStyle.display,
            overflow: vitalFocusReasonStyle.overflow,
            textOverflow: vitalFocusReasonStyle.textOverflow,
            whiteSpace: vitalFocusReasonStyle.whiteSpace,
            webkitLineClamp: vitalFocusReasonStyle.webkitLineClamp
          },
          impact: document.querySelector('#petVitalFocusImpact')?.textContent || '',
          impactHidden: document.querySelector('#petVitalFocusImpact')?.hidden ?? true,
          impactTone: document.querySelector('#petVitalFocusImpact')?.dataset.tone || '',
          impactTitle: document.querySelector('#petVitalFocusImpact')?.title || '',
          button: document.querySelector('#petVitalFocusButton')?.textContent || '',
          title: document.querySelector('#petVitalFocusButton')?.title || '',
          aria: document.querySelector('#petVitalFocusButton')?.getAttribute('aria-label') || ''
        },
        careGuidance: {
          before: window.__qaCareGuidance || null,
          text: document.querySelector('#petCareNext').textContent,
          reason: document.querySelector('#petCareWhy')?.textContent || '',
          reasonTitle: document.querySelector('#petCareWhy')?.title || '',
          reasonAria: document.querySelector('#petCareWhy')?.getAttribute('aria-label') || '',
          detail: document.querySelector('#petCareDetail')?.textContent || '',
          detailTitle: document.querySelector('#petCareDetail')?.title || '',
          detailAria: document.querySelector('#petCareDetail')?.getAttribute('aria-label') || '',
          preview: document.querySelector('#petCarePreview')?.textContent || '',
          previewTitle: document.querySelector('#petCarePreview')?.title || '',
          previewAria: document.querySelector('#petCarePreview')?.getAttribute('aria-label') || '',
          previewTone: document.querySelector('#petCarePreview')?.dataset.tone || '',
          button: careNow.textContent,
          action: careNow.dataset.action || '',
          kind: careNow.dataset.kind || '',
          title: careNow.title,
          display: getComputedStyle(careGuidance).display,
          rect: {
            left: guidanceRect.left,
            top: guidanceRect.top,
            right: guidanceRect.right,
            bottom: guidanceRect.bottom,
            width: guidanceRect.width,
            height: guidanceRect.height
          }
        },
        homeCare: {
          before: window.__qaHomeCareBeforeMenu || null,
          actionsHidden: document.querySelector('#homeActions').classList.contains('hidden'),
          focusText: homeActionState('#focusNow').text,
          focusMeta: homeActionState('#focusNow').meta,
          focusMetaHidden: homeActionState('#focusNow').metaHidden,
          focusAction: document.querySelector('#focusNow').dataset.action || '',
          focusTaskLoad: document.querySelector('#focusNow').dataset.taskLoad || '',
          focusOverflow: document.querySelector('#focusNow').dataset.overflow || '',
          focusTitle: document.querySelector('#focusNow').title || '',
          focusAria: document.querySelector('#focusNow').getAttribute('aria-label') || '',
          chatText: homeActionState('#quickChat').text,
          chatMeta: homeActionState('#quickChat').meta,
          chatMetaHidden: homeActionState('#quickChat').metaHidden,
          chatStatus: document.querySelector('#quickChat').dataset.status || '',
          chatUnread: document.querySelector('#quickChat').dataset.unread || '',
          chatTitle: document.querySelector('#quickChat').title || '',
          text: homeActionState('#careMenu').text,
          meta: homeActionState('#careMenu').meta,
          metaHidden: homeActionState('#careMenu').metaHidden,
          action: document.querySelector('#careMenu').dataset.action || '',
          reason: document.querySelector('#careMenu').dataset.reason || '',
          impact: document.querySelector('#careMenu').dataset.impact || '',
          title: document.querySelector('#careMenu').title || '',
          aria: document.querySelector('#careMenu').getAttribute('aria-label') || '',
          expanded: document.querySelector('#careMenu').getAttribute('aria-expanded') || '',
          controls: document.querySelector('#careMenu').getAttribute('aria-controls') || '',
          rect: {
            left: homeActionsRect.left,
            top: homeActionsRect.top,
            right: homeActionsRect.right,
            bottom: homeActionsRect.bottom,
            width: homeActionsRect.width,
            height: homeActionsRect.height
          }
        },
        careMenu: {
          hidden: petMenu.classList.contains('hidden'),
          title: document.querySelector('#careMenuTitle').textContent,
          reason: document.querySelector('#careMenuReason').textContent,
          insight: {
            text: careMenuInsight?.textContent || '',
            focus: careMenuInsight?.dataset.focus || '',
            display: careMenuInsightStyle.display,
            lineClamp: careMenuInsightStyle.webkitLineClamp,
            whiteSpace: careMenuInsightStyle.whiteSpace
          },
          statsVibe: petStats.dataset.vibe,
          rect: {
            left: menuRect.left,
            top: menuRect.top,
            right: menuRect.right,
            bottom: menuRect.bottom,
            width: menuRect.width,
            height: menuRect.height
          },
          statsRect: {
            left: statsRect.left,
            top: statsRect.top,
            right: statsRect.right,
            bottom: statsRect.bottom,
            width: statsRect.width,
            height: statsRect.height
          },
          buttons: careButtons
        },
        renderErrors: window.focusPetRenderErrors?.list?.() || []
      };
    })()
  `).catch(async error => {
    const renderErrors = await browserWindow.webContents.executeJavaScript('window.focusPetRenderErrors?.list?.() || []').catch(() => []);
    throw new Error(`${scenario.name} dom capture failed: ${error.message}${renderErrors.length ? `; renderer errors: ${renderErrors.join(' | ')}` : ''}`);
  });

  const image = await browserWindow.webContents.capturePage();
  fs.writeFileSync(screenshotPath, image.toPNG());
  if (scenario.name === 'compact') fs.writeFileSync(legacyScreenshotPath, image.toPNG());
  const pixelStats = countOpaquePixels(image, domState.avatarRect, scenario.windowSize);
  const careCooldownHomeOk = (impact, meta = '刚休息过', title = `刚刚休息过，${impact}；约30秒后再继续。打开照料菜单`) => (
    domState.petStateSummary === '刚照料过，先观察状态'
    && domState.petCareCue === '观察变化'
    && domState.homeCare.text === '观察'
    && domState.homeCare.meta === meta
    && domState.homeCare.metaHidden === false
    && domState.homeCare.action === 'cooldown'
    && domState.homeCare.reason === '刚休息过'
    && domState.homeCare.impact === impact
    && domState.homeCare.title === title
    && domState.homeCare.aria === title
    && domState.careMenu.title === '刚休息过'
    && domState.careMenu.reason === impact
  );
  const careCooldownRestMilestoneOk = careCooldownHomeOk('先观察精力回到低电', '刚休息过 · 精力回到低电');
  const careCooldownRestImpactOk = careCooldownHomeOk('先观察精力回升', '刚休息过 · 精力回升');
  const careCooldownRestStableOk = careCooldownHomeOk('先观察心情、精力、亲密变化');
  const careGuidanceObserveOk = (impact, reason = '刚休息过', display = 'grid') => {
    const observation = String(impact || '').replace(/^先观察/, '');
    return (
      domState.careGuidance.display === display
      && domState.careGuidance.kind === 'observe'
      && domState.careGuidance.action === 'cooldown'
      && domState.careGuidance.button === '观察'
      && domState.careGuidance.reason === reason
      && domState.careGuidance.reasonTitle === `为什么观察：${reason}`
      && domState.careGuidance.reasonAria === `为什么观察：${reason}`
      && domState.careGuidance.text === `先观察${observation}，约30秒后再继续照料。`
      && domState.careGuidance.detail === `它${reason}，心情、精力和亲密已经变化；先看${observation}是否稳定，约30秒后再决定下一步。`
      && domState.careGuidance.detailTitle === domState.careGuidance.detail
      && domState.careGuidance.detailAria === `照顾理由：${domState.careGuidance.detail}`
      && domState.careGuidance.preview === observation
      && domState.careGuidance.previewTitle === impact
      && domState.careGuidance.previewAria === `预计变化：${impact}`
      && domState.careGuidance.previewTone === 'neutral'
      && domState.careGuidance.title === `观察状态：${reason}，${impact}；约30秒后再继续。`
    );
  };
  const careMenuCooldownObservationOk = !scenario.expectCareMenuCooldownObservation || (
    !domState.careMenu.hidden
    && domState.homeCare.expanded === 'true'
    && domState.homeCare.text === '观察'
    && domState.homeCare.meta === '刚休息过 · 精力回升'
    && domState.homeCare.action === 'cooldown'
    && domState.homeCare.reason === '刚休息过'
    && domState.homeCare.impact === '先观察精力回升'
    && domState.homeCare.title === '刚刚休息过，先观察精力回升；约30秒后再继续。打开照料菜单'
    && domState.careMenu.title === '刚休息过'
    && domState.careMenu.reason === '先观察精力回升'
    && domState.careMenu.insight.text === '它刚休息过，先看精力是否回升，约30秒后再继续照料。'
    && domState.careMenu.insight.focus === 'energy'
    && domState.careMenu.statsVibe === 'steady'
    && domState.petStateSummary === '刚照料过，先观察状态'
    && domState.petCareCue === '观察变化'
    && domState.careFeedback.reason.includes('休息能恢复精力')
    && domState.careFeedback.recent === '刚休息'
    && domState.careFeedback.delta === '心+4 精+15 亲+2'
    && domState.careFeedback.focus === 'energy'
    && domState.careFeedback.focusedRows.energy === 'true'
    && careGuidanceObserveOk('先观察精力回升', '刚休息过', 'none')
    && domState.activeElement.action === 'feed'
    && String(domState.activeElement.className).includes('recommended')
  );
  const careCooldownActionGuardOk = !scenario.expectCareCooldownActionGuard || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-rest')
    && !domState.petClasses.includes('action-feed')
    && domState.message === '还在观察精力回升，约30秒后再继续照料。'
    && domState.petStateSummary === '刚照料过，先观察状态'
    && domState.petCareCue === '观察变化'
    && domState.homeCare.text === '观察'
    && domState.homeCare.meta === '刚休息过 · 精力回升'
    && domState.homeCare.action === 'cooldown'
    && domState.homeCare.reason === '刚休息过'
    && domState.homeCare.impact === '先观察精力回升'
    && domState.homeCare.title === '刚刚休息过，先观察精力回升；约30秒后再继续。打开照料菜单'
    && domState.careFeedback.reason.includes('照料还在观察期')
    && domState.careFeedback.reason.includes('先观察精力回升')
    && domState.careFeedback.delta === '精力观察中'
    && domState.careFeedback.deltaText === '精力观察中'
    && domState.careFeedback.tone === 'neutral'
    && domState.careFeedback.moodLabel === '心情·愉快'
    && domState.careFeedback.moodStage === 'happy'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·亲近'
    && domState.careFeedback.bondStage === 'close'
    && domState.careFeedback.focus === 'energy'
    && domState.careFeedback.focusSource === 'care'
    && domState.careFeedback.feedbackFocus === 'energy'
    && domState.careFeedback.feedbackFocusSource === 'care'
    && domState.careFeedback.focusedRows.energy === 'true'
    && domState.careFeedback.trends.mood === 'flat'
    && domState.careFeedback.trends.energy === 'flat'
    && domState.careFeedback.trends.bond === 'flat'
    && careGuidanceObserveOk('先观察精力回升')
  );
  const careMenuOk = !scenario.expectCareMenu || (
    !domState.careMenu.hidden
    && domState.homeCare.expanded === 'true'
    && domState.homeCare.controls === 'petMenu'
    && domState.careMenu.title === '现在适合休息'
    && domState.careMenu.reason === '精力偏低'
    && domState.careMenu.insight.text.includes('预计精力回到低电')
    && domState.careMenu.insight.focus === 'energy'
    && domState.vibe === 'tired'
    && domState.careMenu.statsVibe === 'tired'
    && domState.homeCare.text === '休息'
    && domState.homeCare.meta === '精力偏低 · 回到低电'
    && domState.homeCare.metaHidden === false
    && domState.homeCare.action === 'rest'
    && domState.homeCare.reason === '精力偏低'
    && domState.homeCare.impact === '预计精力回到低电'
    && domState.homeCare.title.includes('现在适合休息')
    && domState.homeCare.title.includes('预计精力回到低电')
    && domState.homeCare.aria.includes('预计精力回到低电')
    && domState.spriteBackgroundPosition.endsWith('-1872px')
    && domState.careMenu.buttons.length === 6
    && domState.careMenu.buttons[0]?.action === 'rest'
    && domState.careMenu.buttons[0]?.recommended
    && domState.activeElement.action === 'rest'
    && String(domState.activeElement.className).includes('recommended')
    && domState.careMenu.buttons.slice(-2).every(button => button.guard === 'blocked')
    && domState.careMenu.buttons.every(button => button.noteText)
    && domState.careMenu.buttons.some(button => (
      button.action === 'rest'
      && button.recommended
      && button.title.includes('心+4 精+15 亲+2')
      && button.title.includes('精到低电，亲到亲近')
      && button.title.includes('精到低电')
      && button.noteText === '精力偏低，先休息；精力会回升，也会带动亲密。'
      && button.impactBadges.length === 3
      && button.impactBadges.some(badge => badge.text === '精力+15' && badge.tone === 'positive')
      && button.impactBadges.some(badge => badge.text === '心情+4' && badge.tone === 'positive')
      && button.impactBadges.some(badge => badge.text === '亲密+2' && badge.tone === 'positive')
      && button.text.includes('精力+15')
      && button.text.includes('亲密+2')
      && button.stageBadges.length === 1
      && button.stageBadges.some(badge => badge.text === '精到低电' && badge.tone === 'up')
    ))
    && domState.careMenu.buttons.some(button => (
      button.action === 'play'
      && button.noteText === '可选：心情会高涨，但会耗一点精力。'
      && button.stageBadges.some(badge => badge.text === '心到高涨' && badge.tone === 'up')
    ))
    && domState.careMenu.buttons.some(button => button.action === 'feed' && button.noteText === '可选：补充精力和亲密，适合休息后再用。')
    && domState.careMenu.buttons.some(button => button.action === 'clean' && button.noteText === '可选：关系会更安心，不会额外耗精力。')
    && domState.careMenu.buttons.some(button => button.action === 'study' && button.guard === 'blocked' && button.cueText.includes('精力太低') && button.guardLabels.includes('先休息') && button.noteText === '暂缓：精力太低，先休息再一起专注。')
    && domState.careMenu.buttons.some(button => button.action === 'work' && button.guard === 'blocked' && button.cueText.includes('精力太低') && button.guardLabels.includes('先休息') && button.noteText === '暂缓：精力太低，先休息再推进任务。')
    && domState.careMenu.buttons.every(button => button.effectCount > 0 || button.guard === 'blocked')
    && domState.careFeedback.moodLabel === '心情·愉快'
    && domState.careFeedback.moodStage === 'happy'
    && domState.careFeedback.energyLabel === '精力·疲惫'
    && domState.careFeedback.energyStage === 'tired'
    && domState.careFeedback.bondLabel === '亲密·熟悉'
    && domState.careFeedback.bondStage === 'familiar'
    && domState.careFeedback.needs.energy === 'primary'
    && domState.careFeedback.needs.mood === 'stable'
    && domState.careFeedback.needs.bond === 'stable'
    && domState.careMenu.rect.bottom <= domState.careMenu.statsRect.top - 4
  );
  const careMenuLowMoodOk = !scenario.expectCareMenuLowMood || (
    !domState.careMenu.hidden
    && domState.homeCare.expanded === 'true'
    && domState.careMenu.title === '现在适合玩耍'
    && domState.careMenu.reason === '心情偏低'
    && domState.careMenu.insight.text.includes('心情偏低时先放松')
    && domState.careMenu.insight.focus === 'mood'
    && domState.vibe === 'down'
    && domState.careMenu.statsVibe === 'down'
    && domState.homeCare.text === '玩耍'
    && domState.homeCare.meta === '心情偏低 · 回到平稳'
    && domState.homeCare.action === 'play'
    && domState.careMenu.buttons[0]?.action === 'play'
    && domState.careMenu.buttons[0]?.recommended
    && domState.activeElement.action === 'play'
    && String(domState.activeElement.className).includes('recommended')
    && domState.careMenu.buttons.some(button => (
      button.action === 'play'
      && button.recommended
      && button.noteText === '心情偏低，先玩耍；心情会回稳，但会耗一点精力。'
      && button.impactBadges.some(badge => badge.text === '心情+12' && badge.tone === 'positive')
      && button.impactBadges.some(badge => badge.text === '精力-5' && badge.tone === 'negative')
      && button.impactBadges.some(badge => badge.text === '亲密+5' && badge.tone === 'positive')
      && button.stageBadges.some(badge => badge.text === '心到平稳' && badge.tone === 'up')
    ))
    && domState.careMenu.buttons.every(button => button.noteText)
    && domState.careMenu.buttons.some(button => button.action === 'work' && button.guard === 'blocked' && button.cueText.includes('心情太低') && button.guardLabels.includes('先玩耍') && button.noteText === '暂缓：心情太低，先玩耍再推进任务。')
    && domState.careFeedback.moodLabel === '心情·低落'
    && domState.careFeedback.moodStage === 'low'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·熟悉'
    && domState.careFeedback.bondStage === 'familiar'
    && domState.careFeedback.needs.mood === 'primary'
    && domState.careMenu.rect.bottom <= domState.careMenu.statsRect.top - 4
  );
  const careMenuLowBondOk = !scenario.expectCareMenuLowBond || (
    !domState.careMenu.hidden
    && domState.homeCare.expanded === 'true'
    && domState.careMenu.title === '现在适合轻互动'
    && domState.careMenu.reason === '亲密偏低'
    && domState.careMenu.insight.text.includes('关系还在试探')
    && domState.careMenu.insight.text.includes('预计心情回到愉快')
    && domState.careMenu.insight.focus === 'bond'
    && domState.vibe === 'guarded'
    && domState.careMenu.statsVibe === 'guarded'
    && domState.homeCare.text === '轻互动'
    && domState.homeCare.meta === '亲密偏低 · 亲密增加'
    && domState.homeCare.action === 'clean'
    && domState.homeCare.impact === '预计亲密增加，也会照顾心情'
    && domState.homeCare.title === '现在适合轻互动：亲密偏低，预计亲密增加，也会照顾心情。打开照料菜单'
    && domState.careMenu.buttons[0]?.action === 'clean'
    && domState.careMenu.buttons[0]?.recommended
    && domState.activeElement.action === 'clean'
    && String(domState.activeElement.className).includes('recommended')
    && domState.careMenu.buttons.some(button => (
      button.action === 'clean'
      && button.recommended
      && button.text.includes('轻互动')
      && !button.text.includes('清洁')
      && button.noteText === '亲密偏低，先轻互动；关系会更安心，也会照顾心情。'
      && button.impactBadges.some(badge => badge.text === '亲密+4' && badge.tone === 'positive')
      && button.impactBadges.some(badge => badge.text === '心情+6' && badge.tone === 'positive')
      && button.stageBadges.some(badge => badge.text === '心到愉快' && badge.tone === 'up')
    ))
    && domState.careMenu.buttons.every(button => button.noteText)
    && domState.careMenu.buttons.some(button => button.action === 'work' && button.guard === 'soft' && button.cueText.includes('关系还在试探') && button.guardLabels.includes('先熟悉') && button.noteText === '轻一点：关系还在试探，先互动再推进任务。')
    && domState.careFeedback.moodLabel === '心情·平稳'
    && domState.careFeedback.moodStage === 'steady'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·试探'
    && domState.careFeedback.bondStage === 'new'
    && domState.careFeedback.needs.bond === 'primary'
    && domState.careMenu.rect.bottom <= domState.careMenu.statsRect.top - 4
  );
  const careMenuFamiliarBondPriorityOk = !scenario.expectCareMenuFamiliarBondPriority || (
    !domState.careMenu.hidden
    && domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.homeCare.expanded === 'true'
    && domState.petStateSummary === '状态稳定，先写任务'
    && domState.petCareCue === '先写任务'
    && domState.homeCare.text === '轻互动'
    && domState.homeCare.meta === '亲密正在变熟 · 亲密增加'
    && domState.homeCare.action === 'clean'
    && domState.homeCare.reason === '亲密正在变熟'
    && domState.homeCare.impact === '预计亲密增加，也会照顾心情'
    && domState.homeCare.title === '现在适合轻互动：亲密正在变熟，预计亲密增加，也会照顾心情。打开照料菜单'
    && domState.careMenu.title === '现在适合轻互动'
    && domState.careMenu.reason === '亲密正在变熟'
    && domState.careMenu.insight.text === '关系正在变熟，先轻互动增加安全感。'
    && domState.careMenu.insight.focus === 'bond'
    && domState.careMenu.statsVibe === 'steady'
    && domState.careFeedback.reason.startsWith('下一步先照顾亲密，关系正在变熟')
    && domState.careFeedback.moodLabel === '心情·愉快'
    && domState.careFeedback.moodStage === 'happy'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·熟悉'
    && domState.careFeedback.bondStage === 'familiar'
    && domState.careFeedback.needs.bond === 'primary'
    && domState.careMenu.buttons[0]?.action === 'clean'
    && domState.careMenu.buttons[0]?.recommended
    && domState.activeElement.action === 'clean'
    && String(domState.activeElement.className).includes('recommended')
    && domState.careMenu.buttons.some(button => (
      button.action === 'clean'
      && button.recommended
      && button.noteText === '亲密正在变熟，先轻互动；关系会更安心，也会照顾心情。'
      && button.impactBadges.some(badge => badge.text === '亲密+4' && badge.tone === 'positive')
      && button.impactBadges.some(badge => badge.text === '心情+6' && badge.tone === 'positive')
    ))
    && domState.careGuidance.display === 'none'
    && domState.careGuidance.kind === 'surface'
    && domState.careGuidance.action === 'tasks'
    && domState.careGuidance.button === '写任务'
  );
  const careMenuEscapeCloseOk = !scenario.expectCareMenuEscapeClose || (
    domState.careMenu.hidden
    && domState.homeCare.expanded === 'false'
    && domState.homeCare.controls === 'petMenu'
    && domState.activeElement.id === 'careMenu'
    && domState.petStateSummary === '有点累，动作会慢下来'
    && domState.petCareCue === '建议休息'
  );
  const compoundFragileOk = !scenario.expectCompoundFragile || (
    !domState.careMenu.hidden
    && domState.surface === 'home'
    && domState.vibe === 'fragile'
    && domState.careMenu.statsVibe === 'fragile'
    && domState.careMenu.title === '现在适合缓一缓'
    && domState.careMenu.reason === '多项状态偏低'
    && domState.careFeedback.reason.startsWith('先稳住：精力快缓过来了，心情还低，需要轻一点陪伴')
    && ['-webkit-box', 'flow-root'].includes(domState.careFeedback.reasonStyle.display)
    && domState.careFeedback.reasonStyle.whiteSpace === 'normal'
    && domState.careFeedback.reasonStyle.textOverflow !== 'ellipsis'
    && domState.careFeedback.reasonStyle.webkitLineClamp === '2'
    && domState.spriteBackgroundPosition.endsWith('-1872px')
    && domState.petStateSummary === '状态有点脆弱，先缓一缓'
    && domState.petCareCue === '先稳住'
    && domState.careMenu.buttons.length === 6
    && domState.careMenu.buttons[0]?.action === 'rest'
    && domState.careMenu.buttons[0]?.recommended
    && domState.careMenu.buttons.slice(-2).every(button => button.guard === 'blocked')
    && domState.careMenu.buttons.some(button => (
      button.action === 'rest'
      && button.recommended
      && button.title.includes('心+4 精+15 亲+2')
      && button.title.includes('精到低电')
      && button.impactBadges.length === 3
      && button.impactBadges.some(badge => badge.text === '精力+15' && badge.tone === 'positive')
      && button.impactBadges.some(badge => badge.text === '亲密+2' && badge.tone === 'positive')
      && button.text.includes('精力+15')
      && button.text.includes('亲密+2')
      && button.stageBadges.length === 1
      && button.stageBadges.some(badge => badge.text === '精到低电' && badge.tone === 'up')
    ))
    && domState.careMenu.buttons.some(button => (
      button.action === 'play'
      && button.stageBadges.some(badge => badge.text === '心到平稳' && badge.tone === 'up')
    ))
    && domState.careMenu.buttons.some(button => button.action === 'study' && button.guard === 'blocked' && button.cueText.includes('精力太低') && button.guardLabels.includes('先休息'))
    && domState.careMenu.buttons.some(button => button.action === 'work' && button.guard === 'blocked' && button.cueText.includes('精力太低') && button.guardLabels.includes('先休息'))
    && domState.careFeedback.moodLabel === '心情·低落'
    && domState.careFeedback.moodStage === 'low'
    && domState.careFeedback.energyLabel === '精力·疲惫'
    && domState.careFeedback.energyStage === 'tired'
    && domState.careFeedback.bondLabel === '亲密·试探'
    && domState.careFeedback.bondStage === 'new'
    && domState.careFeedback.vitalHints.mood === '也需要留意：心情低落，当前 24，再提升 6 到平稳。'
    && domState.careFeedback.vitalHints.energy === '当前优先关注：精力疲惫，当前 18，再提升 7 到低电。'
    && domState.careFeedback.vitalHints.bond === '也需要留意：亲密试探，当前 28，再提升 7 到熟悉。'
    && domState.careFeedback.needs.energy === 'primary'
    && domState.careFeedback.needs.mood === 'support'
    && domState.careFeedback.needs.bond === 'support'
    && domState.careFeedback.needBadges.energy === '优先'
    && domState.careFeedback.needBadges.mood === '留意'
    && domState.careFeedback.needBadges.bond === '留意'
    && domState.careFeedback.vitalTargets.energy.text === '差7'
    && domState.careFeedback.vitalTargets.mood.text === '差6'
    && domState.careFeedback.vitalTargets.bond.text === '差7'
    && !domState.careFeedback.vitalTargets.energy.hidden
    && !domState.careFeedback.vitalTargets.mood.hidden
    && !domState.careFeedback.vitalTargets.bond.hidden
    && domState.careFeedback.vitalDeltas.mood.hidden
    && domState.careFeedback.vitalDeltas.energy.hidden
    && domState.careFeedback.vitalDeltas.bond.hidden
    && domState.careMenu.rect.bottom <= domState.careMenu.statsRect.top - 4
  );
  const careMenuInsightOk = !scenario.expectCareMenuInsight || (
    !domState.careMenu.hidden
    && domState.careMenu.insight.text === '先稳住精力，再轻轻照顾心情；建议休息，预计精力回升，也会照顾心情。'
    && domState.careMenu.insight.focus === 'energy'
    && ['-webkit-box', 'flow-root'].includes(domState.careMenu.insight.display)
    && domState.careMenu.insight.lineClamp === '2'
    && domState.careMenu.insight.whiteSpace === 'normal'
    && domState.careMenu.rect.top >= domState.messageRect.bottom + 4
    && domState.careMenu.rect.bottom <= domState.careMenu.statsRect.top - 4
  );
  const compoundRestFollowupOk = !scenario.expectCompoundRestFollowup || (
    domState.careMenu.hidden
    && domState.surface === 'home'
    && domState.vibe === 'fragile'
    && domState.petClasses.includes('action-rest')
    && domState.message === '它闭眼充电 5 分钟，精力回来后再陪你继续。'
    && careCooldownRestMilestoneOk
    && careGuidanceObserveOk('先观察精力回到低电')
    && domState.careFeedback.reason.startsWith('先稳住：心情快回稳了，关系还在试探，先轻互动')
    && domState.careFeedback.reason.includes('最近：休息能恢复精力 · 精力回到低电')
    && !domState.careFeedback.reason.includes('最近：休息能恢复精力。')
    && domState.careFeedback.reason.includes('精力回到低电')
    && !domState.careFeedback.reason.includes('关系试探，离熟悉还差5')
    && domState.careFeedback.delta === '心+4 精+15 亲+2'
    && domState.careFeedback.deltaText === '精力回升'
    && domState.careFeedback.deltaDetail === '心+4 精+15 亲+2'
    && domState.careFeedback.tone === 'positive'
    && domState.careFeedback.milestone === 'true'
    && domState.careFeedback.milestoneTone === 'positive'
    && domState.careFeedback.moodLabel === '心情·低落'
    && domState.careFeedback.moodStage === 'low'
    && domState.careFeedback.energyLabel === '精力·低电'
    && domState.careFeedback.energyStage === 'low'
    && domState.careFeedback.bondLabel === '亲密·试探'
    && domState.careFeedback.bondStage === 'new'
    && domState.careFeedback.vitalHints.mood === '当前优先关注：心情低落，当前 28，本次+4，再提升 2 到平稳。'
    && domState.careFeedback.vitalHints.energy === '刚刚回应：精力低电，当前 33，本次+15，再提升 25 到充足。'
    && domState.careFeedback.vitalHints.bond === '也需要留意：亲密试探，当前 30，本次+2，再提升 5 到熟悉。'
    && domState.careFeedback.needs.mood === 'primary'
    && domState.careFeedback.needs.energy === 'stable'
    && domState.careFeedback.needs.bond === 'support'
    && domState.careFeedback.focus === 'energy'
    && domState.careFeedback.feedbackFocus === 'energy'
    && domState.careFeedback.focusedRows.energy === 'true'
    && domState.careFeedback.vitalDeltas.mood.text === '+4'
    && domState.careFeedback.vitalDeltas.mood.trend === 'up'
    && !domState.careFeedback.vitalDeltas.mood.hidden
    && domState.careFeedback.vitalDeltas.energy.text === '+15'
    && domState.careFeedback.vitalDeltas.energy.trend === 'up'
    && !domState.careFeedback.vitalDeltas.energy.hidden
    && domState.careFeedback.vitalDeltas.bond.text === '+2'
    && domState.careFeedback.vitalDeltas.bond.trend === 'up'
    && !domState.careFeedback.vitalDeltas.bond.hidden
    && domState.careFeedback.trends.mood === 'up'
    && domState.careFeedback.trends.energy === 'up'
    && domState.careFeedback.trends.bond === 'up'
  );
  const idleCareNudgeOk = !scenario.expectIdleCareNudge || (
    domState.nudge.before?.hasNudge === true
    && domState.nudge.before.target === 'care'
    && domState.nudge.before.label === '息'
    && domState.nudge.before.title === '查看照料建议'
    && domState.nudge.before.message === '我有点累，先照料一下再继续任务吧。'
    && domState.nudge.target === ''
    && domState.surface === 'home'
    && domState.vibe === 'tired'
    && !domState.careMenu.hidden
    && domState.careMenu.title === '现在适合休息'
    && domState.careMenu.reason === '精力偏低'
    && domState.petStateSummary === '有点累，动作会慢下来'
    && domState.petCareCue === '建议休息'
    && domState.message === '我有点累，先照料一下再继续任务吧。'
    && domState.careFeedback.reason.includes('精力偏低还等太久')
    && domState.careFeedback.delta === '精-1'
    && domState.careFeedback.deltaText === '会耗精力'
    && domState.careFeedback.focus === 'energy'
    && domState.careFeedback.feedbackFocus === 'energy'
    && domState.careFeedback.focusedRows.energy === 'true'
    && domState.careFeedback.tone === 'negative'
    && domState.careFeedback.energyLabel === '精力·疲惫'
    && domState.careFeedback.energyStage === 'tired'
    && domState.careFeedback.trends.energy === 'down'
    && domState.careMenu.buttons.some(button => button.action === 'rest' && button.recommended)
  );
  const idleBondNudgeOk = !scenario.expectIdleBondNudge || (
    domState.nudge.before?.hasNudge === true
    && domState.nudge.before.target === 'care'
    && domState.nudge.before.label === '亲'
    && domState.nudge.before.title === '查看照料建议'
    && domState.nudge.before.message === '我还在适应你，轻轻互动一下会更熟。'
    && domState.nudge.target === ''
    && domState.surface === 'home'
    && domState.vibe === 'guarded'
    && !domState.careMenu.hidden
    && domState.careMenu.title === '现在适合轻互动'
    && domState.careMenu.reason === '亲密偏低'
    && domState.petStateSummary === '还在熟悉你，会保持一点距离'
    && domState.petCareCue === '多互动'
    && domState.message === '我还在适应你，轻轻互动一下会更熟。'
    && domState.careFeedback.reason.includes('关系还在试探')
    && domState.careFeedback.delta === '亲密待回应'
    && domState.careFeedback.deltaText === '亲密待回应'
    && domState.careFeedback.tone === 'neutral'
    && domState.careFeedback.bondLabel === '亲密·试探'
    && domState.careFeedback.bondStage === 'new'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'focus'
    && domState.careFeedback.feedbackFocus === 'bond'
    && domState.careFeedback.feedbackFocusSource === 'focus'
    && domState.careFeedback.focusedRows.bond === 'true'
    && domState.careMenu.buttons.some(button => button.action === 'clean' && button.recommended)
  );
  const vibeOk = !scenario.expectedVibe || (
    domState.vibe === scenario.expectedVibe
    && (domState.careMenu.statsVibe === scenario.expectedVibe || domState.careMenu.statsRect.width === 0)
  );
  const careFeedbackOk = !scenario.expectCareFeedback || (
    domState.careMenu.hidden
    && domState.careFeedback.reason.includes('休息能恢复精力')
    && domState.careFeedback.reason.includes('关系更亲近了')
    && !domState.careFeedback.reason.includes('关系亲近，离默契还差19')
    && domState.careFeedback.source === '照料·休息'
    && domState.careFeedback.sourceHidden === false
    && domState.careFeedback.sourceTitle === '状态来源：照料 · 休息'
    && domState.careFeedback.sourceData === 'care'
    && domState.careFeedback.sourceDetail === '休息'
    && domState.careFeedback.recent === '刚休息'
    && domState.careFeedback.recentHidden === false
    && domState.careFeedback.delta === '心+4 精+15 亲+2'
    && domState.careFeedback.deltaText === '精力回升'
    && domState.careFeedback.deltaDetail === '心+4 精+15 亲+2'
    && domState.careFeedback.tone === 'positive'
    && domState.careFeedback.moodLabel === '心情·愉快'
    && domState.careFeedback.moodStage === 'happy'
    && domState.careFeedback.energyLabel === '精力·低电'
    && domState.careFeedback.energyStage === 'low'
    && domState.careFeedback.bondLabel === '亲密·亲近'
    && domState.careFeedback.bondStage === 'close'
    && domState.careFeedback.trends.mood === 'up'
    && domState.careFeedback.trends.energy === 'up'
    && domState.careFeedback.trends.bond === 'up'
    && domState.petStateSummary === '刚照料过，先观察状态'
    && domState.petCareCue === '观察变化'
    && domState.homeCare.text === '观察'
    && domState.homeCare.meta === '刚休息过 · 精力回升'
    && domState.homeCare.metaHidden === false
    && domState.homeCare.action === 'cooldown'
    && domState.homeCare.reason === '刚休息过'
    && domState.homeCare.impact === '先观察精力回升'
    && domState.homeCare.title === '刚刚休息过，先观察精力回升；约30秒后再继续。打开照料菜单'
    && careGuidanceObserveOk('先观察精力回升')
  );
  const careRepeatFeedbackOk = !scenario.expectCareRepeatFeedback || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-rest')
    && domState.message === '还在观察精力回升，约30秒后再继续照料。'
    && domState.petStateSummary === '刚照料过，先观察状态'
    && domState.petCareCue === '观察变化'
    && domState.homeCare.text === '观察'
    && domState.homeCare.meta === '刚休息过 · 精力回升'
    && domState.homeCare.action === 'cooldown'
    && domState.homeCare.reason === '刚休息过'
    && domState.homeCare.impact === '先观察精力回升'
    && domState.homeCare.title === '刚刚休息过，先观察精力回升；约30秒后再继续。打开照料菜单'
    && domState.careFeedback.reason.includes('照料还在观察期')
    && domState.careFeedback.reason.includes('先观察精力回升')
    && domState.careFeedback.recent === '刚休息过'
    && domState.careFeedback.recentHidden === false
    && domState.careFeedback.delta === '精力观察中'
    && domState.careFeedback.deltaText === '精力观察中'
    && domState.careFeedback.tone === 'neutral'
    && domState.careFeedback.moodLabel === '心情·愉快'
    && domState.careFeedback.moodStage === 'happy'
    && domState.careFeedback.energyLabel === '精力·低电'
    && domState.careFeedback.energyStage === 'low'
    && domState.careFeedback.bondLabel === '亲密·亲近'
    && domState.careFeedback.bondStage === 'close'
    && domState.careFeedback.focus === 'energy'
    && domState.careFeedback.focusSource === 'care'
    && domState.careFeedback.feedbackFocus === 'energy'
    && domState.careFeedback.feedbackFocusSource === 'care'
    && domState.careFeedback.focusedRows.energy === 'true'
    && domState.careFeedback.trends.mood === 'flat'
    && domState.careFeedback.trends.energy === 'flat'
    && domState.careFeedback.trends.bond === 'flat'
    && careGuidanceObserveOk('先观察精力回升')
  );
  const energyDropWarningOk = !scenario.expectEnergyDropWarning || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-play')
    && domState.spriteBackgroundPosition.endsWith('-2496px')
    && domState.message === '它放松了一小会儿，心情先回稳，等下再继续。'
    && domState.petStateSummary === '刚照料过，先观察状态'
    && domState.petCareCue === '观察变化'
    && domState.homeCare.text === '观察'
    && domState.homeCare.meta === '刚玩耍过 · 精力降到低电'
    && domState.homeCare.action === 'cooldown'
    && domState.homeCare.reason === '刚玩耍过'
    && domState.homeCare.impact === '先观察精力降到低电'
    && domState.homeCare.title === '刚刚玩耍过，先观察精力降到低电；约30秒后再继续。打开照料菜单'
    && domState.careFeedback.reason.includes('短暂玩耍让心情回升')
    && domState.careFeedback.reason.includes('精力降到低电')
    && domState.careFeedback.delta === '心+12 精-5 亲+5'
    && domState.careFeedback.tone === 'mixed'
    && domState.careFeedback.milestone === 'true'
    && domState.careFeedback.milestoneTone === 'warning'
    && domState.careFeedback.moodLabel === '心情·平稳'
    && domState.careFeedback.moodStage === 'steady'
    && domState.careFeedback.energyLabel === '精力·低电'
    && domState.careFeedback.energyStage === 'low'
    && domState.careFeedback.bondLabel === '亲密·亲近'
    && domState.careFeedback.bondStage === 'close'
    && domState.careFeedback.trends.mood === 'up'
    && domState.careFeedback.trends.energy === 'down'
    && domState.careFeedback.trends.bond === 'up'
  );
  const homeActionsOk = !scenario.expectHomeActions || (
    domState.surface === 'home'
    && domState.homeCare.actionsHidden === false
    && domState.homeCare.focusText === '写任务'
    && domState.homeCare.focusMeta === '还没任务'
    && domState.homeCare.focusMetaHidden === false
    && domState.homeCare.focusAction === 'tasks'
    && domState.homeCare.focusTitle.includes('写下一件最小任务')
    && domState.homeCare.chatText === '搭子'
    && domState.homeCare.chatMeta === '在线'
    && domState.homeCare.chatMetaHidden === false
    && domState.homeCare.chatStatus === 'online'
    && domState.homeCare.chatUnread === 'false'
    && domState.homeCare.chatTitle === '搭子在线，打开聊天'
    && domState.petStateSummary === '状态稳定，先写任务'
    && domState.petCareCue === '先写任务'
    && domState.homeCare.text === '轻互动'
    && domState.homeCare.meta === '亲密正在变熟 · 亲密增加'
    && domState.homeCare.metaHidden === false
    && domState.homeCare.action === 'clean'
    && domState.homeCare.reason === '亲密正在变熟'
    && domState.homeCare.impact === '预计亲密增加，也会照顾心情'
    && domState.homeCare.title.includes('现在适合轻互动')
    && domState.homeCare.title.includes('亲密正在变熟')
    && domState.homeCare.title.includes('预计亲密增加，也会照顾心情')
    && domState.homeCare.rect.bottom <= domState.careMenu.statsRect.top - 4
  );
  const homeStudyEnergyTradeoffOk = !scenario.expectHomeStudyEnergyTradeoff || (
    domState.surface === 'home'
    && domState.vibe === 'bright'
    && !domState.careMenu.hidden
    && domState.homeCare.expanded === 'true'
    && domState.homeCare.actionsHidden === false
    && domState.homeCare.focusText === '写任务'
    && domState.homeCare.focusMeta === '还没任务'
    && domState.homeCare.chatText === '搭子'
    && domState.petStateSummary === '状态稳定，先写任务'
    && domState.petCareCue === '先写任务'
    && domState.homeCare.before?.text === '学习'
    && domState.homeCare.before?.meta === '稳定陪伴 · 亲密增加 · 会耗精力'
    && domState.homeCare.before?.metaHidden === false
    && domState.homeCare.before?.action === 'study'
    && domState.homeCare.before?.reason === '稳定陪伴'
    && domState.homeCare.before?.impact === '预计亲密增加 · 会耗精力'
    && domState.homeCare.before?.title === '现在适合学习：稳定陪伴，预计亲密增加 · 会耗精力。打开照料菜单'
    && domState.homeCare.text === '学习'
    && domState.homeCare.meta === '稳定陪伴 · 亲密增加 · 会耗精力'
    && domState.homeCare.action === 'study'
    && domState.careMenu.title === '现在适合学习'
    && domState.careMenu.reason === '稳定陪伴'
    && domState.careMenu.insight.text === '状态够用，可以一起学习；亲密会增加，但会耗精力。'
    && domState.careMenu.insight.focus === 'bond'
    && domState.careMenu.buttons[0]?.action === 'study'
    && domState.careMenu.buttons[0]?.recommended
    && domState.activeElement.action === 'study'
    && String(domState.activeElement.className).includes('recommended')
    && domState.careFeedback.moodLabel === '心情·愉快'
    && domState.careFeedback.moodStage === 'happy'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·亲近'
    && domState.careFeedback.bondStage === 'close'
    && domState.homeCare.rect.bottom <= domState.careMenu.statsRect.top - 4
  );
  const homeWorkEnergyDropPreviewOk = !scenario.expectHomeWorkEnergyDropPreview || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && !domState.careMenu.hidden
    && domState.homeCare.expanded === 'true'
    && domState.homeCare.actionsHidden === false
    && domState.homeCare.focusText === '看任务'
    && domState.homeCare.focusMeta === '当前任务'
    && domState.homeCare.chatText === '搭子'
    && domState.petStateSummary === '状态稳定，盯当前任务'
    && domState.petCareCue === '盯当前任务'
    && domState.careFeedback.reason === '下一步盯当前任务：亲密增加 · 精力降到低电 · 最近：qa home work drop'
    && domState.careFeedback.aria.startsWith('状态反馈：下一步盯当前任务：亲密增加 · 精力降到低电')
    && domState.homeCare.before?.text === '打工'
    && domState.homeCare.before?.meta === '盯当前任务 · 亲密增加 · 精力降到低电'
    && domState.homeCare.before?.metaHidden === false
    && domState.homeCare.before?.action === 'work'
    && domState.homeCare.before?.reason === '盯当前任务'
    && domState.homeCare.before?.impact === '预计亲密增加 · 精力降到低电'
    && domState.homeCare.before?.title === '现在适合打工：盯当前任务，预计亲密增加 · 精力降到低电。打开照料菜单'
    && domState.homeCare.text === '打工'
    && domState.homeCare.meta === '盯当前任务 · 亲密增加 · 精力降到低电'
    && domState.homeCare.action === 'work'
    && domState.homeCare.impact === '预计亲密增加 · 精力降到低电'
    && domState.careMenu.title === '现在适合打工'
    && domState.careMenu.reason === '盯当前任务'
    && domState.careMenu.insight.text === '任务明确，可以一起推进；亲密会增加，但精力降到低电。'
    && domState.careMenu.insight.focus === 'energy'
    && domState.careMenu.buttons[0]?.action === 'work'
    && domState.careMenu.buttons[0]?.recommended
    && domState.careMenu.buttons[0]?.noteText === '任务明确，可以一起推进；亲密会上升，但精力降到低电。'
    && domState.careGuidance.display === 'none'
    && domState.careGuidance.kind === 'care'
    && domState.careGuidance.action === 'work'
    && domState.careGuidance.button === '打工'
    && domState.careGuidance.reason === '盯当前任务'
    && domState.careGuidance.preview === '亲密增加 · 精力降到低电'
    && domState.careGuidance.previewTitle === '亲密增加 · 精力降到低电（心+2 精-10 亲+4 · 精降低电，亲到亲近）'
    && domState.careGuidance.previewAria === '预计变化：亲密增加 · 精力降到低电（心+2 精-10 亲+4 · 精降低电，亲到亲近）'
    && domState.careGuidance.title === '执行推荐：打工。盯当前任务，预计亲密增加 · 精力降到低电（心+2 精-10 亲+4 · 精降低电，亲到亲近）。'
    && domState.homeCare.rect.bottom <= domState.careMenu.statsRect.top - 4
  );
  const careGuidanceShortcutOk = !scenario.expectCareGuidanceShortcut || (
    domState.careGuidance.before?.display === 'grid'
    && domState.careGuidance.before.text === '先休 5 分钟，精力回来再继续。'
    && domState.careGuidance.before.button === '休息'
    && domState.careGuidance.before.reason === '精力偏低'
    && domState.careGuidance.before.preview === '精力回升 · 心情回升'
    && domState.careGuidance.before.previewTitle === '精力回升 · 心情回升（心+4 精+15 亲+2 · 精到低电，亲到亲近）'
    && domState.careGuidance.before.previewAria === '预计变化：精力回升 · 心情回升（心+4 精+15 亲+2 · 精到低电，亲到亲近）'
    && domState.careGuidance.before.previewTone === 'positive'
    && domState.careGuidance.before.previewScrollWidth <= domState.careGuidance.before.previewClientWidth + 1
    && domState.careGuidance.before.previewWhiteSpace !== 'nowrap'
    && domState.careGuidance.before.previewOverflow !== 'hidden'
    && domState.careGuidance.before.kind === 'care'
    && domState.careGuidance.before.action === 'rest'
    && domState.careGuidance.before.title === '执行推荐：休息。精力偏低，预计精力回升 · 心情回升（心+4 精+15 亲+2 · 精到低电，亲到亲近）。'
    && domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-rest')
    && domState.message === '它闭眼充电 5 分钟，精力回来后再陪你继续。'
    && domState.careFeedback.reason.includes('休息能恢复精力')
    && domState.careFeedback.reason.includes('关系更亲近了')
    && !domState.careFeedback.reason.includes('关系亲近，离默契还差19')
    && domState.careFeedback.delta === '心+4 精+15 亲+2'
    && domState.careFeedback.tone === 'positive'
    && domState.careFeedback.moodLabel === '心情·愉快'
    && domState.careFeedback.moodStage === 'happy'
    && domState.careFeedback.energyLabel === '精力·低电'
    && domState.careFeedback.energyStage === 'low'
    && domState.careFeedback.bondLabel === '亲密·亲近'
    && domState.careFeedback.bondStage === 'close'
    && domState.careFeedback.focus === 'energy'
    && domState.careFeedback.feedbackFocus === 'energy'
    && domState.careFeedback.focusedRows.energy === 'true'
    && careGuidanceObserveOk('先观察精力回升')
  );
  const vitalChipEnergyShortcutOk = !scenario.expectVitalChipEnergyShortcut || (
    domState.surface === 'home'
    && domState.vibe === 'tired'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-rest')
    && domState.message === '我现在很累，先休 5 分钟恢复一下。'
    && domState.petStateSummary === '刚看过精力，先休息恢复'
    && domState.petCareCue === '建议休息'
    && domState.careFeedback.reason === '精力疲惫，先休息恢复 · 最近：你注意到它精力偏低，它会更愿意先休息'
    && !domState.careFeedback.reason.includes('任务')
    && domState.careFeedback.delta === '亲+1'
    && domState.careFeedback.deltaText === '亲密增加'
    && domState.careFeedback.focus === 'energy'
    && domState.careFeedback.focusSource === 'inspect'
    && domState.careFeedback.feedbackFocus === 'energy'
    && domState.careFeedback.feedbackFocusSource === 'inspect'
    && domState.careFeedback.focusedRows.energy === 'true'
    && domState.careFeedback.pressedRows.energy === 'true'
    && domState.careFeedback.vitalChips.energy?.text === '精力疲惫 · 休息'
    && domState.careFeedback.vitalChips.energy?.need === 'primary'
    && domState.careFeedback.vitalChips.energy?.focus === 'true'
    && domState.careFeedback.vitalChips.energy?.stage === 'tired'
    && domState.careFeedback.vitalChips.energy?.pressed === 'true'
    && domState.careFeedback.vitalChips.energy?.title.includes('点一下，我会让它先休息。')
    && domState.careFeedback.vitalChips.energy?.aria.includes('点一下，我会让它先休息。')
    && domState.vitalFocusAction.hidden === false
    && domState.vitalFocusAction.vital === 'energy'
    && domState.vitalFocusAction.kind === 'care'
    && domState.vitalFocusAction.action === 'rest'
    && domState.vitalFocusAction.label === '精力·疲惫'
    && domState.vitalFocusAction.goal === '差7到低电'
    && domState.vitalFocusAction.reason === '精力疲惫，先休 5 分钟恢复。'
    && !domState.vitalFocusAction.reason.includes('任务')
    && domState.vitalFocusAction.impact === '预计精力回升 · 心情回升（心+4 精+15 亲+2 · 精到低电）'
    && domState.vitalFocusAction.impactHidden === false
    && domState.vitalFocusAction.impactTone === 'positive'
    && domState.vitalFocusAction.impactTitle === '精力回升 · 心情回升（心+4 精+15 亲+2 · 精到低电）'
    && domState.vitalFocusAction.button === '去休息'
    && domState.careGuidance.display === 'none'
    && domState.careGuidance.kind === 'care'
    && domState.careGuidance.action === 'rest'
    && domState.careGuidance.button === '休息'
    && domState.careGuidance.reason === '精力疲惫，先休息恢复'
    && domState.careGuidance.text === '精力疲惫，先休 5 分钟恢复。'
  );
  const vitalInsightLowEnergyFeedOk = !scenario.expectVitalInsightLowEnergyFeed || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-feed')
    && domState.message === '精力有点低，我先补一点能量再继续。'
    && domState.petStateSummary === '刚看过精力，先补能量'
    && domState.petCareCue === '补充精力'
    && domState.careFeedback.reason === '精力低电，先补一点能量 · 最近：你检查了它的精力，它愿意先补一点能量'
    && domState.careFeedback.delta === '精+1 亲+1'
    && domState.careFeedback.deltaText === '精力回升 · 差7到充足'
    && domState.careFeedback.energyLabel === '精力·低电'
    && domState.careFeedback.energyStage === 'low'
    && domState.careFeedback.focus === 'energy'
    && domState.careFeedback.focusSource === 'inspect'
    && domState.careFeedback.feedbackFocus === 'energy'
    && domState.careFeedback.feedbackFocusSource === 'inspect'
    && domState.careFeedback.focusedRows.energy === 'true'
    && domState.careFeedback.pressedRows.energy === 'true'
    && domState.careFeedback.vitalChips.energy?.text === '精力低电 · 喂食'
    && domState.careFeedback.vitalChips.energy?.need === 'primary'
    && domState.careFeedback.vitalChips.energy?.focus === 'true'
    && domState.careFeedback.vitalChips.energy?.stage === 'low'
    && domState.careFeedback.vitalChips.energy?.title.includes('点一下，我会先帮它补一点精力。')
    && domState.vitalFocusAction.hidden === false
    && domState.vitalFocusAction.vital === 'energy'
    && domState.vitalFocusAction.kind === 'care'
    && domState.vitalFocusAction.action === 'feed'
    && domState.vitalFocusAction.label === '精力·低电'
    && domState.vitalFocusAction.goal === '差7到充足'
    && domState.vitalFocusAction.reason === '精力低电，先补一点能量再继续。'
    && domState.vitalFocusAction.impact === '预计精力回升 · 心情回升（心+8 精+10 亲+3 · 精到充足，亲到亲近）'
    && domState.vitalFocusAction.impactTone === 'positive'
    && domState.vitalFocusAction.button === '去喂食'
    && domState.vitalFocusAction.title === '精力·低电，差7到充足。执行推荐：喂食。精力偏低，先补一点，预计精力回升 · 心情回升（心+8 精+10 亲+3 · 精到充足，亲到亲近）。'
    && domState.careGuidance.display === 'none'
    && domState.careGuidance.kind === 'care'
    && domState.careGuidance.action === 'feed'
    && domState.careGuidance.button === '喂食'
    && domState.careGuidance.reason === '精力偏低，先补一点'
    && domState.careGuidance.preview === '精力回升 · 心情回升'
    && domState.careGuidance.text === '精力低电，先补一点能量再继续。'
  );
  const vitalInsightReadyEnergyFeedOk = !scenario.expectVitalInsightReadyEnergyFeed || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-feed')
    && !domState.petClasses.includes('action-clean')
    && domState.message === '精力够用，我先补一点能量再进入专注。'
    && domState.petStateSummary === '刚看过精力，补足再专注'
    && domState.petCareCue === '补充精力'
    && domState.careFeedback.reason === '精力充足，先补一点再进入专注 · 最近：你检查了它的精力，它愿意先补一点能量再进入专注'
    && domState.careFeedback.delta === '精+1 亲+1'
    && domState.careFeedback.deltaText === '精力回升'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·亲近'
    && domState.careFeedback.bondStage === 'close'
    && domState.careFeedback.focus === 'energy'
    && domState.careFeedback.focusSource === 'inspect'
    && domState.careFeedback.feedbackFocus === 'energy'
    && domState.careFeedback.feedbackFocusSource === 'inspect'
    && domState.careFeedback.focusedRows.energy === 'true'
    && domState.careFeedback.pressedRows.energy === 'true'
    && domState.careFeedback.vitalChips.energy?.text === '精力充足 · 喂食'
    && domState.careFeedback.vitalChips.energy?.need === 'primary'
    && domState.careFeedback.vitalChips.energy?.focus === 'true'
    && domState.careFeedback.vitalChips.energy?.stage === 'ready'
    && domState.careFeedback.vitalChips.energy?.title.includes('点一下，我会先补一点精力再进入专注。')
    && domState.vitalFocusAction.hidden === false
    && domState.vitalFocusAction.vital === 'energy'
    && domState.vitalFocusAction.kind === 'care'
    && domState.vitalFocusAction.action === 'feed'
    && domState.vitalFocusAction.label === '精力·充足'
    && domState.vitalFocusAction.goal === '差17到饱满'
    && domState.vitalFocusAction.reason === '精力充足，先补一点再进入专注。'
    && domState.vitalFocusAction.impact === '预计精力回升 · 心情回升（心+8 精+10 亲+3）'
    && domState.vitalFocusAction.impactTone === 'positive'
    && domState.vitalFocusAction.button === '去喂食'
    && domState.vitalFocusAction.title === '精力·充足，差17到饱满。执行推荐：喂食。精力充足，先补一点再进入专注，预计精力回升 · 心情回升（心+8 精+10 亲+3）。'
    && domState.careGuidance.display === 'none'
    && domState.careGuidance.kind === 'care'
    && domState.careGuidance.action === 'feed'
    && domState.careGuidance.button === '喂食'
    && domState.careGuidance.reason === '精力充足，先补一点再进入专注'
    && domState.careGuidance.preview === '精力回升 · 心情回升'
    && domState.careGuidance.text === '精力充足，先补一点再进入专注。'
  );
  const vitalInsightReadyEnergyTaskRiskOk = !scenario.expectVitalInsightReadyEnergyTaskRisk || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-work')
    && domState.message === '精力够用，但这一步会降到低电；我先盯着当前任务做一小步。'
    && domState.petStateSummary === '刚看过精力，别透支任务'
    && domState.petCareCue === '盯当前任务'
    && domState.careFeedback.reason === '精力够用，当前任务会降到低电 · 最近：你检查了它的精力，它会帮你守住当前任务'
    && domState.careFeedback.delta === '亲+1'
    && domState.careFeedback.deltaText === '亲密增加 · 差2到亲近'
    && domState.careFeedback.focus === 'energy'
    && domState.careFeedback.focusSource === 'inspect'
    && domState.careFeedback.feedbackFocus === 'energy'
    && domState.careFeedback.feedbackFocusSource === 'inspect'
    && domState.careFeedback.focusedRows.energy === 'true'
    && domState.careFeedback.pressedRows.energy === 'true'
    && domState.careFeedback.vitalChips.energy?.text === '精力充足 · 打工'
    && domState.careFeedback.vitalChips.energy?.focus === 'true'
    && domState.careFeedback.vitalChips.energy?.stage === 'ready'
    && domState.careFeedback.vitalChips.energy?.title.includes('点一下，我会帮它守住当前任务但不透支。')
    && domState.vitalFocusAction.hidden === false
    && domState.vitalFocusAction.vital === 'energy'
    && domState.vitalFocusAction.kind === 'care'
    && domState.vitalFocusAction.action === 'work'
    && domState.vitalFocusAction.label === '精力·充足'
    && domState.vitalFocusAction.goal === '差16到饱满'
    && domState.vitalFocusAction.reason === '精力够用，当前任务会降到低电，先只做一小步。'
    && domState.vitalFocusAction.impact === '预计亲密增加 · 精力降到低电（心+2 精-10 亲+4 · 精降低电，亲到亲近）'
    && domState.vitalFocusAction.impactTone === 'mixed'
    && domState.vitalFocusAction.button === '去打工'
    && domState.vitalFocusAction.title === '精力·充足，差16到饱满。执行推荐：打工。精力够用，别透支，预计亲密增加 · 精力降到低电（心+2 精-10 亲+4 · 精降低电，亲到亲近）。'
    && domState.careGuidance.display === 'none'
    && domState.careGuidance.kind === 'care'
    && domState.careGuidance.action === 'work'
    && domState.careGuidance.reason === '精力够用，别透支'
    && domState.careGuidance.preview === '亲密增加 · 精力降到低电'
  );
  const vitalInsightFullEnergyTaskOk = !scenario.expectVitalInsightFullEnergyTask || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-work')
    && domState.message === '精力很足，我先盯着当前任务推进一小步。'
    && domState.petStateSummary === '刚看过精力，趁饱满做任务'
    && domState.petCareCue === '盯当前任务'
    && domState.careFeedback.reason === '精力饱满，适合推进当前任务 · 最近：你确认它精力很足，它会带着你守住当前任务'
    && domState.careFeedback.delta === '亲+1'
    && domState.careFeedback.deltaText === '亲密增加 · 差2到亲近'
    && domState.careFeedback.focus === 'energy'
    && domState.careFeedback.focusSource === 'inspect'
    && domState.careFeedback.feedbackFocus === 'energy'
    && domState.careFeedback.feedbackFocusSource === 'inspect'
    && domState.careFeedback.focusedRows.energy === 'true'
    && domState.careFeedback.pressedRows.energy === 'true'
    && domState.careFeedback.vitalChips.energy?.text === '精力饱满 · 打工'
    && domState.careFeedback.vitalChips.energy?.focus === 'true'
    && domState.careFeedback.vitalChips.energy?.stage === 'full'
    && domState.careFeedback.vitalChips.energy?.title.includes('点一下，我会让它趁精力饱满推进当前任务。')
    && domState.vitalFocusAction.hidden === false
    && domState.vitalFocusAction.vital === 'energy'
    && domState.vitalFocusAction.kind === 'care'
    && domState.vitalFocusAction.action === 'work'
    && domState.vitalFocusAction.label === '精力·饱满'
    && domState.vitalFocusAction.goal === ''
    && domState.vitalFocusAction.goalHidden === true
    && domState.vitalFocusAction.reason === '精力很足，先盯当前任务推进一小步。'
    && domState.vitalFocusAction.impact === '预计亲密增加 · 精力降到充足（心+2 精-10 亲+4 · 精降充足，亲到亲近）'
    && domState.vitalFocusAction.impactTone === 'mixed'
    && domState.vitalFocusAction.button === '去打工'
    && domState.vitalFocusAction.title === '精力·饱满。执行推荐：打工。精力很足，适合推进当前任务，预计亲密增加 · 精力降到充足（心+2 精-10 亲+4 · 精降充足，亲到亲近）。'
    && domState.careGuidance.display === 'none'
    && domState.careGuidance.kind === 'care'
    && domState.careGuidance.action === 'work'
    && domState.careGuidance.reason === '精力很足，适合推进当前任务'
    && domState.careGuidance.preview === '亲密增加 · 精力降到充足'
    && domState.careGuidance.text === '精力很足，先盯当前任务推进一小步。'
  );
  const vitalInsightMoodOk = !scenario.expectVitalInsightMood || (
    domState.surface === 'home'
    && domState.vibe === 'down'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-play')
    && domState.spriteBackgroundPosition.endsWith('-2496px')
    && domState.message === '我有点低落，先陪我缓一缓，会好一点。'
    && domState.messageRect.height <= 34
    && domState.contextRect.bottom <= domState.bubble.rect.bottom + 1
    && domState.petStateSummary === '刚看过心情，先陪它缓一缓'
    && domState.petCareCue === '安抚心情'
    && domState.careFeedback.reason === '心情低落，先陪它缓一缓 · 最近：你注意到它的心情，它被安抚了一点'
    && !domState.careFeedback.reason.includes('心情偏低')
    && domState.careFeedback.recent === '刚安抚心情'
    && domState.careFeedback.recentHidden === false
    && domState.careFeedback.delta === '心+1 亲+1'
    && domState.careFeedback.deltaText === '心情回升 · 差1到平稳'
    && domState.careFeedback.deltaDetail === '心+1 亲+1'
    && domState.careFeedback.aria.includes('本次变化：心情回升 · 差1到平稳（心+1 亲+1）')
    && domState.careFeedback.tone === 'positive'
    && domState.careFeedback.moodLabel === '心情·低落'
    && domState.careFeedback.moodStage === 'low'
    && domState.careFeedback.vitalChips.mood?.text === '心情低落 · 玩耍'
    && domState.careFeedback.vitalChips.mood?.need === 'primary'
    && domState.careFeedback.vitalChips.mood?.focus === 'true'
    && domState.careFeedback.vitalChips.mood?.title === '刚刚回应：心情低落，当前 29，本次+1，再提升 1 到平稳。点一下，我先陪它缓一下心情。'
    && domState.careFeedback.vitalChips.mood?.aria === '刚刚回应：心情低落，当前 29，本次+1，再提升 1 到平稳。点一下，我先陪它缓一下心情。'
    && domState.careFeedback.vitalChips.mood?.pressed === 'true'
    && domState.careFeedback.vitalChips.energy?.pressed === 'false'
    && domState.careFeedback.vitalHints.mood === '刚刚回应：心情低落，当前 29，本次+1，再提升 1 到平稳。'
    && !domState.careFeedback.vitalChips.mood?.title.includes('当前优先关注')
    && domState.careFeedback.vitalChips.energy?.text === '精力充足'
    && domState.careFeedback.vitalChips.bond?.text === '亲密熟悉'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·熟悉'
    && domState.careFeedback.bondStage === 'familiar'
    && domState.careFeedback.trends.mood === 'up'
    && domState.careFeedback.trends.energy === 'flat'
    && domState.careFeedback.trends.bond === 'up'
    && domState.careFeedback.needs.mood === 'primary'
    && domState.careFeedback.needs.energy === 'stable'
    && domState.careFeedback.needs.bond === 'stable'
    && domState.careFeedback.focus === 'mood'
    && domState.careFeedback.feedbackFocus === 'mood'
    && domState.careFeedback.focusedRows.mood === 'true'
    && domState.careFeedback.pressedRows.mood === 'true'
    && domState.careFeedback.pressedRows.energy === 'false'
    && domState.careFeedback.pressedRows.bond === 'false'
    && domState.vitalFocusAction.hidden === false
    && domState.vitalFocusAction.vital === 'mood'
    && domState.vitalFocusAction.kind === 'care'
    && domState.vitalFocusAction.action === 'play'
    && domState.vitalFocusAction.label === '心情·低落'
    && domState.vitalFocusAction.goal === '差1到平稳'
    && domState.vitalFocusAction.goalHidden === false
    && domState.vitalFocusAction.goalTitle === '心情·低落，差1到平稳'
    && domState.vitalFocusAction.reason === '心情低落，先陪它缓一缓。'
    && domState.vitalFocusAction.impact === '预计心情回升 · 会耗精力（心+12 精-5 亲+5 · 心到平稳）'
    && domState.vitalFocusAction.impactHidden === false
    && domState.vitalFocusAction.impactTone === 'mixed'
    && domState.vitalFocusAction.impactTitle === '心情回升 · 会耗精力（心+12 精-5 亲+5 · 心到平稳）'
    && domState.vitalFocusAction.button === '去玩耍'
    && domState.vitalFocusAction.title === '心情·低落，差1到平稳。执行推荐：玩耍。心情低落，先陪它缓一缓，预计心情回升 · 会耗精力（心+12 精-5 亲+5 · 心到平稳）。'
    && domState.vitalFocusAction.aria === '心情·低落，差1到平稳。执行推荐：玩耍。心情低落，先陪它缓一缓，预计心情回升 · 会耗精力（心+12 精-5 亲+5 · 心到平稳）。'
    && !domState.vitalFocusAction.title.includes('心情偏低')
    && domState.careGuidance.display === 'none'
    && domState.careGuidance.kind === 'care'
    && domState.careGuidance.action === 'play'
    && domState.careGuidance.button === '玩耍'
    && domState.careGuidance.reason === '心情低落，先陪它缓一缓'
    && domState.careGuidance.reasonTitle === '为什么推荐：心情低落，先陪它缓一缓'
    && domState.careGuidance.reasonAria === '为什么推荐：心情低落，先陪它缓一缓'
    && domState.careGuidance.preview === '心情回升 · 会耗精力'
    && domState.careGuidance.previewTitle === '心情回升 · 会耗精力（心+12 精-5 亲+5 · 心到平稳）'
    && domState.careGuidance.previewAria === '预计变化：心情回升 · 会耗精力（心+12 精-5 亲+5 · 心到平稳）'
    && domState.careGuidance.title === '执行推荐：玩耍。心情低落，先陪它缓一缓，预计心情回升 · 会耗精力（心+12 精-5 亲+5 · 心到平稳）。'
    && domState.careGuidance.text === '心情低落，先陪它缓一缓。'
  );
  const vitalInsightSteadyMoodPlayOk = !scenario.expectVitalInsightSteadyMoodPlay || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-play')
    && !domState.petClasses.includes('action-clean')
    && domState.message === '心情还稳，我们先轻松一下再继续。'
    && domState.petStateSummary === '刚看过心情，稳住节奏'
    && domState.petCareCue === '摸摸或玩耍'
    && domState.careFeedback.reason === '心情平稳，先轻松稳住节奏 · 最近：你确认了它心情平稳，它会放松一点再继续'
    && domState.careFeedback.delta === '心+1 亲+1'
    && domState.careFeedback.deltaText === '心情回升'
    && domState.careFeedback.moodLabel === '心情·平稳'
    && domState.careFeedback.moodStage === 'steady'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·熟悉'
    && domState.careFeedback.bondStage === 'familiar'
    && domState.careFeedback.focus === 'mood'
    && domState.careFeedback.focusSource === 'inspect'
    && domState.careFeedback.feedbackFocus === 'mood'
    && domState.careFeedback.feedbackFocusSource === 'inspect'
    && domState.careFeedback.focusedRows.mood === 'true'
    && domState.careFeedback.pressedRows.mood === 'true'
    && domState.careFeedback.vitalChips.mood?.text === '心情平稳'
    && domState.careFeedback.vitalChips.mood?.focus === 'true'
    && domState.careFeedback.vitalChips.mood?.stage === 'steady'
    && domState.careFeedback.vitalChips.mood?.title.includes('点一下，我会帮它稳住轻松节奏。')
    && domState.vitalFocusAction.hidden === false
    && domState.vitalFocusAction.vital === 'mood'
    && domState.vitalFocusAction.kind === 'care'
    && domState.vitalFocusAction.action === 'play'
    && domState.vitalFocusAction.label === '心情·平稳'
    && domState.vitalFocusAction.goal === '差11到愉快'
    && domState.vitalFocusAction.reason === '心情平稳，先轻松稳住节奏。'
    && domState.vitalFocusAction.impact === '预计心情回升 · 会耗精力（心+12 精-5 亲+5 · 心到愉快，亲到亲近）'
    && domState.vitalFocusAction.impactTone === 'mixed'
    && domState.vitalFocusAction.button === '去玩耍'
    && domState.vitalFocusAction.title === '心情·平稳，差11到愉快。执行推荐：玩耍。心情平稳，继续轻松互动，预计心情回升 · 会耗精力（心+12 精-5 亲+5 · 心到愉快，亲到亲近）。'
    && domState.careGuidance.display === 'none'
    && domState.careGuidance.kind === 'care'
    && domState.careGuidance.action === 'play'
    && domState.careGuidance.button === '玩耍'
    && domState.careGuidance.reason === '心情平稳，继续轻松互动'
    && domState.careGuidance.preview === '心情回升 · 会耗精力'
    && domState.careGuidance.text === '心情平稳，先轻松稳住节奏。'
  );
  const vitalInsightHappyMoodPlayOk = !scenario.expectVitalInsightHappyMoodPlay || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-play')
    && !domState.petClasses.includes('action-clean')
    && !domState.petClasses.includes('action-work')
    && domState.message === '心情不错，我陪它轻松玩一下稳住状态。'
    && domState.petStateSummary === '刚看过心情，轻松稳住'
    && domState.petCareCue === '摸摸或玩耍'
    && domState.careFeedback.reason === '心情愉快，先轻松玩一下 · 最近：你确认它心情不错，它会放松一下稳住状态'
    && !domState.careFeedback.reason.includes('任务')
    && domState.careFeedback.delta === '心+1 亲+1'
    && domState.careFeedback.deltaText === '心情回升'
    && domState.careFeedback.moodLabel === '心情·愉快'
    && domState.careFeedback.moodStage === 'happy'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·熟悉'
    && domState.careFeedback.bondStage === 'familiar'
    && domState.careFeedback.focus === 'mood'
    && domState.careFeedback.focusSource === 'inspect'
    && domState.careFeedback.feedbackFocus === 'mood'
    && domState.careFeedback.feedbackFocusSource === 'inspect'
    && domState.careFeedback.focusedRows.mood === 'true'
    && domState.careFeedback.pressedRows.mood === 'true'
    && domState.careFeedback.vitalChips.mood?.text === '心情愉快 · 玩耍'
    && domState.careFeedback.vitalChips.mood?.focus === 'true'
    && domState.careFeedback.vitalChips.mood?.stage === 'happy'
    && domState.careFeedback.vitalChips.mood?.title.includes('点一下，我会陪它轻松玩一下。')
    && domState.vitalFocusAction.hidden === false
    && domState.vitalFocusAction.vital === 'mood'
    && domState.vitalFocusAction.kind === 'care'
    && domState.vitalFocusAction.action === 'play'
    && domState.vitalFocusAction.label === '心情·愉快'
    && domState.vitalFocusAction.goal === '差11到高涨'
    && domState.vitalFocusAction.reason === '心情愉快，先轻松玩一下稳住状态。'
    && !domState.vitalFocusAction.reason.includes('任务')
    && domState.vitalFocusAction.impact === '预计心情回升 · 会耗精力（心+12 精-5 亲+5 · 心到高涨，亲到亲近）'
    && domState.vitalFocusAction.impactTone === 'mixed'
    && domState.vitalFocusAction.button === '去玩耍'
    && !domState.vitalFocusAction.title.includes('任务')
    && domState.careGuidance.display === 'none'
    && domState.careGuidance.kind === 'care'
    && domState.careGuidance.action === 'play'
    && domState.careGuidance.button === '玩耍'
    && domState.careGuidance.reason === '心情愉快，先轻松玩一下'
    && !domState.careGuidance.reason.includes('任务')
    && domState.careGuidance.preview === '心情回升 · 会耗精力'
    && domState.careGuidance.text === '心情愉快，先轻松玩一下稳住状态。'
  );
  const vitalInsightBrightMoodCalmOk = !scenario.expectVitalInsightBrightMoodCalm || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-clean')
    && !domState.petClasses.includes('action-play')
    && domState.message === '心情有点高，我们先轻轻互动把节奏稳住。'
    && domState.petStateSummary === '刚看过心情，收住高涨节奏'
    && domState.petCareCue === '多互动'
    && domState.careFeedback.reason === '心情高涨，先轻互动稳住节奏 · 最近：你确认它心情高涨，它愿意先稳住节奏'
    && domState.careFeedback.delta === '亲+1'
    && domState.careFeedback.deltaText === '亲密增加 · 差2到亲近'
    && domState.careFeedback.moodLabel === '心情·高涨'
    && domState.careFeedback.moodStage === 'bright'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·熟悉'
    && domState.careFeedback.bondStage === 'familiar'
    && domState.careFeedback.focus === 'mood'
    && domState.careFeedback.focusSource === 'inspect'
    && domState.careFeedback.feedbackFocus === 'mood'
    && domState.careFeedback.feedbackFocusSource === 'inspect'
    && domState.careFeedback.focusedRows.mood === 'true'
    && domState.careFeedback.pressedRows.mood === 'true'
    && domState.careFeedback.vitalChips.mood?.text === '心情高涨'
    && domState.careFeedback.vitalChips.mood?.focus === 'true'
    && domState.careFeedback.vitalChips.mood?.stage === 'bright'
    && domState.careFeedback.vitalChips.mood?.title.includes('点一下，我会用轻互动稳住节奏。')
    && domState.vitalFocusAction.hidden === false
    && domState.vitalFocusAction.vital === 'mood'
    && domState.vitalFocusAction.kind === 'care'
    && domState.vitalFocusAction.action === 'clean'
    && domState.vitalFocusAction.label === '心情·高涨'
    && domState.vitalFocusAction.goal === ''
    && domState.vitalFocusAction.goalHidden === true
    && domState.vitalFocusAction.reason === '心情高涨，先轻互动稳住节奏。'
    && domState.vitalFocusAction.impact === '预计亲密增加 · 心情回升（心+6 亲+4 · 亲到亲近）'
    && domState.vitalFocusAction.impactTone === 'positive'
    && domState.vitalFocusAction.button === '去轻互动'
    && domState.vitalFocusAction.title === '心情·高涨。执行推荐：轻互动。心情高涨，先轻互动稳住节奏，预计亲密增加 · 心情回升（心+6 亲+4 · 亲到亲近）。'
    && domState.careGuidance.display === 'none'
    && domState.careGuidance.kind === 'care'
    && domState.careGuidance.action === 'clean'
    && domState.careGuidance.button === '轻互动'
    && domState.careGuidance.reason === '心情高涨，先轻互动稳住节奏'
    && domState.careGuidance.preview === '亲密增加 · 心情回升'
    && domState.careGuidance.text === '心情高涨，先轻互动稳住节奏。'
  );
  const vitalInsightHappyMoodTaskOk = !scenario.expectVitalInsightHappyMoodTask || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-work')
    && domState.message === '心情不错，我陪你趁状态推进当前任务。'
    && domState.petStateSummary === '刚看过心情，趁状态做任务'
    && domState.petCareCue === '盯当前任务'
    && domState.careFeedback.reason === '心情愉快，适合推进当前任务 · 最近：你确认了心情状态，它会趁状态陪你推进任务'
    && domState.careFeedback.recent === '刚顺状态'
    && domState.careFeedback.recentHidden === false
    && domState.careFeedback.delta === '心+1 亲+1'
    && domState.careFeedback.deltaText === '心情回升'
    && domState.careFeedback.focus === 'mood'
    && domState.careFeedback.focusSource === 'inspect'
    && domState.careFeedback.feedbackFocus === 'mood'
    && domState.careFeedback.feedbackFocusSource === 'inspect'
    && domState.careFeedback.focusedRows.mood === 'true'
    && domState.careFeedback.pressedRows.mood === 'true'
    && domState.careFeedback.vitalChips.mood?.text === '心情愉快 · 打工'
    && domState.careFeedback.vitalChips.mood?.focus === 'true'
    && domState.careFeedback.vitalChips.mood?.stage === 'happy'
    && domState.careFeedback.vitalChips.mood?.title.includes('点一下，我会让它趁状态推进当前任务。')
    && domState.vitalFocusAction.hidden === false
    && domState.vitalFocusAction.vital === 'mood'
    && domState.vitalFocusAction.kind === 'care'
    && domState.vitalFocusAction.action === 'work'
    && domState.vitalFocusAction.label === '心情·愉快'
    && domState.vitalFocusAction.goal === '差9到高涨'
    && domState.vitalFocusAction.reason === '心情不错，先趁状态做一小步任务。'
    && domState.vitalFocusAction.impact === '预计亲密增加 · 精力降到低电（心+2 精-10 亲+4 · 精降低电，亲到亲近）'
    && domState.vitalFocusAction.impactTone === 'mixed'
    && domState.vitalFocusAction.button === '去打工'
    && domState.vitalFocusAction.title === '心情·愉快，差9到高涨。执行推荐：打工。心情不错，适合推进当前任务，预计亲密增加 · 精力降到低电（心+2 精-10 亲+4 · 精降低电，亲到亲近）。'
    && domState.careGuidance.display === 'none'
    && domState.careGuidance.kind === 'care'
    && domState.careGuidance.action === 'work'
    && domState.careGuidance.button === '打工'
    && domState.careGuidance.reason === '心情不错，适合推进当前任务'
    && domState.careGuidance.preview === '亲密增加 · 精力降到低电'
    && domState.careGuidance.text === '心情不错，先趁状态做一小步任务。'
  );
  const vitalInsightBondFollowupOk = !scenario.expectVitalInsightBondFollowup || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-clean')
    && domState.message === '我们正在变熟，稳定互动会让亲密慢慢上来。'
    && domState.petStateSummary === '刚看过亲密，适合轻互动'
    && domState.petCareCue === '多互动'
    && domState.careMenu.title === '现在适合轻互动'
    && domState.careMenu.reason === '关系正在变熟'
    && domState.careMenu.buttons[0]?.action === 'clean'
    && domState.careMenu.buttons[0]?.recommended
    && domState.careMenu.buttons[0]?.reasonBadges.includes('亲密熟悉')
    && domState.careFeedback.reason.includes('你看见了关系进度')
    && domState.careFeedback.delta === '亲+1'
    && domState.careFeedback.tone === 'positive'
    && domState.careFeedback.bondLabel === '亲密·熟悉'
    && domState.careFeedback.bondStage === 'familiar'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'inspect'
    && domState.careFeedback.feedbackFocus === 'bond'
    && domState.careFeedback.feedbackFocusSource === 'inspect'
    && domState.careFeedback.focusedRows.bond === 'true'
    && domState.vitalFocusAction.hidden === false
    && domState.vitalFocusAction.vital === 'bond'
    && domState.vitalFocusAction.kind === 'care'
    && domState.vitalFocusAction.action === 'clean'
    && domState.vitalFocusAction.label === '亲密·熟悉'
    && domState.vitalFocusAction.goal === '差14到亲近'
    && domState.vitalFocusAction.goalHidden === false
    && domState.vitalFocusAction.goalTitle === '亲密·熟悉，差14到亲近'
    && domState.vitalFocusAction.reason === '关系正在变熟，先轻互动增加安全感。'
    && ['-webkit-box', 'flow-root'].includes(domState.vitalFocusAction.reasonStyle.display)
    && domState.vitalFocusAction.reasonStyle.whiteSpace === 'normal'
    && domState.vitalFocusAction.reasonStyle.textOverflow !== 'ellipsis'
    && domState.vitalFocusAction.reasonStyle.webkitLineClamp === '2'
    && domState.vitalFocusAction.impact === '预计亲密增加 · 心情回升（心+6 亲+4）'
    && domState.vitalFocusAction.impactHidden === false
    && domState.vitalFocusAction.impactTone === 'positive'
    && domState.vitalFocusAction.impactTitle === '亲密增加 · 心情回升（心+6 亲+4）'
    && domState.vitalFocusAction.button === '去轻互动'
    && domState.vitalFocusAction.title === '亲密·熟悉，差14到亲近。执行推荐：轻互动。关系正在变熟，预计亲密增加 · 心情回升（心+6 亲+4）。'
    && domState.vitalFocusAction.aria === '亲密·熟悉，差14到亲近。执行推荐：轻互动。关系正在变熟，预计亲密增加 · 心情回升（心+6 亲+4）。'
    && domState.careGuidance.display === 'none'
    && domState.careGuidance.kind === 'care'
    && domState.careGuidance.action === 'clean'
    && domState.careGuidance.button === '轻互动'
    && domState.careGuidance.reason === '关系正在变熟'
    && domState.careGuidance.reasonTitle === '为什么推荐：关系正在变熟'
    && domState.careGuidance.reasonAria === '为什么推荐：关系正在变熟'
    && domState.careGuidance.preview === '亲密增加 · 心情回升'
    && domState.careGuidance.previewTitle === '亲密增加 · 心情回升（心+6 亲+4）'
    && domState.careGuidance.previewAria === '预计变化：亲密增加 · 心情回升（心+6 亲+4）'
    && domState.careGuidance.previewTone === 'positive'
    && domState.careGuidance.title === '执行推荐：轻互动。关系正在变熟，预计亲密增加 · 心情回升（心+6 亲+4）。'
    && domState.careGuidance.text === '关系正在变熟，先轻互动增加安全感。'
  );
  const vitalInsightNewBondReassureOk = !scenario.expectVitalInsightNewBondReassure || (
    domState.surface === 'home'
    && domState.vibe === 'guarded'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-clean')
    && domState.message === '我还在适应你，先打个招呼，轻轻互动会更安心。'
    && domState.petStateSummary === '刚看过亲密，先建立安全感'
    && domState.petCareCue === '建立安全感'
    && domState.careFeedback.reason === '关系还在试探，先打个招呼让它安心 · 最近：你关注关系状态，它试着更靠近一点'
    && !domState.careFeedback.reason.includes('亲密偏低')
    && domState.careFeedback.delta === '心+1 亲+2'
    && domState.careFeedback.deltaText === '亲密增加'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'inspect'
    && domState.careFeedback.feedbackFocus === 'bond'
    && domState.careFeedback.feedbackFocusSource === 'inspect'
    && domState.careFeedback.focusedRows.bond === 'true'
    && domState.careFeedback.pressedRows.bond === 'true'
    && domState.careFeedback.vitalChips.bond?.text === '亲密试探 · 轻互动'
    && domState.careFeedback.vitalChips.bond?.need === 'primary'
    && domState.careFeedback.vitalChips.bond?.focus === 'true'
    && domState.careFeedback.vitalChips.bond?.stage === 'new'
    && domState.careFeedback.vitalChips.bond?.title.includes('点一下，我会先打个招呼，让它安心靠近。')
    && domState.vitalFocusAction.hidden === false
    && domState.vitalFocusAction.vital === 'bond'
    && domState.vitalFocusAction.kind === 'care'
    && domState.vitalFocusAction.action === 'clean'
    && domState.vitalFocusAction.label === '亲密·试探'
    && domState.vitalFocusAction.goal === '差11到熟悉'
    && domState.vitalFocusAction.reason === '关系还在试探，先打个招呼让它安心。'
    && !domState.vitalFocusAction.reason.includes('任务')
    && domState.vitalFocusAction.impact === '预计亲密增加 · 心情回升（心+6 亲+4）'
    && domState.vitalFocusAction.impactTone === 'positive'
    && domState.vitalFocusAction.button === '去轻互动'
    && domState.vitalFocusAction.title === '亲密·试探，差11到熟悉。执行推荐：轻互动。关系还在试探，先打个招呼让它安心，预计亲密增加 · 心情回升（心+6 亲+4）。'
    && domState.careGuidance.display === 'none'
    && domState.careGuidance.kind === 'care'
    && domState.careGuidance.action === 'clean'
    && domState.careGuidance.button === '轻互动'
    && domState.careGuidance.reason === '关系还在试探，先打个招呼让它安心'
    && domState.careGuidance.reasonTitle === '为什么推荐：关系还在试探，先打个招呼让它安心'
    && domState.careGuidance.preview === '亲密增加 · 心情回升'
    && domState.careGuidance.text === '关系还在试探，先打个招呼让它安心。'
  );
  const vitalInsightCloseBondCalmOk = !scenario.expectVitalInsightCloseBondCalm || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-clean')
    && !domState.petClasses.includes('action-work')
    && domState.message === '关系已经亲近了，轻轻互动就能保持默契。'
    && domState.petStateSummary === '刚看过亲密，保持亲近'
    && domState.petCareCue === '多互动'
    && domState.careFeedback.reason === '亲密亲近，先轻互动保持默契 · 最近：你确认了亲近关系，它会安心地陪着'
    && !domState.careFeedback.reason.includes('任务')
    && domState.careFeedback.delta === '亲+1'
    && domState.careFeedback.deltaText === '亲密增加'
    && domState.careFeedback.bondLabel === '亲密·亲近'
    && domState.careFeedback.bondStage === 'close'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'inspect'
    && domState.careFeedback.feedbackFocus === 'bond'
    && domState.careFeedback.feedbackFocusSource === 'inspect'
    && domState.careFeedback.focusedRows.bond === 'true'
    && domState.careFeedback.pressedRows.bond === 'true'
    && domState.careFeedback.vitalChips.bond?.text === '亲密亲近 · 轻互动'
    && domState.careFeedback.vitalChips.bond?.focus === 'true'
    && domState.careFeedback.vitalChips.bond?.stage === 'close'
    && domState.careFeedback.vitalChips.bond?.title.includes('点一下，我会轻互动保持亲近。')
    && domState.vitalFocusAction.hidden === false
    && domState.vitalFocusAction.vital === 'bond'
    && domState.vitalFocusAction.kind === 'care'
    && domState.vitalFocusAction.action === 'clean'
    && domState.vitalFocusAction.label === '亲密·亲近'
    && domState.vitalFocusAction.goal === '差14到默契'
    && domState.vitalFocusAction.reason === '亲密亲近，先轻互动保持默契。'
    && !domState.vitalFocusAction.reason.includes('任务')
    && domState.vitalFocusAction.impact === '预计亲密增加 · 心情回升（心+6 亲+4）'
    && domState.vitalFocusAction.impactTone === 'positive'
    && domState.vitalFocusAction.button === '去轻互动'
    && domState.vitalFocusAction.title === '亲密·亲近，差14到默契。执行推荐：轻互动。亲密亲近，先轻互动保持默契，预计亲密增加 · 心情回升（心+6 亲+4）。'
    && domState.careGuidance.display === 'none'
    && domState.careGuidance.kind === 'care'
    && domState.careGuidance.action === 'clean'
    && domState.careGuidance.button === '轻互动'
    && domState.careGuidance.reason === '亲密亲近，先轻互动保持默契'
    && domState.careGuidance.preview === '亲密增加 · 心情回升'
    && domState.careGuidance.text === '亲密亲近，先轻互动保持默契。'
  );
  const vitalInsightCloseBondTaskOk = !scenario.expectVitalInsightCloseBondTask || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-work')
    && domState.message === '关系已经亲近了，我陪你一起推进当前任务。'
    && domState.petStateSummary === '刚看过亲密，一起做任务'
    && domState.petCareCue === '盯当前任务'
    && domState.careFeedback.reason === '亲密亲近，可以一起守住当前任务 · 最近：你确认了亲密关系，它愿意陪你推进任务'
    && domState.careFeedback.delta === '亲+1'
    && domState.careFeedback.deltaText === '亲密增加 · 差6到默契'
    && domState.careFeedback.bondLabel === '亲密·亲近'
    && domState.careFeedback.bondStage === 'close'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'inspect'
    && domState.careFeedback.feedbackFocus === 'bond'
    && domState.careFeedback.feedbackFocusSource === 'inspect'
    && domState.careFeedback.focusedRows.bond === 'true'
    && domState.careFeedback.pressedRows.bond === 'true'
    && domState.careFeedback.vitalChips.bond?.text === '亲密亲近 · 打工'
    && domState.careFeedback.vitalChips.bond?.focus === 'true'
    && domState.careFeedback.vitalChips.bond?.stage === 'close'
    && domState.careFeedback.vitalChips.bond?.title.includes('点一下，我会让它陪你推进当前任务。')
    && domState.vitalFocusAction.hidden === false
    && domState.vitalFocusAction.vital === 'bond'
    && domState.vitalFocusAction.kind === 'care'
    && domState.vitalFocusAction.action === 'work'
    && domState.vitalFocusAction.label === '亲密·亲近'
    && domState.vitalFocusAction.goal === '差6到默契'
    && domState.vitalFocusAction.reason === '关系已经亲近，先一起做一小步任务。'
    && domState.vitalFocusAction.impact === '预计亲密增加 · 精力降到低电（心+2 精-10 亲+4 · 精降低电）'
    && domState.vitalFocusAction.impactTone === 'mixed'
    && domState.vitalFocusAction.button === '去打工'
    && domState.vitalFocusAction.title === '亲密·亲近，差6到默契。执行推荐：打工。关系已经亲近，继续靠近默契，预计亲密增加 · 精力降到低电（心+2 精-10 亲+4 · 精降低电）。'
    && domState.careGuidance.display === 'none'
    && domState.careGuidance.kind === 'care'
    && domState.careGuidance.action === 'work'
    && domState.careGuidance.reason === '关系已经亲近，继续靠近默契'
    && domState.careGuidance.preview === '亲密增加 · 精力降到低电'
    && domState.careGuidance.title === '执行推荐：打工。关系已经亲近，继续靠近默契，预计亲密增加 · 精力降到低电（心+2 精-10 亲+4 · 精降低电）。'
    && domState.careGuidance.text === '关系已经亲近，先一起做一小步任务。'
  );
  const vitalInsightTrustedBondTaskOk = !scenario.expectVitalInsightTrustedBondTask || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-work')
    && domState.message === '默契已经很稳了，我陪你一起推进当前任务。'
    && domState.petStateSummary === '刚看过亲密，一起做任务'
    && domState.petCareCue === '盯当前任务'
    && domState.careFeedback.reason === '亲密默契，可以一起守住当前任务 · 最近：你确认了默契关系，它会按你的节奏推进任务'
    && domState.careFeedback.delta === '亲+1'
    && domState.careFeedback.deltaText === '亲密增加'
    && domState.careFeedback.bondLabel === '亲密·默契'
    && domState.careFeedback.bondStage === 'trusted'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'inspect'
    && domState.careFeedback.feedbackFocus === 'bond'
    && domState.careFeedback.feedbackFocusSource === 'inspect'
    && domState.careFeedback.focusedRows.bond === 'true'
    && domState.careFeedback.pressedRows.bond === 'true'
    && domState.careFeedback.vitalChips.bond?.text === '亲密默契 · 打工'
    && domState.careFeedback.vitalChips.bond?.focus === 'true'
    && domState.careFeedback.vitalChips.bond?.stage === 'trusted'
    && domState.careFeedback.vitalChips.bond?.title.includes('点一下，我会让它陪你推进当前任务。')
    && domState.vitalFocusAction.hidden === false
    && domState.vitalFocusAction.vital === 'bond'
    && domState.vitalFocusAction.kind === 'care'
    && domState.vitalFocusAction.action === 'work'
    && domState.vitalFocusAction.label === '亲密·默契'
    && domState.vitalFocusAction.goal === ''
    && domState.vitalFocusAction.goalHidden === true
    && domState.vitalFocusAction.reason === '默契很稳，先按你的节奏推进当前任务。'
    && domState.vitalFocusAction.impact === '预计亲密增加 · 精力降到低电（心+2 精-10 亲+4 · 精降低电）'
    && domState.vitalFocusAction.impactTone === 'mixed'
    && domState.vitalFocusAction.button === '去打工'
    && domState.vitalFocusAction.title === '亲密·默契。执行推荐：打工。默契很稳，适合推进当前任务，预计亲密增加 · 精力降到低电（心+2 精-10 亲+4 · 精降低电）。'
    && domState.careGuidance.display === 'none'
    && domState.careGuidance.kind === 'care'
    && domState.careGuidance.action === 'work'
    && domState.careGuidance.reason === '默契很稳，适合推进当前任务'
    && domState.careGuidance.preview === '亲密增加 · 精力降到低电'
    && domState.careGuidance.title === '执行推荐：打工。默契很稳，适合推进当前任务，预计亲密增加 · 精力降到低电（心+2 精-10 亲+4 · 精降低电）。'
    && domState.careGuidance.text === '默契很稳，先按你的节奏推进当前任务。'
  );
  const vitalInsightTrustedBondCompanionOk = !scenario.expectVitalInsightTrustedBondCompanion || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-clean')
    && !domState.petClasses.includes('action-play')
    && !domState.petClasses.includes('action-work')
    && domState.message === '默契已经很稳了，我会安静陪着你。'
    && domState.petStateSummary === '刚看过亲密，默契陪伴'
    && domState.petCareCue === '多互动'
    && domState.homeCare.text === '陪伴'
    && domState.homeCare.meta === '亲密默契，先按你的节奏陪伴 · 亲密增加'
    && domState.homeCare.action === 'clean'
    && domState.homeCare.reason === '亲密默契，先按你的节奏陪伴'
    && domState.homeCare.impact === '预计亲密增加，也会照顾心情'
    && domState.homeCare.title === '现在适合陪伴：亲密默契，先按你的节奏陪伴，预计亲密增加，也会照顾心情。打开照料菜单'
    && domState.careFeedback.reason === '亲密默契，先按你的节奏陪伴 · 最近：你确认了默契关系，它会安静地陪着'
    && !domState.careFeedback.reason.includes('任务')
    && domState.careFeedback.delta === '心+1'
    && domState.careFeedback.deltaText === '心情回升'
    && domState.careFeedback.bondLabel === '亲密·默契'
    && domState.careFeedback.bondStage === 'trusted'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'inspect'
    && domState.careFeedback.feedbackFocus === 'bond'
    && domState.careFeedback.feedbackFocusSource === 'inspect'
    && domState.careFeedback.focusedRows.bond === 'true'
    && domState.careFeedback.pressedRows.bond === 'true'
    && domState.careFeedback.vitalChips.bond?.text === '亲密默契 · 陪伴'
    && domState.careFeedback.vitalChips.bond?.focus === 'true'
    && domState.careFeedback.vitalChips.bond?.stage === 'trusted'
    && domState.careFeedback.vitalChips.bond?.title.includes('点一下，我会安静陪它保持默契。')
    && domState.vitalFocusAction.hidden === false
    && domState.vitalFocusAction.vital === 'bond'
    && domState.vitalFocusAction.kind === 'care'
    && domState.vitalFocusAction.action === 'clean'
    && domState.vitalFocusAction.label === '亲密·默契'
    && domState.vitalFocusAction.goal === ''
    && domState.vitalFocusAction.goalHidden === true
    && domState.vitalFocusAction.reason === '亲密默契，先按你的节奏陪伴。'
    && !domState.vitalFocusAction.reason.includes('任务')
    && domState.vitalFocusAction.impact === '预计亲密增加 · 心情回升（心+6 亲+4）'
    && domState.vitalFocusAction.impactTone === 'positive'
    && domState.vitalFocusAction.button === '去陪伴'
    && domState.vitalFocusAction.title === '亲密·默契。执行推荐：陪伴。亲密默契，先按你的节奏陪伴，预计亲密增加 · 心情回升（心+6 亲+4）。'
    && domState.careGuidance.display === 'none'
    && domState.careGuidance.kind === 'care'
    && domState.careGuidance.action === 'clean'
    && domState.careGuidance.button === '陪伴'
    && domState.careGuidance.reason === '亲密默契，先按你的节奏陪伴'
    && domState.careGuidance.preview === '亲密增加 · 心情回升'
    && domState.careGuidance.text === '亲密默契，先按你的节奏陪伴。'
    && domState.careGuidance.title === '执行推荐：陪伴。亲密默契，先按你的节奏陪伴，预计亲密增加 · 心情回升（心+6 亲+4）。'
  );
  const vitalInsightBondMenuOk = !scenario.expectVitalInsightBondMenu || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && !domState.careMenu.hidden
    && domState.petClasses.includes('action-clean')
    && domState.petStateSummary === '刚看过亲密，适合轻互动'
    && domState.careMenu.title === '现在适合轻互动'
    && domState.careMenu.reason === '关系正在变熟'
    && domState.careMenu.buttons[0]?.action === 'clean'
    && domState.careMenu.buttons[0]?.recommended
    && domState.careMenu.buttons[0]?.reasonBadges.includes('亲密熟悉')
    && domState.careMenu.buttons[0]?.text.includes('亲密熟悉')
    && domState.careMenu.buttons[0]?.effectCount === 2
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'inspect'
    && domState.careMenu.rect.bottom <= domState.careMenu.statsRect.top - 4
  );
  const vitalInsightRepeatOk = !scenario.expectVitalInsightRepeat || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-clean')
    && domState.message === '我刚刚解释过啦，先按下面的轻互动建议行动就好。'
    && domState.petStateSummary === '刚看过亲密，适合轻互动'
    && domState.petCareCue === '多互动'
    && domState.careFeedback.reason.includes('刚刚已经看过这个状态')
    && domState.careFeedback.delta === '亲密待行动'
    && domState.careFeedback.deltaText === '亲密待行动'
    && domState.careFeedback.tone === 'neutral'
    && domState.careFeedback.bondLabel === '亲密·熟悉'
    && domState.careFeedback.bondStage === 'familiar'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'inspect'
    && domState.careFeedback.feedbackFocus === 'bond'
    && domState.careFeedback.feedbackFocusSource === 'inspect'
    && domState.careFeedback.focusedRows.bond === 'true'
    && domState.careFeedback.recent === '刚看亲密'
    && domState.careGuidance.display === 'none'
    && domState.careGuidance.kind === 'care'
    && domState.careGuidance.action === 'clean'
    && domState.careGuidance.button === '轻互动'
    && domState.careGuidance.reason === '关系正在变熟'
  );
  const careGuardFeedbackOk = !scenario.expectCareGuardFeedback || (
    domState.surface === 'home'
    && domState.vibe === 'tired'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-rest')
    && domState.spriteBackgroundPosition.endsWith('-1872px')
    && domState.message === '它已经很累了，先休息一下再推进任务。'
    && careCooldownRestImpactOk
    && domState.careFeedback.reason.includes('精力太低')
    && domState.careFeedback.delta === '精+4'
    && domState.careFeedback.deltaText === '精力回升 · 差3到低电'
    && domState.careFeedback.aria.includes('本次变化：精力回升 · 差3到低电（精+4）')
    && domState.careFeedback.tone === 'positive'
    && domState.careFeedback.moodLabel === '心情·愉快'
    && domState.careFeedback.moodStage === 'happy'
    && domState.careFeedback.energyLabel === '精力·疲惫'
    && domState.careFeedback.energyStage === 'tired'
    && domState.careFeedback.bondLabel === '亲密·熟悉'
    && domState.careFeedback.bondStage === 'familiar'
    && domState.careFeedback.trends.mood === 'flat'
    && domState.careFeedback.trends.energy === 'up'
    && domState.careFeedback.trends.bond === 'flat'
    && domState.careFeedback.focus === 'energy'
    && domState.careFeedback.feedbackFocus === 'energy'
    && domState.careFeedback.focusedRows.energy === 'true'
  );
  const careGuardRepeatFeedbackOk = !scenario.expectCareGuardRepeatFeedback || (
    domState.surface === 'home'
    && domState.vibe === 'tired'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-rest')
    && domState.message === '还在观察精力回升，约30秒后再继续照料。'
    && careCooldownRestImpactOk
    && domState.careFeedback.reason.includes('照料还在观察期')
    && domState.careFeedback.reason.includes('先观察精力回升')
    && domState.careFeedback.recent === '刚休息过'
    && domState.careFeedback.delta === '精力观察中'
    && domState.careFeedback.deltaText === '精力观察中'
    && domState.careFeedback.tone === 'neutral'
    && domState.careFeedback.moodLabel === '心情·愉快'
    && domState.careFeedback.moodStage === 'happy'
    && domState.careFeedback.energyLabel === '精力·疲惫'
    && domState.careFeedback.energyStage === 'tired'
    && domState.careFeedback.bondLabel === '亲密·熟悉'
    && domState.careFeedback.bondStage === 'familiar'
    && domState.careFeedback.focus === 'energy'
    && domState.careFeedback.focusSource === 'care'
    && domState.careFeedback.feedbackFocus === 'energy'
    && domState.careFeedback.feedbackFocusSource === 'care'
    && domState.careFeedback.focusedRows.energy === 'true'
    && domState.careFeedback.trends.mood === 'flat'
    && domState.careFeedback.trends.energy === 'flat'
    && domState.careFeedback.trends.bond === 'flat'
    && careGuidanceObserveOk('先观察精力回升')
  );
  const careMoodGuardFeedbackOk = !scenario.expectCareMoodGuardFeedback || (
    domState.surface === 'home'
    && domState.vibe === 'down'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-play')
    && domState.message === '它现在有点低落，先玩一小会儿再继续任务。'
    && domState.petStateSummary === '刚照料过，先观察状态'
    && domState.petCareCue === '观察变化'
    && domState.homeCare.text === '观察'
    && domState.homeCare.meta === '刚玩耍过 · 心情回升'
    && domState.homeCare.action === 'cooldown'
    && domState.homeCare.reason === '刚玩耍过'
    && domState.homeCare.impact === '先观察心情回升'
    && domState.homeCare.title === '刚刚玩耍过，先观察心情回升；约30秒后再继续。打开照料菜单'
    && domState.careFeedback.reason.includes('心情太低')
    && domState.careFeedback.delta === '心+4'
    && domState.careFeedback.deltaText === '心情回升 · 差4到平稳'
    && domState.careFeedback.aria.includes('本次变化：心情回升 · 差4到平稳（心+4）')
    && domState.careFeedback.tone === 'positive'
    && domState.careFeedback.moodLabel === '心情·低落'
    && domState.careFeedback.moodStage === 'low'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·熟悉'
    && domState.careFeedback.bondStage === 'familiar'
    && domState.careFeedback.trends.mood === 'up'
    && domState.careFeedback.trends.energy === 'flat'
    && domState.careFeedback.trends.bond === 'flat'
    && domState.careFeedback.focus === 'mood'
    && domState.careFeedback.feedbackFocus === 'mood'
    && domState.careFeedback.focusedRows.mood === 'true'
    && careGuidanceObserveOk('先观察心情回升', '刚玩耍过')
    && domState.careMenu.buttons.some(button => button.action === 'work' && button.guard === 'blocked' && button.cueText.includes('心情太低') && button.guardLabels.includes('先玩耍'))
  );
  const careBondSoftGuardFeedbackOk = !scenario.expectCareBondSoftGuardFeedback || (
    domState.surface === 'home'
    && domState.vibe === 'guarded'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-clean')
    && domState.message === '它还在适应你，先轻轻互动一下再一起推进。'
    && domState.petStateSummary === '刚照料过，先观察状态'
    && domState.petCareCue === '观察变化'
    && domState.homeCare.text === '观察'
    && domState.homeCare.meta === '刚轻互动过 · 亲密增加'
    && domState.homeCare.action === 'cooldown'
    && domState.homeCare.reason === '刚轻互动过'
    && domState.homeCare.impact === '先观察亲密增加'
    && domState.homeCare.title === '刚刚轻互动过，先观察亲密增加；约30秒后再继续。打开照料菜单'
    && domState.careFeedback.reason.includes('关系还在试探')
    && domState.careFeedback.delta === '心+1 亲+2'
    && domState.careFeedback.tone === 'positive'
    && domState.careFeedback.moodLabel === '心情·平稳'
    && domState.careFeedback.moodStage === 'steady'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·试探'
    && domState.careFeedback.bondStage === 'new'
    && domState.careFeedback.trends.mood === 'up'
    && domState.careFeedback.trends.energy === 'flat'
    && domState.careFeedback.trends.bond === 'up'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.feedbackFocus === 'bond'
    && domState.careFeedback.focusedRows.bond === 'true'
    && careGuidanceObserveOk('先观察亲密增加', '刚轻互动过')
    && domState.careMenu.buttons.some(button => button.action === 'work' && button.guard === 'soft' && button.cueText.includes('关系还在试探') && button.guardLabels.includes('先熟悉'))
  );
  const feedFeedbackOk = !scenario.expectFeedFeedback || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.careMenu.hidden
    && domState.petClasses.includes('action-feed')
    && domState.message === '它补了一点能量，眼神亮起来，会更稳地陪你。'
    && domState.petStateSummary === '刚照料过，先观察状态'
    && domState.petCareCue === '观察变化'
    && domState.homeCare.text === '观察'
    && domState.homeCare.meta === '刚喂食过 · 精力回到充足'
    && domState.homeCare.action === 'cooldown'
    && domState.homeCare.reason === '刚喂食过'
    && domState.homeCare.impact === '先观察精力回到充足'
    && domState.homeCare.title === '刚刚喂食过，先观察精力回到充足；约30秒后再继续。打开照料菜单'
    && domState.careFeedback.reason.includes('补一点能量后')
    && domState.careFeedback.source === '照料·喂食'
    && domState.careFeedback.sourceData === 'care'
    && domState.careFeedback.sourceDetail === '喂食'
    && domState.careFeedback.recent === '刚喂食'
    && domState.careFeedback.delta === '心+8 精+10 亲+3'
    && domState.careFeedback.deltaText === '精力回升'
    && domState.careFeedback.deltaDetail === '心+8 精+10 亲+3'
    && domState.careFeedback.tone === 'positive'
    && domState.careFeedback.milestone === 'true'
    && domState.careFeedback.milestoneTone === 'positive'
    && domState.careFeedback.moodLabel === '心情·愉快'
    && domState.careFeedback.moodStage === 'happy'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·亲近'
    && domState.careFeedback.bondStage === 'close'
    && domState.careFeedback.focus === 'energy'
    && domState.careFeedback.feedbackFocus === 'energy'
    && domState.careFeedback.focusedRows.energy === 'true'
    && domState.careFeedback.trends.mood === 'up'
    && domState.careFeedback.trends.energy === 'up'
    && domState.careFeedback.trends.bond === 'up'
  );
  const offlineRestFeedbackOk = !scenario.expectOfflineRestFeedback || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.petStatsDisplay === 'grid'
    && domState.petStateSummary === '离开后恢复了精力'
    && domState.petCareCue === '先接回节奏'
    && domState.careFeedback.reason.includes('休息后精力回来了')
    && domState.careFeedback.delta === '心+2 精+36 亲-1'
    && domState.careFeedback.tone === 'mixed'
    && domState.careFeedback.moodLabel === '心情·平稳'
    && domState.careFeedback.moodStage === 'steady'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·亲近'
    && domState.careFeedback.bondStage === 'close'
    && domState.careFeedback.focus === 'energy'
    && domState.careFeedback.focusSource === 'offline'
    && domState.careFeedback.feedbackFocus === 'energy'
    && domState.careFeedback.feedbackFocusSource === 'offline'
    && domState.careFeedback.focusedRows.energy === 'true'
    && domState.careFeedback.trends.mood === 'up'
    && domState.careFeedback.trends.energy === 'up'
    && domState.careFeedback.trends.bond === 'down'
  );
  const settingsFeedbackOk = !scenario.expectSettingsFeedback || (
    domState.surface === 'settings'
    && !domState.settings.hidden
    && domState.settings.intensity === 'active'
    && domState.vibe === 'steady'
    && domState.petClasses.includes('action-play')
    && domState.spriteBackgroundPosition.endsWith('-2496px')
    && domState.message === '我会更主动提醒你，也会多花一点精力。'
    && domState.petStateSummary === '正在看着设置节奏'
    && domState.petCareCue === '调提醒节奏'
    && domState.careFeedback.reason.includes('陪伴调活跃')
    && domState.careFeedback.delta === '心+2 精-1 亲+1'
    && domState.careFeedback.tone === 'mixed'
    && domState.careFeedback.moodLabel === '心情·愉快'
    && domState.careFeedback.moodStage === 'happy'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·熟悉'
    && domState.careFeedback.bondStage === 'familiar'
    && domState.careFeedback.trends.mood === 'up'
    && domState.careFeedback.trends.energy === 'down'
    && domState.careFeedback.trends.bond === 'up'
  );
  const settingsRepeatFeedbackOk = !scenario.expectSettingsRepeatFeedback || (
    domState.surface === 'settings'
    && !domState.settings.hidden
    && domState.settings.intensity === 'normal'
    && domState.vibe === 'steady'
    && domState.petClasses.includes('action-rest')
    && domState.message === '设置已保存，当前节奏已经同步过了。'
    && domState.petStateSummary === '正在看着设置节奏'
    && domState.petCareCue === '调提醒节奏'
    && domState.careFeedback.reason.includes('设置刚刚已经同步过')
    && domState.careFeedback.delta === '亲密已确认'
    && domState.careFeedback.deltaText === '亲密已确认'
    && domState.careFeedback.tone === 'neutral'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'settings'
    && domState.careFeedback.feedbackFocus === 'bond'
    && domState.careFeedback.feedbackFocusSource === 'settings'
    && domState.careFeedback.focusedRows.bond === 'true'
    && domState.careFeedback.trends.mood === 'flat'
    && domState.careFeedback.trends.energy === 'flat'
    && domState.careFeedback.trends.bond === 'flat'
  );
  const settingsOpenFeedbackOk = !scenario.expectSettingsOpenFeedback || (
    domState.surface === 'settings'
    && !domState.settings.hidden
    && domState.settings.intensity === 'normal'
    && domState.vibe === 'steady'
    && domState.contextDisplay === 'none'
    && domState.message === '我看着设置面板，提醒节奏调顺就继续任务。'
    && domState.petStateSummary === '正在看着设置节奏'
    && domState.petCareCue === '调提醒节奏'
    && domState.careFeedback.reason.includes('打开设置面板')
    && domState.careFeedback.delta === '亲+1'
    && domState.careFeedback.tone === 'positive'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'settings'
    && domState.careFeedback.feedbackFocus === 'bond'
    && domState.careFeedback.feedbackFocusSource === 'settings'
    && domState.careFeedback.focusedRows.bond === 'true'
    && domState.careFeedback.trends.mood === 'flat'
    && domState.careFeedback.trends.energy === 'flat'
    && domState.careFeedback.trends.bond === 'up'
  );
  const onboardingGuideOk = !scenario.expectOnboardingGuide || (
    domState.surface === 'onboarding'
    && !domState.onboarding.hidden
    && domState.contextDisplay === 'none'
    && domState.onboarding.complete === 'false'
    && domState.onboarding.cardCount === 3
    && domState.onboarding.modes.join(',') === 'basic,enhanced,advanced'
    && domState.onboarding.text.includes('3 分钟完成基础模式')
    && domState.onboarding.text.includes('任务 + 宠物 + 前台 App 判断')
    && domState.onboarding.text.includes('工作/学习/娱乐关键词')
    && domState.onboarding.text.includes('屏幕检查')
    && domState.onboarding.text.includes('社交监督')
    && domState.onboarding.text.includes('WebRTC')
    && domState.onboarding.text.includes('会采集什么')
    && domState.onboarding.text.includes('不会采集什么')
    && domState.onboarding.text.includes('数据保存在哪里')
    && domState.onboarding.text.includes('是否会外发')
    && domState.onboarding.overflowingNodes.length === 0
    && domState.message === '先选一个模式，基础模式三分钟内就能开始用。'
  );
  const settingsLlmSelfCheckOk = !scenario.expectSettingsLlmSelfCheck || (
    domState.surface === 'settings'
    && !domState.settings.hidden
    && domState.settings.llmSelfCheck.cardCount === 2
    && domState.settings.llmSelfCheck.text.includes('屏幕监控 LLM 缺少 endpoint、API key')
    && domState.settings.llmSelfCheck.text.includes('复盘 LLM 缺少 API key')
    && domState.settings.llmSelfCheck.text.includes('没有发送测试请求')
    && domState.settings.llmSelfCheck.steps.some(step => step.includes('FOCUS_PET_LLM_API_KEY'))
    && domState.settings.llmSelfCheck.steps.some(step => step.includes('FOCUS_PET_REVIEW_LLM_API_KEY'))
    && domState.settings.llmSelfCheck.statuses.some(className => className.includes('needs-config'))
    && domState.settings.llmSelfCheck.overflowingNodes.length === 0
    && domState.message === 'LLM 自检发现问题，先按设置里的步骤修好。'
    && domState.focusPetCalls.some(call => call.name === 'testLlmConnectivity')
  );
  const touchFeedbackOk = !scenario.expectTouchFeedback || (
    domState.surface === 'home'
    && domState.vibe === 'guarded'
    && domState.petClasses.includes('action-clean')
    && domState.spriteBackgroundPosition.endsWith('-2288px')
    && domState.message === '它犹豫了一下，还是靠近了一点。'
    && domState.petStateSummary === '还在熟悉你，会保持一点距离'
    && domState.petCareCue === '轻轻靠近'
    && domState.careFeedback.reason === '它愿意靠近一点，先轻轻互动让它安心 · 最近：关系还在试探，轻轻互动会更熟悉'
    && !domState.careFeedback.reason.includes('下一步先照顾')
    && domState.careFeedback.delta === '心+1 亲+3'
    && domState.careFeedback.tone === 'positive'
    && domState.careFeedback.moodLabel === '心情·平稳'
    && domState.careFeedback.moodStage === 'steady'
    && domState.careFeedback.energyLabel === '精力·低电'
    && domState.careFeedback.energyStage === 'low'
    && domState.careFeedback.bondLabel === '亲密·试探'
    && domState.careFeedback.bondStage === 'new'
    && domState.careFeedback.trends.mood === 'up'
    && domState.careFeedback.trends.energy === 'flat'
    && domState.careFeedback.trends.bond === 'up'
    && domState.vitalFocusAction.hidden === false
    && domState.vitalFocusAction.vital === 'bond'
    && domState.vitalFocusAction.kind === 'care'
    && domState.vitalFocusAction.action === 'clean'
    && domState.vitalFocusAction.label === '摸摸·试探'
    && domState.vitalFocusAction.goal === '差10到熟悉'
    && domState.vitalFocusAction.goalHidden === false
    && domState.vitalFocusAction.goalTitle === '摸摸·试探，差10到熟悉'
    && domState.vitalFocusAction.reason === '它回应了摸摸，先轻轻互动让它安心。'
    && domState.vitalFocusAction.impact === '预计亲密增加 · 心情回升（心+6 亲+4 · 心到愉快）'
    && domState.vitalFocusAction.impactHidden === false
    && domState.vitalFocusAction.impactTone === 'positive'
    && domState.vitalFocusAction.impactTitle === '亲密增加 · 心情回升（心+6 亲+4 · 心到愉快）'
    && domState.vitalFocusAction.button === '继续互动'
    && domState.vitalFocusAction.title === '摸摸·试探，差10到熟悉。执行推荐：轻互动。先轻轻互动让它安心，预计亲密增加 · 心情回升（心+6 亲+4 · 心到愉快）。'
    && domState.vitalFocusAction.aria === '摸摸·试探，差10到熟悉。执行推荐：轻互动。先轻轻互动让它安心，预计亲密增加 · 心情回升（心+6 亲+4 · 心到愉快）。'
    && domState.careGuidance.reason === '先轻轻互动让它安心'
    && domState.careGuidance.title === '执行推荐：轻互动。先轻轻互动让它安心，预计亲密增加 · 心情回升（心+6 亲+4 · 心到愉快）。'
    && !domState.careFeedback.reason.includes('亲密偏低')
    && !domState.vitalFocusAction.title.includes('亲密偏低')
    && !domState.careGuidance.title.includes('亲密偏低')
  );
  const avatarKeyboardTouchOk = !scenario.expectAvatarKeyboardTouch || (
    domState.surface === 'home'
    && domState.petClasses.includes('expanded')
    && domState.avatarA11y.role === 'button'
    && domState.avatarA11y.tabIndex === 0
    && domState.avatarA11y.aria.includes('摸摸')
    && domState.avatarA11y.title.includes('Enter')
    && domState.petClasses.includes('action-clean')
    && domState.message === '它犹豫了一下，还是靠近了一点。'
    && domState.careFeedback.reason.includes('关系还在试探')
    && domState.careFeedback.delta === '心+1 亲+3'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'touch'
    && domState.vitalFocusAction.button === '继续互动'
  );
  const pettingGestureOk = !scenario.expectPettingGesture || (
    domState.surface === 'home'
    && domState.petClasses.includes('expanded')
    && domState.petClasses.includes('is-petting')
    && domState.petClasses.includes('action-clean')
    && domState.avatarA11y.aria.includes('轻抚')
    && domState.message === '它犹豫了一下，还是靠近了一点。'
    && domState.careFeedback.reason.includes('关系还在试探')
    && domState.careFeedback.delta === '心+1 亲+3'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'touch'
    && !domState.focusPetCalls.some(call => call.name === 'setWindowPosition')
    && domState.focusPetCalls.some(call => call.name === 'setClickThrough' && call.args[0] === false)
    && domState.focusPetCalls.some(call => call.name === 'setClickThrough' && call.args[0] === true)
  );
  const touchFragileFeedbackOk = !scenario.expectTouchFragileFeedback || (
    domState.surface === 'home'
    && domState.vibe === 'fragile'
    && domState.petClasses.includes('action-rest')
    && domState.spriteBackgroundPosition.endsWith('-1872px')
    && domState.message === '它状态很脆弱，靠过来一下就安静休息。'
    && domState.petStateSummary === '状态有点脆弱，先缓一缓'
    && domState.petCareCue === '先稳住'
    && domState.careFeedback.reason.includes('它现在有点脆弱')
    && domState.careFeedback.delta === '心+1 精+2 亲+1'
    && domState.careFeedback.deltaText === '精力回升 · 差5到低电'
    && domState.careFeedback.deltaDetail === '心+1 精+2 亲+1'
    && domState.careFeedback.aria.includes('本次变化：精力回升 · 差5到低电（心+1 精+2 亲+1）')
    && domState.careFeedback.tone === 'positive'
    && domState.careFeedback.moodLabel === '心情·低落'
    && domState.careFeedback.moodStage === 'low'
    && domState.careFeedback.energyLabel === '精力·疲惫'
    && domState.careFeedback.energyStage === 'tired'
    && domState.careFeedback.bondLabel === '亲密·试探'
    && domState.careFeedback.bondStage === 'new'
    && domState.careFeedback.focus === 'energy'
    && domState.careFeedback.focusSource === 'touch'
    && domState.careFeedback.feedbackFocus === 'energy'
    && domState.careFeedback.feedbackFocusSource === 'touch'
    && domState.careFeedback.focusedRows.energy === 'true'
    && domState.careFeedback.trends.mood === 'up'
    && domState.careFeedback.trends.energy === 'up'
    && domState.careFeedback.trends.bond === 'up'
    && domState.vitalFocusAction.hidden === false
    && domState.vitalFocusAction.vital === 'energy'
    && domState.vitalFocusAction.kind === 'care'
    && domState.vitalFocusAction.action === 'rest'
    && domState.vitalFocusAction.label === '摸摸·疲惫'
    && domState.vitalFocusAction.goal === '差5到低电'
    && domState.vitalFocusAction.goalHidden === false
    && domState.vitalFocusAction.goalTitle === '摸摸·疲惫，差5到低电'
    && domState.vitalFocusAction.reason === '摸摸让它放松一点，先让它休息。'
    && domState.vitalFocusAction.impact === '预计精力回升 · 心情回升（心+4 精+15 亲+2 · 精到低电）'
    && domState.vitalFocusAction.impactHidden === false
    && domState.vitalFocusAction.impactTone === 'positive'
    && domState.vitalFocusAction.impactTitle === '精力回升 · 心情回升（心+4 精+15 亲+2 · 精到低电）'
    && domState.vitalFocusAction.button === '让它休息'
    && domState.vitalFocusAction.title === '摸摸·疲惫，差5到低电。执行推荐：休息。多项状态偏低，预计精力回升 · 心情回升（心+4 精+15 亲+2 · 精到低电）。'
    && domState.vitalFocusAction.aria === '摸摸·疲惫，差5到低电。执行推荐：休息。多项状态偏低，预计精力回升 · 心情回升（心+4 精+15 亲+2 · 精到低电）。'
  );
  const touchRepeatFeedbackOk = !scenario.expectTouchRepeatFeedback || (
    domState.surface === 'home'
    && domState.vibe === 'guarded'
    && domState.petClasses.includes('action-rest')
    && domState.message === '它眨眨眼，先别太频繁戳它。'
    && domState.petStateSummary === '刚回应过摸摸，先缓一缓'
    && domState.petCareCue === '别频繁戳它'
    && domState.careFeedback.reason.includes('刚刚已经回应过你')
    && domState.careFeedback.delta === '亲密先缓缓'
    && domState.careFeedback.deltaText === '亲密先缓缓'
    && domState.careFeedback.tone === 'neutral'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'touch'
    && domState.careFeedback.feedbackFocus === 'bond'
    && domState.careFeedback.feedbackFocusSource === 'touch'
    && domState.careFeedback.focusedRows.bond === 'true'
    && domState.careFeedback.trends.mood === 'flat'
    && domState.careFeedback.trends.energy === 'flat'
    && domState.careFeedback.trends.bond === 'flat'
  );
  const bondMilestoneOk = !scenario.expectBondMilestone || (
    domState.surface === 'home'
    && domState.vibe === 'steady'
    && domState.petStatsDisplay === 'grid'
    && domState.careFeedback.milestone === 'true'
    && domState.careFeedback.recent === '关系更亲近了'
    && !domState.careFeedback.recentHidden
    && domState.careFeedback.reason.startsWith('下一步先照顾亲密，关系已经亲近，继续靠近默契')
    && domState.careFeedback.reasonStyle.whiteSpace === 'normal'
    && domState.careFeedback.reasonStyle.webkitLineClamp === '2'
    && domState.careFeedback.reason.includes('连续陪伴以后')
    && domState.careFeedback.reason.includes('关系更亲近了')
    && !domState.careFeedback.reason.includes('关系亲近，离默契还差18')
    && domState.careFeedback.delta === '心+1 亲+4'
    && domState.careFeedback.tone === 'positive'
    && domState.careFeedback.moodLabel === '心情·愉快'
    && domState.careFeedback.moodStage === 'happy'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·亲近'
    && domState.careFeedback.bondStage === 'close'
    && domState.careFeedback.trends.mood === 'up'
    && domState.careFeedback.trends.energy === 'flat'
    && domState.careFeedback.trends.bond === 'up'
  );
  const chatFeedbackOk = !scenario.expectChatFeedback || (
    domState.surface === 'chat'
    && !domState.chat.hidden
    && domState.contextDisplay === 'none'
    && domState.petStatsDisplay === 'none'
    && domState.message === '内容发出去了，我会留意消息回来。'
    && domState.chat.friendText.includes('搭子')
    && domState.chat.messageCount === 1
    && domState.chat.headerDisplay === 'none'
    && domState.chat.metaCount === 0
    && domState.chat.messagesBackground === 'rgba(245, 245, 247, 0.62)'
    && domState.chat.mineBackground === 'rgb(0, 102, 204)'
    && domState.chat.mineColor === 'rgb(255, 255, 255)'
    && domState.chat.visibleMetaTexts.some(text => text.includes('已发送'))
    && domState.chat.messageTitles.some(title => title.includes('我') && title.includes('已发送'))
    && domState.chat.mediaCount === 1
    && domState.chat.composeDisplay === 'flex'
    && domState.chat.toolsDisplay === 'grid'
    && domState.chat.toolButtons.join('、') === '图片、文件、动图、语音通话、视频通话'
    && domState.careFeedback.reason.startsWith('内容已发出，它在旁边等搭子回复')
    && domState.careFeedback.reason.includes('分享内容')
    && !domState.careFeedback.reason.includes('下一步先照顾')
    && domState.careFeedback.delta === '心+1 精-2 亲+2'
    && domState.careFeedback.tone === 'mixed'
    && domState.careFeedback.moodLabel === '心情·愉快'
    && domState.careFeedback.moodStage === 'happy'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·熟悉'
    && domState.careFeedback.bondStage === 'familiar'
    && domState.careFeedback.trends.mood === 'up'
    && domState.careFeedback.trends.energy === 'down'
    && domState.careFeedback.trends.bond === 'up'
  );
  const chatFileCardFeedbackOk = !scenario.expectChatFileCardFeedback || (
    domState.surface === 'chat'
    && !domState.chat.hidden
    && domState.contextDisplay === 'none'
    && domState.petStatsDisplay === 'none'
    && domState.message === '内容发出去了，我会留意消息回来。'
    && domState.chat.friendText.includes('搭子')
    && domState.chat.messageCount === 1
    && domState.chat.headerDisplay === 'none'
    && domState.chat.metaCount === 0
    && domState.chat.messagesBackground === 'rgba(245, 245, 247, 0.62)'
    && domState.chat.mineBackground === 'rgb(0, 102, 204)'
    && domState.chat.mineColor === 'rgb(255, 255, 255)'
    && domState.chat.visibleMetaTexts.some(text => text.includes('已发送'))
    && domState.chat.messageTitles.some(title => title.includes('我') && title.includes('已发送'))
    && domState.chat.mediaCount === 0
    && domState.chat.fileCardCount === 1
    && domState.chat.fileCardTexts.some(text => text.includes('PDF') && text.includes('focus-plan.pdf') && text.includes('4 B'))
    && domState.chat.fileCardHrefs.some(href => href.includes('/media/qa-media-1') && href.includes('token='))
    && domState.chat.attachmentTypes.includes('file')
    && domState.chat.fileInputAccept.includes('.pdf')
    && domState.chat.fileInputAccept.includes('.zip')
    && domState.chat.composeDisplay === 'flex'
    && domState.chat.toolsDisplay === 'grid'
    && domState.chat.toolButtons.join('、') === '图片、文件、动图、语音通话、视频通话'
    && domState.careFeedback.reason.startsWith('内容已发出，它在旁边等搭子回复')
    && domState.careFeedback.delta === '心+1 精-2 亲+2'
    && domState.careFeedback.tone === 'mixed'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'chat'
  );
  const chatRepeatFeedbackOk = !scenario.expectChatRepeatFeedback || (
    domState.surface === 'chat'
    && !domState.chat.hidden
    && domState.contextDisplay === 'none'
    && domState.petStatsDisplay === 'none'
    && domState.message === '内容发出去了，我会留意消息回来。'
    && domState.chat.friendText.includes('搭子')
    && domState.chat.messageCount >= 1
    && domState.chat.headerDisplay === 'none'
    && domState.chat.metaCount === 0
    && domState.chat.messagesBackground === 'rgba(245, 245, 247, 0.62)'
    && domState.chat.mineBackground === 'rgb(0, 102, 204)'
    && domState.chat.mineColor === 'rgb(255, 255, 255)'
    && domState.chat.visibleMetaTexts.some(text => text.includes('已发送'))
    && domState.chat.messageTitles.every(title => title)
    && domState.chat.mediaCount >= 1
    && domState.chat.composeDisplay === 'flex'
    && domState.chat.toolsDisplay === 'grid'
    && domState.chat.toolButtons.join('、') === '图片、文件、动图、语音通话、视频通话'
    && domState.careFeedback.reason.includes('内容刚刚同步过')
    && domState.careFeedback.delta === '状态稳定'
    && domState.careFeedback.tone === 'neutral'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'chat'
    && domState.careFeedback.feedbackFocus === 'bond'
    && domState.careFeedback.feedbackFocusSource === 'chat'
    && domState.careFeedback.focusedRows.bond === 'true'
    && domState.careFeedback.trends.mood === 'flat'
    && domState.careFeedback.trends.energy === 'flat'
    && domState.careFeedback.trends.bond === 'flat'
  );
  const chatCallFeedbackOk = !scenario.expectChatCallFeedback || (
    domState.surface === 'chat'
    && !domState.chat.hidden
    && domState.chat.headerDisplay === 'none'
    && domState.chat.composeDisplay === 'flex'
    && domState.chat.toolsDisplay === 'grid'
    && domState.chat.toolButtons.join('、') === '图片、文件、动图、语音通话、视频通话'
    && domState.chat.callStageHidden === false
    && domState.chat.callStageDisplay === 'grid'
    && domState.chat.callStatusHidden === false
    && domState.chat.callStatus === '视频通话邀请已发出'
    && domState.chat.callButtons.join('、') === '挂断'
    && domState.chat.visibleCallButtons.join('、') === '挂断'
    && domState.chat.systemTexts.some(text => text.includes('视频通话邀请已发出'))
    && !domState.chat.emptyText
    && domState.petClasses.includes('action-call')
    && domState.spriteBackgroundPosition.endsWith('-6032px')
    && domState.message === '视频通话邀请已发出，我会陪你守住这次联系。'
    && domState.petStateSummary === '正在守着这次联系'
    && domState.petCareCue === '守着联系'
    && domState.careFeedback.reason.startsWith('视频邀请发出，它陪你守着这次联系')
    && domState.careFeedback.reason.includes('视频通话更贴近好友')
    && !domState.careFeedback.reason.includes('下一步先照顾')
    && domState.careFeedback.source === '聊天·语音视频'
    && domState.careFeedback.sourceData === 'chat'
    && domState.careFeedback.sourceDetail === '语音视频'
    && domState.careFeedback.delta === '心+2 精-3 亲+3'
    && domState.careFeedback.deltaText === '亲密增加'
    && domState.careFeedback.tone === 'mixed'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'chat'
    && domState.careFeedback.feedbackFocus === 'bond'
    && domState.careFeedback.feedbackFocusSource === 'chat'
    && domState.careFeedback.focusedRows.bond === 'true'
    && domState.careFeedback.trends.mood === 'up'
    && domState.careFeedback.trends.energy === 'down'
    && domState.careFeedback.trends.bond === 'up'
  );
  const chatIncomingCallFeedbackOk = !scenario.expectChatIncomingCallFeedback || (
    domState.surface === 'chat'
    && !domState.chat.hidden
    && domState.chat.headerDisplay === 'none'
    && domState.chat.composeDisplay === 'flex'
    && domState.chat.toolsDisplay === 'grid'
    && domState.chat.callStatusHidden === false
    && domState.chat.callStatus === '继续前确认 WebRTC 网络提示'
    && domState.chat.rtcNoticeHidden === false
    && domState.chat.rtcNoticeDisplay === 'grid'
    && domState.chat.rtcNoticeText.includes('WebRTC 通话可能向通话对方暴露网络地址')
    && domState.chat.rtcNoticeText.includes('继续通话')
    && domState.chat.rtcNoticeText.includes('取消')
    && !domState.chat.emptyText
    && !domState.realtimeCalls.some(call => call.type === 'call-answer')
    && domState.message === 'WebRTC 通话可能向通话对方暴露网络地址；仅与可信联系人通话。'
  );
  const chatPeerActivityFeedbackOk = !scenario.expectChatPeerActivityFeedback || (
    domState.surface === 'chat'
    && !domState.chat.hidden
    && domState.chat.headerDisplay === 'none'
    && domState.chat.composeDisplay === 'flex'
    && domState.chat.toolsDisplay === 'grid'
    && domState.chat.activityHidden === false
    && domState.chat.activityDisplay === 'grid'
    && domState.chat.activityTitle === '搭子 · 专注中'
    && domState.chat.activityText === '搭子正在专注推进任务'
    && domState.chat.activityMeta.includes('88%')
    && domState.chat.activityMeta === '刚刚同步 · 88%'
    && !domState.chat.activityMeta.includes('任务：')
    && !domState.chat.activityMeta.includes('App：')
    && domState.chat.activityLogText.includes('正在推进 Focus Pet 复盘')
    && domState.chat.emptyText.includes('还没有消息')
    && domState.chat.messagesBackground === 'rgba(245, 245, 247, 0.62)'
    && domState.chat.toolButtons.join('、') === '图片、文件、动图、语音通话、视频通话'
    && domState.petClasses.includes('action-study')
    && domState.message === '搭子同步了屏幕状态，我会帮你留意对方节奏。'
    && domState.petStateSummary === '在旁边守着消息'
    && domState.petCareCue === '一起学习'
    && domState.careFeedback.reason.startsWith('搭子同步了屏幕状态，它在旁边帮你留意')
    && domState.careFeedback.reason.includes('看到好友同步的屏幕状态')
    && !domState.careFeedback.reason.includes('下一步先照顾')
    && domState.careFeedback.source === '聊天·屏幕同步'
    && domState.careFeedback.sourceData === 'chat'
    && domState.careFeedback.sourceDetail === '屏幕同步'
    && domState.careFeedback.delta === '心+1 精-1 亲+2'
    && domState.careFeedback.deltaText === '亲密增加 · 差8到亲近'
    && domState.careFeedback.aria.includes('本次变化：亲密增加 · 差8到亲近（心+1 精-1 亲+2）')
    && domState.careFeedback.tone === 'mixed'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'chat'
    && domState.careFeedback.focusedRows.bond === 'true'
    && domState.careFeedback.trends.mood === 'up'
    && domState.careFeedback.trends.energy === 'down'
    && domState.careFeedback.trends.bond === 'up'
  );
  const reviewFeedbackOk = !scenario.expectReviewFeedback || (
    domState.surface === 'review'
    && !domState.review.hidden
    && domState.contextDisplay === 'none'
    && domState.review.summary.includes('专注节奏不错')
    && domState.review.summary.includes('已同步状态')
    && domState.review.tone === 'focused'
    && domState.spriteBackgroundPosition.endsWith('-3952px')
    && domState.message === '专注节奏不错，我会按今天的节奏调整陪伴。'
    && domState.petStateSummary === '正在复盘今天节奏'
    && domState.petCareCue === '看今日复盘'
    && domState.review.rows.some(row => row.includes('采样') && row.includes('12 次'))
    && domState.review.rows.some(row => row.includes('工作/学习') && row.includes('68 分钟'))
    && domState.review.rows.some(row => row.includes('疑似分心') && row.includes('12 分钟'))
    && domState.review.rows.some(row => row.includes('常用 App') && row.includes('Code×7、Safari×3'))
    && domState.review.rows.length === 5
    && domState.review.nextAction.text === '节奏不错，挑下一件小任务继续。'
    && domState.review.nextAction.reason === '专注节奏不错'
    && domState.review.nextAction.button === '看任务'
    && domState.review.nextAction.action === 'tasks'
    && domState.review.nextAction.kind === 'surface'
    && domState.review.nextAction.title === '打开今日任务'
    && domState.review.nextAction.display === 'grid'
    && domState.review.scrollHeight <= domState.review.clientHeight + 1
    && domState.review.lastRowRect?.bottom <= domState.task.actionsRect.top - 4
    && domState.careFeedback.reason.includes('今天专注时间很稳')
    && domState.careFeedback.delta === '心+4 精-2 亲+3'
    && domState.careFeedback.tone === 'mixed'
    && domState.careFeedback.moodLabel === '心情·愉快'
    && domState.careFeedback.moodStage === 'happy'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·熟悉'
    && domState.careFeedback.bondStage === 'familiar'
    && domState.careFeedback.trends.mood === 'up'
    && domState.careFeedback.trends.energy === 'down'
    && domState.careFeedback.trends.bond === 'up'
  );
  const reviewLlmFeedbackOk = !scenario.expectReviewLlmFeedback || (
    domState.surface === 'review'
    && !domState.review.hidden
    && domState.contextDisplay === 'none'
    && domState.review.summary.includes('StepFun 建议先收束到一个小步骤')
    && domState.review.summary.includes('StepFun')
    && domState.review.tone === 'focused'
    && domState.review.ai.text.includes('StepFun 复盘')
    && domState.review.ai.text.includes('当前任务明确')
    && domState.review.ai.display === 'grid'
    && domState.message === 'StepFun 看完节奏，先推进一小步。'
    && domState.review.rows.some(row => row.includes('采样') && row.includes('12 次'))
    && domState.review.rows.some(row => row.includes('常用 App') && row.includes('Code×7、Safari×3'))
    && domState.review.nextAction.text === '按 StepFun 建议先推进当前任务。'
    && domState.review.nextAction.reason === 'StepFun 复盘'
    && domState.review.nextAction.button === '看任务'
    && domState.review.nextAction.action === 'tasks'
    && domState.review.nextAction.kind === 'surface'
    && domState.review.nextAction.title === '打开今日任务'
    && domState.review.nextAction.display === 'grid'
    && domState.review.scrollHeight <= domState.review.clientHeight + 1
    && domState.review.lastRowRect?.bottom <= domState.task.actionsRect.top - 4
  );
  const reviewRepeatFeedbackOk = !scenario.expectReviewRepeatFeedback || (
    domState.surface === 'review'
    && !domState.review.hidden
    && domState.contextDisplay === 'none'
    && domState.review.summary.includes('专注节奏不错')
    && domState.review.summary.includes('已同步')
    && domState.review.tone === 'focused'
    && domState.message === '专注节奏不错，刚刚已经同步过状态。'
    && domState.petStateSummary === '正在复盘今天节奏'
    && domState.petCareCue === '看今日复盘'
    && domState.careFeedback.reason.includes('今天的复盘刚刚同步过')
    && domState.careFeedback.delta === '状态稳定'
    && domState.careFeedback.tone === 'neutral'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'review'
    && domState.careFeedback.feedbackFocus === 'bond'
    && domState.careFeedback.feedbackFocusSource === 'review'
    && domState.careFeedback.focusedRows.bond === 'true'
    && domState.careFeedback.trends.mood === 'flat'
    && domState.careFeedback.trends.energy === 'flat'
    && domState.careFeedback.trends.bond === 'flat'
  );
  const reviewClearRestActionOk = !scenario.expectReviewClearRestAction || (
    domState.surface === 'review'
    && !domState.review.hidden
    && domState.review.summary.includes('专注节奏不错')
    && domState.review.nextAction.text === '今天收尾了，先休息 5 分钟。'
    && domState.review.nextAction.reason === '清单已清空'
    && domState.review.nextAction.button === '休息'
    && domState.review.nextAction.action === 'rest'
    && domState.review.nextAction.kind === 'care'
    && domState.review.nextAction.title === '执行推荐：休息'
    && domState.review.nextAction.display === 'grid'
    && domState.review.scrollHeight <= domState.review.clientHeight + 1
    && domState.review.lastRowRect?.bottom <= domState.task.actionsRect.top - 4
  );
  const taskSurfaceWatchOk = !scenario.expectTaskSurfaceWatch || (
    domState.surface === 'tasks'
    && domState.vibe === 'focused'
    && domState.contextDisplay === 'none'
    && domState.task.behavior === 'watch'
    && domState.task.activity === 'screen-watch'
    && domState.task.target === '回复用户反馈'
    && domState.petStateSummary === '正在看着当前任务'
    && domState.petCareCue === '盯当前任务'
    && domState.taskProgress === '0/1 完成 · 1 待办'
    && domState.message === '我盯着「回复用户反馈」，先推进一个小步骤。'
    && domState.task.note.includes('正在盯')
    && domState.task.note.includes('回复用户反馈')
    && domState.task.noteReaction === '它会看着屏幕，陪你先推进一小步。'
    && domState.careFeedback.reason.includes('花一点精力')
    && domState.careFeedback.reason.includes('更信任你')
    && domState.careFeedback.source === '任务·盯屏'
    && domState.careFeedback.sourceData === 'tasks'
    && domState.careFeedback.sourceDetail === '盯屏'
    && domState.careFeedback.delta === '心+1 精-1 亲+1'
    && domState.careFeedback.deltaText === '亲密增加'
    && domState.careFeedback.tone === 'mixed'
    && domState.careFeedback.moodLabel === '心情·愉快'
    && domState.careFeedback.moodStage === 'happy'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·熟悉'
    && domState.careFeedback.bondStage === 'familiar'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'tasks'
    && domState.careFeedback.feedbackFocus === 'bond'
    && domState.careFeedback.feedbackFocusSource === 'tasks'
    && domState.careFeedback.focusedRows.bond === 'true'
    && domState.careFeedback.trends.mood === 'up'
    && domState.careFeedback.trends.energy === 'down'
    && domState.careFeedback.trends.bond === 'up'
  );
  const taskFeedbackOk = !scenario.expectTaskFeedback || (
    domState.surface === 'tasks'
    && domState.vibe === 'focused'
    && domState.contextDisplay === 'none'
    && domState.spriteBackgroundPosition.endsWith('-5408px')
    && domState.task.behavior === 'watch'
    && domState.message === '这项完成了，它跟着松了一口气，继续盯着「回复用户反馈」。'
    && domState.petStateSummary === '正在看着当前任务'
    && domState.petCareCue === '盯当前任务'
    && domState.taskProgress === '1/2 完成 · 1 待办'
    && domState.task.note.includes('正在盯')
    && domState.task.note.includes('刚完成')
    && domState.task.note.includes('发版检查清单')
    && domState.task.note.includes('回复用户反馈')
    && domState.task.noteReaction === '它会看着屏幕，陪你先推进一小步。'
    && domState.careFeedback.reason.includes('完成高优先级任务')
    && domState.careFeedback.reason.includes('关系更亲近了')
    && !domState.careFeedback.reason.includes('关系亲近，离默契还差17')
    && domState.careFeedback.delta === '心+7 精-2 亲+4'
    && domState.careFeedback.tone === 'mixed'
    && domState.careFeedback.moodLabel === '心情·愉快'
    && domState.careFeedback.moodStage === 'happy'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·亲近'
    && domState.careFeedback.bondStage === 'close'
    && domState.careFeedback.trends.mood === 'up'
    && domState.careFeedback.trends.energy === 'down'
    && domState.careFeedback.trends.bond === 'up'
  );
  const taskReopenFeedbackOk = !scenario.expectTaskReopenFeedback || (
    domState.surface === 'tasks'
    && domState.vibe === 'focused'
    && domState.contextDisplay === 'none'
    && domState.task.behavior === 'watch'
    && domState.message === '已恢复为待办，它收住节奏，重新盯着「补充验收说明」。'
    && domState.petStateSummary === '正在看着当前任务'
    && domState.petCareCue === '盯当前任务'
    && domState.taskProgress === '1/2 完成 · 1 待办'
    && domState.task.note.includes('正在盯')
    && domState.task.note.includes('重新待办')
    && domState.task.note.includes('补充验收说明')
    && domState.task.noteReaction === '它会看着屏幕，陪你先推进一小步。'
    && domState.careFeedback.reason.includes('任务恢复待办')
    && domState.careFeedback.delta === '心-1'
    && domState.careFeedback.tone === 'negative'
    && domState.careFeedback.moodLabel === '心情·愉快'
    && domState.careFeedback.moodStage === 'happy'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·熟悉'
    && domState.careFeedback.bondStage === 'familiar'
    && domState.careFeedback.trends.mood === 'down'
    && domState.careFeedback.trends.energy === 'flat'
    && domState.careFeedback.trends.bond === 'flat'
  );
  const taskSurfaceRepeatOk = !scenario.expectTaskSurfaceRepeat || (
    domState.surface === 'tasks'
    && domState.vibe === 'focused'
    && domState.contextDisplay === 'none'
    && domState.task.behavior === 'watch'
    && domState.petStateSummary === '正在看着当前任务'
    && domState.petCareCue === '盯当前任务'
    && domState.taskProgress === '0/1 完成 · 1 待办'
    && domState.message.includes('我盯着「回复用户反馈」')
    && domState.task.note.includes('正在盯')
    && domState.task.note.includes('回复用户反馈')
    && domState.task.noteReaction === '它会看着屏幕，陪你先推进一小步。'
    && domState.careFeedback.reason.includes('当前任务刚刚同步过')
    && domState.careFeedback.delta === '状态稳定'
    && domState.careFeedback.tone === 'neutral'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'tasks'
    && domState.careFeedback.feedbackFocus === 'bond'
    && domState.careFeedback.feedbackFocusSource === 'tasks'
    && domState.careFeedback.focusedRows.bond === 'true'
    && domState.careFeedback.trends.mood === 'flat'
    && domState.careFeedback.trends.energy === 'flat'
    && domState.careFeedback.trends.bond === 'flat'
  );
  const taskClearOk = !scenario.expectTaskClear || (
    domState.surface === 'tasks'
    && domState.vibe === 'bright'
    && domState.contextDisplay === 'none'
    && domState.task.load === 'clear'
    && domState.task.behavior === 'clear'
    && domState.task.summaryLoad === 'clear'
    && domState.petStateSummary === '清单清空，适合复盘'
    && domState.petCareCue === '可以复盘'
    && domState.spriteBackgroundPosition.endsWith('-2704px')
    && domState.taskProgress === '2/2 完成 · 0 待办'
    && domState.message === '今天的任务都完成了，我会放松一点，等你复盘。'
    && domState.task.note.includes('已完成')
    && domState.task.note.includes('可以去复盘')
    && domState.task.noteReaction === '清单清空后它会放松，亲密也更稳定。'
    && domState.task.rowCount === 2
    && domState.careFeedback.reason.includes('今天的任务都完成了')
    && domState.careFeedback.delta === '心+3 亲+2'
    && domState.careFeedback.tone === 'positive'
    && domState.careFeedback.moodLabel === '心情·高涨'
    && domState.careFeedback.moodStage === 'bright'
    && domState.careFeedback.energyLabel === '精力·充足'
    && domState.careFeedback.energyStage === 'ready'
    && domState.careFeedback.bondLabel === '亲密·亲近'
    && domState.careFeedback.bondStage === 'close'
    && domState.careFeedback.trends.mood === 'up'
    && domState.careFeedback.trends.energy === 'flat'
    && domState.careFeedback.trends.bond === 'up'
  );
  const taskOverloadOk = !scenario.expectTaskOverload || (
    domState.surface === 'tasks'
    && domState.vibe === 'focused'
    && domState.contextDisplay === 'none'
    && domState.petClasses.includes('task-watch')
    && domState.task.load === 'overload'
    && domState.task.behavior === 'overload'
    && domState.task.activity === 'screen-watch'
    && domState.task.target === '高优先级屏幕检查'
    && domState.task.summaryLoad === 'overload'
    && domState.task.composerDisplay === 'none'
    && domState.petStateSummary === '待办超限，紧盯第一项'
    && domState.petCareCue === '先减负'
    && domState.careGuidance.reason === '待办超限'
    && String(domState.careGuidance.detail || '').includes('待办 10/8')
    && String(domState.careGuidance.detail || '').includes('心情会紧张')
    && String(domState.careGuidance.detail || '').includes('精力也会被消耗')
    && String(domState.careGuidance.detail || '').includes('亲密会因陪伴守住第一项而增加')
    && domState.careGuidance.detailTitle === domState.careGuidance.detail
    && domState.careGuidance.detailAria === `照顾理由：${domState.careGuidance.detail}`
    && domState.careFeedback.role === 'status'
    && domState.careFeedback.live === 'polite'
    && domState.careFeedback.aria.startsWith('状态反馈：待办超限，先守住「高优先级屏幕检查」')
    && domState.careFeedback.aria.includes('来源：任务·超限')
    && domState.careFeedback.aria.includes('最近：qa task overload')
    && domState.careFeedback.aria.includes('最近：任务同步')
    && domState.careFeedback.title === domState.careFeedback.aria
    && domState.careFeedback.reason.startsWith('待办超限，先守住「高优先级屏幕检查」')
    && domState.careFeedback.reason.includes('最近：qa task overload')
    && domState.careFeedback.source === '任务·超限'
    && domState.careFeedback.sourceHidden === false
    && domState.careFeedback.sourceTitle === '状态来源：任务 · 待办超限'
    && domState.careFeedback.sourceData === 'tasks'
    && domState.careFeedback.sourceDetail === '超限'
    && domState.careFeedback.recent === '任务同步'
    && domState.spriteBackgroundPosition.endsWith('-5408px')
    && domState.taskProgress === '1/11 完成 · 10 待办 · 超出 2'
    && domState.homeCare.focusMeta === '待办 10/8'
    && domState.homeCare.focusTaskLoad === 'overload'
    && domState.homeCare.focusOverflow === '2'
    && domState.homeCare.focusTitle.includes('超出 2 个')
    && domState.homeCare.focusAria.includes('看着屏幕')
    && domState.message.includes('待办超过 8 个')
    && domState.task.note.includes('待办 10/8')
    && domState.task.note.includes('高优先级屏幕检查')
    && domState.task.note.includes('收起 7')
    && domState.task.noteReaction === '屏幕太满会让它紧张，先减掉多余待办。'
    && domState.task.currentText === '高优先级屏幕检查'
    && domState.task.rowCount === 4
    && domState.task.overflowNote.includes('收起 7')
    && domState.task.overflowNote.includes('还有 6 个待办已折叠')
    && domState.task.overflowNote.includes('超出建议 2 个')
    && domState.avatarA11y.aria.includes('看着屏幕')
    && domState.avatarA11y.aria.includes('待办超限')
    && domState.avatarA11y.title.includes('看着屏幕')
    && domState.task.gaze.lookX === '9px'
    && domState.task.gaze.lookY === '-4px'
    && domState.task.gaze.animationName === 'gaze-scan'
    && domState.task.listRect.bottom <= domState.task.actionsRect.top - 4
  );
  const taskDeleteReliefOk = !scenario.expectTaskDeleteRelief || (
    domState.surface === 'tasks'
    && domState.vibe === 'focused'
    && domState.contextDisplay === 'none'
    && domState.petClasses.includes('task-watch')
    && domState.petClasses.includes('action-clean')
    && domState.task.load === 'busy'
    && domState.task.behavior === 'busy'
    && domState.task.activity === 'screen-watch'
    && domState.task.target === '高优先级屏幕检查'
    && domState.task.summaryLoad === 'busy'
    && domState.task.rowCount === 8
    && domState.task.currentText === '高优先级屏幕检查'
    && domState.taskProgress === '0/8 完成 · 8 待办'
    && domState.message === '任务已删除，任务偏多，我盯着「高优先级屏幕检查」先推进一步。'
    && domState.petStateSummary === '任务偏多，守住第一项'
    && domState.petCareCue === '先做第一项'
    && domState.task.note.includes('正在盯')
    && domState.task.note.includes('高优先级屏幕检查')
    && domState.task.noteReaction === '任务有点多，它会收住精力只盯第一项。'
    && domState.careFeedback.reason.startsWith('任务减负后')
    && domState.careFeedback.reason.includes('看着屏幕')
    && domState.careFeedback.source === '任务·偏多'
    && domState.careFeedback.sourceData === 'tasks'
    && domState.careFeedback.sourceDetail === '偏多'
    && domState.careFeedback.recent === '任务同步'
    && domState.careFeedback.delta === '心+2 精+1 亲+1'
    && domState.careFeedback.deltaText === '精力回升'
    && domState.careFeedback.tone === 'positive'
    && domState.careFeedback.focus === 'energy'
    && domState.careFeedback.focusSource === 'tasks'
    && domState.careFeedback.focusedRows.energy === 'true'
    && domState.careFeedback.trends.mood === 'up'
    && domState.careFeedback.trends.energy === 'up'
    && domState.careFeedback.trends.bond === 'up'
    && domState.avatarA11y.aria.includes('看着屏幕')
    && domState.avatarA11y.aria.includes('任务偏多')
  );
  const taskRowsDontOverlap = domState.task.rows.every((row, index, rows) => (
    index === 0 || row.rect.top >= rows[index - 1].rect.bottom + 4
  ));
  const taskRowControlsInside = domState.task.rows.every(row => (
    (!row.titleRect || (
      row.titleRect.left >= row.rect.left - 1
      && row.titleRect.right <= row.rect.right + 1
      && row.titleRect.top >= row.rect.top - 1
      && row.titleRect.bottom <= row.rect.bottom + 1
    ))
    && (!row.metaRect || row.metaRect.width === 0 || (
      row.metaRect.left >= row.rect.left - 1
      && row.metaRect.right <= row.rect.right + 1
      && row.metaRect.top >= row.rect.top - 1
      && row.metaRect.bottom <= row.rect.bottom + 1
    ))
    && (!row.actionsRect || (
      row.actionsRect.left >= row.rect.left - 1
      && row.actionsRect.right <= row.rect.right + 1
      && row.actionsRect.top >= row.rect.top - 1
      && row.actionsRect.bottom <= row.rect.bottom + 1
    ))
  ));
  const [taskComposerText, taskComposerPriority, taskComposerThird, taskComposerFourth, taskComposerFifth] = domState.task.composerItems;
  const taskComposerLegacyQuickAddLayout = domState.task.composerItems.length === 4 && (
    taskComposerText.width >= 220
    && taskComposerFourth.width <= 70
    && Math.abs(taskComposerText.top - taskComposerFourth.top) <= 1
    && Math.abs(taskComposerText.bottom - taskComposerFourth.bottom) <= 1
    && taskComposerPriority.top >= taskComposerText.bottom + 3
    && Math.abs(taskComposerPriority.top - taskComposerThird.top) <= 1
    && Math.abs(taskComposerPriority.bottom - taskComposerThird.bottom) <= 1
    && taskComposerThird.width >= 190
  );
  const taskComposerSceneTemplateLayout = domState.task.composerItems.length >= 5 && (
    taskComposerText.width >= 180
    && taskComposerFifth.width >= 96
    && taskComposerFifth.width <= 150
    && Math.abs(taskComposerText.top - taskComposerFifth.top) <= 1
    && Math.abs(taskComposerText.bottom - taskComposerFifth.bottom) <= 1
    && taskComposerPriority.width >= 50
    && taskComposerThird.width >= 110
    && taskComposerFourth.width >= 110
    && taskComposerPriority.top >= taskComposerText.bottom + 3
    && Math.abs(taskComposerPriority.top - taskComposerThird.top) <= 1
    && Math.abs(taskComposerPriority.top - taskComposerFourth.top) <= 1
    && Math.abs(taskComposerPriority.bottom - taskComposerThird.bottom) <= 1
    && Math.abs(taskComposerPriority.bottom - taskComposerFourth.bottom) <= 1
    && domState.task.composerRect.height <= 76
  );
  const taskComposerQuickAddLayout = taskComposerLegacyQuickAddLayout || taskComposerSceneTemplateLayout;
  const taskLastRowAboveActions = domState.task.rows.length === 0 || (
    domState.task.rows.at(-1).rect.bottom <= domState.task.actionsRect.top - 8
  );
  const currentTaskRow = domState.task.rows.find(row => row.current);
  const taskActionColumnCompact = domState.task.rows.every(row => !row.actionsRect || row.actionsRect.width <= 72);
  const currentTaskTitleReadable = !currentTaskRow?.titleRect || currentTaskRow.titleRect.width >= 215;
  const currentTaskCardBalanced = !currentTaskRow?.rect || (
    currentTaskRow.rect.height >= 64
    && currentTaskRow.rect.height <= 74
  );
  const taskLayoutDensityOk = !scenario.expectTaskLayoutDensity || (
    domState.surface === 'tasks'
    && domState.task.rowCount === 3
    && domState.task.currentText === '电商系统：推进一个可验证的小步骤'
    && taskComposerQuickAddLayout
    && taskRowsDontOverlap
    && taskRowControlsInside
    && taskLastRowAboveActions
    && taskActionColumnCompact
    && currentTaskTitleReadable
    && currentTaskCardBalanced
  );
  const taskAddCall = domState.focusPetCalls.find(call => call.name === 'addTask');
  const taskUpdateCall = domState.focusPetCalls.find(call => call.name === 'updateTask');
  const taskPriorityFocusOk = !scenario.expectTaskPriorityFocus || (
    domState.surface === 'tasks'
    && domState.vibe === 'focused'
    && taskUpdateCall
    && taskUpdateCall.args[0] === 'qa-priority-1'
    && taskUpdateCall.args[1].priority === 'high'
    && domState.petClasses.includes('task-watch')
    && domState.petClasses.includes('action-study')
    && domState.task.load === 'normal'
    && domState.task.behavior === 'watch'
    && domState.task.activity === 'screen-watch'
    && domState.task.currentText === '整理窗口状态反馈'
    && domState.taskProgress === '0/2 完成 · 2 待办'
    && domState.message === '优先级已设为高，我盯着「整理窗口状态反馈」，先推进一个小步骤。'
    && domState.petStateSummary === '正在看着当前任务'
    && domState.petCareCue === '盯当前任务'
    && domState.careFeedback.reason.startsWith('任务优先级更清楚')
    && domState.careFeedback.source === '任务·盯屏'
    && domState.careFeedback.sourceData === 'tasks'
    && domState.careFeedback.sourceDetail === '盯屏'
    && domState.careFeedback.delta === '心+1 亲+1'
    && domState.careFeedback.deltaText === '亲密增加 · 差2到亲近'
    && domState.careFeedback.aria.includes('本次变化：亲密增加 · 差2到亲近（心+1 亲+1）')
    && domState.careFeedback.tone === 'positive'
    && domState.careFeedback.focus === 'bond'
    && domState.careFeedback.focusSource === 'tasks'
    && domState.careFeedback.focusedRows.bond === 'true'
    && domState.careFeedback.trends.mood === 'up'
    && domState.careFeedback.trends.bond === 'up'
    && domState.avatarA11y.aria.includes('看着屏幕')
    && domState.avatarA11y.aria.includes('正在陪你推进')
  );
  const taskQuickAddOk = !scenario.expectTaskQuickAdd || (
    domState.surface === 'tasks'
    && domState.vibe === 'focused'
    && taskAddCall
    && taskAddCall.args[0].text === '写验收说明'
    && taskAddCall.args[0].priority === 'high'
    && taskAddCall.args[0].dueDate === '2026-06-24'
    && domState.task.load === 'normal'
    && domState.task.rowCount === 2
    && domState.task.currentText === '写验收说明'
    && domState.task.rows[0]?.current === true
    && domState.task.composerFeedback.text === '已添加：写验收说明'
    && domState.task.composerFeedback.hidden === false
    && domState.task.composerFeedback.tone === 'success'
    && domState.task.composerFeedback.inputValue === ''
    && domState.task.composerFeedback.dueValue === ''
    && domState.task.composerFeedback.invalid === 'false'
    && domState.activeElement.id === 'newTaskText'
    && domState.message.includes('任务已添加')
  );
  const taskLimitGuardOk = !scenario.expectTaskLimitGuard || (
    domState.surface === 'tasks'
    && domState.vibe === 'focused'
    && !taskAddCall
    && domState.petClasses.includes('task-watch')
    && domState.petClasses.includes('action-study')
    && domState.task.load === 'busy'
    && domState.task.behavior === 'busy'
    && domState.task.activity === 'screen-watch'
    && domState.task.target === '高优先级屏幕检查'
    && domState.task.rowCount === 8
    && domState.task.composerFeedback.text === '待办已达 8 个上限，先完成或删除一项。'
    && domState.task.composerFeedback.tone === 'error'
    && domState.task.composerFeedback.invalid === 'true'
    && domState.activeElement.id === 'newTaskText'
    && domState.message === '待办已达 8 个上限，先完成或删除一项。'
    && domState.petStateSummary === '任务偏多，守住第一项'
    && domState.petCareCue === '先做第一项'
    && domState.careFeedback.reason.startsWith('待办已达 8 个上限')
    && domState.careFeedback.reason.includes('看着屏幕')
    && domState.careFeedback.source === '任务·偏多'
    && domState.careFeedback.sourceData === 'tasks'
    && domState.careFeedback.sourceDetail === '偏多'
    && domState.careFeedback.focus === 'energy'
    && domState.careFeedback.focusSource === 'tasks'
    && domState.careFeedback.focusedRows.energy === 'true'
    && domState.avatarA11y.aria.includes('看着屏幕')
    && domState.avatarA11y.aria.includes('任务偏多')
  );
  const interactiveSurface = ['tasks', 'review', 'settings', 'chat'].includes(domState.surface);
  const activeInteractionPanel = domState.surface === 'chat' ? domState.chatPanelRect : domState.panel;
  const activePanelVisible = activeInteractionPanel
    && !activeInteractionPanel.hidden
    && activeInteractionPanel.display !== 'none'
    && activeInteractionPanel.rect.width > 0
    && activeInteractionPanel.rect.height > 0;
  const avatarBesideInteractivePanelOk = !interactiveSurface || !activePanelVisible || (
    rectRangesOverlap(domState.avatarRect.top, domState.avatarRect.bottom, activeInteractionPanel.rect.top, activeInteractionPanel.rect.bottom)
    && (
      domState.avatarRect.left >= activeInteractionPanel.rect.right + 2
      || activeInteractionPanel.rect.left >= domState.avatarRect.right + 2
    )
  );
  const dragMoveIndex = domState.dragCalls.findIndex(call => call.name === 'setWindowPosition');
  const dragTrueBeforeMove = domState.dragCalls.some((call, index) => (
    index < dragMoveIndex
    && call.name === 'setClickThrough'
    && call.args[0] === true
  ));
  const dragTrueAfterMove = domState.dragCalls.some((call, index) => (
    index > dragMoveIndex
    && call.name === 'setClickThrough'
    && call.args[0] === true
  ));
  const taskDragLockOk = !scenario.expectTaskDragLock || (
    domState.surface === 'tasks'
    && domState.petStateSummary === '正在看着当前任务'
    && domState.task.behavior === 'watch'
    && dragMoveIndex >= 0
    && !dragTrueBeforeMove
    && dragTrueAfterMove
    && domState.dragCalls[dragMoveIndex].args[0] === 30
    && domState.dragCalls[dragMoveIndex].args[1] === 22
  );
  const expandedHtmlRects = [
    { visible: true, rect: domState.bubble.rect },
    { visible: !domState.panel.hidden && domState.panel.display !== 'none', rect: domState.panel.rect },
    { visible: !domState.chatPanelRect.hidden && domState.chatPanelRect.display !== 'none', rect: domState.chatPanelRect.rect },
    { visible: !domState.homeCare.actionsHidden, rect: domState.homeCare.rect },
    { visible: !domState.careMenu.hidden, rect: domState.careMenu.rect },
    { visible: domState.petStatsDisplay !== 'none', rect: domState.careMenu.statsRect }
  ];
  const expandedHtmlBesidePetOk = !domState.petClasses.includes('expanded') || expandedHtmlRects.every(item => (
    !item.visible
    || item.rect.width === 0
    || item.rect.left >= 150
  ));
  const feedbackPunctuationOk = !/[。.!！] ·/.test(domState.careFeedback.reason);
  const careMenuContextOk = domState.careMenu.hidden
    || domState.contextDisplay === 'none'
    || domState.contextRect.height === 0
    || domState.contextRect.bottom <= domState.careMenu.rect.top - 4
    || domState.contextRect.top >= domState.careMenu.rect.bottom + 4;
  const checks = {
    spritePath: domState.spriteBackgroundImage.includes('nervy-sci-fi-kid/spritesheet.webp'),
    spriteSize: domState.spriteBackgroundSize === '1536px 6240px',
    avatarWidth: domState.avatarRect.width > 100,
    avatarHeight: domState.avatarRect.height > 100,
    opaquePixels: pixelStats.opaquePixels > 1000,
    coloredPixels: pixelStats.coloredPixels > 500,
    renderErrors: domState.renderErrors.length === 0,
    expandedHtmlBesidePetOk,
    avatarBesideInteractivePanelOk,
    vibeOk,
    careFeedbackOk,
    energyDropWarningOk,
    homeActionsOk,
    homeStudyEnergyTradeoffOk,
    homeWorkEnergyDropPreviewOk,
    vitalInsightReadyEnergyTaskRiskOk,
    vitalInsightFullEnergyTaskOk,
    reviewFeedbackOk,
    reviewLlmFeedbackOk,
    reviewRepeatFeedbackOk,
    reviewClearRestActionOk,
    chatFeedbackOk,
    chatFileCardFeedbackOk,
    chatRepeatFeedbackOk,
    chatCallFeedbackOk,
    chatIncomingCallFeedbackOk,
    chatPeerActivityFeedbackOk,
    careMenuOk,
    careMenuLowMoodOk,
    careMenuLowBondOk,
    careMenuFamiliarBondPriorityOk,
    careMenuEscapeCloseOk,
    compoundFragileOk,
    careMenuInsightOk,
    compoundRestFollowupOk,
    idleCareNudgeOk,
    idleBondNudgeOk,
    careGuidanceShortcutOk,
    vitalChipEnergyShortcutOk,
    vitalInsightLowEnergyFeedOk,
    vitalInsightReadyEnergyFeedOk,
    vitalInsightMoodOk,
    vitalInsightSteadyMoodPlayOk,
    vitalInsightHappyMoodPlayOk,
    vitalInsightBrightMoodCalmOk,
    vitalInsightHappyMoodTaskOk,
    vitalInsightBondFollowupOk,
    vitalInsightNewBondReassureOk,
    vitalInsightCloseBondCalmOk,
    vitalInsightCloseBondTaskOk,
    vitalInsightTrustedBondCompanionOk,
    vitalInsightTrustedBondTaskOk,
    vitalInsightBondMenuOk,
    vitalInsightRepeatOk,
    careGuardFeedbackOk,
    careGuardRepeatFeedbackOk,
    careMenuCooldownObservationOk,
    careCooldownActionGuardOk,
    careRepeatFeedbackOk,
    careMoodGuardFeedbackOk,
    careBondSoftGuardFeedbackOk,
    feedFeedbackOk,
    offlineRestFeedbackOk,
    settingsFeedbackOk,
    settingsRepeatFeedbackOk,
    settingsOpenFeedbackOk,
    onboardingGuideOk,
    settingsLlmSelfCheckOk,
    bondMilestoneOk,
    taskSurfaceWatchOk,
    taskFeedbackOk,
    taskReopenFeedbackOk,
    taskSurfaceRepeatOk,
    touchFeedbackOk,
    avatarKeyboardTouchOk,
    pettingGestureOk,
    touchFragileFeedbackOk,
    touchRepeatFeedbackOk,
    taskClearOk,
    taskOverloadOk,
    taskDeleteReliefOk,
    taskLayoutDensityOk,
    taskPriorityFocusOk,
    taskQuickAddOk,
    taskLimitGuardOk,
    taskDragLockOk,
    feedbackPunctuationOk,
    careMenuContextOk
  };
  const ok = Object.values(checks).every(Boolean);

  const summary = {
    name: scenario.name,
    ok,
    screenshotPath,
    checks,
    domState,
    pixelStats,
    renderErrors: domState.renderErrors
  };

  return summary;
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(preloadPath, preloadSource, 'utf8');
  if (!activeScenarios.length) {
    throw new Error(`Unknown render scenario: ${scenarioFilter}`);
  }

  let browserWindow;
  try {
    browserWindow = new BrowserWindow({
      ...scenarios[0].windowSize,
      show: false,
      transparent: true,
      frame: false,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    const scenarioResults = [];
    for (const scenario of activeScenarios) {
      scenarioResults.push(await verifyScenario(browserWindow, scenario, { reload: true }));
    }

    const summary = {
      ok: scenarioResults.every(result => result.ok),
      scenarios: scenarioResults
    };
    fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    const consoleSummary = {
      ok: summary.ok,
      summaryPath,
      scenarios: scenarioResults.map(result => ({
        name: result.name,
        ok: result.ok,
        failedChecks: Object.entries(result.checks)
          .filter(([, value]) => !value)
          .map(([key]) => key),
        screenshotPath: result.screenshotPath
      }))
    };

    if (!summary.ok) {
      fs.writeSync(process.stderr.fd, `${JSON.stringify(consoleSummary, null, 2)}\n`);
      exitCode = 1;
    } else {
      fs.writeSync(process.stdout.fd, `${JSON.stringify(consoleSummary, null, 2)}\n`);
    }
  } finally {
    await destroyBrowserWindow(browserWindow);
  }
}

app.commandLine.appendSwitch('disable-gpu');
app.whenReady()
  .then(main)
  .catch(error => {
    fs.writeSync(process.stderr.fd, `${error?.stack || error}\n`);
    exitCode = 1;
  })
  .finally(() => {
    try { fs.rmSync(preloadPath, { force: true }); } catch {}
    process.exit(exitCode);
  });
