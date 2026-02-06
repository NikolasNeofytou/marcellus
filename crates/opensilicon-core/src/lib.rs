//! # OpenSilicon Core
//!
//! Core layout database with hierarchical cell management, geometric primitives,
//! spatial indexing (R-tree), and undo/redo via command-pattern journal.
//!
//! This crate is the heart of the OpenSilicon EDA kernel.

pub mod geometry;
pub mod cell;
pub mod database;
pub mod layer;
pub mod commands;
pub mod spatial;

pub use database::LayoutDatabase;
pub use cell::Cell;
pub use layer::{Layer, LayerId};
pub use geometry::{Rect, Polygon, Path, Via, Point, GeomPrimitive};
