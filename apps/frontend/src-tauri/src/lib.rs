use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

use opensilicon_core::cell::CellId;
use opensilicon_core::commands::{AddGeometryCommand, RemoveGeometryCommand, MoveGeometryCommand};
use opensilicon_core::geometry::{GeomPrimitive, Point, Rect, Polygon, Path as LayoutPath, Via};
use opensilicon_core::{Cell, LayoutDatabase};
use opensilicon_renderer::Viewport;

/// Shared application state managed by Tauri.
pub struct AppState {
    pub database: Mutex<LayoutDatabase>,
    pub viewport: Mutex<Viewport>,
    /// Path of the currently open file (if any), for "Save" re-save flow.
    pub current_file: Mutex<Option<CurrentFile>>,
}

/// Tracks what file is currently open and its format.
#[derive(Debug, Clone)]
pub struct CurrentFile {
    pub path: String,
    pub format: FileFormat,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum FileFormat {
    Gds,
    Json,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            database: Mutex::new(LayoutDatabase::new("Untitled Project")),
            viewport: Mutex::new(Viewport::new(1400.0, 900.0)),
            current_file: Mutex::new(None),
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

/// Add a rectangle to a cell (via undoable command).
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
    let geom = GeomPrimitive::Rect(Rect::new(layer, x1, y1, x2, y2));
    let mut db = state.database.lock().map_err(|e| e.to_string())?;
    let cmd = Box::new(AddGeometryCommand::new(id, geom));
    db.execute_command(cmd);
    let count = db.get_cell(&id).map(|c| c.geometry_count()).unwrap_or(0);
    Ok(count)
}

/// Add a polygon to a cell (via undoable command).
#[tauri::command]
fn add_polygon(
    state: State<AppState>,
    cell_id: String,
    layer: u32,
    vertices: Vec<[f64; 2]>,
) -> Result<usize, String> {
    let id: CellId = cell_id.parse().map_err(|e: uuid::Error| e.to_string())?;
    let points: Vec<Point> = vertices.iter().map(|v| Point::new(v[0], v[1])).collect();
    let geom = GeomPrimitive::Polygon(Polygon::new(layer, points));
    let mut db = state.database.lock().map_err(|e| e.to_string())?;
    let cmd = Box::new(AddGeometryCommand::new(id, geom));
    db.execute_command(cmd);
    let count = db.get_cell(&id).map(|c| c.geometry_count()).unwrap_or(0);
    Ok(count)
}

/// Add a path/wire to a cell (via undoable command).
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
    let geom = GeomPrimitive::Path(LayoutPath::new(layer, pts, width));
    let mut db = state.database.lock().map_err(|e| e.to_string())?;
    let cmd = Box::new(AddGeometryCommand::new(id, geom));
    db.execute_command(cmd);
    let count = db.get_cell(&id).map(|c| c.geometry_count()).unwrap_or(0);
    Ok(count)
}

/// Remove a geometry from a cell by index (via undoable command).
#[tauri::command]
fn remove_geometry(
    state: State<AppState>,
    cell_id: String,
    index: usize,
) -> Result<bool, String> {
    let id: CellId = cell_id.parse().map_err(|e: uuid::Error| e.to_string())?;
    let mut db = state.database.lock().map_err(|e| e.to_string())?;
    let exists = db.get_cell(&id).map(|c| index < c.geometry_count()).unwrap_or(false);
    if exists {
        let cmd = Box::new(RemoveGeometryCommand::new(id, index));
        db.execute_command(cmd);
    }
    Ok(exists)
}

/// Move geometries in a cell by a delta offset (via undoable command).
#[tauri::command]
fn move_geometries(
    state: State<AppState>,
    cell_id: String,
    indices: Vec<usize>,
    dx: f64,
    dy: f64,
) -> Result<(), String> {
    let id: CellId = cell_id.parse().map_err(|e: uuid::Error| e.to_string())?;
    let mut db = state.database.lock().map_err(|e| e.to_string())?;
    let cmd = Box::new(MoveGeometryCommand::new(id, indices, Point::new(dx, dy)));
    db.execute_command(cmd);
    Ok(())
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

// ── Geometry sync commands (Rust DB ↔ Frontend stores) ───────────

/// Flatten-export: return all geometries from all cells in a format the
/// frontend CanvasGeometry store can directly consume.
#[tauri::command]
fn export_all_geometries(state: State<AppState>) -> Result<Vec<FlatGeometry>, String> {
    let db = state.database.lock().map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for cell in db.all_cells() {
        for geom in &cell.geometries {
            out.push(FlatGeometry::from_primitive(geom));
        }
    }
    Ok(out)
}

/// A geometry record the TypeScript side can directly map to CanvasGeometry.
#[derive(Serialize, Deserialize, Debug, Clone)]
struct FlatGeometry {
    #[serde(rename = "type")]
    geom_type: String,
    #[serde(rename = "layerId")]
    layer_id: u32,
    points: Vec<FlatPoint>,
    #[serde(skip_serializing_if = "Option::is_none")]
    width: Option<f64>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct FlatPoint {
    x: f64,
    y: f64,
}

impl FlatGeometry {
    fn from_primitive(p: &GeomPrimitive) -> Self {
        match p {
            GeomPrimitive::Rect(r) => FlatGeometry {
                geom_type: "rect".into(),
                layer_id: r.layer_id,
                points: vec![
                    FlatPoint { x: r.lower_left.x, y: r.lower_left.y },
                    FlatPoint { x: r.upper_right.x, y: r.upper_right.y },
                ],
                width: None,
            },
            GeomPrimitive::Polygon(p) => FlatGeometry {
                geom_type: "polygon".into(),
                layer_id: p.layer_id,
                points: p.vertices.iter().map(|v| FlatPoint { x: v.x, y: v.y }).collect(),
                width: None,
            },
            GeomPrimitive::Path(p) => FlatGeometry {
                geom_type: "path".into(),
                layer_id: p.layer_id,
                points: p.points.iter().map(|v| FlatPoint { x: v.x, y: v.y }).collect(),
                width: Some(p.width),
            },
            GeomPrimitive::Via(v) => FlatGeometry {
                geom_type: "via".into(),
                layer_id: v.cut_layer,
                points: vec![FlatPoint { x: v.position.x, y: v.position.y }],
                width: Some(v.width),
            },
        }
    }

    fn to_primitive(&self) -> Option<GeomPrimitive> {
        match self.geom_type.as_str() {
            "rect" if self.points.len() >= 2 => {
                let p1 = &self.points[0];
                let p2 = &self.points[1];
                Some(GeomPrimitive::Rect(Rect::new(self.layer_id, p1.x, p1.y, p2.x, p2.y)))
            }
            "polygon" if self.points.len() >= 3 => {
                let pts: Vec<Point> = self.points.iter().map(|p| Point::new(p.x, p.y)).collect();
                Some(GeomPrimitive::Polygon(Polygon::new(self.layer_id, pts)))
            }
            "path" if self.points.len() >= 2 => {
                let pts: Vec<Point> = self.points.iter().map(|p| Point::new(p.x, p.y)).collect();
                Some(GeomPrimitive::Path(LayoutPath::new(self.layer_id, pts, self.width.unwrap_or(0.1))))
            }
            "via" if !self.points.is_empty() => {
                let p = &self.points[0];
                let w = self.width.unwrap_or(0.17);
                Some(GeomPrimitive::Via(Via::new(self.layer_id, self.layer_id, self.layer_id, Point::new(p.x, p.y), w, w)))
            }
            _ => None,
        }
    }
}

/// Import geometries from the frontend store into the Rust database,
/// replacing the current top cell's geometries.
#[tauri::command]
fn import_all_geometries(
    state: State<AppState>,
    geometries: Vec<FlatGeometry>,
    project_name: Option<String>,
) -> Result<ProjectInfo, String> {
    let mut db = state.database.lock().map_err(|e| e.to_string())?;

    // If a project name is given, update it
    if let Some(name) = project_name {
        db.name = name;
    }

    // Create or reuse the top cell
    let top_id = if let Some(id) = db.top_cell {
        // Clear existing geometries
        if let Some(cell) = db.get_cell_mut(&id) {
            cell.geometries.clear();
        }
        id
    } else {
        let cell = Cell::new("TOP");
        db.add_cell(cell)
    };

    // Add geometries
    if let Some(cell) = db.get_cell_mut(&top_id) {
        for fg in &geometries {
            if let Some(prim) = fg.to_primitive() {
                cell.geometries.push(prim);
            }
        }
    }

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

/// Get the path of the currently open file (for Save flow).
#[tauri::command]
fn get_current_file(state: State<AppState>) -> Result<Option<String>, String> {
    let cf = state.current_file.lock().map_err(|e| e.to_string())?;
    Ok(cf.as_ref().map(|f| f.path.clone()))
}

/// Set the current file path after a save/open operation.
#[tauri::command]
fn set_current_file(state: State<AppState>, path: String, format: String) -> Result<(), String> {
    let fmt = match format.as_str() {
        "gds" => FileFormat::Gds,
        _ => FileFormat::Json,
    };
    let mut cf = state.current_file.lock().map_err(|e| e.to_string())?;
    *cf = Some(CurrentFile { path, format: fmt });
    Ok(())
}

// ── App setup ────────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
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
            move_geometries,
            get_cell_geometries,
            export_all_geometries,
            import_all_geometries,
            get_current_file,
            set_current_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running OpenSilicon");
}
