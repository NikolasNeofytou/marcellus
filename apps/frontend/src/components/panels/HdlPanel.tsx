/**
 * HdlPanel — Sidebar panel for HDL module hierarchy, ports,
 * signals, instances, parameters, and diagnostics.
 */

import { useMemo, useState } from "react";
import { useHdlStore } from "../../stores/hdlStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import type { HdlModule, HdlLanguage } from "../../engines/hdlParser";
import {
  FileCode,
  ChevronRight,
  AlertTriangle,
  XCircle,
  Info,
  Cpu,
  Cable,
  Waypoints,
  Settings2,
} from "lucide-react";
import "./HdlPanel.css";

type PanelTab = "hierarchy" | "files" | "diagnostics";

export function HdlPanel() {
  const [activeTab, setActiveTab] = useState<PanelTab>("hierarchy");

  return (
    <div className="hdl-panel">
      <div className="hdl-panel__tabs">
        {(["hierarchy", "files", "diagnostics"] as PanelTab[]).map((tab) => (
          <div
            key={tab}
            className={`hdl-panel__tab ${activeTab === tab ? "hdl-panel__tab--active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </div>
        ))}
      </div>
      <div className="hdl-panel__content">
        {activeTab === "hierarchy" && <HierarchyView />}
        {activeTab === "files" && <FilesView />}
        {activeTab === "diagnostics" && <DiagnosticsView />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hierarchy View                                                    */
/* ------------------------------------------------------------------ */

function HierarchyView() {
  const getAllModules = useHdlStore((s) => s.getAllModules);
  const expandedModules = useHdlStore((s) => s.expandedModules);
  const toggleModuleExpanded = useHdlStore((s) => s.toggleModuleExpanded);
  const selectedModule = useHdlStore((s) => s.selectedModule);
  const setSelectedModule = useHdlStore((s) => s.setSelectedModule);
  const newFile = useHdlStore((s) => s.newFile);
  const addTab = useWorkspaceStore((s) => s.addTab);

  const modules = getAllModules();

  const handleNewFile = (lang: HdlLanguage) => {
    const id = newFile(lang);
    addTab({
      id: `hdl-tab-${id}`,
      title: `untitled${lang === "vhdl" ? ".vhd" : lang === "systemverilog" ? ".sv" : ".v"}`,
      type: "hdl",
      modified: false,
    });
  };

  if (modules.length === 0) {
    return (
      <div className="hdl-panel__empty">
        <Cpu size={32} style={{ opacity: 0.3 }} />
        <div>No HDL modules</div>
        <div style={{ fontSize: 10 }}>Open or create an HDL file to see the module hierarchy</div>
        <button className="hdl-panel__empty-btn" onClick={() => handleNewFile("verilog")}>
          New Verilog File
        </button>
      </div>
    );
  }

  return (
    <>
      {modules.map((mod) => (
        <ModuleCard
          key={`${mod.name}-${mod.startLine}`}
          module={mod}
          expanded={expandedModules.has(mod.name)}
          selected={selectedModule === mod.name}
          onToggle={() => toggleModuleExpanded(mod.name)}
          onSelect={() => setSelectedModule(mod.name === selectedModule ? null : mod.name)}
        />
      ))}
    </>
  );
}

/* ── Module Card ── */

function ModuleCard({
  module: mod,
  expanded,
  selected,
  onToggle,
  onSelect,
}: {
  module: HdlModule;
  expanded: boolean;
  selected: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  return (
    <div className={`hdl-panel__module ${selected ? "hdl-panel__module--selected" : ""}`}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}
        onClick={() => { onToggle(); onSelect(); }}
      >
        <ChevronRight
          size={12}
          className={`hdl-panel__section-chevron ${expanded ? "hdl-panel__section-chevron--open" : ""}`}
        />
        <span className="hdl-panel__module-name">{mod.name}</span>
        <span className="hdl-panel__module-lang">
          {mod.language === "systemverilog" ? "SV" : mod.language === "vhdl" ? "VHDL" : "V"}
        </span>
      </div>
      <div className="hdl-panel__module-meta">
        <span>{mod.ports.length} ports</span>
        <span>{mod.signals.length} signals</span>
        <span>{mod.instances.length} instances</span>
        <span>L{mod.startLine}–{mod.endLine}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 6 }}>
          {/* Ports */}
          {mod.ports.length > 0 && (
            <CollapsibleSection title="Ports" icon={<Cable size={11} />} count={mod.ports.length} defaultOpen>
              <div className="hdl-panel__ports">
                {mod.ports.map((p, i) => (
                  <div key={i} className="hdl-panel__port">
                    <span className={`hdl-panel__port-dir hdl-panel__port-dir--${p.direction}`}>
                      {p.direction === "input" ? "IN" : p.direction === "output" ? "OUT" : "IO"}
                    </span>
                    <span className="hdl-panel__port-name">{p.name}</span>
                    {p.width > 1 && (
                      <span className="hdl-panel__port-width">{p.range ?? `[${p.width - 1}:0]`}</span>
                    )}
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Parameters */}
          {mod.parameters.length > 0 && (
            <CollapsibleSection title="Parameters" icon={<Settings2 size={11} />} count={mod.parameters.length}>
              {mod.parameters.map((p, i) => (
                <div key={i} className="hdl-panel__param">
                  <span className="hdl-panel__param-name">{p.name}</span>
                  {p.defaultValue && <span className="hdl-panel__param-value">= {p.defaultValue}</span>}
                </div>
              ))}
            </CollapsibleSection>
          )}

          {/* Signals */}
          {mod.signals.length > 0 && (
            <CollapsibleSection title="Signals" icon={<Waypoints size={11} />} count={mod.signals.length}>
              {mod.signals.map((s, i) => (
                <div key={i} className="hdl-panel__signal">
                  <span className="hdl-panel__signal-type">{s.type}</span>
                  <span className="hdl-panel__signal-name">{s.name}</span>
                  {s.width > 1 && (
                    <span className="hdl-panel__port-width">{s.range ?? `[${s.width - 1}:0]`}</span>
                  )}
                </div>
              ))}
            </CollapsibleSection>
          )}

          {/* Instances */}
          {mod.instances.length > 0 && (
            <CollapsibleSection title="Instances" icon={<Cpu size={11} />} count={mod.instances.length}>
              {mod.instances.map((inst, i) => (
                <div key={i} className="hdl-panel__instance">
                  <span className="hdl-panel__instance-module">{inst.moduleName}</span>
                  <span className="hdl-panel__instance-name">{inst.instanceName}</span>
                  <span className="hdl-panel__instance-conns">
                    {Object.keys(inst.connections).length} conn
                  </span>
                </div>
              ))}
            </CollapsibleSection>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Collapsible Section ── */

function CollapsibleSection({
  title,
  icon,
  count,
  defaultOpen = false,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="hdl-panel__section">
      <div className="hdl-panel__section-header" onClick={() => setOpen(!open)}>
        <ChevronRight
          size={10}
          className={`hdl-panel__section-chevron ${open ? "hdl-panel__section-chevron--open" : ""}`}
        />
        {icon}
        {title}
        {count !== undefined && <span className="hdl-panel__section-count">{count}</span>}
      </div>
      {open && children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Files View                                                        */
/* ------------------------------------------------------------------ */

function FilesView() {
  const files = useHdlStore((s) => s.files);
  const activeFileId = useHdlStore((s) => s.activeFileId);
  const setActiveFile = useHdlStore((s) => s.setActiveFile);

  const fileList = useMemo(() => Array.from(files.values()), [files]);

  if (fileList.length === 0) {
    return (
      <div className="hdl-panel__empty">
        <FileCode size={24} style={{ opacity: 0.3 }} />
        <div>No HDL files open</div>
      </div>
    );
  }

  return (
    <>
      {fileList.map((f) => (
        <div
          key={f.id}
          className={`hdl-panel__file ${f.id === activeFileId ? "hdl-panel__file--active" : ""}`}
          onClick={() => setActiveFile(f.id)}
        >
          <FileCode size={14} />
          {f.modified && <span className="hdl-panel__file-dot">●</span>}
          <span className="hdl-panel__file-name">{f.filename}</span>
          <span className="hdl-panel__file-lang">{f.language.toUpperCase()}</span>
        </div>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Diagnostics View                                                  */
/* ------------------------------------------------------------------ */

function DiagnosticsView() {
  const files = useHdlStore((s) => s.files);

  const allDiags = useMemo(() => {
    const diags: { filename: string; severity: string; message: string; line: number; rule?: string }[] = [];
    for (const f of files.values()) {
      for (const d of f.diagnostics) {
        diags.push({ filename: f.filename, ...d });
      }
    }
    // Sort: errors first, then warnings, then info
    const order = { error: 0, warning: 1, info: 2 };
    diags.sort((a, b) => (order[a.severity as keyof typeof order] ?? 3) - (order[b.severity as keyof typeof order] ?? 3));
    return diags;
  }, [files]);

  if (allDiags.length === 0) {
    return (
      <div className="hdl-panel__empty">
        <AlertTriangle size={24} style={{ opacity: 0.3 }} />
        <div>No diagnostics</div>
        <div style={{ fontSize: 10 }}>Parse an HDL file to see lint results</div>
      </div>
    );
  }

  return (
    <>
      {allDiags.map((d, i) => (
        <div key={i} className="hdl-panel__diag">
          <span className={`hdl-panel__diag-icon hdl-panel__diag-icon--${d.severity}`}>
            {d.severity === "error" ? <XCircle size={13} /> : d.severity === "warning" ? <AlertTriangle size={13} /> : <Info size={13} />}
          </span>
          <div style={{ flex: 1 }}>
            <div className="hdl-panel__diag-message">{d.message}</div>
            {d.rule && <div className="hdl-panel__diag-rule">{d.rule}</div>}
          </div>
          <span className="hdl-panel__diag-line">{d.filename}:{d.line}</span>
        </div>
      ))}
    </>
  );
}
