"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { archiveManagedSite, associateManagedSite, recordSiteRenewal, saveManagedSite } from "@/lib/managed-sites";
import type { ManagedSiteInput, SiteRenewalInput } from "@/lib/managed-sites-domain";
import { retrySiteEmailReminder, saveSiteEmailSettings, sendSiteEmailTest } from "@/lib/site-email";
import type { SiteEmailSettings } from "@/lib/site-email-domain";

async function run<T>(operation: (userId: string) => Promise<T>) {
  const session = await requireAuth();
  try {
    const value = await operation(session.userId);
    revalidatePath("/sites");
    return { ok: true as const, value };
  } catch (error) {
    revalidatePath("/sites");
    return { ok: false as const, error: error instanceof Error ? error.message : "Operazione non riuscita." };
  }
}
export async function saveSiteAction(input: ManagedSiteInput) { return run(userId => saveManagedSite(userId, input)); }
export async function associateSiteAction(id: string, version: number, customerId: string | null) { return run(userId => associateManagedSite(userId, id, version, customerId)); }
export async function archiveSiteAction(id: string, version: number, archived: boolean) { return run(userId => archiveManagedSite(userId, id, version, archived)); }
export async function renewSiteAction(input: SiteRenewalInput) { return run(userId => recordSiteRenewal(userId, input)); }
export async function saveSiteEmailSettingsAction(input: SiteEmailSettings) { return run(userId => saveSiteEmailSettings(userId, input)); }
export async function testSiteEmailAction(recipient: string, input: SiteEmailSettings) { return run(userId => sendSiteEmailTest(userId, recipient, input)); }
export async function retrySiteEmailAction(id: string) { return run(userId => retrySiteEmailReminder(userId, id)); }
