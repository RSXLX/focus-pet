const { writeDiagnosticsBundle } = require('../src/diagnostics');

function parseArgs(argv = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--output-dir') {
      options.outputDir = argv[index + 1];
      index += 1;
    }
  }
  return options;
}

function main(argv = process.argv.slice(2)) {
  const result = writeDiagnosticsBundle(parseArgs(argv));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = { parseArgs, main };
