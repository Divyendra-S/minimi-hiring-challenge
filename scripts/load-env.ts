import { existsSync } from "node:fs";

// The env files Next.js reads, with its precedence: the shell, then .env.local, then .env.
// process.loadEnvFile never overwrites a variable that is already set.
for (const file of [".env.local", ".env"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}
