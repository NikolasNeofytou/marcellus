# OpenSilicon

[![CI](https://github.com/opensilicon/opensilicon/actions/workflows/ci.yml/badge.svg)](https://github.com/opensilicon/opensilicon/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6.svg)](https://www.typescriptlang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2.x-ffc131.svg)](https://v2.tauri.app/)

**The Modern VLSI Layout IDE — "VSCode for Chip Design"**

> A next-generation, open-source VLSI layout IDE designed to bring the extensibility, speed, and developer experience of modern code editors to IC layout design.

<!-- TODO: Replace with actual screenshot -->
<p align="center">
  <img src="docs/screenshot-placeholder.png" alt="OpenSilicon IDE screenshot" width="800" />
</p>

> [!IMPORTANT]
> **Feature Maturity Notice** — OpenSilicon is an early-stage project. Features marked ✅ below have working frontend implementations, but some carry caveats (noted inline). Features marked ⚠️ are **UI shells / prototypes** — the panels render and the stores hold state, but they rely on demo data or heuristic stubs rather than production backends. See the [Feature Maturity](#feature-maturity) section for a full breakdown.

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
│       │   ├── stores/        # Zustand state management (27+ stores)
│       │   ├── utils/         # Structured logger, grid snap
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
| Frontend | React 19 + TypeScript 5.7 |
| State Management | Zustand 5 + Immer |
| Bundler | Vite 6 |
| Renderer | Canvas2D (default) — WebGPU renderer available with auto-fallback |
| Compute | Web Workers for DRC, LVS, netlist extraction, simulation |
| Layout DB | Custom Rust crate with R-tree spatial index |
| File Formats | GDS-II, OASIS, LEF/DEF (Rust parsers) |
| Tests | Vitest 3 |

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (stable)
- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) 9+
- Tauri 2 prerequisites: [platform setup guide](https://v2.tauri.app/start/prerequisites/)

### Development

```bash
# 1. Install all dependencies (from monorepo root)
pnpm install

# 2. Run in development mode (Tauri + Vite HMR)
pnpm dev

# 3. Or run frontend only in the browser (no Tauri)
pnpm frontend:dev

# Check Rust code
pnpm rust:check

# Run all tests (frontend unit tests)
pnpm test

# Run Rust tests
pnpm rust:test

# Lint & format
pnpm lint

# Build for production
pnpm build
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

> V4: Built-in MNA solver, netlist handoff, transient/DC/AC analysis, waveform plotting

- [x] SPICE netlist parser (`spiceParser.ts`) — parses MOSFET/R/C/L/V/I devices, .model, .subckt, .tran/.dc/.ac/.op directives, transient sources (PULSE/SIN/PWL/EXP), SI suffixes
- [x] MNA-based circuit solver (`circuitSolver.ts`) — DC operating point (Newton-Raphson), transient (backward Euler), DC sweep, AC small-signal (complex MNA), MOSFET Level-1 Shichman-Hodge model
- [x] ngspice WASM engine wrapper (`ngspiceEngine.ts`) — WASM loader with **built-in solver fallback** *(ngspice WASM binary not yet integrated — all simulation uses the TypeScript MNA solver)*, abort support, demo netlist generators (inverter, NAND, amplifier, DC sweep)
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

## Additional Features

The following features ship as panels and stores but vary in maturity:

| Feature | Panel | Status | Notes |
|---------|-------|--------|-------|
| Version Control | VcsPanel | ✅ **Real** | Full in-memory Git-like VCS (branch, commit, diff, three-way merge). No disk persistence yet. |
| AI Assistant | AiAssistantPanel | ✅ **Real (heuristic)** | Rule-based DRC fix suggestions, regex NL command parser, heuristic design review. No LLM/ML — "AI" is deterministic logic. |
| Git Integration | GitIntegrationPanel | ⚠️ **Partial** | XOR geometry diff and cell-level locking work locally. PR integration uses demo data. |
| Monte Carlo | MonteCarloPanel | ⚠️ **Partial** | Statistical engine (sampling, histograms, yield) is real. Underlying "simulation" generates synthetic waveforms, not real SPICE results. |
| Advanced Analysis | AdvancedAnalysisPanel | ⚠️ **UI Shell** | IR drop, antenna check, noise analysis, stability — all produce synthetic/demo data. Math for Bode plots is correct but inputs are hardcoded. |
| Collaboration | CollaborationPanel | ⚠️ **UI Shell** | Live sharing, chat, CI/CD pipeline, shuttle export — all use hardcoded demo data. No WebSocket/network backend. |
| Marketplace | MarketplacePanel | ⚠️ **UI Shell** | PDK/plugin registry with search & filter UI. Registry is a hardcoded mock array. Install simulated with `setTimeout`. |
| Community | CommunityPanel | ⚠️ **UI Shell** | Snippet sharing, layout templates, contributions — all demo data. No backend or persistence. |
| Education | EducationPanel | ⚠️ **UI Shell** | Tutorial content is well-authored (5 tutorials, 3 labs). Grading uses `Math.random()` — no real validation. |

## Architecture Highlights

### LayoutCanvas Decomposition

The layout canvas (previously a 1,300-line monolith) is split into focused modules:

| Module | Responsibility |
|--------|---------------|
| `hooks/useLayoutViewport.ts` | Viewport state, pan/zoom, coordinate transforms |
| `hooks/useLayoutRenderer.ts` | Canvas2D render pipeline (geometry, DRC overlays, cross-probe) |
| `hooks/useLayoutInput.ts` | Mouse/keyboard interaction, tool state, clipboard |
| `utils/layoutHitTesting.ts` | Pure geometry hit-testing (point-in-polygon, box-select) |
| `components/canvas/LayoutCanvas.tsx` | Thin ~100-line orchestrator |

### Off-Main-Thread Compute

Heavy engines run in Web Workers via a Promise-based pool (`workers/workerPool.ts`):

- `drc.worker.ts` — DRC rule checking
- `lvs.worker.ts` — Layout vs Schematic
- `netlist.worker.ts` — Netlist extraction
- `circuitSolver.worker.ts` — Circuit simulation (with progress callbacks)

### Rendering

- **Canvas2D** — default renderer, fully functional
- **WebGPU** — `engines/webgpuRenderer.ts` provides instanced-quad rendering via WGSL shaders; auto-detects GPU support and falls back to Canvas2D. Both implement the `ILayoutRenderer` interface.

### Test Coverage

Unit tests (`vitest`) cover the core TypeScript engines and stores:

- `__tests__/spiceParser.test.ts` — SPICE number parsing, netlist parsing, transient sources
- `__tests__/circuitSolver.test.ts` — DC operating point, transient, DC sweep, simulation dispatch
- `__tests__/drc.test.ts` — geometry preparation, rule checking, severity filtering
- `__tests__/layoutHitTesting.test.ts` — point-in-polygon, segment distance, hit-testing, box-select
- `__tests__/geometryStore.test.ts` — undo/redo, commit/revert, auto-save persistence
- `__tests__/layerStore.test.ts` — layer visibility, color, selection, active layer
- `__tests__/themeStore.test.ts` — theme switching, persistence, custom properties
- `__tests__/toolStore.test.ts` — tool activation, history, parameter management

```bash
cd apps/frontend && pnpm test
```

## Contributing

Contributions are welcome! Please see our guidelines before getting started:

1. **Fork** the repository and create a feature branch
2. **Install dependencies** — `pnpm install` at the repo root
3. **Run tests** — `pnpm test` (frontend) and `pnpm rust:test` (Rust crates)
4. **Lint & format** — pre-commit hooks run automatically via Husky + lint-staged
5. **Open a PR** with a clear description of what changed and why

Please keep PRs focused — one feature or fix per PR. All CI checks (typecheck, lint, test, Rust clippy) must pass.

## Roadmap

- [ ] Production GDS-II round-trip (read → edit → write)
- [ ] ngspice WASM integration for real SPICE simulation
- [ ] WebGPU renderer as default (Canvas2D fallback preserved)
- [ ] Multi-file project persistence (save/load full projects)
- [ ] Collaboration backend (WebSocket live-share)
- [ ] Plugin marketplace with registry backend
- [ ] PDK packaging format & repository
- [ ] Analog layout automation (common-centroid, interdigitation)
- [ ] P&R integration (OpenROAD interop)
- [ ] Desktop installer packages (MSI, DMG, AppImage)

## License

Apache-2.0