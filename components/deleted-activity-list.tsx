import Link from "next/link";
import { restoreDeletedAuditEntryAction } from "@/app/actions";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { formatDateTime } from "@/lib/format";
import type { DeletedEntityEntry } from "@/lib/audit-log";

export function DeletedActivityList({
  entries,
  returnTo
}: {
  entries: DeletedEntityEntry[];
  returnTo: string;
}) {
  if (entries.length === 0) {
    return <div className="empty">Nessuna voce eliminata di recente.</div>;
  }

  return (
    <div className="stack deleted-activity-list">
      {entries.map((entry) => (
        <article className="mini-item deleted-activity-item" key={entry.id}>
          <div className="deleted-activity-head">
            <div className="deleted-activity-copy">
              <div className="deleted-activity-badges">
                <span className="pill">{entry.categoryLabel}</span>
                <span className="subtle">{formatDateTime(entry.createdAt)}</span>
                {entry.actorLabel ? <span className="subtle">{entry.actorLabel}</span> : null}
              </div>
              <strong>{entry.entityLabel}</strong>
            </div>
          </div>

          <div className="stack deleted-activity-summary">
            <strong>{entry.summary}</strong>
            {entry.details ? <div className="subtle">{entry.details}</div> : null}
            {entry.statusNote ? <div className="hint">{entry.statusNote}</div> : null}
          </div>

          <div className="deleted-activity-actions">
            <Link className="compact-link" href={entry.href} prefetch={false}>
              Apri sezione
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
  );
}
