import { describe, expect, it } from "vitest";
import { parseStaffPushSubscriptionInput } from "../lib/push-notifications";

describe("push notifications helpers", () => {
  it("accepts a complete browser push subscription", () => {
    expect(
      parseStaffPushSubscriptionInput({
        endpoint: "https://push.example.test/subscription/123",
        expirationTime: null,
        keys: {
          auth: "auth-token",
          p256dh: "public-key"
        }
      })
    ).toEqual({
      endpoint: "https://push.example.test/subscription/123",
      expirationTime: null,
      keys: {
        auth: "auth-token",
        p256dh: "public-key"
      }
    });
  });

  it("rejects incomplete browser push subscriptions", () => {
    expect(
      parseStaffPushSubscriptionInput({
        endpoint: "https://push.example.test/subscription/123",
        keys: {
          auth: "auth-token"
        }
      })
    ).toBeNull();
  });
});
