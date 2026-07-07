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
let stapler = '';
let codesignOk = true;
let gatekeeperOk = true;
let staplerOk = true;
try {
  codesign = execFileSync('codesign', ['--verify', '--deep', '--strict', '--verbose=2', appPath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (error) {
  codesignOk = false;
  codesign = error.stderr?.toString() || error.message;
}
try {
  gatekeeper = execFileSync('spctl', ['--assess', '--type', 'execute', '--verbose=4', appPath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (error) {
  gatekeeperOk = false;
  gatekeeper = error.stderr?.toString() || error.message;
}
try {
  stapler = execFileSync('xcrun', ['stapler', 'validate', appPath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
} catch (error) {
  staplerOk = false;
  stapler = error.stderr?.toString() || error.message;
}

const plistOk = info.includes('CFBundleName') && info.includes('CFBundleIdentifier');
const executableCount = fs.readdirSync(executableDir).length;
const ok = plistOk && executableCount > 0 && codesignOk && gatekeeperOk && staplerOk;

console.log(JSON.stringify({
  ok,
  appPath,
  plist: plistOk,
  executableCount,
  codesignOk,
  gatekeeperOk,
  staplerOk,
  codesign: codesign.trim(),
  gatekeeper: gatekeeper.trim(),
  stapler: stapler.trim()
}, null, 2));

if (!ok) {
  process.exitCode = 1;
}
