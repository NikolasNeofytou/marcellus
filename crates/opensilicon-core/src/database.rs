use std::collections::HashMap;

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::cell::{Cell, CellId};
use crate::commands::{Command, CommandHistory};
use crate::layer::LayerStack;

/// The central layout database that holds all cells and the technology layer stack.
#[derive(Debug, Serialize, Deserialize)]
pub struct LayoutDatabase {
    /// Database identifier.
    pub id: Uuid,
    /// Project name.
    pub name: String,
    /// Technology layers.
    pub layer_stack: LayerStack,
    /// All cells indexed by ID.
    cells: HashMap<CellId, Cell>,
    /// Top-level cell (entry point for hierarchy).
    pub top_cell: Option<CellId>,
    /// Command history for undo/redo.
    #[serde(skip)]
    command_history: CommandHistory,
    /// Database units: nanometers per database unit.
    pub dbu_per_nm: f64,
}

impl LayoutDatabase {
    pub fn new(name: &str) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.to_string(),
            layer_stack: LayerStack::new(),
            cells: HashMap::new(),
            top_cell: None,
            command_history: CommandHistory::new(),
            dbu_per_nm: 1.0,
        }
    }

    // ── Cell management ──────────────────────────────────────────────

    pub fn add_cell(&mut self, cell: Cell) -> CellId {
        let id = cell.id;
        self.cells.insert(id, cell);
        if self.top_cell.is_none() {
            self.top_cell = Some(id);
        }
        id
    }

    pub fn get_cell(&self, id: &CellId) -> Option<&Cell> {
        self.cells.get(id)
    }

    pub fn get_cell_mut(&mut self, id: &CellId) -> Option<&mut Cell> {
        self.cells.get_mut(id)
    }

    pub fn remove_cell(&mut self, id: &CellId) -> Option<Cell> {
        if self.top_cell == Some(*id) {
            self.top_cell = None;
        }
        self.cells.remove(id)
    }

    pub fn find_cell_by_name(&self, name: &str) -> Option<&Cell> {
        self.cells.values().find(|c| c.name == name)
    }

    pub fn cell_names(&self) -> Vec<&str> {
        self.cells.values().map(|c| c.name.as_str()).collect()
    }

    pub fn cell_count(&self) -> usize {
        self.cells.len()
    }

    pub fn all_cells(&self) -> impl Iterator<Item = &Cell> {
        self.cells.values()
    }

    // ── Undo / Redo ──────────────────────────────────────────────────

    pub fn execute_command(&mut self, command: Box<dyn Command>) {
        self.command_history.execute(command, self);
    }

    pub fn undo(&mut self) -> bool {
        self.command_history.undo(self)
    }

    pub fn redo(&mut self) -> bool {
        self.command_history.redo(self)
    }

    pub fn can_undo(&self) -> bool {
        self.command_history.can_undo()
    }

    pub fn can_redo(&self) -> bool {
        self.command_history.can_redo()
    }

    // ── Serialization ────────────────────────────────────────────────

    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }

    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_database_create() {
        let db = LayoutDatabase::new("test_project");
        assert_eq!(db.name, "test_project");
        assert_eq!(db.cell_count(), 0);
        assert!(db.top_cell.is_none());
    }

    #[test]
    fn test_add_and_find_cell() {
        let mut db = LayoutDatabase::new("test");
        let cell = Cell::new("inverter");
        let id = db.add_cell(cell);
        assert_eq!(db.cell_count(), 1);
        assert!(db.get_cell(&id).is_some());
        assert_eq!(db.find_cell_by_name("inverter").unwrap().name, "inverter");
    }

    #[test]
    fn test_top_cell_auto_set() {
        let mut db = LayoutDatabase::new("test");
        let cell = Cell::new("top");
        let id = db.add_cell(cell);
        assert_eq!(db.top_cell, Some(id));
    }
}
