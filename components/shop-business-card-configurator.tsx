"use client";

import { useMemo, useState } from "react";
import type { BusinessCardShopOption } from "@/lib/shop-business-cards";

type ShopBusinessCardConfiguratorProps = {
  options: BusinessCardShopOption[];
};

const currencyFormatter = new Intl.NumberFormat("it-IT", {
  currency: "EUR",
  style: "currency"
});

function formatPrice(cents: number) {
  return currencyFormatter.format(cents / 100);
}

function getFirstAvailableOption(options: BusinessCardShopOption[]) {
  return options.find((option) => option.available) || options[0] || null;
}

export function ShopBusinessCardConfigurator({ options }: ShopBusinessCardConfiguratorProps) {
  const firstOption = getFirstAvailableOption(options);
  const [selectedKey, setSelectedKey] = useState(firstOption?.key || "");
  const selectedOption = options.find((option) => option.key === selectedKey) || firstOption;
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

  function selectOption(option: BusinessCardShopOption) {
    if (!option.available) {
      return;
    }

    setSelectedKey(option.key);
    setSelectedQuantity(option.quantities[0]?.quantity || 0);
  }

  return (
    <section className="shop-business-card-layout" aria-label="Configuratore biglietti da visita">
      <div className="shop-business-card-visual">
        <div className="shop-business-card-photo-slot">
          <span>Foto prodotto</span>
        </div>

        <div className="shop-business-card-template">
          <span>Template file</span>
          <strong>In arrivo</strong>
        </div>
      </div>

      <div className="shop-business-card-config">
        <div className="shop-business-card-section">
          <h2>Finitura</h2>
          <div className="shop-business-card-option-grid">
            {options.map((option) => (
              <button
                className={`shop-business-card-option${selectedOption?.key === option.key ? " is-selected" : ""}`}
                disabled={!option.available}
                key={option.key}
                onClick={() => selectOption(option)}
                type="button"
              >
                <strong>{option.label}</strong>
                {option.quantities[0] ? <span>Da {formatPrice(option.quantities[0].priceCents)}</span> : <span>Da verificare</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="shop-business-card-section">
          <h2>Quantità</h2>
          <div className="shop-business-card-quantity-grid">
            {selectedOption?.quantities.map((quantity) => (
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

        <aside className="shop-business-card-summary" aria-label="Riepilogo biglietti da visita">
          <div>
            <span>Totale</span>
            <strong>{selectedQuantityOption ? formatPrice(selectedQuantityOption.priceCents) : "Da verificare"}</strong>
          </div>
          <div>
            <span>Scelta</span>
            <strong>
              {selectedOption?.label || "Biglietti da visita"}
              {selectedQuantityOption ? ` · ${selectedQuantityOption.quantity} pz` : ""}
            </strong>
          </div>
        </aside>
      </div>
    </section>
  );
}
