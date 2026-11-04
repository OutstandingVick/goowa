// Preload for scripts/demo.ts: makes `agent-native action` print its result
// as one JSON line instead of util.inspect output (which truncates nesting).
const { writeSync } = require("node:fs");

// Write every byte, retrying partial writes and EAGAIN on non-blocking pipes.
function writeAll(text) {
  const buf = Buffer.from(text);
  let offset = 0;
  while (offset < buf.length) {
    try {
      offset += writeSync(1, buf, offset);
    } catch (err) {
      if (err.code !== "EAGAIN") throw err;
    }
  }
}

const log = console.log;
console.log = (...args) => {
  if (args.length === 1 && args[0] !== null && typeof args[0] === "object") {
    // Synchronous: the CLI exits right after printing, and an async write to
    // a pipe would be cut off at the first 64 KB.
    writeAll(`${JSON.stringify(args[0])}\n`);
  } else {
    log(...args);
  }
};
