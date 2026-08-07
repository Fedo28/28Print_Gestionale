import Link from "next/link";
import { restoreOrderHistoryAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { UndoButtonContent } from "@/components/undo-button-content";
import { formatDateTime } from "@/lib/format";
import type { RecentOrderHistoryEntry } from "@/lib/orders";

function getRestoreLabel(entry: RecentOrderHistoryEntry) {
  if (entry.snapshotKind === "order-invoice-status") {
    return "Annulla cambio";
  }

  if (entry.snapshotKind === "order-status") {
    return "Ripristina stato";
  }

  if (entry.snapshotKind === "order-payments") {
    return "Ripristina movimenti";
  }

  return "Ripristina";
}

function RecentOrderActivityList({
  entries,
  emptyMessage,
  returnTo
}: {
  entries: RecentOrderHistoryEntry[];
  emptyMessage: string;
  returnTo: string;
}) {
  if (entries.length === 0) {
    return <div className="empty">{emptyMessage}</div>;
  }

  return (
    <div className="stack orders-recent-activity-list">
      {entries.map((entry) => (
        <article className="mini-item orders-recent-activity-item" key={entry.id}>
          <div className="orders-recent-activity-top">
            <div className="orders-recent-activity-copy">
              <div className="orders-recent-activity-badges">
                <span className="pill">{entry.categoryLabel}</span>
                <span className="subtle">{formatDateTime(entry.createdAt)}</span>
              </div>
              <strong>
                <Link className="orders-recent-activity-link" href={`${entry.href}#order-history-panel`} prefetch={false}>
                  {entry.orderLabel}
                </Link>
              </strong>
              <div className="subtle">
                {entry.customerName}
                {entry.customerContact ? ` • ${entry.customerContact}` : ""}
              </div>
            </div>
          </div>

          <div className="stack orders-recent-activity-summary">
            <strong>{entry.summary}</strong>
            {entry.description !== entry.summary ? <div className="subtle">{entry.description}</div> : null}
          </div>

          <div className="orders-recent-activity-actions">
            <Link className="compact-link" href={`${entry.href}#order-history-panel`} prefetch={false}>
              Apri ordine
            </Link>
            {entry.canRestore ? (
              <form action={restoreOrderHistoryAction} className="timeline-restore-form">
                <input name="orderId" type="hidden" value={entry.orderId} />
                <input name="historyId" type="hidden" value={entry.id} />
                <input name="returnTo" type="hidden" value={returnTo} />
                <ConfirmSubmitButton
                  className="button ghost timeline-restore-button"
                  confirmMessage="Vuoi ripristinare questo stato precedente?"
                >
                  <UndoButtonContent label={getRestoreLabel(entry)} />
                </ConfirmSubmitButton>
              </form>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

export function OrdersRecentActivity({
  recentInvoiceChanges,
  recentChanges,
  returnTo
}: {
  recentInvoiceChanges: RecentOrderHistoryEntry[];
  recentChanges: RecentOrderHistoryEntry[];
  returnTo: string;
}) {
  return (
    <section className="grid grid-2 orders-recent-activity-grid" id="orders-recent-activity">
      <article className="card card-pad orders-recent-activity-card">
        <div className="list-header">
          <div>
            <h3>Ultimi cambi fatturazione</h3>
          </div>
        </div>
        <RecentOrderActivityList
          emptyMessage="Nessun cambio fatturazione recente."
          entries={recentInvoiceChanges}
          returnTo={returnTo}
        />
      </article>

      <article className="card card-pad orders-recent-activity-card">
        <div className="list-header">
          <div>
            <h3>Ultime modifiche ordini</h3>
          </div>
        </div>
        <RecentOrderActivityList
          emptyMessage="Nessun'altra modifica recente."
          entries={recentChanges}
          returnTo={returnTo}
        />
      </article>
    </section>
  );
}
