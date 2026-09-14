import { Prisma } from "@prisma/client";
import { hashPassword, isAuthSecretConfigured, verifyPassword } from "@/lib/auth-core";
import { prisma } from "@/lib/prisma";

export type CustomerAccountHealth = {
  ready: boolean;
  message?: string;
};

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function describeCustomerAccountPrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return "Database non raggiungibile. Controlla DATABASE_URL e la connessione dell'ambiente shop.";
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") {
      return "Database raggiungibile ma non inizializzato. Applica prima le migrazioni Prisma.";
    }

    if (error.code === "P1000" || error.code === "P1001" || error.code === "P1003") {
      return "Database non raggiungibile o credenziali non valide. Controlla DATABASE_URL.";
    }
  }

  const message = error instanceof Error ? error.message : "";
  if (/database|connection|connect|schema/i.test(message)) {
    return "Database shop non pronto. Verifica migrazioni e variabili ambiente.";
  }

  return "Ambiente shop non pronto. Controlla database, migrazioni e variabili ambiente.";
}

export function normalizeCustomerAccountFullName(value: string) {
  const normalized = normalizeWhitespace(String(value || ""));
  if (normalized.length < 2) {
    throw new Error("Inserisci nome e cognome del cliente.");
  }

  return normalized;
}

export function normalizeCustomerAccountPhone(value: string) {
  const normalized = normalizeWhitespace(String(value || ""));
  const digits = normalized.replace(/[^\d]/g, "");

  if (digits.length < 6) {
    throw new Error("Inserisci un numero di telefono valido.");
  }

  return normalized;
}

export function normalizeCustomerAccountEmail(value: string, options?: { allowEmpty?: boolean }) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    if (options?.allowEmpty) {
      return "";
    }

    throw new Error("Email obbligatoria.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Inserisci un'email valida.");
  }

  return normalized;
}

export function validateCustomerAccountPassword(value: string) {
  const password = String(value || "");
  if (password.length < 8) {
    throw new Error("La password deve contenere almeno 8 caratteri.");
  }

  return password;
}

export async function getCustomerAccountHealth(): Promise<CustomerAccountHealth> {
  if (!process.env.DATABASE_URL?.trim()) {
    return {
      ready: false,
      message: "DATABASE_URL mancante. L'area clienti non ha ancora un database configurato."
    };
  }

  if (process.env.NODE_ENV === "production" && !isAuthSecretConfigured()) {
    return {
      ready: false,
      message: "AUTH_SECRET mancante. Serve anche per la sessione cliente."
    };
  }

  try {
    await prisma.customerAccount.count();
    return { ready: true };
  } catch (error) {
    console.error("Customer account health check failed", error);
    return {
      ready: false,
      message: describeCustomerAccountPrismaError(error)
    };
  }
}

export async function registerCustomerAccount(input: {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}) {
  const fullName = normalizeCustomerAccountFullName(input.fullName);
  const email = normalizeCustomerAccountEmail(input.email);
  const phone = normalizeCustomerAccountPhone(input.phone);
  const password = validateCustomerAccountPassword(input.password);

  const existingAccount = await prisma.customerAccount.findUnique({
    where: { emailNormalized: email },
    select: { id: true }
  });

  if (existingAccount) {
    throw new Error("Esiste gia un account cliente con questa email.");
  }

  return prisma.$transaction(async (tx) => {
    const existingCustomer = await tx.customer.findFirst({
      where: {
        email: {
          equals: email,
          mode: "insensitive"
        }
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        type: true
      }
    });

    const customer =
      existingCustomer
        ? await tx.customer.update({
            where: { id: existingCustomer.id },
            data: {
              phone: existingCustomer.phone?.trim() ? undefined : phone
            },
            select: {
              id: true,
              name: true,
              email: true,
              type: true
            }
          })
        : await tx.customer.create({
            data: {
              name: fullName,
              email,
              phone
            },
            select: {
              id: true,
              name: true,
              email: true,
              type: true
            }
          });

    const account = await tx.customerAccount.create({
      data: {
        customerId: customer.id,
        email,
        emailNormalized: email,
        passwordHash: hashPassword(password)
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
            type: true
          }
        }
      }
    });

    return account;
  });
}

export async function authenticateCustomerAccount(input: { email: string; password: string }) {
  const email = normalizeCustomerAccountEmail(input.email);
  const password = String(input.password || "");
  const account = await prisma.customerAccount.findUnique({
    where: { emailNormalized: email },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          type: true
        }
      }
    }
  });

  if (!account || !verifyPassword(password, account.passwordHash)) {
    throw new Error("Credenziali non valide.");
  }

  if (account.status !== "ACTIVE") {
    throw new Error("Account cliente disattivato.");
  }

  return prisma.customerAccount.update({
    where: { id: account.id },
    data: { lastLoginAt: new Date() },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          type: true
        }
      }
    }
  });
}

export async function getCustomerAccountDashboard(accountId: string) {
  return prisma.customerAccount.findUnique({
    where: { id: accountId },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      createdAt: true,
      _count: {
        select: {
          salesOrders: true
        }
      },
      customer: {
        select: {
          id: true,
          name: true,
          type: true,
          email: true,
          phone: true,
          _count: {
            select: {
              addresses: true,
              billingProfiles: true,
              fileAssets: true,
              salesOrders: true
            }
          }
        }
      }
    }
  });
}

export function describeCustomerAccountFailure(error: unknown) {
  if (
    error instanceof Error &&
    [
      "Email obbligatoria.",
      "Inserisci un'email valida.",
      "Inserisci nome e cognome del cliente.",
      "Inserisci un numero di telefono valido.",
      "La password deve contenere almeno 8 caratteri.",
      "Le password non coincidono.",
      "Credenziali non valide.",
      "Account cliente disattivato.",
      "Esiste gia un account cliente con questa email."
    ].includes(error.message)
  ) {
    return error.message;
  }

  if (error instanceof Error && /AUTH_SECRET/i.test(error.message)) {
    return "AUTH_SECRET non configurato. Serve per proteggere anche la sessione cliente.";
  }

  return describeCustomerAccountPrismaError(error);
}
