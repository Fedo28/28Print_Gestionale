import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { changeWorkTaskParticipation, claimOrderForWork, createPersonalNote, getPersonalWorkspace, pickWorkForPersonalAgenda, reorderPersonalNotes, savePersonalNote, saveWorkTask } from "../lib/personal-workspace";
import type { TaskInput, WorkspaceActor } from "../lib/personal-workspace-domain";

const databaseUrl = process.env.PERSONAL_WORKSPACE_TEST_DATABASE_URL;
if (databaseUrl) {
  const target = new URL(databaseUrl);
  if (!["localhost", "127.0.0.1"].includes(target.hostname) || target.pathname !== "/fede_personal_preview") {
    throw new Error("I test di integrazione richiedono il database locale dell'anteprima.");
  }
  if (process.env.DATABASE_URL !== databaseUrl) throw new Error("Il database di test deve coincidere con il database locale configurato.");
}

describe.runIf(Boolean(databaseUrl))("personal workspace integration", () => {
  const a: WorkspaceActor = { id: randomUUID(), role: "OPERATOR" };
  const b: WorkspaceActor = { id: randomUUID(), role: "OPERATOR" };
  const admin: WorkspaceActor = { id: randomUUID(), role: "ADMIN" };
  const customerId = randomUUID();
  const orderId = randomUUID();
  const pickerOrderId = randomUUID();
  const actors = [a, b, admin];
  const base = (ownerId = a.id): TaskInput => ({ title: "[Verifica] Commissione", description: "", orderId: null, ownerId,
    status: "OPEN", scheduledDate: null, startTime: null, endTime: null, collaborators: [] });

  beforeAll(async () => {
    for (const [index, actor] of actors.entries()) await prisma.user.create({ data: { id: actor.id, name: `[Verifica] Profilo ${index}`,
      nickname: `test-${actor.id}`, email: `${actor.id}@example.invalid`, passwordHash: "not-used", role: actor.role } });
    await prisma.customer.create({ data: { id: customerId, name: "[Verifica] Cliente" } });
    await prisma.order.create({ data: { id: orderId, customerId, orderCode: `TEST-${orderId}`, title: "[Verifica] Insegna",
      titleNormalized: orderId, createdOn: "2026-10-08", deliveryAt: new Date("2026-10-12T10:00:00Z") } });
    await prisma.order.create({ data: { id: pickerOrderId, customerId, orderCode: `TEST-${pickerOrderId}`, title: "[Verifica] Lista lavori",
      titleNormalized: pickerOrderId, createdOn: "2026-10-09", deliveryAt: new Date("2026-10-13T10:00:00Z") } });
  });
  afterAll(async () => {
    await prisma.workTask.deleteMany({ where: { createdById: { in: actors.map((actor) => actor.id) } } });
    await prisma.order.deleteMany({ where: { id: { in: [orderId, pickerOrderId] } } });
    await prisma.customer.deleteMany({ where: { id: customerId } });
    await prisma.user.deleteMany({ where: { id: { in: actors.map((actor) => actor.id) } } });
    await prisma.$disconnect();
  });

  it("saves optional commissions and shows collaborators the same scheduled commitment", async () => {
    const loose = await saveWorkTask(a, { ...base(), ownerId: null });
    expect(loose.ownerId).toBeNull(); expect(loose.scheduledDate).toBeNull();
    const shared = await saveWorkTask(a, { ...base(), scheduledDate: "2026-10-09", startTime: "09:00", endTime: "11:00",
      collaborators: [{ userId: b.id, role: "Installazione" }] });
    const workspace = await getPersonalWorkspace(b.id);
    expect(workspace.tasks.find((task) => task.id === shared.id)?.collaborators[0].role).toBe("Installazione");
    await expect(saveWorkTask(b, { ...base(), id: loose.id, version: loose.version, title: "Non autorizzato" })).rejects.toThrow(/modificare/);
  });

  it("keeps post-its private even from administrators and rejects stale edits", async () => {
    const note = await createPersonalNote(a);
    const saved = await savePersonalNote(a, { ...note, title: "Privato", content: "  Testo riservato\n", color: "PINK" });
    expect((await getPersonalWorkspace(b.id)).notes.some((entry) => entry.id === note.id)).toBe(false);
    expect((await getPersonalWorkspace(admin.id)).notes.some((entry) => entry.id === note.id)).toBe(false);
    await expect(savePersonalNote(admin, { ...saved, content: "Intrusione" })).rejects.toThrow(/non è disponibile/);
    await expect(savePersonalNote(b, saved, true)).rejects.toThrow(/non è disponibile/);
    await expect(reorderPersonalNotes(b, [note.id])).rejects.toThrow(/lista/);
    await expect(savePersonalNote(a, { ...note, content: "Vecchia versione" })).rejects.toThrow(/aggiornato/);
    expect((await prisma.personalNote.findUniqueOrThrow({ where: { id: note.id } })).content).toBe("  Testo riservato\n");
    const archived = await savePersonalNote(a, saved, true);
    expect(archived.archivedAt).not.toBeNull();
    expect((await savePersonalNote(a, archived, false)).archivedAt).toBeNull();
  });

  it("stores post-it positions without changing their content", async () => {
    const note2 = await createPersonalNote(a);
    const current = await prisma.personalNote.findMany({ where: { userId: a.id, archivedAt: null }, orderBy: { position: "asc" } });
    const ids = current.map((note) => note.id).reverse();
    await reorderPersonalNotes(a, ids);
    expect((await getPersonalWorkspace(a.id)).notes.filter((note) => !note.archivedAt).map((note) => note.id)).toEqual(ids);
    expect(ids[0]).toBe(note2.id);
  });

  it("prevents two simultaneous primary claims and never changes production or delivery", async () => {
    const before = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    const results = await Promise.allSettled([claimOrderForWork(a, orderId), claimOrderForWork(b, orderId)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.workTask.count({ where: { claimKey: `order:${orderId}` } })).toBe(1);
    const task = await prisma.workTask.findUniqueOrThrow({ where: { claimKey: `order:${orderId}` } });
    const winner = task.ownerId === a.id ? a : b;
    const helper = task.ownerId === a.id ? b : a;
    await changeWorkTaskParticipation(helper, task.id, task.version, "JOIN");
    const joined = await prisma.workTask.findUniqueOrThrow({ where: { id: task.id } });
    await changeWorkTaskParticipation(winner, task.id, joined.version, "DONE");
    const reclaimed = await claimOrderForWork(helper, orderId);
    expect(reclaimed.ownerId).toBe(helper.id);
    expect(reclaimed.collaborators).toHaveLength(0);
    const scheduled = await saveWorkTask(helper, { ...base(helper.id), id: reclaimed.id, version: reclaimed.version,
      orderId, status: "IN_PROGRESS", scheduledDate: "2026-10-09", startTime: "09:00", endTime: "11:00" });
    await changeWorkTaskParticipation(helper, scheduled.id, scheduled.version, "LEAVE");
    const handedOver = await claimOrderForWork(winner, orderId);
    expect(handedOver.scheduledDate).toBe("2026-10-09");
    expect(handedOver.startTime).toBe("09:00");
    expect(handedOver.status).toBe("IN_PROGRESS");
    const after = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
    expect(after.mainPhase).toBe(before.mainPhase);
    expect(after.deliveryAt).toEqual(before.deliveryAt);
    expect(after.updatedAt).toEqual(before.updatedAt);
  });

  it("rejects concurrent overwrites and supports leaving and taking an unassigned commission", async () => {
    const task = await saveWorkTask(a, { ...base(), collaborators: [{ userId: b.id, role: "" }] });
    const patch = { ...base(), id: task.id, version: task.version, collaborators: [{ userId: b.id, role: "" }] };
    const results = await Promise.allSettled([saveWorkTask(a, { ...patch, title: "Versione A" }), saveWorkTask(b, { ...patch, title: "Versione B" })]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const latest = await prisma.workTask.findUniqueOrThrow({ where: { id: task.id } });
    await changeWorkTaskParticipation(a, task.id, latest.version, "LEAVE");
    const unassigned = await prisma.workTask.findUniqueOrThrow({ where: { id: task.id } });
    expect(unassigned.ownerId).toBeNull();
    await changeWorkTaskParticipation(b, task.id, unassigned.version, "TAKE");
    const taken = await prisma.workTask.findUniqueOrThrow({ where: { id: task.id }, include: { collaborators: true } });
    expect(taken.ownerId).toBe(b.id); expect(taken.collaborators).toHaveLength(0);
  });

  it("adds from the visible list without a date and keeps repeat selections idempotent", async () => {
    const before = await prisma.order.findUniqueOrThrow({ where: { id: pickerOrderId } });
    const picked = await pickWorkForPersonalAgenda(a, { kind: "order", id: pickerOrderId });
    expect(picked.ownerId).toBe(a.id); expect(picked.scheduledDate).toBeNull();
    const repeat = await pickWorkForPersonalAgenda(a, { kind: "order", id: pickerOrderId });
    expect(repeat.id).toBe(picked.id); expect(repeat.version).toBe(picked.version);
    const collaboration = await pickWorkForPersonalAgenda(b, { kind: "order", id: pickerOrderId });
    expect(collaboration.ownerId).toBe(a.id);
    expect(collaboration.collaborators.map((person) => person.userId)).toContain(b.id);
    expect(await prisma.workTask.count({ where: { claimKey: `order:${pickerOrderId}` } })).toBe(1);
    const after = await prisma.order.findUniqueOrThrow({ where: { id: pickerOrderId } });
    expect(after.mainPhase).toBe(before.mainPhase); expect(after.deliveryAt).toEqual(before.deliveryAt);
    await prisma.order.update({ where: { id: pickerOrderId }, data: { isQuote: true } });
    await expect(pickWorkForPersonalAgenda(a, { kind: "order", id: pickerOrderId })).rejects.toThrow(/lavori aperti/);
    await prisma.order.update({ where: { id: pickerOrderId }, data: { isQuote: false, mainPhase: "CONSEGNATO" } });
    await expect(pickWorkForPersonalAgenda(a, { kind: "order", id: pickerOrderId })).rejects.toThrow(/lavori aperti/);
  });

  it("takes free commissions and joins planned shared work without changing the owner's schedule", async () => {
    const loose = await saveWorkTask(a, { ...base(), ownerId: null });
    const taken = await pickWorkForPersonalAgenda(b, { kind: "task", id: loose.id });
    expect(taken.ownerId).toBe(b.id); expect(taken.scheduledDate).toBeNull();
    const planned = await saveWorkTask(a, { ...base(), scheduledDate: "2026-10-12", startTime: "09:00", endTime: "11:00" });
    const joined = await pickWorkForPersonalAgenda(b, { kind: "task", id: planned.id });
    expect(joined.ownerId).toBe(a.id); expect(joined.scheduledDate).toBe("2026-10-12"); expect(joined.startTime).toBe("09:00");
    const repeat = await pickWorkForPersonalAgenda(b, { kind: "task", id: planned.id });
    expect(repeat.version).toBe(joined.version); expect(repeat.collaborators).toHaveLength(1);
    await changeWorkTaskParticipation(a, planned.id, joined.version, "DONE");
    await expect(pickWorkForPersonalAgenda(b, { kind: "task", id: planned.id })).rejects.toThrow(/concluso/);
  });
});
