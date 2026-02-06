use serde::{Deserialize, Serialize};

/// Type of DRC violation.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum ViolationType {
    MinWidth,
    MinSpacing,
    Enclosure,
    Extension,
    Density,
    Antenna,
    Custom(String),
}

/// Severity level of a DRC violation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Severity {
    Error,
    Warning,
    Info,
}

/// A single DRC violation with location and description.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DrcViolation {
    pub id: String,
    pub violation_type: ViolationType,
    pub severity: Severity,
    pub rule_name: String,
    pub message: String,
    pub layer_id: u32,
    /// Bounding box of the violation region: [min_x, min_y, max_x, max_y]
    pub bbox: [f64; 4],
    /// Indices of the geometries involved.
    pub geometry_indices: Vec<usize>,
}
