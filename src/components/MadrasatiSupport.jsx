// src/components/MadrasatiSupport.jsx
// دعم منصة مدرستي للطالب داخل «مركز الدعم والمساندة» (بدل الموقع الملحق، supabase/madrasati_requests.sql):
// رابط الدعم الرسمي للمنصة، وطريقة استعادة كلمة المرور، وطلبات بسيطة يعالجها الدعم الفني:
// كلمة مرور جديدة على جوال يكتبه الطالب (المنصة ترسلها عليه، ولا تظهر للمدرسة)، وتغيير الفصل، ومشكلة أخرى.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { fmtDateTime } from "../lib/dates";
import { GRADE_NAMES } from "../lib/schoolTime";
import MadrasatiAlert from "./MadrasatiAlert.jsx";

export const MADRASATI_SUPPORT_URL = "https://schools.madrasati.sa/contact-us?Language=1";

export const MR_KINDS = [
  { k: "password", t: "كلمة مرور جديدة", icon: "🔑", d: "تصلك برسالة على الجوال الذي تكتبه" },
  { k: "class", t: "تغيير الفصل في المنصة", icon: "🏫", d: "فصلك في المنصة غير فصلك الصحيح" },
  { k: "other", t: "مشكلة أخرى", icon: "❓", d: "اكتب مشكلتك باختصار" },
];
export const MR_STATUS = {
  new: { t: "جديد", c: "bg-warning-light text-warning" },
  in_progress: { t: "قيد المعالجة", c: "bg-late/10 text-late" },
  done: { t: "تم", c: "bg-present/10 text-present" },
  rejected: { t: "تعذّر", c: "bg-absent/10 text-absent" },
};
export const kindOf = (k) => MR_KINDS.find((x) => x.k === k) ?? MR_KINDS[2];

// الجوال السعودي بصيغة 05XXXXXXXX (يقبل الأرقام العربية و+966)
const normMobile = (v) => {
  let d = String(v ?? "").replace(/[٠-٩]/g, (c) => "٠١٢٣٤٥٦٧٨٩".indexOf(c)).replace(/\D/g, "");
  if (/^9665\d{8}$/.test(d)) d = "0" + d.slice(3);
  return d;
};
const okMobile = (v) => /^05\d{8}$/.test(v);

export default function MadrasatiSupport() {
  const [kind, setKind] = useState(null);
  const [f, setF] = useState({ mobile: "", mobile2: "", target: "", details: "" });
  const [classes, setClasses] = useState([]);
  const [mine, setMine] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const load = useCallback(() => {
    supabase.from("madrasati_requests").select("*").order("created_at", { ascending: false }).limit(20)
      .then(({ data, error }) => setMine(error ? [] : data ?? []));
  }, []);
  useEffect(() => {
    load();
    supabase.rpc("madrasati_classes").then(({ data }) => setClasses(data ?? []));
    // الوصول من رابط «دعم منصة مدرستي» في الرئيسية
    if (window.location.hash === "#madrasati") setTimeout(() => document.getElementById("madrasati")?.scrollIntoView({ behavior: "smooth" }), 300);
  }, [load]);

  const open = (mine ?? []).filter((r) => r.status === "new" || r.status === "in_progress");
  const hasOpen = (k) => open.some((r) => r.kind === k);
  const m1 = normMobile(f.mobile), m2 = normMobile(f.mobile2);
  const valid = kind === "password" ? okMobile(m1) && m1 === m2
    : kind === "class" ? !!f.target : kind === "other" ? f.details.trim().length >= 5 : false;

  const send = async () => {
    setBusy(true); setMsg(null);
    const row = { kind, mobile: kind === "password" ? m1 : null, target_class: kind === "class" ? f.target : null,
                  details: f.details.trim() || null };
    const { error } = await supabase.from("madrasati_requests").insert(row);
    setBusy(false);
    if (error) {
      setMsg({ ok: false, text: /madrasati_requests_open/.test(error.message) ? "لديك طلب مفتوح من النوع نفسه. انتظر الرد عليه."
        : /does not exist|schema cache/.test(error.message) ? "الخدمة قيد التفعيل. حاول لاحقًا." : error.message });
      return;
    }
    setMsg({ ok: true, text: "وصل طلبك إلى الدعم الفني، ويصلك إشعار عند معالجته." });
    setKind(null); setF({ mobile: "", mobile2: "", target: "", details: "" }); load();
  };
  const cancel = async (r) => {
    if (!window.confirm("إلغاء هذا الطلب؟")) return;
    await supabase.from("madrasati_requests").delete().eq("id", r.id); load();
  };

  return (
    <section className="mt-6 space-y-3">
      <div className="card space-y-4 p-5">
        <div className="flex items-center gap-3">
          <img src="/brands/madrasati.png" alt="منصة مدرستي" className="h-12 w-24 shrink-0 object-contain" />
          <div className="min-w-0">
            <h2 className="text-base font-bold text-ink">دعم منصة مدرستي</h2>
            <p className="text-xs leading-relaxed text-muted">مشكلة في الدخول أو في فصلك بالمنصة؟ اطلبها هنا ويعالجها الدعم الفني بالمدرسة.</p>
          </div>
        </div>

        <MadrasatiAlert />

        <div className="grid gap-2 sm:grid-cols-2">
          <a href={MADRASATI_SUPPORT_URL} target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-3 rounded-sm2 border border-line bg-white p-3 hover:border-mint-light hover:bg-mint-tint/40">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1B8354]/10 text-[#1B8354]">☎</span>
            <span className="min-w-0 flex-1">
              <b className="block text-[13px] text-ink">الدعم الفني الرسمي للمنصة</b>
              <span className="block text-[11.5px] text-muted">صفحة «تواصل معنا» في منصة مدرستي</span>
            </span>
            <span className="text-faint">↗</span>
          </a>
          <div className="rounded-sm2 border border-line bg-canvas/60 p-3">
            <b className="block text-[13px] text-ink">نسيت كلمة المرور؟</b>
            <span className="block text-[11.5px] leading-relaxed text-muted">
              تصلك كلمة المرور برسالة على الجوال المسجّل لك في المنصة. إن لم تصلك أو تغيّر رقمك فاطلب «كلمة مرور جديدة» أدناه.
            </span>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink">اطلب من الدعم الفني</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {MR_KINDS.map((x) => (
              <button key={x.k} type="button" disabled={hasOpen(x.k)} onClick={() => { setKind(x.k); setMsg(null); }}
                className={`rounded-sm2 border p-3 text-start transition-colors disabled:opacity-60 ${
                  kind === x.k ? "border-mint-deep bg-mint-tint" : "border-line bg-white hover:bg-canvas"}`}>
                <span className="text-lg">{x.icon}</span>
                <b className="mt-1 block text-[13px] text-ink">{x.t}</b>
                <span className="block text-[11px] text-muted">{hasOpen(x.k) ? "لديك طلب مفتوح منه" : x.d}</span>
              </button>
            ))}
          </div>
        </div>

        {kind && (
          <div className="space-y-3 rounded-sm2 border border-line bg-canvas/50 p-3">
            {kind === "password" && (
              <>
                <p className="text-[12px] leading-relaxed text-muted">
                  اكتب رقم الجوال الذي تريد أن تصلك عليه كلمة المرور. يُسجَّل في المنصة ثم تُرسل عليه برسالة نصية، ولا تظهر كلمة المرور لأحد في المدرسة.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input className="field num" inputMode="tel" dir="ltr" maxLength={14} placeholder="05XXXXXXXX"
                         value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} />
                  <input className="field num" inputMode="tel" dir="ltr" maxLength={14} placeholder="أعد كتابة الرقم"
                         value={f.mobile2} onChange={(e) => setF({ ...f, mobile2: e.target.value })} />
                </div>
                {f.mobile && !okMobile(m1) && <p className="text-[11.5px] text-absent">الرقم يبدأ بـ 05 ومن 10 أرقام.</p>}
                {okMobile(m1) && f.mobile2 && m1 !== m2 && <p className="text-[11.5px] text-absent">الرقمان غير متطابقين.</p>}
              </>
            )}
            {kind === "class" && (
              <label className="block text-[12px] text-muted">فصلك الصحيح
                <select className="field mt-1 w-full" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })}>
                  <option value="">— اختر —</option>
                  {classes.map((c) => {
                    const t = `${GRADE_NAMES[c.grade] ?? ""} · ${c.class_no}`;
                    return <option key={t} value={t}>{t}</option>;
                  })}
                </select>
              </label>
            )}
            <textarea className="field min-h-[70px] w-full text-sm" maxLength={500}
                      placeholder={kind === "other" ? "صف المشكلة باختصار: ماذا حدث؟ وفي أي صفحة؟" : "ملاحظة (اختيارية)"}
                      value={f.details} onChange={(e) => setF({ ...f, details: e.target.value })} />
            <div className="flex gap-2">
              <button className="btn-primary px-5" disabled={!valid || busy} onClick={send}>{busy ? "جارٍ الإرسال…" : "إرسال الطلب"}</button>
              <button className="btn-ghost px-4" onClick={() => setKind(null)}>إلغاء</button>
            </div>
          </div>
        )}
        {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.text}</p>}
      </div>

      {(mine ?? []).length > 0 && (
        <div className="card overflow-hidden">
          <p className="border-b border-line px-4 py-2.5 text-sm font-semibold text-ink">طلباتي لمنصة مدرستي</p>
          <div className="divide-y divide-line">
            {mine.map((r) => (
              <div key={r.id} className="space-y-1 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink">{kindOf(r.kind).icon} {kindOf(r.kind).t}</span>
                  <span className={`rounded-pill px-2 py-0.5 text-[11px] font-semibold ${MR_STATUS[r.status]?.c}`}>{MR_STATUS[r.status]?.t}</span>
                  <span className="num ms-auto text-[11px] text-faint">{fmtDateTime(r.created_at)}</span>
                </div>
                {r.reply && <p className="rounded-sm2 bg-mint-tint/60 px-3 py-2 text-[12.5px] leading-relaxed text-ink">{r.reply}</p>}
                {r.status === "new" && <button className="text-[11.5px] text-absent" onClick={() => cancel(r)}>إلغاء الطلب</button>}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
