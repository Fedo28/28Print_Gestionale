"use client";

import { useMemo, useState } from "react";
import type { ShopCatalogProductPage } from "@/lib/shop-product-pages";

type ShopCatalogProductConfiguratorProps = {
  page: ShopCatalogProductPage;
};

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  currency: "EUR",
  style: "currency"
});

function formatPrice(cents: number) {
  return currencyFormatter.format(cents / 100);
}

export function ShopCatalogProductConfigurator({ page }: ShopCatalogProductConfiguratorProps) {
  const firstOption = page.options[0] || null;
  const [selectedId, setSelectedId] = useState(firstOption?.id || "");
  const selectedOption = page.options.find((option) => option.id === selectedId) || firstOption;
  const firstQuantity = selectedOption?.quantities[0]?.quantity || 0;
  const [selectedQuantity, setSelectedQuantity] = useState(firstQuantity);

  const selectedQuantityOption = useMemo(() => {
    if (!selectedOption) {
      return null;
    }

    return (
      selectedOption.quantities.find((quantity) => quantity.quantity === selectedQuantity) ||
      selectedOption.quantities[0] ||
      null
    );
  }, [selectedOption, selectedQuantity]);

  function selectOption(optionId: string) {
    const nextOption = page.options.find((option) => option.id === optionId);
    if (!nextOption) {
      return;
    }

    setSelectedId(nextOption.id);
    setSelectedQuantity(nextOption.quantities[0]?.quantity || 0);
  }

  return (
    <section className="shop-business-card-layout" aria-label={`Configuratore ${page.title}`}>
      <div className="shop-business-card-visual">
        <div className="shop-business-card-photo-slot">
          <span>Foto prodotto</span>
        </div>

        <div className="shop-business-card-template">
          <span>{page.templateLabel}</span>
          <strong>In arrivo</strong>
        </div>
      </div>

      <div className="shop-business-card-config">
        <div className="shop-business-card-section">
          <h2>Opzione</h2>
          {page.options.length ? (
            <div className="shop-business-card-option-grid">
              {page.options.map((option) => (
                <button
                  className={`shop-business-card-option${selectedOption?.id === option.id ? " is-selected" : ""}`}
                  key={option.id}
                  onClick={() => selectOption(option.id)}
                  type="button"
                >
                  <strong>{option.label}</strong>
                  {option.quantities[0] ? <span>Da {formatPrice(option.quantities[0].priceCents)}</span> : <span>Da verificare</span>}
                </button>
              ))}
            </div>
          ) : (
            <div className="shop-business-card-empty">Catalogo da completare.</div>
          )}
        </div>

        {selectedOption ? (
          <div className="shop-business-card-section">
            <h2>Quantità</h2>
            <div className="shop-business-card-quantity-grid">
              {selectedOption.quantities.map((quantity) => (
                <button
                  className={`shop-business-card-quantity${selectedQuantityOption?.quantity === quantity.quantity ? " is-selected" : ""}`}
                  key={quantity.quantity}
                  onClick={() => setSelectedQuantity(quantity.quantity)}
                  type="button"
                >
                  <strong>{quantity.quantity}</strong>
                  <span>{formatPrice(quantity.priceCents)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <aside className="shop-business-card-summary" aria-label={`Riepilogo ${page.title}`}>
          <div>
            <span>Totale</span>
            <strong>{selectedQuantityOption ? formatPrice(selectedQuantityOption.priceCents) : "Da verificare"}</strong>
          </div>
          <div>
            <span>Scelta</span>
            <strong>
              {selectedOption?.label || page.title}
              {selectedQuantityOption ? ` · ${selectedQuantityOption.quantity} pz` : ""}
            </strong>
          </div>
        </aside>
      </div>
    </section>
  );
}
