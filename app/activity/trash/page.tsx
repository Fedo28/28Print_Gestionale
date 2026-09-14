import Link from "next/link";
import { DeletedActivityList } from "@/components/deleted-activity-list";
import { PageHeader } from "@/components/page-header";
import { getDeletedEntityFeed } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ActivityTrashPage() {
  await requireAuth();
  const deletedEntries = await getDeletedEntityFeed({ limit: 80 });
  const restorableCount = deletedEntries.filter((entry) => entry.canRestore).length;

  return (
    <div className="stack activity-page-shell">
      <PageHeader
        title="Cestino"
        action={
          <div className="button-row activity-page-actions">
            <Link className="button ghost" href="/activity">
              Torna alle modifiche
            </Link>
            <Link className="button ghost" href="/">
              Dashboard
            </Link>
          </div>
        }
      />

      <section className="card card-pad activity-page-card" id="activity-trash-feed">
        <div className="stack deleted-activity-workspace">
          <section className="activity-signal-grid activity-trash-signal-grid" aria-label="Riepilogo cestino">
            <article className="activity-signal is-red">
              <span>Eliminati</span>
              <strong>{deletedEntries.length}</strong>
            </article>
            <article className="activity-signal is-lime">
              <span>Ripristinabili</span>
              <strong>{restorableCount}</strong>
            </article>
          </section>

          <nav className="activity-mode-tabs" aria-label="Archivio attività">
            <Link className="activity-mode-tab" href="/activity#activity-feed">
              Modifiche
            </Link>
            <Link className="activity-mode-tab is-active" href="/activity/trash#activity-trash-feed">
              Cestino <span>{deletedEntries.length}</span>
            </Link>
          </nav>
        </div>
        <DeletedActivityList entries={deletedEntries} returnTo="/activity/trash#activity-trash-feed" />
      </section>
    </div>
  );
}
