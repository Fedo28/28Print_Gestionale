import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDateKey } from "@/lib/format";
import { getPersonalWorkspace } from "@/lib/personal-workspace";
import { isValidDay } from "@/lib/personal-workspace-domain";
import { PersonalWorkspace } from "@/components/personal-workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Agenda | Gestionale 28 Print" };

export default async function MyDayPage({ searchParams }: { searchParams?: { scope?: string; view?: string; date?: string; orderId?: string; task?: string } }) {
  const session = await requireAuth();
  const profile = await prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, name: true, active: true, role: true } });
  if (!profile?.active) redirect("/logout");
  const data = await getPersonalWorkspace(session.userId);
  const today = formatDateKey(new Date());
  return <PersonalWorkspace {...data} actor={{ id: profile.id, role: profile.role }} profileName={profile.name}
    today={today} initialDate={searchParams?.date && isValidDay(searchParams.date) ? searchParams.date : today}
    initialScope={searchParams?.scope === "team" ? "team" : "mine"}
    initialView={searchParams?.view === "week" ? "week" : searchParams?.view === "inbox" ? "inbox" : "day"}
    initialOrderId={searchParams?.orderId} initialTaskId={searchParams?.task} />;
}
