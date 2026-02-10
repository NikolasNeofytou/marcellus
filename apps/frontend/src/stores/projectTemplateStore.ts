/**
 * projectTemplateStore — Manages new-project creation wizard state,
 * project templates, and toolchain configuration.
 *
 * Design philosophy vs MPLAB:
 *   MPLAB: 6–8 wizard steps, pick from 5000 chips, manually choose compiler/debugger/header/config bits.
 *   OpenSilicon: 3 steps — Board → Template → Name. Board selection auto-configures everything.
 *   Advanced options are available via expandable sections, not mandatory steps.
 */

import { create } from "zustand";
import { type BoardProfile, type BoardFamily, BUILTIN_BOARDS } from "./boardStore";

/* ------------------------------------------------------------------ */
/*  Template & Toolchain Types                                        */
/* ------------------------------------------------------------------ */

export type ProjectCategory =
  | "microcontroller"
  | "fpga"
  | "asic"
  | "simulation-only";

export type Toolchain =
  | "gcc-arm"
  | "gcc-riscv"
  | "gcc-avr"
  | "xtensa-esp"
  | "sdcc"
  | "yosys-nextpnr"
  | "vivado"
  | "custom";

export type BuildSystem = "cmake" | "make" | "platformio" | "custom";

export type RtosOption =
  | "none"
  | "freertos"
  | "zephyr"
  | "chibios"
  | "nuttx";

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  /** Which board families this template is compatible with */
  families: BoardFamily[];
  category: ProjectCategory;
  /** Tags for filtering */
  tags: string[];
  /** Estimated files created */
  fileCount: number;
  /** Difficulty level for UI badge */
  difficulty: "beginner" | "intermediate" | "advanced";
  /** Template "icon" identifier mapped in the UI */
  icon: string;
  /** Generated file tree preview */
  previewTree: string[];
}

export interface ProjectConfig {
  name: string;
  location: string;
  board: BoardProfile | null;
  template: ProjectTemplate | null;
  category: ProjectCategory;
  toolchain: Toolchain;
  buildSystem: BuildSystem;
  rtos: RtosOption;
  /** Enable debug printf / semihosting */
  debugPrintf: boolean;
  /** Generate VS Code launch.json + tasks.json */
  generateVsCodeConfig: boolean;
  /** Initialize git repo */
  initGit: boolean;
  /** Use OpenSilicon project format (.osp) */
  useOspFormat: boolean;
  /** Clock speed override (Hz) — auto-filled from board */
  clockSpeedHz: number;
  /** Custom linker script path (empty = auto-generate) */
  customLinkerScript: string;
  /** Extra C flags */
  cFlags: string;
  /** Extra linker flags */
  ldFlags: string;
}

/* ------------------------------------------------------------------ */
/*  Built-in Templates                                                */
/* ------------------------------------------------------------------ */

export const BUILTIN_TEMPLATES: ProjectTemplate[] = [
  /* ---------- Microcontroller templates ---------- */
  {
    id: "blinky",
    name: "Blinky LED",
    description:
      "Toggle an LED on the board's default GPIO pin. The simplest starting point.",
    families: ["stm32", "esp32", "nrf52", "rp2040", "arduino"],
    category: "microcontroller",
    tags: ["gpio", "beginner", "hello-world"],
    fileCount: 5,
    difficulty: "beginner",
    icon: "lightbulb",
    previewTree: [
      "src/",
      "  main.c",
      "  system_init.c",
      "include/",
      "  board.h",
      "CMakeLists.txt",
      "Makefile",
    ],
  },
  {
    id: "uart-hello",
    name: "UART Hello World",
    description:
      "Print messages over UART/serial. Great for learning serial communication.",
    families: ["stm32", "esp32", "nrf52", "rp2040", "arduino"],
    category: "microcontroller",
    tags: ["uart", "serial", "beginner"],
    fileCount: 6,
    difficulty: "beginner",
    icon: "terminal",
    previewTree: [
      "src/",
      "  main.c",
      "  uart.c",
      "  system_init.c",
      "include/",
      "  uart.h",
      "  board.h",
      "CMakeLists.txt",
    ],
  },
  {
    id: "gpio-button",
    name: "GPIO Button & LED",
    description:
      "Read a button input and control an LED — learn GPIO input/output and interrupts.",
    families: ["stm32", "esp32", "nrf52", "rp2040", "arduino"],
    category: "microcontroller",
    tags: ["gpio", "interrupt", "beginner"],
    fileCount: 5,
    difficulty: "beginner",
    icon: "toggle",
    previewTree: [
      "src/",
      "  main.c",
      "  gpio.c",
      "  system_init.c",
      "include/",
      "  gpio.h",
      "CMakeLists.txt",
    ],
  },
  {
    id: "timer-pwm",
    name: "Timer & PWM",
    description:
      "Configure a hardware timer to generate PWM signals — fade an LED or drive a servo.",
    families: ["stm32", "esp32", "nrf52", "rp2040"],
    category: "microcontroller",
    tags: ["timer", "pwm", "intermediate"],
    fileCount: 6,
    difficulty: "intermediate",
    icon: "clock",
    previewTree: [
      "src/",
      "  main.c",
      "  timer.c",
      "  system_init.c",
      "include/",
      "  timer.h",
      "  board.h",
      "CMakeLists.txt",
    ],
  },
  {
    id: "i2c-sensor",
    name: "I²C Sensor Reader",
    description:
      "Read data from an I²C sensor (e.g. temperature/accelerometer) and print over UART.",
    families: ["stm32", "esp32", "nrf52", "rp2040", "arduino"],
    category: "microcontroller",
    tags: ["i2c", "sensor", "intermediate"],
    fileCount: 7,
    difficulty: "intermediate",
    icon: "thermometer",
    previewTree: [
      "src/",
      "  main.c",
      "  i2c.c",
      "  sensor.c",
      "  uart.c",
      "include/",
      "  i2c.h",
      "  sensor.h",
      "CMakeLists.txt",
    ],
  },
  {
    id: "spi-display",
    name: "SPI Display Driver",
    description:
      "Drive an SPI display (SSD1306 / ST7735) — draw pixels, text, and graphics.",
    families: ["stm32", "esp32", "nrf52", "rp2040"],
    category: "microcontroller",
    tags: ["spi", "display", "intermediate"],
    fileCount: 8,
    difficulty: "intermediate",
    icon: "monitor",
    previewTree: [
      "src/",
      "  main.c",
      "  spi.c",
      "  display.c",
      "  font.c",
      "include/",
      "  spi.h",
      "  display.h",
      "  font.h",
      "CMakeLists.txt",
    ],
  },
  {
    id: "freertos-blinky",
    name: "FreeRTOS Blinky",
    description:
      "Two RTOS tasks: one blinks an LED, one prints to UART. Learn multitasking basics.",
    families: ["stm32", "esp32", "nrf52", "rp2040"],
    category: "microcontroller",
    tags: ["rtos", "freertos", "multitask", "intermediate"],
    fileCount: 8,
    difficulty: "intermediate",
    icon: "layers",
    previewTree: [
      "src/",
      "  main.c",
      "  tasks.c",
      "  system_init.c",
      "include/",
      "  tasks.h",
      "  FreeRTOSConfig.h",
      "lib/",
      "  FreeRTOS/",
      "CMakeLists.txt",
    ],
  },
  {
    id: "adc-dma",
    name: "ADC with DMA",
    description:
      "Sample analog inputs efficiently using DMA transfers. Plot data via serial.",
    families: ["stm32", "nrf52", "rp2040"],
    category: "microcontroller",
    tags: ["adc", "dma", "advanced"],
    fileCount: 7,
    difficulty: "advanced",
    icon: "activity",
    previewTree: [
      "src/",
      "  main.c",
      "  adc.c",
      "  dma.c",
      "  uart.c",
      "include/",
      "  adc.h",
      "  dma.h",
      "CMakeLists.txt",
    ],
  },
  {
    id: "usb-cdc",
    name: "USB CDC (Virtual COM)",
    description:
      "Enumerate as a USB serial device — no external UART adapter needed.",
    families: ["stm32", "nrf52", "rp2040"],
    category: "microcontroller",
    tags: ["usb", "cdc", "advanced"],
    fileCount: 9,
    difficulty: "advanced",
    icon: "usb",
    previewTree: [
      "src/",
      "  main.c",
      "  usb_cdc.c",
      "  usb_descriptors.c",
      "  system_init.c",
      "include/",
      "  usb_cdc.h",
      "  usb_descriptors.h",
      "lib/",
      "  tinyusb/",
      "CMakeLists.txt",
    ],
  },
  {
    id: "bare-metal-empty",
    name: "Bare Metal (Empty)",
    description:
      "Minimal startup code, linker script, and an empty main() — for experts who want full control.",
    families: ["stm32", "esp32", "nrf52", "rp2040", "arduino"],
    category: "microcontroller",
    tags: ["bare-metal", "empty", "advanced"],
    fileCount: 4,
    difficulty: "advanced",
    icon: "file",
    previewTree: [
      "src/",
      "  main.c",
      "  startup.s",
      "include/",
      "linker.ld",
      "Makefile",
    ],
  },

  /* ---------- FPGA templates ---------- */
  {
    id: "fpga-blinky",
    name: "FPGA Blinky (Verilog)",
    description:
      "Toggle an LED using a clock divider — the 'Hello World' of FPGA development.",
    families: ["fpga-ice40", "fpga-ecp5", "fpga-xilinx"],
    category: "fpga",
    tags: ["verilog", "beginner", "led"],
    fileCount: 4,
    difficulty: "beginner",
    icon: "cpu",
    previewTree: [
      "rtl/",
      "  top.v",
      "  blinky.v",
      "constraints/",
      "  pins.pcf",
      "Makefile",
    ],
  },
  {
    id: "fpga-counter",
    name: "FPGA Counter (VHDL)",
    description:
      "A simple up-counter displayed on LEDs. Introduction to VHDL and sequential logic.",
    families: ["fpga-ice40", "fpga-ecp5", "fpga-xilinx"],
    category: "fpga",
    tags: ["vhdl", "beginner", "counter"],
    fileCount: 5,
    difficulty: "beginner",
    icon: "hash",
    previewTree: [
      "rtl/",
      "  top.vhd",
      "  counter.vhd",
      "tb/",
      "  counter_tb.vhd",
      "constraints/",
      "  pins.pcf",
      "Makefile",
    ],
  },
  {
    id: "fpga-uart",
    name: "FPGA UART Transceiver",
    description:
      "Implement a UART TX/RX module in Verilog with testbench. Learn serial protocol on hardware.",
    families: ["fpga-ice40", "fpga-ecp5", "fpga-xilinx"],
    category: "fpga",
    tags: ["verilog", "uart", "intermediate"],
    fileCount: 7,
    difficulty: "intermediate",
    icon: "terminal",
    previewTree: [
      "rtl/",
      "  top.v",
      "  uart_tx.v",
      "  uart_rx.v",
      "tb/",
      "  uart_tb.v",
      "constraints/",
      "  pins.pcf",
      "Makefile",
    ],
  },
  {
    id: "fpga-soc",
    name: "Soft-Core SoC (PicoRV32)",
    description:
      "A RISC-V soft-core processor with SRAM and GPIO — build your own CPU on an FPGA.",
    families: ["fpga-ice40", "fpga-ecp5"],
    category: "fpga",
    tags: ["riscv", "soc", "advanced"],
    fileCount: 12,
    difficulty: "advanced",
    icon: "cpu",
    previewTree: [
      "rtl/",
      "  top.v",
      "  picorv32.v",
      "  soc.v",
      "  gpio.v",
      "  sram.v",
      "firmware/",
      "  main.c",
      "  start.s",
      "  linker.ld",
      "  Makefile",
      "constraints/",
      "  pins.pcf",
      "Makefile",
    ],
  },

  /* ---------- ASIC / simulation templates ---------- */
  {
    id: "asic-inverter",
    name: "CMOS Inverter (SKY130)",
    description:
      "Design a CMOS inverter using the SKY130 PDK — schematic, layout, DRC, and LVS.",
    families: [],
    category: "asic",
    tags: ["sky130", "cmos", "beginner"],
    fileCount: 3,
    difficulty: "beginner",
    icon: "git-branch",
    previewTree: [
      "design/",
      "  inverter.sch",
      "  inverter.lay",
      "simulation/",
      "  inverter_tb.spice",
      "project.osp",
    ],
  },
  {
    id: "asic-opamp",
    name: "Two-Stage Op-Amp (SKY130)",
    description:
      "Design a two-stage Miller-compensated operational amplifier. Includes SPICE testbenches.",
    families: [],
    category: "asic",
    tags: ["sky130", "analog", "advanced"],
    fileCount: 6,
    difficulty: "advanced",
    icon: "triangle",
    previewTree: [
      "design/",
      "  opamp.sch",
      "  opamp.lay",
      "simulation/",
      "  dc_sweep.spice",
      "  ac_response.spice",
      "  transient.spice",
      "project.osp",
    ],
  },
  {
    id: "sim-only",
    name: "Simulation Only",
    description:
      "No board needed — just SPICE simulation, waveform viewer, and schematic capture.",
    families: [],
    category: "simulation-only",
    tags: ["spice", "simulation", "beginner"],
    fileCount: 2,
    difficulty: "beginner",
    icon: "line-chart",
    previewTree: [
      "simulation/",
      "  circuit.spice",
      "project.osp",
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Toolchain auto-detection from board family                        */
/* ------------------------------------------------------------------ */

export function inferToolchain(family: BoardFamily): Toolchain {
  switch (family) {
    case "stm32":
    case "nrf52":
      return "gcc-arm";
    case "rp2040":
      return "gcc-arm";
    case "esp32":
      return "xtensa-esp";
    case "arduino":
      return "gcc-avr";
    case "fpga-ice40":
    case "fpga-ecp5":
      return "yosys-nextpnr";
    case "fpga-xilinx":
      return "vivado";
    default:
      return "custom";
  }
}

export function inferBuildSystem(family: BoardFamily): BuildSystem {
  switch (family) {
    case "esp32":
      return "cmake"; // ESP-IDF uses CMake
    case "arduino":
      return "platformio";
    case "fpga-ice40":
    case "fpga-ecp5":
    case "fpga-xilinx":
      return "make";
    default:
      return "cmake";
  }
}

/* ------------------------------------------------------------------ */
/*  Wizard state machine                                              */
/* ------------------------------------------------------------------ */

export type WizardStep = "board" | "template" | "configure";

interface ProjectTemplateState {
  /* Wizard visibility */
  isOpen: boolean;
  openWizard: () => void;
  closeWizard: () => void;

  /* Wizard navigation */
  currentStep: WizardStep;
  setStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;

  /* Selection state */
  selectedBoard: BoardProfile | null;
  selectBoard: (board: BoardProfile | null) => void;
  selectedTemplate: ProjectTemplate | null;
  selectTemplate: (template: ProjectTemplate | null) => void;
  categoryFilter: ProjectCategory | "all";
  setCategoryFilter: (cat: ProjectCategory | "all") => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  familyFilter: BoardFamily | "all";
  setFamilyFilter: (f: BoardFamily | "all") => void;
  difficultyFilter: "all" | "beginner" | "intermediate" | "advanced";
  setDifficultyFilter: (d: "all" | "beginner" | "intermediate" | "advanced") => void;

  /* Project configuration */
  config: ProjectConfig;
  setConfigField: <K extends keyof ProjectConfig>(
    key: K,
    value: ProjectConfig[K],
  ) => void;

  /* Template helpers */
  getCompatibleTemplates: () => ProjectTemplate[];
  getAvailableBoards: () => BoardProfile[];

  /* Create project */
  isCreating: boolean;
  createError: string | null;
  createProject: () => Promise<void>;
  resetWizard: () => void;

  /* Recent projects */
  recentProjects: RecentProject[];
  addRecentProject: (p: RecentProject) => void;
  clearRecentProjects: () => void;
}

export interface RecentProject {
  name: string;
  path: string;
  board: string;
  template: string;
  createdAt: number;
}

const DEFAULT_CONFIG: ProjectConfig = {
  name: "",
  location: "",
  board: null,
  template: null,
  category: "microcontroller",
  toolchain: "gcc-arm",
  buildSystem: "cmake",
  rtos: "none",
  debugPrintf: true,
  generateVsCodeConfig: true,
  initGit: true,
  useOspFormat: true,
  clockSpeedHz: 0,
  customLinkerScript: "",
  cFlags: "-Wall -Wextra -Os",
  ldFlags: "",
};

const STEP_ORDER: WizardStep[] = ["board", "template", "configure"];

function loadRecentProjects(): RecentProject[] {
  try {
    const raw = localStorage.getItem("opensilicon-recent-projects");
    return raw ? (JSON.parse(raw) as RecentProject[]) : [];
  } catch {
    return [];
  }
}

function saveRecentProjects(projects: RecentProject[]) {
  localStorage.setItem(
    "opensilicon-recent-projects",
    JSON.stringify(projects.slice(0, 20)),
  );
}

export const useProjectTemplateStore = create<ProjectTemplateState>(
  (set, get) => ({
    /* Wizard visibility */
    isOpen: false,
    openWizard: () =>
      set({
        isOpen: true,
        currentStep: "board",
        selectedBoard: null,
        selectedTemplate: null,
        config: { ...DEFAULT_CONFIG },
        createError: null,
        isCreating: false,
        searchQuery: "",
        categoryFilter: "all",
        familyFilter: "all",
        difficultyFilter: "all",
      }),
    closeWizard: () => set({ isOpen: false }),

    /* Wizard navigation */
    currentStep: "board",
    setStep: (step) => set({ currentStep: step }),
    nextStep: () => {
      const { currentStep } = get();
      const idx = STEP_ORDER.indexOf(currentStep);
      if (idx < STEP_ORDER.length - 1) {
        set({ currentStep: STEP_ORDER[idx + 1] });
      }
    },
    prevStep: () => {
      const { currentStep } = get();
      const idx = STEP_ORDER.indexOf(currentStep);
      if (idx > 0) {
        set({ currentStep: STEP_ORDER[idx - 1] });
      }
    },

    /* Selection */
    selectedBoard: null,
    selectBoard: (board) => {
      const updates: Partial<ProjectTemplateState> & Partial<{ config: ProjectConfig }> = {
        selectedBoard: board,
      };
      if (board) {
        const toolchain = inferToolchain(board.family);
        const buildSystem = inferBuildSystem(board.family);
        const isFpga =
          board.family === "fpga-ice40" ||
          board.family === "fpga-ecp5" ||
          board.family === "fpga-xilinx";
        const category: ProjectCategory = isFpga ? "fpga" : "microcontroller";

        set((s) => ({
          ...updates,
          config: {
            ...s.config,
            board,
            toolchain,
            buildSystem,
            category,
            clockSpeedHz: parseInt(board.clockSpeed) * 1_000_000 || 0,
          },
          categoryFilter: category,
        }));
        return;
      }
      set(updates);
    },
    selectedTemplate: null,
    selectTemplate: (template) => {
      set((s) => ({
        selectedTemplate: template,
        config: { ...s.config, template },
      }));
    },
    categoryFilter: "all",
    setCategoryFilter: (cat) => set({ categoryFilter: cat }),
    searchQuery: "",
    setSearchQuery: (q) => set({ searchQuery: q }),
    familyFilter: "all",
    setFamilyFilter: (f) => set({ familyFilter: f }),
    difficultyFilter: "all",
    setDifficultyFilter: (d) => set({ difficultyFilter: d }),

    /* Project configuration */
    config: { ...DEFAULT_CONFIG },
    setConfigField: (key, value) =>
      set((s) => ({ config: { ...s.config, [key]: value } })),

    /* Template helpers */
    getCompatibleTemplates: () => {
      const { selectedBoard, categoryFilter, searchQuery, difficultyFilter } = get();
      let templates = BUILTIN_TEMPLATES;

      // Filter by board compatibility
      if (selectedBoard) {
        templates = templates.filter(
          (t) =>
            t.families.length === 0 || // universal templates
            t.families.includes(selectedBoard.family),
        );
      }

      // Filter by category
      if (categoryFilter !== "all") {
        templates = templates.filter((t) => t.category === categoryFilter);
      }

      // Filter by difficulty
      if (difficultyFilter !== "all") {
        templates = templates.filter((t) => t.difficulty === difficultyFilter);
      }

      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        templates = templates.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            t.tags.some((tag) => tag.includes(q)),
        );
      }

      return templates;
    },

    getAvailableBoards: () => {
      const { familyFilter, searchQuery } = get();
      let boards = [...BUILTIN_BOARDS];

      if (familyFilter !== "all") {
        boards = boards.filter((b) => b.family === familyFilter);
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        boards = boards.filter(
          (b) =>
            b.name.toLowerCase().includes(q) ||
            b.mcu.toLowerCase().includes(q) ||
            b.family.toLowerCase().includes(q),
        );
      }

      return boards;
    },

    /* Create project */
    isCreating: false,
    createError: null,
    createProject: async () => {
      const { config, addRecentProject, closeWizard } = get();

      if (!config.name.trim()) {
        set({ createError: "Project name is required." });
        return;
      }
      if (!config.location.trim()) {
        set({ createError: "Project location is required." });
        return;
      }

      set({ isCreating: true, createError: null });

      try {
        // Simulate project scaffolding (in real implementation,
        // this calls Tauri backend to write files to disk)
        await new Promise((resolve) => setTimeout(resolve, 1200));

        addRecentProject({
          name: config.name,
          path: config.location + "/" + config.name,
          board: config.board?.name ?? "None",
          template: config.template?.name ?? "Empty",
          createdAt: Date.now(),
        });

        set({ isCreating: false });
        closeWizard();
      } catch (err) {
        set({
          isCreating: false,
          createError: err instanceof Error ? err.message : "Unknown error",
        });
      }
    },

    resetWizard: () =>
      set({
        currentStep: "board",
        selectedBoard: null,
        selectedTemplate: null,
        config: { ...DEFAULT_CONFIG },
        createError: null,
        isCreating: false,
        searchQuery: "",
        categoryFilter: "all",
        familyFilter: "all",
        difficultyFilter: "all",
      }),

    /* Recent projects */
    recentProjects: loadRecentProjects(),
    addRecentProject: (p) => {
      const list = [p, ...get().recentProjects.filter((r) => r.path !== p.path)].slice(0, 20);
      saveRecentProjects(list);
      set({ recentProjects: list });
    },
    clearRecentProjects: () => {
      saveRecentProjects([]);
      set({ recentProjects: [] });
    },
  }),
);
