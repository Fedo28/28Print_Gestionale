"use client";

import { InvoiceStatus, MainPhase, OperationalStatus } from "@prisma/client";
import { useEffect, useRef, useState } from "react";
import {
  quickUpdateOperationalStatusAction,
  quickUpdatePhaseAction,
  quickUpdateQuoteFlagAction
} from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { ReadyWhatsAppButton } from "@/components/ready-whatsapp-button";
import { mainPhaseLabels, normalizeMainPhaseForWorkflow, operationalStatusLabels } from "@/lib/constants";
import { canConvertOrderToQuote, getOrderToQuoteDisabledReason } from "@/lib/order-quote";
import { getSelectablePhaseTargets } from "@/lib/order-phase-transitions";

export type QuickOrderControlProps = {
  invoiceStatus?: InvoiceStatus;
  orderId: string;
  phase: MainPhase;
  status: OperationalStatus;
  hasWhatsapp?: boolean;
  readyWhatsappSentAt?: Date | string | null;
  showWhatsapp?: boolean;
  isQuote?: boolean;
  includeQuote?: boolean;
  align?: "start" | "end";
  mode?: "popover" | "inline";
  placement?: "above" | "below";
  showStatus?: boolean;
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
  invoiceStatus,
  orderId,
  phase,
  status,
  hasWhatsapp = false,
  readyWhatsappSentAt,
  showWhatsapp = true,
  isQuote = false,
  includeQuote = false,
  showStatus = true
}: Omit<QuickOrderControlProps, "align">) {
  const phaseFormRef = useRef<HTMLFormElement>(null);
  const statusFormRef = useRef<HTMLFormElement>(null);
  const visiblePhase = normalizeMainPhaseForWorkflow(phase);
  const selectablePhases = getSelectablePhaseTargets(phase);
  const quoteConversionState = invoiceStatus
    ? {
        canConvert: canConvertOrderToQuote({ isQuote, invoiceStatus, mainPhase: phase }),
        disabledReason: getOrderToQuoteDisabledReason({ isQuote, invoiceStatus, mainPhase: phase })
      }
    : null;

  return (
    <div className="quick-order-controls">
      <form action={quickUpdatePhaseAction} ref={phaseFormRef}>
        <input name="orderId" type="hidden" value={orderId} />
        <label className="quick-order-label" htmlFor={`quick-phase-${orderId}`}>
          Fase lavoro
        </label>
        <select
          aria-label="Fase ordine"
          className="quick-select"
          defaultValue={visiblePhase}
          id={`quick-phase-${orderId}`}
          name="nextPhase"
          onChange={() => phaseFormRef.current?.requestSubmit()}
        >
          {selectablePhases.map((value) => (
            <option key={value} value={value}>
              {mainPhaseLabels[value]}
            </option>
          ))}
        </select>
      </form>

      {showStatus ? (
        <form action={quickUpdateOperationalStatusAction} ref={statusFormRef}>
          <input name="orderId" type="hidden" value={orderId} />
          <label className="quick-order-label" htmlFor={`quick-status-${orderId}`}>
            Stato operativo
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
      ) : null}

      {includeQuote ? (
        quoteConversionState?.canConvert ? (
          <form action={quickUpdateQuoteFlagAction}>
            <input name="orderId" type="hidden" value={orderId} />
            <input name="isQuote" type="hidden" value="true" />
            <span className="quick-order-label">Tipo</span>
            <ConfirmSubmitButton
              className="button ghost quick-order-action-button"
              confirmMessage="Trasformare questo ordine in preventivo? Verra escluso dal flusso operativo finche non lo confermi di nuovo come ordine."
            >
              Trasforma in preventivo
            </ConfirmSubmitButton>
          </form>
        ) : quoteConversionState?.disabledReason ? (
          <div className="quick-order-status-card" role="note">
            <span className="quick-order-label">Tipo</span>
            <div className="quick-order-note">{quoteConversionState.disabledReason}</div>
          </div>
        ) : null
      ) : null}

      {showWhatsapp && phase === "SVILUPPO_COMPLETATO" ? (
        <div className="quick-order-actions">
          <ReadyWhatsAppButton hasPhone={hasWhatsapp} notifiedAt={readyWhatsappSentAt} orderId={orderId} />
        </div>
      ) : null}
    </div>
  );
}

export function QuickOrderControls({
  invoiceStatus,
  orderId,
  phase,
  status,
  hasWhatsapp = false,
  readyWhatsappSentAt,
  showWhatsapp = true,
  isQuote = false,
  includeQuote = false,
  align = "start",
  mode = "popover",
  placement = "below",
  showStatus = true
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
    <div className={`quick-order-menu quick-order-menu-${align} quick-order-menu-${mode} quick-order-menu-${placement}${isOpen ? " open" : ""}`} ref={menuRef}>
      <QuickOrderTriggerButton isOpen={isOpen} onClick={() => setIsOpen((current) => !current)} />
      {isOpen ? (
        <div className="quick-order-panel">
          <QuickOrderControlForms
            hasWhatsapp={hasWhatsapp}
            includeQuote={includeQuote}
            invoiceStatus={invoiceStatus}
            isQuote={isQuote}
            orderId={orderId}
            phase={phase}
            readyWhatsappSentAt={readyWhatsappSentAt}
            showWhatsapp={showWhatsapp}
            showStatus={showStatus}
            status={status}
          />
        </div>
      ) : null}
    </div>
  );
}
