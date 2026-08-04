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


function hexStringToDecimal(raw: string): number | { error: string } {
  const cleaned = raw.trim().replace(/^0x/i, "").replace(/\s+/g, "");
  if (!/^[0-9a-fA-F]{8}$/.test(cleaned)) {
    return { error: "Invalid Input. Double check your input. Enter exactly 8 hex digits (32-bit IEEE 754)." };
  }
  const intVal = parseInt(cleaned, 16) >>> 0;
  const buf = new ArrayBuffer(4);
  const view = new DataView(buf);
  view.setUint32(0, intVal);
  return view.getFloat32(0);
}

function parseOperand(
  raw: string,
  mode: InputMode
): { value: number } | { error: string } | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;

  if (mode === "hex") {
    const decoded = hexStringToDecimal(trimmed);
    if (typeof decoded === "object") return decoded; // { error }
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

function hasOperandBreakdown(
  r: ArithmeticResponse
): r is Extract<ArithmeticResponse, { operands: unknown }> {
  return "operands" in r;
}

function finalDecimal(r: ArithmeticResponse): number {
  return "decimal" in r ? r.decimal : r.result;
}

function cleanBits(binary: string): string | null {
  const stripped = binary.replace(/\s/g, "");
  return /^[01]{32}$/.test(stripped) ? stripped : null;
}

export default function ArithmeticPage() {
  const [aInput, setAInput] = useState("");
  const [bInput, setBInput] = useState("");

  // same operation isn't allowed
  const [mode, setMode] = useState<InputMode>("decimal");
  const [operation, setOperation] = useState<ArithmeticOperation>("add");
  const [result, setResult] = useState<ArithmeticResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // switching modes invalidates whatever was typed in 
  const handleModeChange = (next: InputMode) => {
    if (next === mode) return;
    setMode(next);
    setAInput("");
    setBInput("");
  };

  useEffect(() => {
    const a = parseOperand(aInput, mode);
    const b = parseOperand(bInput, mode);

    if (a === null || b === null) {
      // one or both operands haven't been entered yet, wait
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

    return () => {
      cancelled = true;
    };
  }, [aInput, bInput, mode, operation]);

  const finalBits = result ? cleanBits(result.binary) : null;

  return (
    <PageShell
      eyebrow="IEEE 754 · Single Precision"
      title="Arithmetic Operation"
      description="Enter two operands, pick addition or multiplication, and see each value converted to IEEE 754 and the binary, hex, and decimal result."
    >
      {/* ---- inputs ---- */}
      <Card tone="transparent">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <label style={{ ...labelStyle("transparent"), marginBottom: 0 }}>Input</label>
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
          {/* ---- results ---- */}
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
                  <Stat tone="blue" label="Hex" value={result.hex} mono />
                  <Stat tone="blue" label="Decimal" value={String(finalDecimal(result))} mono />
                </div>
              </>
            ) : (
              <ErrorNote tone="blue">
                The backend returned {`"${result.hex}"`} for this input instead of a real
                32-bit pattern, so it can&apos;t be rendered as bits here. (Flagged in the
                backend bug list — see the isNaN(a) || isNaN(b) branches of ieeeAdd/ieeeMul.)
                Decimal result: {String(finalDecimal(result))}.
              </ErrorNote>
            )}
          </Card>

          {/* ---- step by step ---- */}
          {hasOperandBreakdown(result) && (
            <Card tone="transparent">
              <SectionTitle tone="transparent">Step by step</SectionTitle>
              <Step tone="transparent" title="Method">
                {result.stepByStep}
              </Step>
              <br></br>
              <Step tone="transparent" title="Operand A normalized">
                {result.operands.a.normalized}
              </Step>
              <br></br>
              <Step tone="transparent" title="Operand B normalized">
                {result.operands.b.normalized}
              </Step>
              <br></br>
              <div style={{ display: "flex", gap: 32, flexWrap: "wrap", marginTop: 4 }}>
                <div>
                  <div style={miniLabelStyle("transparent")}>Operand A</div>
                  <div style={monoValueStyle("transparent")}>{result.operands.a.binary}</div>
                  <br></br>
                  <div style={monoValueStyle("transparent")}>{result.operands.a.hex}</div>
                </div>
                <div>
                  <div style={miniLabelStyle("transparent")}>Operand B</div>
                  <div style={monoValueStyle("transparent")}>{result.operands.b.binary}</div>
                  <br></br>
                  <div style={monoValueStyle("transparent")}>{result.operands.b.hex}</div>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </PageShell>
  );
}

/* ---------- operand input ---------- */

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

/* ---------- presentational helpers ---------- */

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
  title,
  children,
  tone = "transparent",
}: {
  title: string;
  children: React.ReactNode;
  tone?: Tone;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
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

function monoValueStyle(tone: Tone): React.CSSProperties {
  return {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    color: tone === "white" ? "#1D2340" : "#E4E8FA",
    wordBreak: "break-word",
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

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: 32,
  flexWrap: "wrap",
  marginTop: 14,
};