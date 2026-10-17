"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { savePrintConfiguration } from "@/lib/print-settings";

export async function savePrintConfigurationAction(form: FormData) {
  const session = await requireAuth();
  let error = "";
  try { await savePrintConfiguration(session.userId, form); }
  catch (e) {
    error = e instanceof Error && !e.name.startsWith("Prisma") ? e.message : "Salvataggio non riuscito: verifica che la chiave sia univoca e ricarica la pagina.";
  }
  if (error) redirect(`/settings/printing?error=${encodeURIComponent(error)}`);
  revalidatePath("/settings/printing");
  revalidatePath("/orders", "layout");
  redirect("/settings/printing?saved=1");
}
