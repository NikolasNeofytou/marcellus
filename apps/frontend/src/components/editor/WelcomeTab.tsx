import { useCommandStore } from "../../stores/commandStore";
import {
  Palette,
  Search,
  Settings,
  BookOpen,
  FilePlus,
  FolderOpen,
  Play,
  Cpu,
} from "lucide-react";
import "./WelcomeTab.css";

export function WelcomeTab() {
  const executeCommand = useCommandStore((s) => s.executeCommand);

  return (
    <div className="welcome-tab">
      <div className="welcome-tab__content">
        <div className="welcome-tab__hero">
          <div className="welcome-tab__logo-mark">
            <Cpu size={48} strokeWidth={1.2} />
          </div>
          <h1 className="welcome-tab__title">
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
              <li><button className="welcome-tab__link" onClick={() => executeCommand("file.newLayout")}><FilePlus size={14} /> New Layout...</button></li>
              <li><button className="welcome-tab__link" onClick={() => executeCommand("file.newSchematic")}><FilePlus size={14} /> New Schematic...</button></li>
              <li><button className="welcome-tab__link" onClick={() => executeCommand("file.openFile")}><FolderOpen size={14} /> Open Project File...</button></li>
              <li><button className="welcome-tab__link" onClick={() => executeCommand("layout.loadDemo")}><Play size={14} /> Load Demo Layout</button></li>
              <li><button className="welcome-tab__link" onClick={() => executeCommand("schematic.loadDemo")}><Play size={14} /> Load Demo Schematic</button></li>
            </ul>
          </div>

          <div className="welcome-tab__section">
            <h2>Quick Actions</h2>
            <ul>
              <li><button className="welcome-tab__link" onClick={() => executeCommand("view.toggleTheme")}><Palette size={14} /> Toggle Theme <kbd>Ctrl+K T</kbd></button></li>
              <li><button className="welcome-tab__link" onClick={() => executeCommand("drc.runCheck")}><Search size={14} /> Run DRC Check <kbd>Ctrl+Shift+D</kbd></button></li>
              <li><button className="welcome-tab__link" onClick={() => executeCommand("pdk.showInfo")}><Settings size={14} /> Show PDK Info</button></li>
              <li><button className="welcome-tab__link" onClick={() => executeCommand("pdk.showDesignRules")}><BookOpen size={14} /> Show Design Rules</button></li>
            </ul>
          </div>

          <div className="welcome-tab__section welcome-tab__section--full">
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
