//! # OpenSilicon Renderer
//!
//! WebGPU-based 2D rendering engine for the layout canvas.
//! Handles polygon rendering, layer coloring, zoom/pan, and selection highlighting.
//!
//! In Phase 1, this module defines the rendering data structures and provides
//! JSON-serializable render commands that the frontend WebGPU canvas consumes.

pub mod viewport;
pub mod render_data;

pub use viewport::Viewport;
pub use render_data::RenderLayer;
