import { describe, expect, it } from "vitest";
import { getWorkdayHighlight } from "../lib/workday-highlights";

describe("workday highlights", () => {
  it("marks today, next and next-after business day", () => {
    const referenceDate = new Date("2026-04-09T09:00:00.000Z");

    expect(getWorkdayHighlight(new Date("2026-04-09T12:00:00.000Z"), referenceDate)).toBe("today");
    expect(getWorkdayHighlight(new Date("2026-04-10T12:00:00.000Z"), referenceDate)).toBe("priority-next");
    expect(getWorkdayHighlight(new Date("2026-04-13T12:00:00.000Z"), referenceDate)).toBe("priority-later");
  });

  it("skips weekend when reference day is friday", () => {
    const referenceDate = new Date("2026-04-10T09:00:00.000Z");

    expect(getWorkdayHighlight(new Date("2026-04-11T12:00:00.000Z"), referenceDate)).toBe("weekend");
    expect(getWorkdayHighlight(new Date("2026-04-12T12:00:00.000Z"), referenceDate)).toBe("weekend");
    expect(getWorkdayHighlight(new Date("2026-04-13T12:00:00.000Z"), referenceDate)).toBe("priority-next");
    expect(getWorkdayHighlight(new Date("2026-04-14T12:00:00.000Z"), referenceDate)).toBe("priority-later");
  });
});
