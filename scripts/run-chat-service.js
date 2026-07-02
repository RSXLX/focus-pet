#!/usr/bin/env node
const chatService = require('../src/chat-service');
const { sanitizeLogText } = require('../src/runtime-logger');

let shuttingDown = false;

function printStartup(started) {
  const state = chatService.publicState();
  console.log(JSON.stringify({
    service: 'focus-pet-chat',
    status: 'listening',
    host: started.host,
    port: started.port,
    protocol: started.protocol,
    publicUrl: started.publicUrl,
    hasInviteUrl: Boolean(state.inviteUrl),
    dataDir: chatService.DATA_DIR
  }, null, 2));
}

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  chatService.stop();
  console.log(JSON.stringify({ service: 'focus-pet-chat', status: 'stopped', signal }));
  process.exit(0);
}

function printStartupError(error) {
  console.error(sanitizeLogText(error?.stack || error?.message || error));
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', error => {
  printStartupError(error);
  chatService.stop();
  process.exit(1);
});
process.on('unhandledRejection', error => {
  printStartupError(error);
  chatService.stop();
  process.exit(1);
});

async function main() {
  chatService.start();
  printStartup(await chatService.ready());
}

main();
