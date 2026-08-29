#!/usr/bin/env node
/**
 * create-super-admin.mjs — one-off command to create the first Super Admin.
 *
 * NO default account is seeded by migrations (deliberate). After deploying
 * the API worker + applying migration 0015, run this ONCE with a strong
 * secret YOU generate:
 *
 *   # 1) generate a strong password (example with openssl):
 *   openssl rand -base64 24
 *
 *   # 2) create the account in the REMOTE production D1:
 *   node scripts/create-super-admin.mjs <username> '<password>' --remote
 *
 *   # or locally (wrangler dev D1) for testing:
 *   node scripts/create-super-admin.mjs <username> '<password>' --local
 *
 * Without --remote/--local the script only prints the SQL (dry-run).
 *
 * The password is hashed with SALTED PBKDF2-SHA256 (100k iterations,
 * 256-bit key) — byte-compatible with the API's WebCrypto verifier
 * (apps/api/src/utils.ts → hashPasswordPBKDF2).
 */
import { webcrypto as crypto } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const PBKDF2_ITERATIONS = 100_000;

async function hashPasswordPBKDF2(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    256,
  );
  const b64 = (bytes) => Buffer.from(bytes).toString("base64");
  return `pbkdf2:sha256:${PBKDF2_ITERATIONS}:${b64(salt)}:${b64(new Uint8Array(bits))}`;
}

const [username, password, mode] = process.argv.slice(2);

if (!username || !password) {
  console.error("Usage: node scripts/create-super-admin.mjs <username> <password> [--remote|--local]");
  console.error("  --remote  apply directly to the production D1 (wrangler d1 execute --remote)");
  console.error("  --local   apply to the local wrangler dev D1");
  console.error("  (no flag) dry-run: print the SQL only");
  process.exit(1);
}

if (password.length < 12) {
  console.error("⚠ Refusing: the password must be at least 12 characters (this account controls the platform).");
  process.exit(1);
}

if (!/^[a-zA-Z0-9_-]{2,50}$/.test(username)) {
  console.error("⚠ Username must be 2-50 chars of [a-zA-Z0-9_-] (matches API username validation).");
  process.exit(1);
}

const hash = await hashPasswordPBKDF2(password);
const sql =
  `INSERT INTO super_admins (username, password_hash) VALUES ('${username.replace(/'/g, "''")}', '${hash}');`;

if (!mode) {
  console.log("── Dry run — SQL to create the Super Admin ──\n");
  console.log(sql);
  console.log("\nRe-run with --remote (production) or --local (dev) to apply it via wrangler.");
  process.exit(0);
}

const flag = mode === "--remote" ? "--remote" : "--local";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// wrangler may be hoisted to the workspace root or installed per-app
const wrCandidates = [
  join(root, "node_modules", "wrangler", "bin", "wrangler.js"),
  join(root, "apps", "api", "node_modules", "wrangler", "bin", "wrangler.js"),
];
const wr = wrCandidates.find((p) => existsSync(p));
if (!wr) {
  console.error("✖ wrangler binary not found — run `npm install` at the repo root first.");
  process.exit(1);
}
execFileSync(process.execPath, [wr, "d1", "execute", "barber_db", flag, "--command", sql], {
  cwd: join(root, "apps", "api"),
  stdio: "inherit",
});
console.log(`\n✅ Super Admin «${username}» created (${flag}). Keep the password in your password manager — it cannot be recovered.`);
