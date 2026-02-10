/**
 * NewProjectWizard — 3-step modal wizard for creating projects.
 *
 * Step 1  BOARD    — Pick your board (or "No board — simulation only").
 *                    Auto-configures toolchain, build system, clock, etc.
 * Step 2  TEMPLATE — Choose a starting template filtered to the board.
 *                    Difficulty badges, file-count hints, preview tree.
 * Step 3  CONFIGURE — Name, location, optional advanced settings.
 *                    Everything has smart defaults so you can just hit "Create".
 *
 * vs MPLAB:  3 clicks vs 6-8 screens.  Board-first, not chip-first.
 */

import { useState, useMemo, useCallback } from "react";
import {
  useProjectTemplateStore,
  type ProjectTemplate,
  type ProjectCategory,
  BUILTIN_TEMPLATES,
} from "../../stores/projectTemplateStore";
import { type BoardProfile, type BoardFamily, BUILTIN_BOARDS } from "../../stores/boardStore";
import {
  X,
  ChevronRight,
  ChevronLeft,
  CircuitBoard,
  Cpu,
  Zap,
  Search,
  FolderOpen,
  Plus,
  Check,
  Loader2,
  AlertCircle,
  Clock,
  FileText,
  GitBranch,
  Settings2,
  ChevronDown,
  ChevronUp,
  Monitor,
  Lightbulb,
  Terminal,
  ToggleLeft,
  Hash,
  Activity,
  Triangle,
  LineChart,
  File,
  Layers,
  Usb,
  Thermometer,
} from "lucide-react";
import "./NewProjectWizard.css";

/* ------------------------------------------------------------------ */
/*  Family labels & icons                                             */
/* ------------------------------------------------------------------ */

const FAMILY_LABELS: Record<BoardFamily, string> = {
  stm32: "STM32",
  esp32: "ESP32",
  nrf52: "nRF52",
  rp2040: "RP2040",
  "fpga-ice40": "iCE40",
  "fpga-ecp5": "ECP5",
  "fpga-xilinx": "Xilinx",
  arduino: "Arduino",
  custom: "Custom",
};

const CATEGORY_LABELS: Record<ProjectCategory | "all", string> = {
  all: "All",
  microcontroller: "Microcontroller",
  fpga: "FPGA",
  asic: "ASIC / Layout",
  "simulation-only": "Simulation Only",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "var(--color-success, #4caf50)",
  intermediate: "var(--color-warning, #ff9800)",
  advanced: "var(--color-error, #f44336)",
};

/* ------------------------------------------------------------------ */
/*  Template icon mapper                                              */
/* ------------------------------------------------------------------ */

function TemplateIcon({ icon, size = 20 }: { icon: string; size?: number }) {
  switch (icon) {
    case "lightbulb":
      return <Lightbulb size={size} />;
    case "terminal":
      return <Terminal size={size} />;
    case "toggle":
      return <ToggleLeft size={size} />;
    case "clock":
      return <Clock size={size} />;
    case "thermometer":
      return <Thermometer size={size} />;
    case "monitor":
      return <Monitor size={size} />;
    case "layers":
      return <Layers size={size} />;
    case "activity":
      return <Activity size={size} />;
    case "usb":
      return <Usb size={size} />;
    case "file":
      return <File size={size} />;
    case "cpu":
      return <Cpu size={size} />;
    case "hash":
      return <Hash size={size} />;
    case "git-branch":
      return <GitBranch size={size} />;
    case "triangle":
      return <Triangle size={size} />;
    case "line-chart":
      return <LineChart size={size} />;
    default:
      return <FileText size={size} />;
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function NewProjectWizard() {
  const isOpen = useProjectTemplateStore((s) => s.isOpen);
  const closeWizard = useProjectTemplateStore((s) => s.closeWizard);
  const currentStep = useProjectTemplateStore((s) => s.currentStep);
  const nextStep = useProjectTemplateStore((s) => s.nextStep);
  const prevStep = useProjectTemplateStore((s) => s.prevStep);
  const selectedBoard = useProjectTemplateStore((s) => s.selectedBoard);
  const selectBoard = useProjectTemplateStore((s) => s.selectBoard);
  const selectedTemplate = useProjectTemplateStore((s) => s.selectedTemplate);
  const selectTemplate = useProjectTemplateStore((s) => s.selectTemplate);
  const config = useProjectTemplateStore((s) => s.config);
  const setConfigField = useProjectTemplateStore((s) => s.setConfigField);
  const getCompatibleTemplates = useProjectTemplateStore((s) => s.getCompatibleTemplates);
  const isCreating = useProjectTemplateStore((s) => s.isCreating);
  const createError = useProjectTemplateStore((s) => s.createError);
  const createProject = useProjectTemplateStore((s) => s.createProject);
  const searchQuery = useProjectTemplateStore((s) => s.searchQuery);
  const setSearchQuery = useProjectTemplateStore((s) => s.setSearchQuery);
  const familyFilter = useProjectTemplateStore((s) => s.familyFilter);
  const setFamilyFilter = useProjectTemplateStore((s) => s.setFamilyFilter);
  const categoryFilter = useProjectTemplateStore((s) => s.categoryFilter);
  const setCategoryFilter = useProjectTemplateStore((s) => s.setCategoryFilter);
  const difficultyFilter = useProjectTemplateStore((s) => s.difficultyFilter);
  const setDifficultyFilter = useProjectTemplateStore((s) => s.setDifficultyFilter);
  const recentProjects = useProjectTemplateStore((s) => s.recentProjects);

  if (!isOpen) return null;

  const stepIndex = currentStep === "board" ? 0 : currentStep === "template" ? 1 : 2;

  const canNext =
    currentStep === "board"
      ? true // board selection is optional (simulation-only)
      : currentStep === "template"
        ? selectedTemplate !== null
        : config.name.trim() !== "";

  return (
    <div className="npw-overlay" onClick={closeWizard}>
      <div className="npw-modal" onClick={(e) => e.stopPropagation()}>
        {/* ---- Header ---- */}
        <div className="npw-header">
          <div className="npw-header-left">
            <Plus size={18} />
            <h2>New Project</h2>
          </div>
          <button className="npw-close" onClick={closeWizard} title="Close">
            <X size={16} />
          </button>
        </div>

        {/* ---- Step indicator ---- */}
        <div className="npw-steps">
          {["Board", "Template", "Configure"].map((label, i) => (
            <div
              key={label}
              className={`npw-step ${i === stepIndex ? "active" : ""} ${i < stepIndex ? "done" : ""}`}
            >
              <div className="npw-step-circle">
                {i < stepIndex ? <Check size={12} /> : i + 1}
              </div>
              <span>{label}</span>
            </div>
          ))}
          <div className="npw-step-line" style={{ width: `${stepIndex * 50}%` }} />
        </div>

        {/* ---- Body ---- */}
        <div className="npw-body">
          {currentStep === "board" && (
            <BoardStep
              selectedBoard={selectedBoard}
              selectBoard={selectBoard}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              familyFilter={familyFilter}
              setFamilyFilter={setFamilyFilter}
            />
          )}
          {currentStep === "template" && (
            <TemplateStep
              selectedBoard={selectedBoard}
              selectedTemplate={selectedTemplate}
              selectTemplate={selectTemplate}
              getCompatibleTemplates={getCompatibleTemplates}
              categoryFilter={categoryFilter}
              setCategoryFilter={setCategoryFilter}
              difficultyFilter={difficultyFilter}
              setDifficultyFilter={setDifficultyFilter}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          )}
          {currentStep === "configure" && (
            <ConfigureStep
              config={config}
              setConfigField={setConfigField}
              selectedBoard={selectedBoard}
              selectedTemplate={selectedTemplate}
              recentProjects={recentProjects}
            />
          )}
        </div>

        {/* ---- Footer ---- */}
        <div className="npw-footer">
          <div className="npw-footer-left">
            {createError && (
              <span className="npw-error">
                <AlertCircle size={14} /> {createError}
              </span>
            )}
          </div>
          <div className="npw-footer-right">
            {stepIndex > 0 && (
              <button className="npw-btn npw-btn-secondary" onClick={prevStep}>
                <ChevronLeft size={14} /> Back
              </button>
            )}
            {stepIndex < 2 ? (
              <button
                className="npw-btn npw-btn-primary"
                onClick={nextStep}
                disabled={!canNext}
              >
                Next <ChevronRight size={14} />
              </button>
            ) : (
              <button
                className="npw-btn npw-btn-primary npw-btn-create"
                onClick={createProject}
                disabled={isCreating || !config.name.trim()}
              >
                {isCreating ? (
                  <>
                    <Loader2 size={14} className="npw-spin" /> Creating…
                  </>
                ) : (
                  <>
                    <Zap size={14} /> Create Project
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Step 1: Board Selection                                           */
/* ================================================================== */

function BoardStep({
  selectedBoard,
  selectBoard,
  searchQuery,
  setSearchQuery,
  familyFilter,
  setFamilyFilter,
}: {
  selectedBoard: BoardProfile | null;
  selectBoard: (b: BoardProfile | null) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  familyFilter: BoardFamily | "all";
  setFamilyFilter: (f: BoardFamily | "all") => void;
}) {
  const boards = useMemo(() => {
    let list = [...BUILTIN_BOARDS];
    if (familyFilter !== "all") list = list.filter((b) => b.family === familyFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.mcu.toLowerCase().includes(q),
      );
    }
    return list;
  }, [familyFilter, searchQuery]);

  const families: (BoardFamily | "all")[] = [
    "all",
    "stm32",
    "esp32",
    "nrf52",
    "rp2040",
    "fpga-ice40",
    "fpga-ecp5",
    "fpga-xilinx",
    "arduino",
  ];

  return (
    <div className="npw-board-step">
      <p className="npw-subtitle">
        Select your development board. Everything else auto-configures.
      </p>

      {/* No-board option */}
      <button
        className={`npw-no-board ${selectedBoard === null ? "selected" : ""}`}
        onClick={() => selectBoard(null)}
      >
        <Monitor size={20} />
        <div>
          <strong>No Board — Simulation Only</strong>
          <span>SPICE simulation, schematic capture, ASIC layout</span>
        </div>
      </button>

      {/* Search + family filters */}
      <div className="npw-board-filters">
        <div className="npw-search-box">
          <Search size={14} />
          <input
            placeholder="Search boards…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="npw-family-chips">
          {families.map((f) => (
            <button
              key={f}
              className={`npw-chip ${familyFilter === f ? "active" : ""}`}
              onClick={() => setFamilyFilter(f)}
            >
              {f === "all" ? "All" : FAMILY_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Board grid */}
      <div className="npw-board-grid">
        {boards.map((board) => (
          <button
            key={board.id}
            className={`npw-board-card ${selectedBoard?.id === board.id ? "selected" : ""}`}
            onClick={() => selectBoard(board)}
          >
            <div className="npw-board-card-header">
              <CircuitBoard size={18} />
              <span className="npw-board-family-badge">
                {FAMILY_LABELS[board.family]}
              </span>
            </div>
            <div className="npw-board-card-name">{board.name}</div>
            <div className="npw-board-card-mcu">{board.mcu}</div>
            <div className="npw-board-card-specs">
              <span>{board.clockSpeed}</span>
              <span>{board.flash} Flash</span>
              <span>{board.ram} RAM</span>
            </div>
          </button>
        ))}
      </div>

      {boards.length === 0 && (
        <div className="npw-empty">No boards match your search.</div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Step 2: Template Selection                                        */
/* ================================================================== */

function TemplateStep({
  selectedBoard,
  selectedTemplate,
  selectTemplate,
  getCompatibleTemplates,
  categoryFilter,
  setCategoryFilter,
  difficultyFilter,
  setDifficultyFilter,
  searchQuery,
  setSearchQuery,
}: {
  selectedBoard: BoardProfile | null;
  selectedTemplate: ProjectTemplate | null;
  selectTemplate: (t: ProjectTemplate | null) => void;
  getCompatibleTemplates: () => ProjectTemplate[];
  categoryFilter: ProjectCategory | "all";
  setCategoryFilter: (c: ProjectCategory | "all") => void;
  difficultyFilter: "all" | "beginner" | "intermediate" | "advanced";
  setDifficultyFilter: (d: "all" | "beginner" | "intermediate" | "advanced") => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}) {
  const templates = getCompatibleTemplates();
  const [previewId, setPreviewId] = useState<string | null>(null);

  const previewTemplate = previewId
    ? BUILTIN_TEMPLATES.find((t) => t.id === previewId) ?? null
    : selectedTemplate;

  return (
    <div className="npw-template-step">
      <p className="npw-subtitle">
        {selectedBoard
          ? `Templates compatible with ${selectedBoard.name}`
          : "Choose a starting template"}
      </p>

      {/* Filters */}
      <div className="npw-template-filters">
        <div className="npw-search-box">
          <Search size={14} />
          <input
            placeholder="Search templates…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="npw-filter-row">
          <div className="npw-family-chips">
            {(
              ["all", "microcontroller", "fpga", "asic", "simulation-only"] as const
            ).map((c) => (
              <button
                key={c}
                className={`npw-chip ${categoryFilter === c ? "active" : ""}`}
                onClick={() => setCategoryFilter(c)}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>
          <div className="npw-family-chips">
            {(["all", "beginner", "intermediate", "advanced"] as const).map(
              (d) => (
                <button
                  key={d}
                  className={`npw-chip ${difficultyFilter === d ? "active" : ""}`}
                  onClick={() => setDifficultyFilter(d)}
                  style={
                    d !== "all"
                      ? { borderColor: DIFFICULTY_COLORS[d] }
                      : undefined
                  }
                >
                  {d === "all" ? "All Levels" : d.charAt(0).toUpperCase() + d.slice(1)}
                </button>
              ),
            )}
          </div>
        </div>
      </div>

      <div className="npw-template-layout">
        {/* Template list */}
        <div className="npw-template-list">
          {templates.map((t) => (
            <button
              key={t.id}
              className={`npw-template-card ${selectedTemplate?.id === t.id ? "selected" : ""}`}
              onClick={() => selectTemplate(t)}
              onMouseEnter={() => setPreviewId(t.id)}
              onMouseLeave={() => setPreviewId(null)}
            >
              <div className="npw-template-icon">
                <TemplateIcon icon={t.icon} />
              </div>
              <div className="npw-template-info">
                <div className="npw-template-name">
                  {t.name}
                  <span
                    className="npw-difficulty-badge"
                    style={{ background: DIFFICULTY_COLORS[t.difficulty] }}
                  >
                    {t.difficulty}
                  </span>
                </div>
                <div className="npw-template-desc">{t.description}</div>
                <div className="npw-template-tags">
                  {t.tags.map((tag) => (
                    <span key={tag} className="npw-tag">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="npw-template-meta">
                <span>
                  <FileText size={12} /> {t.fileCount} files
                </span>
              </div>
            </button>
          ))}
          {templates.length === 0 && (
            <div className="npw-empty">
              No templates match your filters. Try broadening your search.
            </div>
          )}
        </div>

        {/* Preview pane */}
        {previewTemplate && (
          <div className="npw-preview-pane">
            <h4>
              <FileText size={14} /> File Preview
            </h4>
            <pre className="npw-file-tree">
              {previewTemplate.previewTree.join("\n")}
            </pre>
            <div className="npw-preview-meta">
              <span>Category: {CATEGORY_LABELS[previewTemplate.category]}</span>
              <span>Files: {previewTemplate.fileCount}</span>
              <span>
                Level:{" "}
                <span
                  style={{ color: DIFFICULTY_COLORS[previewTemplate.difficulty] }}
                >
                  {previewTemplate.difficulty}
                </span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Step 3: Configure & Create                                        */
/* ================================================================== */

function ConfigureStep({
  config,
  setConfigField,
  selectedBoard,
  selectedTemplate,
  recentProjects,
}: {
  config: import("../../stores/projectTemplateStore").ProjectConfig;
  setConfigField: <K extends keyof import("../../stores/projectTemplateStore").ProjectConfig>(
    key: K,
    value: import("../../stores/projectTemplateStore").ProjectConfig[K],
  ) => void;
  selectedBoard: BoardProfile | null;
  selectedTemplate: ProjectTemplate | null;
  recentProjects: import("../../stores/projectTemplateStore").RecentProject[];
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleBrowse = useCallback(async () => {
    // In browser dev we just set a placeholder path
    setConfigField("location", "~/projects");
  }, [setConfigField]);

  return (
    <div className="npw-configure-step">
      {/* Summary row */}
      <div className="npw-summary-row">
        <div className="npw-summary-item">
          <CircuitBoard size={16} />
          <div>
            <label>Board</label>
            <span>{selectedBoard?.name ?? "None (Simulation)"}</span>
          </div>
        </div>
        <div className="npw-summary-item">
          <FileText size={16} />
          <div>
            <label>Template</label>
            <span>{selectedTemplate?.name ?? "—"}</span>
          </div>
        </div>
        {selectedBoard && (
          <div className="npw-summary-item">
            <Cpu size={16} />
            <div>
              <label>MCU</label>
              <span>{selectedBoard.mcu}</span>
            </div>
          </div>
        )}
      </div>

      {/* Essential fields */}
      <div className="npw-form">
        <div className="npw-field">
          <label htmlFor="npw-name">Project Name</label>
          <input
            id="npw-name"
            type="text"
            placeholder="my-blinky-project"
            value={config.name}
            onChange={(e) => setConfigField("name", e.target.value)}
            autoFocus
          />
        </div>

        <div className="npw-field">
          <label htmlFor="npw-location">Location</label>
          <div className="npw-location-row">
            <input
              id="npw-location"
              type="text"
              placeholder="~/projects"
              value={config.location}
              onChange={(e) => setConfigField("location", e.target.value)}
            />
            <button className="npw-browse-btn" onClick={handleBrowse}>
              <FolderOpen size={14} /> Browse
            </button>
          </div>
        </div>

        {/* Quick toggles */}
        <div className="npw-toggles">
          <label className="npw-toggle">
            <input
              type="checkbox"
              checked={config.initGit}
              onChange={(e) => setConfigField("initGit", e.target.checked)}
            />
            <GitBranch size={14} /> Initialize Git repository
          </label>
          <label className="npw-toggle">
            <input
              type="checkbox"
              checked={config.generateVsCodeConfig}
              onChange={(e) =>
                setConfigField("generateVsCodeConfig", e.target.checked)
              }
            />
            <Settings2 size={14} /> Generate VS Code config
          </label>
          <label className="npw-toggle">
            <input
              type="checkbox"
              checked={config.debugPrintf}
              onChange={(e) =>
                setConfigField("debugPrintf", e.target.checked)
              }
            />
            <Terminal size={14} /> Enable debug printf
          </label>
        </div>

        {/* Advanced settings (collapsible) */}
        <button
          className="npw-advanced-toggle"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Advanced Settings
        </button>

        {showAdvanced && (
          <div className="npw-advanced">
            <div className="npw-field-row">
              <div className="npw-field">
                <label>Toolchain</label>
                <select
                  value={config.toolchain}
                  onChange={(e) =>
                    setConfigField(
                      "toolchain",
                      e.target.value as import("../../stores/projectTemplateStore").Toolchain,
                    )
                  }
                >
                  <option value="gcc-arm">GCC ARM</option>
                  <option value="gcc-riscv">GCC RISC-V</option>
                  <option value="gcc-avr">GCC AVR</option>
                  <option value="xtensa-esp">Xtensa (ESP-IDF)</option>
                  <option value="sdcc">SDCC</option>
                  <option value="yosys-nextpnr">Yosys + nextpnr</option>
                  <option value="vivado">Vivado</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <div className="npw-field">
                <label>Build System</label>
                <select
                  value={config.buildSystem}
                  onChange={(e) =>
                    setConfigField(
                      "buildSystem",
                      e.target.value as import("../../stores/projectTemplateStore").BuildSystem,
                    )
                  }
                >
                  <option value="cmake">CMake</option>
                  <option value="make">Make</option>
                  <option value="platformio">PlatformIO</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
            </div>

            <div className="npw-field-row">
              <div className="npw-field">
                <label>RTOS</label>
                <select
                  value={config.rtos}
                  onChange={(e) =>
                    setConfigField(
                      "rtos",
                      e.target.value as import("../../stores/projectTemplateStore").RtosOption,
                    )
                  }
                >
                  <option value="none">None (bare metal)</option>
                  <option value="freertos">FreeRTOS</option>
                  <option value="zephyr">Zephyr</option>
                  <option value="chibios">ChibiOS</option>
                  <option value="nuttx">NuttX</option>
                </select>
              </div>
              <div className="npw-field">
                <label>Clock Speed (Hz)</label>
                <input
                  type="number"
                  value={config.clockSpeedHz || ""}
                  onChange={(e) =>
                    setConfigField("clockSpeedHz", parseInt(e.target.value) || 0)
                  }
                  placeholder="Auto from board"
                />
              </div>
            </div>

            <div className="npw-field">
              <label>Extra C Flags</label>
              <input
                type="text"
                value={config.cFlags}
                onChange={(e) =>
                  setConfigField("cFlags", e.target.value)
                }
                placeholder="-Wall -Wextra -Os"
              />
            </div>
            <div className="npw-field">
              <label>Extra Linker Flags</label>
              <input
                type="text"
                value={config.ldFlags}
                onChange={(e) =>
                  setConfigField("ldFlags", e.target.value)
                }
                placeholder=""
              />
            </div>
            <div className="npw-field">
              <label>Custom Linker Script</label>
              <input
                type="text"
                value={config.customLinkerScript}
                onChange={(e) =>
                  setConfigField("customLinkerScript", e.target.value)
                }
                placeholder="Auto-generated from board"
              />
            </div>
          </div>
        )}
      </div>

      {/* Recent projects */}
      {recentProjects.length > 0 && (
        <div className="npw-recent">
          <h4>
            <Clock size={14} /> Recent Projects
          </h4>
          <div className="npw-recent-list">
            {recentProjects.slice(0, 5).map((p) => (
              <div key={p.path} className="npw-recent-item">
                <FolderOpen size={12} />
                <span className="npw-recent-name">{p.name}</span>
                <span className="npw-recent-detail">
                  {p.board} · {p.template}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
