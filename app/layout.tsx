import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { DEFAULT_THEME, themeBootstrapScript } from "@/lib/theme";
import brandLogo from "../logo.png";
import "./globals.css";

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
      </head>
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
