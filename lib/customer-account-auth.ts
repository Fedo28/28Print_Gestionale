import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readExpiringSignedPayload, serializeExpiringSignedPayload } from "@/lib/auth-core";

export const CUSTOMER_SESSION_COOKIE = "fede_customer_session";
const CUSTOMER_SESSION_DURATION_SECONDS = 60 * 60 * 24 * 30;

export type CustomerAccountSessionPayload = {
  customerAccountId: string;
  customerId: string;
  email: string;
  exp: number;
};

export function readCustomerAccountSession(cookieValue?: string | null) {
  return readExpiringSignedPayload<CustomerAccountSessionPayload>(cookieValue);
}

export function getCustomerAccountSession() {
  return readCustomerAccountSession(cookies().get(CUSTOMER_SESSION_COOKIE)?.value);
}

export async function requireCustomerAccountAuth() {
  const session = getCustomerAccountSession();
  if (!session) {
    redirect("/shop/account/login");
  }

  return session;
}

export function createCustomerAccountSession(input: {
  customerAccountId: string;
  customerId: string;
  email: string;
}) {
  const payload: CustomerAccountSessionPayload = {
    customerAccountId: input.customerAccountId,
    customerId: input.customerId,
    email: input.email,
    exp: Date.now() + CUSTOMER_SESSION_DURATION_SECONDS * 1000
  };

  cookies().set(CUSTOMER_SESSION_COOKIE, serializeExpiringSignedPayload(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CUSTOMER_SESSION_DURATION_SECONDS
  });
}

export function clearCustomerAccountSession() {
  cookies().set(CUSTOMER_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
