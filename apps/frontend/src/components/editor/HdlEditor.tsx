/**
 * HdlEditor — Full-featured HDL code editor with syntax highlighting,
 * line numbers, diagnostics gutter, minimap, code folding, breadcrumbs,
 * find & replace, peek definition, rename symbol, go-to-line,
 * bracket matching, and multi-cursor editing.
 */

import { useRef, useCallback, useEffect, useMemo, useState } from "react";
import { useHdlStore } from "../../stores/hdlStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { parseHdl, lintHdl, generateInstantiationTemplate } from "../../engines/hdlParser";
import type { HdlLanguage, HdlDiagnostic } from "../../engines/hdlParser";
import { getCompletions, type CompletionItem } from "../../engines/hdlCompletionProvider";
import { goToDefinition, findReferences, getWordAtPosition, type HdlFileInfo } from "../../engines/hdlNavigator";
import {
  FileCode, Play, AlertTriangle, Info, XCircle, Plus, Braces, Copy,
  ChevronDown, ChevronRight, Search, Replace, X, CaseSensitive,
  WholeWord, Regex, Eye, ArrowDown, ArrowUp, PenLine,
} from "lucide-react";
import { Breadcrumbs } from "./Breadcrumbs";
import "./HdlEditor.css";

/* ------------------------------------------------------------------ */
/*  Code folding — detect foldable regions                            */
/* ------------------------------------------------------------------ */

interface FoldRegion {
  startLine: number; // 1-based
  endLine: number;   // 1-based
  keyword: string;
}

function detectFoldRegions(content: string, lang: HdlLanguage): FoldRegion[] {
  const lines = content.split("\n");
  const regions: FoldRegion[] = [];
  const stack: Array<{ keyword: string; line: number }> = [];

  const OPEN_CLOSE = lang === "vhdl"
    ? [
        { open: /\bentity\b/i, close: /\bend\b/i, keyword: "entity" },
        { open: /\barchitecture\b/i, close: /\bend\b/i, keyword: "architecture" },
        { open: /\bprocess\b/i, close: /\bend\s+process\b/i, keyword: "process" },
        { open: /\bbegin\b/i, close: /\bend\b/i, keyword: "begin" },
      ]
    : [
        { open: /\bmodule\b/, close: /\bendmodule\b/, keyword: "module" },
        { open: /\bfunction\b/, close: /\bendfunction\b/, keyword: "function" },
        { open: /\btask\b/, close: /\bendtask\b/, keyword: "task" },
        { open: /\bgenerate\b/, close: /\bendgenerate\b/, keyword: "generate" },
        { open: /\binterface\b/, close: /\bendinterface\b/, keyword: "interface" },
        { open: /\bpackage\b/, close: /\bendpackage\b/, keyword: "package" },
        { open: /\bclass\b/, close: /\bendclass\b/, keyword: "class" },
        { open: /\bbegin\b/, close: /\bend\b/, keyword: "begin" },
      ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comments
    const stripped = line.replace(/\/\/.*$/, "").replace(/--.*$/, "").trim();
    if (!stripped) continue;

    for (const rule of OPEN_CLOSE) {
      if (rule.close.test(stripped)) {
        // Find matching open
        for (let j = stack.length - 1; j >= 0; j--) {
          if (stack[j].keyword === rule.keyword) {
            const startLine = stack[j].line;
            if (i + 1 > startLine + 1) {
              regions.push({ startLine, endLine: i + 1, keyword: rule.keyword });
            }
            stack.splice(j, 1);
            break;
          }
        }
      }
      if (rule.open.test(stripped)) {
        stack.push({ keyword: rule.keyword, line: i + 1 });
      }
    }
  }

  return regions;
}

/* ------------------------------------------------------------------ */
/*  Bracket / Block matching                                          */
/* ------------------------------------------------------------------ */

interface BracketPair {
  openLine: number;    // 1-based
  openCol: number;     // 0-based
  closeLine: number;   // 1-based
  closeCol: number;    // 0-based
}

/** Simple bracket characters */
const BRACKET_PAIRS: Record<string, string> = {
  "(": ")", "[": "]", "{": "}",
};
const CLOSE_TO_OPEN: Record<string, string> = {
  ")": "(", "]": "[", "}": "{",
};

function findMatchingBracket(
  content: string,
  cursorLine: number,
  cursorCol: number,
): BracketPair | null {
  const lines = content.split("\n");
  if (cursorLine < 1 || cursorLine > lines.length) return null;
  const lineText = lines[cursorLine - 1];
  const ch = lineText[cursorCol] ?? "";
  const prevCh = cursorCol > 0 ? lineText[cursorCol - 1] : "";

  // Decide which char to match
  let target = "";
  let searchCol = cursorCol;
  if (BRACKET_PAIRS[ch] || CLOSE_TO_OPEN[ch]) {
    target = ch;
  } else if (BRACKET_PAIRS[prevCh] || CLOSE_TO_OPEN[prevCh]) {
    target = prevCh;
    searchCol = cursorCol - 1;
  }
  if (!target) return null;

  const isOpen = !!BRACKET_PAIRS[target];
  const matchCh = isOpen ? BRACKET_PAIRS[target] : CLOSE_TO_OPEN[target];

  // Search forward or backward
  let depth = 0;
  if (isOpen) {
    // Forward search
    for (let ln = cursorLine; ln <= lines.length; ln++) {
      const start = ln === cursorLine ? searchCol : 0;
      for (let c = start; c < lines[ln - 1].length; c++) {
        const ch2 = lines[ln - 1][c];
        if (ch2 === target) depth++;
        if (ch2 === matchCh) {
          depth--;
          if (depth === 0) {
            return { openLine: cursorLine, openCol: searchCol, closeLine: ln, closeCol: c };
          }
        }
      }
    }
  } else {
    // Backward search
    for (let ln = cursorLine; ln >= 1; ln--) {
      const start = ln === cursorLine ? searchCol : lines[ln - 1].length - 1;
      for (let c = start; c >= 0; c--) {
        const ch2 = lines[ln - 1][c];
        if (ch2 === target) depth++;
        if (ch2 === matchCh) {
          depth--;
          if (depth === 0) {
            return { openLine: ln, openCol: c, closeLine: cursorLine, closeCol: searchCol };
          }
        }
      }
    }
  }
  return null;
}

/** HDL keyword pairs (module/endmodule etc). Returns matching line or null. */
function findMatchingKeywordBlock(
  content: string,
  cursorLine: number,
  lang: HdlLanguage,
): { matchLine: number; keyword: string } | null {
  const lines = content.split("\n");
  if (cursorLine < 1 || cursorLine > lines.length) return null;
  const lineText = lines[cursorLine - 1].replace(/\/\/.*$/, "").replace(/--.*$/, "").trim();

  const pairs = lang === "vhdl"
    ? [
        { open: /\bentity\b/i, close: /\bend\b/i, keyword: "entity" },
        { open: /\barchitecture\b/i, close: /\bend\b/i, keyword: "architecture" },
        { open: /\bprocess\b/i, close: /\bend\s+process\b/i, keyword: "process" },
      ]
    : [
        { open: /\bmodule\b/, close: /\bendmodule\b/, keyword: "module" },
        { open: /\bfunction\b/, close: /\bendfunction\b/, keyword: "function" },
        { open: /\btask\b/, close: /\bendtask\b/, keyword: "task" },
        { open: /\bgenerate\b/, close: /\bendgenerate\b/, keyword: "generate" },
        { open: /\bbegin\b/, close: /\bend\b/, keyword: "begin" },
      ];

  for (const pair of pairs) {
    if (pair.close.test(lineText)) {
      // Search backward for matching open
      let depth = 0;
      for (let ln = cursorLine; ln >= 1; ln--) {
        const lt = lines[ln - 1].replace(/\/\/.*$/, "").replace(/--.*$/, "").trim();
        if (pair.close.test(lt)) depth++;
        if (pair.open.test(lt)) {
          depth--;
          if (depth === 0) return { matchLine: ln, keyword: pair.keyword };
        }
      }
    }
    if (pair.open.test(lineText)) {
      // Search forward for matching close
      let depth = 0;
      for (let ln = cursorLine; ln <= lines.length; ln++) {
        const lt = lines[ln - 1].replace(/\/\/.*$/, "").replace(/--.*$/, "").trim();
        if (pair.open.test(lt)) depth++;
        if (pair.close.test(lt)) {
          depth--;
          if (depth === 0) return { matchLine: ln, keyword: pair.keyword };
        }
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Syntax highlighting                                               */
/* ------------------------------------------------------------------ */

interface Token { text: string; className: string }

const VERILOG_KEYWORDS = new Set([
  "module", "endmodule", "input", "output", "inout", "wire", "reg", "logic",
  "integer", "real", "assign", "always", "always_ff", "always_comb",
  "always_latch", "initial", "begin", "end", "if", "else", "case", "endcase",
  "casex", "casez", "default", "for", "while", "repeat", "forever",
  "generate", "endgenerate", "function", "endfunction", "task", "endtask",
  "parameter", "localparam", "genvar", "posedge", "negedge", "or", "and",
  "not", "buf", "nand", "nor", "xor", "xnor", "typedef", "struct", "enum",
  "union", "packed", "interface", "endinterface", "modport", "class",
  "endclass", "extends", "virtual", "pure", "extern", "import", "export",
  "package", "endpackage", "program", "endprogram", "property",
  "endproperty", "assert", "assume", "cover", "sequence", "endsequence",
  "clocking", "endclocking", "constraint", "rand", "randc", "bit", "byte",
  "shortint", "int", "longint", "shortreal", "string", "void", "return",
  "break", "continue", "fork", "join", "join_any", "join_none",
  "disable", "wait", "event", "supply0", "supply1", "tri", "wand", "wor",
  "signed", "unsigned",
]);

const VHDL_KEYWORDS = new Set([
  "library", "use", "entity", "is", "end", "architecture", "of", "begin",
  "port", "generic", "map", "signal", "variable", "constant", "type",
  "subtype", "array", "record", "process", "if", "then", "elsif", "else",
  "case", "when", "for", "loop", "while", "generate", "component",
  "function", "procedure", "return", "package", "body", "in", "out",
  "inout", "buffer", "downto", "to", "others", "all", "open", "with",
  "select", "after", "wait", "until", "on", "rising_edge", "falling_edge",
  "not", "and", "or", "xor", "nand", "nor", "xnor", "mod", "rem", "abs",
  "sll", "srl", "sla", "sra", "rol", "ror", "report", "severity",
  "assert", "null", "exit", "next", "file", "shared", "impure", "pure",
  "range", "attribute", "alias", "configuration", "block", "postponed",
]);

const PORT_DIRECTIONS = new Set(["input", "output", "inout", "in", "out", "buffer"]);
const TYPE_KEYWORDS = new Set([
  "wire", "reg", "logic", "integer", "real", "bit", "byte", "int", "shortint",
  "longint", "shortreal", "string", "void",
  "std_logic", "std_logic_vector", "std_ulogic", "std_ulogic_vector",
  "signed", "unsigned", "natural", "positive", "boolean",
]);

function tokenizeLine(line: string, lang: HdlLanguage): Token[] {
  const tokens: Token[] = [];
  // Token regex: identifiers, numbers, strings, comments, operators, punctuation, spaces
  const re = lang === "vhdl"
    ? /("(?:[^"\\]|\\.)*"|'.'|--.*$|\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b|[a-zA-Z_]\w*|[<>=:]+|=>|<=|[();\[\]{},.:@#]|\S|\s+)/g
    : /("(?:[^"\\]|\\.)*"|`[a-zA-Z_]\w*|\/\/.*$|\b\d+'[bBoOdDhH][\da-fA-F_xXzZ]+\b|\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b|[a-zA-Z_$]\w*|[<>=!&|^~?:]+|[();\[\]{},.:@#]|\S|\s+)/g;

  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) {
    const t = m[0];
    let cls = "";

    if (t.startsWith("//") || t.startsWith("--")) {
      cls = "tok-comment";
    } else if (t.startsWith('"') || (t.startsWith("'") && t.length > 1)) {
      cls = "tok-string";
    } else if (t.startsWith("`")) {
      cls = "tok-preproc";
    } else if (/^\d/.test(t)) {
      cls = "tok-number";
    } else if (/^[a-zA-Z_$]/.test(t)) {
      const lower = t.toLowerCase();
      if (lower === "module" || lower === "endmodule" || lower === "entity" || lower === "architecture") {
        cls = "tok-module";
      } else if (PORT_DIRECTIONS.has(lower)) {
        cls = "tok-port-dir";
      } else if (TYPE_KEYWORDS.has(lower)) {
        cls = "tok-type";
      } else if (
        (lang === "vhdl" ? VHDL_KEYWORDS : VERILOG_KEYWORDS).has(lower)
      ) {
        cls = "tok-keyword";
      } else {
        cls = "tok-signal";
      }
    } else if (/^[();\[\]{},.:@#]$/.test(t)) {
      cls = "tok-punct";
    } else if (t.trim().length > 0) {
      cls = "tok-operator";
    }

    tokens.push({ text: t, className: cls });
  }
  return tokens;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function HdlEditor() {
  const files = useHdlStore((s) => s.files);
  const activeFileId = useHdlStore((s) => s.activeFileId);
  const setActiveFile = useHdlStore((s) => s.setActiveFile);
  const closeFile = useHdlStore((s) => s.closeFile);
  const updateContent = useHdlStore((s) => s.updateContent);
  const setCursorPosition = useHdlStore((s) => s.setCursorPosition);
  const setParseResult = useHdlStore((s) => s.setParseResult);
  const setDiagnostics = useHdlStore((s) => s.setDiagnostics);
  const newFile = useHdlStore((s) => s.newFile);
  const appendConsole = useHdlStore((s) => s.appendConsole);
  const getAllModules = useHdlStore((s) => s.getAllModules);
  const addTab = useWorkspaceStore((s) => s.addTab);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const parseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeFile = activeFileId ? files.get(activeFileId) : null;
  const fileList = useMemo(() => Array.from(files.values()), [files]);

  /* ── Autocomplete state ── */
  const [completions, setCompletions] = useState<CompletionItem[]>([]);
  const [completionVisible, setCompletionVisible] = useState(false);
  const [completionIndex, setCompletionIndex] = useState(0);
  const [completionPos, setCompletionPos] = useState({ top: 0, left: 0 });

  /* ── References panel state ── */
  const [refsPanel, setRefsPanel] = useState<{ word: string; refs: Array<{ file: string; line: number; text: string }> } | null>(null);

  /* ── Find & Replace state ── */
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [replaceQuery, setReplaceQuery] = useState("");
  const [findCaseSensitive, setFindCaseSensitive] = useState(false);
  const [findWholeWord, setFindWholeWord] = useState(false);
  const [findUseRegex, setFindUseRegex] = useState(false);
  const [findMatches, setFindMatches] = useState<Array<{ line: number; start: number; end: number }>>([]);
  const [findCurrentIndex, setFindCurrentIndex] = useState(0);
  const [showReplace, setShowReplace] = useState(false);

  /* ── Go to Line state ── */
  const [goToLineOpen, setGoToLineOpen] = useState(false);
  const [goToLineInput, setGoToLineInput] = useState("");

  /* ── Peek Definition state ── */
  const [peekDef, setPeekDef] = useState<{
    word: string;
    filename: string;
    line: number;
    preview: string[];
  } | null>(null);

  /* ── Rename Symbol state ── */
  const [renameState, setRenameState] = useState<{
    word: string;
    newName: string;
    occurrences: Array<{ fileId: string; filename: string; line: number; col: number }>;
  } | null>(null);

  /* ── Multi-cursor state ── */
  const [extraCursors, setExtraCursors] = useState<Array<{ line: number; col: number }>>([]);

  /* ── Bracket matching state ── */
  const [matchedBracket, setMatchedBracket] = useState<BracketPair | null>(null);
  const [matchedKeyword, setMatchedKeyword] = useState<{ matchLine: number; keyword: string } | null>(null);

  /* ── Code folding state ── */
  const [collapsedLines, setCollapsedLines] = useState<Set<number>>(new Set());

  const foldRegions = useMemo<FoldRegion[]>(() => {
    if (!activeFile) return [];
    return detectFoldRegions(activeFile.content, activeFile.language);
  }, [activeFile?.content, activeFile?.language]);

  const toggleFold = useCallback((startLine: number) => {
    setCollapsedLines((prev) => {
      const next = new Set(prev);
      if (next.has(startLine)) next.delete(startLine);
      else next.add(startLine);
      return next;
    });
  }, []);

  /** Set of lines hidden by folding */
  const hiddenLines = useMemo(() => {
    const hidden = new Set<number>();
    for (const region of foldRegions) {
      if (collapsedLines.has(region.startLine)) {
        for (let l = region.startLine + 1; l <= region.endLine; l++) {
          hidden.add(l);
        }
      }
    }
    return hidden;
  }, [foldRegions, collapsedLines]);

  /* ── Minimap refs ── */
  const codeAreaRef = useRef<HTMLDivElement>(null);
  const minimapRef = useRef<HTMLDivElement>(null);

  /* ── Parse on content change (debounced) ── */
  const triggerParse = useCallback(
    (id: string, content: string, filename: string) => {
      if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
      parseTimerRef.current = setTimeout(() => {
        const result = parseHdl(content, filename);
        setParseResult(id, result);
        const lintDiags = lintHdl(result, content);
        setDiagnostics(id, lintDiags);
      }, 300);
    },
    [setParseResult, setDiagnostics]
  );

  /* ── Initial parse for active file ── */
  useEffect(() => {
    if (activeFile && !activeFile.parseResult) {
      triggerParse(activeFile.id, activeFile.content, activeFile.filename);
    }
  }, [activeFile, triggerParse]);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!activeFile) return;
      const value = e.target.value;
      updateContent(activeFile.id, value);
      triggerParse(activeFile.id, value, activeFile.filename);
    },
    [activeFile, updateContent, triggerParse]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Tab → insert 2 spaces
      if (e.key === "Tab") {
        e.preventDefault();
        if (completionVisible && completions.length > 0) {
          // Accept current completion
          applyCompletion(completions[completionIndex]);
          return;
        }
        const ta = e.currentTarget;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const value = ta.value;
        const newValue = value.substring(0, start) + "  " + value.substring(end);
        if (activeFile) {
          updateContent(activeFile.id, newValue);
          // restore cursor
          requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = start + 2;
          });
        }
      }
      // Ctrl+Space → trigger autocomplete
      else if (e.key === " " && e.ctrlKey) {
        e.preventDefault();
        triggerAutocomplete();
      }
      // Escape → dismiss autocomplete
      else if (e.key === "Escape") {
        setCompletionVisible(false);
        setRefsPanel(null);
        setFindOpen(false);
        setGoToLineOpen(false);
        setPeekDef(null);
        setRenameState(null);
      }
      // Arrow keys in autocomplete
      else if (completionVisible && e.key === "ArrowDown") {
        e.preventDefault();
        setCompletionIndex((i) => Math.min(i + 1, completions.length - 1));
      } else if (completionVisible && e.key === "ArrowUp") {
        e.preventDefault();
        setCompletionIndex((i) => Math.max(i - 1, 0));
      } else if (completionVisible && e.key === "Enter") {
        e.preventDefault();
        if (completions.length > 0) {
          applyCompletion(completions[completionIndex]);
        }
      }
      // F12 → Go to Definition
      else if (e.key === "F12" && !e.shiftKey) {
        e.preventDefault();
        handleGoToDefinition();
      }
      // Shift+F12 → Find References
      else if (e.key === "F12" && e.shiftKey && !e.altKey) {
        e.preventDefault();
        handleFindReferences();
      }
      // Alt+F12 → Peek Definition
      else if (e.key === "F12" && e.altKey) {
        e.preventDefault();
        handlePeekDefinition();
      }
      // F2 → Rename Symbol
      else if (e.key === "F2" && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        handleRenameStart();
      }
      // Ctrl+F → Find
      else if (e.key === "f" && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        setFindOpen(true);
        setShowReplace(false);
      }
      // Ctrl+H → Find and Replace
      else if (e.key === "h" && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        setFindOpen(true);
        setShowReplace(true);
      }
      // Ctrl+G → Go to Line
      else if (e.key === "g" && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        setGoToLineOpen(true);
        setGoToLineInput("");
      }
      // Ctrl+D → Add next occurrence (multi-cursor)
      else if (e.key === "d" && e.ctrlKey && !e.shiftKey) {
        e.preventDefault();
        handleAddNextOccurrence();
      }
    },
    [activeFile, updateContent, completionVisible, completions, completionIndex]
  );

  /* ── Autocomplete ── */
  const triggerAutocomplete = useCallback(() => {
    if (!activeFile || !textareaRef.current) return;
    const ta = textareaRef.current;
    const pos = ta.selectionStart;
    const lines = ta.value.substring(0, pos).split("\n");
    const line = lines.length;
    const column = (lines[lines.length - 1]?.length ?? 0) + 1;
    const linePrefix = activeFile.content.split("\n")[line - 1]?.substring(0, column - 1) ?? "";

    // Extract the word prefix being typed
    const wordMatch = linePrefix.match(/[$\w]+$/);
    const prefix = wordMatch ? wordMatch[0] : "";

    const allModules = getAllModules();
    const items = getCompletions({
      language: activeFile.language,
      linePrefix,
      line,
      column,
      source: activeFile.content,
      prefix,
      allModules,
    });

    if (items.length > 0) {
      setCompletions(items.slice(0, 20));
      setCompletionIndex(0);
      setCompletionVisible(true);
      // Position popup near cursor
      const lineHeight = 20;
      setCompletionPos({
        top: line * lineHeight + 28,
        left: Math.min(column * 7.8, 400),
      });
    } else {
      setCompletionVisible(false);
    }
  }, [activeFile, getAllModules]);

  const applyCompletion = useCallback(
    (item: CompletionItem) => {
      if (!activeFile || !textareaRef.current) return;
      const ta = textareaRef.current;
      const pos = ta.selectionStart;
      const content = activeFile.content;
      const lines = content.substring(0, pos).split("\n");
      const lineText = lines[lines.length - 1] ?? "";

      // Find the prefix to replace
      const wordMatch = lineText.match(/[$\w]+$/);
      const prefixLen = wordMatch ? wordMatch[0].length : 0;
      const insertStart = pos - prefixLen;

      const newContent = content.substring(0, insertStart) + item.insertText + content.substring(pos);
      updateContent(activeFile.id, newContent);
      setCompletionVisible(false);

      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = insertStart + item.insertText.length;
        ta.focus();
      });
    },
    [activeFile, updateContent]
  );

  /* ── Go to Definition ── */
  const handleGoToDefinition = useCallback(() => {
    if (!activeFile || !textareaRef.current) return;
    const ta = textareaRef.current;
    const pos = ta.selectionStart;
    const lines = ta.value.substring(0, pos).split("\n");
    const line = lines.length;
    const lineText = activeFile.content.split("\n")[line - 1] ?? "";
    const column = (lines[lines.length - 1]?.length ?? 0);
    const word = getWordAtPosition(lineText, column);
    if (!word) return;

    const allFiles: HdlFileInfo[] = Array.from(files.values()).map((f) => ({
      id: f.id,
      filename: f.filename,
      content: f.content,
      parseResult: f.parseResult,
    }));

    const cursorFileInfo: HdlFileInfo = {
      id: activeFile.id,
      filename: activeFile.filename,
      content: activeFile.content,
      parseResult: activeFile.parseResult,
    };

    const def = goToDefinition(word, cursorFileInfo, line, allFiles);
    if (def) {
      // Jump to definition - find which file has it
      const targetFile = Array.from(files.values()).find((f) => f.filename === def.location.filename);
      if (targetFile) {
        setActiveFile(targetFile.id);
        appendConsole(`[GoTo] ${word} → ${def.location.filename}:${def.location.line}`);
      }
    } else {
      appendConsole(`[GoTo] No definition found for '${word}'`);
    }
  }, [activeFile, files, setActiveFile, appendConsole]);

  /* ── Find References ── */
  const handleFindReferences = useCallback(() => {
    if (!activeFile || !textareaRef.current) return;
    const ta = textareaRef.current;
    const pos = ta.selectionStart;
    const lines = ta.value.substring(0, pos).split("\n");
    const lineText = activeFile.content.split("\n")[lines.length - 1] ?? "";
    const column = (lines[lines.length - 1]?.length ?? 0);
    const word = getWordAtPosition(lineText, column);
    if (!word) return;

    const allFiles: HdlFileInfo[] = Array.from(files.values()).map((f) => ({
      id: f.id,
      filename: f.filename,
      content: f.content,
      parseResult: f.parseResult,
    }));

    const refs = findReferences(word, allFiles);
    if (refs.length > 0) {
      setRefsPanel({
        word,
        refs: refs.map((r) => ({
          file: r.location.filename,
          line: r.location.line,
          text: r.context,
        })),
      });
      appendConsole(`[Refs] Found ${refs.length} reference(s) for '${word}'`);
    } else {
      appendConsole(`[Refs] No references found for '${word}'`);
    }
  }, [activeFile, files, appendConsole]);

  /* ── Find & Replace ── */
  const updateFindMatches = useCallback(
    (query: string, caseSensitive: boolean, wholeWord: boolean, useRegex: boolean) => {
      if (!activeFile || !query) { setFindMatches([]); return; }
      const lines = activeFile.content.split("\n");
      const matches: Array<{ line: number; start: number; end: number }> = [];

      try {
        let re: RegExp;
        if (useRegex) {
          re = new RegExp(query, caseSensitive ? "g" : "gi");
        } else {
          const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const pattern = wholeWord ? `\\b${escaped}\\b` : escaped;
          re = new RegExp(pattern, caseSensitive ? "g" : "gi");
        }

        for (let i = 0; i < lines.length; i++) {
          let m: RegExpExecArray | null;
          while ((m = re.exec(lines[i])) !== null) {
            matches.push({ line: i + 1, start: m.index, end: m.index + m[0].length });
            if (m[0].length === 0) break; // prevent infinite loop on zero-width match
          }
        }
      } catch {
        // invalid regex — ignore
      }

      setFindMatches(matches);
      if (matches.length > 0) setFindCurrentIndex(0);
    },
    [activeFile],
  );

  useEffect(() => {
    if (findOpen) {
      updateFindMatches(findQuery, findCaseSensitive, findWholeWord, findUseRegex);
    }
  }, [findQuery, findCaseSensitive, findWholeWord, findUseRegex, findOpen, updateFindMatches]);

  const handleFindNext = useCallback(() => {
    if (findMatches.length === 0) return;
    setFindCurrentIndex((i) => (i + 1) % findMatches.length);
  }, [findMatches]);

  const handleFindPrev = useCallback(() => {
    if (findMatches.length === 0) return;
    setFindCurrentIndex((i) => (i - 1 + findMatches.length) % findMatches.length);
  }, [findMatches]);

  const handleReplaceCurrent = useCallback(() => {
    if (!activeFile || findMatches.length === 0) return;
    const match = findMatches[findCurrentIndex];
    if (!match) return;
    const lines = activeFile.content.split("\n");
    const line = lines[match.line - 1];
    lines[match.line - 1] = line.substring(0, match.start) + replaceQuery + line.substring(match.end);
    updateContent(activeFile.id, lines.join("\n"));
  }, [activeFile, findMatches, findCurrentIndex, replaceQuery, updateContent]);

  const handleReplaceAll = useCallback(() => {
    if (!activeFile || !findQuery) return;
    try {
      let re: RegExp;
      if (findUseRegex) {
        re = new RegExp(findQuery, findCaseSensitive ? "g" : "gi");
      } else {
        const escaped = findQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const pattern = findWholeWord ? `\\b${escaped}\\b` : escaped;
        re = new RegExp(pattern, findCaseSensitive ? "g" : "gi");
      }
      const newContent = activeFile.content.replace(re, replaceQuery);
      updateContent(activeFile.id, newContent);
      appendConsole(`[Replace] Replaced all occurrences of '${findQuery}'`);
    } catch {
      // invalid regex
    }
  }, [activeFile, findQuery, replaceQuery, findCaseSensitive, findWholeWord, findUseRegex, updateContent, appendConsole]);

  /* ── Go to Line ── */
  const handleGoToLine = useCallback(() => {
    if (!activeFile || !textareaRef.current) return;
    const lineNum = parseInt(goToLineInput, 10);
    if (isNaN(lineNum) || lineNum < 1) return;
    const lines = activeFile.content.split("\n");
    const targetLine = Math.min(lineNum, lines.length);
    // Find character offset for the target line
    let offset = 0;
    for (let i = 0; i < targetLine - 1; i++) {
      offset += lines[i].length + 1;
    }
    const ta = textareaRef.current;
    ta.selectionStart = ta.selectionEnd = offset;
    ta.focus();
    setCursorPosition(activeFile.id, targetLine, 1);
    setGoToLineOpen(false);
    appendConsole(`[GoTo] Line ${targetLine}`);
  }, [activeFile, goToLineInput, setCursorPosition, appendConsole]);

  /* ── Peek Definition (Alt+F12) ── */
  const handlePeekDefinition = useCallback(() => {
    if (!activeFile || !textareaRef.current) return;
    const ta = textareaRef.current;
    const pos = ta.selectionStart;
    const lines = ta.value.substring(0, pos).split("\n");
    const line = lines.length;
    const lineText = activeFile.content.split("\n")[line - 1] ?? "";
    const column = (lines[lines.length - 1]?.length ?? 0);
    const word = getWordAtPosition(lineText, column);
    if (!word) return;

    const allFiles: HdlFileInfo[] = Array.from(files.values()).map((f) => ({
      id: f.id, filename: f.filename, content: f.content, parseResult: f.parseResult,
    }));
    const cursorFileInfo: HdlFileInfo = {
      id: activeFile.id, filename: activeFile.filename,
      content: activeFile.content, parseResult: activeFile.parseResult,
    };

    const def = goToDefinition(word, cursorFileInfo, line, allFiles);
    if (def) {
      const targetFile = Array.from(files.values()).find((f) => f.filename === def.location.filename);
      if (targetFile) {
        const fileLines = targetFile.content.split("\n");
        const startLine = Math.max(0, def.location.line - 3);
        const endLine = Math.min(fileLines.length, def.location.line + 7);
        const preview = fileLines.slice(startLine, endLine);
        setPeekDef({
          word,
          filename: def.location.filename,
          line: def.location.line,
          preview,
        });
      }
    } else {
      appendConsole(`[Peek] No definition found for '${word}'`);
    }
  }, [activeFile, files, appendConsole]);

  /* ── Rename Symbol (F2) ── */
  const handleRenameStart = useCallback(() => {
    if (!activeFile || !textareaRef.current) return;
    const ta = textareaRef.current;
    const pos = ta.selectionStart;
    const lines = ta.value.substring(0, pos).split("\n");
    const lineText = activeFile.content.split("\n")[lines.length - 1] ?? "";
    const column = (lines[lines.length - 1]?.length ?? 0);
    const word = getWordAtPosition(lineText, column);
    if (!word) return;

    // Find all occurrences across all files
    const occurrences: Array<{ fileId: string; filename: string; line: number; col: number }> = [];
    for (const f of files.values()) {
      const fileLines = f.content.split("\n");
      const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
      for (let i = 0; i < fileLines.length; i++) {
        let m: RegExpExecArray | null;
        while ((m = re.exec(fileLines[i])) !== null) {
          occurrences.push({ fileId: f.id, filename: f.filename, line: i + 1, col: m.index });
        }
      }
    }

    if (occurrences.length > 0) {
      setRenameState({ word, newName: word, occurrences });
    } else {
      appendConsole(`[Rename] No occurrences found for '${word}'`);
    }
  }, [activeFile, files, appendConsole]);

  const handleRenameApply = useCallback(() => {
    if (!renameState || !renameState.newName || renameState.newName === renameState.word) {
      setRenameState(null);
      return;
    }
    const re = new RegExp(`\\b${renameState.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
    for (const f of files.values()) {
      const newContent = f.content.replace(re, renameState.newName);
      if (newContent !== f.content) {
        updateContent(f.id, newContent);
      }
    }
    appendConsole(`[Rename] '${renameState.word}' → '${renameState.newName}' (${renameState.occurrences.length} occurrences)`);
    setRenameState(null);
  }, [renameState, files, updateContent, appendConsole]);

  /* ── Multi-cursor: Add next occurrence (Ctrl+D) ── */
  const handleAddNextOccurrence = useCallback(() => {
    if (!activeFile || !textareaRef.current) return;
    const ta = textareaRef.current;
    const selStart = ta.selectionStart;
    const selEnd = ta.selectionEnd;

    // Get selected text or word at cursor
    let selectedText: string;
    if (selStart !== selEnd) {
      selectedText = ta.value.substring(selStart, selEnd);
    } else {
      const lines = ta.value.substring(0, selStart).split("\n");
      const lineText = activeFile.content.split("\n")[lines.length - 1] ?? "";
      const col = lines[lines.length - 1]?.length ?? 0;
      selectedText = getWordAtPosition(lineText, col) ?? "";
    }
    if (!selectedText) return;

    // Find the next occurrence after current cursor
    const searchStart = selEnd;
    const idx = activeFile.content.indexOf(selectedText, searchStart);
    if (idx !== -1) {
      const beforeIdx = activeFile.content.substring(0, idx).split("\n");
      const line = beforeIdx.length;
      const col = (beforeIdx[beforeIdx.length - 1]?.length ?? 0);
      setExtraCursors((prev) => {
        // Don't add duplicate
        if (prev.some((c) => c.line === line && c.col === col)) return prev;
        return [...prev, { line, col }];
      });
      appendConsole(`[MultiCursor] Added cursor at Ln ${line}, Col ${col + 1}`);
    } else {
      // Wrap around — search from beginning
      const idx2 = activeFile.content.indexOf(selectedText);
      if (idx2 !== -1 && idx2 < selStart) {
        const beforeIdx = activeFile.content.substring(0, idx2).split("\n");
        const line = beforeIdx.length;
        const col = (beforeIdx[beforeIdx.length - 1]?.length ?? 0);
        setExtraCursors((prev) => {
          if (prev.some((c) => c.line === line && c.col === col)) return prev;
          return [...prev, { line, col }];
        });
        appendConsole(`[MultiCursor] Wrapped: cursor at Ln ${line}, Col ${col + 1}`);
      }
    }
  }, [activeFile, appendConsole]);

  /* ── Bracket matching — update on cursor move ── */
  useEffect(() => {
    if (!activeFile) {
      setMatchedBracket(null);
      setMatchedKeyword(null);
      return;
    }
    const col = activeFile.cursorColumn - 1; // to 0-based
    const bracket = findMatchingBracket(activeFile.content, activeFile.cursorLine, col);
    setMatchedBracket(bracket);
    const kwMatch = findMatchingKeywordBlock(activeFile.content, activeFile.cursorLine, activeFile.language);
    setMatchedKeyword(kwMatch);
  }, [activeFile?.cursorLine, activeFile?.cursorColumn, activeFile?.content, activeFile?.language]);

  /* ── Auto-trigger autocomplete on $ and . ── */
  const handleContentChangeWithAutocomplete = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      handleContentChange(e);
      const val = e.target.value;
      const pos = e.target.selectionStart;
      const ch = val[pos - 1];
      if (ch === "$" || ch === ".") {
        setTimeout(() => triggerAutocomplete(), 50);
      } else if (completionVisible) {
        setTimeout(() => triggerAutocomplete(), 100);
      }
    },
    [handleContentChange, triggerAutocomplete, completionVisible]
  );

  const handleSelect = useCallback(() => {
    if (!activeFile || !textareaRef.current) return;
    const ta = textareaRef.current;
    const pos = ta.selectionStart;
    const lines = ta.value.substring(0, pos).split("\n");
    setCursorPosition(activeFile.id, lines.length, (lines[lines.length - 1]?.length ?? 0) + 1);
  }, [activeFile, setCursorPosition]);

  const handleParse = useCallback(() => {
    if (!activeFile) return;
    const result = parseHdl(activeFile.content, activeFile.filename);
    setParseResult(activeFile.id, result);
    const lintDiags = lintHdl(result, activeFile.content);
    setDiagnostics(activeFile.id, lintDiags);
    appendConsole(
      `[Parse] ${activeFile.filename} — ${result.modules.length} module(s), ${lintDiags.length} diagnostic(s) [${result.parseTimeMs.toFixed(1)}ms]`
    );
  }, [activeFile, setParseResult, setDiagnostics, appendConsole]);

  const handleCopyInstantiation = useCallback(() => {
    const modules = getAllModules();
    if (modules.length === 0) return;
    const template = generateInstantiationTemplate(modules[0]);
    navigator.clipboard.writeText(template).catch(() => {});
    appendConsole(`[Copy] Instantiation template for '${modules[0].name}' copied to clipboard`);
  }, [getAllModules, appendConsole]);

  const handleNewFile = useCallback(
    (lang: HdlLanguage) => {
      const id = newFile(lang);
      addTab({ id: `hdl-tab-${id}`, title: `untitled${lang === "vhdl" ? ".vhd" : lang === "systemverilog" ? ".sv" : ".v"}`, type: "hdl", modified: false });
    },
    [newFile, addTab]
  );

  /* ── Compute diagnostic lines for gutter ── */
  const diagLineMap = useMemo(() => {
    const map = new Map<number, HdlDiagnostic["severity"]>();
    if (!activeFile) return map;
    for (const d of activeFile.diagnostics) {
      const existing = map.get(d.line);
      if (!existing || d.severity === "error" || (d.severity === "warning" && existing !== "error")) {
        map.set(d.line, d.severity);
      }
    }
    return map;
  }, [activeFile]);

  /* ── Syntax-highlighted lines ── */
  const highlightedLines = useMemo(() => {
    if (!activeFile) return [];
    return activeFile.content.split("\n").map((line) =>
      tokenizeLine(line, activeFile.language)
    );
  }, [activeFile]);

  /* ── Diagnostic counts ── */
  const diagCounts = useMemo(() => {
    if (!activeFile) return { errors: 0, warnings: 0, infos: 0 };
    let errors = 0, warnings = 0, infos = 0;
    for (const d of activeFile.diagnostics) {
      if (d.severity === "error") errors++;
      else if (d.severity === "warning") warnings++;
      else infos++;
    }
    return { errors, warnings, infos };
  }, [activeFile]);

  /* ── Empty state ── */
  if (fileList.length === 0) {
    return (
      <div className="hdl-editor">
        <div className="hdl-editor__empty">
          <FileCode size={48} className="hdl-editor__empty-icon" />
          <div className="hdl-editor__empty-title">HDL Editor</div>
          <div style={{ color: "var(--os-fg-muted)", fontSize: "var(--os-font-size-sm)" }}>
            Create or open a Verilog, SystemVerilog, or VHDL file
          </div>
          <div className="hdl-editor__empty-actions">
            <button className="hdl-editor__empty-btn hdl-editor__empty-btn--primary" onClick={() => handleNewFile("verilog")}>
              New Verilog
            </button>
            <button className="hdl-editor__empty-btn" onClick={() => handleNewFile("systemverilog")}>
              New SystemVerilog
            </button>
            <button className="hdl-editor__empty-btn" onClick={() => handleNewFile("vhdl")}>
              New VHDL
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="hdl-editor">
      {/* ── File tabs ── */}
      <div className="hdl-editor__tabs">
        {fileList.map((f) => (
          <div
            key={f.id}
            className={`hdl-editor__tab ${f.id === activeFileId ? "hdl-editor__tab--active" : ""}`}
            onClick={() => setActiveFile(f.id)}
          >
            {f.modified && <span className="hdl-editor__tab-dot">●</span>}
            <span>{f.filename}</span>
            <span className="hdl-editor__tab-lang">{f.language === "systemverilog" ? "SV" : f.language === "vhdl" ? "VHDL" : "V"}</span>
            <button
              className="hdl-editor__tab-close"
              onClick={(e) => { e.stopPropagation(); closeFile(f.id); }}
              aria-label={`Close ${f.filename}`}
            >
              ×
            </button>
          </div>
        ))}
        <button
          className="hdl-editor__tab-close"
          style={{ margin: "0 6px", padding: "4px 6px" }}
          onClick={() => handleNewFile("verilog")}
          title="New HDL File"
          aria-label="New HDL file"
        >
          <Plus size={14} />
        </button>
      </div>

      {/* ── Toolbar ── */}
      <div className="hdl-editor__toolbar">
        <button className="hdl-editor__toolbar-btn hdl-editor__toolbar-btn--primary" onClick={handleParse} title="Parse & Lint">
          <Play size={13} /> Parse
        </button>
        <button className="hdl-editor__toolbar-btn" onClick={handleCopyInstantiation} title="Copy instantiation template">
          <Copy size={13} /> Instantiate
        </button>
        <button className="hdl-editor__toolbar-btn" onClick={() => handleNewFile("verilog")} title="New Verilog file">
          <Plus size={13} /> Verilog
        </button>
        <button className="hdl-editor__toolbar-btn" onClick={() => handleNewFile("systemverilog")} title="New SystemVerilog file">
          <Plus size={13} /> SV
        </button>
        <button className="hdl-editor__toolbar-btn" onClick={() => handleNewFile("vhdl")} title="New VHDL file">
          <Plus size={13} /> VHDL
        </button>
        <div className="hdl-editor__toolbar-separator" />
        <span className="hdl-editor__toolbar-info">
          {activeFile && (
            <>
              <Braces size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
              {activeFile.parseResult?.modules.length ?? 0} module(s) ·{" "}
              {activeFile.language.toUpperCase()}
            </>
          )}
        </span>
      </div>

      {/* ── Breadcrumbs ── */}
      <Breadcrumbs />

      {/* ── Find & Replace widget ── */}
      {findOpen && (
        <div className="hdl-find-widget" role="search" aria-label="Find and Replace">
          <div className="hdl-find-widget__row">
            <div className="hdl-find-widget__input-wrap">
              <Search size={13} />
              <input
                className="hdl-find-widget__input"
                type="text"
                placeholder="Find"
                value={findQuery}
                onChange={(e) => setFindQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleFindNext(); }
                  if (e.key === "Escape") { e.preventDefault(); setFindOpen(false); }
                }}
                autoFocus
              />
            </div>
            <button
              className={`hdl-find-widget__toggle ${findCaseSensitive ? "hdl-find-widget__toggle--active" : ""}`}
              title="Match Case"
              onClick={() => setFindCaseSensitive(!findCaseSensitive)}
            >
              <CaseSensitive size={13} />
            </button>
            <button
              className={`hdl-find-widget__toggle ${findWholeWord ? "hdl-find-widget__toggle--active" : ""}`}
              title="Whole Word"
              onClick={() => setFindWholeWord(!findWholeWord)}
            >
              <WholeWord size={13} />
            </button>
            <button
              className={`hdl-find-widget__toggle ${findUseRegex ? "hdl-find-widget__toggle--active" : ""}`}
              title="Use Regular Expression"
              onClick={() => setFindUseRegex(!findUseRegex)}
            >
              <Regex size={13} />
            </button>
            <span className="hdl-find-widget__count">
              {findMatches.length > 0 ? `${findCurrentIndex + 1}/${findMatches.length}` : "No results"}
            </span>
            <button className="hdl-find-widget__btn" title="Previous (Shift+Enter)" onClick={handleFindPrev}>
              <ArrowUp size={13} />
            </button>
            <button className="hdl-find-widget__btn" title="Next (Enter)" onClick={handleFindNext}>
              <ArrowDown size={13} />
            </button>
            <button
              className="hdl-find-widget__btn"
              title={showReplace ? "Hide Replace" : "Show Replace"}
              onClick={() => setShowReplace(!showReplace)}
            >
              <Replace size={13} />
            </button>
            <button className="hdl-find-widget__btn" title="Close (Escape)" onClick={() => setFindOpen(false)}>
              <X size={13} />
            </button>
          </div>
          {showReplace && (
            <div className="hdl-find-widget__row">
              <div className="hdl-find-widget__input-wrap">
                <PenLine size={13} />
                <input
                  className="hdl-find-widget__input"
                  type="text"
                  placeholder="Replace"
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); handleReplaceCurrent(); }
                    if (e.key === "Escape") { e.preventDefault(); setFindOpen(false); }
                  }}
                />
              </div>
              <button className="hdl-find-widget__btn hdl-find-widget__btn--replace" title="Replace" onClick={handleReplaceCurrent}>
                Replace
              </button>
              <button className="hdl-find-widget__btn hdl-find-widget__btn--replace" title="Replace All" onClick={handleReplaceAll}>
                All
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Go to Line dialog ── */}
      {goToLineOpen && (
        <div className="hdl-goto-line" role="dialog" aria-label="Go to Line">
          <label className="hdl-goto-line__label">Go to Line:</label>
          <input
            className="hdl-goto-line__input"
            type="number"
            min={1}
            max={activeFile ? activeFile.content.split("\n").length : 1}
            placeholder={`1–${activeFile ? activeFile.content.split("\n").length : 1}`}
            value={goToLineInput}
            onChange={(e) => setGoToLineInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleGoToLine(); }
              if (e.key === "Escape") { e.preventDefault(); setGoToLineOpen(false); }
            }}
            autoFocus
          />
          <button className="hdl-goto-line__btn" onClick={handleGoToLine}>Go</button>
        </div>
      )}

      {/* ── Rename Symbol dialog ── */}
      {renameState && (
        <div className="hdl-rename-dialog" role="dialog" aria-label="Rename Symbol">
          <div className="hdl-rename-dialog__header">
            <PenLine size={13} />
            <span>Rename <strong>{renameState.word}</strong> ({renameState.occurrences.length} occurrences)</span>
          </div>
          <div className="hdl-rename-dialog__body">
            <input
              className="hdl-rename-dialog__input"
              type="text"
              value={renameState.newName}
              onChange={(e) => setRenameState((s) => s ? { ...s, newName: e.target.value } : null)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); handleRenameApply(); }
                if (e.key === "Escape") { e.preventDefault(); setRenameState(null); }
              }}
              autoFocus
            />
            <button className="hdl-rename-dialog__btn" onClick={handleRenameApply}>
              Rename
            </button>
            <button className="hdl-rename-dialog__btn hdl-rename-dialog__btn--cancel" onClick={() => setRenameState(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Code area ── */}
      {activeFile && (
        <div className="hdl-editor__code-area" ref={codeAreaRef}>
          {/* Gutter with fold indicators */}
          <div className="hdl-editor__gutter" aria-hidden="true">
            {highlightedLines.map((_, i) => {
              const lineNum = i + 1;
              if (hiddenLines.has(lineNum)) return null;
              const diagSev = diagLineMap.get(lineNum);
              const foldRegion = foldRegions.find((r) => r.startLine === lineNum);
              const isFolded = collapsedLines.has(lineNum);
              const isBracketMatch =
                (matchedBracket && (lineNum === matchedBracket.openLine || lineNum === matchedBracket.closeLine)) ||
                (matchedKeyword && lineNum === matchedKeyword.matchLine);
              const hasExtraCursor = extraCursors.some((c) => c.line === lineNum);
              return (
                <div
                  key={lineNum}
                  className={`hdl-editor__line-number ${
                    lineNum === activeFile.cursorLine ? "hdl-editor__line-number--active" : ""
                  } ${diagSev === "error" ? "hdl-editor__line-number--error" : diagSev === "warning" ? "hdl-editor__line-number--warning" : ""} ${
                    isBracketMatch ? "hdl-editor__line-number--bracket-match" : ""
                  } ${hasExtraCursor ? "hdl-editor__line-number--multi-cursor" : ""}`}
                >
                  {foldRegion ? (
                    <span
                      className="hdl-editor__fold-icon"
                      onClick={() => toggleFold(lineNum)}
                      title={isFolded ? "Unfold" : "Fold"}
                    >
                      {isFolded ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                    </span>
                  ) : (
                    <span className="hdl-editor__fold-spacer" />
                  )}
                  {lineNum}
                </div>
              );
            })}
          </div>

          {/* Source */}
          <div className="hdl-editor__source">
            <textarea
              ref={textareaRef}
              className="hdl-editor__textarea"
              value={activeFile.content}
              onChange={handleContentChangeWithAutocomplete}
              onKeyDown={handleKeyDown}
              onSelect={handleSelect}
              onClick={handleSelect}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              aria-label={`HDL source code for ${activeFile.filename}`}
            />
            <div className="hdl-editor__highlight" aria-hidden="true">
              {highlightedLines.map((tokens, i) => {
                const lineNum = i + 1;
                if (hiddenLines.has(lineNum)) return null;
                const isFoldStart = collapsedLines.has(lineNum);
                return (
                  <div key={i} className="hdl-editor__line">
                    {tokens.map((tok, j) => (
                      <span key={j} className={tok.className}>
                        {tok.text}
                      </span>
                    ))}
                    {isFoldStart && (
                      <span className="hdl-editor__fold-placeholder" onClick={() => toggleFold(lineNum)}>
                        {" "}⋯
                      </span>
                    )}
                    {tokens.length === 0 && "\n"}
                  </div>
                );
              })}
            </div>

            {/* Find match highlights */}
            {findOpen && findMatches.length > 0 && (
              <div className="hdl-editor__find-highlights" aria-hidden="true">
                {findMatches.map((match, idx) => {
                  if (hiddenLines.has(match.line)) return null;
                  const visibleLine = match.line - 1 - Array.from(hiddenLines).filter((l) => l < match.line).length;
                  return (
                    <div
                      key={idx}
                      className={`hdl-editor__find-match ${idx === findCurrentIndex ? "hdl-editor__find-match--current" : ""}`}
                      style={{
                        top: `${visibleLine * 1.6}em`,
                        left: `${match.start * 0.6}em`,
                        width: `${(match.end - match.start) * 0.6}em`,
                      }}
                    />
                  );
                })}
              </div>
            )}

            {/* Bracket match highlights */}
            {matchedBracket && (
              <div className="hdl-editor__bracket-highlights" aria-hidden="true">
                {!hiddenLines.has(matchedBracket.openLine) && (
                  <div
                    className="hdl-editor__bracket-match"
                    style={{
                      top: `${(matchedBracket.openLine - 1) * 1.6}em`,
                      left: `${matchedBracket.openCol * 0.6}em`,
                      width: "0.6em",
                    }}
                  />
                )}
                {!hiddenLines.has(matchedBracket.closeLine) && (
                  <div
                    className="hdl-editor__bracket-match"
                    style={{
                      top: `${(matchedBracket.closeLine - 1) * 1.6}em`,
                      left: `${matchedBracket.closeCol * 0.6}em`,
                      width: "0.6em",
                    }}
                  />
                )}
              </div>
            )}

            {/* Multi-cursor indicators */}
            {extraCursors.length > 0 && (
              <div className="hdl-editor__multi-cursors" aria-hidden="true">
                {extraCursors.map((c, idx) => (
                  <div
                    key={idx}
                    className="hdl-editor__extra-cursor"
                    style={{
                      top: `${(c.line - 1) * 1.6}em`,
                      left: `${c.col * 0.6}em`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Enhanced Minimap with viewport indicator + click-to-scroll */}
          <div
            className="hdl-editor__minimap"
            ref={minimapRef}
            aria-hidden="true"
            onClick={(e) => {
              if (!codeAreaRef.current || !minimapRef.current) return;
              const rect = minimapRef.current.getBoundingClientRect();
              const frac = (e.clientY - rect.top) / rect.height;
              const scrollTarget = frac * codeAreaRef.current.scrollHeight;
              codeAreaRef.current.scrollTop = scrollTarget - codeAreaRef.current.clientHeight / 2;
            }}
          >
            {/* Viewport indicator */}
            <div
              className="hdl-editor__minimap-viewport"
              style={{
                top: codeAreaRef.current
                  ? `${(codeAreaRef.current.scrollTop / Math.max(codeAreaRef.current.scrollHeight, 1)) * 100}%`
                  : "0%",
                height: codeAreaRef.current
                  ? `${Math.max((codeAreaRef.current.clientHeight / Math.max(codeAreaRef.current.scrollHeight, 1)) * 100, 5)}%`
                  : "20%",
              }}
            />
            {highlightedLines.map((tokens, i) => {
              const lineNum = i + 1;
              if (hiddenLines.has(lineNum)) return null;
              const hasContent = tokens.some((t) => t.text.trim().length > 0);
              const hasKeyword = tokens.some((t) => t.className === "tok-keyword" || t.className === "tok-module");
              const hasDiag = diagLineMap.has(lineNum);
              return (
                <div
                  key={i}
                  className="hdl-editor__minimap-line"
                  style={{
                    background: hasDiag
                      ? diagLineMap.get(lineNum) === "error"
                        ? "var(--os-accent-error, #ef5350)"
                        : "var(--os-accent-warning, #ffa726)"
                      : hasKeyword
                        ? "var(--os-accent-primary)"
                        : hasContent
                          ? "var(--os-fg-muted)"
                          : "transparent",
                    width: `${Math.min(52, (tokens.reduce((a, t) => a + t.text.length, 0) / 80) * 52)}px`,
                  }}
                />
              );
            })}
          </div>

          {/* Autocomplete popup */}
          {completionVisible && completions.length > 0 && (
            <div
              className="hdl-autocomplete"
              style={{ top: completionPos.top, left: completionPos.left }}
              role="listbox"
              aria-label="Autocomplete suggestions"
            >
              {completions.map((item, idx) => (
                <div
                  key={item.label + idx}
                  className={`hdl-autocomplete__item ${idx === completionIndex ? "hdl-autocomplete__item--active" : ""}`}
                  role="option"
                  aria-selected={idx === completionIndex}
                  onMouseDown={(e) => { e.preventDefault(); applyCompletion(item); }}
                  onMouseEnter={() => setCompletionIndex(idx)}
                >
                  <span className={`hdl-autocomplete__kind hdl-autocomplete__kind--${item.kind}`}>
                    {item.kind === "keyword" ? "K" : item.kind === "module" ? "M" : item.kind === "signal" ? "S" :
                     item.kind === "port" ? "P" : item.kind === "parameter" ? "#" : item.kind === "snippet" ? "⚡" :
                     item.kind === "type" ? "T" : item.kind === "systemTask" ? "F" : item.kind === "directive" ? "D" :
                     item.kind === "instance" ? "I" : "·"}
                  </span>
                  <span className="hdl-autocomplete__label">{item.label}</span>
                  {item.detail && <span className="hdl-autocomplete__detail">{item.detail}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* References panel */}
      {refsPanel && (
        <div className="hdl-refs-panel">
          <div className="hdl-refs-panel__header">
            <span>References: <strong>{refsPanel.word}</strong> ({refsPanel.refs.length})</span>
            <button className="hdl-refs-panel__close" onClick={() => setRefsPanel(null)} aria-label="Close references">×</button>
          </div>
          <div className="hdl-refs-panel__list">
            {refsPanel.refs.map((ref, idx) => (
              <div key={idx} className="hdl-refs-panel__item" onClick={() => {
                const target = Array.from(files.values()).find((f) => f.filename === ref.file);
                if (target) setActiveFile(target.id);
                setRefsPanel(null);
              }}>
                <span className="hdl-refs-panel__file">{ref.file}</span>
                <span className="hdl-refs-panel__line">:{ref.line}</span>
                <span className="hdl-refs-panel__text">{ref.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Peek Definition inline panel */}
      {peekDef && (
        <div className="hdl-peek-panel">
          <div className="hdl-peek-panel__header">
            <Eye size={12} />
            <span className="hdl-peek-panel__title">
              <strong>{peekDef.word}</strong> — {peekDef.filename}:{peekDef.line}
            </span>
            <button className="hdl-peek-panel__close" onClick={() => setPeekDef(null)} aria-label="Close peek">
              <X size={12} />
            </button>
            <button
              className="hdl-peek-panel__goto"
              title="Go to Definition (F12)"
              onClick={() => {
                handleGoToDefinition();
                setPeekDef(null);
              }}
            >
              Go to →
            </button>
          </div>
          <div className="hdl-peek-panel__code">
            {peekDef.preview.map((line, idx) => {
              const absLine = Math.max(1, peekDef.line - 2) + idx;
              return (
                <div
                  key={idx}
                  className={`hdl-peek-panel__line ${absLine === peekDef.line ? "hdl-peek-panel__line--highlight" : ""}`}
                >
                  <span className="hdl-peek-panel__line-no">{absLine}</span>
                  <span className="hdl-peek-panel__line-text">{line}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Diagnostics bar ── */}
      {activeFile && (
        <div className="hdl-editor__diagnostics">
          <span className="hdl-editor__diag-item hdl-editor__diag-error">
            <XCircle size={13} /> {diagCounts.errors}
          </span>
          <span className="hdl-editor__diag-item hdl-editor__diag-warning">
            <AlertTriangle size={13} /> {diagCounts.warnings}
          </span>
          <span className="hdl-editor__diag-item hdl-editor__diag-info">
            <Info size={13} /> {diagCounts.infos}
          </span>
          <span className="hdl-editor__cursor-pos">
            Ln {activeFile.cursorLine}, Col {activeFile.cursorColumn}
            {extraCursors.length > 0 && (
              <span className="hdl-editor__multi-cursor-count">
                {" "}+{extraCursors.length} cursor{extraCursors.length > 1 ? "s" : ""}
              </span>
            )}
            {matchedKeyword && (
              <span className="hdl-editor__bracket-indicator">
                {" "}⟨{matchedKeyword.keyword} Ln {matchedKeyword.matchLine}⟩
              </span>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
