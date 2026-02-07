/**
 * Analog/Mixed-Signal Calculators Engine — Sprint 21-22
 *
 * Built-in calculators for VLSI design:
 * 1. Wire R/C Calculator — resistance and capacitance from geometry + PDK
 * 2. EM Calculator — electromigration current density limits
 * 3. Matching Estimator — Pelgrom model for device mismatch
 * 4. gm/Id Sizer — MOSFET operating-point sizing methodology
 * 5. MOSFET Parameter Viewer — interactive IV / gm / gds curves
 */

// ══════════════════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════════════════

export interface WireRCParams {
  /** Wire length (µm) */
  length: number;
  /** Wire width (µm) */
  width: number;
  /** Sheet resistance (Ω/□) */
  rSheet: number;
  /** Capacitance per unit area (fF/µm²) */
  cPerArea: number;
  /** Fringe capacitance per unit length (fF/µm) */
  cFringe: number;
  /** Number of via connections */
  viaCount: number;
  /** Resistance per via (Ω) */
  rVia: number;
}

export interface WireRCResult {
  /** Total wire resistance (Ω) */
  resistance: number;
  /** Total wire capacitance (fF) */
  capacitance: number;
  /** RC time constant (ps) */
  rcDelay: number;
  /** Elmore delay estimate (ps) */
  elmoreDelay: number;
  /** Total via resistance (Ω) */
  viaResistance: number;
  /** Breakdown */
  breakdown: {
    rWire: number;
    cArea: number;
    cFringe: number;
    cTotal: number;
  };
}

export interface EMParams {
  /** Wire width (µm) */
  width: number;
  /** Wire thickness (µm) */
  thickness: number;
  /** Current through wire (mA) */
  current: number;
  /** Maximum allowed current density (mA/µm²) */
  jMax: number;
  /** Temperature (°C) */
  temperature: number;
  /** DC or AC signal */
  signalType: "dc" | "ac";
  /** Duty cycle for AC (0-1) */
  dutyCycle: number;
}

export interface EMResult {
  /** Cross-sectional area (µm²) */
  crossSection: number;
  /** Current density (mA/µm²) */
  currentDensity: number;
  /** Maximum allowed current (mA) */
  maxCurrent: number;
  /** Whether EM limit is violated */
  violation: boolean;
  /** Margin (%) — how much headroom or overshoot */
  margin: number;
  /** Effective jMax after AC/temp derating */
  effectiveJMax: number;
  /** Minimum wire width for given current (µm) */
  minWidth: number;
}

export interface MatchingParams {
  /** Pelgrom coefficient Avt (mV·µm) — threshold voltage matching */
  avt: number;
  /** Pelgrom coefficient Aβ (%·µm) — current factor matching */
  aBeta: number;
  /** Device width (µm) */
  width: number;
  /** Device length (µm) */
  length: number;
  /** Number of parallel devices */
  multiplier: number;
  /** Distance between devices (µm) — for gradient term */
  distance: number;
  /** Gradient coefficient (mV/µm) */
  gradientCoeff: number;
}

export interface MatchingResult {
  /** σ(ΔVt) — threshold voltage mismatch std dev (mV) */
  sigmaVt: number;
  /** σ(Δβ/β) — current factor mismatch std dev (%) */
  sigmaBeta: number;
  /** 3σ(ΔVt) (mV) */
  threeSignaVt: number;
  /** 3σ(Δβ/β) (%) */
  threeSigmaBeta: number;
  /** Gradient-induced offset (mV) */
  gradientOffset: number;
  /** Effective area (WL) (µm²) */
  effectiveArea: number;
  /** Total mismatch including gradient (mV) */
  totalVtMismatch: number;
}

export interface GmIdParams {
  /** Target gm/Id ratio (1/V) — typically 5-25 */
  gmOverId: number;
  /** Required transconductance gm (µS) */
  targetGm: number;
  /** Drain current budget (µA) */
  currentBudget: number;
  /** Technology gate oxide capacitance Cox (fF/µm²) */
  cox: number;
  /** Mobility µ (cm²/V·s) */
  mobility: number;
  /** Threshold voltage Vth (V) */
  vth: number;
  /** Supply voltage Vdd (V) */
  vdd: number;
  /** Device type */
  deviceType: "nmos" | "pmos";
  /** Minimum channel length (µm) */
  lMin: number;
}

export interface GmIdResult {
  /** Operating region */
  region: "weak-inversion" | "moderate-inversion" | "strong-inversion";
  /** Required drain current Id (µA) */
  drainCurrent: number;
  /** Overdrive voltage Vov = Vgs - Vth (V) */
  vov: number;
  /** Estimated Vgs (V) */
  vgs: number;
  /** Required W/L ratio */
  wOverL: number;
  /** Suggested width W (µm) at L = Lmin */
  width: number;
  /** Suggested length L (µm) */
  length: number;
  /** Transit frequency fT estimate (GHz) */
  fT: number;
  /** Output resistance ro estimate (kΩ) */
  ro: number;
  /** Intrinsic gain gm·ro */
  intrinsicGain: number;
  /** Power consumption (µW) with Vdd */
  power: number;
}

export interface MosfetViewerParams {
  /** Gate oxide capacitance Cox (fF/µm²) */
  cox: number;
  /** Mobility µ (cm²/V·s) */
  mobility: number;
  /** Threshold voltage Vth (V) */
  vth: number;
  /** Width W (µm) */
  width: number;
  /** Length L (µm) */
  length: number;
  /** Channel length modulation λ (1/V) */
  lambda: number;
  /** Subthreshold slope factor n */
  subthresholdN: number;
  /** Thermal voltage Vt (mV) — default 26mV at room temp */
  thermalVoltage: number;
}

export interface MosfetCurvePoint {
  vgs: number;
  vds: number;
  id: number;
  gm: number;
  gds: number;
  gmOverId: number;
}

// ══════════════════════════════════════════════════════════════════════
// Wire R/C Calculator
// ══════════════════════════════════════════════════════════════════════

export function calculateWireRC(params: WireRCParams): WireRCResult {
  const { length, width, rSheet, cPerArea, cFringe, viaCount, rVia } = params;

  const squares = length / width;
  const rWire = rSheet * squares;
  const cArea = cPerArea * length * width; // fF
  const cFringeTotal = cFringe * 2 * length; // fF (both sides)
  const cTotal = cArea + cFringeTotal;
  const viaResistance = viaCount * rVia;
  const totalR = rWire + viaResistance;

  // RC delay (distributed wire)
  const rcDelay = 0.5 * rWire * cTotal + viaResistance * cTotal; // in Ω·fF = ps
  const elmoreDelay = 0.377 * rWire * cTotal + viaResistance * cTotal;

  return {
    resistance: totalR,
    capacitance: cTotal,
    rcDelay,
    elmoreDelay,
    viaResistance,
    breakdown: {
      rWire,
      cArea,
      cFringe: cFringeTotal,
      cTotal,
    },
  };
}

// ══════════════════════════════════════════════════════════════════════
// EM Calculator
// ══════════════════════════════════════════════════════════════════════

export function calculateEM(params: EMParams): EMResult {
  const { width, thickness, current, jMax, temperature, signalType, dutyCycle } = params;

  const crossSection = width * thickness;

  // Temperature derating: jMax reduces ~50% per 30°C above 105°C
  let tempFactor = 1.0;
  if (temperature > 105) {
    tempFactor = Math.pow(0.5, (temperature - 105) / 30);
  }

  // AC signals can tolerate higher current density
  const acFactor = signalType === "ac" ? 1.0 / Math.max(dutyCycle, 0.01) : 1.0;
  const effectiveJMax = jMax * tempFactor * Math.min(acFactor, 10); // cap at 10x

  const currentDensity = current / crossSection;
  const maxCurrent = effectiveJMax * crossSection;
  const violation = currentDensity > effectiveJMax;
  const margin = ((maxCurrent - current) / maxCurrent) * 100;
  const minWidth = current / (effectiveJMax * thickness);

  return {
    crossSection,
    currentDensity,
    maxCurrent,
    violation,
    margin,
    effectiveJMax,
    minWidth,
  };
}

// ══════════════════════════════════════════════════════════════════════
// Matching Estimator (Pelgrom Model)
// ══════════════════════════════════════════════════════════════════════

export function calculateMatching(params: MatchingParams): MatchingResult {
  const { avt, aBeta, width, length, multiplier, distance, gradientCoeff } = params;

  const area = width * length;
  const effectiveArea = area * multiplier;

  // Pelgrom: σ(ΔVt) = Avt / √(WL)  (with multiplier: / √(M·WL))
  const sigmaVt = avt / Math.sqrt(effectiveArea);

  // σ(Δβ/β) = Aβ / √(WL)
  const sigmaBeta = aBeta / Math.sqrt(effectiveArea);

  const threeSignaVt = 3 * sigmaVt;
  const threeSigmaBeta = 3 * sigmaBeta;

  // Gradient-induced systematic offset
  const gradientOffset = gradientCoeff * distance;

  // Total mismatch (RSS of random + systematic)
  const totalVtMismatch = Math.sqrt(threeSignaVt * threeSignaVt + gradientOffset * gradientOffset);

  return {
    sigmaVt,
    sigmaBeta,
    threeSignaVt,
    threeSigmaBeta,
    gradientOffset,
    effectiveArea,
    totalVtMismatch,
  };
}

// ══════════════════════════════════════════════════════════════════════
// gm/Id Sizer
// ══════════════════════════════════════════════════════════════════════

export function calculateGmId(params: GmIdParams): GmIdResult {
  const {
    gmOverId, targetGm, cox, mobility,
    vth, vdd, lMin,
  } = params;

  // Id = gm / (gm/Id)
  const drainCurrent = (targetGm * 1e-6) / gmOverId; // in A, then convert
  const idUA = drainCurrent * 1e6; // µA

  // Determine operating region from gm/Id
  let region: GmIdResult["region"];
  if (gmOverId > 20) {
    region = "weak-inversion";
  } else if (gmOverId > 10) {
    region = "moderate-inversion";
  } else {
    region = "strong-inversion";
  }

  // In strong inversion: gm/Id ≈ 2/(Vgs-Vth), so Vov ≈ 2/(gm/Id)
  // In weak inversion: gm/Id ≈ 1/(n·Vt) ≈ 38 V^-1 at room temp
  let vov: number;
  if (region === "strong-inversion") {
    vov = 2 / gmOverId;
  } else if (region === "moderate-inversion") {
    vov = 2 / gmOverId; // approximate
  } else {
    vov = 0.026 * Math.log(gmOverId / 38 + 1); // weak inversion approximation
  }

  const vgs = Math.abs(vth) + vov;

  // W/L = 2·Id / (µ·Cox·Vov²) for strong inversion
  const coxSI = cox * 1e-3; // fF/µm² → F/m² approximately (scale factor)
  // µ in m²/Vs for SI calculations
  void mobility; // used below in wOverL calculation via coxSI

  // Simplified: W/L = gm / (µ·Cox·Vov) for strong inversion
  // For all regions: W/L = Id / (0.5·µ·Cox·(Vov²)·(1/L)) → W = Id·L / (0.5·µ·Cox·Vov²)
  let wOverL: number;
  if (region === "strong-inversion") {
    wOverL = (2 * idUA) / (mobility * coxSI * vov * vov * 1e6);
    if (!isFinite(wOverL) || wOverL <= 0) wOverL = 1;
  } else {
    // Moderate/weak: use empirical relation
    wOverL = (targetGm * 1e-6) / (mobility * 1e-4 * cox * 1e-15 * vov * 1e12);
    if (!isFinite(wOverL) || wOverL <= 0) wOverL = (idUA / 10) * (lMin / 0.13);
  }

  const length = lMin;
  const width = wOverL * length;

  // fT ≈ gm / (2π·Cgs) ≈ gm / (2π·2/3·Cox·W·L)
  const cgs = (2 / 3) * cox * width * length; // fF
  const fT = cgs > 0 ? (targetGm * 1e-6) / (2 * Math.PI * cgs * 1e-15) / 1e9 : 0; // GHz

  // ro ≈ 1/(λ·Id)
  const lambda = 0.1 / length; // rough estimate
  const ro = 1 / (lambda * idUA * 1e-6) / 1e3; // kΩ

  // Intrinsic gain
  const intrinsicGain = (targetGm * 1e-6) * (ro * 1e3);

  const power = idUA * vdd; // µW

  return {
    region,
    drainCurrent: idUA,
    vov,
    vgs,
    wOverL: Math.max(wOverL, 0.1),
    width: Math.max(width, lMin),
    length,
    fT: Math.max(fT, 0),
    ro: Math.max(ro, 0),
    intrinsicGain: Math.max(intrinsicGain, 0),
    power,
  };
}

// ══════════════════════════════════════════════════════════════════════
// MOSFET Parameter Viewer — curve generation
// ══════════════════════════════════════════════════════════════════════

/**
 * Generate MOSFET I-V curves (Id vs Vds) for multiple Vgs values.
 * Uses simple long-channel MOSFET model with subthreshold.
 */
export function generateMosfetCurves(
  params: MosfetViewerParams,
  vgsValues: number[],
  vdsMax: number,
  numPoints: number,
): MosfetCurvePoint[] {
  const { cox, mobility, vth, width, length, lambda, subthresholdN, thermalVoltage } = params;

  const vt = thermalVoltage / 1000; // mV → V
  const kp = mobility * 1e-4 * cox * 1e-15 * 1e12; // transconductance parameter
  const kn = kp * (width / length);

  const points: MosfetCurvePoint[] = [];

  for (const vgs of vgsValues) {
    for (let i = 0; i <= numPoints; i++) {
      const vds = (i / numPoints) * vdsMax;
      const vov = vgs - vth;
      let id: number;
      let gm: number;
      let gds: number;

      if (vov <= -3 * subthresholdN * vt) {
        // Cutoff
        id = 0;
        gm = 0;
        gds = 0;
      } else if (vov < 0) {
        // Subthreshold: Id = Is * exp((Vgs - Vth) / (n * Vt))
        const is0 = kn * (subthresholdN - 1) * vt * vt;
        id = is0 * Math.exp(vov / (subthresholdN * vt)) * (1 - Math.exp(-vds / vt));
        gm = id / (subthresholdN * vt);
        gds = is0 * Math.exp(vov / (subthresholdN * vt)) * Math.exp(-vds / vt) / vt;
      } else if (vds < vov) {
        // Linear region: Id = kn * ((Vov * Vds) - Vds²/2) * (1 + λ·Vds)
        id = kn * (vov * vds - vds * vds / 2) * (1 + lambda * vds);
        gm = kn * vds * (1 + lambda * vds);
        gds = kn * (vov - vds) * (1 + lambda * vds) + kn * (vov * vds - vds * vds / 2) * lambda;
      } else {
        // Saturation: Id = 0.5 * kn * Vov² * (1 + λ·Vds)
        id = 0.5 * kn * vov * vov * (1 + lambda * vds);
        gm = kn * vov * (1 + lambda * vds);
        gds = 0.5 * kn * vov * vov * lambda;
      }

      const gmOverId = id > 1e-15 ? gm / id : 0;

      points.push({ vgs, vds, id: id * 1e6, gm: gm * 1e6, gds: gds * 1e6, gmOverId }); // id in µA, gm in µS
    }
  }

  return points;
}

/**
 * Generate gm/Id vs Id curve for MOSFET sizing.
 */
export function generateGmIdCurve(
  params: MosfetViewerParams,
  vdsFixed: number,
  vgsMin: number,
  vgsMax: number,
  numPoints: number,
): { vgs: number; id: number; gm: number; gmOverId: number }[] {
  const results: { vgs: number; id: number; gm: number; gmOverId: number }[] = [];

  for (let i = 0; i <= numPoints; i++) {
    const vgs = vgsMin + (i / numPoints) * (vgsMax - vgsMin);
    const curve = generateMosfetCurves(params, [vgs], vdsFixed, 1);
    const pt = curve[curve.length - 1]; // take the point at vds = vdsFixed
    if (pt) {
      results.push({
        vgs,
        id: pt.id,
        gm: pt.gm,
        gmOverId: pt.gmOverId,
      });
    }
  }

  return results;
}
