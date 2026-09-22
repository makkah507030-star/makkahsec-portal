// =====================================================================
//  بوابة مكة الثانوية الرقمية
//  Netlify Function: site-metrics — يجمع مؤشرات الموقع من الجهات الداعمة
//  (حالة الخدمات + Netlify API + Supabase Management API).
//
//  محمي: يقبل فقط مستخدمًا مسجّلًا بدور الدعم الفني أو مدير المدرسة.
//  المفاتيح تُقرأ من متغيّرات بيئة Netlify (لا تظهر أبدًا في الواجهة):
//    NETLIFY_API_TOKEN, NETLIFY_SITE_ID
//    SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF
//  ما لم يُضبط مفتاحه يعود كـ configured=false بدل أن يفشل.
//
//  GET  → مؤشرات المنصّات الحيّة.
//  POST {action:"snapshot"} → حفظ لقطة اليوم يدويًا في site_status_snapshots.
//  وتستورد الدالة المجدولة site-status-snapshot.mjs الدالة buildSnapshot من هنا.
// =====================================================================

const { createClient } = require("@supabase/supabase-js");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (body, status = 200) => ({
  statusCode: status,
  headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});

// جلب مع مهلة قصوى حتى لا تتعلّق الدالة على مصدر بطيء
async function fetchJSON(url, opts = {}, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    if (!res.ok) return { ok: false, status: res.status, data };
    return { ok: true, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, error: String(e?.message || e) };
  } finally {
    clearTimeout(t);
  }
}

// صفحات الحالة الرسمية (Statuspage.io) — عامة بلا مفاتيح
async function serviceStatus() {
  const [nf, sb] = await Promise.all([
    fetchJSON("https://www.netlifystatus.com/api/v2/status.json"),
    fetchJSON("https://status.supabase.com/api/v2/status.json"),
  ]);
  const pick = (r) =>
    r.ok && r.data?.status
      ? { indicator: r.data.status.indicator, description: r.data.status.description }
      : { indicator: "unknown", description: "تعذّر جلب الحالة" };
  return { netlify: pick(nf), supabase: pick(sb) };
}

async function netlifyMetrics() {
  const token = process.env.NETLIFY_API_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  if (!token || !siteId) return { configured: false };
  const h = { Authorization: `Bearer ${token}` };

  const site = await fetchJSON(`https://api.netlify.com/api/v1/sites/${siteId}`, { headers: h });
  if (!site.ok) return { configured: true, error: `تعذّر جلب الموقع (${site.status})` };
  const s = site.data || {};
  const out = {
    configured: true,
    name: s.name,
    url: s.ssl_url || s.url,
    state: s.state,
    account_name: s.account_name,
    account_slug: s.account_slug,
    published_deploy: s.published_deploy
      ? {
          state: s.published_deploy.state,
          published_at: s.published_deploy.published_at,
          deploy_time: s.published_deploy.deploy_time,
          branch: s.published_deploy.branch,
        }
      : null,
  };

  // النطاق الترددي على مستوى الحساب (قد لا يتوفّر لكل الخطط)
  if (s.account_slug) {
    const bw = await fetchJSON(
      `https://api.netlify.com/api/v1/accounts/${s.account_slug}/bandwidth`,
      { headers: h },
    );
    if (bw.ok && bw.data) {
      out.bandwidth = {
        used: bw.data.used,
        included: bw.data.included,
        period_start: bw.data.period_start_date,
        period_end: bw.data.period_end_date,
      };
    }
  }
  return out;
}

async function supabaseMetrics() {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!token || !ref) return { configured: false };
  const h = { Authorization: `Bearer ${token}` };

  const proj = await fetchJSON(`https://api.supabase.com/v1/projects/${ref}`, { headers: h });
  if (!proj.ok) return { configured: true, error: `تعذّر جلب المشروع (${proj.status})` };
  const p = proj.data || {};
  return {
    configured: true,
    name: p.name,
    region: p.region,
    status: p.status,
    created_at: p.created_at,
    plan: p.subscription_tier || p.plan || null,
  };
}

// =====================================================================
//  اللقطة اليومية لملخّص الحالة
// =====================================================================

const adminClient = () =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

// اليوم بتوقيت السعودية (UTC+3 بلا توقيت صيفي) وبداية اليوم بصيغة ISO
const KSA_OFFSET_MS = 3 * 60 * 60 * 1000;
function ksaDay(now = new Date()) {
  const day = new Date(now.getTime() + KSA_OFFSET_MS).toISOString().slice(0, 10);
  const startISO = new Date(Date.parse(`${day}T00:00:00Z`) - KSA_OFFSET_MS).toISOString();
  return { day, startISO };
}

// نفس قواعد computeHealth في SiteMetrics.jsx — عدّلهما معًا عند تغيير أي حدّ
const SEV_RANK = { ok: 0, info: 1, warn: 2, crit: 3 };
const worst = (a, b) => (SEV_RANK[a] >= SEV_RANK[b] ? a : b);

function computeHealth(app, plat) {
  const checks = [];

  const indMap = { none: "ok", minor: "warn", major: "crit", critical: "crit", maintenance: "info" };
  const nfInd = plat?.status?.netlify?.indicator, sbInd = plat?.status?.supabase?.indicator;
  if (nfInd || sbInd) {
    checks.push({ area: "تقني", label: "حالة الخدمات الداعمة",
      sev: worst(indMap[nfInd] ?? "info", indMap[sbInd] ?? "info"),
      detail: `Netlify: ${plat?.status?.netlify?.description ?? "—"} · Supabase: ${plat?.status?.supabase?.description ?? "—"}` });
  }

  if (plat?.netlify?.configured && plat.netlify.published_deploy) {
    const ready = plat.netlify.published_deploy.state === "ready";
    checks.push({ area: "تقني", label: "آخر عملية نشر",
      sev: ready ? "ok" : "warn",
      detail: ready ? "اكتمل النشر بنجاح" : `الحالة: ${plat.netlify.published_deploy.state}` });
  }

  if (plat?.netlify?.bandwidth?.included) {
    const { used, included } = plat.netlify.bandwidth;
    const pct = Math.round((used / included) * 100);
    checks.push({ area: "سعة", label: "استهلاك النطاق الترددي",
      sev: pct >= 90 ? "crit" : pct >= 75 ? "warn" : "ok",
      detail: `${pct}% من الحصة الشهرية` });
  }

  if (app?.pendingPw != null) {
    const ratio = app.usersTotal ? app.pendingPw / app.usersTotal : 0;
    checks.push({ area: "أمني", label: "حسابات بكلمة المرور الافتراضية",
      sev: app.pendingPw === 0 ? "ok" : ratio > 0.2 ? "warn" : "info",
      detail: `${app.pendingPw} حساب لم يغيّر كلمة المرور بعد` });
  }

  if (app?.failedToday != null) {
    checks.push({ area: "أمني", label: "محاولات دخول فاشلة اليوم",
      sev: app.failedToday >= 30 ? "crit" : app.failedToday >= 10 ? "warn" : "ok",
      detail: `${app.failedToday} محاولة فاشلة` });
  }

  if (app?.drafts != null && app.drafts > 0) {
    checks.push({ area: "تقني", label: "إشعارات بانتظار الاعتماد",
      sev: "info", detail: `${app.drafts} بانتظار المراجعة` });
  }

  return { verdict: checks.reduce((v, c) => worst(v, c.sev), "ok"), checks };
}

async function collectAppStats(admin, startISO) {
  const head = { count: "exact", head: true };
  const C = async (q) => {
    try { const r = await q; return r.error ? null : (r.count ?? null); } catch { return null; }
  };
  const [usersTotal, pendingPw, loginsToday, failedToday, drafts, tickets] = await Promise.all([
    C(admin.from("users").select("id", head)),
    C(admin.from("users").select("id", head).eq("must_change_pw", true)),
    C(admin.from("login_log").select("id", head).eq("event_type", "login").eq("success", true).gte("created_at", startISO)),
    C(admin.from("login_log").select("id", head).eq("event_type", "login").eq("success", false).gte("created_at", startISO)),
    C(admin.from("notification_drafts").select("id", head).eq("status", "pending")),
    C(admin.from("support_tickets").select("id", head).neq("status", "closed")),
  ]);
  return { usersTotal, pendingPw, loginsToday, failedToday, drafts, tickets };
}

const RETENTION_DAYS = 365;

async function buildSnapshot(admin, source = "scheduled") {
  const { day, startISO } = ksaDay();
  const [status, netlify, supabase, app, dbr] = await Promise.all([
    serviceStatus(),
    netlifyMetrics(),
    supabaseMetrics(),
    collectAppStats(admin, startISO),
    admin.rpc("admin_db_stats").then((r) => r, () => ({ error: true })),
  ]);

  const { verdict, checks } = computeHealth(app, { status, netlify, supabase });
  const db = dbr?.error ? null : (dbr?.data ?? null);
  const bw = netlify?.bandwidth;

  const row = {
    day,
    verdict,
    checks,
    metrics: {
      ...app,
      db_bytes: db?.db_bytes ?? null,
      storage_bytes: db?.storage_bytes ?? null,
      bandwidth_pct: bw?.included ? Math.round((bw.used / bw.included) * 100) : null,
    },
    source,
    created_at: new Date().toISOString(),
  };

  const { error } = await admin.from("site_status_snapshots").upsert(row, { onConflict: "day" });
  if (error) throw new Error(`تعذّر حفظ اللقطة: ${error.message}`);

  // الاحتفاظ بسنة واحدة فقط
  const cutoff = new Date(Date.parse(`${day}T00:00:00Z`) - RETENTION_DAYS * 86400000)
    .toISOString().slice(0, 10);
  await admin.from("site_status_snapshots").delete().lt("day", cutoff);

  return row;
}

// =====================================================================

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };

  // التحقق من هوية المستدعي: دعم فني أو مدير فقط
  try {
    const auth = event.headers.authorization || event.headers.Authorization || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "غير مصرّح" }, 401);

    const admin = adminClient();
    const { data: u } = await admin.auth.getUser(token);
    const uid = u?.user?.id;
    if (!uid) return json({ error: "جلسة غير صالحة" }, 401);

    const { data: roles } = await admin
      .from("admin_roles").select("role_type").eq("user_id", uid);
    const allowed = (roles || []).some(
      (r) => r.role_type === "tech_support" || r.role_type === "principal",
    );
    if (!allowed) return json({ error: "هذه الصفحة للدعم الفني فقط" }, 403);

    // حفظ لقطة اليوم يدويًا
    if (event.httpMethod === "POST") {
      let body = {};
      try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }
      if (body.action !== "snapshot") return json({ error: "إجراء غير معروف" }, 400);
      const snapshot = await buildSnapshot(admin, "manual");
      return json({ ok: true, snapshot });
    }

    const [status, netlify, supabase] = await Promise.all([
      serviceStatus(),
      netlifyMetrics(),
      supabaseMetrics(),
    ]);

    return json({ ok: true, at: new Date().toISOString(), status, netlify, supabase });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
};

// للاستخدام من الدالة المجدولة
exports.adminClient = adminClient;
exports.buildSnapshot = buildSnapshot;
