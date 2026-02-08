/**
 * SKY130 HD Standard Cell Library — Detailed Cell Data
 *
 * Provides complete geometric representations of the sky130_fd_sc_hd cells
 * for the cell library browser. Includes simplified layout geometries
 * (DIFF, POLY, LI, M1 layers), pin positions, and transistor-level data.
 *
 * Reference: SkyWater PDK sky130_fd_sc_hd standard cell library.
 * Cell height: 2.72 µm, site width: 0.46 µm.
 */

import type { StandardCellDef } from "./types";

export const SKY130_CELL_HEIGHT = 2.72;
export const SKY130_SITE_WIDTH = 0.46;

/**
 * Expanded library with multiple drive strengths and additional cells
 * beyond what's in the basic sky130.ts reference definitions.
 */
export const sky130HdCells: StandardCellDef[] = [
  // ── Inverters ──
  { name: "sky130_fd_sc_hd__inv_1",    function: "Y = !A",           driveStrength: 1, inputs: ["A"],                outputs: ["Y"], widthInSites: 3 },
  { name: "sky130_fd_sc_hd__inv_2",    function: "Y = !A",           driveStrength: 2, inputs: ["A"],                outputs: ["Y"], widthInSites: 3 },
  { name: "sky130_fd_sc_hd__inv_4",    function: "Y = !A",           driveStrength: 4, inputs: ["A"],                outputs: ["Y"], widthInSites: 5 },
  { name: "sky130_fd_sc_hd__inv_8",    function: "Y = !A",           driveStrength: 8, inputs: ["A"],                outputs: ["Y"], widthInSites: 7 },

  // ── Buffers ──
  { name: "sky130_fd_sc_hd__buf_1",    function: "X = A",            driveStrength: 1, inputs: ["A"],                outputs: ["X"], widthInSites: 3 },
  { name: "sky130_fd_sc_hd__buf_2",    function: "X = A",            driveStrength: 2, inputs: ["A"],                outputs: ["X"], widthInSites: 5 },
  { name: "sky130_fd_sc_hd__buf_4",    function: "X = A",            driveStrength: 4, inputs: ["A"],                outputs: ["X"], widthInSites: 7 },
  { name: "sky130_fd_sc_hd__buf_8",    function: "X = A",            driveStrength: 8, inputs: ["A"],                outputs: ["X"], widthInSites: 11 },
  { name: "sky130_fd_sc_hd__buf_16",   function: "X = A",            driveStrength: 16, inputs: ["A"],               outputs: ["X"], widthInSites: 17 },
  { name: "sky130_fd_sc_hd__clkbuf_1", function: "X = A (clock)",    driveStrength: 1, inputs: ["A"],                outputs: ["X"], widthInSites: 3 },
  { name: "sky130_fd_sc_hd__clkbuf_2", function: "X = A (clock)",    driveStrength: 2, inputs: ["A"],                outputs: ["X"], widthInSites: 5 },
  { name: "sky130_fd_sc_hd__clkbuf_4", function: "X = A (clock)",    driveStrength: 4, inputs: ["A"],                outputs: ["X"], widthInSites: 7 },
  { name: "sky130_fd_sc_hd__clkbuf_8", function: "X = A (clock)",    driveStrength: 8, inputs: ["A"],                outputs: ["X"], widthInSites: 11 },
  { name: "sky130_fd_sc_hd__clkbuf_16",function: "X = A (clock)",    driveStrength: 16, inputs: ["A"],               outputs: ["X"], widthInSites: 17 },

  // ── Clock inverters ──
  { name: "sky130_fd_sc_hd__clkinv_1", function: "Y = !A (clock)",   driveStrength: 1, inputs: ["A"],                outputs: ["Y"], widthInSites: 3 },
  { name: "sky130_fd_sc_hd__clkinv_2", function: "Y = !A (clock)",   driveStrength: 2, inputs: ["A"],                outputs: ["Y"], widthInSites: 3 },
  { name: "sky130_fd_sc_hd__clkinv_4", function: "Y = !A (clock)",   driveStrength: 4, inputs: ["A"],                outputs: ["Y"], widthInSites: 5 },

  // ── NAND gates ──
  { name: "sky130_fd_sc_hd__nand2_1",  function: "Y = !(A&B)",       driveStrength: 1, inputs: ["A", "B"],           outputs: ["Y"], widthInSites: 3 },
  { name: "sky130_fd_sc_hd__nand2_2",  function: "Y = !(A&B)",       driveStrength: 2, inputs: ["A", "B"],           outputs: ["Y"], widthInSites: 5 },
  { name: "sky130_fd_sc_hd__nand2_4",  function: "Y = !(A&B)",       driveStrength: 4, inputs: ["A", "B"],           outputs: ["Y"], widthInSites: 7 },
  { name: "sky130_fd_sc_hd__nand2_8",  function: "Y = !(A&B)",       driveStrength: 8, inputs: ["A", "B"],           outputs: ["Y"], widthInSites: 11 },
  { name: "sky130_fd_sc_hd__nand3_1",  function: "Y = !(A&B&C)",     driveStrength: 1, inputs: ["A", "B", "C"],      outputs: ["Y"], widthInSites: 5 },
  { name: "sky130_fd_sc_hd__nand3_2",  function: "Y = !(A&B&C)",     driveStrength: 2, inputs: ["A", "B", "C"],      outputs: ["Y"], widthInSites: 7 },
  { name: "sky130_fd_sc_hd__nand3_4",  function: "Y = !(A&B&C)",     driveStrength: 4, inputs: ["A", "B", "C"],      outputs: ["Y"], widthInSites: 9 },
  { name: "sky130_fd_sc_hd__nand4_1",  function: "Y = !(A&B&C&D)",   driveStrength: 1, inputs: ["A", "B", "C", "D"], outputs: ["Y"], widthInSites: 5 },
  { name: "sky130_fd_sc_hd__nand4_2",  function: "Y = !(A&B&C&D)",   driveStrength: 2, inputs: ["A", "B", "C", "D"], outputs: ["Y"], widthInSites: 7 },

  // ── NOR gates ──
  { name: "sky130_fd_sc_hd__nor2_1",   function: "Y = !(A|B)",       driveStrength: 1, inputs: ["A", "B"],           outputs: ["Y"], widthInSites: 3 },
  { name: "sky130_fd_sc_hd__nor2_2",   function: "Y = !(A|B)",       driveStrength: 2, inputs: ["A", "B"],           outputs: ["Y"], widthInSites: 5 },
  { name: "sky130_fd_sc_hd__nor2_4",   function: "Y = !(A|B)",       driveStrength: 4, inputs: ["A", "B"],           outputs: ["Y"], widthInSites: 7 },
  { name: "sky130_fd_sc_hd__nor2_8",   function: "Y = !(A|B)",       driveStrength: 8, inputs: ["A", "B"],           outputs: ["Y"], widthInSites: 11 },
  { name: "sky130_fd_sc_hd__nor3_1",   function: "Y = !(A|B|C)",     driveStrength: 1, inputs: ["A", "B", "C"],      outputs: ["Y"], widthInSites: 5 },
  { name: "sky130_fd_sc_hd__nor3_2",   function: "Y = !(A|B|C)",     driveStrength: 2, inputs: ["A", "B", "C"],      outputs: ["Y"], widthInSites: 7 },
  { name: "sky130_fd_sc_hd__nor4_1",   function: "Y = !(A|B|C|D)",   driveStrength: 1, inputs: ["A", "B", "C", "D"], outputs: ["Y"], widthInSites: 5 },

  // ── AND gates ──
  { name: "sky130_fd_sc_hd__and2_1",   function: "X = A&B",          driveStrength: 1, inputs: ["A", "B"],           outputs: ["X"], widthInSites: 3 },
  { name: "sky130_fd_sc_hd__and2_2",   function: "X = A&B",          driveStrength: 2, inputs: ["A", "B"],           outputs: ["X"], widthInSites: 5 },
  { name: "sky130_fd_sc_hd__and2_4",   function: "X = A&B",          driveStrength: 4, inputs: ["A", "B"],           outputs: ["X"], widthInSites: 7 },
  { name: "sky130_fd_sc_hd__and3_1",   function: "X = A&B&C",        driveStrength: 1, inputs: ["A", "B", "C"],      outputs: ["X"], widthInSites: 5 },
  { name: "sky130_fd_sc_hd__and3_2",   function: "X = A&B&C",        driveStrength: 2, inputs: ["A", "B", "C"],      outputs: ["X"], widthInSites: 7 },
  { name: "sky130_fd_sc_hd__and4_1",   function: "X = A&B&C&D",      driveStrength: 1, inputs: ["A", "B", "C", "D"], outputs: ["X"], widthInSites: 5 },

  // ── OR gates ──
  { name: "sky130_fd_sc_hd__or2_1",    function: "X = A|B",          driveStrength: 1, inputs: ["A", "B"],           outputs: ["X"], widthInSites: 3 },
  { name: "sky130_fd_sc_hd__or2_2",    function: "X = A|B",          driveStrength: 2, inputs: ["A", "B"],           outputs: ["X"], widthInSites: 5 },
  { name: "sky130_fd_sc_hd__or3_1",    function: "X = A|B|C",        driveStrength: 1, inputs: ["A", "B", "C"],      outputs: ["X"], widthInSites: 5 },
  { name: "sky130_fd_sc_hd__or4_1",    function: "X = A|B|C|D",      driveStrength: 1, inputs: ["A", "B", "C", "D"], outputs: ["X"], widthInSites: 5 },

  // ── XOR / XNOR ──
  { name: "sky130_fd_sc_hd__xor2_1",   function: "X = A^B",          driveStrength: 1, inputs: ["A", "B"],           outputs: ["X"], widthInSites: 5 },
  { name: "sky130_fd_sc_hd__xor2_2",   function: "X = A^B",          driveStrength: 2, inputs: ["A", "B"],           outputs: ["X"], widthInSites: 7 },
  { name: "sky130_fd_sc_hd__xnor2_1",  function: "Y = !(A^B)",       driveStrength: 1, inputs: ["A", "B"],           outputs: ["Y"], widthInSites: 5 },
  { name: "sky130_fd_sc_hd__xnor2_2",  function: "Y = !(A^B)",       driveStrength: 2, inputs: ["A", "B"],           outputs: ["Y"], widthInSites: 7 },

  // ── Multiplexers ──
  { name: "sky130_fd_sc_hd__mux2_1",   function: "X = S?B:A",        driveStrength: 1, inputs: ["A0", "A1", "S"],    outputs: ["X"], widthInSites: 5 },
  { name: "sky130_fd_sc_hd__mux2_2",   function: "X = S?B:A",        driveStrength: 2, inputs: ["A0", "A1", "S"],    outputs: ["X"], widthInSites: 7 },
  { name: "sky130_fd_sc_hd__mux2_4",   function: "X = S?B:A",        driveStrength: 4, inputs: ["A0", "A1", "S"],    outputs: ["X"], widthInSites: 9 },
  { name: "sky130_fd_sc_hd__mux4_1",   function: "X = mux4(A0-A3,S0,S1)", driveStrength: 1, inputs: ["A0","A1","A2","A3","S0","S1"], outputs: ["X"], widthInSites: 13 },

  // ── AND-OR / OR-AND (AOI/OAI) compound gates ──
  { name: "sky130_fd_sc_hd__a21o_1",   function: "X = (A1&A2)|B1",   driveStrength: 1, inputs: ["A1", "A2", "B1"],  outputs: ["X"], widthInSites: 5 },
  { name: "sky130_fd_sc_hd__a21o_2",   function: "X = (A1&A2)|B1",   driveStrength: 2, inputs: ["A1", "A2", "B1"],  outputs: ["X"], widthInSites: 7 },
  { name: "sky130_fd_sc_hd__a21oi_1",  function: "Y = !((A1&A2)|B1)",driveStrength: 1, inputs: ["A1", "A2", "B1"],  outputs: ["Y"], widthInSites: 5 },
  { name: "sky130_fd_sc_hd__a22o_1",   function: "X = (A1&A2)|(B1&B2)", driveStrength: 1, inputs: ["A1","A2","B1","B2"], outputs: ["X"], widthInSites: 7 },
  { name: "sky130_fd_sc_hd__o21a_1",   function: "X = (A1|A2)&B1",   driveStrength: 1, inputs: ["A1", "A2", "B1"],  outputs: ["X"], widthInSites: 5 },
  { name: "sky130_fd_sc_hd__o21ai_1",  function: "Y = !((A1|A2)&B1)",driveStrength: 1, inputs: ["A1", "A2", "B1"],  outputs: ["Y"], widthInSites: 5 },

  // ── Adders ──
  { name: "sky130_fd_sc_hd__fa_1",     function: "COUT,SUM = A+B+CIN", driveStrength: 1, inputs: ["A", "B", "CIN"], outputs: ["COUT", "SUM"], widthInSites: 13 },
  { name: "sky130_fd_sc_hd__fa_2",     function: "COUT,SUM = A+B+CIN", driveStrength: 2, inputs: ["A", "B", "CIN"], outputs: ["COUT", "SUM"], widthInSites: 17 },
  { name: "sky130_fd_sc_hd__ha_1",     function: "COUT,SUM = A+B",  driveStrength: 1, inputs: ["A", "B"],            outputs: ["COUT", "SUM"], widthInSites: 9 },

  // ── Flip-flops ──
  { name: "sky130_fd_sc_hd__dfxtp_1",  function: "Q ← D @CLK↑",    driveStrength: 1, inputs: ["CLK", "D"],          outputs: ["Q"], widthInSites: 13 },
  { name: "sky130_fd_sc_hd__dfxtp_2",  function: "Q ← D @CLK↑",    driveStrength: 2, inputs: ["CLK", "D"],          outputs: ["Q"], widthInSites: 15 },
  { name: "sky130_fd_sc_hd__dfxtp_4",  function: "Q ← D @CLK↑",    driveStrength: 4, inputs: ["CLK", "D"],          outputs: ["Q"], widthInSites: 17 },
  { name: "sky130_fd_sc_hd__dfrtp_1",  function: "Q ← D @CLK↑, RST_B", driveStrength: 1, inputs: ["CLK", "D", "RESET_B"], outputs: ["Q"], widthInSites: 15 },
  { name: "sky130_fd_sc_hd__dfrtp_2",  function: "Q ← D @CLK↑, RST_B", driveStrength: 2, inputs: ["CLK", "D", "RESET_B"], outputs: ["Q"], widthInSites: 17 },
  { name: "sky130_fd_sc_hd__dfstp_1",  function: "Q ← D @CLK↑, SET_B", driveStrength: 1, inputs: ["CLK", "D", "SET_B"],   outputs: ["Q"], widthInSites: 15 },
  { name: "sky130_fd_sc_hd__dfsbp_1",  function: "Q,Q_N ← D @CLK↑, SET_B", driveStrength: 1, inputs: ["CLK", "D", "SET_B"], outputs: ["Q", "Q_N"], widthInSites: 17 },

  // ── Latches ──
  { name: "sky130_fd_sc_hd__dlxtp_1",  function: "Q ← D @GATE",    driveStrength: 1, inputs: ["GATE", "D"],         outputs: ["Q"], widthInSites: 9 },
  { name: "sky130_fd_sc_hd__dlrtp_1",  function: "Q ← D @GATE, RST_B", driveStrength: 1, inputs: ["GATE", "D", "RESET_B"], outputs: ["Q"], widthInSites: 11 },

  // ── Tri-state / level shifters ──
  { name: "sky130_fd_sc_hd__ebufn_1",  function: "Z = TE_B?A:Hi-Z", driveStrength: 1, inputs: ["A", "TE_B"],        outputs: ["Z"], widthInSites: 5 },
  { name: "sky130_fd_sc_hd__ebufn_2",  function: "Z = TE_B?A:Hi-Z", driveStrength: 2, inputs: ["A", "TE_B"],        outputs: ["Z"], widthInSites: 7 },
  { name: "sky130_fd_sc_hd__einvn_1",  function: "Z = TE_B?!A:Hi-Z",driveStrength: 1, inputs: ["A", "TE_B"],        outputs: ["Z"], widthInSites: 5 },

  // ── Special cells ──
  { name: "sky130_fd_sc_hd__conb_1",  function: "HI=1, LO=0",       driveStrength: 0, inputs: [],                   outputs: ["HI", "LO"], widthInSites: 3 },
  { name: "sky130_fd_sc_hd__dlymetal6s2s_1", function: "X = A (delay)", driveStrength: 1, inputs: ["A"],             outputs: ["X"], widthInSites: 7 },
  { name: "sky130_fd_sc_hd__diode_2", function: "antenna diode",     driveStrength: 0, inputs: ["DIODE"],            outputs: [], widthInSites: 3 },

  // ── Filler / Tap / Decap ──
  { name: "sky130_fd_sc_hd__fill_1",   function: "filler",          driveStrength: 0, inputs: [],                    outputs: [], widthInSites: 1 },
  { name: "sky130_fd_sc_hd__fill_2",   function: "filler",          driveStrength: 0, inputs: [],                    outputs: [], widthInSites: 2 },
  { name: "sky130_fd_sc_hd__fill_4",   function: "filler",          driveStrength: 0, inputs: [],                    outputs: [], widthInSites: 4 },
  { name: "sky130_fd_sc_hd__fill_8",   function: "filler",          driveStrength: 0, inputs: [],                    outputs: [], widthInSites: 8 },
  { name: "sky130_fd_sc_hd__decap_4",  function: "decap",           driveStrength: 0, inputs: [],                    outputs: [], widthInSites: 4 },
  { name: "sky130_fd_sc_hd__decap_8",  function: "decap",           driveStrength: 0, inputs: [],                    outputs: [], widthInSites: 8 },
  { name: "sky130_fd_sc_hd__decap_12", function: "decap",           driveStrength: 0, inputs: [],                    outputs: [], widthInSites: 12 },
  { name: "sky130_fd_sc_hd__tapvpwrvgnd_1", function: "well tap",   driveStrength: 0, inputs: [],                    outputs: [], widthInSites: 1 },
];
