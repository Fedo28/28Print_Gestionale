import Link from "next/link";
import { restoreOrderHistoryAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { UndoButtonContent } from "@/components/undo-button-content";
import { APP_TIMEZONE } from "@/lib/constants";
import { formatDate, formatDateKey, formatWeekdayLabel } from "@/lib/format";
import type { RecentOrderHistoryEntry } from "@/lib/orders";

type OrderHistoryFilter = "all" | "invoice" | "status" | "lines" | "cash" | "materials" | "customer" | "restorable";

const orderHistoryFilters: Array<{ key: OrderHistoryFilter; label: string }> = [
  { key: "all", label: "Tutto" },
  { key: "invoice", label: "Fatture" },
  { key: "status", label: "Stato" },
  { key: "lines", label: "Righe" },
  { key: "cash", label: "Incassi" },
  { key: "materials", label: "Materiali" },
  { key: "customer", label: "Cliente" },
  { key: "restorable", label: "Annullabili" }
];

function normalizeOrderHistoryFilter(value?: string | string[] | null): OrderHistoryFilter {
  const key = Array.isArray(value) ? value[0] : value;
  return orderHistoryFilters.some((entry) => entry.key === key) ? (key as OrderHistoryFilter) : "all";
}

function buildOrderHistoryHref(filter: OrderHistoryFilter) {
  return `/orders/activity${filter === "all" ? "" : `?type=${filter}`}#orders-recent-activity`;
}

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

function getOrderHistoryFilterKey(entry: RecentOrderHistoryEntry): OrderHistoryFilter | "other" {
  if (entry.snapshotKind === "order-invoice-status") {
    return "invoice";
  }

  if (entry.snapshotKind === "order-status") {
    return "status";
  }

  if (entry.snapshotKind === "order-item" || entry.snapshotKind === "order-item-created") {
    return "lines";
  }

  if (entry.snapshotKind === "order-payments" || entry.snapshotKind === "order-financial-adjustments") {
    return "cash";
  }

  if (entry.snapshotKind === "order-material-note") {
    return "materials";
  }

  if (entry.snapshotKind === "order-customer" || entry.snapshotKind === "order-linked-customer") {
    return "customer";
  }

  return "other";
}

function matchesOrderHistoryFilter(entry: RecentOrderHistoryEntry, filter: OrderHistoryFilter) {
  if (filter === "all") {
    return true;
  }

  if (filter === "restorable") {
    return entry.canRestore;
  }

  return getOrderHistoryFilterKey(entry) === filter;
}

function getOrderHistoryFilterCount(entries: RecentOrderHistoryEntry[], filter: OrderHistoryFilter) {
  return entries.filter((entry) => matchesOrderHistoryFilter(entry, filter)).length;
}

function getOrderHistoryDayLabel(date: Date, todayKey: string, yesterdayKey: string) {
  const key = formatDateKey(date);

  if (key === todayKey) {
    return "Oggi";
  }

  if (key === yesterdayKey) {
    return "Ieri";
  }

  return `${formatWeekdayLabel(date)} ${formatDate(date)}`;
}

function groupOrderHistoryEntries(entries: RecentOrderHistoryEntry[]) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const todayKey = formatDateKey(today);
  const yesterdayKey = formatDateKey(yesterday);
  const groups = new Map<string, { label: string; entries: RecentOrderHistoryEntry[] }>();

  entries.forEach((entry) => {
    const key = formatDateKey(entry.createdAt);
    const currentGroup = groups.get(key);

    if (currentGroup) {
      currentGroup.entries.push(entry);
      return;
    }

    groups.set(key, {
      label: getOrderHistoryDayLabel(entry.createdAt, todayKey, yesterdayKey),
      entries: [entry]
    });
  });

  return Array.from(groups.entries()).map(([key, group]) => ({ key, ...group }));
}

function formatOrderHistoryTime(date: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE
  }).format(date);
}

function getOrderHistoryToneClass(entry: RecentOrderHistoryEntry) {
  if (entry.snapshotKind === "order-invoice-status") {
    return "is-invoice";
  }

  if (entry.canRestore) {
    return "is-restorable";
  }

  if (entry.snapshotKind === "order-status") {
    return "is-status";
  }

  return "is-neutral";
}

function getMergedOrderEntries(
  recentInvoiceChanges: RecentOrderHistoryEntry[],
  recentChanges: RecentOrderHistoryEntry[]
) {
  const entries = new Map<string, RecentOrderHistoryEntry>();

  [...recentInvoiceChanges, ...recentChanges].forEach((entry) => {
    entries.set(entry.id, entry);
  });

  return Array.from(entries.values()).sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
}

export function OrdersRecentActivity({
  activeType,
  recentInvoiceChanges,
  recentChanges,
  returnTo
}: {
  activeType?: string | string[] | null;
  recentInvoiceChanges: RecentOrderHistoryEntry[];
  recentChanges: RecentOrderHistoryEntry[];
  returnTo: string;
}) {
  const selectedType = normalizeOrderHistoryFilter(activeType);
  const entries = getMergedOrderEntries(recentInvoiceChanges, recentChanges);
  const filteredEntries = entries.filter((entry) => matchesOrderHistoryFilter(entry, selectedType));
  const groupedEntries = groupOrderHistoryEntries(filteredEntries);
  const invoiceCount = getOrderHistoryFilterCount(entries, "invoice");
  const restorableCount = getOrderHistoryFilterCount(entries, "restorable");
  const statusCount = getOrderHistoryFilterCount(entries, "status");
  const linesCount = getOrderHistoryFilterCount(entries, "lines");
  const currentReturnTo = buildOrderHistoryHref(selectedType) || returnTo;

  return (
    <section className="card card-pad orders-history-card" id="orders-recent-activity">
      <div className="stack orders-history-workspace">
        <section className="orders-history-signal-grid" aria-label="Riepilogo cronologia ordini">
          <article className="orders-history-signal is-cyan">
            <span>Fatture</span>
            <strong>{invoiceCount}</strong>
          </article>
          <article className="orders-history-signal is-lime">
            <span>Annullabili</span>
            <strong>{restorableCount}</strong>
          </article>
          <article className="orders-history-signal is-blue">
            <span>Stati</span>
            <strong>{statusCount}</strong>
          </article>
          <article className="orders-history-signal is-red">
            <span>Righe</span>
            <strong>{linesCount}</strong>
          </article>
        </section>

        <nav className="orders-history-filters" aria-label="Filtri cronologia ordini">
          {orderHistoryFilters.map((filter) => (
            <Link
              aria-current={selectedType === filter.key ? "page" : undefined}
              className={selectedType === filter.key ? "orders-history-filter is-active" : "orders-history-filter"}
              href={buildOrderHistoryHref(filter.key)}
              key={filter.key}
            >
              {filter.label}
              <small>{getOrderHistoryFilterCount(entries, filter.key)}</small>
            </Link>
          ))}
        </nav>

        <div className="stack orders-history-timeline">
          {groupedEntries.length === 0 ? (
            <div className="empty orders-history-empty">Nessuna modifica in questa vista.</div>
          ) : (
            groupedEntries.map((group) => (
              <section className="orders-history-day-group" key={group.key}>
                <div className="orders-history-day-label">
                  <span>{group.label}</span>
                  <small>{group.entries.length}</small>
                </div>

                <div className="stack orders-history-day-list">
                  {group.entries.map((entry) => (
                    <article className={`orders-history-row ${getOrderHistoryToneClass(entry)}`} key={entry.id}>
                      <div className="orders-history-kind">
                        <span>{entry.categoryLabel}</span>
                        <time dateTime={entry.createdAt.toISOString()}>{formatOrderHistoryTime(entry.createdAt)}</time>
                      </div>

                      <div className="orders-history-order">
                        <strong>
                          <Link className="orders-recent-activity-link" href={`${entry.href}#order-history-panel`} prefetch={false}>
                            {entry.orderLabel}
                          </Link>
                        </strong>
                        <span>
                          {entry.customerName}
                          {entry.customerContact ? ` • ${entry.customerContact}` : ""}
                        </span>
                      </div>

                      <div className="orders-history-change">
                        <strong>{entry.summary}</strong>
                        {entry.description !== entry.summary ? <span>{entry.description}</span> : null}
                      </div>

                      <div className="orders-recent-activity-actions">
                        <Link className="compact-link orders-history-open-link" href={`${entry.href}#order-history-panel`} prefetch={false}>
                          Apri
                        </Link>
                        {entry.canRestore ? (
                          <form action={restoreOrderHistoryAction} className="timeline-restore-form">
                            <input name="orderId" type="hidden" value={entry.orderId} />
                            <input name="historyId" type="hidden" value={entry.id} />
                            <input name="returnTo" type="hidden" value={currentReturnTo} />
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
              </section>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
