import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canManageTask, isTaskParticipant, validateNoteInput, validateTaskInput } from "@/lib/personal-workspace-domain";
import type { NoteInput, TaskInput, WorkPickerSelection, WorkspaceActor, WorkspaceNote, WorkspaceTask } from "@/lib/personal-workspace-domain";

export const workspaceProfileSelect = { id: true, name: true, nickname: true, active: true } as const;
export const orderWorkTasksRelationArgs = {
  where: { archivedAt: null, status: { not: "DONE" as const } },
  select: {
    id: true, title: true, ownerId: true, version: true, claimKey: true,
    owner: { select: { name: true } },
    collaborators: { select: { userId: true, user: { select: { name: true } } } }
  },
  orderBy: { createdAt: "asc" as const }
};
export const workspaceTaskInclude = {
  owner: { select: workspaceProfileSelect },
  collaborators: { include: { user: { select: workspaceProfileSelect } }, orderBy: { createdAt: "asc" as const } },
  order: { select: { id: true, title: true, deliveryAt: true, mainPhase: true, customer: { select: { name: true } } } }
} satisfies Prisma.WorkTaskInclude;
type TaskRecord = Prisma.WorkTaskGetPayload<{ include: typeof workspaceTaskInclude }>;

export function serializeWorkspaceTask(task: TaskRecord): WorkspaceTask {
  return {
    id: task.id, title: task.title, description: task.description, orderId: task.orderId, claimKey: task.claimKey,
    ownerId: task.ownerId, createdById: task.createdById, owner: task.owner, status: task.status,
    scheduledDate: task.scheduledDate, startTime: task.startTime, endTime: task.endTime,
    version: task.version, completedAt: task.completedAt?.toISOString() || null, archivedAt: task.archivedAt?.toISOString() || null, createdAt: task.createdAt.toISOString(),
    collaborators: task.collaborators.map(({ userId, role, user }) => ({ userId, role, user })),
    order: task.order ? { id: task.order.id, title: task.order.title, customerName: task.order.customer.name,
      deliveryAt: task.order.deliveryAt.toISOString(), mainPhase: task.order.mainPhase } : null
  };
}

export function serializeWorkspaceNote(note: Prisma.PersonalNoteGetPayload<object>): WorkspaceNote {
  return { id: note.id, title: note.title, content: note.content, color: note.color, position: note.position,
    version: note.version, archivedAt: note.archivedAt?.toISOString() || null, updatedAt: note.updatedAt.toISOString() };
}

async function assertActiveActor(actor: WorkspaceActor) {
  const user = await prisma.user.findUnique({ where: { id: actor.id }, select: { active: true, role: true } });
  if (!user?.active || user.role !== actor.role) throw new Error("Il profilo non è più attivo. Accedi di nuovo.");
}

export async function getPersonalWorkspace(userId: string) {
  const [profiles, tasks, notes, orders] = await Promise.all([
    prisma.user.findMany({ select: workspaceProfileSelect, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.workTask.findMany({ include: workspaceTaskInclude,
      orderBy: [{ scheduledDate: "asc" }, { startTime: "asc" }, { createdAt: "desc" }] }),
    prisma.personalNote.findMany({ where: { userId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }),
    prisma.order.findMany({ where: { isQuote: false, mainPhase: { not: "CONSEGNATO" } },
      select: { id: true, title: true, deliveryAt: true, mainPhase: true, customer: { select: { name: true } } }, orderBy: { deliveryAt: "asc" } })
  ]);
  return { profiles, tasks: tasks.map(serializeWorkspaceTask), notes: notes.map(serializeWorkspaceNote),
    orders: orders.map((order) => ({ id: order.id, title: order.title, customerName: order.customer.name,
      deliveryAt: order.deliveryAt.toISOString(), mainPhase: order.mainPhase })) };
}

export async function saveWorkTask(actor: WorkspaceActor, raw: TaskInput) {
  await assertActiveActor(actor);
  const input = validateTaskInput(raw);
  return prisma.$transaction(async (tx) => {
    const existing = input.id ? await tx.workTask.findUnique({ where: { id: input.id }, include: workspaceTaskInclude }) : null;
    if (input.id && (!existing || existing.archivedAt)) throw new Error("Incarico non disponibile.");
    if (existing && !canManageTask(existing, actor)) throw new Error("Puoi modificare gli incarichi che segui o ai quali collabori.");
    if (existing?.claimKey && input.orderId !== existing.orderId) throw new Error("La presa in carico resta collegata al suo ordine.");
    const people = [input.ownerId, ...input.collaborators.map((person) => person.userId)].filter((id): id is string => Boolean(id));
    const validPeople = await tx.user.findMany({ where: { id: { in: people } }, select: { id: true, active: true } });
    if (validPeople.length !== new Set(people).size || validPeople.some((user) => !user.active && user.id !== existing?.ownerId && !existing?.collaborators.some((person) => person.userId === user.id))) {
      throw new Error("Scegli profili attivi per i nuovi incarichi.");
    }
    if (input.orderId) {
      const order = await tx.order.findUnique({ where: { id: input.orderId }, select: { isQuote: true } });
      if (!order || order.isQuote) throw new Error("L'ordine collegato non è disponibile.");
    }
    const data = {
      title: input.title, description: input.description, orderId: input.orderId, ownerId: input.ownerId,
      status: input.status, scheduledDate: input.scheduledDate, startTime: input.startTime, endTime: input.endTime,
      completedAt: input.status === "DONE" ? existing?.completedAt || new Date() : null
    };
    if (!existing) {
      return serializeWorkspaceTask(await tx.workTask.create({ data: { ...data, createdById: actor.id,
        collaborators: { create: input.collaborators } }, include: workspaceTaskInclude }));
    }
    const result = await tx.workTask.updateMany({ where: { id: existing.id, version: input.version, archivedAt: null },
      data: { ...data, version: { increment: 1 } } });
    if (!result.count) throw new Error("Un collega ha aggiornato questo incarico. Riaprilo per vedere le modifiche; il tuo testo resta nel modulo.");
    await tx.workTaskCollaborator.deleteMany({ where: { taskId: existing.id } });
    if (input.collaborators.length) await tx.workTaskCollaborator.createMany({ data: input.collaborators.map((person) => ({ ...person, taskId: existing.id })) });
    return serializeWorkspaceTask(await tx.workTask.findUniqueOrThrow({ where: { id: existing.id }, include: workspaceTaskInclude }));
  });
}

export async function claimOrderForWork(actor: WorkspaceActor, orderId: string) {
  await assertActiveActor(actor);
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { id: true, title: true, isQuote: true } });
  if (!order || order.isQuote) throw new Error("Ordine non disponibile.");
  const claimKey = `order:${order.id}`;
  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.workTask.findUnique({ where: { claimKey }, include: workspaceTaskInclude });
      if (!existing) return serializeWorkspaceTask(await tx.workTask.create({ data: {
        title: order.title, orderId: order.id, claimKey, ownerId: actor.id, createdById: actor.id
      }, include: workspaceTaskInclude }));
      if (existing.ownerId === actor.id && !existing.archivedAt && existing.status !== "DONE") return serializeWorkspaceTask(existing);
      if (existing.ownerId && !existing.archivedAt && existing.status !== "DONE") throw new Error(`Lo segue già ${existing.owner?.name || "un collega"}. Puoi aggiungerti come collaboratore.`);
      const newCycle = existing.status === "DONE" || Boolean(existing.archivedAt);
      const changed = await tx.workTask.updateMany({ where: { id: existing.id, version: existing.version }, data: {
        ownerId: actor.id, version: { increment: 1 },
        ...(newCycle ? { status: "OPEN", archivedAt: null, completedAt: null, scheduledDate: null, startTime: null, endTime: null } : {})
      } });
      if (!changed.count) throw new Error("Un collega ha appena aggiornato la presa in carico. Controlla chi la segue.");
      await tx.workTaskCollaborator.deleteMany({ where: { taskId: existing.id,
        ...(newCycle ? {} : { userId: actor.id }) } });
      return serializeWorkspaceTask(await tx.workTask.findUniqueOrThrow({ where: { id: existing.id }, include: workspaceTaskInclude }));
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new Error("Un collega ha appena preso in carico questo ordine. Controlla chi lo segue.");
    throw error;
  }
}

export async function changeWorkTaskParticipation(actor: WorkspaceActor, id: string, version: number, operation: "JOIN" | "TAKE" | "LEAVE" | "DONE" | "REOPEN" | "ARCHIVE" | "RESTORE") {
  await assertActiveActor(actor);
  if (!Number.isInteger(version) || version < 0) throw new Error("Ricarica l'incarico.");
  return prisma.$transaction(async (tx) => {
    const task = await tx.workTask.findUnique({ where: { id }, include: workspaceTaskInclude });
    if (!task || (task.archivedAt && operation !== "RESTORE")) throw new Error("Incarico non disponibile.");
    if (operation !== "JOIN" && operation !== "TAKE" && !canManageTask(task, actor)) throw new Error("Questo incarico è seguito da un altro profilo.");
    if (operation === "TAKE" && task.ownerId && task.ownerId !== actor.id) throw new Error("Lo segue già un collega. Puoi collaborare senza cambiare il referente.");
    if (operation === "LEAVE" && task.ownerId !== actor.id && !task.collaborators.some((person) => person.userId === actor.id)) throw new Error("Non partecipi a questo incarico.");
    if (operation === "JOIN" && task.ownerId === actor.id) return;
    const changed = await tx.workTask.updateMany({ where: { id, version, ...(operation === "RESTORE" ? {} : { archivedAt: null }) }, data: {
      version: { increment: 1 },
      ...(operation === "LEAVE" && task.ownerId === actor.id ? { ownerId: null } : {}),
      ...(operation === "TAKE" ? { ownerId: actor.id } : {}),
      ...(operation === "DONE" ? { status: "DONE", completedAt: new Date() } : {}),
      ...(operation === "REOPEN" ? { status: "OPEN", completedAt: null } : {}),
      ...(operation === "ARCHIVE" ? { archivedAt: new Date() } : {}),
      ...(operation === "RESTORE" ? { archivedAt: null } : {})
    } });
    if (!changed.count) throw new Error("L'incarico è stato aggiornato da un collega. Ricarica la lista.");
    if (operation === "JOIN") await tx.workTaskCollaborator.upsert({ where: { taskId_userId: { taskId: id, userId: actor.id } },
      create: { taskId: id, userId: actor.id }, update: {} });
    if (operation === "LEAVE") await tx.workTaskCollaborator.deleteMany({ where: { taskId: id, userId: actor.id } });
    if (operation === "TAKE") await tx.workTaskCollaborator.deleteMany({ where: { taskId: id, userId: actor.id } });
  });
}

export async function pickWorkForPersonalAgenda(actor: WorkspaceActor, selection: WorkPickerSelection) {
  await assertActiveActor(actor);
  if (!selection.id || !["order", "task"].includes(selection.kind)) throw new Error("Scegli un lavoro disponibile.");
  let existing: TaskRecord | null;
  if (selection.kind === "order") {
    const order = await prisma.order.findUnique({ where: { id: selection.id }, select: { isQuote: true, mainPhase: true } });
    if (!order || order.isQuote || order.mainPhase === "CONSEGNATO") throw new Error("Questo ordine non è più tra i lavori aperti. La lista è stata aggiornata.");
    existing = await prisma.workTask.findUnique({ where: { claimKey: `order:${selection.id}` }, include: workspaceTaskInclude });
    if (!existing || existing.archivedAt || existing.status === "DONE") return claimOrderForWork(actor, selection.id);
  } else {
    existing = await prisma.workTask.findUnique({ where: { id: selection.id }, include: workspaceTaskInclude });
    if (!existing || existing.archivedAt || existing.status === "DONE") throw new Error("Questo incarico è già concluso o non è più disponibile.");
  }
  if (isTaskParticipant(existing, actor.id)) return serializeWorkspaceTask(existing);
  await changeWorkTaskParticipation(actor, existing.id, existing.version, existing.ownerId ? "JOIN" : "TAKE");
  return serializeWorkspaceTask(await prisma.workTask.findUniqueOrThrow({ where: { id: existing.id }, include: workspaceTaskInclude }));
}

export async function createPersonalNote(actor: WorkspaceActor) {
  await assertActiveActor(actor);
  const last = await prisma.personalNote.aggregate({ where: { userId: actor.id }, _max: { position: true } });
  return serializeWorkspaceNote(await prisma.personalNote.create({ data: { userId: actor.id, position: (last._max.position ?? -1) + 1 } }));
}

export async function savePersonalNote(actor: WorkspaceActor, raw: NoteInput, archived?: boolean) {
  await assertActiveActor(actor);
  const input = validateNoteInput(raw);
  return prisma.$transaction(async (tx) => {
    const changed = await tx.personalNote.updateMany({ where: { id: input.id, userId: actor.id, version: input.version,
      ...(archived === undefined ? { archivedAt: null } : {}) }, data: {
      title: input.title, content: input.content, color: input.color, version: { increment: 1 },
      ...(archived === undefined ? {} : { archivedAt: archived ? new Date() : null })
    } });
    if (!changed.count) throw new Error("Il post-it è stato aggiornato o non è disponibile. Ricaricalo prima di salvare; il tuo testo resta qui.");
    return serializeWorkspaceNote(await tx.personalNote.findFirstOrThrow({ where: { id: input.id, userId: actor.id } }));
  });
}

export async function reorderPersonalNotes(actor: WorkspaceActor, ids: string[]) {
  await assertActiveActor(actor);
  if (new Set(ids).size !== ids.length) throw new Error("Ordine dei post-it non valido.");
  return prisma.$transaction(async (tx) => {
    const active = await tx.personalNote.findMany({ where: { userId: actor.id, archivedAt: null }, select: { id: true } });
    if (active.length !== ids.length || active.some((note) => !ids.includes(note.id))) throw new Error("La lista dei post-it è cambiata. Ricaricala prima di spostarli.");
    for (let index = 0; index < ids.length; index++) await tx.personalNote.updateMany({ where: { id: ids[index], userId: actor.id, archivedAt: null }, data: { position: index } });
  });
}
