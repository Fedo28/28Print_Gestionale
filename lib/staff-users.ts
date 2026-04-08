import { Prisma, UserRole } from "@prisma/client";
import { hashPassword } from "@/lib/auth-core";
import {
  DEFAULT_STAFF_INVITE_EMAIL_SUBJECT,
  DEFAULT_STAFF_INVITE_EMAIL_TEMPLATE
} from "@/lib/constants";
import { sendTextEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import {
  getStaffAccessBaseUrl,
  getStaffInviteEmailSubject,
  getStaffInviteEmailTemplate
} from "@/lib/settings";

export type CreateStaffUserInput = {
  name: string;
  nickname: string;
  email: string;
  password: string;
  role: UserRole;
};

export function normalizeStaffNickname(raw: string) {
  return raw.trim().toLowerCase();
}

function normalizeStaffAccessBaseUrl(raw: string) {
  const value = raw.trim();
  if (!value) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;

  try {
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

function normalizeStaffEmail(raw: string) {
  return raw.trim().toLowerCase();
}

export function parseStaffNickname(raw: string) {
  const value = normalizeStaffNickname(raw);
  if (!value) {
    throw new Error("Il nickname e obbligatorio.");
  }

  if (value.length < 3) {
    throw new Error("Il nickname deve avere almeno 3 caratteri.");
  }

  if (!/^[a-z0-9._-]+$/.test(value)) {
    throw new Error("Il nickname puo contenere solo lettere minuscole, numeri, punto, trattino o underscore.");
  }

  return value;
}

function parseStaffEmail(raw: string) {
  const value = normalizeStaffEmail(raw);
  if (!value) {
    throw new Error("L'email e obbligatoria.");
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new Error("Email non valida.");
  }

  return value;
}

function parseStaffPassword(raw: string) {
  if (!raw) {
    throw new Error("La password iniziale e obbligatoria.");
  }

  if (raw.length < 8) {
    throw new Error("La password iniziale deve avere almeno 8 caratteri.");
  }

  return raw;
}

function parseStaffName(raw: string) {
  const value = raw.trim();
  if (!value) {
    throw new Error("Il nome profilo e obbligatorio.");
  }

  return value;
}

export function buildStaffAccessLoginUrl(baseUrl: string) {
  const value = normalizeStaffAccessBaseUrl(baseUrl);
  if (!value) {
    return null;
  }

  try {
    return new URL("/login", value).toString();
  } catch {
    return null;
  }
}

function getDefaultStaffAccessBaseUrlFromEnv() {
  const candidates = [
    process.env.STAFF_ACCESS_BASE_URL,
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL
  ];

  for (const candidate of candidates) {
    const normalized = normalizeStaffAccessBaseUrl(candidate || "");
    if (normalized) {
      return normalized;
    }
  }

  return "";
}

export async function getStaffInviteConfig(options?: { requestBaseUrl?: string | null }) {
  const [accessBaseUrl, subject, template] = await Promise.all([
    getStaffAccessBaseUrl(),
    getStaffInviteEmailSubject(),
    getStaffInviteEmailTemplate()
  ]);

  const resolvedAccessBaseUrl =
    normalizeStaffAccessBaseUrl(accessBaseUrl) ||
    normalizeStaffAccessBaseUrl(options?.requestBaseUrl || "") ||
    getDefaultStaffAccessBaseUrlFromEnv();

  return {
    accessBaseUrl: resolvedAccessBaseUrl,
    subject: subject.trim() || DEFAULT_STAFF_INVITE_EMAIL_SUBJECT,
    template: template.trim() || DEFAULT_STAFF_INVITE_EMAIL_TEMPLATE,
    accessLoginUrl: buildStaffAccessLoginUrl(resolvedAccessBaseUrl)
  };
}

export function buildStaffInvitationPreview(input: {
  name: string;
  nickname: string;
  subject?: string;
  template?: string;
  accessBaseUrl?: string;
}) {
  const subject = input.subject?.trim() || DEFAULT_STAFF_INVITE_EMAIL_SUBJECT;
  const template = input.template?.trim() || DEFAULT_STAFF_INVITE_EMAIL_TEMPLATE;
  const accessLoginUrl = buildStaffAccessLoginUrl(input.accessBaseUrl || "");

  return {
    subject,
    accessLoginUrl,
    body: template
      .replaceAll("{nome_staff}", input.name.trim() || "Nome collega")
      .replaceAll("{nickname}", parseStaffNickname(input.nickname))
      .replaceAll("{access_url}", accessLoginUrl || "[link accesso da configurare]")
  };
}

export async function getStaffUsersAdmin() {
  return prisma.user.findMany({
    orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      nickname: true,
      email: true,
      role: true,
      active: true,
      invitePreparedAt: true,
      inviteSentAt: true,
      createdAt: true
    }
  });
}

function describeStaffUserMutationError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = Array.isArray(error.meta?.target) ? error.meta?.target.join(",") : String(error.meta?.target || "");
    if (/nickname/i.test(target)) {
      return "Questo nickname e gia in uso.";
    }

    if (/email/i.test(target)) {
      return "Questa email e gia associata a un altro profilo.";
    }
  }

  return error instanceof Error ? error.message : "Impossibile salvare il profilo staff.";
}

function sanitizeUpdateNicknameError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return "Questo nickname e gia in uso.";
  }

  return error instanceof Error ? error.message : "Impossibile aggiornare il nickname.";
}

export async function createStaffUser(input: CreateStaffUserInput) {
  const name = parseStaffName(input.name);
  const nickname = parseStaffNickname(input.nickname);
  const email = parseStaffEmail(input.email);
  const password = parseStaffPassword(input.password);

  const [nicknameOwner, emailOwner] = await Promise.all([
    prisma.user.findUnique({ where: { nickname }, select: { id: true } }),
    prisma.user.findUnique({ where: { email }, select: { id: true } })
  ]);

  if (nicknameOwner) {
    throw new Error("Questo nickname e gia in uso.");
  }

  if (emailOwner) {
    throw new Error("Questa email e gia associata a un altro profilo.");
  }

  try {
    return await prisma.user.create({
      data: {
        name,
        nickname,
        email,
        passwordHash: hashPassword(password),
        role: input.role,
        active: true,
        invitePreparedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true,
        role: true,
        active: true,
        invitePreparedAt: true,
        inviteSentAt: true,
        createdAt: true
      }
    });
  } catch (error) {
    throw new Error(describeStaffUserMutationError(error));
  }
}

export async function getStaffUserProfile(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      nickname: true,
      email: true,
      role: true
    }
  });
}

export async function updateOwnStaffNickname(userId: string, rawNickname: string) {
  const nickname = parseStaffNickname(rawNickname);
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, nickname: true }
  });

  if (!currentUser) {
    throw new Error("Profilo utente non trovato.");
  }

  if (currentUser.nickname === nickname) {
    return prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true
      }
    });
  }

  const nicknameOwner = await prisma.user.findUnique({
    where: { nickname },
    select: { id: true }
  });

  if (nicknameOwner && nicknameOwner.id !== userId) {
    throw new Error("Questo nickname e gia in uso.");
  }

  try {
    return await prisma.user.update({
      where: { id: userId },
      data: { nickname },
      select: {
        id: true,
        name: true,
        nickname: true,
        email: true
      }
    });
  } catch (error) {
    throw new Error(sanitizeUpdateNicknameError(error));
  }
}

export async function sendStaffInviteEmail(input: {
  userId: string;
  name: string;
  nickname: string;
  email: string;
  subject?: string;
  template?: string;
  accessBaseUrl?: string;
}) {
  const preview = buildStaffInvitationPreview({
    name: input.name,
    nickname: input.nickname,
    subject: input.subject,
    template: input.template,
    accessBaseUrl: input.accessBaseUrl
  });

  if (!preview.accessLoginUrl) {
    return {
      sent: false,
      message: "Mail non inviata: link di accesso non disponibile per questo ambiente."
    };
  }

  const delivery = await sendTextEmail({
    to: input.email,
    subject: preview.subject,
    text: preview.body
  });

  if (delivery.sent) {
    await prisma.user.update({
      where: { id: input.userId },
      data: {
        invitePreparedAt: new Date(),
        inviteSentAt: new Date()
      }
    });
  }

  return delivery;
}
