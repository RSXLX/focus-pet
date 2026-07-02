(function initFocusSceneTemplates(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.focusPetSceneTemplates = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createFocusSceneTemplatesApi() {
  const FOCUS_SCENE_TEMPLATES = [
    {
      id: 'coding',
      label: '写代码',
      appRules: ['Code', 'Cursor', 'Terminal', 'iTerm2', 'WebStorm', 'Xcode', 'GitHub Desktop'],
      keywordRules: ['代码', '编译', '测试', 'bug', 'debug', 'PR', '接口', '组件', 'commit'],
      reminderMinutes: 25,
      petAnimationPreference: 'work',
      reviewMetrics: ['focusedMinutes', 'completedNextActions', 'testRuns', 'contextSwitches'],
      taskDefaults: {
        estimatedMinutes: 50,
        energyLevel: 'high',
        contextTags: ['写代码'],
        nextAction: '打开编辑器，先完成一个最小变更'
      }
    },
    {
      id: 'paper',
      label: '论文',
      appRules: ['Pages', 'Word', 'Microsoft Word', 'Zotero', 'Preview', 'Safari'],
      keywordRules: ['论文', '文献', '引用', '摘要', '写作', '研究', '方法', '参考文献'],
      reminderMinutes: 30,
      petAnimationPreference: 'study',
      reviewMetrics: ['focusedMinutes', 'draftWords', 'referencesReviewed', 'outlineProgress'],
      taskDefaults: {
        estimatedMinutes: 60,
        energyLevel: 'high',
        contextTags: ['论文'],
        nextAction: '打开提纲，先补一段核心论证'
      }
    },
    {
      id: 'exam',
      label: '备考',
      appRules: ['Preview', 'Notion', 'Obsidian', 'Anki', 'Safari'],
      keywordRules: ['备考', '复习', '刷题', '错题', '课程', '知识点', '考试'],
      reminderMinutes: 25,
      petAnimationPreference: 'study',
      reviewMetrics: ['focusedMinutes', 'studyBlocks', 'questionsPracticed', 'wrongAnswersReviewed'],
      taskDefaults: {
        estimatedMinutes: 45,
        energyLevel: 'high',
        contextTags: ['备考'],
        nextAction: '先做一组题或复盘一页错题'
      }
    },
    {
      id: 'meeting',
      label: '会议',
      appRules: ['Zoom', 'TencentMeeting', 'Teams', 'Google Meet', 'Calendar', 'Keynote', 'PowerPoint'],
      keywordRules: ['会议', '纪要', '议题', '同步', '评审', '周会', '需求'],
      reminderMinutes: 45,
      petAnimationPreference: 'work',
      reviewMetrics: ['focusedMinutes', 'decisionsCaptured', 'actionItems', 'meetingMinutes'],
      taskDefaults: {
        estimatedMinutes: 45,
        energyLevel: 'medium',
        contextTags: ['会议'],
        nextAction: '打开会议议程，先确认本轮要产出的结论'
      }
    },
    {
      id: 'reading',
      label: '阅读',
      appRules: ['Preview', 'Books', 'Kindle', 'Safari', 'Chrome', 'Zotero'],
      keywordRules: ['阅读', '读书', '文章', '资料', '笔记', '摘录', '理解'],
      reminderMinutes: 30,
      petAnimationPreference: 'study',
      reviewMetrics: ['focusedMinutes', 'pagesRead', 'notesCaptured', 'keyTakeaways'],
      taskDefaults: {
        estimatedMinutes: 40,
        energyLevel: 'medium',
        contextTags: ['阅读'],
        nextAction: '先读完一个小节并记一句要点'
      }
    },
    {
      id: 'creation',
      label: '创作',
      appRules: ['Figma', 'Photoshop', 'Illustrator', 'Final Cut Pro', 'Blender', 'GarageBand', 'Canva'],
      keywordRules: ['创作', '设计', '草稿', '素材', '剪辑', '排版', '原型', '画面'],
      reminderMinutes: 35,
      petAnimationPreference: 'work',
      reviewMetrics: ['focusedMinutes', 'draftsProduced', 'iterationsCompleted', 'assetsExported'],
      taskDefaults: {
        estimatedMinutes: 50,
        energyLevel: 'medium',
        contextTags: ['创作'],
        nextAction: '先产出一个可看的草稿版本'
      }
    },
    {
      id: 'light-rest',
      label: '轻休息',
      appRules: ['Music', 'Spotify', 'Podcasts', 'Calm', 'Clock'],
      keywordRules: ['休息', '伸展', '散步', '喝水', '冥想', '轻休息', '放松'],
      reminderMinutes: 15,
      petAnimationPreference: 'rest',
      reviewMetrics: ['restMinutes', 'recoveredEnergy', 'returnReadiness'],
      taskDefaults: {
        priority: 'low',
        estimatedMinutes: 15,
        energyLevel: 'low',
        contextTags: ['轻休息'],
        nextAction: '离开屏幕做一个 5 分钟恢复动作'
      }
    }
  ];

  const TEMPLATE_BY_ID = new Map(FOCUS_SCENE_TEMPLATES.map(template => [template.id, template]));

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function textValue(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function listValue(value) {
    return Array.isArray(value) ? value : String(value || '').split(/[\n,，]/);
  }

  function uniqueList(...lists) {
    const seen = new Set();
    const result = [];
    for (const list of lists) {
      for (const raw of listValue(list)) {
        const item = textValue(raw);
        const key = item.toLowerCase();
        if (!item || seen.has(key)) continue;
        seen.add(key);
        result.push(item);
      }
    }
    return result;
  }

  function getFocusSceneTemplates() {
    return FOCUS_SCENE_TEMPLATES.map(clone);
  }

  function findFocusSceneTemplate(id) {
    const key = textValue(id);
    return TEMPLATE_BY_ID.has(key) ? clone(TEMPLATE_BY_ID.get(key)) : null;
  }

  function applyFocusSceneTemplate(input = {}, templateId = '') {
    const template = TEMPLATE_BY_ID.get(textValue(templateId));
    if (!template) return { ...input };

    const taskDefaults = template.taskDefaults || {};
    const task = {
      ...taskDefaults,
      ...input,
      focusSceneTemplate: template.id,
      focusSceneLabel: template.label,
      reminderMinutes: template.reminderMinutes,
      petAnimationPreference: template.petAnimationPreference
    };

    task.contextTags = uniqueList(input.contextTags, taskDefaults.contextTags, [template.label]);
    task.relatedApps = uniqueList(input.relatedApps, template.appRules);
    task.relatedKeywords = uniqueList(input.relatedKeywords, template.keywordRules);
    task.reviewMetrics = uniqueList(input.reviewMetrics, template.reviewMetrics);
    task.nextAction = textValue(input.nextAction) || textValue(taskDefaults.nextAction);

    return task;
  }

  return {
    FOCUS_SCENE_TEMPLATES: getFocusSceneTemplates(),
    applyFocusSceneTemplate,
    findFocusSceneTemplate,
    getFocusSceneTemplates
  };
});
