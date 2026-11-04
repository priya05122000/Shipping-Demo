"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertIcon, CheckCircleIcon, XIcon } from "@/components/ui/icons";

type ToastVariant = "success" | "error";

interface Toast {
  id: number;
  variant: ToastVariant;
  title: string;
  message?: string;
}

interface ToastApi {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATION: Record<ToastVariant, number> = { success: 3500, error: 6000 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, title: string, message?: string) => {
      const id = nextId.current++;
      setToasts((current) => [...current.slice(-3), { id, variant, title, message }]);
      setTimeout(() => dismiss(id), DURATION[variant]);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, message) => push("success", title, message),
      error: (title, message) => push("error", title, message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Above modals (z-40) so errors stay visible while a form is open. */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.variant === "error" ? "alert" : "status"}
            className="animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl bg-white/95 p-4 shadow-2xl ring-1 shadow-slate-950/15 ring-slate-900/10 backdrop-blur"
          >
            {toast.variant === "success" ? (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-200/70">
                <CheckCircleIcon className="size-4.5 text-emerald-600" />
              </span>
            ) : (
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-red-50 ring-1 ring-red-200/70">
                <AlertIcon className="size-4.5 text-red-600" />
              </span>
            )}
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
              {toast.message && <p className="mt-1 text-sm text-slate-500">{toast.message}</p>}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="-m-1 rounded p-1 text-slate-400 hover:text-slate-600"
              aria-label="Dismiss notification"
            >
              <XIcon className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used within <ToastProvider>.");
  return api;
}
