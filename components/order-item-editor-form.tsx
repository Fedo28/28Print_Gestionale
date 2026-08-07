"use client";

import type { DiscountMode, ServiceCatalog } from "@prisma/client";
import { useDeferredValue, useEffect, useState } from "react";
import { createOrderItemAction, updateOrderItemAction } from "@/app/actions";
import { UndoButtonContent } from "@/components/undo-button-content";
import { useUndoHistory } from "@/components/use-undo-history";
import { normalizeCatalogServiceSearchValue, rankCatalogServices } from "@/lib/catalog-search";
import { formatCurrency } from "@/lib/format";
import { getTieredUnitPrice, parseFlexibleAdjustmentInput, parseQuantityValue, usesLineTotalQuantityTiers } from "@/lib/pricing";

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

type OrderItemEditorUndoSnapshot = {
  serviceCatalogId: string;
  serviceQuery: string;
  quantity: string;
  catalogBasePrice: string;
  priceOverridden: boolean;
  label: string;
  isCustomLabel: boolean;
  discountInput: string;
  extraInput: string;
  format: string;
  material: string;
  finishing: string;
  notes: string;
};

function formatPriceInput(cents: number) {
  return (Math.max(cents, 0) / 100).toFixed(2).replace(".", ",");
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

function formatAdjustmentInput(mode: DiscountMode, value: number) {
  if (mode === "PERCENT") {
    return `${value}%`;
  }

  if (mode === "AMOUNT") {
    return formatPriceInput(value);
  }

  return "";
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
  const [label, setLabel] = useState(values?.label || "");
  const [isCustomLabel, setIsCustomLabel] = useState(
    initialSelectedService ? (values?.label || "").trim() !== initialSelectedService.name.trim() : true
  );
  const [discountInput, setDiscountInput] = useState(
    values ? formatAdjustmentInput(values.discountMode, values.discountValue) : ""
  );
  const [extraInput, setExtraInput] = useState(
    values ? formatAdjustmentInput(values.extraMode, values.extraValue) : ""
  );
  const [format, setFormat] = useState(values?.format || "");
  const [material, setMaterial] = useState(values?.material || "");
  const [finishing, setFinishing] = useState(values?.finishing || "");
  const [notes, setNotes] = useState(values?.notes || "");
  const itemUndo = useUndoHistory<OrderItemEditorUndoSnapshot>({
    limit: 40,
    debounceMs: 180
  });
  const {
    canUndo: canUndoItem,
    undo: undoItem,
    undoCount: undoItemCount,
    reset: resetItemUndo,
    record: recordItemUndo
  } = itemUndo;
  const deferredServiceQuery = useDeferredValue(serviceQuery);
  const action = mode === "create" ? createOrderItemAction : updateOrderItemAction;
  const selectedService = serviceCatalogId ? services.find((entry) => entry.id === serviceCatalogId) || null : null;
  const hasAdvancedValues = Boolean(
    discountInput.trim() ||
      extraInput.trim() ||
      format.trim() ||
      material.trim() ||
      finishing.trim()
  );
  const normalizedServiceQuery = normalizeCatalogServiceSearchValue(deferredServiceQuery);
  const serviceSuggestions = normalizedServiceQuery ? rankCatalogServices(services, normalizedServiceQuery).slice(0, 6) : [];
  const showServiceSuggestions =
    isServiceFocused &&
    normalizedServiceQuery.length > 0 &&
    (!selectedService || normalizeCatalogServiceSearchValue(selectedService.name) !== normalizedServiceQuery);

  function captureUndoSnapshot(): OrderItemEditorUndoSnapshot {
    return {
      serviceCatalogId,
      serviceQuery,
      quantity,
      catalogBasePrice,
      priceOverridden,
      label,
      isCustomLabel,
      discountInput,
      extraInput,
      format,
      material,
      finishing,
      notes
    };
  }

  function restoreUndoSnapshot(snapshot: OrderItemEditorUndoSnapshot) {
    setServiceCatalogId(snapshot.serviceCatalogId);
    setServiceQuery(snapshot.serviceQuery);
    setQuantity(snapshot.quantity);
    setCatalogBasePrice(snapshot.catalogBasePrice);
    setPriceOverridden(snapshot.priceOverridden);
    setLabel(snapshot.label);
    setIsCustomLabel(snapshot.isCustomLabel);
    setDiscountInput(snapshot.discountInput);
    setExtraInput(snapshot.extraInput);
    setFormat(snapshot.format);
    setMaterial(snapshot.material);
    setFinishing(snapshot.finishing);
    setNotes(snapshot.notes);
  }

  useEffect(() => {
    resetItemUndo(captureUndoSnapshot());
  }, [resetItemUndo]);

  useEffect(() => {
    recordItemUndo(captureUndoSnapshot());
  }, [
    catalogBasePrice,
    discountInput,
    extraInput,
    finishing,
    format,
    isCustomLabel,
    label,
    material,
    notes,
    priceOverridden,
    quantity,
    recordItemUndo,
    serviceCatalogId,
    serviceQuery
  ]);

  function handleServiceChange(nextServiceCatalogId: string) {
    setServiceCatalogId(nextServiceCatalogId);

    const nextSelectedService = services.find((entry) => entry.id === nextServiceCatalogId);
    if (!nextSelectedService) {
      return;
    }

    setCatalogBasePrice(getCatalogPriceDisplay(nextSelectedService, parseQuantityValue(quantity, 1)));
    setPriceOverridden(false);
    setLabel(nextSelectedService.name);
    setIsCustomLabel(false);
  }

  function handleServiceSearchChange(nextValue: string) {
    setServiceQuery(nextValue);

    const normalizedNextValue = normalizeCatalogServiceSearchValue(nextValue);
    const exactMatchedService = services.find(
      (service) =>
        normalizeCatalogServiceSearchValue(service.name) === normalizedNextValue ||
        normalizeCatalogServiceSearchValue(service.code || "") === normalizedNextValue
    );

    if (exactMatchedService) {
      handleServiceChange(exactMatchedService.id);
      setServiceQuery(exactMatchedService.name);
      return;
    }

    if (selectedService && normalizeCatalogServiceSearchValue(selectedService.name) !== normalizedNextValue) {
      setServiceCatalogId("");
    }
  }

  function clearSelectedService() {
    const shouldClearLabel = Boolean(selectedService) && !isCustomLabel && label.trim() === (selectedService?.name || "").trim();
    setServiceCatalogId("");
    setServiceQuery("");
    setIsCustomLabel(true);

    if (shouldClearLabel) {
      setLabel("");
    }
  }

  function handleQuantityChange(nextQuantity: string) {
    setQuantity(nextQuantity);

    if (priceOverridden) {
      return;
    }

    const nextSelectedService = services.find((entry) => entry.id === serviceCatalogId);
    if (!nextSelectedService) {
      return;
    }

    setCatalogBasePrice(getCatalogPriceDisplay(nextSelectedService, parseQuantityValue(nextQuantity, 1)));
  }

  return (
    <form action={action} className="form-grid order-item-editor-form">
      <input name="orderId" type="hidden" value={orderId} />
      {mode === "update" && values?.id ? <input name="itemId" type="hidden" value={values.id} /> : null}

      <div className="field wide">
        <label htmlFor={`${fieldPrefix}-service`}>Catalogo</label>
        <input
          autoComplete="off"
          id={`${fieldPrefix}-service`}
          onBlur={() => {
            window.setTimeout(() => setIsServiceFocused(false), 120);
          }}
          onChange={(event) => handleServiceSearchChange(event.target.value)}
          onFocus={() => setIsServiceFocused(true)}
          placeholder="Scrivi nome o codice"
          spellCheck={false}
          type="search"
          value={serviceQuery}
        />
        <input name="serviceCatalogId" type="hidden" value={serviceCatalogId} />
        <div className="order-item-service-search-meta">
          <span className="subtle">
            {selectedService
              ? formatCurrency(selectedService.basePriceCents)
              : "Vuoto = voce libera"}
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
                    <span className="order-line-suggestion-meta">{formatCurrency(service.basePriceCents)}</span>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mini-item customer-autocomplete-empty">
              <p className="subtle">Nessun servizio trovato.</p>
            </div>
          )
        ) : null}
      </div>

      {selectedService && !isCustomLabel ? (
        <div className="field full order-item-linked-label">
          <label>Titolo automatico</label>
          <div className="order-item-linked-label-card">
            <div>
              <strong>{label}</strong>
              <span className="subtle">Preso dal catalogo</span>
            </div>
            <button className="ghost order-item-title-toggle" onClick={() => setIsCustomLabel(true)} type="button">
              Cambia nome
            </button>
          </div>
          <input name="label" type="hidden" value={label} />
        </div>
      ) : (
        <div className="field wide">
          <label htmlFor={`${fieldPrefix}-label`}>{selectedService ? "Nome personalizzato" : "Nome riga"}</label>
          <input
            id={`${fieldPrefix}-label`}
            name="label"
            onChange={(event) => {
              setLabel(event.target.value);
              if (selectedService) {
                setIsCustomLabel(true);
              }
            }}
            required
            value={label}
          />
          {selectedService ? (
            <div className="order-item-manual-label-actions">
              <button
                className="ghost order-item-title-toggle"
                onClick={() => {
                  setLabel(selectedService.name);
                  setIsCustomLabel(false);
                }}
                type="button"
              >
                Usa nome catalogo
              </button>
            </div>
          ) : null}
        </div>
      )}

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
        <label htmlFor={`${fieldPrefix}-base`}>Prezzo</label>
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

      <div className="field full">
        <label htmlFor={`${fieldPrefix}-notes`}>Note</label>
        <textarea id={`${fieldPrefix}-notes`} name="notes" onChange={(event) => setNotes(event.target.value)} value={notes} />
      </div>

      <details className="order-item-advanced-panel" open={hasAdvancedValues}>
        <summary className="order-item-advanced-summary">Dettagli opzionali</summary>
        <div className="form-grid order-item-advanced-grid">
          <div className="field">
            <label htmlFor={`${fieldPrefix}-discount-value`}>Sconto</label>
            <input
              className="numeric-input"
              id={`${fieldPrefix}-discount-value`}
              inputMode="decimal"
              name="discountValue"
              onChange={(event) => setDiscountInput(event.target.value)}
              placeholder="0,00 o 10%"
              value={discountInput}
            />
          </div>

          <div className="field">
            <label htmlFor={`${fieldPrefix}-extra-value`}>Extra</label>
            <input
              className="numeric-input"
              id={`${fieldPrefix}-extra-value`}
              inputMode="decimal"
              name="extraValue"
              onChange={(event) => setExtraInput(event.target.value)}
              placeholder="0,00 o 10%"
              value={extraInput}
            />
          </div>

          <div className="field">
            <label htmlFor={`${fieldPrefix}-format`}>Formato</label>
            <input id={`${fieldPrefix}-format`} name="format" onChange={(event) => setFormat(event.target.value)} value={format} />
          </div>

          <div className="field">
            <label htmlFor={`${fieldPrefix}-material`}>Materiale</label>
            <input id={`${fieldPrefix}-material`} name="material" onChange={(event) => setMaterial(event.target.value)} value={material} />
          </div>

          <div className="field">
            <label htmlFor={`${fieldPrefix}-finishing`}>Finitura</label>
            <input id={`${fieldPrefix}-finishing`} name="finishing" onChange={(event) => setFinishing(event.target.value)} value={finishing} />
          </div>
        </div>
      </details>

      <div className="button-row order-detail-submit-row">
        <input name="discountMode" type="hidden" value={parseFlexibleAdjustmentInput(discountInput, "AMOUNT").mode} />
        <input name="extraMode" type="hidden" value={parseFlexibleAdjustmentInput(extraInput, "AMOUNT").mode} />
        <button
          className="ghost undo-action-button"
          disabled={!canUndoItem}
          onClick={(event) => {
            event.preventDefault();
            if (!canUndoItem) {
              return;
            }
            if (!window.confirm("Vuoi annullare l'ultima modifica di questa riga?")) {
              return;
            }
            const snapshot = undoItem();
            if (!snapshot) {
              return;
            }
            restoreUndoSnapshot(snapshot);
          }}
          type="button"
        >
          <UndoButtonContent count={canUndoItem ? undoItemCount : undefined} label="Indietro" />
        </button>
        <button className={mode === "create" ? "primary" : "secondary"} type="submit">
          {submitLabel}
        </button>
      </div>

      {selectedService ? (
        <input
          name="catalogPriceMode"
          type="hidden"
          value={usesLineTotalQuantityTiers(selectedService) ? "LINE_TOTAL" : "UNIT"}
        />
      ) : null}
    </form>
  );
}
