export type TaskStatus = "OPEN" | "IN_PROGRESS" | "DONE";
export type NoteColor = "YELLOW" | "BLUE" | "GREEN" | "PINK";
export type WorkspaceProfile = { id: string; name: string; nickname: string; active: boolean };
export type WorkspaceActor = { id: string; role: "ADMIN" | "OPERATOR" };
export type WorkspacePickerOrder = { id: string; title: string; customerName: string; deliveryAt: string; mainPhase: string };
export type WorkPickerSelection = { kind: "order" | "task"; id: string };
export type WorkspaceTask = {
  id: string; title: string; description: string; orderId: string | null; claimKey: string | null;
  ownerId: string | null; createdById: string | null; owner: WorkspaceProfile | null;
  status: TaskStatus; scheduledDate: string | null; startTime: string | null; endTime: string | null;
  version: number; completedAt: string | null; archivedAt: string | null; createdAt: string;
  collaborators: { userId: string; role: string; user: WorkspaceProfile }[];
  order: { id: string; title: string; customerName: string; deliveryAt: string; mainPhase: string } | null;
};
export type WorkspaceNote = {
  id: string; title: string; content: string; color: NoteColor; position: number;
  version: number; archivedAt: string | null; updatedAt: string;
};
export type TaskInput = {
  id?: string; version?: number; title: string; description: string; orderId: string | null;
  ownerId: string | null; status: TaskStatus; scheduledDate: string | null;
  startTime: string | null; endTime: string | null;
  collaborators: { userId: string; role: string }[];
};
export type NoteInput = { id: string; version: number; title: string; content: string; color: NoteColor };

export const taskStatusLabels: Record<TaskStatus, string> = { OPEN: "Da fare", IN_PROGRESS: "In corso", DONE: "Fatto" };
export const noteColorLabels: Record<NoteColor, string> = { YELLOW: "Giallo", BLUE: "Azzurro", GREEN: "Verde", PINK: "Rosa" };

export function isValidDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function shiftDay(value: string, offset: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function getWeekDays(day: string) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  const monday = shiftDay(day, -(weekday === 0 ? 6 : weekday - 1));
  return Array.from({ length: 7 }, (_, index) => shiftDay(monday, index));
}

export function isTaskParticipant(task: { ownerId: string | null; collaborators: readonly { userId: string }[] }, userId: string) {
  return task.ownerId === userId || task.collaborators.some((person) => person.userId === userId);
}

export function canManageTask(task: { ownerId: string | null; createdById: string | null; collaborators: readonly { userId: string }[] }, actor: WorkspaceActor) {
  return actor.role === "ADMIN" || task.createdById === actor.id || isTaskParticipant(task, actor.id);
}

export function validateTaskInput(input: TaskInput): TaskInput {
  const title = input.title.trim();
  const description = input.description.trim();
  if (!title || title.length > 180) throw new Error("Scrivi un titolo di massimo 180 caratteri.");
  if (description.length > 4000) throw new Error("La descrizione può contenere al massimo 4000 caratteri.");
  if (!["OPEN", "IN_PROGRESS", "DONE"].includes(input.status)) throw new Error("Stato incarico non valido.");
  const scheduledDate = input.scheduledDate?.trim() || null;
  const startTime = input.startTime?.trim() || null;
  const endTime = input.endTime?.trim() || null;
  if (scheduledDate && !isValidDay(scheduledDate)) throw new Error("Scegli una data valida.");
  if ((startTime || endTime) && !scheduledDate) throw new Error("Scegli il giorno prima di indicare un orario.");
  if ([startTime, endTime].some((time) => time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) throw new Error("Orario non valido.");
  if (endTime && (!startTime || endTime <= startTime)) throw new Error("L'orario finale deve essere successivo a quello iniziale.");
  if (input.id && (!Number.isInteger(input.version) || (input.version ?? -1) < 0)) throw new Error("Ricarica l'incarico prima di modificarlo.");
  const collaborators = input.collaborators.filter((person) => person.userId !== input.ownerId);
  if (new Set(collaborators.map((person) => person.userId)).size !== collaborators.length) throw new Error("Un collaboratore è stato indicato due volte.");
  if (collaborators.some((person) => person.role.trim().length > 120)) throw new Error("Il ruolo può contenere al massimo 120 caratteri.");
  return { ...input, title, description, scheduledDate, startTime, endTime,
    ownerId: input.ownerId || null, orderId: input.orderId || null,
    collaborators: collaborators.map((person) => ({ userId: person.userId, role: person.role.trim() })) };
}

export function validateNoteInput(input: NoteInput) {
  if (!input.id || !Number.isInteger(input.version) || input.version < 0) throw new Error("Ricarica il post-it prima di modificarlo.");
  if (input.title.length > 100 || input.content.length > 8000) throw new Error("Il post-it è troppo lungo: massimo 100 caratteri per il titolo e 8000 per il testo.");
  if (!Object.hasOwn(noteColorLabels, input.color)) throw new Error("Colore post-it non valido.");
  return { ...input, title: input.title.trim() };
}
