use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

use opensilicon_core::cell::CellId;
use opensilicon_core::geometry::{GeomPrimitive, Point, Rect, Polygon, Path as LayoutPath, Via};
use opensilicon_core::{Cell, LayoutDatabase};
use opensilicon_renderer::Viewport;

/// Shared application state managed by Tauri.
pub struct AppState {
    pub database: Mutex<LayoutDatabase>,
    pub viewport: Mutex<Viewport>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            database: Mutex::new(LayoutDatabase::new("Untitled Project")),
            viewport: Mutex::new(Viewport::new(1400.0, 900.0)),
        }
    }
}

// ── Tauri IPC Commands ───────────────────────────────────────────────

/// Get the project info.
#[tauri::command]
fn get_project_info(state: State<AppState>) -> Result<ProjectInfo, String> {
    let db = state.database.lock().map_err(|e| e.to_string())?;
    Ok(ProjectInfo {
        name: db.name.clone(),
        cell_count: db.cell_count(),
        top_cell: db.top_cell.map(|id| {
            db.get_cell(&id)
                .map(|c| c.name.clone())
                .unwrap_or_default()
        }),
    })
}

#[derive(Serialize)]
struct ProjectInfo {
    name: String,
    cell_count: usize,
    top_cell: Option<String>,
}

/// Create a new cell.
#[tauri::command]
fn create_cell(state: State<AppState>, name: String) -> Result<String, String> {
    let mut db = state.database.lock().map_err(|e| e.to_string())?;
    let cell = Cell::new(&name);
    let id = db.add_cell(cell);
    Ok(id.to_string())
}

/// List all cells.
#[tauri::command]
fn list_cells(state: State<AppState>) -> Result<Vec<CellInfo>, String> {
    let db = state.database.lock().map_err(|e| e.to_string())?;
    Ok(db
        .all_cells()
        .map(|c| CellInfo {
            id: c.id.to_string(),
            name: c.name.clone(),
            geometry_count: c.geometry_count(),
            instance_count: c.instance_count(),
        })
        .collect())
}

#[derive(Serialize)]
struct CellInfo {
    id: String,
    name: String,
    geometry_count: usize,
    instance_count: usize,
}

/// Get viewport state.
#[tauri::command]
fn get_viewport(state: State<AppState>) -> Result<Viewport, String> {
    let vp = state.viewport.lock().map_err(|e| e.to_string())?;
    Ok(*vp)
}

/// Update viewport (pan/zoom from frontend).
#[tauri::command]
fn update_viewport(
    state: State<AppState>,
    center_x: f64,
    center_y: f64,
    zoom: f64,
) -> Result<(), String> {
    let mut vp = state.viewport.lock().map_err(|e| e.to_string())?;
    vp.center_x = center_x;
    vp.center_y = center_y;
    vp.zoom = zoom;
    Ok(())
}

/// Undo last action.
#[tauri::command]
fn undo(state: State<AppState>) -> Result<bool, String> {
    let mut db = state.database.lock().map_err(|e| e.to_string())?;
    Ok(db.undo())
}

/// Redo last undone action.
#[tauri::command]
fn redo(state: State<AppState>) -> Result<bool, String> {
    let mut db = state.database.lock().map_err(|e| e.to_string())?;
    Ok(db.redo())
}

// ── File I/O Commands ────────────────────────────────────────────────

/// Open a GDS-II file and load it into the database.
#[tauri::command]
fn open_gds_file(state: State<AppState>, path: String) -> Result<ProjectInfo, String> {
    use opensilicon_io::GdsReader;
    use std::fs::File;
    use std::io::BufReader;

    let file = File::open(&path).map_err(|e| format!("Failed to open file: {}", e))?;
    let reader = BufReader::new(file);
    let mut gds_reader = GdsReader::new(reader);
    let new_db = gds_reader.read().map_err(|e| format!("GDS parse error: {}", e))?;

    let mut db = state.database.lock().map_err(|e| e.to_string())?;
    *db = new_db;

    Ok(ProjectInfo {
        name: db.name.clone(),
        cell_count: db.cell_count(),
        top_cell: db.top_cell.map(|id| {
            db.get_cell(&id)
                .map(|c| c.name.clone())
                .unwrap_or_default()
        }),
    })
}

/// Save the current database as a GDS-II file.
#[tauri::command]
fn save_gds_file(state: State<AppState>, path: String) -> Result<(), String> {
    use opensilicon_io::GdsWriter;
    use std::fs::File;
    use std::io::BufWriter;

    let db = state.database.lock().map_err(|e| e.to_string())?;
    let file = File::create(&path).map_err(|e| format!("Failed to create file: {}", e))?;
    let writer = BufWriter::new(file);
    let mut gds_writer = GdsWriter::new(writer);
    gds_writer.write(&db).map_err(|e| format!("GDS write error: {}", e))?;
    Ok(())
}

/// Save/load the database as JSON (native project format).
#[tauri::command]
fn save_project_json(state: State<AppState>, path: String) -> Result<(), String> {
    let db = state.database.lock().map_err(|e| e.to_string())?;
    let json = db.to_json().map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn open_project_json(state: State<AppState>, path: String) -> Result<ProjectInfo, String> {
    let json = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let new_db = LayoutDatabase::from_json(&json).map_err(|e| e.to_string())?;
    let mut db = state.database.lock().map_err(|e| e.to_string())?;
    *db = new_db;
    Ok(ProjectInfo {
        name: db.name.clone(),
        cell_count: db.cell_count(),
        top_cell: db.top_cell.map(|id| {
            db.get_cell(&id)
                .map(|c| c.name.clone())
                .unwrap_or_default()
        }),
    })
}

// ── Geometry Commands ────────────────────────────────────────────────

/// Add a rectangle to a cell.
#[tauri::command]
fn add_rect(
    state: State<AppState>,
    cell_id: String,
    layer: u32,
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
) -> Result<usize, String> {
    let id: CellId = cell_id.parse().map_err(|e: uuid::Error| e.to_string())?;
    let mut db = state.database.lock().map_err(|e| e.to_string())?;
    let cell = db.get_cell_mut(&id).ok_or("Cell not found")?;
    cell.add_geometry(GeomPrimitive::Rect(Rect::new(layer, x1, y1, x2, y2)));
    Ok(cell.geometry_count())
}

/// Add a polygon to a cell.
#[tauri::command]
fn add_polygon(
    state: State<AppState>,
    cell_id: String,
    layer: u32,
    vertices: Vec<[f64; 2]>,
) -> Result<usize, String> {
    let id: CellId = cell_id.parse().map_err(|e: uuid::Error| e.to_string())?;
    let points: Vec<Point> = vertices.iter().map(|v| Point::new(v[0], v[1])).collect();
    let mut db = state.database.lock().map_err(|e| e.to_string())?;
    let cell = db.get_cell_mut(&id).ok_or("Cell not found")?;
    cell.add_geometry(GeomPrimitive::Polygon(Polygon::new(layer, points)));
    Ok(cell.geometry_count())
}

/// Add a path/wire to a cell.
#[tauri::command]
fn add_path(
    state: State<AppState>,
    cell_id: String,
    layer: u32,
    points: Vec<[f64; 2]>,
    width: f64,
) -> Result<usize, String> {
    let id: CellId = cell_id.parse().map_err(|e: uuid::Error| e.to_string())?;
    let pts: Vec<Point> = points.iter().map(|v| Point::new(v[0], v[1])).collect();
    let mut db = state.database.lock().map_err(|e| e.to_string())?;
    let cell = db.get_cell_mut(&id).ok_or("Cell not found")?;
    cell.add_geometry(GeomPrimitive::Path(LayoutPath::new(layer, pts, width)));
    Ok(cell.geometry_count())
}

/// Remove a geometry from a cell by index.
#[tauri::command]
fn remove_geometry(
    state: State<AppState>,
    cell_id: String,
    index: usize,
) -> Result<bool, String> {
    let id: CellId = cell_id.parse().map_err(|e: uuid::Error| e.to_string())?;
    let mut db = state.database.lock().map_err(|e| e.to_string())?;
    let cell = db.get_cell_mut(&id).ok_or("Cell not found")?;
    Ok(cell.remove_geometry(index).is_some())
}

/// Get all geometries in a cell as JSON (for canvas rendering).
#[tauri::command]
fn get_cell_geometries(
    state: State<AppState>,
    cell_id: String,
) -> Result<serde_json::Value, String> {
    let id: CellId = cell_id.parse().map_err(|e: uuid::Error| e.to_string())?;
    let db = state.database.lock().map_err(|e| e.to_string())?;
    let cell = db.get_cell(&id).ok_or("Cell not found")?;
    serde_json::to_value(&cell.geometries).map_err(|e| e.to_string())
}

// ── App setup ────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            get_project_info,
            create_cell,
            list_cells,
            get_viewport,
            update_viewport,
            undo,
            redo,
            open_gds_file,
            save_gds_file,
            save_project_json,
            open_project_json,
            add_rect,
            add_polygon,
            add_path,
            remove_geometry,
            get_cell_geometries,
        ])
        .run(tauri::generate_context!())
        .expect("error while running OpenSilicon");
}
