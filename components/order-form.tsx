"use client";

import { Customer, ServiceCatalog } from "@prisma/client";
import { useState } from "react";
import { invoiceStatusLabels, priorityLabels } from "@/lib/constants";
import {
  computeDiscountedUnitPrice,
  discountModeLabels,
  getTieredUnitPrice,
  type DiscountModeValue
} from "@/lib/pricing";

type CustomerWithOrders = Customer & { orders: { id: string }[] };

type ItemState = {
  label: string;
  description: string;
  quantity: number;
  unitPrice: string;
  discountMode: DiscountModeValue;
  discountValue: string;
  format: string;
  material: string;
  finishing: string;
  notes: string;
  serviceCatalogId: string;
  priceOverridden: boolean;
};

const emptyItem = (): ItemState => ({
  label: "",
  description: "",
  quantity: 1,
  unitPrice: "",
  discountMode: "NONE",
  discountValue: "",
  format: "",
  material: "",
  finishing: "",
  notes: "",
  serviceCatalogId: "",
  priceOverridden: false
});

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

export function OrderForm({
  customers,
  services,
  action
}: {
  customers: CustomerWithOrders[];
  services: ServiceCatalog[];
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [items, setItems] = useState<ItemState[]>([emptyItem(), emptyItem()]);
  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId);

  function getCatalogPriceDisplay(service: ServiceCatalog | undefined, quantity: number) {
    if (!service) {
      return "";
    }

    const cents = getTieredUnitPrice(service.basePriceCents, quantity, service.quantityTiers);
    return (cents / 100).toFixed(2).replace(".", ",");
  }

  const itemsPayload = JSON.stringify(
    items
      .map((item) => {
        const service = services.find((entry) => entry.id === item.serviceCatalogId);
        const catalogBasePriceCents = parseDisplayPriceToCents(item.unitPrice);
        const discountValue = parseDiscountValue(item.discountMode, item.discountValue);
        const unitPriceCents = computeDiscountedUnitPrice(catalogBasePriceCents, item.discountMode, discountValue);

        return {
          ...item,
          label: item.label || service?.name || "",
          serviceCatalogId: item.serviceCatalogId || undefined,
          priceOverridden: undefined,
          catalogBasePriceCents,
          discountValue,
          unitPriceCents
        };
      })
      .filter((item) => item.label.trim())
  );
  const previewTotalCents = items.reduce((sum, item) => {
    const unitPriceCents = computeDiscountedUnitPrice(
      parseDisplayPriceToCents(item.unitPrice),
      item.discountMode,
      parseDiscountValue(item.discountMode, item.discountValue)
    );
    return sum + (Number.isFinite(unitPriceCents) ? unitPriceCents : 0) * Math.max(1, item.quantity || 1);
  }, 0);
  const filledRows = items.filter((item) => item.label.trim() || item.description.trim()).length;

  return (
    <form action={action} className="stack">
      <section className="card card-pad order-sheet-hero">
        <div className="order-sheet-head">
          <div className="stack compact-stack">
            <span className="compact-kicker">Scheda ordine</span>
            <h3>Copia commissione digitale</h3>
            <p className="card-muted">
              Modulo rapido da banco: cliente, consegna, acconto e righe lavorazione tutte nella stessa scheda.
            </p>
          </div>
          <div className="order-sheet-summary">
            <div className="order-sheet-chip">
              <span className="subtle">Cliente</span>
              <strong>{selectedCustomer ? selectedCustomer.name : "Nuovo cliente"}</strong>
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
      </section>

      <div className="grid grid-2 order-sheet-grid">
        <section className="card card-pad order-sheet-panel">
          <div className="stack">
            <div>
              <h3>Cliente</h3>
              <p className="card-muted">Seleziona un cliente o inseriscilo al volo come sulla copia commissione.</p>
            </div>
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="customerId">Cliente esistente</label>
                <select
                  id="customerId"
                  name="customerId"
                  onChange={(event) => setSelectedCustomerId(event.target.value)}
                  value={selectedCustomerId}
                >
                  <option value="">Nuovo cliente</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name} - {customer.phone}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCustomerId ? null : (
                <>
                  <div className="field wide">
                    <label htmlFor="customerName">Nome / Ragione sociale</label>
                    <input id="customerName" name="customerName" required={!selectedCustomerId} />
                  </div>
                  <div className="field">
                    <label htmlFor="customerPhone">Telefono</label>
                    <input id="customerPhone" name="customerPhone" required={!selectedCustomerId} />
                  </div>
                  <div className="field">
                    <label htmlFor="customerWhatsapp">WhatsApp</label>
                    <input id="customerWhatsapp" name="customerWhatsapp" />
                  </div>
                  <div className="field wide">
                    <label htmlFor="customerEmail">Email</label>
                    <input id="customerEmail" name="customerEmail" type="email" />
                  </div>
                  <div className="field">
                    <label htmlFor="customerTaxCode">Codice fiscale</label>
                    <input id="customerTaxCode" name="customerTaxCode" />
                  </div>
                  <div className="field">
                    <label htmlFor="customerVatNumber">P. IVA</label>
                    <input id="customerVatNumber" name="customerVatNumber" />
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
              <h3>Dati ordine</h3>
              <p className="card-muted">Campi essenziali per prendere in carico l’ordine senza perdere tempo.</p>
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
              <div className="field">
                <label className="toggle-field" htmlFor="isQuote">
                  <input id="isQuote" name="isQuote" type="checkbox" />
                  <span>Preventivo</span>
                </label>
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
            <p className="card-muted">Impostate come una copia commissione: numero riga, descrizione e dettagli rapidi.</p>
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
        <input name="itemsPayload" type="hidden" value={itemsPayload} />

        <div className="order-lines-stack">
          {items.map((item, index) => {
            const lineFinalCents = computeDiscountedUnitPrice(
              parseDisplayPriceToCents(item.unitPrice),
              item.discountMode,
              parseDiscountValue(item.discountMode, item.discountValue)
            );

            return (
              <article className="order-line-card" key={index}>
                <div className="order-line-head">
                  <div className="order-line-index">#{index + 1}</div>
                  <strong>Voce lavorazione</strong>
                  <span className="pill">{new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(lineFinalCents / 100)}</span>
                  {items.length > 1 ? (
                    <button
                      className="ghost"
                      onClick={(event) => {
                        event.preventDefault();
                        setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
                      }}
                      type="button"
                    >
                      Rimuovi
                    </button>
                  ) : null}
                </div>
                <div className="form-grid order-line-grid">
                  <div className="field wide order-line-service">
                    <label htmlFor={`service-${index}`}>Servizio</label>
                    <select
                      id={`service-${index}`}
                      onChange={(event) => {
                        const service = services.find((entry) => entry.id === event.target.value);
                        setItems((current) =>
                          current.map((entry, itemIndex) =>
                            itemIndex === index
                              ? {
                                ...entry,
                                serviceCatalogId: event.target.value,
                                label: service ? service.name : entry.label,
                                unitPrice: service ? getCatalogPriceDisplay(service, entry.quantity) : entry.unitPrice,
                                discountMode: service ? "NONE" : entry.discountMode,
                                discountValue: service ? "" : entry.discountValue,
                                priceOverridden: false
                              }
                            : entry
                        )
                        );
                      }}
                      value={item.serviceCatalogId}
                    >
                      <option value="">Lavorazione personalizzata</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field wide order-line-description">
                    <label htmlFor={`label-${index}`}>Descrizione</label>
                    <input
                      id={`label-${index}`}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((entry, itemIndex) =>
                            itemIndex === index ? { ...entry, label: event.target.value } : entry
                          )
                        )
                      }
                      value={item.label}
                    />
                  </div>
                  <div className="field order-line-qty">
                    <label htmlFor={`quantity-${index}`}>Qta</label>
                    <input
                      id={`quantity-${index}`}
                      min={1}
                      onChange={(event) => {
                        const nextQuantity = Number.parseInt(event.target.value || "1", 10) || 1;

                        setItems((current) =>
                          current.map((entry, itemIndex) => {
                            if (itemIndex !== index) {
                              return entry;
                            }

                            const service = services.find((serviceEntry) => serviceEntry.id === entry.serviceCatalogId);

                            if (!service || entry.priceOverridden) {
                              return { ...entry, quantity: nextQuantity };
                            }

                            return {
                              ...entry,
                              quantity: nextQuantity,
                              unitPrice: getCatalogPriceDisplay(service, nextQuantity)
                            };
                          })
                        );
                      }}
                      type="number"
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
                    {item.serviceCatalogId
                      ? (() => {
                          const service = services.find((entry) => entry.id === item.serviceCatalogId);
                          if (!service?.quantityTiers) {
                            return null;
                          }

                          return <p className="hint order-line-tier-hint">Scaglioni: {service.quantityTiers}</p>;
                        })()
                      : null}
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
                  <div className="field order-line-final">
                    <label htmlFor={`finalPrice-${index}`}>Prezzo finale</label>
                    <input
                      disabled
                      id={`finalPrice-${index}`}
                      value={new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(lineFinalCents / 100)}
                    />
                  </div>
                  <div className="field order-line-format">
                    <label htmlFor={`format-${index}`}>Formato</label>
                    <input
                      id={`format-${index}`}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((entry, itemIndex) =>
                            itemIndex === index ? { ...entry, format: event.target.value } : entry
                          )
                        )
                      }
                      value={item.format}
                    />
                  </div>
                  <div className="field order-line-material">
                    <label htmlFor={`material-${index}`}>Materiale</label>
                    <input
                      id={`material-${index}`}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((entry, itemIndex) =>
                            itemIndex === index ? { ...entry, material: event.target.value } : entry
                          )
                        )
                      }
                      value={item.material}
                    />
                  </div>
                  <div className="field order-line-finishing">
                    <label htmlFor={`finishing-${index}`}>Finitura</label>
                    <input
                      id={`finishing-${index}`}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((entry, itemIndex) =>
                            itemIndex === index ? { ...entry, finishing: event.target.value } : entry
                          )
                        )
                      }
                      value={item.finishing}
                    />
                  </div>
                  <div className="field full order-line-notes">
                    <label htmlFor={`description-${index}`}>Note riga</label>
                    <textarea
                      id={`description-${index}`}
                      onChange={(event) =>
                        setItems((current) =>
                          current.map((entry, itemIndex) =>
                            itemIndex === index
                              ? { ...entry, description: event.target.value, notes: event.target.value }
                              : entry
                          )
                        )
                      }
                      value={item.description}
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
          Crea ordine
        </button>
      </div>
    </form>
  );
}
