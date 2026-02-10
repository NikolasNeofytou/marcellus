import { useState } from "react";
import {
  Code2,
  LayoutTemplate,
  Heart,
  BarChart3,
  Copy,
  Download,
  Star,
  ThumbsUp,
  MessageSquare,
  Trophy,
  Users,
} from "lucide-react";
import { useCommunityStore } from "../../stores/communityStore";
import type { SnippetCategory, TemplateCategory } from "../../stores/communityStore";
import "./CommunityPanel.css";

type Tab = "snippets" | "templates" | "contributions" | "stats";

export function CommunityPanel() {
  const [tab, setTab] = useState<Tab>("snippets");
  return (
    <div className="community-panel">
      <div className="community-panel__tabs">
        <button
          className={`community-panel__tab${tab === "snippets" ? " community-panel__tab--active" : ""}`}
          onClick={() => setTab("snippets")}
        >
          <Code2 size={12} /> Snippets
        </button>
        <button
          className={`community-panel__tab${tab === "templates" ? " community-panel__tab--active" : ""}`}
          onClick={() => setTab("templates")}
        >
          <LayoutTemplate size={12} /> Templates
        </button>
        <button
          className={`community-panel__tab${tab === "contributions" ? " community-panel__tab--active" : ""}`}
          onClick={() => setTab("contributions")}
        >
          <Heart size={12} /> Contrib
        </button>
        <button
          className={`community-panel__tab${tab === "stats" ? " community-panel__tab--active" : ""}`}
          onClick={() => setTab("stats")}
        >
          <BarChart3 size={12} /> Stats
        </button>
      </div>
      <div className="community-panel__body">
        {tab === "snippets" && <SnippetsTab />}
        {tab === "templates" && <TemplatesTab />}
        {tab === "contributions" && <ContribTab />}
        {tab === "stats" && <StatsTab />}
      </div>
    </div>
  );
}

/* ── Snippets ──────────────────────────────────────────── */
function SnippetsTab() {
  const { snippets, snippetSearch, setSnippetSearch, snippetCategory, setSnippetCategory, copySnippet } =
    useCommunityStore();

  const categories: Array<SnippetCategory | "all"> = ["all", "pcell", "drc_deck", "simulation", "utility", "measurement"];

  const filtered = snippets.filter((s) => {
    const matchSearch =
      !snippetSearch ||
      s.title.toLowerCase().includes(snippetSearch.toLowerCase()) ||
      s.description.toLowerCase().includes(snippetSearch.toLowerCase());
    const matchCat = snippetCategory === "all" || s.category === snippetCategory;
    return matchSearch && matchCat;
  });

  return (
    <>
      <div className="community-panel__section">
        <input
          className="community-panel__search"
          placeholder="Search snippets..."
          value={snippetSearch}
          onChange={(e) => setSnippetSearch(e.target.value)}
        />
      </div>
      <div className="community-panel__filter-row">
        {categories.map((c) => (
          <button
            key={c}
            className={`community-panel__filter-chip${snippetCategory === c ? " community-panel__filter-chip--active" : ""}`}
            onClick={() => setSnippetCategory(c)}
          >
            {c.replace("_", " ")}
          </button>
        ))}
      </div>
      {filtered.map((s) => (
        <div key={s.id} className="community-panel__card">
          <div className="community-panel__card-title">
            <Code2 size={10} /> {s.title}
          </div>
          <div className="community-panel__card-desc">{s.description}</div>
          <div className="community-panel__tags">
            {s.tags.map((t) => (
              <span key={t} className="community-panel__tag">{t}</span>
            ))}
          </div>
          <div className="community-panel__card-meta">
            <span>by {s.author}</span>
            <span>
              <Star size={8} /> {s.rating.toFixed(1)}
            </span>
            <span>
              <Copy size={8} /> {s.downloads}
            </span>
          </div>
          <div className="community-panel__card-actions">
            <button className="community-panel__btn community-panel__btn--sm" onClick={() => copySnippet(s.id)}>
              <Copy size={10} /> Copy
            </button>
          </div>
        </div>
      ))}
      {filtered.length === 0 && (
        <div style={{ color: "var(--text-secondary)", fontSize: 11, textAlign: "center", padding: 20 }}>
          No snippets match your search.
        </div>
      )}
    </>
  );
}

/* ── Templates ──────────────────────────────────────────── */
function TemplatesTab() {
  const { templates, templateSearch, setTemplateSearch, templateCategory, setTemplateCategory, useTemplate: applyTemplate } =
    useCommunityStore();

  const categories: Array<TemplateCategory | "all"> = ["all", "analog_block", "standard_cell", "io_cell", "memory", "pad_frame"];

  const filtered = templates.filter((t) => {
    const matchSearch =
      !templateSearch ||
      t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
      t.description.toLowerCase().includes(templateSearch.toLowerCase());
    const matchCat = templateCategory === "all" || t.category === templateCategory;
    return matchSearch && matchCat;
  });

  return (
    <>
      <div className="community-panel__section">
        <input
          className="community-panel__search"
          placeholder="Search templates..."
          value={templateSearch}
          onChange={(e) => setTemplateSearch(e.target.value)}
        />
      </div>
      <div className="community-panel__filter-row">
        {categories.map((c) => (
          <button
            key={c}
            className={`community-panel__filter-chip${templateCategory === c ? " community-panel__filter-chip--active" : ""}`}
            onClick={() => setTemplateCategory(c)}
          >
            {c.replace("_", " ")}
          </button>
        ))}
      </div>
      {filtered.map((t) => (
        <div key={t.id} className="community-panel__card">
          <div className="community-panel__card-title">
            <LayoutTemplate size={10} /> {t.name}
          </div>
          <div className="community-panel__card-desc">{t.description}</div>
          <div className="community-panel__tags">
            {t.tags.map((tag) => (
              <span key={tag} className="community-panel__tag">{tag}</span>
            ))}
          </div>
          <div className="community-panel__card-meta">
            <span>by {t.author}</span>
            <span>{t.pdk}</span>
            <span>
              <Download size={8} /> {t.downloads}
            </span>
          </div>
          <div className="community-panel__card-actions">
            <button
              className="community-panel__btn community-panel__btn--sm community-panel__btn--primary"
              onClick={() => applyTemplate(t.id)}
            >
              <Download size={10} /> Use
            </button>
          </div>
        </div>
      ))}
      {filtered.length === 0 && (
        <div style={{ color: "var(--text-secondary)", fontSize: 11, textAlign: "center", padding: 20 }}>
          No templates match your search.
        </div>
      )}
    </>
  );
}

/* ── Contributions ──────────────────────────────────────── */
function ContribTab() {
  const { contributions } = useCommunityStore();

  return (
    <>
      <div className="community-panel__section">
        <div className="community-panel__label">Community Contributions</div>
      </div>
      {contributions.map((c) => (
        <div key={c.id} className="community-panel__card">
          <div className="community-panel__card-title">
            <Heart size={10} />
            {c.title}
            <span className={`community-panel__status community-panel__status--${c.status}`}>
              {c.status.replace("_", " ")}
            </span>
          </div>
          <div className="community-panel__card-desc">{c.description}</div>
          <div className="community-panel__card-meta">
            <span>by {c.author}</span>
            <span>{c.type}</span>
            <span>
              <ThumbsUp size={8} /> {c.stars}
            </span>
            <span>
              <MessageSquare size={8} /> {c.comments.length}
            </span>
          </div>
          {c.comments.length > 0 && (
            <div style={{ marginTop: 6 }}>
              {c.comments.slice(0, 2).map((cm) => (
                <div key={cm.id} className="community-panel__comment">
                  <span className="community-panel__comment-author">{cm.author}:</span>
                  {cm.text}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

/* ── Stats ──────────────────────────────────────────── */
function StatsTab() {
  const getStats = useCommunityStore((s) => s.getStats);
  const stats = getStats();

  return (
    <>
      <div className="community-panel__section">
        <div className="community-panel__label">Community Statistics</div>
      </div>

      <div className="community-panel__stats-grid">
        <div className="community-panel__stat">
          <div className="community-panel__stat-value">{stats.totalSnippets}</div>
          <div className="community-panel__stat-label">Snippets</div>
        </div>
        <div className="community-panel__stat">
          <div className="community-panel__stat-value">{stats.totalTemplates}</div>
          <div className="community-panel__stat-label">Templates</div>
        </div>
        <div className="community-panel__stat">
          <div className="community-panel__stat-value">{stats.totalContributions}</div>
          <div className="community-panel__stat-label">Contributions</div>
        </div>
        <div className="community-panel__stat">
          <div className="community-panel__stat-value">{stats.totalPlugins}</div>
          <div className="community-panel__stat-label">Plugins</div>
        </div>
      </div>

      <div className="community-panel__section">
        <div className="community-panel__label">
          <Trophy size={10} /> Top Contributors
        </div>
      </div>
      {stats.topContributors.map((c, i) => (
        <div key={c.name} className="community-panel__leaderboard-item">
          <span className="community-panel__rank">#{i + 1}</span>
          <Users size={12} />
          <span className="community-panel__contributor-name">{c.name}</span>
          <span className="community-panel__contributor-score">{c.contributions} items</span>
        </div>
      ))}
    </>
  );
}
