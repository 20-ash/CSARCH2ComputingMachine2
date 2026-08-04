"use client";

import React, { useEffect, useState } from "react";
import PageShell from "@/components/PageShell";
import BitField from "@/components/BitField";
import { roundFloatCompare, computeCustomRounding, type RoundCompareResponse } from "@/lib/floatApi";
import { ROUNDING_MODES, toFloat32Breakdown, type Float32Breakdown, type RoundingMode } from "@/lib/ieee754";

/* ---------- input format handling ---------- */

type InputFormat = "decimal" | "binary" | "ieee";
type SignedMode = "signed" | "unsigned";

// Maximum representable finite value in IEEE-754 single precision
const FLOAT32_MAX = 3.4028234663852886e38;

const INPUT_FORMATS: {
  id: InputFormat;
  label: string;
  placeholder: string;
  helper: string;
  default: string;
}[] = [
  {
    id: "decimal",
    label: "Decimal",
    placeholder: "e.g. 0.1 or 1.5e-3",
    helper: "A base-10 number, e.g. 0.1, -13.25, or scientific notation (1.2e-4)",
    default: "0.1",
  },
  {
    id: "binary",
    label: "Binary",
    placeholder: "e.g. 1010.101 or 1.01p3",
    helper: "A base-2 fraction, e.g. 0.00011 or base-2 exponent notation (1.01p3)",
    default: "0.0001100110011",
  },
  {
    id: "ieee",
    label: "IEEE-754 bits",
    placeholder: "e.g. 3DCCCCCD or 0 01111011 10011001100110011010",
    helper: "8 hex digits, or the 32 raw sign/exponent/mantissa bits",
    default: "3DCCCCCD",
  },
];

/** Parses a fixed-point binary string ("-101.011") into a decimal number. */
function parseBinaryToDecimal(raw: string): number {
  const str = raw.trim();
  if (str === "") throw new Error("Enter a binary value.");

  const match = /^([+-]?)((?:[01]+)?)(?:\.([01]*))?$/.exec(str);
  if (!match || (match[2] === "" && (match[3] ?? "") === "")) {
    throw new Error("Binary input can only contain 0, 1, and one decimal point (e.g. -101.011).");
  }

  const [, signPart, intPart, fracPart = ""] = match;
  const sign = signPart === "-" ? -1 : 1;

  let value = 0;
  for (const digit of intPart) {
    value = value * 2 + (digit === "1" ? 1 : 0);
  }

  let scale = 0.5;
  for (const digit of fracPart) {
    if (digit === "1") value += scale;
    scale /= 2;
  }

  return sign * value;
}

/** Parses either 32 raw IEEE-754 bits or 8 hex digits into the decimal value they encode. */
function parseIeeeToDecimal(raw: string): number {
  const cleaned = raw.trim().replace(/^0x/i, "").replace(/\s+/g, "");
  if (cleaned === "") throw new Error("Enter an IEEE-754 bit pattern.");

  let uint32: number;
  if (/^[01]{32}$/.test(cleaned)) {
    uint32 = parseInt(cleaned, 2) >>> 0;
  } else if (/^[0-9a-fA-F]{8}$/.test(cleaned)) {
    uint32 = parseInt(cleaned, 16) >>> 0;
  } else {
    throw new Error("IEEE-754 input needs exactly 32 bits (0/1) or 8 hex digits.");
  }

  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setUint32(0, uint32, false);
  return view.getFloat32(0, false);
}

/** Converts decimal scientific notation ("1.23e-4") into an expanded fixed-point string ("0.000123") */
function expandDecimalScientific(str: string): string {
  const trimmed = str.trim();
  if (!/[eE]/.test(trimmed)) 
    return trimmed;

  const num = Number(trimmed);
  if (Number.isNaN(num)) 
    return trimmed;

  // Convert to fixed decimal representation with high precision
  // Prevents JS from outputting scientific notation for small/large values
  const [mantissa, expStr] = trimmed.split(/[eE]/);
  const exp = parseInt(expStr, 10);

  let [intPart, fracPart = ""] = mantissa.split(".");
  const isNeg = intPart.startsWith("-");
  if (isNeg) intPart = intPart.slice(1);

  if (exp >= 0) {
    if (exp >= fracPart.length) {
      intPart += fracPart + "0".repeat(exp - fracPart.length);
      fracPart = "";
    } else {
      intPart += fracPart.slice(0, exp);
      fracPart = fracPart.slice(exp);
    }
  } else {
    const shift = Math.abs(exp);
    if (shift >= intPart.length) {
      fracPart = "0".repeat(shift - intPart.length) + intPart + fracPart;
      intPart = "0";
    } else {
      fracPart = intPart.slice(intPart.length - shift) + fracPart;
      intPart = intPart.slice(0, intPart.length - shift);
    }
  }

  return `${isNeg ? "-" : ""}${intPart}${fracPart ? "." + fracPart : ""}`;
}

/** Expands binary scientific notation ("1.01p3") by shifting the binary point */
function expandBinaryScientific(str: string): string {
  const trimmed = str.trim();
  if (!/[pP]/.test(trimmed)) 
    return trimmed;

  const [mantissa, expStr] = trimmed.split(/[pP]/);
  const exp = parseInt(expStr, 10);
  if (Number.isNaN(exp)) 
    return trimmed;

  let [intPart, fracPart = ""] = mantissa.split(".");
  const isNeg = intPart.startsWith("-");
  if (isNeg) intPart = intPart.slice(1);

  if (exp >= 0) {
    if (exp >= fracPart.length) {
      intPart += fracPart + "0".repeat(exp - fracPart.length);
      fracPart = "";
    } else {
      intPart += fracPart.slice(0, exp);
      fracPart = fracPart.slice(exp);
    }
  } else {
    const shift = Math.abs(exp);
    if (shift >= intPart.length) {
      fracPart = "0".repeat(shift - intPart.length) + intPart + fracPart;
      intPart = "0";
    } else {
      fracPart = intPart.slice(intPart.length - shift) + fracPart;
      intPart = intPart.slice(0, intPart.length - shift);
    }
  }

  return `${isNeg ? "-" : ""}${intPart}${fracPart ? "." + fracPart : ""}`;
}

/** Converts raw text (in the given format) into the decimal value the API expects */
function inputToDecimal(raw: string, format: InputFormat): number {
  if (format === "decimal") {
    const value = Number(raw);
    if (raw.trim() === "" || Number.isNaN(value)) {
      throw new Error("Enter a valid decimal number.");
    }
    return value;
  }
  if (format === "binary") return parseBinaryToDecimal(raw);
  return parseIeeeToDecimal(raw);
}

/** Converts a stored float value to an exact fixed-point binary string */
function decimalToBinaryString(value: number): string {
  if (Number.isNaN(value)) return "NaN";
  if (!Number.isFinite(value)) return value > 0 ? "+Infinity" : "-Infinity";
  if (value === 0) return Object.is(value, -0) ? "-0" : "0";

  const sign = value < 0 ? "-" : "";
  let abs = Math.abs(value);
  const intPart = Math.floor(abs);
  let fracPart = abs - intPart;

  let fracStr = "";
  let guard = 0;
  
  while (fracPart > 1e-15 && guard < 53) {
    fracPart *= 2;
    const bit = fracPart >= 1 ? 1 : 0;
    fracStr += String(bit);
    fracPart -= bit;
    guard++;
  }

  return sign + intPart.toString(2) + (fracStr ? "." + fracStr : "");
}

/** Formats a stored decimal value in whichever format the user chose as their input */
function formatStoredValue(
  value: number, 
  format: InputFormat, 
  hex: string, 
  breakdown?: Float32Breakdown
): string {
  
  if (
    breakdown?.specialCase === "overflow" || 
    value === Infinity || 
    value === -Infinity || 
    !Number.isFinite(value)
  ) {
    const isNeg = breakdown?.sign === 1 || value < 0;
    return isNeg ? "-Infinity" : "+Infinity";
  }

  if (breakdown?.specialCase === "zero" || value === 0) {
    const isNeg = breakdown?.sign === 1 || Object.is(value, -0);
    return isNeg ? "-0" : "0";
  }

  if (breakdown && (breakdown as any).customBinaryString && format === "binary") {
    return (breakdown as any).customBinaryString;
  }

  if (format === "decimal") return String(value);
  if (format === "binary") return decimalToBinaryString(value);
  return hex;
}

export default function RoundPage() {
  const [inputFormat, setInputFormat] = useState<InputFormat>("decimal");
  const [signedMode, setSignedMode] = useState<SignedMode>("signed");
  const [input, setInput] = useState(INPUT_FORMATS[0].default);
  const [targetBits, setTargetBits] = useState<string>("23");
  const [compare, setCompare] = useState<RoundCompareResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!input.trim()) return;

    const parsedTarget = Number(targetBits);
    if (!targetBits || Number.isNaN(parsedTarget) || parsedTarget < 1) {
      setStatus("error");
      setErrorMsg("Please enter a valid positive target number.");
      setCompare(null);
      return;
    }

    // for ieee only, limit target input to 1-23 bits only
    if (inputFormat === "ieee" && parsedTarget > 23) {
      setStatus("error");
      setErrorMsg("Target mantissa bits for IEEE-754 single precision must be between 1 and 23.");
      setCompare(null);
      return;
    }

    const trimmedInput = input.trim();

    // validation for decimal numbers (also handles scientific notation)
    if (inputFormat === "decimal") {
      const isDecimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(trimmedInput);
      if (!isDecimal) {
        setStatus("error");
        setErrorMsg("Decimal input can only contain digits (0–9), an optional sign (+/-), a decimal point, or scientific notation (e.g. -13.25 or 1.2e-4).");
        setCompare(null);
        return;
      }
    }

    // validation for binary numbers (also handles scientific notation)
    if (inputFormat === "binary") {
      const isBinary = /^[+-]?(?:[01]+(?:\.[01]*)?|\.[01]+)(?:[pP][+-]?\d+)?$/.test(trimmedInput);
      if (!isBinary) {
        setStatus("error");
        setErrorMsg("Binary input can only contain 0s and 1s, an optional sign (+/-), a decimal point, or base-2 scientific notation (e.g. -101.011 or 1.01p3).");
        setCompare(null);
        return;
      }
    }

    let cancelled = false;
    setStatus("loading");

    if (inputFormat === "decimal" || inputFormat === "binary") {
      const isNegative = trimmedInput.startsWith("-");
      const signBit = isNegative ? "1" : "0";

      // Expand scientific notation into fixed-point notation
      const expandedInput = inputFormat === "decimal"
        ? expandDecimalScientific(trimmedInput)
        : expandBinaryScientific(trimmedInput);

      // Check if value exceeds float32 range
      let numVal: number;
      try {
        numVal = inputToDecimal(expandedInput, inputFormat);
      } catch {
        numVal = NaN;
      }

      // for overflow/underflow
      if (!Number.isNaN(numVal) && (Math.abs(numVal) > FLOAT32_MAX || !Number.isFinite(numVal))) {
        const isInfNeg = isNegative || numVal < 0;
        const infSignBit: 0 | 1 = isInfNeg ? 1 : 0;

        const buildInfBreakdown = (mode: RoundingMode): Float32Breakdown => ({
          input: isInfNeg ? -Infinity : Infinity,
          mode,
          targetBits: parsedTarget,
          sign: infSignBit,
          exponentUnbiased: 128,
          exponentBiased: 255,
          exponentBits: "11111111",
          mantissaBits: "0".repeat(parsedTarget),
          sourceSignificand: "1" + "0".repeat(52),
          roundBit: "0",
          stickyBits: "",
          stickyAny: false,
          roundedUp: false,
          mantissaCarried: false,
          fullBinary: `${infSignBit}11111111${"0".repeat(23)}`,
          hex: infSignBit ? "0xFF800000" : "0x7F800000",
          storedValue: isInfNeg ? -Infinity : Infinity,
          specialCase: "overflow",
        });

        setCompare({
          results: {
            "nearest-even": buildInfBreakdown("nearest-even"),
            "toward-zero": buildInfBreakdown("toward-zero"),
            "toward-positive": buildInfBreakdown("toward-positive"),
            "toward-negative": buildInfBreakdown("toward-negative"),
          },
        });
        setStatus("idle");
        return;
      }

      // remove sign for custom rounding backend processing
      const cleanInput = expandedInput.replace(/^[+-]/, "");

      computeCustomRounding(cleanInput, signedMode, signBit, targetBits, inputFormat)
        .then((res: any) => {
          if (cancelled || !res) return;

          const binaryObjToString = (obj: any): string => {
            if (typeof obj === "string" || typeof obj === "number") 
              return String(obj);
            
            if (!obj) 
              return "0";

            const mag: number[] = obj.arithmeticMagnitude ?? obj.magnitude ?? [];
            const pointIdx: number = obj.arithmeticPointIndex ?? obj.decimalPointIndex ?? -1;
            const sign = isNegative ? "-" : "";

            if (mag.length === 0) 
              return "0";

            if (pointIdx === -1) {
              return sign + mag.join("");
            }

            if (pointIdx >= mag.length) {
              return sign + mag.join("") + "0".repeat(pointIdx - mag.length);
            }

            const intPart = mag.slice(0, pointIdx).join("") || "0";
            const fracPart = mag.slice(pointIdx).join("");
            return `${sign}${intPart}${fracPart ? "." + fracPart : ""}`;
          };

          const buildBreakdown = (val: any, mode: RoundingMode): Float32Breakdown => {
            if (val === undefined || val === null) return toFloat32Breakdown(0, mode, parsedTarget);

            let numericVal: number;
            let rawStringVal: string | undefined;

            if (inputFormat === "binary") {
              try {
                rawStringVal = binaryObjToString(val);
                numericVal = parseBinaryToDecimal(rawStringVal);
              } catch {
                numericVal = Number(val);
              }
            } else {
              numericVal = typeof val === "object" && "value" in val ? Number(val.value) : Number(val);
            }

            if (Number.isNaN(numericVal)) {
              return toFloat32Breakdown(0, mode, parsedTarget);
            }

            const absVal = Math.abs(numericVal);
            if (absVal > FLOAT32_MAX) {
              const isNeg = isNegative || numericVal < 0;
              const infSignBit: 0 | 1 = isNeg ? 1 : 0;

              const breakdown = toFloat32Breakdown(isNeg ? -Infinity : Infinity, mode, parsedTarget);
              breakdown.specialCase = "overflow";
              breakdown.storedValue = isNeg ? -Infinity : Infinity;

              if (typeof val === "object" && val !== null) {
                if ("guardBit" in val) breakdown.roundBit = String(val.guardBit);
                if ("stickyAny" in val) breakdown.stickyAny = Boolean(val.stickyAny);
                if ("roundedUp" in val) breakdown.roundedUp = Boolean(val.roundedUp);
              }

              return breakdown;
            }

            const breakdown = toFloat32Breakdown(numericVal, mode, parsedTarget);

            if (typeof val === "object" && val !== null) {
              if ("guardBit" in val) {
                breakdown.roundBit = String(val.guardBit);
              }
              if ("stickyAny" in val) breakdown.stickyAny = Boolean(val.stickyAny);
              if ("roundedUp" in val) breakdown.roundedUp = Boolean(val.roundedUp);
            }

            // Set exact decimal value when in decimal format (prevents float double-rounding display)
            if (inputFormat === "decimal") {
              breakdown.storedValue = numericVal;
            }

            if (inputFormat === "binary" && rawStringVal) {
              (breakdown as any).customBinaryString = rawStringVal;
            }

            return breakdown;
          };

          const nearest = res.roundNearest ?? res.roundToNearest ?? res.nearest;
          const trunc = res.truncate ?? res.truncation ?? res.towardZero;
          const up = res.roundUp ?? res.towardPositive;
          const down = res.roundDown ?? res.towardNegative;

          setCompare({
            results: {
              "nearest-even": buildBreakdown(nearest, "nearest-even"),
              "toward-zero": buildBreakdown(trunc, "toward-zero"),
              "toward-positive": buildBreakdown(up, "toward-positive"),
              "toward-negative": buildBreakdown(down, "toward-negative"),
            },
          });
          setStatus("idle");
        })
        .catch((err: Error) => {
          if (cancelled) return;
          setErrorMsg(err.message || "Custom Rounding failed.");
          setStatus("error");
          setCompare(null);
        });

    } else {
      let decimalValue: number;
      try {
        decimalValue = inputToDecimal(input, inputFormat);
      } catch (err) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Invalid input format.");
        setCompare(null);
        return;
      }

      // handle infinity / overflow decimal values
      if (!Number.isFinite(decimalValue)) {
        const buildInfBreakdown = (mode: RoundingMode): Float32Breakdown => {
          const signBit: 0 | 1 = decimalValue < 0 ? 1 : 0;
          return {
            input: decimalValue,
            mode,
            targetBits: parsedTarget,
            sign: signBit,
            exponentUnbiased: 128,
            exponentBiased: 255,
            exponentBits: "11111111",
            mantissaBits: "0".repeat(parsedTarget),
            sourceSignificand: "1" + "0".repeat(52),
            roundBit: "0",
            stickyBits: "",
            stickyAny: false,
            roundedUp: false,
            mantissaCarried: false,
            fullBinary: `${signBit}11111111${"0".repeat(23)}`,
            hex: signBit ? "0xFF800000" : "0x7F800000",
            storedValue: decimalValue > 0 ? Infinity : -Infinity,
            specialCase: "overflow",
          };
        };

        setCompare({
          results: {
            "nearest-even": buildInfBreakdown("nearest-even"),
            "toward-zero": buildInfBreakdown("toward-zero"),
            "toward-positive": buildInfBreakdown("toward-positive"),
            "toward-negative": buildInfBreakdown("toward-negative"),
          },
        });
        setStatus("idle");
        return;
      }

      roundFloatCompare({ decimal: decimalValue, targetBits: parsedTarget })
        .then((c) => {
          if (cancelled) return;
          setCompare(c);
          setStatus("idle");
        })
        .catch((err: Error) => {
          if (cancelled) return;
          setErrorMsg(err.message || "Rounding failed.");
          setStatus("error");
          setCompare(null);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [input, inputFormat, targetBits, signedMode]);

  const activeFormat = INPUT_FORMATS.find((f) => f.id === inputFormat)!;

  return (
    <PageShell
      eyebrow="IEEE 754 · Single Precision"
      title="Numeric Rounding"
      description="Explore how Decimal, Binary, and IEEE-754 inputs are trimmed to fit target precision. See the guard, round, and sticky bits a rounding mode actually looks at, and how the choice of mode changes the stored value."
    >
      <Card>
        <label style={labelStyle}>Input format</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
          {INPUT_FORMATS.map((f) => (
            <button
              key={f.id}
              className="bfl-mode"
              onClick={() => {
                setInputFormat(f.id);
                setInput(f.default);
              }}
              style={{
                ...modeButtonStyle,
                background: inputFormat === f.id ? "#4B3F72" : "rgba(6,11,36,0.7)",
                color: inputFormat === f.id ? "#EAE3FF" : "#A9B3D6",
                borderColor: inputFormat === f.id ? "#7091df" : "rgba(143,166,217,0.3)",
              }}
              title={f.label}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }} htmlFor="decimal-input">
                {activeFormat.label} input
              </label>

              {inputFormat === "binary" && (
                <div style={{ display: "flex", gap: 4 }}>
                  {(["signed", "unsigned"] as SignedMode[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSignedMode(s)}
                      style={{
                        border: "1px solid",
                        borderRadius: 6,
                        padding: "2px 8px",
                        fontSize: 10.5,
                        fontFamily: "'JetBrains Mono', monospace",
                        cursor: "pointer",
                        background: signedMode === s ? "#4B3F72" : "rgba(6,11,36,0.7)",
                        color: signedMode === s ? "#EAE3FF" : "#A9B3D6",
                        borderColor: signedMode === s ? "#7091df" : "rgba(143,166,217,0.3)",
                      }}
                    >
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <input
              id="decimal-input"
              className="bfl-field"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              inputMode={inputFormat === "decimal" ? "decimal" : "text"}
              placeholder={activeFormat.placeholder}
              style={inputStyle}
            />
            <div style={helperStyle}>{activeFormat.helper}</div>
          </div>

          <div style={{ width: 180 }}>
            <label style={labelStyle} htmlFor="target-bits-input">
              {inputFormat === "decimal" 
                ? "Target Digits" 
                : inputFormat === "binary" 
                ? "Target Bits" 
                : "Target Mantissa Bits"}
            </label>
            <input
              id="target-bits-input"
              className="bfl-field"
              type="number"
              min={1}
              max={inputFormat === "ieee" ? 23 : 52}
              value={targetBits}
              onChange={(e) => {
                const val = e.target.value;
                if (inputFormat === "ieee" && Number(val) > 23) {
                  setTargetBits("23");
                } else {
                  setTargetBits(val);
                }
              }}
              placeholder={inputFormat === "ieee" ? "1 - 23" : "e.g. 10"}
              style={inputStyle}
            />
            <div style={helperStyle}>
              {inputFormat === "ieee" 
                ? "The Mantissa holds 23 bits." 
                : "Number of target digits/bits for rounding."}
            </div>
          </div>
        </div>

        {status === "error" && <ErrorNote>{errorMsg}</ErrorNote>}
      </Card>

      {status === "loading" && <LoadingNote>Computing rounded representation…</LoadingNote>}

      {status === "idle" && compare && (
        <>
          <Card>
            <SectionTitle>Compare across modes</SectionTitle>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {[`Mode`, `Stored value (${activeFormat.label.toLowerCase()})`, "Bit pattern", "Rounded up?"].map(
                      (h) => (
                        <th key={h} style={thStyle}>
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {ROUNDING_MODES.map((m) => {
                    const r = compare.results[m.id];
                    return (
                      <tr key={m.id}>
                        <td style={tdStyle}>{m.short}</td>
                        <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', monospace" }}>
                          {formatStoredValue(r.storedValue, inputFormat, r.hex, r)}
                        </td>
                        <td
                          style={{
                            ...tdStyle,
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 12,
                            letterSpacing: 0.5,
                          }}
                        >
                          {r.fullBinary}
                        </td>
                        <td style={tdStyle}>{r.roundedUp ? "yes" : "no"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {ROUNDING_MODES.map((m) => (
            <ModeBreakdownCard
              key={m.id}
              label={m.label}
              breakdown={compare.results[m.id]}
              activeFormat={activeFormat}
              inputFormat={inputFormat}
            />
          ))}
        </>
      )}
    </PageShell>
  );
}

/* ---------- presentational helpers ---------- */

function ModeBreakdownCard({
  label,
  breakdown,
  activeFormat,
  inputFormat,
}: {
  label: string;
  breakdown: Float32Breakdown;
  activeFormat: (typeof INPUT_FORMATS)[number];
  inputFormat: InputFormat;
}) {
  return (
    <Card>
      <SectionTitle>{label}</SectionTitle>
      {breakdown.specialCase && <SpecialCaseNote breakdown={breakdown} />}
      <div style={{ overflowX: "auto", padding: "4px 0 8px" }}>
        <BitField
          sign={breakdown.sign}
          exponentBits={breakdown.exponentBits}
          mantissaBits={breakdown.mantissaBits}
        />
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={rowStyle}>
          <Stat label="Guard/round bit" value={breakdown.roundBit} mono />
          <Stat label="Sticky (any 1s after)" value={breakdown.stickyAny ? "yes" : "no"} mono />
          <Stat label="Rounded up?" value={breakdown.roundedUp ? "yes" : "no"} mono />
          <Stat
            label={`Stored value (${activeFormat.label.toLowerCase()})`}
            value={formatStoredValue(breakdown.storedValue, inputFormat, breakdown.hex, breakdown)}
            mono
          />
        </div>
        {breakdown.mantissaCarried && (
          <ErrorNote>
            Rounding filled the mantissa to all 1s and carried into the exponent (23-bit
            overflow), so the exponent increased by 1.
          </ErrorNote>
        )}
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(14,23,64,0.55)",
        border: "1px solid rgba(143,166,217,0.2)",
        borderRadius: 14,
        padding: "22px 24px",
        marginBottom: 18,
      }}
    >
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 700,
        fontSize: 15.5,
        color: "#F5F7FF",
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: "#7C86AD", textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
      <div
        style={{
          color: "#F5F7FF",
          fontSize: 15,
          marginTop: 2,
          fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit",
          overflowWrap: "anywhere",
          wordBreak: "break-all",
          whiteSpace: "normal",
          minWidth: 0,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function LoadingNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: "#7091df", fontSize: 13.5, padding: "8px 4px", marginBottom: 4 }}>
      {children}
    </div>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 12,
        color: "#f2a5a5",
        fontSize: 13,
        background: "rgba(226,114,91,0.12)",
        border: "1px solid rgba(226,114,91,0.35)",
        borderRadius: 8,
        padding: "8px 12px",
      }}
    >
      {children}
    </div>
  );
}

function SpecialCaseNote({ breakdown }: { breakdown: Float32Breakdown }) {
  const infString = breakdown.sign ? "-Infinity" : "+Infinity";
  const messages: Record<string, string> = {
    zero: "This value stores as signed zero — exponent and mantissa are all zero.",
    overflow: `This magnitude is too large for float32 and stores as ${infString}.`,
    underflow:
      "This magnitude is too small for float32's normal range. This tool simplifies subnormal values and stores it as ±0.",
  };

  if (breakdown.specialCase === "overflow") {
    return (
      <div
        style={{
          marginTop: 12,
          color: "#b0c4de",
          fontSize: 13,
          background: "rgba(112, 145, 223, 0.15)",
          border: "1px solid rgba(112, 145, 223, 0.35)",
          borderRadius: 8,
          padding: "8px 12px",
        }}
      >
        {messages.overflow}
      </div>
    );
  }

  return <ErrorNote>{messages[breakdown.specialCase as string]}</ErrorNote>;
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  color: "#7C86AD",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  marginBottom: 8,
};

const helperStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#7C86AD",
  marginTop: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "rgba(6,11,36,0.7)",
  border: "1px solid rgba(143,166,217,0.3)",
  borderRadius: 8,
  padding: "10px 14px",
  color: "#F5F7FF",
  fontSize: 15,
  fontFamily: "'JetBrains Mono', monospace",
};

const modeButtonStyle: React.CSSProperties = {
  border: "1px solid",
  borderRadius: 8,
  padding: "8px 14px",
  fontSize: 13,
  fontFamily: "'JetBrains Mono', monospace",
  cursor: "pointer",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: 32,
  flexWrap: "wrap",
  minWidth: 0,
  width: "100%",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: 11.5,
  color: "#7C86AD",
  textTransform: "uppercase",
  letterSpacing: 0.5,
  padding: "6px 10px",
  borderBottom: "1px solid rgba(143,166,217,0.25)",
};

const tdStyle: React.CSSProperties = {
  padding: "9px 10px",
  fontSize: 13.5,
  color: "#E4E8FA",
  borderBottom: "1px solid rgba(143,166,217,0.1)",
  wordBreak: "break-word",
  maxWidth: 280,
};
