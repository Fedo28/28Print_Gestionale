"use client";

import type { DiscountMode, ServiceCatalog } from "@prisma/client";
import { useDeferredValue, useState } from "react";
import { createOrderItemAction, updateOrderItemAction } from "@/app/actions";
import { formatCurrency } from "@/lib/format";
import { getTieredUnitPrice, parseQuantityValue, usesLineTotalQuantityTiers } from "@/lib/pricing";
import { formatServiceUnitPriceLabel, formatServiceUnitShortLabel } from "@/lib/service-units";

const discountModeOptions = [
  { value: "NONE", label: "Nessuno" },
  { value: "AMOUNT", label: "Euro" },
  { value: "PERCENT", label: "%" }
] as const;

type OrderItemEditorService = Pick<ServiceCatalog, "id" | "code" | "name" | "basePriceCents" | "quantityTiers" | "unit">;

type OrderItemEditorValues = {
  id?: string;
  label: string;
  serviceCatalogId?: string | null;
  quantity: number;
  catalogBasePriceCents?: number | null;
  unitPriceCents: number;
  discountMode: DiscountMode;
  discountValue: number;
  extraMode: DiscountMode;
  extraValue: number;
  format?: string | null;
  material?: string | null;
  finishing?: string | null;
  notes?: string | null;
};

type OrderItemEditorFormProps = {
  mode: "create" | "update";
  orderId: string;
  fieldPrefix: string;
  services: OrderItemEditorService[];
  values?: OrderItemEditorValues;
  submitLabel: string;
};

function formatPriceInput(cents: number) {
  return (Math.max(cents, 0) / 100).toFixed(2).replace(".", ",");
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function buildSearchHaystack(service: OrderItemEditorService) {
  return normalizeSearchValue([service.code || "", service.name, service.quantityTiers || ""].join(" "));
}

function getSearchScore(service: OrderItemEditorService, normalizedQuery: string) {
  const haystack = buildSearchHaystack(service);
  const terms = normalizedQuery.split(/\s+/).filter(Boolean);

  if (!terms.length || !terms.every((term) => haystack.includes(term))) {
    return Number.MAX_SAFE_INTEGER;
  }

  const normalizedCode = normalizeSearchValue(service.code || "");
  const normalizedName = normalizeSearchValue(service.name);

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

  if (normalizedCode.includes(normalizedQuery)) {
    return 4;
  }

  if (normalizedName.includes(normalizedQuery)) {
    return 5;
  }

  return 6;
}

function getCatalogPriceDisplay(service: OrderItemEditorService | undefined, quantity: number) {
  if (!service) {
    return "";
  }

  let cents = service.basePriceCents;

  try {
    cents = getTieredUnitPrice(service.basePriceCents, quantity, service.quantityTiers);
  } catch {
    cents = service.basePriceCents;
  }

  return formatPriceInput(cents);
}

function getInitialPriceOverrideState(
  values: OrderItemEditorValues | undefined,
  services: OrderItemEditorService[],
  quantityInput: string
) {
  if (!values?.serviceCatalogId) {
    return false;
  }

  const service = services.find((entry) => entry.id === values.serviceCatalogId);
  if (!service) {
    return false;
  }

  const expectedPrice = getCatalogPriceDisplay(service, parseQuantityValue(quantityInput, 1));
  const currentPrice = formatPriceInput(values.catalogBasePriceCents || values.unitPriceCents || 0);

  return expectedPrice !== currentPrice;
}

export function OrderItemEditorForm({
  mode,
  orderId,
  fieldPrefix,
  services,
  values,
  submitLabel
}: OrderItemEditorFormProps) {
  const initialSelectedService = values?.serviceCatalogId
    ? services.find((entry) => entry.id === values.serviceCatalogId) || null
    : null;
  const initialQuantity = values ? String(values.quantity).replace(".", ",") : "1";
  const initialBasePrice = formatPriceInput(values?.catalogBasePriceCents || values?.unitPriceCents || 0);
  const [serviceCatalogId, setServiceCatalogId] = useState(values?.serviceCatalogId || "");
  const [serviceQuery, setServiceQuery] = useState(initialSelectedService?.name || "");
  const [quantity, setQuantity] = useState(initialQuantity);
  const [catalogBasePrice, setCatalogBasePrice] = useState(initialBasePrice);
  const [priceOverridden, setPriceOverridden] = useState(getInitialPriceOverrideState(values, services, initialQuantity));
  const [isServiceFocused, setIsServiceFocused] = useState(false);
  const deferredServiceQuery = useDeferredValue(serviceQuery);
  const action = mode === "create" ? createOrderItemAction : updateOrderItemAction;
  const selectedService = serviceCatalogId ? services.find((entry) => entry.id === serviceCatalogId) || null : null;
  const normalizedServiceQuery = normalizeSearchValue(deferredServiceQuery);
  const serviceSuggestions = normalizedServiceQuery
    ? services
        .map((service) => ({
          service,
          score: getSearchScore(service, normalizedServiceQuery)
        }))
        .filter((entry) => entry.score !== Number.MAX_SAFE_INTEGER)
        .sort(
          (left, right) =>
            left.score - right.score ||
            left.service.name.localeCompare(right.service.name, "it") ||
            (left.service.code || "").localeCompare(right.service.code || "", "it")
        )
        .slice(0, 6)
        .map((entry) => entry.service)
    : [];
  const showServiceSuggestions =
    isServiceFocused &&
    normalizedServiceQuery.length > 0 &&
    (!selectedService || normalizeSearchValue(selectedService.name) !== normalizedServiceQuery);

  function handleServiceChange(nextServiceCatalogId: string) {
    setServiceCatalogId(nextServiceCatalogId);

    const selectedService = services.find((entry) => entry.id === nextServiceCatalogId);
    if (!selectedService) {
      return;
    }

    setCatalogBasePrice(getCatalogPriceDisplay(selectedService, parseQuantityValue(quantity, 1)));
    setPriceOverridden(false);
  }

  function handleServiceSearchChange(nextValue: string) {
    setServiceQuery(nextValue);

    const normalizedNextValue = normalizeSearchValue(nextValue);
    const exactMatchedService = services.find(
      (service) =>
        normalizeSearchValue(service.name) === normalizedNextValue || normalizeSearchValue(service.code || "") === normalizedNextValue
    );

    if (exactMatchedService) {
      handleServiceChange(exactMatchedService.id);
      setServiceQuery(exactMatchedService.name);
      return;
    }

    if (selectedService && normalizeSearchValue(selectedService.name) !== normalizedNextValue) {
      setServiceCatalogId("");
    }
  }

  function clearSelectedService() {
    setServiceCatalogId("");
    setServiceQuery("");
  }

  function handleQuantityChange(nextQuantity: string) {
    setQuantity(nextQuantity);

    if (priceOverridden) {
      return;
    }

    const selectedService = services.find((entry) => entry.id === serviceCatalogId);
    if (!selectedService) {
      return;
    }

    setCatalogBasePrice(getCatalogPriceDisplay(selectedService, parseQuantityValue(nextQuantity, 1)));
  }

  return (
    <form action={action} className="form-grid order-item-editor-form">
      <input name="orderId" type="hidden" value={orderId} />
      {mode === "update" && values?.id ? <input name="itemId" type="hidden" value={values.id} /> : null}
      <div className="field wide">
        <label htmlFor={`${fieldPrefix}-service`}>Cerca servizio di catalogo</label>
        <input
          autoComplete="off"
          id={`${fieldPrefix}-service`}
          onBlur={() => {
            window.setTimeout(() => setIsServiceFocused(false), 120);
          }}
          onChange={(event) => handleServiceSearchChange(event.target.value)}
          onFocus={() => setIsServiceFocused(true)}
          placeholder="Scrivi nome o codice servizio"
          spellCheck={false}
          type="search"
          value={serviceQuery}
        />
        <input name="serviceCatalogId" type="hidden" value={serviceCatalogId} />
        <div className="order-item-service-search-meta">
          <span className="subtle">
            {selectedService
              ? `${selectedService.code || "Senza codice"} • ${formatCurrency(selectedService.basePriceCents)} • ${formatServiceUnitPriceLabel(selectedService.unit)}`
              : "Lascia vuoto o non selezionare nulla per usare una voce libera."}
          </span>
          {selectedService || serviceQuery ? (
            <button className="ghost order-item-service-clear" onClick={clearSelectedService} type="button">
              Voce libera
            </button>
          ) : null}
        </div>
        {showServiceSuggestions ? (
          serviceSuggestions.length > 0 ? (
            <div className="order-line-suggestions" aria-label="Suggerimenti servizi catalogo">
              {serviceSuggestions.map((service) => (
                <button
                  className="order-line-suggestion"
                  key={service.id}
                  onClick={() => {
                    handleServiceChange(service.id);
                    setServiceQuery(service.name);
                    setIsServiceFocused(false);
                  }}
                  onMouseDown={(event) => event.preventDefault()}
                  type="button"
                >
                  <span className="order-line-suggestion-main">
                    <strong className="order-line-suggestion-title">{service.name}</strong>
                    <span className="order-line-suggestion-meta">
                      {service.code || "Senza codice"} • {formatCurrency(service.basePriceCents)} • {formatServiceUnitPriceLabel(service.unit)}
                    </span>
                  </span>
                  <span className="order-line-suggestion-badge">{formatServiceUnitShortLabel(service.unit)}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mini-item customer-autocomplete-empty">
              <p className="subtle">Nessun servizio trovato. Continua a scrivere oppure lascia la riga come voce libera.</p>
            </div>
          )
        ) : null}
      </div>
      <div className="field wide">
        <label htmlFor={`${fieldPrefix}-label`}>Titolo riga</label>
        <input defaultValue={values?.label || ""} id={`${fieldPrefix}-label`} name="label" required />
      </div>
      <div className="field">
        <label htmlFor={`${fieldPrefix}-qty`}>Qta</label>
        <input
          className="numeric-input"
          id={`${fieldPrefix}-qty`}
          inputMode="decimal"
          name="quantity"
          onChange={(event) => handleQuantityChange(event.target.value)}
          value={quantity}
        />
      </div>
      <div className="field">
        <label htmlFor={`${fieldPrefix}-base`}>Prezzo listino</label>
        <input
          className="currency-input"
          id={`${fieldPrefix}-base`}
          inputMode="decimal"
          name="catalogBasePrice"
          onChange={(event) => {
            setCatalogBasePrice(event.target.value);
            setPriceOverridden(true);
          }}
          value={catalogBasePrice}
        />
      </div>
      <div className="field">
        <label htmlFor={`${fieldPrefix}-discount-mode`}>Sconto</label>
        <select defaultValue={values?.discountMode || "NONE"} id={`${fieldPrefix}-discount-mode`} name="discountMode">
          {discountModeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${fieldPrefix}-discount-value`}>Valore sconto</label>
        <input
          className="numeric-input"
          defaultValue={
            values
              ? values.discountMode === "PERCENT"
                ? String(values.discountValue)
                : formatPriceInput(values.discountValue)
              : "0"
          }
          id={`${fieldPrefix}-discount-value`}
          inputMode="decimal"
          name="discountValue"
        />
      </div>
      <div className="field">
        <label htmlFor={`${fieldPrefix}-extra-mode`}>Extra</label>
        <select defaultValue={values?.extraMode || "NONE"} id={`${fieldPrefix}-extra-mode`} name="extraMode">
          {discountModeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor={`${fieldPrefix}-extra-value`}>Valore extra</label>
        <input
          className="numeric-input"
          defaultValue={
            values
              ? values.extraMode === "PERCENT"
                ? String(values.extraValue)
                : formatPriceInput(values.extraValue)
              : "0"
          }
          id={`${fieldPrefix}-extra-value`}
          inputMode="decimal"
          name="extraValue"
        />
      </div>
      <div className="field">
        <label htmlFor={`${fieldPrefix}-format`}>Formato</label>
        <input defaultValue={values?.format || ""} id={`${fieldPrefix}-format`} name="format" />
      </div>
      <div className="field">
        <label htmlFor={`${fieldPrefix}-material`}>Materiale</label>
        <input defaultValue={values?.material || ""} id={`${fieldPrefix}-material`} name="material" />
      </div>
      <div className="field">
        <label htmlFor={`${fieldPrefix}-finishing`}>Finitura</label>
        <input defaultValue={values?.finishing || ""} id={`${fieldPrefix}-finishing`} name="finishing" />
      </div>
      <div className="field full">
        <label htmlFor={`${fieldPrefix}-notes`}>Note riga</label>
        <textarea defaultValue={values?.notes || ""} id={`${fieldPrefix}-notes`} name="notes" />
      </div>
      <div className="button-row order-detail-submit-row">
        <button className={mode === "create" ? "primary" : "secondary"} type="submit">
          {submitLabel}
        </button>
      </div>
      {serviceCatalogId ? <input name="catalogPriceMode" type="hidden" value={usesLineTotalQuantityTiers(selectedService) ? "LINE_TOTAL" : "UNIT"} /> : null}
    </form>
  );
}
