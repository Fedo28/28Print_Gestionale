export const shopPrintFormatValues = ["A6", "A5", "A4", "A3", "SA3", "A2", "A1", "A0"] as const;
export const shopPrintColorModeValues = ["BLACK_WHITE", "COLOR"] as const;
export const shopPrintSidesModeValues = ["FRONT_ONLY", "DOUBLE_SIDED"] as const;
export const shopPrintPaperTypeValues = ["USOMANO", "PATINATA_LUCIDA"] as const;
export const shopPrintBindingValues = ["NONE", "STAPLED", "SPIRAL"] as const;
export const shopPrintPaperStockValuesByType = {
  USOMANO: ["USOMANO_80", "USOMANO_100", "USOMANO_200", "USOMANO_300"],
  PATINATA_LUCIDA: ["PATINATA_LUCIDA_115", "PATINATA_LUCIDA_170"]
} as const;

export type ShopPrintFormat = (typeof shopPrintFormatValues)[number];
export type ShopPrintColorMode = (typeof shopPrintColorModeValues)[number];
export type ShopPrintSidesMode = (typeof shopPrintSidesModeValues)[number];
export type ShopPrintPaperType = (typeof shopPrintPaperTypeValues)[number];
export type ShopPrintBinding = (typeof shopPrintBindingValues)[number];
export type ShopPrintPaperStock =
  | (typeof shopPrintPaperStockValuesByType.USOMANO)[number]
  | (typeof shopPrintPaperStockValuesByType.PATINATA_LUCIDA)[number];

export type ShopPrintConfiguration = {
  format: ShopPrintFormat;
  colorMode: ShopPrintColorMode;
  sidesMode: ShopPrintSidesMode;
  paperType: ShopPrintPaperType;
  paperStock: ShopPrintPaperStock;
  binding: ShopPrintBinding;
};

export type ShopPrintConfigurationInput = Partial<Record<keyof ShopPrintConfiguration, string | null | undefined>>;

export type ShopDocumentConfiguration = ShopPrintConfiguration & {
  id: string;
  name: string;
  copies: number;
  pages: number;
};

export type ShopDocumentConfigurationInput = ShopPrintConfigurationInput & {
  copies?: number | string | null | undefined;
  id?: string | null | undefined;
  name?: string | null | undefined;
  pages?: number | string | null | undefined;
};

export type ShopDocumentBundle = {
  documents: ShopDocumentConfiguration[];
  totalCopies: number;
  totalPages: number;
  totalPrintUnits: number;
};

export type ShopDocumentBundleInput =
  | {
      documents?: Array<ShopDocumentConfigurationInput | null | undefined> | null;
    }
  | Array<ShopDocumentConfigurationInput | null | undefined>;

type ShopPrintOption = {
  value: string;
  label: string;
  detail: string;
};

type ShopPrintOptionGroup<TKey extends keyof ShopPrintConfiguration = keyof ShopPrintConfiguration> = {
  key: TKey;
  label: string;
  options: ShopPrintOption[];
};

type PreviewPricedService = {
  basePriceCents: number;
  onlineActive?: boolean | null;
  quantityTiers?: string | null;
};

const MAX_DOCUMENT_COPIES = 999;
const MAX_DOCUMENT_PAGES = 10_000;

const defaultConfiguration: ShopPrintConfiguration = {
  format: "A4",
  colorMode: "BLACK_WHITE",
  sidesMode: "FRONT_ONLY",
  paperType: "USOMANO",
  paperStock: "USOMANO_80",
  binding: "NONE"
};

const legacyPaperStockAliases: Partial<Record<string, ShopPrintPaperStock>> = {
  PREMIUM_100: "USOMANO_100",
  STANDARD_80: "USOMANO_80"
};

const legacyPaperTypeByStock: Partial<Record<string, ShopPrintPaperType>> = {
  PREMIUM_100: "USOMANO",
  STANDARD_80: "USOMANO"
};

const shopPrintFormatOptions: ShopPrintOption[] = [
  { value: "A6", label: "A6", detail: "Molto compatto" },
  { value: "A5", label: "A5", detail: "Tascabile" },
  { value: "A4", label: "A4", detail: "Standard" },
  { value: "A3", label: "A3", detail: "Grande" },
  { value: "SA3", label: "SA3", detail: "Formato extra" },
  { value: "A2", label: "A2", detail: "Poster" },
  { value: "A1", label: "A1", detail: "Grande formato" },
  { value: "A0", label: "A0", detail: "Maxi formato" }
];

const shopPrintColorModeOptions: ShopPrintOption[] = [
  { value: "BLACK_WHITE", label: "Bianco e nero", detail: "Testi e bozze" },
  { value: "COLOR", label: "A colori", detail: "Immagini e grafica" }
];

const shopPrintSidesModeOptions: ShopPrintOption[] = [
  { value: "FRONT_ONLY", label: "Solo fronte", detail: "Un lato" },
  { value: "DOUBLE_SIDED", label: "Fronte e retro", detail: "Due lati" }
];

const shopPrintPaperTypeOptions: ShopPrintOption[] = [
  { value: "USOMANO", label: "Carta usomano", detail: "Classica opaca" },
  { value: "PATINATA_LUCIDA", label: "Carta patinata lucida", detail: "Più brillante" }
];

const shopPrintPaperStockOptionsByType: Record<ShopPrintPaperType, ShopPrintOption[]> = {
  USOMANO: [
    { value: "USOMANO_80", label: "80 g", detail: "Leggera" },
    { value: "USOMANO_100", label: "100 g", detail: "Più consistente" },
    { value: "USOMANO_200", label: "200 g", detail: "Rigida" },
    { value: "USOMANO_300", label: "300 g", detail: "Molto rigida" }
  ],
  PATINATA_LUCIDA: [
    { value: "PATINATA_LUCIDA_115", label: "115 g", detail: "Lucida" },
    { value: "PATINATA_LUCIDA_170", label: "170 g", detail: "Lucida rigida" }
  ]
};

const shopPrintBindingOptions: ShopPrintOption[] = [
  { value: "NONE", label: "Nessuna", detail: "Fogli sciolti" },
  { value: "STAPLED", label: "Spillati", detail: "Punto metallico" },
  { value: "SPIRAL", label: "Spirale", detail: "Rilegatura a spirale" }
];

export const SHOP_DOCUMENT_PREVIEW_BASE_PRICE_CENTS = 30;
export const SHOP_DOCUMENT_PREVIEW_QUANTITY_TIERS = "1-19:0,30 | 20-99:0,18 | 100+:0,12";

const longLabelMaps = {
  format: {
    A6: "A6",
    A5: "A5",
    A4: "A4",
    A3: "A3",
    SA3: "SA3",
    A2: "A2",
    A1: "A1",
    A0: "A0"
  },
  colorMode: {
    BLACK_WHITE: "Bianco e nero",
    COLOR: "A colori"
  },
  sidesMode: {
    FRONT_ONLY: "Solo fronte",
    DOUBLE_SIDED: "Fronte e retro"
  },
  paperType: {
    USOMANO: "Carta usomano",
    PATINATA_LUCIDA: "Carta patinata lucida"
  },
  paperStock: {
    USOMANO_80: "80 grammi",
    USOMANO_100: "100 grammi",
    USOMANO_200: "200 grammi",
    USOMANO_300: "300 grammi",
    PATINATA_LUCIDA_115: "115 grammi",
    PATINATA_LUCIDA_170: "170 grammi"
  },
  binding: {
    NONE: "Senza rilegatura",
    STAPLED: "Spillati",
    SPIRAL: "Rilegatura a spirale"
  }
} as const;

const compactLabelMaps = {
  format: {
    A6: "A6",
    A5: "A5",
    A4: "A4",
    A3: "A3",
    SA3: "SA3",
    A2: "A2",
    A1: "A1",
    A0: "A0"
  },
  colorMode: {
    BLACK_WHITE: "Bianco e nero",
    COLOR: "A colori"
  },
  sidesMode: {
    FRONT_ONLY: "Solo fronte",
    DOUBLE_SIDED: "Fronte e retro"
  },
  paperType: {
    USOMANO: "Usomano",
    PATINATA_LUCIDA: "Lucida"
  },
  paperStock: {
    USOMANO_80: "80 g",
    USOMANO_100: "100 g",
    USOMANO_200: "200 g",
    USOMANO_300: "300 g",
    PATINATA_LUCIDA_115: "115 g",
    PATINATA_LUCIDA_170: "170 g"
  },
  binding: {
    NONE: "Libero",
    STAPLED: "Spillati",
    SPIRAL: "Spirale"
  }
} as const;

function normalizeOption<TValue extends string>(value: unknown, allowedValues: readonly TValue[], fallback: TValue) {
  const normalized = String(value || "").trim().toUpperCase() as TValue;
  return allowedValues.includes(normalized) ? normalized : fallback;
}

function normalizeDocumentCopies(value: unknown) {
  const numeric = Number(value ?? 1);
  if (!Number.isFinite(numeric)) {
    return 1;
  }

  return Math.max(1, Math.min(MAX_DOCUMENT_COPIES, Math.round(numeric)));
}

function normalizeDocumentPages(value: unknown) {
  const numeric = Number(value ?? 1);
  if (!Number.isFinite(numeric)) {
    return 1;
  }

  return Math.max(1, Math.min(MAX_DOCUMENT_PAGES, Math.round(numeric)));
}

function normalizeDocumentName(value: unknown, index: number) {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);

  return normalized || `Documento ${index + 1}`;
}

function normalizeDocumentId(value: unknown, index: number) {
  const normalized = String(value || "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9_-]+/g, "");

  return normalized || `document-${index + 1}`;
}

function resolveBundleDocuments(input?: ShopDocumentBundleInput | null) {
  if (Array.isArray(input)) {
    return input;
  }

  if (input && typeof input === "object" && Array.isArray(input.documents)) {
    return input.documents;
  }

  return [];
}

function formatCopiesLabel(copies: number) {
  return `${copies} ${copies === 1 ? "copia" : "copie"}`;
}

export function formatShopDocumentPagesLabel(pages: number) {
  return `${pages} ${pages === 1 ? "pagina" : "pagine"}`;
}

export function formatShopPrintedPagesLabel(pages: number) {
  return `${pages} ${pages === 1 ? "pagina di stampa" : "pagine di stampa"}`;
}

function getDefaultPaperStockForType(paperType: ShopPrintPaperType): ShopPrintPaperStock {
  return paperType === "PATINATA_LUCIDA" ? "PATINATA_LUCIDA_115" : "USOMANO_80";
}

function resolveNormalizedPaperSelection(input?: ShopPrintConfigurationInput | null) {
  const rawPaperStock = String(input?.paperStock || "")
    .trim()
    .toUpperCase();
  const normalizedPaperType = normalizeOption(
    String(input?.paperType || "").trim().toUpperCase() || legacyPaperTypeByStock[rawPaperStock],
    shopPrintPaperTypeValues,
    defaultConfiguration.paperType
  );
  const normalizedPaperStock = normalizeOption(
    legacyPaperStockAliases[rawPaperStock] || rawPaperStock,
    shopPrintPaperStockValuesByType[normalizedPaperType] as readonly ShopPrintPaperStock[],
    getDefaultPaperStockForType(normalizedPaperType)
  );

  return {
    paperType: normalizedPaperType,
    paperStock: normalizedPaperStock
  };
}

export function getShopPrintOptionGroups(
  input?: Partial<ShopPrintConfiguration> | null
): Array<ShopPrintOptionGroup> {
  const { paperType } = resolveNormalizedPaperSelection(input);

  return [
    {
      key: "format",
      label: "Formato",
      options: shopPrintFormatOptions
    },
    {
      key: "colorMode",
      label: "Colore",
      options: shopPrintColorModeOptions
    },
    {
      key: "sidesMode",
      label: "Lati",
      options: shopPrintSidesModeOptions
    },
    {
      key: "paperType",
      label: "Tipo carta",
      options: shopPrintPaperTypeOptions
    },
    {
      key: "paperStock",
      label: "Grammatura",
      options: shopPrintPaperStockOptionsByType[paperType]
    },
    {
      key: "binding",
      label: "Rilegatura",
      options: shopPrintBindingOptions
    }
  ];
}

export const shopPrintOptionGroups = getShopPrintOptionGroups(defaultConfiguration);

export function normalizeShopPrintConfiguration(input?: ShopPrintConfigurationInput | null): ShopPrintConfiguration {
  const normalizedPaperSelection = resolveNormalizedPaperSelection(input);

  return {
    format: normalizeOption(input?.format, shopPrintFormatValues, defaultConfiguration.format),
    colorMode: normalizeOption(input?.colorMode, shopPrintColorModeValues, defaultConfiguration.colorMode),
    sidesMode: normalizeOption(input?.sidesMode, shopPrintSidesModeValues, defaultConfiguration.sidesMode),
    paperType: normalizedPaperSelection.paperType,
    paperStock: normalizedPaperSelection.paperStock,
    binding: normalizeOption(input?.binding, shopPrintBindingValues, defaultConfiguration.binding)
  };
}

export function getDefaultShopPrintConfiguration() {
  return { ...defaultConfiguration };
}

export function createEmptyShopDocument(index: number, overrides?: Partial<ShopDocumentConfiguration>) {
  return normalizeShopDocument(
    {
      ...getDefaultShopPrintConfiguration(),
      copies: 1,
      pages: 1,
      id: overrides?.id || `document-${index + 1}`,
      name: overrides?.name || `Documento ${index + 1}`,
      ...overrides
    },
    index
  );
}

export function normalizeShopDocument(input?: ShopDocumentConfigurationInput | null, index = 0): ShopDocumentConfiguration {
  const configuration = normalizeShopPrintConfiguration(input);

  return {
    ...configuration,
    copies: normalizeDocumentCopies(input?.copies),
    pages: normalizeDocumentPages(input?.pages),
    id: normalizeDocumentId(input?.id, index),
    name: normalizeDocumentName(input?.name, index)
  };
}

export function getShopDocumentPrintUnits(input?: Partial<ShopDocumentConfiguration> | null) {
  const document = normalizeShopDocument(input, 0);
  return document.pages * document.copies;
}

export function normalizeShopDocumentBundle(input?: ShopDocumentBundleInput | null): ShopDocumentBundle {
  const rawDocuments = resolveBundleDocuments(input);
  const documents = rawDocuments.length
    ? rawDocuments.map((document, index) => normalizeShopDocument(document || undefined, index))
    : [createEmptyShopDocument(0)];
  const totalCopies = documents.reduce((sum, document) => sum + document.copies, 0);
  const totalPages = documents.reduce((sum, document) => sum + document.pages, 0);
  const totalPrintUnits = documents.reduce((sum, document) => sum + getShopDocumentPrintUnits(document), 0);

  return {
    documents,
    totalCopies,
    totalPages,
    totalPrintUnits
  };
}

export function parseShopDocumentBundlePayload(raw: string | null | undefined) {
  const normalized = String(raw || "").trim();
  if (!normalized) {
    return null;
  }

  try {
    return normalizeShopDocumentBundle(JSON.parse(normalized) as ShopDocumentBundleInput);
  } catch {
    return null;
  }
}

export function getShopPrintConfigurationOptionLabel<TKey extends keyof ShopPrintConfiguration>(
  key: TKey,
  value: ShopPrintConfiguration[TKey]
) {
  return (longLabelMaps as Record<keyof ShopPrintConfiguration, Record<string, string>>)[key][String(value)] || String(value);
}

export function getShopPrintConfigurationCompactLabel<TKey extends keyof ShopPrintConfiguration>(
  key: TKey,
  value: ShopPrintConfiguration[TKey]
) {
  return (compactLabelMaps as Record<keyof ShopPrintConfiguration, Record<string, string>>)[key][String(value)] || String(value);
}

export function buildShopPrintConfigurationSummary(input?: ShopPrintConfigurationInput | null) {
  const configuration = normalizeShopPrintConfiguration(input);

  return [
    getShopPrintConfigurationOptionLabel("format", configuration.format),
    getShopPrintConfigurationOptionLabel("colorMode", configuration.colorMode),
    getShopPrintConfigurationOptionLabel("sidesMode", configuration.sidesMode),
    getShopPrintConfigurationOptionLabel("paperType", configuration.paperType),
    getShopPrintConfigurationOptionLabel("paperStock", configuration.paperStock),
    getShopPrintConfigurationOptionLabel("binding", configuration.binding)
  ].join(" • ");
}

export function buildShopDocumentCardSummary(
  input?: Partial<ShopDocumentConfiguration> | null,
  options?: { compact?: boolean; includeCopies?: boolean }
) {
  const document = normalizeShopDocument(input, 0);
  const resolveLabel = options?.compact ? getShopPrintConfigurationCompactLabel : getShopPrintConfigurationOptionLabel;
  const chunks = [
    formatShopDocumentPagesLabel(document.pages),
    resolveLabel("format", document.format),
    resolveLabel("colorMode", document.colorMode),
    resolveLabel("sidesMode", document.sidesMode),
    resolveLabel("paperType", document.paperType),
    resolveLabel("paperStock", document.paperStock),
    resolveLabel("binding", document.binding)
  ];

  if (options?.includeCopies !== false) {
    chunks.unshift(formatCopiesLabel(document.copies));
  }

  return chunks.join(" • ");
}

export function buildShopDocumentOptionsSummary(
  input?: Partial<ShopDocumentConfiguration> | null,
  options?: { compact?: boolean }
) {
  const document = normalizeShopDocument(input, 0);
  const resolveLabel = options?.compact ? getShopPrintConfigurationCompactLabel : getShopPrintConfigurationOptionLabel;

  return [
    resolveLabel("format", document.format),
    resolveLabel("colorMode", document.colorMode),
    resolveLabel("sidesMode", document.sidesMode),
    resolveLabel("paperType", document.paperType),
    resolveLabel("paperStock", document.paperStock),
    resolveLabel("binding", document.binding)
  ].join(" • ");
}

export function buildShopDocumentBundleOverview(input?: ShopDocumentBundleInput | ShopDocumentBundle | null) {
  const bundle = normalizeShopDocumentBundle(input || undefined);
  const documentsLabel = bundle.documents.length === 1 ? "documento" : "documenti";
  return `${bundle.documents.length} ${documentsLabel} • ${formatShopPrintedPagesLabel(bundle.totalPrintUnits)}`;
}

export function buildShopDocumentBundleDetailedSummary(input?: ShopDocumentBundleInput | ShopDocumentBundle | null) {
  const bundle = normalizeShopDocumentBundle(input || undefined);
  return bundle.documents.map((document) => `${document.name}: ${buildShopDocumentCardSummary(document)}`).join("\n");
}

export function resolveShopDocumentPreviewPricing<TService extends PreviewPricedService>(service: TService, sourcePath?: string | null): TService {
  if (service.onlineActive || sourcePath?.trim() !== "/shop/stampa-documenti") {
    return service;
  }

  return {
    ...service,
    basePriceCents: SHOP_DOCUMENT_PREVIEW_BASE_PRICE_CENTS,
    quantityTiers: SHOP_DOCUMENT_PREVIEW_QUANTITY_TIERS
  };
}

export function extractShopDocumentBundleFromConfiguration(configuration: unknown, fallbackCopies = 1) {
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
    return null;
  }

  const record = configuration as Record<string, unknown>;

  if (record.documentBundle) {
    return normalizeShopDocumentBundle(record.documentBundle as ShopDocumentBundleInput);
  }

  if (record.printConfiguration && typeof record.printConfiguration === "object" && !Array.isArray(record.printConfiguration)) {
    return normalizeShopDocumentBundle({
      documents: [
        {
          ...(record.printConfiguration as ShopPrintConfigurationInput),
          copies: fallbackCopies,
          id: "document-1",
          name: "Documento 1"
        }
      ]
    });
  }

  return null;
}
