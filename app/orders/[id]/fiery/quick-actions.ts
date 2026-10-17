"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { approvePrint, reviewPrintAttachment } from "@/lib/print-jobs";
import { prisma } from "@/lib/prisma";
import { destinationUnavailable, profileDescription, recommendDestination } from "@/lib/print-profiles";

const failure = (error: unknown) => error instanceof Error && !error.name.startsWith("Prisma")
  ? error.message : "Operazione non disponibile. Riprova senza creare un nuovo invio.";

export async function reviewAttachmentQuick(orderId: string, attachmentId: string) {
  const session = await requireAuth();
  try {
    const reviewed = await reviewPrintAttachment(session.userId, orderId, attachmentId);
    const configured = await prisma.printDestination.findMany({ orderBy: { name: "asc" }, include: { printer: true, profile: true, bridge: { select: { enabled: true, lastSeenAt: true } } } });
    const destinations = configured.filter(d => !destinationUnavailable(d));
    const latest = await prisma.printJob.findFirst({ where: { orderId, attachmentId }, orderBy: { approvedAt: "desc" }, select: { id: true, status: true } });
    return { ok: true as const, review: { fileName: reviewed.attachment.fileName,
      url: `/api/orders/${encodeURIComponent(orderId)}/print-preview?attachment=${encodeURIComponent(attachmentId)}&sha256=${reviewed.sha256}`,
      sha256: reviewed.sha256, pageCount: reviewed.pageCount, latest,
      options: destinations.map(d => ({ id: d.id, printerName: d.printer!.name, name: d.name,
        profileId: d.profile!.id, profileName: d.profile!.name, description: profileDescription(d.profile!),
        recommended: recommendDestination(destinations, d.profile!.colorMode, d.profile!.id)?.id === d.id,
        online: !!d.bridge.lastSeenAt && Date.now() - d.bridge.lastSeenAt.getTime() < 90000 })) } };
  } catch (error) { return { ok: false as const, error: failure(error) }; }
}

export async function approveAttachmentQuick(input: { orderId: string; attachmentId: string; destinationId: string; sha256: string; reprintOfId?: string; reason?: string; confirmed: boolean }) {
  const session = await requireAuth();
  try {
    if (input.confirmed !== true) throw Error("Conferma l'invio del documento.");
    const jobId = await approvePrint({ ...input, userId: session.userId });
    revalidatePath(`/orders/${input.orderId}`);
    revalidatePath(`/orders/${input.orderId}/fiery`);
    revalidatePath("/settings/printing");
    return { ok: true as const, jobId };
  } catch (error) { return { ok: false as const, error: failure(error) }; }
}
