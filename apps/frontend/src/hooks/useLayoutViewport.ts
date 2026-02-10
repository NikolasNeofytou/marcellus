/**
 * useLayoutViewport — viewport state, coordinate conversion, pan & zoom.
 *
 * Extracted from the LayoutCanvas god-component so that viewport concerns
 * live in their own hook and can also be consumed by overlays, minimap, etc.
 */

import { useState, useCallback, useRef, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────

export interface ViewportState {
  centerX: number;
  centerY: number;
  zoom: number;
}

export interface UseLayoutViewportReturn {
  viewport: ViewportState;
  viewportRef: React.MutableRefObject<ViewportState>;
  setViewport: React.Dispatch<React.SetStateAction<ViewportState>>;
  /** Convert screen-pixel coords → layout-micron coords. */
  screenToLayout: (screenX: number, screenY: number, vp?: ViewportState) => { x: number; y: number };
  /** Convert layout-micron coords → screen-pixel coords. */
  layoutToScreen: (lx: number, ly: number, w: number, h: number, vp?: ViewportState) => { x: number; y: number };
  /** Wheel-zoom handler (binds directly to onWheel). */
  handleWheel: (e: React.WheelEvent) => void;
  /** Is currently panning? */
  isPanning: boolean;
  /** Call on pan-start (middle-click, shift+left, or pan-tool). */
  startPan: (clientX: number, clientY: number) => void;
  /** Call on pan-move (must be called every mouseMove while panning). */
  updatePan: (clientX: number, clientY: number) => void;
  /** Call on pan-end. */
  endPan: () => void;
  /** The canvas ref this viewport is bound to (needed for coord conversion). */
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useLayoutViewport(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
): UseLayoutViewportReturn {
  const [viewport, setViewport] = useState<ViewportState>({
    centerX: 0,
    centerY: 0,
    zoom: 20,
  });
  const viewportRef = useRef(viewport);
  useEffect(() => { viewportRef.current = viewport; }, [viewport]);

  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // ── Coordinate conversion ──

  const screenToLayout = useCallback(
    (screenX: number, screenY: number, vp?: ViewportState) => {
      const canvas = canvasRef.current;
      const v = vp ?? viewportRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const dpr = window.devicePixelRatio;
      const canvasW = canvas.width / dpr;
      const canvasH = canvas.height / dpr;
      return {
        x: (screenX - canvasW / 2) / v.zoom + v.centerX,
        y: -(screenY - canvasH / 2) / v.zoom + v.centerY,
      };
    },
    [canvasRef],
  );

  const layoutToScreen = useCallback(
    (lx: number, ly: number, w: number, h: number, vp?: ViewportState) => {
      const v = vp ?? viewportRef.current;
      return {
        x: (lx - v.centerX) * v.zoom + w / 2,
        y: h / 2 - (ly - v.centerY) * v.zoom,
      };
    },
    [],
  );

  // ── Wheel zoom (zoom-toward-cursor) ──

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      setViewport((vp) => {
        const canvas = canvasRef.current;
        if (!canvas) return vp;
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;

        const layoutBefore = screenToLayout(screenX, screenY, vp);
        const newZoom = Math.max(0.01, Math.min(100000, vp.zoom * factor));
        const newVp = { ...vp, zoom: newZoom };
        const layoutAfter = screenToLayout(screenX, screenY, newVp);
        return {
          ...newVp,
          centerX: vp.centerX + (layoutBefore.x - layoutAfter.x),
          centerY: vp.centerY + (layoutBefore.y - layoutAfter.y),
        };
      });
    },
    [canvasRef, screenToLayout],
  );

  // ── Panning ──

  const startPan = useCallback((clientX: number, clientY: number) => {
    setIsPanning(true);
    panStartRef.current = { x: clientX, y: clientY };
  }, []);

  const updatePan = useCallback((clientX: number, clientY: number) => {
    if (!isPanning) return;
    const dx = clientX - panStartRef.current.x;
    const dy = clientY - panStartRef.current.y;
    panStartRef.current = { x: clientX, y: clientY };
    setViewport((vp) => ({
      ...vp,
      centerX: vp.centerX - dx / vp.zoom,
      centerY: vp.centerY + dy / vp.zoom,
    }));
  }, [isPanning]);

  const endPan = useCallback(() => {
    setIsPanning(false);
  }, []);

  // ── External viewport commands (zoom-fit, zoom-selection) ──

  useEffect(() => {
    const handleViewportCmd = (e: Event) => {
      const { centerX, centerY, fitSpanX, fitSpanY } = (e as CustomEvent).detail;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const w = canvas.clientWidth || 800;
      const h = canvas.clientHeight || 600;
      const padding = 1.15;
      const zoom = Math.min(w / (fitSpanX * padding), h / (fitSpanY * padding));
      setViewport({ centerX, centerY, zoom });
    };
    window.addEventListener("opensilicon:viewport", handleViewportCmd);
    return () => window.removeEventListener("opensilicon:viewport", handleViewportCmd);
  }, [canvasRef]);

  return {
    viewport,
    viewportRef,
    setViewport,
    screenToLayout,
    layoutToScreen,
    handleWheel,
    isPanning,
    startPan,
    updatePan,
    endPan,
    canvasRef,
  };
}
