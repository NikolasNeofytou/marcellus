import { useCommandStore } from "../../stores/commandStore";
import "./WelcomeTab.css";

export function WelcomeTab() {
  const executeCommand = useCommandStore((s) => s.executeCommand);

  return (
    <div className="welcome-tab">
      <div className="welcome-tab__content">
        <div className="welcome-tab__hero">
          <h1 className="welcome-tab__title">
            <span className="welcome-tab__logo">◇</span>
            OpenSilicon
          </h1>
          <p className="welcome-tab__subtitle">
            The Modern VLSI Layout IDE
          </p>
          <p className="welcome-tab__version">v0.1.0-alpha</p>
        </div>

        <div className="welcome-tab__sections">
          <div className="welcome-tab__section">
            <h2>Start</h2>
            <ul>
              <li><button className="welcome-tab__link" onClick={() => executeCommand("file.newLayout")}>New Layout...</button></li>
              <li><button className="welcome-tab__link" onClick={() => executeCommand("file.openFile")}>Open Project File...</button></li>
              <li><button className="welcome-tab__link" onClick={() => executeCommand("layout.loadDemo")}>Load Demo Layout</button></li>
            </ul>
          </div>

          <div className="welcome-tab__section">
            <h2>Quick Actions</h2>
            <ul>
              <li><button className="welcome-tab__link" onClick={() => executeCommand("view.toggleTheme")}>🎨 Toggle Theme <kbd>Ctrl+K T</kbd></button></li>
              <li><button className="welcome-tab__link" onClick={() => executeCommand("drc.runCheck")}>🔍 Run DRC Check <kbd>Ctrl+Shift+D</kbd></button></li>
              <li><button className="welcome-tab__link" onClick={() => executeCommand("pdk.showInfo")}>⚙ Show PDK Info</button></li>
              <li><button className="welcome-tab__link" onClick={() => executeCommand("pdk.showDesignRules")}>📏 Show Design Rules</button></li>
            </ul>
          </div>

          <div className="welcome-tab__section">
            <h2>Supported PDKs</h2>
            <div className="welcome-tab__pdks">
              <span className="welcome-tab__pdk">SKY130</span>
              <span className="welcome-tab__pdk welcome-tab__pdk--soon">GF180MCU</span>
              <span className="welcome-tab__pdk welcome-tab__pdk--soon">IHP SG13G2</span>
              <span className="welcome-tab__pdk welcome-tab__pdk--soon">ASAP7</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
