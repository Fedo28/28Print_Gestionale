import { NightPauseMessage } from "@/components/night-pause-boundary";

export const metadata = { title: "Pausa notturna · 28PRINT", robots: { index: false, follow: false } };

// No authentication, DB, polling or dynamic data on this page.
export default function SuspensionPage() {
  return <NightPauseMessage />;
}
