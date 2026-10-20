import { prisma } from "@/lib/prisma";
import { printEnabled } from "@/lib/print-runtime";
import { printStatusLabels } from "@/lib/print-jobs";
import { PrintAttachmentButton } from "./print-attachment-button";

export async function PrintAttachmentActions({ orderId, attachmentId, admin }: { orderId: string; attachmentId: string; admin: boolean }) {
  if (!printEnabled()) return null;
  const job = await prisma.printJob.findFirst({ where: { orderId, attachmentId }, orderBy: { approvedAt: "desc" }, select: { status: true, destination: { select: { printerName: true } } } });
  return <PrintAttachmentButton orderId={orderId} attachmentId={attachmentId} admin={admin}
    status={job?.status} statusLabel={job ? (job.status === "DELIVERED" ? "Consegnato alla cartella Fiery" : printStatusLabels[job.status]) : undefined} printerName={job?.destination.printerName} />;
}
