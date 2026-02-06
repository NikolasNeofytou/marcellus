use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::geometry::{BBox, GeomPrimitive, Point};
use crate::LayerId;

/// Unique cell identifier.
pub type CellId = Uuid;

/// A transformation for placing subcell instances.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Transform {
    /// Translation offset.
    pub offset: Point,
    /// Rotation in degrees (0, 90, 180, 270).
    pub rotation: f64,
    /// Mirror about X axis.
    pub mirror_x: bool,
    /// Uniform scale factor (typically 1.0).
    pub scale: f64,
}

impl Default for Transform {
    fn default() -> Self {
        Self {
            offset: Point::new(0.0, 0.0),
            rotation: 0.0,
            mirror_x: false,
            scale: 1.0,
        }
    }
}

impl Transform {
    pub fn translate(x: f64, y: f64) -> Self {
        Self {
            offset: Point::new(x, y),
            ..Default::default()
        }
    }

    pub fn apply(&self, point: &Point) -> Point {
        let mut p = *point;

        // Apply scale
        p.x *= self.scale;
        p.y *= self.scale;

        // Apply mirror
        if self.mirror_x {
            p.y = -p.y;
        }

        // Apply rotation (simplified for 90-degree increments)
        let rad = self.rotation.to_radians();
        let cos_r = rad.cos();
        let sin_r = rad.sin();
        let rx = p.x * cos_r - p.y * sin_r;
        let ry = p.x * sin_r + p.y * cos_r;

        // Apply translation
        Point::new(rx + self.offset.x, ry + self.offset.y)
    }
}

/// A reference to a subcell placed within a parent cell.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CellInstance {
    pub id: Uuid,
    pub cell_id: CellId,
    pub instance_name: String,
    pub transform: Transform,
}

impl CellInstance {
    pub fn new(cell_id: CellId, instance_name: &str, transform: Transform) -> Self {
        Self {
            id: Uuid::new_v4(),
            cell_id,
            instance_name: instance_name.to_string(),
            transform,
        }
    }
}

/// Pin / port definition on a cell.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Pin {
    pub name: String,
    pub layer_id: LayerId,
    pub shape: GeomPrimitive,
    pub direction: PinDirection,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub enum PinDirection {
    Input,
    Output,
    InOut,
    Power,
    Ground,
}

/// A layout cell containing geometric primitives and subcell references.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cell {
    pub id: CellId,
    pub name: String,
    pub geometries: Vec<GeomPrimitive>,
    pub instances: Vec<CellInstance>,
    pub pins: Vec<Pin>,
    pub modified: bool,
}

impl Cell {
    pub fn new(name: &str) -> Self {
        Self {
            id: Uuid::new_v4(),
            name: name.to_string(),
            geometries: Vec::new(),
            instances: Vec::new(),
            pins: Vec::new(),
            modified: false,
        }
    }

    pub fn add_geometry(&mut self, geom: GeomPrimitive) {
        self.geometries.push(geom);
        self.modified = true;
    }

    pub fn remove_geometry(&mut self, index: usize) -> Option<GeomPrimitive> {
        if index < self.geometries.len() {
            self.modified = true;
            Some(self.geometries.remove(index))
        } else {
            None
        }
    }

    pub fn add_instance(&mut self, instance: CellInstance) {
        self.instances.push(instance);
        self.modified = true;
    }

    pub fn add_pin(&mut self, pin: Pin) {
        self.pins.push(pin);
        self.modified = true;
    }

    /// Compute the bounding box of all geometry in this cell (not including subcells).
    pub fn local_bbox(&self) -> Option<BBox> {
        let bboxes: Vec<BBox> = self
            .geometries
            .iter()
            .filter_map(|g| g.bbox())
            .collect();

        if bboxes.is_empty() {
            return None;
        }

        let mut result = bboxes[0];
        for bb in &bboxes[1..] {
            result = result.union(bb);
        }
        Some(result)
    }

    /// Get all geometries on a specific layer.
    pub fn geometries_on_layer(&self, layer_id: LayerId) -> Vec<&GeomPrimitive> {
        self.geometries
            .iter()
            .filter(|g| g.layer_id() == layer_id)
            .collect()
    }

    pub fn geometry_count(&self) -> usize {
        self.geometries.len()
    }

    pub fn instance_count(&self) -> usize {
        self.instances.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::geometry::Rect;

    #[test]
    fn test_cell_add_geometry() {
        let mut cell = Cell::new("test_cell");
        let rect = GeomPrimitive::Rect(Rect::new(0, 0.0, 0.0, 100.0, 50.0));
        cell.add_geometry(rect);
        assert_eq!(cell.geometry_count(), 1);
        assert!(cell.modified);
    }

    #[test]
    fn test_cell_bbox() {
        let mut cell = Cell::new("test_cell");
        cell.add_geometry(GeomPrimitive::Rect(Rect::new(0, 0.0, 0.0, 100.0, 50.0)));
        cell.add_geometry(GeomPrimitive::Rect(Rect::new(1, 50.0, 25.0, 200.0, 75.0)));
        let bb = cell.local_bbox().unwrap();
        assert!((bb.min.x - 0.0).abs() < 1e-10);
        assert!((bb.min.y - 0.0).abs() < 1e-10);
        assert!((bb.max.x - 200.0).abs() < 1e-10);
        assert!((bb.max.y - 75.0).abs() < 1e-10);
    }

    #[test]
    fn test_transform_translate() {
        let t = Transform::translate(10.0, 20.0);
        let p = Point::new(5.0, 5.0);
        let result = t.apply(&p);
        assert!((result.x - 15.0).abs() < 1e-10);
        assert!((result.y - 25.0).abs() < 1e-10);
    }
}
