/**
 * WaveformViewer — VCD-based waveform viewer with Canvas2D rendering.
 * Features: signal tree, digital/analog traces, zoom/pan, cursors,
 * radix selection, signal reordering.
 */

import { useRef, useEffect, useCallback, useState } from "react";
import { useWaveformViewerStore, type SignalDisplay } from "../../stores/waveformViewerStore";
import type { VcdSignal } from "../../engines/vcdParser";
import {
  ZoomIn,
  ZoomOut,
  Maximize,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import "./WaveformViewer.css";

// ── Signal List (left panel) ─────────────────────────────────────

function SignalList() {
  const signals = useWaveformViewerStore((s) => s.signals);
  const selectedSignals = useWaveformViewerStore((s) => s.selectedSignals);
  const toggleSignalVisible = useWaveformViewerStore((s) => s.toggleSignalVisible);
  const selectSignal = useWaveformViewerStore((s) => s.selectSignal);
  const deselectSignal = useWaveformViewerStore((s) => s.deselectSignal);
  const setSignalRadix = useWaveformViewerStore((s) => s.setSignalRadix);

  return (
    <div className="wv-signal-list" role="list" aria-label="Signals">
      {signals.map((sig) => {
        const isSelected = selectedSignals.has(sig.signalId);
        return (
          <div
            key={sig.signalId}
            className={`wv-signal-item ${isSelected ? "wv-signal-item--selected" : ""}`}
            style={{ height: sig.height }}
            onClick={() =>
              isSelected ? deselectSignal(sig.signalId) : selectSignal(sig.signalId)
            }
          >
            <button
              className="wv-signal-item__vis"
              onClick={(e) => {
                e.stopPropagation();
                toggleSignalVisible(sig.signalId);
              }}
              title={sig.visible ? "Hide" : "Show"}
              aria-label={sig.visible ? `Hide ${sig.name}` : `Show ${sig.name}`}
            >
              {sig.visible ? <Eye size={12} /> : <EyeOff size={12} />}
            </button>
            <div
              className="wv-signal-item__color"
              style={{ backgroundColor: sig.color }}
            />
            <span className="wv-signal-item__name" title={`${sig.scopePath}.${sig.name}`}>
              {sig.name}
            </span>
            {sig.width > 1 && (
              <select
                className="wv-signal-item__radix"
                value={sig.radix}
                onChange={(e) =>
                  setSignalRadix(sig.signalId, e.target.value as SignalDisplay["radix"])
                }
                onClick={(e) => e.stopPropagation()}
                aria-label={`Radix for ${sig.name}`}
              >
                <option value="hex">Hex</option>
                <option value="binary">Bin</option>
                <option value="decimal">Dec</option>
              </select>
            )}
            <span className="wv-signal-item__width">
              [{sig.width > 1 ? `${sig.width - 1}:0` : "0"}]
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Cursor info bar ──────────────────────────────────────────────

function CursorBar() {
  const cursors = useWaveformViewerStore((s) => s.cursors);
  const activeCursorId = useWaveformViewerStore((s) => s.activeCursorId);
  const removeCursor = useWaveformViewerStore((s) => s.removeCursor);
  const timescale = useWaveformViewerStore((s) => s.timescale);

  const unit = timescale ? `${timescale.magnitude}${timescale.unit}` : "units";

  if (cursors.length === 0) return null;

  // Compute delta between first two cursors
  const delta =
    cursors.length >= 2
      ? Math.abs(cursors[1].time - cursors[0].time)
      : null;

  return (
    <div className="wv-cursor-bar">
      {cursors.map((c) => (
        <div
          key={c.id}
          className={`wv-cursor-tag ${c.id === activeCursorId ? "wv-cursor-tag--active" : ""}`}
          style={{ borderLeftColor: c.color }}
        >
          <span>{c.label}: {c.time} {unit}</span>
          <button
            className="wv-cursor-tag__remove"
            onClick={() => removeCursor(c.id)}
            aria-label={`Remove ${c.label}`}
          >
            <Trash2 size={10} />
          </button>
        </div>
      ))}
      {delta !== null && (
        <div className="wv-cursor-delta">
          Δ = {delta} {unit}
          {timescale && delta > 0 && (
            <span> ({(1 / delta).toFixed(4)} {timescale.unit === "ns" ? "GHz" : "MHz"})</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Waveform Canvas ──────────────────────────────────────────────

function WaveformCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const signals = useWaveformViewerStore((s) => s.signals);
  const vcdData = useWaveformViewerStore((s) => s.vcdData);
  const viewStart = useWaveformViewerStore((s) => s.viewStart);
  const viewEnd = useWaveformViewerStore((s) => s.viewEnd);
  const cursors = useWaveformViewerStore((s) => s.cursors);
  const addCursor = useWaveformViewerStore((s) => s.addCursor);
  const setViewRange = useWaveformViewerStore((s) => s.setViewRange);
  const totalTimeStart = useWaveformViewerStore((s) => s.totalTimeStart);
  const totalTimeEnd = useWaveformViewerStore((s) => s.totalTimeEnd);

  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 400 });

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setCanvasSize({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // Draw waveforms
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !vcdData) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.w * dpr;
    canvas.height = canvasSize.h * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue("--os-bg")
      .trim() || "#1e1e1e";
    ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);

    const timeSpan = viewEnd - viewStart;
    if (timeSpan <= 0) return;

    const timeToX = (t: number) =>
      ((t - viewStart) / timeSpan) * canvasSize.w;

    // Time axis (top 24px)
    const axisH = 24;
    ctx.fillStyle = "#2a2a2a";
    ctx.fillRect(0, 0, canvasSize.w, axisH);

    // Grid lines
    const tickCount = Math.max(4, Math.floor(canvasSize.w / 100));
    const tickStep = timeSpan / tickCount;
    const niceStep = niceNumber(tickStep, false);

    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#999";
    ctx.font = "10px monospace";
    ctx.textAlign = "center";

    const firstTick = Math.ceil(viewStart / niceStep) * niceStep;
    for (let t = firstTick; t <= viewEnd; t += niceStep) {
      const x = timeToX(t);
      // Grid line
      ctx.beginPath();
      ctx.moveTo(x, axisH);
      ctx.lineTo(x, canvasSize.h);
      ctx.stroke();
      // Tick label
      ctx.fillText(formatTime(t), x, axisH - 6);
    }

    // Draw each visible signal
    let y = axisH;
    for (const sig of signals) {
      if (!sig.visible) continue;
      const vcdSig = vcdData.signals.find((s) => s.variable.idCode === sig.signalId);
      if (!vcdSig) { y += sig.height; continue; }

      const rowTop = y;
      const rowBot = y + sig.height;

      // Row separator
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, rowBot);
      ctx.lineTo(canvasSize.w, rowBot);
      ctx.stroke();

      // Draw signal trace
      ctx.strokeStyle = sig.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      if (sig.isAnalog) {
        drawAnalogSignal(ctx, vcdSig, timeToX, rowTop + 4, rowBot - 4);
      } else if (sig.width === 1) {
        drawDigitalSignal(ctx, vcdSig, timeToX, rowTop + 4, rowBot - 4);
      } else {
        drawBusSignal(ctx, vcdSig, sig, timeToX, rowTop + 4, rowBot - 4);
      }

      y = rowBot;
    }

    // Draw cursors
    for (const cursor of cursors) {
      const x = timeToX(cursor.time);
      if (x < 0 || x > canvasSize.w) continue;
      ctx.strokeStyle = cursor.color;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvasSize.h);
      ctx.stroke();
      ctx.setLineDash([]);

      // Cursor label
      ctx.fillStyle = cursor.color;
      ctx.font = "10px monospace";
      ctx.textAlign = "left";
      ctx.fillText(cursor.label, x + 3, 12);
    }
  }, [canvasSize, signals, vcdData, viewStart, viewEnd, cursors]);

  // Mouse wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = e.clientX - rect.left;
      const fraction = mouseX / rect.width;
      const timeAtMouse = viewStart + fraction * (viewEnd - viewStart);

      const factor = e.deltaY > 0 ? 1.2 : 1 / 1.2;
      const newSpan = (viewEnd - viewStart) * factor;

      // Zoom centered on mouse position
      const newStart = Math.max(totalTimeStart, timeAtMouse - fraction * newSpan);
      const newEnd = Math.min(totalTimeEnd, newStart + newSpan);
      setViewRange(newStart, newEnd);
    },
    [viewStart, viewEnd, totalTimeStart, totalTimeEnd, setViewRange]
  );

  // Double-click to add cursor
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      const fraction = mouseX / rect.width;
      const time = Math.round(viewStart + fraction * (viewEnd - viewStart));
      addCursor(time);
    },
    [viewStart, viewEnd, addCursor]
  );

  // Pan with mouse drag
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, viewStart: 0, viewEnd: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      setIsDragging(true);
      dragStartRef.current = { x: e.clientX, viewStart, viewEnd };
    },
    [viewStart, viewEnd]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = e.clientX - dragStartRef.current.x;
      const timeDelta = -(dx / rect.width) * (dragStartRef.current.viewEnd - dragStartRef.current.viewStart);

      let newStart = dragStartRef.current.viewStart + timeDelta;
      let newEnd = dragStartRef.current.viewEnd + timeDelta;

      // Clamp
      if (newStart < totalTimeStart) {
        newEnd += totalTimeStart - newStart;
        newStart = totalTimeStart;
      }
      if (newEnd > totalTimeEnd) {
        newStart -= newEnd - totalTimeEnd;
        newEnd = totalTimeEnd;
      }

      setViewRange(newStart, newEnd);
    },
    [isDragging, totalTimeStart, totalTimeEnd, setViewRange]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    <div className="wv-canvas-container" ref={containerRef}>
      <canvas
        ref={canvasRef}
        className="wv-canvas"
        style={{ width: canvasSize.w, height: canvasSize.h, cursor: isDragging ? "grabbing" : "crosshair" }}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
    </div>
  );
}

// ── Drawing Helpers ──────────────────────────────────────────────

function drawDigitalSignal(
  ctx: CanvasRenderingContext2D,
  sig: VcdSignal,
  timeToX: (t: number) => number,
  top: number,
  bottom: number
) {
  const transitions = sig.transitions;
  if (transitions.length === 0) return;

  const high = top;
  const low = bottom;

  ctx.beginPath();
  let lastY = transitions[0].rawValue === "1" ? high : low;
  let lastX = timeToX(transitions[0].time);
  ctx.moveTo(lastX, lastY);

  for (let i = 1; i < transitions.length; i++) {
    const t = transitions[i];
    const x = timeToX(t.time);
    const y = t.rawValue === "1" ? high : t.rawValue === "x" || t.rawValue === "z" ? (high + low) / 2 : low;

    // Horizontal line to transition point
    ctx.lineTo(x, lastY);
    // Vertical transition
    ctx.lineTo(x, y);

    lastX = x;
    lastY = y;
  }

  // Extend to end
  ctx.lineTo(timeToX(sig.transitions[sig.transitions.length - 1].time + 100), lastY);
  ctx.stroke();

  // Draw X/Z with hatching
  for (let i = 0; i < transitions.length; i++) {
    if (transitions[i].rawValue === "x" || transitions[i].rawValue === "z") {
      const x1 = timeToX(transitions[i].time);
      const x2 = i + 1 < transitions.length ? timeToX(transitions[i + 1].time) : x1 + 20;
      ctx.fillStyle = transitions[i].rawValue === "x" ? "rgba(229,115,115,0.15)" : "rgba(255,183,77,0.15)";
      ctx.fillRect(x1, top, x2 - x1, bottom - top);
    }
  }
}

function drawBusSignal(
  ctx: CanvasRenderingContext2D,
  sig: VcdSignal,
  display: SignalDisplay,
  timeToX: (t: number) => number,
  top: number,
  bottom: number
) {
  const transitions = sig.transitions;
  if (transitions.length === 0) return;

  const mid = (top + bottom) / 2;
  const slant = 3; // pixels for bus transition slant

  for (let i = 0; i < transitions.length; i++) {
    const x1 = timeToX(transitions[i].time);
    const x2 = i + 1 < transitions.length ? timeToX(transitions[i + 1].time) : x1 + 100;

    // Draw bus outline (diamond shape at transitions)
    ctx.beginPath();
    ctx.moveTo(x1 + slant, top);
    ctx.lineTo(x2 - slant, top);
    ctx.lineTo(x2, mid);
    ctx.lineTo(x2 - slant, bottom);
    ctx.lineTo(x1 + slant, bottom);
    ctx.lineTo(x1, mid);
    ctx.closePath();
    ctx.stroke();

    // Fill with semi-transparent color
    ctx.fillStyle = display.color + "15";
    ctx.fill();

    // Draw value text
    const val = transitions[i].rawValue;
    const displayVal = formatBusValue(val, display.radix, display.width);
    const textWidth = x2 - x1 - 2 * slant;
    if (textWidth > 20) {
      ctx.save();
      ctx.fillStyle = display.color;
      ctx.font = "10px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.beginPath();
      ctx.rect(x1 + slant, top, textWidth, bottom - top);
      ctx.clip();
      ctx.fillText(displayVal, (x1 + x2) / 2, mid);
      ctx.restore();
    }
  }
}

function drawAnalogSignal(
  ctx: CanvasRenderingContext2D,
  sig: VcdSignal,
  timeToX: (t: number) => number,
  top: number,
  bottom: number
) {
  const transitions = sig.transitions;
  if (transitions.length === 0) return;

  // Find value range
  let minVal = Infinity, maxVal = -Infinity;
  for (const t of transitions) {
    const v = parseFloat(t.rawValue);
    if (isFinite(v)) {
      if (v < minVal) minVal = v;
      if (v > maxVal) maxVal = v;
    }
  }
  if (minVal === maxVal) { minVal -= 1; maxVal += 1; }

  const valToY = (v: number) =>
    bottom - ((v - minVal) / (maxVal - minVal)) * (bottom - top);

  // Draw filled area
  ctx.beginPath();
  ctx.moveTo(timeToX(transitions[0].time), bottom);

  for (const t of transitions) {
    const v = parseFloat(t.rawValue);
    if (isFinite(v)) {
      ctx.lineTo(timeToX(t.time), valToY(v));
    }
  }

  ctx.lineTo(timeToX(transitions[transitions.length - 1].time), bottom);
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle + "20";
  ctx.fill();

  // Draw line
  ctx.beginPath();
  let started = false;
  for (const t of transitions) {
    const v = parseFloat(t.rawValue);
    if (isFinite(v)) {
      const x = timeToX(t.time);
      const y = valToY(v);
      if (!started) { ctx.moveTo(x, y); started = true; }
      else ctx.lineTo(x, y);
    }
  }
  ctx.stroke();
}

function formatBusValue(binStr: string, radix: string, width: number): string {
  if (binStr.includes("x") || binStr.includes("z") || binStr.includes("X") || binStr.includes("Z")) {
    return binStr.length <= 4 ? binStr : binStr.slice(0, 4) + "...";
  }
  const val = parseInt(binStr, 2);
  switch (radix) {
    case "hex":
      return "0x" + val.toString(16).toUpperCase().padStart(Math.ceil(width / 4), "0");
    case "decimal":
      return val.toString();
    case "binary":
      return "0b" + binStr.padStart(width, "0");
    default:
      return "0x" + val.toString(16).toUpperCase();
  }
}

function niceNumber(range: number, round: boolean): number {
  const exp = Math.floor(Math.log10(range));
  const frac = range / Math.pow(10, exp);
  let nice: number;
  if (round) {
    if (frac < 1.5) nice = 1;
    else if (frac < 3) nice = 2;
    else if (frac < 7) nice = 5;
    else nice = 10;
  } else {
    if (frac <= 1) nice = 1;
    else if (frac <= 2) nice = 2;
    else if (frac <= 5) nice = 5;
    else nice = 10;
  }
  return nice * Math.pow(10, exp);
}

function formatTime(t: number): string {
  if (Math.abs(t) >= 1e6) return (t / 1e6).toFixed(1) + "M";
  if (Math.abs(t) >= 1e3) return (t / 1e3).toFixed(1) + "k";
  return t.toFixed(0);
}

// ── Main Component ───────────────────────────────────────────────

export function WaveformViewer() {
  const isLoaded = useWaveformViewerStore((s) => s.isLoaded);
  const loadDemoVcd = useWaveformViewerStore((s) => s.loadDemoVcd);
  const zoomIn = useWaveformViewerStore((s) => s.zoomIn);
  const zoomOut = useWaveformViewerStore((s) => s.zoomOut);
  const zoomFit = useWaveformViewerStore((s) => s.zoomFit);
  const panLeft = useWaveformViewerStore((s) => s.panLeft);
  const panRight = useWaveformViewerStore((s) => s.panRight);
  const addCursor = useWaveformViewerStore((s) => s.addCursor);
  const viewStart = useWaveformViewerStore((s) => s.viewStart);
  const viewEnd = useWaveformViewerStore((s) => s.viewEnd);

  if (!isLoaded) {
    return (
      <div className="wv-empty">
        <div className="wv-empty__content">
          <Upload size={32} />
          <p>No waveform loaded</p>
          <button className="wv-empty__btn" onClick={loadDemoVcd}>
            Load Demo VCD
          </button>
          <span className="wv-empty__hint">
            Or open a .vcd file from the File Explorer
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="waveform-viewer">
      {/* Toolbar */}
      <div className="wv-toolbar">
        <button className="wv-tool-btn" onClick={zoomIn} title="Zoom In" aria-label="Zoom In">
          <ZoomIn size={14} />
        </button>
        <button className="wv-tool-btn" onClick={zoomOut} title="Zoom Out" aria-label="Zoom Out">
          <ZoomOut size={14} />
        </button>
        <button className="wv-tool-btn" onClick={zoomFit} title="Zoom Fit" aria-label="Zoom Fit">
          <Maximize size={14} />
        </button>
        <div className="wv-toolbar__sep" />
        <button className="wv-tool-btn" onClick={panLeft} title="Pan Left" aria-label="Pan Left">
          <ChevronLeft size={14} />
        </button>
        <button className="wv-tool-btn" onClick={panRight} title="Pan Right" aria-label="Pan Right">
          <ChevronRight size={14} />
        </button>
        <div className="wv-toolbar__sep" />
        <button
          className="wv-tool-btn"
          onClick={() => addCursor((viewStart + viewEnd) / 2)}
          title="Add Cursor"
          aria-label="Add Cursor"
        >
          <Plus size={14} />
        </button>
        <div className="wv-toolbar__sep" />
        <button className="wv-tool-btn" onClick={loadDemoVcd} title="Reload Demo">
          <Upload size={14} />
        </button>
      </div>

      <CursorBar />

      {/* Split view: signal list + canvas */}
      <div className="wv-main">
        <SignalList />
        <WaveformCanvas />
      </div>
    </div>
  );
}
