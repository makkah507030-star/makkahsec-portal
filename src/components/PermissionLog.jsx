import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmtGreg } from "../lib/dates";
import { useSession } from "../lib/session.jsx";
import { exportToExcel, printReport, STUDENT_DEPUTY_NAME } from "../lib/exportUtils";
import logoIcon from "../assets/icon-mint.png";
import moeLogo from "../assets/moe-logo.png";

const daysAgo = (n) =>
  new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function PermissionLog() {
  const { profile } = useSession();
  const isAdmin = profile?.role === "admin";

  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(todayStr());
  const [rows, setRows] = useState(null);
  const [names, setNames] = useState({});   // user_id -> اسم
  const [titles, setTitles] = useState({}); // user_id -> صفة
  const [raiser, setRaiser] = useState("all");
  const [busy, setBusy] = useState(null);
  const [returns, setReturns] = useState([]);

  const load = async () => {
    setRows(null);

    let q = supabase
      .from("permission_requests")
      .select(`
        id, request_date, scope, period_numbers, note, created_by, created_at,
        permission_request_students (
          student_id,
          students ( full_name, national_id )
        )
      `)
      .gte("request_date", from)
      .lte("request_date", to)
      .order("request_date", { ascending: false });

    // المعلم يرى ما رفعه هو فقط
    if (!isAdmin) q = q.eq("created_by", profile.id);

    const { data } = await q;
    const list = data ?? [];
    setRows(list);

    // عودات الطلاب المسجّلة من المعلمين خلال نفس الفترة
    const { data: rets } = await supabase
      .from("permission_returns")
      .select("student_id, return_date, from_period, returned_by")
      .gte("return_date", from)
      .lte("return_date", to);
    setReturns(rets ?? []);

    const ids = [...new Set(list.map((r) => r.created_by).filter(Boolean))];
    if (ids.length) {
      const [{ data: us }, { data: gs }] = await Promise.all([
        supabase.from("users").select("id, full_name, username").in("id", ids),
        supabase.from("permission_grantors").select("user_id, title").in("user_id", ids),
      ]);
      setNames(Object.fromEntries((us ?? []).map((u) => [u.id, u.full_name ?? u.username])));
      setTitles(Object.fromEntries((gs ?? []).map((g) => [g.user_id, g.title])));
    }
  };

  useEffect(() => { load(); }, [from, to, isAdmin]);

  const raisers = useMemo(
    () => [...new Set((rows ?? []).map((r) => r.created_by).filter(Boolean))],
    [rows]
  );

  const filtered = useMemo(
    () => (raiser === "all" ? rows ?? [] : (rows ?? []).filter((r) => r.created_by === raiser)),
    [rows, raiser]
  );

  const scopeText = (r) =>
    r.scope === "day"
      ? "اليوم كاملاً"
      : `الحصص ${(r.period_numbers ?? []).join("، ")}`;

  const remove = async (r) => {
    if (!confirm(`حذف استئذان ${r.request_date} نهائيًا؟`)) return;
    setBusy(r.id);
    const { error } = await supabase.from("permission_requests").delete().eq("id", r.id);
    setBusy(null);
    if (error) { alert("تعذّر الحذف: " + error.message); return; }
    await load();
  };

  const canDelete = (r) => isAdmin || r.created_by === profile?.id;

  // صف لكل طالب (أوضح للتصدير والطباعة)
  const flatRows = () => {
    const out = [];
    filtered.forEach((r) => {
      (r.permission_request_students ?? []).forEach((s) => {
        out.push([
          out.length + 1,
          fmtGreg(r.request_date + "T00:00:00"),
          s.students?.national_id ?? "",
          s.students?.full_name ?? "",
          scopeText(r),
          names[r.created_by] ?? "—",
          titles[r.created_by] ?? "",
          r.note ?? "",
        ]);
      });
    });
    return out;
  };

  const headers = ["م", "التاريخ", "رقم الهوية", "اسم الطالب", "النطاق", "بواسطة", "الصفة", "ملاحظة"];

  const totalStudents = filtered.reduce(
    (n, r) => n + (r.permission_request_students?.length ?? 0), 0
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted">من</label>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
               className="rounded-sm2 border border-line px-3 py-2 text-sm" />
        <label className="text-sm text-muted">إلى</label>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
               className="rounded-sm2 border border-line px-3 py-2 text-sm" />
      </div>

      {isAdmin && raisers.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <Pill on={raiser === "all"} onClick={() => setRaiser("all")}>الجميع</Pill>
          {raisers.map((id) => (
            <Pill key={id} on={raiser === id} onClick={() => setRaiser(id)}>
              {names[id] ?? "—"}
            </Pill>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          <span className="num font-semibold text-ink">{filtered.length}</span> استئذان ·{" "}
          <span className="num font-semibold text-ink">{totalStudents}</span> طالب
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            disabled={!totalStudents}
            onClick={() =>
              exportToExcel(
                flatRows().map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]]))),
                `سجل-الاستئذان-${from}_${to}`, "الاستئذان"
              )}
            className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
            تصدير Excel
          </button>
          <button
            disabled={!totalStudents}
            onClick={() =>
              printReport({
                title: "سجل الاستئذان الداخلي",
                subtitle: `${from} — ${to}`,
                headers,
                rows: flatRows(),
                logoUrl: new URL(logoIcon, window.location.origin).href,
                moeLogoUrl: new URL(moeLogo, window.location.origin).href,
                secondSignature: { title: "وكيل شؤون الطلاب", name: STUDENT_DEPUTY_NAME },
              })}
            className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas disabled:opacity-40">
            طباعة / PDF
          </button>
        </div>
      </div>

      {!rows && <p className="text-sm text-muted">جارٍ التحميل…</p>}

      {rows && filtered.length === 0 && (
        <div className="card px-6 py-12 text-center">
          <p className="font-semibold text-ink">لا استئذانات</p>
          <p className="mt-1.5 text-sm text-muted">لم تُرفع استئذانات في هذه الفترة.</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((r) => {
          const students = r.permission_request_students ?? [];
          return (
            <article key={r.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="num chip bg-mint-tint text-mint-deep">{fmtGreg(r.request_date + "T00:00:00")}</span>
                <span className="chip bg-gray-tint text-muted">{scopeText(r)}</span>
                <span className="num chip bg-gray-tint text-muted">
                  {students.length} طالب
                </span>
                <span className="ms-auto text-xs text-faint">
                  {names[r.created_by] ?? "—"}
                  {titles[r.created_by] ? ` · ${titles[r.created_by]}` : ""}
                </span>
              </div>

              {r.note && (
                <p className="mt-2.5 text-sm leading-relaxed text-ink">{r.note}</p>
              )}

              <div className="mt-3 flex flex-wrap gap-1.5">
                {students.map((s) => {
                  const ret = returns.find(
                    (x) => x.student_id === s.student_id && x.return_date === r.request_date
                  );
                  return (
                    <span key={s.student_id}
                      className={`rounded-pill border px-2.5 py-1 text-xs ${
                        ret ? "border-present/40 bg-present/10 text-present"
                            : "border-line text-muted"}`}>
                      {s.students?.full_name ?? "—"}
                      {ret && (
                        <span className="num"> · عاد من الحصة {ret.from_period}</span>
                      )}
                    </span>
                  );
                })}
              </div>

              {canDelete(r) && (
                <button
                  onClick={() => remove(r)}
                  disabled={busy === r.id}
                  className="mt-3 text-xs font-medium text-absent hover:underline disabled:opacity-50"
                >
                  {busy === r.id ? "جارٍ الحذف…" : "حذف الاستئذان"}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Pill({ on, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`shrink-0 rounded-pill px-3 py-1.5 text-sm font-medium transition-colors ${
        on ? "bg-mint-deep text-white" : "border border-line bg-paper text-muted hover:bg-canvas"}`}>
      {children}
    </button>
  );
}
