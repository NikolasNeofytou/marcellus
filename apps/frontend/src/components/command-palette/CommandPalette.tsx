import { useRef, useEffect, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCommandStore } from "../../stores/commandStore";
import "./CommandPalette.css";

/** Render a label with matched characters highlighted. */
function HighlightedLabel({
  label,
  matchedIndices,
}: {
  label: string;
  matchedIndices: number[];
}) {
  if (matchedIndices.length === 0) return <>{label}</>;
  const set = new Set(matchedIndices);
  return (
    <>
      {label.split("").map((ch, i) =>
        set.has(i) ? (
          <span key={i} className="command-palette__match">
            {ch}
          </span>
        ) : (
          <span key={i}>{ch}</span>
        )
      )}
    </>
  );
}

export function CommandPalette() {
  const isOpen = useCommandStore((s) => s.isOpen);
  if (!isOpen) return null;
  return <CommandPaletteInner />;
}

function CommandPaletteInner() {
  const query = useCommandStore((s) => s.query);
  const setQuery = useCommandStore((s) => s.setQuery);
  const closePalette = useCommandStore((s) => s.closePalette);
  const executeCommand = useCommandStore((s) => s.executeCommand);
  const getFilteredCommands = useCommandStore((s) => s.getFilteredCommands);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = getFilteredCommands();

  const virtualizer = useVirtualizer({
    count: filteredCommands.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 36,
    overscan: 5,
  });

  useEffect(() => {
    inputRef.current?.focus();
    setSelectedIndex(0);
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Escape":
        closePalette();
        break;
      case "ArrowDown": {
        e.preventDefault();
        const next = Math.min(selectedIndex + 1, filteredCommands.length - 1);
        setSelectedIndex(next);
        virtualizer.scrollToIndex(next, { align: "auto" });
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = Math.max(selectedIndex - 1, 0);
        setSelectedIndex(prev);
        virtualizer.scrollToIndex(prev, { align: "auto" });
        break;
      }
      case "Enter":
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex].command.id);
        }
        break;
    }
  };

  return (
    <div className="command-palette__overlay" onClick={closePalette} role="presentation">
      <div
        className="command-palette"
        role="dialog"
        aria-label="Command palette"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="command-palette__input-wrapper">
          <span className="command-palette__prefix">&gt;</span>
          <input
            ref={inputRef}
            className="command-palette__input"
            type="text"
            placeholder="Type a command..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            role="combobox"
            aria-expanded={filteredCommands.length > 0}
            aria-controls="command-palette-list"
            aria-activedescendant={
              filteredCommands[selectedIndex]
                ? `cmd-${filteredCommands[selectedIndex].command.id}`
                : undefined
            }
            aria-autocomplete="list"
          />
        </div>
        <div ref={listRef} className="command-palette__results" id="command-palette-list" role="listbox" style={{ overflow: "auto" }}>
          {filteredCommands.length === 0 && (
            <div className="command-palette__empty">
              No matching commands
            </div>
          )}
          {filteredCommands.length > 0 && (
            <div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const result = filteredCommands[virtualRow.index];
                const i = virtualRow.index;
                return (
                  <button
                    key={result.command.id}
                    id={`cmd-${result.command.id}`}
                    role="option"
                    aria-selected={i === selectedIndex}
                    className={`command-palette__item ${
                      i === selectedIndex ? "command-palette__item--selected" : ""
                    }`}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    onClick={() => executeCommand(result.command.id)}
                    onMouseEnter={() => setSelectedIndex(i)}
                  >
                    <div className="command-palette__item-left">
                      {result.command.category && (
                        <span className="command-palette__category">
                          {result.command.category}:
                        </span>
                      )}
                      <span className="command-palette__label">
                        <HighlightedLabel
                          label={result.command.label}
                          matchedIndices={result.matchedIndices}
                        />
                      </span>
                    </div>
                    {result.command.keybinding && (
                      <kbd className="command-palette__keybinding">
                        {result.command.keybinding}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
