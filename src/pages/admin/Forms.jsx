// src/pages/admin/Forms.jsx
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession, ADMIN_ROLE_LABEL } from "../../lib/session.jsx";
import { GRADE_NAMES } from "../../lib/schoolTime";
import DateField, { TimeField, rangeDays } from "../../components/DateField.jsx";
import FormReport, { ReportPrintArea } from "../../components/FormReport.jsx";
import FormSheet, { PrintArea, SHEET_PX, CERT_THEMES } from "../../components/FormSheet.jsx";

/* =====================================================================
   النماذج والشهادات — الإصدار والأرشيف والاعتماد.
   ما يظهر لكل مستخدم تحدّده سياسات قاعدة البيانات، لا الواجهة.
   ===================================================================== */

const CAT_LABEL = { certificate: "شهادات", official: "رسمية", administrative: "إدارية" };

/* أقسام المدرسة — يُصنَّف كل نموذج تحت قسمه المُصدِر */
export const DEPARTMENTS = [
  { key: "school_admin",    label: "الإدارة المدرسية" },
  { key: "academic",        label: "الشؤون التعليمية" },
  { key: "school_affairs",  label: "الشؤون المدرسية" },
  { key: "student_affairs", label: "شؤون الطلاب" },
  { key: "guidance",        label: "التوجيه الطلابي" },
  { key: "activity",        label: "النشاط الطلابي" },
  { key: "health",          label: "الموجه الصحي" },
  { key: "gifted",          label: "الموهوبين" },
  { key: "globe",           label: "برنامج جلوب البيئي العالمي" },
  { key: "sport",           label: "مكة سبورت" },
];
const DEPT_LABEL = Object.fromEntries(DEPARTMENTS.map((d) => [d.key, d.label]));
const STATUS_CHIP = {
  issued:   { t: "صادر",            c: "bg-present/10 text-present" },
  pending:  { t: "بانتظار الاعتماد", c: "bg-warning/10 text-warning" },
  approved: { t: "معتمد",           c: "bg-present/10 text-present" },
  rejected: { t: "مُعاد للتعديل",    c: "bg-absent/10 text-absent" },
  awaiting_reply: { t: "بانتظار رد المستفيد", c: "bg-warning/10 text-warning" },
  replied:  { t: "وصل الرد",         c: "bg-mint-tint text-mint-deep" },
};

const hijriYear = () => {
  try {
    const s = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric" }).format(new Date());
    return parseInt(String(s).replace(/\D/g, ""), 10);
  } catch { return new Date().getFullYear() - 579; }
};

// التاريخ الهجري بصيغة رقمية: يوم/شهر/سنة — بلا أسماء شهور ولا حرف الهاء
const hijriToday = () => {
  try {
    const parts = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura",
      { day: "2-digit", month: "2-digit", year: "numeric" }).formatToParts(new Date());
    const g = (t) => parts.find((x) => x.type === t)?.value ?? "";
    return `${g("day")}/${g("month")}/${String(g("year")).replace(/\D/g, "")}`;
  } catch { return ""; }
};

/* معاينة مصغّرة: تُقاس عرض الحاوية فتُصغَّر الورقة لتناسبها */
function SheetPreview({ landscape, children }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const fit = () => {
      const w = box.current?.clientWidth ?? 0;
      const sheet = landscape ? SHEET_PX.landscape : SHEET_PX.portrait;
      if (w) setScale(Math.min(1, Math.max(0.25, (w - 8) / sheet)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [landscape]);

  const h = (landscape ? SHEET_PX.portrait : 1123) * scale + 16;
  return (
    <div ref={box} className="w-full min-w-0 max-w-full overflow-hidden">
      <div className="min-w-0" style={{ height: h }}>
        <div className="w-0 min-w-0" style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}>
          <div style={{ width: landscape ? SHEET_PX.landscape : SHEET_PX.portrait }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/* التعبئة التلقائية: يطابق حقول النموذج بما هو معروف في قاعدة البيانات
   اعتمادًا على تسمية الحقل، فيقلّ الإدخال اليدوي قدر الإمكان. */
const AUTO_MAP = [
  { keys: ["اسم الطالب", "اسم الموظف", "اسم المنسوب", "الاسم رباعي", "اسم المعلم", "الاسم"], from: "name" },
  { keys: ["السجل المدني", "رقم الهوية", "الإقامة", "رقم السجل"], from: "national_id" },
  { keys: ["الصف", "الفصل", "المرحلة"], from: "class_label" },
  { keys: ["جوال ولي الأمر", "هاتف ولي الأمر", "جوال"], from: "guardian_mobile" },
  { keys: ["ولي الأمر", "ولي أمر"], from: "guardian_name" },
  { keys: ["التخصص"], from: "specialization" },
  { keys: ["المسمّى", "المسمى", "العمل الحالي", "الوظيفة"], from: "job" },
];

function autoFill(fields, info, current) {
  const out = { ...current };
  (fields ?? []).forEach((f) => {
    if (["student", "staff", "theme", "table"].includes(f.type)) return;
    if (String(out[f.name] ?? "").trim()) return;           // لا نطمس ما كتبه المستخدم
    const label = f.label ?? "";
    const hit = AUTO_MAP.find((m) => m.keys.some((k) => label.includes(k)));
    const val = hit ? info[hit.from] : null;
    if (val) out[f.name] = val;
  });
  return out;
}

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
  const [dept, setDept] = useState("all");
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
  const [chosen, setChosen] = useState([]);      // مستفيدون متعددون: شهادة لكل واحد
  const [staff, setStaff] = useState([]);        // موظفو المدرسة: معلمون وإداريون
  const [staffQ, setStaffQ] = useState("");
  const [batch, setBatch] = useState([]);        // مستندات صدرت دفعة واحدة للطباعة

  useEffect(() => {
    (async () => {
      const [{ data: t }, { data: sig }, { data: a }] = await Promise.all([
        supabase.from("form_templates")
          .select("*").eq("is_active", true).order("sort_order"),
        supabase.from("user_signatures").select("path").eq("user_id", session.user.id).maybeSingle(),
        supabase.from("school_assets").select("key, path, label"),
      ]);
      setTemplates(t ?? []);
      setMySig(sig?.path ?? null);
      const am = Object.fromEntries((a ?? []).map((r) => [r.key, r.path]));
      am.principal_name = (a ?? []).find((r) => r.key === "principal_signature")?.label ?? "";
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

  // موظفو المدرسة لشهادات المعلمين والإداريين — الاسم والمسمّى الوظيفي
  useEffect(() => {
    (async () => {
      const needsStaff = (picked?.fields ?? []).some((f) => f.type === "staff");
      if (!needsStaff || staff.length) return;

      const [{ data: tch }, { data: usr }, { data: roles }] = await Promise.all([
        supabase.from("teachers").select("id, user_id, full_name, specialization, national_id").order("full_name"),
        supabase.from("users").select("id, full_name, username, role").eq("role", "admin"),
        supabase.from("admin_roles").select("user_id, role_type"),
      ]);

      // المسمّى الوظيفي من مسمّيات الأدوار المعتمدة في البوابة
      const jobBy = {};
      (roles ?? []).forEach((r) => {
        const label = ADMIN_ROLE_LABEL[r.role_type] ?? r.role_type;
        jobBy[r.user_id] = jobBy[r.user_id]
          ? `${jobBy[r.user_id]} و${label}`
          : label;
      });

      // الإداريون أولًا: من يجمع بين التدريس ودور إداري يظهر بمسمّاه الإداري
      const list = [
        ...(usr ?? []).map((u) => ({
          id: `u-${u.id}`,
          uid: u.id,
          full_name: u.full_name ?? u.username,
          job: jobBy[u.id] ?? "إداري بالمدرسة",
        })),
        ...(tch ?? []).map((t) => ({
          id: `t-${t.id}`,
          uid: t.user_id ?? null,
          full_name: t.full_name,
          specialization: t.specialization ?? "",
          national_id: t.national_id ?? "",
          job: "معلم",
        })),
      ];

      // التخصص يُنقل للإداري الذي له سجل معلّم، ليُملأ حقل «التخصص» تلقائيًا
      const specByName = {};
      (tch ?? []).forEach((t) => {
        if (t.full_name) specByName[t.full_name.trim()] = {
          specialization: t.specialization ?? "",
          national_id: t.national_id ?? "",
        };
      });
      list.forEach((m) => {
        const extra = specByName[(m.full_name ?? "").trim()];
        if (extra && !m.specialization) Object.assign(m, extra);
      });

      const seen = new Set();
      setStaff(list.filter((x) => {
        const k = (x.full_name ?? "").trim();
        if (!k || seen.has(k)) return false;
        seen.add(k); return true;
      }));
    })();
  }, [picked, staff.length]);

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
        .select("students(id, full_name, user_id, national_id)").eq("class_id", classId).eq("status", "active");
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
  // يُحمَّل عند فتح الصفحة ليُحتسب عدّاد الردود والاعتماد فورًا
  useEffect(() => { loadDocs(); }, [tab]);

  // فتح مستند مُعاد لتصحيحه بنفس رقمه التسلسلي
  const startEdit = (d) => {
    const t = templates.find((x) => x.id === d.template_id) ?? d.form_templates;
    if (!t) { setMsg({ ok: false, text: "النموذج لم يعد متاحًا." }); return; }
    setEditing(d);
    setChosen([]); setBatch([]);
    setPicked({ ...t, id: d.template_id });
    setValues(d.data ?? {});
    setIssued(null); setMsg(null); setClassId("");
  };

  const start = (t) => {
    setPicked(t);
    setEditing(null);
    setIssued(null); setMsg(null); setClassId(""); setChosen([]); setBatch([]);
    const init = {};
    (t.fields ?? []).forEach((f) => {
      if (f.type === "date") init[f.name] = hijriToday();
      else if (f.default) init[f.name] = f.default;
    });
    setValues(init);
  };

  const multi = chosen.length > 1;

  // حقول يملؤها المستفيد بنفسه — يُحجب عن المُصدِر
  const needsReply = (picked?.fields ?? []).some((f) => f.by_recipient);

  const missing = useMemo(() => {
    if (!picked) return [];
    return (picked.fields ?? []).filter((f) => {
      if (f.by_recipient || f.after_reply) return false;
      if (f.type === "table" || f.type === "duty_schedule") return false;
      if (f.type === "student" || f.type === "staff") return f.required && chosen.length === 0;
      return f.required && !String(values[f.name] ?? "").trim();
    });
  }, [picked, values, chosen]);

  const toggleStaff = async (m) => {
    const already = chosen.some((x) => x.id === m.id);
    const next = already ? chosen.filter((x) => x.id !== m.id) : [...chosen, m];
    setChosen(next);

    const head = next[0];
    if (!head) { setValues((v) => ({ ...v, recipient: "", job: "" })); return; }

    // المسمّى في النموذج: التخصص للمعلم، والمسمّى الإداري لمن له دور إداري.
    // أما قائمة الاختيار فتظل تعرض «معلم» للتمييز السريع.
    const jobValue = head.job === "معلم"
      ? (head.specialization || "معلم")
      : (head.job ?? "");

    const info = {
      name: head.full_name,
      job: jobValue,
      specialization: head.specialization ?? "",
      national_id: head.national_id ?? "",
    };
    setValues((v) =>
      autoFill(picked?.fields, info, { ...v, recipient: head.full_name, job: jobValue }));

    // نموذج التكليف: يُملأ جدول الموظف في المناوبة والإشراف تلقائيًا
    const dutyField = (picked?.fields ?? []).find((f) => f.type === "duty_schedule");
    if (dutyField && head.uid) {
      const { data } = await supabase.rpc("my_duty_schedule", { p_user: head.uid });
      const fmt = (d) => {
        if (!d) return "";
        const x = new Date(d + "T00:00:00");
        const p = (n) => String(n).padStart(2, "0");
        return `${p(x.getDate())}/${p(x.getMonth() + 1)}/${x.getFullYear()}`;
      };
      const rows = data ?? [];
      setValues((v) => ({
        ...v,
        [dutyField.name]: {
          duty: rows.filter((r) => r.kind === "duty").map((r) => ({
            day: r.day_label, date: fmt(r.duty_date),
            hijri: r.hijri_label ?? "", partner: r.partner ?? "",
          })),
          supervision: rows.filter((r) => r.kind === "supervision").map((r) => ({
            day: r.day_label,
            role: r.partner === "supervisor" ? "مشرف متابع" : "معلم مشرف",
          })),
        },
      }));
    }
  };

  // بيانات الطالب المعروفة في القاعدة — لتعبئة الحقول تلقائيًا
  const studentInfo = async (st) => {
    const info = { name: st.full_name, national_id: st.national_id ?? null };
    const [{ data: v }, { data: gs }] = await Promise.all([
      supabase.from("v_active_students").select("class_no, grade").eq("student_id", st.id).maybeSingle(),
      supabase.from("guardian_student").select("guardians(full_name, mobile)").eq("student_id", st.id),
    ]);
    if (v) {
      info.class_label = `${GRADE_NAMES[v.grade] ?? ""} — فصل ${v.class_no}`.trim();
    }
    const g = (gs ?? [])[0]?.guardians;
    if (g) { info.guardian_name = g.full_name; info.guardian_mobile = g.mobile; }
    return info;
  };

  const toggleStudent = async (st) => {
    const already = chosen.some((x) => x.id === st.id);
    const next = already ? chosen.filter((x) => x.id !== st.id) : [...chosen, st];
    setChosen(next);

    const head = next[0];
    if (!head) {
      setValues((v) => ({ ...v, student_id: null, recipient: "" }));
      return;
    }
    setValues((v) => ({ ...v, student_id: head.id, recipient: head.full_name }));

    // التعبئة التلقائية من بيانات أول طالب مختار
    try {
      const info = await studentInfo(head);
      setValues((v) => autoFill(picked?.fields, info, { ...v, student_id: head.id, recipient: head.full_name }));
    } catch { /* تبقى الحقول للإدخال اليدوي */ }
  };

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
    // صفة المُصدِر كما تُطبع تحت توقيعه — مسمّاه الوظيفي الفعلي
    const roles = (adminRoles ?? []).filter((r) => r !== "admin");
    const issuerRole = roles.length
      ? roles.map((r) => ADMIN_ROLE_LABEL[r] ?? r).join(" و")
      : "المعلم";
    const row = {
      template_id: picked.id,
      serial,
      title: picked.title,
      recipient: values.recipient ?? null,
      student_id: values.student_id ?? null,
      data: values,
      status: needsReply ? "awaiting_reply"
            : picked.requires_approval ? "pending" : "issued",
      hijri_year: year,
      created_by: session.user.id,
      signature_path: usesIssuer ? mySig : null,
      signature_name: usesIssuer ? (profile?.full_name ?? profile?.username ?? "") : null,
      signature_role: usesIssuer ? issuerRole : null,
      stamp_path: picked.show_stamp ? (assets.stamp ?? null) : null,
    };

    // شهادة لكل طالب مختار، لكل واحدة رقمها التسلسلي
    const targets = chosen.length ? chosen : [null];
    const rows = [];
    for (let i = 0; i < targets.length; i++) {
      const st = targets[i];
      let sr = serial;
      if (i > 0) {
        const { data: more, error: me } = await supabase
          .rpc("next_form_serial", { p_category: picked.category, p_hijri_year: year });
        if (me) { setSaving(false); setMsg({ ok: false, text: me.message }); return; }
        sr = more;
      }
      rows.push({
        ...row,
        recipient_user_id: st ? (st.uid ?? st.user_id ?? null) : null,
        serial: sr,
        recipient: st ? st.full_name : row.recipient,
        student_id: st && !/^[tu]-/.test(String(st.id)) ? st.id : row.student_id,
        data: st
          ? { ...values,
              recipient: st.full_name,
              ...(st.job
                ? { job: st.job === "معلم" ? (st.specialization || "معلم") : st.job }
                : {}),
              ...(/^[tu]-/.test(String(st.id)) ? {} : { student_id: st.id }) }
          : values,
      });
    }

    const { data, error } = await supabase.from("form_documents").insert(rows).select();
    setSaving(false);
    if (error) { setMsg({ ok: false, text: `تعذّر الحفظ: ${error.message}` }); return; }

    setIssued(data[0]);
    setBatch(data);
    setMsg({
      ok: true,
      text: needsReply
        ? `أُرسل ${data[0].serial} للمستفيد — سيصلك إشعار عند وصول ردّه.`
        : picked.requires_approval
        ? `حُفظ ${data.length > 1 ? `${data.length} مستندات` : `برقم ${data[0].serial}`} — بانتظار اعتماد المدير قبل الطباعة.`
        : data.length > 1
          ? `صدرت ${data.length} شهادات — اضغط طباعة لإخراجها دفعة واحدة.`
          : `صدر برقم ${data[0].serial}.`,
    });
  };

  const [decision, setDecision] = useState({});   // قرار الإدارة قبل الإغلاق
  const [report, setReport] = useState(null);    // تقرير نموذج مفتوح للطباعة
  const [rTpl, setRTpl] = useState("");
  const [rFrom, setRFrom] = useState("");
  const [rTo, setRTo] = useState("");

  // اعتماد الرد أو إعادته للمستفيد بملاحظة
  const handleReply = async (d, action, note = null) => {
    const patch =
      action === "approve"
        ? { status: "issued", decision_note: null, data: { ...d.data, ...(decision[d.id] ?? {}) } }
        : { status: "awaiting_reply", decision_note: note };
    const { error } = await supabase.from("form_documents").update(patch).eq("id", d.id);
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    setRejectFor(null); setRejectNote("");
    setMsg({
      ok: true,
      text: action === "approve"
        ? `اعتُمد المستند ${d.serial} وأُغلق. يمكنك طباعته من الأرشيف.`
        : "أُعيد للمستفيد مع الملاحظة.",
    });
    loadDocs();
    if (action === "return") sendToRecipient({ ...d, status: "awaiting_reply" });
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

  // حذف مستند من الأرشيف — للدعم الفني ومدير المدرسة فقط
  const removeDoc = async (d) => {
    if (!window.confirm(`حذف المستند ${d.serial} نهائيًا من الأرشيف؟`)) return;
    const { error } = await supabase.from("form_documents").delete().eq("id", d.id);
    if (error) { setMsg({ ok: false, text: `تعذّر الحذف: ${error.message}` }); return; }
    setMsg({ ok: true, text: `حُذف المستند ${d.serial}.` });
    loadDocs(); loadReturned();
  };

  // إرسال المستند للمستفيد: إشعار داخل البوابة (جرس) وإشعار على الجوال
  const sendToRecipient = async (d) => {
    if (!d.recipient_user_id) {
      setMsg({ ok: false, text: "هذا المستند غير مرتبط بحساب مستفيد." });
      return;
    }
    if (!["issued", "approved", "awaiting_reply"].includes(d.status)) {
      setMsg({ ok: false, text: "لا يُرسل المستند قبل اعتماده." });
      return;
    }

    // المستفيد، ومعه أولياء أمره إن كان طالبًا
    const ids = new Set([d.recipient_user_id]);
    if (d.student_id) {
      const { data: gs } = await supabase
        .from("guardian_student")
        .select("guardians(user_id)")
        .eq("student_id", d.student_id);
      (gs ?? []).forEach((g) => { if (g.guardians?.user_id) ids.add(g.guardians.user_id); });
    }

    const { data: nid, error } = await supabase.rpc("send_notification", {
      p_title: d.title,
      p_body: d.status === "awaiting_reply"
        ? `وصلك ${d.title} برقم ${d.serial} ويحتاج ردّك. افتحه من البوابة واكتب إفادتك ثم أرسلها.`
        : `صدر لك ${d.title}${d.recipient ? ` باسم ${d.recipient}` : ""} برقم ${d.serial}. يمكنك عرضه وطباعته من البوابة.`,
      p_kind: "general",
      p_link: `/doc/${d.id}`,
      p_roles: null,
      p_user_ids: Array.from(ids),
      p_grade: null,
      p_class_no: null,
      p_is_auto: false,
    });

    if (error) { setMsg({ ok: false, text: `تعذّر الإرسال: ${error.message}` }); return; }
    if (!nid)  { setMsg({ ok: false, text: "لا يوجد مستلمون مطابقون." }); return; }

    // إشعار الجوال
    try {
      await fetch("/.netlify/functions/push-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notification_id: nid }),
      });
    } catch { /* الإشعار داخل البوابة وصل على كل حال */ }

    await supabase.from("form_documents")
      .update({ sent_at: new Date().toISOString() }).eq("id", d.id);

    setMsg({ ok: true, text: `أُرسل إشعار المستند ${d.serial} للمستفيد.` });
    loadDocs();
  };

  // تقرير نموذج: مستنداته في المدى المحدّد مع أسماء مُصدِريها
  const buildReport = async () => {
    const tpl = templates.find((t) => t.id === rTpl);
    if (!tpl) { setMsg({ ok: false, text: "اختر النموذج أولًا." }); return; }

    let q = supabase.from("form_documents")
      .select("id, serial, recipient, status, created_at, created_by")
      .eq("template_id", tpl.id)
      .order("created_at", { ascending: true });
    if (rFrom) q = q.gte("created_at", `${rFrom}T00:00:00`);
    if (rTo)   q = q.lte("created_at", `${rTo}T23:59:59`);

    const { data, error } = await q;
    if (error) { setMsg({ ok: false, text: error.message }); return; }
    if (!data?.length) { setMsg({ ok: false, text: "لا مستندات في هذا النطاق." }); return; }

    const ids = [...new Set(data.map((d) => d.created_by).filter(Boolean))];
    const { data: us } = await supabase.from("users")
      .select("id, full_name, username").in("id", ids);
    const nameBy = Object.fromEntries((us ?? []).map((u) => [u.id, u.full_name ?? u.username]));

    // نموذج التكليف: يهمّ المدير من استلم ومن وقّع
    const isAssignment = tpl.key === "frm_duty_assignment";
    let ackBy = {};
    if (isAssignment) {
      const { data: acks } = await supabase.from("form_documents")
        .select("id, sent_at, reply_at, reply_signature_path, status")
        .in("id", data.map((d) => d.id));
      ackBy = Object.fromEntries((acks ?? []).map((a) => [a.id, a]));
    }

    setReport({
      title: tpl.title,
      dept: DEPT_LABEL[tpl.department ?? "school_admin"],
      ack: isAssignment,
      rows: data.map((d) => ({
        ...d,
        issuer_name: nameBy[d.created_by] ?? "—",
        ...(isAssignment ? {
          sent_at: ackBy[d.id]?.sent_at ?? null,
          reply_at: ackBy[d.id]?.reply_at ?? null,
          signed: Boolean(ackBy[d.id]?.reply_signature_path),
        } : {}),
      })),
      from: rFrom ? `${rFrom}T00:00:00` : null,
      to: rTo ? `${rTo}T00:00:00` : null,
    });
    setMsg(null);
  };

  const openDoc = async (d) => {
    setViewing({
      doc: { ...d, signature_source: d.form_templates?.signature_source },
      template: { ...d.form_templates, fields: d.form_templates?.fields ?? [] },
      sig: await signedUrl(d.signature_path),
      replySig: await signedUrl(d.reply_signature_path),
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
        <div className="no-print">
          <SheetPreview landscape={viewing.template.orientation === "landscape"}>
            <FormSheet template={viewing.template} values={d.data} doc={d}
                       sigUrl={printable ? viewing.sig : null}
                       stampUrl={printable ? viewing.stamp : null}
                       principalSigUrl={printable ? viewing.principal : null}
                       principalName={assets.principal_name}
                       replySigUrl={printable ? viewing.replySig : null}
                       replySigName={d.reply_signature_name} />
          </SheetPreview>
        </div>

        {printable && (
          <div className="hidden print:block">
            <PrintArea landscape={viewing.template.orientation === "landscape"}>
              <FormSheet template={viewing.template} values={d.data} doc={d}
                         sigUrl={viewing.sig} stampUrl={viewing.stamp}
                         principalSigUrl={viewing.principal}
                         principalName={assets.principal_name}
                         replySigUrl={viewing.replySig}
                         replySigName={d.reply_signature_name} />
            </PrintArea>
          </div>
        )}
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

        {/* منطقة الطباعة: مخفية على الشاشة، تظهر عند الطباعة فقط */}
        {batch.length > 0 && batch[0].status !== "pending" && (
          <div className="hidden print:block">
            <PrintArea landscape={picked.orientation === "landscape"}>
              {batch.map((b) => (
                <FormSheet key={b.id} template={picked} values={b.data} doc={b}
                           sigUrl={urls.sig}
                           stampUrl={picked.show_stamp ? urls.stamp : null}
                           principalSigUrl={urls.principal}
                           principalName={assets.principal_name} />
              ))}
            </PrintArea>
          </div>
        )}

        {editing?.decision_note && (
          <div className="no-print rounded-card border border-absent/30 bg-absent/5 px-4 py-3">
            <p className="text-sm font-semibold text-absent">أعاد المدير هذا النموذج للتعديل</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink">
              {editing.decision_note}
            </p>
            <p className="num mt-1 text-xs text-faint">رقم المستند: {editing.serial}</p>
          </div>
        )}

        <div className="no-print grid min-w-0 gap-4 lg:grid-cols-[320px,minmax(0,1fr)]">
          <section className="card min-w-0 space-y-3 p-4">
            {(picked.presets ?? []).length > 0 && (
              <div>
                <p className="text-xs text-muted">صيغ جاهزة — اضغط إحداها لتعبئة السبب</p>
                <div className="mt-1.5 space-y-1.5">
                  {picked.presets.map((t, i) => {
                    const field = picked.preset_field || "reason";
                    const on = values[field] === t;
                    return (
                      <button key={i} type="button"
                        onClick={() => setValues((v) => ({ ...v, [field]: t }))}
                        className={`w-full rounded-sm2 border px-3 py-2 text-right text-xs leading-relaxed transition-colors ${
                          on ? "border-mint-deep bg-mint-tint text-mint-deep"
                             : "border-line text-muted hover:bg-canvas"}`}>
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {(picked.fields ?? []).filter((f) => !f.by_recipient && !f.after_reply && !f.auto).map((f) => (
              <div key={f.name}>
                <label className="text-xs text-muted">
                  {f.label}{f.required && <span className="text-absent"> *</span>}
                </label>

                {f.type === "theme" ? (
                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    {CERT_THEMES.map((t) => {
                      const on = (values.theme || "classic") === t.key;
                      return (
                        <button key={t.key} type="button"
                          onClick={() => setValues((v) => ({ ...v, theme: t.key }))}
                          className={`rounded-sm2 border p-2 text-right transition-colors ${
                            on ? "border-mint-deep bg-mint-tint" : "border-line hover:bg-canvas"}`}>
                          <span className="flex items-center gap-2">
                            <span className="h-6 w-8 shrink-0 rounded-[3px] border-[1.5px]"
                                  style={{ borderColor: t.accent }}>
                              <span className="mx-auto mt-[7px] block h-[3px] w-4 rounded"
                                    style={{ background: t.accent, opacity: .5 }} />
                            </span>
                            <span className={`text-xs font-semibold ${on ? "text-mint-deep" : "text-ink"}`}>
                              {t.label}
                            </span>
                          </span>
                          <span className="mt-1 block text-[10.5px] leading-tight text-faint">{t.hint}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : f.type === "duty_schedule" ? (
                  <p className="mt-1 rounded-sm2 bg-mint-tint px-3 py-2 text-xs leading-relaxed text-mint-deep">
                    يُدرج جدول الموظف في المناوبة والإشراف تلقائيًا بعد اختيار اسمه.
                    {values[f.name]?.duty && (
                      <> — <span className="num">{values[f.name].duty.length}</span> يوم مناوبة
                      و<span className="num">{values[f.name].supervision?.length ?? 0}</span> يوم إشراف.</>
                    )}
                  </p>
                ) : f.type === "table" ? (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted">عدد الصفوف الفارغة</span>
                    <input className="field num w-20" inputMode="numeric"
                           value={values[f.name]?.rows ?? f.rows ?? 10}
                           onChange={(e) => {
                             const n = Math.min(40, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1));
                             setValues((v) => ({ ...v, [f.name]: { ...(v[f.name] ?? {}), rows: n } }));
                           }} />
                    <span className="text-[11px] text-faint">تُطبع فارغة لتُملأ بخط اليد</span>
                  </div>
                ) : f.type === "staff" ? (
                  <div className="mt-1 space-y-2">
                    <input className="field w-full" value={staffQ} placeholder="ابحث بالاسم…"
                           onChange={(e) => setStaffQ(e.target.value)} />
                    <div className="max-h-56 overflow-y-auto rounded-sm2 border border-line">
                      {staff
                        .filter((m) => !staffQ.trim() || m.full_name.includes(staffQ.trim()))
                        .map((m) => {
                          const on = chosen.some((x) => x.id === m.id);
                          return (
                            <button key={m.id} type="button" onClick={() => toggleStaff(m)}
                              className={`flex w-full items-center gap-2 border-b border-line px-3 py-2 text-right text-sm last:border-b-0 ${
                                on ? "bg-mint-tint text-mint-deep" : "text-ink hover:bg-canvas"}`}>
                              <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border text-[10px] ${
                                on ? "border-mint-deep bg-mint-deep text-white" : "border-line"}`}>
                                {on ? "✓" : ""}
                              </span>
                              <span className="min-w-0 flex-1 truncate">{m.full_name}</span>
                              <span className="shrink-0 text-[11px] text-faint">{m.job}</span>
                            </button>
                          );
                        })}
                      {staff.length === 0 && (
                        <p className="px-3 py-3 text-xs text-muted">جارٍ تحميل الموظفين…</p>
                      )}
                    </div>
                    {chosen.length > 1 && (
                      <p className="text-xs text-mint-deep">
                        اخترت <span className="num">{chosen.length}</span> — ستصدر شهادة لكل واحد
                        بمسمّاه الوظيفي، وتُطبع دفعة واحدة.
                      </p>
                    )}
                  </div>
                ) : f.type === "student" ? (
                  <div className="mt-1 space-y-2">
                    <select className="field w-full" value={classId} onChange={(e) => setClassId(e.target.value)}>
                      <option value="">اختر الفصل…</option>
                      {classes.map((c) => (
                        <option key={c.id} value={c.id}>فصل {c.class_no}</option>
                      ))}
                    </select>

                    {classId && (
                      <div className="max-h-56 overflow-y-auto rounded-sm2 border border-line">
                        {students.map((st) => {
                          const on = chosen.some((x) => x.id === st.id);
                          return (
                            <button key={st.id} type="button" onClick={() => toggleStudent(st)}
                              className={`flex w-full items-center gap-2 border-b border-line px-3 py-2 text-right text-sm last:border-b-0 ${
                                on ? "bg-mint-tint text-mint-deep" : "text-ink hover:bg-canvas"}`}>
                              <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border text-[10px] ${
                                on ? "border-mint-deep bg-mint-deep text-white" : "border-line"}`}>
                                {on ? "✓" : ""}
                              </span>
                              <span className="truncate">{st.full_name}</span>
                            </button>
                          );
                        })}
                        {students.length === 0 && (
                          <p className="px-3 py-3 text-xs text-muted">لا طلاب في هذا الفصل.</p>
                        )}
                      </div>
                    )}

                    {chosen.length > 0 && (
                      <p className="text-xs text-mint-deep">
                        اخترت <span className="num">{chosen.length}</span> طالبًا — ستصدر شهادة لكل واحد،
                        وتُطبع كلها دفعة واحدة.
                      </p>
                    )}
                  </div>
                ) : f.type === "date" || f.type === "daterange" ? (
                  <div className="mt-1">
                    <DateField range={f.type === "daterange"}
                               value={values[f.name] ?? ""}
                               onChange={(val) => setValues((v) => {
                                 const next = { ...v, [f.name]: val };
                                 // أي حقل يطلب عدد الأيام يُحسب من المدى تلقائيًا
                                 if (f.type === "daterange") {
                                   const n = rangeDays(val);
                                   (picked.fields ?? []).forEach((g) => {
                                     if (/عدد (الأيام|أيام)|المدة المحسومة/.test(g.label ?? "")) {
                                       next[g.name] = n ? String(n) : "";
                                     }
                                   });
                                 }
                                 return next;
                               })} />
                  </div>
                ) : f.type === "time" || f.type === "timerange" ? (
                  <div className="mt-1">
                    <TimeField range={f.type === "timerange"}
                               value={values[f.name] ?? ""}
                               onChange={(val) => setValues((v) => ({ ...v, [f.name]: val }))} />
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

            {needsReply && (
              <p className="rounded-sm2 bg-mint-tint px-3 py-2 text-xs leading-relaxed text-mint-deep">
                هذا النموذج فيه حقول يملؤها المستفيد بنفسه. بعد الإصدار أرسله له من الأرشيف،
                ثم يعود إليك لاعتماده بعد ردّه.
              </p>
            )}

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

            {issued && issued.status === "issued" && picked.orientation === "landscape" && (
              <p className="rounded-sm2 bg-mint-tint px-3 py-2 text-xs leading-relaxed text-mint-deep">
                في نافذة الطباعة: اجعل الاتجاه <b>أفقيًا</b> والهوامش <b>بلا هوامش</b>،
                وفعّل <b>طباعة الخلفيات</b> ليظهر الشعاران بلونيهما.
              </p>
            )}

            {issued && issued.status === "issued" && (
              <button className="w-full rounded-sm2 border border-line py-2 text-sm text-mint-deep hover:bg-canvas"
                      onClick={printNow}>
                {batch.length > 1 ? `طباعة ${batch.length} شهادات` : "طباعة"}
              </button>
            )}

            {issued && (
              <button className="w-full rounded-sm2 border border-line py-2 text-sm text-muted hover:bg-canvas"
                      onClick={() => start(picked)}>
                إصدار نموذج جديد
              </button>
            )}

            {msg && (
              <p className={`rounded-sm2 px-3 py-2 text-sm ${msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
                {msg.text}
              </p>
            )}
          </section>

          <section className="min-w-0 overflow-hidden">
            <p className="mb-1.5 text-xs text-muted">
              معاينة {batch.length > 1 ? `الشهادة الأولى من ${batch.length}` : "مصغّرة"} — الطباعة بالمقاس الأصلي
            </p>
            <SheetPreview landscape={picked.orientation === "landscape"}>
              <FormSheet
                template={picked} values={values} doc={d}
                sigUrl={showSign ? urls.sig : null}
                stampUrl={showSign && picked.show_stamp ? urls.stamp : null}
                principalSigUrl={showSign ? urls.principal : null}
                principalName={assets.principal_name}
              />
            </SheetPreview>
          </section>
        </div>
      </div>
    );
  }

  /* ---------------- القوائم ---------------- */
  const pending = docs.filter((d) => d.status === "pending");
  const replies = docs.filter(
    (d) => (d.status === "replied" || d.status === "awaiting_reply") && d.created_by === session.user.id,
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">النماذج والشهادات</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          اختر نموذجًا لتعبئته وطباعته. كل ما يصدر يُحفظ في الأرشيف برقم تسلسلي.
        </p>
      </div>

      {replies.filter((d) => d.status === "replied").length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-[#CCF2DB] bg-mint-tint px-4 py-3">
          <p className="text-sm text-mint-deep">
            <span className="font-semibold">
              وصلك <span className="num">{replies.filter((d) => d.status === "replied").length}</span> ردًّا
            </span>
            {" "}— راجعه لاعتماده أو إعادته بملاحظة.
          </p>
          <button onClick={() => setTab("replies")}
                  className="shrink-0 rounded-pill bg-mint-deep px-4 py-1.5 text-xs font-semibold text-white">
            عرضها
          </button>
        </div>
      )}

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
          ...(replies.length ? [["replies", `ردود المستفيدين (${replies.filter((d) => d.status === "replied").length})`]] : []),
          ["archive", "الأرشيف"],
          ["report", "التقارير"],
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
          <>
          {/* أقسام المدرسة — تظهر الأقسام التي لها نماذج متاحة لهذا الحساب */}
          {(() => {
            const used = DEPARTMENTS.filter((dp) =>
              templates.some((t) => (t.department ?? "school_admin") === dp.key));
            if (used.length < 2) return null;
            return (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {[{ key: "all", label: "الكل" }, ...used].map((dp) => (
                  <button key={dp.key} onClick={() => setDept(dp.key)}
                    className={`rounded-pill px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      dept === dp.key ? "bg-mint-tint text-mint-deep"
                                      : "border border-line bg-white text-muted hover:bg-canvas"}`}>
                    {dp.label}
                  </button>
                ))}
              </div>
            );
          })()}

          <div className="grid gap-3 sm:grid-cols-2">
            {templates
              .filter((t) => dept === "all" || (t.department ?? "school_admin") === dept)
              .map((t) => (
              <button key={t.id} onClick={() => start(t)}
                      className="card p-4 text-right transition-colors hover:border-[#CCF2DB] hover:bg-mint-tint/40">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-ink">{t.title}</p>
                  <span className="chip bg-mint-tint text-mint-deep">{CAT_LABEL[t.category]}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-faint">
                  {DEPT_LABEL[t.department ?? "school_admin"]}
                </p>
                <p className="mt-1 text-sm text-muted">{t.description}</p>
                {t.requires_approval && (
                  <p className="mt-2 text-xs text-warning">يحتاج اعتماد المدير قبل الطباعة</p>
                )}
              </button>
            ))}
          </div>
          </>
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

      {tab === "replies" && (
        <div className="space-y-3">
          {msg && (
            <p className={`rounded-sm2 px-3 py-2 text-sm ${
              msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
              {msg.text}
            </p>
          )}
          {replies.length === 0 && (
            <p className="card px-4 py-6 text-sm text-muted">لا نماذج بانتظار رد.</p>
          )}
          {replies.map((d) => (
            <div key={d.id} className="card space-y-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-ink">{d.title}</p>
                  <p className="num mt-0.5 text-xs text-faint">
                    {d.serial}{d.recipient ? ` · ${d.recipient}` : ""}
                  </p>
                </div>
                <span className={`chip shrink-0 ${STATUS_CHIP[d.status].c}`}>{STATUS_CHIP[d.status].t}</span>
              </div>

              {/* ما كتبه المستفيد */}
              {(d.form_templates?.fields ?? []).filter((f) => f.by_recipient).map((f) => (
                <div key={f.name} className="rounded-sm2 bg-canvas px-3 py-2">
                  <p className="text-[11px] text-faint">{f.label}</p>
                  <p className="whitespace-pre-line text-sm text-ink">
                    {d.data?.[f.name] || "— لم يردّ بعد —"}
                  </p>
                </div>
              ))}

              {rejectFor?.id === d.id ? (
                <div className="space-y-2 rounded-sm2 border border-absent/30 p-3">
                  <textarea rows={2} className="field w-full" value={rejectNote}
                            placeholder="اكتب ملاحظتك للمستفيد — سيقرأها كما هي."
                            onChange={(e) => setRejectNote(e.target.value)} />
                  <div className="flex gap-2">
                    <button className="btn-primary px-4 py-1.5 text-xs" disabled={!rejectNote.trim()}
                            onClick={() => handleReply(d, "return", rejectNote.trim())}>
                      إعادة للمستفيد
                    </button>
                    <button onClick={() => setRejectFor(null)}
                            className="rounded-pill border border-line px-4 py-1.5 text-xs text-muted hover:bg-canvas">
                      إلغاء
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                {/* قرار الإدارة وإغلاق المساءلة — يظهر بعد وصول الرد */}
                {d.status === "replied" &&
                 (d.form_templates?.fields ?? []).filter((f) => f.after_reply).length > 0 && (
                  <div className="space-y-2 rounded-sm2 border border-[#CCF2DB] bg-mint-tint/40 p-3">
                    <p className="text-xs font-semibold text-mint-deep">قرار الإدارة</p>
                    {(d.form_templates?.fields ?? []).filter((f) => f.after_reply).map((f) => (
                      <div key={f.name}>
                        <label className="text-[11px] text-muted">{f.label}</label>
                        {f.type === "textarea" ? (
                          <textarea rows={3} className="field mt-1 w-full"
                                    value={decision[d.id]?.[f.name] ?? d.data?.[f.name] ?? ""}
                                    onChange={(e) => setDecision((x) => ({
                                      ...x, [d.id]: { ...(x[d.id] ?? {}), [f.name]: e.target.value } }))} />
                        ) : (
                          <input className="field mt-1 w-full"
                                 value={decision[d.id]?.[f.name] ?? d.data?.[f.name] ?? ""}
                                 onChange={(e) => setDecision((x) => ({
                                   ...x, [d.id]: { ...(x[d.id] ?? {}), [f.name]: e.target.value } }))} />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button onClick={() => openDoc(d)}
                          className="rounded-pill border border-line px-3 py-1.5 text-xs text-muted hover:bg-canvas">
                    معاينة
                  </button>
                  <button onClick={() => { setRejectFor(d); setRejectNote(""); }}
                          className="rounded-pill border border-warning/40 px-3 py-1.5 text-xs text-warning hover:bg-warning/5">
                    ملاحظة وإعادة
                  </button>
                  <button onClick={() => removeDoc(d)}
                          className="rounded-pill border border-absent/40 px-3 py-1.5 text-xs text-absent hover:bg-absent/5">
                    حذف
                  </button>
                  {d.status === "replied" && (
                    <button onClick={() => handleReply(d, "approve")} className="btn-primary px-4 py-1.5 text-xs">
                      اعتماد وإغلاق المساءلة
                    </button>
                  )}
                  {d.status === "awaiting_reply" && (
                    <button onClick={() => sendToRecipient(d)}
                            className="rounded-pill border border-mint-deep px-3 py-1.5 text-xs text-mint-deep hover:bg-mint-tint">
                      تذكير المستفيد
                    </button>
                  )}
                </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "report" && (
        <div className="space-y-3">
          <section className="card space-y-3 p-4">
            <div>
              <p className="text-sm font-semibold text-ink">تقرير نموذج</p>
              <p className="mt-0.5 text-xs text-muted">
                اختر النموذج والمدى الزمني، فيُبنى تقرير بغلاف رسمي وجدول جاهز للطباعة أو الحفظ PDF.
              </p>
            </div>

            <div>
              <label className="text-xs text-muted">النموذج</label>
              <select className="field mt-1 w-full" value={rTpl} onChange={(e) => setRTpl(e.target.value)}>
                <option value="">اختر النموذج…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs text-muted">من تاريخ (اختياري)</label>
                <input type="date" className="field num mt-1 w-full" value={rFrom}
                       onChange={(e) => setRFrom(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted">إلى تاريخ (اختياري)</label>
                <input type="date" className="field num mt-1 w-full" value={rTo}
                       onChange={(e) => setRTo(e.target.value)} />
              </div>
            </div>

            <button className="btn-primary w-full" onClick={buildReport}>بناء التقرير</button>

            {msg && (
              <p className={`rounded-sm2 px-3 py-2 text-sm ${
                msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
                {msg.text}
              </p>
            )}
          </section>

          {report && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted">
                  <span className="num font-semibold text-ink">{report.rows.length}</span> مستندًا
                </p>
                <div className="flex gap-2">
                  <button onClick={() => setReport(null)}
                          className="rounded-pill border border-line px-4 py-1.5 text-sm text-muted hover:bg-canvas">
                    إغلاق
                  </button>
                  <button className="btn-primary" onClick={printNow}>طباعة / حفظ PDF</button>
                </div>
              </div>

              <SheetPreview landscape={false}>
                <FormReport {...report} issuedBy={profile?.full_name ?? profile?.username ?? ""} />
              </SheetPreview>

              <div className="hidden print:block">
                <ReportPrintArea>
                  <FormReport {...report} issuedBy={profile?.full_name ?? profile?.username ?? ""} />
                </ReportPrintArea>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "archive" && (
        <>
          {msg && (
            <p className={`mb-3 rounded-sm2 px-3 py-2 text-sm ${
              msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
              {msg.text}
            </p>
          )}
          <div className="card divide-y divide-line overflow-hidden">
            {docs.length === 0 && <p className="px-4 py-6 text-sm text-muted">لا مستندات بعد.</p>}
            {docs.map((d) => (
              <div key={d.id} className="flex items-center gap-2 px-2 py-1 hover:bg-canvas">
                <button onClick={() => openDoc(d)}
                        className="flex min-w-0 flex-1 items-center justify-between gap-3 px-2 py-2 text-right">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{d.title}</p>
                    <p className="num mt-0.5 text-xs text-faint">
                      {d.serial}{d.recipient ? ` · ${d.recipient}` : ""}
                    </p>
                  </div>
                  <span className={`chip shrink-0 ${STATUS_CHIP[d.status].c}`}>{STATUS_CHIP[d.status].t}</span>
                </button>
                {d.recipient_user_id && ["issued", "approved", "awaiting_reply"].includes(d.status) && (
                  <button onClick={() => sendToRecipient(d)}
                          title={d.sent_at ? "أُرسل سابقًا — يمكن إعادة الإرسال" : "إرسال إشعار للمستفيد"}
                          className={`shrink-0 rounded-pill border px-2.5 py-1 text-xs ${
                            d.sent_at
                              ? "border-line text-muted hover:bg-canvas"
                              : "border-mint-deep text-mint-deep hover:bg-mint-tint"}`}>
                    {d.sent_at ? "أُرسل" : "إرسال للمستفيد"}
                  </button>
                )}
                {isManager && (
                  <button onClick={() => removeDoc(d)} title="حذف من الأرشيف"
                          className="shrink-0 rounded-pill border border-absent/40 px-2.5 py-1 text-xs text-absent hover:bg-absent/5">
                    حذف
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
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
