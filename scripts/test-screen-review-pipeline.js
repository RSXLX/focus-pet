const { app, desktopCapturer, systemPreferences } = require('electron');
const focus = require('../src/focus');
const {
  analyzeScreenActivity,
  capturePrimaryScreen,
  monitorConfig
} = require('../src/screen-monitor');
const { reviewLlmConfig } = require('../src/review-llm');

function screenPermissionStatus() {
  if (process.platform !== 'darwin') return 'granted';
  return systemPreferences.getMediaAccessStatus('screen');
}

function publicConfigStatus(config) {
  return {
    configured: Boolean(config.configured),
    missing: config.missing || []
  };
}

function printJson(label, payload) {
  console.log(`${label} ${JSON.stringify(payload, null, 2)}`);
}

function assertConfigured(settings) {
  const screenConfig = monitorConfig(settings, process.env);
  const reviewConfig = reviewLlmConfig(settings, process.env);
  printJson('[config]', {
    screen: publicConfigStatus(screenConfig),
    review: publicConfigStatus(reviewConfig)
  });

  const missing = [];
  for (const item of screenConfig.missing || []) missing.push(`screen.${item}`);
  for (const item of reviewConfig.missing || []) missing.push(`review.${item}`);
  if (missing.length) {
    const error = new Error(`LLM pipeline 配置不完整：${missing.join(', ')}`);
    error.missing = missing;
    throw error;
  }
}

async function run() {
  const settings = focus.getSettings();
  assertConfigured(settings);

  const currentTask = focus.getCurrentTask();
  const frontmost = focus.getStatus();
  const screenAnalysis = await analyzeScreenActivity({
    settings: { ...settings, screenMonitorEnabled: true },
    currentTask,
    frontmost,
    getScreenPermissionStatus: screenPermissionStatus,
    captureScreen: () => capturePrimaryScreen(desktopCapturer),
    fetchImpl: fetch,
    manual: true
  });

  printJson('[screen-analysis]', {
    ok: screenAnalysis.ok,
    status: screenAnalysis.status,
    activity: screenAnalysis.activity,
    reason: screenAnalysis.reason,
    confidence: screenAnalysis.confidence,
    suggestion: screenAnalysis.suggestion,
    sourceName: screenAnalysis.sourceName
  });

  if (!screenAnalysis.ok) {
    process.exitCode = 2;
    return;
  }

  const review = await focus.getDailyReview({ screenAnalysis, fetchImpl: fetch });
  printJson('[pipeline-review]', {
    samples: review.samples,
    workMinutes: review.workMinutes,
    distractedMinutes: review.distractedMinutes,
    llm: review.llm
  });
  process.exitCode = review.llm?.ok ? 0 : 3;
}

app.whenReady()
  .then(run)
  .catch(error => {
    process.exitCode = 1;
    printJson('[error]', {
      message: error.message,
      missing: error.missing || []
    });
  })
  .finally(() => app.exit(process.exitCode || 0));
