"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Menu, X, Info, Binary, ArrowLeftRight, Sigma, ChevronDown } from "lucide-react";
import DarkVeil from "@/components/DarkVeil";

const NAV_LINKS = [
  { id: "use", label: "How To Use", icon: Info, href: "/how-to-use" },
  { id: "convert", label: "Decimal to Binary", icon: Binary, href: "/convert" },
  { id: "round", label: "Numeric Rounding", icon: ArrowLeftRight, href: "/round" },
  { id: "arithmetic", label: "Arithmetic Operation", icon: Sigma, href: "/arithmetic" },
];

const SERVICE_CARDS = [
  {
    id: "convert",
    icon: Binary,
    title: "Decimal to Binary",
    desc: "Step into how a decimal number becomes sign, exponent, and mantissa.",
    href: "/convert",
  },
  {
    id: "round",
    icon: ArrowLeftRight,
    title: "Numeric Rounding",
    desc: "Compare rounding methods and see how the stored value shifts.",
    href: "/round",
  },
  {
    id: "arithmetic",
    icon: Sigma,
    title: "Arithmetic Operation",
    desc: "Add or multiply two floats and trace the rounding at every step.",
    href: "/arithmetic",
  },
];

export default function MainPage() {
  const [scrollY, setScrollY] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY || 0);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const heroFadeDistance = 420;
  const heroOpacity = Math.max(0, 1 - scrollY / heroFadeDistance);
  const heroTranslate = Math.min(scrollY * 0.25, 90);

  const navThreshold = 180;
  const navOpacity = Math.min(1, Math.max(0, (scrollY - navThreshold) / 140));
  const navVisible = navOpacity > 0.02;

  const closeMenu = useCallback(() => setMenuOpen(false), []);

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
 
        @keyframes floatY { 0%,100% { transform: translateY(0); } 50% { transform: translateY(14px); } }
        @keyframes spinSlow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes chevronBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
        @keyframes scanline { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
        @keyframes glowPulse { 0%,100% { box-shadow: 0 0 0 rgba(69,196,176,0); } 50% { box-shadow: 0 0 24px rgba(69,196,176,0.25); } }
        @keyframes dropIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
 
        .bfl-ring { animation: spinSlow 40s linear infinite; }
        .bfl-crystal { animation: floatY 6s ease-in-out infinite; }
        .bfl-chevron { animation: chevronBounce 2.2s ease-in-out infinite; }
        .bfl-scanline { animation: scanline 6s linear infinite; }
 
        .bfl-card { transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
        .bfl-card:hover { transform: translateY(-12px); border-color: #7091df; }
        .bfl-card:focus-visible { outline: 2px solid #7091df; outline-offset: 3px; }
 
        .bfl-navlink { transition: background .15s ease, color .15s ease; }
        .bfl-navlink:hover { background: rgba(69,196,176,0.12); color: #7091df !important; }
 
        .bfl-menubtn { transition: background .15s ease, border-color .15s ease; }
        .bfl-menubtn:hover { border-color: #7091df !important; }
      `}</style>

      <div
        className="bfl-scanline"
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          top: 0,
          height: "40%",
          background: "linear-gradient(180deg, rgba(69,196,176,0) 0%, rgba(69,196,176,0.05) 50%, rgba(69,196,176,0) 100%)",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

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

      {/* ================= navbar ================= */}
      <header
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 30,
          opacity: navOpacity,
          pointerEvents: navVisible ? "auto" : "none",
          transform: `translateY(${navVisible ? 0 : -12}px)`,
          transition: "transform .25s ease",
          background: "rgba(32, 10, 84, 0.72)",
          backdropFilter: "blur(10px)",
          borderBottom: "1px solid rgba(143,166,217,0.15)",
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 700,
                fontSize: 15.5,
                color: "#F5F7FF",
                letterSpacing: 0.4,
              }}
            >
              BINARY 32-BIT MACHINE
            </span>
          </div>

          <div style={{ position: "relative" }}>
            <button
              className="bfl-menubtn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(14,23,64,0.8)",
                border: "1px solid rgba(143,166,217,0.3)",
                borderRadius: 8,
                padding: "8px 14px",
                color: "#EAEFFF",
                fontSize: 13.5,
                fontFamily: "'Inter', sans-serif",
                cursor: "pointer",
              }}
            >
              {menuOpen ? <X size={16} /> : <Menu size={16} />}
              Menu
            </button>

            {menuOpen && (
              <>
                <div
                  onClick={closeMenu}
                  style={{ position: "fixed", inset: 0, zIndex: 29 }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 10px)",
                    right: 0,
                    minWidth: 230,
                    background: "#0E1740",
                    border: "1px solid rgba(143,166,217,0.25)",
                    borderRadius: 12,
                    padding: 8,
                    zIndex: 31,
                    animation: "dropIn .18s ease",
                    boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
                  }}
                >
                  {NAV_LINKS.map((link) => {
                    const Icon = link.icon;
                    return (
                      <a
                        key={link.id}
                        href={link.href}
                        className="bfl-navlink"
                        onClick={closeMenu}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "9px 10px",
                          borderRadius: 8,
                          color: "#C7CFEE",
                          textDecoration: "none",
                          fontSize: 13.5,
                        }}
                      >
                        <Icon size={15} color="#6891ea" />
                        {link.label}
                      </a>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ================= main hero ================= */}
      <section
        style={{
          position: "relative",
          zIndex: 2,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "24px",
          opacity: heroOpacity,
          transform: `translateY(${-heroTranslate}px)`,
        }}
      >

        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 20.5,
            letterSpacing: 2,
            color: "#90a6d0",
            textTransform: "uppercase",
            marginBottom: 18,
          }}
        >
          <span><b>IEEE 754 · single precision</b></span>
        </div>

        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: "clamp(34px, 6vw, 62px)",
            color: "#F5F7FF",
            letterSpacing: 0.5,
            lineHeight: 1.1,
            margin: "0 auto",
            maxWidth: 800,
          }}
        >
          BINARY 32-BIT FLOATING-POINT MACHINE
        </h1>

        <p
          style={{
            maxWidth: 500,
            margin: "20px auto 0",
            color: "#A9B3D6",
            fontSize: 16,
            lineHeight: 1.65,
          }}
        >
          Convert decimal to binary single-precision, apply rounding methods, and perform arithmetic operations.  
        </p>

        <div className="bfl-chevron" style={{ marginTop: 46, color: "#4580c4" }}>
          <ChevronDown size={50} />
        </div>
      </section>

      {/* ================= diff service cards ================= */}
      <section style={{ position: "relative", zIndex: 2, maxWidth: 1080, margin: "0 auto", padding: "0 24px 100px" }}>
        <div
          style={{
            background: "#5D739C",
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderRadius: 10,
            marginBottom: 36,
          }}
        >
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: "clamp(15px, 2.2vw, 20px)",
              color: "#F5F7FF",
            }}
          >
            Click which operation you want to test and explore
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
          {SERVICE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <a
                key={card.id}
                href={card.href}
                className="bfl-card"
                style={{
                  display: "block",
                  background: "#EDEFF7",
                  borderRadius: 16,
                  padding: "28px 22px",
                  border: "2px solid transparent",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                  textDecoration: "none",
                }}
              >
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: 12,
                    background: "#4B3F72",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 18,
                  }}
                >
                  <Icon size={22} color="#EAE3FF" />
                </div>
                <div
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    fontSize: 17,
                    color: "#1D2340",
                    marginBottom: 6,
                  }}
                >
                  {card.title}
                </div>
                <div style={{ fontSize: 13, color: "#4A527A", lineHeight: 1.5 }}>{card.desc}</div>
              </a>
            );
          })}
        </div>

        <p style={{ textAlign: "center", color: "#7C86AD", fontSize: 13, marginTop: 57 }}>
          <b>ⓘ  CSARCH2 Case Project 1</b>. De Leon, Galvez, Guillermo, Lee, Tiu.
        </p>
      </section>
    </div>
  );
}
