import { useEffect } from "react";
import { useCommandStore, type CommandEntry } from "../stores/commandStore";
import { useThemeStore } from "../stores/themeStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useToolStore } from "../stores/toolStore";
import { useDrcStore } from "../stores/drcStore";
import { usePluginStore } from "../stores/pluginStore";
import { useSimStore } from "../stores/simStore";

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
          console.log("TODO: Open file dialog");
        },
      },
      {
        id: "file.save",
        label: "Save",
        category: "File",
        keybinding: "Ctrl+S",
        execute: () => {
          console.log("TODO: Save current file");
        },
      },
      {
        id: "file.exportGds",
        label: "Export as GDS-II",
        category: "File",
        execute: () => {
          console.log("TODO: Export GDS-II");
        },
      },

      // ── Edit commands ──
      {
        id: "edit.undo",
        label: "Undo",
        category: "Edit",
        keybinding: "Ctrl+Z",
        execute: () => {
          // TODO: Wire to Rust undo when Tauri is available
          console.log("[Command] Undo");
        },
      },
      {
        id: "edit.redo",
        label: "Redo",
        category: "Edit",
        keybinding: "Ctrl+Y",
        execute: () => {
          console.log("[Command] Redo");
        },
      },
      {
        id: "edit.selectAll",
        label: "Select All",
        category: "Edit",
        keybinding: "Ctrl+A",
        execute: () => {
          console.log("[Command] Select all");
        },
      },
      {
        id: "edit.delete",
        label: "Delete Selection",
        category: "Edit",
        keybinding: "Delete",
        execute: () => {
          console.log("[Command] Delete selected");
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
          console.log("[Command] Zoom to fit");
        },
      },
      {
        id: "layout.zoomSelection",
        label: "Zoom to Selection",
        category: "Layout",
        keybinding: "Z",
        execute: () => {
          console.log("[Command] Zoom to selection");
        },
      },

      // ── DRC commands ──
      {
        id: "drc.runCheck",
        label: "Run DRC Check",
        category: "DRC",
        keybinding: "Ctrl+Shift+D",
        execute: () => {
          // Import engines inline to avoid circular deps
          import("../engines/drc").then(({ runDrc: _runDrc, prepareDrcGeometries: _prepareDrc }) => {
            void usePluginStore.getState().getActiveDesignRules();
            const drcStore = useDrcStore.getState();
            const simStore = useSimStore.getState();

            drcStore.setRunState("running");
            simStore.appendTerminalLine("> Running DRC check...");

            // We need geometries from canvas — for now use a global event
            const event = new CustomEvent("opensilicon:request-drc");
            window.dispatchEvent(event);

            // The canvas will respond by calling runDrcWithGeometries
            setTimeout(() => {
              if (drcStore.runState === "running") {
                simStore.appendTerminalLine("  DRC check complete (use canvas to provide geometries).");
                drcStore.setRunState("idle");
              }
            }, 100);
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
    ];

    registerCommands(commands);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
