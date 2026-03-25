"use client";

import { MainPhase, OperationalStatus } from "@prisma/client";
import { useEffect, useRef, useState } from "react";
import {
  quickUpdateOperationalStatusAction,
  quickUpdatePhaseAction,
  quickUpdateQuoteFlagAction
} from "@/app/actions";
import { ReadyWhatsAppButton } from "@/components/ready-whatsapp-button";
import { mainPhaseLabels, operationalStatusLabels } from "@/lib/constants";

export type QuickOrderControlProps = {
  orderId: string;
  phase: MainPhase;
  status: OperationalStatus;
  hasWhatsapp?: boolean;
  isQuote?: boolean;
  includeQuote?: boolean;
  align?: "start" | "end";
};

export function QuickOrderTriggerButton({
  isOpen = false,
  onClick,
  ariaControls
}: {
  isOpen?: boolean;
  onClick?: () => void;
  ariaControls?: string;
}) {
  return (
    <button
      aria-controls={ariaControls}
      aria-expanded={isOpen}
      aria-label="Apri azioni ordine"
      className={`quick-order-trigger${isOpen ? " active" : ""}`}
      onClick={onClick}
      type="button"
    >
      <svg aria-hidden="true" className="glyph" viewBox="0 0 24 24">
        <rect x="4" y="5" width="16" height="3.2" rx="1.6" fill="currentColor" />
        <rect x="4" y="10.4" width="16" height="3.2" rx="1.6" fill="currentColor" />
        <rect x="4" y="15.8" width="16" height="3.2" rx="1.6" fill="currentColor" />
      </svg>
    </button>
  );
}

export function QuickOrderControlForms({
  orderId,
  phase,
  status,
  hasWhatsapp = false,
  isQuote = false,
  includeQuote = false
}: Omit<QuickOrderControlProps, "align">) {
  const phaseFormRef = useRef<HTMLFormElement>(null);
  const statusFormRef = useRef<HTMLFormElement>(null);
  const quoteFormRef = useRef<HTMLFormElement>(null);

  return (
    <div className="quick-order-controls">
      <form action={quickUpdatePhaseAction} ref={phaseFormRef}>
        <input name="orderId" type="hidden" value={orderId} />
        <label className="quick-order-label" htmlFor={`quick-phase-${orderId}`}>
          Fase
        </label>
        <select
          aria-label="Fase ordine"
          className="quick-select"
          defaultValue={phase}
          id={`quick-phase-${orderId}`}
          name="nextPhase"
          onChange={() => phaseFormRef.current?.requestSubmit()}
        >
          {Object.entries(mainPhaseLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </form>

      <form action={quickUpdateOperationalStatusAction} ref={statusFormRef}>
        <input name="orderId" type="hidden" value={orderId} />
        <label className="quick-order-label" htmlFor={`quick-status-${orderId}`}>
          Stato
        </label>
        <select
          aria-label="Stato operativo"
          className="quick-select"
          defaultValue={status}
          id={`quick-status-${orderId}`}
          name="operationalStatus"
          onChange={() => statusFormRef.current?.requestSubmit()}
        >
          {Object.entries(operationalStatusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </form>

      {includeQuote ? (
        <form action={quickUpdateQuoteFlagAction} ref={quoteFormRef}>
          <input name="orderId" type="hidden" value={orderId} />
          <label className="quick-order-label" htmlFor={`quick-quote-${orderId}`}>
            Tipo
          </label>
          <select
            aria-label="Tipo ordine"
            className="quick-select"
            defaultValue={isQuote ? "true" : "false"}
            id={`quick-quote-${orderId}`}
            name="isQuote"
            onChange={() => quoteFormRef.current?.requestSubmit()}
          >
            <option value="false">Ordine</option>
            <option value="true">Preventivo</option>
          </select>
        </form>
      ) : null}

      {phase === "SVILUPPO_COMPLETATO" ? (
        <div className="quick-order-actions">
          <ReadyWhatsAppButton hasPhone={hasWhatsapp} orderId={orderId} />
        </div>
      ) : null}
    </div>
  );
}

export function QuickOrderControls({
  orderId,
  phase,
  status,
  hasWhatsapp = false,
  isQuote = false,
  includeQuote = false,
  align = "start"
}: QuickOrderControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
    <div className={`quick-order-menu quick-order-menu-${align}${isOpen ? " open" : ""}`} ref={menuRef}>
      <QuickOrderTriggerButton isOpen={isOpen} onClick={() => setIsOpen((current) => !current)} />
      {isOpen ? (
        <div className="quick-order-panel">
          <QuickOrderControlForms
            hasWhatsapp={hasWhatsapp}
            includeQuote={includeQuote}
            isQuote={isQuote}
            orderId={orderId}
            phase={phase}
            status={status}
          />
        </div>
      ) : null}
    </div>
  );
}
