#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: 'inherit', ...options });
}

function filePart(value) {
  return String(value || '')
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'app';
}

function buildReleaseAssetPlan(options = {}) {
  const root = options.root || PROJECT_ROOT;
  const appName = options.appName || 'Focus Pet';
  const version = options.version || require(path.join(root, 'package.json')).version;
  const arch = options.arch || process.arch;
  const assetBaseName = `${filePart(appName)}-${version}-mac-${arch}`;
  const distDir = path.join(root, 'dist');
  const releaseDir = path.join(distDir, 'release', `v${version}`);
  const appPath = path.join(distDir, `${appName}.app`);
  const stagingDir = path.join(releaseDir, 'dmg-staging');
  return {
    root,
    appName,
    version,
    arch,
    assetBaseName,
    distDir,
    releaseDir,
    appPath,
    stagingDir,
    stagedAppPath: path.join(stagingDir, `${appName}.app`),
    stagedApplicationsLink: path.join(stagingDir, 'Applications'),
    zipPath: path.join(releaseDir, `${assetBaseName}.zip`),
    dmgPath: path.join(releaseDir, `${assetBaseName}.dmg`),
    manifestPath: path.join(releaseDir, `${assetBaseName}-manifest.json`)
  };
}

function sha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function assetInfo(filePath) {
  return {
    file: path.basename(filePath),
    size: fs.statSync(filePath).size,
    sha256: sha256(filePath)
  };
}

function createZip(plan) {
  fs.rmSync(plan.zipPath, { force: true });
  run('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', plan.appPath, plan.zipPath]);
}

function createDmg(plan) {
  fs.rmSync(plan.stagingDir, { recursive: true, force: true });
  fs.mkdirSync(plan.stagingDir, { recursive: true });
  fs.cpSync(plan.appPath, plan.stagedAppPath, { recursive: true, verbatimSymlinks: true });
  try {
    fs.symlinkSync('/Applications', plan.stagedApplicationsLink);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  fs.rmSync(plan.dmgPath, { force: true });
  run('hdiutil', [
    'create',
    '-volname', `${plan.appName} ${plan.version}`,
    '-srcfolder', plan.stagingDir,
    '-ov',
    '-format', 'UDZO',
    plan.dmgPath
  ]);
}

function signAppForRelease(plan) {
  if (process.platform !== 'darwin') return 'skipped-non-darwin';
  const identity = process.env.MAC_CODESIGN_IDENTITY || '-';
  if (identity === '-') {
    run('codesign', ['--force', '--deep', '--sign', identity, plan.appPath]);
  } else {
    run('codesign', ['--force', '--deep', '--options', 'runtime', '--timestamp', '--sign', identity, plan.appPath]);
  }
  run('codesign', ['--verify', '--deep', '--strict', '--verbose=2', plan.appPath]);
  return identity === '-' ? 'ad-hoc' : 'developer-id';
}

function writeManifest(plan) {
  const manifest = {
    appName: plan.appName,
    version: plan.version,
    tag: `v${plan.version}`,
    platform: 'mac',
    arch: plan.arch,
    signing: plan.signing || 'unknown',
    createdAt: new Date().toISOString(),
    assets: [
      assetInfo(plan.zipPath),
      assetInfo(plan.dmgPath)
    ]
  };
  fs.writeFileSync(plan.manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

function createMacReleaseAssets(options = {}) {
  const packageJson = require(path.join(PROJECT_ROOT, 'package.json'));
  const plan = buildReleaseAssetPlan({
    root: PROJECT_ROOT,
    appName: process.env.APP_NAME || options.appName || 'Focus Pet',
    version: options.version || packageJson.version,
    arch: process.env.RELEASE_ARCH || options.arch || process.arch
  });
  fs.rmSync(plan.releaseDir, { recursive: true, force: true });
  fs.mkdirSync(plan.releaseDir, { recursive: true });
  run(process.execPath, [path.join(PROJECT_ROOT, 'scripts', 'package-macos.js')]);
  if (!fs.existsSync(plan.appPath)) throw new Error(`App bundle 不存在：${plan.appPath}`);
  plan.signing = signAppForRelease(plan);
  createZip(plan);
  createDmg(plan);
  const manifest = writeManifest(plan);
  fs.rmSync(plan.stagingDir, { recursive: true, force: true });
  console.log(JSON.stringify({
    ok: true,
    releaseDir: plan.releaseDir,
    zip: plan.zipPath,
    dmg: plan.dmgPath,
    manifest: plan.manifestPath,
    assets: manifest.assets
  }, null, 2));
  return { plan, manifest };
}

if (require.main === module) {
  createMacReleaseAssets();
}

module.exports = {
  buildReleaseAssetPlan,
  createMacReleaseAssets,
  filePart
};
