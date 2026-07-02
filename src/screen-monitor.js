const STATUS_VALUES = new Set(['work', 'study', 'game', 'distracted', 'unknown']);
const TASK_RELEVANCE_VALUES = new Set(['on_task', 'adjacent', 'off_task', 'uncertain']);
const PRIVACY_RISK_VALUES = new Set(['low', 'medium', 'high']);
const INTERVENTION_VALUES = new Set(['none', 'gentle', 'ask_user', 'return_to_task']);
const DEFAULT_THUMBNAIL_SIZE = { width: 960, height: 540 };
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const SCREEN_ANALYSIS_SCHEMA_VERSION = 1;
const MIN_CONFIDENCE_TO_SUGGEST_INTERVENTION = 0.75;
const SCREEN_CHECK_TRANSPORTS = new Set(['auto', 'cloud', 'direct']);
const {
  authHeaders,
  DEFAULT_STEPFUN_ENDPOINT,
  DEFAULT_STEPFUN_SCREEN_MODEL,
  endpointAllowedByCloudMode,
  normalizeChatEndpoint,
  normalizeScreenCheckCloudUrl,
  normalizeLlmProvider,
  providerSummary
} = require('./llm-provider');

class ScreenMonitorTimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ScreenMonitorTimeoutError';
  }
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function cleanText(value, maxLength = 200) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanEvidence(value, maxItems = 5) {
  if (!Array.isArray(value)) return [];
  return value.map(item => cleanText(item, 120)).filter(Boolean).slice(0, maxItems);
}

function normalizeEndpoint(value) {
  const endpoint = String(value || '').trim();
  return /^https?:\/\//i.test(endpoint) ? endpoint : '';
}

function normalizeScreenCheckTransport(value) {
  const transport = String(value || '').trim();
  return SCREEN_CHECK_TRANSPORTS.has(transport) ? transport : 'auto';
}

function monitorConfig(settings = {}, env = process.env) {
  const cloudMode = settings.llmCloudMode || env.FOCUS_PET_LLM_CLOUD_MODE || 'allowed';
  const provider = normalizeLlmProvider(
    settings.screenMonitorProvider
    || env.FOCUS_PET_SCREEN_LLM_PROVIDER
    || env.FOCUS_PET_LLM_PROVIDER
    || 'stepfun'
  );
  const endpoint = normalizeChatEndpoint(
    settings.screenMonitorEndpoint
    || env.FOCUS_PET_SCREEN_LLM_ENDPOINT
    || env.FOCUS_PET_LLM_ENDPOINT
    || env.OPENAI_CHAT_COMPLETIONS_URL
    || (provider === 'stepfun' ? DEFAULT_STEPFUN_ENDPOINT : ''),
    { provider }
  );
  const model = cleanText(
    settings.screenMonitorModel
    || env.FOCUS_PET_SCREEN_LLM_MODEL
    || env.FOCUS_PET_LLM_MODEL
    || (provider === 'stepfun' ? DEFAULT_STEPFUN_SCREEN_MODEL : ''),
    120
  );
  const apiKey = String(
    env.FOCUS_PET_SCREEN_LLM_API_KEY
    || env.FOCUS_PET_LLM_API_KEY
    || (provider === 'stepfun' ? (env.FOCUS_PET_STEPFUN_API_KEY || env.STEPFUN_API_KEY || env.STEP_API_KEY) : '')
    || env.OPENAI_API_KEY
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
    endpoint,
    model,
    apiKey,
    configured: missing.length === 0,
    missing
  };
}

function screenCheckCloudConfig(settings = {}, env = process.env) {
  const cloudMode = settings.llmCloudMode || env.FOCUS_PET_LLM_CLOUD_MODE || 'allowed';
  const endpoint = normalizeScreenCheckCloudUrl(
    settings.screenCheckCloudUrl
    || env.FOCUS_PET_SCREEN_CHECK_CLOUD_URL
    || env.FOCUS_PET_CLOUD_SCREEN_CHECK_URL
    || env.FOCUS_PET_SCREEN_CHECK_URL
    || env.FOCUS_PET_CLOUD_PUBLIC_URL
    || ''
  );
  const missing = [];
  if (!endpoint) missing.push('endpoint');
  if (endpoint && !endpointAllowedByCloudMode(endpoint, cloudMode)) missing.push('localEndpoint');
  return {
    provider: 'focus-pet-cloud',
    cloudMode,
    localProvider: false,
    apiKeyRequired: false,
    endpoint,
    configured: missing.length === 0,
    missing
  };
}

function chooseScreenCheckTransport({ settings = {}, directConfig = {}, cloudConfig = {} } = {}) {
  const requested = normalizeScreenCheckTransport(settings.screenCheckTransport);
  if (requested === 'direct') {
    return directConfig.configured
      ? { transport: 'direct', config: directConfig }
      : { transport: 'none', missing: directConfig.missing || [] };
  }
  if (requested === 'cloud') {
    return cloudConfig.configured
      ? { transport: 'cloud', config: cloudConfig }
      : { transport: 'none', missing: cloudConfig.missing || [] };
  }
  if (directConfig.configured) return { transport: 'direct', config: directConfig };
  if (cloudConfig.configured) return { transport: 'cloud', config: cloudConfig };
  return {
    transport: 'none',
    missing: [...new Set([...(directConfig.missing || []), ...(cloudConfig.missing || [])])]
  };
}

function buildVisionPrompt({ currentTask = null, frontmost = {} } = {}) {
  const taskText = cleanText(currentTask?.text || '未设置当前任务', 160);
  const appText = cleanText(frontmost.app || '未知 App', 80);
  const titleText = cleanText(frontmost.title || '', 140);
  return [
    '请观察这张屏幕截图，判断用户当前正在做什么，以及是否与当前任务相关。',
    '只输出 JSON，不要输出 Markdown。',
    '必须输出 schema：state、activity_summary、task_relevance、evidence、confidence、privacy_risk、suggested_intervention、reasoning_visible。',
    'state 只能是 work、study、game、distracted、unknown。',
    'task_relevance 只能是 on_task、adjacent、off_task、uncertain。',
    'privacy_risk 只能是 low、medium、high；suggested_intervention 只能是 none、gentle、ask_user、return_to_task。',
    'activity_summary 用一句中文概括当前操作；evidence 只给高层次依据，不要转录密码、验证码、聊天全文、邮件正文等敏感内容。',
    'confidence 是 0 到 1 的数字；证据不足时 confidence 低于 0.75 且 suggested_intervention 必须是 none。',
    'reasoning_visible 是给用户看的简短安全解释。',
    `当前任务：${taskText}`,
    `前台 App：${appText}`,
    `窗口标题：${titleText || '无'}`
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

function hasStructuredSchemaKeys(parsed = {}) {
  return [
    'state',
    'activity_summary',
    'task_relevance',
    'evidence',
    'privacy_risk',
    'suggested_intervention',
    'reasoning_visible'
  ].some(key => Object.prototype.hasOwnProperty.call(parsed, key));
}

function interventionSuggestionText(value) {
  if (value === 'gentle') return '保持当前节奏，必要时轻提醒。';
  if (value === 'ask_user') return '可以轻问一句是否需要调整方向。';
  if (value === 'return_to_task') return '回到当前任务的下一小步。';
  return '先继续观察，不主动打扰。';
}

function invalidSchemaAnalysis(reason = 'LLM 输出不符合结构化 schema') {
  return {
    schemaVersion: SCREEN_ANALYSIS_SCHEMA_VERSION,
    schemaValid: false,
    status: 'unknown',
    state: 'unknown',
    activity: '无法判断当前屏幕活动',
    activitySummary: '无法判断当前屏幕活动',
    taskRelevance: 'uncertain',
    evidence: [],
    confidence: 0,
    privacyRisk: 'low',
    suggestedIntervention: 'none',
    reasoningVisible: reason,
    reason,
    suggestion: interventionSuggestionText('none'),
    lowConfidence: true
  };
}

function normalizeStructuredScreenAnalysis(parsed = {}) {
  const confidence = clampNumber(parsed.confidence, 0, 1, 0);
  const evidence = cleanEvidence(parsed.evidence);
  const activity = cleanText(parsed.activity_summary, 160);
  const reasoningVisible = cleanText(parsed.reasoning_visible, 220);
  const valid = (
    STATUS_VALUES.has(parsed.state)
    && activity
    && TASK_RELEVANCE_VALUES.has(parsed.task_relevance)
    && Array.isArray(parsed.evidence)
    && PRIVACY_RISK_VALUES.has(parsed.privacy_risk)
    && INTERVENTION_VALUES.has(parsed.suggested_intervention)
    && reasoningVisible
    && Number.isFinite(Number(parsed.confidence))
  );
  if (!valid) return invalidSchemaAnalysis();

  const lowConfidence = confidence < MIN_CONFIDENCE_TO_SUGGEST_INTERVENTION;
  const suggestedIntervention = lowConfidence ? 'none' : parsed.suggested_intervention;
  return {
    schemaVersion: SCREEN_ANALYSIS_SCHEMA_VERSION,
    schemaValid: true,
    status: parsed.state,
    state: parsed.state,
    activity,
    activitySummary: activity,
    taskRelevance: parsed.task_relevance,
    evidence,
    confidence,
    privacyRisk: parsed.privacy_risk,
    suggestedIntervention,
    reasoningVisible,
    reason: reasoningVisible,
    suggestion: interventionSuggestionText(suggestedIntervention),
    lowConfidence
  };
}

function normalizeLegacyScreenAnalysis(parsed = {}) {
  const status = STATUS_VALUES.has(parsed.status) ? parsed.status : 'unknown';
  const activity = cleanText(parsed.activity, 160) || '无法判断当前屏幕活动';
  const reason = cleanText(parsed.reason, 220) || 'LLM 未给出明确依据';
  const confidence = clampNumber(parsed.confidence, 0, 1, 0);
  const lowConfidence = confidence < MIN_CONFIDENCE_TO_SUGGEST_INTERVENTION;
  const suggestedIntervention = lowConfidence ? 'none' : (status === 'distracted' || status === 'game' ? 'return_to_task' : 'gentle');
  const suggestion = cleanText(parsed.suggestion, 160) || interventionSuggestionText(suggestedIntervention);
  return {
    schemaVersion: 0,
    schemaValid: false,
    status,
    state: status,
    activity,
    activitySummary: activity,
    taskRelevance: 'uncertain',
    evidence: [],
    confidence,
    privacyRisk: 'low',
    suggestedIntervention,
    reasoningVisible: reason,
    reason,
    suggestion: lowConfidence ? interventionSuggestionText('none') : suggestion,
    lowConfidence
  };
}

function normalizeScreenAnalysis(content) {
  const parsed = extractJsonObject(content);
  if (hasStructuredSchemaKeys(parsed)) return normalizeStructuredScreenAnalysis(parsed);
  return normalizeLegacyScreenAnalysis(parsed);
}

function statusMessage(result) {
  if (result.status === 'work') return `我看到你正在：${result.activity}。${result.suggestion}`;
  if (result.status === 'study') return `我看到你正在学习：${result.activity}。${result.suggestion}`;
  if (result.status === 'game') return `我看到你正在游戏：${result.activity}。${result.suggestion}`;
  if (result.status === 'distracted') return `我看到你可能偏离当前任务：${result.activity}。${result.suggestion}`;
  return `我还不确定你在做什么：${result.activity}。${result.suggestion}`;
}

function screenshotPayload(image = {}, policy = {}) {
  const dataUrl = String(image.dataUrl || '');
  const mimeType = dataUrl.match(/^data:([^;,]+);base64,/)?.[1] || 'image/png';
  return {
    dataUrl,
    mimeType,
    sourceName: image.sourceName || '',
    size: image.size || null,
    policy: {
      thumbnailSize: DEFAULT_THUMBNAIL_SIZE,
      detail: 'low',
      storedToDisk: false,
      requestTimeoutMs: policy.requestTimeoutMs || DEFAULT_REQUEST_TIMEOUT_MS
    }
  };
}

function fetchWithTimeout(fetchPromise, timeoutMs, onTimeout) {
  const timeout = Number(timeoutMs);
  if (!Number.isFinite(timeout) || timeout <= 0) return fetchPromise;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (typeof onTimeout === 'function') onTimeout();
      reject(new ScreenMonitorTimeoutError(`LLM 请求超时：${Math.round(timeout)}ms`));
    }, timeout);
    fetchPromise.then(
      value => {
        clearTimeout(timer);
        resolve(value);
      },
      error => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function callVisionModel({ config, image, currentTask, frontmost, fetchImpl = fetch, requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS }) {
  if (typeof fetchImpl !== 'function') throw new Error('缺少 fetch 实现');
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const body = {
    model: config.model,
    temperature: 0.2,
    reasoning_effort: 'low',
    max_tokens: 220,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: '你是 Focus Pet 的屏幕状态观察器。你只做高层次活动归纳，不保存、不复述敏感内容。'
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: buildVisionPrompt({ currentTask, frontmost }) },
          { type: 'image_url', image_url: { url: image.dataUrl, detail: 'low' } }
        ]
      }
    ]
  };
  const response = await fetchWithTimeout(fetchImpl(config.endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...authHeaders(config.apiKey)
    },
    signal: controller?.signal,
    body: JSON.stringify(body)
  }), requestTimeoutMs, () => controller?.abort());
  if (!response.ok) {
    const detail = typeof response.text === 'function' ? await response.text().catch(() => '') : '';
    throw new Error(`LLM 请求失败：${response.status}${detail ? ` ${detail.slice(0, 160)}` : ''}`);
  }
  const payload = await response.json();
  return normalizeScreenAnalysis(payload?.choices?.[0]?.message?.content || payload);
}

function cloudScreenCheckDeviceId(settings = {}, env = process.env) {
  return cleanText(
    settings.screenCheckDeviceId
    || env.FOCUS_PET_SCREEN_CHECK_DEVICE_ID
    || env.FOCUS_PET_DEVICE_ID
    || '',
    120
  );
}

async function callCloudScreenCheck({
  config,
  image,
  currentTask,
  frontmost,
  settings = {},
  env = process.env,
  fetchImpl = fetch,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
}) {
  if (typeof fetchImpl !== 'function') throw new Error('缺少 fetch 实现');
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const deviceId = cloudScreenCheckDeviceId(settings, env);
  const headers = { 'content-type': 'application/json' };
  if (deviceId) headers['x-focus-pet-device-id'] = deviceId;
  const body = {
    image: {
      dataUrl: image.dataUrl,
      sourceName: image.sourceName || '',
      size: image.size || null
    },
    currentTask: currentTask ? { text: cleanText(currentTask.text, 160) } : null,
    frontmost: {
      app: cleanText(frontmost?.app, 80),
      title: cleanText(frontmost?.title, 140)
    }
  };
  const response = await fetchWithTimeout(fetchImpl(config.endpoint, {
    method: 'POST',
    headers,
    signal: controller?.signal,
    body: JSON.stringify(body)
  }), requestTimeoutMs, () => controller?.abort());
  if (!response.ok) {
    const detail = typeof response.text === 'function' ? await response.text().catch(() => '') : '';
    throw new Error(`Cloud 屏幕检查请求失败：${response.status}${detail ? ` ${detail.slice(0, 160)}` : ''}`);
  }
  const payload = await response.json();
  if (payload && typeof payload === 'object' && Object.prototype.hasOwnProperty.call(payload, 'ok')) return payload;
  return {
    ok: true,
    source: 'focus-pet-cloud',
    ...normalizeScreenAnalysis(payload?.choices?.[0]?.message?.content || payload)
  };
}

async function capturePrimaryScreen(desktopCapturer, options = {}) {
  if (!desktopCapturer?.getSources) throw new Error('当前运行环境不支持屏幕捕获');
  const thumbnailSize = {
    width: options.width || DEFAULT_THUMBNAIL_SIZE.width,
    height: options.height || DEFAULT_THUMBNAIL_SIZE.height
  };
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize,
    fetchWindowIcons: false
  });
  const source = sources.find(item => String(item.id || '').startsWith('screen:')) || sources[0];
  if (!source?.thumbnail || source.thumbnail.isEmpty?.()) throw new Error('没有可用的屏幕缩略图');
  return {
    dataUrl: source.thumbnail.toDataURL(),
    sourceName: source.name || 'Screen',
    size: typeof source.thumbnail.getSize === 'function' ? source.thumbnail.getSize() : thumbnailSize
  };
}

async function analyzeScreenActivity({
  settings = {},
  env = process.env,
  currentTask = null,
  frontmost = {},
  getScreenPermissionStatus = null,
  captureScreen,
  fetchImpl,
  now = () => new Date(),
  manual = false,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS
} = {}) {
  if (!settings.screenMonitorEnabled && !manual) {
    return {
      ok: false,
      status: 'disabled',
      reason: '屏幕检查未开启',
      time: now().toISOString()
    };
  }

  const directConfig = monitorConfig(settings, env);
  const cloudConfig = screenCheckCloudConfig(settings, env);
  const selectedTransport = chooseScreenCheckTransport({ settings, directConfig, cloudConfig });
  if (selectedTransport.transport === 'none') {
    return {
      ok: false,
      status: 'needs-config',
      reason: '需要配置 Cloud 检查 URL，或本机 LLM endpoint、model 和 API key',
      missing: selectedTransport.missing || [],
      time: now().toISOString()
    };
  }

  const permissionStatus = typeof getScreenPermissionStatus === 'function' ? getScreenPermissionStatus() : 'granted';
  if (permissionStatus && permissionStatus !== 'granted') {
    return {
      ok: false,
      status: 'permission',
      permissionStatus,
      reason: '需要在 macOS 隐私与安全性中授予屏幕录制权限',
      time: now().toISOString()
    };
  }

  const time = now().toISOString();
  const image = await captureScreen();
  let analysis;
  try {
    analysis = selectedTransport.transport === 'cloud'
      ? await callCloudScreenCheck({
        config: selectedTransport.config,
        image,
        currentTask,
        frontmost,
        settings,
        env,
        fetchImpl,
        requestTimeoutMs
      })
      : await callVisionModel({
        config: selectedTransport.config,
        image,
        currentTask,
        frontmost,
        fetchImpl,
        requestTimeoutMs
      });
  } catch (error) {
    if (error?.name === 'ScreenMonitorTimeoutError') {
      return {
        ok: false,
        status: 'timeout',
        reason: 'LLM 请求超时，已丢弃本次截图结果',
        time,
        manual: Boolean(manual),
        sourceName: image.sourceName || ''
      };
    }
    throw error;
  }
  if (analysis?.ok === false) {
    return {
      ...analysis,
      time,
      manual: Boolean(manual),
      sourceName: image.sourceName || ''
    };
  }
  const result = {
    ...analysis,
    ok: true,
    time,
    manual: Boolean(manual),
    sourceName: image.sourceName || '',
    screenshot: screenshotPayload(image, { requestTimeoutMs }),
    screenshotPolicy: {
      thumbnailSize: DEFAULT_THUMBNAIL_SIZE,
      detail: 'low',
      storedToDisk: false,
      requestTimeoutMs
    }
  };
  if (!result.message) result.message = statusMessage(result);
  return {
    ...result
  };
}

module.exports = {
  analyzeScreenActivity,
  buildVisionPrompt,
  callCloudScreenCheck,
  callVisionModel,
  capturePrimaryScreen,
  monitorConfig,
  normalizeScreenAnalysis,
  screenCheckCloudConfig,
  statusMessage,
  ScreenMonitorTimeoutError
};
