const { execFileSync } = require('node:child_process');
const os = require('node:os');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ELECTRON_APP_ROOT = path.join(PROJECT_ROOT, 'node_modules', 'electron', 'dist', 'Electron.app');
const ELECTRON_MAIN = path.join(ELECTRON_APP_ROOT, 'Contents', 'MacOS', 'Electron');
const APP_SUPPORT_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'focus-pet');

function parseProcessLine(line) {
  const match = String(line || '').match(/^\s*(\d+)\s+(.+?)\s*$/);
  if (!match) return null;
  return {
    pid: Number(match[1]),
    command: match[2]
  };
}

function isFocusPetElectronCommand(command, options = {}) {
  const root = options.projectRoot || PROJECT_ROOT;
  const electronAppRoot = options.electronAppRoot || ELECTRON_APP_ROOT;
  const electronMain = options.electronMain || ELECTRON_MAIN;
  const appSupportDir = options.appSupportDir || APP_SUPPORT_DIR;
  const text = String(command || '');

  if (text === `${electronMain} .`) return true;
  if (!text.includes(electronAppRoot)) return false;
  if (text.includes(`--app-path=${root}`)) return true;
  if (text.includes(`--user-data-dir=${appSupportDir}`)) return true;
  return false;
}

function parseFocusPetProcesses(output, options = {}) {
  return String(output || '')
    .split('\n')
    .map(parseProcessLine)
    .filter(Boolean)
    .filter(processInfo => isFocusPetElectronCommand(processInfo.command, options));
}

function listFocusPetProcesses(options = {}) {
  const output = execFileSync('ps', ['-axo', 'pid=,command='], { encoding: 'utf8' });
  return parseFocusPetProcesses(output, options);
}

module.exports = {
  isFocusPetElectronCommand,
  listFocusPetProcesses,
  parseFocusPetProcesses
};
