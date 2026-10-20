import { describe, expect, it } from "vitest";
import { printConnectionLabel } from "../lib/print-connection";

describe("stato connessione Bridge, non stato stampante", () => {
  const now = Date.UTC(2026, 9, 16, 12);
  it("la revoca prevale su un contatto recente", () => {
    expect(printConnectionLabel(false, new Date(now), now)).toBe("Accesso revocato");
  });
  it("nessun contatto non implica che il programma sia in esecuzione", () => {
    expect(printConnectionLabel(true, null, now)).toBe("In attesa del primo collegamento");
  });
  it("distingue contatto recente, scaduto e orologio incoerente", () => {
    expect(printConnectionLabel(true, new Date(now - 90000), now)).toBe("Collegato di recente");
    expect(printConnectionLabel(true, new Date(now - 90001), now)).toContain("Contatto non recente");
    expect(printConnectionLabel(true, new Date(now + 1000), now)).toContain("Contatto non recente");
  });
});
