import { Prisma } from "@prisma/client";
import Stripe from "stripe";
import { resolveShopPublicBaseUrl } from "@/lib/domain/commerce/shop-foundation";
import { prisma } from "@/lib/prisma";
import {
  completeShopStripeCheckoutPayment,
  markShopStripeCheckoutPaymentFailed
} from "@/lib/shop-orders";

const STRIPE_MIN_EUR_CHARGE_CENTS = 50;

type StripeCheckoutAvailability = {
  enabled: boolean;
  mode: "demo" | "live" | "test";
  reason?: string;
  webhookConfigured: boolean;
};

function readOptionalEnv(name: string) {
  const value = process.env[name]?.trim();
  return value || null;
}

function readStripeSecretKey() {
  return readOptionalEnv("STRIPE_SECRET_KEY");
}

function readStripeWebhookSecret() {
  return readOptionalEnv("STRIPE_WEBHOOK_SECRET");
}

function getStripeMode(secretKey: string | null): StripeCheckoutAvailability["mode"] {
  if (!secretKey) {
    return "demo";
  }

  return secretKey.startsWith("sk_live_") ? "live" : "test";
}

function getStripeClient() {
  const secretKey = readStripeSecretKey();
  if (!secretKey) {
    throw new Error("Pagamento non disponibile.");
  }

  return new Stripe(secretKey, {
    appInfo: {
      name: "28 Print Shop"
    }
  });
}

function resolveCheckoutBaseUrl(requestOrigin?: string | null) {
  const origin = String(requestOrigin || "").trim();
  if (process.env.NODE_ENV !== "production" && /^https?:\/\//i.test(origin)) {
    const parsedOrigin = new URL(origin);
    if (parsedOrigin.hostname === "0.0.0.0") {
      parsedOrigin.hostname = "localhost";
    }

    return parsedOrigin.origin.replace(/\/+$/, "");
  }

  return resolveShopPublicBaseUrl(process.env.SHOP_PUBLIC_BASE_URL || origin);
}

function getStripeStringId(value: string | Stripe.PaymentIntent | null) {
  return typeof value === "string" ? value : value?.id || null;
}

function readMetadataValue(metadata: Stripe.Metadata | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

function buildCheckoutSessionSnapshot(
  session: Stripe.Checkout.Session,
  eventType?: string | null
) {
  return {
    amountTotal: session.amount_total,
    checkoutSessionId: session.id,
    currency: session.currency,
    eventType: eventType || null,
    livemode: session.livemode,
    paymentIntentId: getStripeStringId(session.payment_intent),
    paymentStatus: session.payment_status,
    status: session.status
  } satisfies Prisma.InputJsonObject;
}

export function getShopStripeCheckoutAvailability(): StripeCheckoutAvailability {
  const secretKey = readStripeSecretKey();
  const webhookSecret = readStripeWebhookSecret();

  if (!secretKey) {
    return {
      enabled: false,
      mode: "demo",
      reason: "STRIPE_SECRET_KEY non configurata: uso checkout demo locale.",
      webhookConfigured: Boolean(webhookSecret)
    };
  }

  return {
    enabled: true,
    mode: getStripeMode(secretKey),
    webhookConfigured: Boolean(webhookSecret)
  };
}

export async function createShopStripeCheckoutSession(input: {
  customerAccountId: string;
  requestOrigin?: string | null;
  salesOrderId: string;
}) {
  const customerAccountId = String(input.customerAccountId || "").trim();
  const salesOrderId = String(input.salesOrderId || "").trim();
  if (!customerAccountId || !salesOrderId) {
    throw new Error("Ordine shop non disponibile.");
  }

  const salesOrder = await prisma.salesOrder.findFirst({
    where: {
      customerAccountId,
      id: salesOrderId,
      origin: "SHOP_ONLINE"
    },
    select: {
      currency: true,
      customer: {
        select: {
          email: true,
          name: true,
          phone: true
        }
      },
      id: true,
      invoiceRequested: true,
      items: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          label: true
        }
      },
      orderCode: true,
      status: true,
      totalCents: true
    }
  });

  if (!salesOrder) {
    throw new Error("Ordine shop non disponibile.");
  }

  if (salesOrder.status === "PAID" || salesOrder.status === "FULFILLED") {
    throw new Error("Pagamento non disponibile.");
  }

  if (!Number.isFinite(salesOrder.totalCents) || salesOrder.totalCents < STRIPE_MIN_EUR_CHARGE_CENTS) {
    throw new Error("Importo ordine non valido per il pagamento online.");
  }

  const stripe = getStripeClient();
  const baseUrl = resolveCheckoutBaseUrl(input.requestOrigin);
  const orderUrl = `${baseUrl}/shop/orders/${salesOrder.id}`;
  const currency = salesOrder.currency.toLowerCase() || "eur";
  const primaryLabel = salesOrder.items[0]?.label || "Stampa documenti";
  const metadata = {
    customerAccountId,
    salesOrderCode: salesOrder.orderCode,
    salesOrderId: salesOrder.id
  };
  const session = await stripe.checkout.sessions.create({
    cancel_url: `${orderUrl}?checkout=cancelled`,
    client_reference_id: salesOrder.id,
    customer_email: salesOrder.customer.email || undefined,
    line_items: [
      {
        price_data: {
          currency,
          product_data: {
            description: salesOrder.orderCode,
            name: primaryLabel
          },
          unit_amount: salesOrder.totalCents
        },
        quantity: 1
      }
    ],
    metadata,
    mode: "payment",
    payment_intent_data: {
      metadata
    },
    phone_number_collection: {
      enabled: true
    },
    success_url: `${orderUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`
  });

  const paymentIntentId = getStripeStringId(session.payment_intent);
  const existingPayment = await prisma.paymentRecord.findFirst({
    where: {
      salesOrderId: salesOrder.id,
      status: {
        in: ["CREATED", "PENDING"]
      }
    },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      providerCheckoutSessionId: true
    }
  });

  const paymentData = {
    amountCents: salesOrder.totalCents,
    currency: salesOrder.currency,
    providerCheckoutSessionId: session.id,
    providerPaymentIntentId: paymentIntentId || undefined,
    rawProviderSnapshot: buildCheckoutSessionSnapshot(session, "checkout.session.created"),
    status: "PENDING" as const
  };

  if (existingPayment && !existingPayment.providerCheckoutSessionId) {
    await prisma.paymentRecord.update({
      where: { id: existingPayment.id },
      data: paymentData
    });
  } else {
    await prisma.paymentRecord.create({
      data: {
        ...paymentData,
        salesOrderId: salesOrder.id
      }
    });
  }

  return {
    checkoutSessionId: session.id,
    checkoutUrl: session.url,
    mode: getShopStripeCheckoutAvailability().mode
  };
}

export async function syncShopStripeCheckoutSessionForCustomer(input: {
  checkoutSessionId: string;
  customerAccountId: string;
}) {
  const checkoutSessionId = String(input.checkoutSessionId || "").trim();
  const customerAccountId = String(input.customerAccountId || "").trim();
  if (!checkoutSessionId || !customerAccountId) {
    return null;
  }

  const session = await getStripeClient().checkout.sessions.retrieve(checkoutSessionId);
  const salesOrderId = readMetadataValue(session.metadata, "salesOrderId");
  const sessionCustomerAccountId = readMetadataValue(session.metadata, "customerAccountId");

  if (!salesOrderId || sessionCustomerAccountId !== customerAccountId) {
    return null;
  }

  if (session.payment_status !== "paid") {
    return null;
  }

  return completeShopStripeCheckoutPayment({
    amountTotalCents: session.amount_total,
    checkoutSessionId: session.id,
    currency: session.currency,
    eventType: "checkout.session.return_sync",
    paymentIntentId: getStripeStringId(session.payment_intent),
    rawProviderSnapshot: buildCheckoutSessionSnapshot(session, "checkout.session.return_sync"),
    salesOrderId
  });
}

export function constructStripeWebhookEvent(input: {
  payload: string;
  signature: string | null;
}) {
  const webhookSecret = readStripeWebhookSecret();
  if (!webhookSecret || !input.signature) {
    throw new Error("Pagamento non disponibile.");
  }

  return getStripeClient().webhooks.constructEvent(
    input.payload,
    input.signature,
    webhookSecret
  );
}

export async function processStripeWebhookEvent(input: {
  event: Stripe.Event;
  payloadJson: Prisma.InputJsonValue;
}) {
  const object = input.event.data.object as { id?: string };
  const existingEvent = await prisma.paymentWebhookEvent.findUnique({
    where: {
      providerEventId: input.event.id
    },
    select: {
      processingStatus: true
    }
  });

  if (existingEvent?.processingStatus === "PROCESSED") {
    return {
      duplicate: true,
      processed: true
    };
  }

  await prisma.paymentWebhookEvent.upsert({
    where: {
      providerEventId: input.event.id
    },
    update: {
      eventType: input.event.type,
      objectId: object.id || null,
      payloadJson: input.payloadJson,
      processingStatus: "PENDING"
    },
    create: {
      eventType: input.event.type,
      objectId: object.id || null,
      payloadJson: input.payloadJson,
      providerEventId: input.event.id
    }
  });

  try {
    await handleStripeWebhookEvent(input.event);

    await prisma.paymentWebhookEvent.update({
      where: {
        providerEventId: input.event.id
      },
      data: {
        processedAt: new Date(),
        processingStatus: "PROCESSED"
      }
    });

    return {
      duplicate: false,
      processed: true
    };
  } catch (error) {
    await prisma.paymentWebhookEvent.update({
      where: {
        providerEventId: input.event.id
      },
      data: {
        processedAt: new Date(),
        processingStatus: "FAILED"
      }
    });
    throw error;
  }
}

async function handleStripeWebhookEvent(event: Stripe.Event) {
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status !== "paid") {
      return null;
    }

    return completeShopStripeCheckoutPayment({
      amountTotalCents: session.amount_total,
      checkoutSessionId: session.id,
      currency: session.currency,
      eventType: event.type,
      paymentIntentId: getStripeStringId(session.payment_intent),
      rawProviderSnapshot: buildCheckoutSessionSnapshot(session, event.type),
      salesOrderId: readMetadataValue(session.metadata, "salesOrderId")
    });
  }

  if (
    event.type === "checkout.session.async_payment_failed" ||
    event.type === "checkout.session.expired"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;

    return markShopStripeCheckoutPaymentFailed({
      amountTotalCents: session.amount_total,
      checkoutSessionId: session.id,
      currency: session.currency,
      eventType: event.type,
      failureCode: event.type,
      failureMessage:
        event.type === "checkout.session.expired"
          ? "Sessione di pagamento scaduta."
          : "Pagamento asincrono non riuscito.",
      paymentIntentId: getStripeStringId(session.payment_intent),
      rawProviderSnapshot: buildCheckoutSessionSnapshot(session, event.type),
      salesOrderId: readMetadataValue(session.metadata, "salesOrderId")
    });
  }

  if (event.type === "payment_intent.payment_failed") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;

    return markShopStripeCheckoutPaymentFailed({
      amountTotalCents: paymentIntent.amount,
      currency: paymentIntent.currency,
      eventType: event.type,
      failureCode: paymentIntent.last_payment_error?.code || event.type,
      failureMessage: paymentIntent.last_payment_error?.message || "Pagamento non riuscito.",
      paymentIntentId: paymentIntent.id,
      rawProviderSnapshot: {
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        eventType: event.type,
        lastPaymentErrorCode: paymentIntent.last_payment_error?.code || null,
        lastPaymentErrorMessage: paymentIntent.last_payment_error?.message || null,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status
      } satisfies Prisma.InputJsonObject,
      salesOrderId: readMetadataValue(paymentIntent.metadata, "salesOrderId")
    });
  }

  return null;
}
