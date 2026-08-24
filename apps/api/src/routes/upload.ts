import { Hono } from 'hono';
import type { Bindings, Variables } from '../types';

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

// POST /api/upload
uploadRoutes.post('/upload', async (c) => {
  try {
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
    const key = `${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${ext}`;
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
        console.warn('R2 upload failed, falling back to D1 storage:', err);
      }
    }

    if (!uploadedToR2) {
      await c.env.DB.prepare(
        'INSERT OR REPLACE INTO uploads (key, content_type, data) VALUES (?, ?, ?)',
      )
        .bind(key, file.type, uint8)
        .run();
    }

    const url = `/api/uploads/${key}`;
    return c.json({ ok: true, url, key }, 201);
  } catch (err) {
    console.error('Upload error:', err);
    return c.json({ error: 'حدث خطأ أثناء رفع الصورة، يرجى المحاولة لاحقاً' }, 500);
  }
});

// GET /api/uploads/:key
uploadRoutes.get('/uploads/:key', async (c) => {
  const key = c.req.param('key');
  if (!key || key.includes('/') || key.includes('\\') || key.includes('..')) {
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
      console.warn('R2 get failed, checking D1:', err);
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
