#!/usr/bin/env node
/**
 * reset-local-d1.mjs — wipe the LOCAL D1 database (dev only).
 *
 * Deletes the miniflare persist directory for D1 so the next
 * `npm run migrate:local` starts from a fresh, empty database.
 * NEVER touches the remote/production database.
 */
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const apiDir = join(dirname(fileURLToPath(import.meta.url)), "..", "apps", "api");
const d1State = join(apiDir, ".wrangler", "state", "v3", "d1");

if (!existsSync(d1State)) {
  console.log("No local D1 state found — nothing to reset.");
  process.exit(0);
}

try {
  rmSync(d1State, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 });
} catch (err) {
  console.error(
    "❌ Could not delete local D1 state (" + err.code + ").\n" +
      "A `wrangler dev` process is probably still running and holding the file.\n" +
      "Stop it first (Ctrl+C in the dev:api terminal, or: taskkill /F /IM workerd.exe), then re-run.",
  );
  process.exit(1);
}
console.log("✅ Local D1 state deleted:", d1State);

console.log("\nNext steps:");
console.log("  npm run migrate:local   # re-apply all migrations");
console.log("  npm run seed:local      # re-seed realistic test data");
