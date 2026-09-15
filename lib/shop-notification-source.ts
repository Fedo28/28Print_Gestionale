export type ShopNotificationSourceTone = "shop" | "rick";

export type ShopNotificationSource = {
  label: string;
  tone: ShopNotificationSourceTone;
};

function normalizeNotificationSourceText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasRickToken(value: string | null | undefined) {
  const normalized = normalizeNotificationSourceText(value);
  return normalized.split(/\s+/).includes("rick");
}

export function resolveShopNotificationSource(input: {
  customerAccountEmail?: string | null;
  customerAccountEmailNormalized?: string | null;
  customerName?: string | null;
  staffEmail?: string | null;
  staffName?: string | null;
  staffNickname?: string | null;
}): ShopNotificationSource {
  const emailLocalPart = String(input.customerAccountEmail || input.customerAccountEmailNormalized || "").split("@")[0];
  const staffEmailLocalPart = String(input.staffEmail || "").split("@")[0];

  if (
    hasRickToken(input.customerName) ||
    hasRickToken(emailLocalPart) ||
    hasRickToken(input.staffName) ||
    hasRickToken(input.staffNickname) ||
    hasRickToken(staffEmailLocalPart)
  ) {
    return {
      label: "Rick",
      tone: "rick"
    };
  }

  return {
    label: "Shop online",
    tone: "shop"
  };
}
