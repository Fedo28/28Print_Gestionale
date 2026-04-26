"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

type PrintBrand = "28-print" | "pr-adv";

function buildPrintHref(orderId: string, brand: PrintBrand) {
  return `/orders/${orderId}/print?autoprint=1&brand=${brand}`;
}

export function OrderPrintBrandMenu({ orderId }: { orderId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className={`print-brand-menu${isOpen ? " open" : ""}`} ref={menuRef}>
      <button
        aria-controls={panelId}
        aria-expanded={isOpen}
        className={`button ghost print-brand-trigger${isOpen ? " active" : ""}`}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        Stampa
      </button>
      {isOpen ? (
        <div aria-label="Scelta logo per la stampa" className="print-brand-panel" id={panelId} role="menu">
          <span className="print-brand-panel-title">Scegli logo</span>
          <Link
            className="print-brand-option"
            href={buildPrintHref(orderId, "28-print")}
            onClick={() => setIsOpen(false)}
            prefetch={false}
            rel="noreferrer"
            role="menuitem"
            target="_blank"
          >
            <strong>28 Print</strong>
            <span>Usa il logo standard gia salvato</span>
          </Link>
          <Link
            className="print-brand-option"
            href={buildPrintHref(orderId, "pr-adv")}
            onClick={() => setIsOpen(false)}
            prefetch={false}
            rel="noreferrer"
            role="menuitem"
            target="_blank"
          >
            <strong>PR adv</strong>
            <span>Usa il logo allegato PR adv</span>
          </Link>
        </div>
      ) : null}
    </div>
  );
}
