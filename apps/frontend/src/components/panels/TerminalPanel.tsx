/**
 * TerminalPanel — Interactive terminal emulator.
 * In Tauri mode: would connect to a real shell via the Tauri shell plugin.
 * In browser-dev mode: provides a simulated shell with EDA commands.
 */

import { useRef, useEffect, useCallback, useMemo } from "react";
import { useTerminalStore, type TerminalLine as TermLine } from "../../stores/terminalStore";
import "./TerminalPanel.css";

/* ------------------------------------------------------------------ */
/*  Syntax coloring for terminal output                                */
/* ------------------------------------------------------------------ */

/** Color tokens used in terminal syntax highlighting */
interface ColorSpan {
  text: string;
  className: string;
}

/** Tokenize a terminal output line into colored spans */
function colorize(text: string, lineType: TermLine["type"]): ColorSpan[] {
  // Input lines are already green; errors already red — skip those
  if (lineType === "input" || lineType === "error" || lineType === "system") {
    return [{ text, className: "" }];
  }

  const spans: ColorSpan[] = [];
  let remaining = text;

  // Tokenization patterns (order matters — first match wins for each segment)
  const patterns: { regex: RegExp; cls: string }[] = [
    // ANSI escape sequences — strip them
    { regex: /\x1b\[[0-9;]*m/, cls: "__strip__" },
    // Paths like /foo/bar.v, ./rtl/top.v, ../tb/tb.vhd
    { regex: /(?:(?:\.{1,2}\/|\/)(?:[\w.-]+\/)*[\w.-]+\.\w+)/, cls: "term-path" },
    // Quoted strings
    { regex: /"[^"]*"/, cls: "term-string" },
    { regex: /'[^']*'/, cls: "term-string" },
    // Numbers (hex, decimal, binary with units)
    { regex: /\b0x[0-9a-fA-F]+\b/, cls: "term-number" },
    { regex: /\b\d+(\.\d+)?(%|\s*(MHz|kHz|Hz|KB|MB|ns|us|ms|s))?\b/, cls: "term-number" },
    // Known EDA tool names / keywords
    { regex: /\b(iverilog|vvp|yosys|verilator|gtkwave|make|gcc|ld|openocd|ngspice|xschem|magic|klayout|iceprog|nextpnr|openfpgaloader|esptool)\b/, cls: "term-tool" },
    // Verilog / HDL keywords that might appear in output
    { regex: /\b(module|endmodule|wire|reg|input|output|assign|always|initial)\b/, cls: "term-keyword" },
    // Success words
    { regex: /\b(complete|success|passed|done|ok|built|ready|connected|loaded)\b/i, cls: "term-success" },
    // Warning words
    { regex: /\b(warning|warn|deprecated|caution|notice)\b/i, cls: "term-warning" },
    // Error words
    { regex: /\b(error|fail|failed|fatal|abort|aborted|missing|not found|denied|refused)\b/i, cls: "term-error-word" },
    // Flags / options like -g, --output, -Wall
    { regex: /(?:^|\s)(-{1,2}[a-zA-Z][a-zA-Z0-9_-]*)/, cls: "term-flag" },
    // Arrows / separators (→, =>, ->, ::, |)
    { regex: /[→=>\->]+|::/, cls: "term-operator" },
    // Prompt-like patterns: yosys>, $$
    { regex: /^\w+>/, cls: "term-prompt" },
    // Variable assignments: KEY=value
    { regex: /\b[A-Z_][A-Z0-9_]*=/, cls: "term-var" },
  ];

  while (remaining.length > 0) {
    let earliestIdx = remaining.length;
    let earliestMatch: RegExpExecArray | null = null;
    let earliestCls = "";

    for (const { regex, cls } of patterns) {
      const re = new RegExp(regex.source, regex.flags.includes("i") ? "i" : "");
      const m = re.exec(remaining);
      if (m && m.index < earliestIdx) {
        earliestIdx = m.index;
        earliestMatch = m;
        earliestCls = cls;
      }
    }

    if (!earliestMatch) {
      // No more matches — push the rest as plain text
      spans.push({ text: remaining, className: "" });
      break;
    }

    // Push any plain text before the match
    if (earliestIdx > 0) {
      spans.push({ text: remaining.slice(0, earliestIdx), className: "" });
    }

    // Push the match (unless it's an ANSI strip)
    if (earliestCls !== "__strip__") {
      spans.push({ text: earliestMatch[0], className: earliestCls });
    }

    remaining = remaining.slice(earliestIdx + earliestMatch[0].length);
  }

  return spans;
}

function TerminalLine({ line }: { line: TermLine }) {
  let className = "terminal-line";
  if (line.type === "input") className += " terminal-line--input";
  else if (line.type === "error") className += " terminal-line--error";
  else if (line.type === "system") className += " terminal-line--system";

  // For output lines, apply syntax coloring
  const spans = useMemo(() => colorize(line.text, line.type), [line.text, line.type]);

  if (line.type === "output") {
    return (
      <div className={className}>
        {spans.map((s, i) =>
          s.className ? (
            <span key={i} className={s.className}>{s.text}</span>
          ) : (
            <span key={i}>{s.text}</span>
          )
        )}
      </div>
    );
  }

  return <div className={className}>{line.text || "\u00A0"}</div>;
}

export function TerminalPanel() {
  const lines = useTerminalStore((s) => s.lines);
  const currentInput = useTerminalStore((s) => s.currentInput);
  const isRunning = useTerminalStore((s) => s.isRunning);
  const cwd = useTerminalStore((s) => s.cwd);
  const executeCommand = useTerminalStore((s) => s.executeCommand);
  const setCurrentInput = useTerminalStore((s) => s.setCurrentInput);
  const navigateHistory = useTerminalStore((s) => s.navigateHistory);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new lines appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines.length]);

  // Focus input when panel becomes visible
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (currentInput.trim() || !isRunning) {
        executeCommand(currentInput);
      }
    },
    [currentInput, isRunning, executeCommand]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        navigateHistory("up");
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        navigateHistory("down");
      } else if (e.key === "c" && e.ctrlKey) {
        e.preventDefault();
        if (isRunning) {
          useTerminalStore.getState().appendLine("^C", "system");
        }
      } else if (e.key === "l" && e.ctrlKey) {
        e.preventDefault();
        useTerminalStore.getState().clearTerminal();
      }
    },
    [navigateHistory, isRunning]
  );

  const handleContainerClick = useCallback(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="terminal-panel" onClick={handleContainerClick}>
      <div className="terminal-panel__output" ref={scrollRef}>
        {lines.map((line) => (
          <TerminalLine key={line.id} line={line} />
        ))}
      </div>
      <form className="terminal-panel__input-row" onSubmit={handleSubmit}>
        <span className="terminal-panel__prompt">{cwd}$</span>
        <input
          ref={inputRef}
          type="text"
          className="terminal-panel__input"
          value={currentInput}
          onChange={(e) => setCurrentInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isRunning}
          autoComplete="off"
          spellCheck={false}
          aria-label="Terminal input"
        />
      </form>
    </div>
  );
}
