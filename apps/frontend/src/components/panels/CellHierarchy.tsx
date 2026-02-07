/**
 * Cell Hierarchy Panel — tree view of the design hierarchy.
 *
 * Shows:
 *  - Top-level cell (project) with geometry count by layer
 *  - Cell library definitions grouped by category
 *  - Placed instances with position, rotation, mirror info
 *  - Click-to-select instance or geometry group
 *  - Expand/collapse for each tree node
 */

import { useState, useMemo, useCallback } from "react";
import { useGeometryStore } from "../../stores/geometryStore";
import { useLayerStore } from "../../stores/layerStore";
import { useCellStore, type CellDefinition, type CellInstance, type CellCategory } from "../../stores/cellStore";
import { useToolStore } from "../../stores/toolStore";
import "./CellHierarchy.css";

// ── Category icons ────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<CellCategory, string> = {
  transistor: "🔌",
  passive: "⚡",
  contact: "◻",
  "standard-cell": "🔲",
  macro: "📦",
  pad: "📍",
  esd: "🛡",
  "guard-ring": "🔄",
  custom: "✏",
};

// ── Tree node component ───────────────────────────────────────────────

function TreeNode({
  label,
  icon,
  badge,
  badgeColor,
  depth,
  expandable,
  defaultExpanded,
  selected,
  onClick,
  onDoubleClick,
  children,
}: {
  label: string;
  icon?: string;
  badge?: string | number;
  badgeColor?: string;
  depth: number;
  expandable?: boolean;
  defaultExpanded?: boolean;
  selected?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  children?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);

  return (
    <div className="cell-tree__node">
      <div
        className={`cell-tree__row ${selected ? "cell-tree__row--selected" : ""}`}
        style={{ paddingLeft: depth * 14 + 6 }}
        onClick={() => {
          if (expandable) setExpanded((v) => !v);
          onClick?.();
        }}
        onDoubleClick={onDoubleClick}
      >
        {expandable ? (
          <span className={`cell-tree__chevron ${expanded ? "cell-tree__chevron--open" : ""}`}>
            ▸
          </span>
        ) : (
          <span className="cell-tree__spacer" />
        )}
        {icon && <span className="cell-tree__icon">{icon}</span>}
        <span className="cell-tree__label">{label}</span>
        {badge !== undefined && (
          <span className="cell-tree__badge" style={badgeColor ? { color: badgeColor } : undefined}>
            {badge}
          </span>
        )}
      </div>
      {expanded && children && (
        <div className="cell-tree__children">{children}</div>
      )}
    </div>
  );
}

// ── Layer color swatch ────────────────────────────────────────────────

function LayerSwatch({ color, visible }: { color: string; visible: boolean }) {
  return (
    <span
      className="cell-tree__swatch"
      style={{ backgroundColor: color, opacity: visible ? 1 : 0.3 }}
    />
  );
}

// ── Instance row ──────────────────────────────────────────────────────

function InstanceRow({
  instance,
  cellDef,
  depth,
  isSelected,
  onSelect,
}: {
  instance: CellInstance;
  cellDef: CellDefinition | undefined;
  depth: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const posLabel = `(${instance.position.x.toFixed(2)}, ${instance.position.y.toFixed(2)})`;
  const rotMirror = [
    instance.rotation !== 0 ? `R${instance.rotation}` : "",
    instance.mirror ? "MX" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <TreeNode
      label={instance.instanceName}
      icon={cellDef ? CATEGORY_ICONS[cellDef.category] : "?"}
      badge={rotMirror || posLabel}
      depth={depth}
      expandable={!!cellDef && cellDef.pins.length > 0}
      selected={isSelected}
      onClick={() => onSelect(instance.id)}
    >
      {cellDef && cellDef.pins.length > 0 && (
        <>
          {cellDef.pins.map((pin) => {
            const netName = instance.connections[pin.name];
            return (
              <TreeNode
                key={pin.name}
                label={pin.name}
                badge={netName || "—"}
                badgeColor={netName ? "#4ade80" : "#666"}
                depth={depth + 1}
                icon={pin.direction === "input" ? "→" : pin.direction === "output" ? "←" : "↔"}
              />
            );
          })}
        </>
      )}
    </TreeNode>
  );
}

// ── Main CellHierarchy component ──────────────────────────────────────

export function CellHierarchy() {
  const geometries = useGeometryStore((s) => s.geometries);
  const projectName = useGeometryStore((s) => s.projectName);
  const layers = useLayerStore((s) => s.layers);

  const cellLibrary = useCellStore((s) => s.cellLibrary);
  const instances = useCellStore((s) => s.instances);
  const selectedInstances = useCellStore((s) => s.selectedInstances);
  const selectInstances = useCellStore((s) => s.selectInstances);

  const selectedItems = useToolStore((s) => s.selectedItems);

  // Group geometries by layer
  const byLayer = useMemo(() => {
    const map = new Map<number, number>();
    for (const g of geometries) {
      map.set(g.layerId, (map.get(g.layerId) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [geometries]);

  // Group cell definitions by category
  const cellsByCategory = useMemo(() => {
    const map = new Map<CellCategory, CellDefinition[]>();
    for (const cell of cellLibrary.values()) {
      const list = map.get(cell.category) ?? [];
      list.push(cell);
      map.set(cell.category, list);
    }
    return map;
  }, [cellLibrary]);

  // Count instances per cell definition
  const instanceCountByCell = useMemo(() => {
    const map = new Map<string, number>();
    for (const inst of instances) {
      map.set(inst.cellId, (map.get(inst.cellId) ?? 0) + 1);
    }
    return map;
  }, [instances]);

  const handleSelectInstance = useCallback(
    (id: string) => {
      selectInstances([id]);
    },
    [selectInstances],
  );

  const isEmpty = geometries.length === 0 && instances.length === 0 && cellLibrary.size === 0;

  if (isEmpty) {
    return (
      <div className="cell-hierarchy">
        <div className="cell-hierarchy__empty">
          <p>No design data.</p>
          <p className="cell-hierarchy__hint">
            Draw shapes or use <em>Load Demo Layout</em> from the Command Palette (Ctrl+Shift+P).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="cell-hierarchy">
      {/* Top Cell — project root */}
      <TreeNode
        label={projectName}
        icon="📐"
        badge={`${geometries.length} geom${geometries.length !== 1 ? "s" : ""}`}
        depth={0}
        expandable
        defaultExpanded
      >
        {/* Flat geometries grouped by layer */}
        {byLayer.map(([layerId, count]) => {
          const layer = layers.find((l) => l.id === layerId);
          return (
            <div key={layerId} className="cell-tree__layer-row" style={{ paddingLeft: 26 }}>
              <LayerSwatch color={layer?.color ?? "#888"} visible={layer?.visible ?? true} />
              <span className="cell-tree__label">{layer?.name ?? `Layer ${layerId}`}</span>
              <span className="cell-tree__badge">{count}</span>
            </div>
          );
        })}

        {/* Placed instances */}
        {instances.length > 0 && (
          <TreeNode
            label="Instances"
            icon="📋"
            badge={instances.length}
            depth={1}
            expandable
            defaultExpanded
          >
            {instances.map((inst) => (
              <InstanceRow
                key={inst.id}
                instance={inst}
                cellDef={cellLibrary.get(inst.cellId)}
                depth={2}
                isSelected={selectedInstances.includes(inst.id)}
                onSelect={handleSelectInstance}
              />
            ))}
          </TreeNode>
        )}
      </TreeNode>

      {/* Cell Library */}
      {cellLibrary.size > 0 && (
        <TreeNode
          label="Cell Library"
          icon="📚"
          badge={cellLibrary.size}
          depth={0}
          expandable
          defaultExpanded={false}
        >
          {Array.from(cellsByCategory.entries()).map(([category, cells]) => (
            <TreeNode
              key={category}
              label={category}
              icon={CATEGORY_ICONS[category]}
              badge={cells.length}
              depth={1}
              expandable
            >
              {cells.map((cell) => (
                <TreeNode
                  key={cell.id}
                  label={cell.name}
                  badge={`${instanceCountByCell.get(cell.id) ?? 0}×`}
                  badgeColor={instanceCountByCell.has(cell.id) ? "#818cf8" : "#555"}
                  depth={2}
                />
              ))}
            </TreeNode>
          ))}
        </TreeNode>
      )}

      {/* Selection info */}
      {selectedItems.length > 0 && (
        <div className="cell-hierarchy__selection-info">
          {selectedItems.length} geometry selected
        </div>
      )}
      {selectedInstances.length > 0 && (
        <div className="cell-hierarchy__selection-info">
          {selectedInstances.length} instance selected
        </div>
      )}
    </div>
  );
}
