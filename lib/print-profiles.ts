import { PROFILE } from "@/bridge/src/protocol";

export const printColors = { BW: "Bianco e nero", COLOR: "Colore" } as const;
export const printSides = { SIMPLEX: "Solo fronte", DUPLEX_LONG: "Fronte/retro lato lungo", DUPLEX_SHORT: "Fronte/retro lato corto" } as const;
export type ProfileProperties = { key: string; paperSize: string; colorMode: string; sides: string; copies: number; paperStock: string };
export function profileDescription(p: ProfileProperties) {
  return `${p.paperSize} · ${printColors[p.colorMode as keyof typeof printColors]} · ${printSides[p.sides as keyof typeof printSides]} · ${p.copies} ${p.copies === 1 ? "copia" : "copie"} · ${p.paperStock || "carta della Hot Folder"} · in attesa`;
}
export function supportedPrintProfile(p: ProfileProperties) {
  // The currently installed Bridge accepts this exact immutable contract only.
  return p.key === PROFILE && p.paperSize === "A4" && p.colorMode === "BW" && p.sides === "SIMPLEX" && p.copies === 1 && p.paperStock === "";
}
type Destination = { id: string; name: string; enabled: boolean; profileKey: string; bridge: { enabled: boolean };
  printer: { name: string; enabled: boolean; preferredFor: string } | null;
  profile: (ProfileProperties & { name: string; enabled: boolean }) | null };
export function destinationUnavailable(d: Destination): string | null {
  if (!d.enabled) return "Destinazione disabilitata / da configurare sul PC";
  if (!d.bridge.enabled) return "Bridge revocato";
  if (!d.printer || !d.profile) return "Configurazione stampante/profilo incompleta";
  if (!d.printer.enabled) return "Stampante disabilitata";
  if (!d.profile.enabled) return "Profilo disabilitato";
  if (d.profileKey !== d.profile.key || !supportedPrintProfile(d.profile)) return "Profilo preparato: richiede supporto nel Bridge e collaudo della Hot Folder";
  return null;
}
export function recommendDestination<T extends Destination>(items: T[], colorMode: string, profileId?: string): T | undefined {
  return items.filter(d => !destinationUnavailable(d) && d.profile?.colorMode === colorMode &&
    (!profileId || (d.profile as ProfileProperties & { id?: string })?.id === profileId))
    .sort((a, b) => Number(b.printer?.preferredFor === colorMode) - Number(a.printer?.preferredFor === colorMode) ||
      a.printer!.name.localeCompare(b.printer!.name, "it") || a.id.localeCompare(b.id))[0];
}
