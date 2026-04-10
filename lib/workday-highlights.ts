export type WorkdayHighlight = "today" | "priority-next" | "priority-later" | "weekend" | null;

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return startOfDay(next);
}

function isSameDay(left: Date | string, right: Date) {
  const leftDate = new Date(left);
  return (
    leftDate.getFullYear() === right.getFullYear() &&
    leftDate.getMonth() === right.getMonth() &&
    leftDate.getDate() === right.getDate()
  );
}

export function isWeekendDay(date: Date | string) {
  const day = new Date(date).getDay();
  return day === 0 || day === 6;
}

export function addBusinessDays(date: Date, amount: number) {
  let cursor = startOfDay(date);
  let remaining = amount;

  while (remaining > 0) {
    cursor = addDays(cursor, 1);
    if (!isWeekendDay(cursor)) {
      remaining -= 1;
    }
  }

  return cursor;
}

export function getWorkdayHighlight(date: Date | string, referenceDate: Date = new Date()): WorkdayHighlight {
  const target = new Date(date);
  const today = startOfDay(referenceDate);

  if (isWeekendDay(target)) {
    return "weekend";
  }

  if (isSameDay(target, today)) {
    return "today";
  }

  if (isSameDay(target, addBusinessDays(today, 1))) {
    return "priority-next";
  }

  if (isSameDay(target, addBusinessDays(today, 2))) {
    return "priority-later";
  }

  return null;
}
