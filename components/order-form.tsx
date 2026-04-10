"use client";

import { Customer, CustomerType, ServiceCatalog } from "@prisma/client";
import { useEffect, useRef, useState } from "react";
import { CustomerAutocomplete } from "@/components/customer-autocomplete";
import { customerTypeLabels, invoiceStatusLabels, priorityLabels } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
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

type InlineCatalogDraft = {
  name: string;
  code: string;
  basePrice: string;
  description: string;
  quantityTiers: string;
};

function createEmptyInlineCatalogDraft(): InlineCatalogDraft {
  return {
    name: "",
    code: "",
    basePrice: "",
    description: "",
    quantityTiers: ""
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
  const [catalogServices, setCatalogServices] = useState<ServiceCatalog[]>(services);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerQuery, setCustomerQuery] = useState("");
  const [items, setItems] = useState<ItemState[]>([emptyItem(), emptyItem()]);
  const [activeServiceField, setActiveServiceField] = useState<number | null>(null);
  const [openTierIndex, setOpenTierIndex] = useState<number | null>(null);
  const [catalogDraftRowIndex, setCatalogDraftRowIndex] = useState<number | null>(null);
  const [catalogDraft, setCatalogDraft] = useState<InlineCatalogDraft>(createEmptyInlineCatalogDraft());
  const [catalogDraftMessage, setCatalogDraftMessage] = useState<string | null>(null);
  const [isCatalogDraftSubmitting, setIsCatalogDraftSubmitting] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [draftRestoredAt, setDraftRestoredAt] = useState<string | null>(null);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string | null>(null);
  const [hasSavedDraft, setHasSavedDraft] = useState(false);
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);
  const photographyFormats = getPhotographyFormatOptions(catalogServices);
  const photographyServices = catalogServices.filter(isPhotographyService);
  const isCatalogEmpty = catalogServices.length === 0;
  const defaultCustomerType: CustomerType = "PUBBLICO";
  const isQuoteMode = kind === "quote";
  const draftStorageKey = buildOrderDraftStorageKey(kind as OrderDraftMode);
  const submittedDraftKey = buildOrderDraftSubmittedKey(kind as OrderDraftMode);

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
    setItems([emptyItem(), emptyItem()]);
    setActiveServiceField(null);
    setOpenTierIndex(null);
    setCatalogDraftRowIndex(null);
    setCatalogDraft(createEmptyInlineCatalogDraft());
    setCatalogDraftMessage(null);
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

  useEffect(() => {
    setCatalogServices(services);
  }, [services]);

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
    setItems(draft.items.length > 0 ? draft.items.map((item) => createItemStateFromDraft(item)) : [emptyItem(), emptyItem()]);
    setHasSavedDraft(true);
    setLastDraftSavedAt(draft.savedAt);
    setDraftRestoredAt(draft.savedAt);

    window.setTimeout(() => {
      applyDraftFields(draft.fields);
      setDraftHydrated(true);
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
    };
  }, []);

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
        meta: `${service.code || "Senza codice"} • ${(service.basePriceCents / 100).toFixed(2).replace(".", ",")} €`,
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
              priceOverridden: false
            }
          : entry
      )
    );
    setActiveServiceField(null);
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
        const lineTotalCents = computeLineTotalWithAdjustmentsCents(
          catalogBasePriceCents,
          quantity,
          item.discountMode,
          discountValue,
          item.extraMode,
          extraValue
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
          discountValue,
          extraValue,
          unitPriceCents
        };
      })
      .filter((item) => item.label.trim() && (!item.serviceQuery || item.serviceQuery !== "Fotografie" || Boolean(item.serviceCatalogId)))
  );
  const previewTotalCents = items.reduce((sum, item) => {
    const quantity = parseQuantityValue(item.quantity, 1);
    const lineTotalCents = computeLineTotalWithAdjustmentsCents(
      parseDisplayPriceToCents(item.unitPrice),
      quantity,
      item.discountMode,
      parseDiscountValue(item.discountMode, item.discountValue),
      item.extraMode,
      parseDiscountValue(item.extraMode, item.extraValue)
    );
    return sum + (Number.isFinite(lineTotalCents) ? lineTotalCents : 0);
  }, 0);
  const filledRows = items.filter((item) => item.label.trim() || item.notes.trim()).length;

  return (
    <form
      action={action}
      className="stack"
      onChangeCapture={() => scheduleDraftSave()}
      onInputCapture={() => scheduleDraftSave()}
      onSubmit={() => {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(submittedDraftKey, "1");
        }
      }}
      ref={formRef}
    >
      {selectedCustomerId ? <input name="customerId" type="hidden" value={selectedCustomerId} /> : null}
      {isQuoteMode ? <input name="isQuote" type="hidden" value="true" /> : null}
      <section className="card card-pad order-sheet-hero">
        <div className="order-sheet-head">
          <div className="stack compact-stack">
            <span className="compact-kicker">{isQuoteMode ? "Scheda preventivo" : "Scheda ordine"}</span>
            <h3>{isQuoteMode ? "Preventivo rapido da banco" : "Copia commissione digitale"}</h3>
            <p className="card-muted">
              {isQuoteMode
                ? "Stesso flusso compatto degli ordini, ma dedicato ai preventivi per non mescolare il lavoro operativo."
                : "Modulo rapido da banco: cliente, consegna, acconto e righe lavorazione tutte nella stessa scheda."}
            </p>
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
        <div className="order-draft-banner">
          <div className="compact-stack">
            <strong>{hasSavedDraft ? "Bozza attiva" : "Autosalvataggio pronto"}</strong>
            <span className="subtle">
              {draftRestoredAt
                ? `Bozza recuperata automaticamente da ${formatDateTime(draftRestoredAt)}`
                : lastDraftSavedAt
                  ? `Ultimo autosalvataggio ${formatDateTime(lastDraftSavedAt)}`
                  : "Compilo e salvo da solo la scheda mentre lavori."}
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
      </section>

      <div className="grid grid-2 order-sheet-grid">
        <section className="card card-pad order-sheet-panel">
          <div className="stack">
            <div>
              <h3>Cliente</h3>
              <p className="card-muted">Cerca un cliente gia registrato oppure inseriscilo al volo come sulla copia commissione.</p>
            </div>
            <div className="form-grid">
              <CustomerAutocomplete
                customers={customers.map((customer) => ({
                  ...customer,
                  orderCount: customer.orders.length
                }))}
                helperText="Scrivi nome, telefono, email, PEC, codice fiscale, partita IVA o codice univoco per trovare subito il cliente giusto."
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
                  <div className="subtle">{selectedCustomer.phone || "Telefono non inserito"}</div>
                  <div className="subtle">{selectedCustomer.email || selectedCustomer.pec || selectedCustomer.whatsapp || "Nessun contatto secondario"}</div>
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
                  <div className="field full">
                    <label htmlFor="customerNotes">Note cliente</label>
                    <textarea id="customerNotes" name="customerNotes" />
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <section className="card card-pad order-sheet-panel">
          <div className="stack">
            <div>
              <h3>{isQuoteMode ? "Dati preventivo" : "Dati ordine"}</h3>
              <p className="card-muted">
                {isQuoteMode
                  ? "Campi essenziali per preparare un preventivo completo senza mischiarlo al flusso operativo."
                  : "Campi essenziali per prendere in carico l’ordine senza perdere tempo."}
              </p>
            </div>
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="title">Titolo / lavoro</label>
                <input id="title" name="title" placeholder="Biglietti visita Rossi" required />
              </div>
              <div className="field wide">
                <label htmlFor="deliveryAt">Consegna prevista</label>
                <input id="deliveryAt" name="deliveryAt" required type="datetime-local" />
              </div>
              <div className="field wide">
                <label htmlFor="appointmentAt">Appuntamento programmato</label>
                <input id="appointmentAt" name="appointmentAt" type="datetime-local" />
              </div>
              <div className="field">
                <label htmlFor="priority">Priorita</label>
                <select defaultValue="MEDIA" id="priority" name="priority">
                  {Object.entries(priorityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="invoiceStatus">Stato fatturazione</label>
                <select defaultValue="DA_FATTURARE" id="invoiceStatus" name="invoiceStatus">
                  {Object.entries(invoiceStatusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="initialDeposit">Acconto iniziale</label>
                <input id="initialDeposit" name="initialDeposit" placeholder="0,00" />
              </div>
              <div className="field full">
                <label htmlFor="appointmentNote">Nota appuntamento</label>
                <input id="appointmentNote" name="appointmentNote" placeholder="Installazione vetrina, sopralluogo, lavorazione esterna" />
              </div>
              <div className="field full">
                <label htmlFor="notes">Note operative</label>
                <textarea id="notes" name="notes" />
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="card card-pad order-sheet-lines">
        <div className="list-header">
          <div>
            <h3>Righe lavorazione</h3>
            <p className="card-muted">Impostate come una copia commissione: numero riga, articolo, quantita, prezzo e note rapide.</p>
          </div>
          <button
            className="ghost"
            onClick={(event) => {
              event.preventDefault();
              setItems((current) => [...current, emptyItem()]);
            }}
            type="button"
          >
            Aggiungi riga
          </button>
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
            const selectedService = catalogServices.find((entry) => entry.id === item.serviceCatalogId);
            const suggestions = getServiceSuggestions(item.serviceQuery);
            const parsedTiers = getServiceTiers(selectedService);
            const lineQuantity = parseQuantityValue(item.quantity, 1);
            const selectedPhotographyOption = photographyFormats.find((entry) => entry.serviceId === item.serviceCatalogId && entry.label === item.photoFormat);
            const isPhotographyRow = item.photoMode || item.serviceQuery === "Fotografie" || Boolean(selectedPhotographyOption);
            const showSuggestions =
              activeServiceField === index &&
              item.serviceQuery.trim().length > 0 &&
              (!selectedService || normalizeCatalogSearch(item.serviceQuery) !== normalizeCatalogSearch(selectedService.name) || isPhotographyRow);
            const hasTierEntries = parsedTiers.length > 0;
            const lineFinalWithExtraCents = computeLineTotalWithAdjustmentsCents(
              parseDisplayPriceToCents(item.unitPrice),
              lineQuantity,
              item.discountMode,
              parseDiscountValue(item.discountMode, item.discountValue),
              item.extraMode,
              parseDiscountValue(item.extraMode, item.extraValue)
            );

            return (
              <article className="order-line-card" key={index}>
                <div className="order-line-head">
                  <div className="order-line-index">#{index + 1}</div>
                  <strong>Voce lavorazione</strong>
                  <span className="pill">{new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(lineFinalWithExtraCents / 100)}</span>
                  {items.length > 1 ? (
                    <button
                      className="ghost"
                      onClick={(event) => {
                        event.preventDefault();
                        setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
                        closeInlineCatalogDraft();
                      }}
                      type="button"
                    >
                      Rimuovi
                    </button>
                  ) : null}
                </div>
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
                                    format: matchesSelectedService ? entry.format : ""
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
                        className="ghost order-line-tier-toggle"
                        onClick={(event) => {
                          event.preventDefault();
                          if (catalogDraftRowIndex === index) {
                            closeInlineCatalogDraft();
                          } else {
                            openInlineCatalogDraft(index);
                          }
                        }}
                        type="button"
                      >
                        {catalogDraftRowIndex === index ? "Chiudi nuovo servizio" : "Nuovo in catalogo"}
                      </button>
                      <button
                        className="ghost order-line-tier-toggle"
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
                      <div className="mini-item order-line-inline-catalog">
                        <div className="order-line-inline-catalog-head">
                          <div className="order-line-inline-catalog-title">
                            <div className="order-line-inline-catalog-copy">
                              <strong>Nuovo servizio catalogo</strong>
                              <p className="card-muted">Lo salvo e lo aggancio subito a questa riga.</p>
                            </div>
                            <span className="pill">Codice automatico se vuoto</span>
                          </div>
                          <p className="hint">
                            Compila prima nome e prezzo base. Descrizione e scaglioni servono solo se vuoi rendere il
                            servizio piu preciso o riutilizzarlo meglio in seguito.
                          </p>
                        </div>
                        <div className="order-line-inline-catalog-sections">
                          <section className="order-line-inline-catalog-section">
                            <div className="order-line-inline-catalog-section-head">
                              <strong>Dati base</strong>
                              <span className="subtle">Questi campi bastano per creare il servizio e usarlo subito.</span>
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
                              <div className="field wide order-line-inline-catalog-code">
                                <label htmlFor={`inline-service-code-${index}`}>Codice</label>
                                <input
                                  id={`inline-service-code-${index}`}
                                  onChange={(event) => setCatalogDraft((current) => ({ ...current, code: event.target.value }))}
                                  placeholder="Facoltativo"
                                  value={catalogDraft.code}
                                />
                              </div>
                              <div className="field wide order-line-inline-catalog-price">
                                <label htmlFor={`inline-service-price-${index}`}>Prezzo base</label>
                                <input
                                  id={`inline-service-price-${index}`}
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
                              <span className="subtle">Utile se vuoi trovare il servizio piu facilmente o descriverlo meglio.</span>
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
                              <span className="subtle">Usali solo se il prezzo cambia in base alla quantita ordinata.</span>
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
                            <p className="hint order-line-inline-catalog-help">
                              Esempio: <code>1-9:0,50 | 10-49:0,30 | 50+:0,20</code>
                            </p>
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
                      id={`unitPrice-${index}`}
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
                      disabled={item.discountMode === "NONE"}
                      id={`discountValue-${index}`}
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
                      disabled={item.extraMode === "NONE"}
                      id={`extraValue-${index}`}
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
                  <div className="field order-line-final">
                    <label htmlFor={`finalPrice-${index}`}>Prezzo finale</label>
                    <input
                      disabled
                      id={`finalPrice-${index}`}
                      value={new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(lineFinalWithExtraCents / 100)}
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
                </div>
              </article>
          );
          })}
        </div>
        <div className="order-sheet-footer">
          <div className="order-sheet-chip">
            <span className="card-muted">Totale anteprima</span>
            <strong>{new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(previewTotalCents / 100)}</strong>
          </div>
        </div>
      </section>

      <div className="button-row">
        <button className="primary" type="submit">
          {isQuoteMode ? "Crea preventivo" : "Crea ordine"}
        </button>
      </div>
    </form>
  );
}
