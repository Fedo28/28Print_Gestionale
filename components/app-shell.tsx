"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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

type NavTone = "neutral" | "sky" | "coral" | "lilac" | "rose" | "amber" | "mint" | "teal";
type NavIcon =
  | "dashboard"
  | "customers"
  | "orders"
  | "quotes"
  | "calendar"
  | "billboards"
  | "production"
  | "stats"
  | "settings"
  | "logout";

const navItems = [
  { href: "/", label: "Dashboard", icon: "dashboard", tone: "sky" },
  { href: "/customers", label: "Clienti", icon: "customers", tone: "coral" },
  { href: "/orders", label: "Ordini", icon: "orders", tone: "lilac" },
  { href: "/quotes", label: "Preventivi", icon: "quotes", tone: "rose" },
  { href: "/calendar", label: "Calendario", icon: "calendar", tone: "amber" },
  { href: "/billboards", label: "Cartelloni", icon: "billboards", tone: "teal" },
  { href: "/production", label: "Produzione", icon: "production", tone: "mint" },
  { href: "/stats", label: "Statistiche", icon: "stats", tone: "sky" }
] as const satisfies ReadonlyArray<{
  href: string;
  label: string;
  icon: NavIcon;
  tone: NavTone;
}>;

const COMPACT_NAV_MEDIA_QUERY = "(max-width: 1180px)";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isLoginRoute = pathname === "/login";
  const isPrintRoute = pathname.endsWith("/print");
  const isDashboardRoute = pathname === "/";
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeName>(DEFAULT_THEME);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const wasMobileNavOpenRef = useRef(false);
  const wasMobileSearchOpenRef = useRef(false);

  useEffect(() => {
    setIsMobileNavOpen(false);
    setIsMobileSearchOpen(false);
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
    const schedulePrefetch = () => {
      for (const item of navItems) {
        router.prefetch(item.href);
      }
      router.prefetch("/orders/new");
      router.prefetch("/quotes/new");
    };

    const supportsIdleCallback = "requestIdleCallback" in window && "cancelIdleCallback" in window;
    const prefetchHandle = supportsIdleCallback
      ? window.requestIdleCallback(schedulePrefetch)
      : window.setTimeout(schedulePrefetch, 180);

    return () => {
      if (supportsIdleCallback) {
        window.cancelIdleCallback(prefetchHandle);
        return;
      }

      window.clearTimeout(prefetchHandle);
    };
  }, [router]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(COMPACT_NAV_MEDIA_QUERY);
    const syncViewport = (matches: boolean) => {
      setIsCompactViewport(matches);
      if (!matches) {
        setIsMobileNavOpen(false);
        setIsMobileSearchOpen(false);
      }
    };

    const handleViewportChange = (event: MediaQueryListEvent) => {
      syncViewport(event.matches);
    };

    syncViewport(mediaQuery.matches);

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

    document.body.classList.toggle("mobile-nav-open", isMobileNavOpen || isMobileSearchOpen);
    document.body.classList.toggle("mobile-menu-open", isMobileNavOpen);
    return () => {
      document.body.classList.remove("mobile-nav-open");
      document.body.classList.remove("mobile-menu-open");
    };
  }, [isMobileNavOpen, isMobileSearchOpen]);

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

  useEffect(() => {
    if (!isMobileSearchOpen) {
      if (wasMobileSearchOpenRef.current) {
        searchButtonRef.current?.focus();
      }
      wasMobileSearchOpenRef.current = false;
      return;
    }

    wasMobileSearchOpenRef.current = true;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsMobileSearchOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileSearchOpen]);

  if (isLoginRoute) {
    return <main className="auth-layout">{children}</main>;
  }

  if (isPrintRoute) {
    return <main className="print-route-layout">{children}</main>;
  }

  function handleCloseMobileNav() {
    setIsMobileNavOpen(false);
  }

  function handleCloseMobileSearch() {
    setIsMobileSearchOpen(false);
  }

  function handleMobileNavLinkClick(_: MouseEvent<HTMLAnchorElement>) {
    handleCloseMobileNav();
  }

  function handleOpenMobileNav() {
    setIsMobileSearchOpen(false);
    setIsMobileNavOpen((current) => !current);
  }

  function handleOpenMobileSearch() {
    setIsMobileNavOpen(false);
    setIsMobileSearchOpen((current) => !current);
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
              className={`nav-link nav-tone-${item.tone} ${active ? "active" : ""}`}
              href={item.href}
              key={item.href}
              onClick={options?.onNavigate}
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
              height={132}
              priority
              sizes="220px"
              src={brandLogo}
              width={132}
            />
          </div>

          <nav className="nav-list">{renderNavLinks()}</nav>
        </div>
      </aside>

      <div className="shell-content">
        <div className="mobile-topbar">
          <Link aria-label="Vai alla dashboard" className="mobile-brand" href="/">
            <Image
              alt="28 Print"
              className="mobile-brand-logo"
              height={112}
              priority
              sizes="120px"
              src={brandLogo}
              width={112}
            />
          </Link>

          <button
            aria-controls="mobile-search-sheet"
            aria-expanded={isMobileSearchOpen}
            aria-label={isMobileSearchOpen ? "Chiudi ricerca globale" : "Apri ricerca globale"}
            className="mobile-search-trigger"
            onClick={handleOpenMobileSearch}
            ref={searchButtonRef}
            type="button"
          >
            <svg aria-hidden="true" className="glyph mobile-search-trigger-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
              <path d="m21 21-4.35-4.35M10.5 18a7.5 7.5 0 1 0 0-15a7.5 7.5 0 0 0 0 15Z" />
            </svg>
            <span className="mobile-search-trigger-copy">
              <span className="mobile-search-trigger-label">Cerca</span>
              <span className="mobile-search-trigger-hint">Ordini, clienti, cartelloni</span>
            </span>
          </button>

          <button
            aria-controls="mobile-navigation-drawer"
            aria-expanded={isMobileNavOpen}
            aria-label={isMobileNavOpen ? "Chiudi menu di navigazione" : "Apri menu di navigazione"}
            className="mobile-nav-trigger"
            onClick={handleOpenMobileNav}
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

        <div className={`mobile-search-layer${isMobileSearchOpen ? " open" : ""}`} aria-hidden={!isMobileSearchOpen}>
          <button
            aria-label="Chiudi ricerca globale"
            className="mobile-search-overlay"
            onClick={handleCloseMobileSearch}
            tabIndex={isMobileSearchOpen ? 0 : -1}
            type="button"
          />

          <div
            aria-modal="true"
            className="mobile-search-sheet"
            id="mobile-search-sheet"
            role="dialog"
          >
            <div className="mobile-search-head">
              <div>
                <strong>Ricerca</strong>
                <div className="subtle">Trova ordini, clienti, preventivi, impianti e catalogo.</div>
              </div>
              <button
                aria-label="Chiudi ricerca"
                className="mobile-search-close"
                onClick={handleCloseMobileSearch}
                type="button"
              >
                <span />
                <span />
              </button>
            </div>

            <GlobalSearch
              autoFocus={isCompactViewport && isMobileSearchOpen}
              onNavigate={handleCloseMobileSearch}
              variant="mobile-sheet"
            />
          </div>
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
            <div className="mobile-nav-utilities">
              <div className="mobile-nav-section-label">Utility rapide</div>
              <ThemeToggle
                checked={theme === THEMES.dark}
                className="mobile-drawer-theme-toggle"
                hint="Tema serale"
                label="Dark mode"
                onChange={handleThemeChange}
              />
              <Link
                className="mobile-nav-utility-link"
                href="/settings"
                onClick={handleMobileNavLinkClick}
              >
                <span aria-hidden="true" className="nav-icon">
                  <ShellGlyph kind="settings" />
                </span>
                <span className="nav-copy">
                  <span>Impostazioni</span>
                </span>
              </Link>
              <a className="mobile-nav-utility-link mobile-nav-utility-link-logout" href="/logout" onClick={handleCloseMobileNav}>
                <span aria-hidden="true" className="nav-icon">
                  <ShellGlyph kind="logout" />
                </span>
                <span className="nav-copy">
                  <span>Logout</span>
                </span>
              </a>
            </div>
          </div>
        </div>

        <div className={`shell-stage${isDashboardRoute ? " dashboard-stage-shell" : ""}`}>
          <span aria-hidden className="stage-glow stage-glow-a" />
          <span aria-hidden className="stage-glow stage-glow-b" />
          <span aria-hidden className="stage-glow stage-glow-c" />
          {!isCompactViewport ? (
            <div className="shell-toolbar">
              <GlobalSearch />
              <div className="shell-toolbar-actions">
                <ThemeToggle
                  checked={theme === THEMES.dark}
                  className="toolbar-theme-toggle"
                  hint="Tema serale"
                  label="Dark mode"
                  onChange={handleThemeChange}
                />
                <Link
                  aria-label="Apri impostazioni"
                  className="shell-toolbar-icon-link shell-toolbar-settings-link"
                  href="/settings"
                >
                  <ShellGlyph kind="settings" />
                </Link>
                <a
                  className="shell-toolbar-link"
                  href="/logout"
                >
                  <span aria-hidden="true" className="shell-toolbar-link-icon">
                    <ShellGlyph kind="logout" />
                  </span>
                  <span>Logout</span>
                </a>
              </div>
            </div>
          ) : null}
          <main>{children}</main>
        </div>
      </div>
    </div>
  );
}

function ShellGlyph({ kind }: { kind: NavIcon }) {
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
    quotes: (
      <>
        <path d="M7 4.5h7l4 4v10a2 2 0 0 1-2 2H7A2.5 2.5 0 0 1 4.5 18V7A2.5 2.5 0 0 1 7 4.5Z" />
        <path d="M14 4.5V9h4" />
        <path d="M8.5 13h7M8.5 16h4.5" />
      </>
    ),
    calendar: (
      <>
        <rect x="4" y="5.5" width="16" height="14" rx="3" />
        <path d="M8 3.5v4M16 3.5v4M4 9.5h16" />
      </>
    ),
    billboards: (
      <>
        <rect x="4.5" y="5" width="15" height="9" rx="2.5" />
        <path d="M9 14v5M15 14v5M7 19h10" />
        <path d="M8 8h8M8 11h5" />
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
      <path
        clipRule="evenodd"
        d="M10.68 2.75a1 1 0 0 1 1.64 0l1.04 1.5a1 1 0 0 0 1.16.39l1.75-.57a1 1 0 0 1 1.31.98l-.06 1.82a1 1 0 0 0 .74.98l1.75.48a1 1 0 0 1 .5 1.56l-1.12 1.43a1 1 0 0 0 0 1.24l1.12 1.43a1 1 0 0 1-.5 1.56l-1.75.48a1 1 0 0 0-.74.98l.06 1.82a1 1 0 0 1-1.31.98l-1.75-.57a1 1 0 0 0-1.16.39l-1.04 1.5a1 1 0 0 1-1.64 0l-1.04-1.5a1 1 0 0 0-1.16-.39l-1.75.57a1 1 0 0 1-1.31-.98l.06-1.82a1 1 0 0 0-.74-.98l-1.75-.48a1 1 0 0 1-.5-1.56l1.12-1.43a1 1 0 0 0 0-1.24L2.99 9.6a1 1 0 0 1 .5-1.56l1.75-.48a1 1 0 0 0 .74-.98l-.06-1.82a1 1 0 0 1 1.31-.98l1.75.57a1 1 0 0 0 1.16-.39l1.04-1.5ZM12 8.25a3.75 3.75 0 1 0 0 7.5a3.75 3.75 0 0 0 0-7.5Z"
        fill="currentColor"
        fillRule="evenodd"
        stroke="none"
      />
    ),
    logout: (
      <>
        <path d="M10 6H7.5A2.5 2.5 0 0 0 5 8.5v7A2.5 2.5 0 0 0 7.5 18H10" />
        <path d="M13 8l4 4l-4 4" />
        <path d="M9 12h8" />
      </>
    )
  } satisfies Record<NavIcon, ReactNode>;

  return (
    <svg
      aria-hidden="true"
      className="glyph"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      {paths[kind]}
    </svg>
  );
}
