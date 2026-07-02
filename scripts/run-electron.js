#!/usr/bin/env node
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { DEFAULT_RUNTIME_LOG_PATH, writeRuntimeLog } = require('../src/runtime-logger');
const { createSettingsStore, DEFAULT_SETTINGS } = require('../src/settings-store');

const root = path.resolve(__dirname, '..');
const electronPath = path.join(root, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron');
const logPath = DEFAULT_RUNTIME_LOG_PATH;
const stateDir = path.dirname(logPath);
const stopPath = path.join(stateDir, 'focus-pet.stop');
fs.mkdirSync(stateDir, { recursive: true });
try { fs.rmSync(stopPath, { force: true }); } catch {}

function runtimeLogRetentionDays() {
  try {
    return createSettingsStore().getSettings().activityRetentionDays;
  } catch {
    return DEFAULT_SETTINGS.activityRetentionDays;
  }
}

function log(message, level = 'info') {
  writeRuntimeLog({ logPath, level, scope: 'supervisor', message, retentionDays: runtimeLogRetentionDays() });
}

function shouldRestartAfterExit({ code, signal, stopRequested = false } = {}) {
  if (stopRequested) return false;
  if (code === 0) return false;
  if (signal === 'SIGTERM' || signal === 'SIGINT') return false;
  return true;
}

function startOnce(restartCount = 0) {
  if (fs.existsSync(stopPath)) {
    log('stop marker present; supervisor exiting');
    process.exit(0);
  }
  log(`starting focus-pet restart=${restartCount}`);
  const logFd = fs.openSync(logPath, 'a');
  const child = spawn(electronPath, ['.'], {
    cwd: root,
    detached: false,
    stdio: ['ignore', logFd, logFd],
    env: { ...process.env, ELECTRON_ENABLE_LOGGING: process.env.ELECTRON_ENABLE_LOGGING || '1' }
  });

  child.on('exit', (code, signal) => {
    fs.closeSync(logFd);
    const stopRequested = fs.existsSync(stopPath);
    const shouldRestart = shouldRestartAfterExit({ code, signal, stopRequested });
    log(`electron exited code=${code} signal=${signal}`, shouldRestart ? 'warn' : 'info');
    if (!shouldRestart) {
      log(stopRequested ? 'stop marker found after exit; supervisor exiting' : 'electron exited normally; supervisor exiting');
      process.exit(0);
    }
    const delay = Math.min(10_000, 1_000 + restartCount * 1_000);
    log(`restarting in ${delay}ms`, 'warn');
    setTimeout(() => startOnce(restartCount + 1), delay);
  });
}

process.on('SIGTERM', () => {
  log('supervisor received SIGTERM');
  fs.writeFileSync(stopPath, 'stop');
  process.exit(0);
});

if (require.main === module) startOnce();

module.exports = { shouldRestartAfterExit };
