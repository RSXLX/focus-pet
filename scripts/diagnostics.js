const { buildRuntimeDiagnosticsSummary } = require('../src/diagnostics');

function main() {
  const summary = buildRuntimeDiagnosticsSummary();
  console.log(JSON.stringify(summary, null, 2));
}

main();
