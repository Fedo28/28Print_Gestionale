import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ProjectRecentActivity } from "@/components/project-recent-activity";
import { getRecentProjectActivityFeed } from "@/lib/audit-log";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  await requireAuth();
  const recentActivity = await getRecentProjectActivityFeed({ limit: 40 });

  return (
    <div className="stack activity-page-shell">
      <PageHeader
        title="Ultime modifiche"
        description="Registro rapido delle operazioni recenti, con link diretto e annullamento dove disponibile."
        action={
          <Link className="button ghost" href="/">
            Torna alla dashboard
          </Link>
        }
      />

      <section className="card card-pad activity-page-card" id="activity-feed">
        <ProjectRecentActivity entries={recentActivity} returnTo="/activity#activity-feed" />
      </section>
    </div>
  );
}
