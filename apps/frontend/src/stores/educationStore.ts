/**
 * Education Mode Engine — Sprint 31-32
 *
 * Tutorial framework, guided labs, visual DRC/LVS rule explorer,
 * auto-grading, and 3-D cross-section viewer data model.
 */

import { create } from "zustand";

// ══════════════════════════════════════════════════════════════════════
// Tutorial / Lab Framework
// ══════════════════════════════════════════════════════════════════════

export interface TutorialStep {
  id: string;
  title: string;
  content: string;       // Markdown body
  hint?: string;
  /** Optional highlight target (panel id, component selector, etc.) */
  highlightTarget?: string;
  /** Validation function name — resolved at runtime */
  validator?: string;
  completed: boolean;
}

export interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: "basics" | "layout" | "simulation" | "verification" | "advanced";
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedMinutes: number;
  steps: TutorialStep[];
  prerequisites: string[];  // tutorial IDs
}

export interface Lab {
  id: string;
  title: string;
  description: string;
  category: Tutorial["category"];
  difficulty: Tutorial["difficulty"];
  estimatedMinutes: number;
  objectives: string[];
  /** Initial layout state (JSON-serialisable) */
  starterDesign?: object;
  /** Rubric items for auto-grading */
  rubric: RubricItem[];
  /** Completed flag */
  completed: boolean;
  /** Student score, 0-100 */
  score: number | null;
}

export interface RubricItem {
  id: string;
  description: string;
  points: number;
  /** Automatic check type */
  checkType: "drc_clean" | "lvs_clean" | "layer_exists" | "cell_count" | "area_limit" | "custom";
  /** Parameters for the check */
  checkParams?: Record<string, unknown>;
  passed: boolean;
}

// ── 3-D Cross Section ─────────────────────────────────────────────

export interface CrossSectionLayer {
  name: string;
  material: string;
  yBottom: number;   // µm from substrate
  thickness: number; // µm
  color: string;
  pattern: "solid" | "hatch" | "dots";
}

export interface CrossSectionCut {
  /** Cut-line start/end in layout coordinates */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  layers: CrossSectionLayer[];
}

// ── Visual Rule Explorer ──────────────────────────────────────────

export interface VisualRule {
  id: string;
  name: string;
  category: "width" | "spacing" | "enclosure" | "extension" | "area" | "density";
  description: string;
  /** Markdown formatted explanation with diagrams */
  detailedExplanation: string;
  /** SVG diagram — inline or reference */
  diagramSvg?: string;
  value: number;
  unit: string;
  layer: string;
  relatedRules: string[];
}

// ══════════════════════════════════════════════════════════════════════
// Built-in Tutorials
// ══════════════════════════════════════════════════════════════════════

const builtInTutorials: Tutorial[] = [
  {
    id: "tut-welcome",
    title: "Welcome to OpenSilicon",
    description: "Get familiar with the IDE layout, panels, and basic navigation.",
    category: "basics",
    difficulty: "beginner",
    estimatedMinutes: 10,
    prerequisites: [],
    steps: [
      { id: "w1", title: "The Activity Bar", content: "The **Activity Bar** on the left gives you access to all major panels — Cell Hierarchy, Layers, Component Library, Simulation, and more.\n\nClick each icon to explore.", highlightTarget: "activity-bar", completed: false },
      { id: "w2", title: "The Canvas", content: "The central **canvas** is where your layout lives. Use **scroll** to zoom and **middle-click drag** to pan.\n\nTry zooming in and out now.", highlightTarget: "layout-canvas", completed: false },
      { id: "w3", title: "The Toolbar", content: "The **toolbar** at the top provides drawing tools — Select, Rectangle, Polygon, Path, and Via.\n\nSelect the Rectangle tool.", highlightTarget: "toolbar", completed: false },
      { id: "w4", title: "Draw Your First Rectangle", content: "With the Rectangle tool active, click and drag on the canvas to draw a metal1 rectangle.\n\n> Tip: Make sure the **M1** layer is selected in the Layers panel.", validator: "hasRectangle", completed: false },
      { id: "w5", title: "The Properties Panel", content: "Click your rectangle to see its properties in the **Properties** panel — position, size, layer, net name.\n\nTry changing its width.", highlightTarget: "properties-panel", completed: false },
    ],
  },
  {
    id: "tut-inverter-layout",
    title: "Inverter Layout",
    description: "Create a CMOS inverter layout from scratch using NMOS and PMOS devices.",
    category: "layout",
    difficulty: "beginner",
    estimatedMinutes: 25,
    prerequisites: ["tut-welcome"],
    steps: [
      { id: "inv1", title: "Place NMOS", content: "Open the **Component Library** panel and drag an NMOS transistor onto the canvas.\n\nSet W=0.42µm, L=0.15µm.", validator: "hasNmos", completed: false },
      { id: "inv2", title: "Place PMOS", content: "Place a PMOS transistor above the NMOS.\n\nSet W=0.84µm (2× NMOS width for balanced switching) and L=0.15µm.", validator: "hasPmos", completed: false },
      { id: "inv3", title: "Connect Gates", content: "Draw a **poly path** connecting the gates of both transistors. This is your **input (A)**.", validator: "gatesConnected", completed: false },
      { id: "inv4", title: "Connect Drains", content: "Draw a **metal1 path** connecting the drains. This is your **output (Y)**.", validator: "drainsConnected", completed: false },
      { id: "inv5", title: "Add Power Rails", content: "Draw VDD (top) and VSS (bottom) metal1 rails. Connect PMOS source to VDD and NMOS source to VSS.", validator: "powerConnected", completed: false },
      { id: "inv6", title: "Run DRC", content: "Click **Verification → Run DRC** to check your layout. Fix any violations until you see ✓ Clean.", validator: "drcClean", completed: false },
      { id: "inv7", title: "Run LVS", content: "Click **Verification → Run LVS** to compare schematic vs layout. Fix any mismatches.", validator: "lvsClean", completed: false },
    ],
  },
  {
    id: "tut-simulation-intro",
    title: "Running Your First Simulation",
    description: "Extract a netlist from your layout, run SPICE simulation, and view waveforms.",
    category: "simulation",
    difficulty: "beginner",
    estimatedMinutes: 15,
    prerequisites: ["tut-inverter-layout"],
    steps: [
      { id: "sim1", title: "Extract Netlist", content: "Go to **Simulation → Extract Netlist**. This converts your layout into a SPICE netlist.", validator: "netlistExtracted", completed: false },
      { id: "sim2", title: "Configure Stimulus", content: "Set up a pulse input on net A: V1=0, V2=1.8V, rise=50ps, period=2ns.", completed: false },
      { id: "sim3", title: "Run Transient", content: "Click **Run Simulation** with transient analysis: tstop=10ns, tstep=10ps.", validator: "simCompleted", completed: false },
      { id: "sim4", title: "View Waveforms", content: "Switch to the **Waveform** tab to see Vout vs time. Measure rise time using cursors.", completed: false },
    ],
  },
  {
    id: "tut-guard-rings",
    title: "Guard Rings & Latch-up Prevention",
    description: "Learn why guard rings are needed and how to add them around sensitive devices.",
    category: "verification",
    difficulty: "intermediate",
    estimatedMinutes: 20,
    prerequisites: ["tut-inverter-layout"],
    steps: [
      { id: "gr1", title: "What Is Latch-up?", content: "Latch-up is a parasitic effect in CMOS where a **thyristor** (PNPN) path forms between VDD and VSS, causing destructive current flow.\n\n**Guard rings** break this path by collecting minority carriers.", completed: false },
      { id: "gr2", title: "Add N+ Guard Ring", content: "Select your NMOS device → right-click → **Add Guard Ring → N+ Ring**.\n\nThis ties the substrate to VSS around the NMOS.", validator: "hasNGuardRing", completed: false },
      { id: "gr3", title: "Add P+ Guard Ring", content: "Select your PMOS device → **Add Guard Ring → P+ Ring**.\n\nThis ties the N-well to VDD.", validator: "hasPGuardRing", completed: false },
      { id: "gr4", title: "Verify Continuity", content: "Run DRC to confirm the guard ring contacts are properly connected to their respective supplies.", validator: "drcClean", completed: false },
    ],
  },
  {
    id: "tut-monte-carlo",
    title: "Monte Carlo Analysis",
    description: "Understand process variation and run Monte Carlo simulations to evaluate yield.",
    category: "advanced",
    difficulty: "advanced",
    estimatedMinutes: 30,
    prerequisites: ["tut-simulation-intro"],
    steps: [
      { id: "mc1", title: "Why Monte Carlo?", content: "Real transistors have **random variation** in threshold voltage, oxide thickness, and other parameters. Monte Carlo simulation randomises these parameters across many runs to estimate **yield** and **robustness**.", completed: false },
      { id: "mc2", title: "Configure Parameters", content: "Open **Monte Carlo** panel. Add VTH0 (σ=25mV) and TOX parameters. Set N=100 runs.", completed: false },
      { id: "mc3", title: "Define Measurements", content: "Add measurements: rise time, propagation delay, and offset voltage. These will be extracted from each run.", completed: false },
      { id: "mc4", title: "Run Simulation", content: "Click **Run Monte Carlo**. Watch the progress bar as 100 simulations execute.", validator: "mcCompleted", completed: false },
      { id: "mc5", title: "Analyse Results", content: "View the **histogram** for each measurement. Check mean, σ, and yield percentage. Is yield > 99.7% (3σ)?", completed: false },
    ],
  },
];

// ══════════════════════════════════════════════════════════════════════
// Built-in Labs
// ══════════════════════════════════════════════════════════════════════

const builtInLabs: Lab[] = [
  {
    id: "lab-inv-layout",
    title: "Lab 1: CMOS Inverter Layout",
    description: "Design a DRC/LVS-clean CMOS inverter in SKY130 PDK.",
    category: "layout",
    difficulty: "beginner",
    estimatedMinutes: 45,
    objectives: [
      "Place NMOS and PMOS transistors with correct sizing",
      "Route all connections on metal1",
      "Add substrate and well contacts",
      "Pass DRC with zero violations",
      "Pass LVS against the inverter schematic",
    ],
    rubric: [
      { id: "r1", description: "NMOS placed with W ≥ 0.42µm", points: 15, checkType: "layer_exists", passed: false },
      { id: "r2", description: "PMOS placed with W ≥ 0.84µm", points: 15, checkType: "layer_exists", passed: false },
      { id: "r3", description: "All nets connected", points: 20, checkType: "lvs_clean", passed: false },
      { id: "r4", description: "DRC clean", points: 25, checkType: "drc_clean", passed: false },
      { id: "r5", description: "LVS clean", points: 25, checkType: "lvs_clean", passed: false },
    ],
    completed: false,
    score: null,
  },
  {
    id: "lab-diffpair",
    title: "Lab 2: Differential Pair Layout",
    description: "Layout a matched differential pair using common-centroid and interdigitation techniques.",
    category: "layout",
    difficulty: "intermediate",
    estimatedMinutes: 60,
    objectives: [
      "Use interdigitated layout for NMOS pair",
      "Apply common-centroid placement",
      "Add dummy devices at edges",
      "Achieve symmetry in routing",
      "Pass DRC and LVS",
    ],
    rubric: [
      { id: "r1", description: "Interdigitated structure (ABBA or ABAB)", points: 20, checkType: "custom", passed: false },
      { id: "r2", description: "Common-centroid arrangement", points: 15, checkType: "custom", passed: false },
      { id: "r3", description: "Dummy devices present", points: 10, checkType: "cell_count", checkParams: { minCount: 2 }, passed: false },
      { id: "r4", description: "DRC clean", points: 25, checkType: "drc_clean", passed: false },
      { id: "r5", description: "LVS clean", points: 20, checkType: "lvs_clean", passed: false },
      { id: "r6", description: "Layout area ≤ 100µm²", points: 10, checkType: "area_limit", checkParams: { maxArea: 100 }, passed: false },
    ],
    completed: false,
    score: null,
  },
  {
    id: "lab-opamp-sim",
    title: "Lab 3: Op-Amp Characterization",
    description: "Simulate a two-stage op-amp: AC analysis for gain/bandwidth, transient for slew rate.",
    category: "simulation",
    difficulty: "advanced",
    estimatedMinutes: 75,
    objectives: [
      "Extract netlist from op-amp layout",
      "Run AC analysis to measure open-loop gain and GBW",
      "Run transient analysis to measure slew rate",
      "Run corner analysis across TT/FF/SS",
      "Achieve gain > 60dB and GBW > 10MHz across all corners",
    ],
    rubric: [
      { id: "r1", description: "Netlist extracted successfully", points: 10, checkType: "custom", passed: false },
      { id: "r2", description: "Open-loop gain > 60dB (TT)", points: 20, checkType: "custom", passed: false },
      { id: "r3", description: "GBW > 10MHz (TT)", points: 20, checkType: "custom", passed: false },
      { id: "r4", description: "Slew rate > 5V/µs", points: 15, checkType: "custom", passed: false },
      { id: "r5", description: "All corners passing specs", points: 25, checkType: "custom", passed: false },
      { id: "r6", description: "Phase margin > 60°", points: 10, checkType: "custom", passed: false },
    ],
    completed: false,
    score: null,
  },
];

// ══════════════════════════════════════════════════════════════════════
// Built-in Visual Rules (sample)
// ══════════════════════════════════════════════════════════════════════

const builtInVisualRules: VisualRule[] = [
  {
    id: "vr-min-width",
    name: "Minimum Width",
    category: "width",
    description: "Every drawn shape on a layer must be at least this wide.",
    detailedExplanation: "**Minimum width** ensures that a feature can be reliably manufactured. If a line is too thin, it may break during etching or suffer from electromigration.\n\n```\n ┌─────┐\n │ OK  │  width ≥ min_width ✓\n └─────┘\n ┌──┐\n │XX│  width < min_width ✗\n └──┘\n```",
    value: 0.14,
    unit: "µm",
    layer: "met1.drawing",
    relatedRules: ["vr-min-spacing"],
  },
  {
    id: "vr-min-spacing",
    name: "Minimum Spacing",
    category: "spacing",
    description: "Two shapes on the same layer must be separated by at least this distance.",
    detailedExplanation: "**Minimum spacing** prevents shorts between adjacent features. The space between two polygons on the same layer must meet the rule.\n\n```\n ┌───┐   ┌───┐\n │ A │←s→│ B │  s ≥ min_spacing ✓\n └───┘   └───┘\n```",
    value: 0.14,
    unit: "µm",
    layer: "met1.drawing",
    relatedRules: ["vr-min-width"],
  },
  {
    id: "vr-enclosure",
    name: "Enclosure",
    category: "enclosure",
    description: "A via must be enclosed by the surrounding metal by at least this amount on each side.",
    detailedExplanation: "**Enclosure** (also called overlap) ensures reliable electrical contact between a via and the metal layers above/below.\n\n```\n ┌─────────────┐\n │  metal1      │\n │  ┌───────┐   │\n │  │  via  │←e │  e ≥ enclosure ✓\n │  └───────┘   │\n └─────────────┘\n```",
    value: 0.06,
    unit: "µm",
    layer: "via1.drawing",
    relatedRules: [],
  },
  {
    id: "vr-min-area",
    name: "Minimum Area",
    category: "area",
    description: "Every polygon on this layer must have an area greater than the minimum.",
    detailedExplanation: "Very small metal islands can become detached during CMP (Chemical Mechanical Polishing). The minimum area rule prevents this.\n\n```\n ┌─────────┐\n │  area   │  area ≥ min_area ✓\n │  > 0.06 │\n └─────────┘\n```",
    value: 0.06,
    unit: "µm²",
    layer: "met1.drawing",
    relatedRules: ["vr-min-width"],
  },
  {
    id: "vr-density",
    name: "Metal Density",
    category: "density",
    description: "The ratio of metal area to total area in any window must be within bounds.",
    detailedExplanation: "**Density rules** ensure uniform CMP polishing. If a region has too little metal, fill shapes are added. Too much metal can also cause issues.\n\nTypical range: 20% – 80% metal density per 50µm × 50µm window.",
    value: 30,
    unit: "%",
    layer: "met1.drawing",
    relatedRules: [],
  },
];

// ══════════════════════════════════════════════════════════════════════
// 3-D Cross-Section Demo Generator
// ══════════════════════════════════════════════════════════════════════

export function generateDemoCrossSection(): CrossSectionCut {
  return {
    x1: 0, y1: 5, x2: 20, y2: 5,
    layers: [
      { name: "Substrate (P-type)", material: "silicon",   yBottom: 0,    thickness: 2.0, color: "#8B7355", pattern: "solid" },
      { name: "N-Well",            material: "nwell",     yBottom: 0.5,  thickness: 1.0, color: "#6B8E9B", pattern: "hatch" },
      { name: "Field Oxide",       material: "oxide",     yBottom: 2.0,  thickness: 0.4, color: "#D4E6F1", pattern: "solid" },
      { name: "Gate Oxide",        material: "oxide",     yBottom: 2.0,  thickness: 0.008, color: "#EBF5FB", pattern: "solid" },
      { name: "Polysilicon",       material: "poly",      yBottom: 2.4,  thickness: 0.18, color: "#CC4444", pattern: "solid" },
      { name: "ILD-1",            material: "oxide",     yBottom: 2.4,  thickness: 0.55, color: "#D5F5E3", pattern: "dots" },
      { name: "Contact",          material: "tungsten",  yBottom: 2.4,  thickness: 0.55, color: "#808080", pattern: "solid" },
      { name: "Metal 1",          material: "aluminium", yBottom: 2.95, thickness: 0.36, color: "#4488CC", pattern: "solid" },
      { name: "IMD-1",            material: "oxide",     yBottom: 3.31, thickness: 0.42, color: "#D5F5E3", pattern: "dots" },
      { name: "Via 1",            material: "tungsten",  yBottom: 3.31, thickness: 0.42, color: "#808080", pattern: "solid" },
      { name: "Metal 2",          material: "aluminium", yBottom: 3.73, thickness: 0.36, color: "#448844", pattern: "solid" },
      { name: "Passivation",      material: "nitride",   yBottom: 4.09, thickness: 0.5,  color: "#FAD7A0", pattern: "hatch" },
    ],
  };
}

// ══════════════════════════════════════════════════════════════════════
// Zustand Store
// ══════════════════════════════════════════════════════════════════════

interface EducationStoreState {
  /** Education mode active */
  enabled: boolean;

  /** Simplified UI mode (hides advanced panels) */
  simplifiedUI: boolean;

  /** Tutorials */
  tutorials: Tutorial[];
  activeTutorialId: string | null;
  activeStepIndex: number;

  /** Labs */
  labs: Lab[];
  activeLabId: string | null;

  /** Visual rules */
  visualRules: VisualRule[];
  activeRuleId: string | null;

  /** 3-D cross-section */
  crossSection: CrossSectionCut | null;
  crossSectionVisible: boolean;

  /** Student progress */
  completedTutorials: string[];
  labScores: Record<string, number>;

  // ── Actions ──

  toggleEducationMode: () => void;
  setSimplifiedUI: (on: boolean) => void;

  // Tutorials
  startTutorial: (id: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  completeStep: (stepIndex: number) => void;
  resetTutorial: (id: string) => void;
  closeTutorial: () => void;

  // Labs
  startLab: (id: string) => void;
  gradeRubricItem: (labId: string, rubricId: string, passed: boolean) => void;
  autoGradeLab: (labId: string) => void;
  closeLab: () => void;

  // Visual rules
  setActiveRule: (id: string | null) => void;

  // Cross-section
  showCrossSection: () => void;
  hideCrossSection: () => void;
}

export const useEducationStore = create<EducationStoreState>((set, get) => ({
  enabled: false,
  simplifiedUI: false,
  tutorials: builtInTutorials,
  activeTutorialId: null,
  activeStepIndex: 0,
  labs: builtInLabs,
  activeLabId: null,
  visualRules: builtInVisualRules,
  activeRuleId: null,
  crossSection: null,
  crossSectionVisible: false,
  completedTutorials: [],
  labScores: {},

  toggleEducationMode: () =>
    set((s) => ({ enabled: !s.enabled, simplifiedUI: !s.enabled })),

  setSimplifiedUI: (on) => set({ simplifiedUI: on }),

  // ── Tutorials ──

  startTutorial: (id) => {
    const tut = get().tutorials.find((t) => t.id === id);
    if (!tut) return;
    set({ activeTutorialId: id, activeStepIndex: 0 });
  },

  nextStep: () =>
    set((s) => {
      const tut = s.tutorials.find((t) => t.id === s.activeTutorialId);
      if (!tut) return {};
      const next = Math.min(s.activeStepIndex + 1, tut.steps.length - 1);
      return { activeStepIndex: next };
    }),

  prevStep: () =>
    set((s) => ({ activeStepIndex: Math.max(0, s.activeStepIndex - 1) })),

  completeStep: (stepIndex) =>
    set((s) => {
      const tutorials = s.tutorials.map((t) => {
        if (t.id !== s.activeTutorialId) return t;
        const steps = t.steps.map((step, i) =>
          i === stepIndex ? { ...step, completed: true } : step,
        );
        return { ...t, steps };
      });

      // Check if all steps complete
      const tut = tutorials.find((t) => t.id === s.activeTutorialId);
      const allDone = tut?.steps.every((st) => st.completed) ?? false;
      const completedTutorials = allDone && s.activeTutorialId
        ? [...new Set([...s.completedTutorials, s.activeTutorialId])]
        : s.completedTutorials;

      return { tutorials, completedTutorials };
    }),

  resetTutorial: (id) =>
    set((s) => ({
      tutorials: s.tutorials.map((t) =>
        t.id === id
          ? { ...t, steps: t.steps.map((st) => ({ ...st, completed: false })) }
          : t,
      ),
      completedTutorials: s.completedTutorials.filter((tid) => tid !== id),
    })),

  closeTutorial: () =>
    set({ activeTutorialId: null, activeStepIndex: 0 }),

  // ── Labs ──

  startLab: (id) => set({ activeLabId: id }),

  gradeRubricItem: (labId, rubricId, passed) =>
    set((s) => ({
      labs: s.labs.map((lab) => {
        if (lab.id !== labId) return lab;
        const rubric = lab.rubric.map((r) =>
          r.id === rubricId ? { ...r, passed } : r,
        );
        const totalPoints = rubric.reduce((sum, r) => sum + r.points, 0);
        const earnedPoints = rubric.filter((r) => r.passed).reduce((sum, r) => sum + r.points, 0);
        const score = Math.round((earnedPoints / totalPoints) * 100);
        const completed = rubric.every((r) => r.passed);
        return { ...lab, rubric, score, completed };
      }),
    })),

  autoGradeLab: (labId) => {
    const lab = get().labs.find((l) => l.id === labId);
    if (!lab) return;
    // Demo: randomly grade (in real impl, would check actual layout)
    for (const item of lab.rubric) {
      const passed = Math.random() > 0.3;
      get().gradeRubricItem(labId, item.id, passed);
    }
    // Record score
    const updated = get().labs.find((l) => l.id === labId);
    if (updated?.score != null) {
      set((s) => ({
        labScores: { ...s.labScores, [labId]: updated.score! },
      }));
    }
  },

  closeLab: () => set({ activeLabId: null }),

  // ── Visual Rules ──

  setActiveRule: (id) => set({ activeRuleId: id }),

  // ── Cross-Section ──

  showCrossSection: () =>
    set({ crossSection: generateDemoCrossSection(), crossSectionVisible: true }),

  hideCrossSection: () =>
    set({ crossSectionVisible: false }),
}));
