import { usePluginStore } from "../../stores/pluginStore";
import type { PluginInstance } from "../../plugins/types";
import { useRef } from "react";
import "./PluginsPanel.css";

const stateLabels: Record<string, string> = {
  active: "Active",
  installed: "Installed",
  disabled: "Disabled",
  error: "Error",
};

const stateIcons: Record<string, string> = {
  active: "●",
  installed: "○",
  disabled: "◌",
  error: "✕",
};

function PluginCard({ plugin }: { plugin: PluginInstance }) {
  const activatePlugin = usePluginStore((s) => s.activatePlugin);
  const disablePlugin = usePluginStore((s) => s.disablePlugin);
  const unregisterPlugin = usePluginStore((s) => s.unregisterPlugin);
  const setActivePdk = usePluginStore((s) => s.setActivePdk);

  const isPdk = plugin.manifest.categories.includes("pdk");
  const activePdkId = usePluginStore((s) => s.activePdkId);
  const isActivePdk = activePdkId === plugin.manifest.id;

  return (
    <div className={`plugin-card plugin-card--${plugin.state}`}>
      <div className="plugin-card__header">
        <span className={`plugin-card__status plugin-card__status--${plugin.state}`}>
          {stateIcons[plugin.state] ?? "?"}
        </span>
        <div className="plugin-card__info">
          <span className="plugin-card__name">{plugin.manifest.name}</span>
          <span className="plugin-card__version">v{plugin.manifest.version}</span>
        </div>
      </div>

      <p className="plugin-card__description">{plugin.manifest.description}</p>

      <div className="plugin-card__meta">
        <span className="plugin-card__author">{plugin.manifest.author}</span>
        <span className="plugin-card__state">{stateLabels[plugin.state]}</span>
      </div>

      {plugin.state === "error" && plugin.error && (
        <p className="plugin-card__error">{plugin.error}</p>
      )}

      <div className="plugin-card__categories">
        {plugin.manifest.categories.map((cat) => (
          <span key={cat} className="plugin-card__tag">{cat}</span>
        ))}
      </div>

      <div className="plugin-card__actions">
        {plugin.state === "installed" && (
          <button className="plugin-card__btn" onClick={() => activatePlugin(plugin.manifest.id)}>
            Activate
          </button>
        )}
        {plugin.state === "active" && (
          <button className="plugin-card__btn" onClick={() => disablePlugin(plugin.manifest.id)}>
            Disable
          </button>
        )}
        {plugin.state === "disabled" && (
          <>
            <button className="plugin-card__btn" onClick={() => activatePlugin(plugin.manifest.id)}>
              Enable
            </button>
            <button
              className="plugin-card__btn plugin-card__btn--danger"
              onClick={() => unregisterPlugin(plugin.manifest.id)}
            >
              Uninstall
            </button>
          </>
        )}
        {isPdk && plugin.state === "active" && !isActivePdk && (
          <button className="plugin-card__btn" onClick={() => setActivePdk(plugin.manifest.id)}>
            Set as Active PDK
          </button>
        )}
        {isPdk && isActivePdk && (
          <span className="plugin-card__tag plugin-card__tag--pdk">Active PDK</span>
        )}
      </div>
    </div>
  );
}

export function PluginsPanel() {
  const plugins = usePluginStore((s) => s.plugins);
  const installFromManifest = usePluginStore((s) => s.installFromManifest);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = installFromManifest(reader.result as string);
      if (!result.success) {
        alert(`Failed to install plugin: ${result.error}`);
      }
    };
    reader.readAsText(file);
    // Reset so same file can be re-imported
    e.target.value = "";
  };

  return (
    <div className="plugins-panel">
      <div className="plugins-panel__toolbar">
        <button className="plugins-panel__import-btn" onClick={handleImport} title="Install plugin from JSON manifest">
          + Install Plugin
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>

      <div className="plugins-panel__list">
        {plugins.length === 0 && (
          <p className="plugins-panel__empty">No plugins installed</p>
        )}
        {plugins.map((p) => (
          <PluginCard key={p.manifest.id} plugin={p} />
        ))}
      </div>
    </div>
  );
}
