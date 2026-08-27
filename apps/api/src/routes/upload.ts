import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';
import { requireOwner } from './auth';

export const uploadRoutes = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
  'image/avif',
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Multi-tenant storage layout:
 *   R2 / D1 key = salons/{salon_id}/{timestamp}_{rand}.{ext}
 * The tenant is derived from the OWNER SESSION (never client input), so one
 * salon can never write into — or read another salon's folder namespace.
 */
uploadRoutes.post('/upload', requireOwner, async (c) => {
  try {
    const salonId: number = c.get('salonId');

    const formData = await c.req.formData();
    const file = (formData.get('file') || formData.get('image')) as File | null;

    if (!file || typeof file === 'string' || !(file instanceof File)) {
      return c.json({ error: 'يرجى اختيار ملف صورة صالح' }, 400);
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return c.json(
        { error: 'نوع الملف غير مدعوم. الصيغ المسموحة: JPG, PNG, WEBP, GIF, SVG, AVIF' },
        400,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: 'حجم الصورة كبير جداً (الحد الأقصى 5 ميجابايت)' }, 400);
    }

    const extMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
    // Per-salon folder inside the bucket (e.g. salons/7/barbers_xyz.jpg)
    const key = `salons/${salonId}/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);

    let uploadedToR2 = false;
    if (c.env.BUCKET) {
      try {
        await c.env.BUCKET.put(key, arrayBuffer, {
          httpMetadata: { contentType: file.type },
        });
        uploadedToR2 = true;
      } catch (err) {
        console.warn(`[Upload] R2 upload failed for ${key}, falling back to D1 storage:`, err);
      }
    }

    if (!uploadedToR2) {
      await c.env.DB.prepare(
        'INSERT OR REPLACE INTO uploads (key, content_type, data) VALUES (?, ?, ?)',
      )
        .bind(key, file.type, uint8)
        .run();
    }

    console.log(`[Upload] ✓ salon=${salonId} stored "${key}" via ${uploadedToR2 ? 'R2' : 'D1-fallback'} (${file.size} bytes, ${file.type})`);

    // Absolute URL: in split deployments (SSR web worker ≠ API worker) the
    // browser renders <img> from the WEB domain, so a relative path would
    // resolve to the wrong origin and break. Build from this request's origin.
    const fileOrigin = new URL(c.req.url).origin;
    const url = `${fileOrigin}/api/uploads/${key}`;
    return c.json({ ok: true, url, key }, 201);
  } catch (err) {
    console.error('[Upload] error:', err);
    return c.json({ error: 'حدث خطأ أثناء رفع الصورة، يرجى المحاولة لاحقاً' }, 500);
  }
});

// GET /api/uploads/* — supports nested per-salon keys (salons/{id}/file.jpg).
// Legacy flat keys (pre-multi-tenant uploads) are still served by the same handler.
uploadRoutes.get('/uploads/*', async (c) => {
  let rawKey = c.req.path.replace(/^\/api\/uploads\//, '');
  try {
    rawKey = decodeURIComponent(rawKey);
  } catch {
    // keep raw
  }
  const key = rawKey.split(/[?#]/)[0].trim();

  // Safety validation: allow "/" separators (per-salon folders) but block
  // traversal, backslashes, empty segments and control characters.
  if (
    !key ||
    key.length > 512 ||
    /[\u0000-\u001f\u007f]/.test(key) ||
    key.includes('\\') ||
    key.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')
  ) {
    return c.text('Invalid key', 400);
  }

  // 1. Try R2 if available
  if (c.env.BUCKET) {
    try {
      const obj = await c.env.BUCKET.get(key);
      if (obj) {
        const headers = new Headers();
        headers.set(
          'Content-Type',
          obj.httpMetadata?.contentType || 'image/jpeg',
        );
        headers.set('Cache-Control', 'public, max-age=31536000, immutable');
        headers.set('ETag', obj.httpEtag);
        return new Response(obj.body, { headers });
      }
    } catch (err) {
      console.warn('[Upload] R2 get failed, checking D1:', err);
    }
  }

  // 2. Fallback to D1
  const row = await c.env.DB.prepare(
    'SELECT content_type, data FROM uploads WHERE key = ?',
  )
    .bind(key)
    .first<{ content_type: string; data: any }>();

  if (row && row.data) {
    let bodyBytes: Uint8Array;
    if (row.data instanceof Uint8Array) {
      bodyBytes = row.data;
    } else if (row.data instanceof ArrayBuffer) {
      bodyBytes = new Uint8Array(row.data);
    } else if (Array.isArray(row.data)) {
      bodyBytes = new Uint8Array(row.data);
    } else if (typeof row.data === 'string') {
      bodyBytes = new TextEncoder().encode(row.data);
    } else {
      bodyBytes = new Uint8Array(row.data);
    }

    const headers = new Headers();
    headers.set('Content-Type', row.content_type || 'image/jpeg');
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new Response(bodyBytes, { headers });
  }

  return c.text('Not found', 404);
});
