"use client";

import { Customer, ServiceCatalog } from "@prisma/client";
import { useState } from "react";
import { invoiceStatusLabels, priorityLabels } from "@/lib/constants";

type CustomerWithOrders = Customer & { orders: { id: string }[] };

type ItemState = {
  label: string;
  description: string;
  quantity: number;
  unitPrice: string;
  format: string;
  material: string;
  finishing: string;
  notes: string;
  serviceCatalogId: string;
};

const emptyItem = (): ItemState => ({
  label: "",
  description: "",
  quantity: 1,
  unitPrice: "",
  format: "",
  material: "",
  finishing: "",
  notes: "",
  serviceCatalogId: ""
});

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

  const itemsPayload = JSON.stringify(
    items
      .map((item) => {
        const normalizedPrice = item.unitPrice.replace(/\./g, "").replace(",", ".");
        const unitPriceCents = normalizedPrice ? Math.round(Number(normalizedPrice) * 100) : 0;
        const service = services.find((entry) => entry.id === item.serviceCatalogId);

        return {
          ...item,
          label: item.label || service?.name || "",
          serviceCatalogId: item.serviceCatalogId || undefined,
          unitPriceCents
        };
      })
      .filter((item) => item.label.trim())
  );
  const previewTotalCents = items.reduce((sum, item) => {
    const normalizedPrice = item.unitPrice.replace(/\./g, "").replace(",", ".");
    const unitPriceCents = normalizedPrice ? Math.round(Number(normalizedPrice) * 100) : 0;
    return sum + (Number.isFinite(unitPriceCents) ? unitPriceCents : 0) * Math.max(1, item.quantity || 1);
  }, 0);

  return (
    <form action={action} className="stack">
      <div className="grid grid-2">
        <section className="card card-pad">
          <div className="stack">
            <div>
              <h3>Cliente</h3>
              <p className="card-muted">Seleziona un cliente esistente o creane uno nuovo nello stesso form.</p>
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

        <section className="card card-pad">
          <div className="stack">
            <div>
              <h3>Dati ordine</h3>
              <p className="card-muted">Il codice ordine verra creato come YYYY-MM-DD_titolo dell'ordine.</p>
            </div>
            <div className="form-grid">
              <div className="field full">
                <label htmlFor="title">Titolo ordine</label>
                <input id="title" name="title" placeholder="Biglietti visita Rossi" required />
              </div>
              <div className="field wide">
                <label htmlFor="deliveryAt">Consegna prevista</label>
                <input id="deliveryAt" name="deliveryAt" required type="datetime-local" />
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
                <label htmlFor="notes">Note operative</label>
                <textarea id="notes" name="notes" />
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="card card-pad">
        <div className="list-header">
          <div>
            <h3>Righe ordine</h3>
            <p className="card-muted">Catalogo e lavorazioni personalizzate nello stesso ordine.</p>
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

        <div className="stack">
          {items.map((item, index) => (
            <article className="mini-item" key={index}>
              <div className="list-header">
                <strong>Riga {index + 1}</strong>
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
              <div className="form-grid">
                <div className="field wide">
                  <label htmlFor={`service-${index}`}>Servizio catalogo</label>
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
                                label: entry.label || service?.name || entry.label,
                                unitPrice:
                                  entry.unitPrice ||
                                  (service ? (service.basePriceCents / 100).toFixed(2).replace(".", ",") : "")
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
                <div className="field wide">
                  <label htmlFor={`label-${index}`}>Etichetta</label>
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
                <div className="field">
                  <label htmlFor={`quantity-${index}`}>Quantita</label>
                  <input
                    id={`quantity-${index}`}
                    min={1}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((entry, itemIndex) =>
                          itemIndex === index
                            ? { ...entry, quantity: Number.parseInt(event.target.value || "1", 10) || 1 }
                            : entry
                        )
                      )
                    }
                    type="number"
                    value={item.quantity}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`unitPrice-${index}`}>Prezzo unitario</label>
                  <input
                    id={`unitPrice-${index}`}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((entry, itemIndex) =>
                          itemIndex === index ? { ...entry, unitPrice: event.target.value } : entry
                        )
                      )
                    }
                    placeholder="0,00"
                    value={item.unitPrice}
                  />
                </div>
                <div className="field">
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
                <div className="field">
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
                <div className="field">
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
                <div className="field full">
                  <label htmlFor={`description-${index}`}>Descrizione / note riga</label>
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
          ))}
        </div>
        <div className="list-header">
          <span className="card-muted">Totale anteprima</span>
          <strong>{new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(previewTotalCents / 100)}</strong>
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
