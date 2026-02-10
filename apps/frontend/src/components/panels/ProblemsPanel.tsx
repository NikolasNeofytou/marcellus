/**
 * ProblemsPanel — Unified error/warning/info aggregation panel.
 * Shows diagnostics from HDL parser, DRC, LVS, elaboration, linting, timing.
 */

import { useEffect, useMemo, useCallback } from "react";
import { useProblemsStore, type Problem, type ProblemSeverity } from "../../stores/problemsStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronRight,
  ChevronDown,
  FileCode,
  Filter,
  Trash2,
  X,
} from "lucide-react";
import "./ProblemsPanel.css";

function SeverityIcon({ severity, size = 14 }: { severity: ProblemSeverity; size?: number }) {
  switch (severity) {
    case "error":
      return <AlertCircle size={size} className="problem-icon problem-icon--error" />;
    case "warning":
      return <AlertTriangle size={size} className="problem-icon problem-icon--warning" />;
    case "info":
    case "hint":
      return <Info size={size} className="problem-icon problem-icon--info" />;
  }
}

export function ProblemsPanel() {
  const errorCount = useProblemsStore((s) => s.errorCount);
  const warningCount = useProblemsStore((s) => s.warningCount);
  const infoCount = useProblemsStore((s) => s.infoCount);
  const filterText = useProblemsStore((s) => s.filterText);
  const expandedFiles = useProblemsStore((s) => s.expandedFiles);
  const severityFilter = useProblemsStore((s) => s.severityFilter);
  const setFilterText = useProblemsStore((s) => s.setFilterText);
  const toggleFileExpand = useProblemsStore((s) => s.toggleFileExpand);
  const toggleSeverityFilter = useProblemsStore((s) => s.toggleSeverityFilter);
  const clearAll = useProblemsStore((s) => s.clearAll);
  const loadDemoProblems = useProblemsStore((s) => s.loadDemoProblems);
  const getFilteredGroups = useProblemsStore((s) => s.getFilteredGroups);
  const addTab = useWorkspaceStore((s) => s.addTab);

  // Load demo on first mount if empty
  const problems = useProblemsStore((s) => s.problems);
  useEffect(() => {
    if (problems.length === 0) {
      loadDemoProblems();
    }
  }, [problems.length, loadDemoProblems]);

  const groups = useMemo(() => getFilteredGroups(), [getFilteredGroups, problems, filterText, severityFilter]);

  const handleProblemClick = useCallback(
    (problem: Problem) => {
      if (!problem.filePath) return;
      const fileName = problem.filePath.split("/").pop() ?? problem.filePath;
      const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
      const hdlExts = ["v", "sv", "vh", "svh", "vhd", "vhdl"];
      addTab({
        id: `file-${problem.filePath}`,
        title: fileName,
        type: hdlExts.includes(ext) ? "hdl" : "welcome",
        modified: false,
      });
    },
    [addTab]
  );

  return (
    <div className="problems-panel">
      {/* Toolbar */}
      <div className="problems-panel__toolbar">
        <div className="problems-panel__counts">
          <button
            className={`problems-panel__count-btn ${severityFilter.has("error") ? "" : "problems-panel__count-btn--muted"}`}
            onClick={() => toggleSeverityFilter("error")}
            title="Toggle errors"
          >
            <AlertCircle size={12} className="problem-icon--error" />
            <span>{errorCount}</span>
          </button>
          <button
            className={`problems-panel__count-btn ${severityFilter.has("warning") ? "" : "problems-panel__count-btn--muted"}`}
            onClick={() => toggleSeverityFilter("warning")}
            title="Toggle warnings"
          >
            <AlertTriangle size={12} className="problem-icon--warning" />
            <span>{warningCount}</span>
          </button>
          <button
            className={`problems-panel__count-btn ${severityFilter.has("info") ? "" : "problems-panel__count-btn--muted"}`}
            onClick={() => toggleSeverityFilter("info")}
            title="Toggle info"
          >
            <Info size={12} className="problem-icon--info" />
            <span>{infoCount}</span>
          </button>
        </div>

        <div className="problems-panel__filter-wrap">
          <Filter size={12} className="problems-panel__filter-icon" />
          <input
            type="text"
            className="problems-panel__filter"
            placeholder="Filter problems..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            aria-label="Filter problems"
          />
          {filterText && (
            <button
              className="problems-panel__filter-clear"
              onClick={() => setFilterText("")}
            >
              <X size={10} />
            </button>
          )}
        </div>

        <button
          className="problems-panel__action"
          onClick={clearAll}
          title="Clear All"
          aria-label="Clear All Problems"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Results tree */}
      <div className="problems-panel__list" role="tree" aria-label="Problems">
        {groups.length === 0 ? (
          <div className="problems-panel__empty">
            No problems detected in workspace.
          </div>
        ) : (
          groups.map((group) => {
            const isExpanded = expandedFiles.has(group.filePath);
            const fileName = group.filePath.split("/").pop() ?? group.filePath;

            return (
              <div key={group.filePath} className="problem-group">
                <div
                  className="problem-group__header"
                  onClick={() => toggleFileExpand(group.filePath)}
                  role="treeitem"
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <FileCode size={14} className="problem-group__icon" />
                  <span className="problem-group__name">{fileName}</span>
                  <span className="problem-group__path">
                    {group.filePath.split("/").slice(0, -1).join("/")}
                  </span>
                  <div className="problem-group__badges">
                    {group.errorCount > 0 && (
                      <span className="problem-badge problem-badge--error">{group.errorCount}</span>
                    )}
                    {group.warningCount > 0 && (
                      <span className="problem-badge problem-badge--warning">{group.warningCount}</span>
                    )}
                    {group.infoCount > 0 && (
                      <span className="problem-badge problem-badge--info">{group.infoCount}</span>
                    )}
                  </div>
                </div>
                {isExpanded && (
                  <div className="problem-group__items" role="group">
                    {group.problems.map((prob) => (
                      <div
                        key={prob.id}
                        className="problem-item"
                        onClick={() => handleProblemClick(prob)}
                        role="treeitem"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleProblemClick(prob);
                        }}
                      >
                        <SeverityIcon severity={prob.severity} />
                        <span className="problem-item__message">{prob.message}</span>
                        {prob.code && (
                          <span className="problem-item__code">{prob.code}</span>
                        )}
                        <span className="problem-item__source">{prob.source}</span>
                        {prob.line && (
                          <span className="problem-item__location">
                            [{prob.line}{prob.column ? `:${prob.column}` : ""}]
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
