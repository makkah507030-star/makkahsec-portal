// ملف الطالب الشامل: الغياب الرسمي والتأخر الصباحي وغياب الحصص والإنذارات في صفحة واحدة
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { todayISO, GRADE_NAMES } from "../../lib/schoolTime";
import { fmtDate, fmtTime12 } from "../../lib/dates";
import { printReport } from "../../lib/exportUtils";
import { fetchAllPaged } from "../../lib/attendanceHelpers";
import { loadRangeStart, WARNING_STAGES, OFFICIAL_LABEL } from "../../lib/officialAttendance";
import { SIGNS, logos, Fig, DateInput, Note, Loading, weekdayOf, useFingerprint } from "./shared.jsx";
import { useSession } from "../../lib/session.jsx";
import { countAr } from "../../lib/arabicCount.js";
import { byName } from "../../lib/sortAr.js";

// من يعدّل حضور الحصص (supabase/class_attendance_staff_edit.sql)
const EDIT_ROLES = ["principal", "tech_support", "deputy_students"];

const P_STATUS = {
  present: { t: "حاضر",   c: "text-present" },
  absent:  { t: "غائب",   c: "text-absent" },
  late:    { t: "متأخر",  c: "text-late" },
  excused: { t: "مستأذن", c: "text-excused" },
};

const STAGE = Object.fromEntries(WARNING_STAGES.map((s) => [s.key, s]));

export default function StudentFile() {
  const [all, setAll] = useState(null);
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(null);
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(todayISO());

  useEffect(() => {
    loadRangeStart(todayISO()).then((d) => setFrom(d ?? todayISO().slice(0, 8) + "01"));
    fetchAllPaged(() => supabase.from("v_active_students")
      .select("student_id, full_name, class_no, grade").order("student_id", { ascending: true }))
      .then((r) => setAll(r.sort(byName()))).catch(() => setAll([]));
  }, []);

  const matches = useMemo(() => {
    const t = q.trim();
    if (t.length < 2 || !all) return [];
    return all.filter((s) => s.full_name?.includes(t)).slice(0, 12);
  }, [q, all]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <input value={q} onChange={(e) => { setQ(e.target.value); setPicked(null); }}
          placeholder="ابحث باسم الطالب…"
          className="w-full rounded-sm2 border border-line px-4 py-2.5 text-sm" />
        {!picked && matches.length > 0 && (
          <div className="card absolute inset-x-0 top-full z-10 mt-1 divide-y divide-line overflow-hidden">
            {matches.map((s) => (
              <button key={s.student_id} onClick={() => { setPicked(s); setQ(s.full_name); }}
                className="block w-full px-4 py-2 text-right text-sm hover:bg-canvas">
                {s.full_name} <span className="text-xs text-muted">· صف {s.grade} · فصل {s.class_no}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {from && (
        <div className="flex flex-wrap items-center gap-3">
          <DateInput label="من" value={from} onChange={setFrom} />
          <DateInput label="إلى" value={to} onChange={setTo} />
        </div>
      )}

      {!picked ? <Note>اختر طالبًا لعرض ملفه: الغياب الرسمي، التأخر الصباحي، غياب الحصص، والإنذارات.</Note>
        : from && <FileBody s={picked} from={from} to={to} />}
    </div>
  );
}

function FileBody({ s, from, to }) {
  const [data, setData] = useState(null);
  const [reload, setReload] = useState(0);
  const fp = useFingerprint();
  const { adminRoles, session } = useSession();
  const canEdit = (adminRoles ?? []).some((r) => EDIT_ROLES.includes(r));

  useEffect(() => {
    (async () => {
      setData(null);
      const [marks, warns, periods, nid] = await Promise.all([
        supabase.from("official_day_marks")
          .select("attend_date, status, punched, punch_time, late_minutes, manual, note")
          .eq("student_id", s.student_id).gte("attend_date", from).lte("attend_date", to)
          .order("attend_date", { ascending: true }),
        supabase.from("absence_warnings").select("stage, issued_on, source, days_count")
          .eq("student_id", s.student_id).order("issued_on", { ascending: true }),
        fetchAllPaged(() => supabase.from("class_attendance")
          .select("id, attend_date, status, updated_at, schedule(period_no, subjects(name))")
          .eq("student_id", s.student_id).in("status", ["absent", "late", "excused"])
          .gte("attend_date", from).lte("attend_date", to)
          .order("id", { ascending: true })).catch(() => []),
        supabase.from("students").select("national_id").eq("id", s.student_id).maybeSingle(),
      ]);
      setData({
        marks: marks.data ?? [], warns: warns.data ?? [], periods, nid: nid.data?.national_id ?? "",
        notReady: !!marks.error,
      });
    })();
  }, [s, from, to, reload]);

  if (!data) return <Loading />;

  const absent = data.marks.filter((m) => m.status === "absent");
  const excused = data.marks.filter((m) => m.status === "excused");
  const late = data.marks.filter((m) => m.late_minutes > 0);
  const pAbsent = data.periods.filter((p) => p.status === "absent");
  const pLate = data.periods.filter((p) => p.status === "late");

  const bySubject = {};
  pAbsent.forEach((p) => {
    const n = p.schedule?.subjects?.name ?? "—";
    bySubject[n] = (bySubject[n] ?? 0) + 1;
  });

  const print = () => printReport({
    title: "ملف متابعة الطالب — الحضور والغياب",
    sections: [{
      title: "ملف متابعة الطالب — الحضور والغياب",
      subtitle: `${fmtDate(from + "T00:00:00")} — ${fmtDate(to + "T00:00:00")}`,
      html: studentFileHtml({ s, nid: data.nid, from, to, fp, absent, excused, late, pAbsent, pLate, warns: data.warns, bySubject }),
    }],
    ...logos(), signatures: SIGNS,
  });

  return (
    <div className="space-y-4">
      {data.notReady && <Note tone="warn">الأيام المعتمدة غير متاحة بعد — نفّذ ملف SQL الخاص بالمركز.</Note>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fig value={absent.length} label="غياب رسمي بدون عذر" tone="text-absent" />
        <Fig value={excused.length} label="غياب بعذر" tone="text-excused" />
        {fp ? <Fig value={late.length} label="تأخر صباحي" tone="text-late" />
            : <Fig value="—" label="تأخر صباحي" hint="البصمة مقفلة" />}
        <Fig value={pAbsent.length} label="حصص غياب" tone="text-absent" hint={`تأخر عن ${countAr(pLate.length, "period", { acc: true })}`} />
      </div>

      <button onClick={print}
        className="rounded-sm2 border border-line bg-paper px-4 py-2 text-sm font-medium text-ink hover:bg-canvas">
        طباعة ملف الطالب
      </button>

      <Section title="الإنذارات">
        {data.warns.length === 0 ? <p className="text-sm text-muted">لا إنذارات.</p> : data.warns.map((w) => (
          <p key={w.stage} className="text-sm text-ink">
            {STAGE[w.stage]?.label} · <span className="num">{fmtDate(w.issued_on + "T12:00:00")}</span>
            {w.source === "paper" && <span className="text-xs text-muted"> (ورقي)</span>}
          </p>
        ))}
      </Section>

      <Section title="الغياب الرسمي">
        {absent.length + excused.length === 0 ? <p className="text-sm text-muted">لا غياب رسمي في الفترة.</p> : (
          <div className="flex flex-wrap gap-1.5">
            {[...absent, ...excused].sort((a, b) => a.attend_date.localeCompare(b.attend_date)).map((m) => (
              <span key={m.attend_date} className={`rounded-sm2 px-2 py-1 text-xs ${
                m.status === "absent" ? "bg-absent/10 text-absent" : "bg-excused/10 text-excused"}`}>
                {weekdayOf(m.attend_date)} {fmtDate(m.attend_date + "T12:00:00")} · {OFFICIAL_LABEL[m.status]}
                {m.punched ? " · بصم ولم يحضر" : ""}
              </span>
            ))}
          </div>
        )}
      </Section>

      {fp && <Section title="التأخر الصباحي">
        {late.length === 0 ? <p className="text-sm text-muted">لا تأخر في الفترة.</p> : (
          <div className="flex flex-wrap gap-1.5">
            {late.map((m) => (
              <span key={m.attend_date} className="rounded-sm2 bg-late/10 px-2 py-1 text-xs text-late">
                {fmtDate(m.attend_date + "T12:00:00")} ·{" "}
                {m.punch_time ? <>{fmtTime12(m.punch_time)} · {m.late_minutes} د</> : "لم يبصم · بلا وقت"}
              </span>
            ))}
          </div>
        )}
      </Section>}

      {canEdit && <PeriodEdit periods={data.periods} uid={session?.user?.id ?? null} onSaved={() => setReload((n) => n + 1)} />}

      <Section title="غياب الحصص حسب المادة">
        {Object.keys(bySubject).length === 0 ? <p className="text-sm text-muted">لا غياب حصص.</p> : (
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(bySubject).sort((a, b) => b[1] - a[1]).map(([n, c]) => (
              <span key={n} className="rounded-sm2 bg-gray-tint px-2 py-1 text-xs text-ink">
                {n} · <span className="num">{c}</span>
              </span>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

/* محتوى ملف الطالب المطبوع بهوية البوابة: بطاقة الطالب، ثم بطاقات الأرقام،
   ثم جدول لكل قسم (الإنذارات، الغياب الرسمي، التأخر الصباحي، غياب الحصص). */
function studentFileHtml({ s, nid, from, to, fp, absent, excused, late, pAbsent, pLate, warns, bySubject }) {
  const day = (d) => `${weekdayOf(d)} ${fmtDate(d + "T12:00:00")}`;
  const kv = (k, v) => `<tr><th>${k}</th><td>${v ?? "—"}</td></tr>`;
  const tile = (v, l, color) =>
    `<div class="stat-tile"><div class="v"${color ? ` style="color:${color}"` : ""}>${v}</div><div class="l">${l}</div></div>`;
  const head = (t, n) => `<p class="sec-h">${t}${n != null ? ` <span class="c">(${n})</span>` : ""}</p>`;
  const table = (cls, hs, rows) => `<table class="${cls}"><thead><tr>${hs.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c ?? ""}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const empty = (t) => `<p class="empty">${t}</p>`;

  const official = [...absent, ...excused].sort((a, b) => a.attend_date.localeCompare(b.attend_date));
  const periods = [...pAbsent, ...pLate].sort((a, b) =>
    a.attend_date.localeCompare(b.attend_date) || (a.schedule?.period_no ?? 0) - (b.schedule?.period_no ?? 0));
  const subjects = Object.entries(bySubject).sort((a, b) => b[1] - a[1]);

  return `
    <table class="kv">
      ${kv("اسم الطالب", s.full_name)}${kv("رقم الهوية", nid)}
      ${kv("الصف / الفصل", `${GRADE_NAMES[s.grade] ?? s.grade} / ${s.class_no}`)}
      ${kv("الفترة", `${fmtDate(from + "T00:00:00")} — ${fmtDate(to + "T00:00:00")}`)}
    </table>
    <div class="stat-tiles" style="margin-top:12px">
      ${tile(absent.length, "غياب رسمي بدون عذر", "#B02A2A")}${tile(excused.length, "غياب بعذر", "#544CC0")}
      ${fp ? tile(late.length, "تأخر صباحي", "#9A6B12") : ""}
      ${tile(pAbsent.length, "حصص غياب", "#B02A2A")}${tile(pLate.length, "حصص تأخر", "#9A6B12")}
      ${tile(warns.length, "إنذارات")}
    </div>
    ${head("الإنذارات", warns.length)}
    ${warns.length ? table("danger", ["م", "الإنذار", "تاريخ الإصدار", "النوع"], warns.map((w, i) =>
      [i + 1, STAGE[w.stage]?.label ?? w.stage, fmtDate(w.issued_on + "T12:00:00"), w.source === "paper" ? "ورقي" : "من البوابة"]))
      : empty("لا إنذارات.")}
    ${head("الغياب الرسمي", official.length)}
    ${official.length ? table("", ["م", "اليوم والتاريخ", "الحالة", "ملاحظة"], official.map((m, i) =>
      [i + 1, day(m.attend_date),
       `<span style="color:${m.status === "absent" ? "#B02A2A" : "#544CC0"};font-weight:700">${OFFICIAL_LABEL[m.status]}</span>`,
       m.punched ? "بصم ولم يحضر الحصص" : m.note ?? ""]))
      : empty("لا غياب رسمي في الفترة.")}
    ${fp ? head("التأخر الصباحي", late.length) + (late.length ? table("", ["م", "اليوم والتاريخ", "وقت البصمة", "دقائق التأخر"], late.map((m, i) =>
      [i + 1, day(m.attend_date), m.punch_time ? fmtTime12(m.punch_time) : "لم يبصم", m.punch_time ? m.late_minutes : "بلا وقت"]))
      : empty("لا تأخر في الفترة.")) : ""}
    ${head("غياب الحصص حسب المادة", subjects.length)}
    ${subjects.length ? table("", ["م", "المادة", "عدد حصص الغياب"], subjects.map(([n, c], i) => [i + 1, n, c]))
      : empty("لا غياب حصص.")}
    ${periods.length ? head("تفصيل غياب الحصص وتأخرها", periods.length) + table("", ["م", "اليوم والتاريخ", "الحصة", "المادة", "الحالة"], periods.map((p, i) =>
      [i + 1, day(p.attend_date), p.schedule?.period_no ?? "—", p.schedule?.subjects?.name ?? "—",
       `<span style="color:${p.status === "absent" ? "#B02A2A" : "#9A6B12"};font-weight:700">${P_STATUS[p.status]?.t ?? p.status}</span>`]))
      : ""}`;
}

/* تعديل حضور الحصص — للإدارة: إلغاء غياب حصة أو تغيير نوعه بعد انتهاء وقتها
   (ومنها حصص الانتظار التي لا يعود المعلم إليها). لا يُضاف غياب جديد من هنا،
   فلا يصل ولي الأمر أي إشعار بسبب التعديل. */
function PeriodEdit({ periods, uid, onSaved }) {
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  const rows = [...periods].sort((a, b) =>
    b.attend_date.localeCompare(a.attend_date) ||
    (a.schedule?.period_no ?? 0) - (b.schedule?.period_no ?? 0));

  // الحالة الحالية، ثم ما يُسمح بالتغيير إليه (بلا «غائب» لمن ليس غائبًا)
  const options = (cur) => [cur, ...["present", "late", "excused"].filter((k) => k !== cur)];

  const save = async (p) => {
    const next = draft[p.id];
    if (!next || next === p.status) return;
    setBusy(p.id); setMsg(null);
    const { error } = await supabase.from("class_attendance")
      .update({ status: next, updated_by: uid, updated_at: new Date().toISOString() })
      .eq("id", p.id);
    setBusy(null);
    if (error) { setMsg({ ok: false, text: `تعذّر الحفظ: ${error.message}` }); return; }
    setMsg({ ok: true, text: `عُدّلت حصة ${p.schedule?.period_no ?? ""} يوم ${fmtDate(p.attend_date + "T12:00:00")} إلى «${P_STATUS[next].t}».` });
    setDraft((d) => { const n = { ...d }; delete n[p.id]; return n; });
    onSaved();
  };

  return (
    <Section title="تعديل حضور الحصص">
      <p className="text-xs leading-relaxed text-muted">
        لإلغاء غياب حصة أو تغيير نوعه بعد انتهاء وقتها — ومنها حصص الانتظار. التعديل لا يُرسل
        أي إشعار لولي الأمر، ويُسجَّل باسمك ووقته.
      </p>
      {rows.length === 0 ? <p className="text-sm text-muted">لا غياب ولا تأخر حصص في الفترة المختارة.</p> : (
        <div className="divide-y divide-line">
          {rows.map((p) => {
            const val = draft[p.id] ?? p.status;
            const dirty = val !== p.status;
            return (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="min-w-0 text-sm">
                  <span className="text-ink">{weekdayOf(p.attend_date)} <span className="num">{fmtDate(p.attend_date + "T12:00:00")}</span></span>
                  <span className="text-muted"> · الحصة <span className="num">{p.schedule?.period_no ?? "—"}</span> · {p.schedule?.subjects?.name ?? "—"}</span>
                  {p.updated_at && <span className="text-[11px] text-faint"> · مُعدَّلة</span>}
                </div>
                <div className="flex items-center gap-2">
                  <select value={val} disabled={busy === p.id}
                          onChange={(e) => setDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                          className={`rounded-sm2 border border-line bg-white px-2 py-1 text-sm font-medium ${P_STATUS[val]?.c ?? ""}`}>
                    {options(p.status).map((k) => <option key={k} value={k}>{P_STATUS[k].t}</option>)}
                  </select>
                  {dirty && (
                    <button onClick={() => save(p)} disabled={busy === p.id}
                            className="btn-primary px-3 py-1 text-xs">
                      {busy === p.id ? "…" : "حفظ"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {msg && (
        <p className={`rounded-sm2 px-3 py-2 text-sm ${
          msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.text}</p>
      )}
    </Section>
  );
}

function Section({ title, children }) {
  return (
    <section className="card space-y-2 p-4">
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

