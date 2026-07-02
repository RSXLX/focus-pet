const CJK_RE = /[\u3400-\u9fff]/;

function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\u3400-\u9fff]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsAny(text, keywords = []) {
  const normalized = normalizeText(text);
  return keywords.find(keyword => {
    const clean = normalizeText(keyword);
    return clean && normalized.includes(clean);
  });
}

function taskTerms(taskText) {
  const normalized = normalizeText(taskText);
  const terms = new Set();
  for (const part of normalized.split(' ')) {
    if (part.length >= 3 && !CJK_RE.test(part)) terms.add(part);
    if (CJK_RE.test(part)) {
      if (part.length >= 2) terms.add(part);
      for (let index = 0; index < part.length - 1; index += 1) {
        terms.add(part.slice(index, index + 2));
      }
      for (let index = 0; index < part.length - 2; index += 1) {
        terms.add(part.slice(index, index + 3));
      }
    }
  }
  return [...terms].filter(term => !['今天', '任务', '一下', '一个', '完成', '整理'].includes(term));
}

function matchCurrentTask(app, title, currentTask) {
  if (!currentTask?.text) return null;
  const text = normalizeText(`${app} ${title}`);
  const matched = taskTerms(currentTask.text).filter(term => text.includes(term));
  if (matched.length === 0) return null;
  return {
    task: currentTask,
    matched: [...new Set(matched)].slice(0, 4)
  };
}

function matchApp(app, apps = []) {
  return (apps || []).find(candidate => String(candidate).toLowerCase() === String(app).toLowerCase());
}

function matchTaskDeclaredContext(app, title, currentTask) {
  if (!currentTask) return null;
  const sceneLabel = String(currentTask.focusSceneLabel || '').trim();
  const relatedApp = matchApp(app, currentTask.relatedApps);
  if (relatedApp) {
    return {
      kind: 'app',
      matched: [relatedApp],
      sceneLabel
    };
  }
  const keyword = containsAny(`${app} ${title}`, currentTask.relatedKeywords);
  if (keyword) {
    return {
      kind: 'keyword',
      matched: [keyword],
      sceneLabel
    };
  }
  return null;
}

function classifySpecializedActivity(text, settings = {}) {
  const study = containsAny(text, settings.studyKeywords);
  if (study) return { status: 'study', reason: `命中学习关键词：${study}` };

  const game = containsAny(text, settings.gameKeywords);
  if (game) return { status: 'game', reason: `命中游戏关键词：${game}` };

  return null;
}

function classifyActivity({ app = '', title = '', settings = {}, currentTask = null }) {
  const haystack = `${app} ${title}`;
  const gameApp = matchApp(app, settings.gameApps);
  if (gameApp) return { status: 'game', reason: `游戏 App：${gameApp}` };

  const distraction = containsAny(haystack, settings.distractionKeywords);
  if (distraction) {
    return { status: 'distracted', reason: `命中分心关键词：${distraction}` };
  }

  const specialized = classifySpecializedActivity(haystack, settings);
  if (specialized) return specialized;

  const taskMatch = matchCurrentTask(app, title, currentTask);
  if (taskMatch) {
    const taskActivity = classifySpecializedActivity(taskMatch.task.text, settings);
    if (taskActivity?.status === 'study') {
      return {
        status: 'study',
        reason: `匹配当前学习任务：${taskMatch.task.text}（${taskMatch.matched.join('、')}）`
      };
    }
    if (taskActivity?.status === 'game') {
      return {
        status: 'game',
        reason: `匹配当前游戏任务：${taskMatch.task.text}（${taskMatch.matched.join('、')}）`
      };
    }
    return {
      status: 'work',
      reason: `匹配当前任务：${taskMatch.task.text}（${taskMatch.matched.join('、')}）`
    };
  }

  const declaredTaskContext = matchTaskDeclaredContext(app, title, currentTask);
  if (declaredTaskContext) {
    const contextSource = declaredTaskContext.sceneLabel
      ? `${declaredTaskContext.sceneLabel}场景相关`
      : '任务相关';
    return {
      status: 'work',
      reason: `匹配${contextSource}${declaredTaskContext.kind === 'app' ? ' App' : '关键词'}：${declaredTaskContext.matched.join('、')}`
    };
  }

  const appMatch = matchApp(app, settings.workApps);
  if (appMatch) return { status: 'work', reason: `工作/学习 App：${appMatch}` };

  const focusKeyword = containsAny(haystack, settings.focusKeywords);
  if (focusKeyword) return { status: 'work', reason: `命中工作关键词：${focusKeyword}` };

  if (currentTask?.text) return { status: 'unknown', reason: `未匹配当前任务：${currentTask.text}` };
  return { status: 'unknown', reason: '无法确定是否与当前目标相关' };
}

module.exports = {
  classifyActivity,
  matchCurrentTask,
  matchTaskDeclaredContext,
  taskTerms,
  normalizeText
};
