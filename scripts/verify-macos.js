#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const appPath = process.env.APP_PATH || path.join(root, 'dist', 'Focus Pet.app');
const plist = path.join(appPath, 'Contents', 'Info.plist');
const executableDir = path.join(appPath, 'Contents', 'MacOS');

if (!fs.existsSync(appPath)) throw new Error(`App bundle 不存在：${appPath}`);
if (!fs.existsSync(plist)) throw new Error(`Info.plist 不存在：${plist}`);
if (!fs.existsSync(executableDir)) throw new Error(`可执行目录不存在：${executableDir}`);

const info = execFileSync('/usr/bin/plutil', ['-p', plist], { encoding: 'utf8' });
let codesign = '';
let gatekeeper = '';
try {
  codesign = execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (error) {
  codesign = error.stderr?.toString() || error.message;
}
try {
  gatekeeper = execFileSync('spctl', ['--assess', '--type', 'execute', '--verbose=4', appPath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (error) {
  gatekeeper = error.stderr?.toString() || error.message;
}

console.log(JSON.stringify({
  ok: true,
  appPath,
  plist: info.includes('CFBundleName') && info.includes('CFBundleIdentifier'),
  executableCount: fs.readdirSync(executableDir).length,
  codesign: codesign.trim(),
  gatekeeper: gatekeeper.trim()
}, null, 2));
