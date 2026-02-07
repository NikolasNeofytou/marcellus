import { useState } from "react";
import { useGitIntegrationStore } from "../../stores/gitIntegrationStore";
import {
  GitPullRequest, Lock, Unlock, Layers, Eye, EyeOff,
  RefreshCw, ExternalLink, MessageSquare, Filter,
} from "lucide-react";
import "./GitIntegrationPanel.css";

type Tab = "xor" | "locks" | "prs";

export function GitIntegrationPanel() {
  const [tab, setTab] = useState<Tab>("xor");

  return (
    <div className="git-panel">
      {/* ── Tabs ─────────────────────────────────────────────── */}
      <div className="git-panel__tabs">
        {([
          ["xor", "XOR Diff", <Layers size={13} key="xor" />],
          ["locks", "Locks", <Lock size={13} key="locks" />],
          ["prs", "Pull Requests", <GitPullRequest size={13} key="prs" />],
        ] as [Tab, string, React.ReactNode][]).map(([id, label, icon]) => (
          <button
            key={id}
            className={`git-panel__tab ${tab === id ? "git-panel__tab--active" : ""}`}
            onClick={() => setTab(id)}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {/* ── XOR Diff ─────────────────────────────────────────── */}
      {tab === "xor" && <XorTab />}

      {/* ── Locks ────────────────────────────────────────────── */}
      {tab === "locks" && <LocksTab />}

      {/* ── Pull Requests ────────────────────────────────────── */}
      {tab === "prs" && <PullRequestsTab />}
    </div>
  );
}

/* ── XOR Overlay Tab ────────────────────────────────────────────── */

function XorTab() {
  const {
    xorResult, xorOverlay, computeXor, clearXor, setXorOverlay, diffViewMode, setDiffViewMode,
  } = useGitIntegrationStore();

  const visibleRegions = useGitIntegrationStore((s) => s.getVisibleXorRegions());

  return (
    <div>
      {/* Controls */}
      <div className="git-panel__section">
        <div className="git-panel__label">XOR Overlay</div>
        <div style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
          <button className="git-panel__btn git-panel__btn--primary" onClick={() => computeXor([], [], "HEAD", "Working")}>
            <Layers size={12} /> Compute XOR
          </button>
          <button className="git-panel__btn" onClick={clearXor} disabled={!xorResult}>
            Clear
          </button>
        </div>

        {/* Toggle overlay */}
        <div className="git-panel__toggle" onClick={() => setXorOverlay({ enabled: !xorOverlay.enabled })}>
          <div className={`git-panel__toggle-track ${xorOverlay.enabled ? "git-panel__toggle-track--on" : ""}`}>
            <div className="git-panel__toggle-knob" />
          </div>
          <span>{xorOverlay.enabled ? <Eye size={12} /> : <EyeOff size={12} />} Show overlay</span>
        </div>

        {/* Colors & opacity */}
        <div style={{ display: "flex", gap: 12, marginTop: 6, alignItems: "center" }}>
          <span style={{ fontSize: 10 }}>Only A</span>
          <div className="git-panel__color-chip" style={{ background: xorOverlay.colorA }} />
          <span style={{ fontSize: 10 }}>Only B</span>
          <div className="git-panel__color-chip" style={{ background: xorOverlay.colorB }} />
          <span style={{ fontSize: 10 }}>Opacity</span>
          <input
            className="git-panel__slider"
            type="range" min={0} max={1} step={0.05}
            value={xorOverlay.opacity}
            onChange={(e) => setXorOverlay({ opacity: Number(e.target.value) })}
          />
        </div>
      </div>

      {/* View mode */}
      <div className="git-panel__section">
        <div className="git-panel__label">View Mode</div>
        <div style={{ display: "flex", gap: 4 }}>
          {(["split", "unified", "xor"] as const).map((m) => (
            <button
              key={m}
              className={`git-panel__btn git-panel__btn--sm ${diffViewMode === m ? "git-panel__btn--primary" : ""}`}
              onClick={() => setDiffViewMode(m)}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      {xorResult && (
        <div className="git-panel__section">
          <div className="git-panel__label">
            Diff Result — {xorResult.xorRegions.length} region(s), {xorResult.totalDiffArea.toFixed(1)} diff area
          </div>
          {visibleRegions.map((r, i) => {
            const xs = r.polygon.map((p) => p.x);
            const ys = r.polygon.map((p) => p.y);
            const bx = Math.min(...xs);
            const by = Math.min(...ys);
            const bw = Math.max(...xs) - bx;
            const bh = Math.max(...ys) - by;
            return (
              <div
                key={i}
                className={`git-panel__xor-region git-panel__xor-region--${r.side === "only-a" ? "added" : "removed"}`}
              >
                {r.side} — Layer {r.layerId} @ ({bx.toFixed(2)}, {by.toFixed(2)})
                {" "}{bw.toFixed(2)}×{bh.toFixed(2)}
              </div>
            );
          })}
          {xorResult.xorRegions.length === 0 && (
            <div style={{ color: "#22c55e", fontSize: 11 }}>Layouts are identical</div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Cell Locks Tab ─────────────────────────────────────────────── */

function LocksTab() {
  const { lockList, acquireLock, releaseLock } = useGitIntegrationStore();
  const [cellInput, setCellInput] = useState("");

  return (
    <div>
      <div className="git-panel__section">
        <div className="git-panel__label">Cell-Level Locking</div>
        <div style={{ display: "flex", gap: 4 }}>
          <input
            type="text"
            placeholder="Cell name…"
            value={cellInput}
            onChange={(e) => setCellInput(e.target.value)}
            style={{
              flex: 1, padding: "4px 8px", fontSize: 11, background: "var(--surface, #1e1e1e)",
              border: "1px solid var(--border, #444)", borderRadius: 4, color: "var(--text, #eee)",
            }}
          />
          <button
            className="git-panel__btn git-panel__btn--primary git-panel__btn--sm"
            disabled={!cellInput.trim()}
            onClick={() => { acquireLock(cellInput.trim(), cellInput.trim()); setCellInput(""); }}
          >
            <Lock size={11} /> Lock
          </button>
        </div>
      </div>

      <div className="git-panel__section">
        <div className="git-panel__label">Active Locks ({lockList.length})</div>
        {lockList.length === 0 && (
          <div style={{ color: "var(--text-secondary)", fontSize: 11 }}>No active locks</div>
        )}
        {lockList.map((lock) => (
          <div key={lock.cellName} className="git-panel__row">
            <span className="git-panel__badge git-panel__badge--lock">
              <Lock size={10} />
            </span>
            <span style={{ flex: 1, fontFamily: "monospace" }}>{lock.cellName}</span>
            <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>
              {lock.lockedBy} · {new Date(lock.lockedAt).toLocaleTimeString()}
            </span>
            <button
              className="git-panel__btn git-panel__btn--sm"
              onClick={() => releaseLock(lock.cellName)}
            >
              <Unlock size={10} /> Release
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Pull Requests Tab ──────────────────────────────────────────── */

function PullRequestsTab() {
  const { pullRequests, prFilter, fetchPullRequests, remoteConfig } = useGitIntegrationStore();
  const setPrFilter = useGitIntegrationStore((s) => s.setPrFilter);

  return (
    <div>
      <div className="git-panel__section">
        <div className="git-panel__label">Remote: {remoteConfig?.provider ?? "none"}</div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <button className="git-panel__btn" onClick={() => fetchPullRequests(["main", "feature/layout", "bugfix/drc"])}>
            <RefreshCw size={12} /> Fetch PRs
          </button>
          <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
            <Filter size={11} />
            {(["all", "open", "merged", "closed"] as const).map((f) => (
              <button
                key={f}
                className={`git-panel__btn git-panel__btn--sm ${prFilter === f ? "git-panel__btn--primary" : ""}`}
                onClick={() => setPrFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="git-panel__section">
        {pullRequests.length === 0 && (
          <div style={{ color: "var(--text-secondary)", fontSize: 11 }}>
            No pull requests. Click "Fetch PRs" to load demo data.
          </div>
        )}
        {pullRequests.map((pr) => (
          <div key={pr.id} className="git-panel__pr-card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div className="git-panel__pr-title">
                <GitPullRequest size={12} /> #{pr.id} {pr.title}
              </div>
              <span className={`git-panel__pr-status git-panel__pr-status--${pr.state}`}>
                {pr.state}
              </span>
            </div>
            <div className="git-panel__pr-meta">
              {pr.author} · {pr.sourceBranch} → {pr.targetBranch}
            </div>
            <div className="git-panel__pr-meta">
              <span className="git-panel__badge git-panel__badge--add">+{pr.diffStats.additions}</span>{" "}
              <span className="git-panel__badge git-panel__badge--del">-{pr.diffStats.deletions}</span>{" "}
              <MessageSquare size={10} /> {pr.comments}
              {" · "}{new Date(pr.updatedAt).toLocaleDateString()}
            </div>
            <div style={{ marginTop: 4 }}>
              <button className="git-panel__btn git-panel__btn--sm">
                <ExternalLink size={10} /> View
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
