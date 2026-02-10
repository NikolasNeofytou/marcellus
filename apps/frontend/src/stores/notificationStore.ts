/**
 * Notification Center Store — extends the toast system with persistent
 * notification history, a bell indicator, and filtering.
 */

import { create } from "zustand";
import type { ToastSeverity } from "./toastStore";

export interface Notification {
  id: string;
  message: string;
  severity: ToastSeverity;
  source?: string;         // e.g. "DRC", "Build", "HDL Parser"
  timestamp: number;
  read: boolean;
  /** Optional action label + callback id */
  action?: { label: string; commandId: string };
}

interface NotificationState {
  notifications: Notification[];
  /** Whether the notification center panel is open */
  isOpen: boolean;
  /** Filter: show all, or filter by severity */
  filter: "all" | ToastSeverity;

  // ── Actions ──
  addNotification: (
    message: string,
    severity?: ToastSeverity,
    source?: string,
    action?: { label: string; commandId: string },
  ) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  setFilter: (filter: "all" | ToastSeverity) => void;

  // ── Derived ──
  getUnreadCount: () => number;
  getFiltered: () => Notification[];
}

let _nid = 0;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  isOpen: false,
  filter: "all",

  addNotification: (message, severity = "info", source, action) => {
    const id = `notif_${++_nid}`;
    const notif: Notification = {
      id,
      message,
      severity,
      source,
      timestamp: Date.now(),
      read: false,
      action,
    };
    set((s) => ({
      notifications: [notif, ...s.notifications].slice(0, 200), // keep last 200
    }));
  },

  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    })),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
    })),

  removeNotification: (id) =>
    set((s) => ({
      notifications: s.notifications.filter((n) => n.id !== id),
    })),

  clearAll: () => set({ notifications: [] }),

  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
  setFilter: (filter) => set({ filter }),

  getUnreadCount: () => get().notifications.filter((n) => !n.read).length,

  getFiltered: () => {
    const { notifications, filter } = get();
    if (filter === "all") return notifications;
    return notifications.filter((n) => n.severity === filter);
  },
}));
