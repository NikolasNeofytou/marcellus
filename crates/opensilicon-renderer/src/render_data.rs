use serde::{Deserialize, Serialize};

/// Render data for a single layer, ready to be consumed by the frontend WebGPU canvas.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderLayer {
    pub layer_id: u32,
    pub name: String,
    pub color: [f32; 4],       // RGBA
    pub fill_pattern: String,  // "solid", "hatched", "crosshatched", "stipple", "dotted", "outline"
    pub visible: bool,
    pub polygons: Vec<RenderPolygon>,
}

/// A polygon ready for rendering (triangulated or as a vertex list).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderPolygon {
    /// Flat array of vertices: [x0, y0, x1, y1, ...]
    pub vertices: Vec<f64>,
    /// Whether this polygon is currently selected.
    pub selected: bool,
    /// Whether this polygon has a DRC violation.
    pub has_violation: bool,
}

/// Complete render frame data sent from Rust to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderFrame {
    pub layers: Vec<RenderLayer>,
    pub viewport: super::Viewport,
    pub grid_visible: bool,
    pub grid_spacing: f64,
    pub selection_bbox: Option<[f64; 4]>, // [min_x, min_y, max_x, max_y]
}

impl RenderFrame {
    pub fn empty(viewport: super::Viewport) -> Self {
        Self {
            layers: Vec::new(),
            viewport,
            grid_visible: true,
            grid_spacing: 1.0,
            selection_bbox: None,
        }
    }
}
