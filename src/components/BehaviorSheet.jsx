// src/components/BehaviorSheet.jsx
import PrincipalSign from "./PrincipalSign.jsx";
import { OfficialHead, GuideFoot, SHEET_STYLE, fmtDual, SheetField } from "./ReferralSheet.jsx";
import { PRINCIPAL_NAME } from "../lib/exportUtils.js";
import { degreeName, violationPhrase } from "../lib/behavior.js";

/* =====================================================================
   نماذج السلوك والمواظبة على صيغ دليل السلوك والمواظبة 1447هـ:
   تعهد سلوكي (8)، وخطاب دعوة ولي الأمر (10)، وسري: محضر ضبط واقعة (11).
   ورقة A4 واحدة بالترويسة الرسمية والختم وتوقيع المدير.
   ===================================================================== */

export const FORM_KINDS = {
  pledge:   { title: "تعهد سلوكي",          short: "تعهد سلوكي",   n: 8,  secret: false,
              hint: "يقرّ فيه الطالب بالمخالفة ويتعهد بعدم تكرارها، ويقرّ ولي أمره بالاطّلاع." },
  invite:   { title: "خطاب دعوة ولي الأمر", short: "دعوة ولي أمر", n: 10, secret: false,
              hint: "يُرسل لولي الأمر بموعد الحضور وهدفه، فيرد بالحضور أو بطلب تغيير الموعد." },
  incident: { title: "محضر ضبط واقعة",      short: "محضر ضبط",     n: 11, secret: true,
              hint: "سري للإدارة: توثيق الواقعة ونوع المشاهدة المضبوطة ومكانها وشهودها." },
};

export const EVIDENCE = ["صور", "مقاطع فيديو", "محادثات", "أخرى"];
export const MEET_WITH = ["مدير المدرسة", "وكيل شؤون الطلاب", "الموجه الطلابي"];

const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
export const weekday = (d) => (d ? WEEKDAYS[new Date(`${String(d).slice(0, 10)}T12:00:00`).getDay()] : "");
const day = (d) => (d ? `${weekday(d)} ${fmtDual(d)}` : "—");

const P = ({ children, center, bold }) => (
  <p className={`text-[13.5px] leading-[2.1] ${center ? "text-center" : ""} ${bold ? "font-bold" : ""}`}>{children}</p>
);

const Box = ({ on }) => (
  <span className="mx-1 inline-flex h-4 w-4 items-center justify-center rounded-[3px] border border-ink/60 align-middle text-[11px] font-bold leading-none">
    {on ? "✓" : ""}
  </span>
);

function Sign({ title, name, at, atLabel, children }) {
  return (
    <div className="flex-1 text-center">
      <p className="text-[11.5px] font-semibold text-muted">{title}</p>
      {children ?? <div className="h-10" />}
      <div className="mx-auto h-px w-36 bg-line" />
      <p className="mt-1 text-[12px] font-semibold">{name || " "}</p>
      {at ? <p className="text-[10px] text-present">{atLabel} {fmtDual(at)}</p>
          : <p className="text-[10px] text-faint">التوقيع: ..................</p>}
    </div>
  );
}

const Principal = ({ at }) => (
  <Sign title="مدير المدرسة" name={PRINCIPAL_NAME} at={at} atLabel="">
    <PrincipalSign height="h-10" />
  </Sign>
);

const Stamp = ({ url }) => (
  <div className="flex w-28 items-end justify-center">
    {url ? <img src={url} alt="" className="h-16 w-auto object-contain opacity-90" />
         : <p className="text-[11px] text-faint">الختم</p>}
  </div>
);

export default function BehaviorSheet({ f, stampUrl }) {
  if (!f) return null;
  const k = FORM_KINDS[f.kind];
  const d = f.data ?? {};
  return (
    <div className="sheet mx-auto bg-white text-ink" style={SHEET_STYLE}>
      <OfficialHead title={k.title} serial={f.serial} secret={k.secret} />
      {f.kind === "pledge" && <Pledge f={f} stampUrl={stampUrl} />}
      {f.kind === "invite" && <Invite f={f} d={d} stampUrl={stampUrl} />}
      {f.kind === "incident" && <Incident f={f} d={d} stampUrl={stampUrl} />}
      <GuideFoot />
    </div>
  );
}

/* ----------------------------- (8) تعهد سلوكي ----------------------------- */
function Pledge({ f, stampUrl }) {
  return (
    <>
      <div className="mt-6 space-y-1 px-1">
        <P>أنا الطالب / <b>{f.student_name}</b></P>
        <P>بالصف / {f.class_label}</P>
        <P>أُقرّ بأنني قمت في يوم {day(f.violation_date)} بمشكلة سلوكية من الدرجة
          ({degreeName(f.violation_degree)})،</P>
        <P>وهي: {violationPhrase(f.violation_text)}.</P>
        <P>وأتعهد بعدم تكرار أي مشكلة سلوكية مستقبلًا، وعلى ذلك جرى التوقيع.</P>
      </div>
      <div className="mt-10 flex items-end gap-3">
        <Sign title="الطالب" name={f.student_name} at={f.student_ack_at} atLabel="أقرّ إلكترونيًا" />
        <Sign title="ولي الأمر" name="" at={f.guardian_ack_at} atLabel="أقرّ إلكترونيًا" />
        <Principal at={f.created_at} />
      </div>
      <div className="mt-4 flex justify-center"><Stamp url={stampUrl} /></div>
      {f.guardian_note && <div className="mt-4"><SheetField label="ملاحظة ولي الأمر" value={f.guardian_note} /></div>}
    </>
  );
}

/* ------------------------ (10) خطاب دعوة ولي الأمر ------------------------ */
export const inviteText = (f, d) =>
  `نأمل منكم الحضور إلى المدرسة في يوم ${day(d.date)}${d.time ? ` الساعة ${d.time}` : ""}` +
  ` لمقابلة ${d.meet_with || "مدير المدرسة"}، وذلك بهدف ${String(d.purpose ?? "").trim() || "مناقشة ما يخص الطالب"}.`;

function Invite({ f, d, stampUrl }) {
  const r = f.guardian_reply ?? {};
  return (
    <>
      <div className="mt-6 space-y-1 px-1">
        <P bold>المكرم ولي أمر الطالب / {f.student_name}</P>
        <P>بالصف / {f.class_label}</P>
        <P center>السلام عليكم ورحمة الله وبركاته، وبعد:</P>
        <P>{inviteText(f, d)}</P>
        {f.violation_text && (
          <P>وذلك بخصوص مشكلة سلوكية من الدرجة ({degreeName(f.violation_degree)})، وهي: {violationPhrase(f.violation_text)}.</P>
        )}
        <P center>شاكرين لكم تعاونكم معنا لتحقيق مصلحة الطالب.</P>
      </div>
      <div className="mt-6 flex items-end gap-3">
        <Stamp url={stampUrl} />
        <div className="flex-1" />
        <Principal at={f.created_at} />
      </div>

      <div className="mt-6 rounded-[10px] border border-[#F0E3C4] px-4 py-3">
        <p className="text-[12.5px] font-bold text-[#7E6318]">رد ولي الأمر:</p>
        <P><Box on={r.choice === "attend"} /> أُقرّ بالعلم، وسأحضر في الموعد المحدد.</P>
        <P><Box on={r.choice === "reschedule"} /> أُقرّ بالعلم، وأرغب بتغيير الموعد (خلال نفس الأسبوع)، وذلك في يوم
          {r.choice === "reschedule" && r.date ? ` ${day(r.date)}` : " ......................"}.</P>
        {f.guardian_note && <SheetField label="ملاحظة ولي الأمر" value={f.guardian_note} />}
        <p className="mt-1 text-[11px] text-muted">
          {f.guardian_ack_at ? <>ردّ ولي الأمر إلكترونيًا بتاريخ <span className="num">{fmtDual(f.guardian_ack_at)}</span></>
                             : "الاسم: ........................   التوقيع: ........................   التاريخ: ........................"}
        </p>
      </div>
    </>
  );
}

/* ------------------------ (11) سري: محضر ضبط واقعة ------------------------ */
function Incident({ f, d, stampUrl }) {
  const ev = d.evidence ?? [];
  const witnesses = [...(d.witnesses ?? []).filter((w) => w?.name?.trim())];
  while (witnesses.length < 5) witnesses.push({});
  return (
    <>
      <div className="mt-5 space-y-0.5 px-1">
        <P>اسم الطالب: <b>{f.student_name}</b></P>
        <P>المرحلة: الثانوية &nbsp;&nbsp;&nbsp; الصف: {f.class_label}</P>
        <P>المشكلة السلوكية: {violationPhrase(f.violation_text)} &nbsp;&nbsp; درجتها: ({degreeName(f.violation_degree)})</P>
        <P>تاريخ الواقعة: {day(f.violation_date)}{d.time ? ` — ${d.time}` : ""}</P>
        <P>نوع المشاهدة المضبوطة:
          {EVIDENCE.map((e) => <span key={e} className="whitespace-nowrap"><Box on={ev.includes(e)} />{e}</span>)}
          {ev.includes("أخرى") && d.evidence_other ? `: ${d.evidence_other}` : ""}
        </P>
        <P>مكان ضبط الواقعة: {d.place || "........................................"}</P>
        {d.description && <SheetField label="وصف الواقعة" value={d.description} />}
      </div>

      <p className="mt-3 px-1 text-[13px] font-bold">شهود الواقعة:</p>
      <table className="mt-1 w-full border-collapse text-[12px]">
        <thead>
          <tr style={{ background: "#EDFAF2", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
            {["م", "الاسم", "الوظيفة", "العمل المسند إليه", "التوقيع"].map((h) => (
              <th key={h} className="border border-line px-2 py-1.5 font-semibold text-mint-deep">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {witnesses.map((w, i) => (
            <tr key={i}>
              <td className="num w-8 border border-line px-2 py-2 text-center">{i + 1}</td>
              <td className="border border-line px-2 py-2">{w.name ?? ""}</td>
              <td className="border border-line px-2 py-2">{w.job ?? ""}</td>
              <td className="border border-line px-2 py-2">{w.task ?? ""}</td>
              <td className="w-24 border border-line px-2 py-2" />
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-8 flex items-end gap-3">
        <Sign title="الطالب" name={f.student_name} />
        <Sign title="ولي الأمر" name="" />
        <Principal at={f.created_at} />
      </div>
      <div className="mt-3 flex justify-center"><Stamp url={stampUrl} /></div>
      <p className="mt-2 text-center text-[10.5px] text-faint">حرّره: {f.issued_name}{f.issued_role ? ` — ${f.issued_role}` : ""}</p>
    </>
  );
}
