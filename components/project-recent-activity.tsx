import Link from "next/link";
import { restoreOrderHistoryAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { UndoButtonContent } from "@/components/undo-button-content";
import { formatDateTime } from "@/lib/format";
import type { ProjectRecentActivityEntry } from "@/lib/audit-log";

export function ProjectRecentActivity({
  entries,
  returnTo
}: {
  entries: ProjectRecentActivityEntry[];
  returnTo: string;
}) {
  if (entries.length === 0) {
    return <div className="empty">Nessuna modifica recente da mostrare.</div>;
  }

  return (
    <div className="stack project-activity-list">
      {entries.map((entry) => (
        <article className="mini-item project-activity-item" key={entry.id}>
          <div className="project-activity-head">
            <div className="project-activity-copy">
              <div className="project-activity-badges">
                <span className="pill">{entry.categoryLabel}</span>
                <span className="subtle">{formatDateTime(entry.createdAt)}</span>
                {entry.actorLabel ? <span className="subtle">{entry.actorLabel}</span> : null}
              </div>
              <strong>
                <Link className="project-activity-link" href={entry.href} prefetch={false}>
                  {entry.entityLabel}
                </Link>
              </strong>
            </div>
          </div>

          <div className="stack project-activity-summary">
            <strong>{entry.summary}</strong>
            {entry.details ? <div className="subtle">{entry.details}</div> : null}
          </div>

          <div className="project-activity-actions">
            <Link className="compact-link" href={entry.href} prefetch={false}>
              Apri
            </Link>
            {entry.source === "order" && entry.canRestore && entry.restoreOrderId && entry.restoreHistoryId ? (
              <form action={restoreOrderHistoryAction} className="timeline-restore-form">
                <input name="orderId" type="hidden" value={entry.restoreOrderId} />
                <input name="historyId" type="hidden" value={entry.restoreHistoryId} />
                <input name="returnTo" type="hidden" value={returnTo} />
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
  );
}
