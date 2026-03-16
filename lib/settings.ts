import { DEFAULT_WHATSAPP_TEMPLATE } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export async function getSetting(key: string, fallback = "") {
  const setting = await prisma.appSetting.findUnique({ where: { key } });
  return setting?.value ?? fallback;
}

export async function saveSetting(key: string, value: string) {
  return prisma.appSetting.upsert({
    where: { key },
    update: { value },
    create: { key, value }
  });
}

export async function getWhatsappTemplate() {
  return getSetting("whatsappTemplate", DEFAULT_WHATSAPP_TEMPLATE);
}
