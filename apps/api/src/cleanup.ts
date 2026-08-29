import type { D1Database, R2Bucket } from '@cloudflare/workers-types';

const UPLOAD_URL_MARKER = '/api/uploads/';

/**
 * Deletes expired owner session rows (sessions table grows forever otherwise).
 * Called from the worker's daily cron trigger (see index.ts scheduled handler
 * and wrangler.toml [triggers]). Backed by idx_sessions_expiry (migration 0014).
 *
 * @returns number of rows deleted (0 on failure — cleanup is best-effort)
 */
export async function purgeExpiredSessions(db: D1Database): Promise<number> {
  try {
    const res = await db.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
    return res.meta.changes ?? 0;
  } catch (err) {
    console.warn('[cleanup] expired-session purge failed:', err);
    return 0;
  }
}

/**
 * Deletes an old uploaded file (from R2 and its D1 fallback row) that is no longer referenced.
 *
 * - Returns true immediately when there is nothing to clean up
 *   (no old URL, external URL, data URI, or URL identical to the new one).
 * - Returns false only if the R2 deletion itself failed, so callers can decide
 *   whether to persist the new reference or not.
 */
export async function deleteOldUpload(
  db: D1Database,
  bucket: R2Bucket | undefined,
  oldUrl: string | null | undefined,
  newUrl?: string | null,
): Promise<boolean> {
  // 1) No old link — nothing to do
  if (!oldUrl || typeof oldUrl !== 'string') return true;

  const trimmed = oldUrl.trim();
  if (!trimmed) return true;

  // 2) Same file being kept — never delete
  if (newUrl && trimmed === String(newUrl).trim()) return true;

  // 3) Only our own upload URLs are deletable (data URIs / external URLs are not)
  const markerIdx = trimmed.indexOf(UPLOAD_URL_MARKER);
  if (markerIdx === -1) return true;

  let key: string;
  try {
    key = decodeURIComponent(trimmed.slice(markerIdx + UPLOAD_URL_MARKER.length).split(/[?#]/)[0].trim());
  } catch {
    key = trimmed.slice(markerIdx + UPLOAD_URL_MARKER.length).split(/[?#]/)[0].trim();
  }

  // Guard against malformed/path-traversal keys.
  // Nested per-salon keys (salons/{id}/file.jpg) ARE allowed — only the
  // separator "/" is legal; backslashes, empty/dot segments are rejected.
  if (
    !key ||
    key.length > 512 ||
    key.includes('\\') ||
    /[^\x20-\x7e]/.test(key) ||
    key.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')
  ) {
    return true;
  }

  let r2Deleted = true;

  // 4) Delete from R2
  if (bucket) {
    try {
      await bucket.delete(key);
    } catch (err) {
      console.warn('[cleanup] R2 delete failed for key:', key, err);
      r2Deleted = false;
    }
  }

  // 5) Best-effort cleanup of the D1 fallback storage (used when R2 unavailable)
  try {
    await db.prepare('DELETE FROM uploads WHERE key = ?').bind(key).run();
  } catch (err) {
    console.warn('[cleanup] D1 uploads row delete failed for key:', key, err);
  }

  return r2Deleted;
}
