import Link from "next/link";
import { printEnabled } from "@/lib/print-runtime";
import { prisma } from "@/lib/prisma";
import { printStatusLabels } from "@/lib/print-jobs";

export async function PrintOrderPanel({ orderId, admin }: { orderId: string; admin: boolean }) {
  if (!printEnabled()) return null;
  const jobs = await prisma.printJob.findMany({ where: { orderId }, orderBy: { approvedAt: "desc" }, take: 5, select: { id: true, status: true, fileName: true } });
  return <section className="card card-pad stack" aria-label="Invio documenti a Fiery">
    <h3>Documenti per Fiery · prova</h3>
    <p>A4, scala di grigi, solo fronte, una copia. I lavori restano in attesa su Fiery.</p>
    <Link className="button secondary" href={`/orders/${orderId}/fiery`}>{admin ? "Approva invio a Fiery" : "Stato invii a Fiery"}</Link>
    {jobs.map(job => <p key={job.id}>{job.fileName}: {printStatusLabels[job.status]}</p>)}
  </section>;
}
