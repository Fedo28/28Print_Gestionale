"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";
import { GlobalSearch } from "@/components/global-search";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  THEMES,
  applyTheme,
  persistTheme,
  readStoredTheme,
  type ThemeName
} from "@/lib/theme";
import brandLogo from "../logo.png";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/customers", label: "Clienti" },
  { href: "/orders", label: "Ordini" },
  { href: "/quotes", label: "Preventivi" },
  { href: "/calendar", label: "Calendario" },
  { href: "/billboards", label: "Cartelloni" },
  { href: "/production", label: "Produzione" },
  { href: "/stats", label: "Statistiche" },
  { href: "/settings", label: "Impostazioni" }
];

const COMPACT_NAV_MEDIA_QUERY = "(max-width: 1180px)";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginRoute = pathname === "/login";
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeName>(DEFAULT_THEME);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasMobileNavOpenRef = useRef(false);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const initialTheme = readStoredTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== THEME_STORAGE_KEY) {
        return;
      }

      const nextTheme = readStoredTheme();
      setTheme(nextTheme);
      applyTheme(nextTheme);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(COMPACT_NAV_MEDIA_QUERY);
    const handleViewportChange = (event: MediaQueryListEvent) => {
      if (!event.matches) {
        setIsMobileNavOpen(false);
      }
    };

    if (!mediaQuery.matches) {
      setIsMobileNavOpen(false);
    }

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleViewportChange);
      return () => mediaQuery.removeEventListener("change", handleViewportChange);
    }

    mediaQuery.addListener(handleViewportChange);
    return () => mediaQuery.removeListener(handleViewportChange);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    document.body.classList.toggle("mobile-nav-open", isMobileNavOpen);
    return () => document.body.classList.remove("mobile-nav-open");
  }, [isMobileNavOpen]);

  useEffect(() => {
    if (!isMobileNavOpen) {
      if (wasMobileNavOpenRef.current) {
        menuButtonRef.current?.focus();
      }
      wasMobileNavOpenRef.current = false;
      return;
    }

    wasMobileNavOpenRef.current = true;
    const focusTarget = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMobileNavOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusTarget);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileNavOpen]);

  if (isLoginRoute) {
    return <main className="auth-layout">{children}</main>;
  }

  function handleCloseMobileNav() {
    setIsMobileNavOpen(false);
  }

  function handleMobileNavLinkClick(_: MouseEvent<HTMLAnchorElement>) {
    handleCloseMobileNav();
  }

  function handleThemeChange(isDarkModeEnabled: boolean) {
    const nextTheme = isDarkModeEnabled ? THEMES.dark : THEMES.light;
    setTheme(nextTheme);
    applyTheme(nextTheme);
    persistTheme(nextTheme);
  }

  function renderNavLinks(options?: { onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void }) {
    return (
      <>
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              className={`nav-link ${active ? "active" : ""}`}
              href={item.href}
              key={item.href}
              onClick={options?.onNavigate}
            >
              <span>{item.label}</span>
            </Link>
          );
        })}
        <a className="nav-link" href="/logout" onClick={options?.onNavigate}>
          <span>Logout</span>
        </a>
      </>
    );
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

          <nav className="nav-list">{renderNavLinks()}</nav>

          <div className="sidebar-utility">
            <ThemeToggle
              checked={theme === THEMES.dark}
              onChange={handleThemeChange}
            />
          </div>
        </div>
      </aside>

      <div className="shell-content">
        <div className="mobile-topbar">
          <Link aria-label="Vai alla dashboard" className="mobile-brand" href="/">
            <Image
              alt="28 Print"
              className="mobile-brand-logo"
              priority
              sizes="120px"
              src={brandLogo}
            />
          </Link>

          <button
            aria-controls="mobile-navigation-drawer"
            aria-expanded={isMobileNavOpen}
            aria-label={isMobileNavOpen ? "Chiudi menu di navigazione" : "Apri menu di navigazione"}
            className="mobile-nav-trigger"
            onClick={() => setIsMobileNavOpen((current) => !current)}
            ref={menuButtonRef}
            type="button"
          >
            <svg aria-hidden="true" className="glyph mobile-nav-trigger-icon" viewBox="0 0 24 24">
              <rect x="4" y="5" width="16" height="3.2" rx="1.6" fill="currentColor" />
              <rect x="4" y="10.4" width="16" height="3.2" rx="1.6" fill="currentColor" />
              <rect x="4" y="15.8" width="16" height="3.2" rx="1.6" fill="currentColor" />
            </svg>
          </button>
        </div>

        <div className={`mobile-nav-layer${isMobileNavOpen ? " open" : ""}`} aria-hidden={!isMobileNavOpen}>
          <button
            aria-label="Chiudi menu di navigazione"
            className="mobile-nav-overlay"
            onClick={handleCloseMobileNav}
            tabIndex={isMobileNavOpen ? 0 : -1}
            type="button"
          />

          <div
            aria-modal="true"
            className="mobile-nav-drawer"
            id="mobile-navigation-drawer"
            role="dialog"
          >
            <div className="mobile-nav-head">
              <div>
                <strong>Menu</strong>
                <div className="subtle">Navigazione rapida del gestionale</div>
              </div>
              <button
                aria-label="Chiudi menu"
                className="mobile-nav-close"
                onClick={handleCloseMobileNav}
                ref={closeButtonRef}
                type="button"
              >
                <span />
                <span />
              </button>
            </div>

            <nav className="nav-list mobile-nav-list">{renderNavLinks({ onNavigate: handleMobileNavLinkClick })}</nav>

            <div className="mobile-nav-foot">
              <ThemeToggle
                checked={theme === THEMES.dark}
                onChange={handleThemeChange}
              />
            </div>
          </div>
        </div>

        <div className="shell-stage">
          <span aria-hidden className="stage-glow stage-glow-a" />
          <span aria-hidden className="stage-glow stage-glow-b" />
          <span aria-hidden className="stage-glow stage-glow-c" />
          <div className="shell-toolbar">
            <GlobalSearch />
          </div>
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}
