"use client";

import { useState, useRef } from "react";
import Spinner from "./Spinner";
import { useToast } from "./Toaster";
import { API_BASE } from "@/lib/api";
import { getOwnerToken } from "@/lib/auth";

interface ImageUploaderProps {
  value: string | null;
  onChange: (url: string) => void;
  label?: string;
  shape?: "circle" | "rounded";
  helperText?: string;
}

export default function ImageUploader({
  value,
  onChange,
  label = "الصورة",
  shape = "rounded",
  helperText,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      const msg = "يرجى اختيار ملف صورة صالح (PNG, JPG, WebP, SVG, GIF)";
      setError(msg);
      toast.error(msg);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      const msg = "حجم الصورة كبير جداً (الحد الأقصى 5 ميجابايت)";
      setError(msg);
      toast.error(msg);
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Multi-tenant: the upload endpoint is owner-authenticated; the backend
      // derives the salon from the session and stores under salons/{id}/...
      // API_BASE keeps split deployments (web worker ≠ api worker) working.
      const token = getOwnerToken();
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });

      const data = await res.json().catch(() => ({}) as Record<string, unknown>);
      if (!res.ok || !data || typeof data.url !== "string") {
        throw new Error(
          (typeof data.error === "string" && data.error) ||
            (res.status === 401
              ? "انتهت صلاحية جلستك، يرجى تسجيل الدخول من جديد ثم إعادة رفع الصورة"
              : "فشل رفع الصورة"),
        );
      }

      onChange(data.url);
      toast.success("تم رفع الصورة بنجاح ✓");
    } catch (err) {
      // Surface the REAL error so failures are diagnosable
      const msg = (err as Error)?.message || "حدث خطأ أثناء رفع الصورة، يرجى المحاولة مرة أخرى";
      setError(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemove = () => {
    onChange("");
    setError(null);
    toast.info("تمت إزالة الصورة");
  };

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-semibold text-[var(--bs-text)]">{label}</label>}

      {error && (
        <div className="rounded-xl border border-[var(--bs-error)]/40 bg-[var(--bs-error-soft)] p-3 text-xs text-[var(--bs-error)] flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-[10px] text-[var(--bs-error)] opacity-80 hover:underline"
          >
            إغلاق
          </button>
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* Preview box */}
        <div
          className={`relative flex h-20 w-20 shrink-0 items-center justify-center border-2 border-dashed border-[var(--bs-border-strong)] bg-[var(--bs-bg)] overflow-hidden shadow-inner ${
            shape === "circle" ? "rounded-full" : "rounded-2xl"
          }`}
        >
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--bs-overlay)] backdrop-blur-xs">
              <Spinner size="sm" color="amber" />
            </div>
          ) : value ? (
            <img src={value} alt="Preview" className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl">📷</span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border border-[var(--bs-border-strong)] bg-[var(--bs-surface-raised)] px-4 py-2 text-xs font-semibold text-[var(--bs-text)] hover:bg-[var(--bs-border-strong)] hover:text-[var(--bs-text)] transition disabled:opacity-50 inline-flex items-center gap-2 active:scale-95"
            >
              {uploading ? (
                <>
                  <Spinner size="sm" color="white" />
                  <span>جاري الرفع…</span>
                </>
              ) : (
                <>
                  <span>📁</span>
                  <span>{value ? "تغيير الصورة" : "رفع صورة من الجهاز"}</span>
                </>
              )}
            </button>

            {value && !uploading && (
              <button
                type="button"
                onClick={handleRemove}
                className="rounded-xl border border-[var(--bs-error)]/30 bg-[var(--bs-error-soft)] px-3.5 py-2 text-xs font-semibold text-[var(--bs-error)] hover:bg-[var(--bs-error)]/20 transition active:scale-95"
              >
                🗑 حذف الصورة
              </button>
            )}
          </div>

          {helperText && <p className="text-xs text-[var(--bs-text-muted)]">{helperText}</p>}
        </div>
      </div>
    </div>
  );
}
