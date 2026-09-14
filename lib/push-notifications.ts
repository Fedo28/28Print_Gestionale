import webPush from "web-push";
import { formatCurrency } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export type StaffPushClientConfig = {
  enabled: boolean;
  publicKey: string | null;
  reason?: string;
};

export type StaffPushSubscriptionInput = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    auth: string;
    p256dh: string;
  };
};

type StaffPushNotificationPayload = {
  body: string;
  href: string;
  orderCode: string;
  orderId: string;
  shopOrderCode: string;
  tag: string;
  title: string;
  totalLabel: string;
  type: "SHOP_ONLINE_ORDER_RECEIVED";
};

type ShopOnlinePushInput = {
  customerName: string;
  internalOrderId: string;
  internalOrderCode: string;
  salesOrderCode: string;
  totalCents: number;
};

function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

function normalizeVapidSubject(value: string | null) {
  if (!value) {
    return "mailto:shop@28print.it";
  }

  if (/^(mailto:|https?:\/\/)/i.test(value)) {
    return value;
  }

  if (value.includes("@")) {
    return `mailto:${value}`;
  }

  return "mailto:shop@28print.it";
}

function getWebPushServerConfig() {
  const publicKey =
    readOptionalEnv("WEB_PUSH_VAPID_PUBLIC_KEY") ||
    readOptionalEnv("NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY");
  const privateKey = readOptionalEnv("WEB_PUSH_VAPID_PRIVATE_KEY");

  if (!publicKey || !privateKey) {
    return null;
  }

  return {
    publicKey,
    privateKey,
    subject: normalizeVapidSubject(
      readOptionalEnv("WEB_PUSH_VAPID_SUBJECT") ||
      readOptionalEnv("WEB_PUSH_CONTACT")
    )
  };
}

export function getStaffPushClientConfig(): StaffPushClientConfig {
  const config = getWebPushServerConfig();
  if (!config) {
    return {
      enabled: false,
      publicKey: null,
      reason: "Chiavi Web Push non configurate."
    };
  }

  return {
    enabled: true,
    publicKey: config.publicKey
  };
}

export function parseStaffPushSubscriptionInput(value: unknown): StaffPushSubscriptionInput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const keys = record.keys && typeof record.keys === "object"
    ? record.keys as Record<string, unknown>
    : null;
  const endpoint = typeof record.endpoint === "string" ? record.endpoint.trim() : "";
  const p256dh = typeof keys?.p256dh === "string" ? keys.p256dh.trim() : "";
  const auth = typeof keys?.auth === "string" ? keys.auth.trim() : "";
  const expirationTime = typeof record.expirationTime === "number" ? record.expirationTime : null;

  if (!endpoint || !p256dh || !auth) {
    return null;
  }

  return {
    endpoint,
    expirationTime,
    keys: {
      auth,
      p256dh
    }
  };
}

export async function registerStaffPushSubscription(input: {
  subscription: StaffPushSubscriptionInput;
  userAgent?: string | null;
  userId: string;
}) {
  const now = new Date();

  await prisma.staffPushSubscription.upsert({
    where: {
      endpoint: input.subscription.endpoint
    },
    update: {
      active: true,
      auth: input.subscription.keys.auth,
      failedAt: null,
      failureReason: null,
      lastSeenAt: now,
      p256dh: input.subscription.keys.p256dh,
      userAgent: input.userAgent || undefined,
      userId: input.userId
    },
    create: {
      auth: input.subscription.keys.auth,
      endpoint: input.subscription.endpoint,
      lastSeenAt: now,
      p256dh: input.subscription.keys.p256dh,
      userAgent: input.userAgent || undefined,
      userId: input.userId
    }
  });
}

export async function disableStaffPushSubscription(input: {
  endpoint: string;
  reason?: string;
  userId: string;
}) {
  const endpoint = input.endpoint.trim();
  if (!endpoint) {
    return;
  }

  await prisma.staffPushSubscription.updateMany({
    where: {
      endpoint,
      userId: input.userId
    },
    data: {
      active: false,
      failedAt: new Date(),
      failureReason: input.reason || "Disattivata dal dispositivo."
    }
  });
}

function getPushErrorStatusCode(error: unknown) {
  if (!error || typeof error !== "object") {
    return null;
  }

  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === "number" ? statusCode : null;
}

function getPushErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Invio push non riuscito.";
}

export async function sendShopOnlineOrderPushNotification(input: ShopOnlinePushInput) {
  const config = getWebPushServerConfig();
  if (!config) {
    return {
      attempted: 0,
      disabled: 0,
      failed: 0,
      sent: 0,
      skippedReason: "web_push_not_configured"
    };
  }

  webPush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  const subscriptions = await prisma.staffPushSubscription.findMany({
    where: {
      active: true,
      user: {
        active: true
      }
    },
    select: {
      auth: true,
      endpoint: true,
      id: true,
      p256dh: true
    }
  });

  if (!subscriptions.length) {
    return {
      attempted: 0,
      disabled: 0,
      failed: 0,
      sent: 0,
      skippedReason: "no_active_subscriptions"
    };
  }

  const payload: StaffPushNotificationPayload = {
    body: `${input.customerName} - ${formatCurrency(input.totalCents)}`,
    href: `/orders/${input.internalOrderId}`,
    orderCode: input.internalOrderCode,
    orderId: input.internalOrderId,
    shopOrderCode: input.salesOrderCode,
    tag: `28print-shop-order-${input.internalOrderId}`,
    title: "Nuovo ordine shop online",
    totalLabel: formatCurrency(input.totalCents),
    type: "SHOP_ONLINE_ORDER_RECEIVED"
  };
  const sentAt = new Date();
  let disabled = 0;
  let failed = 0;
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: {
              auth: subscription.auth,
              p256dh: subscription.p256dh
            }
          },
          JSON.stringify(payload)
        );

        sent += 1;
        await prisma.staffPushSubscription.update({
          where: {
            id: subscription.id
          },
          data: {
            active: true,
            failedAt: null,
            failureReason: null,
            lastSentAt: sentAt,
            lastSeenAt: sentAt
          }
        });
      } catch (error) {
        failed += 1;
        const statusCode = getPushErrorStatusCode(error);
        const shouldDisable = statusCode === 404 || statusCode === 410;
        if (shouldDisable) {
          disabled += 1;
        }

        await prisma.staffPushSubscription.update({
          where: {
            id: subscription.id
          },
          data: {
            active: !shouldDisable,
            failedAt: new Date(),
            failureReason: getPushErrorMessage(error)
          }
        });
      }
    })
  );

  return {
    attempted: subscriptions.length,
    disabled,
    failed,
    sent
  };
}
