import { useState } from "react";
import { useBuildTaskStore, type BuildTask, type TaskRun } from "../../stores/buildTaskStore";
import { Search, Play, Square, Trash2, AlertTriangle, XCircle } from "lucide-react";
import "./BuildPanel.css";

/* ------------------------------------------------------------------ */
/*  Category → icon letter                                            */
/* ------------------------------------------------------------------ */

const CAT_ICONS: Record<string, string> = {
  Compile: "C",
  Lint: "L",
  Simulate: "S",
  Synthesis: "Y",
  Build: "B",
  Test: "T",
};

/* ------------------------------------------------------------------ */
/*  Task card                                                         */
/* ------------------------------------------------------------------ */

function TaskCard({ task }: { task: BuildTask }) {
  const [expanded, setExpanded] = useState(false);
  const startTask = useBuildTaskStore((s) => s.startTask);
  const cancelTask = useBuildTaskStore((s) => s.cancelTask);
  const clearRun = useBuildTaskStore((s) => s.clearRun);
  const removeTask = useBuildTaskStore((s) => s.removeTask);
  const runs = useBuildTaskStore((s) => s.runs);

  const run = runs[task.id];
  const isRunning = run?.status === "running";
  const catClass = task.category.toLowerCase();

  const handleRun = (e: React.MouseEvent) => {
    e.stopPropagation();
    // In a real Tauri app, this would invoke a shell command via IPC.
    // For now, simulate running.
    startTask(task.id);
    // Simulate completion after 2 seconds
    setTimeout(() => {
      useBuildTaskStore.getState().appendOutput(task.id, `$ ${task.command} ${task.args.join(" ")}`);
      useBuildTaskStore.getState().appendOutput(task.id, `Running ${task.label}…`);
      useBuildTaskStore.getState().appendOutput(task.id, "Task completed (simulated).");
      useBuildTaskStore.getState().finishTask(task.id, 0);
    }, 2000);
  };

  return (
    <div className="build-task-card" onClick={() => setExpanded(!expanded)}>
      <div className="build-task-card__header">
        <span className={`build-task-card__icon build-task-card__icon--${catClass}`}>
          {CAT_ICONS[task.category] ?? "?"}
        </span>
        <span className="build-task-card__name">{task.label}</span>
        <span className="build-task-card__cat">{task.category}</span>
      </div>
      <div className="build-task-card__desc">{task.description}</div>

      {expanded && (
        <>
          <div className="build-task-card__cmd">
            {task.command} {task.args.join(" ")}
          </div>
          <div className="build-task-card__actions">
            {isRunning ? (
              <button
                className="build-task-card__btn build-task-card__btn--stop"
                onClick={(e) => { e.stopPropagation(); cancelTask(task.id); }}
              >
                <Square size={10} /> Stop
              </button>
            ) : (
              <button
                className="build-task-card__btn build-task-card__btn--run"
                onClick={handleRun}
              >
                <Play size={10} /> Run
              </button>
            )}
            {run && !isRunning && (
              <button
                className="build-task-card__btn"
                onClick={(e) => { e.stopPropagation(); clearRun(task.id); }}
              >
                <Trash2 size={10} /> Clear
              </button>
            )}
            {!task.builtIn && (
              <button
                className="build-task-card__btn"
                onClick={(e) => { e.stopPropagation(); removeTask(task.id); }}
                style={{ color: "#ef5350", borderColor: "#ef5350" }}
              >
                <Trash2 size={10} /> Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Output pane                                                       */
/* ------------------------------------------------------------------ */

function TaskOutput({ run }: { run: TaskRun }) {
  const tasks = useBuildTaskStore((s) => s.tasks);
  const task = tasks.find((t) => t.id === run.taskId);
  const errorCount = run.problems.filter((p) => p.severity === "error").length;
  const warnCount = run.problems.filter((p) => p.severity === "warning").length;

  return (
    <>
      <div className="build-panel__output-header">
        <span className="build-panel__output-title">{task?.label ?? "Task"}</span>
        <span className={`build-panel__status build-panel__status--${run.status}`}>
          {run.status}
        </span>
        {run.endTime && (
          <span style={{ fontSize: 10, color: "var(--os-fg-muted)", marginLeft: "auto" }}>
            {((run.endTime - run.startTime) / 1000).toFixed(1)}s
          </span>
        )}
      </div>
      <div className="build-panel__output">
        {run.output.map((line, i) => (
          <div
            key={i}
            className={`build-panel__output-line ${
              line.match(/error/i) ? "build-panel__output-line--error" :
              line.match(/warning|warn/i) ? "build-panel__output-line--warning" : ""
            }`}
          >
            {line}
          </div>
        ))}
        {run.output.length === 0 && (
          <div className="build-panel__output-line" style={{ fontStyle: "italic" }}>
            Waiting for output…
          </div>
        )}
      </div>
      {(errorCount > 0 || warnCount > 0) && (
        <div className="build-panel__problems">
          {errorCount > 0 && (
            <span className="build-panel__problem-count build-panel__problem-count--error">
              <XCircle size={12} /> {errorCount} error{errorCount !== 1 ? "s" : ""}
            </span>
          )}
          {warnCount > 0 && (
            <span className="build-panel__problem-count build-panel__problem-count--warning">
              <AlertTriangle size={12} /> {warnCount} warning{warnCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Build Panel                                                       */
/* ------------------------------------------------------------------ */

export function BuildPanel() {
  const searchQuery = useBuildTaskStore((s) => s.searchQuery);
  const setSearchQuery = useBuildTaskStore((s) => s.setSearchQuery);
  const getFilteredTasks = useBuildTaskStore((s) => s.getFilteredTasks);
  const activeRunId = useBuildTaskStore((s) => s.activeRunId);
  const runs = useBuildTaskStore((s) => s.runs);

  const tasks = getFilteredTasks();

  // Show the most recent run (active or last completed)
  const lastRunId = activeRunId ?? Object.keys(runs).pop();
  const lastRun = lastRunId ? runs[lastRunId] : undefined;

  return (
    <div className="build-panel">
      {/* Search */}
      <div className="build-panel__header">
        <div className="build-panel__search-wrap">
          <Search size={14} style={{ color: "var(--os-fg-muted)", flexShrink: 0 }} />
          <input
            className="build-panel__search-input"
            placeholder="Search tasks…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Task list */}
      <div className="build-panel__list">
        {tasks.length === 0 ? (
          <div className="build-panel__empty">No build tasks configured.</div>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>

      {/* Output */}
      {lastRun && <TaskOutput run={lastRun} />}
    </div>
  );
}
