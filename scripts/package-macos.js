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
const APP_ICON_ICNS = path.join(root, 'src', 'assets', 'app-icon', 'icon.icns');

function run(command, args) {
  execFileSync(command, args, { stdio: 'inherit' });
}

function setPlistValue(plist, key, value) {
  try {
    execFileSync('/usr/libexec/PlistBuddy', ['-c', `Set :${key} ${value}`, plist], { stdio: 'ignore' });
  } catch {
    run('/usr/libexec/PlistBuddy', ['-c', `Add :${key} string ${value}`, plist]);
  }
}

function copyProject() {
  fs.rmSync(resourcesApp, { recursive: true, force: true });
  fs.mkdirSync(resourcesApp, { recursive: true });
  for (const entry of ['src']) {
    const from = path.join(root, entry);
    if (!fs.existsSync(from)) continue;
    fs.cpSync(from, path.join(resourcesApp, entry), { recursive: true });
  }
  fs.writeFileSync(path.join(resourcesApp, 'package.json'), `${JSON.stringify({
    name: packageJson.name,
    version: packageJson.version,
    description: packageJson.description,
    main: packageJson.main,
    license: packageJson.license,
    dependencies: packageJson.dependencies || {}
  }, null, 2)}\n`, 'utf8');
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
  if (!fs.existsSync(APP_ICON_ICNS)) throw new Error(`应用图标不存在：${APP_ICON_ICNS}`);
  fs.copyFileSync(APP_ICON_ICNS, path.join(outApp, 'Contents', 'Resources', 'icon.icns'));
  if (fs.existsSync(executable)) fs.renameSync(executable, renamedExecutable);
  for (const [key, value] of [
    ['CFBundleName', appName],
    ['CFBundleDisplayName', appName],
    ['CFBundleExecutable', appName],
    ['CFBundleIdentifier', process.env.BUNDLE_ID || 'dev.focus-pet.app'],
    ['CFBundleIconFile', 'icon.icns'],
    ['CFBundleShortVersionString', packageJson.version],
    ['CFBundleVersion', packageJson.version]
  ]) {
    setPlistValue(plist, key, value);
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
