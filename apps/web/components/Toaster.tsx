"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Toast = { id: number; message: string };

const ToastContext = createContext<(message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

export function ToasterProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed bottom-4 inset-x-4 z-50 flex flex-col items-center gap-2 pointer-events-none sm:inset-x-auto sm:left-4 sm:items-start">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto w-full max-w-sm rounded-lg border border-amber-500/40 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 shadow-lg shadow-black/50"
          >
            <span className="ml-2 inline-block h-2 w-2 rounded-full bg-amber-400 align-middle" />
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
