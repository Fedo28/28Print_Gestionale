"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import brandLogo from "../logo.png";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/customers", label: "Clienti" },
  { href: "/orders", label: "Ordini" },
  { href: "/calendar", label: "Calendario" },
  { href: "/production", label: "Produzione" },
  { href: "/settings", label: "Impostazioni" }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") {
    return <main className="auth-layout">{children}</main>;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-frame">
          <div className="brand">
            <span className="brand-kicker">Liquid workflow</span>
            <Image
              alt="28 Print"
              className="brand-logo"
              priority
              sizes="170px"
              src={brandLogo}
            />
            <p>Workflow completo per ordini di stampa digitale, dal banco al ritiro.</p>
          </div>

          <nav className="nav-list">
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link className={`nav-link ${active ? "active" : ""}`} href={item.href} key={item.href}>
                  <span>{item.label}</span>
                </Link>
              );
            })}
            <a className="nav-link" href="/logout">
              <span>Logout</span>
            </a>
          </nav>

          <div className="sidebar-meta">
            <span className="meta-label">Studio control</span>
            <strong>Ambiente operativo unificato</strong>
            <p>Clienti, ordini, produzione e ritiro raccolti in un solo spazio visivo.</p>
          </div>
        </div>
      </aside>

      <div className="shell-content">
        <div className="shell-stage">
          <span aria-hidden className="stage-glow stage-glow-a" />
          <span aria-hidden className="stage-glow stage-glow-b" />
          <span aria-hidden className="stage-glow stage-glow-c" />
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}
