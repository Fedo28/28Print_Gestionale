"use client";

import type { InvoiceStatus, MainPhase, OperationalStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  bulkUpdateOrdersInvoiceStatusAction,
  bulkUpdateOrdersOperationalStatusAction,
  bulkUpdateOrdersPhaseAction
} from "@/app/actions";
import { invoiceStatusLabels, mainPhaseLabels, operationalStatusLabels, visibleMainPhases } from "@/lib/constants";

type FeedbackState =
  | {
      tone: "success" | "error";
      message: string;
    }
  | null;

export function OrdersBulkToolbar({
  selectedOrderIds,
  onClearSelection
}: {
  selectedOrderIds: string[];
  onClearSelection: () => void;
}) {
  const router = useRouter();
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus | "">("");
  const [phase, setPhase] = useState<MainPhase | "">("");
  const [operationalStatus, setOperationalStatus] = useState<OperationalStatus | "">("");
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isPending, startTransition] = useTransition();

  if (selectedOrderIds.length === 0) {
    return null;
  }

  function handleSuccess(message: string, updatedCount: number) {
    setFeedback({
      tone: "success",
      message
    });
    if (updatedCount > 0) {
      onClearSelection();
    }
    router.refresh();
  }

  function handleFailure(error: unknown, fallback: string) {
    setFeedback({
      tone: "error",
      message: error instanceof Error && error.message.trim() ? error.message : fallback
    });
  }

  function runInvoiceAction() {
    if (!invoiceStatus) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await bulkUpdateOrdersInvoiceStatusAction({
          orderIds: selectedOrderIds,
          nextInvoiceStatus: invoiceStatus
        });
        handleSuccess(result.message, result.updatedCount);
      } catch (error) {
        handleFailure(error, "Impossibile aggiornare la fatturazione in blocco.");
      }
    });
  }

  function runPhaseAction() {
    if (!phase) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await bulkUpdateOrdersPhaseAction({
          orderIds: selectedOrderIds,
          nextPhase: phase
        });
        handleSuccess(result.message, result.updatedCount);
      } catch (error) {
        handleFailure(error, "Impossibile aggiornare la fase in blocco.");
      }
    });
  }

  function runOperationalStatusAction() {
    if (!operationalStatus) {
      return;
    }

    startTransition(async () => {
      try {
        const result = await bulkUpdateOrdersOperationalStatusAction({
          orderIds: selectedOrderIds,
          operationalStatus
        });
        handleSuccess(result.message, result.updatedCount);
      } catch (error) {
        handleFailure(error, "Impossibile aggiornare lo stato operativo in blocco.");
      }
    });
  }

  return (
    <section className="orders-bulk-toolbar" aria-label="Azioni massive ordini">
      <div className="orders-bulk-toolbar-head">
        <div className="orders-bulk-toolbar-copy">
          <strong>{selectedOrderIds.length} ordini selezionati</strong>
          <span className="subtle">Applica un cambio unico e poi aggiorno subito la lista.</span>
        </div>
        <button className="button ghost" disabled={isPending} onClick={onClearSelection} type="button">
          Deseleziona
        </button>
      </div>

      <div className="orders-bulk-toolbar-grid">
        <div className="orders-bulk-control">
          <label htmlFor="bulk-invoice-status">Fatturazione</label>
          <div className="orders-bulk-control-row">
            <select
              disabled={isPending}
              id="bulk-invoice-status"
              onChange={(event) => setInvoiceStatus(event.target.value as InvoiceStatus | "")}
              value={invoiceStatus}
            >
              <option value="">Scegli stato fattura</option>
              {Object.entries(invoiceStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button className="button secondary" disabled={!invoiceStatus || isPending} onClick={runInvoiceAction} type="button">
              Applica
            </button>
          </div>
        </div>

        <div className="orders-bulk-control">
          <label htmlFor="bulk-order-phase">Fase lavoro</label>
          <div className="orders-bulk-control-row">
            <select disabled={isPending} id="bulk-order-phase" onChange={(event) => setPhase(event.target.value as MainPhase | "")} value={phase}>
              <option value="">Scegli fase</option>
              {visibleMainPhases.map((value) => (
                <option key={value} value={value}>
                  {mainPhaseLabels[value]}
                </option>
              ))}
            </select>
            <button className="button secondary" disabled={!phase || isPending} onClick={runPhaseAction} type="button">
              Applica
            </button>
          </div>
        </div>

        <div className="orders-bulk-control">
          <label htmlFor="bulk-order-status">Stato operativo</label>
          <div className="orders-bulk-control-row">
            <select
              disabled={isPending}
              id="bulk-order-status"
              onChange={(event) => setOperationalStatus(event.target.value as OperationalStatus | "")}
              value={operationalStatus}
            >
              <option value="">Scegli stato</option>
              {Object.entries(operationalStatusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button
              className="button secondary"
              disabled={!operationalStatus || isPending}
              onClick={runOperationalStatusAction}
              type="button"
            >
              Applica
            </button>
          </div>
        </div>
      </div>

      {feedback ? (
        <div className={`orders-bulk-feedback${feedback.tone === "success" ? " is-success" : " is-error"}`}>
          {feedback.message}
        </div>
      ) : null}
    </section>
  );
}
