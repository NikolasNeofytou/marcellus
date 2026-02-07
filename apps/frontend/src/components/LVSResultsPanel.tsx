/**
 * LVS Results Panel — displays device and net matching results side-by-side.
 *
 * Shows:
 *  - Summary: passed/failed, mismatch counts
 *  - Device Matches: each device with match status and parameter diffs
 *  - Net Matches: each net with connectivity status
 *  - Click device/net to cross-probe in schematic/layout
 */

import { useState } from "react";
import { useCrossProbeStore } from "../stores/crossProbeStore";
import type { LvsResult, DeviceMatch, NetMatch } from "../engines/lvs";
import "./styles/LvsPanel.css";

interface LVSResultsPanelProps {
  result: LvsResult | null;
  onClose?: () => void;
}

export function LVSResultsPanel({ result, onClose }: LVSResultsPanelProps) {
  const [activeTab, setActiveTab] = useState<"summary" | "devices" | "nets">("summary");
  const [expandedDevices, setExpandedDevices] = useState<Set<number>>(new Set());
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const { highlightDevice, highlightNet } = useCrossProbeStore();

  if (!result) {
    return (
      <div className="lvs-panel empty">
        <p>No LVS result yet. Run LVS to compare schematic and layout.</p>
      </div>
    );
  }

  const toggleExpanded = (idx: number) => {
    const next = new Set(expandedDevices);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setExpandedDevices(next);
  };

  const handleDeviceClick = (device: DeviceMatch, idx: number) => {
    setSelectedDevice(selectedDevice === idx ? null : idx);
    if (device.status !== "match") {
      highlightDevice(device);
    }
  };

  const handleNetClick = (net: NetMatch) => {
    highlightNet(net);
  };

  return (
    <div className="lvs-panel">
      {/* Header */}
      <div className="lvs-header">
        <h3>LVS Results</h3>
        {onClose && <button onClick={onClose} className="close-btn">✕</button>}
      </div>

      {/* Tabs */}
      <div className="lvs-tabs">
        <button
          className={`tab ${activeTab === "summary" ? "active" : ""}`}
          onClick={() => setActiveTab("summary")}
        >
          Summary
        </button>
        <button
          className={`tab ${activeTab === "devices" ? "active" : ""}`}
          onClick={() => setActiveTab("devices")}
        >
          Devices ({result.deviceMatches.length})
        </button>
        <button
          className={`tab ${activeTab === "nets" ? "active" : ""}`}
          onClick={() => setActiveTab("nets")}
        >
          Nets ({result.netMatches.length})
        </button>
      </div>

      {/* Summary Tab */}
      {activeTab === "summary" && (
        <div className="lvs-content summary-tab">
          <div className={`status-box ${result.status}`}>
            <h4>{result.status === "clean" ? "✓ Passed" : "✗ Failed"}</h4>
            <p>{result.status === "clean" ? "Schematic matches layout perfectly!" : `${result.summary.mismatchedDevices} device(s) and ${result.summary.extraNets + result.summary.missingNets} net(s) have issues.`}</p>
          </div>

          <div className="summary-stats">
            <div className="stat">
              <span className="label">Matched Devices:</span>
              <span className="value">{result.deviceMatches.filter((d: DeviceMatch) => d.status === "match").length}</span>
            </div>
            <div className="stat">
              <span className="label">Mismatched Devices:</span>
              <span className="value error">
                {result.deviceMatches.filter((d: DeviceMatch) => d.status !== "match").length}
              </span>
            </div>
            <div className="stat">
              <span className="label">Matched Nets:</span>
              <span className="value">{result.netMatches.filter((n: NetMatch) => n.status === "match").length}</span>
            </div>
            <div className="stat">
              <span className="label">Problematic Nets:</span>
              <span className="value error">{result.netMatches.filter((n: NetMatch) => n.status !== "match").length}</span>
            </div>
          </div>
        </div>
      )}

      {/* Devices Tab */}
      {activeTab === "devices" && (
        <div className="lvs-content devices-tab">
          <div className="device-list">
            {result.deviceMatches.map((device: DeviceMatch, idx: number) => (
              <div
                key={idx}
                className={`device-item ${device.status} ${selectedDevice === idx ? "selected" : ""}`}
                onClick={() => handleDeviceClick(device, idx)}
              >
                {/* Header */}
                <div className="device-header">
                  <div className="device-name">
                    <span className={`status-icon ${device.status}`}>
                      {device.status === "match" ? "✓" : "✗"}
                    </span>
                    <span className="name">
                      {device.schematicDevice?.name || device.layoutDevice?.name || "unknown"}
                    </span>
                  </div>
                  <div className="device-type">{device.schematicDevice?.type || device.layoutDevice?.type || "?"}</div>
                  <button
                    className="expand-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpanded(idx);
                    }}
                  >
                    {expandedDevices.has(idx) ? "−" : "+"}
                  </button>
                </div>

                {/* Message */}
                <div className="device-message">
                  {device.status === "match" ? "Matched: devices are equivalent" : 
                   device.status === "extra" ? "Extra in layout - not in schematic" :
                   device.status === "missing" ? "Missing in layout - in schematic only" :
                   `Mismatch: ${device.parameterDiffs.length} parameter(s) differ, ${device.terminalDiffs.length} terminal(s) mismatch`}
                </div>

                {/* Details (if expanded) */}
                {expandedDevices.has(idx) && (
                  <div className="device-details">
                    {device.schematicDevice && (
                      <div className="detail-section">
                        <h5>Schematic:</h5>
                        <p><strong>Type:</strong> {device.schematicDevice.type}</p>
                        <p><strong>Params:</strong> {JSON.stringify(device.schematicDevice.parameters)}</p>
                      </div>
                    )}
                    {device.layoutDevice && (
                      <div className="detail-section">
                        <h5>Layout:</h5>
                        <p><strong>Type:</strong> {device.layoutDevice.type}</p>
                        <p><strong>Params:</strong> {JSON.stringify(device.layoutDevice.parameters)}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Nets Tab */}
      {activeTab === "nets" && (
        <div className="lvs-content nets-tab">
          <div className="net-list">
            {result.netMatches.map((net: NetMatch, idx: number) => (
              <div
                key={idx}
                className={`net-item ${net.status}`}
                onClick={() => handleNetClick(net)}
              >
                <span className={`status-icon ${net.status}`}>
                  {net.status === "match" ? "✓" : "⚠"}
                </span>
                <span className="net-name">
                  {net.schematicNet || net.layoutNet || "unknown"}
                </span>
                <span className="net-status">{net.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
