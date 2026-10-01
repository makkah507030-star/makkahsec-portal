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
  notice:   { title: "إشعار ولي أمر الطالب بمشكلة سلوكية", short: "إشعار ولي أمر", n: 9, secret: true,
              hint: "يُشعر ولي الأمر بالمخالفة والإجراءات المقررة حيالها، فيقرّ بالاطّلاع ويكتب ملاحظته." },
  invite:   { title: "خطاب دعوة ولي الأمر", short: "دعوة ولي أمر", n: 10, secret: false,
              hint: "يُرسل لولي الأمر بموعد الحضور وهدفه، فيرد بالحضور أو بطلب تغيير الموعد." },
  incident: { title: "محضر ضبط واقعة",      short: "محضر ضبط",     n: 11, secret: true, internal: true,
              hint: "سري للإدارة: توثيق الواقعة ونوع المشاهدة المضبوطة ومكانها وشهودها." },
  statement: { title: "إفادة طالب",         short: "إفادة طالب",   n: null, secret: true, internal: true,
              hint: "يكتب الوكيل إفادة الطالب بنصوص مقترحة، ثم يطبعها ليوقّع عليها الطالب." },
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
      {f.kind === "statement" && <Statement f={f} d={d} stampUrl={stampUrl} />}
      {f.kind === "notice" && <Notice f={f} d={d} stampUrl={stampUrl} />}
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

/* ------------------------------ إفادة طالب ------------------------------
   نص حر يكتبه الوكيل بصيغ مقترحة، ويوقّع عليه الطالب ورقيًا بعد الطباعة. */
export const STATEMENT_CLOSING = "وهذه إفادتي، وأُقرّ بصحة ما ورد فيها، وعلى ذلك جرى التوقيع.";

function Statement({ f, d, stampUrl }) {
  const paras = String(d.text ?? "").split(/\n+/).map((x) => x.trim()).filter(Boolean);
  return (
    <>
      <div className="mt-5 grid grid-cols-2 gap-x-6 rounded-[10px] border border-line px-4 py-2">
        <P>اسم الطالب: <b>{f.student_name}</b></P>
        <P>الصف: {f.class_label}</P>
        <P>تاريخ الإفادة: {day(d.date)}</P>
        <P>{d.time ? `الوقت: ${d.time}` : "\u00A0"}</P>
        {f.violation_text && (
          <div className="col-span-2">
            <P>بخصوص: {violationPhrase(f.violation_text)} — مخالفة سلوكية من الدرجة ({degreeName(f.violation_degree)})</P>
          </div>
        )}
      </div>

      <div className="mt-4 min-h-[110mm] rounded-[10px] border border-line px-4 py-3">
        <p className="mb-1 text-[12.5px] font-bold text-mint-deep">نص الإفادة:</p>
        {paras.map((x, i) => <P key={i}>{x}</P>)}
        <P>{STATEMENT_CLOSING}</P>
      </div>

      <div className="mt-8 flex items-end gap-3">
        <Sign title="الطالب" name={f.student_name} />
        <Stamp url={stampUrl} />
        <Sign title={f.issued_role || "وكيل شؤون الطلاب"} name={f.issued_name} at={f.created_at} atLabel="دُوّنت في" />
      </div>
    </>
  );
}

/* --------------- (9) سري: إشعار ولي أمر الطالب بمشكلة سلوكية --------------- */
function Notice({ f, d, stampUrl }) {
  const steps = (d.steps ?? []).filter((x) => String(x).trim());
  return (
    <>
      <div className="mt-6 space-y-1 px-1">
        <P bold>المكرم ولي أمر الطالب / {f.student_name}</P>
        <P>بالصف / {f.class_label}</P>
        <P center>السلام عليكم ورحمة الله وبركاته، وبعد:</P>
        <P>نشعركم بأن الطالب قام في يوم {day(f.violation_date)} بمشكلة سلوكية من الدرجة
          ({degreeName(f.violation_degree)})، وهي: {violationPhrase(f.violation_text)}.</P>
        <P>وقد قُرّرت الإجراءات التالية حياله وفق ما ورد في قواعد السلوك والمواظبة:</P>
        <ol className="list-inside list-decimal pr-2 text-[13.5px] leading-[2.1]">
          {(steps.length ? steps : ["........................................................"]).map((x, i) => <li key={i}>{x}</li>)}
        </ol>
        <P>لذا يرجى منكم المتابعة والتعاون مع المدرسة بما يسهم في انضباط سلوك ابنكم.</P>
      </div>
      <div className="mt-6 flex items-end gap-3">
        <Stamp url={stampUrl} />
        <div className="flex-1" />
        <Principal at={f.created_at} />
      </div>

      <div className="mt-6 rounded-[10px] border border-[#F0E3C4] px-4 py-3">
        <p className="text-[12.5px] font-bold text-[#7E6318]">إقرار ولي الأمر:</p>
        <P><Box on={!!f.guardian_ack_at} /> أُقرّ بالاطّلاع على هذا الإشعار، وبمتابعة سلوك ابني والتعاون مع المدرسة.</P>
        {f.guardian_note && <SheetField label="ملاحظة ولي الأمر" value={f.guardian_note} />}
        <p className="mt-1 text-[11px] text-muted">
          {f.guardian_ack_at ? <>أقرّ ولي الأمر إلكترونيًا بتاريخ <span className="num">{fmtDual(f.guardian_ack_at)}</span></>
                             : "الاسم: ........................   التوقيع: ........................   التاريخ: ........................"}
        </p>
      </div>
    </>
  );
}
