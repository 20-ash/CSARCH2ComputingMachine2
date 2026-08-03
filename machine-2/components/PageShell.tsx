"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import DarkVeil from "@/components/DarkVeil";

export default function PageShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        background: "linear-gradient(180deg, #060B24 0%, #0B1339 55%, #101A45 100%)",
        fontFamily: "'Inter', sans-serif",
        overflowX: "hidden",
      }}
    >
      <div
        style={{
          position: "fixed",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
          pointerEvents: "none",
        }}
      >
        <DarkVeil
          hueShift={10}
          noiseIntensity={0}
          scanlineIntensity={0}
          speed={1.5}
          scanlineFrequency={0}
          warpAmount={0}
          resolutionScale={1}
        />
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');

        .bfl-back { transition: color .15s ease, transform .15s ease; }
        .bfl-back:hover { color: #7091df !important; transform: translateX(-3px); }

        .bfl-field:focus { outline: 2px solid #7091df; outline-offset: 2px; }
        .bfl-btn { transition: background .15s ease, transform .15s ease; }
        .bfl-btn:hover { transform: translateY(-1px); }
        .bfl-btn:active { transform: translateY(0); }
        .bfl-btn:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }

        .bfl-mode { transition: background .15s ease, border-color .15s ease, color .15s ease; }
        .bfl-mode:hover { border-color: #7091df; }
      `}</style>

      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(rgba(143,166,217,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(143,166,217,0.055) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />

      <header
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: 1120,
          margin: "0 auto",
          padding: "24px 24px 0",
        }}
      >
        <Link
          href="/"
          className="bfl-back"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: "#A9B3D6",
            textDecoration: "none",
            fontSize: 13.5,
            fontFamily: "'Inter', sans-serif",
          }}
        >
          <ArrowLeft size={15} />
          Back to Home
        </Link>
      </header>

      <section
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: 900,
          margin: "0 auto",
          padding: "36px 24px 12px",
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 14,
            letterSpacing: 2,
            color: "#90a6d0",
            textTransform: "uppercase",
            marginBottom: 14,
          }}
        >
          <b>{eyebrow}</b>
        </div>
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(28px, 4.5vw, 44px)",
            color: "#F5F7FF",
            letterSpacing: 0.3,
            lineHeight: 1.15,
            margin: 0,
          }}
        >
          {title}
        </h1>
        <p
          style={{
            maxWidth: 560,
            margin: "16px auto 0",
            color: "#A9B3D6",
            fontSize: 15,
            lineHeight: 1.6,
          }}
        >
          {description}
        </p>
      </section>

      <main
        style={{
          position: "relative",
          zIndex: 2,
          maxWidth: 900,
          margin: "0 auto",
          padding: "28px 24px 100px",
        }}
      >
        {children}
      </main>
    </div>
  );
}