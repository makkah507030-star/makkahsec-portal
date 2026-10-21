// src/pages/lab/LabSeating.jsx
// خريطة جلوس الطلاب: لكل فصل خريطته على رسم المعمل (شكل U)، وقد يجلس على
// الجهاز الواحد أكثر من طالب. التوزيع باللمس: اختر طالبًا ثم اضغط الجهاز.
// تُحفظ الخريطة كاملة دفعة واحدة (lab_seats_save).
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNotice } from "../../lib/useNotice.js";
import { confirmDanger } from "../../lib/danger";
import Loader from "../../components/Loader.jsx";
import { printReport } from "../../lib/exportUtils";
import { byName } from "../../lib/sortAr.js";
import { DEVICE_STATUS, uLayout, classText } from "../../lib/lab.js";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";

const firstName = (n) => String(n ?? "").trim().split(/\s+/)[0];

export default function LabSeating({ lab, canEdit }) {
  const [classes, setClasses] = useState(null);
  const [classId, setClassId] = useState("");
  const [devices, setDevices] = useState([]);
  const [students, setStudents] = useState(null);   // [{ student_id, full_name, seat_no }]
  const [saved, setSaved] = useState("");           // نسخة المحفوظ للمقارنة
  const [picked, setPicked] = useState(null);       // الطالب المختار للنقل
  const [openSeat, setOpenSeat] = useState(null);   // الجهاز المفتوح تفاصيله
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useNotice(null);

  const loadClasses = useCallback(async () => {
    const { data, error } = await supabase.rpc("lab_classes", { p_lab: lab });
    if (error) setMsg({ ok: false, text: "تعذّر تحميل الفصول: " + error.message });
    setClasses(data ?? []);
  }, [lab, setMsg]);

  useEffect(() => {
    loadClasses();
    supabase.from("lab_devices").select("seat_no, code, status").eq("lab_id", lab).order("seat_no")
      .then(({ data }) => setDevices(data ?? []));
  }, [lab, loadClasses]);

  useEffect(() => {
    if (!classId) { setStudents(null); return; }
    let alive = true;
    setStudents(null); setPicked(null); setOpenSeat(null);
    supabase.rpc("lab_class_seats", { p_lab: lab, p_class: classId }).then(({ data, error }) => {
      if (!alive) return;
      if (error) setMsg({ ok: false, text: "تعذّر تحميل الطلاب: " + error.message });
      const rows = (data ?? []).sort(byName());
      setStudents(rows);
      setSaved(JSON.stringify(rows.map((r) => [r.student_id, r.seat_no])));
    });
    return () => { alive = false; };
  }, [lab, classId, setMsg]);

  const bySeat = useMemo(() => {
    const m = {};
    (students ?? []).forEach((s) => { if (s.seat_no != null) (m[s.seat_no] ??= []).push(s); });
    return m;
  }, [students]);

  const unseated = (students ?? []).filter((s) => s.seat_no == null);
  const dirty = students && JSON.stringify(students.map((r) => [r.student_id, r.seat_no])) !== saved;
  const working = devices.filter((d) => d.status === "ok");
  const cls = classes?.find((c) => c.class_id === classId);

  const move = (studentId, seat) =>
    setStudents((list) => list.map((s) => (s.student_id === studentId ? { ...s, seat_no: seat } : s)));

  const clickDevice = (d) => {
    if (canEdit && picked) {
      if (d.status !== "ok") setMsg({ ok: true, text: `تنبيه: ${d.code} ${DEVICE_STATUS[d.status]?.label}` });
      move(picked, d.seat_no);
      setPicked(null);
      return;
    }
    setOpenSeat(d.seat_no === openSeat ? null : d.seat_no);
  };

  // توزيع تلقائي بالترتيب الأبجدي على كل الأجهزة العاملة بالتساوي: جهاز لكل طالب ما كفت الأجهزة،
  // وإلا طالبان على بعضها وطالب على الباقي (الفرق بين الأجهزة طالب واحد على الأكثر)، فلا يبقى جهاز فارغ
  const autoFill = async () => {
    if (students.some((s) => s.seat_no != null)) {
      const ok = await confirmDanger({
        title: "إعادة توزيع طلاب الفصل تلقائيًا؟",
        impact: ["يُستبدل التوزيع الحالي لهذا الفصل", "لا يُحفظ حتى تضغط «حفظ الخريطة»"],
        level: "medium", confirmLabel: "توزيع",
      });
      if (!ok) return;
    }
    if (!working.length) { setMsg({ ok: false, text: "لا توجد أجهزة تعمل للتوزيع عليها." }); return; }
    const N = students.length, D = working.length;
    const base = Math.floor(N / D), extra = N % D;   // أول extra جهازًا عليها طالب زائد
    const seatOf = [];
    working.forEach((d, j) => { for (let k = 0; k < base + (j < extra ? 1 : 0); k++) seatOf.push(d.seat_no); });
    setStudents((list) => list.map((s, i) => ({ ...s, seat_no: seatOf[i] ?? null })));
    setPicked(null); setOpenSeat(null);
    setMsg({ ok: true, text: N <= D
      ? `وُزّع ${N} طالبًا على ${N} جهازًا، طالب على كل جهاز.`
      : `وُزّع ${N} طالبًا على كل الأجهزة العاملة (${D}): ${extra ? `${base + 1} على ${extra} منها، و${base} على ${D - extra}` : `${base} على كل جهاز`}.` });
  };

  const clearAll = () => { setStudents((list) => list.map((s) => ({ ...s, seat_no: null }))); setPicked(null); };

  const save = async () => {
    setBusy(true);
    const seats = students.filter((s) => s.seat_no != null).map((s) => ({ student_id: s.student_id, seat_no: s.seat_no }));
    const { error } = await supabase.rpc("lab_seats_save", { p_lab: lab, p_class: classId, p_seats: seats });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: "تعذّر الحفظ: " + error.message }); return; }
    setSaved(JSON.stringify(students.map((r) => [r.student_id, r.seat_no])));
    setMsg({ ok: true, text: `حُفظت خريطة ${classText(cls)}` });
    loadClasses();
  };

  const printMap = () => {
    printReport({
      title: `خريطة جلوس ${classText(cls)} — معمل الحاسب الآلي`,
      subtitle: `${students.length} طالبًا · الترقيم يبدأ من يمين المعلم`,
      headers: ["الجهاز", "الطلاب"],
      rows: devices.map((d) => [
        `${d.seat_no} (${d.code})${d.status !== "ok" ? " — " + DEVICE_STATUS[d.status]?.label : ""}`,
        (bySeat[d.seat_no] ?? []).map((s) => s.full_name).join("، ") || "—",
      ]).concat(unseated.length ? [["بلا جهاز", unseated.map((s) => s.full_name).join("، ")]] : []),
      logoUrl: new URL(logoIcon, window.location.origin).href,
      moeLogoUrl: new URL(moeLogo, window.location.origin).href,
      hideSignatures: true,
    });
  };

  if (classes === null) return <Loader />;

  const { cols, rows, pos } = uLayout(devices.length || 24);
  const pickedName = picked && students?.find((s) => s.student_id === picked)?.full_name;

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3 p-3 print:hidden">
        <div className="min-w-[12rem] flex-1">
          <label className="label" htmlFor="seat-class">الفصل</label>
          <select id="seat-class" className="field" value={classId}
                  onChange={async (e) => {
                    if (dirty && !(await confirmDanger({ title: "تغييرات غير محفوظة", impact: ["الانتقال لفصل آخر يُلغي تعديلاتك على هذا الفصل"], level: "medium", confirmLabel: "انتقال دون حفظ" }))) return;
                    setClassId(e.target.value);
                  }}>
            <option value="">— اختر الفصل —</option>
            {classes.map((c) => (
              <option key={c.class_id} value={c.class_id}>
                {classText(c)} · {c.seated ? `موزّع ${c.seated} من ${c.students}` : `${c.students} طالبًا`}
              </option>
            ))}
          </select>
        </div>
        {students && canEdit && (
          <div className="flex flex-wrap items-end gap-2">
            <button type="button" className="btn-ghost py-2" onClick={autoFill}>توزيع تلقائي</button>
            <button type="button" className="btn-ghost py-2 text-muted" onClick={clearAll}>إفراغ</button>
          </div>
        )}
        {students && (
          <div className="flex gap-2">
            <button type="button" className="btn-ghost py-2" onClick={printMap}>طباعة</button>
            {canEdit && <button type="button" className="btn-primary py-2" disabled={!dirty || busy} onClick={save}>{busy ? "جارٍ الحفظ…" : "حفظ الخريطة"}</button>}
          </div>
        )}
      </div>

      {!classId ? (
        <div className="card px-6 py-10 text-center text-sm text-muted">اختر الفصل لعرض خريطة جلوسه.</div>
      ) : students === null ? <Loader /> : (
        <div className="grid gap-4 lg:grid-cols-[1fr_17rem]">
          {/* رسم المعمل */}
          <div className="card p-3 sm:p-5">
            {canEdit && (
              <p className={`mb-3 rounded-sm2 px-3 py-2 text-center text-xs ${picked ? "bg-mint-tint font-semibold text-mint-deep" : "bg-canvas text-muted"}`}>
                {picked ? <>اضغط الجهاز الذي يجلس عليه: {pickedName}</> : "اختر طالبًا من القائمة، ثم اضغط على جهازه."}
              </p>
            )}
            <div className="mb-3 flex items-center gap-2 text-[10px] text-faint">
              <span className="w-12 text-center">يسار المعلم</span>
              <div className="flex-1 rounded-sm2 bg-canvas py-1.5 text-center text-[11px] font-semibold text-muted">السبورة ومكتب المعلم</div>
              <span className="w-12 text-center">يمين المعلم</span>
            </div>
            <div className="grid gap-1 sm:gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${rows}, auto)` }}>
              {devices.map((d) => {
                const p = pos(d.seat_no);
                const who = bySeat[d.seat_no] ?? [];
                const bad = d.status !== "ok";
                return (
                  <button key={d.seat_no} type="button" onClick={() => clickDevice(d)}
                          title={[d.code, ...who.map((s) => s.full_name)].join("\n")}
                          style={{ gridColumn: p.col, gridRow: p.row }}
                          className={`relative flex min-h-[3.25rem] flex-col items-center justify-start overflow-hidden rounded-sm2 border px-0.5 py-1 text-center transition-colors ${
                            openSeat === d.seat_no ? "border-mint-deep ring-2 ring-mint-deep/30" : "border-line"} ${
                            bad ? "bg-danger-light/60" : who.length ? "bg-mint-tint" : "bg-paper"} ${
                            picked ? "hover:border-mint-deep hover:bg-mint-light" : ""}`}>
                    <span className={`num text-[11px] font-bold ${bad ? "text-absent" : "text-ink"}`}>{d.seat_no}</span>
                    {who.length > 0 && (
                      <>
                        <span className="num mt-0.5 rounded-pill bg-mint-deep px-1.5 text-[9px] font-bold text-white sm:hidden">{who.length}</span>
                        <span className="hidden w-full sm:block">
                          {who.map((s) => <span key={s.student_id} className="block truncate text-[10px] leading-tight text-mint-deep">{firstName(s.full_name)}</span>)}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* القوائم — فوق الرسم في الجوال حتى يُختار الطالب ثم جهازه دون تمرير طويل */}
          <div className="order-first space-y-3 lg:order-none">
            {openSeat != null && (
              <SeatPanel seat={openSeat} device={devices.find((d) => d.seat_no === openSeat)} list={bySeat[openSeat] ?? []}
                         canEdit={canEdit} picked={picked} onPick={setPicked}
                         onRemove={(id) => move(id, null)} onClose={() => setOpenSeat(null)} />
            )}
            <div className="card p-3">
              <p className="mb-2 text-sm font-semibold text-ink">
                بلا جهاز <span className="num text-muted">({unseated.length})</span>
              </p>
              {unseated.length === 0 ? (
                <p className="text-xs text-muted">وُزّع كل طلاب الفصل.</p>
              ) : (
                <ul className="flex flex-wrap gap-1.5 lg:flex-col">
                  {unseated.map((s) => (
                    <li key={s.student_id}>
                      <StudentChip s={s} picked={picked} canEdit={canEdit} onPick={setPicked} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
      {msg && !msg.ok && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-absent">{msg.text}</p>}
    </div>
  );
}

function StudentChip({ s, picked, canEdit, onPick }) {
  const on = picked === s.student_id;
  return (
    <button type="button" disabled={!canEdit} onClick={() => onPick(on ? null : s.student_id)}
            className={`w-full rounded-pill border px-3 py-1 text-start text-xs transition-colors ${
              on ? "border-mint-deep bg-mint-deep font-semibold text-white" : "border-line bg-paper text-ink hover:border-mint-deep"} disabled:cursor-default`}>
      {s.full_name}
    </button>
  );
}

function SeatPanel({ seat, device, list, canEdit, picked, onPick, onRemove, onClose }) {
  const st = DEVICE_STATUS[device?.status] ?? DEVICE_STATUS.ok;
  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-ink">
          الجهاز <span className="num">{seat}</span> <span className="num text-xs text-muted">{device?.code}</span>
          {device?.status !== "ok" && <span className={`chip ms-1 ${st.chip}`}>{st.label}</span>}
        </p>
        <button type="button" className="text-xs text-muted" onClick={onClose}>إغلاق</button>
      </div>
      {list.length === 0 ? <p className="text-xs text-muted">لا يجلس عليه أحد.</p> : (
        <ul className="space-y-1.5">
          {list.map((s) => (
            <li key={s.student_id} className="flex items-center gap-1.5">
              <div className="min-w-0 flex-1"><StudentChip s={s} picked={picked} canEdit={canEdit} onPick={onPick} /></div>
              {canEdit && <button type="button" className="shrink-0 px-1 text-xs text-absent" onClick={() => onRemove(s.student_id)} aria-label="إزالة من الجهاز">✕</button>}
            </li>
          ))}
        </ul>
      )}
      {canEdit && list.length > 0 && <p className="mt-2 text-[11px] text-faint">لنقل طالب: اختره ثم اضغط جهازه الجديد.</p>}
    </div>
  );
}
