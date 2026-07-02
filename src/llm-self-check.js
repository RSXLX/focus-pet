const { monitorConfig } = require('./screen-monitor');
const { reviewLlmConfig } = require('./review-llm');
const { authHeaders } = require('./llm-provider');

const FIELD_LABELS = {
  endpoint: 'endpoint',
  model: 'model',
  apiKey: 'API key',
  localEndpoint: '本地 endpoint'
};

const SERVICES = [
  {
    id: 'screen-monitor',
    title: '屏幕监控 LLM',
    config(settings, env) {
      return monitorConfig(settings, env);
    },
    endpointHint: '在屏幕监控的 LLM Endpoint 填入完整 Chat Completions 地址，例如 https://api.example.com/v1/chat/completions。',
    modelHint: '在 LLM Model 填入支持文本 ping、并且实际监控时支持图片输入的模型名。',
    apiKeyHint: '在启动应用前设置 FOCUS_PET_LLM_API_KEY；如果使用 OpenAI-compatible 默认 key，也可以设置 OPENAI_API_KEY。',
    localEndpointHint: '当前为仅本地模式，请把 endpoint 改成 localhost、127.0.0.1 或本机 Ollama 地址。'
  },
  {
    id: 'review-llm',
    title: '复盘 LLM',
    config(settings, env) {
      return reviewLlmConfig({ ...settings, reviewLlmEnabled: true }, env);
    },
    endpointHint: '在复盘 URL 填入服务根地址或 Chat Completions 地址；StepFun 默认会补到 /chat/completions。',
    modelHint: '在复盘模型填入当前账号可访问的模型名，例如 step-3.7-flash。',
    apiKeyHint: '在启动应用前设置 FOCUS_PET_REVIEW_LLM_API_KEY、FOCUS_PET_STEPFUN_API_KEY、STEPFUN_API_KEY 或 STEP_API_KEY。',
    localEndpointHint: '当前为仅本地模式，请把复盘 URL 改成 localhost、127.0.0.1 或本机 Ollama 地址。'
  }
];

function cleanText(value, maxLength = 420) {
  return String(value || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+/gi, 'Bearer [redacted]')
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function formatList(items = []) {
  return items.map(item => FIELD_LABELS[item] || item).join('、');
}

function missingNextSteps(service, missing = []) {
  const steps = [];
  if (missing.includes('endpoint')) steps.push(service.endpointHint);
  if (missing.includes('localEndpoint')) steps.push(service.localEndpointHint);
  if (missing.includes('model')) steps.push(service.modelHint);
  if (missing.includes('apiKey')) steps.push(service.apiKeyHint);
  return steps;
}

function minimalChatBody(model) {
  return {
    model,
    temperature: 0,
    max_tokens: 8,
    messages: [
      {
        role: 'system',
        content: 'Reply with ok.'
      },
      {
        role: 'user',
        content: 'ping'
      }
    ]
  };
}

function baseCheck(service, config) {
  return {
    id: service.id,
    title: service.title,
    endpoint: config.endpoint || '',
    model: config.model || '',
    apiKeyPresent: Boolean(config.apiKey),
    apiKeyRequired: config.apiKeyRequired !== false,
    provider: config.provider || 'openai-compatible',
    localProvider: Boolean(config.localProvider),
    cloudMode: config.cloudMode || 'allowed',
    missing: Array.isArray(config.missing) ? config.missing : [],
    requestSent: false
  };
}

function configFailure(service, config) {
  const missing = Array.isArray(config.missing) ? config.missing : [];
  return {
    ...baseCheck(service, config),
    ok: false,
    status: 'needs-config',
    summary: `${service.title} 缺少 ${formatList(missing)}。`,
    detail: '没有发送测试请求，因为配置还不完整。',
    nextSteps: missingNextSteps(service, missing)
  };
}

function httpNextSteps(service, response, detail) {
  const status = Number(response.status) || 0;
  if (status === 401 || status === 403) {
    return [
      '检查 API key 是否来自正确的服务商账号，是否有当前模型权限，并重启应用让环境变量生效。',
      service.apiKeyHint
    ];
  }
  if (status === 404) {
    return [
      '检查 endpoint 路径是否正确，尤其是是否需要 /v1/chat/completions 或 /chat/completions。',
      service.endpointHint
    ];
  }
  if (status === 400) {
    return [
      '检查 model 名是否拼写正确、当前账号是否可访问，以及该服务是否兼容 Chat Completions 请求格式。',
      detail ? `服务返回：${detail}` : service.modelHint
    ];
  }
  if (status === 429) {
    return [
      '服务已限流或额度不足；检查账号余额、配额、并稍后重试。',
      '如果只是本机配置验证，可以先换一个可用额度的 key 或降低请求频率。'
    ];
  }
  if (status >= 500) {
    return [
      '服务端返回 5xx，优先检查供应商状态页或稍后重试。',
      '如果持续失败，换一个 endpoint 或模型做交叉验证。'
    ];
  }
  return [
    '检查 endpoint、model、API key 是否属于同一个服务商，并确认网络或代理没有拦截请求。',
    service.endpointHint
  ];
}

function networkNextSteps(service, error) {
  const message = cleanText(error?.message || error);
  if (/abort|timeout|timed out/i.test(message)) {
    return [
      '请求超时；检查网络、代理、防火墙，或确认服务商 endpoint 当前可访问。',
      service.endpointHint
    ];
  }
  return [
    '检查 endpoint 域名、协议和网络连通性；如果需要代理，请从启动 Focus Pet 的终端配置代理环境变量。',
    '确认本机可以访问该服务商 API，再回到设置页重新自检。'
  ];
}

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs) {
  if (typeof AbortController !== 'function') return fetchImpl(url, options);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  timer.unref?.();
  try {
    return await fetchImpl(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function readResponseDetail(response) {
  if (typeof response.text !== 'function') return '';
  return cleanText(await response.text().catch(() => ''));
}

async function testService(service, settings, env, fetchImpl, timeoutMs) {
  const config = service.config(settings, env);
  if (config.missing?.length) return configFailure(service, config);
  if (typeof fetchImpl !== 'function') throw new Error('缺少 fetch 实现');

  const request = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...authHeaders(config.apiKey)
    },
    body: JSON.stringify(minimalChatBody(config.model))
  };

  let response;
  try {
    response = await fetchWithTimeout(fetchImpl, config.endpoint, request, timeoutMs);
  } catch (error) {
    return {
      ...baseCheck(service, config),
      ok: false,
      status: 'network-error',
      requestSent: true,
      summary: `${service.title} 无法连接 endpoint：${cleanText(error.message || error, 160) || '网络错误'}。`,
      detail: `请求地址：${config.endpoint}`,
      nextSteps: networkNextSteps(service, error)
    };
  }

  if (!response.ok) {
    const detail = await readResponseDetail(response);
    return {
      ...baseCheck(service, config),
      ok: false,
      status: 'request-failed',
      statusCode: response.status,
      requestSent: true,
      summary: `${service.title} 请求失败：${response.status}${response.statusText ? ` ${response.statusText}` : ''}。`,
      detail,
      nextSteps: httpNextSteps(service, response, detail)
    };
  }

  if (typeof response.json === 'function') {
    try {
      await response.json();
    } catch (error) {
      return {
        ...baseCheck(service, config),
        ok: false,
        status: 'invalid-response',
        requestSent: true,
        summary: `${service.title} endpoint 有响应，但返回的不是可解析 JSON。`,
        detail: cleanText(error.message || error),
        nextSteps: [
          '确认 endpoint 指向的是 Chat Completions API，不是网页、网关健康检查或其它接口。',
          service.endpointHint
        ]
      };
    }
  }

  return {
    ...baseCheck(service, config),
    ok: true,
    status: 'connected',
    requestSent: true,
    summary: config.localProvider
      ? `${service.title} 本地模型连通，endpoint 和 model 可用。`
      : `${service.title} 连通，endpoint、model、API key 都可用。`,
    detail: config.apiKeyRequired === false
      ? '已发送最小文本 ping 请求，服务返回 2xx 响应；本地提供方无需 API key。'
      : '已发送最小文本 ping 请求，服务返回 2xx 响应。',
    nextSteps: service.id === 'screen-monitor'
      ? ['连通性正常；如果正式监控失败，再检查屏幕录制权限和模型是否支持图片输入。']
      : ['连通性正常；保存设置后可以回到复盘页触发一次复盘。']
  };
}

async function runLlmConnectivitySelfCheck({
  settings = {},
  env = process.env,
  fetchImpl = fetch,
  now = () => new Date(),
  timeoutMs = 15000
} = {}) {
  const checks = [];
  for (const service of SERVICES) {
    checks.push(await testService(service, settings, env, fetchImpl, timeoutMs));
  }
  return {
    ok: checks.every(check => check.ok),
    checkedAt: now().toISOString(),
    checks
  };
}

module.exports = {
  formatList,
  minimalChatBody,
  runLlmConnectivitySelfCheck
};
