import { describe, expect, it } from "vitest";
import { buildWorkPickerEntries, filterWorkPickerEntries } from "../lib/workspace-work-picker";
import type { WorkspacePickerOrder, WorkspaceTask } from "../lib/personal-workspace-domain";

const order: WorkspacePickerOrder = { id: "order-1", title: "Insegna in dibond", customerName: "Caffè Bianchi", deliveryAt: "2026-10-12T10:00:00Z", mainPhase: "ACCETTATO" };
const profile = (id: string) => ({ id, name: id === "rick" ? "Riccardo" : "Fedo", nickname: id, active: true });
function task(input: Partial<WorkspaceTask> = {}): WorkspaceTask {
  return { id: "task-1", title: "Ritirare materiale", description: "", orderId: null, claimKey: null,
    ownerId: "rick", createdById: "rick", owner: profile("rick"), status: "OPEN", scheduledDate: null,
    startTime: null, endTime: null, version: 0, completedAt: null, archivedAt: null,
    createdAt: "2026-10-09T10:00:00Z", collaborators: [], order: null, ...input };
}

describe("workspace work picker", () => {
  it("shows open orders and individual commissions without duplicating primary assignments", () => {
    const primary = task({ orderId: order.id, claimKey: `order:${order.id}` });
    const records = buildWorkPickerEntries([order, { ...order, id: "closed", mainPhase: "CONSEGNATO" }], [primary, task({ id: "commission" }), task({ id: "done", status: "DONE" }), task({ id: "archived", archivedAt: "2026-10-09" })], "fedo");
    expect(records.map((entry) => entry.key)).toEqual(["order:order-1", "task:commission"]);
    expect(records[0].task?.owner?.name).toBe("Riccardo");
  });
  it("marks collaborators as already participating, not as candidates for a duplicate claim", () => {
    const primary = task({ claimKey: `order:${order.id}`, orderId: order.id, collaborators: [{ userId: "fedo", role: "Montaggio", user: profile("fedo") }] });
    expect(buildWorkPickerEntries([order], [primary], "fedo")[0]).toMatchObject({ mine: true, followed: true });
  });
  it("reveals existing specific activities even when no one has claimed the entire order", () => {
    const specific = task({ orderId: order.id, title: "Montaggio" });
    const records = buildWorkPickerEntries([order], [specific], "fedo");
    expect(records[0].relatedPeople).toEqual(["Riccardo"]);
    expect(records[1].kindLabel).toBe("Attività");
    expect(filterWorkPickerEntries(records, "", "FREE")).toEqual([]);
  });
  it("searches customers and colleagues ignoring accents, spaces and case", () => {
    const records = buildWorkPickerEntries([order], [task()], "fedo");
    expect(filterWorkPickerEntries(records, "CAFFEBIANCHI", "ALL").map((entry) => entry.key)).toEqual(["order:order-1"]);
    expect(filterWorkPickerEntries(records, "riccardo materiale", "ALL").map((entry) => entry.key)).toEqual(["task:task-1"]);
  });
  it("filters free work, other people's work and the user's own assignments", () => {
    const records = buildWorkPickerEntries([order], [task(), task({ id: "mine", ownerId: "fedo", owner: profile("fedo") })], "fedo");
    expect(filterWorkPickerEntries(records, "", "FREE").map((entry) => entry.key)).toEqual(["order:order-1"]);
    expect(filterWorkPickerEntries(records, "", "FOLLOWED").map((entry) => entry.key)).toEqual(["task:task-1"]);
    expect(filterWorkPickerEntries(records, "", "MINE").map((entry) => entry.key)).toEqual(["task:mine"]);
  });
});
