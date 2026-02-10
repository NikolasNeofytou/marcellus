import { Workspace } from "./components/workspace/Workspace";
import { CommandPalette } from "./components/command-palette/CommandPalette";
import { ToastContainer } from "./components/toast/ToastContainer";
import { NotificationCenter } from "./components/notification/NotificationCenter";
import { NewProjectWizard } from "./components/workspace/NewProjectWizard";
import { useThemeStore } from "./stores/themeStore";
import { useGeometryStore, loadAutosave } from "./stores/geometryStore";
import { useToastStore } from "./stores/toastStore";
import { useEffect, Component, type ReactNode, type ErrorInfo } from "react";
import { createLogger } from "./utils/logger";

const log = createLogger("App");

// Error boundary to surface runtime crashes
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null; info: string }
> {
  state = { error: null as Error | null, info: "" };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
    this.setState({ info: info.componentStack ?? "" });
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, color: "#f44", fontFamily: "monospace", background: "#1e1e1e", height: "100%", overflow: "auto" }}>
          <h2>OpenSilicon — Runtime Error</h2>
          <pre style={{ color: "#ccc", whiteSpace: "pre-wrap" }}>{this.state.error.message}</pre>
          <pre style={{ color: "#888", fontSize: 12, whiteSpace: "pre-wrap" }}>{this.state.error.stack}</pre>
          <pre style={{ color: "#666", fontSize: 11, whiteSpace: "pre-wrap" }}>{this.state.info}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export function App() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // ── Auto-save recovery on startup ──
  useEffect(() => {
    const saved = loadAutosave();
    if (saved && saved.geometries.length > 0) {
      log.info(`Found auto-saved session: ${saved.projectName} (${saved.geometries.length} geometries)`);
      useToastStore.getState().addToast(
        `Recovered unsaved work from "${saved.projectName}" (${saved.geometries.length} geometries). Click the toast to dismiss — data was restored automatically.`,
        "info",
        8000,
      );
      // Restore the geometries into the store
      const store = useGeometryStore.getState();
      for (const geom of saved.geometries) {
        store.addGeometry(geom);
      }
    }
  }, []);

  // ── Unsaved-changes warning ──
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useGeometryStore.getState().modified) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // ── Global unhandled-rejection catcher ──
  useEffect(() => {
    const handler = (e: PromiseRejectionEvent) => {
      log.error("Unhandled promise rejection:", e.reason);
      useToastStore.getState().addToast(
        `Unexpected error: ${e.reason?.message ?? String(e.reason)}`,
        "error",
        6000,
      );
    };
    window.addEventListener("unhandledrejection", handler);
    return () => window.removeEventListener("unhandledrejection", handler);
  }, []);

  return (
    <ErrorBoundary>
      <div className="app" data-theme={theme}>
        <Workspace />
        <CommandPalette />
        <ToastContainer />
        <NotificationCenter />
        <NewProjectWizard />
      </div>
    </ErrorBoundary>
  );
}
