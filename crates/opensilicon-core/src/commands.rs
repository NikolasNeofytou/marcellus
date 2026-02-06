use crate::cell::CellId;
use crate::database::LayoutDatabase;
use crate::geometry::{GeomPrimitive, Point};

/// A reversible command for the undo/redo system.
pub trait Command: std::fmt::Debug + Send {
    /// Execute the command (apply changes to the database).
    fn execute(&mut self, db: &mut LayoutDatabase);
    /// Reverse the command (undo changes).
    fn undo(&mut self, db: &mut LayoutDatabase);
    /// Human-readable description for the undo/redo history.
    fn description(&self) -> &str;
}

// ══════════════════════════════════════════════════════════════════════
// Concrete Commands
// ══════════════════════════════════════════════════════════════════════

/// Add a geometry primitive to a cell.
#[derive(Debug)]
pub struct AddGeometryCommand {
    pub cell_id: CellId,
    pub geometry: GeomPrimitive,
    /// Index at which the geometry was inserted (set on execute).
    inserted_index: Option<usize>,
}

impl AddGeometryCommand {
    pub fn new(cell_id: CellId, geometry: GeomPrimitive) -> Self {
        Self {
            cell_id,
            geometry,
            inserted_index: None,
        }
    }
}

impl Command for AddGeometryCommand {
    fn execute(&mut self, db: &mut LayoutDatabase) {
        if let Some(cell) = db.get_cell_mut(&self.cell_id) {
            cell.add_geometry(self.geometry.clone());
            self.inserted_index = Some(cell.geometry_count() - 1);
        }
    }

    fn undo(&mut self, db: &mut LayoutDatabase) {
        if let Some(idx) = self.inserted_index {
            if let Some(cell) = db.get_cell_mut(&self.cell_id) {
                cell.remove_geometry(idx);
            }
        }
    }

    fn description(&self) -> &str {
        "Add geometry"
    }
}

/// Remove a geometry primitive from a cell by index.
#[derive(Debug)]
pub struct RemoveGeometryCommand {
    pub cell_id: CellId,
    pub index: usize,
    /// The removed geometry (saved for undo).
    removed: Option<GeomPrimitive>,
}

impl RemoveGeometryCommand {
    pub fn new(cell_id: CellId, index: usize) -> Self {
        Self {
            cell_id,
            index,
            removed: None,
        }
    }
}

impl Command for RemoveGeometryCommand {
    fn execute(&mut self, db: &mut LayoutDatabase) {
        if let Some(cell) = db.get_cell_mut(&self.cell_id) {
            self.removed = cell.remove_geometry(self.index);
        }
    }

    fn undo(&mut self, db: &mut LayoutDatabase) {
        if let Some(geom) = self.removed.take() {
            if let Some(cell) = db.get_cell_mut(&self.cell_id) {
                // Re-insert at the original index
                if self.index <= cell.geometries.len() {
                    cell.geometries.insert(self.index, geom.clone());
                } else {
                    cell.geometries.push(geom.clone());
                }
                cell.modified = true;
                self.removed = Some(geom);
            }
        }
    }

    fn description(&self) -> &str {
        "Remove geometry"
    }
}

/// Move one or more geometry primitives by a delta offset.
#[derive(Debug)]
pub struct MoveGeometryCommand {
    pub cell_id: CellId,
    pub indices: Vec<usize>,
    pub delta: Point,
}

impl MoveGeometryCommand {
    pub fn new(cell_id: CellId, indices: Vec<usize>, delta: Point) -> Self {
        Self {
            cell_id,
            indices,
            delta,
        }
    }
}

impl Command for MoveGeometryCommand {
    fn execute(&mut self, db: &mut LayoutDatabase) {
        if let Some(cell) = db.get_cell_mut(&self.cell_id) {
            for &idx in &self.indices {
                if idx < cell.geometries.len() {
                    translate_geometry(&mut cell.geometries[idx], self.delta.x, self.delta.y);
                }
            }
            cell.modified = true;
        }
    }

    fn undo(&mut self, db: &mut LayoutDatabase) {
        if let Some(cell) = db.get_cell_mut(&self.cell_id) {
            for &idx in &self.indices {
                if idx < cell.geometries.len() {
                    translate_geometry(&mut cell.geometries[idx], -self.delta.x, -self.delta.y);
                }
            }
            cell.modified = true;
        }
    }

    fn description(&self) -> &str {
        "Move geometry"
    }
}

/// Helper: translate all points in a geometry by (dx, dy).
fn translate_geometry(geom: &mut GeomPrimitive, dx: f64, dy: f64) {
    match geom {
        GeomPrimitive::Rect(r) => {
            r.lower_left.x += dx;
            r.lower_left.y += dy;
            r.upper_right.x += dx;
            r.upper_right.y += dy;
        }
        GeomPrimitive::Polygon(p) => {
            for pt in &mut p.vertices {
                pt.x += dx;
                pt.y += dy;
            }
        }
        GeomPrimitive::Path(p) => {
            for pt in &mut p.points {
                pt.x += dx;
                pt.y += dy;
            }
        }
        GeomPrimitive::Via(v) => {
            v.position.x += dx;
            v.position.y += dy;
        }
    }
}

/// Manages the undo/redo history stack.
#[derive(Debug, Default)]
pub struct CommandHistory {
    undo_stack: Vec<Box<dyn Command>>,
    redo_stack: Vec<Box<dyn Command>>,
}

impl CommandHistory {
    pub fn new() -> Self {
        Self {
            undo_stack: Vec::new(),
            redo_stack: Vec::new(),
        }
    }

    pub fn execute(&mut self, mut command: Box<dyn Command>, db: &mut LayoutDatabase) {
        command.execute(db);
        self.undo_stack.push(command);
        // Executing a new command clears the redo stack.
        self.redo_stack.clear();
    }

    pub fn undo(&mut self, db: &mut LayoutDatabase) -> bool {
        if let Some(mut command) = self.undo_stack.pop() {
            command.undo(db);
            self.redo_stack.push(command);
            true
        } else {
            false
        }
    }

    pub fn redo(&mut self, db: &mut LayoutDatabase) -> bool {
        if let Some(mut command) = self.redo_stack.pop() {
            command.execute(db);
            self.undo_stack.push(command);
            true
        } else {
            false
        }
    }

    pub fn can_undo(&self) -> bool {
        !self.undo_stack.is_empty()
    }

    pub fn can_redo(&self) -> bool {
        !self.redo_stack.is_empty()
    }

    pub fn undo_description(&self) -> Option<&str> {
        self.undo_stack.last().map(|c| c.description())
    }

    pub fn redo_description(&self) -> Option<&str> {
        self.redo_stack.last().map(|c| c.description())
    }

    pub fn clear(&mut self) {
        self.undo_stack.clear();
        self.redo_stack.clear();
    }
}
