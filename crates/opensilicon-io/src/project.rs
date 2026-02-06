use serde::{Deserialize, Serialize};

/// Metadata for an OpenSilicon project (.osproj directory).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMeta {
    pub name: String,
    pub version: String,
    pub pdk: String,
    pub description: String,
    pub created: String,
    pub modified: String,
    pub top_cell: Option<String>,
    pub settings: ProjectSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSettings {
    pub grid_size: f64,
    pub snap_to_grid: bool,
    pub dbu_per_um: f64,
    pub default_via: Option<String>,
}

impl Default for ProjectSettings {
    fn default() -> Self {
        Self {
            grid_size: 0.005, // 5nm grid
            snap_to_grid: true,
            dbu_per_um: 1000.0,
            default_via: None,
        }
    }
}

impl ProjectMeta {
    pub fn new(name: &str, pdk: &str) -> Self {
        Self {
            name: name.to_string(),
            version: "0.1.0".to_string(),
            pdk: pdk.to_string(),
            description: String::new(),
            created: String::new(),
            modified: String::new(),
            top_cell: None,
            settings: ProjectSettings::default(),
        }
    }
}
