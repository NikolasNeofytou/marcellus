/**
 * Toast container — renders transient notifications at the bottom-right.
 */

import { useToastStore, type ToastSeverity } from "../../stores/toastStore";
import "./ToastContainer.css";

const SEVERITY_ICONS: Record<ToastSeverity, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.severity}`}
          role="alert"
        >
          <span className="toast__icon">{SEVERITY_ICONS[t.severity]}</span>
          <span className="toast__message">{t.message}</span>
          <button
            className="toast__close"
            onClick={() => removeToast(t.id)}
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
