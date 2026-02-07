import { useState } from "react";
import {
  Bot,
  Sparkles,
  ClipboardCheck,
  Send,
  Play,
  RotateCcw,
  Wrench,
  CheckCircle,
  AlertTriangle,
  Info,
  ChevronRight,
  Zap,
} from "lucide-react";
import { useAiAssistantStore } from "../../stores/aiAssistantStore";
import { useDrcStore } from "../../stores/drcStore";
import { useGeometryStore } from "../../stores/geometryStore";
import "./AiAssistantPanel.css";

type Tab = "fixes" | "chat" | "review";

export function AiAssistantPanel() {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <div className="ai-panel">
      <div className="ai-panel__tabs">
        <button
          className={`ai-panel__tab${tab === "fixes" ? " ai-panel__tab--active" : ""}`}
          onClick={() => setTab("fixes")}
        >
          <Wrench size={12} /> Fixes
        </button>
        <button
          className={`ai-panel__tab${tab === "chat" ? " ai-panel__tab--active" : ""}`}
          onClick={() => setTab("chat")}
        >
          <Bot size={12} /> Chat
        </button>
        <button
          className={`ai-panel__tab${tab === "review" ? " ai-panel__tab--active" : ""}`}
          onClick={() => setTab("review")}
        >
          <ClipboardCheck size={12} /> Review
        </button>
      </div>
      {tab === "fixes" && <FixesTab />}
      {tab === "chat" && <ChatTab />}
      {tab === "review" && <ReviewTab />}
    </div>
  );
}

/* ── Fixes Tab ──────────────────────────────────────────── */
function FixesTab() {
  const { fixSuggestions, generateFixes, applyFix } = useAiAssistantStore();
  const { violations } = useDrcStore();

  const handleGenerate = () => {
    generateFixes(violations);
  };

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <div className="ai-panel__section">
        <div className="ai-panel__label">DRC Fix Suggestions</div>
        <button className="ai-panel__btn ai-panel__btn--primary" onClick={handleGenerate}>
          <Sparkles size={12} /> Generate Fixes ({violations.length} violations)
        </button>
      </div>
      <div style={{ padding: "8px 12px" }}>
        {fixSuggestions.length === 0 && (
          <div style={{ color: "var(--text-secondary)", fontSize: 11, textAlign: "center", padding: 16 }}>
            No fix suggestions yet. Run DRC and click &quot;Generate Fixes&quot;.
          </div>
        )}
        {fixSuggestions.map((fix) => (
          <div
            key={fix.id}
            className={`ai-panel__fix-card${fix.applied ? " ai-panel__fix-card--applied" : ""}`}
          >
            <div className="ai-panel__fix-title">
              <ChevronRight size={10} />
              {fix.action.type.replace(/_/g, " ")}
              <span
                className={`ai-panel__confidence ai-panel__confidence--${fix.confidence >= 0.8 ? "high" : fix.confidence >= 0.5 ? "medium" : "low"}`}
              >
                {Math.round(fix.confidence * 100)}%
              </span>
            </div>
            <div className="ai-panel__fix-desc">{fix.description}</div>
            {!fix.applied && (
              <button className="ai-panel__btn ai-panel__btn--sm" onClick={() => applyFix(fix.id)}>
                <Play size={10} /> Apply
              </button>
            )}
            {fix.applied && (
              <span style={{ fontSize: 10, color: "#22c55e" }}>
                <CheckCircle size={10} /> Applied
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Chat Tab ──────────────────────────────────────────── */
function ChatTab() {
  const { chatHistory, inputText, setInputText, submitCommand, clearChat } =
    useAiAssistantStore();
  const [composing, setComposing] = useState("");

  const handleSend = () => {
    const text = composing.trim() || inputText.trim();
    if (!text) return;
    submitCommand(text);
    setComposing("");
    setInputText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <div className="ai-panel__section" style={{ display: "flex", justifyContent: "space-between" }}>
        <div className="ai-panel__label">Natural Language Assistant</div>
        <button className="ai-panel__btn ai-panel__btn--sm" onClick={clearChat}>
          <RotateCcw size={10} /> Clear
        </button>
      </div>
      <div className="ai-panel__chat">
        {chatHistory.map((msg) => (
          <div key={msg.id} className={`ai-panel__message ai-panel__message--${msg.role}`}>
            {msg.content}
            {msg.suggestions && msg.suggestions.length > 0 && (
              <div className="ai-panel__suggestions">
                {msg.suggestions.map((s) => (
                  <button
                    key={s}
                    className="ai-panel__suggestion-chip"
                    onClick={() => submitCommand(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="ai-panel__input-area">
        <input
          className="ai-panel__input"
          placeholder="Type a command or question..."
          value={composing}
          onChange={(e) => setComposing(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button className="ai-panel__btn ai-panel__btn--primary" onClick={handleSend}>
          <Send size={12} />
        </button>
      </div>
    </>
  );
}

/* ── Review Tab ──────────────────────────────────────────── */
function ReviewTab() {
  const { currentReview, runReview } = useAiAssistantStore();
  const geometries = useGeometryStore((s) => s.geometries);
  const [reviewing, setReviewing] = useState(false);

  const handleReview = () => {
    setReviewing(true);
    runReview(geometries);
    setTimeout(() => setReviewing(false), 500);
  };

  const severityIcon = (sev: string) => {
    switch (sev) {
      case "critical":
        return <AlertTriangle size={10} color="#ef4444" />;
      case "major":
        return <AlertTriangle size={10} color="#f59e0b" />;
      case "minor":
        return <Info size={10} color="#3b82f6" />;
      default:
        return <Info size={10} color="#6b7280" />;
    }
  };

  const scoreClass =
    currentReview && currentReview.score >= 80
      ? "good"
      : currentReview && currentReview.score >= 50
        ? "warn"
        : "bad";

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <div className="ai-panel__section">
        <div className="ai-panel__label">Design Review Copilot</div>
        <button
          className="ai-panel__btn ai-panel__btn--primary"
          onClick={handleReview}
          disabled={reviewing}
        >
          <Zap size={12} /> {reviewing ? "Analyzing..." : "Run Review"}
        </button>
      </div>
      {currentReview && (
        <>
          <div className="ai-panel__review-score">
            <div className={`ai-panel__score-circle ai-panel__score-circle--${scoreClass}`}>
              {currentReview.score}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>Design Score</div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                {currentReview.findings.length} findings
              </div>
            </div>
          </div>
          <div style={{ padding: "4px 12px" }}>
            {currentReview.findings.map((f) => (
              <div key={f.id} className={`ai-panel__finding ai-panel__finding--${f.severity}`}>
                <div className="ai-panel__finding-category">
                  {severityIcon(f.severity)} {f.category}
                </div>
                <div>{f.description}</div>
                {f.suggestion && (
                  <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>
                    💡 {f.suggestion}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {!currentReview && (
        <div style={{ color: "var(--text-secondary)", fontSize: 11, textAlign: "center", padding: 24 }}>
          Run a design review to get AI-powered feedback on your layout.
        </div>
      )}
    </div>
  );
}
