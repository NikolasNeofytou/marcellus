/**
 * DebugDashboard — Bottom panel tab for on-chip debugging with GDB/OpenOCD.
 * Features: breakpoints, call stack, variables, registers, memory viewer.
 */

import { useState, useRef, useEffect } from "react";
import { useBoardStore } from "../../stores/boardStore";
import type { DebugVariable } from "../../stores/boardStore";
import {
  Bug,
  Play,
  Pause,
  SkipForward,
  ArrowDownToLine,
  ArrowUpFromLine,
  Square,
  Circle,
  ChevronDown,
  ChevronRight,
  Trash2,
  Plus,
  X,
  Eye,
  MapPin,
  HardDrive,
} from "lucide-react";
import "./DebugDashboard.css";

/* ── Sub-components ─────────────────────────────────────────────── */

function VariableTree({ v, depth = 0 }: { v: DebugVariable; depth?: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = v.children && v.children.length > 0;

  return (
    <>
      <div
        className={`debug-var ${v.changed ? "debug-var--changed" : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {hasChildren ? (
          <button className="debug-var__toggle" onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
          </button>
        ) : (
          <span className="debug-var__toggle-placeholder" />
        )}
        <span className="debug-var__name">{v.name}</span>
        <span className="debug-var__eq">=</span>
        <span className="debug-var__value">{v.value}</span>
        <span className="debug-var__type">{v.type}</span>
      </div>
      {expanded &&
        v.children?.map((child, i) => (
          <VariableTree key={`${child.name}-${i}`} v={child} depth={depth + 1} />
        ))}
    </>
  );
}

/* ── Main component ─────────────────────────────────────────────── */

export function DebugDashboard() {
  const activeBoard = useBoardStore((s) => s.activeBoard);
  const connectionStatus = useBoardStore((s) => s.connectionStatus);
  const debugState = useBoardStore((s) => s.debugState);
  const breakpoints = useBoardStore((s) => s.breakpoints);
  const variables = useBoardStore((s) => s.variables);
  const callStack = useBoardStore((s) => s.callStack);
  const registers = useBoardStore((s) => s.registers);
  const memoryBlocks = useBoardStore((s) => s.memoryBlocks);
  const memoryAddress = useBoardStore((s) => s.memoryAddress);
  const debugOutput = useBoardStore((s) => s.debugOutput);
  const currentFile = useBoardStore((s) => s.currentFile);
  const currentLine = useBoardStore((s) => s.currentLine);
  const watchExpressions = useBoardStore((s) => s.watchExpressions);

  const startDebugSession = useBoardStore((s) => s.startDebugSession);
  const stopDebugSession = useBoardStore((s) => s.stopDebugSession);
  const debugContinue = useBoardStore((s) => s.debugContinue);
  const debugStepOver = useBoardStore((s) => s.debugStepOver);
  const debugStepInto = useBoardStore((s) => s.debugStepInto);
  const debugStepOut = useBoardStore((s) => s.debugStepOut);
  const debugPause = useBoardStore((s) => s.debugPause);
  const addBreakpoint = useBoardStore((s) => s.addBreakpoint);
  const removeBreakpoint = useBoardStore((s) => s.removeBreakpoint);
  const toggleBreakpoint = useBoardStore((s) => s.toggleBreakpoint);
  const clearAllBreakpoints = useBoardStore((s) => s.clearAllBreakpoints);
  const setMemoryAddress = useBoardStore((s) => s.setMemoryAddress);
  const loadMemory = useBoardStore((s) => s.loadMemory);
  const addWatchExpression = useBoardStore((s) => s.addWatchExpression);
  const removeWatchExpression = useBoardStore((s) => s.removeWatchExpression);

  const [activePane, setActivePane] = useState<"variables" | "callstack" | "breakpoints" | "registers" | "memory" | "watch" | "output">("variables");
  const [bpFile, setBpFile] = useState("main.c");
  const [bpLine, setBpLine] = useState("1");
  const [bpCond, setBpCond] = useState("");
  const [watchInput, setWatchInput] = useState("");
  const [memInput, setMemInput] = useState(memoryAddress);
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll debug output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [debugOutput]);

  const isActive = debugState !== "idle";
  const isPaused = debugState === "paused";
  const canStart = activeBoard && connectionStatus === "connected" && !isActive;

  if (!activeBoard) {
    return (
      <div className="debug-dashboard">
        <div className="debug-dashboard__empty">
          <Bug size={32} style={{ opacity: 0.3 }} />
          <span>Select and connect a board to start debugging</span>
        </div>
      </div>
    );
  }

  return (
    <div className="debug-dashboard">
      {/* ── Debug Toolbar ── */}
      <div className="debug-dashboard__toolbar">
        <div className="debug-dashboard__toolbar-left">
          {!isActive ? (
            <button
              className="debug-dashboard__ctrl debug-dashboard__ctrl--start"
              onClick={startDebugSession}
              disabled={!canStart}
              title="Start debug session (F5)"
            >
              <Play size={13} /> Start
            </button>
          ) : (
            <>
              {debugState === "running" ? (
                <button className="debug-dashboard__ctrl" onClick={debugPause} title="Pause (F6)">
                  <Pause size={13} />
                </button>
              ) : (
                <button className="debug-dashboard__ctrl" onClick={debugContinue} title="Continue (F5)">
                  <Play size={13} />
                </button>
              )}
              <button className="debug-dashboard__ctrl" onClick={debugStepOver} disabled={!isPaused} title="Step Over (F10)">
                <SkipForward size={13} />
              </button>
              <button className="debug-dashboard__ctrl" onClick={debugStepInto} disabled={!isPaused} title="Step Into (F11)">
                <ArrowDownToLine size={13} />
              </button>
              <button className="debug-dashboard__ctrl" onClick={debugStepOut} disabled={!isPaused} title="Step Out (Shift+F11)">
                <ArrowUpFromLine size={13} />
              </button>
              <button className="debug-dashboard__ctrl debug-dashboard__ctrl--stop" onClick={stopDebugSession} title="Stop (Shift+F5)">
                <Square size={13} />
              </button>
            </>
          )}
        </div>

        <div className="debug-dashboard__toolbar-right">
          <span className={`debug-dashboard__state debug-dashboard__state--${debugState}`}>
            {debugState === "idle" && "Idle"}
            {debugState === "running" && "Running"}
            {debugState === "paused" && `Paused — ${currentFile}:${currentLine}`}
            {debugState === "stepping" && "Stepping…"}
            {debugState === "error" && "Error"}
          </span>
        </div>
      </div>

      {/* ── Pane Tabs ── */}
      <div className="debug-dashboard__pane-tabs">
        {(["variables", "callstack", "breakpoints", "registers", "memory", "watch", "output"] as const).map((p) => (
          <button
            key={p}
            className={`debug-dashboard__pane-tab ${activePane === p ? "debug-dashboard__pane-tab--active" : ""}`}
            onClick={() => setActivePane(p)}
          >
            {p === "variables" && "Variables"}
            {p === "callstack" && "Call Stack"}
            {p === "breakpoints" && "Breakpoints"}
            {p === "registers" && "Registers"}
            {p === "memory" && "Memory"}
            {p === "watch" && "Watch"}
            {p === "output" && "Debug Console"}
          </button>
        ))}
      </div>

      {/* ── Pane Content ── */}
      <div className="debug-dashboard__pane-content">
        {/* Variables */}
        {activePane === "variables" && (
          <div className="debug-dashboard__pane">
            {!isActive ? (
              <div className="debug-dashboard__pane-empty">Start a debug session to inspect variables</div>
            ) : variables.length === 0 ? (
              <div className="debug-dashboard__pane-empty">No variables in scope</div>
            ) : (
              variables.map((v, i) => <VariableTree key={`${v.name}-${i}`} v={v} />)
            )}
          </div>
        )}

        {/* Call Stack */}
        {activePane === "callstack" && (
          <div className="debug-dashboard__pane">
            {callStack.length === 0 ? (
              <div className="debug-dashboard__pane-empty">No call stack available</div>
            ) : (
              callStack.map((frame) => (
                <div key={frame.id} className={`debug-frame ${frame.id === 0 ? "debug-frame--current" : ""}`}>
                  <MapPin size={11} className="debug-frame__icon" />
                  <span className="debug-frame__name">{frame.name}</span>
                  <span className="debug-frame__loc">{frame.file}:{frame.line}</span>
                  <span className="debug-frame__addr">{frame.address}</span>
                </div>
              ))
            )}
          </div>
        )}

        {/* Breakpoints */}
        {activePane === "breakpoints" && (
          <div className="debug-dashboard__pane">
            <div className="debug-bp__add-row">
              <input
                className="debug-bp__input"
                value={bpFile}
                onChange={(e) => setBpFile(e.target.value)}
                placeholder="File"
              />
              <input
                className="debug-bp__input debug-bp__input--sm"
                value={bpLine}
                onChange={(e) => setBpLine(e.target.value)}
                placeholder="Line"
                type="number"
              />
              <input
                className="debug-bp__input"
                value={bpCond}
                onChange={(e) => setBpCond(e.target.value)}
                placeholder="Condition (optional)"
              />
              <button
                className="debug-bp__add-btn"
                onClick={() => {
                  const ln = parseInt(bpLine, 10);
                  if (bpFile && ln > 0) {
                    addBreakpoint(bpFile, ln, bpCond || undefined);
                    setBpLine("");
                    setBpCond("");
                  }
                }}
              >
                <Plus size={12} /> Add
              </button>
              <button className="debug-bp__clear-btn" onClick={clearAllBreakpoints} title="Clear all">
                <Trash2 size={12} />
              </button>
            </div>
            {breakpoints.length === 0 ? (
              <div className="debug-dashboard__pane-empty">No breakpoints set</div>
            ) : (
              breakpoints.map((bp) => (
                <div key={bp.id} className={`debug-bp ${bp.enabled ? "" : "debug-bp--disabled"}`}>
                  <button
                    className="debug-bp__toggle"
                    onClick={() => toggleBreakpoint(bp.id)}
                    title={bp.enabled ? "Disable" : "Enable"}
                  >
                    <Circle size={11} fill={bp.enabled ? "var(--os-error, #f44336)" : "transparent"} />
                  </button>
                  <span className="debug-bp__loc">{bp.file}:{bp.line}</span>
                  {bp.condition && <span className="debug-bp__cond">if {bp.condition}</span>}
                  <span className="debug-bp__hits">hits: {bp.hitCount}</span>
                  <button className="debug-bp__remove" onClick={() => removeBreakpoint(bp.id)}>
                    <X size={11} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Registers */}
        {activePane === "registers" && (
          <div className="debug-dashboard__pane">
            {registers.length === 0 ? (
              <div className="debug-dashboard__pane-empty">No register data available</div>
            ) : (
              <div className="debug-reg__grid">
                {registers.map((r) => (
                  <div key={r.name} className="debug-reg">
                    <span className="debug-reg__name">{r.name}</span>
                    <span className="debug-reg__hex">{r.value}</span>
                    <span className="debug-reg__dec">{r.decimal}</span>
                    <span className="debug-reg__cat">{r.category}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Memory */}
        {activePane === "memory" && (
          <div className="debug-dashboard__pane">
            <div className="debug-mem__toolbar">
              <HardDrive size={12} />
              <input
                className="debug-mem__addr-input"
                value={memInput}
                onChange={(e) => setMemInput(e.target.value)}
                placeholder="0x08000000"
              />
              <button
                className="debug-mem__load-btn"
                onClick={() => {
                  setMemoryAddress(memInput);
                  loadMemory(memInput);
                }}
              >
                Load
              </button>
            </div>
            {memoryBlocks.length === 0 ? (
              <div className="debug-dashboard__pane-empty">Enter an address and click Load</div>
            ) : (
              <div className="debug-mem__view">
                <div className="debug-mem__header">
                  <span className="debug-mem__col-addr">Address</span>
                  <span className="debug-mem__col-hex">00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F</span>
                  <span className="debug-mem__col-ascii">ASCII</span>
                </div>
                {memoryBlocks.map((blk) => (
                  <div key={blk.address} className="debug-mem__row">
                    <span className="debug-mem__addr">
                      {`0x${blk.address.toString(16).toUpperCase().padStart(8, "0")}`}
                    </span>
                    <span className="debug-mem__hex-data">
                      {blk.bytes.map((b, i) => (
                        <span key={i} className="debug-mem__byte">
                          {b.toString(16).toUpperCase().padStart(2, "0")}
                          {i === 7 ? "  " : " "}
                        </span>
                      ))}
                    </span>
                    <span className="debug-mem__ascii-data">{blk.ascii}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Watch */}
        {activePane === "watch" && (
          <div className="debug-dashboard__pane">
            <div className="debug-watch__add-row">
              <input
                className="debug-watch__input"
                value={watchInput}
                onChange={(e) => setWatchInput(e.target.value)}
                placeholder="Expression to watch"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && watchInput.trim()) {
                    addWatchExpression(watchInput.trim());
                    setWatchInput("");
                  }
                }}
              />
              <button
                className="debug-watch__add-btn"
                onClick={() => {
                  if (watchInput.trim()) {
                    addWatchExpression(watchInput.trim());
                    setWatchInput("");
                  }
                }}
              >
                <Plus size={12} /> Add
              </button>
            </div>
            {watchExpressions.length === 0 ? (
              <div className="debug-dashboard__pane-empty">Add watch expressions to monitor values</div>
            ) : (
              watchExpressions.map((expr) => (
                <div key={expr} className="debug-watch__item">
                  <Eye size={11} />
                  <span className="debug-watch__expr">{expr}</span>
                  <span className="debug-watch__val">
                    {isPaused ? "<pending>" : "—"}
                  </span>
                  <button className="debug-watch__remove" onClick={() => removeWatchExpression(expr)}>
                    <X size={11} />
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* Debug Console Output */}
        {activePane === "output" && (
          <div className="debug-dashboard__pane debug-dashboard__pane--output" ref={outputRef}>
            {debugOutput.length === 0 ? (
              <div className="debug-dashboard__pane-empty">Debug output will appear here</div>
            ) : (
              debugOutput.map((line, i) => (
                <div key={i} className="debug-output__line">{line}</div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
