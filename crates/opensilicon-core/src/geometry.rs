use serde::{Deserialize, Serialize};

/// A 2D point in layout coordinates (nanometers).
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

impl Point {
    pub fn new(x: f64, y: f64) -> Self {
        Self { x, y }
    }

    pub fn distance_to(&self, other: &Point) -> f64 {
        ((self.x - other.x).powi(2) + (self.y - other.y).powi(2)).sqrt()
    }

    pub fn translate(&self, dx: f64, dy: f64) -> Self {
        Self {
            x: self.x + dx,
            y: self.y + dy,
        }
    }
}

/// An axis-aligned bounding box.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct BBox {
    pub min: Point,
    pub max: Point,
}

impl BBox {
    pub fn new(min: Point, max: Point) -> Self {
        Self { min, max }
    }

    pub fn from_points(points: &[Point]) -> Option<Self> {
        if points.is_empty() {
            return None;
        }
        let mut min_x = f64::MAX;
        let mut min_y = f64::MAX;
        let mut max_x = f64::MIN;
        let mut max_y = f64::MIN;
        for p in points {
            min_x = min_x.min(p.x);
            min_y = min_y.min(p.y);
            max_x = max_x.max(p.x);
            max_y = max_y.max(p.y);
        }
        Some(Self {
            min: Point::new(min_x, min_y),
            max: Point::new(max_x, max_y),
        })
    }

    pub fn width(&self) -> f64 {
        self.max.x - self.min.x
    }

    pub fn height(&self) -> f64 {
        self.max.y - self.min.y
    }

    pub fn center(&self) -> Point {
        Point::new(
            (self.min.x + self.max.x) / 2.0,
            (self.min.y + self.max.y) / 2.0,
        )
    }

    pub fn contains_point(&self, p: &Point) -> bool {
        p.x >= self.min.x && p.x <= self.max.x && p.y >= self.min.y && p.y <= self.max.y
    }

    pub fn intersects(&self, other: &BBox) -> bool {
        self.min.x <= other.max.x
            && self.max.x >= other.min.x
            && self.min.y <= other.max.y
            && self.max.y >= other.min.y
    }

    pub fn union(&self, other: &BBox) -> Self {
        Self {
            min: Point::new(self.min.x.min(other.min.x), self.min.y.min(other.min.y)),
            max: Point::new(self.max.x.max(other.max.x), self.max.y.max(other.max.y)),
        }
    }
}

/// A rectangle defined by lower-left and upper-right corners.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Rect {
    pub layer_id: crate::LayerId,
    pub lower_left: Point,
    pub upper_right: Point,
}

impl Rect {
    pub fn new(layer_id: crate::LayerId, x1: f64, y1: f64, x2: f64, y2: f64) -> Self {
        Self {
            layer_id,
            lower_left: Point::new(x1.min(x2), y1.min(y2)),
            upper_right: Point::new(x1.max(x2), y1.max(y2)),
        }
    }

    pub fn bbox(&self) -> BBox {
        BBox::new(self.lower_left, self.upper_right)
    }

    pub fn width(&self) -> f64 {
        self.upper_right.x - self.lower_left.x
    }

    pub fn height(&self) -> f64 {
        self.upper_right.y - self.lower_left.y
    }

    pub fn area(&self) -> f64 {
        self.width() * self.height()
    }

    pub fn contains_point(&self, p: &Point) -> bool {
        self.bbox().contains_point(p)
    }
}

/// A polygon defined by a list of vertices.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Polygon {
    pub layer_id: crate::LayerId,
    pub vertices: Vec<Point>,
}

impl Polygon {
    pub fn new(layer_id: crate::LayerId, vertices: Vec<Point>) -> Self {
        Self { layer_id, vertices }
    }

    pub fn bbox(&self) -> Option<BBox> {
        BBox::from_points(&self.vertices)
    }

    pub fn vertex_count(&self) -> usize {
        self.vertices.len()
    }
}

/// A path (wire) defined by a centerline and width.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Path {
    pub layer_id: crate::LayerId,
    pub points: Vec<Point>,
    pub width: f64,
}

impl Path {
    pub fn new(layer_id: crate::LayerId, points: Vec<Point>, width: f64) -> Self {
        Self {
            layer_id,
            points,
            width,
        }
    }

    pub fn bbox(&self) -> Option<BBox> {
        let half_w = self.width / 2.0;
        let expanded: Vec<Point> = self
            .points
            .iter()
            .flat_map(|p| {
                vec![
                    Point::new(p.x - half_w, p.y - half_w),
                    Point::new(p.x + half_w, p.y + half_w),
                ]
            })
            .collect();
        BBox::from_points(&expanded)
    }

    pub fn length(&self) -> f64 {
        self.points
            .windows(2)
            .map(|w| w[0].distance_to(&w[1]))
            .sum()
    }
}

/// A via connecting two layers.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Via {
    pub bottom_layer: crate::LayerId,
    pub top_layer: crate::LayerId,
    pub cut_layer: crate::LayerId,
    pub position: Point,
    pub width: f64,
    pub height: f64,
}

impl Via {
    pub fn new(
        bottom_layer: crate::LayerId,
        top_layer: crate::LayerId,
        cut_layer: crate::LayerId,
        position: Point,
        width: f64,
        height: f64,
    ) -> Self {
        Self {
            bottom_layer,
            top_layer,
            cut_layer,
            position,
            width,
            height,
        }
    }

    pub fn bbox(&self) -> BBox {
        let half_w = self.width / 2.0;
        let half_h = self.height / 2.0;
        BBox::new(
            Point::new(self.position.x - half_w, self.position.y - half_h),
            Point::new(self.position.x + half_w, self.position.y + half_h),
        )
    }
}

/// A geometric primitive in the layout.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum GeomPrimitive {
    Rect(Rect),
    Polygon(Polygon),
    Path(Path),
    Via(Via),
}

impl GeomPrimitive {
    pub fn bbox(&self) -> Option<BBox> {
        match self {
            GeomPrimitive::Rect(r) => Some(r.bbox()),
            GeomPrimitive::Polygon(p) => p.bbox(),
            GeomPrimitive::Path(p) => p.bbox(),
            GeomPrimitive::Via(v) => Some(v.bbox()),
        }
    }

    pub fn layer_id(&self) -> crate::LayerId {
        match self {
            GeomPrimitive::Rect(r) => r.layer_id,
            GeomPrimitive::Polygon(p) => p.layer_id,
            GeomPrimitive::Path(p) => p.layer_id,
            GeomPrimitive::Via(v) => v.cut_layer,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_point_distance() {
        let a = Point::new(0.0, 0.0);
        let b = Point::new(3.0, 4.0);
        assert!((a.distance_to(&b) - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_rect_area() {
        let r = Rect::new(0, 0.0, 0.0, 10.0, 5.0);
        assert!((r.area() - 50.0).abs() < 1e-10);
    }

    #[test]
    fn test_bbox_intersection() {
        let a = BBox::new(Point::new(0.0, 0.0), Point::new(10.0, 10.0));
        let b = BBox::new(Point::new(5.0, 5.0), Point::new(15.0, 15.0));
        let c = BBox::new(Point::new(20.0, 20.0), Point::new(30.0, 30.0));
        assert!(a.intersects(&b));
        assert!(!a.intersects(&c));
    }
}
