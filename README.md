# OpenSilicon

**The Modern VLSI Layout IDE — "VSCode for Chip Design"**

> A next-generation, open-source VLSI layout IDE designed to bring the extensibility, speed, and developer experience of modern code editors to IC layout design.

## Project Structure

```
opensilicon/
├── apps/
│   └── frontend/              # Tauri + React application
│       ├── src/               # React frontend (TypeScript)
│       │   ├── components/    # UI components (workspace, panels, canvas, etc.)
│       │   ├── engines/       # DRC engine, netlist extraction
│       │   ├── hooks/         # React hooks (commands, keybindings)
│       │   ├── ipc/           # Tauri IPC bridge
│       │   ├── plugins/       # Plugin system & PDK definitions (SKY130)
│       │   ├── stores/        # Zustand state management (8 stores)
│       │   └── styles/        # Global CSS with theming engine
│       └── src-tauri/         # Tauri/Rust backend
│           └── src/           # IPC commands, app state
├── crates/                    # Rust workspace
│   ├── opensilicon-core/      # Layout database, cell hierarchy, geometry, spatial index
│   ├── opensilicon-renderer/  # WebGPU rendering engine (viewport, render data)
│   ├── opensilicon-drc/       # DRC engine (violations, rule checking)
│   └── opensilicon-io/        # File I/O (GDS-II, OASIS, project format)
└── package.json               # Monorepo root
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| App Framework | Tauri 2.x (Rust) |
| Frontend | React 19 + TypeScript |
| State Management | Zustand + Immer |
| Renderer | WebGPU (wgpu-rs) — Canvas2D fallback |
| Layout DB | Custom Rust crate with R-tree spatial index |
| File Formats | GDS-II, OASIS, LEF/DEF (Rust parsers) |

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- Tauri 2 prerequisites: [platform setup guide](https://v2.tauri.app/start/prerequisites/)

### Development

```bash
# Install frontend dependencies
cd apps/frontend && pnpm install

# Run in development mode (Tauri + Vite HMR)
pnpm tauri dev

# Run frontend only (browser mode, no Tauri)
pnpm dev

# Check Rust code
cd crates && cargo check --workspace

# Run Rust tests
cd crates && cargo test --workspace

# Build for production
cd apps/frontend && pnpm tauri build
```

## Phase 1 Status (Core Foundation) ✅

- [x] Tauri app shell with React workspace
- [x] VSCode-like panel system (sidebar, tabs, bottom panel)
- [x] Theming engine (dark/light themes via CSS custom properties)
- [x] Command palette with fuzzy search (Ctrl+Shift+P)
- [x] Keyboard shortcuts system
- [x] Rust layout database with cell hierarchy
- [x] Geometry primitives (rect, polygon, path, via)
- [x] R-tree spatial index for O(log n) queries
- [x] Undo/redo command-pattern journal
- [x] Viewport with zoom/pan and semantic zoom levels
- [x] Canvas2D rendering with grid, layer-aware fill/stroke
- [x] Tauri IPC bridge (project info, cells, viewport, undo/redo)
- [x] Layer palette with SKY130-like layer definitions
- [x] GDS-II binary parser/writer (Rust)
- [x] Full editing tools: rectangle, polygon, path, via
- [x] Tool state machine with grid snapping
- [x] Selection system (click, box-select, multi-select)
- [x] Toolbar UI with active-tool highlighting

## Phase 2 Status (Verification & Integration) ✅

- [x] Plugin system with typed manifests (PluginManifest, PDK, TechLayer, DesignRule)
- [x] SkyWater 130nm PDK (21 tech layers, 6 via definitions, 33 design rules)
- [x] Device generators (NMOS, PMOS, resistor) & 23 standard cell definitions
- [x] Plugin manager store with auto-registration & activation
- [x] DRC engine — 6 rule checker types (min/max/exact width, spacing, area, enclosure)
- [x] DRC store with violation navigation, severity/layer filtering, overlay toggle
- [x] DRC panel UI with violation list, filters, run statistics
- [x] DRC canvas overlay (bounding boxes, X markers, rule labels)
- [x] Netlist extraction engine (transistor detection, parasitic RC, SPICE output)
- [x] Simulation store with waveform data model & demo waveform generator
- [x] Bottom panel: Terminal, Netlist viewer, Simulation controls, Waveform viewer
- [x] Canvas2D waveform renderer (time grid, signal tracks, auto-scaled Y axis)
- [x] Properties panel (tool info, PDK info, selection details)
- [x] All commands wired to stores (DRC, sim, tool activation, PDK info)
- [x] StatusBar — live PDK name, DRC error count, active tool, sim state
- [x] TypeScript compiles with zero errors

## Phase 3 Status (Schematic Capture) ✅

> Phase C / V3: Schematic canvas, symbol placement, wire routing, subcircuit navigation

- [x] Schematic Canvas with symbol placement and wire routing
- [x] Schematic store with component/wire/net/pin data model
- [x] LVS (Layout vs Schematic) verification engine
- [x] Cross-probing between layout and schematic

## Phase 4 Status (Simulation — Phase D) ✅

> V4: ngspice WASM integration, netlist handoff, transient/DC/AC analysis, waveform plotting

- [x] SPICE netlist parser (`spiceParser.ts`) — parses MOSFET/R/C/L/V/I devices, .model, .subckt, .tran/.dc/.ac/.op directives, transient sources (PULSE/SIN/PWL/EXP), SI suffixes
- [x] MNA-based circuit solver (`circuitSolver.ts`) — DC operating point (Newton-Raphson), transient (backward Euler), DC sweep, AC small-signal (complex MNA), MOSFET Level-1 Shichman-Hodge model
- [x] ngspice WASM engine wrapper (`ngspiceEngine.ts`) — WASM loader with built-in solver fallback, abort support, demo netlist generators (inverter, NAND, amplifier, DC sweep)
- [x] ngspice raw output parser (`rawParser.ts`) — ASCII raw format parsing, measurement extraction, simulation report formatting
- [x] Simulation store enhancements — analysis config (OP/tran/DC/AC), engine backend selection, progress tracking, simulation history, async run/abort
- [x] Simulation Setup sidebar panel — analysis type tabs, parameter inputs, demo circuit quick-load, SPICE netlist editor, run/abort controls, progress bar, result summary, simulation history
- [x] Bottom panel simulation tab — engine status display, progress bar, run/abort buttons, OP point result table
- [x] Activity bar simulation icon + sidebar wiring
- [x] Full command registration — `sim.runSimulation` (F5), `sim.abortSimulation` (Shift+F5), analysis type commands, demo circuit loaders, `sim.showSetupPanel`

## Phase 5 Status (Schematic-Layout Sync — V5) ✅

> V5: Bi-directional schematic ↔ layout mapping, LVS checking, parasitic extraction feedback

- [x] Bi-directional sync engine (`engines/schematicLayoutSync.ts`) — name-based + LVS-enhanced device matching, parameter delta comparison (5% tolerance), sync action generation, back-annotation from extracted parasitics, auto-placement suggestions for missing layout devices
- [x] Sync store (`stores/syncStore.ts`) — sync state management, accept/reject individual sync actions, auto-sync toggle, direction control (bidirectional, S→L, L→S), back-annotation apply workflow, action history tracking
- [x] Sync panel UI (`components/panels/SchematicLayoutSyncPanel.tsx`) — run sync / demo / clear controls, summary grid (synced/mismatch/missing counts), mapping list with status icons, parameter delta detail view, sync action accept/reject workflow, back-annotation parasitic summaries
- [x] Activity bar sync icon (ArrowLeftRight) + sidebar wiring
- [x] Command registration — `sync.runSync`, `sync.runDemoSync`, `sync.backAnnotate`, `sync.toggleAutoSync`, `sync.showPanel`

## Phase 6 Status (Standard Cell Library Browser — V6) ✅

> V6: SKY130 HD import, cell viewer, search, place from library

- [x] Cell library store (`stores/cellLibraryStore.ts`) — library cell model with category/drive-strength/area/transistor-count/pins, search/filter/sort, favorites & recently-used, place-from-library workflow, PDK cell import pipeline
- [x] SKY130 HD cell library data (`plugins/sky130CellLibrary.ts`) — 85+ standard cells with multiple drive strengths: inverters, buffers, clock buffers, NAND/NOR/AND/OR/XOR/XNOR gates (2/3/4-input), MUX (2/4), AOI/OAI compound gates, full adders, half adders, D flip-flops with reset/set, latches, tri-state buffers, filler/tap/decap cells
- [x] Cell library browser panel (`components/panels/CellLibraryBrowserPanel.tsx`) — search input, category & drive-strength filters, sort (name/area/drive/transistors), grid/list/compact view modes, favorites & recently-used quick filters, cell card with double-click-to-place
- [x] Cell preview with Canvas2D visualization — PMOS/NMOS regions, VDD/VSS power rails, pin positions with direction-colored indicators (input=green, output=red, power=yellow), cell dimensions & stats
- [x] Place-from-library workflow — registers cell in CellStore, places instance at origin, adds geometries to layout, terminal feedback
- [x] Activity bar cell library icon (Library) + sidebar wiring
- [x] Command registration — `cellLib.showBrowser`, `cellLib.loadSky130`, `cellLib.searchCells`

## License

Apache-2.0