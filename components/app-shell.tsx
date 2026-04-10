"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import brandLogo from "../logo.png";

const navItems = [
  { href: "/", label: "Dashboard", icon: "dashboard", tone: "sky" },
  { href: "/customers", label: "Clienti", icon: "customers", tone: "coral" },
  { href: "/orders", label: "Ordini", icon: "orders", tone: "lilac" },
  { href: "/calendar", label: "Calendario", icon: "calendar", tone: "amber" },
  { href: "/production", label: "Produzione", icon: "production", tone: "mint" },
  { href: "/stats", label: "Statistiche", icon: "stats", tone: "sky" },
  { href: "/settings", label: "Impostazioni", icon: "settings", tone: "neutral" }
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login") {
    return <main className="auth-layout">{children}</main>;
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-frame">
          <div className="sidebar-top">
            <Link className="brand brand-compact" href="/">
              <div className="brand-mark">
                <Image
                  alt="28 Print"
                  className="brand-logo"
                  priority
                  sizes="108px"
                  src={brandLogo}
                />
              </div>
              <div className="brand-copy">
                <span className="brand-kicker">Workspace</span>
                <strong>Control room</strong>
                <p>Ordini, clienti e produzione in una vista unica.</p>
              </div>
            </Link>
            <span className="sidebar-caption">Navigazione</span>
          </div>

          <nav aria-label="Navigazione principale" className="nav-list">
            {navItems.map((item) => {
              const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  className={`nav-link nav-tone-${item.tone} ${active ? "active" : ""}`}
                  href={item.href}
                  key={item.href}
                >
                  <span aria-hidden="true" className="nav-icon">
                    <ShellGlyph kind={item.icon} />
                  </span>
                  <span className="nav-copy">
                    <span>{item.label}</span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="sidebar-footer">
            <a className="nav-link nav-link-logout nav-tone-neutral" href="/logout">
              <span aria-hidden="true" className="nav-icon">
                <ShellGlyph kind="logout" />
              </span>
              <span className="nav-copy">
                <span>Logout</span>
              </span>
            </a>
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

function ShellGlyph({
  kind
}: {
  kind: "dashboard" | "customers" | "orders" | "calendar" | "production" | "stats" | "settings" | "logout";
}) {
  const paths = {
    dashboard: (
      <>
        <rect x="4" y="4" width="7" height="7" rx="2" />
        <rect x="13" y="4" width="7" height="4.5" rx="2" />
        <rect x="13" y="10.5" width="7" height="9.5" rx="2" />
        <rect x="4" y="13" width="7" height="7" rx="2" />
      </>
    ),
    customers: (
      <>
        <path d="M12 12a3.5 3.5 0 1 0 0-7a3.5 3.5 0 0 0 0 7Z" />
        <path d="M5.8 19.2a6.2 6.2 0 0 1 12.4 0" />
      </>
    ),
    orders: (
      <>
        <path d="M8 4.5h8" />
        <path d="M8 9h8" />
        <path d="M8 13.5h5" />
        <rect x="4.5" y="3.5" width="15" height="17" rx="3" />
      </>
    ),
    calendar: (
      <>
        <rect x="4" y="5.5" width="16" height="14" rx="3" />
        <path d="M8 3.5v4M16 3.5v4M4 9.5h16" />
      </>
    ),
    production: (
      <>
        <path d="M5 17.5V8.8a1.8 1.8 0 0 1 1-1.6l5.1-2.5a1.8 1.8 0 0 1 1.8 0L18 7.2a1.8 1.8 0 0 1 1 1.6v8.7" />
        <path d="M9 12h6M12 9v6" />
      </>
    ),
    stats: (
      <>
        <path d="M5 19.5V11M12 19.5V7M19 19.5V13" />
        <path d="M3.5 19.5h17" />
      </>
    ),
    settings: (
      <>
        <path d="M12 8.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 0 0 0-7Z" />
        <path d="M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M17.3 6.7l-1.5 1.5M8.2 15.8l-1.5 1.5M17.3 17.3l-1.5-1.5M8.2 8.2L6.7 6.7" />
      </>
    ),
    logout: (
      <>
        <path d="M10 6H7.5A2.5 2.5 0 0 0 5 8.5v7A2.5 2.5 0 0 0 7.5 18H10" />
        <path d="M13 8l4 4l-4 4" />
        <path d="M9 12h8" />
      </>
    )
  };

  return (
    <svg aria-hidden="true" className="glyph" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
      {paths[kind]}
    </svg>
  );
}
