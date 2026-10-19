// src/lab-player/InstallPlayer.jsx
// الملف الدائم على أجهزة المعمل (يعمل دون إنترنت): فيه كل الدروس وكل الفصول.
// • رقم الجهاز من رابط التشغيل (#seat=5)، أو يُضبط مرة واحدة برمز المعلم.
// • يكتب الطالب «رمز الحصة» الظاهر على السبورة، فيُعرف الفصل والدرس (lab_room_code).
// • يختار اسمه من الجالسين على جهازه، ويؤدّي الدرس، ويعرض رمز درجته (MKL2).
// • «تبديل الطالب» وتغيير الجهاز برمز المعلم فقط، و«حصة جديدة» للفصل التالي بلا رمز.
import { useState } from "react";
import { LESSONS, lessonById } from "../lab-content/index.js";
import { roomCode, installResultCode, pinHash } from "../lib/labSign.js";
import { store, pc, Header, DeviceGrid, NamePicker, LessonRun } from "./shared.jsx";

const pad = (n) => String(n).padStart(2, "0");
// رقم الجهاز من رابط التشغيل (lab.html#seat=5) يغني عن ضبطه: وضع Kiosk قد يمسح التخزين
const hashSeat = () => { const m = /seat=(\d+)/.exec(location.hash); return m ? Number(m[1]) : null; };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

export default function InstallPlayer({ data }) {
  const K = (s) => `mki:${data.code}:${s}`;
  const fixedSeat = hashSeat();
  const [seat, setSeat] = useState(() => fixedSeat ?? store.get(K("seat"), null));
  const [room, setRoom] = useState(() => { const r = store.get(K("room"), null); return r?.date === today() ? r : null; });
  const [who, setWho] = useState(() => (room ? store.get(K(`who:${room.date}:${room.cls}:${room.lesson}`), null) : null));
  const [pin, setPin] = useState(null);        // { why, then } عند طلب رمز المعلم

  const cls = room ? data.classes[room.cls] : null;
  const lesson = room ? lessonById(room.lesson) : null;
  const saveRoom = (r) => {
    store.set(K("room"), r); setRoom(r);
    setWho(r ? store.get(K(`who:${r.date}:${r.cls}:${r.lesson}`), null) : null);
  };
  const saveWho = (w) => { store.set(K(`who:${room.date}:${room.cls}:${room.lesson}`), w); setWho(w); };
  const askPin = (why, then) => setPin({ why, then });

  return (
    <div className="mx-auto min-h-screen max-w-3xl space-y-4 p-4 sm:p-6">
      <Header title={lesson ? lesson.lesson.title : "معمل الحاسب الآلي"}
              chip={<div className="flex gap-1.5">
                {cls && <span className="chip gap-1 bg-mint-tint text-mint-deep">فصل <bdi className="num">{cls.no}</bdi></span>}
                {seat != null && <span className="chip num bg-canvas text-ink">{pc(seat)}</span>}
              </div>} />

      {seat == null ? (
        <div className="card space-y-3 p-4">
          <p className="font-bold text-ink">إعداد الجهاز (مرة واحدة)</p>
          <p className="text-sm text-muted">اختر رقم هذا الجهاز كما على خلفية سطح المكتب، ثم يُطلب رمز المعلم.</p>
          <DeviceGrid count={data.device_count} seat={null}
                      onPick={(n) => askPin(`ضبط هذا الجهاز على ${pc(n)}`, () => { store.set(K("seat"), n); setSeat(n); })} />
        </div>
      ) : !room ? (
        <RoomEntry data={data} onRoom={saveRoom} />
      ) : !lesson ? (
        <p className="card p-4 text-absent">هذا الدرس غير موجود في الملف — اطلب من الدعم الفني تحديث ملف المعمل.</p>
      ) : !who ? (
        <NamePicker key={`${room.cls}:${seat}`} roster={cls.roster} seat={seat} step="١" onStart={saveWho} />
      ) : (
        <LessonRun key={`${room.date}:${room.cls}:${room.lesson}:${who.join("-")}`} lesson={lesson} seat={seat}
                   progressKey={K(`p:${room.date}:${room.cls}:${room.lesson}:${seat}:${who.join("-")}`)}
                   names={who.map((i) => cls.roster[i]?.n).filter(Boolean)}
                   codeOf={(sum) => installResultCode({ origin: data.origin, code: data.code, secret: data.secret, date: room.date,
                     classIdx: room.cls, lesson: room.lesson, seat, students: who,
                     quiz: sum.quiz, mastery: sum.mastery, done: sum.done, total: sum.total })}
                   onSwitch={() => askPin("تبديل الطالب على هذا الجهاز", () => saveWho(null))} />
      )}

      {seat != null && (
        <div className="flex justify-center gap-4 pt-2 text-xs text-muted">
          {room && <button type="button" className="underline" onClick={() => saveRoom(null)}>حصة جديدة</button>}
          {fixedSeat == null && <button type="button" className="underline" onClick={() => askPin("تغيير رقم الجهاز", () => { store.del(K("seat")); setSeat(null); })}>إعدادات المعلم</button>}
        </div>
      )}

      {pin && <PinDialog data={data} why={pin.why} onOk={() => { pin.then(); setPin(null); }} onCancel={() => setPin(null)} />}
    </div>
  );
}

/* رمز الحصة: يُطابَق مع كل فصل ودرس لليوم؛ وإن تطابق أكثر من واحد يختار الطالب فصله */
function RoomEntry({ data, onRoom }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [choices, setChoices] = useState(null);

  const submit = () => {
    const c = code.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).trim();
    const date = today();
    const hits = [];
    data.classes.forEach((_, ci) => LESSONS.forEach((l) => { if (roomCode(data.secret, date, ci, l.id) === c) hits.push({ date, cls: ci, lesson: l.id }); }));
    if (!hits.length) { setErr("رمز غير صحيح — تأكد من الرمز الظاهر على السبورة."); return; }
    if (hits.length === 1) onRoom(hits[0]); else setChoices(hits);
  };

  if (choices) {
    return (
      <div className="card space-y-3 p-4">
        <p className="font-bold text-ink">اختر فصلك</p>
        {choices.map((h) => (
          <button key={`${h.cls}:${h.lesson}`} type="button" className="btn-ghost w-full" onClick={() => onRoom(h)}>
            فصل {data.classes[h.cls].no} · {lessonById(h.lesson)?.lesson.title}
          </button>
        ))}
      </div>
    );
  }
  return (
    <div className="card flex flex-col items-center gap-4 p-6 text-center">
      <p className="text-lg font-bold text-ink">اكتب رمز الحصة الظاهر على السبورة</p>
      <input dir="ltr" inputMode="numeric" autoFocus maxLength={5} value={code} placeholder="• • • • •"
             className="field num max-w-[14rem] text-center text-3xl tracking-[0.5em]"
             onChange={(e) => { setCode(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && submit()} />
      {err && <p className="text-sm text-absent">{err}</p>}
      <button type="button" className="btn-primary w-full max-w-[14rem]" disabled={code.trim().length < 5} onClick={submit}>دخول</button>
    </div>
  );
}

function PinDialog({ data, why, onOk, onCancel }) {
  const [v, setV] = useState("");
  const [bad, setBad] = useState(false);
  const check = () => (pinHash(v) === data.pin ? onOk() : (setBad(true), setV("")));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onCancel}>
      <div className="card w-full max-w-xs space-y-3 p-5 text-center" onClick={(e) => e.stopPropagation()}>
        <p className="font-bold text-ink">رمز المعلم</p>
        <p className="text-sm text-muted">{why}</p>
        <input type="password" inputMode="numeric" autoFocus dir="ltr" value={v} className="field num text-center text-xl tracking-widest"
               onChange={(e) => { setV(e.target.value); setBad(false); }} onKeyDown={(e) => e.key === "Enter" && check()} />
        {bad && <p className="text-sm text-absent">رمز غير صحيح</p>}
        <div className="flex gap-2">
          <button type="button" className="btn-ghost flex-1" onClick={onCancel}>إلغاء</button>
          <button type="button" className="btn-primary flex-1" disabled={!v} onClick={check}>تأكيد</button>
        </div>
      </div>
    </div>
  );
}
