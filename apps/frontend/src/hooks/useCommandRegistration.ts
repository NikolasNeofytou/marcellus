import { useEffect } from "react";
import { useCommandStore, type CommandEntry } from "../stores/commandStore";
import { useThemeStore } from "../stores/themeStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useToolStore } from "../stores/toolStore";
import { useDrcStore } from "../stores/drcStore";
import { usePluginStore } from "../stores/pluginStore";
import { useSimStore } from "../stores/simStore";
import { useGeometryStore } from "../stores/geometryStore";
import { useSchematicStore } from "../stores/schematicStore";

/**
 * Registers all built-in commands on mount.
 * Commands are the core abstraction — every action is a command.
 */
export function useCommandRegistration() {
  const registerCommands = useCommandStore((s) => s.registerCommands);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const toggleLeftSidebar = useWorkspaceStore((s) => s.toggleLeftSidebar);
  const toggleRightSidebar = useWorkspaceStore((s) => s.toggleRightSidebar);
  const toggleBottomPanel = useWorkspaceStore((s) => s.toggleBottomPanel);
  const setActiveSidebarPanel = useWorkspaceStore((s) => s.setActiveSidebarPanel);
  const addTab = useWorkspaceStore((s) => s.addTab);
  const setActiveTool = useToolStore((s) => s.setActiveTool);

  useEffect(() => {
    const commands: CommandEntry[] = [
      // ── View commands ──
      {
        id: "view.toggleTheme",
        label: "Toggle Theme (Dark/Light)",
        category: "View",
        keybinding: "Ctrl+K Ctrl+T",
        execute: toggleTheme,
      },
      {
        id: "view.toggleLeftSidebar",
        label: "Toggle Left Sidebar",
        category: "View",
        keybinding: "Ctrl+B",
        execute: toggleLeftSidebar,
      },
      {
        id: "view.toggleRightSidebar",
        label: "Toggle Right Sidebar",
        category: "View",
        keybinding: "Ctrl+Alt+B",
        execute: toggleRightSidebar,
      },
      {
        id: "view.toggleBottomPanel",
        label: "Toggle Bottom Panel",
        category: "View",
        keybinding: "Ctrl+J",
        execute: toggleBottomPanel,
      },
      {
        id: "view.showExplorer",
        label: "Show Explorer",
        category: "View",
        keybinding: "Ctrl+Shift+E",
        execute: () => setActiveSidebarPanel("explorer"),
      },
      {
        id: "view.showLayers",
        label: "Show Layer Palette",
        category: "View",
        keybinding: "Ctrl+Shift+L",
        execute: () => setActiveSidebarPanel("layers"),
      },
      {
        id: "view.showCellHierarchy",
        label: "Show Cell Hierarchy",
        category: "View",
        keybinding: "Ctrl+Shift+H",
        execute: () => setActiveSidebarPanel("cell-hierarchy"),
      },
      {
        id: "view.showComponents",
        label: "Show Component Library",
        category: "View",
        execute: () => setActiveSidebarPanel("components"),
      },

      // ── File commands ──
      {
        id: "file.newLayout",
        label: "New Layout",
        category: "File",
        keybinding: "Ctrl+N",
        execute: () => {
          const id = `layout-${Date.now()}`;
          addTab({
            id,
            title: "Untitled Layout",
            type: "layout",
            modified: false,
          });
        },
      },
      {
        id: "file.openFile",
        label: "Open File...",
        category: "File",
        keybinding: "Ctrl+O",
        execute: () => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".json,.osproj";
          input.onchange = () => {
            const file = input.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const data = JSON.parse(reader.result as string);
                if (data.geometries && Array.isArray(data.geometries)) {
                  useGeometryStore.getState().load(data.geometries, data.projectName ?? file.name);
                  useSimStore.getState().appendTerminalLine(`> Opened: ${file.name}`);
                }
              } catch {
                useSimStore.getState().appendTerminalLine(`> Error: Invalid project file.`);
              }
            };
            reader.readAsText(file);
          };
          input.click();
        },
      },
      {
        id: "file.save",
        label: "Save",
        category: "File",
        keybinding: "Ctrl+S",
        execute: () => {
          const store = useGeometryStore.getState();
          const json = store.exportJson();
          const blob = new Blob([json], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${store.projectName.replace(/\s+/g, "_")}.json`;
          a.click();
          URL.revokeObjectURL(url);
          store.markSaved();
          useSimStore.getState().appendTerminalLine(`> Saved: ${a.download}`);
        },
      },
      {
        id: "file.exportGds",
        label: "Export as GDS-II",
        category: "File",
        execute: () => {
          // Export current geometries as a simplified GDS-II JSON representation
          const geoms = useGeometryStore.getState().geometries;
          const name = useGeometryStore.getState().projectName || "design";
          const gdsData = {
            format: "GDSII-JSON",
            version: 1,
            units: { database: 1e-9, user: 1e-6 },
            library: name,
            structures: [
              {
                name: "TOP",
                elements: geoms.map((g, i) => ({
                  id: i,
                  type: g.type === "rect" ? "boundary" : g.type === "path" ? "path" : "boundary",
                  layer: g.layerId,
                  datatype: 0,
                  points: g.points,
                  ...(g.width != null ? { width: g.width } : {}),
                })),
              },
            ],
          };
          const blob = new Blob([JSON.stringify(gdsData, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${name}.gds.json`;
          a.click();
          URL.revokeObjectURL(url);
          useSimStore.getState().appendTerminalLine(`> Exported GDS-II: ${a.download}`);
        },
      },

      // ── Edit commands ──
      {
        id: "edit.undo",
        label: "Undo",
        category: "Edit",
        keybinding: "Ctrl+Z",
        execute: () => {
          useGeometryStore.getState().undo();
        },
      },
      {
        id: "edit.redo",
        label: "Redo",
        category: "Edit",
        keybinding: "Ctrl+Y",
        execute: () => {
          useGeometryStore.getState().redo();
        },
      },
      {
        id: "edit.selectAll",
        label: "Select All",
        category: "Edit",
        keybinding: "Ctrl+A",
        execute: () => {
          const geoms = useGeometryStore.getState().geometries;
          const toolStore = useToolStore.getState();
          toolStore.clearSelection();
          geoms.forEach((g, i) => {
            toolStore.addToSelection({
              cellId: "top",
              geometryIndex: i,
              type: g.type,
            });
          });
        },
      },
      {
        id: "edit.delete",
        label: "Delete Selection",
        category: "Edit",
        keybinding: "Delete",
        execute: () => {
          const toolStore = useToolStore.getState();
          const sel = toolStore.selectedItems;
          if (sel.length === 0) return;
          useGeometryStore.getState().removeGeometries(sel.map((s) => s.geometryIndex));
          toolStore.clearSelection();
        },
      },

      // ── Layout commands ──
      {
        id: "layout.drawRect",
        label: "Draw Rectangle",
        category: "Layout",
        keybinding: "R",
        execute: () => setActiveTool("rect"),
      },
      {
        id: "layout.drawPolygon",
        label: "Draw Polygon",
        category: "Layout",
        keybinding: "P",
        execute: () => setActiveTool("polygon"),
      },
      {
        id: "layout.drawPath",
        label: "Draw Path / Wire",
        category: "Layout",
        keybinding: "W",
        execute: () => setActiveTool("path"),
      },
      {
        id: "layout.placeVia",
        label: "Place Via",
        category: "Layout",
        execute: () => setActiveTool("via"),
      },
      {
        id: "layout.selectTool",
        label: "Select Tool",
        category: "Layout",
        keybinding: "V",
        execute: () => setActiveTool("select"),
      },
      {
        id: "layout.panTool",
        label: "Pan Tool",
        category: "Layout",
        keybinding: "H",
        execute: () => setActiveTool("pan"),
      },
      {
        id: "layout.rulerTool",
        label: "Ruler / Measure",
        category: "Layout",
        keybinding: "M",
        execute: () => setActiveTool("ruler"),
      },
      {
        id: "layout.zoomFit",
        label: "Zoom to Fit",
        category: "Layout",
        keybinding: "Ctrl+0",
        execute: () => {
          // Calculate bounding box of all geometries and dispatch viewport change
          const geoms = useGeometryStore.getState().geometries;
          if (geoms.length === 0) return;
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const g of geoms) {
            for (const p of g.points) {
              if (p.x < minX) minX = p.x;
              if (p.y < minY) minY = p.y;
              if (p.x > maxX) maxX = p.x;
              if (p.y > maxY) maxY = p.y;
            }
          }
          const cx = (minX + maxX) / 2;
          const cy = (minY + maxY) / 2;
          const spanX = maxX - minX || 1;
          const spanY = maxY - minY || 1;
          window.dispatchEvent(
            new CustomEvent("opensilicon:viewport", {
              detail: { centerX: cx, centerY: cy, fitSpanX: spanX, fitSpanY: spanY },
            }),
          );
        },
      },
      {
        id: "layout.zoomSelection",
        label: "Zoom to Selection",
        category: "Layout",
        keybinding: "Z",
        execute: () => {
          const selected = useToolStore.getState().selectedItems;
          const geoms = useGeometryStore.getState().geometries;
          if (selected.length === 0) return;
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const sel of selected) {
            const g = geoms[sel.geometryIndex];
            if (!g) continue;
            for (const p of g.points) {
              if (p.x < minX) minX = p.x;
              if (p.y < minY) minY = p.y;
              if (p.x > maxX) maxX = p.x;
              if (p.y > maxY) maxY = p.y;
            }
          }
          if (!isFinite(minX)) return;
          const cx = (minX + maxX) / 2;
          const cy = (minY + maxY) / 2;
          const spanX = maxX - minX || 1;
          const spanY = maxY - minY || 1;
          window.dispatchEvent(
            new CustomEvent("opensilicon:viewport", {
              detail: { centerX: cx, centerY: cy, fitSpanX: spanX, fitSpanY: spanY },
            }),
          );
        },
      },

      // ── DRC commands ──
      {
        id: "drc.runCheck",
        label: "Run DRC Check",
        category: "DRC",
        keybinding: "Ctrl+Shift+D",
        execute: () => {
          import("../engines/drc").then(({ runDrc, prepareDrcGeometries }) => {
            const rules = usePluginStore.getState().getActiveDesignRules();
            const drcStore = useDrcStore.getState();
            const simStore = useSimStore.getState();
            const geometries = useGeometryStore.getState().geometries;

            // Build layer-id → alias map from PDK
            const techLayers = usePluginStore.getState().getTechLayers();
            const layerMap: Record<number, string> = {};
            for (const tl of techLayers) {
              layerMap[tl.gdsLayer] = tl.alias;
            }

            drcStore.setRunState("running");
            simStore.appendTerminalLine("> Running DRC check...");

            try {
              const drcGeoms = prepareDrcGeometries(geometries, layerMap);
              const result = runDrc(drcGeoms, rules);
              drcStore.setResult(result);
              const errors = result.violations.filter((v) => v.severity === "error").length;
              const warnings = result.violations.filter((v) => v.severity === "warning").length;
              simStore.appendTerminalLine(
                `  DRC complete: ${result.violations.length} violation(s), ${errors} error(s), ${warnings} warning(s).`,
              );
            } catch (err) {
              drcStore.setRunState("error");
              simStore.appendTerminalLine(`  DRC error: ${err}`);
            }
          });
        },
      },
      {
        id: "drc.clearViolations",
        label: "Clear DRC Violations",
        category: "DRC",
        execute: () => {
          useDrcStore.getState().clearViolations();
          useSimStore.getState().appendTerminalLine("> DRC violations cleared.");
        },
      },
      {
        id: "drc.nextViolation",
        label: "Next DRC Violation",
        category: "DRC",
        keybinding: "F8",
        execute: () => useDrcStore.getState().nextViolation(),
      },
      {
        id: "drc.prevViolation",
        label: "Previous DRC Violation",
        category: "DRC",
        keybinding: "Shift+F8",
        execute: () => useDrcStore.getState().prevViolation(),
      },
      {
        id: "drc.toggleOverlay",
        label: "Toggle DRC Overlay",
        category: "DRC",
        execute: () => useDrcStore.getState().toggleOverlay(),
      },

      // ── Simulation commands ──
      {
        id: "sim.extractNetlist",
        label: "Extract SPICE Netlist",
        category: "Simulation",
        execute: () => {
          const simStore = useSimStore.getState();
          simStore.appendTerminalLine("> Extracting SPICE netlist...");
          simStore.setState("extracting");

          // Request geometries from canvas for extraction
          const event = new CustomEvent("opensilicon:request-netlist");
          window.dispatchEvent(event);
        },
      },
      {
        id: "sim.runSimulation",
        label: "Run Simulation (ngspice)",
        category: "Simulation",
        keybinding: "F5",
        execute: () => {
          const simStore = useSimStore.getState();
          simStore.appendTerminalLine("> Starting simulation...");
          simStore.setState("running");

          // Demo: generate waveform after a delay
          setTimeout(() => {
            simStore.generateDemoWaveform();
            simStore.appendTerminalLine("  Simulation complete. Waveform generated.");
            simStore.setState("completed");
          }, 500);
        },
      },
      {
        id: "sim.showWaveform",
        label: "Show Waveform Viewer",
        category: "Simulation",
        execute: () => {
          useWorkspaceStore.getState().toggleBottomPanel();
          useSimStore.getState().setActiveTab("waveform");
        },
      },
      {
        id: "sim.showNetlist",
        label: "Show Netlist",
        category: "Simulation",
        execute: () => {
          useWorkspaceStore.getState().toggleBottomPanel();
          useSimStore.getState().setActiveTab("netlist");
        },
      },

      // ── PDK commands ──
      {
        id: "pdk.showInfo",
        label: "Show PDK Info",
        category: "PDK",
        execute: () => {
          const pdk = usePluginStore.getState().getActivePdk();
          if (pdk) {
            const simStore = useSimStore.getState();
            simStore.appendTerminalLine(`> Active PDK: ${pdk.name} (${pdk.foundry} ${pdk.node})`);
            simStore.appendTerminalLine(`  Metal layers: ${pdk.metalLayers}, Mfg grid: ${pdk.manufacturingGrid}µm`);
            simStore.appendTerminalLine(`  Design rules: ${pdk.designRules.length}, Tech layers: ${pdk.layers.length}`);
          }
        },
      },
      {
        id: "pdk.showDesignRules",
        label: "Show Design Rules",
        category: "PDK",
        execute: () => {
          const rules = usePluginStore.getState().getActiveDesignRules();
          const simStore = useSimStore.getState();
          simStore.appendTerminalLine(`> Design Rules (${rules.length} total):`);
          for (const r of rules.slice(0, 10)) {
            simStore.appendTerminalLine(`  ${r.id}: ${r.description} = ${r.value}µm [${r.type}]`);
          }
          if (rules.length > 10) {
            simStore.appendTerminalLine(`  ... and ${rules.length - 10} more`);
          }
        },
      },

      // ── View extras ──
      {
        id: "view.showProperties",
        label: "Show Properties Panel",
        category: "View",
        execute: () => {
          const ws = useWorkspaceStore.getState();
          ws.toggleRightSidebar();
        },
      },
      {
        id: "view.showDrc",
        label: "Show DRC Panel",
        category: "View",
        execute: () => {
          const ws = useWorkspaceStore.getState();
          if (!ws.rightSidebarVisible) ws.toggleRightSidebar();
        },
      },

      // ── Schematic commands ──
      {
        id: "file.newSchematic",
        label: "New Schematic",
        category: "File",
        execute: () => {
          const id = `schematic-${Date.now()}`;
          addTab({
            id,
            title: "Untitled Schematic",
            type: "schematic",
            modified: false,
          });
        },
      },
      {
        id: "schematic.loadDemo",
        label: "Load Demo Schematic (CMOS Inverter)",
        category: "Schematic",
        execute: () => {
          useSchematicStore.getState().loadDemoSchematic();
          const id = `schematic-${Date.now()}`;
          addTab({
            id,
            title: "Demo Inverter",
            type: "schematic",
            modified: false,
          });
          useSimStore.getState().appendTerminalLine("> Loaded demo CMOS inverter schematic.");
        },
      },
      {
        id: "view.showGenerators",
        label: "Show Layout Generators",
        category: "View",
        execute: () => setActiveSidebarPanel("generators"),
      },
      {
        id: "view.showCalculators",
        label: "Show Analog Calculators",
        category: "View",
        execute: () => setActiveSidebarPanel("calculators"),
      },
      {
        id: "view.showVerification",
        label: "Show Verification Panel",
        category: "View",
        execute: () => setActiveSidebarPanel("verification"),
      },
      {
        id: "view.showGitIntegration",
        label: "Show Git Integration",
        category: "View",
        execute: () => setActiveSidebarPanel("git-integration"),
      },
      {
        id: "view.showMultiPdk",
        label: "Show Multi-PDK Browser",
        category: "View",
        execute: () => setActiveSidebarPanel("multi-pdk"),
      },
      {
        id: "view.showMonteCarlo",
        label: "Show Monte Carlo Panel",
        category: "View",
        execute: () => setActiveSidebarPanel("monte-carlo"),
      },
      {
        id: "view.showEducation",
        label: "Show Education Mode",
        category: "View",
        execute: () => setActiveSidebarPanel("education"),
      },

      // ── Demo / Debug ──
      {
        id: "layout.loadDemo",
        label: "Load Demo Layout (NMOS)",
        category: "Layout",
        execute: () => {
          useGeometryStore.getState().loadDemo();
          useSimStore.getState().appendTerminalLine("> Loaded demo NMOS layout.");
        },
      },
    ];

    registerCommands(commands);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
