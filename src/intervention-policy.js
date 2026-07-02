(function initInterventionPolicy(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.focusPetInterventionPolicy = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function createInterventionPolicyApi() {
  const DEFAULT_INTERVENTION_POLICY = {
    minConfidenceToInterrupt: 0.75,
    cooldownMinutes: 8,
    maxInterruptionsPerHour: 3,
    neverInterruptApps: ['Zoom', 'Keynote', 'PowerPoint'],
    levels: ['none', 'dot', 'bubble', 'bubble_action', 'panel', 'system']
  };

  const ATTENTION_STATUSES = new Set(['distracted', 'game', 'unknown', 'permission']);

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  }

  function normalizedList(value) {
    const raw = Array.isArray(value) ? value : String(value || '').split(/[\n,，]/);
    return raw.map(item => String(item || '').trim()).filter(Boolean);
  }

  function normalizeInterventionPolicy(input = {}) {
    const merged = { ...DEFAULT_INTERVENTION_POLICY, ...(input || {}) };
    return {
      minConfidenceToInterrupt: clampNumber(merged.minConfidenceToInterrupt, 0, 1, DEFAULT_INTERVENTION_POLICY.minConfidenceToInterrupt),
      cooldownMinutes: clampNumber(merged.cooldownMinutes, 0, 240, DEFAULT_INTERVENTION_POLICY.cooldownMinutes),
      maxInterruptionsPerHour: Math.round(clampNumber(merged.maxInterruptionsPerHour, 0, 24, DEFAULT_INTERVENTION_POLICY.maxInterruptionsPerHour)),
      neverInterruptApps: normalizedList(merged.neverInterruptApps),
      levels: normalizedList(merged.levels).length ? normalizedList(merged.levels) : DEFAULT_INTERVENTION_POLICY.levels
    };
  }

  function appMatches(app, apps = []) {
    const current = String(app || '').trim().toLowerCase();
    return Boolean(current) && apps.some(item => String(item || '').trim().toLowerCase() === current);
  }

  function recentInterventionCount(recentShownAt = [], nowMs = Date.now()) {
    const hourAgo = nowMs - 60 * 60 * 1000;
    return (Array.isArray(recentShownAt) ? recentShownAt : [])
      .filter(time => Number.isFinite(Number(time)) && Number(time) >= hourAgo && Number(time) <= nowMs)
      .length;
  }

  function confidenceValue(input = {}) {
    if (Number.isFinite(Number(input.confidence))) return clampNumber(input.confidence, 0, 1, 1);
    return 1;
  }

  function focusStatusAffectsPetVitals(input = {}) {
    const status = typeof input === 'string' ? input : input?.status;
    return String(status || '').trim() !== 'permission';
  }

  function shouldShowIntervention(input = {}, policyInput = {}) {
    const policy = normalizeInterventionPolicy(policyInput);
    const status = String(input.status || '').trim();
    const nowMs = Number.isFinite(Number(input.nowMs)) ? Number(input.nowMs) : Date.now();

    if (!ATTENTION_STATUSES.has(status)) {
      return { shouldShow: false, level: 'none', target: 'home', reason: 'status-ok' };
    }

    if (appMatches(input.app, policy.neverInterruptApps)) {
      return { shouldShow: false, level: 'none', target: 'home', reason: 'never-interrupt-app' };
    }

    if (status !== 'permission' && confidenceValue(input) < policy.minConfidenceToInterrupt) {
      return { shouldShow: false, level: 'dot', target: 'home', reason: 'low-confidence' };
    }

    const lastShownAt = Number(input.lastShownAt) || 0;
    const cooldownMs = policy.cooldownMinutes * 60 * 1000;
    if (cooldownMs > 0 && lastShownAt && nowMs - lastShownAt < cooldownMs) {
      return { shouldShow: false, level: 'dot', target: 'home', reason: 'cooldown' };
    }

    if (policy.maxInterruptionsPerHour > 0 && recentInterventionCount(input.recentShownAt, nowMs) >= policy.maxInterruptionsPerHour) {
      return { shouldShow: false, level: 'dot', target: 'home', reason: 'hourly-limit' };
    }

    if (status === 'permission') {
      return { shouldShow: true, level: 'bubble_action', target: 'settings', reason: 'permission' };
    }

    return { shouldShow: true, level: 'bubble_action', target: 'tasks', reason: status };
  }

  return {
    DEFAULT_INTERVENTION_POLICY,
    focusStatusAffectsPetVitals,
    normalizeInterventionPolicy,
    shouldShowIntervention
  };
});
