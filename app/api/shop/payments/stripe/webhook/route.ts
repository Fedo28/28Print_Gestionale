import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import {
  constructStripeWebhookEvent,
  processStripeWebhookEvent
} from "@/lib/shop-payments";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature");

  let event;
  try {
    event = constructStripeWebhookEvent({
      payload,
      signature
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Webhook Stripe non valido."
      },
      { status: 400 }
    );
  }

  try {
    const result = await processStripeWebhookEvent({
      event,
      payloadJson: JSON.parse(payload) as Prisma.InputJsonValue
    });

    revalidatePath("/");
    revalidatePath("/orders");
    revalidatePath("/production");
    revalidatePath("/shop/account");

    return NextResponse.json({
      received: true,
      ...result
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Webhook Stripe non processato."
      },
      { status: 500 }
    );
  }
}
