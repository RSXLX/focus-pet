#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const packageJson = require(path.join(root, 'package.json'));
const appName = process.env.APP_NAME || 'Focus Pet';
const sourceApp = path.join(root, 'node_modules', 'electron', 'dist', 'Electron.app');
const distDir = path.join(root, 'dist');
const outApp = path.join(distDir, `${appName}.app`);
const resourcesApp = path.join(outApp, 'Contents', 'Resources', 'app');

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' });
}

function copyProject() {
  fs.rmSync(resourcesApp, { recursive: true, force: true });
  fs.mkdirSync(resourcesApp, { recursive: true });
  for (const entry of ['src', 'scripts', 'package.json', 'package-lock.json']) {
    const from = path.join(root, entry);
    if (!fs.existsSync(from)) continue;
    fs.cpSync(from, path.join(resourcesApp, entry), { recursive: true });
  }
  const packagedModules = path.join(resourcesApp, 'node_modules');
  fs.mkdirSync(packagedModules, { recursive: true });
  for (const dependency of Object.keys(packageJson.dependencies || {})) {
    const from = path.join(root, 'node_modules', dependency);
    if (!fs.existsSync(from)) throw new Error(`运行时依赖不存在：${dependency}`);
    fs.cpSync(from, path.join(packagedModules, dependency), { recursive: true, verbatimSymlinks: true });
  }
}

function updatePlist() {
  const plist = path.join(outApp, 'Contents', 'Info.plist');
  const executable = path.join(outApp, 'Contents', 'MacOS', 'Electron');
  const renamedExecutable = path.join(outApp, 'Contents', 'MacOS', appName);
  if (fs.existsSync(executable)) fs.renameSync(executable, renamedExecutable);
  for (const [key, value] of [
    ['CFBundleName', appName],
    ['CFBundleDisplayName', appName],
    ['CFBundleExecutable', appName],
    ['CFBundleIdentifier', process.env.BUNDLE_ID || 'dev.focus-pet.app'],
    ['CFBundleShortVersionString', packageJson.version],
    ['CFBundleVersion', packageJson.version]
  ]) {
    run('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plist]);
  }
}

function main() {
  if (!fs.existsSync(sourceApp)) throw new Error(`Electron.app 不存在：${sourceApp}`);
  fs.mkdirSync(distDir, { recursive: true });
  fs.rmSync(outApp, { recursive: true, force: true });
  fs.cpSync(sourceApp, outApp, { recursive: true, verbatimSymlinks: true });
  copyProject();
  updatePlist();
  fs.writeFileSync(path.join(distDir, 'latest-mac.json'), JSON.stringify({
    version: packageJson.version,
    url: '',
    notes: '本地构建产物；发布时填入下载 URL。'
  }, null, 2));
  console.log(JSON.stringify({ ok: true, app: outApp }, null, 2));
}

main();
