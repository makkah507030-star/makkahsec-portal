// src/pages/globe/GlobeSupervisor.jsx
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useNotice } from "../../lib/useNotice.js";
import { loadPrincipalSignature, loadSchoolStamp } from "../../lib/principalSignature";
import { signatureByName } from "../../lib/userSignatures";
import Loader from "../../components/Loader.jsx";
import ReportViewer from "../../components/report/ReportViewer.jsx";
import { GLOBE_BUCKET } from "../../lib/globe.js";
import { uploadDoc, signedUrl, MAX_DOC_MB } from "./shared.jsx";
import { cvPages } from "./GlobeCharts.jsx";

/* =====================================================================
   السيرة الذاتية لمشرف برنامج جلوب (supabase/globe_3.sql ← globe_supervisor، صف واحد)
   وشهادة اعتماد تدريبه (صورة أو PDF في globe-files/supervisor)، وطباعتها بهوية البوابة.
   ===================================================================== */

export const CV_FIELDS = [
  { k: "name", t: "الاسم" },
  { k: "title", t: "الصفة", ph: "المشرف العام لبرنامج جلوب البيئي العالمي" },
  { k: "degree", t: "المؤهل العلمي", ph: "بكالوريوس علوم — تخصص …" },
  { k: "job", t: "العمل الحالي", ph: "معلم … بمدرسة مكة الثانوية" },
  { k: "years", t: "سنوات الخبرة في التعليم" },
  { k: "globe_since", t: "الإشراف على البرنامج منذ", ph: "2023" },
  { k: "email", t: "البريد الإلكتروني", ltr: true },
];
export const CV_LISTS = [
  { k: "about", t: "نبذة", rows: 3, ph: "نبذة مختصرة عن المشرف واهتمامه بالتعليم البيئي" },
  { k: "training", t: "الدورات والاعتمادات", rows: 4, ph: "دورة في سطر: اعتماد مدرب GLOBE — 2024" },
  { k: "experience", t: "الخبرات", rows: 4, ph: "خبرة في سطر" },
  { k: "achievements", t: "الإنجازات", rows: 4, ph: "إنجاز في سطر" },
];
const setup = (e) => (/globe_supervisor|schema cache|relation/i.test(e?.message ?? "")
  ? "السيرة الذاتية تحتاج تشغيل ملف supabase/globe_3.sql مرة واحدة في Supabase ← SQL Editor." : e?.message);

export default function GlobeSupervisor({ leader }) {
  const [row, setRow] = useState(null);
  const [d, setD] = useState({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useNotice(null);
  const [print, setPrint] = useState(false);

  const load = () => supabase.from("globe_supervisor").select("*").eq("id", 1).maybeSingle().then(({ data, error }) => {
    if (error) setMsg({ ok: false, text: setup(error) });
    setRow(data ?? { id: 1, data: {} });
    setD({ name: leader ?? "", title: "المشرف العام لبرنامج جلوب البيئي العالمي", ...(data?.data ?? {}) });
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const save = async (extra = {}) => {
    setBusy(true); setMsg(null);
    const { error } = await supabase.from("globe_supervisor").upsert({ id: 1, data: d, ...extra, updated_at: new Date().toISOString() });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: setup(error) }); return false; }
    setMsg({ ok: true, text: "حُفظت السيرة الذاتية." }); load();
    return true;
  };

  const uploadCert = async (file) => {
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const old = row?.cert_path;
      const up = await uploadDoc("supervisor", file);
      setBusy(false);
      if (await save({ cert_path: up.path, cert_mime: up.mime }) && old) await supabase.storage.from(GLOBE_BUCKET).remove([old]);
    } catch (e) { setBusy(false); setMsg({ ok: false, text: setup(e) }); }
  };

  const openCert = async () => {
    const w = window.open("", "_blank");
    const u = await signedUrl(row.cert_path);
    if (w && u) w.location.href = u;
  };

  if (!row) return <Loader />;
  if (print) return <CvReport d={d} cert={row} onBack={() => setPrint(false)} />;

  return (
    <div className="space-y-4">
      <section className="card space-y-3 p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-ink">السيرة الذاتية لمشرف البرنامج</h2>
          <button data-ro-ok className="btn-ghost ms-auto px-3 py-1.5 text-xs" onClick={() => setPrint(true)}>طباعة السيرة الذاتية</button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {CV_FIELDS.map((f) => (
            <label key={f.k} className="text-xs text-muted">{f.t}
              <input className="field mt-1 w-full" dir={f.ltr ? "ltr" : undefined} placeholder={f.ph ?? ""} maxLength={120}
                     value={d[f.k] ?? ""} onChange={(e) => setD({ ...d, [f.k]: e.target.value })} />
            </label>
          ))}
        </div>
        {CV_LISTS.map((f) => (
          <label key={f.k} className="block text-xs text-muted">{f.t}{f.k !== "about" && " (بند في كل سطر)"}
            <textarea className="field mt-1 w-full" rows={f.rows} placeholder={f.ph} maxLength={1500}
                      value={d[f.k] ?? ""} onChange={(e) => setD({ ...d, [f.k]: e.target.value })} />
          </label>
        ))}
        <button className="btn-primary" disabled={busy} onClick={() => save()}>{busy ? "جارٍ الحفظ…" : "حفظ السيرة الذاتية"}</button>
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="text-sm font-bold text-ink">شهادة اعتماد التدريب</h2>
        <p className="text-xs text-muted">صورة الشهادة أو ملف PDF (حتى {MAX_DOC_MB} م.ب). صورة الشهادة تُطبع مع السيرة الذاتية.</p>
        {row.cert_path && (
          <div className="flex items-center gap-3 rounded-sm2 border border-line bg-canvas px-3 py-2">
            <span className="text-sm text-ink">{row.cert_mime === "application/pdf" ? "ملف PDF مرفوع" : "صورة مرفوعة"}</span>
            <button data-ro-ok className="text-xs font-semibold text-mint-deep" onClick={openCert}>عرض</button>
          </div>
        )}
        <input type="file" accept="image/*,application/pdf" className="field w-full" disabled={busy}
               onChange={(e) => uploadCert(e.target.files?.[0])} />
      </section>
      {msg && <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>{msg.text}</p>}
    </div>
  );
}

function CvReport({ d, cert, onBack }) {
  const [theme, setTheme] = useState("light");
  const [extra, setExtra] = useState({ cert: null, sig: null, principal: null, stamp: null });
  useEffect(() => {
    let live = true;
    Promise.all([cert?.cert_path && cert.cert_mime !== "application/pdf" ? signedUrl(cert.cert_path) : null,
                 d.name ? signatureByName(d.name) : null, loadPrincipalSignature(), loadSchoolStamp()])
      .then(([c, s, p, st]) => { if (live) setExtra({ cert: c, sig: s, principal: p?.url ?? null, stamp: st }); });
    return () => { live = false; };
  }, [cert, d.name]);
  const pages = useMemo(() => cvPages({ d, theme, ...extra, hasPdfCert: cert?.cert_mime === "application/pdf" }), [d, theme, extra, cert]);
  return (
    <ReportViewer id="globe-cv-print" pages={pages} theme={theme} setTheme={setTheme}
      fileTitle={`السيرة الذاتية — ${d.name || "مشرف برنامج جلوب"}`}
      controls={<button className="btn-ghost px-4 py-1.5 text-xs" onClick={onBack}>رجوع</button>} />
  );
}
