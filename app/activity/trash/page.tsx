import Link from "next/link";
import { DeletedActivityList } from "@/components/deleted-activity-list";
import { PageHeader } from "@/components/page-header";
import { getDeletedEntityFeed } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ActivityTrashPage() {
  await requireAuth();
  const deletedEntries = await getDeletedEntityFeed({ limit: 40 });

  return (
    <div className="stack activity-page-shell">
      <PageHeader
        title="Cestino"
        description="Elementi eliminati di recente, con ripristino diretto dove il gestionale puo ricostruirli in sicurezza."
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
        <DeletedActivityList entries={deletedEntries} returnTo="/activity/trash#activity-trash-feed" />
      </section>
    </div>
  );
}
