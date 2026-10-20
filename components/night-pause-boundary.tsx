"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isNightPause, nextOpening, romeMinutes } from "@/bridge/src/service-hours";

export function NightPauseMessage() {
  const [opening, setOpening] = useState("");
  const [closed, setClosed] = useState(true);
  useEffect(() => {
    const update = () => {
      const paused = isNightPause();
      setClosed(paused);
      setOpening(paused ? nextOpening().toLocaleString("it-IT", {
        timeZone: "Europe/Rome", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
      }) : "");
    };
    update();
    const timer = window.setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, background: "#f3f5fa", color: "#182439" }}>
      <section style={{ width: "100%", maxWidth: 560, padding: "40px 28px", borderRadius: 24, background: "#fff", boxShadow: "0 16px 60px #18243912", display: "grid", gap: 14, lineHeight: 1.5 }}>
        <p style={{ fontWeight: 800, letterSpacing: 2, color: "#bc2739" }}>28PRINT · PAUSA NOTTURNA</p>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)", lineHeight: 1.15 }}>{closed ? "Ci ritroviamo alle 08:00." : "Il gestionale è disponibile."}</h1>
        <p>Il gestionale è sospeso ogni giorno dalle <strong>20:00 alle 08:00</strong>, ora italiana, per limitare i consumi.</p>
        <p>Non effettuare modifiche fino alla riapertura. Le operazioni già salvate sono conservate; le modifiche non salvate <strong>non vengono registrate né inviate automaticamente domani</strong>.</p>
        <p>Il Bridge riprenderà i nuovi lavori al mattino, se il PC è acceso e il Bridge attivo. Un invio già iniziato può terminare; i lavori già in attesa su Fiery restano invariati.</p>
        {opening && <p>Prossima apertura: <strong>{opening}</strong>.</p>}
        <a href="/" style={{ display: "inline-block", marginTop: 16, padding: "12px 20px", borderRadius: 10, background: "#182439", color: "#fff", textDecoration: "none" }}>Rientra nel gestionale</a>
      </section>
    </main>
  );
}

export function NightPauseBoundary({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  const pathname = usePathname();
  const exempt = pathname === "/sospensione" || pathname === "/shop" || pathname.startsWith("/shop/");
  const [minutes, setMinutes] = useState<number | null>(null);
  useEffect(() => {
    if (!enabled || exempt) return;
    const update = () => {
      const value = romeMinutes();
      setMinutes(value);
      document.documentElement.dataset.nightPause = String(value < 480 || value >= 1200);
    };
    update();
    const timer = window.setInterval(update, 1000);
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
      delete document.documentElement.dataset.nightPause;
    };
  }, [enabled, exempt]);
  const paused = enabled && !exempt && minutes !== null && (minutes < 480 || minutes >= 1200);
  return <>
    {paused && <NightPauseMessage />}
    {/* Keep mounted form state; do not pretend that this is durable/offline saving. */}
    <div hidden={paused}>
      {enabled && !exempt && minutes !== null && minutes >= 1190 && minutes < 1200 &&
        <div role="status" style={{ padding: 14, background: "#fff0cb", color: "#513600", textAlign: "center" }}>
          Alle 20:00 il gestionale va in pausa fino alle 08:00. Salva ora le modifiche: non vengono salvate automaticamente.
        </div>}
      {children}
    </div>
  </>;
}
