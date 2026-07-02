#!/usr/bin/env node
const { spawnSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const generatorPath = path.join(projectRoot, 'scripts', 'generate-pet-animations.py');
const bundledPython = path.join(
  os.homedir(),
  '.cache',
  'codex-runtimes',
  'codex-primary-runtime',
  'dependencies',
  'python',
  'bin',
  'python3'
);

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function canImportPillow(python) {
  const result = spawnSync(python, ['-c', 'from PIL import Image'], {
    cwd: projectRoot,
    encoding: 'utf8'
  });
  return result.status === 0;
}

function runGenerator(python) {
  return spawnSync(python, [generatorPath, ...process.argv.slice(2)], {
    cwd: projectRoot,
    env: process.env,
    stdio: 'inherit'
  });
}

const candidates = unique([
  process.env.FOCUS_PET_PYTHON,
  process.env.PYTHON,
  'python3',
  bundledPython
]);

for (const python of candidates) {
  if (!canImportPillow(python)) continue;
  const result = runGenerator(python);
  process.exit(result.status ?? 1);
}

console.error('Unable to run pet animation generator: no Python candidate can import Pillow/PIL.');
console.error('Install Pillow for python3 or set FOCUS_PET_PYTHON to a Python executable with Pillow.');
process.exit(1);
