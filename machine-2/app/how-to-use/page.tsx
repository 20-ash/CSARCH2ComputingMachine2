"use client";

import React from "react";
import Link from "next/link";
import PageShell from "@/components/PageShell";

type Tone = "transparent" | "blue" | "white";

interface IOItem {
  label: string;
  text: string;
}

interface ServiceSpec {
  tone: Tone;
  number: string;
  title: string;
  inputs: IOItem[];
  output: {
    label: string;
    text: string;
    subItems?: string[];
  };
  href: string;
  cta: string;
}

const SERVICES: ServiceSpec[] = [
  {
    tone: "white",
    number: "1",
    title: "Convert decimal to binary single-precision",
    inputs: [{ label: "a. Input", text: "A decimal number." }],
    output: {
      label: "b. Output",
      text:
        "The IEEE 754 single-precision representation (including special cases like NaN, Infinity, etc.) in:",
      subItems: ["i) Binary with proper spacing", "ii) Hexadecimal"],
    },
    href: "/convert",
    cta: "Try Decimal to Binary",
  },
  {
    tone: "blue",
    number: "2",
    title: "Demonstrate rounding methods",
    inputs: [
      { label: "a. Input", text: "A number in either decimal or binary format." },
      { label: "b. Input", text: "The target number of digits (or bits) for rounding." },
    ],
    output: {
      label: "c. Output",
      text:
        "The rounded results using all four methods: chopping (truncation), round-up, round-down, and round-to-nearest ties-to-even.",
    },
    href: "/round",
    cta: "Try Numeric Rounding",
  },
  {
    tone: "transparent",
    number: "3",
    title: "Perform arithmetic operations (addition and multiplication) using rounding method",
    inputs: [
      { label: "a. Input", text: "Operands in either decimal or IEEE hexadecimal format." },
      { label: "b. Input", text: "The type of operation (addition or multiplication)." },
    ],
    output: {
      label: "c. Output",
      text: "The step-by-step solution and final result (including special cases) in:",
      subItems: ["i) Binary with proper spacing.", "ii) Hexadecimal.", "iii) Decimal."],
    },
    href: "/arithmetic",
    cta: "Try Arithmetic Operation",
  },
];

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

function titleColor(tone: Tone) {
  return tone === "white" ? "#1D2340" : "#F5F7FF";
}
function labelColor(tone: Tone) {
  if (tone === "white") return "#4A527A";
  if (tone === "blue") return "#E3E9F7";
  return "#7C86AD";
}
function bodyColor(tone: Tone) {
  if (tone === "white") return "#3A4266";
  if (tone === "blue") return "#EAEFFB";
  return "#C7CFEE";
}
function badgeStyle(tone: Tone): React.CSSProperties {
  return {
    width: 34,
    height: 34,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "'Space Grotesk', sans-serif",
    fontWeight: 700,
    fontSize: 15,
    flexShrink: 0,
    background: tone === "white" ? "#4B3F72" : "rgba(255,255,255,0.15)",
    color: tone === "white" ? "#EAE3FF" : "#F5F7FF",
  };
}
function ctaStyle(tone: Tone): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    marginTop: 18,
    padding: "9px 16px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
    fontFamily: "'Inter', sans-serif",
    background: tone === "white" ? "#4B3F72" : "rgba(255,255,255,0.14)",
    color: tone === "white" ? "#EAE3FF" : "#F5F7FF",
    border: tone === "transparent" ? "1px solid rgba(143,166,217,0.35)" : "none",
  };
}

export default function HowToUsePage() {
  return (
    <PageShell
      eyebrow="IEEE 754 · Single Precision"
      title="How To Use"
      description="Guide to using IEEE 754 binary single-precision operations. Each service below covers one part of the machine along with the expected input and the exact output it produces."
    >
      {SERVICES.map((service) => (
        <div
          key={service.number}
          style={{
            borderRadius: 14,
            padding: "24px 26px",
            marginBottom: 20,
            ...TONE_CARD_STYLE[service.tone],
          }}
        >
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={badgeStyle(service.tone)}>{service.number}</div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: 17,
                  color: titleColor(service.tone),
                  marginBottom: 14,
                  lineHeight: 1.35,
                }}
              >
                {service.title}
              </div>

              {service.inputs.map((item) => (
                <div key={item.label} style={{ marginBottom: 8 }}>
                  <span
                    style={{
                      fontWeight: 700,
                      color: titleColor(service.tone),
                      fontSize: 13.5,
                    }}
                  >
                    {item.label}:{" "}
                  </span>
                  <span style={{ color: bodyColor(service.tone), fontSize: 13.5 }}>
                    {item.text}
                  </span>
                </div>
              ))}

              <div style={{ marginTop: 10 }}>
                <span
                  style={{
                    fontWeight: 700,
                    color: titleColor(service.tone),
                    fontSize: 13.5,
                  }}
                >
                  {service.output.label}:{" "}
                </span>
                <span style={{ color: bodyColor(service.tone), fontSize: 13.5 }}>
                  {service.output.text}
                </span>

                {service.output.subItems && (
                  <ul style={{ margin: "8px 0 0", paddingLeft: 22 }}>
                    {service.output.subItems.map((sub) => (
                      <li
                        key={sub}
                        style={{
                          color: bodyColor(service.tone),
                          fontSize: 13.5,
                          lineHeight: 1.7,
                          fontFamily: "'JetBrains Mono', monospace",
                        }}
                      >
                        {sub}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Link href={service.href} style={ctaStyle(service.tone)}>
                {service.cta} →
              </Link>
            </div>
          </div>
        </div>
      ))}
    </PageShell>
  );
}
