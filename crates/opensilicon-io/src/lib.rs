//! # OpenSilicon I/O
//!
//! File format readers and writers for the OpenSilicon project format,
//! GDS-II, OASIS, LEF/DEF, and CIF. Also handles the directory-based
//! .osproj project structure with human-readable JSON metadata.

pub mod project;
pub mod gds;

pub use project::ProjectMeta;
pub use gds::{GdsReader, GdsWriter, GdsError};
