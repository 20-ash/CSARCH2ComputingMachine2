"use client";

import React from "react";

const FIELD_COLORS = {
  sign: "#e2725b",
  exponent: "#f2c078",
  mantissa: "#6ec3d1",
};

/** Renders a 32-bit IEEE-754 pattern as color-coded, labeled bit groups. */
export default function BitField({
  sign,
  exponentBits,
  mantissaBits,
  highlightFrom,
}: {
  sign: 0 | 1;
  exponentBits: string;
  mantissaBits: string;
  /** Mantissa bit index (0-22) from which bits should render dimmed, e.g. to show a rounding cutoff. */
  highlightFrom?: number;
}) {
  const renderBits = (bits: string, color: string, dimFrom?: number) =>
    bits.split("").map((b, i) => (
      <span
        key={i}
        style={{
          display: "inline-block",
          width: 20,
          textAlign: "center",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 14,
          fontWeight: 600,
          color: "#0B1339",
          background: dimFrom !== undefined && i >= dimFrom ? `${color}55` : color,
          borderRight: "1px solid rgba(11,19,57,0.15)",
        }}
      >
        {b}
      </span>
    ));

  return (
    <div>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid rgba(143,166,217,0.3)",
          width: "fit-content",
        }}
      >
        {renderBits(String(sign), FIELD_COLORS.sign)}
        {renderBits(exponentBits, FIELD_COLORS.exponent)}
        {renderBits(mantissaBits, FIELD_COLORS.mantissa, highlightFrom)}
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 10, flexWrap: "wrap" }}>
        <Legend color={FIELD_COLORS.sign} label={`Sign (1 bit)`} />
        <Legend color={FIELD_COLORS.exponent} label={`Exponent (8 bits)`} />
        <Legend color={FIELD_COLORS.mantissa} label={`Mantissa (23 bits)`} />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
      <span style={{ fontSize: 12, color: "#A9B3D6" }}>{label}</span>
    </div>
  );
}