import { describe, expect, it } from "vitest";
import { canManageTask, getWeekDays, isTaskParticipant, isValidDay, shiftDay, validateNoteInput, validateTaskInput } from "../lib/personal-workspace-domain";
import type { TaskInput, WorkspaceActor } from "../lib/personal-workspace-domain";

const input: TaskInput = { title: "Ritirare materiale", description: "", orderId: null, ownerId: "owner", status: "OPEN",
  scheduledDate: null, startTime: null, endTime: null, collaborators: [] };

describe("personal planning", () => {
  it("allows unscheduled and unassigned commissions", () => {
    expect(validateTaskInput({ ...input, ownerId: null })).toMatchObject({ ownerId: null, scheduledDate: null });
  });
  it("allows a planned day without time", () => {
    expect(validateTaskInput({ ...input, scheduledDate: "2026-10-08" })).toMatchObject({ startTime: null, endTime: null });
  });
  it("rejects invalid dates and times rather than silently changing them", () => {
    expect(isValidDay("2026-02-29")).toBe(false);
    expect(isValidDay("2028-02-29")).toBe(true);
    expect(() => validateTaskInput({ ...input, scheduledDate: "2026-02-30" })).toThrow(/data valida/);
    expect(() => validateTaskInput({ ...input, startTime: "09:00" })).toThrow(/giorno/);
    expect(() => validateTaskInput({ ...input, scheduledDate: "2026-10-08", startTime: "25:00" })).toThrow(/Orario/);
    expect(() => validateTaskInput({ ...input, scheduledDate: "2026-10-08", startTime: "10:00", endTime: "09:00" })).toThrow(/successivo/);
  });
  it("builds complete weeks across the daylight saving change and year boundary", () => {
    expect(getWeekDays("2026-10-25")).toEqual(["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25"]);
    expect(getWeekDays("2027-01-01")[0]).toBe("2026-12-28");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("includes collaborators in their own agenda without duplicating the owner", () => {
    const task = { ownerId: "owner", createdById: "creator", collaborators: [{ userId: "helper" }] };
    expect(isTaskParticipant(task, "helper")).toBe(true);
    expect(isTaskParticipant(task, "unrelated")).toBe(false);
    const cleaned = validateTaskInput({ ...input, collaborators: [{ userId: "owner", role: "" }, { userId: "helper", role: "  Montaggio " }] });
    expect(cleaned.collaborators).toEqual([{ userId: "helper", role: "Montaggio" }]);
  });
  it("limits editing to participants, creators and administrators", () => {
    const task = { ownerId: "owner", createdById: "creator", collaborators: [{ userId: "helper" }] };
    for (const id of ["owner", "creator", "helper"]) expect(canManageTask(task, { id, role: "OPERATOR" } as WorkspaceActor)).toBe(true);
    expect(canManageTask(task, { id: "unrelated", role: "OPERATOR" })).toBe(false);
    expect(canManageTask(task, { id: "admin", role: "ADMIN" })).toBe(true);
  });
});

describe("personal post-its", () => {
  it("preserves body formatting and allows an empty new note", () => {
    expect(validateNoteInput({ id: "note", version: 0, title: " Promemoria ", content: "  una riga\n\n", color: "YELLOW" })).toMatchObject({ title: "Promemoria", content: "  una riga\n\n" });
    expect(validateNoteInput({ id: "note", version: 0, title: "", content: "", color: "BLUE" }).content).toBe("");
  });
  it("rejects unsupported colors and invalid editing versions", () => {
    expect(() => validateNoteInput({ id: "note", version: 0, title: "", content: "", color: "__proto__" as never })).toThrow(/Colore/);
    expect(() => validateNoteInput({ id: "note", version: -1, title: "", content: "", color: "YELLOW" })).toThrow(/Ricarica/);
  });
});
