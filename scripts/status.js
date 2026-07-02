const http = require('node:http');
const { listFocusPetProcesses } = require('./process-utils');

function getJson(port) {
  return new Promise(resolve => {
    const req = http.get(`http://127.0.0.1:${port}/api/state`, { timeout: 500 }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve({ port, ok: true, state: JSON.parse(body) }); }
        catch { resolve({ port, ok: false }); }
      });
    });
    req.on('timeout', () => { req.destroy(); resolve({ port, ok: false }); });
    req.on('error', () => resolve({ port, ok: false }));
  });
}

async function main() {
  const ports = await Promise.all(Array.from({ length: 10 }, (_, index) => getJson(47321 + index)));
  const live = ports.filter(item => item.ok);
  const processRows = listFocusPetProcesses();
  const processes = processRows.map(processInfo => processInfo.pid).join('\n');
  console.log(JSON.stringify({
    livePorts: live.map(item => ({ port: item.port, friends: item.state.friends?.length || 0, messages: item.state.messages?.length || 0 })),
    processCount: processRows.length,
    processes
  }, null, 2));
}

main().catch(error => { console.error(error); process.exit(1); });
