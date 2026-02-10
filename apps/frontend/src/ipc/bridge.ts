/**
 * Tauri IPC bridge — typed wrappers around Tauri invoke calls.
 * These mirror the #[tauri::command] functions defined in the Rust backend.
 */

// During development without Tauri, we provide mock implementations
const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isTauri) {
    const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
    return tauriInvoke<T>(cmd, args);
  }
  // Mock responses for browser dev mode
  console.log(`[Mock IPC] ${cmd}`, args);
  return {} as T;
}

// ── File Dialogs (Tauri 2 plugin-dialog) ──

export interface DialogFilter {
  name: string;
  extensions: string[];
}

/**
 * Show a native "Open File" dialog. Returns the selected path, or null if cancelled.
 */
export async function showOpenDialog(filters: DialogFilter[]): Promise<string | null> {
  if (!isTauri) {
    console.log("[Mock IPC] showOpenDialog", filters);
    return null;
  }
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({
    multiple: false,
    filters,
  });
  // open() with multiple:false returns string | null
  if (typeof result === "string") return result;
  return null;
}

/**
 * Show a native "Save File" dialog. Returns the selected path, or null if cancelled.
 */
export async function showSaveDialog(
  defaultName: string,
  filters: DialogFilter[],
): Promise<string | null> {
  if (!isTauri) {
    console.log("[Mock IPC] showSaveDialog", defaultName, filters);
    return null;
  }
  const { save } = await import("@tauri-apps/plugin-dialog");
  return save({ defaultPath: defaultName, filters });
}

// ── Project ──

export interface ProjectInfo {
  name: string;
  cell_count: number;
  top_cell: string | null;
}

export async function getProjectInfo(): Promise<ProjectInfo> {
  return invoke<ProjectInfo>("get_project_info");
}

// ── Cells ──

export interface CellInfo {
  id: string;
  name: string;
  geometry_count: number;
  instance_count: number;
}

export async function createCell(name: string): Promise<string> {
  return invoke<string>("create_cell", { name });
}

export async function listCells(): Promise<CellInfo[]> {
  return invoke<CellInfo[]>("list_cells");
}

// ── Viewport ──

export interface Viewport {
  center_x: number;
  center_y: number;
  zoom: number;
  canvas_width: number;
  canvas_height: number;
}

export async function getViewport(): Promise<Viewport> {
  return invoke<Viewport>("get_viewport");
}

export async function updateViewport(
  centerX: number,
  centerY: number,
  zoom: number
): Promise<void> {
  return invoke("update_viewport", {
    center_x: centerX,
    center_y: centerY,
    zoom,
  });
}

// ── Undo/Redo ──

export async function undo(): Promise<boolean> {
  return invoke<boolean>("undo");
}

export async function redo(): Promise<boolean> {
  return invoke<boolean>("redo");
}

// ── File I/O ──

export async function openGdsFile(path: string): Promise<ProjectInfo> {
  return invoke<ProjectInfo>("open_gds_file", { path });
}

export async function saveGdsFile(path: string): Promise<void> {
  return invoke("save_gds_file", { path });
}

export async function saveProjectJson(path: string): Promise<void> {
  return invoke("save_project_json", { path });
}

export async function openProjectJson(path: string): Promise<ProjectInfo> {
  return invoke<ProjectInfo>("open_project_json", { path });
}

// ── Geometry ──

export async function addRect(
  cellId: string,
  layer: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): Promise<number> {
  return invoke<number>("add_rect", {
    cell_id: cellId,
    layer,
    x1,
    y1,
    x2,
    y2,
  });
}

export async function addPolygon(
  cellId: string,
  layer: number,
  vertices: [number, number][]
): Promise<number> {
  return invoke<number>("add_polygon", {
    cell_id: cellId,
    layer,
    vertices,
  });
}

export async function addPath(
  cellId: string,
  layer: number,
  points: [number, number][],
  width: number
): Promise<number> {
  return invoke<number>("add_path", {
    cell_id: cellId,
    layer,
    points,
    width,
  });
}

export async function removeGeometry(
  cellId: string,
  index: number
): Promise<boolean> {
  return invoke<boolean>("remove_geometry", {
    cell_id: cellId,
    index,
  });
}

export interface GeometryData {
  Rect?: { layer_id: number; lower_left: { x: number; y: number }; upper_right: { x: number; y: number } };
  Polygon?: { layer_id: number; vertices: { x: number; y: number }[] };
  Path?: { layer_id: number; points: { x: number; y: number }[]; width: number };
  Via?: { bottom_layer: number; top_layer: number; cut_layer: number; position: { x: number; y: number }; width: number; height: number };
}

export async function getCellGeometries(cellId: string): Promise<GeometryData[]> {
  return invoke<GeometryData[]>("get_cell_geometries", { cell_id: cellId });
}

// ── Geometry sync (Rust DB ↔ Frontend stores) ──

/**
 * FlatGeometry — matches the Rust FlatGeometry struct.
 * Directly compatible with CanvasGeometry from geometryStore.
 */
export interface FlatGeometry {
  type: string;
  layerId: number;
  points: { x: number; y: number }[];
  width?: number;
}

/**
 * Export all geometries from the Rust database as flat CanvasGeometry-like records.
 */
export async function exportAllGeometries(): Promise<FlatGeometry[]> {
  return invoke<FlatGeometry[]>("export_all_geometries");
}

/**
 * Import geometries from the frontend store into the Rust database.
 */
export async function importAllGeometries(
  geometries: FlatGeometry[],
  projectName?: string,
): Promise<ProjectInfo> {
  return invoke<ProjectInfo>("import_all_geometries", {
    geometries,
    project_name: projectName,
  });
}

/**
 * Get the path of the currently open file.
 */
export async function getCurrentFile(): Promise<string | null> {
  return invoke<string | null>("get_current_file");
}

/**
 * Update the tracked current file path after save/open.
 */
export async function setCurrentFile(path: string, format: "gds" | "json"): Promise<void> {
  return invoke("set_current_file", { path, format });
}
