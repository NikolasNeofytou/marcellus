import "./WelcomeTab.css";

export function WelcomeTab() {
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
              <li><button className="welcome-tab__link">New Layout...</button></li>
              <li><button className="welcome-tab__link">Open GDS-II File...</button></li>
              <li><button className="welcome-tab__link">Open Project Folder...</button></li>
              <li><button className="welcome-tab__link">Clone Repository...</button></li>
            </ul>
          </div>

          <div className="welcome-tab__section">
            <h2>Recent</h2>
            <p className="welcome-tab__muted">No recent projects</p>
          </div>

          <div className="welcome-tab__section">
            <h2>Quick Actions</h2>
            <ul>
              <li><button className="welcome-tab__link">⌨ Command Palette <kbd>Ctrl+Shift+P</kbd></button></li>
              <li><button className="welcome-tab__link">🎨 Toggle Theme <kbd>Ctrl+K Ctrl+T</kbd></button></li>
              <li><button className="welcome-tab__link">⚙ Settings</button></li>
              <li><button className="welcome-tab__link">📖 Documentation</button></li>
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
