import { describe, it, expect } from "vitest";
import { PROFILE } from "../bridge/src/protocol";
import { destinationUnavailable, recommendDestination, supportedPrintProfile, profileDescription } from "../lib/print-profiles";
import { parsePrintProfile } from "../lib/print-settings";
const profile = { id: "legacy", name: "A4 test", key: PROFILE, paperSize: "A4", colorMode: "BW", sides: "SIMPLEX", copies: 1, paperStock: "", enabled: true };
const destination = (id: string, preferredFor: string) => ({ id, name: id, profileKey: PROFILE, enabled: true, bridge: { enabled: true },
  printer: { name: id, preferredFor, enabled: true }, profile });
describe("profili, compatibilita e smistamento", () => {
  it("il profilo legacy mantiene esattamente il contratto del Bridge installato", () => {
    expect(supportedPrintProfile(profile)).toBe(true);
    for (const change of [{ key: "UNVERIFIED" }, { paperSize: "A3" }, { colorMode: "COLOR" }, { sides: "DUPLEX_LONG" }, { copies: 2 }, { paperStock: "300g" }]) {
      expect(supportedPrintProfile({ ...profile, ...change })).toBe(false);
    }
    expect(profileDescription(profile)).toContain("1 copia");
    expect(profileDescription(profile)).toContain("in attesa");
  });
  it("preferenza riguarda solo destinazioni abilitate del profilo richiesto", () => {
    const normal = destination("IPC650", "COLOR"), preferred = destination("C7260", "BW");
    expect(recommendDestination([normal, preferred], "BW", "legacy")?.id).toBe("C7260");
    expect(recommendDestination([normal, { ...preferred, enabled: false }], "BW", "legacy")?.id).toBe("IPC650");
    expect(recommendDestination([normal], "COLOR")).toBeUndefined();
    expect(recommendDestination([normal], "BW", "other-profile")).toBeUndefined();
  });
  it("non consiglia profili incompleti, disabilitati o non supportati", () => {
    const d = destination("A", "BW");
    expect(destinationUnavailable(d)).toBeNull();
    for (const changed of [{ ...d, profile: null }, { ...d, printer: null }, { ...d, bridge: { enabled: false } },
      { ...d, printer: { ...d.printer, enabled: false } }, { ...d, profile: { ...profile, enabled: false } },
      { ...d, profileKey: "WRONG" }]) expect(destinationUnavailable(changed)).toBeTruthy();
  });
  it("valida i dati sul server e non accetta copie variabili o campi arbitrari", () => {
    const form = new FormData();
    for (const [k, v] of Object.entries({ key: "A3_COLOR", name: "A3 colore", paperSize: "A3", colorMode: "COLOR", sides: "DUPLEX_LONG", copies: "2" })) form.set(k, v);
    expect(parsePrintProfile(form).copies).toBe(2);
    for (const value of ["0", "-1", "1.5", "1000", "1e2", ""]) {
      form.set("copies", value); expect(() => parsePrintProfile(form)).toThrow();
    }
    form.set("copies", "1"); form.set("colorMode", "__proto__"); expect(() => parsePrintProfile(form)).toThrow();
  });
});
