import { prisma } from "@/lib/prisma";
import { parseQuantityTiers } from "@/lib/pricing";

type BusinessCardOptionDefinition = {
  code: string | null;
  key: string;
  label: string;
};

export type BusinessCardQuantityOption = {
  priceCents: number;
  quantity: number;
};

export type BusinessCardShopOption = {
  available: boolean;
  catalogName: string | null;
  code: string | null;
  id: string | null;
  key: string;
  label: string;
  note: string | null;
  quantities: BusinessCardQuantityOption[];
};

const businessCardOptionDefinitions: BusinessCardOptionDefinition[] = [
  {
    key: "standard",
    label: "Standard",
    code: "BIGLIETTI_DA_VISITA_STANDARD_PLASTIFICATO"
  },
  {
    key: "plastificato",
    label: "Plastificato",
    code: "BIGLIETTI_DA_VISITA_NOBILITATO_PLASTIFICATO_LUCIDO_OPACO"
  },
  {
    key: "nobilitato",
    label: "Nobilitato",
    code: "BIGLIETTI_DA_VISITA_NOBILITATO_NON_PLASTIFICATO"
  },
  {
    key: "soft-touch",
    label: "Soft-touch",
    code: "BIGLIETTI_DA_VISITA_PLASTIFICATO_SOFT_TOUCH"
  },
  {
    key: "nobilitato-soft-touch",
    label: "Nobilitato soft-touch",
    code: "BIGLIETTI_DA_VISITA_NOBILITATO_SOFT_TOUCH"
  }
];

function readQuantityOptions(raw: string | null | undefined, basePriceCents: number): BusinessCardQuantityOption[] {
  try {
    const tiers = parseQuantityTiers(raw);
    if (tiers.length) {
      return tiers.map((tier) => ({
        quantity: tier.minQuantity,
        priceCents: tier.unitPriceCents
      }));
    }
  } catch {
    return [];
  }

  return basePriceCents > 0 ? [{ quantity: 1, priceCents: basePriceCents }] : [];
}

export async function getBusinessCardShopOptions(): Promise<BusinessCardShopOption[]> {
  const codes = businessCardOptionDefinitions
    .map((option) => option.code)
    .filter((code): code is string => Boolean(code));

  const services = await prisma.serviceCatalog.findMany({
    where: {
      active: true,
      code: {
        in: codes
      }
    },
    select: {
      basePriceCents: true,
      code: true,
      id: true,
      name: true,
      quantityTiers: true
    }
  });
  const servicesByCode = new Map(services.map((service) => [service.code, service]));

  return businessCardOptionDefinitions.map((definition) => {
    const service = definition.code ? servicesByCode.get(definition.code) : null;
    const quantities = service ? readQuantityOptions(service.quantityTiers, service.basePriceCents) : [];

    return {
      available: Boolean(service && quantities.length),
      catalogName: service?.name || null,
      code: service?.code || definition.code,
      id: service?.id || null,
      key: definition.key,
      label: definition.label,
      note:
        definition.key === "plastificato"
          ? "Voce collegata alla riga catalogo nobilitato plastificato lucido/opaco."
          : null,
      quantities
    };
  });
}
