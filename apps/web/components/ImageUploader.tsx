"use client";

import { useState, useRef } from "react";
import Spinner from "./Spinner";

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("يرجى اختيار ملف صورة صالح (PNG, JPG, WebP, SVG, GIF)");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("حجم الصورة كبير جداً (الحد الأقصى 5 ميجابايت)");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "فشل رفع الصورة");
      }

      onChange(data.url);
    } catch (err) {
      setError((err as Error).message);
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
  };

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-semibold text-zinc-200">{label}</label>}

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-400 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-[10px] text-red-300 hover:underline"
          >
            إغلاق
          </button>
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* Preview box */}
        <div
          className={`relative flex h-20 w-20 shrink-0 items-center justify-center border-2 border-dashed border-zinc-700 bg-zinc-950 overflow-hidden shadow-inner ${
            shape === "circle" ? "rounded-full" : "rounded-2xl"
          }`}
        >
          {uploading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 backdrop-blur-xs">
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
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-200 hover:bg-zinc-700 hover:text-white transition disabled:opacity-50 inline-flex items-center gap-2 active:scale-95"
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
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition active:scale-95"
              >
                🗑 حذف الصورة
              </button>
            )}
          </div>

          {helperText && <p className="text-xs text-zinc-400">{helperText}</p>}
        </div>
      </div>
    </div>
  );
}
