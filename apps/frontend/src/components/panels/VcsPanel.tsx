import { useState } from "react";
import { useVcsStore, type VcsCommit, type CommitDiff } from "../../stores/vcsStore";
import { useGeometryStore } from "../../stores/geometryStore";
import { useSimStore } from "../../stores/simStore";
import "./VcsPanel.css";

export function VcsPanel() {
  const vcs = useVcsStore();
  const geometries = useGeometryStore((s) => s.geometries);
  const load = useGeometryStore((s) => s.load);
  const appendLine = useSimStore((s) => s.appendTerminalLine);

  const [tab, setTab] = useState<"changes" | "history" | "branches">("changes");
  const [commitMsg, setCommitMsg] = useState("");
  const [newBranchName, setNewBranchName] = useState("");

  const isInitialised = vcs.commits.size > 0;
  const history = vcs.getHistory(50);
  const branchNames = vcs.getBranchNames();
  const workingDiff = isInitialised ? vcs.diffWorking(geometries) : null;
  const hasChanges = workingDiff ? workingDiff.stats.added + workingDiff.stats.removed + workingDiff.stats.modified > 0 : false;

  const handleInit = () => {
    vcs.init(geometries, useGeometryStore.getState().projectName);
    appendLine("> VCS initialised with initial commit");
  };

  const handleCommit = () => {
    if (!commitMsg.trim()) return;
    const id = vcs.commit(commitMsg.trim(), geometries);
    appendLine(`> Committed ${id}: ${commitMsg.trim()}`);
    setCommitMsg("");
  };

  const handleCheckout = (branch: string) => {
    const snapshot = vcs.checkout(branch);
    if (snapshot) {
      load(snapshot);
      appendLine(`> Switched to branch: ${branch}`);
    }
  };

  const handleCreateBranch = () => {
    if (!newBranchName.trim()) return;
    vcs.createBranch(newBranchName.trim());
    appendLine(`> Created branch: ${newBranchName.trim()}`);
    setNewBranchName("");
  };

  const handleViewDiff = (commit: VcsCommit) => {
    if (commit.parentIds.length > 0) {
      const diff = vcs.diff(commit.parentIds[0], commit.id);
      vcs.setActiveDiff(diff);
    }
  };

  if (!isInitialised) {
    return (
      <div className="vcs-panel">
        <div className="vcs-panel__empty">
          <p>Version control not initialised.</p>
          <button className="vcs-panel__btn vcs-panel__btn--primary" onClick={handleInit}>
            Initialise Repository
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="vcs-panel">
      <div className="vcs-panel__tabs">
        {(["changes", "history", "branches"] as const).map((t) => (
          <button
            key={t}
            className={`vcs-panel__tab ${tab === t ? "vcs-panel__tab--active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "changes" ? `Changes${hasChanges ? " •" : ""}` : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="vcs-panel__content">
        {tab === "changes" && (
          <ChangesTab
            diff={workingDiff}
            commitMsg={commitMsg}
            setCommitMsg={setCommitMsg}
            onCommit={handleCommit}
            hasChanges={hasChanges}
          />
        )}
        {tab === "history" && (
          <HistoryTab
            history={history}
            currentBranch={vcs.currentBranch}
            onViewDiff={handleViewDiff}
          />
        )}
        {tab === "branches" && (
          <BranchesTab
            branches={branchNames}
            currentBranch={vcs.currentBranch}
            newBranchName={newBranchName}
            setNewBranchName={setNewBranchName}
            onCreateBranch={handleCreateBranch}
            onCheckout={handleCheckout}
            onDelete={(name) => {
              vcs.deleteBranch(name);
              appendLine(`> Deleted branch: ${name}`);
            }}
            isMerging={vcs.isMerging}
            onStartMerge={(source) => {
              const conflicts = vcs.startMerge(source, geometries);
              appendLine(`> Merge from ${source}: ${conflicts.length} conflicts`);
            }}
          />
        )}
      </div>

      {/* Merge bar */}
      {vcs.isMerging && (
        <MergeBar
          source={vcs.mergeSourceBranch ?? ""}
          conflicts={vcs.mergeConflicts}
          onResolve={vcs.resolveConflict}
          onComplete={() => {
            const merged = vcs.completeMerge();
            if (merged) {
              load(merged);
              const id = vcs.commit(`Merge ${vcs.mergeSourceBranch}`, merged);
              appendLine(`> Merge complete: ${id}`);
            }
          }}
          onAbort={() => {
            vcs.abortMerge();
            appendLine("> Merge aborted");
          }}
        />
      )}
    </div>
  );
}

// ── Changes Tab ───────────────────────────────────────────────────

function ChangesTab({
  diff,
  commitMsg,
  setCommitMsg,
  onCommit,
  hasChanges,
}: {
  diff: CommitDiff | null;
  commitMsg: string;
  setCommitMsg: (v: string) => void;
  onCommit: () => void;
  hasChanges: boolean;
}) {
  return (
    <div className="vcs-changes">
      <div className="vcs-changes__input-row">
        <input
          className="vcs-changes__input"
          placeholder="Commit message…"
          value={commitMsg}
          onChange={(e) => setCommitMsg(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onCommit()}
        />
        <button
          className="vcs-panel__btn vcs-panel__btn--primary"
          onClick={onCommit}
          disabled={!commitMsg.trim()}
        >
          Commit
        </button>
      </div>

      {!hasChanges && (
        <div className="vcs-changes__clean">No changes since last commit</div>
      )}

      {diff && diff.diffs.length > 0 && (
        <div className="vcs-changes__list">
          <div className="vcs-changes__stats">
            <span className="vcs-changes__stat vcs-changes__stat--added">+{diff.stats.added}</span>
            <span className="vcs-changes__stat vcs-changes__stat--removed">−{diff.stats.removed}</span>
            <span className="vcs-changes__stat vcs-changes__stat--modified">~{diff.stats.modified}</span>
          </div>
          {diff.diffs.map((d, i) => (
            <div key={i} className={`vcs-changes__item vcs-changes__item--${d.action}`}>
              <span className="vcs-changes__action">
                {d.action === "added" ? "+" : d.action === "removed" ? "−" : "~"}
              </span>
              <span className="vcs-changes__desc">
                {d.action === "added" && d.after && `${d.after.type} on layer ${d.after.layerId}`}
                {d.action === "removed" && d.before && `${d.before.type} on layer ${d.before.layerId}`}
                {d.action === "modified" && d.before && `${d.before.type} on layer ${d.before.layerId}`}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── History Tab ───────────────────────────────────────────────────

function HistoryTab({
  history,
  currentBranch,
  onViewDiff,
}: {
  history: VcsCommit[];
  currentBranch: string;
  onViewDiff: (commit: VcsCommit) => void;
}) {
  return (
    <div className="vcs-history">
      <div className="vcs-history__branch-label">
        On branch: <strong>{currentBranch}</strong>
      </div>
      {history.length === 0 && <div className="vcs-history__empty">No commits</div>}
      {history.map((commit) => (
        <div
          key={commit.id}
          className="vcs-history__commit"
          onClick={() => onViewDiff(commit)}
          title="Click to view diff"
        >
          <div className="vcs-history__graph">
            <span className="vcs-history__dot" />
            <span className="vcs-history__line" />
          </div>
          <div className="vcs-history__info">
            <div className="vcs-history__msg">{commit.message}</div>
            <div className="vcs-history__meta">
              <span className="vcs-history__id">{commit.id}</span>
              <span className="vcs-history__time">{formatRelTime(commit.timestamp)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Branches Tab ──────────────────────────────────────────────────

function BranchesTab({
  branches,
  currentBranch,
  newBranchName,
  setNewBranchName,
  onCreateBranch,
  onCheckout,
  onDelete,
  isMerging,
  onStartMerge,
}: {
  branches: string[];
  currentBranch: string;
  newBranchName: string;
  setNewBranchName: (v: string) => void;
  onCreateBranch: () => void;
  onCheckout: (name: string) => void;
  onDelete: (name: string) => void;
  isMerging: boolean;
  onStartMerge: (source: string) => void;
}) {
  return (
    <div className="vcs-branches">
      <div className="vcs-branches__create">
        <input
          className="vcs-branches__input"
          placeholder="New branch name…"
          value={newBranchName}
          onChange={(e) => setNewBranchName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onCreateBranch()}
        />
        <button className="vcs-panel__btn" onClick={onCreateBranch} disabled={!newBranchName.trim()}>
          Create
        </button>
      </div>
      <div className="vcs-branches__list">
        {branches.map((name) => (
          <div key={name} className={`vcs-branches__item ${name === currentBranch ? "vcs-branches__item--current" : ""}`}>
            <span className="vcs-branches__name">
              {name === currentBranch && "● "}{name}
            </span>
            <div className="vcs-branches__actions">
              {name !== currentBranch && (
                <>
                  <button className="vcs-panel__btn-sm" onClick={() => onCheckout(name)}>Checkout</button>
                  <button className="vcs-panel__btn-sm" onClick={() => onStartMerge(name)} disabled={isMerging}>Merge</button>
                  {name !== "main" && (
                    <button className="vcs-panel__btn-sm vcs-panel__btn-sm--danger" onClick={() => onDelete(name)}>✕</button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Merge Bar ─────────────────────────────────────────────────────

function MergeBar({
  source,
  conflicts,
  onResolve,
  onComplete,
  onAbort,
}: {
  source: string;
  conflicts: { resolution: string | null; targetGeom: { type: string; layerId: number }; sourceGeom: { type: string; layerId: number } }[];
  onResolve: (index: number, resolution: "target" | "source") => void;
  onComplete: () => void;
  onAbort: () => void;
}) {
  const allResolved = conflicts.every((c) => c.resolution !== null);

  return (
    <div className="vcs-merge-bar">
      <div className="vcs-merge-bar__header">
        Merging from <strong>{source}</strong> — {conflicts.length} conflict{conflicts.length !== 1 ? "s" : ""}
      </div>
      {conflicts.map((c, i) => (
        <div key={i} className="vcs-merge-bar__conflict">
          <span>{c.targetGeom.type}@L{c.targetGeom.layerId} vs {c.sourceGeom.type}@L{c.sourceGeom.layerId}</span>
          <div className="vcs-merge-bar__btns">
            <button
              className={`vcs-panel__btn-sm ${c.resolution === "target" ? "vcs-panel__btn-sm--selected" : ""}`}
              onClick={() => onResolve(i, "target")}
            >
              Keep Ours
            </button>
            <button
              className={`vcs-panel__btn-sm ${c.resolution === "source" ? "vcs-panel__btn-sm--selected" : ""}`}
              onClick={() => onResolve(i, "source")}
            >
              Take Theirs
            </button>
          </div>
        </div>
      ))}
      <div className="vcs-merge-bar__actions">
        <button className="vcs-panel__btn vcs-panel__btn--primary" onClick={onComplete} disabled={!allResolved}>
          Complete Merge
        </button>
        <button className="vcs-panel__btn" onClick={onAbort}>Abort</button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────

function formatRelTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}
