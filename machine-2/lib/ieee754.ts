// lib/ieee754.ts
// this is the part a numerics-heavy backend could eventually
// replace or verify against, so it is kept isolated from the UI and from
// lib/floatApi.ts (the swappable integration seam).

export type RoundingMode =
  | "nearest-even"
  | "toward-zero"
  | "toward-positive"
  | "toward-negative";

export const ROUNDING_MODES: { id: RoundingMode; label: string; short: string }[] = [
  { id: "nearest-even", label: "Round to Nearest, Ties to Even", short: "RNE" },
  { id: "toward-zero", label: "Round Toward Zero (Truncate)", short: "RTZ" },
  { id: "toward-positive", label: "Round Toward +Infinity", short: "RTP" },
  { id: "toward-negative", label: "Round Toward -Infinity", short: "RTN" },
];

export type SpecialCase = "zero" | "overflow" | "underflow" | null;

export interface Float32Breakdown {
  input: number;
  mode: RoundingMode;

  sign: 0 | 1;

  /** Real (unbiased) power-of-two exponent, e.g. 5.75 = 1.0111 x 2^2 -> 2 */
  exponentUnbiased: number;
  /** 8-bit biased exponent stored in the word (exponentUnbiased + 127) */
  exponentBiased: number;
  exponentBits: string; // 8 chars

  /** The 23 mantissa bits actually stored, after rounding */
  mantissaBits: string; // 23 chars
  /** The 53-bit double-precision significand this was derived from ("1" + 52 bits) */
  sourceSignificand: string;

  /** The bit immediately after the 23 kept mantissa bits */
  roundBit: "0" | "1";
  /** Every bit after the round bit, OR'd together conceptually */
  stickyBits: string;
  stickyAny: boolean;
  /** Whether the rounding step actually incremented the mantissa */
  roundedUp: boolean;
  /** True if rounding up overflowed 23 ones into a mantissa-carry (exponent bumped) */
  mantissaCarried: boolean;

  fullBinary: string; // 32 chars, sign+exponent+mantissa
  hex: string; // 0x-prefixed, 8 hex digits

  /** The actual float32 value once the bit pattern above is decoded back */
  storedValue: number;

  specialCase: SpecialCase;
}

function getFloat64Parts(absValue: number) {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setFloat64(0, absValue);
  const hi = view.getUint32(0);
  const lo = view.getUint32(4);
  const exponentBiased = (hi >>> 20) & 0x7ff;
  const mantissaHigh = hi & 0xfffff; // top 20 bits of the 52-bit mantissa
  const mantissaBits =
    mantissaHigh.toString(2).padStart(20, "0") + lo.toString(2).padStart(32, "0");
  return { exponentBiased, mantissaBits };
}

function bitsToFloat32(bits: string): number {
  const intVal = parseInt(bits, 2) >>> 0;
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setUint32(0, intVal);
  return view.getFloat32(0);
}

function toHex(bits: string): string {
  const intVal = parseInt(bits, 2) >>> 0;
  return "0x" + intVal.toString(16).padStart(8, "0").toUpperCase();
}

/**
 * Converts a JS number into its IEEE-754 single-precision (float32)
 * representation, applying the given rounding mode explicitly (rather than
 * relying on JS's built-in Float32Array cast, which only does
 * round-to-nearest-even). Subnormal float32 results are simplified to zero
 * with specialCase "underflow" — real subnormal encoding is out of scope
 * for this teaching tool.
 */
export function toFloat32Breakdown(
  input: number,
  mode: RoundingMode = "nearest-even"
): Float32Breakdown {
  const sign: 0 | 1 = input < 0 || Object.is(input, -0) ? 1 : 0;

  if (input === 0) {
    const fullBinary = `${sign}${"0".repeat(8)}${"0".repeat(23)}`;
    return {
      input,
      mode,
      sign,
      exponentUnbiased: 0,
      exponentBiased: 0,
      exponentBits: "0".repeat(8),
      mantissaBits: "0".repeat(23),
      sourceSignificand: "1" + "0".repeat(52),
      roundBit: "0",
      stickyBits: "",
      stickyAny: false,
      roundedUp: false,
      mantissaCarried: false,
      fullBinary,
      hex: toHex(fullBinary),
      storedValue: sign ? -0 : 0,
      specialCase: "zero",
    };
  }

  const abs = Math.abs(input);
  const { exponentBiased: dBiased, mantissaBits: dMantissa } = getFloat64Parts(abs);
  const exponentUnbiased = dBiased - 1023;
  const sourceSignificand = "1" + dMantissa; // 53 bits, exact for this double

  // Out of float32 normal range: simplified handling.
  if (exponentUnbiased > 127) {
    const fullBinary = `${sign}${"1".repeat(8)}${"0".repeat(23)}`;
    return {
      input,
      mode,
      sign,
      exponentUnbiased,
      exponentBiased: 255,
      exponentBits: "1".repeat(8),
      mantissaBits: "0".repeat(23),
      sourceSignificand,
      roundBit: "0",
      stickyBits: "",
      stickyAny: false,
      roundedUp: false,
      mantissaCarried: false,
      fullBinary,
      hex: toHex(fullBinary),
      storedValue: sign ? -Infinity : Infinity,
      specialCase: "overflow",
    };
  }
  if (exponentUnbiased < -126) {
    const fullBinary = `${sign}${"0".repeat(8)}${"0".repeat(23)}`;
    return {
      input,
      mode,
      sign,
      exponentUnbiased,
      exponentBiased: 0,
      exponentBits: "0".repeat(8),
      mantissaBits: "0".repeat(23),
      sourceSignificand,
      roundBit: "0",
      stickyBits: "",
      stickyAny: false,
      roundedUp: false,
      mantissaCarried: false,
      fullBinary,
      hex: toHex(fullBinary),
      storedValue: sign ? -0 : 0,
      specialCase: "underflow",
    };
  }

  // Normal range: keep 23 mantissa bits, look at the rest to decide rounding.
  const mantissaKept = sourceSignificand.slice(1, 24); // 23 bits
  const roundBit = (sourceSignificand[24] ?? "0") as "0" | "1";
  const stickyBits = sourceSignificand.slice(25);
  const stickyAny = stickyBits.includes("1");

  let roundUp = false;
  switch (mode) {
    case "nearest-even":
      if (roundBit === "1") {
        roundUp = stickyAny ? true : mantissaKept[22] === "1";
      }
      break;
    case "toward-zero":
      roundUp = false;
      break;
    case "toward-positive":
      roundUp = sign === 0 && (roundBit === "1" || stickyAny);
      break;
    case "toward-negative":
      roundUp = sign === 1 && (roundBit === "1" || stickyAny);
      break;
  }

  let mantissaInt = parseInt(mantissaKept, 2);
  let exponentFinal = exponentUnbiased;
  let mantissaCarried = false;
  if (roundUp) {
    mantissaInt += 1;
    if (mantissaInt === 1 << 23) {
      mantissaInt = 0;
      exponentFinal += 1;
      mantissaCarried = true;
    }
  }

  // Rounding pushed us past float32's max exponent -> overflow to infinity.
  if (exponentFinal > 127) {
    const fullBinary = `${sign}${"1".repeat(8)}${"0".repeat(23)}`;
    return {
      input,
      mode,
      sign,
      exponentUnbiased,
      exponentBiased: 255,
      exponentBits: "1".repeat(8),
      mantissaBits: "0".repeat(23),
      sourceSignificand,
      roundBit,
      stickyBits,
      stickyAny,
      roundedUp: roundUp,
      mantissaCarried,
      fullBinary,
      hex: toHex(fullBinary),
      storedValue: sign ? -Infinity : Infinity,
      specialCase: "overflow",
    };
  }

  const mantissaFinalBits = mantissaInt.toString(2).padStart(23, "0");
  const exponentBiasedFinal = exponentFinal + 127;
  const exponentBits = exponentBiasedFinal.toString(2).padStart(8, "0");
  const fullBinary = `${sign}${exponentBits}${mantissaFinalBits}`;

  return {
    input,
    mode,
    sign,
    exponentUnbiased: exponentFinal,
    exponentBiased: exponentBiasedFinal,
    exponentBits,
    mantissaBits: mantissaFinalBits,
    sourceSignificand,
    roundBit,
    stickyBits,
    stickyAny,
    roundedUp: roundUp,
    mantissaCarried,
    fullBinary,
    hex: toHex(fullBinary),
    storedValue: bitsToFloat32(fullBinary),
    specialCase: null,
  };
}