type PhotoPriceSchedule = {
  basePriceCents: number;
  quantityTiers: string;
};

const PHOTO_PRICE_SCHEDULES: Record<string, PhotoPriceSchedule> = {
  "10x15": {
    basePriceCents: 50,
    quantityTiers: "1-10:0,50 | 11-100:0,40 | 101-500:0,35 | 501+:0,30"
  },
  "13x18": {
    basePriceCents: 100,
    quantityTiers: "1-100:1,00 | 101+:0,80"
  },
  "15x20": {
    basePriceCents: 100,
    quantityTiers: "1-100:1,00 | 101+:0,80"
  }
};

function photoFormatKeys(value: string | null | undefined) {
  return [...String(value || "").matchAll(/(\d{1,3})\s*[xX]\s*(\d{1,3})/g)].map((match) => {
    const sides = [Number(match[1]), Number(match[2])].sort((first, second) => first - second);
    return `${sides[0]}x${sides[1]}`;
  });
}

export function getShopPhotoPriceSchedule(format: string | null | undefined): PhotoPriceSchedule | null {
  const [key] = photoFormatKeys(format);
  return key ? PHOTO_PRICE_SCHEDULES[key] || null : null;
}

export function resolveShopPhotoOnlineServicePricing<TService extends {
  basePriceCents: number;
  code: string | null;
  name: string;
  quantityTiers: string | null;
}>(service: TService, sourcePath: string | null | undefined, serviceLabel: string | null | undefined): TService {
  if (String(sourcePath || "").split("?")[0] !== "/shop/servizi/stampa-foto") return service;

  const [format] = photoFormatKeys(serviceLabel);
  const schedule = format ? PHOTO_PRICE_SCHEDULES[format] : null;
  const serviceFormats = photoFormatKeys(`${service.code || ""} ${service.name}`);
  if (!schedule || !serviceFormats.includes(format)) return service;

  return { ...service, ...schedule };
}
