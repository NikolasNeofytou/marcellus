//! # OpenSilicon DRC
//!
//! Incremental Design Rule Checking engine.
//! Rules are defined declaratively in YAML rule decks provided by PDK plugins.
//! Only modified spatial regions are re-checked for efficiency.
//!
//! This crate will be fully implemented in Phase 2. The initial skeleton
//! defines the violation data structures used by the UI.

pub mod violation;

pub use violation::{DrcViolation, ViolationType, Severity};
