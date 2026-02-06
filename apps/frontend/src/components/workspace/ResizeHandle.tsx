import { useRef, useCallback, useEffect, useState } from "react";

interface ResizeHandleProps {
  /** Direction the handle controls */
  direction: "horizontal" | "vertical";
  /** Callback with delta in pixels */
  onResize: (delta: number) => void;
  /** Optional className */
  className?: string;
}

/**
 * A drag handle for resizing panels.
 * "horizontal" means dragging left/right (controls width).
 * "vertical" means dragging up/down (controls height).
 */
export function ResizeHandle({ direction, onResize, className }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startPos = useRef(0);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      startPos.current = direction === "horizontal" ? e.clientX : e.clientY;
    },
    [direction]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const current = direction === "horizontal" ? e.clientX : e.clientY;
      const delta = current - startPos.current;
      if (delta !== 0) {
        onResize(delta);
        startPos.current = current;
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // Set cursor on body during drag
    document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, direction, onResize]);

  const baseClass = direction === "horizontal" ? "resize-handle--horizontal" : "resize-handle--vertical";

  return (
    <div
      className={`resize-handle ${baseClass} ${isDragging ? "resize-handle--active" : ""} ${className ?? ""}`}
      onMouseDown={handleMouseDown}
    />
  );
}
