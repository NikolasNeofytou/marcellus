/**
 * NotificationCenter — dropdown panel showing notification history.
 * Activated from the bell icon in the StatusBar.
 */

import { useNotificationStore } from "../../stores/notificationStore";
import type { ToastSeverity } from "../../stores/toastStore";
import {
  Bell,
  BellOff,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  X,
  Trash2,
  CheckCheck,
  Filter,
} from "lucide-react";
import type { ReactElement } from "react";
import "./NotificationCenter.css";

const SEV_ICON: Record<ToastSeverity, ReactElement> = {
  success: <CheckCircle2 size={13} />,
  error: <XCircle size={13} />,
  warning: <AlertTriangle size={13} />,
  info: <Info size={13} />,
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

export function NotificationCenter() {
  const isOpen = useNotificationStore((s) => s.isOpen);
  const filter = useNotificationStore((s) => s.filter);
  const setOpen = useNotificationStore((s) => s.setOpen);
  const setFilter = useNotificationStore((s) => s.setFilter);
  const markRead = useNotificationStore((s) => s.markRead);
  const markAllRead = useNotificationStore((s) => s.markAllRead);
  const removeNotification = useNotificationStore((s) => s.removeNotification);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const getUnreadCount = useNotificationStore((s) => s.getUnreadCount);
  const getFiltered = useNotificationStore((s) => s.getFiltered);

  const unread = getUnreadCount();
  const filtered = getFiltered();

  if (!isOpen) return null;

  return (
    <div className="notif-center" role="dialog" aria-label="Notification Center">
      {/* Backdrop */}
      <div className="notif-center__backdrop" onClick={() => setOpen(false)} />

      <div className="notif-center__panel">
        {/* Header */}
        <div className="notif-center__header">
          <span className="notif-center__title">
            <Bell size={14} /> Notifications
            {unread > 0 && <span className="notif-center__badge">{unread}</span>}
          </span>
          <div className="notif-center__actions">
            <button
              className="notif-center__action"
              title="Mark all read"
              onClick={markAllRead}
            >
              <CheckCheck size={13} />
            </button>
            <button
              className="notif-center__action"
              title="Clear all"
              onClick={clearAll}
            >
              <Trash2 size={13} />
            </button>
            <button
              className="notif-center__action"
              title="Close"
              onClick={() => setOpen(false)}
            >
              <X size={13} />
            </button>
          </div>
        </div>

        {/* Filter row */}
        <div className="notif-center__filters">
          <Filter size={11} />
          {(["all", "error", "warning", "info", "success"] as const).map((f) => (
            <button
              key={f}
              className={`notif-center__filter ${filter === f ? "notif-center__filter--active" : ""}`}
              onClick={() => setFilter(f)}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="notif-center__list">
          {filtered.length === 0 && (
            <div className="notif-center__empty">
              <BellOff size={32} style={{ opacity: 0.3 }} />
              <span>No notifications</span>
            </div>
          )}
          {filtered.map((n) => (
            <div
              key={n.id}
              className={`notif-center__item notif-center__item--${n.severity} ${n.read ? "" : "notif-center__item--unread"}`}
              onClick={() => markRead(n.id)}
            >
              <span className="notif-center__sev-icon">{SEV_ICON[n.severity]}</span>
              <div className="notif-center__body">
                <div className="notif-center__msg">{n.message}</div>
                <div className="notif-center__meta">
                  {n.source && <span className="notif-center__source">{n.source}</span>}
                  <span className="notif-center__time">{timeAgo(n.timestamp)}</span>
                </div>
              </div>
              <button
                className="notif-center__dismiss"
                title="Dismiss"
                onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
