import Link from "next/link";
import { restoreOrderHistoryAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { UndoButtonContent } from "@/components/undo-button-content";
import { APP_TIMEZONE } from "@/lib/constants";
import { formatDate, formatDateKey, formatDateTime, formatWeekdayLabel } from "@/lib/format";
import type { ProjectRecentActivityEntry } from "@/lib/audit-log";

type ActivityCategoryFilter = "all" | "orders" | "customers" | "purchase" | "billboards" | "settings";
type ActivityActionFilter = "all" | "changes" | "deleted" | "restorable" | "invoices";

const categoryFilters: Array<{ key: ActivityCategoryFilter; label: string }> = [
  { key: "all", label: "Tutto" },
  { key: "orders", label: "Ordini" },
  { key: "customers", label: "Clienti" },
  { key: "purchase", label: "Da ordinare" },
  { key: "billboards", label: "Cartelloni" },
  { key: "settings", label: "Impostazioni" }
];

const actionFilters: Array<{ key: ActivityActionFilter; label: string }> = [
  { key: "all", label: "Tutte" },
  { key: "changes", label: "Modifiche" },
  { key: "deleted", label: "Eliminati" },
  { key: "restorable", label: "Ripristinabili" },
  { key: "invoices", label: "Fatture" }
];

function normalizeCategoryFilter(value?: string | string[] | null): ActivityCategoryFilter {
  const key = Array.isArray(value) ? value[0] : value;
  return categoryFilters.some((entry) => entry.key === key) ? (key as ActivityCategoryFilter) : "all";
}

function normalizeActionFilter(value?: string | string[] | null): ActivityActionFilter {
  const key = Array.isArray(value) ? value[0] : value;
  return actionFilters.some((entry) => entry.key === key) ? (key as ActivityActionFilter) : "all";
}

function getEntryCategoryFilter(entry: ProjectRecentActivityEntry): ActivityCategoryFilter {
  switch (entry.entityType) {
    case "ORDER":
      return "orders";
    case "CUSTOMER":
      return "customers";
    case "PURCHASE_NOTE":
      return "purchase";
    case "BILLBOARD_BOOKING":
      return "billboards";
    default:
      return "settings";
  }
}

function matchesActionFilter(entry: ProjectRecentActivityEntry, action: ActivityActionFilter) {
  if (action === "all") {
    return true;
  }

  if (action === "deleted") {
    return entry.actionType === "DELETED";
  }

  if (action === "restorable") {
    return entry.canRestore;
  }

  if (action === "invoices") {
    return entry.categoryLabel === "Fatturazione";
  }

  return entry.actionType !== "CREATED" && entry.actionType !== "DELETED";
}

function buildActivityHref(category: ActivityCategoryFilter, action: ActivityActionFilter) {
  const params = new URLSearchParams();

  if (category !== "all") {
    params.set("category", category);
  }

  if (action !== "all") {
    params.set("action", action);
  }

  const query = params.toString();
  return `/activity${query ? `?${query}` : ""}#activity-feed`;
}

function getActivityDayLabel(date: Date, todayKey: string, yesterdayKey: string) {
  const key = formatDateKey(date);

  if (key === todayKey) {
    return "Oggi";
  }

  if (key === yesterdayKey) {
    return "Ieri";
  }

  return `${formatWeekdayLabel(date)} ${formatDate(date)}`;
}

function groupActivityEntries(entries: ProjectRecentActivityEntry[]) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const todayKey = formatDateKey(today);
  const yesterdayKey = formatDateKey(yesterday);
  const groups = new Map<string, { label: string; entries: ProjectRecentActivityEntry[] }>();

  entries.forEach((entry) => {
    const key = formatDateKey(entry.createdAt);
    const currentGroup = groups.get(key);

    if (currentGroup) {
      currentGroup.entries.push(entry);
      return;
    }

    groups.set(key, {
      label: getActivityDayLabel(entry.createdAt, todayKey, yesterdayKey),
      entries: [entry]
    });
  });

  return Array.from(groups.entries()).map(([key, group]) => ({ key, ...group }));
}

function formatActivityTime(date: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE
  }).format(date);
}

function getActivityToneClass(entry: ProjectRecentActivityEntry) {
  if (entry.actionType === "DELETED") {
    return "is-danger";
  }

  if (entry.canRestore) {
    return "is-restorable";
  }

  if (entry.categoryLabel === "Fatturazione") {
    return "is-invoice";
  }

  return "is-neutral";
}

function getFilterCount(
  entries: ProjectRecentActivityEntry[],
  category: ActivityCategoryFilter,
  action: ActivityActionFilter
) {
  return entries.filter((entry) => {
    const matchesCategory = category === "all" || getEntryCategoryFilter(entry) === category;
    return matchesCategory && matchesActionFilter(entry, action);
  }).length;
}

export function ProjectRecentActivity({
  activeAction,
  activeCategory,
  deletedCount = 0,
  deletedRestorableCount = 0,
  entries,
  returnTo
}: {
  activeAction?: string | string[] | null;
  activeCategory?: string | string[] | null;
  deletedCount?: number;
  deletedRestorableCount?: number;
  entries: ProjectRecentActivityEntry[];
  returnTo: string;
}) {
  const selectedCategory = normalizeCategoryFilter(activeCategory);
  const selectedAction = normalizeActionFilter(activeAction);
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 7);
  const todayKey = formatDateKey(now);
  const todayCount = entries.filter((entry) => formatDateKey(entry.createdAt) === todayKey).length;
  const weekCount = entries.filter((entry) => entry.createdAt >= weekStart).length;
  const restorableCount = entries.filter((entry) => entry.canRestore).length + deletedRestorableCount;
  const filteredEntries = entries.filter((entry) => {
    const matchesCategory = selectedCategory === "all" || getEntryCategoryFilter(entry) === selectedCategory;
    return matchesCategory && matchesActionFilter(entry, selectedAction);
  });
  const groupedEntries = groupActivityEntries(filteredEntries);
  const currentReturnTo = buildActivityHref(selectedCategory, selectedAction) || returnTo;

  return (
    <div className="stack project-activity-workspace">
      <section className="activity-signal-grid" aria-label="Riepilogo attività">
        <article className="activity-signal is-blue">
          <span>Oggi</span>
          <strong>{todayCount}</strong>
        </article>
        <article className="activity-signal is-cyan">
          <span>7 giorni</span>
          <strong>{weekCount}</strong>
        </article>
        <article className="activity-signal is-red">
          <span>Eliminati</span>
          <strong>{deletedCount}</strong>
        </article>
        <article className="activity-signal is-lime">
          <span>Ripristinabili</span>
          <strong>{restorableCount}</strong>
        </article>
      </section>

      <nav className="activity-mode-tabs" aria-label="Archivio attività">
        <Link className="activity-mode-tab is-active" href={buildActivityHref("all", "all")}>
          Modifiche
        </Link>
        <Link className="activity-mode-tab" href="/activity/trash#activity-trash-feed">
          Cestino <span>{deletedCount}</span>
        </Link>
      </nav>

      <section className="activity-filter-panel" aria-label="Filtri attività">
        <div className="activity-filter-block">
          <span>Area</span>
          <div className="activity-filter-row">
            {categoryFilters.map((filter) => (
              <Link
                aria-current={selectedCategory === filter.key ? "page" : undefined}
                className={selectedCategory === filter.key ? "activity-filter-chip is-active" : "activity-filter-chip"}
                href={buildActivityHref(filter.key, selectedAction)}
                key={filter.key}
              >
                {filter.label}
                <small>{getFilterCount(entries, filter.key, selectedAction)}</small>
              </Link>
            ))}
          </div>
        </div>

        <div className="activity-filter-block">
          <span>Tipo</span>
          <div className="activity-filter-row">
            {actionFilters.map((filter) => (
              <Link
                aria-current={selectedAction === filter.key ? "page" : undefined}
                className={selectedAction === filter.key ? "activity-filter-chip is-active" : "activity-filter-chip"}
                href={buildActivityHref(selectedCategory, filter.key)}
                key={filter.key}
              >
                {filter.label}
                <small>{getFilterCount(entries, selectedCategory, filter.key)}</small>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="stack activity-timeline">
        {groupedEntries.length === 0 ? (
          <div className="empty activity-empty-state">Nessuna attività in questa vista.</div>
        ) : (
          groupedEntries.map((group) => (
            <section className="activity-day-group" key={group.key}>
              <div className="activity-day-label">
                <span>{group.label}</span>
                <small>{group.entries.length}</small>
              </div>

              <div className="stack activity-day-list">
                {group.entries.map((entry) => (
                  <article className={`activity-timeline-item ${getActivityToneClass(entry)}`} key={entry.id}>
                    <div className="activity-row-kind">
                      <span className="activity-kind-pill">{entry.categoryLabel}</span>
                      <time dateTime={entry.createdAt.toISOString()}>{formatActivityTime(entry.createdAt)}</time>
                    </div>

                    <div className="activity-row-object">
                      <strong>
                        <Link className="project-activity-link" href={entry.href} prefetch={false}>
                          {entry.entityLabel}
                        </Link>
                      </strong>
                      {entry.actorLabel ? <span>{entry.actorLabel}</span> : null}
                    </div>

                    <div className="activity-row-change">
                      <strong>{entry.summary}</strong>
                      {entry.details ? <span>{entry.details}</span> : null}
                    </div>

                    <div className="project-activity-actions">
                      <Link className="compact-link activity-open-link" href={entry.href} prefetch={false}>
                        Apri
                      </Link>
                      {entry.source === "order" && entry.canRestore && entry.restoreOrderId && entry.restoreHistoryId ? (
                        <form action={restoreOrderHistoryAction} className="timeline-restore-form">
                          <input name="orderId" type="hidden" value={entry.restoreOrderId} />
                          <input name="historyId" type="hidden" value={entry.restoreHistoryId} />
                          <input name="returnTo" type="hidden" value={currentReturnTo} />
                          <ConfirmSubmitButton
                            className="button ghost timeline-restore-button"
                            confirmMessage="Vuoi ripristinare questo stato precedente?"
                          >
                            <UndoButtonContent label="Annulla" />
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

      <div className="activity-last-sync">
        <span>Ultimo evento</span>
        <strong>{entries[0] ? formatDateTime(entries[0].createdAt) : "-"}</strong>
      </div>
    </div>
  );
}
