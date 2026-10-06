import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { clearPeriodTimesCache, fmtRange, toMinutes } from "../../lib/periodTimes";
import { useSession } from "../../lib/session.jsx";
import Loader from "../../components/Loader.jsx";
import { useNotice } from "../../lib/useNotice.js";
import { confirmDanger } from "../../lib/danger";
import DangerZone from "../../components/DangerZone.jsx";

const SEASONS = [
  { key: "summer", label: "التوقيت الصيفي" },
  { key: "winter", label: "التوقيت الشتوي" },
  { key: "ramadan", label: "توقيت رمضان" },
];

/* ---------------- محرّر جدول الأوقات ----------------
   يعدّل صفوف توقيت واحد: الحصص والفسح والصلاة والاصطفاف، بأوقاتها وترتيبها.
   أرقام الحصص تُحسب تلقائيًا بترتيبها. للمدير والدعم الفني (سياسة period_times_write). */

const hhmm = (t) => String(t ?? "").slice(0, 5);
let tmpId = 0;

function TimesEditor({ season, label, rows, isActive, otherSeasons, onDone, onCancel, setMsg }) {
  const [list, setList] = useState(() => rows.map((r) => ({ ...r, start_time: hhmm(r.start_time), end_time: hhmm(r.end_time) })));
  const [busy, setBusy] = useState(false);

  const set = (i, k, v) => setList((l) => l.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const move = (i, d) => setList((l) => {
    const j = i + d;
    if (j < 0 || j >= l.length) return l;
    const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });
  const add = (kind) => setList((l) => {
    const last = l[l.length - 1];
    const start = last?.end_time || "07:00";
    const m = toMinutes(start) + (kind === "period" ? 45 : 20);
    const end = `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    return [...l, { _new: ++tmpId, kind, label: kind === "period" ? "" : "الفسحة", start_time: start, end_time: end }];
  });

  // نسخ جدول توقيت آخر بديلًا عن هذا (يُراجع ثم يُحفظ)
  const copyFrom = async (src) => {
    const { data } = await supabase.from("period_times")
      .select("kind, period_no, label, start_time, end_time, sort_order").eq("season", src).order("sort_order");
    setList((data ?? []).map((r) => ({ ...r, _new: ++tmpId, start_time: hhmm(r.start_time), end_time: hhmm(r.end_time) })));
  };

  // أرقام الحصص بترتيبها، والتسمية الافتراضية «الحصة …»
  const WORDS = ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة", "الثامنة", "التاسعة"];
  const numbered = () => {
    let n = 0;
    return list.map((r, i) => {
      const period_no = r.kind === "period" ? ++n : null;
      return { ...r, period_no, sort_order: i + 1,
               label: r.label.trim() || (r.kind === "period" ? `الحصة ${WORDS[period_no - 1] ?? period_no}` : "فعالية") };
    });
  };

  const problems = () => {
    const out = [];
    list.forEach((r, i) => {
      const s = toMinutes(r.start_time), e = toMinutes(r.end_time);
      if (s == null || e == null || !r.start_time || !r.end_time) out.push(`الصف ${i + 1}: أكمل وقت البداية والنهاية.`);
      else if (e <= s) out.push(`الصف ${i + 1}: النهاية قبل البداية.`);
      const prev = list[i - 1];
      if (prev && toMinutes(prev.end_time) > s) out.push(`الصف ${i + 1}: يبدأ قبل نهاية الصف السابق.`);
    });
    return out;
  };
  const errs = problems();

  const save = async () => {
    if (errs.length) return;
    if (isActive) {
      const ok = await confirmDanger({
        title: `حفظ جدول «${label}» — التوقيت الفعّال`,
        impact: [
          "تتغيّر أوقات الحصص فورًا في كل الشاشات: التحضير والجداول وحصص الانتظار.",
          "يتغيّر وقت فتح التحضير واحتساب التأخر الصباحي من هذه اللحظة.",
        ],
        confirmLabel: "حفظ الجدول",
      });
      if (!ok) return;
    }
    setBusy(true);
    const rowsOut = numbered();
    const keep = rowsOut.filter((r) => r.id).map((r) => r.id);
    const removed = rows.filter((r) => !keep.includes(r.id)).map((r) => r.id);
    const payload = (r) => ({ season, kind: r.kind, period_no: r.period_no, label: r.label,
                              start_time: r.start_time, end_time: r.end_time, sort_order: r.sort_order });
    let error = null;
    if (removed.length) ({ error } = await supabase.from("period_times").delete().in("id", removed));
    for (const r of rowsOut) {
      if (error) break;
      ({ error } = r.id
        ? await supabase.from("period_times").update(payload(r)).eq("id", r.id)
        : await supabase.from("period_times").insert(payload(r)));
    }
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    clearPeriodTimesCache();
    setMsg({ ok: true, text: `حُفظ جدول «${label}».` });
    onDone();
  };

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>نسخ من:</span>
        {otherSeasons.map((o) => (
          <button key={o.key} type="button" onClick={() => copyFrom(o.key)}
                  className="rounded-pill border border-line px-3 py-1 hover:bg-canvas">{o.label}</button>
        ))}
      </div>

      <div className="space-y-2">
        {list.map((r, i) => (
          <div key={r.id ?? r._new} className={`flex flex-wrap items-center gap-2 rounded-sm2 border p-2 ${
            r.kind === "period" ? "border-line bg-white" : "border-[#CCF2DB] bg-mint-tint"}`}>
            <select className="field w-24 py-1.5 text-sm" value={r.kind === "period" ? "period" : "other"}
                    onChange={(e) => set(i, "kind", e.target.value === "period" ? "period" : (rows.find((x) => x.id === r.id && x.kind !== "period")?.kind ?? "break"))}>
              <option value="period">حصة</option>
              <option value="other">فعالية</option>
            </select>
            <input className="field min-w-[9rem] flex-1 py-1.5 text-sm" value={r.label}
                   placeholder={r.kind === "period" ? "يُسمّى تلقائيًا: الحصة …" : "الفسحة، الصلاة، الاصطفاف…"}
                   onChange={(e) => set(i, "label", e.target.value)} />
            <input type="time" className="field num w-28 py-1.5 text-sm" value={r.start_time}
                   onChange={(e) => set(i, "start_time", e.target.value)} />
            <span className="text-xs text-faint">إلى</span>
            <input type="time" className="field num w-28 py-1.5 text-sm" value={r.end_time}
                   onChange={(e) => set(i, "end_time", e.target.value)} />
            <div className="mr-auto flex gap-1 text-xs">
              <button type="button" className="rounded border border-line px-2 py-1 hover:bg-canvas" onClick={() => move(i, -1)} title="أعلى">▲</button>
              <button type="button" className="rounded border border-line px-2 py-1 hover:bg-canvas" onClick={() => move(i, 1)} title="أسفل">▼</button>
              <button type="button" className="rounded border border-absent/30 px-2 py-1 text-absent hover:bg-absent/5"
                      onClick={() => setList((l) => l.filter((_, j) => j !== i))}>حذف</button>
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="text-sm text-muted">لا صفوف. أضف حصة، أو انسخ جدول توقيت آخر.</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="rounded-sm2 border border-mint-deep px-3 py-1.5 text-sm font-semibold text-mint-deep hover:bg-mint-tint"
                onClick={() => add("period")}>+ حصة</button>
        <button type="button" className="rounded-sm2 border border-line px-3 py-1.5 text-sm text-muted hover:bg-canvas"
                onClick={() => add("break")}>+ فسحة أو صلاة</button>
      </div>

      {errs.length > 0 && (
        <ul className="list-inside list-disc rounded-sm2 bg-absent/10 px-3 py-2 text-xs text-absent">
          {errs.map((e) => <li key={e}>{e}</li>)}
        </ul>
      )}

      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <button className="btn-primary" disabled={busy || errs.length > 0 || list.length === 0} onClick={save}>حفظ الجدول</button>
        <button className="rounded-sm2 border border-line px-4 py-2 text-sm text-muted hover:bg-canvas" onClick={onCancel}>إلغاء</button>
        <p className="w-full text-[11px] text-faint">أرقام الحصص تُحسب بترتيبها، والحصة بلا اسم تُسمّى «الحصة الأولى، الثانية…» تلقائيًا.</p>
      </div>
    </div>
  );
}

export default function SeasonSwitch() {
  const { hasAdminRole } = useSession();
  const canEdit = hasAdminRole("principal", "tech_support");
  const [editing, setEditing] = useState(false);
  const [reload, setReload] = useState(0);
  const [season, setSeason] = useState(null);
  const [grace, setGrace] = useState("0");
  const [rows, setRows] = useState([]);
  const [counts, setCounts] = useState({});
  const [view, setView] = useState("summer");
  const [msg, setMsg] = useNotice(null);

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
        .select("id, kind, period_no, label, start_time, end_time, sort_order")
        .eq("season", view)
        .order("sort_order");
      setRows(data ?? []);
    })();
  }, [view, reload]);

  const setActive = async (s) => {
    if (!counts[s]) {
      setView(s);
      setMsg({
        ok: false,
        text: `لا يمكن تفعيل «${SEASONS.find((x) => x.key === s)?.label}» قبل إدخال جدول أوقاته.`,
      });
      return;
    }
    if (s === season) return;
    const ok = await confirmDanger({
      title: `تفعيل «${SEASONS.find((x) => x.key === s)?.label}»`,
      impact: [
        "تتغيّر أوقات الحصص فورًا في كل الشاشات: التحضير والجداول وحصص الانتظار.",
        "يتغيّر احتساب التأخر الصباحي من هذه اللحظة.",
      ],
      confirmLabel: "تفعيل التوقيت",
    });
    if (!ok) return;
    const { error } = await supabase
      .from("settings").upsert({ key: "active_season", value: s }, { onConflict: "key" });
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    clearPeriodTimesCache();
    setSeason(s);
    setMsg({ ok: true, text: "حُدِّث التوقيت الفعّال." });
  };

  const saveGrace = async () => {
    const v = String(Math.max(0, Number(grace) || 0));
    const ok = await confirmDanger({
      title: `مهلة السماح للتأخر: ${v} دقيقة`,
      impact: ["يتغيّر احتساب التأخر الصباحي لكل الطلاب من هذه اللحظة."],
      confirmLabel: "حفظ المهلة",
    });
    if (!ok) return;
    const { error } = await supabase
      .from("settings").upsert({ key: "late_grace_minutes", value: v }, { onConflict: "key" });
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setGrace(v);
    setMsg({ ok: true, text: "حُفظت مهلة السماح." });
  };

  if (season === null) return <Loader compact />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">التوقيت الزمني</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          التوقيت الفعّال يحدد أوقات الحصص في كل الشاشات، واحتساب التأخر الصباحي.
        </p>
      </div>

      <section className="card space-y-4 p-4">
        <DangerZone className="space-y-4" note="التوقيت والمهلة يغيّران أوقات الحصص واحتساب التأخر للمدرسة كلها">
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
        </DangerZone>

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
              <button key={s.key} onClick={() => { setView(s.key); setEditing(false); }}
                className={`rounded-pill px-3 py-1 text-xs font-medium transition-colors ${
                  view === s.key ? "bg-mint-tint text-mint-deep"
                                 : "border border-line text-muted"}`}>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {canEdit && !editing && (
          <div className="flex items-center justify-between gap-2 border-b border-line bg-canvas/50 px-4 py-2">
            <span className="text-xs text-muted">{SEASONS.find((x) => x.key === view)?.label}{view === season ? " — الفعّال الآن" : ""}</span>
            <button className="rounded-sm2 border border-mint-deep px-3 py-1 text-xs font-semibold text-mint-deep hover:bg-mint-tint"
                    onClick={() => setEditing(true)}>
              {rows.length ? "تعديل الجدول" : "إدخال الجدول"}
            </button>
          </div>
        )}

        {editing ? (
          <TimesEditor key={view} season={view} label={SEASONS.find((x) => x.key === view)?.label} rows={rows}
                       isActive={view === season} setMsg={setMsg}
                       otherSeasons={SEASONS.filter((x) => x.key !== view && counts[x.key])}
                       onCancel={() => setEditing(false)}
                       onDone={() => { setEditing(false); setReload((n) => n + 1); loadCounts(); }} />
        ) : rows.length === 0 ? (
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
