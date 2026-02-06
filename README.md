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

## License

Apache-2.0