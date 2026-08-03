"use client";

import React, { useEffect, useState } from "react";
import PageShell from "@/components/PageShell";
import BitField from "@/components/BitField";
import { roundFloatCompare, type RoundCompareResponse } from "@/lib/floatApi";
import { ROUNDING_MODES, type Float32Breakdown } from "@/lib/ieee754";

/* ---------- input format handling ---------- */

type InputFormat = "decimal" | "binary" | "ieee";

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
    placeholder: "e.g. 0.1",
    helper: "A base-10 number, e.g. 0.1 or -13.25",
    default: "0.1",
  },
  {
    id: "binary",
    label: "Binary",
    placeholder: "e.g. 1010.101 or -0.0011",
    helper: "A base-2 fraction using only 0s and 1s, e.g. 0.0001100110011",
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

/** Converts a user's raw text (in the given format) into the decimal value the API expects. */
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

/** Converts a stored float value to an exact fixed-point binary string. Float32 values that
 * come from this tool always terminate within a bounded number of fractional bits. */
function decimalToBinaryString(value: number): string {
  if (Number.isNaN(value)) return "NaN";
  if (!Number.isFinite(value)) return value > 0 ? "Infinity" : "-Infinity";
  if (value === 0) return Object.is(value, -0) ? "-0" : "0";

  const sign = value < 0 ? "-" : "";
  let abs = Math.abs(value);
  const intPart = Math.floor(abs);
  let fracPart = abs - intPart;

  let fracStr = "";
  let guard = 0;
  while (fracPart > 0 && guard < 200) {
    fracPart *= 2;
    const bit = fracPart >= 1 ? 1 : 0;
    fracStr += String(bit);
    fracPart -= bit;
    guard++;
  }

  return sign + intPart.toString(2) + (fracStr ? "." + fracStr : "");
}

/** Formats a stored decimal value in whichever format the user chose as their input.
 * `hex` is the breakdown's own precomputed IEEE-754 hex string (already 0x-prefixed,
 * 8 uppercase hex digits) — reused as-is rather than re-derived on the frontend. */
function formatStoredValue(value: number, format: InputFormat, hex: string): string {
  if (format === "decimal") return String(value);
  if (format === "binary") return decimalToBinaryString(value);
  return hex;
}

export default function RoundPage() {
  const [inputFormat, setInputFormat] = useState<InputFormat>("decimal");
  const [input, setInput] = useState(INPUT_FORMATS[0].default);
  const [compare, setCompare] = useState<RoundCompareResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let value: number;
    try {
      value = inputToDecimal(input, inputFormat);
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Invalid input.");
      setCompare(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");

    roundFloatCompare({ decimal: value })
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

    return () => {
      cancelled = true;
    };
  }, [input, inputFormat]);

  const activeFormat = INPUT_FORMATS.find((f) => f.id === inputFormat)!;

  return (
    <PageShell
      eyebrow="IEEE 754 · Single Precision"
      title="Numeric Rounding"
      description="Most decimals don't fit exactly in 23 mantissa bits. See the guard, round, and sticky bits a rounding mode actually looks at, and how the choice of mode changes the stored value."
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

        <label style={labelStyle} htmlFor="decimal-input">
          {activeFormat.label} input
        </label>
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
                          {formatStoredValue(r.storedValue, inputFormat, r.hex)}
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

/* ---------- presentational helpers (mirrors app/convert/page.tsx) ---------- */

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

      {!breakdown.specialCase && (
        <div style={{ marginTop: 16 }}>
          <div style={rowStyle}>
            <Stat label="Guard/round bit" value={breakdown.roundBit} mono />
            <Stat label="Sticky (any 1s after)" value={breakdown.stickyAny ? "yes" : "no"} mono />
            <Stat label="Rounded up?" value={breakdown.roundedUp ? "yes" : "no"} mono />
            <Stat
              label={`Stored value (${activeFormat.label.toLowerCase()})`}
              value={formatStoredValue(breakdown.storedValue, inputFormat, breakdown.hex)}
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
      )}
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
  const messages: Record<string, string> = {
    zero: "This value stores as signed zero — exponent and mantissa are all zero.",
    overflow: "This magnitude is too large for float32 and stores as ±Infinity.",
    underflow:
      "This magnitude is too small for float32's normal range. This tool simplifies subnormal values and stores it as ±0.",
  };
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
};