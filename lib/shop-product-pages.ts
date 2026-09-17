import type { ServiceCatalog } from "@prisma/client";
import { quoteCatalogService } from "@/lib/domain/pricing/service-pricing";
import { prisma } from "@/lib/prisma";
import { parseQuantityTiers } from "@/lib/pricing";

export type ShopCatalogQuantityOption = {
  priceCents: number;
  quantity: number;
};

export type ShopCatalogProductOption = {
  code: string | null;
  id: string;
  label: string;
  quantities: ShopCatalogQuantityOption[];
};

export type ShopCatalogProductPage = {
  accent: "cyan" | "lime" | "red";
  options: ShopCatalogProductOption[];
  slug: string;
  templateLabel: string;
  title: string;
};

type ProductDefinition = {
  accent: "cyan" | "lime" | "red";
  codeIncludes?: string[];
  codePrefixes?: string[];
  excludeCodeIncludes?: string[];
  slug: string;
  templateLabel?: string;
  title: string;
};

const productDefinitions: ProductDefinition[] = [
  {
    accent: "cyan",
    codePrefixes: ["VOLANTINO_", "LOCANDINA_"],
    slug: "volantini-e-locandine",
    title: "Volantini e locandine"
  },
  {
    accent: "cyan",
    codePrefixes: ["ROLLUP_"],
    codeIncludes: ["PVC_CON_RETRO_GRIGIO_PER_ROLLUP"],
    slug: "roll-up",
    title: "Roll-up"
  },
  {
    accent: "cyan",
    codePrefixes: ["BANNER_", "RETE_MESH_", "OCCHIELLI_", "PERIMETRO_"],
    codeIncludes: ["SOLO_TELO", "SOLO_MONTAGGIO"],
    slug: "banner-e-striscioni",
    title: "Banner e striscioni"
  },
  {
    accent: "cyan",
    codePrefixes: ["TIMBRO_", "RIGHE_GOMMINA_TIMBRO"],
    slug: "timbri",
    title: "Timbri"
  },
  {
    accent: "cyan",
    codePrefixes: [
      "ADESIVO_",
      "CALPESTABILE_",
      "CAST_",
      "MONOMERICO_",
      "ONE_WAY_",
      "POLIMERICO_",
      "PVC_",
      "RIFRANGENTE_"
    ],
    excludeCodeIncludes: ["PVC_CON_RETRO_GRIGIO_PER_ROLLUP"],
    slug: "adesivi-e-vetrofanie",
    title: "Adesivi e vetrofanie"
  },
  {
    accent: "cyan",
    codePrefixes: [
      "ETICHETTE_",
      "MONOMERICO_LAMINATO_STAMPA_E_TAGLIO",
      "MONOMERICO_STAMPA_E_TAGLIO",
      "POLIMERICO_LAMINATO_STAMPA_E_TAGLIO",
      "POLIMERICO_STAMPA_E_TAGLIO"
    ],
    codeIncludes: ["MESSA_IN_MACCHINA"],
    slug: "etichette-adesive",
    title: "Etichette adesive"
  },
  {
    accent: "lime",
    codePrefixes: ["CARTA_FOTOGRAFICA_", "FOTOGRAFIE_", "FOTO_LIBRO_"],
    slug: "stampa-foto",
    title: "Stampa foto"
  },
  {
    accent: "lime",
    codePrefixes: ["STAMPA_IMMAGINE_PIENA_", "STAMPA_PLOTTER_"],
    slug: "poster-fotografici",
    title: "Poster fotografici"
  },
  {
    accent: "lime",
    codePrefixes: ["CANVAS_"],
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
    slug: "quadri-e-pannelli",
    title: "Quadri e pannelli"
  },
  {
    accent: "lime",
    codeIncludes: ["TABLEAU", "CERIMON", "INVITI", "PARTECIPAZ"],
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

  const options = services
    .filter((service) => matchesDefinition(service, definition))
    .map((service) => ({
      code: service.code,
      id: service.id,
      label: service.name,
      quantities: buildQuantityOptions(service)
    }));

  return {
    accent: definition.accent,
    options,
    slug: definition.slug,
    templateLabel: definition.templateLabel || "File guida",
    title: definition.title
  };
}
