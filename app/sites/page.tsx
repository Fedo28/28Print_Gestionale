import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateKey } from "@/lib/format";
import { getManagedSites } from "@/lib/managed-sites";
import { ManagedSitesWorkspace } from "@/components/managed-sites-workspace";
import { getSiteEmailDashboard } from "@/lib/site-email";
import "./sites.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Siti | Gestionale 28 Print" };

export default async function SitesPage() {
  const session = await requireAuth();
  const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { active: true, role: true } });
  if (!user?.active) redirect("/logout");
  const [sites, emailDashboard] = await Promise.all([getManagedSites(), getSiteEmailDashboard()]);
  if (user.role !== "ADMIN") emailDashboard.lastTest = null;
  return <ManagedSitesWorkspace {...sites} emailDashboard={emailDashboard} canConfigureEmail={user.role === "ADMIN"} today={formatDateKey(new Date())} />;
}
