/**
 * SerialMonitor — Bottom panel for UART/serial communication with boards.
 * Supports text & hex display, configurable baud/data/parity/stop, timestamps.
 */

import { useRef, useEffect, useCallback } from "react";
import { useSerialStore, type BaudRate } from "../../stores/serialStore";
import { useBoardStore } from "../../stores/boardStore";
import {
  Play,
  Square,
  Trash2,
  ArrowDown,
  ArrowUp,
  Send,
  Settings2,
  Clock,
  Binary,
  Type,
} from "lucide-react";
import "./SerialMonitor.css";

const BAUD_OPTIONS: BaudRate[] = [300, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

function formatHexByte(b: number): string {
  return b.toString(16).toUpperCase().padStart(2, "0");
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}:${d.getSeconds().toString().padStart(2, "0")}.${d.getMilliseconds().toString().padStart(3, "0")}`;
}

export function SerialMonitor() {
  const {
    baudRate, setBaudRate,
    lineEnding, setLineEnding,
    displayMode, setDisplayMode,
    autoscroll, toggleAutoscroll,
    showTimestamps, toggleTimestamps,
    isOpen, openPort, closePort,
    messages, clearMessages,
    inputBuffer, setInputBuffer,
    send,
    rxCount, txCount,
  } = useSerialStore();

  const connectionStatus = useBoardStore((s) => s.connectionStatus);
  const connectionPort = useBoardStore((s) => s.connectionPort);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Autoscroll
  useEffect(() => {
    if (autoscroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, autoscroll]);

  const handleSend = useCallback(() => {
    if (inputBuffer.trim()) {
      send(inputBuffer);
      inputRef.current?.focus();
    }
  }, [inputBuffer, send]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const canOpen = connectionStatus === "connected" && !isOpen;
  const canSend = isOpen && connectionStatus === "connected";

  return (
    <div className="serial-monitor">
      {/* ── Toolbar ── */}
      <div className="serial-monitor__toolbar">
        <div className="serial-monitor__toolbar-left">
          {!isOpen ? (
            <button
              className="serial-monitor__btn serial-monitor__btn--open"
              disabled={!canOpen}
              onClick={openPort}
              title={canOpen ? `Open ${connectionPort || "serial port"}` : "Connect to board first"}
            >
              <Play size={12} /> Open Port
            </button>
          ) : (
            <button className="serial-monitor__btn serial-monitor__btn--close" onClick={closePort}>
              <Square size={12} /> Close
            </button>
          )}

          <select
            className="serial-monitor__select"
            value={baudRate}
            onChange={(e) => setBaudRate(Number(e.target.value) as BaudRate)}
            title="Baud rate"
          >
            {BAUD_OPTIONS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>

          <select
            className="serial-monitor__select serial-monitor__select--sm"
            value={lineEnding}
            onChange={(e) => setLineEnding(e.target.value as typeof lineEnding)}
            title="Line ending"
          >
            <option value="none">No LE</option>
            <option value="cr">CR</option>
            <option value="lf">LF</option>
            <option value="crlf">CR+LF</option>
          </select>
        </div>

        <div className="serial-monitor__toolbar-right">
          <button
            className={`serial-monitor__toggle ${displayMode === "text" ? "serial-monitor__toggle--active" : ""}`}
            onClick={() => setDisplayMode("text")}
            title="Text view"
          >
            <Type size={12} />
          </button>
          <button
            className={`serial-monitor__toggle ${displayMode === "hex" ? "serial-monitor__toggle--active" : ""}`}
            onClick={() => setDisplayMode("hex")}
            title="Hex view"
          >
            <Binary size={12} />
          </button>
          <button
            className={`serial-monitor__toggle ${displayMode === "mixed" ? "serial-monitor__toggle--active" : ""}`}
            onClick={() => setDisplayMode("mixed")}
            title="Mixed view"
          >
            <Settings2 size={12} />
          </button>

          <span className="serial-monitor__sep" />

          <button
            className={`serial-monitor__toggle ${showTimestamps ? "serial-monitor__toggle--active" : ""}`}
            onClick={toggleTimestamps}
            title="Show timestamps"
          >
            <Clock size={12} />
          </button>
          <button
            className={`serial-monitor__toggle ${autoscroll ? "serial-monitor__toggle--active" : ""}`}
            onClick={toggleAutoscroll}
            title="Autoscroll"
          >
            <ArrowDown size={12} />
          </button>

          <button className="serial-monitor__btn" onClick={clearMessages} title="Clear output">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* ── Output Area ── */}
      <div className="serial-monitor__output" ref={scrollRef}>
        {!isOpen && messages.length === 0 ? (
          <div className="serial-monitor__empty">
            {connectionStatus !== "connected"
              ? "Connect to a board to use the serial monitor"
              : "Click 'Open Port' to start"}
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`serial-monitor__line serial-monitor__line--${msg.direction}`}
            >
              {showTimestamps && (
                <span className="serial-monitor__timestamp">
                  {formatTimestamp(msg.timestamp)}
                </span>
              )}
              <span className="serial-monitor__dir-badge">
                {msg.direction === "tx" ? "TX" : "RX"}
              </span>
              {displayMode === "text" && (
                <span className="serial-monitor__data">
                  {msg.data.replace(/\r?\n$/, "")}
                </span>
              )}
              {displayMode === "hex" && msg.raw && (
                <span className="serial-monitor__data serial-monitor__data--hex">
                  {msg.raw.map(formatHexByte).join(" ")}
                </span>
              )}
              {displayMode === "mixed" && (
                <span className="serial-monitor__data">
                  {msg.data.replace(/\r?\n$/, "")}
                  {msg.raw && (
                    <span className="serial-monitor__hex-inline">
                      {" "}[{msg.raw.map(formatHexByte).join(" ")}]
                    </span>
                  )}
                </span>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── Input Bar ── */}
      <div className="serial-monitor__input-bar">
        <input
          ref={inputRef}
          className="serial-monitor__input"
          placeholder={canSend ? "Type message and press Enter…" : "Open port to send"}
          value={inputBuffer}
          onChange={(e) => setInputBuffer(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!canSend}
        />
        <button
          className="serial-monitor__send-btn"
          onClick={handleSend}
          disabled={!canSend || !inputBuffer.trim()}
          title="Send"
        >
          <Send size={13} />
        </button>
        <span className="serial-monitor__stats">
          <ArrowUp size={10} /> {txCount}
          <ArrowDown size={10} /> {rxCount}
        </span>
      </div>
    </div>
  );
}
