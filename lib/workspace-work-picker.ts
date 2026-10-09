import { createSearchIndexValue, createSearchMatcher, matchesSearchIndexValue } from "@/lib/search-text";
import { isTaskParticipant } from "@/lib/personal-workspace-domain";
import type { WorkPickerSelection, WorkspacePickerOrder, WorkspaceTask } from "@/lib/personal-workspace-domain";

export type WorkPickerEntry = {
  key: string; selection: WorkPickerSelection; title: string; customerName: string | null;
  kindLabel: string; deliveryAt: string | null; mainPhase: string | null; task: WorkspaceTask | null;
  mine: boolean; followed: boolean; relatedPeople: string[];
};
export type WorkPickerFilter = "ALL" | "FREE" | "FOLLOWED" | "MINE";

export function buildWorkPickerEntries(orders: WorkspacePickerOrder[], tasks: WorkspaceTask[], userId: string): WorkPickerEntry[] {
  const activeTasks = tasks.filter((task) => !task.archivedAt && task.status !== "DONE");
  const entries: WorkPickerEntry[] = orders.filter((order) => order.mainPhase !== "CONSEGNATO").map((order) => {
    const task = activeTasks.find((task) => task.claimKey === `order:${order.id}`) || null;
    const related = activeTasks.filter((other) => other.orderId === order.id && other.id !== task?.id);
    return { key: `order:${order.id}`, selection: { kind: "order", id: order.id }, title: order.title,
      customerName: order.customerName, kindLabel: "Ordine", deliveryAt: order.deliveryAt, mainPhase: order.mainPhase,
      task, mine: Boolean(task && isTaskParticipant(task, userId)), followed: Boolean(task?.ownerId || task?.collaborators.length),
      relatedPeople: [...new Set(related.flatMap((other) => [other.owner?.name, ...other.collaborators.map((person) => person.user.name)]).filter((name): name is string => Boolean(name)))] };
  });
  for (const task of activeTasks.filter((task) => !task.claimKey)) {
    entries.push({ key: `task:${task.id}`, selection: { kind: "task", id: task.id }, title: task.title,
      customerName: task.order?.customerName || null, kindLabel: task.orderId ? "Attività" : "Commissione libera",
      deliveryAt: null, mainPhase: null, task, mine: isTaskParticipant(task, userId),
      followed: Boolean(task.ownerId || task.collaborators.length), relatedPeople: [] });
  }
  return entries;
}

export function filterWorkPickerEntries(entries: WorkPickerEntry[], query: string, filter: WorkPickerFilter) {
  const matcher = createSearchMatcher(query);
  return entries.filter((entry) => {
    if (filter === "FREE" && (entry.followed || entry.relatedPeople.length)) return false;
    if (filter === "FOLLOWED" && (entry.mine || !entry.followed && !entry.relatedPeople.length)) return false;
    if (filter === "MINE" && !entry.mine) return false;
    if (!matcher.normalizedQuery) return true;
    const text = [entry.title, entry.customerName, entry.kindLabel, entry.task?.owner?.name,
      ...(entry.task?.collaborators.map((person) => person.user.name) || []), ...entry.relatedPeople].filter(Boolean).join(" ");
    return matchesSearchIndexValue(createSearchIndexValue(text), matcher);
  });
}
