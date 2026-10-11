/**
 * Lightweight Cloudflare Worker for anbar-shared.
 * - /api/data  → shared state in D1 (requires X-Anbar-Key)
 * - everything else → static assets (SPA)
 */

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

function unauthorized() {
  return json({ error: "دسترسی غیرمجاز — کلید API نامعتبر است." }, 401);
}

function checkSecret(request, env) {
  const expected = env.API_SECRET;
  if (!expected) return true; // اگر هنوز ست نشده، برای مهاجرت اولیه باز بماند
  const got = request.headers.get("X-Anbar-Key") || "";
  return got === expected;
}

async function handleData(request, env) {
  if (!checkSecret(request, env)) return unauthorized();

  const db = env.DB;
  if (!db) {
    return json(
      { error: "پایگاه داده وصل نیست؛ اتصال D1 با نام DB را بررسی کنید." },
      500,
    );
  }

  if (request.method === "GET") {
    try {
      const row = await db
        .prepare("SELECT state_json, updated_at FROM app_state WHERE id = ?")
        .bind("main")
        .first();
      if (!row) return json({ state: null, updatedAt: 0 });
      return json({
        state: JSON.parse(row.state_json),
        updatedAt: Number(row.updated_at) || 0,
      });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "خطا در خواندن" },
        500,
      );
    }
  }

  if (request.method === "POST") {
    try {
      const body = await request.json();
      const state = body?.state;
      const required = ["materials", "products", "staff", "entries", "prods"];
      if (!state || !required.every((key) => Array.isArray(state[key]))) {
        return json({ error: "ساختار اطلاعات ارسالی معتبر نیست." }, 400);
      }
      const updatedAt = Date.now();
      await db
        .prepare(
          `INSERT INTO app_state (id, state_json, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             state_json = excluded.state_json,
             updated_at = excluded.updated_at`,
        )
        .bind("main", JSON.stringify(state), updatedAt)
        .run();
      return json({ success: true, updatedAt });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "خطا در ذخیره" },
        500,
      );
    }
  }

  return json({ error: "Method not allowed" }, 405);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api/data") {
      return handleData(request, env);
    }

    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response("Assets binding missing", { status: 500 });
  },
};
