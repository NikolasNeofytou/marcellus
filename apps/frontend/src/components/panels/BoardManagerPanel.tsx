/**
 * BoardManagerPanel — Sidebar panel for detecting, selecting, and configuring
 * electronics development boards (STM32, ESP32, FPGA, Arduino, etc.)
 */

import type { ReactElement } from "react";
import { useState } from "react";
import { useBoardStore, type BoardProfile, type BoardFamily } from "../../stores/boardStore";
import {
  Cpu,
  Plug,
  PlugZap,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Wifi,
  Usb,
  CircleDot,
  CheckCircle2,
  XCircle,
  Loader2,
  Settings2,
  Zap,
  Bug,
  Cable,
} from "lucide-react";
import "./BoardManagerPanel.css";

const FAMILY_LABELS: Record<BoardFamily, string> = {
  stm32: "STM32",
  esp32: "ESP32",
  nrf52: "nRF52",
  rp2040: "RP2040",
  "fpga-ice40": "iCE40 FPGA",
  "fpga-ecp5": "ECP5 FPGA",
  "fpga-xilinx": "Xilinx FPGA",
  arduino: "Arduino",
  custom: "Custom",
};

const CONN_ICON: Record<string, ReactElement> = {
  usb:  <Usb size={12} />,
  uart: <Cable size={12} />,
  jtag: <PlugZap size={12} />,
  swd:  <CircleDot size={12} />,
  spi:  <Zap size={12} />,
  wifi: <Wifi size={12} />,
  none: <Plug size={12} />,
};

export function BoardManagerPanel() {
  const boards = useBoardStore((s) => s.boards);
  const activeBoard = useBoardStore((s) => s.activeBoard);
  const setActiveBoard = useBoardStore((s) => s.setActiveBoard);
  const connectionStatus = useBoardStore((s) => s.connectionStatus);
  const connectionPort = useBoardStore((s) => s.connectionPort);
  const setConnectionPort = useBoardStore((s) => s.setConnectionPort);
  const availablePorts = useBoardStore((s) => s.availablePorts);
  const scanPorts = useBoardStore((s) => s.scanPorts);
  const connect = useBoardStore((s) => s.connect);
  const disconnect = useBoardStore((s) => s.disconnect);
  const connectionLog = useBoardStore((s) => s.connectionLog);

  const [expandedFamily, setExpandedFamily] = useState<BoardFamily | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [filterText, setFilterText] = useState("");

  // Group boards by family
  const families = new Map<BoardFamily, BoardProfile[]>();
  for (const b of boards) {
    const fam = families.get(b.family) || [];
    fam.push(b);
    families.set(b.family, fam);
  }

  const statusColor =
    connectionStatus === "connected" ? "var(--os-success, #4caf50)"
    : connectionStatus === "connecting" ? "var(--os-warning, #ff9800)"
    : connectionStatus === "error" ? "var(--os-error, #f44336)"
    : "var(--os-fg-muted)";

  const StatusIcon =
    connectionStatus === "connected" ? <CheckCircle2 size={14} style={{ color: statusColor }} />
    : connectionStatus === "connecting" ? <Loader2 size={14} className="board-spin" style={{ color: statusColor }} />
    : connectionStatus === "error" ? <XCircle size={14} style={{ color: statusColor }} />
    : <Plug size={14} style={{ color: statusColor }} />;

  return (
    <div className="board-manager">
      {/* ── Status Banner ── */}
      <div className="board-manager__status">
        {StatusIcon}
        <span className="board-manager__status-text">
          {activeBoard
            ? `${activeBoard.name} — ${connectionStatus}`
            : "No board selected"}
        </span>
      </div>

      {/* ── Connection Controls ── */}
      {activeBoard && (
        <div className="board-manager__connection">
          <div className="board-manager__port-row">
            <select
              className="board-manager__port-select"
              value={connectionPort}
              onChange={(e) => setConnectionPort(e.target.value)}
            >
              <option value="">Auto-detect</option>
              {availablePorts.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button className="board-manager__icon-btn" title="Scan ports" onClick={scanPorts}>
              <RefreshCw size={13} />
            </button>
          </div>
          <div className="board-manager__connect-row">
            {connectionStatus === "disconnected" || connectionStatus === "error" ? (
              <button className="board-manager__btn board-manager__btn--connect" onClick={connect}>
                <Plug size={13} /> Connect
              </button>
            ) : connectionStatus === "connected" ? (
              <button className="board-manager__btn board-manager__btn--disconnect" onClick={disconnect}>
                <PlugZap size={13} /> Disconnect
              </button>
            ) : (
              <button className="board-manager__btn" disabled>
                <Loader2 size={13} className="board-spin" /> Connecting…
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Active Board Details ── */}
      {activeBoard && (
        <div className="board-manager__details">
          <div className="board-manager__section-header">
            <Settings2 size={13} /> Board Details
          </div>
          <div className="board-manager__detail-grid">
            <span className="board-manager__label">MCU</span>
            <span className="board-manager__value">{activeBoard.mcu}</span>
            <span className="board-manager__label">Clock</span>
            <span className="board-manager__value">{activeBoard.clockSpeed}</span>
            <span className="board-manager__label">Flash</span>
            <span className="board-manager__value">{activeBoard.flash}</span>
            <span className="board-manager__label">RAM</span>
            <span className="board-manager__value">{activeBoard.ram}</span>
            <span className="board-manager__label">Interface</span>
            <span className="board-manager__value">
              {CONN_ICON[activeBoard.connectionInterface]} {activeBoard.connectionInterface.toUpperCase()}
            </span>
            <span className="board-manager__label">Programmer</span>
            <span className="board-manager__value">{activeBoard.programmer}</span>
            <span className="board-manager__label">Debug</span>
            <span className="board-manager__value">{activeBoard.debugProbe}</span>
          </div>
        </div>
      )}

      {/* ── Quick Actions ── */}
      {activeBoard && connectionStatus === "connected" && (
        <div className="board-manager__quick-actions">
          <button
            className="board-manager__action-btn"
            title="Flash firmware"
            onClick={() => {
              import("../../stores/simStore").then(({ useSimStore }) =>
                useSimStore.getState().setActiveTab("flash" as never)
              );
            }}
          >
            <Zap size={14} /> Flash
          </button>
          <button
            className="board-manager__action-btn"
            title="Start debugger"
            onClick={() => {
              import("../../stores/simStore").then(({ useSimStore }) =>
                useSimStore.getState().setActiveTab("debug" as never)
              );
            }}
          >
            <Bug size={14} /> Debug
          </button>
          <button
            className="board-manager__action-btn"
            title="Serial monitor"
            onClick={() => {
              import("../../stores/simStore").then(({ useSimStore }) =>
                useSimStore.getState().setActiveTab("serial" as never)
              );
            }}
          >
            <Cable size={14} /> Serial
          </button>
        </div>
      )}

      {/* ── Board Library ── */}
      <div className="board-manager__section-header" style={{ marginTop: 8 }}>
        <Cpu size={13} /> Board Library
      </div>
      <input
        className="board-manager__filter"
        placeholder="Filter boards…"
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
      />
      <div className="board-manager__list">
        {Array.from(families.entries()).map(([family, familyBoards]) => {
          const filteredBoards = filterText
            ? familyBoards.filter(
                (b) =>
                  b.name.toLowerCase().includes(filterText.toLowerCase()) ||
                  b.mcu.toLowerCase().includes(filterText.toLowerCase())
              )
            : familyBoards;
          if (filteredBoards.length === 0) return null;

          const isExpanded = expandedFamily === family || !!filterText;
          return (
            <div key={family} className="board-manager__family">
              <button
                className="board-manager__family-header"
                onClick={() => setExpandedFamily(isExpanded && !filterText ? null : family)}
              >
                {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <span>{FAMILY_LABELS[family]}</span>
                <span className="board-manager__family-count">{filteredBoards.length}</span>
              </button>
              {isExpanded &&
                filteredBoards.map((board) => (
                  <button
                    key={board.id}
                    className={`board-manager__board-item ${activeBoard?.id === board.id ? "board-manager__board-item--active" : ""}`}
                    onClick={() => setActiveBoard(board)}
                    title={`${board.mcu} — ${board.clockSpeed}`}
                  >
                    {CONN_ICON[board.connectionInterface]}
                    <span className="board-manager__board-name">{board.name}</span>
                    {activeBoard?.id === board.id && <CheckCircle2 size={11} />}
                  </button>
                ))}
            </div>
          );
        })}
      </div>

      {/* ── Connection Log ── */}
      <button
        className="board-manager__section-header board-manager__section-header--toggle"
        onClick={() => setShowLog(!showLog)}
        style={{ marginTop: 8 }}
      >
        {showLog ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        Connection Log
      </button>
      {showLog && (
        <div className="board-manager__log">
          {connectionLog.length === 0
            ? <span className="board-manager__log-empty">No log entries</span>
            : connectionLog.map((msg, i) => (
                <div key={i} className="board-manager__log-line">{msg}</div>
              ))}
        </div>
      )}
    </div>
  );
}
