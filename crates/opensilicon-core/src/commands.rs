use crate::database::LayoutDatabase;

/// A reversible command for the undo/redo system.
pub trait Command: std::fmt::Debug + Send {
    /// Execute the command (apply changes to the database).
    fn execute(&mut self, db: &mut LayoutDatabase);
    /// Reverse the command (undo changes).
    fn undo(&mut self, db: &mut LayoutDatabase);
    /// Human-readable description for the undo/redo history.
    fn description(&self) -> &str;
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
