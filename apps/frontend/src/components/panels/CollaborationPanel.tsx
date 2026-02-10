import { useState } from "react";
import {
  Play,
  Pause,
  Square,
  Circle,
  Send,
  Share2,
  Clapperboard,
  Rocket,
  Package,
  CheckCircle,
  XCircle,
  Loader,
  Clock,
  ChevronRight,
  Check,
} from "lucide-react";
import { useCollaborationStore } from "../../stores/collaborationStore";
import type { ShuttleCheckItem } from "../../stores/collaborationStore";
import "./CollaborationPanel.css";

type Tab = "sharing" | "playback" | "pipeline" | "shuttle";

export function CollaborationPanel() {
  const [tab, setTab] = useState<Tab>("sharing");
  return (
    <div className="collab-panel">
      <div className="collab-panel__tabs">
        <button
          className={`collab-panel__tab${tab === "sharing" ? " collab-panel__tab--active" : ""}`}
          onClick={() => setTab("sharing")}
        >
          <Share2 size={12} /> Sharing
        </button>
        <button
          className={`collab-panel__tab${tab === "playback" ? " collab-panel__tab--active" : ""}`}
          onClick={() => setTab("playback")}
        >
          <Clapperboard size={12} /> Playback
        </button>
        <button
          className={`collab-panel__tab${tab === "pipeline" ? " collab-panel__tab--active" : ""}`}
          onClick={() => setTab("pipeline")}
        >
          <Rocket size={12} /> Pipeline
        </button>
        <button
          className={`collab-panel__tab${tab === "shuttle" ? " collab-panel__tab--active" : ""}`}
          onClick={() => setTab("shuttle")}
        >
          <Package size={12} /> Shuttle
        </button>
      </div>
      <div className="collab-panel__body">
        {tab === "sharing" && <SharingTab />}
        {tab === "playback" && <PlaybackTab />}
        {tab === "pipeline" && <PipelineTab />}
        {tab === "shuttle" && <ShuttleTab />}
      </div>
    </div>
  );
}

/* ── Sharing ──────────────────────────────────────────── */
function SharingTab() {
  const { shareSession, startSharing, stopSharing, sendChatMessage } = useCollaborationStore();
  const [chatText, setChatText] = useState("");

  const handleSendChat = () => {
    const t = chatText.trim();
    if (!t) return;
    sendChatMessage(t);
    setChatText("");
  };

  return (
    <>
      <div className="collab-panel__section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="collab-panel__label">Live Sharing</div>
        {!shareSession ? (
          <button className="collab-panel__btn collab-panel__btn--primary" onClick={() => startSharing("My Session")}>
            <Share2 size={12} /> Start Session
          </button>
        ) : (
          <button className="collab-panel__btn collab-panel__btn--danger" onClick={stopSharing}>
            <Square size={10} /> End
          </button>
        )}
      </div>

      {shareSession && (
        <>
          <div className="collab-panel__section">
            <div className="collab-panel__label">
              Collaborators ({shareSession.collaborators.length})
            </div>
            {shareSession.collaborators.map((c) => (
              <div key={c.id} className="collab-panel__user">
                <div
                  className="collab-panel__avatar"
                  style={{ background: c.color }}
                >
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="collab-panel__user-info">
                  <div className="collab-panel__user-name">
                    {c.name}
                  </div>
                  <div className="collab-panel__user-status">
                    {c.connected ? "online" : "offline"}
                  </div>
                </div>
                <div
                  className={`collab-panel__presence-dot collab-panel__presence-dot--${c.connected ? "online" : "offline"}`}
                />
              </div>
            ))}
          </div>

          <div className="collab-panel__chat">
            {shareSession.chatMessages.map((msg) => (
              <div key={msg.id} className="collab-panel__chat-msg">
                <span className="collab-panel__chat-author">
                  {msg.userName}:
                </span>
                {msg.text}
                <span className="collab-panel__chat-time">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>

          <div className="collab-panel__chat-input">
            <input
              placeholder="Type a message..."
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
            />
            <button className="collab-panel__btn collab-panel__btn--primary" onClick={handleSendChat}>
              <Send size={12} />
            </button>
          </div>
        </>
      )}

      {!shareSession && (
        <div style={{ color: "var(--text-secondary)", fontSize: 11, textAlign: "center", padding: 24 }}>
          Start a live sharing session to collaborate in real time.
        </div>
      )}
    </>
  );
}

/* ── Playback ──────────────────────────────────────────── */
function PlaybackTab() {
  const {
    activeRecording,
    recordings,
    isPlaying,
    playbackPosition,
    startRecording,
    stopRecording,
    playRecording,
    pausePlayback,
  } = useCollaborationStore();

  const isCurrentlyRecording = activeRecording?.status === "recording";
  const totalFrames = activeRecording ? activeRecording.frames.length : 0;
  const pct = totalFrames > 0 ? (playbackPosition / totalFrames) * 100 : 0;

  return (
    <>
      <div className="collab-panel__section">
        <div className="collab-panel__label">Layout Playback Recording</div>
        <div style={{ display: "flex", gap: 4 }}>
          {!isCurrentlyRecording ? (
            <button className="collab-panel__btn collab-panel__btn--danger" onClick={() => startRecording("Recording " + (recordings.length + 1))}>
              <Circle size={10} fill="#ef4444" /> Record
            </button>
          ) : (
            <button className="collab-panel__btn" onClick={stopRecording}>
              <Square size={10} /> Stop
            </button>
          )}
          {activeRecording && !isCurrentlyRecording && (
            <>
              {!isPlaying ? (
                <button className="collab-panel__btn collab-panel__btn--primary" onClick={() => playRecording(activeRecording.id)}>
                  <Play size={10} /> Play
                </button>
              ) : (
                <button className="collab-panel__btn" onClick={pausePlayback}>
                  <Pause size={10} /> Pause
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {activeRecording && (
        <>
          <div className="collab-panel__playback">
            <div className="collab-panel__timeline">
              <div className="collab-panel__timeline-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="collab-panel__playback-time">
              {playbackPosition}/{totalFrames}
            </span>
          </div>
          <div className="collab-panel__section">
            <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
              Frames: {totalFrames} · Duration:{" "}
              {activeRecording.endedAt
                ? ((activeRecording.endedAt - activeRecording.startedAt) / 1000).toFixed(1)
                : "recording..."}{" "}
              s
            </div>
          </div>
        </>
      )}

      {!activeRecording && !isCurrentlyRecording && (
        <div style={{ color: "var(--text-secondary)", fontSize: 11, textAlign: "center", padding: 24 }}>
          Record layout editing sessions for playback and review.
        </div>
      )}
    </>
  );
}

/* ── Pipeline ──────────────────────────────────────────── */
function PipelineTab() {
  const { pipelines, createPipeline, runPipeline } = useCollaborationStore();

  const stageIcon = (status: string) => {
    switch (status) {
      case "running":
        return <Loader size={10} />;
      case "passed":
        return <CheckCircle size={10} />;
      case "failed":
        return <XCircle size={10} />;
      case "cancelled":
        return <ChevronRight size={10} />;
      default:
        return <Clock size={10} />;
    }
  };

  return (
    <>
      <div className="collab-panel__section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="collab-panel__label">CI/CD Tapeout Pipeline</div>
        <button className="collab-panel__btn collab-panel__btn--primary" onClick={() => createPipeline("New Pipeline")}>
          <Rocket size={12} /> New
        </button>
      </div>

      {pipelines.map((pl) => (
        <div key={pl.id} style={{ padding: "4px 0" }}>
          <div className="collab-panel__section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 600, fontSize: 11 }}>{pl.name}</span>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <span style={{ fontSize: 9, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                {pl.status}
              </span>
              {pl.status === "pending" && (
                <button className="collab-panel__btn collab-panel__btn--sm" onClick={() => runPipeline(pl.id)}>
                  <Play size={10} /> Run
                </button>
              )}
            </div>
          </div>
          <div className="collab-panel__pipeline">
            {pl.stages.map((s) => (
              <div key={s.id} className="collab-panel__stage">
                <div className={`collab-panel__stage-icon collab-panel__stage-icon--${s.status}`}>
                  {stageIcon(s.status)}
                </div>
                <span className="collab-panel__stage-name">{s.name}</span>
                <span className="collab-panel__stage-status" style={{ color: s.status === "passed" ? "#22c55e" : s.status === "failed" ? "#ef4444" : "var(--text-secondary)" }}>
                  {s.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}

      {pipelines.length === 0 && (
        <div style={{ color: "var(--text-secondary)", fontSize: 11, textAlign: "center", padding: 24 }}>
          Create a tapeout pipeline to automate verification and export.
        </div>
      )}
    </>
  );
}

/* ── Shuttle ──────────────────────────────────────────── */
function ShuttleTab() {
  const { shuttleConfig, shuttleChecklist, setShuttleConfig, refreshChecklist } =
    useCollaborationStore();

  const items = shuttleChecklist.items;
  const completedCount = items.filter((c) => c.passed).length;
  const totalCount = items.length;
  const pct = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const groups = items.reduce<Record<string, ShuttleCheckItem[]>>(
    (acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    },
    {},
  );

  return (
    <>
      <div className="collab-panel__section">
        <div className="collab-panel__label">Shuttle Export Wizard</div>
        <div className="collab-panel__input-row">
          <span className="collab-panel__input-label">Foundry</span>
          <select
            className="collab-panel__select"
            value={shuttleConfig.foundry}
            onChange={(e) => setShuttleConfig({ foundry: e.target.value })}
          >
            <option value="skywater">SkyWater</option>
            <option value="globalfoundries">GlobalFoundries</option>
            <option value="tsmc">TSMC</option>
            <option value="ihp">IHP</option>
          </select>
        </div>
        <div className="collab-panel__input-row">
          <span className="collab-panel__input-label">Process</span>
          <input
            className="collab-panel__input"
            value={shuttleConfig.process}
            onChange={(e) => setShuttleConfig({ process: e.target.value })}
            style={{ width: 100 }}
          />
        </div>
        <div className="collab-panel__input-row">
          <span className="collab-panel__input-label">Die (µm)</span>
          <input
            className="collab-panel__input"
            type="number"
            value={shuttleConfig.dieSize.width}
            onChange={(e) => setShuttleConfig({ dieSize: { ...shuttleConfig.dieSize, width: parseFloat(e.target.value) || 0 } })}
            style={{ width: 60 }}
          />
          <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>×</span>
          <input
            className="collab-panel__input"
            type="number"
            value={shuttleConfig.dieSize.height}
            onChange={(e) => setShuttleConfig({ dieSize: { ...shuttleConfig.dieSize, height: parseFloat(e.target.value) || 0 } })}
            style={{ width: 60 }}
          />
        </div>
        <button className="collab-panel__btn collab-panel__btn--sm" onClick={refreshChecklist} style={{ marginTop: 4 }}>
          Refresh Checklist
        </button>
      </div>

      <div className="collab-panel__progress">
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10 }}>
          <span>Checklist Progress</span>
          <span>
            {completedCount}/{totalCount} ({Math.round(pct)}%)
          </span>
        </div>
        <div className="collab-panel__progress-bar">
          <div
            className="collab-panel__progress-fill"
            style={{
              width: `${pct}%`,
              background: pct === 100 ? "#22c55e" : "var(--accent, #2563eb)",
            }}
          />
        </div>
      </div>

      {Object.entries(groups).map(([category, catItems]) => (
        <div key={category} className="collab-panel__checklist-group">
          <div className="collab-panel__checklist-header">{category}</div>
          {catItems.map((item) => (
            <div
              key={item.id}
              className="collab-panel__check-item"
            >
              <div
                className={`collab-panel__checkbox${item.passed ? " collab-panel__checkbox--checked" : ""}`}
              >
                {item.passed && <Check size={10} color="#fff" />}
              </div>
              <span style={{ opacity: item.passed ? 0.6 : 1 }}>{item.label}</span>
              {item.required && (
                <span style={{ fontSize: 9, color: "#ef4444" }}>*</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
