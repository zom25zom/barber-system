#!/usr/bin/env node
/**
 * Automated tenant-link consistency audit.
 *
 * Fails when any component that can render inside a [salonSlug] context uses a
 * hardcoded internal route instead of the centralized tenant-link helpers
 * (useTenantLink / buildTenantUrl / withSlug).
 *
 * Run: node scripts/check-tenant-links.mjs   (exit 0 = pass, exit 1 = violations)
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";

// fileURLToPath: URL.pathname leaves %20 (e.g. spaces in the repo folder)
// encoded, which makes readdirSync fail silently on Windows → empty audit.
const WEB = fileURLToPath(new URL("../apps/web", import.meta.url));
const SCAN_DIRS = ["app", "components"];
const EXTS = [".tsx", ".ts"];

// Shared components/pages rendered BOTH at root routes and under /[salonSlug]/*
// are exactly where hardcoded tenant routes are dangerous.
const TENANT_CONTEXT_FILES = [
  "components/pages/",
  "components/CustomerBottomBar.tsx",
  "components/Navbar.tsx",
  "components/BookingCountdown.tsx",
];

const ALLOWED = [
  /^\/admin/, // admin panel is session-global by design
  /^\/signup/,
  /^\/manifest/,
  /^\/api\//, // fetch URLs are handled separately by withSlug()
  /^\/icon|^\/favicon/,

  // static assets
];
const isAllowed = (p) => ALLOWED.some((re) => re.test(p));

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (EXTS.some((e) => name.endsWith(e))) yield full;
  }
}

let violations = 0;
for (const dir of SCAN_DIRS) {
  try {
    for (const file of walk(join(WEB, dir))) {
      const rel = relative(WEB, file).replace(/\\/g, "/");
      const isTenantFile = TENANT_CONTEXT_FILES.some((t) => rel.startsWith(t));
      // Under app/: only root-level customer pages share components with tenants;
      // [salonSlug] page wrappers and admin pages are exempt.
      const isRootCustomerPage =
        rel.startsWith("app/") &&
        !rel.includes("[salonSlug]") &&
        !rel.includes("admin") &&
        /\.(tsx|ts)$/.test(rel);

      if (!isTenantFile && !isRootCustomerPage) continue;

      const src = readFileSync(file, "utf8");

      // router.push/replace with string literals
      const navRe = /\brouter\s*\.\s*(push|replace)\s*\(\s*(["'`])(\/[^"'`]*)\2/g;
      let m;
      while ((m = navRe.exec(src)) !== null) {
        if (!isAllowed(m[3])) {
          console.error(`❌ ${rel}: router.${m[1]}("${m[3]}") — use tLink.push/replace from useTenantLink()`);
          violations++;
        }
      }

      // <Link href="/..."> string literals (skip template literals and tel:/http)
      const linkRe = /<Link\b[^>]*?\bhref=(["'])(\/[^"'{]*)\1/gs;
      while ((m = linkRe.exec(src)) !== null) {
        if (!isAllowed(m[2])) {
          console.error(`❌ ${rel}: <Link href="${m[2]}"> — use useTenantLink().href("/${m[2].slice(1)}")`);
          violations++;
        }
      }
    }
  } catch (e) {
    /* dir missing */
  }
}

if (violations > 0) {
  console.error(`\n🚫 ${violations} tenant-link violation(s). Fix them via lib/salonTenant.ts helpers.`);
  process.exit(1);
}
console.log("✅ Tenant-link audit passed — no hardcoded internal routes bypassing useTenantLink().");
