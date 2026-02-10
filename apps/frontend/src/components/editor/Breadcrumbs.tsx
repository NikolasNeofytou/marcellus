/**
 * Breadcrumbs — Navigation breadcrumbs showing file path + current module context.
 *
 * Displays: Project › folder › file.sv › module_name › always_ff block
 * Clicking on any crumb navigates to that scope.
 */

import { useMemo } from "react";
import { useHdlStore } from "../../stores/hdlStore";
import { FileCode, ChevronRight, Folder, Box } from "lucide-react";
import "./Breadcrumbs.css";

interface Crumb {
  label: string;
  icon: React.ReactNode;
  action?: () => void;
}

export function Breadcrumbs() {
  const files = useHdlStore((s) => s.files);
  const activeFileId = useHdlStore((s) => s.activeFileId);
  const activeFile = activeFileId ? files.get(activeFileId) : null;
  const setCursorPosition = useHdlStore((s) => s.setCursorPosition);

  const crumbs = useMemo<Crumb[]>(() => {
    if (!activeFile) return [];

    const result: Crumb[] = [];

    // Project root
    result.push({
      label: "Project",
      icon: <Folder size={12} className="breadcrumbs__icon" />,
    });

    // File path segments
    const parts = activeFile.filename.replace(/\\/g, "/").split("/");
    if (parts.length > 1) {
      // Directory segments
      for (let i = 0; i < parts.length - 1; i++) {
        result.push({
          label: parts[i],
          icon: <Folder size={12} className="breadcrumbs__icon" />,
        });
      }
    }

    // File name
    result.push({
      label: parts[parts.length - 1],
      icon: <FileCode size={12} className="breadcrumbs__icon" />,
    });

    // Current module context (based on cursor line)
    if (activeFile.parseResult) {
      const cursorLine = activeFile.cursorLine ?? 1;
      for (const mod of activeFile.parseResult.modules) {
        if (cursorLine >= mod.startLine && cursorLine <= mod.endLine) {
          result.push({
            label: mod.name,
            icon: <Box size={12} className="breadcrumbs__icon" />,
            action: () => setCursorPosition(activeFile.id, mod.startLine, 1),
          });

          // Check if inside always block
          const lines = activeFile.content.split("\n");
          let blockName: string | null = null;
          let blockLine = 0;
          for (let i = mod.startLine - 1; i < cursorLine && i < lines.length; i++) {
            const trimmed = lines[i].trim();
            const alwaysMatch = trimmed.match(/^(always|always_ff|always_comb|always_latch|initial)\b/);
            if (alwaysMatch) {
              blockName = alwaysMatch[1];
              blockLine = i + 1;
            }
          }
          if (blockName) {
            result.push({
              label: blockName,
              icon: <span style={{ fontSize: 11, opacity: 0.7 }}>⟳</span>,
              action: () => setCursorPosition(activeFile.id, blockLine, 1),
            });
          }

          break;
        }
      }
    }

    return result;
  }, [activeFile, setCursorPosition]);

  if (crumbs.length === 0) return null;

  return (
    <div className="breadcrumbs" role="navigation" aria-label="Breadcrumbs">
      {crumbs.map((crumb, i) => (
        <span key={i} style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {i > 0 && (
            <span className="breadcrumbs__separator">
              <ChevronRight size={10} />
            </span>
          )}
          <button
            className={`breadcrumbs__item ${i === crumbs.length - 1 ? "breadcrumbs__item--active" : ""}`}
            onClick={crumb.action}
            disabled={!crumb.action}
          >
            {crumb.icon}
            {crumb.label}
          </button>
        </span>
      ))}
    </div>
  );
}
