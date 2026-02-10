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
import { useHdlStore } from "../stores/hdlStore";
import {
  generateDemoNetlist,
  generateNandNetlist,
  generateAmplifierNetlist,
  generateDcSweepNetlist,
} from "../engines/ngspiceEngine";
import {
  showOpenDialog,
  showSaveDialog,
  openGdsFile,
  saveGdsFile,
  openProjectJson,
  saveProjectJson,
  exportAllGeometries,
  importAllGeometries,
  setCurrentFile,
  getCurrentFile,
  type FlatGeometry,
} from "../ipc/bridge";

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
          (async () => {
            try {
              const path = await showOpenDialog([
                { name: "All Supported", extensions: ["gds", "gds2", "json", "osproj"] },
                { name: "GDS-II", extensions: ["gds", "gds2"] },
                { name: "OpenSilicon Project", extensions: ["json", "osproj"] },
              ]);
              if (!path) return;

              const isGds = /\.(gds2?)$/i.test(path);
              const terminal = useSimStore.getState().appendTerminalLine;

              if (isGds) {
                // Open in Rust → export flat geometries → load into frontend store
                await openGdsFile(path);
                const geoms = await exportAllGeometries();
                useGeometryStore.getState().load(
                  geoms as import("../stores/geometryStore").CanvasGeometry[],
                  path.split(/[\\/]/).pop() ?? "GDS Design",
                );
                await setCurrentFile(path, "gds");
                terminal(`> Opened GDS: ${path}`);
              } else {
                // JSON project — try Rust first, then fallback for browser-only JSON
                try {
                  await openProjectJson(path);
                  const geoms = await exportAllGeometries();
                  useGeometryStore.getState().load(
                    geoms as import("../stores/geometryStore").CanvasGeometry[],
                    path.split(/[\\/]/).pop() ?? "Project",
                  );
                  await setCurrentFile(path, "json");
                  terminal(`> Opened project: ${path}`);
                } catch {
                  // Fallback: browser FileReader for dev mode
                  terminal(`> Rust backend unavailable, using browser file reader.`);
                }
              }
            } catch (err) {
              useSimStore.getState().appendTerminalLine(
                `> Error opening file: ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          })();
        },
      },
      {
        id: "file.save",
        label: "Save",
        category: "File",
        keybinding: "Ctrl+S",
        execute: () => {
          (async () => {
            try {
              const store = useGeometryStore.getState();
              const currentPath = await getCurrentFile();

              if (currentPath) {
                // Re-save to existing path — sync frontend → Rust → disk
                const geoms = store.geometries as FlatGeometry[];
                await importAllGeometries(geoms, store.projectName);
                const isGds = /\.(gds2?)$/i.test(currentPath);
                if (isGds) {
                  await saveGdsFile(currentPath);
                } else {
                  await saveProjectJson(currentPath);
                }
                store.markSaved();
                useSimStore.getState().appendTerminalLine(`> Saved: ${currentPath}`);
              } else {
                // No current file — trigger Save As
                useCommandStore.getState().executeCommand("file.saveAs");
              }
            } catch (err) {
              useSimStore.getState().appendTerminalLine(
                `> Error saving: ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          })();
        },
      },
      {
        id: "file.saveAs",
        label: "Save As...",
        category: "File",
        keybinding: "Ctrl+Shift+S",
        execute: () => {
          (async () => {
            try {
              const store = useGeometryStore.getState();
              const defaultName = store.projectName.replace(/\s+/g, "_");
              const path = await showSaveDialog(defaultName, [
                { name: "OpenSilicon Project", extensions: ["json"] },
                { name: "GDS-II", extensions: ["gds"] },
              ]);
              if (!path) return;

              // Sync frontend → Rust
              const geoms = store.geometries as FlatGeometry[];
              await importAllGeometries(geoms, store.projectName);

              const isGds = /\.(gds2?)$/i.test(path);
              if (isGds) {
                await saveGdsFile(path);
                await setCurrentFile(path, "gds");
              } else {
                await saveProjectJson(path);
                await setCurrentFile(path, "json");
              }
              store.markSaved();
              useSimStore.getState().appendTerminalLine(`> Saved: ${path}`);
            } catch (err) {
              useSimStore.getState().appendTerminalLine(
                `> Error saving: ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          })();
        },
      },
      {
        id: "file.exportGds",
        label: "Export as GDS-II...",
        category: "File",
        execute: () => {
          (async () => {
            try {
              const store = useGeometryStore.getState();
              const defaultName = (store.projectName || "design").replace(/\s+/g, "_");
              const path = await showSaveDialog(defaultName, [
                { name: "GDS-II", extensions: ["gds"] },
              ]);
              if (!path) return;

              const geoms = store.geometries as FlatGeometry[];
              await importAllGeometries(geoms, store.projectName);
              await saveGdsFile(path);
              useSimStore.getState().appendTerminalLine(`> Exported GDS-II: ${path}`);
            } catch (err) {
              useSimStore.getState().appendTerminalLine(
                `> Error exporting GDS: ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          })();
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

      // ── Simulation commands (Phase D) ──
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
        label: "Run Simulation",
        category: "Simulation",
        keybinding: "F5",
        execute: async () => {
          const simStore = useSimStore.getState();
          simStore.appendTerminalLine("> Starting simulation...");
          try {
            await simStore.runSimulation();
            simStore.appendTerminalLine("  Simulation complete.");
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            simStore.appendTerminalLine(`  Simulation failed: ${msg}`);
          }
        },
      },
      {
        id: "sim.abortSimulation",
        label: "Abort Simulation",
        category: "Simulation",
        keybinding: "Shift+F5",
        execute: () => {
          useSimStore.getState().abortSimulation();
          useSimStore.getState().appendTerminalLine("> Simulation aborted.");
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
      {
        id: "sim.showSimTab",
        label: "Show Simulation Tab",
        category: "Simulation",
        execute: () => {
          useWorkspaceStore.getState().toggleBottomPanel();
          useSimStore.getState().setActiveTab("simulation");
        },
      },
      {
        id: "sim.showSetupPanel",
        label: "Show Simulation Setup",
        category: "Simulation",
        execute: () => {
          useWorkspaceStore.getState().setActiveSidebarPanel("simulation");
        },
      },
      {
        id: "sim.setAnalysisOp",
        label: "Set Analysis: Operating Point",
        category: "Simulation",
        execute: () => useSimStore.getState().setAnalysisType("op"),
      },
      {
        id: "sim.setAnalysisTran",
        label: "Set Analysis: Transient",
        category: "Simulation",
        execute: () => useSimStore.getState().setAnalysisType("tran"),
      },
      {
        id: "sim.setAnalysisDc",
        label: "Set Analysis: DC Sweep",
        category: "Simulation",
        execute: () => useSimStore.getState().setAnalysisType("dc"),
      },
      {
        id: "sim.setAnalysisAc",
        label: "Set Analysis: AC Analysis",
        category: "Simulation",
        execute: () => useSimStore.getState().setAnalysisType("ac"),
      },
      {
        id: "sim.loadDemoInverter",
        label: "Load Demo: CMOS Inverter",
        category: "Simulation",
        execute: () => {
          useSimStore.getState().setSpiceNetlistText(generateDemoNetlist());
          useSimStore.getState().appendTerminalLine("> Loaded CMOS inverter demo netlist.");
        },
      },
      {
        id: "sim.loadDemoNand",
        label: "Load Demo: CMOS NAND Gate",
        category: "Simulation",
        execute: () => {
          useSimStore.getState().setSpiceNetlistText(generateNandNetlist());
          useSimStore.getState().appendTerminalLine("> Loaded CMOS NAND gate demo netlist.");
        },
      },
      {
        id: "sim.loadDemoAmplifier",
        label: "Load Demo: Common-Source Amplifier",
        category: "Simulation",
        execute: () => {
          useSimStore.getState().setSpiceNetlistText(generateAmplifierNetlist());
          useSimStore.getState().appendTerminalLine("> Loaded common-source amplifier demo netlist.");
        },
      },
      {
        id: "sim.loadDemoDcSweep",
        label: "Load Demo: DC Sweep",
        category: "Simulation",
        execute: () => {
          useSimStore.getState().setSpiceNetlistText(generateDcSweepNetlist());
          useSimStore.getState().appendTerminalLine("> Loaded DC sweep demo netlist.");
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
        id: "view.showTransistors",
        label: "Show Transistor Generator",
        category: "View",
        execute: () => setActiveSidebarPanel("transistors"),
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
      {
        id: "view.showAiAssistant",
        label: "Show AI Assistant",
        category: "View",
        execute: () => setActiveSidebarPanel("ai-assistant"),
      },
      {
        id: "view.showAdvancedAnalysis",
        label: "Show Advanced Analysis",
        category: "View",
        execute: () => setActiveSidebarPanel("advanced-analysis"),
      },
      {
        id: "view.showCollaboration",
        label: "Show Collaboration",
        category: "View",
        execute: () => setActiveSidebarPanel("collaboration"),
      },
      {
        id: "view.showCommunity",
        label: "Show Community",
        category: "View",
        execute: () => setActiveSidebarPanel("community"),
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

      // ── V5: Schematic ↔ Layout Sync ──
      {
        id: "sync.showPanel",
        label: "Show Schematic-Layout Sync",
        category: "View",
        execute: () => setActiveSidebarPanel("sync"),
      },
      {
        id: "sync.runSync",
        label: "Run Schematic-Layout Sync",
        category: "Sync",
        execute: () => {
          import("../stores/syncStore").then(({ useSyncStore }) => {
            useSyncStore.getState().runSync();
          });
        },
      },
      {
        id: "sync.runDemoSync",
        label: "Run Demo Sync",
        category: "Sync",
        execute: () => {
          import("../stores/syncStore").then(({ useSyncStore }) => {
            useSyncStore.getState().runDemoSync();
          });
        },
      },
      {
        id: "sync.backAnnotate",
        label: "Back-Annotate Parasitics",
        category: "Sync",
        execute: () => {
          import("../stores/syncStore").then(({ useSyncStore }) => {
            import("../engines/netlist").then(({ extractNetlist }) => {
              import("../plugins/sky130").then(({ sky130Plugin, sky130Layers }) => {
                const geoms = useGeometryStore.getState().geometries;
                const pdk = sky130Plugin.contributes.pdk!;
                // Convert CanvasGeometry[] → NetlistGeometry[]
                const nlGeoms = geoms.map((g, i) => {
                  const xs = g.points.map((p) => p.x);
                  const ys = g.points.map((p) => p.y);
                  const layer = sky130Layers.find((l) => l.gdsLayer === g.layerId);
                  return {
                    index: i,
                    type: g.type as "rect" | "polygon" | "path" | "via",
                    layerAlias: layer?.alias ?? "UNK",
                    bbox: { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) },
                    points: g.points,
                    width: g.width,
                  };
                });
                const extraction = extractNetlist(nlGeoms, pdk);
                useSyncStore.getState().backAnnotate(extraction);
              });
            });
          });
        },
      },
      {
        id: "sync.toggleAutoSync",
        label: "Toggle Auto-Sync",
        category: "Sync",
        execute: () => {
          import("../stores/syncStore").then(({ useSyncStore }) => {
            useSyncStore.getState().toggleAutoSync();
          });
        },
      },

      // ── V6: Cell Library Browser ──
      {
        id: "cellLib.showBrowser",
        label: "Show Cell Library Browser",
        category: "View",
        execute: () => setActiveSidebarPanel("cell-library"),
      },
      {
        id: "cellLib.loadSky130",
        label: "Load SKY130 HD Library",
        category: "Cell Library",
        execute: () => {
          import("../stores/cellLibraryStore").then(({ useCellLibraryStore }) => {
            useCellLibraryStore.getState().loadSky130Hd();
            useSimStore.getState().appendTerminalLine("> Loaded SKY130 HD standard cell library.");
          });
        },
      },
      {
        id: "cellLib.searchCells",
        label: "Search Cell Library",
        category: "Cell Library",
        execute: () => {
          setActiveSidebarPanel("cell-library");
        },
      },

      // ── HDL commands ──
      {
        id: "hdl.newVerilog",
        label: "New Verilog File",
        category: "HDL",
        execute: () => {
          import("../stores/hdlStore").then(({ useHdlStore }) => {
            useHdlStore.getState().newFile("verilog");
            const id = `hdl-${Date.now()}`;
            addTab({ id, title: "HDL Editor", type: "hdl", modified: false });
            setActiveSidebarPanel("hdl");
          });
        },
      },
      {
        id: "hdl.newSystemVerilog",
        label: "New SystemVerilog File",
        category: "HDL",
        execute: () => {
          import("../stores/hdlStore").then(({ useHdlStore }) => {
            useHdlStore.getState().newFile("systemverilog");
            const id = `hdl-${Date.now()}`;
            addTab({ id, title: "HDL Editor", type: "hdl", modified: false });
            setActiveSidebarPanel("hdl");
          });
        },
      },
      {
        id: "hdl.newVhdl",
        label: "New VHDL File",
        category: "HDL",
        execute: () => {
          import("../stores/hdlStore").then(({ useHdlStore }) => {
            useHdlStore.getState().newFile("vhdl");
            const id = `hdl-${Date.now()}`;
            addTab({ id, title: "HDL Editor", type: "hdl", modified: false });
            setActiveSidebarPanel("hdl");
          });
        },
      },
      {
        id: "hdl.showPanel",
        label: "Show HDL Panel",
        category: "HDL",
        execute: () => setActiveSidebarPanel("hdl"),
      },
      {
        id: "hdl.openEditor",
        label: "Open HDL Editor",
        category: "HDL",
        execute: () => {
          const id = `hdl-${Date.now()}`;
          addTab({ id, title: "HDL Editor", type: "hdl", modified: false });
        },
      },
      {
        id: "hdl.parseActive",
        label: "Parse Active HDL File",
        category: "HDL",
        execute: () => {
          Promise.all([
            import("../stores/hdlStore"),
            import("../engines/hdlParser"),
          ]).then(([{ useHdlStore }, { parseHdl, lintHdl }]) => {
            const store = useHdlStore.getState();
            const file = store.getActiveFile();
            if (!file) return;
            const result = parseHdl(file.content, file.filename);
            store.setParseResult(file.id, result);
            const diags = [...result.diagnostics, ...lintHdl(result, file.content)];
            store.setDiagnostics(file.id, diags);
            store.appendConsole(`Parsed ${file.filename}: ${result.modules.length} module(s), ${diags.length} diagnostic(s)`);
          });
        },
      },
      {
        id: "hdl.generateNetlist",
        label: "Generate Verilog Netlist from HDL",
        category: "HDL",
        execute: () => {
          Promise.all([
            import("../stores/hdlStore"),
            import("../engines/hdlElaborator"),
          ]).then(([{ useHdlStore }, { generateVerilogNetlist }]) => {
            const store = useHdlStore.getState();
            const modules = store.getAllModules();
            if (modules.length === 0) {
              store.appendConsole("No modules parsed — parse files first.");
              return;
            }
            const netlist = generateVerilogNetlist(modules);
            store.appendConsole("── Generated Structural Netlist ──");
            store.appendConsole(netlist);
          });
        },
      },
      {
        id: "hdl.generateSpice",
        label: "Generate SPICE Netlist from HDL",
        category: "HDL",
        execute: () => {
          Promise.all([
            import("../stores/hdlStore"),
            import("../engines/hdlElaborator"),
          ]).then(([{ useHdlStore }, { generateSpiceFromHdl }]) => {
            const store = useHdlStore.getState();
            const modules = store.getAllModules();
            if (modules.length === 0) {
              store.appendConsole("No modules parsed — parse files first.");
              return;
            }
            const spice = generateSpiceFromHdl(modules);
            store.appendConsole("── Generated SPICE Netlist ──");
            store.appendConsole(spice);
          });
        },
      },
      {
        id: "hdl.elaborate",
        label: "Elaborate HDL Hierarchy",
        category: "HDL",
        execute: () => {
          Promise.all([
            import("../stores/hdlStore"),
            import("../engines/hdlElaborator"),
          ]).then(([{ useHdlStore }, { elaborateHierarchy }]) => {
            const store = useHdlStore.getState();
            const modules = store.getAllModules();
            if (modules.length === 0) {
              store.appendConsole("No modules parsed — parse files first.");
              return;
            }
            const result = elaborateHierarchy(modules);
            store.appendConsole(`Elaborated "${result.topModule}": ${result.totalNets} nets, ${result.totalInstances} instances, depth ${result.hierarchyDepth} (${result.elaborationTimeMs.toFixed(1)}ms)`);
          });
        },
      },

      // ── Tier 1: File Explorer ──
      {
        id: "fileExplorer.show",
        label: "Show File Explorer",
        category: "View",
        keybinding: "Ctrl+Shift+F",
        execute: () => setActiveSidebarPanel("file-explorer"),
      },

      // ── Tier 1: Search ──
      {
        id: "search.show",
        label: "Search in Files",
        category: "Search",
        keybinding: "Ctrl+Shift+H",
        execute: () => setActiveSidebarPanel("search"),
      },

      // ── Tier 1: Problems ──
      {
        id: "problems.show",
        label: "Show Problems Panel",
        category: "View",
        keybinding: "Ctrl+Shift+M",
        execute: () => {
          useSimStore.getState().setActiveTab("problems");
          const ws = useWorkspaceStore.getState();
          if (!ws.bottomPanelVisible) ws.toggleBottomPanel();
        },
      },

      // ── Tier 1: Terminal ──
      {
        id: "terminal.show",
        label: "Show Terminal",
        category: "View",
        keybinding: "Ctrl+`",
        execute: () => {
          useSimStore.getState().setActiveTab("terminal");
          const ws = useWorkspaceStore.getState();
          if (!ws.bottomPanelVisible) ws.toggleBottomPanel();
        },
      },

      // ── Tier 1: Waveform Viewer ──
      {
        id: "waveform.openDemo",
        label: "Open Demo Waveform (VCD)",
        category: "Waveform",
        execute: () => {
          addTab({
            id: "waveform-vcd-demo",
            title: "Demo Waveform",
            type: "waveform-vcd",
            modified: false,
          });
        },
      },
      {
        id: "waveform.showPanel",
        label: "Show Waveform Panel",
        category: "Waveform",
        execute: () => {
          useSimStore.getState().setActiveTab("waveform");
          const ws = useWorkspaceStore.getState();
          if (!ws.bottomPanelVisible) ws.toggleBottomPanel();
        },
      },

      // ── Tier 1: HDL Testbench Generator ──
      {
        id: "hdl.generateTestbench",
        label: "Generate Testbench for Current Module",
        category: "HDL",
        execute: () => {
          import("../engines/hdlNavigator").then(({ generateTestbench }) => {
            const store = useHdlStore.getState();
            const modules = store.getAllModules();
            if (modules.length === 0) {
              store.appendConsole("No modules found — parse a HDL file first.");
              return;
            }
            const mod = modules[0];
            const lang = store.files.values().next().value?.language ?? "verilog";
            const tb = generateTestbench(mod, lang as "verilog" | "systemverilog" | "vhdl");
            const id = store.newFile(lang as any);
            store.updateContent(id, tb);
            store.appendConsole(`Generated testbench for '${mod.name}'`);
          });
        },
      },

      // ── Tier 2: Settings, Outline, Snippets, Build, Split ──
      {
        id: "preferences.open",
        label: "Open Settings",
        category: "Preferences",
        keybinding: "Ctrl+,",
        execute: () => {
          const ws = useWorkspaceStore.getState();
          ws.setActiveSidebarPanel("preferences");
        },
      },
      {
        id: "outline.show",
        label: "Show Outline",
        category: "Navigation",
        execute: () => {
          const ws = useWorkspaceStore.getState();
          ws.setActiveSidebarPanel("outline");
        },
      },
      {
        id: "snippets.show",
        label: "Show Snippets",
        category: "Snippets",
        execute: () => {
          const ws = useWorkspaceStore.getState();
          ws.setActiveSidebarPanel("snippets");
        },
      },
      {
        id: "build.show",
        label: "Show Build Tasks",
        category: "Build",
        execute: () => {
          const ws = useWorkspaceStore.getState();
          ws.setActiveSidebarPanel("build");
        },
      },
      {
        id: "editor.splitRight",
        label: "Split Editor Right",
        category: "Editor",
        keybinding: "Ctrl+\\",
        execute: () => {
          // Handled via UI — this is for command palette discoverability
        },
      },
      {
        id: "editor.foldAll",
        label: "Fold All Regions",
        category: "Editor",
        keybinding: "Ctrl+K Ctrl+0",
        execute: () => {
          // Fold all — handled in HdlEditor component
        },
      },
      {
        id: "editor.unfoldAll",
        label: "Unfold All Regions",
        category: "Editor",
        keybinding: "Ctrl+K Ctrl+J",
        execute: () => {
          // Unfold all — handled in HdlEditor component
        },
      },
      {
        id: "settings.resetAll",
        label: "Reset All Settings to Defaults",
        category: "Preferences",
        execute: () => {
          import("../stores/settingsStore").then(({ useSettingsStore }) => {
            useSettingsStore.getState().resetAllDefaults();
          });
        },
      },

      /* ─── Tier 3 ─────────────────────────────────────────────── */

      {
        id: "editor.find",
        label: "Find",
        category: "Editor",
        keybinding: "Ctrl+F",
        execute: () => {
          // Handled in HdlEditor — Ctrl+F opens find widget
        },
      },
      {
        id: "editor.findAndReplace",
        label: "Find and Replace",
        category: "Editor",
        keybinding: "Ctrl+H",
        execute: () => {
          // Handled in HdlEditor — Ctrl+H opens find+replace widget
        },
      },
      {
        id: "editor.goToLine",
        label: "Go to Line…",
        category: "Editor",
        keybinding: "Ctrl+G",
        execute: () => {
          // Handled in HdlEditor — Ctrl+G opens go-to-line dialog
        },
      },
      {
        id: "editor.peekDefinition",
        label: "Peek Definition",
        category: "Editor",
        keybinding: "Alt+F12",
        execute: () => {
          // Handled in HdlEditor — Alt+F12 opens peek panel
        },
      },
      {
        id: "editor.renameSymbol",
        label: "Rename Symbol",
        category: "Editor",
        keybinding: "F2",
        execute: () => {
          // Handled in HdlEditor — F2 opens rename dialog
        },
      },
      {
        id: "editor.addNextOccurrence",
        label: "Add Next Occurrence to Selection",
        category: "Editor",
        keybinding: "Ctrl+D",
        execute: () => {
          // Handled in HdlEditor — Ctrl+D adds multi-cursor
        },
      },
      {
        id: "diff.compareFiles",
        label: "Compare Two Files (Diff)",
        category: "Diff",
        execute: () => {
          import("../stores/workspaceStore").then(({ useWorkspaceStore }) => {
            const ws = useWorkspaceStore.getState();
            const existing = ws.tabs.find((t) => t.type === "diff");
            if (existing) {
              ws.setActiveTab(existing.id);
            } else {
              ws.addTab({ id: "diff-editor", title: "Compare Files", type: "diff", modified: false });
              ws.setActiveTab("diff-editor");
            }
          });
        },
      },
      {
        id: "notifications.toggle",
        label: "Toggle Notification Center",
        category: "View",
        execute: () => {
          import("../stores/notificationStore").then(({ useNotificationStore }) => {
            useNotificationStore.getState().toggleOpen();
          });
        },
      },
      {
        id: "notifications.clearAll",
        label: "Clear All Notifications",
        category: "View",
        execute: () => {
          import("../stores/notificationStore").then(({ useNotificationStore }) => {
            useNotificationStore.getState().clearAll();
          });
        },
      },

      /* ─── Project ─────────────────────────────────────────────── */

      {
        id: "project.new",
        label: "New Project…",
        category: "Project",
        keybinding: "Ctrl+Shift+N",
        execute: () => {
          import("../stores/projectTemplateStore").then(({ useProjectTemplateStore }) => {
            useProjectTemplateStore.getState().openWizard();
          });
        },
      },

      /* ─── Board / Hardware Integration ──────────────────────────── */

      {
        id: "board.openManager",
        label: "Open Board Manager",
        category: "Board",
        execute: () => {
          const ws = useWorkspaceStore.getState();
          ws.setActiveSidebarPanel("board-manager");
          if (!ws.leftSidebarVisible) ws.toggleLeftSidebar();
        },
      },
      {
        id: "board.connect",
        label: "Connect to Board",
        category: "Board",
        execute: () => {
          import("../stores/boardStore").then(({ useBoardStore }) => {
            useBoardStore.getState().connect();
          });
        },
      },
      {
        id: "board.disconnect",
        label: "Disconnect from Board",
        category: "Board",
        execute: () => {
          import("../stores/boardStore").then(({ useBoardStore }) => {
            useBoardStore.getState().disconnect();
          });
        },
      },
      {
        id: "board.scanPorts",
        label: "Scan Serial Ports",
        category: "Board",
        execute: () => {
          import("../stores/boardStore").then(({ useBoardStore }) => {
            useBoardStore.getState().scanPorts();
          });
        },
      },
      {
        id: "serial.open",
        label: "Open Serial Monitor",
        category: "Board",
        execute: () => {
          import("../stores/simStore").then(({ useSimStore }) => {
            useSimStore.getState().setActiveTab("serial" as never);
            const ws = useWorkspaceStore.getState();
            if (!ws.bottomPanelVisible) ws.toggleBottomPanel();
          });
        },
      },
      {
        id: "flash.openProgrammer",
        label: "Open Flash / Programmer",
        category: "Board",
        execute: () => {
          import("../stores/simStore").then(({ useSimStore }) => {
            useSimStore.getState().setActiveTab("flash" as never);
            const ws = useWorkspaceStore.getState();
            if (!ws.bottomPanelVisible) ws.toggleBottomPanel();
          });
        },
      },
      {
        id: "flash.start",
        label: "Flash Firmware to Board",
        category: "Board",
        keybinding: "Ctrl+Shift+F",
        execute: () => {
          import("../stores/boardStore").then(({ useBoardStore }) => {
            useBoardStore.getState().startFlash();
          });
        },
      },
      {
        id: "debug.startSession",
        label: "Start Debug Session",
        category: "Debug",
        keybinding: "F5",
        execute: () => {
          import("../stores/boardStore").then(({ useBoardStore }) => {
            useBoardStore.getState().startDebugSession();
            import("../stores/simStore").then(({ useSimStore }) => {
              useSimStore.getState().setActiveTab("debug" as never);
              const ws = useWorkspaceStore.getState();
              if (!ws.bottomPanelVisible) ws.toggleBottomPanel();
            });
          });
        },
      },
      {
        id: "debug.stopSession",
        label: "Stop Debug Session",
        category: "Debug",
        keybinding: "Shift+F5",
        execute: () => {
          import("../stores/boardStore").then(({ useBoardStore }) => {
            useBoardStore.getState().stopDebugSession();
          });
        },
      },
      {
        id: "debug.continue",
        label: "Continue",
        category: "Debug",
        execute: () => {
          import("../stores/boardStore").then(({ useBoardStore }) => {
            useBoardStore.getState().debugContinue();
          });
        },
      },
      {
        id: "debug.stepOver",
        label: "Step Over",
        category: "Debug",
        keybinding: "F10",
        execute: () => {
          import("../stores/boardStore").then(({ useBoardStore }) => {
            useBoardStore.getState().debugStepOver();
          });
        },
      },
      {
        id: "debug.stepInto",
        label: "Step Into",
        category: "Debug",
        keybinding: "F11",
        execute: () => {
          import("../stores/boardStore").then(({ useBoardStore }) => {
            useBoardStore.getState().debugStepInto();
          });
        },
      },
      {
        id: "debug.stepOut",
        label: "Step Out",
        category: "Debug",
        keybinding: "Shift+F11",
        execute: () => {
          import("../stores/boardStore").then(({ useBoardStore }) => {
            useBoardStore.getState().debugStepOut();
          });
        },
      },
      {
        id: "debug.pause",
        label: "Pause Execution",
        category: "Debug",
        keybinding: "F6",
        execute: () => {
          import("../stores/boardStore").then(({ useBoardStore }) => {
            useBoardStore.getState().debugPause();
          });
        },
      },
    ];

    registerCommands(commands);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
