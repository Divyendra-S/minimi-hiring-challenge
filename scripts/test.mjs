// Runs every test/*.test.ts file. The file list is built here because Node 20 does not expand
// a glob itself, and neither does the Windows shell, so "test/*.test.ts" finds nothing there.
// Extra arguments go to the test runner: npm test -- --test-name-pattern="import"
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const files = readdirSync("test")
  .filter((name) => name.endsWith(".test.ts"))
  .map((name) => `test/${name}`);
const args = ["--import", "tsx", "--test", ...process.argv.slice(2), ...files];
const { status } = spawnSync(process.execPath, args, { stdio: "inherit" });
process.exit(status ?? 1);
