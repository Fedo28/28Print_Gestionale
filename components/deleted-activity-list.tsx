import Link from "next/link";
import { restoreDeletedAuditEntryAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { APP_TIMEZONE } from "@/lib/constants";
import { formatDate, formatDateKey, formatWeekdayLabel } from "@/lib/format";
import type { DeletedEntityEntry } from "@/lib/audit-log";

function getDeletedActivityDayLabel(date: Date, todayKey: string, yesterdayKey: string) {
  const key = formatDateKey(date);

  if (key === todayKey) {
    return "Oggi";
  }

  if (key === yesterdayKey) {
    return "Ieri";
  }

  return `${formatWeekdayLabel(date)} ${formatDate(date)}`;
}

function groupDeletedEntries(entries: DeletedEntityEntry[]) {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const todayKey = formatDateKey(today);
  const yesterdayKey = formatDateKey(yesterday);
  const groups = new Map<string, { label: string; entries: DeletedEntityEntry[] }>();

  entries.forEach((entry) => {
    const key = formatDateKey(entry.createdAt);
    const currentGroup = groups.get(key);

    if (currentGroup) {
      currentGroup.entries.push(entry);
      return;
    }

    groups.set(key, {
      label: getDeletedActivityDayLabel(entry.createdAt, todayKey, yesterdayKey),
      entries: [entry]
    });
  });

  return Array.from(groups.entries()).map(([key, group]) => ({ key, ...group }));
}

function formatDeletedActivityTime(date: Date) {
  return new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIMEZONE
  }).format(date);
}

export function DeletedActivityList({
  entries,
  returnTo
}: {
  entries: DeletedEntityEntry[];
  returnTo: string;
}) {
  const groupedEntries = groupDeletedEntries(entries);

  if (entries.length === 0) {
    return <div className="empty activity-empty-state">Nessuna voce eliminata di recente.</div>;
  }

  return (
    <div className="stack deleted-activity-list activity-timeline">
      {groupedEntries.map((group) => (
        <section className="activity-day-group" key={group.key}>
          <div className="activity-day-label">
            <span>{group.label}</span>
            <small>{group.entries.length}</small>
          </div>

          <div className="stack activity-day-list">
            {group.entries.map((entry) => (
              <article className="activity-timeline-item deleted-activity-item is-danger" key={entry.id}>
                <div className="activity-row-kind">
                  <span className="activity-kind-pill">{entry.categoryLabel}</span>
                  <time dateTime={entry.createdAt.toISOString()}>{formatDeletedActivityTime(entry.createdAt)}</time>
                </div>

                <div className="activity-row-object">
                  <strong>{entry.entityLabel}</strong>
                  {entry.actorLabel ? <span>{entry.actorLabel}</span> : null}
                </div>

                <div className="activity-row-change">
                  <strong>{entry.summary}</strong>
                  {entry.details ? <span>{entry.details}</span> : null}
                  {entry.statusNote ? <span>{entry.statusNote}</span> : null}
                </div>

                <div className="deleted-activity-actions">
                  <Link className="compact-link activity-open-link" href={entry.href} prefetch={false}>
                    Apri
                  </Link>
                  {entry.canRestore && entry.restoreLabel ? (
                    <form action={restoreDeletedAuditEntryAction} className="timeline-restore-form">
                      <input name="auditLogId" type="hidden" value={entry.id} />
                      <input name="returnTo" type="hidden" value={returnTo} />
                      <ConfirmSubmitButton
                        className="button ghost timeline-restore-button"
                        confirmMessage="Vuoi ripristinare questa voce dal cestino?"
                      >
                        {entry.restoreLabel}
                      </ConfirmSubmitButton>
                    </form>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
