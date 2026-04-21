"use client";

import { Customer, CustomerType, ServiceCatalog } from "@prisma/client";
import { useEffect, useRef, useState } from "react";
import { CustomerAutocomplete } from "@/components/customer-autocomplete";
import { customerTypeLabels, getAppointmentNoteOptions, invoiceStatusLabels, priorityLabels } from "@/lib/constants";
import { formatCurrency, formatDateTime, formatQuantity } from "@/lib/format";
import { computeAutomaticPriority } from "@/lib/priorities";
import {
  buildOrderDraftStorageKey,
  buildOrderDraftSubmittedKey,
  createEmptyOrderDraftFields,
  hasMeaningfulOrderDraft,
  ORDER_DRAFT_FIELD_NAMES,
  parseOrderDraftSnapshot,
  type OrderDraftFieldValues,
  type OrderDraftMode,
  type OrderDraftSnapshot
} from "@/lib/order-drafts";
import {
  type CatalogPriceMode,
  computeLineTotalWithAdjustmentsCents,
  computeEffectiveUnitPriceCents,
  discountModeLabels,
  getTieredUnitPrice,
  parseQuantityValue,
  parseQuantityTiers,
  type QuantityTier,
  type DiscountModeValue
} from "@/lib/pricing";

type CustomerWithOrders = Customer & { orders: { id: string }[] };

type ItemState = {
  serviceQuery: string;
  photoMode: boolean;
  photoFormat: string;
  label: string;
  quantity: string;
  unitPrice: string;
  discountMode: DiscountModeValue;
  discountValue: string;
  extraMode: DiscountModeValue;
  extraValue: string;
  format: string;
  material: string;
  finishing: string;
  notes: string;
  serviceCatalogId: string;
  priceOverridden: boolean;
};

type LabelCalculatorDraft = {
  widthCm: string;
  heightCm: string;
  quantity: string;
  materialServiceId: string;
  singleCut: boolean;
};

const LABEL_CALCULATOR_FORMAT_PREFIX = "Calcolatore etichette";
const LABEL_CALCULATOR_MATERIAL_NAMES = [
  "Etichette - Polimerico laminato stampa e taglio",
  "Etichette - Polimerico stampa e taglio",
  "Etichette - Monomerico laminato stampa e taglio",
  "Etichette - Monomerico stampa e taglio"
] as const;

const normalizedLabelCalculatorMaterials = new Set(
  LABEL_CALCULATOR_MATERIAL_NAMES.map((entry) => entry.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim())
);

const emptyItem = (): ItemState => ({
  serviceQuery: "",
  photoMode: false,
  photoFormat: "",
  label: "",
  quantity: "1",
  unitPrice: "",
  discountMode: "NONE",
  discountValue: "",
  extraMode: "NONE",
  extraValue: "",
  format: "",
  material: "",
  finishing: "",
  notes: "",
  serviceCatalogId: "",
  priceOverridden: false
});

function getPreferredCustomerPrimaryContact(customer: Pick<Customer, "phone" | "whatsapp">) {
  return customer.phone?.trim() || customer.whatsapp?.trim() || "Telefono non inserito";
}

function getPreferredCustomerSecondaryContact(customer: Pick<Customer, "email" | "pec" | "whatsapp" | "phone">) {
  const primaryContact = customer.phone?.trim() || customer.whatsapp?.trim() || "";
  return customer.email?.trim() || customer.pec?.trim() || (customer.whatsapp?.trim() && customer.whatsapp?.trim() !== primaryContact ? customer.whatsapp.trim() : "") || "Nessun contatto secondario";
}

function isBlankEditorItem(item: ItemState) {
  return (
    !item.serviceQuery.trim() &&
    !item.photoMode &&
    !item.photoFormat.trim() &&
    !item.label.trim() &&
    (item.quantity.trim() === "" || item.quantity.trim() === "1") &&
    !item.unitPrice.trim() &&
    item.discountMode === "NONE" &&
    !item.discountValue.trim() &&
    item.extraMode === "NONE" &&
    !item.extraValue.trim() &&
    !item.format.trim() &&
    !item.material.trim() &&
    !item.finishing.trim() &&
    !item.notes.trim() &&
    !item.serviceCatalogId &&
    !item.priceOverridden
  );
}

function normalizeEditorItems(items: ItemState[]) {
  const nextItems = [...items];

  while (nextItems.length > 1 && isBlankEditorItem(nextItems[nextItems.length - 1])) {
    nextItems.pop();
  }

  return nextItems.length > 0 ? nextItems : [emptyItem()];
}

function getCatalogPriceModeForService(service: ServiceCatalog | undefined): CatalogPriceMode {
  return service?.quantityTiers?.trim() ? "LINE_TOTAL" : "UNIT";
}

function isLabelCalculatorMaterialService(service: ServiceCatalog | undefined) {
  if (!service) {
    return false;
  }

  const normalizedName = service.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  return normalizedLabelCalculatorMaterials.has(normalizedName);
}

function isLabelCalculatorFormat(format: string | null | undefined) {
  return normalizeCatalogSearch(format || "").startsWith(normalizeCatalogSearch(LABEL_CALCULATOR_FORMAT_PREFIX));
}

function createEmptyLabelCalculatorDraft(): LabelCalculatorDraft {
  return {
    widthCm: "",
    heightCm: "",
    quantity: "",
    materialServiceId: "",
    singleCut: false
  };
}

function parseLabelCalculatorFormat(format: string | null | undefined) {
  const value = String(format || "");
  const match = value.match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*cm/i);
  if (!match) {
    return null;
  }

  return {
    widthCm: match[1].replace(".", ","),
    heightCm: match[2].replace(".", ",")
  };
}

function buildLabelCalculatorFormat(widthCm: string, heightCm: string) {
  return `${LABEL_CALCULATOR_FORMAT_PREFIX} • ${widthCm}x${heightCm} cm`;
}

function computeLabelCalculatorTotalCents(
  widthCm: number,
  heightCm: number,
  quantity: number,
  materialPriceCents: number,
  singleCut: boolean
) {
  const expandedWidthMeters = (widthCm + 1) / 100;
  const expandedHeightMeters = (heightCm + 1) / 100;
  const materialCostCents = Math.round(expandedWidthMeters * expandedHeightMeters * quantity * materialPriceCents);
  const machineSetupCents = 2000;
  const subtotalCents = materialCostCents + machineSetupCents;

  return singleCut ? Math.round(subtotalCents * 1.2) : subtotalCents;
}

function createItemStateFromDraft(item?: Partial<OrderDraftSnapshot["items"][number]>): ItemState {
  return {
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
    discountMode: item?.discountMode === "AMOUNT" || item?.discountMode === "PERCENT" ? item.discountMode : "NONE",
    discountValue: typeof item?.discountValue === "string" ? item.discountValue : "",
    extraMode: item?.extraMode === "AMOUNT" || item?.extraMode === "PERCENT" ? item.extraMode : "NONE",
    extraValue: typeof item?.extraValue === "string" ? item.extraValue : "",
    format: typeof item?.format === "string" ? item.format : "",
    material: typeof item?.material === "string" ? item.material : "",
    finishing: typeof item?.finishing === "string" ? item.finishing : "",
    notes: typeof item?.notes === "string" ? item.notes : "",
    serviceCatalogId: typeof item?.serviceCatalogId === "string" ? item.serviceCatalogId : "",
    priceOverridden: Boolean(item?.priceOverridden)
  };
}

function formatLabelCalculatorDraftValue(value: string) {
  return value.trim().replace(/\./g, ",");
}

function parseDisplayPriceToCents(value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  return normalized ? Math.max(0, Math.round(Number(normalized) * 100) || 0) : 0;
}

function parseDiscountValue(mode: DiscountModeValue, value: string) {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  if (!normalized) {
    return 0;
  }

  const parsed = Math.max(0, Number(normalized));
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  if (mode === "AMOUNT") {
    return Math.round(parsed * 100);
  }

  if (mode === "PERCENT") {
    return Math.min(100, Math.round(parsed));
  }

  return 0;
}

function formatQuantityInput(value: string | number) {
  const quantity = parseQuantityValue(value, 1);
  return quantity.toLocaleString("it-IT", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

function normalizeCatalogSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isPhotographyService(service: ServiceCatalog) {
  return String(service.code || "").startsWith("FOTOGRAFIE_");
}

function getServiceSearchScore(service: ServiceCatalog, normalizedQuery: string) {
  const normalizedName = normalizeCatalogSearch(service.name);
  const normalizedCode = normalizeCatalogSearch(service.code || "");
  const normalizedDescription = normalizeCatalogSearch(service.description || "");
  const haystack = [normalizedCode, normalizedName, normalizedDescription].join(" ");
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  if (!terms.length || !terms.every((term) => haystack.includes(term))) {
    return Number.MAX_SAFE_INTEGER;
  }

  if (normalizedCode === normalizedQuery) {
    return 0;
  }

  if (normalizedName === normalizedQuery) {
    return 1;
  }

  if (normalizedCode.startsWith(normalizedQuery)) {
    return 2;
  }

  if (normalizedName.startsWith(normalizedQuery)) {
    return 3;
  }

  if (normalizedName.includes(normalizedQuery)) {
    return 4;
  }

  return 5;
}

function getServiceTiers(service: ServiceCatalog | undefined): QuantityTier[] {
  if (!service?.quantityTiers) {
    return [];
  }

  try {
    return parseQuantityTiers(service.quantityTiers);
  } catch {
    return [];
  }
}

function isTierSelected(tier: QuantityTier, quantity: number) {
  return quantity >= tier.minQuantity && (tier.maxQuantity === null || quantity <= tier.maxQuantity);
}

function formatTierLabel(tier: QuantityTier) {
  return tier.maxQuantity === null
    ? `${tier.minQuantity}+`
    : tier.maxQuantity === tier.minQuantity
      ? `${tier.minQuantity}`
      : `${tier.minQuantity}-${tier.maxQuantity}`;
}

function getPhotographyFormatOptions(services: ServiceCatalog[]) {
  return services
    .filter(isPhotographyService)
    .flatMap((service) => {
      const rawFormats = service.name.replace(/^Fotografie\s*-\s*/i, "").split("/");
      const normalizedFormats = rawFormats
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => entry.replace(/\s+/g, " "));

      return normalizedFormats.map((format) => ({
        key: `${service.id}:${format}`,
        label: format,
        serviceId: service.id,
        serviceName: service.name,
        service
      }));
    });
}

type ServiceSuggestion =
  | {
      type: "service";
      key: string;
      label: string;
      meta: string;
      service: ServiceCatalog;
    }
  | {
      type: "photography";
      key: string;
      label: string;
      meta: string;
    };

type OrderFormMode = "order" | "quote";
type MobileOrderStep = "customer" | "details" | "items" | "review";

type InlineCatalogDraft = {
  name: string;
  code: string;
  basePrice: string;
  description: string;
  quantityTiers: string;
};

type CatalogActionFeedback = {
  rowIndex: number;
  tone: "success" | "error";
  message: string;
};

type MobileOrderMeta = {
  customerName: string;
  customerType: string;
  title: string;
  deliveryAt: string;
  appointmentAt: string;
  appointmentNote: string;
  notes: string;
  invoiceStatus: string;
  initialDeposit: string;
};

const MOBILE_ORDER_MEDIA_QUERY = "(max-width: 768px)";
const MOBILE_ORDER_STEPS: Array<{
  id: MobileOrderStep;
  label: string;
  description: string;
}> = [
  { id: "customer", label: "Cliente", description: "Scegli un cliente esistente oppure creane uno nuovo." },
  { id: "details", label: "Dettagli", description: "Compila titolo, consegna e appuntamento. La priorita viene assegnata da sola." },
  { id: "items", label: "Lavorazioni", description: "Aggiungi e rifinisci le righe di lavorazione." },
  { id: "review", label: "Riepilogo", description: "Controlla i dati finali e conferma l'ordine." }
] as const;

function createEmptyInlineCatalogDraft(): InlineCatalogDraft {
  return {
    name: "",
    code: "",
    basePrice: "",
    description: "",
    quantityTiers: ""
  };
}

function createEmptyMobileOrderMeta(): MobileOrderMeta {
  return {
    customerName: "",
    customerType: "",
    title: "",
    deliveryAt: "",
    appointmentAt: "",
    appointmentNote: "",
    notes: "",
    invoiceStatus: "DA_FATTURARE",
    initialDeposit: ""
  };
}

export function OrderForm({
  customers,
  services,
  action,
  kind = "order"
}: {
  customers: CustomerWithOrders[];
  services: ServiceCatalog[];
  action: (formData: FormData) => void | Promise<void>;
  kind?: OrderFormMode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const autosaveTimerRef = useRef<number | null>(null);
  const mobileMetaFrameRef = useRef<number | null>(null);
  const [catalogServices, setCatalogServices] = useState<ServiceCatalog[]>(services);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [items, setItems] = useState<ItemState[]>([emptyItem()]);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileStep, setMobileStep] = useState<MobileOrderStep>("customer");
  const [mobileMeta, setMobileMeta] = useState<MobileOrderMeta>(createEmptyMobileOrderMeta());
  const [openMobileItemIndex, setOpenMobileItemIndex] = useState<number | null>(null);
  const [activeServiceField, setActiveServiceField] = useState<number | null>(null);
  const [openTierIndex, setOpenTierIndex] = useState<number | null>(null);
  const [catalogDraftRowIndex, setCatalogDraftRowIndex] = useState<number | null>(null);
  const [catalogDraft, setCatalogDraft] = useState<InlineCatalogDraft>(createEmptyInlineCatalogDraft());
  const [catalogDraftMessage, setCatalogDraftMessage] = useState<string | null>(null);
  const [labelCalculatorRowIndex, setLabelCalculatorRowIndex] = useState<number | null>(null);
  const [labelCalculatorDraft, setLabelCalculatorDraft] = useState<LabelCalculatorDraft>(createEmptyLabelCalculatorDraft());
  const [isCatalogDraftSubmitting, setIsCatalogDraftSubmitting] = useState(false);
  const [catalogMutatingServiceId, setCatalogMutatingServiceId] = useState<string | null>(null);
  const [catalogActionFeedback, setCatalogActionFeedback] = useState<CatalogActionFeedback | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(null);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const [appointmentNoteValue, setAppointmentNoteValue] = useState("");
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const photographyFormats = getPhotographyFormatOptions(catalogServices);
  const photographyServices = catalogServices.filter(isPhotographyService);
  const labelCalculatorMaterials = LABEL_CALCULATOR_MATERIAL_NAMES.map((name) =>
    catalogServices.find((service) => service.name === name)
  ).filter((service): service is ServiceCatalog => Boolean(service));
  const isCatalogEmpty = catalogServices.length === 0;
  const defaultCustomerType: CustomerType = "PUBBLICO";
  const isQuoteMode = kind === "quote";
  const availableAppointmentNoteOptions = getAppointmentNoteOptions(appointmentNoteValue);
  const draftStorageKey = buildOrderDraftStorageKey(kind as OrderDraftMode);
  const submittedDraftKey = buildOrderDraftSubmittedKey(kind as OrderDraftMode);
  const mobileStepIndex = MOBILE_ORDER_STEPS.findIndex((step) => step.id === mobileStep);
  const isMobileItemSheetOpen = openMobileItemIndex !== null;

  function addEmptyItemLine() {
    const nextIndex = items.length;
    setItems((current) => [...current, emptyItem()]);
    setOpenMobileItemIndex(isMobileViewport ? nextIndex : null);
  }

  function openMobileItemEditor(index: number) {
    setOpenMobileItemIndex(index);
  }

  function closeMobileItemEditor() {
    setOpenMobileItemIndex(null);
    setActiveServiceField(null);
    setOpenTierIndex(null);
    closeInlineCatalogDraft();
    closeLabelCalculator();
  }

  function removeItemLine(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setActiveServiceField((current) => {
      if (current === null) {
        return null;
      }

      if (current === index) {
        return null;
      }

      return current > index ? current - 1 : current;
    });
    setOpenTierIndex((current) => {
      if (current === null) {
        return null;
      }

      if (current === index) {
        return null;
      }

      return current > index ? current - 1 : current;
    });
    closeInlineCatalogDraft();
    closeLabelCalculator();
    setOpenMobileItemIndex((current) => {
      if (current === null) {
        return null;
      }

      if (current === index) {
        return null;
      }

      return current > index ? current - 1 : current;
    });
  }

  function readDraftFieldsFromForm(): OrderDraftFieldValues {
    const form = formRef.current;
    const emptyFields = createEmptyOrderDraftFields();

    if (!form) {
      return emptyFields;
    }

    const formData = new FormData(form);
    return Object.fromEntries(
      ORDER_DRAFT_FIELD_NAMES.map((fieldName) => [fieldName, String(formData.get(fieldName) || "")])
    ) as OrderDraftFieldValues;
  }

  function applyDraftFields(fields: OrderDraftFieldValues) {
    const form = formRef.current;
    if (!form) {
      return;
    }

    for (const fieldName of ORDER_DRAFT_FIELD_NAMES) {
      const element = form.elements.namedItem(fieldName);
      if (
        element instanceof HTMLInputElement ||
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLSelectElement
      ) {
        element.value = fields[fieldName];
      }
    }
  }

  function clearSavedDraftStorage() {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.removeItem(draftStorageKey);
    window.sessionStorage.removeItem(submittedDraftKey);
    setHasSavedDraft(false);
    setLastDraftSavedAt(null);
    setDraftRestoredAt(null);
  }

  function resetDraftAndForm() {
    clearSavedDraftStorage();
    formRef.current?.reset();
    setSelectedCustomerId("");
    setCustomerQuery("");
    setMobileMeta(createEmptyMobileOrderMeta());
    setMobileStep("customer");
    setAppointmentNoteValue("");
    setItems([emptyItem()]);
    setOpenMobileItemIndex(null);
    setActiveServiceField(null);
    setOpenTierIndex(null);
    setCatalogDraftRowIndex(null);
    setCatalogDraft(createEmptyInlineCatalogDraft());
    setCatalogDraftMessage(null);
    setLabelCalculatorRowIndex(null);
    setLabelCalculatorDraft(createEmptyLabelCalculatorDraft());
    setCatalogActionFeedback(null);
  }

  function persistDraft() {
    if (typeof window === "undefined") {
      return;
    }

    const snapshot: OrderDraftSnapshot = {
      version: 1,
      kind: kind as OrderDraftMode,
      savedAt: new Date().toISOString(),
      selectedCustomerId,
      customerQuery,
      fields: readDraftFieldsFromForm(),
      items
    };

    if (!hasMeaningfulOrderDraft(snapshot)) {
      window.localStorage.removeItem(draftStorageKey);
      setHasSavedDraft(false);
      setLastDraftSavedAt(null);
      return;
    }

    window.localStorage.setItem(draftStorageKey, JSON.stringify(snapshot));
    setHasSavedDraft(true);
    setLastDraftSavedAt(snapshot.savedAt);
  }

  function scheduleDraftSave() {
    if (!draftHydrated || typeof window === "undefined") {
      return;
    }

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(() => {
      persistDraft();
    }, 500);
  }

  function syncMobileMetaFromForm() {
    const form = formRef.current;
    if (!form) {
      return;
    }

    const formData = new FormData(form);
    setMobileMeta({
      customerName: String(formData.get("customerName") || ""),
      customerType: String(formData.get("customerType") || defaultCustomerType),
      title: String(formData.get("title") || ""),
      deliveryAt: String(formData.get("deliveryAt") || ""),
      appointmentAt: String(formData.get("appointmentAt") || ""),
      appointmentNote: String(formData.get("appointmentNote") || ""),
      notes: String(formData.get("notes") || ""),
      invoiceStatus: String(formData.get("invoiceStatus") || "DA_FATTURARE"),
      initialDeposit: String(formData.get("initialDeposit") || "")
    });
  }

  function scheduleMobileMetaSync() {
    if (typeof window === "undefined") {
      return;
    }

    if (mobileMetaFrameRef.current) {
      window.cancelAnimationFrame(mobileMetaFrameRef.current);
    }

    mobileMetaFrameRef.current = window.requestAnimationFrame(() => {
      syncMobileMetaFromForm();
      mobileMetaFrameRef.current = null;
    });
  }

  function jumpToMobileStep(step: MobileOrderStep) {
    setMobileStep(step);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  useEffect(() => {
    setCatalogServices(services);
  }, [services]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(MOBILE_ORDER_MEDIA_QUERY);
    const syncViewport = (matches: boolean) => {
      setIsMobileViewport(matches);
    };

    syncViewport(mediaQuery.matches);

    const handleViewportChange = (event: MediaQueryListEvent) => {
      syncViewport(event.matches);
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleViewportChange);
      return () => mediaQuery.removeEventListener("change", handleViewportChange);
    }

    mediaQuery.addListener(handleViewportChange);
    return () => mediaQuery.removeListener(handleViewportChange);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (window.sessionStorage.getItem(submittedDraftKey) === "1") {
      window.localStorage.removeItem(draftStorageKey);
      window.sessionStorage.removeItem(submittedDraftKey);
      setDraftHydrated(true);
      setHasSavedDraft(false);
      setLastDraftSavedAt(null);
      setDraftRestoredAt(null);
      setMobileMeta(createEmptyMobileOrderMeta());
      return;
    }

    const draft = parseOrderDraftSnapshot(window.localStorage.getItem(draftStorageKey));
    if (!draft || draft.kind !== kind) {
      setDraftHydrated(true);
      return;
    }

    const nextSelectedCustomerId =
      draft.selectedCustomerId && customers.some((customer) => customer.id === draft.selectedCustomerId)
        ? draft.selectedCustomerId
        : "";

    setSelectedCustomerId(nextSelectedCustomerId);
    setCustomerQuery(draft.customerQuery);
    setAppointmentNoteValue(draft.fields.appointmentNote);
    setItems(
      normalizeEditorItems(draft.items.length > 0 ? draft.items.map((item) => createItemStateFromDraft(item)) : [emptyItem()])
    );
    setHasSavedDraft(true);
    setLastDraftSavedAt(draft.savedAt);
    setDraftRestoredAt(draft.savedAt);

    window.setTimeout(() => {
      applyDraftFields(draft.fields);
      setDraftHydrated(true);
      syncMobileMetaFromForm();
    }, 0);
  }, [customers, draftStorageKey, kind, submittedDraftKey]);

  useEffect(() => {
    if (!draftHydrated) {
      return;
    }

    scheduleDraftSave();
  }, [draftHydrated, selectedCustomerId, customerQuery, items]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
      }
      if (typeof window !== "undefined" && mobileMetaFrameRef.current) {
        window.cancelAnimationFrame(mobileMetaFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!draftHydrated) {
      return;
    }

    scheduleMobileMetaSync();
  }, [draftHydrated, selectedCustomerId, customerQuery, items]);

  useEffect(() => {
    if (!items.length) {
      setOpenMobileItemIndex(null);
      return;
    }

    setOpenMobileItemIndex((current) => (current === null ? null : Math.min(current, items.length - 1)));
  }, [items.length]);

  useEffect(() => {
    if (!isMobileViewport || mobileStep !== "items") {
      setOpenMobileItemIndex(null);
    }
  }, [isMobileViewport, mobileStep]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const shouldLockBody = isMobileViewport && isMobileItemSheetOpen;
    document.body.classList.toggle("order-mobile-line-sheet-open", shouldLockBody);

    return () => {
      document.body.classList.remove("order-mobile-line-sheet-open");
    };
  }, [isMobileViewport, isMobileItemSheetOpen]);

  function getCatalogPriceDisplay(service: ServiceCatalog | undefined, quantity: number) {
    if (!service) {
      return "";
    }

    let cents = service.basePriceCents;

    try {
      cents = getTieredUnitPrice(service.basePriceCents, quantity, service.quantityTiers);
    } catch {
      cents = service.basePriceCents;
    }

    return (cents / 100).toFixed(2).replace(".", ",");
  }

  function getCatalogPriceModeForItem(item: ItemState) {
    if (isLabelCalculatorFormat(item.format)) {
      return "LINE_TOTAL";
    }

    const service = catalogServices.find((entry) => entry.id === item.serviceCatalogId);
    return getCatalogPriceModeForService(service);
  }

  function getServiceSuggestions(query: string) {
    const normalizedQuery = normalizeCatalogSearch(query);

    if (!normalizedQuery) {
      return [] as ServiceSuggestion[];
    }

    const serviceSuggestions: ServiceSuggestion[] = catalogServices
      .filter((service) => !isPhotographyService(service))
      .map((service) => ({
        type: "service" as const,
        key: service.id,
        label: service.name,
        meta: formatCurrency(service.basePriceCents),
        service,
        score: getServiceSearchScore(service, normalizedQuery)
      }))
      .filter((entry) => entry.score !== Number.MAX_SAFE_INTEGER)
      .sort(
        (left, right) =>
          left.score - right.score ||
          left.service.name.localeCompare(right.service.name, "it") ||
          (left.service.code || "").localeCompare(right.service.code || "", "it")
      )
      .slice(0, 6)
      .map(({ score: _score, ...entry }) => entry);

    const photographyScore = photographyServices.length
      ? Math.min(...photographyServices.map((service) => getServiceSearchScore(service, normalizedQuery)))
      : Number.MAX_SAFE_INTEGER;

    if (photographyScore !== Number.MAX_SAFE_INTEGER) {
      serviceSuggestions.unshift({
        type: "photography",
        key: "photography-group",
        label: "Fotografie",
        meta: "Seleziona il taglio foto nella colonna accanto"
      });
    }

    return serviceSuggestions.slice(0, 6);
  }

  function openInlineCatalogDraft(index: number) {
    const row = items[index];
    if (!row) {
      return;
    }

    setCatalogDraftRowIndex(index);
    setCatalogDraftMessage(null);
    setCatalogDraft({
      name: row.serviceQuery.trim() || row.label.trim(),
      code: "",
      basePrice: row.unitPrice,
      description: "",
      quantityTiers: ""
    });
  }

  function closeInlineCatalogDraft() {
    setCatalogDraftRowIndex(null);
    setCatalogDraft(createEmptyInlineCatalogDraft());
    setCatalogDraftMessage(null);
  }

  function openLabelCalculator(index: number) {
    const row = items[index];
    const parsedFormat = parseLabelCalculatorFormat(row?.format);

    setLabelCalculatorRowIndex(index);
    setLabelCalculatorDraft({
      widthCm: parsedFormat?.widthCm || "",
      heightCm: parsedFormat?.heightCm || "",
      quantity: row?.quantity || "",
      materialServiceId:
        row?.serviceCatalogId && labelCalculatorMaterials.some((service) => service.id === row.serviceCatalogId)
          ? row.serviceCatalogId
          : "",
      singleCut: normalizeCatalogSearch(row?.finishing || "") === normalizeCatalogSearch("Taglio singolo")
    });
  }

  function closeLabelCalculator() {
    setLabelCalculatorRowIndex(null);
    setLabelCalculatorDraft(createEmptyLabelCalculatorDraft());
  }

  function applyLabelCalculator(index: number) {
    const materialService = labelCalculatorMaterials.find((service) => service.id === labelCalculatorDraft.materialServiceId);
    const widthCm = parseQuantityValue(labelCalculatorDraft.widthCm, 0);
    const heightCm = parseQuantityValue(labelCalculatorDraft.heightCm, 0);
    const quantity = parseQuantityValue(labelCalculatorDraft.quantity, 0);

    if (!materialService || widthCm <= 0 || heightCm <= 0 || quantity <= 0) {
      return;
    }

    const totalCents = computeLabelCalculatorTotalCents(
      widthCm,
      heightCm,
      quantity,
      materialService.basePriceCents,
      labelCalculatorDraft.singleCut
    );
    const quantityInput = formatQuantityInput(quantity);
    const widthInput = formatLabelCalculatorDraftValue(labelCalculatorDraft.widthCm);
    const heightInput = formatLabelCalculatorDraftValue(labelCalculatorDraft.heightCm);

    setItems((current) =>
      current.map((entry, itemIndex) =>
        itemIndex === index
          ? {
              ...entry,
              serviceQuery: materialService.name,
              label: materialService.name,
              serviceCatalogId: materialService.id,
              quantity: quantityInput,
              unitPrice: (totalCents / 100).toFixed(2).replace(".", ","),
              priceOverridden: true,
              format: buildLabelCalculatorFormat(widthInput, heightInput),
              material: materialService.name,
              finishing: labelCalculatorDraft.singleCut ? "Taglio singolo" : ""
            }
          : entry
      )
    );
    closeLabelCalculator();
  }

  async function saveInlineCatalogDraft(index: number) {
    if (!catalogDraft.name.trim()) {
      setCatalogDraftMessage("Il nome servizio e obbligatorio.");
      return;
    }

    setIsCatalogDraftSubmitting(true);
    setCatalogDraftMessage(null);

    try {
      const response = await fetch("/api/services", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(catalogDraft)
      });

      const body = (await response.json().catch(() => null)) as
        | {
            error?: string;
            service?: ServiceCatalog;
          }
        | null;

      const createdService = body?.service;

      if (!response.ok || !createdService) {
        setCatalogDraftMessage(body?.error || "Impossibile salvare il servizio nel catalogo.");
        return;
      }

      setCatalogServices((current) =>
        [...current, createdService].sort((left, right) => left.name.localeCompare(right.name, "it"))
      );
      selectServiceForRow(index, createdService);
      setCatalogDraftRowIndex(null);
      setCatalogDraft(createEmptyInlineCatalogDraft());
      setCatalogDraftMessage(null);
    } catch {
      setCatalogDraftMessage("Errore di rete durante il salvataggio del servizio.");
    } finally {
      setIsCatalogDraftSubmitting(false);
    }
  }

  async function deactivateCatalogService(index: number, service: ServiceCatalog) {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Disattivare "${service.name}" dal catalogo? Non comparira piu nei nuovi ordini, ma restera negli ordini gia salvati.`
      )
    ) {
      return;
    }

    setCatalogMutatingServiceId(service.id);
    setCatalogActionFeedback(null);

    try {
      const response = await fetch("/api/services", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: service.id,
          active: false
        })
      });

      const body = (await response.json().catch(() => null)) as
        | {
            error?: string;
            service?: ServiceCatalog;
          }
        | null;

      if (!response.ok) {
        setCatalogActionFeedback({
          rowIndex: index,
          tone: "error",
          message: body?.error || "Impossibile disattivare il servizio."
        });
        return;
      }

      setCatalogServices((current) => current.filter((entry) => entry.id !== service.id));
      setItems((current) =>
        current.map((entry) =>
          entry.serviceCatalogId === service.id
            ? {
                ...entry,
                serviceCatalogId: "",
                format: isLabelCalculatorFormat(entry.format) ? "" : entry.format,
                material: isLabelCalculatorFormat(entry.format) ? "" : entry.material,
                finishing: isLabelCalculatorFormat(entry.format) ? "" : entry.finishing
              }
            : entry
        )
      );
      setOpenTierIndex((current) => (current === index ? null : current));
      setCatalogActionFeedback({
        rowIndex: index,
        tone: "success",
        message: `"${service.name}" disattivato dal catalogo.`
      });
    } catch {
      setCatalogActionFeedback({
        rowIndex: index,
        tone: "error",
        message: "Errore di rete durante la disattivazione del servizio."
      });
    } finally {
      setCatalogMutatingServiceId(null);
    }
  }

  function selectServiceForRow(index: number, service: ServiceCatalog) {
    setItems((current) =>
      current.map((entry, itemIndex) =>
        itemIndex === index
          ? {
              ...entry,
              serviceCatalogId: service.id,
              serviceQuery: service.name,
              photoMode: false,
              photoFormat: "",
              label: service.name,
              unitPrice: getCatalogPriceDisplay(service, parseQuantityValue(entry.quantity)),
              discountMode: "NONE",
              discountValue: "",
              extraMode: "NONE",
              extraValue: "",
              format: "",
              material: "",
              finishing: "",
              priceOverridden: false
            }
          : entry
      )
    );
    setActiveServiceField(null);
    setCatalogActionFeedback(null);
    closeLabelCalculator();
    if (catalogDraftRowIndex === index) {
      closeInlineCatalogDraft();
    }
  }

  function selectPhotographyForRow(index: number) {
    setItems((current) =>
      current.map((entry, itemIndex) =>
        itemIndex === index
          ? {
              ...entry,
              serviceQuery: "Fotografie",
              photoMode: true,
              photoFormat: "",
              label: "Fotografie",
              serviceCatalogId: "",
              unitPrice: "",
              discountMode: "NONE",
              discountValue: "",
              extraMode: "NONE",
              extraValue: "",
              priceOverridden: false,
              format: ""
            }
          : entry
      )
    );
    setActiveServiceField(null);
    setCatalogActionFeedback(null);
    closeLabelCalculator();
    if (catalogDraftRowIndex === index) {
      closeInlineCatalogDraft();
    }
  }

  const itemsPayload = JSON.stringify(
    items
      .map((item) => {
        const service = catalogServices.find((entry) => entry.id === item.serviceCatalogId);
        const quantity = parseQuantityValue(item.quantity, 1);
        const catalogBasePriceCents = parseDisplayPriceToCents(item.unitPrice);
        const discountValue = parseDiscountValue(item.discountMode, item.discountValue);
        const extraValue = parseDiscountValue(item.extraMode, item.extraValue);
        const catalogPriceMode = getCatalogPriceModeForItem(item);
        const lineTotalCents = computeLineTotalWithAdjustmentsCents(
          catalogBasePriceCents,
          quantity,
          item.discountMode,
          discountValue,
          item.extraMode,
          extraValue,
          catalogPriceMode
        );
        const unitPriceCents = computeEffectiveUnitPriceCents(lineTotalCents, quantity);

        return {
          ...item,
          photoMode: undefined,
          photoFormat: undefined,
          label: item.label || item.serviceQuery || service?.name || "",
          serviceCatalogId: item.serviceCatalogId || undefined,
          priceOverridden: undefined,
          quantity,
          catalogBasePriceCents,
          catalogPriceMode,
          discountValue,
          extraValue,
          unitPriceCents
        };
      })
      .filter((item) => item.label.trim() && (!item.serviceQuery || item.serviceQuery !== "Fotografie" || Boolean(item.serviceCatalogId)))
  );
  const previewTotalCents = items.reduce((sum, item) => {
    const quantity = parseQuantityValue(item.quantity, 1);
    const catalogPriceMode = getCatalogPriceModeForItem(item);
    const lineTotalCents = computeLineTotalWithAdjustmentsCents(
      parseDisplayPriceToCents(item.unitPrice),
      quantity,
      item.discountMode,
      parseDiscountValue(item.discountMode, item.discountValue),
      item.extraMode,
      parseDiscountValue(item.extraMode, item.extraValue),
      catalogPriceMode
    );
    return sum + (Number.isFinite(lineTotalCents) ? lineTotalCents : 0);
  }, 0);
  const filledRows = items.filter((item) => item.label.trim() || item.notes.trim()).length;
  const selectedCustomerTypeLabel = selectedCustomer
    ? customerTypeLabels[selectedCustomer.type]
    : customerTypeLabels[(mobileMeta.customerType as CustomerType) || defaultCustomerType];
  const reviewCustomerName = selectedCustomer ? selectedCustomer.name : mobileMeta.customerName.trim() || "Da selezionare";
  const reviewTitle = mobileMeta.title.trim() || "Titolo da definire";
  const reviewDelivery = mobileMeta.deliveryAt ? formatDateTime(mobileMeta.deliveryAt) : "Da impostare";
  const reviewAppointment = mobileMeta.appointmentAt ? formatDateTime(mobileMeta.appointmentAt) : "Non programmato";
  const reviewPriority = (() => {
    const deliveryAt = mobileMeta.deliveryAt.trim();
    if (!deliveryAt) {
      return "Da calcolare";
    }

    const date = new Date(deliveryAt);
    if (Number.isNaN(date.getTime())) {
      return "Da calcolare";
    }

    return priorityLabels[computeAutomaticPriority(date)];
  })();
  const reviewInvoice = invoiceStatusLabels[mobileMeta.invoiceStatus as keyof typeof invoiceStatusLabels] || invoiceStatusLabels.DA_FATTURARE;
  const mobileDraftStatusMessage = draftRestoredAt
    ? `Bozza recuperata da ${formatDateTime(draftRestoredAt)}`
    : lastDraftSavedAt
      ? `Ultimo salvataggio ${formatDateTime(lastDraftSavedAt)}`
      : "Autosalvataggio attivo";
  const canContinueMobileStep =
    mobileStep === "customer"
      ? Boolean(selectedCustomerId || mobileMeta.customerName.trim())
      : mobileStep === "details"
        ? Boolean(mobileMeta.title.trim() && mobileMeta.deliveryAt)
        : mobileStep === "items"
          ? filledRows > 0
          : true;
  const mobileContinueLabel =
    mobileStep === "customer"
      ? "Vai ai dettagli"
      : mobileStep === "details"
        ? "Vai alle lavorazioni"
        : mobileStep === "items"
          ? "Vai al riepilogo"
          : isQuoteMode
            ? "Crea preventivo"
            : "Crea ordine";
  const mobileItemsPreview = items
    .map((item) => ({
      label: item.label.trim() || item.serviceQuery.trim(),
      quantity: parseQuantityValue(item.quantity, 1),
      totalCents: computeLineTotalWithAdjustmentsCents(
        parseDisplayPriceToCents(item.unitPrice),
        parseQuantityValue(item.quantity, 1),
        item.discountMode,
        parseDiscountValue(item.discountMode, item.discountValue),
        item.extraMode,
        parseDiscountValue(item.extraMode, item.extraValue),
        getCatalogPriceModeForItem(item)
      )
    }))
    .filter((item) => item.label)
    .slice(0, 4);
  const activeMobileLineState =
    isMobileViewport && openMobileItemIndex !== null && items[openMobileItemIndex]
      ? buildLineEditorState(items[openMobileItemIndex], openMobileItemIndex)
      : null;

  function buildLineEditorState(item: ItemState, index: number) {
    const selectedService = catalogServices.find((entry) => entry.id === item.serviceCatalogId);
    const exactMatchedService =
      !selectedService && item.serviceQuery.trim()
        ? catalogServices.find((entry) => normalizeCatalogSearch(entry.name) === normalizeCatalogSearch(item.serviceQuery))
        : undefined;
    const deactivatableService = selectedService || exactMatchedService;
    const suggestions = getServiceSuggestions(item.serviceQuery);
    const parsedTiers = getServiceTiers(selectedService);
    const lineQuantity = parseQuantityValue(item.quantity, 1);
    const selectedPhotographyOption = photographyFormats.find(
      (entry) => entry.serviceId === item.serviceCatalogId && entry.label === item.photoFormat
    );
    const isPhotographyRow = item.photoMode || item.serviceQuery === "Fotografie" || Boolean(selectedPhotographyOption);
    const showSuggestions =
      activeServiceField === index &&
      item.serviceQuery.trim().length > 0 &&
      (!selectedService || normalizeCatalogSearch(item.serviceQuery) !== normalizeCatalogSearch(selectedService.name) || isPhotographyRow);
    const hasTierEntries = parsedTiers.length > 0;
    const catalogPriceMode = getCatalogPriceModeForItem(item);
    const lineFinalWithExtraCents = computeLineTotalWithAdjustmentsCents(
      parseDisplayPriceToCents(item.unitPrice),
      lineQuantity,
      item.discountMode,
      parseDiscountValue(item.discountMode, item.discountValue),
      item.extraMode,
      parseDiscountValue(item.extraMode, item.extraValue),
      catalogPriceMode
    );

    return {
      item,
      index,
      selectedService,
      deactivatableService,
      suggestions,
      parsedTiers,
      lineQuantity,
      selectedPhotographyOption,
      isPhotographyRow,
      showSuggestions,
      hasTierEntries,
      lineFinalWithExtraCents
    };
  }

  function renderLineEditor(state: ReturnType<typeof buildLineEditorState>) {
    const {
      item,
      index,
      selectedService,
      deactivatableService,
      suggestions,
      parsedTiers,
      lineQuantity,
      selectedPhotographyOption,
      isPhotographyRow,
      showSuggestions,
      hasTierEntries,
      lineFinalWithExtraCents
    } = state;

    return (
      <div className="form-grid order-line-grid">
        <div className={`field wide order-line-service${isPhotographyRow ? " order-line-service-photo" : ""}`}>
          <label htmlFor={`service-${index}`}>Articolo / servizio</label>
          <input
            autoComplete="off"
            id={`service-${index}`}
            onChange={(event) => {
              const nextValue = event.target.value;
              const normalizedNextValue = normalizeCatalogSearch(nextValue);
              const matchesSelectedService =
                selectedService && normalizedNextValue === normalizeCatalogSearch(selectedService.name);

              setItems((current) =>
                current.map((entry, itemIndex) =>
                  itemIndex === index
                      ? {
                          ...entry,
                          serviceQuery: nextValue,
                          photoMode: matchesSelectedService ? entry.photoMode : false,
                          photoFormat: matchesSelectedService ? entry.photoFormat : "",
                          label: nextValue,
                          serviceCatalogId: matchesSelectedService ? entry.serviceCatalogId : "",
                          unitPrice: matchesSelectedService ? entry.unitPrice : entry.priceOverridden ? entry.unitPrice : "",
                          priceOverridden: matchesSelectedService ? entry.priceOverridden : entry.priceOverridden,
                          format: matchesSelectedService ? entry.format : "",
                          material: matchesSelectedService ? entry.material : "",
                          finishing: matchesSelectedService ? entry.finishing : ""
                        }
                      : entry
                  )
                );
              setActiveServiceField(index);
              if (!event.target.value.trim()) {
                setOpenTierIndex((current) => (current === index ? null : current));
              }
            }}
            onBlur={() => {
              window.setTimeout(() => {
                setActiveServiceField((current) => (current === index ? null : current));
              }, 120);
            }}
            onFocus={() => setActiveServiceField(index)}
            placeholder="Scrivi per cercare nel catalogo o inserire una voce libera"
            value={item.serviceQuery}
          />
          <div className="order-line-service-tools">
            {hasTierEntries ? <span className="pill order-line-tier-badge">Prezzo a scaglioni</span> : null}
            <button
              className="ghost order-line-service-action order-line-tier-toggle"
              onClick={(event) => {
                event.preventDefault();
                if (catalogDraftRowIndex === index) {
                  closeInlineCatalogDraft();
                } else {
                  closeLabelCalculator();
                  openInlineCatalogDraft(index);
                }
              }}
              type="button"
            >
              {catalogDraftRowIndex === index ? "Chiudi nuovo servizio" : "Nuovo in catalogo"}
            </button>
            <button
              className="ghost order-line-service-action order-line-calculator-toggle"
              disabled={labelCalculatorMaterials.length === 0}
              onClick={(event) => {
                event.preventDefault();
                if (labelCalculatorRowIndex === index) {
                  closeLabelCalculator();
                } else {
                  closeInlineCatalogDraft();
                  openLabelCalculator(index);
                }
              }}
              type="button"
            >
              Calcolatore etichette
            </button>
            {deactivatableService ? (
              <button
                className="ghost order-line-service-action order-line-catalog-remove"
                disabled={catalogMutatingServiceId === deactivatableService.id}
                onClick={(event) => {
                  event.preventDefault();
                  void deactivateCatalogService(index, deactivatableService);
                }}
                type="button"
              >
                {catalogMutatingServiceId === deactivatableService.id ? "Disattivazione..." : "Disattiva dal catalogo"}
              </button>
            ) : null}
            <button
              className="ghost order-line-service-action order-line-tier-toggle"
              disabled={!hasTierEntries}
              onClick={(event) => {
                event.preventDefault();
                if (!hasTierEntries) {
                  return;
                }

                setOpenTierIndex((current) => (current === index ? null : index));
              }}
              type="button"
            >
              Scaglioni
            </button>
          </div>
          {showSuggestions ? (
            <div className="order-line-suggestions">
              {suggestions.length > 0 ? (
                suggestions.map((suggestion) => (
                  <button
                    className="order-line-suggestion"
                    key={suggestion.key}
                    onClick={(event) => {
                      event.preventDefault();
                      if (suggestion.type === "photography") {
                        selectPhotographyForRow(index);
                        return;
                      }

                      selectServiceForRow(index, suggestion.service);
                    }}
                    onMouseDown={(event) => event.preventDefault()}
                    type="button"
                  >
                    <strong>{suggestion.label}</strong>
                    <span>{suggestion.meta}</span>
                  </button>
                ))
              ) : (
                <div className="order-line-suggestion order-line-empty-state">
                  <strong>{isCatalogEmpty ? "Catalogo servizi vuoto" : "Nessun servizio trovato"}</strong>
                  <span>
                    {isCatalogEmpty
                      ? "Importa il listino da Impostazioni o verifica che il bootstrap del template Excel sia andato a buon fine."
                      : "Prova con codice, nome o una parola piu specifica del servizio."}
                  </span>
                </div>
              )}
            </div>
          ) : null}
          {catalogActionFeedback?.rowIndex === index ? (
            <p className={`hint order-line-catalog-feedback${catalogActionFeedback.tone === "error" ? " is-error" : ""}`}>
              {catalogActionFeedback.message}
            </p>
          ) : null}
          {hasTierEntries && openTierIndex === index ? (
            <div className="order-line-tier-panel">
              {parsedTiers.map((tier) => (
                <button
                  className={`order-line-tier-chip${isTierSelected(tier, lineQuantity) && !item.priceOverridden ? " is-selected" : ""}`}
                  key={`${index}-${tier.minQuantity}-${tier.maxQuantity ?? "plus"}`}
                  onClick={(event) => {
                    event.preventDefault();
                    if (!selectedService) {
                      return;
                    }

                    setItems((current) =>
                      current.map((entry, itemIndex) =>
                        itemIndex === index
                          ? {
                              ...entry,
                              quantity: formatQuantityInput(tier.minQuantity),
                              unitPrice: (tier.unitPriceCents / 100).toFixed(2).replace(".", ","),
                              priceOverridden: false
                            }
                          : entry
                      )
                    );
                  }}
                  type="button"
                >
                  <strong>{formatTierLabel(tier)}</strong>
                  <span>{(tier.unitPriceCents / 100).toFixed(2).replace(".", ",")} €</span>
                </button>
              ))}
            </div>
          ) : null}
          {catalogDraftRowIndex === index ? (
            <div className="order-line-inline-catalog">
              <div className="order-line-inline-catalog-head">
                <div className="order-line-inline-catalog-title">
                  <div className="order-line-inline-catalog-copy">
                    <strong>Nuovo servizio catalogo</strong>
                  </div>
                  <span className="pill">Codice automatico se vuoto</span>
                </div>
              </div>
              <div className="order-line-inline-catalog-sections">
                <section className="order-line-inline-catalog-section">
                  <div className="order-line-inline-catalog-section-head">
                    <strong>Dati base</strong>
                  </div>
                  <div className="form-grid order-line-inline-catalog-grid">
                    <div className="field full order-line-inline-catalog-name">
                      <label htmlFor={`inline-service-name-${index}`}>Nome servizio</label>
                      <input
                        id={`inline-service-name-${index}`}
                        onChange={(event) => setCatalogDraft((current) => ({ ...current, name: event.target.value }))}
                        value={catalogDraft.name}
                      />
                    </div>
                    <div className="field full order-line-inline-catalog-code">
                      <label htmlFor={`inline-service-code-${index}`}>Codice</label>
                      <input
                        id={`inline-service-code-${index}`}
                        onChange={(event) => setCatalogDraft((current) => ({ ...current, code: event.target.value }))}
                        placeholder="Facoltativo"
                        value={catalogDraft.code}
                      />
                    </div>
                    <div className="field full order-line-inline-catalog-price">
                      <label htmlFor={`inline-service-price-${index}`}>Prezzo base</label>
                      <input
                        className="currency-input"
                        id={`inline-service-price-${index}`}
                        inputMode="decimal"
                        onChange={(event) => setCatalogDraft((current) => ({ ...current, basePrice: event.target.value }))}
                        placeholder="0,00"
                        value={catalogDraft.basePrice}
                      />
                    </div>
                  </div>
                </section>
                <section className="order-line-inline-catalog-section">
                  <div className="order-line-inline-catalog-section-head">
                    <strong>Dettagli facoltativi</strong>
                  </div>
                  <div className="form-grid order-line-inline-catalog-grid">
                    <div className="field full">
                      <label htmlFor={`inline-service-description-${index}`}>Descrizione</label>
                      <textarea
                        id={`inline-service-description-${index}`}
                        onChange={(event) => setCatalogDraft((current) => ({ ...current, description: event.target.value }))}
                        value={catalogDraft.description}
                      />
                    </div>
                  </div>
                </section>
                <section className="order-line-inline-catalog-section">
                  <div className="order-line-inline-catalog-section-head">
                    <strong>Scaglioni quantita</strong>
                  </div>
                  <div className="form-grid order-line-inline-catalog-grid">
                    <div className="field full">
                      <label htmlFor={`inline-service-tiers-${index}`}>Scaglioni quantita</label>
                      <input
                        id={`inline-service-tiers-${index}`}
                        onChange={(event) => setCatalogDraft((current) => ({ ...current, quantityTiers: event.target.value }))}
                        placeholder="1-9:0,50 | 10-49:0,30 | 50+:0,20"
                        value={catalogDraft.quantityTiers}
                      />
                    </div>
                  </div>
                </section>
              </div>
              {catalogDraftMessage ? <p className="hint order-line-inline-catalog-message">{catalogDraftMessage}</p> : null}
              <div className="button-row order-line-inline-catalog-actions">
                <button className="secondary" onClick={closeInlineCatalogDraft} type="button">
                  Annulla
                </button>
                <button
                  className="primary"
                  disabled={isCatalogDraftSubmitting}
                  onClick={() => void saveInlineCatalogDraft(index)}
                  type="button"
                >
                  {isCatalogDraftSubmitting ? "Salvataggio..." : "Salva e usa"}
                </button>
              </div>
            </div>
          ) : null}
          {labelCalculatorRowIndex === index ? (
            <div className="order-line-inline-catalog order-line-inline-calculator">
              <div className="order-line-inline-catalog-head">
                <div className="order-line-inline-catalog-title">
                  <div className="order-line-inline-catalog-copy">
                    <strong>Calcolatore etichette</strong>
                    <span className="subtle">Aggiunge sempre 1 cm per lato, 20 euro di messa in macchina e il 20% se scegli taglio singolo.</span>
                  </div>
                  <span className="pill">Prezzo totale riga</span>
                </div>
              </div>
              <div className="form-grid order-line-inline-catalog-grid order-line-inline-calculator-grid">
                <div className="field order-line-inline-calculator-width">
                  <label htmlFor={`label-calculator-width-${index}`}>Larghezza cm</label>
                  <input
                    className="numeric-input"
                    id={`label-calculator-width-${index}`}
                    inputMode="decimal"
                    onChange={(event) => setLabelCalculatorDraft((current) => ({ ...current, widthCm: event.target.value }))}
                    placeholder="10"
                    value={labelCalculatorDraft.widthCm}
                  />
                </div>
                <div className="field order-line-inline-calculator-height">
                  <label htmlFor={`label-calculator-height-${index}`}>Altezza cm</label>
                  <input
                    className="numeric-input"
                    id={`label-calculator-height-${index}`}
                    inputMode="decimal"
                    onChange={(event) => setLabelCalculatorDraft((current) => ({ ...current, heightCm: event.target.value }))}
                    placeholder="5"
                    value={labelCalculatorDraft.heightCm}
                  />
                </div>
                <div className="field order-line-inline-calculator-quantity">
                  <label htmlFor={`label-calculator-quantity-${index}`}>Numero etichette</label>
                  <input
                    className="numeric-input"
                    id={`label-calculator-quantity-${index}`}
                    inputMode="decimal"
                    onChange={(event) => setLabelCalculatorDraft((current) => ({ ...current, quantity: event.target.value }))}
                    placeholder="100"
                    value={labelCalculatorDraft.quantity}
                  />
                </div>
                <div className="field wide order-line-inline-calculator-material">
                  <label htmlFor={`label-calculator-material-${index}`}>Materiale</label>
                  <select
                    id={`label-calculator-material-${index}`}
                    onChange={(event) => setLabelCalculatorDraft((current) => ({ ...current, materialServiceId: event.target.value }))}
                    value={labelCalculatorDraft.materialServiceId}
                  >
                    <option value="">Seleziona materiale</option>
                    {labelCalculatorMaterials.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field full order-line-inline-calculator-single-cut">
                  <label className="toggle-field" htmlFor={`label-calculator-single-cut-${index}`}>
                    <input
                      checked={labelCalculatorDraft.singleCut}
                      id={`label-calculator-single-cut-${index}`}
                      onChange={(event) => setLabelCalculatorDraft((current) => ({ ...current, singleCut: event.target.checked }))}
                      type="checkbox"
                    />
                    <span>Taglio singolo</span>
                  </label>
                </div>
              </div>
              {(() => {
                const materialService = labelCalculatorMaterials.find((service) => service.id === labelCalculatorDraft.materialServiceId);
                const widthCm = parseQuantityValue(labelCalculatorDraft.widthCm, 0);
                const heightCm = parseQuantityValue(labelCalculatorDraft.heightCm, 0);
                const quantity = parseQuantityValue(labelCalculatorDraft.quantity, 0);
                const previewReady = Boolean(materialService) && widthCm > 0 && heightCm > 0 && quantity > 0;
                const totalCents = previewReady
                  ? computeLabelCalculatorTotalCents(
                      widthCm,
                      heightCm,
                      quantity,
                      materialService?.basePriceCents || 0,
                      labelCalculatorDraft.singleCut
                    )
                  : 0;
                const expandedWidth = previewReady ? ((widthCm + 1) / 100).toFixed(3).replace(".", ",") : "0,000";
                const expandedHeight = previewReady ? ((heightCm + 1) / 100).toFixed(3).replace(".", ",") : "0,000";

                return (
                  <div className="order-line-inline-calculator-preview">
                    <strong>{previewReady ? formatCurrency(totalCents) : "Compila i campi per vedere il totale"}</strong>
                    <span>
                      {previewReady
                        ? `${expandedWidth} m x ${expandedHeight} m x ${formatQuantity(quantity)} x ${formatCurrency(materialService?.basePriceCents || 0)} + 20,00 €${labelCalculatorDraft.singleCut ? " + 20%" : ""}`
                        : "Il prezzo finale verra inserito nel prezzo listino della riga come totale gia calcolato."}
                    </span>
                  </div>
                );
              })()}
              <div className="button-row order-line-inline-catalog-actions">
                <button className="secondary" onClick={closeLabelCalculator} type="button">
                  Annulla
                </button>
                <button
                  className="primary"
                  disabled={
                    labelCalculatorMaterials.length === 0 ||
                    !labelCalculatorDraft.materialServiceId ||
                    parseQuantityValue(labelCalculatorDraft.widthCm, 0) <= 0 ||
                    parseQuantityValue(labelCalculatorDraft.heightCm, 0) <= 0 ||
                    parseQuantityValue(labelCalculatorDraft.quantity, 0) <= 0
                  }
                  onClick={() => applyLabelCalculator(index)}
                  type="button"
                >
                  Applica calcolo
                </button>
              </div>
            </div>
          ) : null}
        </div>
        {isPhotographyRow ? (
          <div className="field order-line-photo-format">
            <label htmlFor={`photo-format-${index}`}>Taglio foto</label>
            <select
              id={`photo-format-${index}`}
          onChange={(event) => {
                const nextOption = photographyFormats.find((entry) => entry.key === event.target.value);

                setItems((current) =>
                  current.map((entry, itemIndex) => {
                    if (itemIndex !== index) {
                      return entry;
                    }

                    if (!nextOption) {
                      return {
                        ...entry,
                        photoMode: true,
                        photoFormat: "",
                        serviceCatalogId: "",
                        unitPrice: "",
                        format: "",
                        material: "",
                        finishing: "",
                        priceOverridden: false
                      };
                    }

                    return {
                      ...entry,
                      serviceQuery: "Fotografie",
                      photoMode: true,
                      photoFormat: nextOption.label,
                      label: "Fotografie",
                      serviceCatalogId: nextOption.serviceId,
                      format: nextOption.label,
                      unitPrice: getCatalogPriceDisplay(nextOption.service, parseQuantityValue(entry.quantity)),
                      discountMode: "NONE",
                      discountValue: "",
                      extraMode: "NONE",
                      extraValue: "",
                      material: "",
                      finishing: "",
                      priceOverridden: false
                    };
                  })
                );
              }}
              value={selectedPhotographyOption?.key || ""}
            >
              <option value="">Seleziona formato</option>
              {photographyFormats.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="field order-line-qty">
          <label htmlFor={`quantity-${index}`}>Qta</label>
          <input
            className="numeric-input"
            inputMode="decimal"
            id={`quantity-${index}`}
            onChange={(event) => {
              const nextQuantityInput = event.target.value;
              const nextQuantity = parseQuantityValue(nextQuantityInput, 1);

              setItems((current) =>
                current.map((entry, itemIndex) => {
                  if (itemIndex !== index) {
                    return entry;
                  }

                  const service = catalogServices.find((serviceEntry) => serviceEntry.id === entry.serviceCatalogId);

                  if (!service || entry.priceOverridden) {
                    return { ...entry, quantity: nextQuantityInput };
                  }

                  return {
                    ...entry,
                    quantity: nextQuantityInput,
                    unitPrice: getCatalogPriceDisplay(service, nextQuantity)
                  };
                })
              );
            }}
            onBlur={() =>
              setItems((current) =>
                current.map((entry, itemIndex) =>
                  itemIndex === index ? { ...entry, quantity: formatQuantityInput(entry.quantity) } : entry
                )
              )
            }
            placeholder="1 oppure 0,5"
            type="text"
            value={item.quantity}
          />
        </div>
        <div className="field order-line-price">
          <label htmlFor={`unitPrice-${index}`}>Prezzo listino</label>
          <input
            className="currency-input"
            id={`unitPrice-${index}`}
            inputMode="decimal"
            onChange={(event) =>
              setItems((current) =>
                current.map((entry, itemIndex) =>
                  itemIndex === index ? { ...entry, unitPrice: event.target.value, priceOverridden: true } : entry
                )
              )
            }
            placeholder="0,00"
            value={item.unitPrice}
          />
        </div>
        <div className="field order-line-discount-mode">
          <label htmlFor={`discountMode-${index}`}>Sconto</label>
          <select
            id={`discountMode-${index}`}
            onChange={(event) =>
              setItems((current) =>
                current.map((entry, itemIndex) =>
                  itemIndex === index
                    ? {
                        ...entry,
                        discountMode: event.target.value as DiscountModeValue,
                        discountValue: event.target.value === "NONE" ? "" : entry.discountValue
                      }
                    : entry
                )
              )
            }
            value={item.discountMode}
          >
            {Object.entries(discountModeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field order-line-discount-value">
          <label htmlFor={`discountValue-${index}`}>Valore sconto</label>
          <input
            className="numeric-input"
            disabled={item.discountMode === "NONE"}
            id={`discountValue-${index}`}
            inputMode="decimal"
            onChange={(event) =>
              setItems((current) =>
                current.map((entry, itemIndex) =>
                  itemIndex === index ? { ...entry, discountValue: event.target.value } : entry
                )
              )
            }
            placeholder={item.discountMode === "PERCENT" ? "10" : "0,00"}
            value={item.discountValue}
          />
        </div>
        <div className="field order-line-extra-mode">
          <label htmlFor={`extraMode-${index}`}>Lavorazione extra</label>
          <select
            id={`extraMode-${index}`}
            onChange={(event) =>
              setItems((current) =>
                current.map((entry, itemIndex) =>
                  itemIndex === index
                    ? {
                        ...entry,
                        extraMode: event.target.value as DiscountModeValue,
                        extraValue: event.target.value === "NONE" ? "" : entry.extraValue
                      }
                    : entry
                )
              )
            }
            value={item.extraMode}
          >
            {Object.entries(discountModeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field order-line-extra-value">
          <label htmlFor={`extraValue-${index}`}>Valore extra</label>
          <input
            className="numeric-input"
            disabled={item.extraMode === "NONE"}
            id={`extraValue-${index}`}
            inputMode="decimal"
            onChange={(event) =>
              setItems((current) =>
                current.map((entry, itemIndex) =>
                  itemIndex === index ? { ...entry, extraValue: event.target.value } : entry
                )
              )
            }
            placeholder={item.extraMode === "PERCENT" ? "10" : "0,00"}
            value={item.extraValue}
          />
        </div>
        <div className="field full order-line-notes">
          <label htmlFor={`notes-${index}`}>Note riga</label>
          <textarea
            id={`notes-${index}`}
            onChange={(event) =>
              setItems((current) =>
                current.map((entry, itemIndex) =>
                  itemIndex === index ? { ...entry, notes: event.target.value } : entry
                )
              )
            }
            value={item.notes}
          />
        </div>
        <div className="field order-line-final">
          <label htmlFor={`finalPrice-${index}`}>Prezzo finale</label>
          <input
            className="currency-input"
            disabled
            id={`finalPrice-${index}`}
            value={new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(lineFinalWithExtraCents / 100)}
          />
        </div>
      </div>
    );
  }

  function renderMobilePanelHead() {
    return (
      <div className="order-mobile-panel-head">
        <div className="order-mobile-panel-tools">
          <span className="subtle">{mobileDraftStatusMessage}</span>
          {hasSavedDraft ? (
            <button
              className="ghost"
              onClick={(event) => {
                event.preventDefault();
                resetDraftAndForm();
              }}
              type="button"
            >
              Svuota bozza
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="stack order-form-shell"
      data-mobile-order-step={mobileStep}
      onChangeCapture={() => {
        scheduleDraftSave();
        scheduleMobileMetaSync();
      }}
      onInputCapture={() => {
        scheduleDraftSave();
        scheduleMobileMetaSync();
      }}
      onSubmit={() => {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(submittedDraftKey, "1");
        }
      }}
      ref={formRef}
    >
      {selectedCustomerId ? <input name="customerId" type="hidden" value={selectedCustomerId} /> : null}
      {isQuoteMode ? <input name="isQuote" type="hidden" value="true" /> : null}
      <section className="order-mobile-flow" aria-label="Percorso nuovo ordine mobile">
        <nav className="order-mobile-stepper" aria-label="Step nuovo ordine">
          {MOBILE_ORDER_STEPS.map((step) => (
            <button
              aria-current={mobileStep === step.id ? "step" : undefined}
              className={`order-mobile-step-tab${mobileStep === step.id ? " active" : ""}`}
              key={step.id}
              onClick={() => jumpToMobileStep(step.id)}
              type="button"
            >
              <strong>{step.label}</strong>
            </button>
          ))}
        </nav>
      </section>

      <section className="card card-pad order-sheet-hero order-desktop-only">
        <div className="order-sheet-hero-layout">
          <div className="order-sheet-head">
            <div className="stack compact-stack">
              <span className="compact-kicker">{isQuoteMode ? "Scheda preventivo" : "Scheda ordine"}</span>
              <div className="order-sheet-head-title-row">
                <h3>{isQuoteMode ? "Preventivo rapido da banco" : "Copia commissione digitale"}</h3>
                <div className="order-draft-banner order-draft-banner-inline">
                  <div className="compact-stack">
                    <strong>{hasSavedDraft ? "Bozza attiva" : "Autosalvataggio pronto"}</strong>
                    <span className="subtle">
                      {draftRestoredAt
                        ? `Recuperata da ${formatDateTime(draftRestoredAt)}`
                        : lastDraftSavedAt
                          ? `Ultimo salvataggio ${formatDateTime(lastDraftSavedAt)}`
                          : "Salvataggio automatico attivo"}
                    </span>
                  </div>
                  {hasSavedDraft ? (
                    <button
                      className="ghost"
                      onClick={(event) => {
                        event.preventDefault();
                        resetDraftAndForm();
                      }}
                      type="button"
                    >
                      Svuota bozza
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="order-sheet-summary">
              <div className="order-sheet-chip">
                <span className="subtle">Cliente</span>
                <strong>{selectedCustomer ? selectedCustomer.name : "Nuovo cliente"}</strong>
              </div>
              <div className="order-sheet-chip">
                <span className="subtle">Tipo cliente</span>
                <strong>{selectedCustomer ? customerTypeLabels[selectedCustomer.type] : customerTypeLabels[defaultCustomerType]}</strong>
              </div>
              <div className="order-sheet-chip">
                <span className="subtle">Righe</span>
                <strong>{filledRows}</strong>
              </div>
              <div className="order-sheet-chip">
                <span className="subtle">Totale</span>
                <strong>{new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(previewTotalCents / 100)}</strong>
              </div>
            </div>
          </div>
          <div className="order-sheet-hero-flow" aria-label="Percorso nuovo ordine desktop">
            {MOBILE_ORDER_STEPS.map((step, index) => (
              <div className="order-sheet-flow-step" key={step.id}>
                <span className="order-sheet-flow-index">{index + 1}</span>
                <div className="order-sheet-flow-copy">
                  <strong>{step.label}</strong>
                  <span>
                    {step.id === "customer"
                      ? "Selezione o creazione cliente"
                      : step.id === "details"
                        ? "Titolo, scadenza e note"
                        : step.id === "items"
                          ? "Righe e prezzi"
                          : "Controllo finale e invio"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid grid-2 order-sheet-grid">
        <section className="card card-pad order-sheet-panel order-mobile-panel order-mobile-panel-customer">
          <div className="stack">
            <div className="order-desktop-panel-heading">
              <h3>Cliente</h3>
            </div>
            {renderMobilePanelHead()}
            <div className="form-grid">
              <CustomerAutocomplete
                customers={customers.map((customer) => ({
                  ...customer,
                  orderCount: customer.orders.length
                }))}
                label="Cerca cliente esistente"
                onQueryChange={(value) => {
                  setCustomerQuery(value);
                  if (selectedCustomerId) {
                    setSelectedCustomerId("");
                  }
                }}
                onSelect={(customer) => {
                  setSelectedCustomerId(customer.id);
                  setCustomerQuery(customer.name);
                }}
                placeholder="Es. Rossi, +39 333..., info@azienda.it, pec@azienda.it, IT123..."
                query={customerQuery}
                selectedCustomerId={selectedCustomerId}
              />

              {selectedCustomer ? (
                <div className="mini-item customer-selection-card field full">
                  <div className="list-header">
                    <div>
                      <strong>{selectedCustomer.name}</strong>
                      <div className="subtle">{customerTypeLabels[selectedCustomer.type]}</div>
                    </div>
                    <button
                      className="ghost"
                      onClick={(event) => {
                        event.preventDefault();
                        setSelectedCustomerId("");
                        setCustomerQuery("");
                      }}
                      type="button"
                    >
                      Nuovo cliente
                    </button>
                  </div>
                  <div className="subtle">{getPreferredCustomerPrimaryContact(selectedCustomer)}</div>
                  <div className="subtle">{getPreferredCustomerSecondaryContact(selectedCustomer)}</div>
                </div>
              ) : null}

              {selectedCustomerId ? null : (
                <>
                  <div className="field wide">
                    <label htmlFor="customerName">Nome / Ragione sociale</label>
                    <input id="customerName" name="customerName" required={!selectedCustomerId} />
                  </div>
                  <div className="field">
                    <label htmlFor="customerType">Tipo cliente</label>
                    <select defaultValue={defaultCustomerType} id="customerType" name="customerType">
                      {Object.entries(customerTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="customerPhone">Telefono</label>
                    <input id="customerPhone" name="customerPhone" placeholder="Facoltativo" />
                  </div>
                  <div className="field">
                    <label htmlFor="customerWhatsapp">WhatsApp</label>
                    <input id="customerWhatsapp" name="customerWhatsapp" />
                  </div>
                  <details className="field full order-advanced-disclosure">
                    <summary>Info avanzate</summary>
                    <div className="form-grid order-advanced-grid">
                      <div className="field wide">
                        <label htmlFor="customerEmail">Email</label>
                        <input id="customerEmail" name="customerEmail" type="email" />
                      </div>
                      <div className="field wide">
                        <label htmlFor="customerPec">PEC</label>
                        <input id="customerPec" name="customerPec" type="email" />
                      </div>
                      <div className="field">
                        <label htmlFor="customerVatNumber">P. IVA</label>
                        <input id="customerVatNumber" name="customerVatNumber" />
                      </div>
                      <div className="field">
                        <label htmlFor="customerTaxCode">Codice fiscale</label>
                        <input id="customerTaxCode" name="customerTaxCode" />
                      </div>
                      <div className="field">
                        <label htmlFor="customerUniqueCode">Codice univoco (CU)</label>
                        <input id="customerUniqueCode" name="customerUniqueCode" />
                      </div>
                    </div>
                  </details>
                  <div className="field full">
                    <label htmlFor="customerNotes">Note cliente</label>
                    <textarea id="customerNotes" name="customerNotes" />
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="card card-pad order-sheet-panel order-mobile-panel order-mobile-panel-details">
          <div className="stack">
            <div className="order-desktop-panel-heading">
              <h3>{isQuoteMode ? "Dati preventivo" : "Dati ordine"}</h3>
            </div>
            {renderMobilePanelHead()}
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="title">Titolo / lavoro</label>
                <input id="title" name="title" placeholder="Biglietti visita Rossi" required />
              </div>
              <div className="field wide">
                <label htmlFor="deliveryAt">Consegna prevista</label>
                <input className="date-time-input" id="deliveryAt" name="deliveryAt" required type="datetime-local" />
              </div>
              <div className="field wide">
                <label htmlFor="appointmentAt">Appuntamento programmato</label>
                <input className="date-time-input" id="appointmentAt" name="appointmentAt" type="datetime-local" />
              </div>
              <p className="hint order-priority-auto-hint">
                Priorita automatica: urgente per oggi e domani, alta per i due giorni successivi, bassa dal quarto giorno in poi.
              </p>
              <div className="field full">
                <label htmlFor="appointmentNote">Nota appuntamento</label>
                <select id="appointmentNote" name="appointmentNote" onChange={(event) => setAppointmentNoteValue(event.target.value)} value={appointmentNoteValue}>
                  <option value="">Seleziona nota appuntamento</option>
                  {availableAppointmentNoteOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field full">
                <label htmlFor="notes">Note operative</label>
                <textarea id="notes" name="notes" />
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="card card-pad order-sheet-lines order-mobile-panel order-mobile-panel-items">
        <div className="list-header">
          <div className="order-desktop-panel-heading">
            <h3>Righe lavorazione</h3>
          </div>
          <div className="order-mobile-panel-heading-only">
            {renderMobilePanelHead()}
          </div>
          {!isMobileViewport ? (
            <button
              className="ghost"
              onClick={(event) => {
                event.preventDefault();
                addEmptyItemLine();
              }}
              type="button"
            >
              Aggiungi riga
            </button>
          ) : null}
        </div>
        {isCatalogEmpty ? (
          <div className="empty">
            Il catalogo servizi e vuoto in questo ambiente: i suggerimenti non compariranno finche il listino non viene
            bootstrapato o importato da Impostazioni.
          </div>
        ) : null}
        <input name="itemsPayload" type="hidden" value={itemsPayload} />

        <div className="order-lines-stack">
          {items.map((item, index) => {
            const lineState = buildLineEditorState(item, index);
            const lineHeadline = item.label.trim() || item.serviceQuery.trim() || `Riga ${index + 1}`;
            const lineSummaryParts = [`Qta ${formatQuantity(lineState.lineQuantity)}`];
            if (item.photoFormat.trim()) {
              lineSummaryParts.push(item.photoFormat.trim());
            } else if (item.format.trim()) {
              lineSummaryParts.push(item.format.trim());
            }
            const isMobileLineActive = isMobileViewport && openMobileItemIndex === index;
            const isMobileLineOpen = !isMobileViewport;

            return (
              <article
                className={`order-line-card${isMobileLineOpen ? "" : " is-mobile-collapsed"}${
                  isMobileViewport ? " is-mobile-tappable" : ""
                }${isMobileLineActive ? " is-mobile-active" : ""}`}
                aria-expanded={isMobileViewport ? isMobileLineActive : undefined}
                key={index}
                onClick={() => {
                  if (isMobileViewport && !isMobileLineActive) {
                    openMobileItemEditor(index);
                  }
                }}
                onKeyDown={(event) => {
                  if (!isMobileViewport || isMobileLineActive) {
                    return;
                  }

                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openMobileItemEditor(index);
                  }
                }}
                role={isMobileViewport && !isMobileLineActive ? "button" : undefined}
                tabIndex={isMobileViewport && !isMobileLineActive ? 0 : undefined}
              >
                <div className="order-line-head">
                  <div className="order-line-head-main">
                    <div className="order-line-index">#{index + 1}</div>
                    <div className="order-line-head-copy">
                      <strong className="order-line-heading-label">{`Riga ${index + 1}`}</strong>
                      <span className="order-line-mobile-summary">
                        <span>{lineHeadline}</span>
                        <span>{lineSummaryParts.join(" • ")}</span>
                      </span>
                    </div>
                  </div>
                  <div className="order-line-head-actions">
                    <span className="pill order-line-total-pill">
                      {new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(
                        lineState.lineFinalWithExtraCents / 100
                      )}
                    </span>
                    {items.length > 1 && !isMobileViewport ? (
                      <button
                        className="ghost order-line-remove"
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          removeItemLine(index);
                        }}
                        type="button"
                      >
                        Rimuovi
                      </button>
                    ) : null}
                  </div>
                </div>
                {!isMobileViewport ? renderLineEditor(lineState) : null}
              </article>
          );
          })}
        </div>
        {isMobileViewport ? (
          <button
            className="ghost order-lines-add-row"
            onClick={(event) => {
              event.preventDefault();
              addEmptyItemLine();
            }}
            type="button"
          >
            Aggiungi riga
          </button>
        ) : null}
        {!isMobileViewport ? (
          <div className="order-sheet-footer">
            <div className="form-grid order-sheet-payment-row">
              <div className="field order-sheet-invoice-field">
                <label htmlFor="invoiceStatus">Richiesta fattura</label>
                <select defaultValue="DA_FATTURARE" id="invoiceStatus" name="invoiceStatus">
                  {Object.entries(invoiceStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field order-sheet-deposit-field">
                <label htmlFor="initialDeposit">Acconto iniziale</label>
                <input className="currency-input" id="initialDeposit" inputMode="decimal" name="initialDeposit" placeholder="0,00" />
              </div>
              <div className="order-sheet-chip order-sheet-total-card">
                <span className="card-muted">Totale anteprima</span>
                <strong>{formatCurrency(previewTotalCents)}</strong>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {isMobileViewport ? (
        <button
          aria-label="Chiudi editor riga"
          className={`order-line-sheet-backdrop${isMobileItemSheetOpen ? " open" : ""}`}
          onClick={(event) => {
            event.preventDefault();
            closeMobileItemEditor();
          }}
          type="button"
        />
      ) : null}
      {isMobileViewport && activeMobileLineState ? (
        <section className="order-line-mobile-sheet" aria-label={`Editor ${activeMobileLineState.item.label || `Riga ${activeMobileLineState.index + 1}`}`}>
          <div className="order-line-mobile-sheet-head">
            <div className="order-line-mobile-sheet-copy">
              <span className="subtle">{`Riga ${activeMobileLineState.index + 1}`}</span>
              <strong>{activeMobileLineState.item.label.trim() || activeMobileLineState.item.serviceQuery.trim() || "Nuova lavorazione"}</strong>
            </div>
            <div className="order-line-mobile-sheet-actions">
              {items.length > 1 ? (
                <button
                  className="ghost order-line-remove"
                  onClick={(event) => {
                    event.preventDefault();
                    removeItemLine(activeMobileLineState.index);
                  }}
                  type="button"
                >
                  Rimuovi
                </button>
              ) : null}
              <button
                className="ghost order-line-mobile-sheet-close"
                onClick={(event) => {
                  event.preventDefault();
                  closeMobileItemEditor();
                }}
                type="button"
              >
                Chiudi
              </button>
            </div>
          </div>
          {renderLineEditor(activeMobileLineState)}
        </section>
      ) : null}

      {isMobileViewport ? (
        <section className="card card-pad order-sheet-panel order-mobile-review-panel">
          <div className="stack">
            {renderMobilePanelHead()}

            <div className="order-mobile-review-grid">
              <div className="order-mobile-review-chip">
                <span>Cliente</span>
                <strong>{reviewCustomerName}</strong>
                <small>{selectedCustomerTypeLabel}</small>
              </div>
              <div className="order-mobile-review-chip">
                <span>Titolo</span>
                <strong>{reviewTitle}</strong>
              </div>
              <div className="order-mobile-review-chip">
                <span>Consegna</span>
                <strong>{reviewDelivery}</strong>
              </div>
              <div className="order-mobile-review-chip">
                <span>Appuntamento</span>
                <strong>{reviewAppointment}</strong>
              </div>
              <div className="order-mobile-review-chip">
                <span>Priorita</span>
                <strong>{reviewPriority}</strong>
              </div>
              <div className="order-mobile-review-chip">
                <span>Stato fattura</span>
                <strong>{reviewInvoice}</strong>
              </div>
              <div className="order-mobile-review-chip">
                <span>Righe compilate</span>
                <strong>{filledRows}</strong>
              </div>
              <div className="order-mobile-review-chip">
                <span>Totale</span>
                <strong>{formatCurrency(previewTotalCents)}</strong>
              </div>
            </div>

            {mobileItemsPreview.length > 0 ? (
              <div className="order-mobile-review-lines">
                {mobileItemsPreview.map((item) => (
                  <div className="order-mobile-review-line" key={`${item.label}-${item.quantity}-${item.totalCents}`}>
                    <strong>{item.label}</strong>
                    <span>{`Qta ${formatQuantity(item.quantity)} • ${formatCurrency(item.totalCents)}`}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {mobileMeta.notes.trim() ? (
              <div className="order-mobile-review-note">
                <span>Note operative</span>
                <strong>{mobileMeta.notes}</strong>
              </div>
            ) : null}

            <div className="order-sheet-footer order-mobile-review-footer">
              <div className="form-grid order-sheet-payment-row">
                <div className="field order-sheet-invoice-field">
                  <label htmlFor="invoiceStatus">Richiesta fattura</label>
                  <select defaultValue="DA_FATTURARE" id="invoiceStatus" name="invoiceStatus">
                    {Object.entries(invoiceStatusLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field order-sheet-deposit-field">
                  <label htmlFor="initialDeposit">Acconto iniziale</label>
                  <input className="currency-input" id="initialDeposit" inputMode="decimal" name="initialDeposit" placeholder="0,00" />
                </div>
                <div className="order-sheet-chip order-sheet-total-card">
                  <span className="card-muted">Totale anteprima</span>
                  <strong>{formatCurrency(previewTotalCents)}</strong>
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      <div className="button-row order-desktop-submit-row">
        <button className="primary" type="submit">
          {isQuoteMode ? "Crea preventivo" : "Crea ordine"}
        </button>
      </div>

      <div className="order-mobile-footer">
        <div className="order-mobile-footer-meta">
          <span className="compact-kicker">{`Step ${mobileStepIndex + 1} di ${MOBILE_ORDER_STEPS.length}`}</span>
          <strong>{MOBILE_ORDER_STEPS[mobileStepIndex].label}</strong>
          <span className="subtle">{`${filledRows} righe compilate • ${formatCurrency(previewTotalCents)}`}</span>
        </div>
        <div className="order-mobile-footer-actions">
          <button
            className="secondary"
            disabled={mobileStepIndex === 0}
            onClick={() => {
              if (mobileStepIndex > 0) {
                jumpToMobileStep(MOBILE_ORDER_STEPS[mobileStepIndex - 1].id);
              }
            }}
            type="button"
          >
            Indietro
          </button>
          {mobileStep === "review" ? (
            <button className="primary" type="submit">
              {mobileContinueLabel}
            </button>
          ) : (
            <button
              className="primary"
              disabled={!canContinueMobileStep}
              onClick={() => {
                if (!canContinueMobileStep || mobileStepIndex >= MOBILE_ORDER_STEPS.length - 1) {
                  return;
                }
                jumpToMobileStep(MOBILE_ORDER_STEPS[mobileStepIndex + 1].id);
              }}
              type="button"
            >
              {mobileContinueLabel}
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
