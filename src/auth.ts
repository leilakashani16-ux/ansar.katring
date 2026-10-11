import { hashPassword, looksHashed } from "./security";

export type Role = "admin" | "entry" | "prod" | "view";

export type AppUser = {
  username: string;
  password: string;
  role: Role;
  label: string;
};

/** هش SHA-256 رمز اولیه admin (anbar1403) — بعد از ورود حتماً عوض کن */
const DEFAULT_ADMIN_HASH =
  "b046c3d985f16e6f3df9434ee185e724b9e627593725bc5351b71bea582567c3";

export const DEFAULT_USERS: AppUser[] = [
  {
    username: "admin",
    password: DEFAULT_ADMIN_HASH,
    role: "admin",
    label: "مدیر",
  },
];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "مدیر (همه دسترسی‌ها)",
  entry: "فقط ورود مواد",
  prod: "فقط تولید",
  view: "فقط مشاهده",
};

const SESSION_KEY = "anbar-session-v2";

export type Session = {
  username: string;
  role: Role;
  label: string;
};

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    if (!s?.username || !s?.role) return null;
    return s;
  } catch {
    return null;
  }
}

export function saveSession(session: Session | null) {
  try {
    if (!session) localStorage.removeItem(SESSION_KEY);
    else localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* ignore */
  }
}

/**
 * ورود با پشتیبانی از رمز هش‌شده و مهاجرت رمز متنی قدیمی.
 * اگر رمز قدیمی متنی بود و درست بود، هش جدید برمی‌گردد تا ذخیره شود.
 */
export async function loginWithUsers(
  users: AppUser[],
  username: string,
  password: string,
): Promise<{ session: Session; upgradedHash?: string } | null> {
  const name = username.trim();
  const u = users.find((x) => x.username === name);
  if (!u) return null;

  const hashed = await hashPassword(password);
  let ok = false;
  let upgradedHash: string | undefined;

  if (looksHashed(u.password)) {
    ok = u.password === hashed;
  } else {
    // رمز قدیمی متنی
    ok = u.password === password;
    if (ok) upgradedHash = hashed;
  }

  if (!ok) return null;

  const session: Session = {
    username: u.username,
    role: u.role,
    label: u.label,
  };
  saveSession(session);
  return { session, upgradedHash };
}

export function canWriteEntry(role: Role | null | undefined) {
  return role === "admin" || role === "entry";
}

export function canWriteProd(role: Role | null | undefined) {
  return role === "admin" || role === "prod";
}

export function canManageCatalog(role: Role | null | undefined) {
  return role === "admin";
}

export { DEFAULT_ADMIN_HASH };
