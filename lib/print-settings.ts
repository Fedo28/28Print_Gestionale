import { prisma } from "@/lib/prisma";
import { assertPrintAdmin } from "@/lib/print-jobs";
import { destinationUnavailable, printColors, printSides } from "@/lib/print-profiles";
import { lockPrintSettings } from "@/lib/print-settings-lock";

function text(form: FormData, key: string, max: number, required = true) {
  const value = String(form.get(key) || "").trim();
  if ((required && !value) || value.length > max || /[\u0000-\u001f]/.test(value)) throw Error(`Campo ${key} non valido.`);
  return value;
}
export function parsePrintProfile(form: FormData) {
  const key = text(form, "key", 80), name = text(form, "name", 100);
  const paperSize = text(form, "paperSize", 2), colorMode = text(form, "colorMode", 10), sides = text(form, "sides", 20);
  const rawCopies = String(form.get("copies") || "");
  const copies = Number(rawCopies);
  if (!/^[A-Z0-9][A-Z0-9_-]{0,79}$/.test(key) || !["A4", "A3"].includes(paperSize) ||
    !Object.hasOwn(printColors, colorMode) || !Object.hasOwn(printSides, sides) || !/^\d{1,3}$/.test(rawCopies) || copies < 1) throw Error("Proprietà del profilo non valide.");
  return { key, name, paperSize, colorMode, sides, copies, paperStock: text(form, "paperStock", 100, false) };
}
export async function savePrintConfiguration(userId: string, form: FormData) {
  await assertPrintAdmin(userId);
  const operation = String(form.get("operation") || "");
  return prisma.$transaction(async tx => {
    await lockPrintSettings(tx);
    if (operation === "printer") {
      const id = text(form, "id", 100, false), name = text(form, "name", 100), preferredFor = text(form, "preferredFor", 10);
      if (!["NONE", "BW", "COLOR"].includes(preferredFor)) throw Error("Preferenza di smistamento non valida.");
      if (id) await tx.printPrinter.update({ where: { id }, data: { name, preferredFor } });
      else await tx.printPrinter.create({ data: { name, preferredFor } });
    } else if (operation === "profile") {
      await tx.printProfile.create({ data: parsePrintProfile(form) });
    } else if (operation === "destination") {
      const key = text(form, "key", 80), name = text(form, "name", 100);
      if (!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(key)) throw Error("Usa una chiave cartella logica con lettere minuscole, numeri e trattini; non un percorso Windows.");
      const [printer, profile, bridge] = await Promise.all([
        tx.printPrinter.findUnique({ where: { id: text(form, "printerId", 100) } }),
        tx.printProfile.findUnique({ where: { id: text(form, "profileId", 100) } }),
        tx.printBridge.findUnique({ where: { id: text(form, "bridgeId", 100) } })
      ]);
      if (!printer || !profile || !bridge) throw Error("Stampante, profilo o Bridge non disponibili.");
      await tx.printDestination.create({ data: { key, name, printerId: printer.id, profileId: profile.id,
        printerName: printer.name, profileKey: profile.key, bridgeId: bridge.id, enabled: false } });
    } else if (operation === "toggle") {
      const id = text(form, "id", 100), kind = text(form, "kind", 20);
      const requested = String(form.get("enabled"));
      if (!["true", "false"].includes(requested)) throw Error("Stato non valido.");
      const enabled = requested === "true";
      if (kind === "printer") {
        await tx.printPrinter.update({ where: { id }, data: { enabled } });
        if (!enabled) await tx.printDestination.updateMany({ where: { printerId: id }, data: { enabled: false } });
      } else if (kind === "profile") {
        await tx.printProfile.update({ where: { id }, data: { enabled } });
        if (!enabled) await tx.printDestination.updateMany({ where: { profileId: id }, data: { enabled: false } });
      }
      else if (kind === "destination") {
        const destination = await tx.printDestination.findUnique({ where: { id }, include: { printer: true, profile: true, bridge: true } });
        if (!destination) throw Error("Destinazione non disponibile.");
        if (enabled) {
          const reason = destinationUnavailable({ ...destination, enabled: true });
          if (reason) throw Error(reason);
          if (form.get("verified") !== "on") throw Error("Conferma la mappatura nel Bridge e le impostazioni effettive della Hot Folder, inclusa la coda in attesa.");
        }
        await tx.printDestination.update({ where: { id }, data: { enabled } });
      } else throw Error("Tipo configurazione non valido.");
    } else throw Error("Operazione non valida.");
  });
}
