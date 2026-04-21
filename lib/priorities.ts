import type { Priority } from "@prisma/client";
import { APP_TIMEZONE } from "@/lib/constants";

export const automaticPriorityValues = ["URGENTE", "ALTA", "BASSA"] as const satisfies readonly Priority[];

const prioritySortRank: Record<Priority, number> = {
  BASSA: 0,
  MEDIA: 1,
  ALTA: 2,
  URGENTE: 3
};

const timezoneDayFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: APP_TIMEZONE
});

function getTimezoneDayStamp(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  const parts = timezoneDayFormatter.formatToParts(value);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Impossibile determinare la priorita automatica.");
  }

  return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

export function getDeliveryDayOffset(deliveryAt: Date | string, referenceDate: Date = new Date()) {
  const deliveryStamp = getTimezoneDayStamp(deliveryAt);
  const referenceStamp = getTimezoneDayStamp(referenceDate);
  return Math.round((deliveryStamp - referenceStamp) / 86400000);
}

export function computeAutomaticPriority(deliveryAt: Date | string, referenceDate: Date = new Date()): Priority {
  const dayOffset = getDeliveryDayOffset(deliveryAt, referenceDate);

  if (dayOffset <= 1) {
    return "URGENTE";
  }

  if (dayOffset <= 3) {
    return "ALTA";
  }

  return "BASSA";
}

export function comparePriorityDesc(left: Priority, right: Priority) {
  return prioritySortRank[right] - prioritySortRank[left];
}

export function getPriorityToneClass(priority: Priority) {
  if (priority === "URGENTE") {
    return "priority-urgent";
  }

  if (priority === "ALTA") {
    return "priority-high";
  }

  return "priority-low";
}
