import { sanitizeAttachmentFileName } from "@/lib/attachment-utils";

export type ShopPhotoFitMode = "contain" | "cover";
export type ShopPhotoSubject = { fileName: string; copies: number; fitMode: ShopPhotoFitMode };

export function isShopPhotoFitMode(value: unknown): value is ShopPhotoFitMode {
  return value === "contain" || value === "cover";
}

export function formatShopPhotoFitMode(mode: ShopPhotoFitMode) {
  return mode === "cover" ? "Riempi formato (ritaglio centrale)" : "Foto intera (eventuali bordi bianchi)";
}

export function isShopPhotoSource(sourcePath: unknown) {
  return String(sourcePath || "").split("?")[0] === "/shop/servizi/stampa-foto";
}

export function isShopPhotoUploadStorageReady(vercelRuntime: unknown) {
  // Private shop files still use the local filesystem, which is not persistent on Vercel.
  return vercelRuntime !== "1";
}

export function validateShopPhotoSelection(input: {
  sourcePath: unknown;
  selection: unknown;
  quantity: unknown;
}): string | null {
  if (!isShopPhotoSource(input.sourcePath)) return null;
  const selection = input.selection && typeof input.selection === "object"
    ? input.selection as Record<string, unknown>
    : null;
  const names = selection?.subjectFileNames;
  const quantities = selection?.subjectQuantities;
  const fitModes = selection?.subjectFitModes;
  if (!Array.isArray(names) || !Array.isArray(quantities) || names.length < 1 || names.length > 200 || names.length !== quantities.length) {
    return "Controlla le foto caricate prima di continuare.";
  }
  if ((selection?.subjectPricingMode !== "per-subject" && selection?.subjectPricingMode !== "total-quantity") ||
      selection?.subjectCount !== names.length) {
    return "Controlla la quantita delle foto prima di continuare.";
  }
  if (names.some((name) => typeof name !== "string" || name.length > 255 || !sanitizeAttachmentFileName(name).trim()) ||
      quantities.some((value) => !Number.isInteger(value) || value < 1 || value > 999)) {
    return "Controlla i nomi e le copie delle foto.";
  }
  if (fitModes !== undefined && fitModes !== null &&
      (!Array.isArray(fitModes) || fitModes.length !== names.length || fitModes.some((mode) => !isShopPhotoFitMode(mode)))) {
    return "Controlla l'adattamento delle foto.";
  }
  const total = quantities.reduce((sum: number, value: number) => sum + value, 0);
  return Number(input.quantity) === total ? null : "Il totale delle copie non corrisponde alle foto selezionate.";
}

export function readShopPhotoSubjects(configuration: unknown): ShopPhotoSubject[] | null {
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) return null;
  const orderConfig = configuration as Record<string, unknown>;
  if (!isShopPhotoSource(orderConfig.sourcePath)) return null;
  const customization = orderConfig.catalogCustomization;
  const subjects = customization && typeof customization === "object" && !Array.isArray(customization)
    ? (customization as Record<string, unknown>).subjects
    : null;
  const subjectRecord = subjects && typeof subjects === "object" && !Array.isArray(subjects)
    ? subjects as Record<string, unknown>
    : null;
  const names = subjectRecord?.subjectFileNames;
  const quantities = subjectRecord?.subjectQuantities;
  const fitModes = subjectRecord?.subjectFitModes;
  // Older photo orders have no per-file names. Preserve their existing checkout path.
  if (!Array.isArray(names) || !Array.isArray(quantities)) return null;
  if (names.length !== quantities.length) return [];
  if (fitModes !== undefined && (!Array.isArray(fitModes) || (fitModes.length !== 0 && fitModes.length !== names.length))) return [];
  return names.map((name, index) => ({
    fileName: sanitizeAttachmentFileName(String(name || "")),
    copies: Number(quantities[index]),
    fitMode: Array.isArray(fitModes) && isShopPhotoFitMode(fitModes[index]) ? fitModes[index] : "contain"
  }));
}

export function areShopPhotoFilesComplete(subjects: ShopPhotoSubject[] | null, uploadedNames: string[]) {
  if (subjects === null) return true;
  if (!subjects.length || subjects.length !== uploadedNames.length) return false;
  const remaining = new Map<string, number>();
  subjects.forEach(({ fileName, copies }) => {
    if (!fileName || !Number.isInteger(copies) || copies < 1) return;
    remaining.set(fileName, (remaining.get(fileName) || 0) + 1);
  });
  if ([...remaining.values()].reduce((sum, count) => sum + count, 0) !== subjects.length) return false;
  for (const name of uploadedNames) {
    const count = remaining.get(name) || 0;
    if (!count) return false;
    remaining.set(name, count - 1);
  }
  return [...remaining.values()].every((count) => count === 0);
}

export function getMissingShopPhotoFileNames(subjects: ShopPhotoSubject[] | null, uploadedNames: string[]) {
  if (subjects === null) return [];
  const remaining = [...uploadedNames];
  return subjects.flatMap(({ fileName }) => {
    const index = remaining.indexOf(fileName);
    if (index >= 0) {
      remaining.splice(index, 1);
      return [];
    }
    return [fileName];
  });
}
