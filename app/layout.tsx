import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { DEFAULT_THEME, themeBootstrapScript } from "@/lib/theme";
import brandLogo from "../logo.png";
import "./globals.css";

const devAssetRecoveryScript = `
(() => {
  if (typeof window === "undefined") return;

  const reloadKey = "__dev_asset_recovery__";
  let reloadScheduled = false;

  const shouldReload = () => {
    try {
      const last = Number(window.sessionStorage.getItem(reloadKey) || "0");
      return Number.isNaN(last) || Date.now() - last > 4000;
    } catch {
      return true;
    }
  };

  const reloadPage = () => {
    if (reloadScheduled || !shouldReload()) return;
    reloadScheduled = true;

    try {
      window.sessionStorage.setItem(reloadKey, String(Date.now()));
    } catch {}

    const url = new URL(window.location.href);
    url.searchParams.set("__dev_reload", String(Date.now()));
    window.location.replace(url.toString());
  };

  const matchesAssetFailure = (message) =>
    /ChunkLoadError|Loading CSS chunk|Failed to fetch dynamically imported module|CSS_CHUNK_LOAD_FAILED/i.test(message || "");

  window.addEventListener(
    "error",
    (event) => {
      const target = event.target;
      const resourceUrl =
        target instanceof HTMLLinkElement ? target.href || "" : target instanceof HTMLScriptElement ? target.src || "" : "";

      if (resourceUrl.includes("/_next/")) {
        reloadPage();
        return;
      }

      const message =
        typeof event.message === "string"
          ? event.message
          : event.error instanceof Error
            ? event.error.message
            : "";

      if (matchesAssetFailure(message)) {
        reloadPage();
      }
    },
    true
  );

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : typeof reason?.message === "string"
            ? reason.message
            : "";

    if (matchesAssetFailure(message)) {
      reloadPage();
    }
  });
})();
`;

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body"
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: "Gestionale 28 Print",
  description: "Gestionale ordini per stampa digitale",
  applicationName: "Gestionale 28 Print",
  icons: {
    icon: [
      { url: brandLogo.src, type: "image/png" }
    ],
    shortcut: [
      { url: brandLogo.src, type: "image/png" }
    ],
    apple: [
      { url: brandLogo.src, type: "image/png" }
    ]
  }
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html data-theme={DEFAULT_THEME} lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
        {process.env.NODE_ENV !== "production" ? (
          <>
            <meta content="no-store, no-cache, must-revalidate, proxy-revalidate" httpEquiv="Cache-Control" />
            <meta content="no-cache" httpEquiv="Pragma" />
            <meta content="0" httpEquiv="Expires" />
            <script dangerouslySetInnerHTML={{ __html: devAssetRecoveryScript }} />
          </>
        ) : null}
      </head>
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
