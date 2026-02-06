import { Workspace } from "./components/workspace/Workspace";
import { CommandPalette } from "./components/command-palette/CommandPalette";
import { useThemeStore } from "./stores/themeStore";
import { useEffect, Component, type ReactNode, type ErrorInfo } from "react";

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

  return (
    <ErrorBoundary>
      <div className="app" data-theme={theme}>
        <Workspace />
        <CommandPalette />
      </div>
    </ErrorBoundary>
  );
}
