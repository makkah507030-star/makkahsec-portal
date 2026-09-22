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
// =====================================================================

const { createClient } = require("@supabase/supabase-js");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
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

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return { statusCode: 200, headers: cors, body: "" };

  // التحقق من هوية المستدعي: دعم فني أو مدير فقط
  try {
    const url = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const auth = event.headers.authorization || event.headers.Authorization || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "غير مصرّح" }, 401);

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: u } = await admin.auth.getUser(token);
    const uid = u?.user?.id;
    if (!uid) return json({ error: "جلسة غير صالحة" }, 401);

    const { data: roles } = await admin
      .from("admin_roles").select("role_type").eq("user_id", uid);
    const allowed = (roles || []).some(
      (r) => r.role_type === "tech_support" || r.role_type === "principal",
    );
    if (!allowed) return json({ error: "هذه الصفحة للدعم الفني فقط" }, 403);

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
