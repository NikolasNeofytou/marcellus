import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

interface VirtualListProps<T> {
  /** Items to render */
  items: T[];
  /** Estimated height per row in pixels */
  estimateSize: number;
  /** Render a single row */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** CSS class on the scroll container */
  className?: string;
  /** Inline style on the scroll container */
  style?: React.CSSProperties;
  /** Number of items to render outside the visible area */
  overscan?: number;
}

/**
 * Generic windowed list using @tanstack/react-virtual.
 * Renders only the visible rows + a small overscan to keep the DOM small.
 */
export function VirtualList<T>({
  items,
  estimateSize,
  renderItem,
  className,
  style,
  overscan = 5,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
  });

  return (
    <div
      ref={parentRef}
      className={className}
      style={{ overflow: "auto", ...style }}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {renderItem(items[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
