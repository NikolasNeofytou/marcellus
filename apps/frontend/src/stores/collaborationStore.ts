/**
 * Collaboration Store — Sprint 37-38
 *
 * Live sharing, layout playback recording, CI/CD tapeout pipeline,
 * and shuttle export wizard.
 */

import { create } from "zustand";
import type { CanvasGeometry } from "./geometryStore";

// ── Types ─────────────────────────────────────────────────────────

/* ── Live Sharing ── */

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  avatar?: string;
  cursor?: { x: number; y: number };
  activeLayer?: number;
  connected: boolean;
  lastSeen: number;
}

export interface ShareSession {
  id: string;
  hostId: string;
  name: string;
  startedAt: number;
  collaborators: Collaborator[];
  permissions: SharePermissions;
  chatMessages: ShareChatMessage[];
  status: "active" | "paused" | "ended";
}

export interface SharePermissions {
  allowEdit: boolean;
  allowDrc: boolean;
  allowExport: boolean;
  requireApproval: boolean;
}

export interface ShareChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
}

/* ── Layout Playback Recording ── */

export interface LayoutRecording {
  id: string;
  name: string;
  startedAt: number;
  endedAt?: number;
  frames: RecordingFrame[];
  duration: number; // ms
  status: "recording" | "stopped" | "playing";
}

export interface RecordingFrame {
  timestamp: number;
  action: string;
  snapshot: CanvasGeometry[];
  viewport?: { x: number; y: number; zoom: number };
}

/* ── CI/CD Tapeout Pipeline ── */

export interface TapeoutPipeline {
  id: string;
  name: string;
  createdAt: number;
  stages: PipelineStage[];
  status: PipelineStatus;
  triggeredBy: string;
  commitId?: string;
}

export type PipelineStatus = "pending" | "running" | "passed" | "failed" | "cancelled";

export interface PipelineStage {
  id: string;
  name: string;
  type: StageType;
  status: PipelineStatus;
  startedAt?: number;
  completedAt?: number;
  logs: string[];
  artifacts?: string[];
}

export type StageType =
  | "drc_check"
  | "lvs_check"
  | "antenna_check"
  | "density_check"
  | "erc_check"
  | "gds_export"
  | "oas_export"
  | "lef_export"
  | "signoff"
  | "custom";

/* ── Shuttle Export Wizard ── */

export interface ShuttleConfig {
  foundry: string;
  process: string;
  shuttleRun: string;
  submitDeadline: string;
  dieSize: { width: number; height: number };
  padFrame: string;
  topCell: string;
  designerName: string;
  designerEmail: string;
  exportFormats: string[];
}

export interface ShuttleChecklist {
  items: ShuttleCheckItem[];
  allPassed: boolean;
}

export interface ShuttleCheckItem {
  id: string;
  label: string;
  category: "design" | "verification" | "documentation" | "export";
  passed: boolean;
  required: boolean;
  details?: string;
}

// ── Demo data ─────────────────────────────────────────────────────

const DEMO_COLLABORATORS: Collaborator[] = [
  { id: "user-local", name: "You", color: "#2563eb", connected: true, lastSeen: Date.now(), cursor: { x: 150, y: 200 } },
  { id: "user-alice", name: "Alice", color: "#f59e0b", connected: true, lastSeen: Date.now(), cursor: { x: 340, y: 120 }, activeLayer: 10 },
  { id: "user-bob", name: "Bob", color: "#10b981", connected: true, lastSeen: Date.now() - 30000, cursor: { x: 80, y: 300 }, activeLayer: 11 },
  { id: "user-charlie", name: "Charlie", color: "#ef4444", connected: false, lastSeen: Date.now() - 600000 },
];

function createDemoPipeline(): TapeoutPipeline {
  const now = Date.now();
  return {
    id: "pipe-1",
    name: "Tapeout v2.1",
    createdAt: now - 300000,
    triggeredBy: "manual",
    commitId: "fc19318",
    status: "running",
    stages: [
      { id: "s1", name: "DRC Check", type: "drc_check", status: "passed", startedAt: now - 300000, completedAt: now - 240000, logs: ["Running DRC...", "310 rules checked", "0 violations", "DRC CLEAN ✓"], artifacts: ["drc_report.html"] },
      { id: "s2", name: "LVS Check", type: "lvs_check", status: "passed", startedAt: now - 240000, completedAt: now - 180000, logs: ["Extracting netlist...", "Comparing schematic vs layout", "LVS MATCH ✓"], artifacts: ["lvs_report.html"] },
      { id: "s3", name: "Antenna Check", type: "antenna_check", status: "passed", startedAt: now - 180000, completedAt: now - 150000, logs: ["Checking antenna ratios...", "2 warnings (non-critical)", "PASS"], artifacts: [] },
      { id: "s4", name: "Density Check", type: "density_check", status: "running", startedAt: now - 150000, logs: ["Calculating metal density...", "Layer M1: 34.2%", "Layer M2: 28.7%"], artifacts: [] },
      { id: "s5", name: "GDS Export", type: "gds_export", status: "pending", logs: [], artifacts: [] },
      { id: "s6", name: "Signoff", type: "signoff", status: "pending", logs: [], artifacts: [] },
    ],
  };
}

function createShuttleChecklist(): ShuttleChecklist {
  const items: ShuttleCheckItem[] = [
    { id: "c1", label: "DRC clean (0 errors)", category: "verification", passed: true, required: true },
    { id: "c2", label: "LVS match", category: "verification", passed: true, required: true },
    { id: "c3", label: "Antenna check passed", category: "verification", passed: true, required: true },
    { id: "c4", label: "Metal density within limits", category: "verification", passed: false, required: true, details: "M3 density at 18.2% (min 20%)" },
    { id: "c5", label: "Pad frame connected", category: "design", passed: true, required: true },
    { id: "c6", label: "Top cell matches spec", category: "design", passed: true, required: true },
    { id: "c7", label: "Seal ring present", category: "design", passed: true, required: false },
    { id: "c8", label: "Fill patterns applied", category: "design", passed: false, required: false, details: "Run dummy fill before export" },
    { id: "c9", label: "GDS exported", category: "export", passed: false, required: true },
    { id: "c10", label: "LEF/DEF exported", category: "export", passed: false, required: false },
    { id: "c11", label: "Design description document", category: "documentation", passed: true, required: true },
    { id: "c12", label: "Pin list verified", category: "documentation", passed: true, required: true },
  ];
  return { items, allPassed: items.filter((i) => i.required).every((i) => i.passed) };
}

// ── Store ─────────────────────────────────────────────────────────

interface CollaborationState {
  // ── Live Sharing ──
  shareSession: ShareSession | null;
  startSharing: (name: string) => void;
  stopSharing: () => void;
  sendChatMessage: (text: string) => void;
  updateCursor: (x: number, y: number) => void;

  // ── Layout Playback ──
  recordings: LayoutRecording[];
  activeRecording: LayoutRecording | null;
  playbackPosition: number;
  isPlaying: boolean;
  startRecording: (name: string) => void;
  stopRecording: () => void;
  captureFrame: (action: string, geometries: CanvasGeometry[]) => void;
  playRecording: (id: string) => void;
  pausePlayback: () => void;
  setPlaybackPosition: (pos: number) => void;

  // ── CI/CD Pipeline ──
  pipelines: TapeoutPipeline[];
  activePipelineId: string | null;
  createPipeline: (name: string) => void;
  runPipeline: (id: string) => void;
  cancelPipeline: (id: string) => void;
  getActivePipeline: () => TapeoutPipeline | null;

  // ── Shuttle Export Wizard ──
  shuttleConfig: ShuttleConfig;
  shuttleChecklist: ShuttleChecklist;
  wizardStep: number;
  setWizardStep: (step: number) => void;
  setShuttleConfig: (patch: Partial<ShuttleConfig>) => void;
  refreshChecklist: () => void;
  exportShuttle: () => void;

  // ── Active tab ──
  activeTab: "sharing" | "playback" | "pipeline" | "shuttle";
  setActiveTab: (tab: "sharing" | "playback" | "pipeline" | "shuttle") => void;
}

export const useCollaborationStore = create<CollaborationState>((set, get) => ({
  // ── Live Sharing ──
  shareSession: null,

  startSharing(name) {
    set({
      shareSession: {
        id: `session-${Date.now()}`,
        hostId: "user-local",
        name,
        startedAt: Date.now(),
        collaborators: DEMO_COLLABORATORS,
        permissions: { allowEdit: true, allowDrc: true, allowExport: false, requireApproval: false },
        chatMessages: [
          { id: "msg-1", userId: "user-alice", userName: "Alice", text: "Hi! I'll work on the power routing.", timestamp: Date.now() - 60000 },
          { id: "msg-2", userId: "user-bob", userName: "Bob", text: "I'm checking the DRC on the input stage.", timestamp: Date.now() - 30000 },
        ],
        status: "active",
      },
    });
  },

  stopSharing() {
    const session = get().shareSession;
    if (session) {
      set({ shareSession: { ...session, status: "ended" } });
    }
  },

  sendChatMessage(text) {
    const session = get().shareSession;
    if (!session) return;
    const msg: ShareChatMessage = {
      id: `msg-${Date.now()}`,
      userId: "user-local",
      userName: "You",
      text,
      timestamp: Date.now(),
    };
    set({
      shareSession: {
        ...session,
        chatMessages: [...session.chatMessages, msg],
      },
    });
  },

  updateCursor(x, y) {
    const session = get().shareSession;
    if (!session) return;
    set({
      shareSession: {
        ...session,
        collaborators: session.collaborators.map((c) =>
          c.id === "user-local" ? { ...c, cursor: { x, y } } : c
        ),
      },
    });
  },

  // ── Layout Playback ──
  recordings: [],
  activeRecording: null,
  playbackPosition: 0,
  isPlaying: false,

  startRecording(name) {
    const rec: LayoutRecording = {
      id: `rec-${Date.now()}`,
      name,
      startedAt: Date.now(),
      frames: [],
      duration: 0,
      status: "recording",
    };
    set({ activeRecording: rec });
  },

  stopRecording() {
    const rec = get().activeRecording;
    if (!rec) return;
    const stopped: LayoutRecording = {
      ...rec,
      endedAt: Date.now(),
      duration: Date.now() - rec.startedAt,
      status: "stopped",
    };
    set({
      activeRecording: null,
      recordings: [...get().recordings, stopped],
    });
  },

  captureFrame(action, geometries) {
    const rec = get().activeRecording;
    if (!rec || rec.status !== "recording") return;
    const frame: RecordingFrame = {
      timestamp: Date.now() - rec.startedAt,
      action,
      snapshot: geometries,
    };
    set({
      activeRecording: { ...rec, frames: [...rec.frames, frame] },
    });
  },

  playRecording(id) {
    const rec = get().recordings.find((r) => r.id === id);
    if (!rec) return;
    set({ activeRecording: { ...rec, status: "playing" }, playbackPosition: 0, isPlaying: true });
  },

  pausePlayback() {
    set({ isPlaying: false });
  },

  setPlaybackPosition(pos) {
    set({ playbackPosition: pos });
  },

  // ── CI/CD Pipeline ──
  pipelines: [createDemoPipeline()],
  activePipelineId: "pipe-1",

  createPipeline(name) {
    const pipe: TapeoutPipeline = {
      id: `pipe-${Date.now()}`,
      name,
      createdAt: Date.now(),
      triggeredBy: "manual",
      status: "pending",
      stages: [
        { id: `s-${Date.now()}-1`, name: "DRC Check", type: "drc_check", status: "pending", logs: [] },
        { id: `s-${Date.now()}-2`, name: "LVS Check", type: "lvs_check", status: "pending", logs: [] },
        { id: `s-${Date.now()}-3`, name: "Antenna Check", type: "antenna_check", status: "pending", logs: [] },
        { id: `s-${Date.now()}-4`, name: "Density Check", type: "density_check", status: "pending", logs: [] },
        { id: `s-${Date.now()}-5`, name: "GDS Export", type: "gds_export", status: "pending", logs: [] },
        { id: `s-${Date.now()}-6`, name: "Signoff", type: "signoff", status: "pending", logs: [] },
      ],
    };
    set({ pipelines: [...get().pipelines, pipe], activePipelineId: pipe.id });
  },

  runPipeline(id) {
    set({
      pipelines: get().pipelines.map((p) =>
        p.id === id ? { ...p, status: "running" as PipelineStatus, stages: p.stages.map((s, i) => i === 0 ? { ...s, status: "running" as PipelineStatus, startedAt: Date.now() } : s) } : p
      ),
    });
  },

  cancelPipeline(id) {
    set({
      pipelines: get().pipelines.map((p) =>
        p.id === id ? { ...p, status: "cancelled" as PipelineStatus } : p
      ),
    });
  },

  getActivePipeline() {
    return get().pipelines.find((p) => p.id === get().activePipelineId) ?? null;
  },

  // ── Shuttle Export Wizard ──
  shuttleConfig: {
    foundry: "GlobalFoundries",
    process: "GF180MCU",
    shuttleRun: "2026-Q1",
    submitDeadline: "2026-03-15",
    dieSize: { width: 1500, height: 1500 },
    padFrame: "QFN-48",
    topCell: "TOP_CHIP",
    designerName: "",
    designerEmail: "",
    exportFormats: ["GDSII", "OAS"],
  },
  shuttleChecklist: createShuttleChecklist(),
  wizardStep: 0,

  setWizardStep(step) {
    set({ wizardStep: step });
  },

  setShuttleConfig(patch) {
    set({ shuttleConfig: { ...get().shuttleConfig, ...patch } });
  },

  refreshChecklist() {
    set({ shuttleChecklist: createShuttleChecklist() });
  },

  exportShuttle() {
    // In production, this would trigger actual GDS export
    const config = get().shuttleConfig;
    console.log(`Shuttle export: ${config.foundry} ${config.process} — ${config.topCell}`);
  },

  // ── Active tab ──
  activeTab: "sharing",
  setActiveTab(tab) {
    set({ activeTab: tab });
  },
}));
