/**
 * Toast notification store.
 *
 * Provides a queue-based notification system that surfaces
 * success / error / warning / info messages as transient toasts.
 */

import { create } from "zustand";

export type ToastSeverity = "success" | "error" | "warning" | "info";

export interface Toast {
  id: string;
  message: string;
  severity: ToastSeverity;
  /** Auto-dismiss after ms (default 4000, 0 = sticky) */
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  /** Add a toast notification */
  addToast: (message: string, severity?: ToastSeverity, duration?: number) => void;
  /** Remove a toast by id */
  removeToast: (id: string) => void;
}

let _toastId = 0;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],

  addToast: (message, severity = "info", duration = 4000) => {
    const id = `toast_${++_toastId}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, severity, duration }] }));

    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
  },

  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
