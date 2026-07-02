#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const appPath = process.env.APP_PATH || path.join(root, 'dist', 'Focus Pet.app');
const identity = process.env.MAC_CODESIGN_IDENTITY;
const entitlements = process.env.MAC_ENTITLEMENTS || path.join(root, 'build', 'entitlements.mac.plist');

if (!fs.existsSync(appPath)) throw new Error(`App bundle 不存在：${appPath}`);
if (!identity) throw new Error('缺少 MAC_CODESIGN_IDENTITY，例如：Developer ID Application: Your Name (TEAMID)');

const args = ['--force', '--deep', '--options', 'runtime', '--timestamp', '--sign', identity];
if (fs.existsSync(entitlements)) args.push('--entitlements', entitlements);
args.push(appPath);

execFileSync('codesign', args, { stdio: 'inherit' });
execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], { stdio: 'inherit' });
console.log(JSON.stringify({ ok: true, signed: appPath }, null, 2));
