const DEFAULT_REVIEW_LLM_ENDPOINT = 'https://api.stepfun.com/step_plan/v1';
const DEFAULT_REVIEW_LLM_MODEL = 'step-3.7-flash';
const REVIEW_TONES = new Set(['focused', 'balanced', 'distracted', 'quiet']);
const CARE_ACTIONS = new Set(['rest', 'play', 'feed', 'clean', 'study', 'work']);
const {
  authHeaders,
  endpointAllowedByCloudMode,
  normalizeChatEndpoint,
  providerSummary
} = require('./llm-provider');

function cleanText(value, maxLength = 160) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function reviewNumber(review, key) {
  return Math.max(0, Math.round(Number(review?.[key]) || 0));
}

function confidencePercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number * 100)));
}

function normalizeReviewEndpoint(value) {
  return normalizeChatEndpoint(value, { provider: 'openai-compatible' });
}

function reviewLlmConfig(settings = {}, env = process.env) {
  const enabled = settings.reviewLlmEnabled !== false;
  const cloudMode = settings.llmCloudMode || env.FOCUS_PET_REVIEW_LLM_CLOUD_MODE || env.FOCUS_PET_LLM_CLOUD_MODE || 'allowed';
  const provider = settings.reviewLlmProvider || env.FOCUS_PET_REVIEW_LLM_PROVIDER || env.FOCUS_PET_LLM_PROVIDER || 'openai-compatible';
  const endpoint = normalizeChatEndpoint(
    settings.reviewLlmEndpoint
    || env.FOCUS_PET_REVIEW_LLM_ENDPOINT
    || env.FOCUS_PET_STEPFUN_ENDPOINT
    || DEFAULT_REVIEW_LLM_ENDPOINT,
    { provider }
  );
  const model = cleanText(
    settings.reviewLlmModel
    || env.FOCUS_PET_REVIEW_LLM_MODEL
    || env.FOCUS_PET_STEPFUN_MODEL
    || DEFAULT_REVIEW_LLM_MODEL,
    120
  ) || DEFAULT_REVIEW_LLM_MODEL;
  const apiKey = String(
    env.FOCUS_PET_REVIEW_LLM_API_KEY
    || env.FOCUS_PET_STEPFUN_API_KEY
    || env.STEPFUN_API_KEY
    || env.STEP_API_KEY
    || ''
  ).trim();
  const summary = providerSummary({ provider, endpoint, cloudMode });
  const missing = [];
  if (!endpoint) missing.push('endpoint');
  if (!model) missing.push('model');
  if (endpoint && !endpointAllowedByCloudMode(endpoint, cloudMode)) missing.push('localEndpoint');
  if (summary.apiKeyRequired && !apiKey) missing.push('apiKey');
  return {
    ...summary,
    enabled,
    endpoint,
    model,
    apiKey,
    configured: enabled && missing.length === 0,
    missing
  };
}

function topAppsText(review = {}) {
  const apps = Array.isArray(review.topApps) ? review.topApps : [];
  return apps
    .filter(item => Array.isArray(item) && item[0])
    .slice(0, 6)
    .map(([app, count]) => `${cleanText(app, 40)}×${Math.max(0, Math.round(Number(count) || 0))}`)
    .join('、') || '暂无';
}

function taskSummary(tasks = [], currentTask = null) {
  const rows = Array.isArray(tasks) ? tasks : [];
  const doneCount = rows.filter(task => task?.done).length;
  const pending = rows.filter(task => !task?.done);
  const current = currentTask || pending[0] || null;
  const pendingText = pending
    .slice(0, 6)
    .map(task => {
      const meta = [
        task.priority ? `优先级:${task.priority}` : '',
        task.dueDate ? `截止:${task.dueDate}` : ''
      ].filter(Boolean).join('，');
      return `- ${cleanText(task.text, 80)}${meta ? `（${meta}）` : ''}`;
    })
    .join('\n') || '暂无待办';
  return {
    total: rows.length,
    done: doneCount,
    pending: pending.length,
    current: current ? cleanText(current.text, 100) : '未设置',
    pendingText
  };
}

function screenAnalysisLines(screenAnalysis = null) {
  if (!screenAnalysis?.ok) return [];
  return [
    '本次屏幕 LLM 分析：',
    `截图时间：${cleanText(screenAnalysis.time, 48) || '未知'}`,
    `截图来源：${cleanText(screenAnalysis.sourceName, 80) || '未知'}`,
    `屏幕状态：${cleanText(screenAnalysis.status, 24) || 'unknown'}`,
    `当前活动：${cleanText(screenAnalysis.activity, 140) || '无法判断'}`,
    `判断依据：${cleanText(screenAnalysis.reason, 180) || '未提供'}`,
    `置信度：${confidencePercent(screenAnalysis.confidence)}%`,
    `下一步建议：${cleanText(screenAnalysis.suggestion, 140) || '回到当前任务的下一小步'}`
  ];
}

function buildReviewPrompt({ review = {}, currentTask = null, tasks = [], screenAnalysis = null } = {}) {
  const summary = taskSummary(tasks, currentTask);
  return [
    '请基于 Focus Pet 最近 24 小时的聚合数据做一次简短复盘。',
    '如果提供本次屏幕 LLM 分析，请把它作为当前状态证据纳入即时复盘。',
    '只输出 JSON，不要输出 Markdown，不要编造没有提供的数据。',
    'JSON 字段：summary、insight、tone、petMessage、nextAction。',
    'tone 只能是 focused、balanced、distracted、quiet。',
    'nextAction 字段：kind、action、label、text、reason、title。',
    'nextAction.kind 只能是 surface 或 care；surface.action 用 tasks；care.action 可用 rest、play、feed、clean、study、work。',
    '复盘口吻要像桌宠在陪伴用户推进当前任务，克制、短句、可执行。',
    `采样次数：${reviewNumber(review, 'samples')}`,
    `工作/学习分钟：${reviewNumber(review, 'workMinutes')}`,
    `疑似分心分钟：${reviewNumber(review, 'distractedMinutes')}`,
    `未知分钟：${reviewNumber(review, 'unknownMinutes')}`,
    `常用 App 汇总：${topAppsText(review)}`,
    `任务总数：${summary.total}`,
    `已完成：${summary.done}`,
    `待办：${summary.pending}`,
    `当前任务：${summary.current}`,
    `待办摘要：\n${summary.pendingText}`,
    ...screenAnalysisLines(screenAnalysis)
  ].join('\n');
}

function extractJsonObject(content) {
  if (content && typeof content === 'object') return content;
  const text = String(content || '').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]);
  } catch {
    return {};
  }
}

function fallbackTone(review = {}) {
  const workMinutes = reviewNumber(review, 'workMinutes');
  const distractedMinutes = reviewNumber(review, 'distractedMinutes');
  const samples = reviewNumber(review, 'samples');
  const knownMinutes = workMinutes + distractedMinutes;
  const focusRatio = knownMinutes ? workMinutes / knownMinutes : 0;
  const distractedRatio = knownMinutes ? distractedMinutes / knownMinutes : 0;
  if (samples < 3 || knownMinutes < 10) return 'quiet';
  if (workMinutes >= 45 && focusRatio >= 0.65) return 'focused';
  if (distractedMinutes >= 15 && distractedRatio >= 0.35) return 'distracted';
  return 'balanced';
}

function normalizeNextAction(rawNext = {}) {
  const kind = rawNext.kind === 'care' ? 'care' : 'surface';
  const action = kind === 'care'
    ? (CARE_ACTIONS.has(rawNext.action) ? rawNext.action : 'rest')
    : 'tasks';
  const label = cleanText(rawNext.label, 16) || (kind === 'care' ? '照料' : '看任务');
  const reason = cleanText(rawNext.reason, 28) || (kind === 'care' ? 'StepFun 建议' : '复盘建议');
  const text = cleanText(rawNext.text, 68) || (kind === 'care' ? '先照顾一下状态，再继续推进。' : '先回到当前任务，推进一个小步骤。');
  const title = cleanText(rawNext.title, 48) || (kind === 'care' ? `执行推荐：${label}` : '打开今日任务');
  return { kind, action, label, text, reason, title };
}

function normalizeReviewLlmResult(content, { review = {} } = {}) {
  const parsed = extractJsonObject(content);
  const tone = REVIEW_TONES.has(parsed.tone) ? parsed.tone : fallbackTone(review);
  const summary = cleanText(parsed.summary, 44) || 'StepFun 已完成复盘';
  const insight = cleanText(parsed.insight, 120) || '先把注意力放回当前最小步骤。';
  const petMessage = cleanText(parsed.petMessage, 72) || `${summary}，${insight}`;
  return {
    ok: true,
    source: 'stepfun',
    summary,
    insight,
    tone,
    petMessage,
    nextAction: normalizeNextAction(parsed.nextAction || {})
  };
}

async function summarizeDailyReview({
  review = {},
  currentTask = null,
  tasks = [],
  screenAnalysis = null,
  settings = {},
  env = process.env,
  fetchImpl = fetch
} = {}) {
  const config = reviewLlmConfig(settings, env);
  if (!config.enabled) return { ok: false, source: 'stepfun', status: 'disabled' };
  if (!config.configured) {
    return {
      ok: false,
      source: 'stepfun',
      status: 'needs-config',
      missing: config.missing
    };
  }
  if (typeof fetchImpl !== 'function') throw new Error('缺少 fetch 实现');

  const body = {
    model: config.model,
    temperature: 0.2,
    max_tokens: 360,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: '你是 Focus Pet 的每日复盘助手。你只根据聚合数据给短复盘、下一步和桌宠口吻反馈。'
      },
      {
        role: 'user',
        content: buildReviewPrompt({ review, currentTask, tasks, screenAnalysis })
      }
    ]
  };
  const response = await fetchImpl(config.endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...authHeaders(config.apiKey)
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const detail = typeof response.text === 'function' ? await response.text().catch(() => '') : '';
    throw new Error(`StepFun 复盘请求失败：${response.status}${detail ? ` ${detail.slice(0, 160)}` : ''}`);
  }
  const payload = await response.json();
  return normalizeReviewLlmResult(payload?.choices?.[0]?.message?.content || payload, { review });
}

module.exports = {
  DEFAULT_REVIEW_LLM_ENDPOINT,
  DEFAULT_REVIEW_LLM_MODEL,
  buildReviewPrompt,
  normalizeReviewEndpoint,
  normalizeReviewLlmResult,
  reviewLlmConfig,
  summarizeDailyReview
};
