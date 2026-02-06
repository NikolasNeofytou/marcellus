use serde::{Deserialize, Serialize};

/// A unique layer identifier (typically GDS layer number).
pub type LayerId = u32;

/// Represents a technology layer in the layout.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Layer {
    pub id: LayerId,
    pub name: String,
    pub gds_layer: u16,
    pub gds_datatype: u16,
    pub color: LayerColor,
    pub fill_pattern: FillPattern,
    pub opacity: f32,
    pub visible: bool,
    pub selectable: bool,
    pub description: String,
}

impl Layer {
    pub fn new(id: LayerId, name: &str, gds_layer: u16, gds_datatype: u16) -> Self {
        Self {
            id,
            name: name.to_string(),
            gds_layer,
            gds_datatype,
            color: LayerColor::default(),
            fill_pattern: FillPattern::Solid,
            opacity: 0.7,
            visible: true,
            selectable: true,
            description: String::new(),
        }
    }

    pub fn with_color(mut self, r: u8, g: u8, b: u8) -> Self {
        self.color = LayerColor { r, g, b };
        self
    }

    pub fn with_pattern(mut self, pattern: FillPattern) -> Self {
        self.fill_pattern = pattern;
        self
    }

    pub fn with_description(mut self, desc: &str) -> Self {
        self.description = desc.to_string();
        self
    }
}

/// RGBA color for a layer.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct LayerColor {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

impl Default for LayerColor {
    fn default() -> Self {
        Self {
            r: 128,
            g: 128,
            b: 128,
        }
    }
}

impl LayerColor {
    pub fn to_f32_array(&self, opacity: f32) -> [f32; 4] {
        [
            self.r as f32 / 255.0,
            self.g as f32 / 255.0,
            self.b as f32 / 255.0,
            opacity,
        ]
    }
}

/// Fill pattern for layer rendering.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum FillPattern {
    Solid,
    Hatched,
    CrossHatched,
    Stipple,
    Dotted,
    Outline,
}

/// A collection of layers representing a technology stack.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LayerStack {
    layers: Vec<Layer>,
}

impl LayerStack {
    pub fn new() -> Self {
        Self { layers: Vec::new() }
    }

    pub fn add_layer(&mut self, layer: Layer) {
        self.layers.push(layer);
    }

    pub fn get_layer(&self, id: LayerId) -> Option<&Layer> {
        self.layers.iter().find(|l| l.id == id)
    }

    pub fn get_layer_mut(&mut self, id: LayerId) -> Option<&mut Layer> {
        self.layers.iter_mut().find(|l| l.id == id)
    }

    pub fn get_layer_by_gds(&self, gds_layer: u16, gds_datatype: u16) -> Option<&Layer> {
        self.layers
            .iter()
            .find(|l| l.gds_layer == gds_layer && l.gds_datatype == gds_datatype)
    }

    pub fn visible_layers(&self) -> impl Iterator<Item = &Layer> {
        self.layers.iter().filter(|l| l.visible)
    }

    pub fn all_layers(&self) -> &[Layer] {
        &self.layers
    }

    pub fn layer_count(&self) -> usize {
        self.layers.len()
    }

    pub fn toggle_visibility(&mut self, id: LayerId) {
        if let Some(layer) = self.get_layer_mut(id) {
            layer.visible = !layer.visible;
        }
    }

    pub fn set_all_visible(&mut self, visible: bool) {
        for layer in &mut self.layers {
            layer.visible = visible;
        }
    }
}

impl Default for LayerStack {
    fn default() -> Self {
        Self::new()
    }
}
