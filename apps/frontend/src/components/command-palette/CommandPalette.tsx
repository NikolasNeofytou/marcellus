import { useRef, useEffect, useState } from "react";
import { useCommandStore } from "../../stores/commandStore";
import "./CommandPalette.css";

export function CommandPalette() {
  const isOpen = useCommandStore((s) => s.isOpen);
  const query = useCommandStore((s) => s.query);
  const setQuery = useCommandStore((s) => s.setQuery);
  const closePalette = useCommandStore((s) => s.closePalette);
  const executeCommand = useCommandStore((s) => s.executeCommand);
  const getFilteredCommands = useCommandStore((s) => s.getFilteredCommands);

  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = isOpen ? getFilteredCommands() : [];

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "Escape":
        closePalette();
        break;
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        if (filteredCommands[selectedIndex]) {
          executeCommand(filteredCommands[selectedIndex].id);
        }
        break;
    }
  };

  return (
    <div className="command-palette__overlay" onClick={closePalette}>
      <div
        className="command-palette"
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
          />
        </div>
        <div className="command-palette__results">
          {filteredCommands.length === 0 && (
            <div className="command-palette__empty">
              No matching commands
            </div>
          )}
          {filteredCommands.map((cmd, i) => (
            <button
              key={cmd.id}
              className={`command-palette__item ${
                i === selectedIndex ? "command-palette__item--selected" : ""
              }`}
              onClick={() => executeCommand(cmd.id)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <div className="command-palette__item-left">
                {cmd.category && (
                  <span className="command-palette__category">
                    {cmd.category}:
                  </span>
                )}
                <span className="command-palette__label">{cmd.label}</span>
              </div>
              {cmd.keybinding && (
                <kbd className="command-palette__keybinding">
                  {cmd.keybinding}
                </kbd>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
