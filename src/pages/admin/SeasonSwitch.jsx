import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { clearPeriodTimesCache, fmtRange } from "../../lib/periodTimes";

const SEASONS = [
  { key: "summer", label: "التوقيت الصيفي" },
  { key: "winter", label: "التوقيت الشتوي" },
  { key: "ramadan", label: "توقيت رمضان" },
];

export default function SeasonSwitch() {
  const [season, setSeason] = useState(null);
  const [grace, setGrace] = useState("0");
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [view, setView] = useState("summer");
  const [msg, setMsg] = useState(null);

  const load = async () => {
    const { data: st } = await supabase
      .from("settings").select("key, value")
      .in("key", ["active_season", "late_grace_minutes"]);
    const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
    const s = m.active_season ?? "summer";
    setSeason(s);
    setView(s);
    setGrace(m.late_grace_minutes ?? "0");
    loadCounts();
  };

  // كم صفًّا أُدخل لكل توقيت — لمنع تفعيل توقيت فارغ
  const loadCounts = async () => {
    const { data } = await supabase.from("period_times").select("season");
    const c = {};
    (data ?? []).forEach((r) => { c[r.season] = (c[r.season] || 0) + 1; });
    setCounts(c);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("period_times")
        .select("kind, period_no, label, start_time, end_time, sort_order")
        .eq("season", view)
        .order("sort_order");
      setRows(data ?? []);
    })();
  }, [view]);

  const setActive = async (s) => {
    if (!counts[s]) {
      setView(s);
      setMsg({
        ok: false,
        text: `لا يمكن تفعيل «${SEASONS.find((x) => x.key === s)?.label}» قبل إدخال جدول أوقاته.`,
      });
      return;
    }
    const { error } = await supabase
      .from("settings").upsert({ key: "active_season", value: s }, { onConflict: "key" });
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    clearPeriodTimesCache();
    setSeason(s);
    setMsg({ ok: true, text: "حُدِّث التوقيت الفعّال." });
  };

  const saveGrace = async () => {
    const v = String(Math.max(0, Number(grace) || 0));
    const { error } = await supabase
      .from("settings").upsert({ key: "late_grace_minutes", value: v }, { onConflict: "key" });
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setGrace(v);
    setMsg({ ok: true, text: "حُفظت مهلة السماح." });
  };

  if (season === null) return <p className="text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">التوقيت الزمني</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          التوقيت الفعّال يحدد أوقات الحصص في كل الشاشات، واحتساب التأخر الصباحي.
        </p>
      </div>

      <section className="card space-y-4 p-4">
        <div>
          <p className="text-xs text-muted">التوقيت الفعّال</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {SEASONS.map((s) => {
              const empty = !counts[s.key];
              return (
                <button key={s.key} onClick={() => setActive(s.key)}
                  className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
                    season === s.key ? "bg-mint-deep text-white"
                                     : `border border-line bg-white hover:bg-canvas ${
                                         empty ? "text-faint" : "text-muted"}`}`}>
                  {s.label}
                  {empty && season !== s.key && (
                    <span className="mr-1.5 text-xs">(بلا جدول)</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-xs text-muted">مهلة السماح للتأخر (بالدقائق)</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <input className="field num w-28" inputMode="numeric" value={grace}
                   onChange={(e) => setGrace(e.target.value.replace(/\D/g, ""))} />
            <button className="btn-primary" onClick={saveGrace}>حفظ</button>
          </div>
          <p className="mt-1.5 text-xs text-faint">
            من يبصم بعد بداية الحصة الأولى زائد هذه المهلة يُحتسب متأخرًا.
          </p>
        </div>

        {msg && (
          <p className={`rounded-sm2 px-3 py-2 text-sm ${
            msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
            {msg.text}
          </p>
        )}
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">جدول الأوقات</h2>
          <div className="flex flex-wrap gap-1.5">
            {SEASONS.map((s) => (
              <button key={s.key} onClick={() => setView(s.key)}
                className={`rounded-pill px-3 py-1 text-xs font-medium transition-colors ${
                  view === s.key ? "bg-mint-tint text-mint-deep"
                                 : "border border-line text-muted"}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">
            لم يُدخل هذا التوقيت بعد.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {rows.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className={`text-sm ${r.kind === "period" ? "font-medium text-ink" : "text-muted"}`}>
                  {r.label}
                </span>
                <span className="num text-sm text-muted">{fmtRange(r)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
