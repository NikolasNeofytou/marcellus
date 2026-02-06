/**
 * Plugin system type definitions for OpenSilicon.
 *
 * Plugins extend the IDE with PDK definitions, custom DRC rules,
 * device generators, custom tools, and more.
 */

// ══════════════════════════════════════════════════════════════════════
// Plugin Manifest
// ══════════════════════════════════════════════════════════════════════

/** Every plugin ships a manifest describing its identity and capabilities. */
export interface PluginManifest {
  /** Unique plugin identifier, e.g. "opensilicon.sky130-pdk" */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semver version string */
  version: string;
  /** Short description */
  description: string;
  /** Author or organisation */
  author: string;
  /** License identifier */
  license?: string;
  /** Minimum OpenSilicon version required */
  engineVersion?: string;
  /** Plugin categories */
  categories: PluginCategory[];
  /** Capabilities this plugin contributes */
  contributes: PluginContributions;
}

export type PluginCategory =
  | "pdk"
  | "drc"
  | "simulation"
  | "import-export"
  | "tool"
  | "theme"
  | "device-generator";

// ══════════════════════════════════════════════════════════════════════
// Plugin Contributions
// ══════════════════════════════════════════════════════════════════════

/** What a plugin contributes to the IDE */
export interface PluginContributions {
  /** PDK technology definition */
  pdk?: PDKDefinition;
  /** DRC rule decks */
  drcRuleDecks?: DRCRuleDeck[];
  /** Device generators / pcells */
  deviceGenerators?: DeviceGeneratorDef[];
  /** Custom commands */
  commands?: PluginCommandDef[];
  /** Additional layer definitions */
  layers?: PluginLayerDef[];
}

// ══════════════════════════════════════════════════════════════════════
// PDK Definition
// ══════════════════════════════════════════════════════════════════════

/** A complete Process Design Kit definition */
export interface PDKDefinition {
  /** PDK name, e.g. "SKY130" */
  name: string;
  /** Foundry name */
  foundry: string;
  /** Technology node, e.g. "130nm" */
  node: string;
  /** Number of metal layers */
  metalLayers: number;
  /** Database units per micron */
  dbuPerMicron: number;
  /** Manufacturing grid in microns */
  manufacturingGrid: number;

  /** Layer stack definition */
  layers: TechLayer[];
  /** Via definitions between adjacent metal layers */
  vias: ViaDefinition[];
  /** Design rules (spacing, width, enclosure, etc.) */
  designRules: DesignRule[];
  /** Standard cell library reference */
  standardCells?: StandardCellLibrary;
}

/** A technology layer in the PDK */
export interface TechLayer {
  /** Layer number (GDS layer number) */
  gdsLayer: number;
  /** Datatype (GDS purpose) */
  gdsDatatype: number;
  /** Layer name, e.g. "met1.drawing" */
  name: string;
  /** Short alias for UI, e.g. "M1" */
  alias: string;
  /** Layer purpose */
  purpose: LayerPurpose;
  /** Material type */
  material: LayerMaterial;
  /** Display color (hex) */
  color: string;
  /** Fill pattern for display */
  fillPattern: "solid" | "hatch" | "cross" | "dots" | "none";
  /** Default visibility */
  defaultVisible: boolean;
  /** Sheet resistance (ohms/square) — used for parasitic extraction */
  sheetResistance?: number;
  /** Thickness in microns — used for parasitic extraction */
  thickness?: number;
  /** Height above substrate in microns */
  height?: number;
}

export type LayerPurpose =
  | "drawing"
  | "pin"
  | "label"
  | "blockage"
  | "boundary"
  | "net"
  | "fill";

export type LayerMaterial =
  | "diffusion"
  | "well"
  | "poly"
  | "metal"
  | "cut"        // via/contact
  | "implant"
  | "oxide"
  | "marker"
  | "other";

// ══════════════════════════════════════════════════════════════════════
// Via Definitions
// ══════════════════════════════════════════════════════════════════════

export interface ViaDefinition {
  /** Via name, e.g. "via1" */
  name: string;
  /** Bottom layer alias (e.g. "M1") */
  bottomLayer: string;
  /** Top layer alias (e.g. "M2") */
  topLayer: string;
  /** Cut layer alias */
  cutLayer: string;
  /** Minimum via width (µm) */
  width: number;
  /** Minimum via height (µm) */
  height: number;
  /** Minimum enclosure from bottom metal (µm) */
  bottomEnclosure: number;
  /** Minimum enclosure from top metal (µm) */
  topEnclosure: number;
  /** Minimum spacing between vias (µm) */
  spacing: number;
  /** Resistance per via (ohms) */
  resistance?: number;
}

// ══════════════════════════════════════════════════════════════════════
// Design Rules
// ══════════════════════════════════════════════════════════════════════

export interface DesignRule {
  /** Rule identifier, e.g. "met1.width.min" */
  id: string;
  /** Human-readable description */
  description: string;
  /** Rule type */
  type: DesignRuleType;
  /** Layer(s) this rule applies to */
  layers: string[];
  /** Second layer (for spacing/enclosure rules) */
  otherLayer?: string;
  /** Value in microns */
  value: number;
  /** Severity */
  severity: "error" | "warning" | "info";
  /** Is this rule enabled? */
  enabled: boolean;
}

export type DesignRuleType =
  | "min_width"
  | "max_width"
  | "min_spacing"
  | "min_enclosure"
  | "min_overlap"
  | "min_area"
  | "max_area"
  | "min_density"
  | "max_density"
  | "exact_width"
  | "min_edge_length"
  | "min_notch";

// ══════════════════════════════════════════════════════════════════════
// Standard Cell Library
// ══════════════════════════════════════════════════════════════════════

export interface StandardCellLibrary {
  /** Library name */
  name: string;
  /** Cell height in microns */
  cellHeight: number;
  /** Site width (pitch) in microns */
  siteWidth: number;
  /** Available cells */
  cells: StandardCellDef[];
}

export interface StandardCellDef {
  /** Cell name, e.g. "sky130_fd_sc_hd__inv_1" */
  name: string;
  /** Function description */
  function: string;
  /** Drive strength */
  driveStrength: number;
  /** Number of inputs */
  inputs: string[];
  /** Output names */
  outputs: string[];
  /** Width in site units */
  widthInSites: number;
}

// ══════════════════════════════════════════════════════════════════════
// Device Generators (PCell-like)
// ══════════════════════════════════════════════════════════════════════

export interface DeviceGeneratorDef {
  /** Generator name */
  name: string;
  /** Device type */
  deviceType: "nmos" | "pmos" | "resistor" | "capacitor" | "inductor" | "diode" | "bipolar";
  /** Description */
  description: string;
  /** Configurable parameters */
  parameters: DeviceParameter[];
}

export interface DeviceParameter {
  name: string;
  label: string;
  type: "number" | "string" | "boolean" | "enum";
  default: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: string[]; // for enum type
  unit?: string;
  description?: string;
}

// ══════════════════════════════════════════════════════════════════════
// Plugin Commands & Layers
// ══════════════════════════════════════════════════════════════════════

export interface PluginCommandDef {
  id: string;
  label: string;
  category: string;
  keybinding?: string;
}

export interface PluginLayerDef {
  id: number;
  name: string;
  color: string;
  fillPattern: "solid" | "hatch" | "cross" | "dots" | "none";
  visible: boolean;
}

// ══════════════════════════════════════════════════════════════════════
// DRC Rule Deck
// ══════════════════════════════════════════════════════════════════════

export interface DRCRuleDeck {
  /** Deck name, e.g. "SKY130 Minimal DRC" */
  name: string;
  /** Description */
  description: string;
  /** Version */
  version: string;
  /** The rules in this deck */
  rules: DesignRule[];
}

// ══════════════════════════════════════════════════════════════════════
// Plugin Lifecycle State
// ══════════════════════════════════════════════════════════════════════

export type PluginState = "installed" | "active" | "disabled" | "error";

export interface PluginInstance {
  manifest: PluginManifest;
  state: PluginState;
  error?: string;
  activatedAt?: number;
}
