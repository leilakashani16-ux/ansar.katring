/** کلید مشترک اپ و Worker — در صورت لو رفتن، در wrangler.toml عوض کن */
export const API_SECRET = "anbar-team-key-change-me-1405";

const PASS_SALT = "anbar-catering-v1";

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(`${password}${PASS_SALT}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function looksHashed(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

export function apiHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    "X-Anbar-Key": API_SECRET,
    ...extra,
  };
}

const BACKUP_KEY = "anbar-last-backup-at";

export function markBackupDone() {
  try {
    localStorage.setItem(BACKUP_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/** true اگر بیش از ۷ روز از آخرین پشتیبان گذشته یا هرگز نگرفته */
export function needsWeeklyBackup(): boolean {
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (!raw) return true;
    const t = Number(raw);
    if (!Number.isFinite(t)) return true;
    return Date.now() - t > 7 * 24 * 60 * 60 * 1000;
  } catch {
    return true;
  }
}
