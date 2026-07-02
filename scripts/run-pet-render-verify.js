#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const electronPath = path.join(root, 'node_modules', 'electron', 'dist', 'Electron.app', 'Contents', 'MacOS', 'Electron');
const verifyScript = path.join(root, 'scripts', 'verify-pet-render.js');
const summaryPath = path.join(root, 'output', 'qa', 'nervy-render-summary.json');
const startedAt = Date.now();

function cleanEnv() {
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith('npm_')) delete env[key];
  }
  delete env.INIT_CWD;
  return env;
}

function readFreshSummary() {
  try {
    const stat = fs.statSync(summaryPath);
    if (stat.mtimeMs + 1000 < startedAt) return null;
    return JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  } catch {
    return null;
  }
}

function consoleSummary(summary) {
  return {
    ok: Boolean(summary?.ok),
    summaryPath,
    scenarios: (summary?.scenarios || []).map(result => ({
      name: result.name,
      ok: result.ok,
      failedChecks: Object.entries(result.checks || {})
        .filter(([, value]) => !value)
        .map(([key]) => key),
      screenshotPath: result.screenshotPath
    }))
  };
}

const result = spawnSync(electronPath, [verifyScript], {
  cwd: root,
  env: cleanEnv(),
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);

if (result.status === 0) process.exit(0);

const summary = readFreshSummary();
if (summary?.ok) {
  if (!result.stdout) process.stdout.write(`${JSON.stringify(consoleSummary(summary), null, 2)}\n`);
  process.exit(0);
}

if (summary && !summary.ok) {
  if (!result.stderr) process.stderr.write(`${JSON.stringify(consoleSummary(summary), null, 2)}\n`);
  process.exit(1);
}

if (result.error) process.stderr.write(`${result.error.stack || result.error}\n`);
if (result.signal) process.stderr.write(`${electronPath} exited with signal ${result.signal}\n`);
process.exit(typeof result.status === 'number' ? result.status : 1);
