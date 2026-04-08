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
  { href: "/quotes", label: "Preventivi" },
  { href: "/calendar", label: "Calendario" },
  { href: "/production", label: "Produzione" },
  { href: "/stats", label: "Statistiche" },
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
            <Image
              alt="28 Print"
              className="brand-logo"
              priority
              sizes="220px"
              src={brandLogo}
            />
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
