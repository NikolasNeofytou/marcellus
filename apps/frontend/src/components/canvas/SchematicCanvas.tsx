/**
 * SchematicCanvas — interactive schematic capture editor.
 *
 * Renders symbols, wires, labels, ports, and nets on a Canvas2D surface.
 * Supports:
 *  - Symbol placement & move
 *  - Wire drawing (Manhattan routing)
 *  - Net highlighting for cross-probing
 *  - Terminal labels
 *  - Pan & zoom
 */

import { useRef, useEffect, useCallback, useState } from "react";
import {
  useSchematicStore,
  type SchematicSymbol,
  type SchematicWire,
  type SchematicLabel,
  type SchematicPort,
  type SchematicElement,
  type SchematicPoint,
  type SubcircuitInstance,
  type BusWire,
  type BusTap,
} from "../../stores/schematicStore";
import { useCrossProbeStore } from "../../stores/crossProbeStore";
import "./SchematicCanvas.css";

// ── Symbol drawing primitives ─────────────────────────────────────────

function drawMOSSymbol(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  scale: number,
  isPmos: boolean
) {
  ctx.lineWidth = 2;
  // Body
  ctx.beginPath();
  ctx.moveTo(x - 0.6 * scale, y - 0.8 * scale);
  ctx.lineTo(x - 0.6 * scale, y + 0.8 * scale);
  ctx.stroke();
  // Gate
  ctx.beginPath();
  ctx.moveTo(x - 0.8 * scale, y - 0.6 * scale);
  ctx.lineTo(x - 0.8 * scale, y + 0.6 * scale);
  ctx.stroke();
  // Gate lead
  ctx.beginPath();
  ctx.moveTo(x - scale, y);
  ctx.lineTo(x - 0.8 * scale, y);
  ctx.stroke();
  // Drain
  ctx.beginPath();
  ctx.moveTo(x - 0.6 * scale, y - 0.5 * scale);
  ctx.lineTo(x, y - 0.5 * scale);
  ctx.lineTo(x, y - scale);
  ctx.stroke();
  // Source
  ctx.beginPath();
  ctx.moveTo(x - 0.6 * scale, y + 0.5 * scale);
  ctx.lineTo(x, y + 0.5 * scale);
  ctx.lineTo(x, y + scale);
  ctx.stroke();
  // Body connection
  ctx.beginPath();
  ctx.moveTo(x - 0.6 * scale, y);
  ctx.lineTo(x + scale * 0.3, y);
  ctx.lineTo(x + scale, y);
  ctx.stroke();
  // Arrow (NMOS: into channel, PMOS: out + bubble)
  if (isPmos) {
    ctx.beginPath();
    ctx.arc(x - 0.7 * scale, y, 0.06 * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawResistorSymbol(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - scale);
  ctx.lineTo(x, y - 0.7 * scale);
  // Zigzag
  const zigW = 0.3 * scale;
  const steps = 4;
  const stepH = (1.4 * scale) / steps;
  for (let i = 0; i < steps; i++) {
    const yy = y - 0.7 * scale + i * stepH;
    ctx.lineTo(x + (i % 2 === 0 ? zigW : -zigW), yy + stepH / 2);
    ctx.lineTo(x, yy + stepH);
  }
  ctx.lineTo(x, y + scale);
  ctx.stroke();
}

function drawCapacitorSymbol(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.lineWidth = 2;
  // Top lead
  ctx.beginPath();
  ctx.moveTo(x, y - scale);
  ctx.lineTo(x, y - 0.2 * scale);
  ctx.stroke();
  // Top plate
  ctx.beginPath();
  ctx.moveTo(x - 0.4 * scale, y - 0.2 * scale);
  ctx.lineTo(x + 0.4 * scale, y - 0.2 * scale);
  ctx.stroke();
  // Bottom plate
  ctx.beginPath();
  ctx.moveTo(x - 0.4 * scale, y + 0.2 * scale);
  ctx.lineTo(x + 0.4 * scale, y + 0.2 * scale);
  ctx.stroke();
  // Bottom lead
  ctx.beginPath();
  ctx.moveTo(x, y + 0.2 * scale);
  ctx.lineTo(x, y + scale);
  ctx.stroke();
}

function drawGroundSymbol(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y - scale);
  ctx.lineTo(x, y);
  ctx.stroke();
  // Three horizontal lines
  for (let i = 0; i < 3; i++) {
    const w = (0.5 - i * 0.15) * scale;
    const yy = y + i * 0.15 * scale;
    ctx.beginPath();
    ctx.moveTo(x - w, yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
  }
}

function drawVddSymbol(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number) {
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + scale);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x - 0.4 * scale, y);
  ctx.lineTo(x + 0.4 * scale, y);
  ctx.stroke();
}

function drawSymbol(ctx: CanvasRenderingContext2D, sym: SchematicSymbol, scale: number, highlighted: boolean) {
  const { x, y } = sym.position;
  const sx = x * scale;
  const sy = y * scale;

  ctx.save();
  ctx.strokeStyle = highlighted ? "#ffcc00" : "#e0e0e0";
  ctx.fillStyle = highlighted ? "#ffcc00" : "#e0e0e0";

  switch (sym.deviceType) {
    case "nmos":
      drawMOSSymbol(ctx, sx, sy, scale * 0.8, false);
      break;
    case "pmos":
      drawMOSSymbol(ctx, sx, sy, scale * 0.8, true);
      break;
    case "resistor":
      drawResistorSymbol(ctx, sx, sy, scale * 0.6);
      break;
    case "capacitor":
      drawCapacitorSymbol(ctx, sx, sy, scale * 0.6);
      break;
    case "ground":
      drawGroundSymbol(ctx, sx, sy, scale * 0.4);
      break;
    case "vdd":
      drawVddSymbol(ctx, sx, sy, scale * 0.4);
      break;
    default: {
      // Generic box symbol
      ctx.strokeRect(sx - 0.5 * scale, sy - 0.5 * scale, scale, scale);
      ctx.font = `${scale * 0.3}px monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(sym.deviceType, sx, sy);
    }
  }

  // Draw instance name label
  ctx.font = `bold ${scale * 0.3}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = "#82aaff";
  ctx.fillText(sym.instanceName, sx + scale * 0.4, sy - scale * 0.4);

  // Draw parameter annotation
  const paramStr = Object.entries(sym.parameters)
    .map(([k, v]) => `${k}=${typeof v === "number" ? formatParam(v) : v}`)
    .join(" ");
  if (paramStr) {
    ctx.font = `${scale * 0.22}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = "#888";
    ctx.fillText(paramStr, sx + scale * 0.4, sy - scale * 0.15);
  }

  // Draw terminal labels on pins
  ctx.font = `${scale * 0.22}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const pin of sym.pins) {
    const px = sx + pin.position.x * scale * 0.8;
    const py = sy + pin.position.y * scale * 0.8;

    // Pin dot
    ctx.fillStyle = highlighted ? "#ffcc00" : "#66d9ef";
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, Math.PI * 2);
    ctx.fill();

    // Pin name
    ctx.fillStyle = "#a9b7c6";
    const offset = 12;
    const lx = pin.direction === "left" ? px - offset : pin.direction === "right" ? px + offset : px;
    const ly = pin.direction === "top" ? py - offset : pin.direction === "bottom" ? py + offset : py;
    ctx.fillText(pin.name, lx, ly);

    // Net name if assigned
    if (pin.netName) {
      ctx.fillStyle = "#c3e88d";
      const nx = pin.direction === "left" ? px - offset - 20 : pin.direction === "right" ? px + offset + 20 : px;
      const ny = pin.direction === "top" ? py - offset - 10 : pin.direction === "bottom" ? py + offset + 10 : py;
      ctx.fillText(pin.netName, nx, ny);
    }
  }

  ctx.restore();
}

function formatParam(v: number): string {
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  if (v >= 1) return `${v.toFixed(2)}`;
  if (v >= 1e-3) return `${(v * 1e3).toFixed(1)}m`;
  if (v >= 1e-6) return `${(v * 1e6).toFixed(1)}μ`;
  if (v >= 1e-9) return `${(v * 1e9).toFixed(1)}n`;
  if (v >= 1e-12) return `${(v * 1e12).toFixed(1)}p`;
  return v.toExponential(2);
}

function drawSubcircuitInstance(ctx: CanvasRenderingContext2D, inst: SubcircuitInstance, scale: number, highlighted: boolean, cellLibrary: Map<string, any>) {
  const { x, y } = inst.position;
  const sx = x * scale;
  const sy = y * scale;
  const w = scale * 1.2;
  const h = scale * 1.6;

  ctx.save();
  ctx.strokeStyle = highlighted ? "#ffcc00" : "#e0e0e0";
  ctx.fillStyle = highlighted ? "rgba(255, 204, 0, 0.05)" : "rgba(200, 200, 200, 0.02)";
  ctx.lineWidth = 2;

  // Draw box
  ctx.strokeRect(sx - w / 2, sy - h / 2, w, h);
  ctx.fillRect(sx - w / 2, sy - h / 2, w, h);

  // Draw instance name
  ctx.font = `bold ${scale * 0.3}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#82aaff";
  ctx.fillText(inst.instanceName, sx, sy - scale * 0.4);

  // Draw cell name
  const cell = cellLibrary.get(inst.subcircuitId);
  ctx.font = `${scale * 0.25}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = "#c3e88d";
  ctx.fillText(cell?.name ?? "?", sx, sy + scale * 0.2);

  // Draw port dots
  if (cell?.ports) {
    const portCount = cell.ports.length;
    const angleStep = (Math.PI * 2) / Math.max(portCount, 1);
    for (let i = 0; i < portCount; i++) {
      const angle = (i - portCount / 2) * angleStep;
      const px = sx + Math.cos(angle) * (w / 2 + 8);
      const py = sy + Math.sin(angle) * (h / 2 + 8);
      const port = cell.ports[i];

      ctx.fillStyle = "#66d9ef";
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fill();

      ctx.font = `${scale * 0.2}px monospace`;
      ctx.fillStyle = "#a9b7c6";
      ctx.textAlign = "center";
      ctx.fillText(port.name, px, py - 8);
    }
  }

  ctx.restore();
}

// ── Main Component ────────────────────────────────────────────────────

export function SchematicCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  const elements = useSchematicStore((s) => s.elements);
  const nets = useSchematicStore((s) => s.nets);
  const selectedIds = useSchematicStore((s) => s.selectedIds);
  const highlightedNet = useSchematicStore((s) => s.highlightedNet);
  const activeTool = useSchematicStore((s) => s.activeTool);
  const wireInProgress = useSchematicStore((s) => s.wireInProgress);
  const viewOffset = useSchematicStore((s) => s.viewOffset);
  const viewZoom = useSchematicStore((s) => s.viewZoom);
  const placingSymbolType = useSchematicStore((s) => s.placingSymbolType);
  const cellLibrary = useSchematicStore((s) => s.cellLibrary);

  const {
    setActiveTool,
    addSymbol,
    beginWire,
    addWirePoint,
    finishWire,
    cancelWire,
    select,
    clearSelection,
    moveElements,
    setView,
    removeElements,
    highlightNet: highlightNetAction,
    resolveNets,
  } = useSchematicStore.getState();

  const crossProbeHighlights = useCrossProbeStore((s) => s.highlights);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setCanvasSize({ width, height });
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Helper: screen → schematic coords
  const screenToSchematic = useCallback(
    (sx: number, sy: number): SchematicPoint => ({
      x: (sx - viewOffset.x) / viewZoom,
      y: (sy - viewOffset.y) / viewZoom,
    }),
    [viewOffset, viewZoom]
  );

  // Hit test: find element at position
  const hitTest = useCallback(
    (pos: SchematicPoint): SchematicElement | null => {
      const tolerance = 0.5;
      // Check symbols and subcircuits first (they have larger hit area)
      for (let i = elements.length - 1; i >= 0; i--) {
        const el = elements[i];
        if (el.kind === "symbol") {
          const dx = Math.abs(pos.x - el.position.x);
          const dy = Math.abs(pos.y - el.position.y);
          if (dx < 1.5 && dy < 1.5) return el;
        } else if (el.kind === "subcircuit") {
          const dx = Math.abs(pos.x - el.position.x);
          const dy = Math.abs(pos.y - el.position.y);
          if (dx < 0.6 && dy < 0.8) return el;
        } else if (el.kind === "bustap") {
          const dx = Math.abs(pos.x - el.position.x);
          const dy = Math.abs(pos.y - el.position.y);
          if (dx < 0.3 && dy < 0.3) return el;
        } else if (el.kind === "label" || el.kind === "port") {
          const dx = Math.abs(pos.x - el.position.x);
          const dy = Math.abs(pos.y - el.position.y);
          if (dx < 1 && dy < 0.5) return el;
        } else if (el.kind === "wire") {
          for (let j = 0; j < el.points.length - 1; j++) {
            const a = el.points[j];
            const b = el.points[j + 1];
            const dist = pointToSegmentDist(pos, a, b);
            if (dist < tolerance) return el;
          }
        } else if (el.kind === "buswire") {
          for (let j = 0; j < el.points.length - 1; j++) {
            const a = el.points[j];
            const b = el.points[j + 1];
            const dist = pointToSegmentDist(pos, a, b);
            if (dist < tolerance * 1.5) return el;
          }
        }
      }
      return null;
    },
    [elements]
  );

  // ── Rendering ──

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    ctx.save();
    ctx.translate(viewOffset.x, viewOffset.y);

    // Grid
    drawGrid(ctx, canvasSize.width, canvasSize.height, viewOffset, viewZoom);

    // Sort elements: wires first, then symbols/subcircuits, labels, ports
    const sorted = [...elements].sort((a, b) => {
      const order: Record<string, number> = { wire: 0, label: 1, port: 1, symbol: 2, subcircuit: 2 };
      return (order[a.kind] ?? 0) - (order[b.kind] ?? 0);
    });

    // Get net element IDs for highlighted net
    const highlightedElIds = new Set<string>();
    if (highlightedNet) {
      const net = nets.find((n) => n.name === highlightedNet);
      if (net) {
        for (const id of net.connectedElementIds) highlightedElIds.add(id);
      }
    }

    // Draw elements
    for (const el of sorted) {
      const isSelected = selectedIds.has(el.id);
      const isHighlighted = highlightedElIds.has(el.id);

      if (el.kind === "wire") {
        drawWire(ctx, el, viewZoom, isHighlighted || isSelected);
      } else if (el.kind === "buswire") {
        drawBusWire(ctx, el, viewZoom, isHighlighted || isSelected);
        // Selection box
        if (isSelected) {
          ctx.strokeStyle = "#007acc";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          // Draw bounding box around bus
          let minX = el.points[0].x, maxX = el.points[0].x;
          let minY = el.points[0].y, maxY = el.points[0].y;
          for (const pt of el.points) {
            minX = Math.min(minX, pt.x);
            maxX = Math.max(maxX, pt.x);
            minY = Math.min(minY, pt.y);
            maxY = Math.max(maxY, pt.y);
          }
          ctx.strokeRect(minX * viewZoom - 10, minY * viewZoom - 10, (maxX - minX) * viewZoom + 20, (maxY - minY) * viewZoom + 20);
          ctx.setLineDash([]);
        }
      } else if (el.kind === "bustap") {
        drawBusTap(ctx, el, viewZoom, isHighlighted || isSelected);
        // Selection box
        if (isSelected) {
          ctx.strokeStyle = "#007acc";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          const x = el.position.x * viewZoom;
          const y = el.position.y * viewZoom;
          ctx.strokeRect(x - 15, y - 15, 30, 30);
          ctx.setLineDash([]);
        }
      } else if (el.kind === "symbol") {
        drawSymbol(ctx, el, viewZoom, isHighlighted || isSelected);
        // Selection box
        if (isSelected) {
          ctx.strokeStyle = "#007acc";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          const sx = el.position.x * viewZoom;
          const sy = el.position.y * viewZoom;
          ctx.strokeRect(sx - viewZoom * 1.2, sy - viewZoom * 1.2, viewZoom * 2.4, viewZoom * 2.4);
          ctx.setLineDash([]);
        }
      } else if (el.kind === "subcircuit") {
        drawSubcircuitInstance(ctx, el, viewZoom, isHighlighted || isSelected, cellLibrary);
        // Selection box
        if (isSelected) {
          ctx.strokeStyle = "#007acc";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          const sx = el.position.x * viewZoom;
          const sy = el.position.y * viewZoom;
          ctx.strokeRect(sx - viewZoom * 0.6, sy - viewZoom * 0.8, viewZoom * 1.2, viewZoom * 1.6);
          ctx.setLineDash([]);
        }
      } else if (el.kind === "label") {
        drawLabel(ctx, el, viewZoom, isHighlighted || isSelected);
      } else if (el.kind === "port") {
        drawPort(ctx, el, viewZoom, isHighlighted || isSelected);
      }
    }

    // Wire in progress
    if (wireInProgress && wireInProgress.length > 0) {
      ctx.strokeStyle = "#66d9ef";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      ctx.moveTo(wireInProgress[0].x * viewZoom, wireInProgress[0].y * viewZoom);
      for (let i = 1; i < wireInProgress.length; i++) {
        ctx.lineTo(wireInProgress[i].x * viewZoom, wireInProgress[i].y * viewZoom);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();

    // Toolbar overlay
    ctx.fillStyle = "rgba(26, 26, 46, 0.85)";
    ctx.fillRect(8, 8, 230, 28);
    ctx.strokeStyle = "#333";
    ctx.strokeRect(8, 8, 230, 28);
    ctx.font = "11px 'JetBrains Mono', monospace";
    ctx.fillStyle = "#888";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`Tool: ${activeTool} | Elements: ${elements.length} | Nets: ${nets.length}`, 16, 22);
  }, [elements, nets, selectedIds, highlightedNet, activeTool, wireInProgress, canvasSize, viewOffset, viewZoom, crossProbeHighlights, placingSymbolType]);

  // ── Helper: Build net-to-geometry mapping ──
  
  const buildNetGeometryMapping = useCallback((netName: string) => {
    // Find all symbols connected to this net
    const crossProbeStore = useCrossProbeStore.getState();
    const net = nets.find((n) => n.name === netName);
    if (!net) return;

    // Collect all geometry indices from symbols connected to this net
    const geometryIndices = new Set<number>();
    for (const symbolId of net.connectedElementIds) {
      const indices = crossProbeStore.symbolGeometryMap.get(symbolId);
      if (indices) {
        for (const idx of indices) {
          geometryIndices.add(idx);
        }
      }
    }

    // Register the mapping
    if (geometryIndices.size > 0) {
      crossProbeStore.linkNetToGeometry(netName, Array.from(geometryIndices));
    }
  }, [nets]);

  // ── Mouse handlers ──

  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0 });
  const dragStart = useRef<SchematicPoint | null>(null);
  const dragElement = useRef<string | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const pos = screenToSchematic(sx, sy);

      if (activeTool === "pan" || e.button === 1) {
        isPanning.current = true;
        panStart.current = { x: sx - viewOffset.x, y: sy - viewOffset.y };
        return;
      }

      if (activeTool === "select") {
        const hit = hitTest(pos);
        if (hit) {
          if (e.shiftKey) {
            useSchematicStore.getState().toggleSelection(hit.id);
          } else {
            select([hit.id]);
          }
          dragStart.current = pos;
          dragElement.current = hit.id;

          // Cross-probe: if it's a symbol with layout links, highlight in layout
          if (hit.kind === "symbol") {
            // Register the symbol-geometry mapping if we have layout links
            if (hit.layoutGeometryIndices.length > 0) {
              useCrossProbeStore.getState().linkSymbolToGeometry(hit.id, hit.layoutGeometryIndices);
              useCrossProbeStore.getState().highlightSymbol(hit.id);
            }
          }
          // Net highlighting: if we click a wire or label with a net
          if (hit.kind === "wire" && hit.netName) {
            highlightNetAction(hit.netName);
            buildNetGeometryMapping(hit.netName);
            useCrossProbeStore.getState().highlightSchematicNet(hit.netName);
          } else if (hit.kind === "label") {
            highlightNetAction(hit.netName);
            buildNetGeometryMapping(hit.netName);
            useCrossProbeStore.getState().highlightSchematicNet(hit.netName);
          } else {
            highlightNetAction(null);
            useCrossProbeStore.getState().clearHover();
          }
        } else {
          clearSelection();
          highlightNetAction(null);
          useCrossProbeStore.getState().clearHover();
        }
        return;
      }

      if (activeTool === "wire") {
        if (!wireInProgress) {
          beginWire(snapToSchematicGrid(pos));
        } else {
          addWirePoint(snapToSchematicGrid(pos));
        }
        return;
      }

      if (activeTool === "symbol" && placingSymbolType) {
        addSymbol(placingSymbolType, snapToSchematicGrid(pos));
        resolveNets();
        return;
      }
    },
    [activeTool, hitTest, screenToSchematic, viewOffset, wireInProgress, placingSymbolType, select, clearSelection, highlightNetAction, beginWire, addWirePoint, addSymbol, resolveNets, buildNetGeometryMapping]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (isPanning.current) {
        setView(
          { x: sx - panStart.current.x, y: sy - panStart.current.y },
          viewZoom
        );
        return;
      }

      if (dragStart.current && dragElement.current && activeTool === "select") {
        const pos = screenToSchematic(sx, sy);
        const dx = pos.x - dragStart.current.x;
        const dy = pos.y - dragStart.current.y;
        if (Math.abs(dx) > 0.2 || Math.abs(dy) > 0.2) {
          const selectedArray = [...selectedIds];
          if (selectedArray.length > 0) {
            moveElements(selectedArray, dx, dy);
          }
          dragStart.current = pos;
        }
      }
    },
    [activeTool, screenToSchematic, viewZoom, selectedIds, setView, moveElements]
  );

  const handleMouseUp = useCallback(() => {
    isPanning.current = false;
    dragStart.current = null;
    dragElement.current = null;
  }, []);

  const handleDoubleClick = useCallback(
    (_e: React.MouseEvent) => {
      if (activeTool === "wire" && wireInProgress) {
        finishWire();
        resolveNets();
      }
    },
    [activeTool, wireInProgress, finishWire, resolveNets]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.max(5, Math.min(200, viewZoom * factor));
      const ratio = newZoom / viewZoom;

      setView(
        {
          x: sx - (sx - viewOffset.x) * ratio,
          y: sy - (sy - viewOffset.y) * ratio,
        },
        newZoom
      );
    },
    [viewZoom, viewOffset, setView]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        if (wireInProgress) {
          cancelWire();
        } else {
          clearSelection();
          setActiveTool("select");
        }
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        const ids = [...selectedIds];
        if (ids.length > 0) {
          removeElements(ids);
          resolveNets();
        }
      }
      // Copy: Ctrl+C or Cmd+C
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        useSchematicStore.getState().copySelected();
      }
      // Paste: Ctrl+V or Cmd+V
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        useSchematicStore.getState().pasteClipboard();
        resolveNets();
      }
    },
    [wireInProgress, selectedIds, cancelWire, clearSelection, setActiveTool, removeElements, resolveNets]
  );

  return (
    <div ref={containerRef} className="schematic-canvas" tabIndex={0} onKeyDown={handleKeyDown}>
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        style={{ width: "100%", height: "100%" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
      />
      {/* Tool palette mini-bar */}
      <div className="schematic-canvas__toolbar">
        <button className={activeTool === "select" ? "active" : ""} onClick={() => setActiveTool("select")} title="Select (V)">▢</button>
        <button className={activeTool === "wire" ? "active" : ""} onClick={() => setActiveTool("wire")} title="Wire (W)">╱</button>
        <button onClick={() => useSchematicStore.getState().setPlacingSymbolType("nmos")} title="NMOS">N</button>
        <button onClick={() => useSchematicStore.getState().setPlacingSymbolType("pmos")} title="PMOS">P</button>
        <button onClick={() => useSchematicStore.getState().setPlacingSymbolType("resistor")} title="Resistor">R</button>
        <button onClick={() => useSchematicStore.getState().setPlacingSymbolType("capacitor")} title="Capacitor">C</button>
        <button onClick={() => useSchematicStore.getState().setPlacingSymbolType("ground")} title="GND">⏚</button>
        <button onClick={() => useSchematicStore.getState().setPlacingSymbolType("vdd")} title="VDD">⏛</button>
        <button className={activeTool === "pan" ? "active" : ""} onClick={() => setActiveTool("pan")} title="Pan (H)">✥</button>
      </div>
    </div>
  );
}

// ── Helper drawing functions ──────────────────────────────────────────

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offset: SchematicPoint,
  zoom: number
) {
  const spacing = zoom; // 1 unit = 1 grid cell
  if (spacing < 8) return;

  ctx.strokeStyle = "rgba(255,255,255,0.04)";
  ctx.lineWidth = 0.5;

  const startX = -offset.x % spacing;
  const startY = -offset.y % spacing;

  for (let x = startX - spacing; x < width; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, -offset.y);
    ctx.lineTo(x, height - offset.y);
    ctx.stroke();
  }
  for (let y = startY - spacing; y < height; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(-offset.x, y);
    ctx.lineTo(width - offset.x, y);
    ctx.stroke();
  }
}

function drawWire(ctx: CanvasRenderingContext2D, wire: SchematicWire, zoom: number, highlighted: boolean) {
  if (wire.points.length < 2) return;
  ctx.strokeStyle = highlighted ? "#ffcc00" : "#4dc9f6";
  ctx.lineWidth = highlighted ? 3 : 2;
  ctx.beginPath();
  ctx.moveTo(wire.points[0].x * zoom, wire.points[0].y * zoom);
  for (let i = 1; i < wire.points.length; i++) {
    ctx.lineTo(wire.points[i].x * zoom, wire.points[i].y * zoom);
  }
  ctx.stroke();

  // Junction dots at endpoints
  ctx.fillStyle = ctx.strokeStyle;
  for (const pt of wire.points) {
    ctx.beginPath();
    ctx.arc(pt.x * zoom, pt.y * zoom, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBusWire(ctx: CanvasRenderingContext2D, buswire: BusWire, zoom: number, highlighted: boolean) {
  if (buswire.points.length < 2) return;
  
  // Draw bus as thicker line with double stroke effect
  ctx.strokeStyle = highlighted ? "#ffcc00" : "#9966cc";
  ctx.lineWidth = highlighted ? 5 : 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  
  ctx.beginPath();
  ctx.moveTo(buswire.points[0].x * zoom, buswire.points[0].y * zoom);
  for (let i = 1; i < buswire.points.length; i++) {
    ctx.lineTo(buswire.points[i].x * zoom, buswire.points[i].y * zoom);
  }
  ctx.stroke();

  // Draw bus label at midpoint
  const mid = buswire.points[Math.floor(buswire.points.length / 2)];
  ctx.font = `bold ${10 * zoom}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = highlighted ? "#ffcc00" : "#9966cc";
  ctx.fillText(buswire.busName, mid.x * zoom, mid.y * zoom - 12);

  // Junction dots at endpoints
  ctx.fillStyle = ctx.strokeStyle;
  for (const pt of buswire.points) {
    ctx.beginPath();
    ctx.arc(pt.x * zoom, pt.y * zoom, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBusTap(ctx: CanvasRenderingContext2D, bustap: BusTap, zoom: number, highlighted: boolean) {
  const x = bustap.position.x * zoom;
  const y = bustap.position.y * zoom;
  const radius = 5;

  // Draw tap point as a small circle
  ctx.fillStyle = highlighted ? "#ffcc00" : "#66dd99";
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();

  // Draw connecting line (connecting signal to bus)
  ctx.strokeStyle = highlighted ? "#ffcc00" : "#66dd99";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, radius * 2, 0, Math.PI * 2);
  ctx.stroke();

  // Label: bit index if available
  if (bustap.bitIndex !== undefined) {
    ctx.font = `bold ${8 * zoom}px 'JetBrains Mono', monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = highlighted ? "#ffcc00" : "#66dd99";
    ctx.fillText(`[${bustap.bitIndex}]`, x, y + 12);
  }
}


function drawLabel(ctx: CanvasRenderingContext2D, label: SchematicLabel, zoom: number, highlighted: boolean) {
  const x = label.position.x * zoom;
  const y = label.position.y * zoom;
  ctx.font = `bold ${label.fontSize * zoom}px 'JetBrains Mono', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = highlighted ? "#ffcc00" : "#c3e88d";
  ctx.fillText(label.text, x, y);

  // Underline
  const w = ctx.measureText(label.text).width;
  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y + label.fontSize * zoom * 0.6);
  ctx.lineTo(x + w / 2, y + label.fontSize * zoom * 0.6);
  ctx.stroke();
}

function drawPort(ctx: CanvasRenderingContext2D, port: SchematicPort, zoom: number, highlighted: boolean) {
  const x = port.position.x * zoom;
  const y = port.position.y * zoom;
  const w = zoom * 0.8;
  const h = zoom * 0.4;

  // Arrow/triangle shape
  ctx.fillStyle = highlighted ? "rgba(255,204,0,0.3)" : "rgba(100,200,100,0.2)";
  ctx.strokeStyle = highlighted ? "#ffcc00" : "#66bb6a";
  ctx.lineWidth = 2;

  if (port.direction === "input") {
    ctx.beginPath();
    ctx.moveTo(x - w, y - h);
    ctx.lineTo(x, y);
    ctx.lineTo(x - w, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  ctx.font = `bold ${zoom * 0.3}px 'JetBrains Mono', monospace`;
  ctx.fillStyle = highlighted ? "#ffcc00" : "#e0e0e0";
  ctx.textAlign = port.direction === "input" ? "right" : "left";
  ctx.textBaseline = "middle";
  ctx.fillText(port.name, port.direction === "input" ? x - w - 4 : x + w + 4, y);
}

function snapToSchematicGrid(p: SchematicPoint): SchematicPoint {
  return {
    x: Math.round(p.x * 2) / 2, // Snap to 0.5 grid
    y: Math.round(p.y * 2) / 2,
  };
}

function pointToSegmentDist(p: SchematicPoint, a: SchematicPoint, b: SchematicPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}
