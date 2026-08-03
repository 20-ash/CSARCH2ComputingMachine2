// lib/floatApi.ts
//
// ============================================================================
// BACKEND INTEGRATION SEAM
// ============================================================================
// Right now these functions compute the answer locally (see lib/ieee754.ts).
// When the backend is ready, replace the two function
// bodies below with real requests

import { toFloat32Breakdown, type Float32Breakdown, type RoundingMode, type SpecialCase, bitsToFloat32 } from "./ieee754";
import { ieeeAdd, ieeeMul, convert } from "@/backend";

export interface DecimalToBinaryRequest {
  decimal: number;
}
export type DecimalToBinaryResponse = Float32Breakdown;

export interface RoundRequest {
  decimal: number;
  mode: RoundingMode;
}
export type RoundResponse = Float32Breakdown;

export interface RoundCompareRequest {
  decimal: number;
}
export interface RoundCompareResponse {
  results: Record<RoundingMode, Float32Breakdown>;
}

// Simulated network latency so loading states behave the same way they will
// once this is a real request. Remove once real fetch() calls are wired in.
function simulateLatency(ms = 150) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function convertToBreakdown(input: number, conv: ReturnType<typeof convert>): Float32Breakdown {
  const fullBinary = conv.binary.replaceAll(" ", "");
  const sign = fullBinary[0] === "1" ? 1 : 0;
  const exponentBits = fullBinary.slice(1, 9);
  const mantissaBits = fullBinary.slice(9);

  const exponentBiased = parseInt(exponentBits, 2);

  let specialCase: SpecialCase = null;
  if (exponentBits === "11111111") specialCase = "overflow";
  else if (exponentBits === "00000000" && mantissaBits.includes("1")) specialCase = "underflow";
  else if (exponentBits === "00000000") specialCase = "zero";
  
  const expMatch = /X 2\^(-?\d+)$/.exec(conv.normalized); 
  const exponentUnbiased = expMatch ? Number(expMatch[1]) : exponentBiased - 127;

  const storedValue = bitsToFloat32(fullBinary);

  return {                                                 
    input,
    mode: "nearest-even",
    sign,
    exponentUnbiased,
    exponentBiased,
    exponentBits,
    mantissaBits,
    sourceSignificand: "1" + mantissaBits + "0".repeat(29), 
    roundBit: "0",
    stickyBits: "",
    stickyAny: false,
    roundedUp: false,
    mantissaCarried: false,
    fullBinary,
    hex: "0x" + conv.hex,
    storedValue,
    specialCase,
  };
}

export async function decimalToBinary(
  req: DecimalToBinaryRequest
): Promise<DecimalToBinaryResponse> {
  if (!Number.isFinite(req.decimal)) {
    throw new Error("Enter a finite decimal number.");
  }
  const conv = await convert(req.decimal);  
  return convertToBreakdown(req.decimal, conv);
}

export async function roundFloat(req: RoundRequest): Promise<RoundResponse> {
  await simulateLatency();
  if (!Number.isFinite(req.decimal)) {
    throw new Error("Enter a finite decimal number.");
  }
  return toFloat32Breakdown(req.decimal, req.mode);
}

/** Convenience for the rounding page's side-by-side mode comparison table. */
export async function roundFloatCompare(
  req: RoundCompareRequest
): Promise<RoundCompareResponse> {
  await simulateLatency();
  if (!Number.isFinite(req.decimal)) {
    throw new Error("Enter a finite decimal number.");
  }
  const modes: RoundingMode[] = [
    "nearest-even",
    "toward-zero",
    "toward-positive",
    "toward-negative",
  ];
  const results = Object.fromEntries(
    modes.map((m) => [m, toFloat32Breakdown(req.decimal, m)])
  ) as Record<RoundingMode, Float32Breakdown>;
  return { results };
}

// ============================================================================
// ARITHMETIC — backed directly by backend.ts (ieeeAdd / ieeeMul), not by
// lib/ieee754.ts. This is the only operation currently wired to the real
// backend implementation.
// ============================================================================

export type ArithmeticOperation = "add" | "multiply";

export interface ArithmeticRequest {
  a: number;
  b: number;
  operation: ArithmeticOperation;
}

/**
 * Mirrors whatever ieeeAdd/ieeeMul actually return, rather than a hand-written
 * shape — so this type can't silently drift from the backend's real output.
 * The two functions don't return identical shapes (special cases like NaN
 * short-circuit with fewer fields), hence the union.
 */
export type ArithmeticResponse = ReturnType<typeof ieeeAdd> | ReturnType<typeof ieeeMul>;

export async function computeArithmetic(req: ArithmeticRequest): Promise<ArithmeticResponse> {
  await simulateLatency();
  // Unlike decimalToBinary/roundFloat, NaN and +/-Infinity are valid, intentional
  // inputs here — ieeeAdd/ieeeMul both special-case them internally. Rejecting
  // unparseable text (not NaN/Infinity) is handled by the page before this is called.
  return req.operation === "add" ? ieeeAdd(req.a, req.b) : ieeeMul(req.a, req.b);
}