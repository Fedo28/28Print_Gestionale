import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ProjectRecentActivity } from "@/components/project-recent-activity";
import { getDeletedEntityFeed, getRecentProjectActivityFeed } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ActivityPage({
  searchParams
}: {
  searchParams?: {
    action?: string | string[];
    category?: string | string[];
  };
}) {
  await requireAuth();
  const [recentActivity, deletedEntries] = await Promise.all([
    getRecentProjectActivityFeed({ limit: 80 }),
    getDeletedEntityFeed({ limit: 80 })
  ]);
  const deletedRestorableCount = deletedEntries.filter((entry) => entry.canRestore).length;

  return (
    <div className="stack activity-page-shell">
      <PageHeader
        title="Attività"
        action={
          <div className="button-row activity-page-actions">
            <Link className="button ghost" href="/activity/trash">
              Cestino
            </Link>
            <Link className="button ghost" href="/">
              Torna alla dashboard
            </Link>
          </div>
        }
      />

      <section className="card card-pad activity-page-card" id="activity-feed">
        <ProjectRecentActivity
          activeAction={searchParams?.action}
          activeCategory={searchParams?.category}
          deletedCount={deletedEntries.length}
          deletedRestorableCount={deletedRestorableCount}
          entries={recentActivity}
          returnTo="/activity#activity-feed"
        />
      </section>
    </div>
  );
}
