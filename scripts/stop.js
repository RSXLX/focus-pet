#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { listFocusPetProcesses } = require('./process-utils');

const stateDir = path.join(process.env.HOME || '.', '.hermes', 'focus-watchdog');
const stopPath = path.join(stateDir, 'focus-pet.stop');
fs.mkdirSync(stateDir, { recursive: true });
fs.writeFileSync(stopPath, 'stop');

const pids = listFocusPetProcesses()
  .map(processInfo => processInfo.pid)
  .filter(pid => pid && pid !== process.pid);
for (const pid of pids) {
  try { process.kill(pid, 'SIGTERM'); } catch {}
}
setTimeout(() => {
  for (const pid of pids) {
    try { process.kill(pid, 'SIGKILL'); } catch {}
  }
  console.log(JSON.stringify({ stopped: pids }, null, 2));
}, 800);
