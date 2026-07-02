#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const appPath = process.env.APP_PATH || path.join(root, 'dist', 'Focus Pet.app');
const zipPath = process.env.ZIP_PATH || path.join(root, 'dist', 'Focus Pet.zip');
const appleId = process.env.APPLE_ID;
const teamId = process.env.APPLE_TEAM_ID;
const password = process.env.APPLE_APP_SPECIFIC_PASSWORD;

if (!fs.existsSync(appPath)) throw new Error(`App bundle 不存在：${appPath}`);
if (!appleId || !teamId || !password) throw new Error('缺少 APPLE_ID / APPLE_TEAM_ID / APPLE_APP_SPECIFIC_PASSWORD');

fs.rmSync(zipPath, { force: true });
execFileSync('ditto', ['-c', '-k', '--keepParent', appPath, zipPath], { stdio: 'inherit' });
execFileSync('xcrun', [
  'notarytool',
  'submit',
  zipPath,
  '--apple-id', appleId,
  '--team-id', teamId,
  '--password', password,
  '--wait'
], { stdio: 'inherit' });
execFileSync('xcrun', ['stapler', 'staple', appPath], { stdio: 'inherit' });
console.log(JSON.stringify({ ok: true, notarized: appPath, archive: zipPath }, null, 2));
