use rstar::{RTree, RTreeObject, AABB};

use crate::geometry::{BBox, Point};

/// An entry in the R-tree spatial index, referencing a geometry by its index.
#[derive(Debug, Clone)]
pub struct SpatialEntry {
    /// Index into the cell's geometry vector.
    pub geometry_index: usize,
    /// Bounding box of the geometry.
    pub bbox: BBox,
}

impl RTreeObject for SpatialEntry {
    type Envelope = AABB<[f64; 2]>;

    fn envelope(&self) -> Self::Envelope {
        AABB::from_corners(
            [self.bbox.min.x, self.bbox.min.y],
            [self.bbox.max.x, self.bbox.max.y],
        )
    }
}

/// Spatial index for fast point-query and viewport culling.
pub struct SpatialIndex {
    tree: RTree<SpatialEntry>,
}

impl SpatialIndex {
    pub fn new() -> Self {
        Self {
            tree: RTree::new(),
        }
    }

    /// Build the index from a list of geometry bounding boxes.
    pub fn build(entries: Vec<SpatialEntry>) -> Self {
        Self {
            tree: RTree::bulk_load(entries),
        }
    }

    /// Insert a single entry.
    pub fn insert(&mut self, entry: SpatialEntry) {
        self.tree.insert(entry);
    }

    /// Find all entries whose bounding box contains the given point.
    pub fn query_point(&self, point: &Point) -> Vec<&SpatialEntry> {
        self.tree
            .locate_all_at_point(&[point.x, point.y])
            .collect()
    }

    /// Find all entries that intersect with the given viewport bounding box.
    pub fn query_viewport(&self, viewport: &BBox) -> Vec<&SpatialEntry> {
        let envelope = AABB::from_corners(
            [viewport.min.x, viewport.min.y],
            [viewport.max.x, viewport.max.y],
        );
        self.tree
            .locate_in_envelope_intersecting(&envelope)
            .collect()
    }

    /// Number of entries in the index.
    pub fn len(&self) -> usize {
        self.tree.size()
    }

    pub fn is_empty(&self) -> bool {
        self.tree.size() == 0
    }
}

impl Default for SpatialIndex {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spatial_query() {
        let entries = vec![
            SpatialEntry {
                geometry_index: 0,
                bbox: BBox::new(Point::new(0.0, 0.0), Point::new(10.0, 10.0)),
            },
            SpatialEntry {
                geometry_index: 1,
                bbox: BBox::new(Point::new(20.0, 20.0), Point::new(30.0, 30.0)),
            },
        ];
        let index = SpatialIndex::build(entries);

        // Point inside first entry
        let results = index.query_point(&Point::new(5.0, 5.0));
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].geometry_index, 0);

        // Point inside second entry
        let results = index.query_point(&Point::new(25.0, 25.0));
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].geometry_index, 1);

        // Viewport query
        let viewport = BBox::new(Point::new(-5.0, -5.0), Point::new(15.0, 15.0));
        let results = index.query_viewport(&viewport);
        assert_eq!(results.len(), 1);
    }
}
