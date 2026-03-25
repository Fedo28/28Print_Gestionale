import { describe, expect, it } from "vitest";
import { resolveAttachmentStorageMode } from "../lib/storage";

describe("attachment storage", () => {
  it("uses local storage in development without blob token", () => {
    expect(resolveAttachmentStorageMode({ nodeEnv: "development", blobToken: "" })).toBe("local");
  });

  it("uses blob storage in production", () => {
    expect(resolveAttachmentStorageMode({ nodeEnv: "production", blobToken: "" })).toBe("blob");
  });

  it("allows blob storage in development when token is configured", () => {
    expect(resolveAttachmentStorageMode({ nodeEnv: "development", blobToken: "token" })).toBe("blob");
  });
});
