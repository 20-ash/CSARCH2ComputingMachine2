"use client";

import React, { useEffect, useState } from "react";
import PageShell from "@/components/PageShell";
import BitField from "@/components/BitField";
import {
  roundFloat,
  roundFloatCompare,
  type RoundResponse,
  type RoundCompareResponse,
} from "@/lib/floatApi";
import { ROUNDING_MODES, type RoundingMode } from "@/lib/ieee754";

export default function RoundPage() {
  const [input, setInput] = useState("0.1");
  const [mode, setMode] = useState<RoundingMode>("nearest-even");
  const [result, setResult] = useState<RoundResponse | null>(null);
  const [compare, setCompare] = useState<RoundCompareResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const value = Number(input);
    if (input.trim() === "" || Number.isNaN(value)) {
      setStatus("error");
      setErrorMsg("Enter a valid decimal number.");
      setResult(null);
      setCompare(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");

    Promise.all([roundFloat({ decimal: value, mode }), roundFloatCompare({ decimal: value })])
      .then(([r, c]) => {
        if (cancelled) return;
        setResult(r);
        setCompare(c);
        setStatus("idle");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setErrorMsg(err.message || "Rounding failed.");
        setStatus("error");
        setResult(null);
        setCompare(null);
      });

    return () => {
      cancelled = true;
    };
  }, [input, mode]);

  return (
    <PageShell
      eyebrow="IEEE 754 · Single Precision"
      title="Numeric Rounding"
      description="Most decimals don't fit exactly in 23 mantissa bits. See the guard, round, and sticky bits a rounding mode actually looks at, and how the choice of mode changes the stored value."
    >
      <Card>
        <label style={labelStyle} htmlFor="decimal-input">
          Decimal input
        </label>
        <input
          id="decimal-input"
          className="bfl-field"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          inputMode="decimal"
          placeholder="e.g. 0.1"
          style={inputStyle}
        />

        <label style={{ ...labelStyle, marginTop: 18 }}>Rounding mode</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {ROUNDING_MODES.map((m) => (
            <button
              key={m.id}
              className="bfl-mode"
              onClick={() => setMode(m.id)}
              style={{
                ...modeButtonStyle,
                background: mode === m.id ? "#4B3F72" : "rgba(6,11,36,0.7)",
                color: mode === m.id ? "#EAE3FF" : "#A9B3D6",
                borderColor: mode === m.id ? "#7091df" : "rgba(143,166,217,0.3)",
              }}
              title={m.label}
            >
              {m.short}
            </button>
          ))}
        </div>

        {status === "error" && <ErrorNote>{errorMsg}</ErrorNote>}
      </Card>

      {status === "loading" && <LoadingNote>Computing rounded representation…</LoadingNote>}

      {status === "idle" && result && (
        <>
          <Card>
            <SectionTitle>{ROUNDING_MODES.find((m) => m.id === mode)?.label}</SectionTitle>
            {result.specialCase && <SpecialCaseNote breakdown={result} />}
            <div style={{ overflowX: "auto", padding: "4px 0 8px" }}>
              <BitField
                sign={result.sign}
                exponentBits={result.exponentBits}
                mantissaBits={result.mantissaBits}
              />
            </div>

            {!result.specialCase && (
              <div style={{ marginTop: 16 }}>
                <div style={rowStyle}>
                  <Stat label="Guard/round bit" value={result.roundBit} mono />
                  <Stat label="Sticky (any 1s after)" value={result.stickyAny ? "yes" : "no"} mono />
                  <Stat label="Rounded up?" value={result.roundedUp ? "yes" : "no"} mono />
                  <Stat label="Stored value" value={String(result.storedValue)} mono />
                </div>
                {result.mantissaCarried && (
                  <ErrorNote>
                    Rounding filled the mantissa to all 1s and carried into the exponent
                    (23-bit overflow), so the exponent increased by 1.
                  </ErrorNote>
                )}
              </div>
            )}
          </Card>

          {compare && (
            <Card>
              <SectionTitle>Compare across modes</SectionTitle>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Mode", "Stored value", "Bit pattern", "Rounded up?"].map((h) => (
                        <th key={h} style={thStyle}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROUNDING_MODES.map((m) => {
                      const r = compare.results[m.id];
                      const active = m.id === mode;
                      return (
                        <tr
                          key={m.id}
                          style={{
                            background: active ? "rgba(112,145,223,0.12)" : "transparent",
                          }}
                        >
                          <td style={tdStyle}>{m.short}</td>
                          <td style={{ ...tdStyle, fontFamily: "'JetBrains Mono', monospace" }}>
                            {String(r.storedValue)}
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
          )}
        </>
      )}
    </PageShell>
  );
}

/* ---------- presentational helpers (mirrors app/convert/page.tsx) ---------- */

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

function SpecialCaseNote({ breakdown }: { breakdown: RoundResponse }) {
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