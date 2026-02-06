import {
  useMarketplaceStore,
  type MarketplaceEntry,
  type MarketplaceFilter,
  type SortBy,
} from "../../stores/marketplaceStore";
import "./MarketplacePanel.css";

// ── Constants ──

const CATEGORIES: { value: MarketplaceFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pdk", label: "PDK" },
  { value: "drc", label: "DRC" },
  { value: "simulation", label: "Simulation" },
  { value: "import-export", label: "Import/Export" },
  { value: "device-generator", label: "Generators" },
  { value: "tool", label: "Tools" },
  { value: "theme", label: "Themes" },
];

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "downloads", label: "Downloads" },
  { value: "rating", label: "Rating" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name" },
];

// ── Helpers ──

function formatDownloads(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(empty);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Entry Card ──

function EntryCard({ entry }: { entry: MarketplaceEntry }) {
  const installing = useMarketplaceStore((s) => s.installing);
  const installEntry = useMarketplaceStore((s) => s.installEntry);
  const uninstallEntry = useMarketplaceStore((s) => s.uninstallEntry);
  const isInstalled = useMarketplaceStore((s) => s.isInstalled);
  const selectEntry = useMarketplaceStore((s) => s.selectEntry);

  const installed = isInstalled(entry.manifest.id);
  const isInstalling = installing.has(entry.manifest.id);

  return (
    <div
      className={`mp-card ${entry.featured ? "mp-card--featured" : ""}`}
      onClick={() => selectEntry(entry.manifest.id)}
    >
      <div className="mp-card__icon">
        {entry.manifest.categories.includes("pdk")
          ? "🔧"
          : entry.manifest.categories.includes("simulation")
          ? "📊"
          : entry.manifest.categories.includes("drc")
          ? "✓"
          : entry.manifest.categories.includes("theme")
          ? "🎨"
          : entry.manifest.categories.includes("import-export")
          ? "📦"
          : entry.manifest.categories.includes("device-generator")
          ? "⚡"
          : "🧩"}
      </div>
      <div className="mp-card__body">
        <div className="mp-card__header">
          <span className="mp-card__name">{entry.manifest.name}</span>
          <span className="mp-card__version">v{entry.manifest.version}</span>
          {entry.featured && <span className="mp-card__badge">Featured</span>}
        </div>
        <p className="mp-card__desc">{entry.manifest.description}</p>
        <div className="mp-card__meta">
          <span className="mp-card__author">{entry.manifest.author}</span>
          <span className="mp-card__stars" title={`${entry.rating.toFixed(1)} / 5`}>
            {renderStars(entry.rating)}
          </span>
          <span className="mp-card__downloads">
            ↓ {formatDownloads(entry.downloads)}
          </span>
        </div>
        <div className="mp-card__tags">
          {entry.manifest.categories.map((c) => (
            <span key={c} className="mp-card__tag">
              {c}
            </span>
          ))}
        </div>
      </div>
      <div className="mp-card__actions" onClick={(e) => e.stopPropagation()}>
        {isInstalling ? (
          <button className="mp-card__btn mp-card__btn--installing" disabled>
            Installing…
          </button>
        ) : installed ? (
          <button
            className="mp-card__btn mp-card__btn--uninstall"
            onClick={() => uninstallEntry(entry.manifest.id)}
          >
            Uninstall
          </button>
        ) : (
          <button
            className="mp-card__btn mp-card__btn--install"
            onClick={() => installEntry(entry.manifest.id)}
          >
            Install
          </button>
        )}
      </div>
    </div>
  );
}

// ── Detail View ──

function EntryDetail({ entry }: { entry: MarketplaceEntry }) {
  const selectEntry = useMarketplaceStore((s) => s.selectEntry);
  const installing = useMarketplaceStore((s) => s.installing);
  const installEntry = useMarketplaceStore((s) => s.installEntry);
  const uninstallEntry = useMarketplaceStore((s) => s.uninstallEntry);
  const isInstalled = useMarketplaceStore((s) => s.isInstalled);
  const getDependencies = useMarketplaceStore((s) => s.getDependencies);

  const installed = isInstalled(entry.manifest.id);
  const isInstalling = installing.has(entry.manifest.id);
  const deps = getDependencies(entry.manifest.id);

  return (
    <div className="mp-detail">
      <button className="mp-detail__back" onClick={() => selectEntry(null)}>
        ← Back to Marketplace
      </button>

      <div className="mp-detail__header">
        <h2 className="mp-detail__name">{entry.manifest.name}</h2>
        <span className="mp-detail__version">v{entry.manifest.version}</span>
        <div className="mp-detail__actions">
          {isInstalling ? (
            <button className="mp-card__btn mp-card__btn--installing" disabled>
              Installing…
            </button>
          ) : installed ? (
            <button
              className="mp-card__btn mp-card__btn--uninstall"
              onClick={() => uninstallEntry(entry.manifest.id)}
            >
              Uninstall
            </button>
          ) : (
            <button
              className="mp-card__btn mp-card__btn--install"
              onClick={() => installEntry(entry.manifest.id)}
            >
              Install
            </button>
          )}
        </div>
      </div>

      <div className="mp-detail__info">
        <div className="mp-detail__info-item">
          <span className="mp-detail__label">Author</span>
          <span>{entry.manifest.author}</span>
        </div>
        <div className="mp-detail__info-item">
          <span className="mp-detail__label">License</span>
          <span>{entry.manifest.license ?? "N/A"}</span>
        </div>
        <div className="mp-detail__info-item">
          <span className="mp-detail__label">Rating</span>
          <span>
            {renderStars(entry.rating)} ({entry.ratingCount})
          </span>
        </div>
        <div className="mp-detail__info-item">
          <span className="mp-detail__label">Downloads</span>
          <span>{entry.downloads.toLocaleString()}</span>
        </div>
        <div className="mp-detail__info-item">
          <span className="mp-detail__label">Published</span>
          <span>{formatDate(entry.publishedAt)}</span>
        </div>
        <div className="mp-detail__info-item">
          <span className="mp-detail__label">Updated</span>
          <span>{formatDate(entry.updatedAt)}</span>
        </div>
        {entry.repoUrl && (
          <div className="mp-detail__info-item">
            <span className="mp-detail__label">Repository</span>
            <span className="mp-detail__link">{entry.repoUrl}</span>
          </div>
        )}
      </div>

      {deps.length > 0 && (
        <div className="mp-detail__deps">
          <h3>Dependencies</h3>
          {deps.map((d) => (
            <div key={d.id} className="mp-detail__dep">
              <span>{d.id}</span>
              <span className="mp-detail__dep-ver">{d.version}</span>
              <span
                className={`mp-detail__dep-status ${
                  d.satisfied ? "mp-detail__dep-status--ok" : "mp-detail__dep-status--missing"
                }`}
              >
                {d.satisfied ? "✓ Satisfied" : "✕ Missing"}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mp-detail__readme">
        <h3>README</h3>
        <pre className="mp-detail__readme-content">{entry.readme}</pre>
      </div>
    </div>
  );
}

// ── Package Manager View ──

function PackageManagerView() {
  const installedPackages = useMarketplaceStore((s) => s.installedPackages);
  const checkForUpdates = useMarketplaceStore((s) => s.checkForUpdates);
  const updatePackage = useMarketplaceStore((s) => s.updatePackage);
  const toggleAutoUpdate = useMarketplaceStore((s) => s.toggleAutoUpdate);
  const uninstallEntry = useMarketplaceStore((s) => s.uninstallEntry);
  const togglePackageManager = useMarketplaceStore((s) => s.togglePackageManager);

  const packages = Array.from(installedPackages.values());

  return (
    <div className="pkg-mgr">
      <div className="pkg-mgr__header">
        <button className="mp-detail__back" onClick={togglePackageManager}>
          ← Back to Marketplace
        </button>
        <h3 className="pkg-mgr__title">Package Manager</h3>
        <button className="pkg-mgr__check-btn" onClick={checkForUpdates}>
          Check for Updates
        </button>
      </div>

      {packages.length === 0 ? (
        <p className="pkg-mgr__empty">No packages installed.</p>
      ) : (
        <div className="pkg-mgr__list">
          {packages.map((pkg) => (
            <div key={pkg.id} className="pkg-mgr__item">
              <div className="pkg-mgr__item-header">
                <span className="pkg-mgr__item-name">{pkg.name}</span>
                <span className="pkg-mgr__item-version">v{pkg.version}</span>
                {pkg.availableUpdate && (
                  <span className="pkg-mgr__item-update">
                    → v{pkg.availableUpdate}
                  </span>
                )}
              </div>
              <div className="pkg-mgr__item-meta">
                <span>
                  Installed{" "}
                  {new Date(pkg.installedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                {pkg.dependencies.length > 0 && (
                  <span>
                    {pkg.dependencies.length} dep
                    {pkg.dependencies.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div className="pkg-mgr__item-actions">
                <label className="pkg-mgr__auto-update">
                  <input
                    type="checkbox"
                    checked={pkg.autoUpdatable}
                    onChange={() => toggleAutoUpdate(pkg.id)}
                  />
                  Auto-update
                </label>
                {pkg.availableUpdate && (
                  <button
                    className="mp-card__btn mp-card__btn--install"
                    onClick={() => updatePackage(pkg.id)}
                  >
                    Update
                  </button>
                )}
                <button
                  className="mp-card__btn mp-card__btn--uninstall"
                  onClick={() => uninstallEntry(pkg.id)}
                >
                  Uninstall
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Panel ──

export function MarketplacePanel() {
  const searchQuery = useMarketplaceStore((s) => s.searchQuery);
  const setSearchQuery = useMarketplaceStore((s) => s.setSearchQuery);
  const filter = useMarketplaceStore((s) => s.filter);
  const setFilter = useMarketplaceStore((s) => s.setFilter);
  const sortBy = useMarketplaceStore((s) => s.sortBy);
  const setSortBy = useMarketplaceStore((s) => s.setSortBy);
  const selectedEntryId = useMarketplaceStore((s) => s.selectedEntryId);
  const getFilteredEntries = useMarketplaceStore((s) => s.getFilteredEntries);
  const packageManagerOpen = useMarketplaceStore((s) => s.packageManagerOpen);
  const togglePackageManager = useMarketplaceStore((s) => s.togglePackageManager);
  const registry = useMarketplaceStore((s) => s.registry);

  // Detail view
  if (selectedEntryId) {
    const entry = registry.find((e) => e.manifest.id === selectedEntryId);
    if (entry) return <EntryDetail entry={entry} />;
  }

  // Package manager view
  if (packageManagerOpen) {
    return <PackageManagerView />;
  }

  const entries = getFilteredEntries();

  return (
    <div className="marketplace-panel">
      {/* Search bar */}
      <div className="mp-search">
        <input
          className="mp-search__input"
          type="text"
          placeholder="Search plugins, PDKs, tools…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button
          className="mp-search__pkg-btn"
          onClick={togglePackageManager}
          title="Package Manager"
        >
          📦 Packages
        </button>
      </div>

      {/* Filters */}
      <div className="mp-filters">
        <div className="mp-filters__categories">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              className={`mp-filters__cat ${
                filter === c.value ? "mp-filters__cat--active" : ""
              }`}
              onClick={() => setFilter(c.value)}
            >
              {c.label}
            </button>
          ))}
        </div>
        <select
          className="mp-filters__sort"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortBy)}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Results */}
      <div className="mp-results">
        {entries.length === 0 ? (
          <p className="mp-results__empty">
            No results found. Try a different search or filter.
          </p>
        ) : (
          entries.map((e) => <EntryCard key={e.manifest.id} entry={e} />)
        )}
      </div>
    </div>
  );
}
