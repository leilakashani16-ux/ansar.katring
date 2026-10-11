import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { toast, Toaster } from "sonner";
import {
  AlertTriangle,
  ArrowDownToLine,
  Boxes,
  ChevronDown,
  ClipboardList,
  Download,
  Flame,
  Info,
  Moon,
  Pencil,
  Plus,
  Settings,
  Sun,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  calcStock,
  consumption,
  exportCsv,
  exportFullBackup,
  fmt,
  importFullBackup,
  netUse,
  parseQty,
  sessionDuration,
  todayJalali,
  useCatering,
  type Entry,
  type Production,
  type RemainderType,
  type StockStatus,
} from "./catering";
import {
  ROLE_LABELS,
  canManageCatalog,
  canWriteEntry,
  canWriteProd,
  loadSession,
  loginWithUsers,
  saveSession,
  type Role,
  type Session,
} from "./auth";
import { apiHeaders, hashPassword, looksHashed, markBackupDone, needsWeeklyBackup } from "./security";

type TabId = "entry" | "prod" | "inv" | "staff" | "list" | "report" | "more";

const TABS: { id: TabId; label: string; icon: typeof Flame }[] = [
  { id: "entry", label: "ورود", icon: ArrowDownToLine },
  { id: "prod", label: "تولید", icon: Flame },
  { id: "inv", label: "موجودی", icon: Boxes },
  { id: "list", label: "سوابق", icon: ClipboardList },
  { id: "more", label: "بیشتر", icon: Settings },
];

const PREFS_KEY = "anbar-ui-prefs";

type UiPrefs = { dark: boolean; large: boolean; branch: string };

function loadPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { dark: false, large: true, branch: "شعبه اصلی", ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { dark: false, large: true, branch: "شعبه اصلی" };
}

function savePrefs(p: UiPrefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

const fieldClass =
  "h-12 w-full rounded-xl border border-line bg-field px-3 text-base text-ink outline-none transition-colors focus:border-navy focus:bg-card ui-large:h-14 ui-large:text-lg";

function useToday() {
  const [today, setToday] = useState("");
  useEffect(() => {
    setToday(todayJalali());
  }, []);
  return today;
}

export function WarehouseApp() {
  const [tab, setTab] = useState<TabId>("entry");
  const [installOpen, setInstallOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [prefs, setPrefs] = useState<UiPrefs>(() => loadPrefs());
  const [syncState, setSyncState] = useState<"ok" | "offline" | "pending">("ok");
  const hintSeen = useCatering((s) => s.hintSeen);
  const dismissHint = useCatering((s) => s.dismissHint);
  const entries = useCatering((s) => s.entries);
  const prods = useCatering((s) => s.prods);
  const wastes = useCatering((s) => s.wastes);
  const materials = useCatering((s) => s.materials);
  const stockRows = useMemo(
    () => calcStock(materials, entries, prods, wastes),
    [materials, entries, prods, wastes],
  );
  const alerts = useMemo(
    () => stockRows.filter((row) => row.status !== "ok"),
    [stockRows],
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", prefs.dark);
    document.documentElement.classList.toggle("ui-large", prefs.large);
    savePrefs(prefs);
  }, [prefs]);

  // Shared D1 sync — faster poll + offline retry queue
  useEffect(() => {
    let stopped = false;
    let ready = false;
    let applyingRemote = false;
    let lastSeenRemote = 0;
    let lastLocalChange = 0;
    let pendingSave = false;
    let saveTimer: ReturnType<typeof setTimeout> | undefined;

    const sharedFields = (state: ReturnType<typeof useCatering.getState>) => ({
      materials: state.materials,
      products: state.products,
      staff: state.staff,
      entries: state.entries,
      prods: state.prods,
      wastes: state.wastes ?? [],
      appUsers: state.appUsers,
      hintSeen: state.hintSeen,
    });

    const applyRemote = (state: Record<string, unknown>) => {
      applyingRemote = true;
      const next = { ...state } as Partial<ReturnType<typeof useCatering.getState>>;
      if (!Array.isArray(next.appUsers) || next.appUsers.length === 0) {
        delete next.appUsers;
      }
      if (!Array.isArray(next.wastes)) {
        next.wastes = [];
      }
      useCatering.setState(next);
      applyingRemote = false;
    };

    const saveLocal = async () => {
      if (stopped || !ready) return;
      try {
        const response = await fetch("/api/data", {
          method: "POST",
          headers: apiHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ state: sharedFields(useCatering.getState()) }),
        });
        if (!response.ok) throw new Error("shared save failed");
        const result = (await response.json()) as { updatedAt?: number };
        lastSeenRemote = Math.max(lastSeenRemote, result.updatedAt ?? Date.now());
        pendingSave = false;
        setSyncState("ok");
      } catch {
        pendingSave = true;
        setSyncState("offline");
      }
    };

    const unsubscribe = useCatering.subscribe(() => {
      if (!ready || applyingRemote) return;
      lastLocalChange = Date.now();
      pendingSave = true;
      setSyncState(navigator.onLine ? "pending" : "offline");
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        void saveLocal();
      }, 400);
    });

    const start = async () => {
      await useCatering.persist.rehydrate();
      if (stopped) return;
      try {
        const response = await fetch("/api/data", { cache: "no-store", headers: apiHeaders() });
        if (!response.ok) throw new Error("shared read failed");
        const remote = (await response.json()) as {
          state?: Record<string, unknown> | null;
          updatedAt?: number;
        };
        lastSeenRemote = remote.updatedAt ?? 0;
        if (remote.state) {
          applyRemote(remote.state);
        } else {
          ready = true;
          await saveLocal();
        }
        ready = true;
        setSyncState("ok");
      } catch {
        ready = true;
        setSyncState("offline");
      }
    };

    void start();
    const poll = setInterval(async () => {
      if (!ready || stopped) return;
      if (pendingSave) {
        void saveLocal();
        return;
      }
      try {
        const response = await fetch("/api/data", { cache: "no-store", headers: apiHeaders() });
        if (!response.ok) return;
        const remote = (await response.json()) as {
          state?: Record<string, unknown> | null;
          updatedAt?: number;
        };
        const remoteTime = remote.updatedAt ?? 0;
        if (remote.state && remoteTime > lastSeenRemote && remoteTime > lastLocalChange) {
          applyRemote(remote.state);
          lastSeenRemote = remoteTime;
        }
        setSyncState("ok");
      } catch {
        setSyncState("offline");
      }
    }, 1500);

    const onOnline = () => {
      if (pendingSave) void saveLocal();
    };
    window.addEventListener("online", onOnline);

    return () => {
      stopped = true;
      unsubscribe();
      clearInterval(poll);
      if (saveTimer) clearTimeout(saveTimer);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  async function doLogin(username: string, password: string) {
    const users = useCatering.getState().appUsers;
    const result = await loginWithUsers(users, username, password);
    if (!result) {
      toast.error("نام کاربری یا رمز اشتباه است");
      return false;
    }
    if (result.upgradedHash) {
      useCatering.getState().saveAppUser(
        {
          username: result.session.username,
          label: result.session.label,
          role: result.session.role,
          password: result.upgradedHash,
        },
        result.session.username,
      );
    }
    setSession(result.session);
    toast.success(`ورود: ${result.session.label}`);
    return true;
  }

  function logout() {
    saveSession(null);
    setSession(null);
    toast.message("خارج شدید");
  }

  function download(kind: "entry" | "prod") {
    const state = useCatering.getState();
    if (!exportCsv(kind, state.entries, state.prods)) {
      toast.error(kind === "entry" ? "ورودی برای خروجی نیست" : "تولیدی برای خروجی نیست");
      return;
    }
    toast.success("فایل CSV دانلود شد — در اکسل بازش کنید");
  }

  const role = session?.role;
  const writeEntry = canWriteEntry(role);
  const writeProd = canWriteProd(role);

  return (
    <div className="min-h-dvh bg-desk text-ink">
      <Toaster position="top-center" dir="rtl" />
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-paper">
        <header className="sticky top-0 z-30 bg-navy px-4 pt-4 pb-3 text-card">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-bold leading-tight ui-large:text-xl">انبار کترینگ</h1>
              <p className="text-sm text-card/80">
                {prefs.branch}
                {session ? ` · ${session.label}` : " · مهمان"}
                {syncState === "offline"
                  ? " · آفلاین"
                  : syncState === "pending"
                    ? " · در حال همگام‌سازی…"
                    : " · همگام"}
              </p>
            </div>
            <button
              type="button"
              className="grid size-11 place-items-center rounded-full bg-card/10 ui-large:size-12"
              aria-label="راهنمای نصب"
              onClick={() => setInstallOpen(true)}
            >
              <Info className="size-5" />
            </button>
            <button
              type="button"
              className="grid size-11 place-items-center rounded-full bg-copper text-card ui-large:size-12"
              aria-label="خروجی اکسل"
              onClick={() => setExportOpen(true)}
            >
              <Download className="size-5" />
            </button>
          </div>
          {alerts.length > 0 ? (
            <button
              type="button"
              className="mt-2 flex w-full items-center gap-2 rounded-xl bg-bad/90 px-3 py-2 text-start text-sm text-card"
              onClick={() => setTab("inv")}
            >
              <AlertTriangle className="size-4 shrink-0" />
              {alerts.length} ماده در وضعیت هشدار یا تمام — برای جزئیات موجودی را ببینید
            </button>
          ) : null}
        </header>

        <main className="flex-1 px-3 pt-3 pb-28">
          {tab === "entry" && !hintSeen ? (
            <button
              type="button"
              onClick={() => {
                dismissHint();
                setInstallOpen(true);
              }}
              className="mb-3 w-full rounded-2xl bg-navy px-4 py-3 text-start text-sm leading-relaxed text-card"
            >
              برای نصب روی اندروید راهنما را باز کنید. داده‌ها بین دستگاه‌ها همگام می‌شوند.
            </button>
          ) : null}
          {tab === "entry" ? (
            writeEntry ? (
              <>
                <EntryPanel actor={session} />
                <WastePanel actor={session} />
              </>
            ) : (
              <LoginGate title="ثبت ورود مواد" onLogin={doLogin} needRole="ورود یا مدیر" />
            )
          ) : null}
          {tab === "prod" ? (
            writeProd ? (
              <>
                <ProdPanel actor={session} />
                {canManageCatalog(role) ? <ProductCatalog /> : null}
              </>
            ) : (
              <LoginGate title="ثبت تولید" onLogin={doLogin} needRole="تولید یا مدیر" />
            )
          ) : null}
          {tab === "inv" ? <InvPanel canEdit={canManageCatalog(role)} /> : null}
          {tab === "list" ? <HistoryPanel canEdit={canManageCatalog(role)} /> : null}
          {tab === "more" ? (
            <MorePanel
              session={session}
              prefs={prefs}
              setPrefs={setPrefs}
              onLogin={doLogin}
              onLogout={logout}
              onOpenStaff={() => setTab("staff")}
              onOpenReport={() => setTab("report")}
            />
          ) : null}
          {tab === "staff" ? (
            canManageCatalog(role) ? (
              <StaffPanel />
            ) : (
              <LoginGate title="پرسنل" onLogin={doLogin} needRole="مدیر" />
            )
          ) : null}
          {tab === "report" ? <ReportPanel /> : null}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40" aria-label="بخش‌ها">
        <div className="dock-pad mx-auto grid max-w-md grid-cols-5 border-t border-line bg-card">
          {TABS.map((item) => {
            const active = tab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ui-large:min-h-16 ui-large:text-sm ${
                  active ? "text-navy" : "text-muted"
                }`}
                aria-current={active ? "page" : undefined}
                onClick={() => setTab(item.id)}
              >
                <span
                  className={`absolute inset-x-3 top-0 h-1 rounded-full ${active ? "bg-copper" : "bg-transparent"}`}
                />
                <span className="relative">
                  <Icon className="size-5" strokeWidth={active ? 2.4 : 2} />
                  {item.id === "inv" && alerts.length > 0 ? (
                    <span className="absolute -top-1 -start-1 size-2 rounded-full bg-bad" />
                  ) : null}
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      {exportOpen ? (
        <Sheet title="خروجی برای اکسل" onClose={() => setExportOpen(false)}>
          <p className="text-sm leading-relaxed text-pretty text-muted">
            هر دکمه یک فایل است. اگر هر دو را پشت سر هم از یک دکمه می‌گرفتیم، مرورگر دومی را بلوکه
            می‌کرد.
          </p>
          <button
            type="button"
            className="mt-4 h-12 w-full rounded-xl bg-navy text-base font-semibold text-card"
            onClick={() => download("entry")}
          >
            دانلود ورود مواد
          </button>
          <button
            type="button"
            className="mt-2 h-12 w-full rounded-xl bg-copper text-base font-semibold text-card"
            onClick={() => download("prod")}
          >
            دانلود تولید روزانه
          </button>
        </Sheet>
      ) : null}

      {installOpen ? (
        <Sheet title="نصب مثل اپلیکیشن" onClose={() => setInstallOpen(false)}>
          <p className="mb-3 text-sm leading-relaxed text-pretty text-ink">
            کار شما ستون اصلی کیفیت کترینگ است.
            <br />
            این سامانه فقط برای نظم‌دادن به موجودی و سبک‌تر شدن هماهنگی تیم ساخته شده — نه برای کنترل یا
            بی‌اعتمادی.
            <br />
            هر ثبت دقیق شما کمک می‌کند مواد به‌موقع باشد، هدررفت کمتر شود و کار همه راحت‌تر پیش برود.
            <br />
            ممنون از دقت و مسئولیتی که هر روز دارید.
          </p>
          <p className="mb-2 text-sm font-semibold text-navy">نصب روی گوشی</p>
          <ol className="list-decimal space-y-2 ps-5 text-sm leading-relaxed text-pretty text-muted">
            <li>همین آدرس را در <strong>Chrome</strong> اندروید باز کنید.</li>
            <li>منوی سه‌نقطه بالا را بزنید.</li>
            <li>«Install app» یا «افزودن به صفحه اصلی» را انتخاب کنید.</li>
            <li>تأیید کنید — آیکون کنار بقیه اپ‌ها می‌نشیند.</li>
          </ol>
          <p className="mt-3 text-sm text-pretty text-muted">
            روی آیفون: دکمه Share را بزنید و «Add to Home Screen» را انتخاب کنید.
          </p>
          <button
            type="button"
            className="mt-4 h-12 w-full rounded-xl bg-navy text-base font-semibold text-card"
            onClick={() => {
              dismissHint();
              setInstallOpen(false);
            }}
          >
            متوجه شدم
          </button>
        </Sheet>
      ) : null}
    </div>
  );
}


function WastePanel({ actor }: { actor?: Session | null }) {
  const today = useToday();
  const materials = useCatering((s) => s.materials);
  const wastes = useCatering((s) => s.wastes);
  const addWaste = useCatering((s) => s.addWaste);
  const removeWaste = useCatering((s) => s.removeWaste);
  const [date, setDate] = useState<string | null>(null);
  const [mat, setMat] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("خراب / فاسد");
  const [note, setNote] = useState("");
  const unit = materials.find((m) => m.name === mat)?.unit ?? "";

  function submit(event: FormEvent) {
    event.preventDefault();
    const amount = parseQty(qty);
    const when = (date ?? today).trim();
    if (!when || !mat || !Number.isFinite(amount) || amount <= 0) {
      toast.error("تاریخ، ماده و مقدار الزامی است");
      return;
    }
    addWaste({
      date: when,
      mat,
      qty: amount,
      reason,
      note: note.trim(),
      byLabel: actor?.label ?? loadSession()?.label,
      byUser: actor?.username ?? loadSession()?.username,
    });
    setQty("");
    setNote("");
    toast.success("ضایعات ثبت شد و از موجودی کم شد");
  }

  const recent = [...wastes].reverse().slice(0, 8);

  return (
    <>
      <Card title="ثبت ضایعات / دورریز">
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <Field label="تاریخ" extra={<TodayButton onPick={() => setDate(today)} />}>
            <input
              className={fieldClass}
              value={date ?? today}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="ماده">
            <NativeSelect value={mat} onChange={setMat}>
              <option value="">انتخاب کنید</option>
              {materials.map((item) => (
                <option key={item.code} value={item.name}>
                  {item.name} ({item.unit})
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={unit ? `مقدار ضایعات (${unit})` : "مقدار ضایعات"}>
            <input
              className={fieldClass}
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder={unit ? `مثلاً ۲ ${unit}` : "مقدار"}
            />
          </Field>
          <Field label="علت">
            <NativeSelect value={reason} onChange={setReason}>
              <option value="خراب / فاسد">خراب / فاسد</option>
              <option value="ریخت / افتاد">ریخت / افتاد</option>
              <option value="تاریخ گذشته">تاریخ گذشته</option>
              <option value="اشتباه پخت">اشتباه پخت</option>
              <option value="سایر">سایر</option>
            </NativeSelect>
          </Field>
          <Field label="توضیح (اختیاری)">
            <input className={fieldClass} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <button type="submit" className="h-12 rounded-xl bg-copper font-semibold text-card">
            ثبت ضایعات
          </button>
        </form>
      </Card>
      {recent.length > 0 ? (
        <Card title="آخرین ضایعات" action={<Count n={wastes.length} />}>
          <ul className="space-y-2">
            {recent.map((w) => (
              <li key={w.id} className="flex items-start justify-between gap-2 rounded-xl border border-line bg-paper px-3 py-2">
                <div>
                  <p className="font-semibold">
                    {w.mat} — <span className="tabular-nums">{fmt(w.qty)}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {w.date} · {w.reason}
                    {w.byLabel ? ` · ثبت: ${w.byLabel}` : ""}
                    {w.note ? ` · ${w.note}` : ""}
                  </p>
                </div>
                {canManageCatalog(loadSession()?.role) ? (
                  <button
                    type="button"
                    className="grid size-10 place-items-center text-bad"
                    aria-label="حذف"
                    onClick={() => {
                      removeWaste(w.id);
                      toast.success("حذف شد");
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

function EntryPanel({
  initial,
  onDone,
  framed = true,
  actor,
}: {
  initial?: Entry | null;
  onDone?: () => void;
  framed?: boolean;
  actor?: Session | null;
}) {
  const today = useToday();
  const materials = useCatering((s) => s.materials);
  const addEntry = useCatering((s) => s.addEntry);
  const updateEntry = useCatering((s) => s.updateEntry);
  const [date, setDate] = useState<string | null>(initial?.date ?? null);
  const [mat, setMat] = useState(initial?.mat ?? "");
  const [qty, setQty] = useState(initial ? String(initial.qty) : "");
  const [sup, setSup] = useState(initial?.sup ?? "");
  const [inv, setInv] = useState(initial?.inv ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const selectedUnit = materials.find((m) => m.name === mat)?.unit ?? "";

  function submit(event: FormEvent) {
    event.preventDefault();
    const amount = parseQty(qty);
    const when = (date ?? today).trim();
    if (!when || !mat || !Number.isFinite(amount) || amount <= 0) {
      toast.error("تاریخ، ماده و مقدار الزامی است");
      return;
    }
    const payload = {
      date: when,
      mat,
      qty: amount,
      sup: sup.trim(),
      inv: inv.trim(),
      note: note.trim(),
      byLabel: actor?.label ?? loadSession()?.label ?? initial?.byLabel,
      byUser: actor?.username ?? loadSession()?.username ?? initial?.byUser,
    };
    if (initial) {
      updateEntry(initial.id, payload);
      toast.success("ورود ویرایش شد");
      onDone?.();
      return;
    }
    addEntry(payload);
    setQty("");
    setNote("");
    toast.success("ورود ثبت شد");
  }

  const form = (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <Field label="تاریخ" extra={<TodayButton onPick={() => setDate(today)} />}>
        <input
          id="e-date"
          className={fieldClass}
          inputMode="numeric"
          placeholder="1405/07/17"
          value={date ?? today}
          onChange={(event) => setDate(event.target.value)}
        />
      </Field>
      <Field label="ماده اولیه">
        <NativeSelect id="e-mat" value={mat} onChange={setMat}>
          <option value="">انتخاب کنید</option>
          {materials.map((item) => (
            <option key={item.code} value={item.name}>
              {item.name} ({item.unit})
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label={selectedUnit ? `مقدار ورود (${selectedUnit})` : "مقدار ورود"}>
        <input
          id="e-qty"
          className={fieldClass}
          inputMode="decimal"
          placeholder={selectedUnit ? `مثلاً ۱۰ ${selectedUnit}` : "مثلاً ۴۹"}
          value={qty}
          onChange={(event) => setQty(event.target.value)}
        />
      </Field>
      {selectedUnit ? (
        <p className="-mt-1 text-xs text-muted">واحد این ماده: {selectedUnit}</p>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <Field label="تأمین‌کننده">
          <input
            id="e-sup"
            className={fieldClass}
            placeholder="زربال"
            value={sup}
            onChange={(event) => setSup(event.target.value)}
          />
        </Field>
        <Field label="شماره فاکتور">
          <input
            id="e-inv"
            className={fieldClass}
            placeholder="F-1403-101"
            value={inv}
            onChange={(event) => setInv(event.target.value)}
          />
        </Field>
      </div>
      <Field label="توضیحات">
        <input
          id="e-note"
          className={fieldClass}
          placeholder="اختیاری"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
      <Submit>{initial ? "ذخیره ویرایش" : "ثبت ورود"}</Submit>
    </form>
  );

  if (!framed) return form;
  return <Card title="ثبت ورود مواد">{form}</Card>;
}

function ProdPanel({
  initial,
  onDone,
  framed = true,
  actor,
}: {
  initial?: Production | null;
  onDone?: () => void;
  framed?: boolean;
  actor?: Session | null;
}) {
  const today = useToday();
  const staff = useCatering((s) => s.staff);
  const products = useCatering((s) => s.products);
  const prods = useCatering((s) => s.prods);
  const addProd = useCatering((s) => s.addProd);
  const updateProd = useCatering((s) => s.updateProd);
  const [date, setDate] = useState<string | null>(initial?.date ?? null);
  const [prod, setProd] = useState(initial?.prod ?? "");
  const [qty, setQty] = useState(initial ? String(initial.qty) : "");
  const [session, setSession] = useState(initial?.session ?? "");
  const [staffName, setStaffName] = useState(initial?.staff ?? "");
  const [start, setStart] = useState(initial?.start?.slice(0, 5) ?? "");
  const [end, setEnd] = useState(initial?.end?.slice(0, 5) ?? "");
  const [remain, setRemain] = useState(initial ? String(initial.remain ?? 0) : "0");
  const [note, setNote] = useState(initial?.note ?? "");
  const [remainderType, setRemainderType] = useState<RemainderType>(
    initial?.remainderType ?? "حمل به روز بعد",
  );

  const amount = parseQty(qty);
  const remainN = parseQty(remain);
  const preview =
    prod && Number.isFinite(amount) && amount > 0
      ? consumption(products, prod, amount, Number.isFinite(remainN) ? remainN : 0)
      : null;
  const duration = sessionDuration(prods, session.trim(), start, end, initial?.id);
  const shiftTaken =
    session.trim() !== "" &&
    start !== "" &&
    end !== "" &&
    duration == null &&
    prods.some((row) => row.id !== initial?.id && row.session === session.trim() && row.duration != null);
  const choices = products.filter((item) => item.active !== false || item.name === prod);
  const people = staff.filter((member) => member.active !== false || member.name === staffName);
  const net =
    preview == null
      ? 0
      : remainderType === "برگشت به مواد"
        ? Math.max(0, preview.weightKg - preview.remainKg)
        : preview.weightKg;

  function pickProd(name: string) {
    setProd(name);
    const item = products.find((row) => row.name === name);
    if (item) setRemainderType(item.remainderType);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const count = parseQty(qty);
    const left = parseQty(remain);
    const when = (date ?? today).trim();
    if (!when || !prod || !Number.isFinite(count) || count <= 0) {
      toast.error("تاریخ، محصول و تعداد الزامی است");
      return;
    }
    const payload = {
      date: when,
      prod,
      qty: count,
      session,
      staff: staffName,
      start,
      end,
      remain: Number.isFinite(left) && left > 0 ? left : 0,
      note: note.trim(),
      remainderType,
      byLabel: actor?.label ?? loadSession()?.label ?? initial?.byLabel,
      byUser: actor?.username ?? loadSession()?.username ?? initial?.byUser,
    };
    if (initial) {
      updateProd(initial.id, payload);
      toast.success("تولید ویرایش شد");
      onDone?.();
      return;
    }
    addProd(payload);
    setQty("");
    setRemain("0");
    setNote("");
    toast.success("تولید ثبت شد");
  }

  const form = (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <Field label="تاریخ" extra={<TodayButton onPick={() => setDate(today)} />}>
        <input
          id="p-date"
          className={fieldClass}
          inputMode="numeric"
          placeholder="1405/07/17"
          value={date ?? today}
          onChange={(event) => setDate(event.target.value)}
        />
      </Field>
      <Field label="نام محصول">
        <NativeSelect id="p-prod" value={prod} onChange={pickProd}>
          <option value="">انتخاب کنید</option>
          {choices.map((item) => (
            <option key={item.code} value={item.name}>
              {item.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="تعداد تولید">
        <input
          id="p-qty"
          className={fieldClass}
          inputMode="decimal"
          placeholder="مثلاً ۵۰"
          value={qty}
          onChange={(event) => setQty(event.target.value)}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="کد شیفت">
          <input
            id="p-session"
            className={fieldClass}
            placeholder="s1"
            value={session}
            onChange={(event) => setSession(event.target.value)}
          />
        </Field>
        <Field label="تولیدکننده">
          <NativeSelect id="p-staff" value={staffName} onChange={setStaffName}>
            <option value="">انتخاب کنید</option>
            {people.map((member) => (
              <option key={member.code} value={member.name}>
                {member.name}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ساعت شروع">
          <input
            id="p-start"
            type="time"
            className={fieldClass}
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </Field>
        <Field label="ساعت پایان">
          <input
            id="p-end"
            type="time"
            className={fieldClass}
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="باقیمانده">
          <input
            id="p-remain"
            className={fieldClass}
            inputMode="decimal"
            value={remain}
            onChange={(event) => setRemain(event.target.value)}
          />
        </Field>
        <Field label="نوع باقیمانده">
          <NativeSelect
            id="p-remain-type"
            value={remainderType}
            onChange={(value) => setRemainderType(value as RemainderType)}
          >
            <option value="حمل به روز بعد">حمل به روز بعد</option>
            <option value="برگشت به مواد">برگشت به مواد</option>
          </NativeSelect>
        </Field>
      </div>
      <Field label="توضیحات">
        <input
          id="p-note"
          className={fieldClass}
          placeholder="اختیاری"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </Field>
      {preview ? (
        <p className="rounded-xl bg-field px-3 py-2 text-sm leading-relaxed">
          مصرف خالص{" "}
          <span className="font-semibold tabular-nums">{fmt(net)}</span> کیلو {preview.material}
          {remainderType === "برگشت به مواد" && preview.remainKg > 0
            ? ` · ${fmt(preview.remainKg)} کیلو به مواد برمی‌گردد`
            : null}
        </p>
      ) : null}
      {shiftTaken ? (
        <p className="text-sm text-pretty text-warn">
          مدت این شیفت قبلاً روی ردیف اول ثبت شده و دوباره حساب نمی‌شود.
        </p>
      ) : null}
      {duration != null ? (
        <p className="text-sm text-muted">
          مدت شیفت: <span className="font-semibold tabular-nums text-ink">{fmt(duration)}</span> دقیقه
        </p>
      ) : null}
      <Submit>{initial ? "ذخیره ویرایش" : "ثبت تولید"}</Submit>
    </form>
  );

  if (!framed) return form;
  return <Card title="ثبت تولید روزانه">{form}</Card>;
}

function ProductCatalog() {
  const products = useCatering((s) => s.products);
  const materials = useCatering((s) => s.materials);
  const saveProduct = useCatering((s) => s.saveProduct);
  const removeProduct = useCatering((s) => s.removeProduct);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [weight, setWeight] = useState("");
  const [material, setMaterial] = useState("");
  const [note, setNote] = useState("");
  const [remainderNote, setRemainderNote] = useState("");
  const [remainderType, setRemainderType] = useState<RemainderType>("حمل به روز بعد");
  const [active, setActive] = useState(true);
  const [pending, setPending] = useState<string | null>(null);

  function reset() {
    setCode("");
    setName("");
    setWeight("");
    setMaterial("");
    setNote("");
    setRemainderNote("");
    setRemainderType("حمل به روز بعد");
    setActive(true);
  }

  function edit(item: (typeof products)[number]) {
    setCode(item.code);
    setName(item.name);
    setWeight(String(item.weight));
    setMaterial(item.material);
    setNote(item.note);
    setRemainderNote(item.remainderNote);
    setRemainderType(item.remainderType);
    setActive(item.active);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const grams = parseQty(weight);
    if (!name.trim() || !material || !Number.isFinite(grams) || grams <= 0) {
      toast.error("نام، ماده و وزن هر عدد الزامی است");
      return;
    }
    const ok = saveProduct({
      code: code || undefined,
      name,
      weight: grams,
      material,
      note,
      active,
      remainderType,
      remainderNote,
    });
    if (!ok) {
      toast.error("این نام محصول قبلاً ثبت شده");
      return;
    }
    toast.success(code ? "محصول ویرایش شد" : "محصول اضافه شد");
    reset();
  }

  return (
    <>
      <Card title={code ? `ویرایش ${code}` : "تعریف محصول"}>
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <Field label="نام محصول">
            <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="وزن هر عدد (گرم)">
              <input
                className={fieldClass}
                inputMode="decimal"
                value={weight}
                onChange={(event) => setWeight(event.target.value)}
              />
            </Field>
            <Field label="ماده مصرفی">
              <NativeSelect id="prod-mat" value={material} onChange={setMaterial}>
                <option value="">انتخاب کنید</option>
                {materials.map((item) => (
                  <option key={item.code} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
          <Field label="نوع باقیمانده">
            <NativeSelect
              id="prod-rem"
              value={remainderType}
              onChange={(value) => setRemainderType(value as RemainderType)}
            >
              <option value="حمل به روز بعد">حمل به روز بعد</option>
              <option value="برگشت به مواد">برگشت به مواد</option>
            </NativeSelect>
          </Field>
          <Field label="توضیح باقیمانده">
            <input
              className={fieldClass}
              value={remainderNote}
              onChange={(event) => setRemainderNote(event.target.value)}
            />
          </Field>
          <Field label="توضیح">
            <input className={fieldClass} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-navy"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            فعال در فهرست تولید
          </label>
          <div className={code ? "grid grid-cols-2 gap-2" : ""}>
            {code ? (
              <button
                type="button"
                className="h-12 rounded-xl bg-paper text-sm font-semibold text-ink ring-1 ring-line"
                onClick={reset}
              >
                انصراف
              </button>
            ) : null}
            <Submit>{code ? "ذخیره ویرایش" : "افزودن محصول"}</Submit>
          </div>
        </form>
      </Card>
      <Card title="انواع محصول" action={<Count n={products.length} />}>
        <ul className="space-y-2">
          {products.map((item) => (
            <li key={item.code} className="rounded-xl border border-line bg-paper px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {item.name}
                    {item.active ? "" : " · غیرفعال"}
                  </p>
                  <p className="text-xs text-muted">
                    {item.code} · {fmt(item.weight)} گرم · {item.material} · {item.remainderType}
                  </p>
                </div>
                <RowActions
                  editLabel={`ویرایش ${item.name}`}
                  deleteLabel={`حذف ${item.name}`}
                  onEdit={() => edit(item)}
                  onDelete={() => setPending(item.code)}
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>
      {pending ? (
        <Confirm
          title="حذف محصول"
          body="از فهرست تولید حذف می‌شود. ردیف‌های قبلی سوابق می‌مانند."
          confirm="حذف"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            removeProduct(pending);
            if (code === pending) reset();
            setPending(null);
            toast.success("حذف شد");
          }}
        />
      ) : null}
    </>
  );
}

function InvPanel({ canEdit = false }: { canEdit?: boolean }) {
  const materials = useCatering((s) => s.materials);
  const entries = useCatering((s) => s.entries);
  const prods = useCatering((s) => s.prods);
  const wastes = useCatering((s) => s.wastes);
  const saveMaterial = useCatering((s) => s.saveMaterial);
  const removeMaterial = useCatering((s) => s.removeMaterial);
  const stocks = useMemo(
    () => calcStock(materials, entries, prods, wastes),
    [materials, entries, prods, wastes],
  );
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState("کیلوگرم");
  const [qty, setQty] = useState("");
  const [min, setMin] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  function reset() {
    setCode("");
    setName("");
    setUnit("کیلوگرم");
    setQty("");
    setMin("");
    setNote("");
  }

  function edit(item: (typeof materials)[number]) {
    setCode(item.code);
    setName(item.name);
    setUnit(item.unit);
    setQty(String(item.base));
    setMin(String(item.min));
    setNote(item.note);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const base = parseQty(qty);
    const floor = parseQty(min);
    if (!name.trim() || !unit.trim() || !Number.isFinite(base)) {
      toast.error("نام، واحد و موجودی اولیه الزامی است");
      return;
    }
    const ok = saveMaterial({
      code: code || undefined,
      name,
      unit,
      base,
      min: Number.isFinite(floor) ? floor : 0,
      note,
    });
    if (!ok) {
      toast.error("این نام ماده قبلاً ثبت شده");
      return;
    }
    toast.success(code ? "ماده ویرایش شد" : "ماده اضافه شد");
    reset();
  }

  return (
    <>
      <Card title="موجودی فعلی">
        <p className="mb-3 text-sm text-pretty text-muted">
          فعلی = اولیه + ورود − مصرف خالص. اگر باقیمانده «برگشت به مواد» باشد به موجودی برمی‌گردد؛
          «حمل به روز بعد» از مواد کم شده می‌ماند.
        </p>
        <ul className="space-y-2">
          {stocks.map((row) => {
            const cap = Math.max(row.base + row.totalIn, row.min, 0.001);
            const ratio = Math.max(0, Math.min(1, row.current / cap));
            return (
              <li key={row.code} className="rounded-xl border border-line bg-paper px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold">{row.name}</p>
                    <p className="text-xs text-muted">
                      {row.code} · {row.unit}
                      {row.note ? ` · ${row.note}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge status={row.status}>{row.statusLabel}</Badge>
                    {canEdit ? (
                      <RowActions
                        editLabel={`ویرایش ${row.name}`}
                        deleteLabel={`حذف ${row.name}`}
                        onEdit={() => edit(row)}
                        onDelete={() => setPending(row.code)}
                      />
                    ) : null}
                  </div>
                </div>
                <dl className="mt-2 grid grid-cols-4 gap-1 text-center text-xs text-muted">
                  <Stat label="اولیه" value={fmt(row.base)} />
                  <Stat label="ورود" value={fmt(row.totalIn)} />
                  <Stat label="مصرف" value={fmt(row.totalOut)} />
                  <Stat label="فعلی" value={fmt(row.current)} strong />
                </dl>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
                  <div
                    className={`h-full ${row.status === "ok" ? "bg-ok" : row.status === "warn" ? "bg-copper" : "bg-bad"}`}
                    style={{ width: `${Math.round(ratio * 100)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
      {canEdit ? (
        <Card title={code ? `ویرایش ${code}` : "ماده یا موجودی جدید"}>
          <form className="flex flex-col gap-3" onSubmit={submit}>
            <Field label="نام ماده">
              <input className={fieldClass} value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="واحد">
                <input className={fieldClass} value={unit} onChange={(event) => setUnit(event.target.value)} />
              </Field>
              <Field label="موجودی اولیه">
                <input
                  className={fieldClass}
                  inputMode="decimal"
                  value={qty}
                  onChange={(event) => setQty(event.target.value)}
                />
              </Field>
            </div>
            <Field label="حداقل هشدار">
              <input
                className={fieldClass}
                inputMode="decimal"
                value={min}
                onChange={(event) => setMin(event.target.value)}
              />
            </Field>
            <Field label="توضیحات">
              <input className={fieldClass} value={note} onChange={(event) => setNote(event.target.value)} />
            </Field>
            <div className={code ? "grid grid-cols-2 gap-2" : ""}>
              {code ? (
                <button
                  type="button"
                  className="h-12 rounded-xl bg-paper text-sm font-semibold text-ink ring-1 ring-line"
                  onClick={reset}
                >
                  انصراف
                </button>
              ) : null}
              <Submit>{code ? "ذخیره ویرایش" : "افزودن ماده"}</Submit>
            </div>
          </form>
        </Card>
      ) : (
        <p className="mb-3 text-center text-xs text-muted">
          مشاهده موجودی آزاد است. افزودن یا ویرایش مواد فقط با حساب مدیر ممکن است.
        </p>
      )}
      {canEdit && pending ? (
        <Confirm
          title="حذف ماده"
          body="از فهرست موجودی حذف می‌شود. ورود و تولیدهای قبلی در سوابق می‌مانند."
          confirm="حذف"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            removeMaterial(pending);
            if (code === pending) reset();
            setPending(null);
            toast.success("حذف شد");
          }}
        />
      ) : null}
    </>
  );
}

function StaffPanel() {
  const staff = useCatering((s) => s.staff);
  const saveStaff = useCatering((s) => s.saveStaff);
  const removeStaff = useCatering((s) => s.removeStaff);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      toast.error("نام الزامی است");
      return;
    }
    const ok = saveStaff({ name: name.trim(), role: role.trim(), active: true });
    if (!ok) {
      toast.error("این نام قبلاً ثبت شده");
      return;
    }
    setName("");
    setRole("");
    toast.success("پرسنل اضافه شد");
  }

  return (
    <>
      <Card title="لیست پرسنل">
        {staff.length === 0 ? (
          <Empty text="هنوز کسی ثبت نشده" />
        ) : (
          <ul>
            {staff.map((member) => (
              <li
                key={member.code}
                className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{member.name}</p>
                  <p className="text-xs text-muted">
                    {member.role || "بدون سمت"} · {member.code}
                  </p>
                </div>
                <button
                    type="button"
                    className="grid size-11 shrink-0 place-items-center rounded-xl text-bad"
                    aria-label={`حذف ${member.name}`}
                    onClick={() => setPending(member.code)}
                  >
                    <Trash2 className="size-5" />
                  </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="افزودن پرسنل">
          <form className="flex flex-col gap-3" onSubmit={submit}>
            <Field label="نام">
              <input
                id="s-name"
                className={fieldClass}
                placeholder="نام پرسنل"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field label="سمت">
              <input
                id="s-role"
                className={fieldClass}
                placeholder="تولیدکننده"
                value={role}
                onChange={(event) => setRole(event.target.value)}
              />
            </Field>
            <Submit>
              <Plus className="size-5" />
              افزودن
            </Submit>
          </form>
        </Card>
      {pending ? (
        <Confirm
          title="حذف پرسنل"
          body="این نام از فهرست و از انتخاب تولید حذف می‌شود. ثبت‌های قبلی می‌مانند."
          confirm="حذف"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            removeStaff(pending);
            setPending(null);
            toast.success("حذف شد");
          }}
        />
      ) : null}
    </>
  );
}

function HistoryPanel({ canEdit = false }: { canEdit?: boolean }) {
  const entries = useCatering((s) => s.entries);
  const prods = useCatering((s) => s.prods);
  const removeEntry = useCatering((s) => s.removeEntry);
  const removeProd = useCatering((s) => s.removeProd);
  const clearLogs = useCatering((s) => s.clearLogs);
  const loadMehr = useCatering((s) => s.loadMehr);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [editProd, setEditProd] = useState<Production | null>(null);
  const [q, setQ] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [pending, setPending] = useState<
    { kind: "entry" | "prod"; id: string } | { kind: "clear" } | { kind: "mehr" } | null
  >(null);

  const match = (text: string) => !q.trim() || text.includes(q.trim());
  const orderedEntries = [...entries]
    .reverse()
    .filter((e) => match(`${e.mat} ${e.sup} ${e.note} ${e.date}`) && (!dateFrom || e.date >= dateFrom));
  const orderedProds = [...prods]
    .reverse()
    .filter(
      (r) =>
        match(`${r.prod} ${r.staff} ${r.session} ${r.note} ${r.date}`) &&
        (!dateFrom || r.date >= dateFrom),
    );

  return (
    <>
      <Card title="جستجو و فیلتر">
        <input
          className={`${fieldClass} mb-2`}
          placeholder="جستجو در نام، تأمین‌کننده، شیفت…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <input
          className={fieldClass}
          placeholder="از تاریخ (مثال 1405/07/15)"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
      </Card>
      <Card title="ورودها" action={<Count n={orderedEntries.length} />}>
        {orderedEntries.length === 0 ? (
          <Empty text="هنوز ورودی ثبت نشده" />
        ) : (
          <ul className="space-y-2">
            {orderedEntries.map((entry) => (
              <li key={entry.id} className="rounded-xl border border-line bg-paper px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">
                    {entry.mat} — <span className="tabular-nums">{fmt(entry.qty)}</span>
                  </p>
                  {canEdit ? (
                    <div className="flex shrink-0">
                      <button
                        type="button"
                        className="grid size-11 place-items-center rounded-xl text-navy"
                        aria-label={`ویرایش ورود ${entry.mat}`}
                        onClick={() => setEditEntry(entry)}
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        className="grid size-11 place-items-center rounded-xl text-bad"
                        aria-label="حذف ورود"
                        onClick={() => setPending({ kind: "entry", id: entry.id })}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
                <p className="text-sm text-muted">
                  {entry.date}
                  {entry.byLabel ? ` · ثبت: ${entry.byLabel}` : ""}
                  {entry.sup ? ` · ${entry.sup}` : ""}
                  {entry.inv ? ` · ${entry.inv}` : ""}
                  {entry.note ? ` · ${entry.note}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card title="تولیدها" action={<Count n={prods.length} />}>
        {orderedProds.length === 0 ? (
          <Empty text="هنوز تولیدی ثبت نشده" />
        ) : (
          <ul className="space-y-2">
            {orderedProds.map((row) => (
              <li key={row.id} className="rounded-xl border border-line bg-paper px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold">
                    {row.prod} × <span className="tabular-nums">{fmt(row.qty)}</span>
                  </p>
                  {canEdit ? (
                    <div className="flex shrink-0">
                      <button
                        type="button"
                        className="grid size-11 place-items-center rounded-xl text-navy"
                        aria-label={`ویرایش تولید ${row.prod}`}
                        onClick={() => setEditProd(row)}
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        className="grid size-11 place-items-center rounded-xl text-bad"
                        aria-label="حذف تولید"
                        onClick={() => setPending({ kind: "prod", id: row.id })}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  ) : null}
                </div>
                <p className="text-sm leading-relaxed text-pretty text-muted">
                  {row.date}
                  {row.byLabel ? ` · ثبت: ${row.byLabel}` : ""}
                  {row.staff ? ` · ${row.staff}` : ""}
                  {" · "}شیفت {row.session || "—"}
                  {row.start ? ` · ${row.start} تا ${row.end}` : ""}
                  {row.duration != null ? ` · ${fmt(row.duration)} دقیقه` : ""}
                  {" · "}مصرف <span className="tabular-nums">{fmt(row.weightKg)}</span> کیلو
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {canEdit ? (
        <>
          <button
            type="button"
            className="mb-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-card text-sm font-semibold text-navy"
            onClick={() => setPending({ kind: "mehr" })}
          >
            بازگردانی ثبت‌های ۱۴ تا ۱۶ مهر
          </button>
          <button
            type="button"
            className="mb-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-line bg-card text-sm font-semibold text-bad"
            onClick={() => setPending({ kind: "clear" })}
          >
            <Trash2 className="size-4" />
            پاک‌کردن همهٔ ثبت‌ها
          </button>
        </>
      ) : (
        <p className="mb-3 text-center text-xs text-muted">
          مشاهده آزاد است. ویرایش یا حذف سوابق فقط با حساب مدیر ممکن است.
        </p>
      )}
      {pending?.kind === "mehr" ? (
        <Confirm
          title="بازگردانی ثبت‌های مهر"
          body="ورود و تولید فعلی با ردیف‌های فایل اکسل (۱۴ تا ۱۶ مهر) جایگزین می‌شود. موجودی اولیه و پرسنل دست‌نخورده می‌ماند."
          confirm="جایگزین شود"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            loadMehr();
            setPending(null);
            toast.success("ثبت‌های مهر بارگذاری شد");
          }}
        />
      ) : null}
      {pending?.kind === "clear" ? (
        <Confirm
          title="پاک کردن ثبت‌ها"
          body="همهٔ ورودها و تولیدها پاک می‌شود. موجودی اولیه و پرسنل می‌ماند."
          confirm="پاک شود"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            clearLogs();
            setPending(null);
            toast.success("ثبت‌ها پاک شد");
          }}
        />
      ) : null}
      {pending && (pending.kind === "entry" || pending.kind === "prod") ? (
        <Confirm
          title="حذف این ردیف"
          body="بعد از حذف، موجودی دوباره حساب می‌شود."
          confirm="حذف"
          onCancel={() => setPending(null)}
          onConfirm={() => {
            if (pending.kind === "entry") removeEntry(pending.id);
            else removeProd(pending.id);
            setPending(null);
            toast.success("حذف شد");
          }}
        />
      ) : null}
      {editEntry ? (
        <Sheet title="ویرایش ورود" onClose={() => setEditEntry(null)}>
          <EntryPanel
            key={editEntry.id}
            initial={editEntry}
            framed={false}
            onDone={() => setEditEntry(null)}
          />
        </Sheet>
      ) : null}
      {editProd ? (
        <Sheet title="ویرایش تولید" onClose={() => setEditProd(null)}>
          <ProdPanel
            key={editProd.id}
            initial={editProd}
            framed={false}
            onDone={() => setEditProd(null)}
          />
        </Sheet>
      ) : null}
    </>
  );
}

function LoginGate({
  title,
  onLogin,
  needRole,
}: {
  title: string;
  onLogin: (username: string, password: string) => boolean | Promise<boolean>;
  needRole: string;
}) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  return (
    <Card title={title}>
      <p className="mb-4 text-sm leading-relaxed text-muted">
        برای این بخش نقش «{needRole}» لازم است. مشاهده موجودی و سوابق برای همه آزاد است.
      </p>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await onLogin(user, pass)) {
            setUser("");
            setPass("");
          }
        }}
      >
        <input
          className={fieldClass}
          placeholder="نام کاربری"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          autoComplete="username"
        />
        <input
          type="password"
          className={fieldClass}
          placeholder="رمز"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          autoComplete="current-password"
        />
        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center rounded-xl bg-navy text-base font-semibold text-card ui-large:h-14"
        >
          ورود
        </button>
      </form>
    </Card>
  );
}


function UsersAdmin() {
  const appUsers = useCatering((s) => s.appUsers);
  const saveAppUser = useCatering((s) => s.saveAppUser);
  const removeAppUser = useCatering((s) => s.removeAppUser);
  const [username, setUsername] = useState("");
  const [label, setLabel] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("entry");
  const [editKey, setEditKey] = useState<string | undefined>(undefined);

  function resetForm() {
    setUsername("");
    setLabel("");
    setPassword("");
    setRole("entry");
    setEditKey(undefined);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    let passToSave = password;
    if (!passToSave && editKey) {
      const prev = appUsers.find((u) => u.username === editKey);
      passToSave = prev?.password ?? "";
    }
    if (!passToSave) {
      toast.error("رمز الزامی است");
      return;
    }
    if (!looksHashed(passToSave)) {
      passToSave = await hashPassword(passToSave);
    }
    const err = saveAppUser(
      { username, label, password: passToSave, role },
      editKey,
    );
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(editKey ? "کاربر ویرایش شد" : "کاربر اضافه شد");
    resetForm();
  }

  return (
    <Card title="کاربران و رمزها">
      <p className="mb-3 text-sm text-muted">
        فقط مدیر می‌تواند کاربر بسازد. رمزها هش می‌شوند و در صفحه ورود نشان داده نمی‌شوند.
        اگر هنوز با رمز اولیه admin وارد می‌شوید، حتماً رمز مدیر را از اینجا عوض کنید.
      </p>
      <form className="mb-4 flex flex-col gap-2" onSubmit={submit}>
        <input className={fieldClass} placeholder="نام نمایشی (مثلاً علی)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <input className={fieldClass} placeholder="نام کاربری (برای ورود)" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
        <input className={fieldClass} type="password" placeholder={editKey ? "رمز جدید (خالی = بدون تغییر)" : "رمز"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        <select className={fieldClass} value={role} onChange={(e) => setRole(e.target.value as Role)}>
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABELS[r]}</option>
          ))}
        </select>
        <div className="flex gap-2">
          <button type="submit" className="h-12 flex-1 rounded-xl bg-navy font-semibold text-card">
            {editKey ? "ذخیره ویرایش" : "افزودن کاربر"}
          </button>
          {editKey ? (
            <button type="button" className="h-12 rounded-xl border border-line px-4" onClick={resetForm}>
              انصراف
            </button>
          ) : null}
        </div>
      </form>
      <ul className="space-y-2">
        {appUsers.map((u) => (
          <li key={u.username} className="rounded-xl border border-line bg-paper px-3 py-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{u.label}</p>
                <p className="text-xs text-muted">{u.username} · {ROLE_LABELS[u.role]}</p>
              </div>
              <div className="flex shrink-0">
                <button
                  type="button"
                  className="grid size-11 place-items-center text-navy"
                  aria-label="ویرایش"
                  onClick={() => {
                    setEditKey(u.username);
                    setUsername(u.username);
                    setLabel(u.label);
                    setPassword("");
                    setRole(u.role);
                  }}
                >
                  <Pencil className="size-4" />
                </button>
                <button
                  type="button"
                  className="grid size-11 place-items-center text-bad"
                  aria-label="حذف"
                  onClick={() => {
                    if (!removeAppUser(u.username)) toast.error("حداقل یک مدیر باید بماند");
                    else toast.success("حذف شد");
                  }}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MorePanel({
  session,
  prefs,
  setPrefs,
  onLogin,
  onLogout,
  onOpenStaff,
  onOpenReport,
}: {
  session: Session | null;
  prefs: UiPrefs;
  setPrefs: (p: UiPrefs) => void;
  onLogin: (u: string, p: string) => boolean | Promise<boolean>;
  onLogout: () => void;
  onOpenStaff: () => void;
  onOpenReport: () => void;
}) {
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");

  return (
    <>
      <Card title="حساب کاربری">
        {session ? (
          <div className="space-y-3">
            <p className="text-sm">
              وارد شده: <strong>{session.label}</strong> ({session.username})
            </p>
            <button
              type="button"
              className="h-12 w-full rounded-xl border border-line text-sm font-semibold"
              onClick={onLogout}
            >
              خروج
            </button>
          </div>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              await onLogin(user, pass);
            }}
          >
            <input className={fieldClass} placeholder="نام کاربری" value={user} onChange={(e) => setUser(e.target.value)} />
            <input className={fieldClass} type="password" placeholder="رمز" value={pass} onChange={(e) => setPass(e.target.value)} />
            <button type="submit" className="h-12 rounded-xl bg-navy font-semibold text-card">
              ورود
            </button>
          </form>
        )}
      </Card>

      {session?.role === "admin" ? <UsersAdmin /> : null}
      {session?.role === "admin" && needsWeeklyBackup() ? (
        <Card title="یادآور پشتیبان">
          <p className="mb-3 text-sm text-muted">
            بیش از یک هفته از آخرین پشتیبان‌گیری گذشته (یا هنوز نگرفته‌اید). یک JSON دانلود کنید و جای امن نگه دارید.
          </p>
          <button
            type="button"
            className="h-12 w-full rounded-xl bg-copper font-semibold text-card"
            onClick={() => {
              exportFullBackup();
              markBackupDone();
              toast.success("پشتیبان گرفته شد");
            }}
          >
            دانلود پشتیبان الان
          </button>
        </Card>
      ) : null}

      <Card title="ظاهر و شعبه">
        <label className="mb-2 block text-sm text-muted">نام شعبه</label>
        <input
          className={`${fieldClass} mb-3`}
          value={prefs.branch}
          onChange={(e) => setPrefs({ ...prefs, branch: e.target.value })}
        />
        <div className="flex gap-2">
          <button
            type="button"
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-line"
            onClick={() => setPrefs({ ...prefs, dark: !prefs.dark })}
          >
            {prefs.dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {prefs.dark ? "روشن" : "تیره"}
          </button>
          <button
            type="button"
            className="flex h-12 flex-1 items-center justify-center rounded-xl border border-line text-sm font-semibold"
            onClick={() => setPrefs({ ...prefs, large: !prefs.large })}
          >
            {prefs.large ? "دکمه عادی" : "دکمه بزرگ"}
          </button>
        </div>
      </Card>

      {session?.role === "admin" ? (
        <Card title="پشتیبان‌گیری">
          <p className="mb-3 text-sm text-muted">فقط مدیر می‌تواند پشتیبان بگیرد یا بازیابی کند.</p>
          <button
            type="button"
            className="mb-2 h-12 w-full rounded-xl bg-navy font-semibold text-card"
            onClick={() => {
              exportFullBackup();
              markBackupDone();
              toast.success("فایل پشتیبان دانلود شد");
            }}
          >
            دانلود کل اطلاعات (JSON)
          </button>
          <label className="flex h-12 w-full cursor-pointer items-center justify-center rounded-xl border border-line text-sm font-semibold">
            بازیابی از فایل JSON
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                if (importFullBackup(text)) toast.success("بازیابی شد — همگام‌سازی انجام می‌شود");
                else toast.error("فایل نامعتبر است");
                e.target.value = "";
              }}
            />
          </label>
        </Card>
      ) : null}

      <Card title="سایر">
        <button type="button" className="mb-2 h-12 w-full rounded-xl border border-line font-semibold" onClick={onOpenReport}>
          گزارش روزانه / هفتگی
        </button>
        {session?.role === "admin" ? (
          <button type="button" className="h-12 w-full rounded-xl border border-line font-semibold" onClick={onOpenStaff}>
            مدیریت پرسنل
          </button>
        ) : null}
      </Card>
    </>
  );
}

function ReportPanel() {
  const entries = useCatering((s) => s.entries);
  const prods = useCatering((s) => s.prods);
  const wastes = useCatering((s) => s.wastes);
  const materials = useCatering((s) => s.materials);
  const today = todayJalali();
  const dayEntries = entries.filter((e) => e.date === today);
  const dayProds = prods.filter((p) => p.date === today);
  const dayWastes = wastes.filter((w) => w.date === today);
  const weekPrefix = today.split("/").slice(0, 2).join("/");
  const weekEntries = entries.filter((e) => e.date.startsWith(weekPrefix));
  const weekProds = prods.filter((p) => p.date.startsWith(weekPrefix));
  const stocks = calcStock(materials, entries, prods, wastes).filter((s) => s.status !== "ok");

  return (
    <>
      <Card title={`گزارش امروز (${today})`}>
        <p className="text-sm leading-relaxed">
          ورودها: <strong className="tabular-nums">{dayEntries.length}</strong>
          {" · "}
          مجموع ورود:{" "}
          <strong className="tabular-nums">
            {fmt(dayEntries.reduce((s, e) => s + e.qty, 0))}
          </strong>
        </p>
        <p className="mt-1 text-sm leading-relaxed">
          تولیدها: <strong className="tabular-nums">{dayProds.length}</strong>
          {" · "}
          مصرف مواد:{" "}
          <strong className="tabular-nums">
            {fmt(dayProds.reduce((s, p) => s + netUse(p), 0))}
          </strong>{" "}
          کیلو
        </p>
        <p className="mt-1 text-sm leading-relaxed">
          ضایعات: <strong className="tabular-nums">{dayWastes.length}</strong>
          {" · "}
          مجموع:{" "}
          <strong className="tabular-nums">
            {fmt(dayWastes.reduce((s, w) => s + w.qty, 0))}
          </strong>
        </p>
      </Card>
      <Card title="این ماه (تقریبی)">
        <p className="text-sm">
          ورود: <strong className="tabular-nums">{weekEntries.length}</strong> ردیف · تولید:{" "}
          <strong className="tabular-nums">{weekProds.length}</strong> ردیف
        </p>
      </Card>
      <Card title="هشدار موجودی">
        {stocks.length === 0 ? (
          <Empty text="همه مواد در وضعیت عادی‌اند" />
        ) : (
          <ul className="space-y-1 text-sm">
            {stocks.map((s) => (
              <li key={s.code}>
                {s.name}: <span className="tabular-nums">{fmt(s.current)}</span> ({s.statusLabel})
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="mb-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-line">
      <div className="mb-1 flex items-center justify-between gap-2 border-b border-line pb-2">
        <h2 className="text-base font-semibold text-navy">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  extra,
  children,
}: {
  label: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center justify-between gap-2 text-sm text-muted">
        {label}
        {extra}
      </span>
      {children}
    </label>
  );
}

function NativeSelect({
  id,
  value,
  onChange,
  children,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <select
        id={id}
        className={`${fieldClass} appearance-none pe-10`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

function Submit({ children }: { children: ReactNode }) {
  return (
    <button
      type="submit"
      className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-navy text-base font-semibold text-card active:opacity-80"
    >
      {children}
    </button>
  );
}

function TodayButton({ onPick }: { onPick: () => void }) {
  return (
    <button type="button" className="text-xs font-semibold text-copper" onClick={onPick}>
      امروز
    </button>
  );
}

function Badge({ status, children }: { status: StockStatus; children: ReactNode }) {
  const tone =
    status === "ok"
      ? "bg-ok-bg text-ok"
      : status === "warn"
        ? "bg-warn-bg text-warn"
        : "bg-bad-bg text-bad";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>
      {status !== "ok" ? <AlertTriangle className="size-3" /> : null}
      {children}
    </span>
  );
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd className={`tabular-nums ${strong ? "text-sm font-bold text-ink" : "text-ink"}`}>{value}</dd>
    </div>
  );
}

function RowActions({
  editLabel,
  deleteLabel,
  onEdit,
  onDelete,
}: {
  editLabel: string;
  deleteLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex shrink-0">
        <button
          type="button"
          className="grid size-11 place-items-center rounded-xl text-navy"
          aria-label={editLabel}
          onClick={onEdit}
        >
          <Pencil className="size-4" />
        </button>
        <button
          type="button"
          className="grid size-11 place-items-center rounded-xl text-bad"
          aria-label={deleteLabel}
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </button>
      </div>
  );
}

function Count({ n }: { n: number }) {
  return (
    <span className="rounded-full bg-ok-bg px-2 py-0.5 text-xs font-semibold tabular-nums text-ok">
      {fmt(n)}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="py-6 text-center text-sm text-muted">{text}</p>;
}

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-3 sm:items-center"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-4 text-ink shadow-lg ring-1 ring-line"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="sheet-title" className="text-base font-semibold text-navy">
            {title}
          </h2>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full text-muted"
            aria-label="بستن"
            onClick={onClose}
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Confirm({
  title,
  body,
  confirm,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirm: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Sheet title={title} onClose={onCancel}>
      <p className="text-sm leading-relaxed text-pretty">{body}</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          className="h-12 rounded-xl bg-paper text-sm font-semibold text-ink ring-1 ring-line"
          onClick={onCancel}
        >
          انصراف
        </button>
        <button
          type="button"
          className="h-12 rounded-xl bg-bad text-sm font-semibold text-card"
          onClick={onConfirm}
        >
          {confirm}
        </button>
      </div>
    </Sheet>
  );
}
