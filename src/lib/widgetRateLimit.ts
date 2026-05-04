/**
 * Client-side rate limit for the public booking widget.
 * Prevents spam clicks from a single browser session.
 * Not a security boundary — server-side validation still applies.
 */
const KEY = "tw.widget.attempts";
const MAX_ATTEMPTS = 3;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

type Attempt = { ts: number };

function read(): Attempt[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Attempt[];
    const cutoff = Date.now() - WINDOW_MS;
    return arr.filter((a) => a.ts > cutoff);
  } catch {
    return [];
  }
}

function write(arr: Attempt[]) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(arr));
  } catch {
    /* ignore */
  }
}

export function canAttemptBooking(): { allowed: boolean; retryInSeconds?: number } {
  const attempts = read();
  if (attempts.length < MAX_ATTEMPTS) return { allowed: true };
  const oldest = Math.min(...attempts.map((a) => a.ts));
  const retryAt = oldest + WINDOW_MS;
  const retryInSeconds = Math.max(1, Math.ceil((retryAt - Date.now()) / 1000));
  return { allowed: false, retryInSeconds };
}

export function recordBookingAttempt() {
  const attempts = read();
  attempts.push({ ts: Date.now() });
  write(attempts);
}

export function clearBookingAttempts() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
