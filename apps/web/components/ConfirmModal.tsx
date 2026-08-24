"use client";

import { useEffect } from "react";
import Spinner from "./Spinner";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "primary";
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = "تأكيد",
  cancelText = "إلغاء",
  variant = "danger",
  isLoading = false,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoading) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: "🗑️",
      iconBg: "bg-red-500/15 border-red-500/30 text-red-400",
      confirmBtn: "bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-950/50",
    },
    warning: {
      icon: "⚠️",
      iconBg: "bg-amber-500/15 border-amber-500/30 text-amber-400",
      confirmBtn: "bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-950/50",
    },
    primary: {
      icon: "❓",
      iconBg: "bg-blue-500/15 border-blue-500/30 text-blue-400",
      confirmBtn: "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-950/50",
    },
  };

  const currentStyle = variantStyles[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm transition-opacity animate-in fade-in"
        onClick={() => {
          if (!isLoading) onClose();
        }}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${currentStyle.iconBg} text-2xl`}>
            {currentStyle.icon}
          </div>
          <div className="flex-1 text-right">
            <h3 className="text-lg font-bold text-zinc-100">{title}</h3>
            <p className="mt-1.5 text-sm text-zinc-300 leading-relaxed">{message}</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex items-center justify-end gap-3 border-t border-zinc-800/80 pt-4">
          <button
            type="button"
            disabled={isLoading}
            onClick={onClose}
            className="rounded-xl border border-zinc-700 bg-zinc-800/60 px-5 py-2.5 text-sm font-medium text-zinc-300 hover:bg-zinc-800 hover:text-white transition disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={onConfirm}
            className={`inline-flex items-center gap-2 rounded-xl px-6 py-2.5 text-sm font-bold transition active:scale-95 disabled:opacity-50 ${currentStyle.confirmBtn}`}
          >
            {isLoading ? (
              <>
                <Spinner size="sm" color={variant === "warning" ? "zinc" : "white"} />
                <span>جاري التنفيذ…</span>
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
