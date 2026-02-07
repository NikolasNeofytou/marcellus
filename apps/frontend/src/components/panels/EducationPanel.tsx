import { useState } from "react";
import { useEducationStore } from "../../stores/educationStore";
import {
  GraduationCap, BookOpen, FlaskConical, Ruler, Layers3,
  ChevronLeft, ChevronRight, CheckCircle2, Circle,
  Clock, BarChart3, RotateCcw, Award, Lightbulb,
  EyeOff,
} from "lucide-react";
import "./EducationPanel.css";

type Tab = "tutorials" | "labs" | "rules" | "xsection";

export function EducationPanel() {
  const { enabled, simplifiedUI, toggleEducationMode, setSimplifiedUI } = useEducationStore();
  const [tab, setTab] = useState<Tab>("tutorials");

  return (
    <div className="edu-panel">
      {/* Mode Toggle */}
      <div className="edu-panel__toggle" onClick={toggleEducationMode}>
        <div className={`edu-panel__toggle-track ${enabled ? "edu-panel__toggle-track--on" : ""}`}>
          <div className="edu-panel__toggle-knob" />
        </div>
        <GraduationCap size={14} />
        <span style={{ fontWeight: 600, fontSize: 12 }}>Education Mode {enabled ? "ON" : "OFF"}</span>
      </div>

      {enabled && (
        <div className="edu-panel__toggle" onClick={() => setSimplifiedUI(!simplifiedUI)}>
          <div className={`edu-panel__toggle-track ${simplifiedUI ? "edu-panel__toggle-track--on" : ""}`}>
            <div className="edu-panel__toggle-knob" />
          </div>
          <span style={{ fontSize: 11 }}>Simplified UI</span>
        </div>
      )}

      {/* Tabs */}
      <div className="edu-panel__tabs">
        {([
          ["tutorials", "Tutorials", <BookOpen size={13} key="t" />],
          ["labs", "Labs", <FlaskConical size={13} key="l" />],
          ["rules", "Rules", <Ruler size={13} key="r" />],
          ["xsection", "3D X-Section", <Layers3 size={13} key="x" />],
        ] as [Tab, string, React.ReactNode][]).map(([id, label, icon]) => (
          <button
            key={id}
            className={`edu-panel__tab ${tab === id ? "edu-panel__tab--active" : ""}`}
            onClick={() => setTab(id)}
          >
            {icon} {label}
          </button>
        ))}
      </div>

      {tab === "tutorials" && <TutorialsTab />}
      {tab === "labs" && <LabsTab />}
      {tab === "rules" && <RulesTab />}
      {tab === "xsection" && <CrossSectionTab />}
    </div>
  );
}

/* ── Tutorials Tab ──────────────────────────────────────────────── */

function TutorialsTab() {
  const {
    tutorials, activeTutorialId, activeStepIndex, completedTutorials,
    startTutorial, nextStep, prevStep, completeStep, resetTutorial, closeTutorial,
  } = useEducationStore();

  const activeTutorial = tutorials.find((t) => t.id === activeTutorialId);

  // Browsing mode
  if (!activeTutorial) {
    const categories = ["basics", "layout", "simulation", "verification", "advanced"] as const;
    return (
      <div>
        {categories.map((cat) => {
          const items = tutorials.filter((t) => t.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat} className="edu-panel__section">
              <div className="edu-panel__label">{cat}</div>
              {items.map((tut) => {
                const done = completedTutorials.includes(tut.id);
                return (
                  <div
                    key={tut.id}
                    className={`edu-panel__card ${done ? "edu-panel__card--completed" : ""}`}
                    onClick={() => startTutorial(tut.id)}
                  >
                    <div className="edu-panel__card-title">
                      {done ? <CheckCircle2 size={14} style={{ color: "#22c55e" }} /> : <BookOpen size={14} />}
                      {tut.title}
                    </div>
                    <div className="edu-panel__card-desc">{tut.description}</div>
                    <div className="edu-panel__card-meta">
                      <span className={`edu-panel__chip edu-panel__chip--${tut.difficulty}`}>{tut.difficulty}</span>
                      <span><Clock size={9} /> {tut.estimatedMinutes} min</span>
                      <span>{tut.steps.length} steps</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }

  // Active tutorial
  const step = activeTutorial.steps[activeStepIndex];
  const completedCount = activeTutorial.steps.filter((s) => s.completed).length;
  const progressPct = (completedCount / activeTutorial.steps.length) * 100;

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <button className="edu-panel__btn edu-panel__btn--sm" onClick={closeTutorial}>
          <ChevronLeft size={12} /> Back
        </button>
        <span style={{ fontWeight: 600, flex: 1 }}>{activeTutorial.title}</span>
        <button className="edu-panel__btn edu-panel__btn--sm" onClick={() => resetTutorial(activeTutorial.id)}>
          <RotateCcw size={10} />
        </button>
      </div>

      {/* Progress */}
      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 2 }}>
        Step {activeStepIndex + 1} of {activeTutorial.steps.length} · {completedCount} completed
      </div>
      <div className="edu-panel__progress">
        <div className="edu-panel__progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Step content */}
      <div className={`edu-panel__step ${step.completed ? "edu-panel__step--completed" : "edu-panel__step--active"}`}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span className={`edu-panel__step-number ${step.completed ? "edu-panel__step-number--done" : "edu-panel__step-number--active"}`}>
            {step.completed ? <CheckCircle2 size={12} /> : activeStepIndex + 1}
          </span>
          <span className="edu-panel__step-title">{step.title}</span>
        </div>
        <div className="edu-panel__step-content">{step.content}</div>
        {step.hint && (
          <div className="edu-panel__step-hint">
            <Lightbulb size={10} /> {step.hint}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <button className="edu-panel__btn edu-panel__btn--sm" onClick={prevStep} disabled={activeStepIndex === 0}>
          <ChevronLeft size={12} /> Prev
        </button>
        {!step.completed && (
          <button className="edu-panel__btn edu-panel__btn--success edu-panel__btn--sm" onClick={() => completeStep(activeStepIndex)}>
            <CheckCircle2 size={12} /> Mark Complete
          </button>
        )}
        <button
          className="edu-panel__btn edu-panel__btn--sm"
          onClick={nextStep}
          disabled={activeStepIndex === activeTutorial.steps.length - 1}
        >
          Next <ChevronRight size={12} />
        </button>
      </div>

      {/* All steps overview */}
      <div className="edu-panel__section" style={{ marginTop: 12 }}>
        <div className="edu-panel__label">All Steps</div>
        {activeTutorial.steps.map((s, i) => (
          <div
            key={s.id}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "3px 6px",
              fontSize: 11, cursor: "pointer", borderRadius: 3,
              background: i === activeStepIndex ? "var(--accent, #6366f1)0a" : undefined,
            }}
            onClick={() => useEducationStore.setState({ activeStepIndex: i })}
          >
            <span className={`edu-panel__step-number ${s.completed ? "edu-panel__step-number--done" : i === activeStepIndex ? "edu-panel__step-number--active" : "edu-panel__step-number--pending"}`}>
              {s.completed ? <CheckCircle2 size={9} /> : i + 1}
            </span>
            {s.title}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Labs Tab ───────────────────────────────────────────────────── */

function LabsTab() {
  const { labs, activeLabId, startLab, autoGradeLab, closeLab } = useEducationStore();

  const activeLab = labs.find((l) => l.id === activeLabId);

  if (!activeLab) {
    return (
      <div>
        <div className="edu-panel__label">Available Labs</div>
        {labs.map((lab) => (
          <div
            key={lab.id}
            className={`edu-panel__card ${lab.completed ? "edu-panel__card--completed" : ""}`}
            onClick={() => startLab(lab.id)}
          >
            <div className="edu-panel__card-title">
              {lab.completed ? <Award size={14} style={{ color: "#22c55e" }} /> : <FlaskConical size={14} />}
              {lab.title}
              {lab.score !== null && (
                <span style={{ marginLeft: "auto", fontWeight: 700, color: lab.score >= 70 ? "#22c55e" : "#ef4444" }}>
                  {lab.score}%
                </span>
              )}
            </div>
            <div className="edu-panel__card-desc">{lab.description}</div>
            <div className="edu-panel__card-meta">
              <span className={`edu-panel__chip edu-panel__chip--${lab.difficulty}`}>{lab.difficulty}</span>
              <span className="edu-panel__chip edu-panel__chip--category">{lab.category}</span>
              <span><Clock size={9} /> {lab.estimatedMinutes} min</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Active lab
  const totalPoints = activeLab.rubric.reduce((s, r) => s + r.points, 0);
  const earnedPoints = activeLab.rubric.filter((r) => r.passed).reduce((s, r) => s + r.points, 0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <button className="edu-panel__btn edu-panel__btn--sm" onClick={closeLab}>
          <ChevronLeft size={12} /> Back
        </button>
        <span style={{ fontWeight: 600, flex: 1 }}>{activeLab.title}</span>
      </div>

      <div className="edu-panel__card-desc">{activeLab.description}</div>

      {/* Objectives */}
      <div className="edu-panel__section" style={{ marginTop: 8 }}>
        <div className="edu-panel__label">Objectives</div>
        {activeLab.objectives.map((obj, i) => (
          <div key={i} style={{ fontSize: 11, padding: "2px 0", display: "flex", gap: 4 }}>
            <Circle size={8} style={{ marginTop: 3, flexShrink: 0 }} /> {obj}
          </div>
        ))}
      </div>

      {/* Rubric */}
      <div className="edu-panel__section">
        <div className="edu-panel__label">
          Rubric ({earnedPoints}/{totalPoints} pts)
        </div>
        {activeLab.rubric.map((r) => (
          <div
            key={r.id}
            className={`edu-panel__rubric ${r.passed ? "edu-panel__rubric--pass" : "edu-panel__rubric--pending"}`}
          >
            {r.passed ? <CheckCircle2 size={12} style={{ color: "#22c55e" }} /> : <Circle size={12} />}
            <span style={{ flex: 1 }}>{r.description}</span>
            <span style={{ fontWeight: 600, fontSize: 10 }}>{r.points} pts</span>
          </div>
        ))}
      </div>

      {/* Score */}
      {activeLab.score !== null && (
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <div className={`edu-panel__score ${activeLab.score >= 70 ? "edu-panel__score--pass" : "edu-panel__score--fail"}`}>
            {activeLab.score}%
          </div>
          <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>
            {activeLab.score >= 90 ? "Excellent!" : activeLab.score >= 70 ? "Good work!" : "Needs improvement"}
          </div>
        </div>
      )}

      <button className="edu-panel__btn edu-panel__btn--primary" onClick={() => autoGradeLab(activeLab.id)}>
        <BarChart3 size={12} /> Auto-Grade
      </button>
    </div>
  );
}

/* ── Rules Tab ──────────────────────────────────────────────────── */

function RulesTab() {
  const { visualRules, activeRuleId, setActiveRule } = useEducationStore();

  const categories = ["width", "spacing", "enclosure", "extension", "area", "density"] as const;

  return (
    <div>
      <div className="edu-panel__label">Visual Design Rule Explorer</div>
      {categories.map((cat) => {
        const rules = visualRules.filter((r) => r.category === cat);
        if (rules.length === 0) return null;
        return (
          <div key={cat} className="edu-panel__section">
            <div className="edu-panel__label" style={{ textTransform: "capitalize" }}>{cat}</div>
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`edu-panel__rule-card ${activeRuleId === rule.id ? "edu-panel__rule-card--active" : ""}`}
                onClick={() => setActiveRule(activeRuleId === rule.id ? null : rule.id)}
              >
                <div className="edu-panel__rule-title">
                  <Ruler size={12} /> {rule.name}
                  <span className="edu-panel__rule-value">{rule.value} {rule.unit}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{rule.description}</div>
                {activeRuleId === rule.id && (
                  <div className="edu-panel__rule-detail">{rule.detailedExplanation}</div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/* ── Cross-Section Tab ──────────────────────────────────────────── */

function CrossSectionTab() {
  const { crossSection, crossSectionVisible, showCrossSection, hideCrossSection } = useEducationStore();

  return (
    <div>
      <div className="edu-panel__section">
        <div className="edu-panel__label">3-D Process Cross-Section</div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="edu-panel__btn edu-panel__btn--primary" onClick={showCrossSection}>
            <Layers3 size={12} /> Generate Cross-Section
          </button>
          {crossSectionVisible && (
            <button className="edu-panel__btn edu-panel__btn--sm" onClick={hideCrossSection}>
              <EyeOff size={11} /> Hide
            </button>
          )}
        </div>
      </div>

      {crossSection && (
        <div className="edu-panel__xsection">
          <div className="edu-panel__label">Layer Stack</div>
          {/* Visual cross-section bars */}
          <div style={{ position: "relative", height: 240, border: "1px solid var(--border, #333)", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
            {crossSection.layers.map((layer, i) => {
              const scale = 18; // px per µm
              const bottom = layer.yBottom * scale;
              const height = Math.max(layer.thickness * scale, 2);
              return (
                <div
                  key={i}
                  className="edu-panel__xsection-bar"
                  style={{
                    position: "absolute",
                    bottom,
                    left: 0,
                    right: 0,
                    height,
                    background: layer.color,
                    opacity: 0.85,
                    borderTop: "1px solid rgba(255,255,255,0.1)",
                  }}
                  title={`${layer.name}: ${layer.yBottom.toFixed(2)}–${(layer.yBottom + layer.thickness).toFixed(2)} µm`}
                />
              );
            })}
          </div>

          {/* Legend */}
          {crossSection.layers.map((layer, i) => (
            <div key={i} className="edu-panel__xsection-layer">
              <div className="edu-panel__xsection-swatch" style={{ background: layer.color }} />
              <span style={{ minWidth: 100, fontWeight: 500 }}>{layer.name}</span>
              <span style={{ color: "var(--text-secondary)" }}>
                {layer.yBottom.toFixed(2)}–{(layer.yBottom + layer.thickness).toFixed(2)} µm
              </span>
              <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>{layer.material}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
