/**
 * JSON Rule Deck Parser
 *
 * Parses DRC rule decks from JSON format (browser-compatible alternative to YAML).
 * Rule decks can be loaded from files or plugin manifests.
 *
 * Example JSON rule deck format:
 * {
 *   "name": "Custom DRC Deck",
 *   "description": "Custom rules for a specific technology",
 *   "version": "1.0.0",
 *   "rules": [
 *     {
 *       "id": "met1.width.min",
 *       "description": "Minimum M1 width",
 *       "type": "min_width",
 *       "layers": ["M1"],
 *       "value": 0.14,
 *       "severity": "error",
 *       "enabled": true
 *     }
 *   ]
 * }
 */

import type { DRCRuleDeck, DesignRule, DesignRuleType } from "../plugins/types";

// Valid rule types for validation
const VALID_RULE_TYPES: DesignRuleType[] = [
  "min_width", "max_width", "min_spacing", "min_enclosure",
  "min_overlap", "min_area", "max_area", "min_density",
  "max_density", "exact_width", "min_edge_length", "min_notch",
];

const VALID_SEVERITIES = ["error", "warning", "info"] as const;

export interface RuleDeckParseResult {
  success: boolean;
  deck?: DRCRuleDeck;
  errors: string[];
  warnings: string[];
}

/**
 * Parse a JSON string into a validated DRCRuleDeck.
 */
export function parseJsonRuleDeck(jsonString: string): RuleDeckParseResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Parse JSON
  let raw: unknown;
  try {
    raw = JSON.parse(jsonString);
  } catch (e) {
    return {
      success: false,
      errors: [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`],
      warnings: [],
    };
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { success: false, errors: ["Root must be a JSON object"], warnings: [] };
  }

  const obj = raw as Record<string, unknown>;

  // Validate required fields
  const name = typeof obj.name === "string" ? obj.name : "";
  const description = typeof obj.description === "string" ? obj.description : "";
  const version = typeof obj.version === "string" ? obj.version : "1.0.0";

  if (!name) errors.push("Missing required field: name");
  if (!description) warnings.push("Missing field: description");

  // Validate rules array
  if (!Array.isArray(obj.rules)) {
    return { success: false, errors: [...errors, "Missing or invalid 'rules' array"], warnings };
  }

  const rules: DesignRule[] = [];
  for (let i = 0; i < obj.rules.length; i++) {
    const r = obj.rules[i];
    if (typeof r !== "object" || r === null) {
      errors.push(`Rule [${i}]: must be an object`);
      continue;
    }

    const rule = r as Record<string, unknown>;
    const ruleErrors: string[] = [];

    // Required fields
    const id = typeof rule.id === "string" ? rule.id : "";
    const ruleDesc = typeof rule.description === "string" ? rule.description : "";
    const type = typeof rule.type === "string" ? rule.type : "";
    const value = typeof rule.value === "number" ? rule.value : NaN;

    if (!id) ruleErrors.push("missing 'id'");
    if (!type) ruleErrors.push("missing 'type'");
    if (!VALID_RULE_TYPES.includes(type as DesignRuleType)) {
      ruleErrors.push(`invalid type '${type}'. Valid: ${VALID_RULE_TYPES.join(", ")}`);
    }
    if (isNaN(value)) ruleErrors.push("missing or invalid 'value' (must be number)");

    // Layers
    let layers: string[] = [];
    if (Array.isArray(rule.layers)) {
      layers = rule.layers.filter((l): l is string => typeof l === "string");
    }
    if (layers.length === 0) ruleErrors.push("missing or empty 'layers' array");

    // Optional fields
    const otherLayer = typeof rule.otherLayer === "string" ? rule.otherLayer : undefined;
    const severity = typeof rule.severity === "string" && VALID_SEVERITIES.includes(rule.severity as typeof VALID_SEVERITIES[number])
      ? (rule.severity as "error" | "warning" | "info")
      : "error";
    const enabled = typeof rule.enabled === "boolean" ? rule.enabled : true;

    if (ruleErrors.length > 0) {
      errors.push(`Rule [${i}] (${id || "unnamed"}): ${ruleErrors.join("; ")}`);
      continue;
    }

    rules.push({
      id,
      description: ruleDesc,
      type: type as DesignRuleType,
      layers,
      otherLayer,
      value,
      severity,
      enabled,
    });
  }

  if (errors.length > 0) {
    return { success: false, errors, warnings };
  }

  if (rules.length === 0) {
    warnings.push("Rule deck contains no rules");
  }

  return {
    success: true,
    deck: { name, description, version, rules },
    errors: [],
    warnings,
  };
}

/**
 * Serialize a DRCRuleDeck to a formatted JSON string.
 */
export function serializeRuleDeck(deck: DRCRuleDeck): string {
  return JSON.stringify(deck, null, 2);
}

/**
 * Merge multiple rule decks, with later decks overriding earlier ones
 * for rules with the same ID.
 */
export function mergeRuleDecks(decks: DRCRuleDeck[]): DesignRule[] {
  const ruleMap = new Map<string, DesignRule>();
  for (const deck of decks) {
    for (const rule of deck.rules) {
      ruleMap.set(rule.id, rule);
    }
  }
  return Array.from(ruleMap.values());
}
