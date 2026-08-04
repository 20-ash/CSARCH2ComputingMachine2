"use client";

import React, { useEffect, useState } from "react";
import PageShell from "@/components/PageShell";
import BitField from "@/components/BitField";
import {
  computeArithmetic,
  type ArithmeticOperation,
  type ArithmeticResponse,
} from "@/lib/floatApi";

const OPERATIONS: { id: ArithmeticOperation; label: string; short: string }[] = [
  { id: "add", label: "Addition", short: "A + B" },
  { id: "multiply", label: "Multiplication", short: "A × B" },
];

type Tone = "transparent" | "blue" | "white";
type InputMode = "decimal" | "hex";

// Convert hex string to 32-bit float value
function hexStringToDecimal(raw: string): number | { error: string } {
  const cleaned = raw.trim().replace(/^0x/i, "").replace(/\s+/g, ""); // strip prefix and spaces
  if (!/^[0-9a-fA-F]{8}$/.test(cleaned)) { // must be exactly 8 hex digits
    return { error: "Invalid Input. Double check your input. Enter exactly 8 hex digits (32-bit IEEE 754)." };
  }
  const intVal = parseInt(cleaned, 16) >>> 0; // parse as unsigned integer
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setUint32(0, intVal);
  return view.getFloat32(0); // reinterpret bits as float
}

// Parse input string into numeric value or error
function parseOperand(
  raw: string,
  mode: InputMode
): { value: number } | { error: string } | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null; // empty input is nothing yet

  if (mode === "hex") {
    const decoded = hexStringToDecimal(trimmed);
    if (typeof decoded === "object") return decoded;
    return { value: decoded };
  }

  const lower = trimmed.toLowerCase();
  if (lower === "nan" || lower === "-nan") return { value: NaN };
  if (lower === "infinity" || lower === "inf") return { value: Infinity };
  if (lower === "-infinity" || lower === "-inf") return { value: -Infinity };

  const value = Number(trimmed);
  if (Number.isNaN(value)) {
    return { error: "Invalid Input. Double check your input. Enter a valid decimal number." };
  }
  return { value };
}

// Check if result includes full operand breakdown and steps
function hasOperandBreakdown(
  r: ArithmeticResponse
): r is Extract<ArithmeticResponse, { operands: unknown; stepByStep: unknown }> {
  return "operands" in r && "stepByStep" in r;
}

// Format number so -0 stays visible instead of becoming "0"
function formatDecimal(val: number): string {
  if (Object.is(val, -0)) return "-0";
  return String(val);
}

// Get final numeric value from result object
function finalDecimal(r: ArithmeticResponse): number {
  if ("decimal" in r && typeof r.decimal === "number") return r.decimal;
  if ("result" in r && typeof r.result === "number") return r.result;
  return 0;
}

// Clean binary string: remove spaces, validate 32 bits
function cleanBits(binary: unknown): string | null {
  if (typeof binary !== "string") return null;
  const stripped = binary.replace(/\s/g, ""); // remove spacing
  if (stripped === "NaN") return null; // skip special text
  return /^[01]{32}$/.test(stripped) ? stripped : null;
}

// Split 32-bit binary into sign, exponent, mantissa parts
function parseIEEEComponents(binStr: string) {
  const clean = binStr.replace(/\s/g, "");
  if (clean.length !== 32) return null;
  const sign = clean[0]; // first bit is sign
  const expBits = clean.slice(1, 9); // next 8 bits exponent
  const mantBits = clean.slice(9); // last 23 bits mantissa
  const expVal = parseInt(expBits, 2);
  const unbiasedExp = expVal - 127; // remove bias of 127
  return {
    sign,
    expBits,
    expVal,
    unbiasedExp,
    mantBits,
    significand: `1.${mantBits}`, // restore implicit leading 1
  };
}

export default function ArithmeticPage() {
  const [aInput, setAInput] = useState("");
  const [bInput, setBInput] = useState("");

  const [mode, setMode] = useState<InputMode>("decimal");
  const [operation, setOperation] = useState<ArithmeticOperation>("add");
  const [result, setResult] = useState<ArithmeticResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Reset inputs when switching mode
  const handleModeChange = (next: InputMode) => {
    if (next === mode) return;
    setMode(next);
    setAInput("");
    setBInput("");
  };

  // Run calculation whenever inputs/mode/operation change
  useEffect(() => {
    const a = parseOperand(aInput, mode);
    const b = parseOperand(bInput, mode);

    if (a === null || b === null) {
      setStatus("idle");
      setResult(null);
      return;
    }
    if ("error" in a || "error" in b) {
      setStatus("error");
      setErrorMsg("error" in a ? a.error : (b as { error: string }).error);
      setResult(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");

    computeArithmetic({ a: a.value, b: b.value, operation })
      .then((res) => {
        if (cancelled) return;
        setResult(res);
        setStatus("idle");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setErrorMsg(err.message || "Computation failed.");
        setStatus("error");
        setResult(null);
      });

    return () => { cancelled = true; }; // cancel old request if changed
  }, [aInput, bInput, mode, operation]);

  const finalBits = result ? cleanBits(result.binary) : null;
  const safeHex =
    result && typeof result.hex === "string" && /^[0-9A-Fa-f]{8}$/.test(result.hex)
      ? result.hex
      : "—";

  return (
    <PageShell
      eyebrow="IEEE 754 · Single Precision"
      title="Arithmetic Operation"
      description="Enter two operands, pick addition or multiplication, and see each value converted to IEEE 754 and the binary, hex, and decimal result."
    >
      <Card tone="transparent">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <label style={{ ...labelStyle("transparent"), marginBottom: 0 }}>Input Mode</label>
          <div style={{ display: "flex", gap: 4 }}>
            {(["decimal", "hex"] as InputMode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                style={{
                  ...miniToggleStyle,
                  background: mode === m ? "#4B3F72" : "rgba(6,11,36,0.7)",
                  color: mode === m ? "#EAE3FF" : "#A9B3D6",
                  borderColor: mode === m ? "#7091df" : "rgba(143,166,217,0.3)",
                }}
              >
                {m === "decimal" ? "DEC" : "HEX"}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10 }}>
          <OperandInput
            id="operand-a"
            label="Operand A"
            value={aInput}
            onValueChange={setAInput}
            mode={mode}
          />
          <OperandInput
            id="operand-b"
            label="Operand B"
            value={bInput}
            onValueChange={setBInput}
            mode={mode}
          />
        </div>

        <label style={{ ...labelStyle("transparent"), marginTop: 18 }}>Operation</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {OPERATIONS.map((op) => (
            <button
              key={op.id}
              className="bfl-mode"
              onClick={() => setOperation(op.id)}
              style={{
                ...modeButtonStyle,
                background: operation === op.id ? "#4B3F72" : "rgba(6,11,36,0.7)",
                color: operation === op.id ? "#EAE3FF" : "#A9B3D6",
                borderColor: operation === op.id ? "#7091df" : "rgba(143,166,217,0.3)",
              }}
              title={op.label}
            >
              {op.short}
            </button>
          ))}
        </div>

        {status === "error" && <ErrorNote tone="transparent">{errorMsg}</ErrorNote>}
      </Card>

      {status === "idle" && !result && (
        <LoadingNote>Enter both operands to see the result.</LoadingNote>
      )}

      {status === "loading" && <LoadingNote>Computing arithmetic result…</LoadingNote>}

      {status === "idle" && result && (
        <>
          <Card tone="blue">
            <SectionTitle tone="blue">
              Result — {OPERATIONS.find((o) => o.id === operation)?.label}
            </SectionTitle>

            {finalBits ? (
              <>
                <div style={{ overflowX: "auto", padding: "4px 0 8px" }}>
                  <BitField
                    sign={Number(finalBits[0]) as 0 | 1}
                    exponentBits={finalBits.slice(1, 9)}
                    mantissaBits={finalBits.slice(9, 32)}
                  />
                </div>
                <div style={rowStyle}>
                  <Stat tone="blue" label="Hex" value={safeHex} mono />
                  <Stat tone="blue" label="Decimal" value={formatDecimal(finalDecimal(result))} mono />
                </div>
              </>
            ) : (
              <ErrorNote tone="blue">
                Result: {safeHex} — Decimal: {formatDecimal(finalDecimal(result))}
              </ErrorNote>
            )}
          </Card>

          {hasOperandBreakdown(result) && (
            <Card tone="transparent">
              <SectionTitle tone="transparent">Step by step Solution</SectionTitle>

              {(() => {
                const pA = parseIEEEComponents(result.operands.a.binary);
                const pB = parseIEEEComponents(result.operands.b.binary);
                if (!pA || !pB) return null;

                const isAdd = operation === "add";

                return (
                  <>
                    <Step n={1} title="Unpack IEEE 754 Operands">
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 12, marginTop: 4 }}>
                        <div style={operandCardStyle}>
                          <div style={miniLabelStyle("transparent")}>Operand A ({result.operands.a.normalized})</div>
                          <div>Sign: <strong>{pA.sign}</strong> | Exp: <strong>{pA.expBits}</strong> (2^{pA.unbiasedExp})</div>
                          <div>Significand: <strong>{pA.significand}</strong></div>
                        </div>
                        <div style={operandCardStyle}>
                          <div style={miniLabelStyle("transparent")}>Operand B ({result.operands.b.normalized})</div>
                          <div>Sign: <strong>{pB.sign}</strong> | Exp: <strong>{pB.expBits}</strong> (2^{pB.unbiasedExp})</div>
                          <div>Significand: <strong>{pB.significand}</strong></div>
                        </div>
                      </div>
                    </Step>

                    <Step n={2} title={isAdd ? "Align Exponents" : "Compute Product Exponent"}>
                      {isAdd ? (
                        <>
                          Exponents are 2<sup>{pA.unbiasedExp}</sup> and 2<sup>{pB.unbiasedExp}</sup>.
                          {pA.unbiasedExp === pB.unbiasedExp
                            ? " Exponents are equal, no right-shift alignment required."
                            : ` Shift the mantissa of the smaller magnitude right by ${Math.abs(pA.unbiasedExp - pB.unbiasedExp)} bit(s) to match exponent 2<sup>${Math.max(pA.unbiasedExp, pB.unbiasedExp)}</sup>.`
                          }
                        </>
                      ) : (
                        <>
                          Add unbiased exponents: {pA.unbiasedExp} + {pB.unbiasedExp} = {pA.unbiasedExp + pB.unbiasedExp}.
                          Re-bias with +127: {pA.unbiasedExp + pB.unbiasedExp} + 127 = {pA.unbiasedExp + pB.unbiasedExp + 127}.
                        </>
                      )}
                    </Step>

                    <Step n={3} title={isAdd ? "Add / Subtract Significands" : "Sign & Mantissa Multiplication"}>
                      {isAdd ? (
                        <>
                          Perform binary addition/subtraction on aligned 24-bit significands ({pA.significand} and {pB.significand}).
                        </>
                      ) : (
                        <>
                          Sign bit = {pA.sign} ⊕ {pB.sign} = {Number(pA.sign) ^ Number(pB.sign)}.<br />
                          Multiply 24-bit significands: ({pA.significand}) × ({pB.significand}).
                        </>
                      )}
                    </Step>

                    <Step n={4} title="Normalize & Round (RNE)">
                      Shift intermediate result into standard 1.mmmm format. Apply Round-to-Nearest, Ties-to-Even on discarded guard/round/sticky bits to fit 23 mantissa bits.
                    </Step>

                    <Step n={5} title="Assemble Final 32-bit Word">
                      {finalBits ? (
                        <>
                          sign ({finalBits[0]}) + exponent ({finalBits.slice(1, 9)}) + mantissa ({finalBits.slice(9, 32)}) = <strong>{finalBits}</strong> ({safeHex})
                        </>
                      ) : (
                        `Result: ${safeHex}`
                      )}
                    </Step>
                  </>
                );
              })()}
            </Card>
          )}
        </>
      )}
    </PageShell>
  );
}

function OperandInput({
  id,
  label,
  value,
  onValueChange,
  mode,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (v: string) => void;
  mode: InputMode;
}) {
  return (
    <div style={{ flex: "1 1 220px" }}>
      <label style={labelStyle("transparent")} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="bfl-field"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        inputMode={mode === "hex" ? "text" : "decimal"}
        placeholder={mode === "hex" ? "e.g. 3F800000" : "e.g. 5.75"}
        style={inputStyle}
      />
    </div>
  );
}

const TONE_CARD_STYLE: Record<Tone, React.CSSProperties> = {
  transparent: {
    background: "rgba(14,23,64,0.55)",
    border: "1px solid rgba(143,166,217,0.2)",
  },
  blue: {
    background: "#5D739C",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  white: {
    background: "#EDEFF7",
    border: "2px solid transparent",
  },
};

function Card({ tone = "transparent", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 14,
        padding: "22px 24px",
        marginBottom: 18,
        ...TONE_CARD_STYLE[tone],
      }}
    >
      {children}
    </div>
  );
}

function titleColor(tone: Tone) {
  return tone === "white" ? "#1D2340" : "#F5F7FF";
}
function labelColor(tone: Tone) {
  if (tone === "white") return "#4A527A";
  if (tone === "blue") return "#E3E9F7";
  return "#7C86AD";
}
function bodyColor(tone: Tone) {
  if (tone === "white") return "#4A527A";
  if (tone === "blue") return "#EAEFFB";
  return "#A9B3D6";
}

function SectionTitle({ tone = "transparent", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 700,
        fontSize: 15.5,
        color: titleColor(tone),
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

function Step({
  n,
  title,
  children,
  tone = "transparent",
}: {
  n: number;
  title: string;
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <div style={{ display: "flex", gap: 14, marginBottom: 16 }}>
      <div
        style={{
          flexShrink: 0,
          width: 26,
          height: 26,
          borderRadius: "50%",
          background: "#4B3F72",
          color: "#EAE3FF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 12.5,
          fontWeight: 700,
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {n}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ color: titleColor(tone), fontSize: 13.5, fontWeight: 600, marginBottom: 3 }}>
          {title}
        </div>
        <div
          style={{
            color: bodyColor(tone),
            fontSize: 13.5,
            lineHeight: 1.6,
            fontFamily: "'JetBrains Mono', monospace",
            wordBreak: "break-word",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  mono,
  tone = "transparent",
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: Tone;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11.5,
          color: labelColor(tone),
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: titleColor(tone),
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

function ErrorNote({ children, tone = "transparent" }: { children: React.ReactNode; tone?: Tone }) {
  const textColor = tone === "white" ? "#8a2f1f" : "#f2a5a5";
  return (
    <div
      style={{
        marginTop: 12,
        color: textColor,
        fontSize: 13,
        background: "rgba(226,114,91,0.15)",
        border: "1px solid rgba(226,114,91,0.4)",
        borderRadius: 8,
        padding: "8px 12px",
      }}
    >
      {children}
    </div>
  );
}

function labelStyle(tone: Tone): React.CSSProperties {
  return {
    display: "block",
    fontSize: 12,
    color: labelColor(tone),
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  };
}

function miniLabelStyle(tone: Tone): React.CSSProperties {
  return {
    fontSize: 11.5,
    color: labelColor(tone),
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  };
}

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

const miniToggleStyle: React.CSSProperties = {
  border: "1px solid",
  borderRadius: 6,
  padding: "2px 8px",
  fontSize: 10.5,
  fontFamily: "'JetBrains Mono', monospace",
  cursor: "pointer",
};

const operandCardStyle: React.CSSProperties = {
  background: "rgba(6,11,36,0.6)",
  border: "1px solid rgba(143,166,217,0.2)",
  borderRadius: 8,
  padding: "12px 14px",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: 32,
  flexWrap: "wrap",
  marginTop: 14,
};
