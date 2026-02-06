import "./TitleBar.css";

export function TitleBar() {
  return (
    <div className="titlebar" data-tauri-drag-region>
      <div className="titlebar__left">
        <div className="titlebar__logo">
          <span className="titlebar__logo-icon">◇</span>
          <span className="titlebar__logo-text">OpenSilicon</span>
        </div>
        <nav className="titlebar__menu">
          <button className="titlebar__menu-item">File</button>
          <button className="titlebar__menu-item">Edit</button>
          <button className="titlebar__menu-item">View</button>
          <button className="titlebar__menu-item">Layout</button>
          <button className="titlebar__menu-item">Simulate</button>
          <button className="titlebar__menu-item">Tools</button>
          <button className="titlebar__menu-item">Help</button>
        </nav>
      </div>
      <div className="titlebar__center" data-tauri-drag-region>
        <span className="titlebar__project-name">Untitled Project — OpenSilicon</span>
      </div>
      <div className="titlebar__right">
        {/* Window controls will be managed by Tauri */}
      </div>
    </div>
  );
}
