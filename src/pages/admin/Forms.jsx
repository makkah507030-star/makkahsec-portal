import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import FormSheet from "../../components/FormSheet.jsx";

/* =====================================================================
   النماذج والشهادات — الإصدار والأرشيف والاعتماد.
   ما يظهر لكل مستخدم تحدّده سياسات قاعدة البيانات، لا الواجهة.
   ===================================================================== */

const CAT_LABEL = { certificate: "شهادات", official: "رسمية", administrative: "إدارية" };
const STATUS_CHIP = {
  issued:   { t: "صادر",            c: "bg-present/10 text-present" },
  pending:  { t: "بانتظار الاعتماد", c: "bg-warning/10 text-warning" },
  approved: { t: "معتمد",           c: "bg-present/10 text-present" },
  rejected: { t: "مُعاد للتعديل",    c: "bg-absent/10 text-absent" },
};

const hijriYear = () => {
  try {
    const s = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric" }).format(new Date());
    return parseInt(String(s).replace(/\D/g, ""), 10);
  } catch { return new Date().getFullYear() - 579; }
};

const hijriToday = () => {
  try {
    return new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura",
      { day: "numeric", month: "long", year: "numeric" }).format(new Date()) + "هـ";
  } catch { return ""; }
};

const signedUrl = async (path) => {
  if (!path) return null;
  const { data } = await supabase.storage.from("form-assets").createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
};

export default function Forms() {
  const { session, profile, adminRoles } = useSession();
  const isManager = (adminRoles ?? []).some((r) => r === "tech_support" || r === "principal");
  const isApprover = (adminRoles ?? []).includes("principal");

  const [tab, setTab] = useState("issue");
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  const [picked, setPicked] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [issued, setIssued] = useState(null);      // المستند بعد الحفظ

  const [docs, setDocs] = useState([]);
  const [editing, setEditing] = useState(null);     // مستند مُعاد يجري تصحيحه
  const [returned, setReturned] = useState([]);     // ما أعاده المدير إليّ
  const [rejectFor, setRejectFor] = useState(null); // مستند بانتظار سبب الإعادة
  const [rejectNote, setRejectNote] = useState("");
  const [viewing, setViewing] = useState(null);    // { doc, template, urls }

  // أصول التوقيع والختم
  const [mySig, setMySig] = useState(null);
  const [assets, setAssets] = useState({});
  const [urls, setUrls] = useState({ sig: null, stamp: null, principal: null });

  // طلاب فصول المعلم
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState("");
  const [students, setStudents] = useState([]);

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: sig }, { data: a }] = await Promise.all([
        supabase.from("form_templates")
          .select("*").eq("is_active", true).order("sort_order"),
        supabase.from("user_signatures").select("path").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("school_assets").select("key, path"),
      ]);
      setTemplates(t ?? []);
      setMySig(sig?.path ?? null);
      const am = Object.fromEntries((a ?? []).map((r) => [r.key, r.path]));
      setAssets(am);
      setUrls({
        sig: await signedUrl(sig?.path),
        stamp: await signedUrl(am.stamp),
        principal: await signedUrl(am.principal_signature),
      });
      setLoading(false);
      loadReturned();
    })();
  }, [session]);

  // ما أعاده المدير لهذا المستخدم للتعديل
  const loadReturned = async () => {
    const { data } = await supabase.from("form_documents")
      .select("*, form_templates(title, category, orientation, fields, key, signature_source)")
      .eq("created_by", session.user.id).eq("status", "rejected")
      .order("created_at", { ascending: false });
    setReturned(data ?? []);
  };

  // فصول المستخدم: المعلم يرى فصوله المسندة فقط، والإدارة ترى كل الفصول
  useEffect(() => {
    (async () => {
      const needsStudent = (picked?.fields ?? []).some((f) => f.type === "student");
      if (!needsStudent) return;

      const { data: st } = await supabase.from("settings")
        .select("key, value").in("key", ["active_year", "active_term"]);
      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));

      const { data: me } = await supabase.from("teachers")
        .select("id").eq("user_id", session.user.id).maybeSingle();

      if (me) {
        const { data } = await supabase.from("schedule")
          .select("class_id, classes(class_no, grade)")
          .eq("teacher_id", me.id)
          .eq("academic_year", m.active_year ?? "")
          .eq("term", Number(m.active_term ?? 1));
        const uniq = {};
        (data ?? []).forEach((r) => { if (r.class_id) uniq[r.class_id] = r.classes; });
        setClasses(Object.entries(uniq).map(([id, c]) => ({ id, ...c })));
      } else if (isManager || (adminRoles ?? []).length) {
        const { data } = await supabase.from("classes").select("id, class_no, grade").order("class_no");
        setClasses(data ?? []);
      }
    })();
  }, [picked, session, adminRoles, isManager]);

  useEffect(() => {
    (async () => {
      if (!classId) { setStudents([]); return; }
      const { data } = await supabase.from("student_enrollment")
        .select("students(id, full_name)").eq("class_id", classId).eq("status", "active");
      setStudents((data ?? []).map((r) => r.students).filter(Boolean)
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar")));
    })();
  }, [classId]);

  const loadDocs = async () => {
    const { data } = await supabase.from("form_documents")
      .select("*, form_templates(title, category, orientation, fields, key, signature_source)")
      .order("created_at", { ascending: false }).limit(200);
    setDocs(data ?? []);
  };
  useEffect(() => { if (tab !== "issue") loadDocs(); }, [tab]);

  // فتح مستند مُعاد لتصحيحه بنفس رقمه التسلسلي
  const startEdit = (d) => {
    const t = templates.find((x) => x.id === d.template_id) ?? d.form_templates;
    if (!t) { setMsg({ ok: false, text: "النموذج لم يعد متاحًا." }); return; }
    setEditing(d);
    setPicked({ ...t, id: d.template_id });
    setValues(d.data ?? {});
    setIssued(null); setMsg(null); setClassId("");
  };

  const start = (t) => {
    setPicked(t);
    setEditing(null);
    setIssued(null); setMsg(null); setClassId("");
    const init = {};
    (t.fields ?? []).forEach((f) => { if (f.type === "date") init[f.name] = hijriToday(); });
    setValues(init);
  };

  const missing = useMemo(() => {
    if (!picked) return [];
    return (picked.fields ?? []).filter((f) => f.required && !String(values[f.name] ?? "").trim());
  }, [picked, values]);

  const issue = async () => {
    if (!picked || missing.length) {
      setMsg({ ok: false, text: `أكمل الحقول المطلوبة: ${missing.map((f) => f.label).join("، ")}` });
      return;
    }
    setSaving(true); setMsg(null);

    // تصحيح مستند مُعاد: نحتفظ برقمه التسلسلي ونعيده لقائمة الاعتماد
    if (editing) {
      const { data, error } = await supabase.from("form_documents")
        .update({
          data: values,
          recipient: values.recipient ?? null,
          student_id: values.student_id ?? null,
          status: "pending",
          decision_note: null,
          approved_by: null,
          approved_at: null,
        })
        .eq("id", editing.id).select().single();
      setSaving(false);
      if (error) { setMsg({ ok: false, text: `تعذّر الحفظ: ${error.message}` }); return; }
      setIssued(data);
      setEditing(null);
      loadReturned();
      setMsg({ ok: true, text: `أُعيد إرسال المستند ${data.serial} للاعتماد.` });
      return;
    }

    const year = hijriYear();
    const { data: serial, error: se } = await supabase
      .rpc("next_form_serial", { p_category: picked.category, p_hijri_year: year });
    if (se) { setSaving(false); setMsg({ ok: false, text: `تعذّر إصدار الرقم: ${se.message}` }); return; }

    const usesIssuer = picked.signature_source === "issuer" || picked.signature_source === "both";
    const row = {
      template_id: picked.id,
      serial,
      title: picked.title,
      recipient: values.recipient ?? null,
      student_id: values.student_id ?? null,
      data: values,
      status: picked.requires_approval ? "pending" : "issued",
      hijri_year: year,
      created_by: session.user.id,
      signature_path: usesIssuer ? mySig : null,
      signature_name: usesIssuer ? (profile?.full_name ?? profile?.username ?? "") : null,
      signature_role: usesIssuer ? (adminRoles?.length ? "الإدارة" : "المعلم") : null,
      stamp_path: picked.show_stamp ? (assets.stamp ?? null) : null,
    };

    const { data, error } = await supabase.from("form_documents").insert(row).select().single();
    setSaving(false);
    if (error) { setMsg({ ok: false, text: `تعذّر الحفظ: ${error.message}` }); return; }

    setIssued(data);
    setMsg({
      ok: true,
      text: picked.requires_approval
        ? `حُفظ برقم ${serial} — بانتظار اعتماد المدير قبل الطباعة.`
        : `صدر برقم ${serial}.`,
    });
  };

  const decide = async (doc, status, note = null) => {
    const { error } = await supabase.from("form_documents")
      .update({
        status,
        decision_note: note,
        approved_by: session.user.id,
        approved_at: new Date().toISOString(),
      })
      .eq("id", doc.id);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setRejectFor(null); setRejectNote("");
    loadDocs();
  };

  const openDoc = async (d) => {
    setViewing({
      doc: { ...d, signature_source: d.form_templates?.signature_source },
      template: { ...d.form_templates, fields: d.form_templates?.fields ?? [] },
      sig: await signedUrl(d.signature_path),
      stamp: await signedUrl(d.stamp_path),
      principal: await signedUrl(assets.principal_signature),
    });
  };

  const printNow = () => window.print();

  if (loading) return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;

  /* ---------------- معاينة مستند من الأرشيف ---------------- */
  if (viewing) {
    const d = viewing.doc;
    const printable = d.status === "issued" || d.status === "approved";
    return (
      <div className="space-y-4">
        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <button onClick={() => setViewing(null)} className="rounded-pill border border-line px-4 py-1.5 text-sm text-muted hover:bg-canvas">
            رجوع
          </button>
          <div className="flex items-center gap-2">
            <span className={`chip ${STATUS_CHIP[d.status].c}`}>{STATUS_CHIP[d.status].t}</span>
            {printable
              ? <button className="btn-primary" onClick={printNow}>طباعة</button>
              : <span className="text-xs text-muted">لا يُطبع قبل الاعتماد</span>}
          </div>
        </div>
        <div className="no-print overflow-x-auto">
          <FormSheet template={viewing.template} values={d.data} doc={d}
                     sigUrl={printable ? viewing.sig : null}
                     stampUrl={printable ? viewing.stamp : null}
                     principalSigUrl={printable ? viewing.principal : null} />
        </div>
      </div>
    );
  }

  /* ---------------- تعبئة نموذج ---------------- */
  if (picked) {
    const d = issued ?? { serial: null, signature_name: profile?.full_name, signature_source: picked.signature_source };
    const showSign = !picked.requires_approval || issued?.status === "approved";
    return (
      <div className="space-y-4">
        <div className="no-print flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-bold text-ink">{picked.title}</h1>
            <p className="text-sm text-muted">{picked.description}</p>
          </div>
          <button onClick={() => setPicked(null)} className="rounded-pill border border-line px-4 py-1.5 text-sm text-muted hover:bg-canvas">
            رجوع للنماذج
          </button>
        </div>

        {editing?.decision_note && (
          <div className="no-print rounded-card border border-absent/30 bg-absent/5 px-4 py-3">
            <p className="text-sm font-semibold text-absent">أعاد المدير هذا النموذج للتعديل</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink">
              {editing.decision_note}
            </p>
            <p className="num mt-1 text-xs text-faint">رقم المستند: {editing.serial}</p>
          </div>
        )}

        <div className="no-print grid gap-4 lg:grid-cols-[320px,1fr]">
          <section className="card space-y-3 p-4">
            {(picked.fields ?? []).map((f) => (
              <div key={f.name}>
                <label className="text-xs text-muted">
                  {f.label}{f.required && <span className="text-absent"> *</span>}
                </label>

                {f.type === "student" ? (
                  <div className="mt-1 space-y-2">
                    <select className="field w-full" value={classId} onChange={(e) => setClassId(e.target.value)}>
                      <option value="">اختر الفصل…</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>فصل {c.class_no}</option>
                      ))}
                    </select>
                    <select className="field w-full" value={values.student_id ?? ""}
                            onChange={(e) => {
                              const s = students.find((x) => x.id === e.target.value);
                              setValues((v) => ({ ...v, student_id: e.target.value, recipient: s?.full_name ?? "" }));
                            }}
                            disabled={!classId}>
                      <option value="">اختر الطالب…</option>
                      {students.map((s) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                    </select>
                  </div>
                ) : f.type === "textarea" ? (
                  <textarea rows={4} className="field mt-1 w-full" value={values[f.name] ?? ""}
                            onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
                ) : (
                  <input className="field mt-1 w-full" value={values[f.name] ?? ""}
                         onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
                )}
              </div>
            ))}

            {picked.signature_source !== "none" && !mySig &&
             (picked.signature_source === "issuer" || picked.signature_source === "both") && (
              <p className="rounded-sm2 bg-warning/10 px-3 py-2 text-xs text-warning">
                لم ترفع توقيعك بعد. سيصدر المستند بلا توقيع — ارفعه من صفحة «توقيعي».
              </p>
            )}

            <button className="btn-primary w-full" onClick={issue} disabled={saving || !!issued}>
              {saving ? "جارٍ الحفظ…"
                : issued ? "تم"
                : editing ? "إعادة الإرسال للاعتماد"
                : picked.requires_approval ? "إرسال للاعتماد" : "إصدار وحفظ"}
            </button>

            {issued && (issued.status === "issued") && (
              <button className="w-full rounded-sm2 border border-line py-2 text-sm text-mint-deep hover:bg-canvas"
                      onClick={printNow}>
                طباعة
              </button>
            )}

            {msg && (
              <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
                {msg.text}
              </p>
            )}
          </section>

          <section className="overflow-x-auto">
            <FormSheet
              template={picked} values={values} doc={d}
              sigUrl={showSign ? urls.sig : null}
              stampUrl={showSign && picked.show_stamp ? urls.stamp : null}
              principalSigUrl={showSign ? urls.principal : null}
            />
          </section>
        </div>
      </div>
    );
  }

  /* ---------------- القوائم ---------------- */
  const pending = docs.filter((d) => d.status === "pending");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">النماذج والشهادات</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          اختر نموذجًا لتعبئته وطباعته. كل ما يصدر يُحفظ في الأرشيف برقم تسلسلي.
        </p>
      </div>

      {returned.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-absent/30 bg-absent/5 px-4 py-3">
          <p className="text-sm text-absent">
            <span className="font-semibold">
              {returned.length === 1 ? "نموذج واحد أُعيد إليك للتعديل" : `${returned.length} نماذج أُعيدت إليك للتعديل`}
            </span>
            {" "}— صحّحها ثم أعد إرسالها للاعتماد.
          </p>
          <button onClick={() => setTab("returned")}
                  className="shrink-0 rounded-pill bg-absent px-4 py-1.5 text-xs font-semibold text-white">
            عرضها
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {[["issue", "إصدار نموذج"],
          ...(returned.length ? [["returned", `المُعادة إليّ (${returned.length})`]] : []),
          ["archive", "الأرشيف"],
          ...(isApprover ? [["approve", `الاعتماد${pending.length ? ` (${pending.length})` : ""}`]] : [])]
          .map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
                tab === k ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
              {label}
            </button>
          ))}
      </div>

      {tab === "issue" && (
        templates.length === 0 ? (
          <div className="card px-6 py-10 text-center">
            <p className="font-semibold text-ink">لا نماذج متاحة لحسابك</p>
            <p className="mt-1.5 text-sm text-muted">راجع الدعم الفني لإتاحة النماذج المناسبة لدورك.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((t) => (
              <button key={t.id} onClick={() => start(t)}
                      className="card p-4 text-right transition-colors hover:border-[#CCF2DB] hover:bg-mint-tint/40">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-ink">{t.title}</p>
                  <span className="chip bg-mint-tint text-mint-deep">{CAT_LABEL[t.category]}</span>
                </div>
                <p className="mt-1 text-sm text-muted">{t.description}</p>
                {t.requires_approval && (
                  <p className="mt-2 text-xs text-warning">يحتاج اعتماد المدير قبل الطباعة</p>
                )}
              </button>
            ))}
          </div>
        )
      )}

      {tab === "returned" && (
        <div className="space-y-3">
          {returned.length === 0 && (
            <p className="card px-4 py-6 text-sm text-muted">لا نماذج مُعادة إليك.</p>
          )}
          {returned.map((d) => (
            <div key={d.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{d.title}</p>
                  <p className="num mt-0.5 text-xs text-faint">
                    {d.serial}{d.recipient ? ` · ${d.recipient}` : ""}
                  </p>
                </div>
                <button onClick={() => startEdit(d)} className="btn-primary px-4 py-1.5 text-xs">
                  تصحيح وإعادة إرسال
                </button>
              </div>
              {d.decision_note && (
                <p className="mt-2 whitespace-pre-line rounded-sm2 bg-absent/5 px-3 py-2 text-sm leading-relaxed text-ink">
                  <span className="font-semibold text-absent">سبب الإعادة: </span>{d.decision_note}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "archive" && (
        <div className="card divide-y divide-line overflow-hidden">
          {docs.length === 0 && <p className="px-4 py-6 text-sm text-muted">لا مستندات بعد.</p>}
          {docs.map((d) => (
            <button key={d.id} onClick={() => openDoc(d)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right hover:bg-canvas">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{d.title}</p>
                <p className="num mt-0.5 text-xs text-faint">
                  {d.serial}{d.recipient ? ` · ${d.recipient}` : ""}
                </p>
              </div>
              <span className={`chip shrink-0 ${STATUS_CHIP[d.status].c}`}>{STATUS_CHIP[d.status].t}</span>
            </button>
          ))}
        </div>
      )}

      {tab === "approve" && (
        <div className="space-y-3">
          {pending.length === 0 && (
            <p className="card px-4 py-6 text-sm text-muted">لا مستندات بانتظار الاعتماد.</p>
          )}
          {rejectFor && (
            <div className="card space-y-2 border-absent/30 p-4">
              <p className="text-sm font-semibold text-ink">
                سبب إعادة «{rejectFor.title}» إلى مُصدِره
              </p>
              <textarea rows={3} className="field w-full" value={rejectNote}
                        placeholder="اكتب ما يجب تصحيحه بوضوح — سيقرأه المُصدِر كما هو."
                        onChange={(e) => setRejectNote(e.target.value)} />
              <div className="flex gap-2">
                <button className="btn-primary px-4 py-1.5 text-xs"
                        disabled={!rejectNote.trim()}
                        onClick={() => decide(rejectFor, "rejected", rejectNote.trim())}>
                  إعادة للمُصدِر
                </button>
                <button onClick={() => setRejectFor(null)}
                        className="rounded-pill border border-line px-4 py-1.5 text-xs text-muted hover:bg-canvas">
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {pending.map((d) => (
            <div key={d.id} className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-ink">{d.title}</p>
                  <p className="num mt-0.5 text-xs text-faint">{d.serial}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openDoc(d)}
                          className="rounded-pill border border-line px-3 py-1.5 text-xs text-muted hover:bg-canvas">
                    معاينة
                  </button>
                  <button onClick={() => { setRejectFor(d); setRejectNote(""); }}
                          className="rounded-pill border border-absent/40 px-3 py-1.5 text-xs text-absent hover:bg-absent/5">
                    إعادة للتعديل
                  </button>
                  <button onClick={() => decide(d, "approved")} className="btn-primary px-4 py-1.5 text-xs">
                    اعتماد
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
