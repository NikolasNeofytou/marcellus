use serde::{Deserialize, Serialize};

/// Represents the current viewport state for the layout canvas.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Viewport {
    /// Center X in layout coordinates.
    pub center_x: f64,
    /// Center Y in layout coordinates.
    pub center_y: f64,
    /// Zoom level (pixels per layout unit).
    pub zoom: f64,
    /// Canvas width in pixels.
    pub canvas_width: f64,
    /// Canvas height in pixels.
    pub canvas_height: f64,
}

impl Viewport {
    pub fn new(canvas_width: f64, canvas_height: f64) -> Self {
        Self {
            center_x: 0.0,
            center_y: 0.0,
            zoom: 1.0,
            canvas_width,
            canvas_height,
        }
    }

    /// Pan the viewport by a delta in screen pixels.
    pub fn pan(&mut self, dx: f64, dy: f64) {
        self.center_x -= dx / self.zoom;
        self.center_y -= dy / self.zoom;
    }

    /// Zoom in/out centered on a screen position.
    pub fn zoom_at(&mut self, screen_x: f64, screen_y: f64, factor: f64) {
        // Convert screen to layout before zoom
        let layout_x = self.screen_to_layout_x(screen_x);
        let layout_y = self.screen_to_layout_y(screen_y);

        self.zoom *= factor;
        self.zoom = self.zoom.max(0.001).min(1_000_000.0);

        // Adjust center so the point under the cursor stays fixed
        let new_layout_x = self.screen_to_layout_x(screen_x);
        let new_layout_y = self.screen_to_layout_y(screen_y);
        self.center_x -= new_layout_x - layout_x;
        self.center_y -= new_layout_y - layout_y;
    }

    /// Zoom to fit a bounding box.
    pub fn fit_bbox(&mut self, min_x: f64, min_y: f64, max_x: f64, max_y: f64) {
        let width = max_x - min_x;
        let height = max_y - min_y;
        if width <= 0.0 || height <= 0.0 {
            return;
        }

        self.center_x = (min_x + max_x) / 2.0;
        self.center_y = (min_y + max_y) / 2.0;

        let zoom_x = self.canvas_width / width * 0.9; // 10% margin
        let zoom_y = self.canvas_height / height * 0.9;
        self.zoom = zoom_x.min(zoom_y);
    }

    /// Convert screen X coordinate to layout coordinate.
    pub fn screen_to_layout_x(&self, screen_x: f64) -> f64 {
        (screen_x - self.canvas_width / 2.0) / self.zoom + self.center_x
    }

    /// Convert screen Y coordinate to layout coordinate.
    pub fn screen_to_layout_y(&self, screen_y: f64) -> f64 {
        (screen_y - self.canvas_height / 2.0) / self.zoom + self.center_y
    }

    /// Convert layout X coordinate to screen coordinate.
    pub fn layout_to_screen_x(&self, layout_x: f64) -> f64 {
        (layout_x - self.center_x) * self.zoom + self.canvas_width / 2.0
    }

    /// Convert layout Y coordinate to screen coordinate.
    pub fn layout_to_screen_y(&self, layout_y: f64) -> f64 {
        (layout_y - self.center_y) * self.zoom + self.canvas_height / 2.0
    }

    /// Get the visible bounding box in layout coordinates.
    pub fn visible_bounds(&self) -> (f64, f64, f64, f64) {
        let half_w = self.canvas_width / (2.0 * self.zoom);
        let half_h = self.canvas_height / (2.0 * self.zoom);
        (
            self.center_x - half_w,
            self.center_y - half_h,
            self.center_x + half_w,
            self.center_y + half_h,
        )
    }

    /// Determine the semantic zoom level for level-of-detail rendering.
    pub fn detail_level(&self) -> DetailLevel {
        if self.zoom > 100.0 {
            DetailLevel::Full // Show everything: labels, pins, transistor details
        } else if self.zoom > 10.0 {
            DetailLevel::Medium // Show cell boundaries and metal routing
        } else if self.zoom > 1.0 {
            DetailLevel::Low // Show only large structures
        } else {
            DetailLevel::Heatmap // Density visualization
        }
    }
}

/// Semantic zoom level for level-of-detail rendering.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum DetailLevel {
    Full,
    Medium,
    Low,
    Heatmap,
}
