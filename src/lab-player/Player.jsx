// src/lab-player/Player.jsx
// ملف المعمل على جهاز الطالب (يعمل دون إنترنت)، بثلاثة أوضاع حسب بيانات الملف:
// • ملف الحصة: يختار الطالب رقم جهازه من خلفية سطح المكتب، فتظهر أسماء الجالسين عليه
//   من خريطة الجلوس، ثم يؤدّي الدرس، وفي النهاية يعرض رمز QR بدرجته موقّعًا بمفتاح الحصة.
// • الملف الدائم (mode: "install"): يُثبَّت على الأجهزة ويفتح الحصة برمز (InstallPlayer).
// • نسخة العرض (mode: "present"): الدرس على السبورة لجهاز المعلم.
// التقدم محفوظ على الجهاز (localStorage) لكل حصة وجهاز وطلاب، فلا يضيع بإعادة الفتح.
import { useState } from "react";
import { lessonById } from "../lab-content/index.js";
import LessonPresenter from "../pages/lab/lessons/LessonPresenter.jsx";
import { resultCode } from "../lib/labSign.js";
import InstallPlayer from "./InstallPlayer.jsx";
import { store, Header, DeviceGrid, NamePicker, LessonRun } from "./shared.jsx";

export default function Player({ data }) {
  if (data.mode === "install") return <InstallPlayer data={data} />;
  const lesson = lessonById(data.lesson);
  if (data.mode === "present" && lesson) return <LessonPresenter lesson={lesson} />;
  return <SessionPlayer data={data} lesson={lesson} />;
}

function SessionPlayer({ data, lesson }) {
  const whoKey = `mkl:${data.code}:who`;
  const [who, setWho] = useState(() => store.get(whoKey, null));   // { seat, students: [idx] }
  const [seat, setSeat] = useState(() => store.get(`mkl:${data.code}:seat`, null));
  const saveWho = (w) => { store.set(whoKey, w); setWho(w); };

  return (
    <div className="mx-auto min-h-screen max-w-3xl space-y-4 p-4 sm:p-6">
      <Header title={lesson ? lesson.lesson.title : "درس غير معروف"}
              chip={<span className="chip gap-1 bg-mint-tint text-mint-deep">فصل <bdi className="num">{data.class_no}</bdi></span>} />
      {!lesson ? <p className="text-absent">هذا الملف لا يحتوي الدرس المطلوب. اطلب من معلمك ملفًا جديدًا.</p>
        : who ? (
          <LessonRun lesson={lesson} progressKey={`mkl:${data.code}:${who.seat}:${who.students.join("-")}`} seat={who.seat}
                     names={who.students.map((i) => data.roster[i]?.n).filter(Boolean)}
                     codeOf={(sum) => resultCode({ origin: data.origin, code: data.code, secret: data.secret, seat: who.seat,
                       students: who.students, quiz: sum.quiz, mastery: sum.mastery, done: sum.done, total: sum.total })}
                     onSwitch={() => { if (window.confirm("تبديل الطالب؟ يبقى تقدّمك محفوظًا على هذا الجهاز.")) saveWho(null); }} />
        ) : (
          <div className="space-y-4">
            <div className="card space-y-3 p-4">
              <p className="font-bold text-ink">١. اختر رقم جهازك <span className="text-sm font-normal text-muted">(مكتوب على خلفية سطح المكتب)</span></p>
              <DeviceGrid count={data.device_count} seat={seat} onPick={(n) => { setSeat(n); store.set(`mkl:${data.code}:seat`, n); }} />
            </div>
            {seat != null && <NamePicker key={seat} roster={data.roster} seat={seat} onStart={(students) => saveWho({ seat, students })} />}
          </div>
        )}
    </div>
  );
}
