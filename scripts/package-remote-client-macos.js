#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const packageJson = require(path.join(root, 'package.json'));
const appName = process.env.APP_NAME || 'Focus Pet Chat Client';
const bundleId = process.env.BUNDLE_ID || 'dev.focus-pet.chat-client';
const clientUrl = String(process.env.REMOTE_CLIENT_URL || '').trim();
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

function assertHttpsClientUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('REMOTE_CLIENT_URL 必须是完整 HTTPS URL');
  }
  if (parsed.protocol !== 'https:') throw new Error('REMOTE_CLIENT_URL 必须使用 HTTPS');
  if (parsed.pathname !== '/client' && !parsed.pathname.startsWith('/client/')) {
    throw new Error('REMOTE_CLIENT_URL 必须指向 /client 或 /client/... 路径');
  }
  return parsed.toString();
}

function writeRemoteClientApp() {
  const safeUrl = assertHttpsClientUrl(clientUrl);
  fs.rmSync(resourcesApp, { recursive: true, force: true });
  fs.mkdirSync(resourcesApp, { recursive: true });
  fs.writeFileSync(path.join(resourcesApp, 'package.json'), `${JSON.stringify({
    name: 'focus-pet-chat-client',
    version: packageJson.version,
    private: true,
    main: 'main.js'
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(resourcesApp, 'config.json'), `${JSON.stringify({
    clientUrl: safeUrl
  }, null, 2)}\n`);
  fs.writeFileSync(path.join(resourcesApp, 'main.js'), `'use strict';
const { app, BrowserWindow, shell, session } = require('electron');
const path = require('node:path');

const config = require('./config.json');
let mainWindow;

function isSafeExternalUrl(url) {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function isAllowedClientUrl(url) {
  try {
    const target = new URL(url);
    const allowed = new URL(config.clientUrl);
    return target.origin === allowed.origin
      && (target.pathname === '/client' || target.pathname.startsWith('/client/'));
  } catch {
    return false;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 840,
    minHeight: 620,
    title: 'Focus Pet Chat',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details = {}) => {
    const requestingUrl = details.requestingUrl || webContents.getURL() || '';
    const allowedOrigin = new URL(config.clientUrl).origin;
    try {
      const requestingOrigin = new URL(requestingUrl).origin;
      callback(requestingOrigin === allowedOrigin && ['media', 'microphone', 'camera'].includes(permission));
    } catch {
      callback(false);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', event => {
    if (!isAllowedClientUrl(event.url)) {
      event.preventDefault();
      if (isSafeExternalUrl(event.url)) shell.openExternal(event.url);
    }
  });
  mainWindow.loadURL(config.clientUrl);
}

app.whenReady().then(createWindow);
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
`);
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
    ['CFBundleIdentifier', bundleId],
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
  writeRemoteClientApp();
  updatePlist();
  console.log(JSON.stringify({ ok: true, app: outApp, clientUrl: assertHttpsClientUrl(clientUrl) }, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  assertHttpsClientUrl
};
