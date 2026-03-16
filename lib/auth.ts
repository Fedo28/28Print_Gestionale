import type { User } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSession, serializeSession, verifyPassword } from "@/lib/auth-core";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "fede_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12;

export function getSession() {
  return readSession(cookies().get(SESSION_COOKIE)?.value);
}

export async function requireAuth() {
  const session = getSession();
  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function authenticateUser(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail }
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error("Credenziali non valide.");
  }

  return user;
}

export async function createSessionForUser(user: Pick<User, "id" | "role">) {
  const payload = {
    userId: user.id,
    role: user.role,
    exp: Date.now() + SESSION_DURATION_SECONDS * 1000
  };

  cookies().set(SESSION_COOKIE, serializeSession(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS
  });
}

export function clearSession() {
  cookies().set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
