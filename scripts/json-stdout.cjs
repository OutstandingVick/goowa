// Preload for scripts/demo.ts: makes `agent-native action` print its result
// as one JSON line instead of util.inspect output (which truncates nesting).
const { writeSync } = require("node:fs");

const log = console.log;
console.log = (...args) => {
  if (args.length === 1 && args[0] !== null && typeof args[0] === "object") {
    // Synchronous: the CLI exits right after printing, and an async write to
    // a pipe would be cut off at the first 64 KB.
    writeSync(1, `${JSON.stringify(args[0])}\n`);
  } else {
    log(...args);
  }
};
