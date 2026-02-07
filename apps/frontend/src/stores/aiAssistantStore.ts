/**
 * AI Assistant Store — Sprint 33-34
 *
 * DRC fix suggestions, natural language commands,
 * and design review copilot.
 */

import { create } from "zustand";
import type { DrcViolation } from "../engines/drc";
import type { CanvasGeometry } from "./geometryStore";
import type { DesignRuleType } from "../plugins/types";

// ── Types ─────────────────────────────────────────────────────────

export interface DrcFixSuggestion {
  id: string;
  violationId: string;
  ruleType: DesignRuleType;
  description: string;
  /** What the fix will do */
  action: FixAction;
  /** Estimated confidence 0-1 */
  confidence: number;
  /** Preview of changes */
  preview: GeometryPatch[];
  /** Applied status */
  applied: boolean;
}

export type FixAction =
  | { type: "resize"; geometryIndex: number; newWidth: number; newHeight: number }
  | { type: "move"; geometryIndex: number; dx: number; dy: number }
  | { type: "add_guard"; geometryIndex: number; guardLayer: number; margin: number }
  | { type: "merge"; geometryIndices: number[] }
  | { type: "split"; geometryIndex: number; splitAt: number };

export interface GeometryPatch {
  index: number;
  before: Partial<CanvasGeometry>;
  after: Partial<CanvasGeometry>;
}

export interface NLCommand {
  id: string;
  text: string;
  timestamp: number;
  parsed: ParsedCommand | null;
  status: "pending" | "parsed" | "executed" | "error";
  result?: string;
}

export interface ParsedCommand {
  intent: NLIntent;
  entities: Record<string, string | number>;
  confidence: number;
  resolvedAction: string;
}

export type NLIntent =
  | "draw_rect" | "draw_poly" | "draw_path" | "draw_via"
  | "select_layer" | "set_grid" | "zoom_to" | "measure"
  | "run_drc" | "run_lvs" | "run_sim"
  | "undo" | "redo" | "save" | "export"
  | "query_info" | "unknown";

export interface DesignReview {
  id: string;
  timestamp: number;
  status: "running" | "completed" | "error";
  findings: ReviewFinding[];
  score: number; // 0-100
  summary: string;
}

export interface ReviewFinding {
  id: string;
  category: ReviewCategory;
  severity: "critical" | "major" | "minor" | "info";
  description: string;
  location?: { x: number; y: number; w: number; h: number };
  layerId?: number;
  suggestion?: string;
}

export type ReviewCategory =
  | "drc_pattern"
  | "electromigration"
  | "antenna"
  | "density"
  | "symmetry"
  | "matching"
  | "guard_ring"
  | "well_tie"
  | "power_routing"
  | "signal_integrity";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  suggestions?: string[];
}

// ── Fix suggestion engine ─────────────────────────────────────────

function generateFixSuggestions(violation: DrcViolation): DrcFixSuggestion[] {
  const fixes: DrcFixSuggestion[] = [];
  const vid = violation.id;
  const idx = violation.geometryIndices[0] ?? 0;

  switch (violation.ruleType) {
    case "min_width": {
      const deficit = (violation.requiredValue ?? 0) - (violation.actualValue ?? 0);
      if (deficit > 0) {
        fixes.push({
          id: `fix-${vid}-widen`,
          violationId: vid,
          ruleType: "min_width",
          description: `Increase width by ${deficit.toFixed(3)}µm to meet minimum`,
          action: { type: "resize", geometryIndex: idx, newWidth: violation.requiredValue ?? 0, newHeight: 0 },
          confidence: 0.92,
          preview: [{ index: idx, before: {}, after: {} }],
          applied: false,
        });
      }
      break;
    }
    case "min_spacing": {
      const deficit = (violation.requiredValue ?? 0) - (violation.actualValue ?? 0);
      if (deficit > 0) {
        fixes.push({
          id: `fix-${vid}-space`,
          violationId: vid,
          ruleType: "min_spacing",
          description: `Move apart by ${deficit.toFixed(3)}µm to satisfy spacing rule`,
          action: { type: "move", geometryIndex: idx, dx: deficit, dy: 0 },
          confidence: 0.85,
          preview: [{ index: idx, before: {}, after: {} }],
          applied: false,
        });
        if (violation.geometryIndices.length >= 2) {
          fixes.push({
            id: `fix-${vid}-merge`,
            violationId: vid,
            ruleType: "min_spacing",
            description: "Merge adjacent geometries to eliminate narrow space",
            action: { type: "merge", geometryIndices: violation.geometryIndices },
            confidence: 0.65,
            preview: violation.geometryIndices.map((i) => ({ index: i, before: {}, after: {} })),
            applied: false,
          });
        }
      }
      break;
    }
    case "min_enclosure": {
      const deficit = (violation.requiredValue ?? 0) - (violation.actualValue ?? 0);
      fixes.push({
        id: `fix-${vid}-enclose`,
        violationId: vid,
        ruleType: "min_enclosure",
        description: `Extend enclosing layer by ${deficit.toFixed(3)}µm on each side`,
        action: { type: "resize", geometryIndex: idx, newWidth: deficit * 2, newHeight: deficit * 2 },
        confidence: 0.80,
        preview: [{ index: idx, before: {}, after: {} }],
        applied: false,
      });
      break;
    }
    case "min_area": {
      fixes.push({
        id: `fix-${vid}-area`,
        violationId: vid,
        ruleType: "min_area",
        description: "Increase geometry area to meet minimum area rule",
        action: { type: "resize", geometryIndex: idx, newWidth: 0, newHeight: 0 },
        confidence: 0.75,
        preview: [{ index: idx, before: {}, after: {} }],
        applied: false,
      });
      break;
    }
    default: {
      fixes.push({
        id: `fix-${vid}-generic`,
        violationId: vid,
        ruleType: violation.ruleType as DesignRuleType,
        description: `Manual fix required: ${violation.description}`,
        action: { type: "move", geometryIndex: idx, dx: 0, dy: 0 },
        confidence: 0.40,
        preview: [],
        applied: false,
      });
    }
  }

  return fixes;
}

// ── NL Command parser ─────────────────────────────────────────────

const NL_PATTERNS: { pattern: RegExp; intent: NLIntent; extract: (m: RegExpMatchArray) => Record<string, string | number> }[] = [
  { pattern: /draw\s+(a\s+)?rect(?:angle)?\s+(?:on\s+)?(?:layer\s+)?(\w+)\s+(?:at\s+)?(\d+)[,\s]+(\d+)\s+(?:size\s+)?(\d+)[x×,\s]+(\d+)/i, intent: "draw_rect", extract: (m) => ({ layer: m[2], x: +m[3], y: +m[4], w: +m[5], h: +m[6] }) },
  { pattern: /draw\s+(a\s+)?poly(?:gon)?\s+(?:on\s+)?(?:layer\s+)?(\w+)/i, intent: "draw_poly", extract: (m) => ({ layer: m[2] }) },
  { pattern: /draw\s+(a\s+)?via\s+(?:at\s+)?(\d+)[,\s]+(\d+)/i, intent: "draw_via", extract: (m) => ({ x: +m[2], y: +m[3] }) },
  { pattern: /select\s+layer\s+(\w+)/i, intent: "select_layer", extract: (m) => ({ layer: m[1] }) },
  { pattern: /set\s+grid\s+(?:to\s+)?(\d+\.?\d*)/i, intent: "set_grid", extract: (m) => ({ grid: +m[1] }) },
  { pattern: /zoom\s+(?:to\s+)?(?:fit|all|extents)/i, intent: "zoom_to", extract: () => ({ target: "fit" }) },
  { pattern: /zoom\s+(?:to\s+)?(\d+)%/i, intent: "zoom_to", extract: (m) => ({ percent: +m[1] }) },
  { pattern: /measure\s+(?:from\s+)?(\d+)[,\s]+(\d+)\s+(?:to\s+)?(\d+)[,\s]+(\d+)/i, intent: "measure", extract: (m) => ({ x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4] }) },
  { pattern: /run\s+drc/i, intent: "run_drc", extract: () => ({}) },
  { pattern: /run\s+lvs/i, intent: "run_lvs", extract: () => ({}) },
  { pattern: /run\s+sim(?:ulation)?/i, intent: "run_sim", extract: () => ({}) },
  { pattern: /\bundo\b/i, intent: "undo", extract: () => ({}) },
  { pattern: /\bredo\b/i, intent: "redo", extract: () => ({}) },
  { pattern: /\bsave\b/i, intent: "save", extract: () => ({}) },
  { pattern: /export\s+(gds|oas|lef|def)/i, intent: "export", extract: (m) => ({ format: m[1].toLowerCase() }) },
  { pattern: /(?:what|how|which|show)\s+/i, intent: "query_info", extract: () => ({}) },
];

function parseNLCommand(text: string): ParsedCommand | null {
  for (const { pattern, intent, extract } of NL_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return {
        intent,
        entities: extract(match),
        confidence: 0.85 + Math.random() * 0.1,
        resolvedAction: `${intent}(${JSON.stringify(extract(match))})`,
      };
    }
  }
  return {
    intent: "unknown",
    entities: {},
    confidence: 0.2,
    resolvedAction: `echo("Unrecognized: ${text}")`,
  };
}

// ── Design review engine ──────────────────────────────────────────

function runDesignReview(geometries: CanvasGeometry[]): DesignReview {
  const findings: ReviewFinding[] = [];
  let fId = 0;

  // Check density per layer
  const layerCounts = new Map<number, number>();
  for (const g of geometries) {
    layerCounts.set(g.layerId, (layerCounts.get(g.layerId) ?? 0) + 1);
  }

  // Check for density imbalances
  const totalGeo = geometries.length || 1;
  for (const [lid, count] of layerCounts) {
    const pct = count / totalGeo;
    if (pct > 0.5) {
      findings.push({
        id: `rf-${fId++}`,
        category: "density",
        severity: "minor",
        description: `Layer ${lid} contains ${(pct * 100).toFixed(0)}% of all geometries — consider balancing`,
      });
    }
  }

  // Check for symmetry issues (simplified)
  if (geometries.length > 4) {
    const xs = geometries.map((g) => g.points[0]?.x ?? 0);
    const xMean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const xVar = xs.reduce((a, b) => a + (b - xMean) ** 2, 0) / xs.length;
    if (xVar > 1e6) {
      findings.push({
        id: `rf-${fId++}`,
        category: "symmetry",
        severity: "info",
        description: "Layout appears asymmetric — consider mirroring for matched pairs",
        suggestion: "Use symmetry constraint for sensitive analog blocks",
      });
    }
  }

  // Check for guard ring presence
  const hasGuardRing = geometries.some((g) => {
    if (g.type !== "rect") return false;
    const bbox = { x: g.points[0]?.x ?? 0, y: g.points[0]?.y ?? 0, w: g.width ?? 0, h: 0 };
    return bbox.w > 100; // heuristic for large surrounding geometry
  });
  if (!hasGuardRing && geometries.length > 10) {
    findings.push({
      id: `rf-${fId++}`,
      category: "guard_ring",
      severity: "major",
      description: "No guard ring detected — substrate noise isolation recommended",
      suggestion: "Add guard ring around sensitive analog blocks",
    });
  }

  // Check for well ties
  const hasDiffusion = geometries.some((g) => g.layerId === 1); // heuristic
  const hasWellTie = geometries.some((g) => g.layerId === 2); // heuristic
  if (hasDiffusion && !hasWellTie) {
    findings.push({
      id: `rf-${fId++}`,
      category: "well_tie",
      severity: "critical",
      description: "Active diffusion detected without well/substrate contacts",
      suggestion: "Add substrate and well taps near active devices (max 15µm distance recommended)",
    });
  }

  // Power routing check
  const metalGeos = geometries.filter((g) => g.layerId >= 10); // heuristic: metal layers
  if (metalGeos.length > 0) {
    const narrowMetal = metalGeos.filter((g) => (g.width ?? 100) < 0.5);
    if (narrowMetal.length > metalGeos.length * 0.5) {
      findings.push({
        id: `rf-${fId++}`,
        category: "power_routing",
        severity: "major",
        description: `${narrowMetal.length} narrow metal traces detected — potential electromigration risk`,
        suggestion: "Widen power/ground traces or add parallel routing",
      });
    }
  }

  // Electromigration
  findings.push({
    id: `rf-${fId++}`,
    category: "electromigration",
    severity: "info",
    description: "Electromigration analysis requires current density data — connect SPICE results",
  });

  // Score
  const criticals = findings.filter((f) => f.severity === "critical").length;
  const majors = findings.filter((f) => f.severity === "major").length;
  const minors = findings.filter((f) => f.severity === "minor").length;
  const score = Math.max(0, 100 - criticals * 25 - majors * 10 - minors * 3);

  return {
    id: `review-${Date.now()}`,
    timestamp: Date.now(),
    status: "completed",
    findings,
    score,
    summary: findings.length === 0
      ? "No design issues detected — layout looks clean."
      : `Found ${findings.length} issue(s): ${criticals} critical, ${majors} major, ${minors} minor, ${findings.length - criticals - majors - minors} info.`,
  };
}

// ── Store ─────────────────────────────────────────────────────────

interface AiAssistantState {
  // ── DRC Fix Suggestions ──
  fixSuggestions: DrcFixSuggestion[];
  selectedFixId: string | null;
  generateFixes: (violations: DrcViolation[]) => void;
  applyFix: (fixId: string) => void;
  dismissFix: (fixId: string) => void;
  clearFixes: () => void;

  // ── Natural Language Commands ──
  chatHistory: ChatMessage[];
  commandHistory: NLCommand[];
  inputText: string;
  setInputText: (text: string) => void;
  submitCommand: (text: string) => void;
  clearChat: () => void;

  // ── Design Review Copilot ──
  currentReview: DesignReview | null;
  reviewHistory: DesignReview[];
  runReview: (geometries: CanvasGeometry[]) => void;
  clearReview: () => void;

  // ── Settings ──
  autoSuggestFixes: boolean;
  toggleAutoSuggest: () => void;
  nlConfidenceThreshold: number;
  setNlConfidenceThreshold: (v: number) => void;
}

export const useAiAssistantStore = create<AiAssistantState>((set, get) => ({
  // ── DRC Fix Suggestions ──
  fixSuggestions: [],
  selectedFixId: null,

  generateFixes(violations) {
    const all: DrcFixSuggestion[] = [];
    for (const v of violations) {
      all.push(...generateFixSuggestions(v));
    }
    all.sort((a, b) => b.confidence - a.confidence);
    set({ fixSuggestions: all, selectedFixId: all[0]?.id ?? null });
  },

  applyFix(fixId) {
    set({
      fixSuggestions: get().fixSuggestions.map((f) =>
        f.id === fixId ? { ...f, applied: true } : f
      ),
    });
    // In production, this would modify geometry via geometryStore
  },

  dismissFix(fixId) {
    set({ fixSuggestions: get().fixSuggestions.filter((f) => f.id !== fixId) });
  },

  clearFixes() {
    set({ fixSuggestions: [], selectedFixId: null });
  },

  // ── Natural Language Commands ──
  chatHistory: [
    {
      id: "sys-1",
      role: "system",
      content: "I'm your OpenSilicon AI assistant. Ask me to draw shapes, run DRC, control the layout, or get design advice.",
      timestamp: Date.now(),
      suggestions: ["Draw a rect on M1 at 0,0 size 10x5", "Run DRC", "Zoom to fit", "What layers are visible?"],
    },
  ],
  commandHistory: [],
  inputText: "",

  setInputText(text) {
    set({ inputText: text });
  },

  submitCommand(text) {
    if (!text.trim()) return;
    const cmdId = `cmd-${Date.now()}`;
    const parsed = parseNLCommand(text.trim());

    const userMsg: ChatMessage = {
      id: `msg-u-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: Date.now(),
    };

    const cmd: NLCommand = {
      id: cmdId,
      text: text.trim(),
      timestamp: Date.now(),
      parsed,
      status: parsed && parsed.confidence > get().nlConfidenceThreshold ? "parsed" : "error",
      result: parsed
        ? parsed.confidence > get().nlConfidenceThreshold
          ? `Executing: ${parsed.resolvedAction}`
          : `Low confidence (${(parsed.confidence * 100).toFixed(0)}%). Did you mean something else?`
        : "Could not parse command.",
    };

    const assistantContent = cmd.status === "parsed"
      ? `✓ **${parsed!.intent}** — ${cmd.result}\n\nEntities: ${JSON.stringify(parsed!.entities)}`
      : `⚠ ${cmd.result}`;

    const assistantMsg: ChatMessage = {
      id: `msg-a-${Date.now()}`,
      role: "assistant",
      content: assistantContent,
      timestamp: Date.now(),
      suggestions: cmd.status === "error"
        ? ["Draw a rect on M1 at 0,0 size 10x5", "Run DRC", "Undo"]
        : undefined,
    };

    set({
      commandHistory: [...get().commandHistory, cmd],
      chatHistory: [...get().chatHistory, userMsg, assistantMsg],
      inputText: "",
    });
  },

  clearChat() {
    set({
      chatHistory: [{
        id: "sys-1",
        role: "system",
        content: "Chat cleared. How can I help?",
        timestamp: Date.now(),
        suggestions: ["Draw a rect on M1 at 0,0 size 10x5", "Run DRC", "Zoom to fit"],
      }],
      commandHistory: [],
    });
  },

  // ── Design Review Copilot ──
  currentReview: null,
  reviewHistory: [],

  runReview(geometries) {
    set({ currentReview: { id: "pending", timestamp: Date.now(), status: "running", findings: [], score: 0, summary: "Analyzing..." } });
    // Simulate async processing
    setTimeout(() => {
      const review = runDesignReview(geometries);
      set({
        currentReview: review,
        reviewHistory: [...get().reviewHistory, review],
      });
    }, 600);
  },

  clearReview() {
    set({ currentReview: null });
  },

  // ── Settings ──
  autoSuggestFixes: true,
  toggleAutoSuggest() {
    set({ autoSuggestFixes: !get().autoSuggestFixes });
  },

  nlConfidenceThreshold: 0.5,
  setNlConfidenceThreshold(v) {
    set({ nlConfidenceThreshold: v });
  },
}));
