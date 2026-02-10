/**
 * Lightweight structured logger for OpenSilicon.
 *
 * Provides consistent prefixed log output with level control.
 * In production Tauri builds, only warnings and errors are emitted.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;
const minLevel: LogLevel = isTauri ? "warn" : "debug";

function shouldLog(level: LogLevel): boolean {
  return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * Create a namespaced logger.
 *
 * ```ts
 * const log = createLogger("DRC");
 * log.info("Check completed", { violations: 3 });
 * // → [OpenSilicon:DRC] Check completed { violations: 3 }
 * ```
 */
export function createLogger(namespace: string): Logger {
  const prefix = `[OpenSilicon:${namespace}]`;

  return {
    debug: (...args) => {
      if (shouldLog("debug")) console.debug(prefix, ...args);
    },
    info: (...args) => {
      if (shouldLog("info")) console.log(prefix, ...args);
    },
    warn: (...args) => {
      if (shouldLog("warn")) console.warn(prefix, ...args);
    },
    error: (...args) => {
      if (shouldLog("error")) console.error(prefix, ...args);
    },
  };
}
