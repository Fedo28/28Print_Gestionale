import type { ServiceCatalog } from "@prisma/client";
import { quoteCatalogService } from "@/lib/domain/pricing/service-pricing";
import { prisma } from "@/lib/prisma";
import { parseQuantityTiers } from "@/lib/pricing";
import {
  computeShopBannerQuote,
  type ShopBannerMaterial
} from "@/lib/shop-banner-pricing";
import type { ShopLabelMaterial } from "@/lib/label-calculator";
import {
  SHOP_STAMP_MODELS,
  type ShopStampModelCode,
  type ShopStampModelSpec
} from "@/lib/shop-stamp-pricing";
import type { ShopStickerMaterial } from "@/lib/shop-sticker-pricing";

export type ShopCatalogQuantityOption = {
  priceCents: number;
  quantity: number;
};

export type ShopCatalogProductOption = {
  bannerKind?: "custom" | "standard";
  bannerMaterial?: ShopBannerMaterial;
  bannerPreset?: {
    heightM: number;
    reinforced: boolean;
    widthM: number;
  };
  code: string | null;
  description?: string;
  id: string;
  label: string;
  orderLabel?: string;
  quantities: ShopCatalogQuantityOption[];
  serviceId?: string;
  stampModel?: ShopStampModelCode;
  stampSpec?: ShopStampModelSpec;
  labelMaterial?: ShopLabelMaterial;
  stickerMaterial?: ShopStickerMaterial;
};

export type ShopCatalogQuantityMode = "tiers" | "unit-input";

export type ShopCatalogSubjectPricingMode = "total-quantity" | "per-subject";

export type ShopCatalogProductImageRule = {
  codeIncludes?: string[];
  imageAlt: string;
  imageSrc: string;
  labelIncludes?: string[];
};

export type ShopCatalogProductPaperVariant = {
  id: string;
  label: string;
};

export type ShopCatalogProductPaperChoice = {
  id: string;
  label: string;
  note: string;
  priceMultiplier?: number;
  variants?: ShopCatalogProductPaperVariant[];
};

export type ShopCatalogProductPage = {
  accent: "cyan" | "lime" | "red";
  customCalculator?: "banner-size" | "label-size" | "stamp-text" | "sticker-size";
  fileQuantityMode?: "file-count";
  fileMode?: "generated" | "upload";
  fileUploadHint?: string;
  hideTemplateCard?: boolean;
  imageAlt?: string;
  imageSrc?: string;
  optionSectionLabel?: string;
  options: ShopCatalogProductOption[];
  optionImageRules?: ShopCatalogProductImageRule[];
  paperChoices?: ShopCatalogProductPaperChoice[];
  quantityMode?: ShopCatalogQuantityMode;
  slug: string;
  subjectMode?: "multi";
  subjectPricingMode?: ShopCatalogSubjectPricingMode;
  subtitle?: string;
  templateLabel: string;
  title: string;
};

type ProductService = Pick<ServiceCatalog, "basePriceCents" | "code" | "id" | "name" | "quantityTiers">;

type ProductDefinition = {
  accent: "cyan" | "lime" | "red";
  codeIncludes?: string[];
  codePrefixes?: string[];
  excludeCodeIncludes?: string[];
  formatOptionLabel?: (service: Pick<ServiceCatalog, "code" | "name">) => string;
  buildOptions?: (services: ProductService[]) => ShopCatalogProductOption[];
  customCalculator?: "banner-size" | "label-size" | "stamp-text" | "sticker-size";
  expandOptions?: (service: ProductService, option: ShopCatalogProductOption) => ShopCatalogProductOption[];
  fileQuantityMode?: "file-count";
  imageAlt?: string;
  imageSrc?: string;
  fileMode?: "generated" | "upload";
  fileUploadHint?: string;
  hideTemplateCard?: boolean;
  optionSectionLabel?: string;
  optionImageRules?: ShopCatalogProductImageRule[];
  quantityMode?: ShopCatalogQuantityMode;
  slug: string;
  sortOptions?: (options: ShopCatalogProductOption[]) => ShopCatalogProductOption[];
  subjectMode?: "multi";
  subjectPricingMode?: ShopCatalogSubjectPricingMode;
  subtitle?: string;
  templateLabel?: string;
  title: string;
};

function formatFlyerOptionLabel(service: Pick<ServiceCatalog, "code" | "name">) {
  const code = normalizeCode(service.code);
  const name = String(service.name || "");
  if (code.includes("10X21") || name.includes("10x21")) {
    return "10x21";
  }

  if (code.includes("15X21") || name.includes("15x21")) {
    return "15x21";
  }

  return name || "Volantino";
}

function readPaperWeightLabel(value: string) {
  const normalizedValue = value.toUpperCase();
  const codeMatch = normalizedValue.match(/CARTA(?:_PATINATA)?_([0-9]+)(?:_([0-9]+))?_GR/);
  if (codeMatch) {
    return codeMatch[2] ? `${codeMatch[1]}-${codeMatch[2]} gr` : `${codeMatch[1]} gr`;
  }

  const textMatch = value.match(/(?:carta\s+(?:patinata\s+)?)?([0-9]+)(?:\s*-\s*([0-9]+))?\s*gr/i);
  if (!textMatch) {
    return "";
  }

  return textMatch[2] ? `${textMatch[1]}-${textMatch[2]} gr` : `${textMatch[1]} gr`;
}

function formatPosterOptionLabel(service: Pick<ServiceCatalog, "code" | "name">) {
  const code = normalizeCode(service.code);
  const name = String(service.name || "");
  const weightLabel = readPaperWeightLabel(code) || readPaperWeightLabel(name);
  return weightLabel ? `Locandina 32x45 ${weightLabel}` : "Locandina 32x45";
}

type PhotoFormat = {
  height: number;
  label: string;
  width: number;
};

function isExcludedShopPhotoService(service: Pick<ServiceCatalog, "code" | "name">) {
  const value = `${normalizeCode(service.code)} ${normalizeCode(service.name)}`;
  return (
    value.includes("FOTO_LIBRO") ||
    value.includes("FOTOLIBRO") ||
    value.includes("BOBINA") ||
    value.includes("MTL") ||
    value.includes("METRO_LINEARE") ||
    value.includes("METRI_LINEARI")
  );
}

function readShopPhotoFormats(service: Pick<ServiceCatalog, "code" | "name">): PhotoFormat[] {
  const source = `${String(service.code || "")} ${String(service.name || "")}`;
  const matches = Array.from(source.matchAll(/(\d{1,3})\s*[xX]\s*(\d{1,3})/g));
  const formats = new Map<string, PhotoFormat>();

  matches.forEach((match) => {
    const width = Number.parseInt(match[1], 10);
    const height = Number.parseInt(match[2], 10);
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return;
    }

    const label = `${width}x${height}`;
    formats.set(label, {
      height,
      label,
      width
    });
  });

  return [...formats.values()];
}

function comparePhotoFormats(first: Pick<PhotoFormat, "height" | "width">, second: Pick<PhotoFormat, "height" | "width">) {
  return first.width * first.height - second.width * second.height || first.width - second.width || first.height - second.height;
}

function buildShopPhotoOptions(services: ProductService[]) {
  const optionsByFormat = new Map<
    string,
    ShopCatalogProductOption & {
      photoFormatSort: PhotoFormat;
      sourcePriority: number;
    }
  >();

  services.forEach((service) => {
    if (isExcludedShopPhotoService(service)) {
      return;
    }

    const sourcePriority = normalizeCode(service.code).startsWith("FOTOGRAFIE_") ? 0 : 1;
    readShopPhotoFormats(service).forEach((format) => {
      const current = optionsByFormat.get(format.label);
      if (current && current.sourcePriority <= sourcePriority) {
        return;
      }

      optionsByFormat.set(format.label, {
        code: service.code,
        id: `${service.id}:${format.label}`,
        label: format.label,
        orderLabel: `Stampa foto ${format.label}`,
        photoFormatSort: format,
        quantities: buildQuantityOptions(service),
        serviceId: service.id,
        sourcePriority
      });
    });
  });

  return [...optionsByFormat.values()]
    .sort((first, second) => comparePhotoFormats(first.photoFormatSort, second.photoFormatSort))
    .map(({ photoFormatSort: _photoFormatSort, sourcePriority: _sourcePriority, ...option }) => option);
}

function formatRollUpOptionLabel(service: Pick<ServiceCatalog, "code" | "name">) {
  const code = normalizeCode(service.code);
  const name = String(service.name || "");
  const sizeMatch = `${code} ${name}`.match(/([0-9]{2,3})\s*[xX]\s*([0-9]{2,3})/);

  if (sizeMatch) {
    return `Roll Up ${sizeMatch[1]}x${sizeMatch[2]}`;
  }

  return (
    name
      .replace(/roll[\s-]*up/gi, "Roll Up")
      .replace(/\bcompleto\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim() || "Roll Up"
  );
}

function readPosterWeightOptions(service: Pick<ServiceCatalog, "code" | "name">) {
  const code = normalizeCode(service.code);
  const name = String(service.name || "");
  const weightLabel = readPaperWeightLabel(code) || readPaperWeightLabel(name);

  if (!weightLabel) {
    return ["Grammatura"];
  }

  const splitWeightMatch = weightLabel.match(/^([0-9]+)-([0-9]+)\s*gr$/i);
  if (!splitWeightMatch) {
    return [weightLabel];
  }

  return [`${splitWeightMatch[1]} gr`, `${splitWeightMatch[2]} gr`];
}

function expandPosterOptions(service: ProductService, option: ShopCatalogProductOption) {
  return readPosterWeightOptions(service).map((weightLabel) => ({
    ...option,
    id: `${service.id}:${weightLabel.replace(/\s+/g, "-").toLowerCase()}`,
    label: weightLabel,
    orderLabel: `Locandina 32x45 ${weightLabel}`,
    serviceId: service.id
  }));
}

function sortPosterOptions(options: ShopCatalogProductOption[]) {
  return [...options].sort((firstOption, secondOption) => {
    const firstWeight = Number.parseInt(firstOption.label, 10);
    const secondWeight = Number.parseInt(secondOption.label, 10);
    return firstWeight - secondWeight;
  });
}

function isShopBannerAccessoryService(service: Pick<ServiceCatalog, "code" | "name">) {
  const code = normalizeCode(service.code);
  const name = normalizeCode(service.name);
  return (
    code.includes("OCCHIELLI") ||
    code.includes("PERIMETRO") ||
    code.includes("SOLO_MONTAGGIO") ||
    name.includes("OCCHIELLI") ||
    name.includes("PERIMETRO") ||
    name.includes("SOLO MONTAGGIO")
  );
}

function findShopBannerService(services: ProductService[], material: ShopBannerMaterial) {
  const matcher =
    material === "mesh"
      ? (service: ProductService) => normalizeCode(service.code).includes("RETE_MESH") || normalizeCode(service.name).includes("MESH")
      : (service: ProductService) =>
          normalizeCode(service.code).startsWith("BANNER_") ||
          normalizeCode(service.name).includes("STRISCION") ||
          normalizeCode(service.name).includes("BANNER");

  return (
    services.find((service) => matcher(service) && !isShopBannerAccessoryService(service)) ||
    services.find((service) => !isShopBannerAccessoryService(service)) ||
    null
  );
}

function buildShopBannerOptions(services: ProductService[]) {
  const pvcService = findShopBannerService(services, "pvc");
  const meshService = findShopBannerService(services, "mesh") || pvcService;

  if (!pvcService) {
    return [];
  }

  const standardQuote = computeShopBannerQuote({
    heightM: 1,
    material: "pvc",
    priceProfile: "standard-3x1",
    quantity: 1,
    reinforced: true,
    widthM: 3
  });
  const customPvcQuote = computeShopBannerQuote({
    heightM: 1,
    material: "pvc",
    quantity: 1,
    reinforced: true,
    widthM: 1
  });
  const customMeshQuote = computeShopBannerQuote({
    heightM: 1,
    material: "mesh",
    quantity: 1,
    reinforced: true,
    widthM: 1
  });

  return [
    {
      bannerKind: "standard" as const,
      bannerMaterial: "pvc" as const,
      bannerPreset: {
        heightM: 1,
        reinforced: true,
        widthM: 3
      },
      code: pvcService.code,
      id: `${pvcService.id}:standard-3x1`,
      label: "Standard 3x1",
      orderLabel: "Striscione standard 3x1",
      quantities: [
        {
          priceCents: standardQuote.unitTotalCents,
          quantity: 1
        }
      ],
      serviceId: pvcService.id
    },
    {
      bannerKind: "custom" as const,
      bannerMaterial: "pvc" as const,
      code: pvcService.code,
      id: `${pvcService.id}:custom-pvc`,
      label: "Personalizzato PVC",
      orderLabel: "Striscione personalizzato PVC",
      quantities: [
        {
          priceCents: customPvcQuote.unitTotalCents,
          quantity: 1
        }
      ],
      serviceId: pvcService.id
    },
    {
      bannerKind: "custom" as const,
      bannerMaterial: "mesh" as const,
      code: meshService?.code || pvcService.code,
      id: `${meshService?.id || pvcService.id}:custom-mesh`,
      label: "Personalizzato Mesh",
      orderLabel: "Striscione personalizzato Mesh",
      quantities: [
        {
          priceCents: customMeshQuote.unitTotalCents,
          quantity: 1
        }
      ],
      serviceId: meshService?.id || pvcService.id
    }
  ];
}

function findShopStampService(services: ProductService[], model: ShopStampModelCode) {
  const codeMatch = `TIMBRO_${model}`;
  const exactService = services.find((service) => normalizeCode(service.code).includes(codeMatch));
  if (exactService) {
    return exactService;
  }

  if (model === "C20") {
    return services.find((service) => normalizeCode(service.code) === "TIMBRO_12") || null;
  }

  if (model === "C50") {
    return services.find((service) => normalizeCode(service.code).includes("TIMBRO_C40")) || null;
  }

  return services.find((service) => normalizeCode(service.code).startsWith("TIMBRO_")) || null;
}

function buildShopStampOptions(services: ProductService[]) {
  const stampServices = services.filter((service) => {
    const code = normalizeCode(service.code);
    return code.startsWith("TIMBRO_") && code !== "RIGHE_GOMMINA_TIMBRO";
  });

  return SHOP_STAMP_MODELS.flatMap((model) => {
    const service = findShopStampService(stampServices, model.code);
    if (!service) {
      return [];
    }

    return [
      {
        code: service.code,
        description: `${model.displaySize} · max ${model.maxLines} righe`,
        id: `${service.id}:${model.code.toLowerCase()}`,
        label: `Timbro ${model.code}`,
        orderLabel: `Timbro ${model.code}`,
        quantities: buildQuantityOptions(service),
        serviceId: service.id,
        stampModel: model.code,
        stampSpec: model
      }
    ];
  });
}

function findShopStickerService(services: ProductService[], material: ShopStickerMaterial) {
  const targetCode = material === "polimerico-laminato" ? "POLIMERICO_LAMINATO_PREZZO_AL_MQ" : "POLIMERICO_PREZZO_AL_MQ";
  const targetName = material === "polimerico-laminato" ? "polimerico laminato" : "polimerico";

  return (
    services.find((service) => normalizeCode(service.code) === targetCode) ||
    services.find((service) => String(service.name || "").trim().toLowerCase() === targetName) ||
    null
  );
}

function buildShopStickerOptions(services: ProductService[]) {
  return (["polimerico", "polimerico-laminato"] as const).flatMap((material) => {
    const service = findShopStickerService(services, material);
    if (!service) {
      return [];
    }

    const label = material === "polimerico-laminato" ? "Polimerico laminato" : "Polimerico";
    return [
      {
        code: service.code,
        id: `${service.id}:${material}`,
        label,
        orderLabel: `Adesivo grande formato ${label.toLowerCase()}`,
        quantities: buildQuantityOptions(service),
        serviceId: service.id,
        stickerMaterial: material
      }
    ];
  });
}

function findShopLabelService(services: ProductService[], material: ShopLabelMaterial) {
  const targetCode =
    material === "polimerico-laminato"
      ? "POLIMERICO_LAMINATO_STAMPA_E_TAGLIO"
      : "POLIMERICO_STAMPA_E_TAGLIO";
  const targetName = material === "polimerico-laminato" ? "polimerico laminato" : "polimerico";

  return (
    services.find((service) => {
      const code = normalizeCode(service.code);
      return code.startsWith(targetCode) && !code.includes("MONOMERICO");
    }) ||
    services.find((service) => {
      const name = String(service.name || "").trim().toLowerCase();
      if (material === "polimerico" && name.includes("laminato")) {
        return false;
      }

      return name.includes("etichette") && name.includes(targetName) && name.includes("stampa") && name.includes("taglio");
    }) ||
    null
  );
}

function buildShopLabelOptions(services: ProductService[]) {
  return (["polimerico", "polimerico-laminato"] as const).flatMap((material) => {
    const service = findShopLabelService(services, material);
    if (!service) {
      return [];
    }

    const label = material === "polimerico-laminato" ? "Polimerico laminato" : "Polimerico";
    return [
      {
        code: service.code,
        id: `${service.id}:${material}`,
        label,
        orderLabel: `Etichette adesive ${label.toLowerCase()}`,
        quantities: buildQuantityOptions(service),
        serviceId: service.id,
        labelMaterial: material
      }
    ];
  });
}

const productDefinitions: ProductDefinition[] = [
  {
    accent: "cyan",
    codePrefixes: ["VOLANTINO_"],
    formatOptionLabel: formatFlyerOptionLabel,
    imageAlt: "Volantini stampati",
    imageSrc: "/shop/product-volantini.jpg",
    optionSectionLabel: "Dimensione",
    slug: "volantini",
    subjectMode: "multi",
    subjectPricingMode: "per-subject",
    title: "Volantini"
  },
  {
    accent: "cyan",
    codePrefixes: ["LOCANDINA_FOGLIO_MACCHINA_32X45_"],
    expandOptions: expandPosterOptions,
    formatOptionLabel: formatPosterOptionLabel,
    imageAlt: "Locandine stampate",
    imageSrc: "/shop/product-locandine.jpg",
    fileUploadHint: "File di dimensioni effettive",
    hideTemplateCard: true,
    optionSectionLabel: "Grammatura",
    quantityMode: "unit-input",
    slug: "locandine",
    sortOptions: sortPosterOptions,
    subjectMode: "multi",
    subjectPricingMode: "total-quantity",
    subtitle: "32x45",
    title: "Locandine"
  },
  {
    accent: "cyan",
    codePrefixes: ["ROLLUP_"],
    excludeCodeIncludes: ["PVC_CON_RETRO_GRIGIO_PER_ROLLUP", "SOLO"],
    formatOptionLabel: formatRollUpOptionLabel,
    imageAlt: "Roll Up personalizzato",
    imageSrc: "/shop/product-roll-up.jpg",
    fileUploadHint: "File di dimensioni effettive",
    hideTemplateCard: true,
    optionSectionLabel: "Formato",
    quantityMode: "unit-input",
    slug: "roll-up",
    subjectMode: "multi",
    subjectPricingMode: "per-subject",
    title: "Roll Up"
  },
  {
    accent: "cyan",
    buildOptions: buildShopBannerOptions,
    codePrefixes: ["BANNER_", "RETE_MESH_", "OCCHIELLI_", "PERIMETRO_"],
    codeIncludes: ["SOLO_TELO", "SOLO_MONTAGGIO"],
    customCalculator: "banner-size",
    imageAlt: "Striscioni stampati",
    imageSrc: "/shop/product-banner-e-striscioni.jpg",
    fileUploadHint: "File di dimensioni effettive",
    hideTemplateCard: true,
    optionSectionLabel: "Tipo",
    quantityMode: "unit-input",
    slug: "banner-e-striscioni",
    title: "Striscioni"
  },
  {
    accent: "cyan",
    buildOptions: buildShopStampOptions,
    codePrefixes: ["TIMBRO_"],
    customCalculator: "stamp-text",
    fileMode: "generated",
    hideTemplateCard: true,
    imageAlt: "Timbri personalizzati",
    imageSrc: "/shop/product-timbri.jpg",
    optionSectionLabel: "Modello",
    quantityMode: "unit-input",
    slug: "timbri",
    title: "Timbri"
  },
  {
    accent: "cyan",
    buildOptions: buildShopStickerOptions,
    codePrefixes: ["POLIMERICO_PREZZO_AL_MQ", "POLIMERICO_LAMINATO_PREZZO_AL_MQ"],
    customCalculator: "sticker-size",
    imageAlt: "Adesivi grande formato in stampa",
    imageSrc: "/shop/product-adesivi-grande-formato.jpg",
    fileUploadHint: "File di dimensioni effettive",
    hideTemplateCard: true,
    optionSectionLabel: "Materiale",
    slug: "adesivi-e-vetrofanie",
    title: "Adesivi grande formato"
  },
  {
    accent: "cyan",
    buildOptions: buildShopLabelOptions,
    codePrefixes: ["POLIMERICO_LAMINATO_STAMPA_E_TAGLIO", "POLIMERICO_STAMPA_E_TAGLIO"],
    customCalculator: "label-size",
    imageAlt: "Etichette adesive colorate",
    imageSrc: "/shop/product-etichette-adesive.jpg",
    fileUploadHint: "File di dimensioni effettive",
    hideTemplateCard: true,
    optionSectionLabel: "Materiale",
    quantityMode: "unit-input",
    slug: "etichette-adesive",
    title: "Etichette adesive"
  },
  {
    accent: "lime",
    buildOptions: buildShopPhotoOptions,
    codePrefixes: ["CARTA_FOTOGRAFICA_", "FOTOGRAFIE_"],
    excludeCodeIncludes: ["FOTO_LIBRO", "FOTOLIBRO", "BOBINA", "MTL"],
    fileQuantityMode: "file-count",
    fileUploadHint: "Carica JPG o PNG: ogni immagine vale 1 foto",
    hideTemplateCard: true,
    optionSectionLabel: "Formato",
    slug: "stampa-foto",
    title: "Stampa foto"
  },
  {
    accent: "lime",
    codePrefixes: ["STAMPA_IMMAGINE_PIENA_", "STAMPA_PLOTTER_"],
    imageAlt: "Poster stampato",
    imageSrc: "/shop/product-poster.jpg",
    hideTemplateCard: true,
    slug: "poster-fotografici",
    title: "Poster fotografici"
  },
  {
    accent: "lime",
    codePrefixes: ["CANVAS_"],
    hideTemplateCard: true,
    slug: "canvas-e-tele",
    title: "Canvas e tele"
  },
  {
    accent: "lime",
    codePrefixes: [
      "BORDATURA_PIUMA",
      "D_BOND_",
      "FOREX_",
      "PANNELLO_PIUMA",
      "PIUMA_",
      "PLEXIGLASS_",
      "POLIONDA_"
    ],
    hideTemplateCard: true,
    slug: "quadri-e-pannelli",
    title: "Quadri e pannelli"
  },
  {
    accent: "lime",
    codeIncludes: ["TABLEAU", "CERIMON", "INVITI", "PARTECIPAZ"],
    hideTemplateCard: true,
    slug: "tableau-e-cerimonie",
    title: "Tableau e cerimonie"
  },
  {
    accent: "red",
    codePrefixes: ["T_SHIRT_"],
    excludeCodeIncludes: ["_5_9", "_10_19"],
    slug: "t-shirt-personalizzate",
    title: "T-shirt personalizzate"
  },
  {
    accent: "red",
    codePrefixes: [
      "APPLICAZIONE_",
      "CAPPELLINO_",
      "FELPA_",
      "POLO_",
      "STAMPA_DIGITALE_FULL_COLOR_INTAGLIATA",
      "TRANSFERT_",
      "VIDEFLEX_"
    ],
    excludeCodeIncludes: ["_5_9", "_10_19"],
    slug: "abbigliamento-da-lavoro",
    title: "Abbigliamento da lavoro"
  },
  {
    accent: "red",
    codePrefixes: ["TAZZA_"],
    slug: "tazze",
    title: "Tazze"
  },
  {
    accent: "red",
    codePrefixes: ["BORRACCIA_"],
    slug: "borracce",
    title: "Borracce"
  },
  {
    accent: "red",
    codePrefixes: ["SHOPPER_", "CAPPELLINO_"],
    excludeCodeIncludes: ["_5_9", "_10_19"],
    slug: "shopper-e-cappellini",
    title: "Shopper e cappellini"
  },
  {
    accent: "red",
    codePrefixes: ["PORTACHIAVI_"],
    slug: "portachiavi",
    title: "Portachiavi"
  }
];

function normalizeCode(value: string | null | undefined) {
  return String(value || "").trim().toUpperCase();
}

function matchesDefinition(service: Pick<ServiceCatalog, "code">, definition: ProductDefinition) {
  const code = normalizeCode(service.code);
  if (!code) {
    return false;
  }

  if (definition.excludeCodeIncludes?.some((term) => code.includes(term))) {
    return false;
  }

  const matchesPrefix = definition.codePrefixes?.some((prefix) => code.startsWith(prefix));
  const matchesInclude = definition.codeIncludes?.some((term) => code.includes(term));
  return Boolean(matchesPrefix || matchesInclude);
}

function buildQuantityOptions(service: Pick<ServiceCatalog, "basePriceCents" | "code" | "name" | "quantityTiers">) {
  const quantities: number[] = [];

  try {
    quantities.push(...parseQuantityTiers(service.quantityTiers).map((tier) => tier.minQuantity));
  } catch {
    quantities.length = 0;
  }

  if (!quantities.length) {
    quantities.push(1);
  }

  return quantities.map((quantity) => ({
    quantity,
    priceCents: quoteCatalogService({ service, quantity }).lineTotalCents
  }));
}

export function listShopCatalogProductDefinitions() {
  return productDefinitions;
}

export function getShopCatalogProductDefinition(slug: string) {
  return productDefinitions.find((definition) => definition.slug === slug) || null;
}

export async function getShopCatalogProductPage(slug: string): Promise<ShopCatalogProductPage | null> {
  const definition = getShopCatalogProductDefinition(slug);
  if (!definition) {
    return null;
  }

  const services = await prisma.serviceCatalog.findMany({
    where: {
      active: true
    },
    orderBy: [{ name: "asc" }],
    select: {
      basePriceCents: true,
      code: true,
      id: true,
      name: true,
      quantityTiers: true
    }
  });

  const matchedServices = services.filter((service) => matchesDefinition(service, definition));
  const unsortedOptions = definition.buildOptions
    ? definition.buildOptions(matchedServices)
    : matchedServices.flatMap((service) => {
        const option = {
          code: service.code,
          id: service.id,
          label: definition.formatOptionLabel ? definition.formatOptionLabel(service) : service.name,
          quantities: buildQuantityOptions(service),
          serviceId: service.id
        };

        return definition.expandOptions ? definition.expandOptions(service, option) : [option];
      });
  const options = definition.sortOptions ? definition.sortOptions(unsortedOptions) : unsortedOptions;

  return {
    accent: definition.accent,
    customCalculator: definition.customCalculator,
    fileQuantityMode: definition.fileQuantityMode,
    fileMode: definition.fileMode,
    fileUploadHint: definition.fileUploadHint,
    hideTemplateCard: definition.hideTemplateCard,
    imageAlt: definition.imageAlt,
    imageSrc: definition.imageSrc,
    optionSectionLabel: definition.optionSectionLabel,
    options,
    optionImageRules: definition.optionImageRules,
    quantityMode: definition.quantityMode,
    slug: definition.slug,
    subjectMode: definition.subjectMode,
    subjectPricingMode: definition.subjectPricingMode,
    subtitle: definition.subtitle,
    templateLabel: definition.templateLabel || "File guida",
    title: definition.title
  };
}
