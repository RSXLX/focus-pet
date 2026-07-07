#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packageJson = require(path.join(root, 'package.json'));
const appName = process.env.APP_NAME || 'Focus Pet';
const sourceDist = path.join(root, 'node_modules', 'electron', 'dist');
const distDir = path.join(root, 'dist', 'win-unpacked');
const outDir = path.join(distDir, appName);
const resourcesApp = path.join(outDir, 'resources', 'app');
const APP_ICON_ICO = path.join(root, 'src', 'assets', 'app-icon', 'icon.ico');

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

function renameExecutable() {
  const sourceExe = path.join(outDir, 'electron.exe');
  const targetExe = path.join(outDir, `${appName}.exe`);
  if (!fs.existsSync(sourceExe)) throw new Error(`electron.exe 不存在：${sourceExe}`);
  if (sourceExe !== targetExe) {
    fs.rmSync(targetExe, { force: true });
    fs.renameSync(sourceExe, targetExe);
  }
  return targetExe;
}

function copyAppIcon() {
  if (!fs.existsSync(APP_ICON_ICO)) throw new Error(`应用图标不存在：${APP_ICON_ICO}`);
  fs.copyFileSync(APP_ICON_ICO, path.join(outDir, `${appName}.ico`));
}

function main() {
  if (process.platform !== 'win32') {
    throw new Error('Windows 打包需要在 Windows 上执行，并先运行 npm install 下载 Windows Electron。');
  }
  if (!fs.existsSync(sourceDist)) throw new Error(`Electron dist 不存在：${sourceDist}`);
  fs.mkdirSync(distDir, { recursive: true });
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.cpSync(sourceDist, outDir, { recursive: true, verbatimSymlinks: true });
  copyProject();
  copyAppIcon();
  const executable = renameExecutable();
  fs.writeFileSync(path.join(distDir, 'latest-windows.json'), JSON.stringify({
    version: packageJson.version,
    url: '',
    notes: '本地 Windows 构建产物；发布时填入下载 URL。'
  }, null, 2));
  console.log(JSON.stringify({ ok: true, app: outDir, executable }, null, 2));
}

main();
