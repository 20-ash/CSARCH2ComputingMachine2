"use client";

import React, { useEffect, useState } from "react";
import PageShell from "@/components/PageShell";
import BitField from "@/components/BitField";
import { decimalToBinary, type DecimalToBinaryResponse } from "@/lib/floatApi";

export default function ConvertPage() {
  const [input, setInput] = useState("5.75");
  const [result, setResult] = useState<DecimalToBinaryResponse | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const value = Number(input);
    if (input.trim() === "" || Number.isNaN(value)) {
      setStatus("error");
      setErrorMsg("Enter a valid decimal number.");
      setResult(null);
      return;
    }

    let cancelled = false;
    setStatus("loading");

    decimalToBinary({ decimal: value })
      .then((res) => {
        if (cancelled) return;
        setResult(res);
        setStatus("idle");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setErrorMsg(err.message || "Conversion failed.");
        setStatus("error");
        setResult(null);
      });

    return () => {
      cancelled = true;
    };
  }, [input]);

  const isSubnormal =
    !!result && result.exponentBits === "00000000" && result.mantissaBits.includes("1");

  return (
    <PageShell
      eyebrow="IEEE 754 · Single Precision"
      title="Decimal to Binary"
      description="Enter a decimal number and watch it become a sign bit, an exponent, and a mantissa — the same 32 bits a computer would actually store."
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
          placeholder="e.g. 5.75"
          style={inputStyle}
        />

        {status === "error" && <ErrorNote>{errorMsg}</ErrorNote>}
      </Card>

      {status === "loading" && <LoadingNote>Computing bit pattern…</LoadingNote>}

      {status === "idle" && result && (
        <>
          <Card>
            <SectionTitle>Result</SectionTitle>
            {result.specialCase && <SpecialCaseNote breakdown={result} />}
            <div style={{ overflowX: "auto", padding: "4px 0 8px" }}>
              <BitField
                sign={result.sign}
                exponentBits={result.exponentBits}
                mantissaBits={result.mantissaBits}
              />
            </div>
            <div style={rowStyle}>
              <Stat label="Hex" value={result.hex} mono />
              <Stat
                label="Stored value"
                value={String(result.storedValue)}
                mono
              />
            </div>
          </Card>

          {result.specialCase !== "zero" && result.specialCase !== "overflow" && (
            <Card>
              <SectionTitle>Step by step</SectionTitle>
              <Step n={1} title="Sign bit">
                {result.input < 0 || Object.is(result.input, -0)
                  ? `The value is negative, so the sign bit is 1.`
                  : `The value is positive (or zero), so the sign bit is 0.`}
              </Step>
              <Step
                n={2}
                title={isSubnormal ? "Represent as a subnormal" : "Normalize to 1.mmmm × 2^e"}
              >
                {isSubnormal
                  ? `|${result.input}| in binary is below the normal range, so it's stored as a subnormal: 0.${result.mantissaBits} × 2^-126.`
                  : `|${result.input}| in binary normalizes to 1.${result.sourceSignificand.slice(
                      1,
                      24
                    )}… × 2^${result.exponentUnbiased}.`}
              </Step>
              <Step
                n={3}
                title={isSubnormal ? "Exponent field" : "Bias the exponent"}
              >
                {isSubnormal
                  ? `Subnormals skip the usual biasing: the exponent field is all zeros (${result.exponentBits}), encoding the value as 0.mmm × 2^-126.`
                  : `Single precision stores the exponent with a bias of 127, so ${result.exponentUnbiased} + 127 = ${result.exponentBiased}, or ${result.exponentBits} in 8 bits.`}
              </Step>
              <Step n={4} title="Keep 23 mantissa bits">
                {isSubnormal
                  ? `Subnormals have no implicit leading 1 — the leading bit is 0, and all 23 mantissa bits are stored directly: ${result.mantissaBits}.`
                  : `The bits after the leading "1." are kept up to 23 places: ${result.mantissaBits}. The implicit leading 1 is never stored — it's assumed.`}
              </Step>
              <Step n={5} title="Assemble the word">
                {`sign + exponent + mantissa = ${result.fullBinary} (${result.hex}).`}
              </Step>
            </Card>
          )}
        </>
      )}
    </PageShell>
  );
}

/* ---------- small presentational helpers shared by the layout above ---------- */

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

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
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
      <div>
        <div style={{ color: "#F5F7FF", fontSize: 13.5, fontWeight: 600, marginBottom: 3 }}>
          {title}
        </div>
        <div
          style={{
            color: "#A9B3D6",
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

function SpecialCaseNote({ breakdown }: { breakdown: DecimalToBinaryResponse }) {
  const messages: Record<string, string> = {
    zero: "This value stores as signed zero — exponent and mantissa are all zero.",
    overflow: "This magnitude is too large for float32 and stores as ±Infinity.",
    underflow:
      "This magnitude is below float32's normal range and stores as a subnormal (leading 0s in the exponent)",
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

const rowStyle: React.CSSProperties = {
  display: "flex",
  gap: 32,
  flexWrap: "wrap",
  marginTop: 14,
};