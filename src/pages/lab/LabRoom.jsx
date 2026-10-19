// src/pages/lab/LabRoom.jsx
// الملف الدائم لأجهزة المعمل ورمز الحصة (computer_lab_11.sql):
// • InstallPanel: إصدار الملف الدائم برمز معلم، وتنزيله لنسخه إلى الأجهزة.
// • RoomOpen: يختار المعلم الفصل والدرس فيظهر رمز الحصة كبيرًا، ويعرض الدرس على السبورة
//   والرمز في رأسه، فيكتبه الطلاب في الملف الدائم.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNotice } from "../../lib/useNotice.js";
import { confirmDanger } from "../../lib/danger";
import { classText } from "../../lib/lab.js";
import { pinHash } from "../../lib/labSign.js";
import { LESSONS, lessonById } from "../../lab-content/index.js";
import LessonPresenter from "./lessons/LessonPresenter.jsx";
import { buildLabFile, downloadText } from "./labFile.js";

const dateText = (ts) => new Date(ts).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long", year: "numeric" });

export function InstallPanel({ lab }) {
  const [file, setFile] = useState(undefined);
  const [pin, setPin] = useState(null);         // { a, b } أثناء الإصدار
  const [busy, setBusy] = useState(false);
  const [, setMsg] = useNotice(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("lab_install_file", { p_lab: lab });
    setFile(error ? null : data ?? null);
  }, [lab]);
  useEffect(() => { load(); }, [load]);

  const download = async (f) => {
    try { downloadText(await buildLabFile(f), "lab.html"); }
    catch (e) { setMsg({ ok: false, text: "تعذّر تجهيز الملف: " + e.message }); }
  };
  const issue = async () => {
    if (!/^\d{4,8}$/.test(pin.a)) { setMsg({ ok: false, text: "رمز المعلم من 4 إلى 8 أرقام" }); return; }
    if (pin.a !== pin.b) { setMsg({ ok: false, text: "الرمزان غير متطابقين" }); return; }
    if (file && !(await confirmDanger({
      title: "إصدار ملف دائم جديد؟",
      impact: ["يلزم نسخ الملف الجديد إلى كل أجهزة المعمل", "رموز الحصص بعده لا تعمل على الملف القديم"],
      level: "medium", confirmLabel: "إصدار",
    }))) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("lab_install_create", { p_lab: lab, p_pin_hash: pinHash(pin.a) });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: "تعذّر الإصدار: " + error.message }); return; }
    setPin(null); setFile(data); download(data);
  };

  if (file === undefined) return null;
  const students = (file?.classes ?? []).reduce((a, c) => a + c.roster.length, 0);
  return (
    <div className="space-y-2 rounded-card border border-line/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[60%] flex-1">
          <p className="text-sm font-semibold text-ink">الملف الدائم لأجهزة المعمل</p>
          <p className="text-xs text-muted">
            {file ? <>إصدار {dateText(file.created)} · <bdi className="num">{file.classes.length}</bdi> فصلًا · <bdi className="num">{students}</bdi> طالبًا · كل الدروس</>
              : "لم يُصدَر بعد. يُثبَّت مرة واحدة على كل جهاز، ويفتح الطلاب الحصة فيه برمز من السبورة."}
          </p>
        </div>
        {file && <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => download(file)}>تنزيل</button>}
        {!pin && <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setPin({ a: "", b: "" })}>{file ? "إصدار جديد" : "إصدار الملف"}</button>}
      </div>
      {pin && (
        <div className="space-y-2 rounded-card bg-canvas p-3">
          <p className="text-xs leading-relaxed text-muted">
            رمز المعلم يُطلب على الأجهزة لضبط رقم الجهاز ولتبديل الطالب. أصدر ملفًا جديدًا عند تغيّر الطلاب أو إضافة دروس، ثم انسخه إلى كل الأجهزة.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <input type="password" inputMode="numeric" dir="ltr" placeholder="رمز المعلم" className="field num w-36 text-center"
                   value={pin.a} onChange={(e) => setPin({ ...pin, a: e.target.value })} />
            <input type="password" inputMode="numeric" dir="ltr" placeholder="تأكيده" className="field num w-36 text-center"
                   value={pin.b} onChange={(e) => setPin({ ...pin, b: e.target.value })} />
            <button type="button" className="btn-primary py-2" disabled={busy} onClick={issue}>{busy ? "جارٍ الإصدار…" : "إصدار وتنزيل"}</button>
            <button type="button" className="btn-ghost py-2" onClick={() => setPin(null)}>إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function RoomOpen({ lab, onClose }) {
  const [classes, setClasses] = useState(null);
  const [classId, setClassId] = useState("");
  const [lessonId, setLessonId] = useState(LESSONS[0]?.id ?? "");
  const [room, setRoom] = useState(null);
  const [present, setPresent] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { supabase.rpc("lab_classes", { p_lab: lab }).then(({ data }) => setClasses(data ?? [])); }, [lab]);
  const cls = classes?.find((c) => c.class_id === classId);
  const lesson = lessonById(lessonId);

  const open = async () => {
    setBusy(true); setErr("");
    const { data, error } = await supabase.rpc("lab_room_open", { p_lab: lab, p_class: classId, p_lesson: lessonId, p_title: lesson.lesson.title });
    setBusy(false);
    if (error) setErr(error.message); else setRoom(data);
  };

  const badge = room && (
    <span className="chip gap-2 bg-mint-deep px-4 py-1.5 text-lg text-white">رمز الحصة <bdi className="num text-2xl tracking-[0.3em]">{room.room}</bdi></span>
  );
  if (present && room) return <LessonPresenter lesson={lesson} badge={badge} onExit={() => setPresent(false)} />;

  return (
    <div className="card space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-bold text-ink">فتح حصة برمز</p>
        <button type="button" className="btn-ghost py-2" onClick={onClose}>رجوع</button>
      </div>
      {!room ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="room-lesson">الدرس</label>
              <select id="room-lesson" className="field" value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
                {LESSONS.map((l) => <option key={l.id} value={l.id}>{l.grade} · الدرس {l.lesson.no}: {l.lesson.title}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="room-class">الفصل</label>
              <select id="room-class" className="field" value={classId} onChange={(e) => setClassId(e.target.value)}>
                <option value="">— اختر الفصل —</option>
                {(classes ?? []).map((c) => <option key={c.class_id} value={c.class_id}>{classText(c)}</option>)}
              </select>
            </div>
          </div>
          <p className="text-xs text-muted">يعمل الرمز اليوم فقط، على الملف الدائم المثبّت في أجهزة المعمل.</p>
          {err && <p className="rounded-sm2 bg-danger-light px-3 py-2 text-sm text-absent">{err}</p>}
          <button type="button" className="btn-primary w-full" disabled={!classId || busy} onClick={open}>{busy ? "جارٍ الفتح…" : "إظهار رمز الحصة"}</button>
        </>
      ) : (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted">{lesson.lesson.title} · {classText(cls)} · اليوم فقط</p>
          <p className="text-sm font-semibold text-ink">رمز الحصة</p>
          <p dir="ltr" className="num text-6xl font-bold tracking-[0.3em] text-mint-deep sm:text-7xl">{room.room}</p>
          <p className="text-sm text-muted">يكتبه الطلاب في ملف المعمل على أجهزتهم.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className="btn-primary" onClick={() => setPresent(true)}>عرض الدرس على السبورة</button>
            <button type="button" className="btn-ghost" onClick={() => setRoom(null)}>فصل أو درس آخر</button>
          </div>
        </div>
      )}
    </div>
  );
}
