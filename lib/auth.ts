import { Prisma, type User } from "@prisma/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAuthSecretConfigured, readSession, serializeSession, verifyPassword } from "@/lib/auth-core";
import { prisma } from "@/lib/prisma";
import { normalizeStaffNickname } from "@/lib/staff-users";

const SESSION_COOKIE = "fede_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12;

export type LoginHealth = {
  ready: boolean;
  message?: string;
};

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

export async function requireAdmin() {
  const session = await requireAuth();
  if (session.role !== "ADMIN") {
    redirect("/");
  }

  return session;
}

export async function authenticateUser(nickname: string, password: string) {
  const normalizedNickname = normalizeStaffNickname(nickname);
  const user = await prisma.user.findUnique({
    where: { nickname: normalizedNickname }
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new Error("Credenziali non valide.");
  }

  if (!user.active) {
    throw new Error("Utente disattivato.");
  }

  return user;
}

function describePrismaAuthError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return "Database non raggiungibile. Controlla DATABASE_URL e la connessione del deploy.";
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") {
      return "Database raggiungibile ma non inizializzato. Esegui le migrazioni Prisma.";
    }

    if (error.code === "P1000" || error.code === "P1001" || error.code === "P1003") {
      return "Database non raggiungibile o credenziali non valide. Controlla DATABASE_URL.";
    }
  }

  const message = error instanceof Error ? error.message : "";
  if (/database|connection|connect|schema/i.test(message)) {
    return "Database online non pronto. Verifica migrazioni e variabili ambiente.";
  }

  return "Ambiente di accesso non pronto. Controlla database, migrazioni e variabili ambiente.";
}

export function describeLoginFailure(error: unknown) {
  if (error instanceof Error && error.message === "Credenziali non valide.") {
    return error.message;
  }

  if (error instanceof Error && error.message === "Utente disattivato.") {
    return error.message;
  }

  if (error instanceof Error && /AUTH_SECRET/i.test(error.message)) {
    return "AUTH_SECRET non configurato. Completa le variabili ambiente del deploy.";
  }

  return describePrismaAuthError(error);
}

export async function getLoginHealth(): Promise<LoginHealth> {
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      ready: false,
      message: "DATABASE_URL mancante. Il deploy non ha ancora un database configurato."
    };
  }

  if (process.env.NODE_ENV === "production" && !isAuthSecretConfigured()) {
    return {
      ready: false,
      message: "AUTH_SECRET mancante. Aggiungilo nelle variabili ambiente del deploy."
    };
  }

  try {
    const users = await prisma.user.count();
    if (users === 0) {
      return {
        ready: false,
        message: "Database pronto ma senza utenti. Esegui il bootstrap produzione per creare l'admin."
      };
    }

    return { ready: true };
  } catch (error) {
    console.error("Login health check failed", error);
    return {
      ready: false,
      message: describePrismaAuthError(error)
    };
  }
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
