/**
 * DiffEditor — Side-by-side file comparison view.
 *
 * Shows two files aligned line-by-line with additions (green),
 * deletions (red), and unchanged lines. Supports ignore-whitespace toggle.
 */

import { useMemo } from "react";
import { useDiffStore, type DiffLine } from "../../stores/diffStore";
import { useHdlStore } from "../../stores/hdlStore";
import {
  GitCompare,
  ToggleLeft,
  ToggleRight,
  FileCode,
  Plus,
  Minus,
  Equal,
} from "lucide-react";
import "./DiffEditor.css";

export function DiffEditor() {
  const activeDiff = useDiffStore((s) => s.activeDiff);
  const ignoreWhitespace = useDiffStore((s) => s.ignoreWhitespace);
  const setIgnoreWhitespace = useDiffStore((s) => s.setIgnoreWhitespace);
  const computeDiff = useDiffStore((s) => s.computeDiff);
  const clearDiff = useDiffStore((s) => s.clearDiff);
  const files = useHdlStore((s) => s.files);

  const fileList = useMemo(() => Array.from(files.values()), [files]);

  /* ── Prompt to select files if no diff is active ── */
  if (!activeDiff) {
    return (
      <div className="diff-editor">
        <div className="diff-editor__empty">
          <GitCompare size={48} style={{ opacity: 0.3 }} />
          <div className="diff-editor__empty-title">Compare Files</div>
          <div style={{ color: "var(--os-fg-muted)", fontSize: 12 }}>
            Select two HDL files to compare side-by-side
          </div>
          {fileList.length >= 2 ? (
            <div className="diff-editor__file-picker">
              <FileSelector
                label="Left file"
                files={fileList}
                onSelect={(idx) => {
                  const right = fileList.find((_, i) => i !== idx);
                  if (right) {
                    computeDiff(
                      fileList[idx].filename,
                      fileList[idx].content,
                      right.filename,
                      right.content,
                    );
                  }
                }}
              />
            </div>
          ) : (
            <div style={{ color: "var(--os-fg-muted)", fontSize: 11, marginTop: 8 }}>
              Open at least two HDL files to compare.
            </div>
          )}
        </div>
      </div>
    );
  }

  const { leftTitle, rightTitle, lines, stats } = activeDiff;

  return (
    <div className="diff-editor">
      {/* Header */}
      <div className="diff-editor__header">
        <div className="diff-editor__titles">
          <span className="diff-editor__file diff-editor__file--left">
            <FileCode size={13} /> {leftTitle}
          </span>
          <GitCompare size={14} style={{ color: "var(--os-fg-muted)" }} />
          <span className="diff-editor__file diff-editor__file--right">
            <FileCode size={13} /> {rightTitle}
          </span>
        </div>
        <div className="diff-editor__stats">
          <span className="diff-editor__stat diff-editor__stat--added">
            <Plus size={11} /> {stats.added}
          </span>
          <span className="diff-editor__stat diff-editor__stat--removed">
            <Minus size={11} /> {stats.removed}
          </span>
          <span className="diff-editor__stat diff-editor__stat--equal">
            <Equal size={11} /> {stats.equal}
          </span>
        </div>
        <div className="diff-editor__controls">
          <button
            className="diff-editor__ctrl-btn"
            title={`Ignore whitespace: ${ignoreWhitespace ? "ON" : "OFF"}`}
            onClick={() => {
              setIgnoreWhitespace(!ignoreWhitespace);
              // Re-compute
              computeDiff(leftTitle, "", rightTitle, ""); // will be recomputed via effect
            }}
          >
            {ignoreWhitespace ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
            <span>Whitespace</span>
          </button>
          <button className="diff-editor__ctrl-btn" onClick={clearDiff}>
            Close Diff
          </button>
        </div>
      </div>

      {/* Side-by-side view */}
      <div className="diff-editor__body">
        {/* Left pane */}
        <div className="diff-editor__pane diff-editor__pane--left">
          <div className="diff-editor__pane-header">{leftTitle}</div>
          <div className="diff-editor__lines">
            {lines.map((line, i) => (
              <DiffLineRow key={i} line={line} side="left" />
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="diff-editor__divider" />

        {/* Right pane */}
        <div className="diff-editor__pane diff-editor__pane--right">
          <div className="diff-editor__pane-header">{rightTitle}</div>
          <div className="diff-editor__lines">
            {lines.map((line, i) => (
              <DiffLineRow key={i} line={line} side="right" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Diff line row ── */

function DiffLineRow({ line, side }: { line: DiffLine; side: "left" | "right" }) {
  const lineNo = side === "left" ? line.leftLineNo : line.rightLineNo;
  const text = side === "left" ? line.leftText : line.rightText;

  let className = "diff-editor__line";
  if (line.kind === "added") {
    className += side === "right" ? " diff-editor__line--added" : " diff-editor__line--empty";
  } else if (line.kind === "removed") {
    className += side === "left" ? " diff-editor__line--removed" : " diff-editor__line--empty";
  } else if (line.kind === "modified") {
    className += " diff-editor__line--modified";
  }

  return (
    <div className={className}>
      <span className="diff-editor__line-no">{lineNo ?? ""}</span>
      <span className="diff-editor__line-text">
        {(line.kind === "added" && side === "left") || (line.kind === "removed" && side === "right")
          ? ""
          : text}
      </span>
    </div>
  );
}

/* ── File selector helper ── */

function FileSelector({
  label,
  files,
  onSelect,
}: {
  label: string;
  files: Array<{ id: string; filename: string }>;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="diff-editor__selector">
      <label className="diff-editor__selector-label">{label}</label>
      <div className="diff-editor__selector-list">
        {files.map((f, i) => (
          <button
            key={f.id}
            className="diff-editor__selector-btn"
            onClick={() => onSelect(i)}
          >
            <FileCode size={12} /> {f.filename}
          </button>
        ))}
      </div>
    </div>
  );
}
