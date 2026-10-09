"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { changeWorkTaskParticipation, claimOrderForWork, createPersonalNote, pickWorkForPersonalAgenda, reorderPersonalNotes, savePersonalNote, saveWorkTask } from "@/lib/personal-workspace";
import type { NoteInput, TaskInput, WorkPickerSelection, WorkspaceActor } from "@/lib/personal-workspace-domain";

function refreshWorkspace() {
  for (const route of ["/my-day", "/orders", "/production"]) revalidatePath(route);
  revalidatePath("/orders/[id]", "page");
}

async function runAction<T>(operation: (actor: WorkspaceActor) => Promise<T>) {
  const session = await requireAuth();
  try {
    const value = await operation({ id: session.userId, role: session.role });
    refreshWorkspace();
    return { ok: true as const, value };
  } catch (error) {
    refreshWorkspace();
    return { ok: false as const, error: error instanceof Error ? error.message : "Operazione non riuscita. Riprova." };
  }
}

export async function saveTaskAction(input: TaskInput) {
  return runAction((actor) => saveWorkTask(actor, input));
}

export async function claimOrderAction(orderId: string) {
  return runAction((actor) => claimOrderForWork(actor, orderId));
}

export async function pickWorkAction(selection: WorkPickerSelection) {
  return runAction((actor) => pickWorkForPersonalAgenda(actor, selection));
}

export async function taskParticipationAction(id: string, version: number, operation: "JOIN" | "TAKE" | "LEAVE" | "DONE" | "REOPEN" | "ARCHIVE" | "RESTORE") {
  if (!["JOIN", "TAKE", "LEAVE", "DONE", "REOPEN", "ARCHIVE", "RESTORE"].includes(operation)) return { ok: false as const, error: "Operazione non valida." };
  return runAction((actor) => changeWorkTaskParticipation(actor, id, version, operation));
}

export async function createNoteAction() {
  return runAction(createPersonalNote);
}

export async function saveNoteAction(input: NoteInput, archived?: boolean) {
  return runAction((actor) => savePersonalNote(actor, input, archived));
}

export async function reorderNotesAction(ids: string[]) {
  return runAction((actor) => reorderPersonalNotes(actor, ids));
}
