import { useState, useCallback } from "react";
import { useSnippetStore, type Snippet, type HdlLanguage } from "../../stores/snippetStore";
import { useHdlStore } from "../../stores/hdlStore";
import { Search, Plus, Copy, Trash2 } from "lucide-react";
import "./SnippetPanel.css";

/* ------------------------------------------------------------------ */
/*  Snippet card                                                      */
/* ------------------------------------------------------------------ */

function SnippetCard({ snippet }: { snippet: Snippet }) {
  const [expanded, setExpanded] = useState(false);
  const removeSnippet = useSnippetStore((s) => s.removeSnippet);
  const expandSnippet = useSnippetStore((s) => s.expandSnippet);

  const activeFileId = useHdlStore((s) => s.activeFileId);
  const files = useHdlStore((s) => s.files);
  const updateContent = useHdlStore((s) => s.updateContent);
  const activeFile = activeFileId ? files.get(activeFileId) : undefined;

  const handleInsert = useCallback(() => {
    if (!activeFile) return;
    const expanded = expandSnippet(snippet);
    // Insert at cursor position
    const lines = activeFile.content.split("\n");
    const line = Math.min(activeFile.cursorLine ?? 0, lines.length);
    lines.splice(line, 0, expanded);
    updateContent(activeFile.id, lines.join("\n"));
  }, [activeFile, snippet, expandSnippet, updateContent]);

  const previewBody = snippet.body.length > 120
    ? snippet.body.slice(0, 120) + "…"
    : snippet.body;

  return (
    <div className="snippet-card" onClick={() => setExpanded(!expanded)}>
      <div className="snippet-card__header">
        <span className="snippet-card__name">{snippet.name}</span>
        <span className="snippet-card__prefix">{snippet.prefix}</span>
        <span className="snippet-card__lang">{snippet.language}</span>
      </div>
      <div className="snippet-card__desc">{snippet.description}</div>

      {expanded && (
        <>
          <pre className="snippet-card__preview">{previewBody}</pre>
          <div className="snippet-card__actions">
            <button
              className="snippet-card__action-btn snippet-card__action-btn--insert"
              onClick={(e) => { e.stopPropagation(); handleInsert(); }}
              title="Insert into active HDL file"
            >
              <Copy size={10} /> Insert
            </button>
            {!snippet.builtIn && (
              <button
                className="snippet-card__action-btn snippet-card__action-btn--delete"
                onClick={(e) => { e.stopPropagation(); removeSnippet(snippet.id); }}
                title="Delete custom snippet"
              >
                <Trash2 size={10} /> Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  New snippet form (minimal inline)                                 */
/* ------------------------------------------------------------------ */

function NewSnippetForm({ onClose }: { onClose: () => void }) {
  const addSnippet = useSnippetStore((s) => s.addSnippet);
  const [name, setName] = useState("");
  const [prefix, setPrefix] = useState("");
  const [body, setBody] = useState("");
  const [language, setLanguage] = useState<HdlLanguage>("systemverilog");

  const handleSave = () => {
    if (!name.trim() || !prefix.trim() || !body.trim()) return;
    addSnippet({ name, prefix, body, description: name, language, category: "Custom" });
    onClose();
  };

  return (
    <div style={{ padding: 8, borderBottom: "1px solid var(--os-border)" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <input
          className="snippet-panel__search-input"
          style={{ border: "1px solid var(--os-border)", borderRadius: 4, padding: "4px 6px" }}
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div style={{ display: "flex", gap: 4 }}>
          <input
            className="snippet-panel__search-input"
            style={{ flex: 1, border: "1px solid var(--os-border)", borderRadius: 4, padding: "4px 6px" }}
            placeholder="Prefix (trigger)"
            value={prefix}
            onChange={(e) => setPrefix(e.target.value)}
          />
          <select
            style={{
              border: "1px solid var(--os-border)", borderRadius: 4, padding: "4px 6px",
              background: "var(--os-input-bg, var(--os-bg))", color: "var(--os-fg)", fontSize: 11,
            }}
            value={language}
            onChange={(e) => setLanguage(e.target.value as HdlLanguage)}
          >
            <option value="verilog">Verilog</option>
            <option value="systemverilog">SystemVerilog</option>
            <option value="vhdl">VHDL</option>
          </select>
        </div>
        <textarea
          style={{
            width: "100%", minHeight: 60, border: "1px solid var(--os-border)", borderRadius: 4,
            padding: "4px 6px", background: "var(--os-input-bg, var(--os-bg))", color: "var(--os-fg)",
            fontFamily: "var(--os-font-mono, monospace)", fontSize: 11, resize: "vertical",
          }}
          placeholder="Snippet body (use $1, $2, $0 for tabstops)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div style={{ display: "flex", gap: 4 }}>
          <button className="snippet-card__action-btn snippet-card__action-btn--insert" onClick={handleSave}>
            Save
          </button>
          <button className="snippet-card__action-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Snippet Panel                                                     */
/* ------------------------------------------------------------------ */

export function SnippetPanel() {
  const searchQuery = useSnippetStore((s) => s.searchQuery);
  const setSearchQuery = useSnippetStore((s) => s.setSearchQuery);
  const activeLanguage = useSnippetStore((s) => s.activeLanguage);
  const setActiveLanguage = useSnippetStore((s) => s.setActiveLanguage);
  const activeCategory = useSnippetStore((s) => s.activeCategory);
  const setActiveCategory = useSnippetStore((s) => s.setActiveCategory);
  const getFilteredSnippets = useSnippetStore((s) => s.getFilteredSnippets);
  const getCategories = useSnippetStore((s) => s.getCategories);

  const [showNew, setShowNew] = useState(false);

  const snippets = getFilteredSnippets();
  const categories = getCategories();
  const languages: (HdlLanguage | null)[] = [null, "verilog", "systemverilog", "vhdl"];

  return (
    <div className="snippet-panel">
      {/* Header */}
      <div className="snippet-panel__header">
        <div className="snippet-panel__search-wrap">
          <Search size={14} style={{ color: "var(--os-fg-muted)", flexShrink: 0 }} />
          <input
            className="snippet-panel__search-input"
            placeholder="Search snippets…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {/* Language filter */}
        <div className="snippet-panel__filters">
          {languages.map((lang) => (
            <button
              key={lang ?? "all"}
              className={`snippet-panel__filter-btn ${activeLanguage === lang ? "snippet-panel__filter-btn--active" : ""}`}
              onClick={() => setActiveLanguage(lang)}
            >
              {lang ?? "All"}
            </button>
          ))}
        </div>
        {/* Category filter */}
        <div className="snippet-panel__filters">
          <button
            className={`snippet-panel__filter-btn ${!activeCategory ? "snippet-panel__filter-btn--active" : ""}`}
            onClick={() => setActiveCategory(null)}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`snippet-panel__filter-btn ${activeCategory === cat ? "snippet-panel__filter-btn--active" : ""}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* New snippet form */}
      {showNew && <NewSnippetForm onClose={() => setShowNew(false)} />}

      {/* Snippet list */}
      <div className="snippet-panel__list">
        {snippets.length === 0 ? (
          <div className="snippet-panel__empty">No snippets match your filter.</div>
        ) : (
          snippets.map((snip) => <SnippetCard key={snip.id} snippet={snip} />)
        )}
      </div>

      {/* Footer */}
      <div className="snippet-panel__footer">
        <button className="snippet-panel__footer-btn" onClick={() => setShowNew(true)}>
          <Plus size={12} style={{ verticalAlign: -2 }} /> New Snippet
        </button>
      </div>
    </div>
  );
}
