#!/usr/bin/env node
const cloudService = require('../src/cloud-service');
const { sanitizeLogText } = require('../src/runtime-logger');

let shuttingDown = false;

function printStartup(started) {
  console.log(JSON.stringify({
    service: 'focus-pet-cloud',
    status: 'listening',
    host: started.host,
    port: started.port,
    protocol: started.protocol,
    publicUrl: started.publicUrl,
    dataDir: cloudService.DATA_DIR
  }, null, 2));
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  cloudService.stop();
  console.log(JSON.stringify({ service: 'focus-pet-cloud', status: 'stopped', signal }));
  process.exit(0);
}

function printStartupError(error) {
  console.error(sanitizeLogText(error?.stack || error?.message || error));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', error => {
  printStartupError(error);
  cloudService.stop();
  process.exit(1);
});
process.on('unhandledRejection', error => {
  printStartupError(error);
  cloudService.stop();
  process.exit(1);
});

async function main() {
  cloudService.start();
  printStartup(await cloudService.ready());
}

main();
