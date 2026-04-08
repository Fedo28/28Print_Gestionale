import { describe, expect, it } from "vitest";
import {
  buildStaffAccessLoginUrl,
  buildStaffInvitationPreview,
  normalizeStaffNickname,
  parseStaffNickname
} from "../lib/staff-users";

describe("staff users", () => {
  it("normalizes and validates nickname values", () => {
    expect(normalizeStaffNickname("  Mario.Rossi  ")).toBe("mario.rossi");
    expect(parseStaffNickname("mario_rossi")).toBe("mario_rossi");
    expect(() => parseStaffNickname("Ma")).toThrow(/almeno 3 caratteri/i);
    expect(() => parseStaffNickname("Mario Rossi")).toThrow(/lettere minuscole/i);
  });

  it("builds the access login url only when a stable base url exists", () => {
    expect(buildStaffAccessLoginUrl("")).toBeNull();
    expect(buildStaffAccessLoginUrl("https://gestionale.example.com")).toBe("https://gestionale.example.com/login");
    expect(buildStaffAccessLoginUrl("28-print-gestionale.vercel.app")).toBe("https://28-print-gestionale.vercel.app/login");
  });

  it("renders the invitation preview with placeholder link when url is missing", () => {
    const preview = buildStaffInvitationPreview({
      name: "Marco",
      nickname: "marco.rossi",
      template: "Ciao {nome_staff} - {nickname} - {access_url}"
    });

    expect(preview.subject).toBeTruthy();
    expect(preview.body).toContain("Marco");
    expect(preview.body).toContain("marco.rossi");
    expect(preview.body).toContain("[link accesso da configurare]");
  });
});
