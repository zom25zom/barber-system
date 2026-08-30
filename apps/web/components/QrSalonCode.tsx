"use client";

/**
 * QR code generator for a salon's public booking page — admin-only feature.
 *
 * Fully client-side: encodes the tenant-safe public URL (buildTenantUrl("/",
 * slug) — the same rule enforced by scripts/check-tenant-links.mjs), renders
 * the QR on a <canvas> with error-correction level H, optionally overlays the
 * salon logo (from the existing R2 uploads system) in the center, and
 * composes the salon name + URL text below into one downloadable PNG.
 *
 * No backend endpoint, no persistence — regenerated fresh on every render.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { encode } from "uqr";
import { Download } from "lucide-react";
import { buildTenantUrl } from "@/lib/salonTenant";
import { useToast } from "@/components/Toaster";

/** Internal canvas resolution (exported PNG size) — high-DPI print quality */
const CARD_W = 900;
const PADDING = 64;
const QR_AREA = 772; // QR area incl. quiet zone
const QUIET = 40; // quiet zone (white margin) inside the QR area
const MODULES_AREA = QR_AREA - QUIET * 2;
const NAME_FONT_SIZE = 52;
const URL_FONT_SIZE = 26;
const LOGO_PLATE_RATIO = 0.24; // logo plate size as a fraction of the QR modules area

const FONT_STACK = '"IBM Plex Sans Arabic", "Inter", "Segoe UI", system-ui, sans-serif';

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Loads a logo image; resolves null when unavailable. Tries CORS first so
 *  the canvas stays exportable, falls back to a plain load (may taint). */
function loadLogo(src: string, allowRetry = true): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => {
      if (allowRetry && img.crossOrigin) {
        const retry = new Image();
        retry.onload = () => resolve(retry);
        retry.onerror = () => resolve(null);
        retry.src = src;
      } else {
        resolve(null);
      }
    };
    img.src = src;
  });
}

export default function QrSalonCode({
  salonName,
  logoUrl,
  slug,
  primaryColor,
}: {
  salonName: string;
  logoUrl: string | null;
  slug: string | null;
  primaryColor: string;
}) {
  const showToast = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [publicUrl, setPublicUrl] = useState("");
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [generating, setGenerating] = useState(false);

  // Tenant-safe public booking URL — same rule as useTenantLink()/buildTenantUrl
  useEffect(() => {
    if (!slug) return;
    const origin = window.location.origin.replace(/\/+$/, "");
    setPublicUrl(origin + buildTenantUrl("/", slug));
  }, [slug]);

  // Load the salon logo (if any) for the center overlay
  useEffect(() => {
    let cancelled = false;
    if (!logoUrl) {
      setLogoImg(null);
      return;
    }
    loadLogo(logoUrl).then((img) => {
      if (!cancelled) setLogoImg(img);
    });
    return () => {
      cancelled = true;
    };
  }, [logoUrl]);

  /** Draws the composed card. Returns false if the canvas would be tainted
   *  (cross-origin logo without CORS) so the caller can fall back. */
  const draw = useCallback(
    (withLogo: boolean): boolean => {
      const canvas = canvasRef.current;
      if (!canvas || !publicUrl) return false;
      const ctx = canvas.getContext("2d");
      if (!ctx) return false;

      // Ensure the Arabic webfont is ready before measuring/drawing text
      // (synchronous best-effort — the admin UI already uses this font).
      const name = (salonName || "صالون الحلاقة").trim();

      // ── Layout ──
      const qrX = (CARD_W - QR_AREA) / 2;
      const qrY = PADDING;
      ctx.font = `700 ${NAME_FONT_SIZE}px ${FONT_STACK}`;
      const nameWidth = ctx.measureText(name).width;
      ctx.font = `500 ${URL_FONT_SIZE}px ${FONT_STACK}`;
      const urlWidth = ctx.measureText(publicUrl).width;
      const nameY = qrY + QR_AREA + 86;
      const urlY = nameY + 46;
      const accentBarY = urlY + 40;
      const CARD_H = accentBarY + PADDING / 2;

      canvas.width = CARD_W;
      canvas.height = CARD_H;

      // ── Card background (pure white for reliable print/scan) ──
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, CARD_W, CARD_H);

      // ── QR plate: subtle rounded frame around the quiet zone ──
      ctx.strokeStyle = "#e5e7eb";
      ctx.lineWidth = 2;
      roundRectPath(ctx, qrX, qrY, QR_AREA, QR_AREA, 24);
      ctx.stroke();

      // ── QR modules (high-contrast black on white, ECC level H) ──
      const qr = encode(publicUrl, { ecc: "H" });
      const scale = MODULES_AREA / qr.size;
      const offsetX = qrX + QUIET;
      const offsetY = qrY + QUIET;
      ctx.fillStyle = "#000000";
      for (let r = 0; r < qr.size; r++) {
        const row = qr.data[r];
        for (let c = 0; c < qr.size; c++) {
          if (row[c]) {
            // slight bleed (+0.5) avoids hairline gaps between modules
            ctx.fillRect(
              Math.floor(offsetX + c * scale),
              Math.floor(offsetY + r * scale),
              Math.ceil(scale) + 0.5,
              Math.ceil(scale) + 0.5
            );
          }
        }
      }

      // ── Center logo overlay (safe with ECC level H) ──
      if (withLogo && logoImg && logoImg.naturalWidth > 0) {
        const plate = MODULES_AREA * LOGO_PLATE_RATIO;
        const px = qrX + QUIET + (MODULES_AREA - plate) / 2;
        const py = qrY + QUIET + (MODULES_AREA - plate) / 2;

        // white plate with a soft border so the QR "shows through" cleanly
        ctx.fillStyle = "#ffffff";
        roundRectPath(ctx, px, py, plate, plate, plate * 0.22);
        ctx.fill();
        ctx.strokeStyle = "#d1d5db";
        ctx.lineWidth = 2;
        ctx.stroke();

        // logo inside the plate, clipped to rounded corners
        const inner = plate * 0.78;
        const ix = px + (plate - inner) / 2;
        const iy = py + (plate - inner) / 2;
        ctx.save();
        roundRectPath(ctx, ix, iy, inner, inner, inner * 0.2);
        ctx.clip();
        const ratio = logoImg.naturalWidth / logoImg.naturalHeight;
        let dw = inner;
        let dh = inner;
        if (ratio > 1) dh = inner / ratio;
        else dw = inner * ratio;
        ctx.drawImage(logoImg, ix + (inner - dw) / 2, iy + (inner - dh) / 2, dw, dh);
        ctx.restore();
      }

      // ── Salon name (Arabic typography) ──
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.direction = "rtl";
      ctx.fillStyle = "#111111";
      ctx.font = `700 ${NAME_FONT_SIZE}px ${FONT_STACK}`;
      ctx.fillText(name, CARD_W / 2, nameY, CARD_W - PADDING * 2);

      // ── Booking URL ──
      ctx.direction = "ltr";
      ctx.fillStyle = "#6b7280";
      ctx.font = `500 ${URL_FONT_SIZE}px ${FONT_STACK}`;
      ctx.fillText(publicUrl, CARD_W / 2, urlY, CARD_W - PADDING * 2);

      // ── Brand accent bar ──
      const barW = Math.min(220, CARD_W - PADDING * 2);
      ctx.fillStyle = primaryColor || "#f59e0b";
      roundRectPath(ctx, (CARD_W - barW) / 2, accentBarY, barW, 8, 4);
      ctx.fill();

      return true;
    },
    [publicUrl, salonName, logoImg, primaryColor]
  );

  // (Re)draw whenever any input changes — after fonts are ready so the
  // Arabic name renders with IBM Plex Sans Arabic, not a fallback.
  useEffect(() => {
    let cancelled = false;
    const ready = document.fonts?.ready ?? Promise.resolve();
    ready.then(() => {
      if (!cancelled) draw(true);
    });
    return () => {
      cancelled = true;
    };
  }, [draw]);

  async function handleDownload() {
    if (!publicUrl || !slug) return;
    setGenerating(true);
    try {
      // make sure fonts are settled before the final export pass
      await (document.fonts?.ready ?? Promise.resolve());
      let ok = draw(true);
      let blob: Blob | null = null;
      try {
        blob = await new Promise<Blob | null>((res) =>
          canvasRef.current?.toBlob(res, "image/png")
        );
      } catch {
        blob = null; // SecurityError → tainted canvas (cross-origin logo)
      }
      if (!blob) {
        // Tainted canvas (logo loaded without CORS) → export logo-free so the
        // owner still gets a valid, scannable PNG.
        ok = draw(false);
        blob = await new Promise<Blob | null>((res) =>
          canvasRef.current?.toBlob(res, "image/png")
        );
        if (blob && ok) {
          showToast.info("تم التصدير بدون الشعار — صورة الشعار تمنع تصدير الصورة المركبة من المتصفح");
        }
      }
      if (!blob || !ok) {
        showToast.error("تعذّر إنشاء صورة رمز QR، يرجى المحاولة ثانية");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `qr-${slug}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } finally {
      setGenerating(false);
    }
  }

  if (!slug) {
    return (
      <p className="text-sm text-[var(--bs-text-muted)]">
        لا يتوفر رابط عام لهذا الصالون حالياً.
      </p>
    );
  }

  return (
    <div className="flex w-full flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-8">
      {/* Preview — canvas scales responsively on mobile & desktop */}
      <div className="w-full max-w-[300px] shrink-0 rounded-2xl border border-[var(--bs-border)] bg-white p-3 shadow-sm sm:w-auto sm:max-w-[280px]">
        <canvas
          ref={canvasRef}
          className="block h-auto w-full"
          aria-label={`رمز QR لحجز موعد في ${salonName}`}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-center gap-3 text-center sm:items-stretch sm:text-right">
        <p className="text-sm leading-relaxed text-[var(--bs-text-muted)]">
          وجّه كاميرا هاتف الزبون نحو الرمز لفتح صفحة حجز المواعيد العامة
          لصالونك مباشرة. اطبع الرمز وضعه عند الاستقبال أو على واجهة الصالون.
        </p>
        <p
          dir="ltr"
          className="overflow-hidden text-ellipsis whitespace-nowrap rounded-lg bg-[var(--bs-bg)] px-3 py-2 text-left text-xs text-[var(--bs-text-faint)]"
        >
          {publicUrl || "…"}
        </p>
        <button
          type="button"
          onClick={handleDownload}
          disabled={generating || !publicUrl}
          style={{ backgroundColor: primaryColor }}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-[var(--bs-on-primary)] shadow-lg transition-all hover:brightness-110 active:scale-95 disabled:opacity-50 sm:w-auto sm:justify-start sm:py-2.5"
        >
          {generating ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                <path fill="currentColor" className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>جاري التحضير…</span>
            </>
          ) : (
            <>
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>تحميل</span>
            </>
          )}
        </button>
        {logoUrl && !logoImg && (
          <p className="text-center text-xs text-[var(--bs-text-faint)] sm:text-right">
            ملاحظة: سيتم تصدير الرمز بدون الشعار (تعذّر تحميل صورة الشعار).
          </p>
        )}
      </div>
    </div>
  );
}
