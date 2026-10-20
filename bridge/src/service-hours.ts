// Pure clock policy shared by Edge middleware, browser and Windows Node.
// Never use the machine's local timezone (including Windows or the Vercel region).
const clock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Rome", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
});

export function romeMinutes(now = new Date()) {
  const parts = clock.formatToParts(now);
  return Number(parts.find(p => p.type === "hour")!.value) * 60 +
    Number(parts.find(p => p.type === "minute")!.value);
}

export function isNightPause(now = new Date()) {
  const minutes = romeMinutes(now);
  return minutes < 8 * 60 || minutes >= 20 * 60;
}

export function nextOpening(now = new Date()) {
  // Advance real instants rather than adding 12 hours: DST nights last 11/13 hours.
  let time = Math.floor(now.getTime() / 60_000) * 60_000 + 60_000;
  for (let n = 0; n < 26 * 60; n++, time += 60_000) {
    if (romeMinutes(new Date(time)) === 8 * 60) return new Date(time);
  }
  throw new Error("Prossima apertura non calcolabile.");
}
