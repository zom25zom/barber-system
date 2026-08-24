"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

export interface ToastFunction {
  (message: string, type?: ToastType, duration?: number): void;
  success: (message?: string, duration?: number) => void;
  error: (message?: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
}

const defaultToastFn: any = () => {};
defaultToastFn.success = () => {};
defaultToastFn.error = () => {};
defaultToastFn.warning = () => {};
defaultToastFn.info = () => {};

const ToastContext = createContext<ToastFunction>(defaultToastFn as ToastFunction);

/**
 * Global helper for dispatching toast events from anywhere (inside or outside React)
 */
export function showToast(
  message: string,
  type: ToastType = "success",
  duration: number = 4500,
) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("app:toast", {
        detail: { message, type, duration },
      }),
    );
  }
}

showToast.success = (message: string = "تم حفظ التغييرات بنجاح ✓", duration: number = 4500) => {
  showToast(message, "success", duration);
};

showToast.error = (
  message: string = "حدث خطأ، يرجى المحاولة مرة أخرى ⚠️",
  duration: number = 5500,
) => {
  showToast(message, "error", duration);
};

showToast.warning = (message: string, duration: number = 5000) => {
  showToast(message, "warning", duration);
};

showToast.info = (message: string, duration: number = 4500) => {
  showToast(message, "info", duration);
};

export function useToast(): ToastFunction {
  return useContext(ToastContext);
}

export function ToasterProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    (message: string, type: ToastType = "success", duration: number = 4500) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      // Translate raw technical messages to user-friendly Arabic
      let friendlyMessage = message;
      if (type === "error") {
        if (
          !message ||
          message.includes("Failed to fetch") ||
          message.includes("NetworkError") ||
          message.includes("Internal Server Error")
        ) {
          friendlyMessage = "تعذر الاتصال بالخادم، يرجى التأكد من اتصال الإنترنت والمحاولة ثانية.";
        } else if (message.includes("Unauthorized") || message.includes("401")) {
          friendlyMessage = "انتهت الجلسة، يرجى إعادة تسجيل الدخول.";
        }
      }

      setToasts((prev) => [...prev, { id, message: friendlyMessage, type, duration }]);

      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    [],
  );

  useEffect(() => {
    const handleCustomToast = (e: Event) => {
      const custom = e as CustomEvent<{ message: string; type?: ToastType; duration?: number }>;
      if (custom.detail?.message) {
        addToast(custom.detail.message, custom.detail.type || "success", custom.detail.duration);
      }
    };

    window.addEventListener("app:toast", handleCustomToast);
    return () => window.removeEventListener("app:toast", handleCustomToast);
  }, [addToast]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toastFn: any = useCallback(
    (message: string, type: ToastType = "success", duration?: number) => {
      addToast(message, type, duration);
    },
    [addToast],
  );

  toastFn.success = useCallback(
    (message: string = "تم حفظ التغييرات بنجاح ✓", duration?: number) => {
      addToast(message, "success", duration);
    },
    [addToast],
  );

  toastFn.error = useCallback(
    (message: string = "حدث خطأ، يرجى المحاولة مرة أخرى ⚠️", duration: number = 5500) => {
      addToast(message, "error", duration);
    },
    [addToast],
  );

  toastFn.warning = useCallback(
    (message: string, duration?: number) => {
      addToast(message, "warning", duration);
    },
    [addToast],
  );

  toastFn.info = useCallback(
    (message: string, duration?: number) => {
      addToast(message, "info", duration);
    },
    [addToast],
  );

  return (
    <ToastContext.Provider value={toastFn as ToastFunction}>
      {children}

      {/* Floating Toast Notification Container */}
      <div
        aria-live="polite"
        className="fixed top-4 inset-x-4 sm:inset-x-auto sm:right-6 z-[99999] pointer-events-none flex flex-col items-center sm:items-end gap-2.5 max-w-md w-full"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={`pointer-events-auto flex items-center justify-between gap-3 w-full rounded-2xl p-4 shadow-2xl backdrop-blur-xl border transition-all animate-in fade-in slide-in-from-top-4 duration-200 ${
              t.type === "success"
                ? "bg-zinc-900/95 border-emerald-500/50 text-emerald-100 shadow-emerald-950/40"
                : t.type === "error"
                  ? "bg-zinc-900/95 border-red-500/50 text-red-100 shadow-red-950/40"
                  : t.type === "warning"
                    ? "bg-zinc-900/95 border-amber-500/50 text-amber-100 shadow-amber-950/40"
                    : "bg-zinc-900/95 border-blue-500/50 text-blue-100 shadow-blue-950/40"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-sm font-black shadow-inner ${
                  t.type === "success"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : t.type === "error"
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : t.type === "warning"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                }`}
              >
                {t.type === "success"
                  ? "✓"
                  : t.type === "error"
                    ? "✕"
                    : t.type === "warning"
                      ? "⚠️"
                      : "ℹ️"}
              </span>
              <p className="text-xs sm:text-sm font-bold leading-snug break-words">
                {t.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="shrink-0 p-1 text-zinc-400 hover:text-zinc-100 transition rounded-lg hover:bg-zinc-800"
              aria-label="إغلاق التنبيه"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

