const LLM_PROVIDERS = ['stepfun', 'openai-compatible', 'ollama', 'local-openai-compatible'];
const LLM_CLOUD_MODES = ['allowed', 'local-only'];
const DEFAULT_PROVIDER = 'openai-compatible';
const DEFAULT_CLOUD_MODE = 'allowed';
const OLLAMA_CHAT_ENDPOINT = 'http://127.0.0.1:11434/v1/chat/completions';
const DEFAULT_STEPFUN_ENDPOINT = 'https://api.stepfun.com/v1';
const DEFAULT_STEPFUN_CHAT_ENDPOINT = `${DEFAULT_STEPFUN_ENDPOINT}/chat/completions`;
const DEFAULT_STEPFUN_SCREEN_MODEL = 'step-3.7-flash';
const DEFAULT_FOCUS_PET_CLOUD_BASE_URL = 'https://reecewong520--focus-pet-cloud-cloud.modal.run';
const DEFAULT_SCREEN_CHECK_CLOUD_URL = `${DEFAULT_FOCUS_PET_CLOUD_BASE_URL}/api/screen-check`;

function cleanText(value, maxLength = 160) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeLlmProvider(value) {
  const provider = cleanText(value, 60);
  return LLM_PROVIDERS.includes(provider) ? provider : DEFAULT_PROVIDER;
}

function normalizeLlmCloudMode(value) {
  const mode = cleanText(value, 40);
  return LLM_CLOUD_MODES.includes(mode) ? mode : DEFAULT_CLOUD_MODE;
}

function stripTrailingSlashes(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function isLocalEndpoint(value) {
  try {
    const url = new URL(String(value || '').trim());
    const hostname = url.hostname.toLowerCase();
    return ['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'].includes(hostname);
  } catch {
    return false;
  }
}

function normalizeChatEndpoint(value, { provider = DEFAULT_PROVIDER, fallback = '' } = {}) {
  const normalizedProvider = normalizeLlmProvider(provider);
  const providerFallback = normalizedProvider === 'ollama'
    ? OLLAMA_CHAT_ENDPOINT
    : (normalizedProvider === 'stepfun' ? DEFAULT_STEPFUN_ENDPOINT : fallback);
  const raw = stripTrailingSlashes(value || providerFallback);
  if (!/^https?:\/\//i.test(raw)) return '';
  if (/\/chat\/completions$/i.test(raw)) return raw;
  if (normalizedProvider === 'stepfun') {
    try {
      const url = new URL(raw);
      if (url.hostname.toLowerCase() === 'api.stepfun.com' && (!url.pathname || url.pathname === '/')) {
        return DEFAULT_STEPFUN_CHAT_ENDPOINT;
      }
    } catch {}
  }
  if (normalizedProvider === 'ollama') {
    if (/\/api\/chat$/i.test(raw)) return raw.replace(/\/api\/chat$/i, '/v1/chat/completions');
    if (/\/v1$/i.test(raw)) return `${raw}/chat/completions`;
    return `${raw}/v1/chat/completions`;
  }
  if (/\/v1$/i.test(raw)) return `${raw}/chat/completions`;
  return `${raw}/chat/completions`;
}

function normalizeScreenCheckCloudUrl(value, { fallback = '' } = {}) {
  const raw = stripTrailingSlashes(value || fallback);
  if (!/^https?:\/\//i.test(raw)) return '';
  try {
    const url = new URL(raw);
    const pathname = url.pathname.replace(/\/+$/, '');
    if (!pathname || pathname === '/') {
      url.pathname = '/api/screen-check';
      url.search = '';
      url.hash = '';
      return url.toString();
    }
    if (pathname === '/client' || pathname.startsWith('/client/')) {
      url.pathname = '/api/screen-check';
      url.search = '';
      url.hash = '';
      return url.toString();
    }
    return raw;
  } catch {
    return '';
  }
}

function isLocalProvider(provider, endpoint = '') {
  const normalizedProvider = normalizeLlmProvider(provider);
  return normalizedProvider === 'ollama'
    || normalizedProvider === 'local-openai-compatible'
    || isLocalEndpoint(endpoint);
}

function apiKeyRequiredForProvider({ provider = DEFAULT_PROVIDER, endpoint = '', cloudMode = DEFAULT_CLOUD_MODE } = {}) {
  const normalizedCloudMode = normalizeLlmCloudMode(cloudMode);
  if (normalizedCloudMode === 'local-only') return false;
  return !isLocalProvider(provider, endpoint);
}

function endpointAllowedByCloudMode(endpoint = '', cloudMode = DEFAULT_CLOUD_MODE) {
  const normalizedCloudMode = normalizeLlmCloudMode(cloudMode);
  return normalizedCloudMode !== 'local-only' || isLocalEndpoint(endpoint);
}

function authHeaders(apiKey = '') {
  const token = String(apiKey || '').trim();
  return token ? { authorization: `Bearer ${token}` } : {};
}

function providerSummary({ provider = DEFAULT_PROVIDER, endpoint = '', cloudMode = DEFAULT_CLOUD_MODE } = {}) {
  const normalizedProvider = normalizeLlmProvider(provider);
  const normalizedCloudMode = normalizeLlmCloudMode(cloudMode);
  const localProvider = isLocalProvider(normalizedProvider, endpoint);
  return {
    provider: normalizedProvider,
    cloudMode: normalizedCloudMode,
    localProvider,
    apiKeyRequired: apiKeyRequiredForProvider({
      provider: normalizedProvider,
      endpoint,
      cloudMode: normalizedCloudMode
    })
  };
}

module.exports = {
  DEFAULT_CLOUD_MODE,
  DEFAULT_FOCUS_PET_CLOUD_BASE_URL,
  DEFAULT_PROVIDER,
  DEFAULT_SCREEN_CHECK_CLOUD_URL,
  DEFAULT_STEPFUN_CHAT_ENDPOINT,
  DEFAULT_STEPFUN_ENDPOINT,
  DEFAULT_STEPFUN_SCREEN_MODEL,
  LLM_CLOUD_MODES,
  LLM_PROVIDERS,
  OLLAMA_CHAT_ENDPOINT,
  apiKeyRequiredForProvider,
  authHeaders,
  endpointAllowedByCloudMode,
  isLocalEndpoint,
  isLocalProvider,
  normalizeChatEndpoint,
  normalizeLlmCloudMode,
  normalizeLlmProvider,
  normalizeScreenCheckCloudUrl,
  providerSummary
};
