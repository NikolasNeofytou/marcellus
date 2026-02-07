import { useState, useRef, useEffect } from "react";
import { useCommandStore } from "../../stores/commandStore";
import {
  useKeybindingStore,
  eventToCombo,
  KEYBINDING_PRESETS,
  type PresetId,
} from "../../stores/keybindingStore";
import "./KeybindingEditor.css";

export function KeybindingEditor() {
  const commands = useCommandStore((s) => s.commands);
  const {
    customBindings,
    removedDefaults,
    activePreset,
    whenClauses,
    setKeybinding,
    removeKeybinding,
    resetKeybinding,
    resetAll,
    getKeybinding,
    loadPreset,
    setWhenClause,
    removeWhenClause,
  } = useKeybindingStore();

  const [search, setSearch] = useState("");
  const [editingCmd, setEditingCmd] = useState<string | null>(null);
  const [recordedKeys, setRecordedKeys] = useState("");
  const [editingWhenCmd, setEditingWhenCmd] = useState<string | null>(null);
  const [whenInput, setWhenInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (editingCmd && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editingCmd]);

  const allCommands = Array.from(commands.values());
  const filtered = allCommands.filter(
    (cmd) =>
      !search ||
      cmd.label.toLowerCase().includes(search.toLowerCase()) ||
      cmd.id.toLowerCase().includes(search.toLowerCase()) ||
      cmd.category?.toLowerCase().includes(search.toLowerCase())
  );

  // Sort: commands with bindings first, then alphabetically
  filtered.sort((a, b) => {
    const aBinding = getKeybinding(a.id, a.keybinding);
    const bBinding = getKeybinding(b.id, b.keybinding);
    if (aBinding && !bBinding) return -1;
    if (!aBinding && bBinding) return 1;
    return a.label.localeCompare(b.label);
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();

    // Ignore modifier-only presses
    if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;

    const combo = eventToCombo(e.nativeEvent);
    if (e.key === "Escape") {
      setEditingCmd(null);
      setRecordedKeys("");
      return;
    }
    if (e.key === "Enter" && recordedKeys && editingCmd) {
      setKeybinding(editingCmd, recordedKeys);
      setEditingCmd(null);
      setRecordedKeys("");
      return;
    }

    // Support multi-chord: append if there's already a chord recorded and it's been <2 seconds
    if (recordedKeys && !recordedKeys.includes(" ")) {
      setRecordedKeys(`${recordedKeys} ${combo}`);
    } else {
      setRecordedKeys(combo);
    }
  };

  return (
    <div className="keybinding-editor">
      <div className="keybinding-editor__header">
        <h3>Keyboard Shortcuts</h3>
        <div className="keybinding-editor__header-actions">
          <select
            className="keybinding-editor__preset-select"
            value={activePreset}
            onChange={(e) => loadPreset(e.target.value as PresetId)}
            title="Load keybinding preset"
          >
            {KEYBINDING_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button className="keybinding-editor__reset-all" onClick={resetAll}>
            Reset All
          </button>
        </div>
      </div>

      <input
        type="text"
        className="keybinding-editor__search"
        placeholder="Search commands..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="keybinding-editor__list">
        {filtered.map((cmd) => {
          const isEditing = editingCmd === cmd.id;
          const isRemoved = removedDefaults.has(cmd.id);
          const isCustom = customBindings.has(cmd.id);
          const effectiveBinding = getKeybinding(cmd.id, cmd.keybinding);
          const whenClause = whenClauses.get(cmd.id);
          const isEditingWhen = editingWhenCmd === cmd.id;

          return (
            <div
              key={cmd.id}
              className={`keybinding-row ${isEditing ? "keybinding-row--editing" : ""} ${isRemoved ? "keybinding-row--removed" : ""}`}
            >
              <div className="keybinding-row__info">
                <span className="keybinding-row__label">{cmd.label}</span>
                <span className="keybinding-row__id">{cmd.id}</span>
              </div>

              <div className="keybinding-row__binding">
                {isEditing ? (
                  <input
                    ref={inputRef}
                    className="keybinding-row__input"
                    value={recordedKeys}
                    onKeyDown={handleKeyDown}
                    readOnly
                    placeholder="Press keys... (Enter to save, Esc to cancel)"
                  />
                ) : (
                  <span
                    className={`keybinding-row__key ${isCustom ? "keybinding-row__key--custom" : ""}`}
                    onClick={() => {
                      setEditingCmd(cmd.id);
                      setRecordedKeys("");
                    }}
                    title="Click to edit"
                  >
                    {effectiveBinding ? renderKeybinding(effectiveBinding) : "—"}
                  </span>
                )}
              </div>

              <div className="keybinding-row__when">
                {isEditingWhen ? (
                  <input
                    className="keybinding-row__when-input"
                    value={whenInput}
                    onChange={(e) => setWhenInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        if (whenInput.trim()) {
                          setWhenClause(cmd.id, whenInput.trim());
                        } else {
                          removeWhenClause(cmd.id);
                        }
                        setEditingWhenCmd(null);
                        setWhenInput("");
                      } else if (e.key === "Escape") {
                        setEditingWhenCmd(null);
                        setWhenInput("");
                      }
                    }}
                    onBlur={() => {
                      setEditingWhenCmd(null);
                      setWhenInput("");
                    }}
                    autoFocus
                    placeholder="e.g. tool === 'select'"
                  />
                ) : (
                  <span
                    className="keybinding-row__when-label"
                    onClick={() => {
                      setEditingWhenCmd(cmd.id);
                      setWhenInput(whenClause ?? "");
                    }}
                    title="Click to set context condition"
                  >
                    {whenClause || "—"}
                  </span>
                )}
              </div>

              <div className="keybinding-row__actions">
                {!isEditing && (
                  <>
                    <button
                      className="keybinding-row__btn"
                      onClick={() => {
                        setEditingCmd(cmd.id);
                        setRecordedKeys("");
                      }}
                      title="Edit keybinding"
                    >
                      ✎
                    </button>
                    {effectiveBinding && (
                      <button
                        className="keybinding-row__btn"
                        onClick={() => removeKeybinding(cmd.id)}
                        title="Remove keybinding"
                      >
                        ✕
                      </button>
                    )}
                    {isCustom && (
                      <button
                        className="keybinding-row__btn"
                        onClick={() => resetKeybinding(cmd.id)}
                        title="Reset to default"
                      >
                        ↺
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Render keybinding as styled keyboard-key badges */
function renderKeybinding(binding: string): React.ReactNode {
  const chords = binding.split(" ");
  return (
    <>
      {chords.map((chord, ci) => (
        <span key={ci} className="keybinding-chord">
          {ci > 0 && <span className="keybinding-chord-sep"> </span>}
          {chord.split("+").map((key, ki) => (
            <span key={ki}>
              {ki > 0 && <span className="keybinding-plus">+</span>}
              <kbd className="keybinding-kbd">{key}</kbd>
            </span>
          ))}
        </span>
      ))}
    </>
  );
}
