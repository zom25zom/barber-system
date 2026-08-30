"use client";

/**
 * Global toast system — migrated to shadcn/ui Sonner (Phase 2).
 *
 * PUBLIC API IS UNCHANGED (all existing call sites keep working):
 *   • ToasterProvider  — mount once at root
 *   • useToast()       → toastFn(message, type?, duration?) with .success/.error/.warning/.info
 *   • showToast()      → imperative dispatch outside React (same CustomEvent bridge)
 *   • ToastType, ToastFunction types
 *
 * Rendering is delegated to the Sonner <Toaster/> (ui/sonner.tsx) with
 * palette-harmonized colors. The friendly-message translation logic for
 * network/401 errors is preserved verbatim.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { toast as sonner } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";

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

/** Friendly-message translation (unchanged logic) */
function friendlyMessage(message: string, type: ToastType): string {
  if (type === "error") {
    if (
      !message ||
      message.includes("Failed to fetch") ||
      message.includes("NetworkError") ||
      message.includes("Internal Server Error")
    ) {
      return "تعذر الاتصال بالخادم، يرجى التأكد من اتصال الإنترنت والمحاولة ثانية.";
    }
    if (message.includes("Unauthorized") || message.includes("401")) {
      return "انتهت الجلسة، يرجى إعادة تسجيل الدخول.";
    }
  }
  return message;
}

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5" />,
  error: <XCircle className="h-5 w-5" />,
  warning: <AlertTriangle className="h-5 w-5" />,
  info: <Info className="h-5 w-5" />,
};

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
  message: string = "حدث خطأ، يرجى المحاولة مرة أخرى",
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
  // bridge: window event → sonner (addToast logic preserved)
  const addToastRef = useRef<
    (message: string, type?: ToastType, duration?: number) => void
  >(() => {});

  const addToast = useCallback(
    (message: string, type: ToastType = "success", duration: number = 4500) => {
      const msg = friendlyMessage(message, type);
      const opts = { duration, icon: ICONS[type] };
      if (type === "success") sonner.success(msg, opts);
      else if (type === "error") sonner.error(msg, opts);
      else if (type === "warning") sonner.warning(msg, opts);
      else sonner.info(msg, opts);
    },
    [],
  );
  addToastRef.current = addToast;

  useEffect(() => {
    const handleCustomToast = (e: Event) => {
      const custom = e as CustomEvent<{ message: string; type?: ToastType; duration?: number }>;
      if (custom.detail?.message) {
        addToastRef.current(custom.detail.message, custom.detail.type || "success", custom.detail.duration);
      }
    };

    window.addEventListener("app:toast", handleCustomToast);
    return () => window.removeEventListener("app:toast", handleCustomToast);
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
    (message: string = "حدث خطأ، يرجى المحاولة مرة أخرى", duration?: number) => {
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
      {/* Sonner rendering — palette-harmonized via ui/sonner.tsx + globals.css */}
      <Toaster />
    </ToastContext.Provider>
  );
}
