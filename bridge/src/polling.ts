// Only successful empty cycles slow down. Work and errors reset the empty streak.
// The default maximum remains below the server's 90-second contact warning.
export function nextPollSeconds(base: number, emptyCycles: number, failures: number) {
  if (failures > 0) return Math.min(300, base * 2 ** Math.min(failures, 5));
  return Math.min(Math.max(base, 60), base * 2 ** Math.min(emptyCycles, 5));
}
