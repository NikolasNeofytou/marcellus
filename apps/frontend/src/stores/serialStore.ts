import { create } from "zustand";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type BaudRate = 300 | 1200 | 2400 | 4800 | 9600 | 19200 | 38400 | 57600 | 115200 | 230400 | 460800 | 921600;
export type DataBits = 5 | 6 | 7 | 8;
export type Parity = "none" | "odd" | "even";
export type StopBits = 1 | 1.5 | 2;
export type LineEnding = "none" | "cr" | "lf" | "crlf";
export type DisplayMode = "text" | "hex" | "mixed";

export interface SerialMessage {
  id: number;
  direction: "tx" | "rx";
  data: string;
  timestamp: number;
  raw?: number[];         // raw bytes for hex view
}

/* ------------------------------------------------------------------ */
/*  Store                                                             */
/* ------------------------------------------------------------------ */

interface SerialStoreState {
  // Config
  baudRate: BaudRate;
  dataBits: DataBits;
  parity: Parity;
  stopBits: StopBits;
  lineEnding: LineEnding;
  displayMode: DisplayMode;
  autoscroll: boolean;
  showTimestamps: boolean;
  localEcho: boolean;
  dtrEnabled: boolean;
  rtsEnabled: boolean;

  // State
  isOpen: boolean;
  messages: SerialMessage[];
  inputBuffer: string;
  rxCount: number;
  txCount: number;

  // Actions
  setBaudRate: (r: BaudRate) => void;
  setDataBits: (d: DataBits) => void;
  setParity: (p: Parity) => void;
  setStopBits: (s: StopBits) => void;
  setLineEnding: (l: LineEnding) => void;
  setDisplayMode: (m: DisplayMode) => void;
  toggleAutoscroll: () => void;
  toggleTimestamps: () => void;
  toggleLocalEcho: () => void;
  toggleDtr: () => void;
  toggleRts: () => void;
  setInputBuffer: (v: string) => void;
  send: (data: string) => void;
  receiveData: (data: string, raw?: number[]) => void;
  clearMessages: () => void;
  openPort: () => void;
  closePort: () => void;
}

let _msgId = 0;

const LINE_ENDING_MAP: Record<LineEnding, string> = {
  none: "",
  cr: "\r",
  lf: "\n",
  crlf: "\r\n",
};

export const useSerialStore = create<SerialStoreState>((set, get) => ({
  // Config defaults
  baudRate: 115200,
  dataBits: 8,
  parity: "none",
  stopBits: 1,
  lineEnding: "crlf",
  displayMode: "text",
  autoscroll: true,
  showTimestamps: true,
  localEcho: false,
  dtrEnabled: false,
  rtsEnabled: false,

  // State
  isOpen: false,
  messages: [],
  inputBuffer: "",
  rxCount: 0,
  txCount: 0,

  // Setters
  setBaudRate: (baudRate) => set({ baudRate }),
  setDataBits: (dataBits) => set({ dataBits }),
  setParity: (parity) => set({ parity }),
  setStopBits: (stopBits) => set({ stopBits }),
  setLineEnding: (lineEnding) => set({ lineEnding }),
  setDisplayMode: (displayMode) => set({ displayMode }),
  toggleAutoscroll: () => set((s) => ({ autoscroll: !s.autoscroll })),
  toggleTimestamps: () => set((s) => ({ showTimestamps: !s.showTimestamps })),
  toggleLocalEcho: () => set((s) => ({ localEcho: !s.localEcho })),
  toggleDtr: () => set((s) => ({ dtrEnabled: !s.dtrEnabled })),
  toggleRts: () => set((s) => ({ rtsEnabled: !s.rtsEnabled })),
  setInputBuffer: (inputBuffer) => set({ inputBuffer }),

  send: (data) => {
    if (!get().isOpen) return;
    const ending = LINE_ENDING_MAP[get().lineEnding];
    const fullData = data + ending;
    const msg: SerialMessage = {
      id: ++_msgId,
      direction: "tx",
      data: fullData,
      timestamp: Date.now(),
      raw: Array.from(fullData).map((c) => c.charCodeAt(0)),
    };
    set((s) => ({
      messages: [...s.messages.slice(-2000), msg],
      txCount: s.txCount + fullData.length,
      inputBuffer: "",
    }));

    // Simulate an echo/response for demo
    if (get().localEcho) {
      setTimeout(() => get().receiveData(fullData), 50);
    }
    // Simulate board response
    setTimeout(() => {
      const responses = [
        "OK\r\n",
        `> ${data}\r\n`,
        `ACK [${Date.now() & 0xffff}]\r\n`,
      ];
      get().receiveData(responses[Math.floor(Math.random() * responses.length)]);
    }, 150 + Math.random() * 300);
  },

  receiveData: (data, raw) => {
    const msg: SerialMessage = {
      id: ++_msgId,
      direction: "rx",
      data,
      timestamp: Date.now(),
      raw: raw ?? Array.from(data).map((c) => c.charCodeAt(0)),
    };
    set((s) => ({
      messages: [...s.messages.slice(-2000), msg],
      rxCount: s.rxCount + data.length,
    }));
  },

  clearMessages: () => set({ messages: [], rxCount: 0, txCount: 0 }),

  openPort: () => {
    set({ isOpen: true, messages: [] });
    const msg: SerialMessage = {
      id: ++_msgId,
      direction: "rx",
      data: "--- Port opened ---\r\n",
      timestamp: Date.now(),
    };
    set({ messages: [msg] });
  },

  closePort: () => {
    set({ isOpen: false });
    const msg: SerialMessage = {
      id: ++_msgId,
      direction: "rx",
      data: "--- Port closed ---\r\n",
      timestamp: Date.now(),
    };
    set((s) => ({ messages: [...s.messages, msg] }));
  },
}));
