"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { approvePrint, managePrintJob, revokePrintBridge } from "@/lib/print-jobs";
import { prisma } from "@/lib/prisma";

export async function approvePrintAction(form: FormData) {
  const session = await requireAuth();
  const orderId = String(form.get("orderId") || "");
  if (form.get("confirmed") !== "on") throw new Error("Conferma di aver verificato documento e profilo.");
  await approvePrint({ userId: session.userId, orderId, attachmentId: String(form.get("attachmentId") || ""),
    destinationId: String(form.get("destinationId") || ""), sha256: String(form.get("sha256") || ""),
    reprintOfId: String(form.get("reprintOfId") || "") || undefined, reason: String(form.get("reason") || "") });
  revalidatePath(`/orders/${orderId}`); revalidatePath(`/orders/${orderId}/fiery`);
  redirect(`/orders/${orderId}/fiery`);
}
export async function managePrintAction(form: FormData) {
  const session = await requireAuth();
  const id = String(form.get("jobId") || ""), action = String(form.get("operation") || "");
  if (["received", "not-received"].includes(action) && form.get("bridgeStopped") !== "on") throw new Error("Prima arresta il Bridge e verifica il lavoro in Fiery.");
  await managePrintJob(session.userId, id, Number(form.get("version")), action, String(form.get("reason") || ""));
  const job = await prisma.printJob.findUniqueOrThrow({ where: { id }, select: { orderId: true } });
  if (job.orderId) { revalidatePath(`/orders/${job.orderId}/fiery`); revalidatePath(`/orders/${job.orderId}`); }
  revalidatePath("/settings/printing");
}
export async function revokeBridgeAction(form: FormData) {
  const session = await requireAuth();
  await revokePrintBridge(session.userId, String(form.get("bridgeId") || ""));
  revalidatePath("/settings/printing");
}
