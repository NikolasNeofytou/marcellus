/**
 * FlashProgrammer — Bottom panel tab for flashing firmware/bitstreams to boards.
 * Supports multiple programmers: OpenOCD, ST-Link, J-Link, esptool, iceprog, etc.
 */

import { useCallback } from "react";
import { useBoardStore } from "../../stores/boardStore";
import {
  Zap,
  Upload,
  FolderOpen,
  CheckCircle2,
  XCircle,
  Loader2,
  FileCode,
  Cpu,
  Clock,
  HardDrive,
} from "lucide-react";
import "./FlashProgrammer.css";

export function FlashProgrammer() {
  const activeBoard = useBoardStore((s) => s.activeBoard);
  const connectionStatus = useBoardStore((s) => s.connectionStatus);
  const firmwarePath = useBoardStore((s) => s.firmwarePath);
  const setFirmwarePath = useBoardStore((s) => s.setFirmwarePath);
  const flashProgress = useBoardStore((s) => s.flashProgress);
  const startFlash = useBoardStore((s) => s.startFlash);
  const lastFlashTime = useBoardStore((s) => s.lastFlashTime);

  const handleBrowse = useCallback(async () => {
    try {
      const { showOpenDialog } = await import("../../ipc/bridge");
      const result = await showOpenDialog([
        { name: "Firmware", extensions: ["bin", "hex", "elf", "bit", "svf", "uf2", "dfu"] },
        { name: "All Files", extensions: ["*"] },
      ]);
      if (result) setFirmwarePath(result);
    } catch {
      // Mock mode — simulate a file selection
      const mockFiles = [
        "build/firmware.bin",
        "output/top.bit",
        "target/release/app.uf2",
      ];
      setFirmwarePath(mockFiles[Math.floor(Math.random() * mockFiles.length)]);
    }
  }, [setFirmwarePath]);

  const isFlashing = flashProgress.state !== "idle" && flashProgress.state !== "done" && flashProgress.state !== "error";
  const isDone = flashProgress.state === "done";
  const isError = flashProgress.state === "error";
  const canFlash = activeBoard && connectionStatus === "connected" && firmwarePath && !isFlashing;

  const progressColor =
    isDone ? "var(--os-success, #4caf50)"
    : isError ? "var(--os-error, #f44336)"
    : "var(--os-accent-primary)";

  return (
    <div className="flash-programmer">
      {/* ── Header ── */}
      <div className="flash-programmer__header">
        <Zap size={14} />
        <span className="flash-programmer__title">Flash / Program</span>
        {activeBoard && (
          <span className="flash-programmer__board-badge">
            <Cpu size={11} /> {activeBoard.name}
          </span>
        )}
      </div>

      {!activeBoard ? (
        <div className="flash-programmer__empty">
          <Upload size={32} style={{ opacity: 0.3 }} />
          <span>Select a board in the Board Manager to begin</span>
        </div>
      ) : connectionStatus !== "connected" ? (
        <div className="flash-programmer__empty">
          <Upload size={32} style={{ opacity: 0.3 }} />
          <span>Connect to the board first</span>
        </div>
      ) : (
        <div className="flash-programmer__body">
          {/* ── Board Info ── */}
          <div className="flash-programmer__info-row">
            <div className="flash-programmer__info-item">
              <Cpu size={12} /> <span className="flash-programmer__info-label">MCU:</span> {activeBoard.mcu}
            </div>
            <div className="flash-programmer__info-item">
              <HardDrive size={12} /> <span className="flash-programmer__info-label">Flash:</span> {activeBoard.flash}
            </div>
            <div className="flash-programmer__info-item">
              <Zap size={12} /> <span className="flash-programmer__info-label">Tool:</span> {activeBoard.programmer}
            </div>
          </div>

          {/* ── File Selection ── */}
          <div className="flash-programmer__file-row">
            <FileCode size={13} />
            <input
              className="flash-programmer__file-input"
              value={firmwarePath}
              onChange={(e) => setFirmwarePath(e.target.value)}
              placeholder="Firmware file (.bin, .hex, .elf, .bit, .uf2)"
            />
            <button className="flash-programmer__browse-btn" onClick={handleBrowse} title="Browse…">
              <FolderOpen size={12} /> Browse
            </button>
          </div>

          {/* ── Progress Bar ── */}
          {(isFlashing || isDone || isError) && (
            <div className="flash-programmer__progress-section">
              <div className="flash-programmer__progress-bar">
                <div
                  className="flash-programmer__progress-fill"
                  style={{ width: `${flashProgress.percent}%`, background: progressColor }}
                />
              </div>
              <div className="flash-programmer__progress-info">
                <span className="flash-programmer__progress-status">
                  {isFlashing && <Loader2 size={12} className="board-spin" />}
                  {isDone && <CheckCircle2 size={12} style={{ color: "var(--os-success, #4caf50)" }} />}
                  {isError && <XCircle size={12} style={{ color: "var(--os-error, #f44336)" }} />}
                  {flashProgress.message}
                </span>
                <span className="flash-programmer__progress-pct">{flashProgress.percent}%</span>
              </div>
            </div>
          )}

          {/* ── Flash Button ── */}
          <div className="flash-programmer__action-row">
            <button
              className="flash-programmer__flash-btn"
              disabled={!canFlash}
              onClick={startFlash}
            >
              {isFlashing ? (
                <><Loader2 size={14} className="board-spin" /> Flashing…</>
              ) : (
                <><Zap size={14} /> Flash Firmware</>
              )}
            </button>
            {lastFlashTime && (
              <span className="flash-programmer__last-flash">
                <Clock size={11} /> Last flash: {new Date(lastFlashTime).toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* ── Programmer Config ── */}
          <div className="flash-programmer__config">
            <span className="flash-programmer__config-title">Programmer Configuration</span>
            <div className="flash-programmer__config-grid">
              <span className="flash-programmer__config-label">Tool</span>
              <span className="flash-programmer__config-value">{activeBoard.programmer}</span>
              <span className="flash-programmer__config-label">Interface</span>
              <span className="flash-programmer__config-value">{activeBoard.connectionInterface.toUpperCase()}</span>
              {activeBoard.openocdTarget && (
                <>
                  <span className="flash-programmer__config-label">Target</span>
                  <span className="flash-programmer__config-value">{activeBoard.openocdTarget}</span>
                </>
              )}
              {activeBoard.openocdInterface && (
                <>
                  <span className="flash-programmer__config-label">Probe</span>
                  <span className="flash-programmer__config-value">{activeBoard.openocdInterface}</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
