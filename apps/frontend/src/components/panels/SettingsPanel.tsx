import { useState } from "react";
import { useSettingsStore, type SettingDefinition } from "../../stores/settingsStore";
import { Search, RotateCcw } from "lucide-react";
import "./SettingsPanel.css";

/* ------------------------------------------------------------------ */
/*  Individual setting control                                        */
/* ------------------------------------------------------------------ */

function SettingControl({ def }: { def: SettingDefinition }) {
  const value = useSettingsStore((s) => s.getValue(def.id));
  const setValue = useSettingsStore((s) => s.setValue);
  const resetToDefault = useSettingsStore((s) => s.resetToDefault);

  const isDefault = value === def.defaultValue;

  const renderControl = () => {
    switch (def.type) {
      case "boolean":
        return (
          <button
            className={`settings-panel__toggle ${value ? "settings-panel__toggle--on" : ""}`}
            onClick={() => setValue(def.id, !value)}
            aria-pressed={!!value}
            aria-label={def.label}
          />
        );
      case "number":
        return (
          <input
            type="number"
            className="settings-panel__input settings-panel__input--number"
            value={value as number}
            min={def.min}
            max={def.max}
            step={def.step}
            onChange={(e) => setValue(def.id, Number(e.target.value))}
          />
        );
      case "string":
        return (
          <input
            type="text"
            className="settings-panel__input"
            value={value as string}
            onChange={(e) => setValue(def.id, e.target.value)}
          />
        );
      case "enum":
        return (
          <select
            className="settings-panel__select"
            value={value as string}
            onChange={(e) => setValue(def.id, e.target.value)}
          >
            {def.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case "color":
        return (
          <div className="settings-panel__color-wrap">
            <input
              type="color"
              className="settings-panel__color-input"
              value={value as string}
              onChange={(e) => setValue(def.id, e.target.value)}
            />
            <span style={{ fontSize: 11, color: "var(--os-fg-muted)", fontFamily: "var(--os-font-mono, monospace)" }}>
              {value as string}
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="settings-panel__item">
      <div className="settings-panel__item-header">
        <span className="settings-panel__item-label">{def.label}</span>
        <span className="settings-panel__item-id">{def.id}</span>
      </div>
      <div className="settings-panel__item-desc">{def.description}</div>
      <div className="settings-panel__control">
        {renderControl()}
        {!isDefault && (
          <button
            className="settings-panel__reset-btn"
            title="Reset to default"
            onClick={() => resetToDefault(def.id)}
          >
            <RotateCcw size={10} /> default
          </button>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Settings Panel                                                    */
/* ------------------------------------------------------------------ */

export function SettingsPanel() {
  const searchQuery = useSettingsStore((s) => s.searchQuery);
  const setSearchQuery = useSettingsStore((s) => s.setSearchQuery);
  const activeCategory = useSettingsStore((s) => s.activeCategory);
  const setActiveCategory = useSettingsStore((s) => s.setActiveCategory);
  const getCategories = useSettingsStore((s) => s.getCategories);
  const getFilteredSettings = useSettingsStore((s) => s.getFilteredSettings);
  const resetAllDefaults = useSettingsStore((s) => s.resetAllDefaults);

  const [confirmReset, setConfirmReset] = useState(false);

  const categories = getCategories();
  const settings = getFilteredSettings();

  // Group by category
  const grouped = settings.reduce<Record<string, SettingDefinition[]>>((acc, def) => {
    (acc[def.category] ??= []).push(def);
    return acc;
  }, {});

  return (
    <div className="settings-panel">
      {/* Search */}
      <div className="settings-panel__search">
        <div className="settings-panel__search-wrap">
          <Search size={14} style={{ color: "var(--os-fg-muted)", flexShrink: 0 }} />
          <input
            className="settings-panel__search-input"
            placeholder="Search settings…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Category filter */}
      <div className="settings-panel__categories">
        <button
          className={`settings-panel__cat-btn ${!activeCategory ? "settings-panel__cat-btn--active" : ""}`}
          onClick={() => setActiveCategory(null)}
        >
          All
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            className={`settings-panel__cat-btn ${activeCategory === cat ? "settings-panel__cat-btn--active" : ""}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Settings list */}
      <div className="settings-panel__list">
        {Object.entries(grouped).map(([category, defs]) => (
          <div key={category}>
            <div className="settings-panel__group-header">{category}</div>
            {defs.map((def) => (
              <SettingControl key={def.id} def={def} />
            ))}
          </div>
        ))}
        {settings.length === 0 && (
          <div style={{ padding: 16, textAlign: "center", color: "var(--os-fg-muted)", fontSize: 12 }}>
            No settings match your search.
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="settings-panel__footer">
        {confirmReset ? (
          <>
            <span style={{ fontSize: 11, color: "var(--os-fg-muted)" }}>Reset all?</span>
            <button className="settings-panel__footer-btn" onClick={() => { resetAllDefaults(); setConfirmReset(false); }}>
              Yes
            </button>
            <button className="settings-panel__footer-btn" onClick={() => setConfirmReset(false)}>
              No
            </button>
          </>
        ) : (
          <button className="settings-panel__footer-btn" onClick={() => setConfirmReset(true)}>
            Reset All to Defaults
          </button>
        )}
      </div>
    </div>
  );
}
