import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SEED_ENTRIES, SEED_PRODS } from "./mehr-seed";

export type RemainderType = "حمل به روز بعد" | "برگشت به مواد";

export type Material = {
  code: string;
  name: string;
  unit: string;
  base: number;
  min: number;
  note: string;
};

export type Product = {
  code: string;
  name: string;
  /** Grams consumed per produced unit — matches the Excel weight column. */
  weight: number;
  material: string;
  note: string;
  active: boolean;
  remainderType: RemainderType;
  remainderNote: string;
};

export type StaffMember = {
  code: string;
  name: string;
  role: string;
  active: boolean;
};

export type Entry = {
  id: string;
  date: string;
  mat: string;
  matCode: string;
  qty: number;
  sup: string;
  inv: string;
  note: string;
  ts: number;
  /** نام نمایشی کسی که ثبت کرده */
  byLabel?: string;
  /** نام کاربری ثبت‌کننده */
  byUser?: string;
};

export type Production = {
  id: string;
  date: string;
  prod: string;
  prodCode: string;
  qty: number;
  session: string;
  staff: string;
  staffCode: string;
  start: string;
  end: string;
  /** Minutes. Null when this row is not the first of its shift code. */
  duration: number | null;
  remain: number;
  note: string;
  weightKg: number;
  material: string;
  materialCode: string;
  remainKg: number;
  remainderType: RemainderType;
  ts: number;
  byLabel?: string;
  byUser?: string;
};

export type AppUserRow = {
  username: string;
  password: string;
  role: "admin" | "entry" | "prod" | "view";
  label: string;
};

export const MATERIALS: Material[] = [
  { code: "M001", name: "سینه مرغ", unit: "کیلوگرم", base: 23.5, min: 10, note: "ماده اصلی جوجه سیخ" },
  { code: "M002", name: "ران مرغ", unit: "عدد", base: 125, min: 50, note: "" },
  { code: "M003", name: "گوشت نخودی", unit: "کیلوگرم", base: 69, min: 50, note: "برای کباب و سیخ گوشت" },
  { code: "M004", name: "گوشت خورشتی", unit: "کیلوگرم", base: 30.5, min: 10, note: "" },
  { code: "M005", name: "ماهی", unit: "عدد", base: 11, min: 4, note: "" },
  { code: "M006", name: "سینه فسنجان", unit: "کیلوگرم", base: 0, min: 5, note: "از سینه ورودی خام جدا می‌شود" },
  { code: "M007", name: "سینه سالاد", unit: "کیلوگرم", base: 0, min: 1.5, note: "از سینه ورودی خام جدا می‌شود" },
  { code: "M008", name: "مایه لوبیا پلو", unit: "کیلوگرم", base: 0, min: 5, note: "مایه آماده لوبیاپلو، مصرف روزانه" },
];

export const PRODUCTS: Product[] = [
  { code: "P001", name: "جوجه معمولی 170 گرمی", weight: 170, material: "سینه مرغ", note: "", active: true, remainderType: "حمل به روز بعد", remainderNote: "باقیمانده به عنوان محصول نهایی می‌ماند" },
  { code: "P002", name: "جوجه ممتاز ۲۰۰ گرمی", weight: 200, material: "سینه مرغ", note: "", active: true, remainderType: "حمل به روز بعد", remainderNote: "باقیمانده به عنوان محصول نهایی می‌ماند" },
  { code: "P003", name: "جوجه مجلسی ۲۸۰ گرمی", weight: 280, material: "سینه مرغ", note: "", active: true, remainderType: "حمل به روز بعد", remainderNote: "باقیمانده به عنوان محصول نهایی می‌ماند" },
  { code: "P004", name: "کوبیده اکو 100گرمی", weight: 75, material: "گوشت نخودی", note: "", active: true, remainderType: "برگشت به مواد", remainderNote: "باقیمانده از سیخ کشیده و به مایه برمی‌گردد" },
  { code: "P005", name: "لقمه معمولی 120گرمی", weight: 90, material: "گوشت نخودی", note: "", active: true, remainderType: "برگشت به مواد", remainderNote: "باقیمانده از سیخ کشیده و به مایه برمی‌گردد" },
  { code: "P006", name: "لقمه مجلسی 150گرمی", weight: 113, material: "گوشت نخودی", note: "", active: true, remainderType: "برگشت به مواد", remainderNote: "باقیمانده از سیخ کشیده و به مایه برمی‌گردد" },
  { code: "P007", name: "ران مرغ زرشک", weight: 1000, material: "ران مرغ", note: "", active: true, remainderType: "حمل به روز بعد", remainderNote: "باقیمانده به عنوان محصول نهایی می‌ماند" },
  { code: "P008", name: "ماهی قزل", weight: 1000, material: "ماهی", note: "", active: true, remainderType: "حمل به روز بعد", remainderNote: "باقیمانده به عنوان محصول نهایی می‌ماند" },
  { code: "P009", name: "گوشت خورشت قیمه", weight: 1000, material: "گوشت خورشتی", note: "گوشت قیمه", active: true, remainderType: "حمل به روز بعد", remainderNote: "باقیمانده به عنوان محصول نهایی می‌ماند" },
  { code: "P010", name: "گوشت خورشت قورمه", weight: 1000, material: "گوشت خورشتی", note: "گوشت قورمه", active: true, remainderType: "حمل به روز بعد", remainderNote: "باقیمانده به عنوان محصول نهایی می‌ماند" },
  { code: "P011", name: "مرغ خورشت فسنجان", weight: 1000, material: "سینه فسنجان", note: "مرغ فسنجان", active: true, remainderType: "حمل به روز بعد", remainderNote: "باقیمانده به عنوان محصول نهایی می‌ماند" },
  { code: "P012", name: "مرغ سالاد ماکارونی", weight: 1500, material: "سینه سالاد", note: "", active: true, remainderType: "حمل به روز بعد", remainderNote: "باقیمانده به عنوان محصول نهایی می‌ماند" },
  { code: "P013", name: "گوشت پخته خورشتی", weight: 1000, material: "گوشت خورشتی", note: "تنظیم گوشت خورشت‌ها", active: true, remainderType: "حمل به روز بعد", remainderNote: "" },
];

export const STAFF: StaffMember[] = [
  { code: "S001", name: "راجا کشمیری", role: "سوشف", active: true },
  { code: "S002", name: "میثم خواجه", role: "سرآشپز", active: true },
  { code: "S003", name: "مصطفی خوشگفتار", role: "آشپز", active: true },
  { code: "S004", name: "مهدی عصمتی", role: "آشپز", active: true },
  { code: "S005", name: "صفرملک زاده", role: "تخته کاروکبابپز", active: true },
  { code: "S006", name: "مهدی یوسفی", role: "آشپز", active: true },
  { code: "S007", name: "عباس مقدسی", role: "کمک آشپز", active: true },
  { code: "S008", name: "سیدمحمودمیرنظر", role: "کارگر", active: true },
  { code: "S009", name: "شهرام ابوالفتحی", role: "مدیر داخلی", active: true },
  { code: "S010", name: "مریم یزدانی", role: "سالادزن", active: true },
  { code: "S011", name: "اکبر رضاییان", role: "انبار دار", active: true },
];

const PRODUCT_ALIASES: Record<string, string> = {
  "خورشت قیمه": "گوشت خورشت قیمه",
  "خورشت قورمه": "گوشت خورشت قورمه",
  "خورشت فسنجان": "مرغ خورشت فسنجان",
  "سالاد ماکارونی": "مرغ سالاد ماکارونی",
};

const STAFF_ALIASES: Record<string, string> = {
  "ملک زاده": "صفرملک زاده",
  راجا: "راجا کشمیری",
  عصمتی: "مهدی عصمتی",
  خواجه: "میثم خواجه",
  خوشگفتار: "مصطفی خوشگفتار",
};

function toJalaali(gy: number, gm: number, gd: number) {
  const gdm = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    (gdm[gm - 1] ?? 0);
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  if (days < 186) {
    return { jy, jm: 1 + Math.floor(days / 31), jd: 1 + (days % 31) };
  }
  return {
    jy,
    jm: 7 + Math.floor((days - 186) / 30),
    jd: 1 + ((days - 186) % 30),
  };
}

export function todayJalali(date = new Date()): string {
  const { jy, jm, jd } = toJalaali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return `${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`;
}

export function parseQty(raw: string): number {
  const fa = "۰۱۲۳۴۵۶۷۸۹";
  const ar = "٠١٢٣٤٥٦٧٨٩";
  let s = raw.trim();
  for (let i = 0; i < 10; i++) {
    s = s.replaceAll(fa[i]!, String(i)).replaceAll(ar[i]!, String(i));
  }
  s = s.replaceAll("٫", ".").replaceAll("٬", "").replace(",", ".");
  return Number.parseFloat(s);
}

export function fmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Number(n).toLocaleString("fa-IR", { maximumFractionDigits: 2 });
}

export function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export type StockStatus = "ok" | "warn" | "out";

export type StockRow = Material & {
  totalIn: number;
  totalOut: number;
  current: number;
  status: StockStatus;
  statusLabel: string;
};

export type Waste = {
  id: string;
  date: string;
  mat: string;
  matCode: string;
  qty: number;
  reason: string;
  note: string;
  ts: number;
  byLabel?: string;
  byUser?: string;
};

export type WasteInput = Omit<Waste, "id" | "ts" | "matCode"> & { matCode?: string };

export function calcStock(
  materials: Material[],
  entries: Entry[],
  prods: Production[],
  wastes: Waste[] = [],
): StockRow[] {
  return materials.map((m) => {
    const totalIn = round3(
      entries.filter((e) => sameMaterial(e, m)).reduce((s, e) => s + e.qty, 0),
    );
    const totalProdOut = round3(
      prods.filter((p) => sameProdMaterial(p, m)).reduce((s, p) => s + netUse(p), 0),
    );
    const totalWaste = round3(
      wastes.filter((w) => sameWasteMaterial(w, m)).reduce((s, w) => s + w.qty, 0),
    );
    const totalOut = round3(totalProdOut + totalWaste);
    const current = round3((m.base || 0) + totalIn - totalOut);
    let status: StockStatus = "ok";
    let statusLabel = "عادی";
    if (current <= 0) {
      status = "out";
      statusLabel = "تمام شد";
    } else if (current < (m.min || 0)) {
      status = "warn";
      statusLabel = "هشدار";
    }
    return { ...m, totalIn, totalOut, current, status, statusLabel };
  });
}

function sameWasteMaterial(row: Waste, material: Material) {
  if (row.matCode) return row.matCode === material.code;
  return row.mat === material.name;
}

function sameMaterial(entry: Entry, material: Material) {
  if (entry.matCode) return entry.matCode === material.code;
  return entry.mat === material.name;
}

function sameProdMaterial(row: Production, material: Material) {
  if (row.materialCode) return row.materialCode === material.code;
  return row.material === material.name;
}

/** Returned skewers go back into raw stock. Finished leftovers do not. */
export function netUse(row: Production): number {
  const back = row.remainderType === "برگشت به مواد" ? row.remainKg || 0 : 0;
  return round3(Math.max(0, (row.weightKg || 0) - back));
}

function minutesBetween(start: string, end: string): number | null {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60;
  return mins;
}

export function consumption(products: Product[], productName: string, qty: number, remain = 0) {
  const product = products.find((item) => item.name === productName);
  if (!product) {
    return {
      weightKg: 0,
      material: "",
      remainKg: 0,
      unitGrams: 0,
      remainderType: "حمل به روز بعد" as RemainderType,
      prodCode: "",
    };
  }
  return {
    weightKg: round3((qty * product.weight) / 1000),
    material: product.material,
    remainKg: round3((remain * product.weight) / 1000),
    unitGrams: product.weight,
    remainderType: product.remainderType,
    prodCode: product.code,
  };
}

/** Only the first row of a shift code keeps the elapsed minutes, same as the sheet. */
export function sessionDuration(
  prods: Production[],
  session: string,
  start: string,
  end: string,
  ignoreId?: string,
): number | null {
  if (!start || !end) return null;
  const mins = minutesBetween(start, end);
  if (mins == null) return null;
  if (!session) return mins;
  const taken = prods.some(
    (row) => row.id !== ignoreId && row.session === session && row.duration != null,
  );
  return taken ? null : mins;
}

function uid() {
  return crypto.randomUUID();
}

function nextCode(items: { code: string }[], prefix: string) {
  const n = items.reduce((max, item) => {
    const num = Number(item.code.replace(/\D/g, ""));
    return Number.isFinite(num) ? Math.max(max, num) : max;
  }, 0);
  return `${prefix}${String(n + 1).padStart(3, "0")}`;
}

export type EntryInput = Omit<Entry, "id" | "ts" | "matCode"> & {
  matCode?: string;
  byLabel?: string;
  byUser?: string;
};

export type ProdInput = {
  date: string;
  prod: string;
  qty: number;
  session: string;
  staff: string;
  start: string;
  end: string;
  remain: number;
  note: string;
  remainderType?: RemainderType;
  byLabel?: string;
  byUser?: string;
};

type Store = {
  materials: Material[];
  products: Product[];
  staff: StaffMember[];
  entries: Entry[];
  prods: Production[];
  wastes: Waste[];
  appUsers: AppUserRow[];
  hintSeen: boolean;
  addEntry: (entry: EntryInput) => void;
  updateEntry: (id: string, entry: EntryInput) => void;
  addProd: (input: ProdInput) => void;
  updateProd: (id: string, input: ProdInput) => void;
  addWaste: (input: WasteInput) => void;
  removeWaste: (id: string) => void;
  saveMaterial: (input: Omit<Material, "code"> & { code?: string }) => boolean;
  removeMaterial: (code: string) => void;
  saveProduct: (input: Omit<Product, "code"> & { code?: string }) => boolean;
  removeProduct: (code: string) => void;
  saveStaff: (input: Omit<StaffMember, "code"> & { code?: string }) => boolean;
  removeStaff: (code: string) => void;
  removeEntry: (id: string) => void;
  removeProd: (id: string) => void;
  clearLogs: () => void;
  loadMehr: () => void;
  dismissHint: () => void;
  saveAppUser: (user: AppUserRow, prevUsername?: string) => string | null;
  removeAppUser: (username: string) => boolean;
};

function materialOf(materials: Material[], name: string) {
  return materials.find((item) => item.name === name);
}

function staffOf(staff: StaffMember[], name: string) {
  return staff.find((item) => item.name === name);
}

function toEntry(materials: Material[], entry: EntryInput): Omit<Entry, "id" | "ts"> {
  const known = entry.matCode
    ? materials.find((item) => item.code === entry.matCode)
    : materialOf(materials, entry.mat);
  return {
    date: entry.date,
    mat: known?.name ?? entry.mat,
    matCode: known?.code ?? entry.matCode ?? "",
    qty: entry.qty,
    sup: entry.sup,
    inv: entry.inv,
    note: entry.note,
    byLabel: entry.byLabel,
    byUser: entry.byUser,
  };
}

function toProd(
  materials: Material[],
  products: Product[],
  staff: StaffMember[],
  prods: Production[],
  input: ProdInput,
  ignoreId?: string,
): Omit<Production, "id" | "ts"> {
  const used = consumption(products, input.prod, input.qty, input.remain);
  const product = products.find((item) => item.name === input.prod);
  const material = materialOf(materials, used.material);
  const member = staffOf(staff, input.staff);
  const remainderType = input.remainderType ?? used.remainderType;
  return {
    date: input.date,
    prod: product?.name ?? input.prod,
    prodCode: product?.code ?? "",
    qty: input.qty,
    session: input.session.trim(),
    staff: member?.name ?? input.staff,
    staffCode: member?.code ?? "",
    start: input.start,
    end: input.end,
    duration: sessionDuration(prods, input.session.trim(), input.start, input.end, ignoreId),
    remain: input.remain,
    note: input.note,
    weightKg: used.weightKg,
    material: material?.name ?? used.material,
    materialCode: material?.code ?? "",
    remainKg: used.remainKg,
    remainderType,
    byLabel: input.byLabel,
    byUser: input.byUser,
  };
}

function duplicateName(items: { code: string; name: string }[], name: string, code?: string) {
  return items.some((item) => item.name === name && item.code !== code);
}

export const useCatering = create<Store>()(
  persist(
    (set, get) => ({
      materials: MATERIALS,
      products: PRODUCTS,
      staff: STAFF,
      entries: SEED_ENTRIES,
      prods: SEED_PRODS,
      wastes: [],
      appUsers: [
        { username: "admin", password: "b046c3d985f16e6f3df9434ee185e724b9e627593725bc5351b71bea582567c3", role: "admin", label: "مدیر" },
      ],
      hintSeen: false,
      addEntry: (entry) =>
        set({
          entries: [
            ...get().entries,
            { ...toEntry(get().materials, entry), id: uid(), ts: Date.now() },
          ],
        }),
      addWaste: (input) => {
        const materials = get().materials;
        const known = input.matCode
          ? materials.find((item) => item.code === input.matCode)
          : materialOf(materials, input.mat);
        set({
          wastes: [
            ...get().wastes,
            {
              id: uid(),
              ts: Date.now(),
              date: input.date,
              mat: known?.name ?? input.mat,
              matCode: known?.code ?? input.matCode ?? "",
              qty: input.qty,
              reason: input.reason,
              note: input.note,
              byLabel: input.byLabel,
              byUser: input.byUser,
            },
          ],
        });
      },
      removeWaste: (id) => set({ wastes: get().wastes.filter((w) => w.id !== id) }),
      updateEntry: (id, entry) =>
        set({
          entries: get().entries.map((row) =>
            row.id === id
              ? {
                  ...toEntry(get().materials, entry),
                  id,
                  ts: row.ts,
                  byLabel: entry.byLabel ?? row.byLabel,
                  byUser: entry.byUser ?? row.byUser,
                }
              : row,
          ),
        }),
      addProd: (input) => {
        const state = get();
        const row: Production = {
          ...toProd(state.materials, state.products, state.staff, state.prods, input),
          id: uid(),
          ts: Date.now(),
        };
        set({ prods: [...state.prods, row] });
      },
      updateProd: (id, input) => {
        const state = get();
        set({
          prods: state.prods.map((row) =>
            row.id === id
              ? {
                  ...toProd(state.materials, state.products, state.staff, state.prods, input, id),
                  id,
                  ts: row.ts,
                  byLabel: input.byLabel ?? row.byLabel,
                  byUser: input.byUser ?? row.byUser,
                }
              : row,
          ),
        });
      },
      saveAppUser: (user, prevUsername) => {
        const username = user.username.trim();
        const label = user.label.trim();
        const password = user.password;
        if (!username || !label || !password) return "نام کاربری، نام نمایشی و رمز الزامی است";
        if (username.length < 2) return "نام کاربری خیلی کوتاه است";
        const users = get().appUsers;
        const key = prevUsername ?? username;
        if (users.some((u) => u.username === username && u.username !== key)) {
          return "این نام کاربری قبلاً هست";
        }
        const next: AppUserRow = {
          username,
          password,
          role: user.role,
          label,
        };
        const exists = users.some((u) => u.username === key);
        set({
          appUsers: exists
            ? users.map((u) => (u.username === key ? next : u))
            : [...users, next],
        });
        return null;
      },
      removeAppUser: (username) => {
        const users = get().appUsers;
        if (users.filter((u) => u.role === "admin").length <= 1) {
          const target = users.find((u) => u.username === username);
          if (target?.role === "admin") return false;
        }
        if (users.length <= 1) return false;
        set({ appUsers: users.filter((u) => u.username !== username) });
        return true;
      },
      saveMaterial: (input) => {
        const name = input.name.trim();
        if (!name || !input.unit.trim()) return false;
        const materials = get().materials;
        if (duplicateName(materials, name, input.code)) return false;
        const next: Material = {
          code: input.code && materials.some((item) => item.code === input.code) ? input.code : nextCode(materials, "M"),
          name,
          unit: input.unit.trim(),
          base: input.base,
          min: input.min,
          note: input.note.trim(),
        };
        const prev = materials.find((item) => item.code === next.code);
        set({
          materials: prev
            ? materials.map((item) => (item.code === next.code ? next : item))
            : [...materials, next],
          products: get().products.map((item) =>
            prev && item.material === prev.name ? { ...item, material: next.name } : item,
          ),
          entries: get().entries.map((item) =>
            prev && (item.matCode === prev.code || item.mat === prev.name)
              ? { ...item, mat: next.name, matCode: next.code }
              : item,
          ),
          prods: get().prods.map((item) =>
            prev && (item.materialCode === prev.code || item.material === prev.name)
              ? { ...item, material: next.name, materialCode: next.code }
              : item,
          ),
        });
        return true;
      },
      removeMaterial: (code) =>
        set({ materials: get().materials.filter((item) => item.code !== code) }),
      saveProduct: (input) => {
        const name = input.name.trim();
        if (!name || !input.material.trim() || !(input.weight > 0)) return false;
        const products = get().products;
        if (duplicateName(products, name, input.code)) return false;
        const next: Product = {
          code:
            input.code && products.some((item) => item.code === input.code)
              ? input.code
              : nextCode(products, "P"),
          name,
          weight: input.weight,
          material: input.material.trim(),
          note: input.note.trim(),
          active: input.active,
          remainderType: input.remainderType,
          remainderNote: input.remainderNote.trim(),
        };
        const prev = products.find((item) => item.code === next.code);
        set({
          products: prev
            ? products.map((item) => (item.code === next.code ? next : item))
            : [...products, next],
          prods: get().prods.map((item) =>
            prev && (item.prodCode === prev.code || item.prod === prev.name)
              ? { ...item, prod: next.name, prodCode: next.code }
              : item,
          ),
        });
        return true;
      },
      removeProduct: (code) =>
        set({ products: get().products.filter((item) => item.code !== code) }),
      saveStaff: (input) => {
        const name = input.name.trim();
        if (!name) return false;
        const staff = get().staff;
        if (duplicateName(staff, name, input.code)) return false;
        const next: StaffMember = {
          code:
            input.code && staff.some((item) => item.code === input.code)
              ? input.code
              : nextCode(staff, "S"),
          name,
          role: input.role.trim(),
          active: input.active,
        };
        const prev = staff.find((item) => item.code === next.code);
        set({
          staff: prev ? staff.map((item) => (item.code === next.code ? next : item)) : [...staff, next],
          prods: get().prods.map((item) =>
            prev && (item.staffCode === prev.code || item.staff === prev.name)
              ? { ...item, staff: next.name, staffCode: next.code }
              : item,
          ),
        });
        return true;
      },
      removeStaff: (code) => set({ staff: get().staff.filter((item) => item.code !== code) }),
      removeEntry: (id) => set({ entries: get().entries.filter((entry) => entry.id !== id) }),
      removeProd: (id) => set({ prods: get().prods.filter((row) => row.id !== id) }),
      clearLogs: () => set({ entries: [], prods: [], wastes: [] }),
      loadMehr: () => set({ entries: SEED_ENTRIES, prods: SEED_PRODS }),
      dismissHint: () => set({ hintSeen: true }),
    }),
    {
      name: "catering-anbar-v1",
      version: 3,
      skipHydration: true,
      migrate: (persisted, version) => {
        const state = migrateState(persisted, version);
        const entries = state.entries ?? [];
        const prods = state.prods ?? [];
        if (version < 3 && entries.length === 0 && prods.length === 0) {
          return { ...state, entries: SEED_ENTRIES, prods: SEED_PRODS };
        }
        return state;
      },
    },
  ),
);

function migrateState(persisted: unknown, version: number): Partial<Store> {
  const state = (persisted ?? {}) as Partial<Store> & {
    entries?: Array<Partial<Entry>>;
    prods?: Array<Partial<Production>>;
  };
  if (version >= 2 && Array.isArray(state.products) && state.products.length > 0) {
    return state;
  }
  const entries = (state.entries ?? []).map((entry) => {
    const material = MATERIALS.find((item) => item.name === entry.mat);
    return {
      id: entry.id ?? uid(),
      date: entry.date ?? "",
      mat: material?.name ?? entry.mat ?? "",
      matCode: material?.code ?? "",
      qty: entry.qty ?? 0,
      sup: entry.sup ?? "",
      inv: entry.inv ?? "",
      note: entry.note ?? "",
      ts: entry.ts ?? Date.now(),
    };
  });
  const prods = (state.prods ?? []).map((row) => {
    const prodName = PRODUCT_ALIASES[row.prod ?? ""] ?? row.prod ?? "";
    const staffName = STAFF_ALIASES[row.staff ?? ""] ?? row.staff ?? "";
    const product = PRODUCTS.find((item) => item.name === prodName);
    const material = MATERIALS.find((item) => item.name === (row.material || product?.material));
    const member = STAFF.find((item) => item.name === staffName);
    return {
      id: row.id ?? uid(),
      date: row.date ?? "",
      prod: product?.name ?? prodName,
      prodCode: product?.code ?? "",
      qty: row.qty ?? 0,
      session: row.session ?? "",
      staff: member?.name ?? staffName,
      staffCode: member?.code ?? "",
      start: row.start ?? "",
      end: row.end ?? "",
      duration: row.duration ?? null,
      remain: row.remain ?? 0,
      note: row.note ?? "",
      weightKg: row.weightKg ?? 0,
      material: material?.name ?? row.material ?? "",
      materialCode: material?.code ?? "",
      remainKg: row.remainKg ?? 0,
      remainderType: row.remainderType ?? product?.remainderType ?? "حمل به روز بعد",
      ts: row.ts ?? Date.now(),
    };
  });
  return {
    materials: MATERIALS,
    products: PRODUCTS,
    staff: STAFF,
    entries,
    prods,
    hintSeen: state.hintSeen ?? false,
  };
}

function csvEscape(value: unknown): string {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function download(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** پشتیبان کامل JSON از کل وضعیت انبار */
export function exportFullBackup(): void {
  const state = useCatering.getState();
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    materials: state.materials,
    products: state.products,
    staff: state.staff,
    entries: state.entries,
    prods: state.prods,
    wastes: state.wastes,
    appUsers: state.appUsers,
    hintSeen: state.hintSeen,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `anbar-backup-${todayJalali().replaceAll("/", "-")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function importFullBackup(jsonText: string): boolean {
  try {
    const data = JSON.parse(jsonText) as Record<string, unknown>;
    const required = ["materials", "products", "staff", "entries", "prods"] as const;
    if (!required.every((k) => Array.isArray(data[k]))) return false;
    useCatering.setState({
      materials: data.materials as Material[],
      products: data.products as Product[],
      staff: data.staff as StaffMember[],
      entries: data.entries as Entry[],
      prods: data.prods as Production[],
      wastes: Array.isArray(data.wastes) ? (data.wastes as Waste[]) : [],
      appUsers: Array.isArray(data.appUsers) ? (data.appUsers as AppUserRow[]) : undefined,
      hintSeen: Boolean(data.hintSeen),
    });
    return true;
  } catch {
    return false;
  }
}

export function exportCsv(kind: "entry" | "prod", entries: Entry[], prods: Production[]): boolean {
  const stamp = todayJalali().replaceAll("/", "-");
  if (kind === "entry") {
    if (!entries.length) return false;
    let csv =
      "\uFEFFتاریخ,ماده اولیه,مقدار ورود (کیلوگرم),تأمین‌کننده / منبع,شماره فاکتور,توضیحات\n";
    for (const entry of entries) {
      csv +=
        [entry.date, entry.mat, entry.qty, entry.sup, entry.inv, entry.note].map(csvEscape).join(",") +
        "\n";
    }
    download(csv, `ورود_مواد_${stamp}.csv`);
    return true;
  }
  if (!prods.length) return false;
  let csv =
    "\uFEFFتاریخ,نام محصول / نوع سیخ,تعداد تولید,وزن مصرفی مواد (کیلو),ماده اولیه,کد شیفت,ساعت شروع,ساعت پایان,مدت زمان (دقیقه),تولیدکننده,تعداد باقیمانده,وزن باقیمانده (کیلو),نوع باقیمانده,توضیحات\n";
  for (const row of prods) {
    csv +=
      [
        row.date,
        row.prod,
        row.qty,
        row.weightKg,
        row.material,
        row.session,
        row.start,
        row.end,
        row.duration ?? "",
        row.staff,
        row.remain,
        row.remainKg,
        row.remainderType,
        row.note,
      ]
        .map(csvEscape)
        .join(",") + "\n";
  }
  download(csv, `تولید_روزانه_${stamp}.csv`);
  return true;
}
