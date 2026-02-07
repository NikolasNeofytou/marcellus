/**
 * Community Store — Sprint 39-40
 *
 * Snippet sharing, template library, and community contributions.
 * Extends the marketplace store with social/sharing features.
 */

import { create } from "zustand";
import type { CanvasGeometry } from "./geometryStore";

// ── Types ─────────────────────────────────────────────────────────

export interface CodeSnippet {
  id: string;
  title: string;
  description: string;
  author: string;
  language: "python" | "tcl" | "skill" | "json" | "yaml";
  code: string;
  tags: string[];
  downloads: number;
  rating: number;
  createdAt: number;
  updatedAt: number;
  category: SnippetCategory;
}

export type SnippetCategory =
  | "pcell"
  | "drc_deck"
  | "simulation"
  | "automation"
  | "import_export"
  | "measurement"
  | "utility";

export interface LayoutTemplate {
  id: string;
  name: string;
  description: string;
  author: string;
  thumbnail: string; // data URI or placeholder
  category: TemplateCategory;
  pdk: string;
  layers: number;
  geometryCount: number;
  geometries: CanvasGeometry[];
  tags: string[];
  downloads: number;
  rating: number;
  createdAt: number;
}

export type TemplateCategory =
  | "standard_cell"
  | "analog_block"
  | "pad_frame"
  | "test_structure"
  | "io_cell"
  | "memory"
  | "rf_block"
  | "esd_structure";

export interface CommunityContribution {
  id: string;
  type: "plugin" | "snippet" | "template" | "tutorial" | "rule_deck";
  title: string;
  author: string;
  description: string;
  url?: string;
  stars: number;
  status: "submitted" | "under_review" | "approved" | "featured";
  submittedAt: number;
  reviewedAt?: number;
  comments: ContributionComment[];
}

export interface ContributionComment {
  id: string;
  author: string;
  text: string;
  timestamp: number;
}

export interface CommunityStats {
  totalPlugins: number;
  totalSnippets: number;
  totalTemplates: number;
  totalContributions: number;
  activeContributors: number;
  topContributors: { name: string; contributions: number; avatar?: string }[];
}

// ── Demo data ─────────────────────────────────────────────────────

const DEMO_SNIPPETS: CodeSnippet[] = [
  {
    id: "snip-1",
    title: "Interdigitated Capacitor PCell",
    description: "Parameterized interdigitated capacitor with adjustable fingers, width, and spacing",
    author: "alice_analog",
    language: "python",
    code: `def interdigitated_cap(fingers=10, width=0.5, spacing=0.3, length=20.0):
    """Generate interdigitated capacitor layout."""
    geometries = []
    for i in range(fingers):
        x = i * (width + spacing)
        side = "left" if i % 2 == 0 else "right"
        geometries.append({
            "type": "rect",
            "layer": "met1.drawing",
            "x": x, "y": 0,
            "width": width, "height": length,
            "net": side
        })
    return geometries`,
    tags: ["pcell", "capacitor", "analog", "interdigitated"],
    downloads: 342,
    rating: 4.7,
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now() - 86400000 * 5,
    category: "pcell",
  },
  {
    id: "snip-2",
    title: "DRC Waiver Script",
    description: "Automatically generate DRC waivers for known-good violations in test structures",
    author: "bob_drc",
    language: "python",
    code: `def generate_waivers(violations, waiver_rules):
    """Filter violations against waiver rules."""
    waivers = []
    for v in violations:
        for rule in waiver_rules:
            if v["rule_id"] == rule["id"] and v["layer"] in rule["layers"]:
                waivers.append({
                    "violation_id": v["id"],
                    "reason": rule["reason"],
                    "approved_by": rule["approver"]
                })
    return waivers`,
    tags: ["drc", "waiver", "automation", "verification"],
    downloads: 189,
    rating: 4.3,
    createdAt: Date.now() - 86400000 * 45,
    updatedAt: Date.now() - 86400000 * 10,
    category: "drc_deck",
  },
  {
    id: "snip-3",
    title: "Monte Carlo Parameter Sweep",
    description: "Template for running Monte Carlo simulations with custom parameter distributions",
    author: "charlie_sim",
    language: "python",
    code: `import numpy as np

def monte_carlo_sweep(params, n_runs=1000):
    """Run Monte Carlo with correlated parameters."""
    results = []
    for _ in range(n_runs):
        sample = {}
        for p in params:
            if p["dist"] == "gaussian":
                sample[p["name"]] = np.random.normal(p["mean"], p["sigma"])
            elif p["dist"] == "uniform":
                sample[p["name"]] = np.random.uniform(p["min"], p["max"])
        results.append(simulate(sample))
    return analyze(results)`,
    tags: ["simulation", "monte-carlo", "sweep", "statistics"],
    downloads: 267,
    rating: 4.5,
    createdAt: Date.now() - 86400000 * 20,
    updatedAt: Date.now() - 86400000 * 3,
    category: "simulation",
  },
  {
    id: "snip-4",
    title: "GDS Layer Mapper",
    description: "Map GDS layers between different PDKs using a custom mapping table",
    author: "dave_tools",
    language: "python",
    code: `def map_layers(gds_data, mapping_table):
    """Remap GDS layers using a mapping table."""
    for cell in gds_data.cells:
        for element in cell.elements:
            key = (element.layer, element.datatype)
            if key in mapping_table:
                new_layer, new_dt = mapping_table[key]
                element.layer = new_layer
                element.datatype = new_dt
    return gds_data`,
    tags: ["gds", "layer-mapping", "pdk", "conversion"],
    downloads: 415,
    rating: 4.8,
    createdAt: Date.now() - 86400000 * 60,
    updatedAt: Date.now() - 86400000 * 7,
    category: "import_export",
  },
  {
    id: "snip-5",
    title: "Automated Measurement Extraction",
    description: "Extract common analog measurements from simulation waveforms",
    author: "eve_measure",
    language: "python",
    code: `def extract_measurements(waveform):
    """Extract gain, bandwidth, slew rate, settling time."""
    gain = 20 * np.log10(max(waveform["vout"]) / max(waveform["vin"]))
    bw_idx = np.argmax(np.array(waveform["gain_db"]) < gain - 3)
    bandwidth = waveform["freq"][bw_idx]
    slew = max(np.diff(waveform["vout"]) / np.diff(waveform["time"]))
    return {"gain_db": gain, "bandwidth": bandwidth, "slew_rate": slew}`,
    tags: ["measurement", "analog", "waveform", "extraction"],
    downloads: 156,
    rating: 4.1,
    createdAt: Date.now() - 86400000 * 15,
    updatedAt: Date.now() - 86400000 * 2,
    category: "measurement",
  },
];

const DEMO_TEMPLATES: LayoutTemplate[] = [
  {
    id: "tmpl-1", name: "CMOS Inverter (GF180)", description: "Standard CMOS inverter layout with guard ring, well ties, and DRC-clean geometry",
    author: "opensilicon", thumbnail: "", category: "standard_cell", pdk: "GF180MCU",
    layers: 6, geometryCount: 24, geometries: [],
    tags: ["inverter", "cmos", "standard-cell", "gf180"], downloads: 1240, rating: 4.9, createdAt: Date.now() - 86400000 * 90,
  },
  {
    id: "tmpl-2", name: "Differential Pair (IHP SG13G2)", description: "Matched differential pair with common-centroid layout for low offset",
    author: "analog_lab", thumbnail: "", category: "analog_block", pdk: "IHP SG13G2",
    layers: 5, geometryCount: 42, geometries: [],
    tags: ["diff-pair", "analog", "matched", "sg13g2"], downloads: 876, rating: 4.7, createdAt: Date.now() - 86400000 * 60,
  },
  {
    id: "tmpl-3", name: "QFN-48 Pad Frame", description: "Complete QFN-48 pad frame with ESD protection and core/IO power rings",
    author: "io_design", thumbnail: "", category: "pad_frame", pdk: "GF180MCU",
    layers: 8, geometryCount: 256, geometries: [],
    tags: ["pad-frame", "qfn", "esd", "io"], downloads: 543, rating: 4.5, createdAt: Date.now() - 86400000 * 45,
  },
  {
    id: "tmpl-4", name: "Ring Oscillator Test Structure", description: "11-stage ring oscillator for process characterization",
    author: "test_eng", thumbnail: "", category: "test_structure", pdk: "GF180MCU",
    layers: 4, geometryCount: 88, geometries: [],
    tags: ["ring-osc", "test", "characterization", "frequency"], downloads: 321, rating: 4.3, createdAt: Date.now() - 86400000 * 30,
  },
  {
    id: "tmpl-5", name: "6T SRAM Cell", description: "6-transistor SRAM bit cell with read/write ports optimized for density",
    author: "memory_dev", thumbnail: "", category: "memory", pdk: "IHP SG13G2",
    layers: 6, geometryCount: 36, geometries: [],
    tags: ["sram", "memory", "6t", "bitcell"], downloads: 698, rating: 4.6, createdAt: Date.now() - 86400000 * 75,
  },
];

const DEMO_CONTRIBUTIONS: CommunityContribution[] = [
  {
    id: "contrib-1", type: "plugin", title: "Sky130 PDK Plugin", author: "skywater_contrib",
    description: "Full SkyWater 130nm PDK support with all layers, rules, and device generators",
    stars: 89, status: "featured", submittedAt: Date.now() - 86400000 * 120, reviewedAt: Date.now() - 86400000 * 110,
    comments: [
      { id: "cc-1", author: "reviewer1", text: "Excellent coverage of all rules. Merged!", timestamp: Date.now() - 86400000 * 110 },
    ],
  },
  {
    id: "contrib-2", type: "tutorial", title: "Advanced Guard Ring Techniques", author: "analog_guru",
    description: "Tutorial covering double guard rings, deep-nwell isolation, and substrate shielding",
    stars: 45, status: "approved", submittedAt: Date.now() - 86400000 * 30, reviewedAt: Date.now() - 86400000 * 25,
    comments: [],
  },
  {
    id: "contrib-3", type: "rule_deck", title: "Custom Reliability DRC Deck", author: "reliability_team",
    description: "Additional DRC rules for electromigration, self-heating, and hot-carrier injection checks",
    stars: 32, status: "under_review", submittedAt: Date.now() - 86400000 * 7,
    comments: [
      { id: "cc-2", author: "maintainer", text: "Looks promising, need to validate rules against reference.", timestamp: Date.now() - 86400000 * 3 },
    ],
  },
  {
    id: "contrib-4", type: "snippet", title: "Batch DRC Runner", author: "automation_fan",
    description: "Script to run DRC across all cells in a library and generate summary report",
    stars: 28, status: "approved", submittedAt: Date.now() - 86400000 * 14, reviewedAt: Date.now() - 86400000 * 10,
    comments: [],
  },
  {
    id: "contrib-5", type: "template", title: "Bandgap Reference Layout", author: "precision_circuits",
    description: "Complete bandgap reference layout with trimming resistors and startup circuit",
    stars: 56, status: "submitted", submittedAt: Date.now() - 86400000 * 2,
    comments: [],
  },
];

// ── Store ─────────────────────────────────────────────────────────

interface CommunityState {
  // ── Snippets ──
  snippets: CodeSnippet[];
  selectedSnippetId: string | null;
  snippetSearch: string;
  snippetCategory: SnippetCategory | "all";
  setSnippetSearch: (text: string) => void;
  setSnippetCategory: (cat: SnippetCategory | "all") => void;
  selectSnippet: (id: string | null) => void;
  getFilteredSnippets: () => CodeSnippet[];
  copySnippet: (id: string) => void;

  // ── Templates ──
  templates: LayoutTemplate[];
  selectedTemplateId: string | null;
  templateSearch: string;
  templateCategory: TemplateCategory | "all";
  setTemplateSearch: (text: string) => void;
  setTemplateCategory: (cat: TemplateCategory | "all") => void;
  selectTemplate: (id: string | null) => void;
  getFilteredTemplates: () => LayoutTemplate[];
  useTemplate: (id: string) => CanvasGeometry[];

  // ── Contributions ──
  contributions: CommunityContribution[];
  selectedContributionId: string | null;
  selectContribution: (id: string | null) => void;
  submitContribution: (contrib: Omit<CommunityContribution, "id" | "stars" | "status" | "submittedAt" | "comments">) => void;
  addComment: (contribId: string, text: string) => void;

  // ── Stats ──
  getStats: () => CommunityStats;

  // ── Active tab ──
  activeTab: "snippets" | "templates" | "contributions" | "stats";
  setActiveTab: (tab: "snippets" | "templates" | "contributions" | "stats") => void;
}

export const useCommunityStore = create<CommunityState>((set, get) => ({
  // ── Snippets ──
  snippets: DEMO_SNIPPETS,
  selectedSnippetId: null,
  snippetSearch: "",
  snippetCategory: "all",

  setSnippetSearch(text) { set({ snippetSearch: text }); },
  setSnippetCategory(cat) { set({ snippetCategory: cat }); },
  selectSnippet(id) { set({ selectedSnippetId: id }); },

  getFilteredSnippets() {
    const { snippets, snippetSearch, snippetCategory } = get();
    let filtered = snippets;
    if (snippetCategory !== "all") {
      filtered = filtered.filter((s) => s.category === snippetCategory);
    }
    if (snippetSearch.trim()) {
      const q = snippetSearch.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.tags.some((t) => t.includes(q)) ||
          s.author.toLowerCase().includes(q)
      );
    }
    return filtered;
  },

  copySnippet(id) {
    const snip = get().snippets.find((s) => s.id === id);
    if (snip) {
      navigator.clipboard?.writeText(snip.code).catch(() => {});
      // Increment download count
      set({
        snippets: get().snippets.map((s) =>
          s.id === id ? { ...s, downloads: s.downloads + 1 } : s
        ),
      });
    }
  },

  // ── Templates ──
  templates: DEMO_TEMPLATES,
  selectedTemplateId: null,
  templateSearch: "",
  templateCategory: "all",

  setTemplateSearch(text) { set({ templateSearch: text }); },
  setTemplateCategory(cat) { set({ templateCategory: cat }); },
  selectTemplate(id) { set({ selectedTemplateId: id }); },

  getFilteredTemplates() {
    const { templates, templateSearch, templateCategory } = get();
    let filtered = templates;
    if (templateCategory !== "all") {
      filtered = filtered.filter((t) => t.category === templateCategory);
    }
    if (templateSearch.trim()) {
      const q = templateSearch.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.includes(q)) ||
          t.pdk.toLowerCase().includes(q)
      );
    }
    return filtered;
  },

  useTemplate(id) {
    const tmpl = get().templates.find((t) => t.id === id);
    if (!tmpl) return [];
    set({
      templates: get().templates.map((t) =>
        t.id === id ? { ...t, downloads: t.downloads + 1 } : t
      ),
    });
    return tmpl.geometries;
  },

  // ── Contributions ──
  contributions: DEMO_CONTRIBUTIONS,
  selectedContributionId: null,

  selectContribution(id) { set({ selectedContributionId: id }); },

  submitContribution(contrib) {
    const newContrib: CommunityContribution = {
      ...contrib,
      id: `contrib-${Date.now()}`,
      stars: 0,
      status: "submitted",
      submittedAt: Date.now(),
      comments: [],
    };
    set({ contributions: [...get().contributions, newContrib] });
  },

  addComment(contribId, text) {
    set({
      contributions: get().contributions.map((c) =>
        c.id === contribId
          ? {
              ...c,
              comments: [
                ...c.comments,
                { id: `cc-${Date.now()}`, author: "You", text, timestamp: Date.now() },
              ],
            }
          : c
      ),
    });
  },

  // ── Stats ──
  getStats() {
    const { snippets, templates, contributions } = get();
    const authors = new Set([
      ...snippets.map((s) => s.author),
      ...templates.map((t) => t.author),
      ...contributions.map((c) => c.author),
    ]);
    const authorCounts = new Map<string, number>();
    for (const s of snippets) authorCounts.set(s.author, (authorCounts.get(s.author) ?? 0) + 1);
    for (const t of templates) authorCounts.set(t.author, (authorCounts.get(t.author) ?? 0) + 1);
    for (const c of contributions) authorCounts.set(c.author, (authorCounts.get(c.author) ?? 0) + 1);

    const topContributors = [...authorCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, contributions]) => ({ name, contributions }));

    return {
      totalPlugins: 9, // from marketplaceStore
      totalSnippets: snippets.length,
      totalTemplates: templates.length,
      totalContributions: contributions.length,
      activeContributors: authors.size,
      topContributors,
    };
  },

  // ── Active tab ──
  activeTab: "snippets",
  setActiveTab(tab) { set({ activeTab: tab }); },
}));
