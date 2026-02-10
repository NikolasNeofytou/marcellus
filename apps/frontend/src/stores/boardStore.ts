import { create } from "zustand";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

export type BoardFamily =
  | "stm32"
  | "esp32"
  | "nrf52"
  | "rp2040"
  | "fpga-ice40"
  | "fpga-ecp5"
  | "fpga-xilinx"
  | "arduino"
  | "custom";

export type ConnectionInterface =
  | "usb"
  | "uart"
  | "jtag"
  | "swd"
  | "spi"
  | "wifi"
  | "none";

export type ProgrammerTool =
  | "openocd"
  | "jlink"
  | "stlink"
  | "dfu-util"
  | "esptool"
  | "iceprog"
  | "icestorm"
  | "fujprog"
  | "avrdude"
  | "picotool"
  | "custom";

export type DebugProbe =
  | "openocd-gdb"
  | "jlink-gdb"
  | "stlink-gdb"
  | "blackmagic"
  | "custom"
  | "none";

export interface BoardProfile {
  id: string;
  name: string;
  family: BoardFamily;
  mcu: string;                     // e.g. "STM32F407VG", "ESP32-S3", "iCE40HX8K"
  clockSpeed: string;              // e.g. "168 MHz"
  flash: string;                   // e.g. "1 MB"
  ram: string;                     // e.g. "192 KB"
  connectionInterface: ConnectionInterface;
  programmer: ProgrammerTool;
  debugProbe: DebugProbe;
  openocdTarget?: string;          // e.g. "stm32f4x.cfg"
  openocdInterface?: string;       // e.g. "stlink.cfg"
  svdFile?: string;                // SVD for register viewer
  custom?: boolean;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export type FlashState = "idle" | "erasing" | "flashing" | "verifying" | "done" | "error";

export interface FlashProgress {
  state: FlashState;
  percent: number;
  message: string;
  startedAt: number;
}

export interface DebugBreakpoint {
  id: number;
  file: string;
  line: number;
  enabled: boolean;
  condition?: string;
  hitCount: number;
}

export interface DebugVariable {
  name: string;
  value: string;
  type: string;
  children?: DebugVariable[];
  changed?: boolean;
}

export interface RegisterValue {
  name: string;
  value: string;     // hex
  decimal: number;
  bitWidth: number;
  category: string;  // e.g. "General Purpose", "Status", "Control", "FPU"
}

export interface MemoryBlock {
  address: number;
  bytes: number[];
  ascii: string;
}

export type DebugState = "idle" | "running" | "paused" | "stepping" | "error";

export interface CallStackFrame {
  id: number;
  name: string;
  file: string;
  line: number;
  address: string;
  module: string;
}

/* ------------------------------------------------------------------ */
/*  Built-in board profiles                                           */
/* ------------------------------------------------------------------ */

export const BUILTIN_BOARDS: BoardProfile[] = [
  {
    id: "stm32f407-discovery",
    name: "STM32F407 Discovery",
    family: "stm32",
    mcu: "STM32F407VGT6",
    clockSpeed: "168 MHz",
    flash: "1 MB",
    ram: "192 KB",
    connectionInterface: "swd",
    programmer: "stlink",
    debugProbe: "stlink-gdb",
    openocdTarget: "stm32f4x.cfg",
    openocdInterface: "stlink.cfg",
  },
  {
    id: "stm32f103-bluepill",
    name: "STM32F103 Blue Pill",
    family: "stm32",
    mcu: "STM32F103C8T6",
    clockSpeed: "72 MHz",
    flash: "64 KB",
    ram: "20 KB",
    connectionInterface: "swd",
    programmer: "stlink",
    debugProbe: "stlink-gdb",
    openocdTarget: "stm32f1x.cfg",
    openocdInterface: "stlink.cfg",
  },
  {
    id: "stm32h743-nucleo",
    name: "STM32H743 Nucleo-144",
    family: "stm32",
    mcu: "STM32H743ZIT6",
    clockSpeed: "480 MHz",
    flash: "2 MB",
    ram: "1 MB",
    connectionInterface: "swd",
    programmer: "stlink",
    debugProbe: "stlink-gdb",
    openocdTarget: "stm32h7x.cfg",
    openocdInterface: "stlink.cfg",
  },
  {
    id: "esp32-devkit",
    name: "ESP32 DevKit v1",
    family: "esp32",
    mcu: "ESP32-D0WDQ6",
    clockSpeed: "240 MHz",
    flash: "4 MB",
    ram: "520 KB",
    connectionInterface: "usb",
    programmer: "esptool",
    debugProbe: "openocd-gdb",
    openocdTarget: "esp32.cfg",
  },
  {
    id: "esp32s3-devkit",
    name: "ESP32-S3 DevKitC",
    family: "esp32",
    mcu: "ESP32-S3",
    clockSpeed: "240 MHz",
    flash: "8 MB",
    ram: "512 KB",
    connectionInterface: "usb",
    programmer: "esptool",
    debugProbe: "openocd-gdb",
    openocdTarget: "esp32s3.cfg",
  },
  {
    id: "nrf52840-dk",
    name: "nRF52840 DK",
    family: "nrf52",
    mcu: "nRF52840",
    clockSpeed: "64 MHz",
    flash: "1 MB",
    ram: "256 KB",
    connectionInterface: "swd",
    programmer: "jlink",
    debugProbe: "jlink-gdb",
  },
  {
    id: "rp2040-pico",
    name: "Raspberry Pi Pico",
    family: "rp2040",
    mcu: "RP2040",
    clockSpeed: "133 MHz",
    flash: "2 MB",
    ram: "264 KB",
    connectionInterface: "usb",
    programmer: "picotool",
    debugProbe: "openocd-gdb",
    openocdTarget: "rp2040.cfg",
  },
  {
    id: "ice40-hx8k-breakout",
    name: "iCE40-HX8K Breakout",
    family: "fpga-ice40",
    mcu: "iCE40HX8K",
    clockSpeed: "12 MHz (PLL-configurable)",
    flash: "N/A (SRAM-based)",
    ram: "N/A",
    connectionInterface: "spi",
    programmer: "iceprog",
    debugProbe: "none",
  },
  {
    id: "ecp5-evn",
    name: "ECP5 Evaluation Board",
    family: "fpga-ecp5",
    mcu: "LFE5U-85F",
    clockSpeed: "Configurable",
    flash: "128 Mbit",
    ram: "N/A",
    connectionInterface: "jtag",
    programmer: "fujprog",
    debugProbe: "none",
  },
  {
    id: "arduino-uno",
    name: "Arduino Uno R3",
    family: "arduino",
    mcu: "ATmega328P",
    clockSpeed: "16 MHz",
    flash: "32 KB",
    ram: "2 KB",
    connectionInterface: "usb",
    programmer: "avrdude",
    debugProbe: "none",
  },
];

/* ------------------------------------------------------------------ */
/*  Store                                                             */
/* ------------------------------------------------------------------ */

interface BoardStoreState {
  // Board selection
  boards: BoardProfile[];
  activeBoard: BoardProfile | null;
  customBoards: BoardProfile[];

  // Connection
  connectionStatus: ConnectionStatus;
  connectionPort: string;               // e.g. "COM3", "/dev/ttyUSB0"
  availablePorts: string[];
  connectionLog: string[];

  // Flashing
  flashProgress: FlashProgress;
  firmwarePath: string;
  lastFlashTime: number | null;

  // Debug
  debugState: DebugState;
  breakpoints: DebugBreakpoint[];
  variables: DebugVariable[];
  callStack: CallStackFrame[];
  registers: RegisterValue[];
  memoryBlocks: MemoryBlock[];
  memoryAddress: string;               // hex address for memory viewer
  watchExpressions: string[];
  debugOutput: string[];
  currentFile: string;
  currentLine: number;

  // Actions — board
  setActiveBoard: (board: BoardProfile | null) => void;
  addCustomBoard: (board: BoardProfile) => void;
  removeCustomBoard: (id: string) => void;

  // Actions — connection
  setConnectionPort: (port: string) => void;
  setAvailablePorts: (ports: string[]) => void;
  scanPorts: () => void;
  connect: () => void;
  disconnect: () => void;
  appendConnectionLog: (msg: string) => void;

  // Actions — flash
  setFirmwarePath: (path: string) => void;
  startFlash: () => void;
  updateFlashProgress: (p: Partial<FlashProgress>) => void;

  // Actions — debug
  startDebugSession: () => void;
  stopDebugSession: () => void;
  debugContinue: () => void;
  debugStepOver: () => void;
  debugStepInto: () => void;
  debugStepOut: () => void;
  debugPause: () => void;
  addBreakpoint: (file: string, line: number, condition?: string) => void;
  removeBreakpoint: (id: number) => void;
  toggleBreakpoint: (id: number) => void;
  clearAllBreakpoints: () => void;
  setVariables: (v: DebugVariable[]) => void;
  setCallStack: (frames: CallStackFrame[]) => void;
  setRegisters: (regs: RegisterValue[]) => void;
  loadMemory: (address: string) => void;
  setMemoryAddress: (addr: string) => void;
  addWatchExpression: (expr: string) => void;
  removeWatchExpression: (expr: string) => void;
  appendDebugOutput: (msg: string) => void;
  setCurrentLocation: (file: string, line: number) => void;
}

let _bpId = 0;

export const useBoardStore = create<BoardStoreState>((set, get) => ({
  // Board
  boards: BUILTIN_BOARDS,
  activeBoard: null,
  customBoards: [],

  // Connection
  connectionStatus: "disconnected",
  connectionPort: "",
  availablePorts: [],
  connectionLog: [],

  // Flash
  flashProgress: { state: "idle", percent: 0, message: "", startedAt: 0 },
  firmwarePath: "",
  lastFlashTime: null,

  // Debug
  debugState: "idle",
  breakpoints: [],
  variables: [],
  callStack: [],
  registers: [],
  memoryBlocks: [],
  memoryAddress: "0x08000000",
  watchExpressions: [],
  debugOutput: [],
  currentFile: "",
  currentLine: 0,

  /* ── Board actions ──────────────────────────────────────────────── */

  setActiveBoard: (board) => set({ activeBoard: board }),

  addCustomBoard: (board) =>
    set((s) => ({
      customBoards: [...s.customBoards, board],
      boards: [...s.boards, board],
    })),

  removeCustomBoard: (id) =>
    set((s) => ({
      customBoards: s.customBoards.filter((b) => b.id !== id),
      boards: s.boards.filter((b) => b.id !== id),
      activeBoard: s.activeBoard?.id === id ? null : s.activeBoard,
    })),

  /* ── Connection actions ─────────────────────────────────────────── */

  setConnectionPort: (port) => set({ connectionPort: port }),
  setAvailablePorts: (ports) => set({ availablePorts: ports }),

  scanPorts: () => {
    // Simulate scanning — in Tauri, this would be a real IPC call
    const simulatedPorts =
      navigator.platform.startsWith("Win")
        ? ["COM3", "COM4", "COM5", "COM8"]
        : ["/dev/ttyUSB0", "/dev/ttyACM0", "/dev/ttyS0"];
    set({
      availablePorts: simulatedPorts,
      connectionLog: [...get().connectionLog, `[scan] Found ${simulatedPorts.length} port(s)`],
    });
  },

  connect: () => {
    const { activeBoard, connectionPort } = get();
    if (!activeBoard) return;
    set({ connectionStatus: "connecting" });
    get().appendConnectionLog(`Connecting to ${activeBoard.name} on ${connectionPort || "auto"}...`);
    // Simulate connection delay
    setTimeout(() => {
      set({ connectionStatus: "connected" });
      get().appendConnectionLog(`✓ Connected to ${activeBoard.name} via ${activeBoard.connectionInterface.toUpperCase()}`);
    }, 1200);
  },

  disconnect: () => {
    const board = get().activeBoard;
    set({ connectionStatus: "disconnected", debugState: "idle" });
    get().appendConnectionLog(`Disconnected from ${board?.name ?? "board"}`);
  },

  appendConnectionLog: (msg) =>
    set((s) => ({
      connectionLog: [...s.connectionLog.slice(-200), `[${new Date().toLocaleTimeString()}] ${msg}`],
    })),

  /* ── Flash actions ──────────────────────────────────────────────── */

  setFirmwarePath: (path) => set({ firmwarePath: path }),

  startFlash: () => {
    const { activeBoard, firmwarePath, connectionStatus } = get();
    if (!activeBoard || !firmwarePath) return;
    if (connectionStatus !== "connected") {
      get().appendConnectionLog("⚠ Connect to board before flashing");
      return;
    }

    set({
      flashProgress: { state: "erasing", percent: 0, message: "Erasing flash...", startedAt: Date.now() },
    });
    get().appendConnectionLog(`Flashing ${firmwarePath} using ${activeBoard.programmer}...`);

    // Simulate flash stages
    const stages: Array<{ state: FlashState; msg: string; pct: number; delay: number }> = [
      { state: "erasing",   msg: "Erasing flash memory...",       pct: 15,  delay: 800 },
      { state: "flashing",  msg: "Writing firmware (sector 1)...",pct: 30,  delay: 600 },
      { state: "flashing",  msg: "Writing firmware (sector 2)...",pct: 50,  delay: 600 },
      { state: "flashing",  msg: "Writing firmware (sector 3)...",pct: 70,  delay: 600 },
      { state: "verifying", msg: "Verifying...",                  pct: 90,  delay: 500 },
      { state: "done",      msg: "Flash complete!",               pct: 100, delay: 0 },
    ];

    let elapsed = 0;
    for (const stage of stages) {
      elapsed += stage.delay;
      setTimeout(() => {
        set({
          flashProgress: { state: stage.state, percent: stage.pct, message: stage.msg, startedAt: get().flashProgress.startedAt },
        });
        get().appendConnectionLog(stage.msg);
        if (stage.state === "done") {
          set({ lastFlashTime: Date.now() });
        }
      }, elapsed);
    }
  },

  updateFlashProgress: (p) =>
    set((s) => ({ flashProgress: { ...s.flashProgress, ...p } })),

  /* ── Debug actions ──────────────────────────────────────────────── */

  startDebugSession: () => {
    const board = get().activeBoard;
    if (!board || get().connectionStatus !== "connected") return;
    set({ debugState: "running", debugOutput: [], callStack: [], variables: [] });
    get().appendDebugOutput(`[GDB] Starting debug session for ${board.mcu}...`);
    get().appendDebugOutput(`[GDB] target remote :3333`);
    get().appendDebugOutput(`[GDB] Loading symbols...`);

    // Simulate initial pause at main
    setTimeout(() => {
      set({
        debugState: "paused",
        currentFile: "main.c",
        currentLine: 42,
        callStack: [
          { id: 0, name: "main",           file: "main.c",     line: 42, address: "0x08000410", module: "firmware.elf" },
          { id: 1, name: "Reset_Handler",  file: "startup.s",  line: 12, address: "0x08000004", module: "firmware.elf" },
        ],
        variables: [
          { name: "counter", value: "0", type: "uint32_t" },
          { name: "led_state", value: "false", type: "bool" },
          { name: "config", value: "{...}", type: "SystemConfig", children: [
            { name: "clock_freq", value: "168000000", type: "uint32_t" },
            { name: "prescaler", value: "84", type: "uint16_t" },
            { name: "auto_reload", value: "999", type: "uint16_t" },
          ]},
        ],
        registers: [
          { name: "R0",   value: "0x00000000", decimal: 0,          bitWidth: 32, category: "General Purpose" },
          { name: "R1",   value: "0x20000100", decimal: 536871168,  bitWidth: 32, category: "General Purpose" },
          { name: "R2",   value: "0x00000001", decimal: 1,          bitWidth: 32, category: "General Purpose" },
          { name: "R3",   value: "0x40020C00", decimal: 1073875968, bitWidth: 32, category: "General Purpose" },
          { name: "R4",   value: "0x00000000", decimal: 0,          bitWidth: 32, category: "General Purpose" },
          { name: "SP",   value: "0x20020000", decimal: 536969216,  bitWidth: 32, category: "General Purpose" },
          { name: "LR",   value: "0x08000005", decimal: 134217733,  bitWidth: 32, category: "General Purpose" },
          { name: "PC",   value: "0x08000410", decimal: 134218768,  bitWidth: 32, category: "General Purpose" },
          { name: "xPSR", value: "0x61000000", decimal: 1627389952, bitWidth: 32, category: "Status" },
          { name: "MSP",  value: "0x20020000", decimal: 536969216,  bitWidth: 32, category: "Control" },
          { name: "PSP",  value: "0x00000000", decimal: 0,          bitWidth: 32, category: "Control" },
        ],
      });
      get().appendDebugOutput("[GDB] Breakpoint 1 at main (main.c:42)");
      get().appendDebugOutput("[GDB] Stopped at main()");
    }, 1500);
  },

  stopDebugSession: () => {
    set({
      debugState: "idle",
      callStack: [],
      variables: [],
      registers: [],
      memoryBlocks: [],
    });
    get().appendDebugOutput("[GDB] Debug session ended");
  },

  debugContinue: () => {
    if (get().debugState !== "paused") return;
    set({ debugState: "running" });
    get().appendDebugOutput("[GDB] Continuing...");
    // Simulate hitting next breakpoint
    setTimeout(() => {
      const bp = get().breakpoints.find((b) => b.enabled);
      if (bp) {
        set({
          debugState: "paused",
          currentFile: bp.file,
          currentLine: bp.line,
        });
        get().appendDebugOutput(`[GDB] Breakpoint ${bp.id} hit at ${bp.file}:${bp.line}`);
        set((s) => ({
          breakpoints: s.breakpoints.map((b) =>
            b.id === bp.id ? { ...b, hitCount: b.hitCount + 1 } : b
          ),
        }));
      } else {
        set({ debugState: "paused", currentLine: get().currentLine + 5 });
        get().appendDebugOutput("[GDB] Stopped");
      }
    }, 800);
  },

  debugStepOver: () => {
    if (get().debugState !== "paused") return;
    set({ debugState: "stepping" });
    get().appendDebugOutput("[GDB] Step over");
    setTimeout(() => {
      set((s) => ({
        debugState: "paused",
        currentLine: s.currentLine + 1,
      }));
    }, 300);
  },

  debugStepInto: () => {
    if (get().debugState !== "paused") return;
    set({ debugState: "stepping" });
    get().appendDebugOutput("[GDB] Step into");
    setTimeout(() => {
      set((s) => ({
        debugState: "paused",
        currentLine: s.currentLine + 1,
        callStack: [
          { id: 0, name: "HAL_GPIO_WritePin", file: "stm32f4xx_hal_gpio.c", line: 185, address: "0x0800A200", module: "firmware.elf" },
          ...s.callStack,
        ],
      }));
    }, 300);
  },

  debugStepOut: () => {
    if (get().debugState !== "paused") return;
    set({ debugState: "stepping" });
    get().appendDebugOutput("[GDB] Step out");
    setTimeout(() => {
      set((s) => ({
        debugState: "paused",
        currentLine: s.currentLine + 3,
        callStack: s.callStack.slice(1),
      }));
    }, 400);
  },

  debugPause: () => {
    if (get().debugState !== "running") return;
    set({ debugState: "paused" });
    get().appendDebugOutput("[GDB] Paused by user");
  },

  addBreakpoint: (file, line, condition) => {
    const id = ++_bpId;
    set((s) => ({
      breakpoints: [...s.breakpoints, { id, file, line, enabled: true, condition, hitCount: 0 }],
    }));
    get().appendDebugOutput(`[GDB] Breakpoint ${id} set at ${file}:${line}${condition ? ` if ${condition}` : ""}`);
  },

  removeBreakpoint: (id) =>
    set((s) => ({
      breakpoints: s.breakpoints.filter((b) => b.id !== id),
    })),

  toggleBreakpoint: (id) =>
    set((s) => ({
      breakpoints: s.breakpoints.map((b) =>
        b.id === id ? { ...b, enabled: !b.enabled } : b
      ),
    })),

  clearAllBreakpoints: () => set({ breakpoints: [] }),

  setVariables: (variables) => set({ variables }),
  setCallStack: (callStack) => set({ callStack }),
  setRegisters: (registers) => set({ registers }),

  loadMemory: (address) => {
    // Simulate memory read
    const addr = parseInt(address, 16) || 0x08000000;
    const blocks: MemoryBlock[] = [];
    for (let row = 0; row < 16; row++) {
      const base = addr + row * 16;
      const bytes: number[] = [];
      for (let col = 0; col < 16; col++) {
        bytes.push(Math.floor(Math.random() * 256));
      }
      blocks.push({
        address: base,
        bytes,
        ascii: bytes.map((b) => (b >= 32 && b < 127 ? String.fromCharCode(b) : ".")).join(""),
      });
    }
    set({ memoryBlocks: blocks, memoryAddress: address });
  },

  setMemoryAddress: (addr) => set({ memoryAddress: addr }),

  addWatchExpression: (expr) =>
    set((s) => ({
      watchExpressions: s.watchExpressions.includes(expr) ? s.watchExpressions : [...s.watchExpressions, expr],
    })),

  removeWatchExpression: (expr) =>
    set((s) => ({
      watchExpressions: s.watchExpressions.filter((e) => e !== expr),
    })),

  appendDebugOutput: (msg) =>
    set((s) => ({
      debugOutput: [...s.debugOutput.slice(-500), msg],
    })),

  setCurrentLocation: (file, line) => set({ currentFile: file, currentLine: line }),
}));
