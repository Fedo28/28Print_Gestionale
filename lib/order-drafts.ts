export type OrderDraftMode = "order" | "quote";

export type OrderDraftFieldValues = {
  customerName: string;
  customerType: string;
  customerPhone: string;
  customerWhatsapp: string;
  customerEmail: string;
  customerTaxCode: string;
  customerVatNumber: string;
  customerNotes: string;
  title: string;
  deliveryAt: string;
  appointmentAt: string;
  invoiceStatus: string;
  initialDeposit: string;
  appointmentNote: string;
  notes: string;
};

export type OrderDraftItemSnapshot = {
  serviceQuery: string;
  photoMode: boolean;
  photoFormat: string;
  label: string;
  quantity: string;
  unitPrice: string;
  discountMode: string;
  discountValue: string;
  extraMode: string;
  extraValue: string;
  format: string;
  material: string;
  finishing: string;
  notes: string;
  serviceCatalogId: string;
  priceOverridden: boolean;
};

export type OrderDraftSnapshot = {
  version: 1;
  kind: OrderDraftMode;
  savedAt: string;
  selectedCustomerId: string;
  customerQuery: string;
  fields: OrderDraftFieldValues;
  items: OrderDraftItemSnapshot[];
};

export const ORDER_DRAFT_STORAGE_EVENT = "gestionale:order-draft-changed";

export const ORDER_DRAFT_FIELD_NAMES = [
  "customerName",
  "customerType",
  "customerPhone",
  "customerWhatsapp",
  "customerEmail",
  "customerTaxCode",
  "customerVatNumber",
  "customerNotes",
  "title",
  "deliveryAt",
  "appointmentAt",
  "invoiceStatus",
  "initialDeposit",
  "appointmentNote",
  "notes"
] as const satisfies readonly (keyof OrderDraftFieldValues)[];

export function buildOrderDraftStorageKey(kind: OrderDraftMode) {
  return `gestionale.order-draft.${kind}`;
}

export function buildOrderDraftSubmittedKey(kind: OrderDraftMode) {
  return `gestionale.order-draft-submitted.${kind}`;
}

export function createEmptyOrderDraftFields(): OrderDraftFieldValues {
  return {
    customerName: "",
    customerType: "",
    customerPhone: "",
    customerWhatsapp: "",
    customerEmail: "",
    customerTaxCode: "",
    customerVatNumber: "",
    customerNotes: "",
    title: "",
    deliveryAt: "",
    appointmentAt: "",
    invoiceStatus: "",
    initialDeposit: "",
    appointmentNote: "",
    notes: ""
  };
}

export function parseOrderDraftSnapshot(raw: string | null | undefined): OrderDraftSnapshot | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<OrderDraftSnapshot> | null;
    if (!parsed || parsed.version !== 1 || (parsed.kind !== "order" && parsed.kind !== "quote")) {
      return null;
    }

    const baseFields = createEmptyOrderDraftFields();
    const fields = Object.fromEntries(
      ORDER_DRAFT_FIELD_NAMES.map((fieldName) => [
        fieldName,
        typeof parsed.fields?.[fieldName] === "string" ? parsed.fields[fieldName] : baseFields[fieldName]
      ])
    ) as OrderDraftFieldValues;

    return {
      version: 1,
      kind: parsed.kind,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date(0).toISOString(),
      selectedCustomerId: typeof parsed.selectedCustomerId === "string" ? parsed.selectedCustomerId : "",
      customerQuery: typeof parsed.customerQuery === "string" ? parsed.customerQuery : "",
      fields,
      items: Array.isArray(parsed.items)
        ? parsed.items.map((item) => ({
            serviceQuery: typeof item?.serviceQuery === "string" ? item.serviceQuery : "",
            photoMode: Boolean(item?.photoMode),
            photoFormat: typeof item?.photoFormat === "string" ? item.photoFormat : "",
            label: typeof item?.label === "string" ? item.label : "",
            quantity:
              typeof item?.quantity === "string"
                ? item.quantity
                : typeof item?.quantity === "number" && Number.isFinite(item.quantity)
                  ? String(item.quantity).replace(".", ",")
                  : "1",
            unitPrice: typeof item?.unitPrice === "string" ? item.unitPrice : "",
            discountMode: typeof item?.discountMode === "string" ? item.discountMode : "NONE",
            discountValue: typeof item?.discountValue === "string" ? item.discountValue : "",
            extraMode: typeof item?.extraMode === "string" ? item.extraMode : "NONE",
            extraValue: typeof item?.extraValue === "string" ? item.extraValue : "",
            format: typeof item?.format === "string" ? item.format : "",
            material: typeof item?.material === "string" ? item.material : "",
            finishing: typeof item?.finishing === "string" ? item.finishing : "",
            notes: typeof item?.notes === "string" ? item.notes : "",
            serviceCatalogId: typeof item?.serviceCatalogId === "string" ? item.serviceCatalogId : "",
            priceOverridden: Boolean(item?.priceOverridden)
          }))
        : []
    };
  } catch {
    return null;
  }
}

export function hasMeaningfulOrderDraft(snapshot: Pick<OrderDraftSnapshot, "selectedCustomerId" | "customerQuery" | "fields" | "items">) {
  if (snapshot.selectedCustomerId.trim() || snapshot.customerQuery.trim()) {
    return true;
  }

  if (ORDER_DRAFT_FIELD_NAMES.some((fieldName) => snapshot.fields[fieldName].trim())) {
    return true;
  }

  return snapshot.items.some((item) =>
    [
      item.serviceQuery,
      item.photoFormat,
      item.label,
      item.unitPrice,
      item.discountValue,
      item.extraValue,
      item.format,
      item.material,
      item.finishing,
      item.notes,
      item.serviceCatalogId
    ].some((value) => value.trim()) || (item.quantity.trim() && item.quantity.trim() !== "1")
  );
}
