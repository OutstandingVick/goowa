// Preload for scripts/demo.ts: makes `agent-native action` print its result
// as one JSON line instead of util.inspect output (which truncates nesting).
const log = console.log;
console.log = (...args) => {
  if (args.length === 1 && args[0] !== null && typeof args[0] === "object") {
    process.stdout.write(`${JSON.stringify(args[0])}\n`);
  } else {
    log(...args);
  }
};
