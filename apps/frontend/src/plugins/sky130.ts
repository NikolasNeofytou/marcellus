/**
 * SKY130 PDK Plugin for OpenSilicon
 *
 * Provides the SkyWater 130nm process technology definition including:
 * - Complete layer stack (nwell through met5)
 * - Via definitions
 * - Design rules (minimum width, spacing, enclosure)
 * - Device generators (NMOS, PMOS, resistor)
 * - Standard cell library reference (sky130_fd_sc_hd)
 */

import type {
  PluginManifest,
  TechLayer,
  ViaDefinition,
  DesignRule,
  DeviceGeneratorDef,
  StandardCellLibrary,
  DRCRuleDeck,
} from "./types";

// ══════════════════════════════════════════════════════════════════════
// Layer Stack
// ══════════════════════════════════════════════════════════════════════

const sky130Layers: TechLayer[] = [
  // ── Wells & Implants ──
  {
    gdsLayer: 64, gdsDatatype: 20, name: "nwell.drawing", alias: "NW",
    purpose: "drawing", material: "well", color: "#3b82f6",
    fillPattern: "hatch", defaultVisible: true,
    sheetResistance: 900, thickness: 3.0, height: 0,
  },
  {
    gdsLayer: 122, gdsDatatype: 16, name: "pwell.drawing", alias: "PW",
    purpose: "drawing", material: "well", color: "#ef4444",
    fillPattern: "hatch", defaultVisible: true,
    sheetResistance: 1050, thickness: 3.0, height: 0,
  },
  // ── Diffusion ──
  {
    gdsLayer: 65, gdsDatatype: 20, name: "diff.drawing", alias: "DIFF",
    purpose: "drawing", material: "diffusion", color: "#22c55e",
    fillPattern: "solid", defaultVisible: true,
    sheetResistance: 100, thickness: 0.13, height: 0,
  },
  {
    gdsLayer: 65, gdsDatatype: 44, name: "tap.drawing", alias: "TAP",
    purpose: "drawing", material: "diffusion", color: "#a855f7",
    fillPattern: "solid", defaultVisible: true,
  },
  // ── Polysilicon ──
  {
    gdsLayer: 66, gdsDatatype: 20, name: "poly.drawing", alias: "POLY",
    purpose: "drawing", material: "poly", color: "#f97316",
    fillPattern: "solid", defaultVisible: true,
    sheetResistance: 48, thickness: 0.18, height: 0.14,
  },
  // ── Local Interconnect ──
  {
    gdsLayer: 67, gdsDatatype: 20, name: "li1.drawing", alias: "LI",
    purpose: "drawing", material: "metal", color: "#ec4899",
    fillPattern: "solid", defaultVisible: true,
    sheetResistance: 12.5, thickness: 0.1, height: 0.93,
  },
  // ── Contacts / Vias ──
  {
    gdsLayer: 66, gdsDatatype: 44, name: "licon.drawing", alias: "LICON",
    purpose: "drawing", material: "cut", color: "#06b6d4",
    fillPattern: "cross", defaultVisible: true,
    sheetResistance: 120,
  },
  {
    gdsLayer: 67, gdsDatatype: 44, name: "mcon.drawing", alias: "MCON",
    purpose: "drawing", material: "cut", color: "#84cc16",
    fillPattern: "cross", defaultVisible: true,
    sheetResistance: 9.3,
  },
  // ── Metal 1 ──
  {
    gdsLayer: 68, gdsDatatype: 20, name: "met1.drawing", alias: "M1",
    purpose: "drawing", material: "metal", color: "#6366f1",
    fillPattern: "solid", defaultVisible: true,
    sheetResistance: 0.125, thickness: 0.36, height: 1.02,
  },
  // ── Via 1 ──
  {
    gdsLayer: 68, gdsDatatype: 44, name: "via.drawing", alias: "VIA1",
    purpose: "drawing", material: "cut", color: "#f59e0b",
    fillPattern: "cross", defaultVisible: true,
    sheetResistance: 4.5,
  },
  // ── Metal 2 ──
  {
    gdsLayer: 69, gdsDatatype: 20, name: "met2.drawing", alias: "M2",
    purpose: "drawing", material: "metal", color: "#14b8a6",
    fillPattern: "solid", defaultVisible: true,
    sheetResistance: 0.125, thickness: 0.36, height: 1.74,
  },
  // ── Via 2 ──
  {
    gdsLayer: 69, gdsDatatype: 44, name: "via2.drawing", alias: "VIA2",
    purpose: "drawing", material: "cut", color: "#d97706",
    fillPattern: "cross", defaultVisible: true,
    sheetResistance: 3.4,
  },
  // ── Metal 3 ──
  {
    gdsLayer: 70, gdsDatatype: 20, name: "met3.drawing", alias: "M3",
    purpose: "drawing", material: "metal", color: "#0ea5e9",
    fillPattern: "solid", defaultVisible: true,
    sheetResistance: 0.047, thickness: 0.845, height: 2.37,
  },
  // ── Via 3 ──
  {
    gdsLayer: 70, gdsDatatype: 44, name: "via3.drawing", alias: "VIA3",
    purpose: "drawing", material: "cut", color: "#c2410c",
    fillPattern: "cross", defaultVisible: true,
    sheetResistance: 3.4,
  },
  // ── Metal 4 ──
  {
    gdsLayer: 71, gdsDatatype: 20, name: "met4.drawing", alias: "M4",
    purpose: "drawing", material: "metal", color: "#8b5cf6",
    fillPattern: "solid", defaultVisible: true,
    sheetResistance: 0.047, thickness: 0.845, height: 3.78,
  },
  // ── Via 4 ──
  {
    gdsLayer: 71, gdsDatatype: 44, name: "via4.drawing", alias: "VIA4",
    purpose: "drawing", material: "cut", color: "#9a3412",
    fillPattern: "cross", defaultVisible: true,
    sheetResistance: 0.38,
  },
  // ── Metal 5 (redistribution / thick top metal) ──
  {
    gdsLayer: 72, gdsDatatype: 20, name: "met5.drawing", alias: "M5",
    purpose: "drawing", material: "metal", color: "#e11d48",
    fillPattern: "solid", defaultVisible: true,
    sheetResistance: 0.029, thickness: 1.26, height: 5.30,
  },
  // ── Implants / markers ──
  {
    gdsLayer: 93, gdsDatatype: 44, name: "nsdm.drawing", alias: "NSDM",
    purpose: "drawing", material: "implant", color: "#38bdf8",
    fillPattern: "hatch", defaultVisible: false,
  },
  {
    gdsLayer: 94, gdsDatatype: 20, name: "psdm.drawing", alias: "PSDM",
    purpose: "drawing", material: "implant", color: "#fb7185",
    fillPattern: "hatch", defaultVisible: false,
  },
  // ── Pin layers ──
  {
    gdsLayer: 68, gdsDatatype: 16, name: "met1.pin", alias: "M1.PIN",
    purpose: "pin", material: "metal", color: "#6366f1",
    fillPattern: "none", defaultVisible: true,
  },
  {
    gdsLayer: 69, gdsDatatype: 16, name: "met2.pin", alias: "M2.PIN",
    purpose: "pin", material: "metal", color: "#14b8a6",
    fillPattern: "none", defaultVisible: true,
  },
];

// ══════════════════════════════════════════════════════════════════════
// Via Definitions
// ══════════════════════════════════════════════════════════════════════

const sky130Vias: ViaDefinition[] = [
  {
    name: "licon",
    bottomLayer: "DIFF",
    topLayer: "LI",
    cutLayer: "LICON",
    width: 0.17,
    height: 0.17,
    bottomEnclosure: 0.06,
    topEnclosure: 0.08,
    spacing: 0.17,
    resistance: 120,
  },
  {
    name: "mcon",
    bottomLayer: "LI",
    topLayer: "M1",
    cutLayer: "MCON",
    width: 0.17,
    height: 0.17,
    bottomEnclosure: 0.0,
    topEnclosure: 0.06,
    spacing: 0.19,
    resistance: 9.3,
  },
  {
    name: "via1",
    bottomLayer: "M1",
    topLayer: "M2",
    cutLayer: "VIA1",
    width: 0.15,
    height: 0.15,
    bottomEnclosure: 0.055,
    topEnclosure: 0.055,
    spacing: 0.17,
    resistance: 4.5,
  },
  {
    name: "via2",
    bottomLayer: "M2",
    topLayer: "M3",
    cutLayer: "VIA2",
    width: 0.2,
    height: 0.2,
    bottomEnclosure: 0.065,
    topEnclosure: 0.065,
    spacing: 0.2,
    resistance: 3.4,
  },
  {
    name: "via3",
    bottomLayer: "M3",
    topLayer: "M4",
    cutLayer: "VIA3",
    width: 0.2,
    height: 0.2,
    bottomEnclosure: 0.065,
    topEnclosure: 0.065,
    spacing: 0.2,
    resistance: 3.4,
  },
  {
    name: "via4",
    bottomLayer: "M4",
    topLayer: "M5",
    cutLayer: "VIA4",
    width: 0.8,
    height: 0.8,
    bottomEnclosure: 0.19,
    topEnclosure: 0.31,
    spacing: 0.8,
    resistance: 0.38,
  },
];

// ══════════════════════════════════════════════════════════════════════
// Design Rules
// ══════════════════════════════════════════════════════════════════════

const sky130DesignRules: DesignRule[] = [
  // ── Diffusion rules ──
  { id: "difftap.1",  description: "Min diff/tap width",       type: "min_width",     layers: ["DIFF", "TAP"], value: 0.15,  severity: "error", enabled: true },
  { id: "difftap.2",  description: "Min diff/tap spacing",     type: "min_spacing",   layers: ["DIFF"],        value: 0.27,  severity: "error", enabled: true },
  { id: "difftap.3",  description: "Min diff/tap area",        type: "min_area",      layers: ["DIFF"],        value: 0.063, severity: "error", enabled: true },
  // ── Poly rules ──
  { id: "poly.1a",    description: "Min poly width",           type: "min_width",     layers: ["POLY"],        value: 0.15,  severity: "error", enabled: true },
  { id: "poly.2",     description: "Min poly spacing",         type: "min_spacing",   layers: ["POLY"],        value: 0.21,  severity: "error", enabled: true },
  { id: "poly.7",     description: "Min poly to diff spacing", type: "min_spacing",   layers: ["POLY"],        otherLayer: "DIFF", value: 0.075, severity: "error", enabled: true },
  { id: "poly.8",     description: "Min poly extension past diff", type: "min_enclosure", layers: ["POLY"],    otherLayer: "DIFF", value: 0.13, severity: "error", enabled: true },
  // ── LI rules ──
  { id: "li.1",       description: "Min local interconnect width",  type: "min_width",   layers: ["LI"],   value: 0.17, severity: "error", enabled: true },
  { id: "li.3",       description: "Min local interconnect spacing", type: "min_spacing", layers: ["LI"],   value: 0.17, severity: "error", enabled: true },
  // ── LICON rules ──
  { id: "licon.1",    description: "Min licon width",                type: "exact_width", layers: ["LICON"], value: 0.17, severity: "error", enabled: true },
  { id: "licon.2",    description: "Min licon spacing",              type: "min_spacing", layers: ["LICON"], value: 0.17, severity: "error", enabled: true },
  { id: "licon.5a",   description: "Min LI enclosure of licon",     type: "min_enclosure", layers: ["LI"], otherLayer: "LICON", value: 0.08, severity: "error", enabled: true },
  // ── MCON rules ──
  { id: "ct.1",       description: "Min mcon width",          type: "exact_width",     layers: ["MCON"], value: 0.17, severity: "error", enabled: true },
  { id: "ct.2",       description: "Min mcon spacing",        type: "min_spacing",     layers: ["MCON"], value: 0.19, severity: "error", enabled: true },
  { id: "ct.4",       description: "Min M1 enclosure of mcon", type: "min_enclosure", layers: ["M1"], otherLayer: "MCON", value: 0.06, severity: "error", enabled: true },
  // ── Metal 1 rules ──
  { id: "m1.1",       description: "Min metal1 width",          type: "min_width",     layers: ["M1"],   value: 0.14,  severity: "error", enabled: true },
  { id: "m1.2",       description: "Min metal1 spacing",        type: "min_spacing",   layers: ["M1"],   value: 0.14,  severity: "error", enabled: true },
  { id: "m1.4",       description: "Min metal1 area",           type: "min_area",      layers: ["M1"],   value: 0.083, severity: "error", enabled: true },
  // ── VIA 1 rules ──
  { id: "via.1a",     description: "Min via1 width",            type: "exact_width",   layers: ["VIA1"], value: 0.15, severity: "error", enabled: true },
  { id: "via.2",      description: "Min via1 spacing",          type: "min_spacing",   layers: ["VIA1"], value: 0.17, severity: "error", enabled: true },
  { id: "via.4a",     description: "Min M1 enclosure of via1",  type: "min_enclosure", layers: ["M1"], otherLayer: "VIA1", value: 0.055, severity: "error", enabled: true },
  { id: "via.5a",     description: "Min M2 enclosure of via1",  type: "min_enclosure", layers: ["M2"], otherLayer: "VIA1", value: 0.055, severity: "error", enabled: true },
  // ── Metal 2 rules ──
  { id: "m2.1",       description: "Min metal2 width",          type: "min_width",     layers: ["M2"],   value: 0.14,  severity: "error", enabled: true },
  { id: "m2.2",       description: "Min metal2 spacing",        type: "min_spacing",   layers: ["M2"],   value: 0.14,  severity: "error", enabled: true },
  { id: "m2.4",       description: "Min metal2 area",           type: "min_area",      layers: ["M2"],   value: 0.0676, severity: "error", enabled: true },
  // ── Metal 3 rules ──
  { id: "m3.1",       description: "Min metal3 width",          type: "min_width",     layers: ["M3"],   value: 0.30,  severity: "error", enabled: true },
  { id: "m3.2",       description: "Min metal3 spacing",        type: "min_spacing",   layers: ["M3"],   value: 0.30,  severity: "error", enabled: true },
  // ── Metal 4 rules ──
  { id: "m4.1",       description: "Min metal4 width",          type: "min_width",     layers: ["M4"],   value: 0.30,  severity: "error", enabled: true },
  { id: "m4.2",       description: "Min metal4 spacing",        type: "min_spacing",   layers: ["M4"],   value: 0.30,  severity: "error", enabled: true },
  // ── Metal 5 rules ──
  { id: "m5.1",       description: "Min metal5 width",          type: "min_width",     layers: ["M5"],   value: 1.60,  severity: "error", enabled: true },
  { id: "m5.2",       description: "Min metal5 spacing",        type: "min_spacing",   layers: ["M5"],   value: 1.60,  severity: "error", enabled: true },
  // ── NWell rules ──
  { id: "nwell.1",    description: "Min nwell width",           type: "min_width",     layers: ["NW"],   value: 0.84,  severity: "error", enabled: true },
  { id: "nwell.2a",   description: "Min nwell spacing",         type: "min_spacing",   layers: ["NW"],   value: 1.27,  severity: "error", enabled: true },
];

// ══════════════════════════════════════════════════════════════════════
// Device Generators
// ══════════════════════════════════════════════════════════════════════

const sky130DeviceGenerators: DeviceGeneratorDef[] = [
  {
    name: "sky130_fd_pr__nfet_01v8",
    deviceType: "nmos",
    description: "1.8V NMOS transistor",
    parameters: [
      { name: "w", label: "Width", type: "number", default: 0.42, min: 0.15, max: 5.0, step: 0.01, unit: "µm", description: "Channel width" },
      { name: "l", label: "Length", type: "number", default: 0.15, min: 0.15, max: 10.0, step: 0.01, unit: "µm", description: "Channel length" },
      { name: "nf", label: "Fingers", type: "number", default: 1, min: 1, max: 20, step: 1, description: "Number of fingers" },
      { name: "mult", label: "Multiplier", type: "number", default: 1, min: 1, max: 100, step: 1, description: "Device multiplier" },
    ],
  },
  {
    name: "sky130_fd_pr__pfet_01v8",
    deviceType: "pmos",
    description: "1.8V PMOS transistor",
    parameters: [
      { name: "w", label: "Width", type: "number", default: 0.42, min: 0.15, max: 5.0, step: 0.01, unit: "µm", description: "Channel width" },
      { name: "l", label: "Length", type: "number", default: 0.15, min: 0.15, max: 10.0, step: 0.01, unit: "µm", description: "Channel length" },
      { name: "nf", label: "Fingers", type: "number", default: 1, min: 1, max: 20, step: 1, description: "Number of fingers" },
      { name: "mult", label: "Multiplier", type: "number", default: 1, min: 1, max: 100, step: 1, description: "Device multiplier" },
    ],
  },
  {
    name: "sky130_fd_pr__res_generic_nd",
    deviceType: "resistor",
    description: "N-diffusion resistor",
    parameters: [
      { name: "w", label: "Width", type: "number", default: 0.42, min: 0.15, max: 5.0, step: 0.01, unit: "µm" },
      { name: "l", label: "Length", type: "number", default: 2.0, min: 0.5, max: 100.0, step: 0.1, unit: "µm" },
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════
// Standard Cell Library (reference)
// ══════════════════════════════════════════════════════════════════════

const sky130StdCells: StandardCellLibrary = {
  name: "sky130_fd_sc_hd",
  cellHeight: 2.72,
  siteWidth: 0.46,
  cells: [
    { name: "sky130_fd_sc_hd__inv_1",    function: "Y = !A",      driveStrength: 1, inputs: ["A"],      outputs: ["Y"], widthInSites: 3 },
    { name: "sky130_fd_sc_hd__inv_2",    function: "Y = !A",      driveStrength: 2, inputs: ["A"],      outputs: ["Y"], widthInSites: 3 },
    { name: "sky130_fd_sc_hd__inv_4",    function: "Y = !A",      driveStrength: 4, inputs: ["A"],      outputs: ["Y"], widthInSites: 5 },
    { name: "sky130_fd_sc_hd__inv_8",    function: "Y = !A",      driveStrength: 8, inputs: ["A"],      outputs: ["Y"], widthInSites: 7 },
    { name: "sky130_fd_sc_hd__buf_1",    function: "X = A",       driveStrength: 1, inputs: ["A"],      outputs: ["X"], widthInSites: 3 },
    { name: "sky130_fd_sc_hd__buf_2",    function: "X = A",       driveStrength: 2, inputs: ["A"],      outputs: ["X"], widthInSites: 5 },
    { name: "sky130_fd_sc_hd__nand2_1",  function: "Y = !(A&B)",  driveStrength: 1, inputs: ["A", "B"], outputs: ["Y"], widthInSites: 3 },
    { name: "sky130_fd_sc_hd__nand2_2",  function: "Y = !(A&B)",  driveStrength: 2, inputs: ["A", "B"], outputs: ["Y"], widthInSites: 5 },
    { name: "sky130_fd_sc_hd__nand3_1",  function: "Y = !(A&B&C)", driveStrength: 1, inputs: ["A", "B", "C"], outputs: ["Y"], widthInSites: 5 },
    { name: "sky130_fd_sc_hd__nor2_1",   function: "Y = !(A|B)",  driveStrength: 1, inputs: ["A", "B"], outputs: ["Y"], widthInSites: 3 },
    { name: "sky130_fd_sc_hd__nor2_2",   function: "Y = !(A|B)",  driveStrength: 2, inputs: ["A", "B"], outputs: ["Y"], widthInSites: 5 },
    { name: "sky130_fd_sc_hd__and2_1",   function: "X = A&B",     driveStrength: 1, inputs: ["A", "B"], outputs: ["X"], widthInSites: 3 },
    { name: "sky130_fd_sc_hd__or2_1",    function: "X = A|B",     driveStrength: 1, inputs: ["A", "B"], outputs: ["X"], widthInSites: 3 },
    { name: "sky130_fd_sc_hd__xor2_1",   function: "X = A^B",     driveStrength: 1, inputs: ["A", "B"], outputs: ["X"], widthInSites: 5 },
    { name: "sky130_fd_sc_hd__xnor2_1",  function: "Y = !(A^B)",  driveStrength: 1, inputs: ["A", "B"], outputs: ["Y"], widthInSites: 5 },
    { name: "sky130_fd_sc_hd__mux2_1",   function: "X = S?B:A",   driveStrength: 1, inputs: ["A0", "A1", "S"], outputs: ["X"], widthInSites: 5 },
    { name: "sky130_fd_sc_hd__dfxtp_1",  function: "Q ← D @CLK",  driveStrength: 1, inputs: ["CLK", "D"], outputs: ["Q"], widthInSites: 13 },
    { name: "sky130_fd_sc_hd__dfxtp_2",  function: "Q ← D @CLK",  driveStrength: 2, inputs: ["CLK", "D"], outputs: ["Q"], widthInSites: 15 },
    { name: "sky130_fd_sc_hd__dfrtp_1",  function: "Q ← D @CLK, R", driveStrength: 1, inputs: ["CLK", "D", "RESET_B"], outputs: ["Q"], widthInSites: 15 },
    { name: "sky130_fd_sc_hd__fill_1",   function: "filler",      driveStrength: 0, inputs: [],         outputs: [], widthInSites: 1 },
    { name: "sky130_fd_sc_hd__fill_2",   function: "filler",      driveStrength: 0, inputs: [],         outputs: [], widthInSites: 2 },
    { name: "sky130_fd_sc_hd__decap_4",  function: "decap",       driveStrength: 0, inputs: [],         outputs: [], widthInSites: 4 },
    { name: "sky130_fd_sc_hd__tapvpwrvgnd_1", function: "well tap", driveStrength: 0, inputs: [],     outputs: [], widthInSites: 1 },
  ],
};

// ══════════════════════════════════════════════════════════════════════
// DRC Rule Deck
// ══════════════════════════════════════════════════════════════════════

const sky130DrcDeck: DRCRuleDeck = {
  name: "SKY130 Standard DRC",
  description: "SkyWater 130nm DRC rules for physical verification",
  version: "1.0.0",
  rules: sky130DesignRules,
};

// ══════════════════════════════════════════════════════════════════════
// Plugin Manifest
// ══════════════════════════════════════════════════════════════════════

export const sky130Plugin: PluginManifest = {
  id: "opensilicon.sky130-pdk",
  name: "SkyWater SKY130 PDK",
  version: "1.0.0",
  description: "SkyWater 130nm open-source PDK for OpenSilicon — includes layer definitions, design rules, device generators, and standard cell library.",
  author: "OpenSilicon",
  license: "Apache-2.0",
  engineVersion: ">=0.1.0",
  categories: ["pdk", "drc", "device-generator"],
  contributes: {
    pdk: {
      name: "SKY130",
      foundry: "SkyWater Technology",
      node: "130nm",
      metalLayers: 5,
      dbuPerMicron: 1000,
      manufacturingGrid: 0.005,
      layers: sky130Layers,
      vias: sky130Vias,
      designRules: sky130DesignRules,
      standardCells: sky130StdCells,
    },
    drcRuleDecks: [sky130DrcDeck],
    deviceGenerators: sky130DeviceGenerators,
    commands: [
      { id: "sky130.showTechInfo", label: "Show SKY130 Technology Info", category: "PDK" },
      { id: "sky130.layerMap", label: "Show SKY130 Layer Map", category: "PDK" },
    ],
  },
};

/** Export for direct access */
export { sky130Layers, sky130Vias, sky130DesignRules, sky130DeviceGenerators, sky130StdCells, sky130DrcDeck };
