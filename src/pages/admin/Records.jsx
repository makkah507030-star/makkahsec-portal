import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { cleanIdentity, cleanMobile, cleanText, guessIdentityType } from "../../lib/importer";
import { ADMIN_ROLE_LABEL } from "../../lib/session.jsx";

const TRACK_LABEL = { common_year: "السنة المشتركة", general_track: "المسار العام" };
const trackName = (t) => TRACK_LABEL[t] ?? t ?? "";

const TABS = [
  { key: "students", label: "الطلاب" },
  { key: "teachers", label: "المعلمون" },
  { key: "guardians", label: "أولياء الأمور" },
  { key: "admins", label: "حسابات الإدارة" },
];

export default function Records() {
  const [tab, setTab] = useState("students");
  const [year, setYear] = useState(null);
  const [yearLabel, setYearLabel] = useState(null);

  useEffect(() => {
    supabase
      .from("settings")
      .select("key, value")
      .in("key", ["active_year", "active_year_label"])
      .then(({ data }) => {
        const m = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));
        setYear(m.active_year ?? null);
        setYearLabel(m.active_year_label ?? m.active_year ?? null);
      });
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold">إدارة السجلات</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          إضافة وتعديل بيانات الطلاب والمعلمين وأولياء الأمور يدويًا دون الرجوع لملفات
          الاستيراد. أي تعديل هنا ينعكس فورًا في كل شاشات البوابة المرتبطة.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={
              tab === t.key
                ? "rounded-pill bg-mint-deep px-4 py-1.5 text-sm font-semibold text-white"
                : "rounded-pill border border-line bg-paper px-4 py-1.5 text-sm font-medium text-muted hover:bg-canvas"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "students" && <StudentsTab year={year} yearLabel={yearLabel} />}
      {tab === "teachers" && <TeachersTab />}
      {tab === "guardians" && <GuardiansTab />}
      {tab === "admins" && <AdminAccountsTab />}
    </div>
  );
}

/* ============================================================= */
/* أدوات مشتركة                                                   */
/* ============================================================= */

function Banner({ err, msg }) {
  if (!err && !msg) return null;
  return (
    <div
      className={`rounded-sm2 px-3 py-2 text-sm ${
        err ? "bg-absent/10 text-absent" : "bg-present/10 text-present"
      }`}
    >
      {err || msg}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs text-muted">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/* ============================================================= */
/* تبويب الطلاب                                                   */
/* ============================================================= */

function StudentsTab({ year, yearLabel }) {
  const [rows, setRows] = useState(null);
  const [classes, setClasses] = useState([]);
  const [enrollMap, setEnrollMap] = useState(new Map()); // student_id -> class_id
  const [guardianMap, setGuardianMap] = useState(new Map()); // student_id -> {id, full_name, mobile}
  const [q, setQ] = useState("");
  const [gradeSel, setGradeSel] = useState(0); // 0 | 1 | 2 | 3 | "unassigned"
  const [clsSel, setClsSel] = useState(0); // 0 | class id
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    const { data: s } = await supabase
      .from("students")
      .select("id, national_id, full_name, identity_type, user_id")
      .order("full_name");
    setRows(s ?? []);

    if (year) {
      const { data: cls } = await supabase
        .from("classes")
        .select("id, class_no, grade, track")
        .eq("academic_year", year)
        .order("class_no");
      setClasses(cls ?? []);

      const { data: en } = await supabase
        .from("student_enrollment")
        .select("student_id, class_id")
        .eq("academic_year", year);
      setEnrollMap(new Map((en ?? []).map((r) => [r.student_id, r.class_id])));
    } else {
      setClasses([]);
      setEnrollMap(new Map());
    }

    const { data: gs } = await supabase
      .from("guardian_student")
      .select("student_id, guardians(id, full_name, mobile)");
    const m = new Map();
    (gs ?? []).forEach((r) => {
      const gg = Array.isArray(r.guardians) ? r.guardians[0] : r.guardians;
      if (gg && (gg.full_name || gg.mobile)) m.set(r.student_id, gg);
    });
    setGuardianMap(m);
  };

  useEffect(() => {
    load();
  }, [year]);

  const classesById = useMemo(() => new Map(classes.map((c) => [c.id, c])), [classes]);

  // نتصفح بالبطاقات (صف ثم فصل) ما لم يكن فيه بحث نصي فعّال — بنفس أسلوب صفحة الطلاب
  const searching = q.trim().length > 0;
  const browsingGrades = !searching && !gradeSel;
  const browsingClasses = !searching && gradeSel && gradeSel !== "unassigned" && !clsSel;
  const showList = searching || clsSel || gradeSel === "unassigned";

  const gradesList = useMemo(
    () => [...new Set(classes.map((c) => c.grade))].sort((a, b) => a - b),
    [classes]
  );
  const classesForGrade = useMemo(
    () => classes.filter((c) => c.grade === gradeSel),
    [classes, gradeSel]
  );
  const countByGrade = useMemo(() => {
    const m = new Map();
    (rows ?? []).forEach((r) => {
      const c = classesById.get(enrollMap.get(r.id));
      if (c) m.set(c.grade, (m.get(c.grade) ?? 0) + 1);
    });
    return m;
  }, [rows, enrollMap, classesById]);
  const countByClass = useMemo(() => {
    const m = new Map();
    (rows ?? []).forEach((r) => {
      const cid = enrollMap.get(r.id);
      if (cid) m.set(cid, (m.get(cid) ?? 0) + 1);
    });
    return m;
  }, [rows, enrollMap]);
  const unassignedCount = useMemo(
    () => (rows ?? []).filter((r) => !enrollMap.has(r.id)).length,
    [rows, enrollMap]
  );

  const filtered = useMemo(() => {
    const term = q.trim();
    if (term) {
      return (rows ?? []).filter(
        (r) => r.full_name?.includes(term) || r.national_id?.includes(term)
      );
    }
    if (gradeSel === "unassigned") return (rows ?? []).filter((r) => !enrollMap.has(r.id));
    if (clsSel) return (rows ?? []).filter((r) => enrollMap.get(r.id) === clsSel);
    return [];
  }, [rows, q, gradeSel, clsSel, enrollMap]);

  const unlinkGuardian = async (studentId) => {
    if (!confirm("إزالة ربط ولي الأمر عن هذا الطالب؟")) return;
    await supabase.from("guardian_student").delete().eq("student_id", studentId);
    await load();
  };

  const saveStudent = async (form, existing) => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const national_id = cleanIdentity(form.national_id);
      const full_name = cleanText(form.full_name);
      if (!national_id) throw new Error("رقم الهوية مطلوب");
      if (!full_name) throw new Error("اسم الطالب مطلوب");

      let studentId = existing?.id;
      if (existing) {
        const { error } = await supabase
          .from("students")
          .update({ national_id, full_name })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("students")
          .insert({ national_id, full_name, identity_type: guessIdentityType(national_id) })
          .select("id")
          .single();
        if (error) throw error;
        studentId = data.id;
      }

      // مزامنة الاسم في حساب الدخول إن وُجد (لا نُغيّر اسم المستخدم/رقم الهوية هناك)
      if (existing?.user_id) {
        await supabase.from("users").update({ full_name }).eq("id", existing.user_id);
      }

      if (form.classId) {
        if (!year) throw new Error("لم تُضبط السنة الدراسية النشطة في الإعدادات");
        const { error } = await supabase
          .from("student_enrollment")
          .upsert(
            { student_id: studentId, class_id: form.classId, academic_year: year, status: "active" },
            { onConflict: "student_id,academic_year" }
          );
        if (error) throw error;
      }

      let guardianId = null;
      if (form.newGuardianName || form.newGuardianMobile) {
        const mobile = cleanMobile(form.newGuardianMobile);
        if (!mobile) throw new Error("رقم جوال ولي الأمر الجديد غير صالح");
        const { data: gRow, error: gErr } = await supabase
          .from("guardians")
          .upsert({ full_name: cleanText(form.newGuardianName) || null, mobile }, { onConflict: "mobile" })
          .select("id")
          .single();
        if (gErr) throw gErr;
        guardianId = gRow.id;
      }
      if (guardianId) {
        const { error } = await supabase
          .from("guardian_student")
          .upsert({ guardian_id: guardianId, student_id: studentId }, { onConflict: "guardian_id,student_id" });
        if (error) throw error;
      }

      setMsg(existing ? "تم حفظ تعديلات الطالب." : "تمت إضافة الطالب.");
      setAdding(false);
      setEditingId(null);
      await load();
    } catch (e) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!rows) return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-4">
      {!year && (
        <div className="card border-late/30 bg-late/5 px-4 py-3 text-sm text-late">
          لم تُضبط السنة الدراسية النشطة في الإعدادات — يمكنك إضافة الطالب وبياناته، لكن
          لن يمكن تعيين فصله حتى تُضبط السنة من صفحة «التوقيت الزمني».
        </div>
      )}
      {yearLabel && (
        <p className="text-xs text-muted">
          السنة الدراسية الحالية: <span className="num font-semibold text-mint-deep">{yearLabel}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          className="field flex-1"
          placeholder="بحث بالاسم أو رقم الهوية"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          className="btn-primary shrink-0"
          onClick={() => {
            setAdding((v) => !v);
            setEditingId(null);
            setErr("");
            setMsg("");
          }}
        >
          {adding ? "إلغاء" : "+ إضافة طالب"}
        </button>
      </div>

      <Banner err={err} msg={msg} />

      {adding && (
        <StudentForm
          classes={classes}
          busy={busy}
          onCancel={() => setAdding(false)}
          onSave={(form) => saveStudent(form)}
        />
      )}

      {/* مسار التصفح: كل الطلاب ‹ الصف ‹ الفصل */}
      {!browsingGrades && (
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
          <button
            onClick={() => { setGradeSel(0); setClsSel(0); }}
            className="font-medium text-mint-deep hover:underline"
          >
            كل الطلاب
          </button>
          {gradeSel === "unassigned" && (
            <>
              <span>‹</span>
              <span className="font-semibold text-ink">بلا فصل معيّن</span>
            </>
          )}
          {gradeSel && gradeSel !== "unassigned" && (
            <>
              <span>‹</span>
              <button
                onClick={() => setClsSel(0)}
                className={
                  browsingClasses ? "font-semibold text-ink" : "font-medium text-mint-deep hover:underline"
                }
              >
                {GRADE_NAMES[gradeSel]}
              </button>
            </>
          )}
          {clsSel && (
            <>
              <span>‹</span>
              <span className="num font-semibold text-ink">
                فصل {classesById.get(clsSel)?.class_no}
              </span>
            </>
          )}
          {searching && <span className="text-faint">— نتائج بحث في كل الطلاب</span>}
        </nav>
      )}

      {/* الخطوة 1: اختيار الصف */}
      {browsingGrades && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {gradesList.map((g) => (
            <button
              key={g}
              onClick={() => { setGradeSel(g); setClsSel(0); }}
              className="card flex items-center justify-between px-4 py-4 text-right hover:bg-canvas"
            >
              <span className="font-semibold text-ink">{GRADE_NAMES[g]}</span>
              <span className="num rounded-pill bg-mint-tint px-2.5 py-1 text-xs font-bold text-mint-deep">
                {countByGrade.get(g) ?? 0}
              </span>
            </button>
          ))}
          {unassignedCount > 0 && (
            <button
              onClick={() => { setGradeSel("unassigned"); setClsSel(0); }}
              className="card flex items-center justify-between border-late/30 bg-late/5 px-4 py-4 text-right hover:bg-late/10"
            >
              <span className="font-semibold text-late">بلا فصل معيّن</span>
              <span className="num rounded-pill bg-late/15 px-2.5 py-1 text-xs font-bold text-late">
                {unassignedCount}
              </span>
            </button>
          )}
        </div>
      )}

      {/* الخطوة 2: اختيار الفصل */}
      {browsingClasses && (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {classesForGrade.map((c) => (
            <button
              key={c.id}
              onClick={() => setClsSel(c.id)}
              className="card flex flex-col items-center gap-1 px-3 py-4 hover:bg-canvas"
            >
              <span className="num text-lg font-bold text-ink">{c.class_no}</span>
              <span className="num text-xs text-muted">{countByClass.get(c.id) ?? 0} طالب</span>
            </button>
          ))}
        </div>
      )}

      {showList && (
      <>
      <p className="text-sm text-muted">
        <span className="num font-semibold text-ink">{filtered.length}</span> من{" "}
        <span className="num">{rows.length}</span>
      </p>

      <div className="card divide-y divide-line overflow-hidden">
        {filtered.slice(0, 200).map((r) => {
          const classId = enrollMap.get(r.id);
          const cls = classId ? classesById.get(classId) : null;
          const g = guardianMap.get(r.id);
          const editing = editingId === r.id;
          return (
            <div key={r.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.full_name}</p>
                  <p className="num mt-0.5 text-right text-xs text-faint">{r.national_id}</p>
                  <p className="mt-1 text-xs text-muted">
                    {cls ? `${GRADE_NAMES[cls.grade] ?? cls.grade} · فصل ${cls.class_no}` : "بلا فصل معيّن"}
                  </p>
                  {g ? (
                    <p className="mt-1 truncate text-xs text-muted">
                      ولي الأمر: {g.full_name} · <span className="num">{g.mobile}</span>{" "}
                      <button
                        onClick={() => unlinkGuardian(r.id)}
                        className="text-absent hover:underline"
                      >
                        إزالة الربط
                      </button>
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-late">بلا ولي أمر مسجّل</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setEditingId(editing ? null : r.id);
                    setAdding(false);
                    setErr("");
                    setMsg("");
                  }}
                  className="shrink-0 text-xs font-medium text-mint-deep hover:underline"
                >
                  {editing ? "إغلاق" : "تعديل"}
                </button>
              </div>

              {editing && (
                <div className="mt-3">
                  <StudentForm
                    classes={classes}
                    existing={r}
                    initialClassId={classId ?? ""}
                    initialGuardian={g}
                    busy={busy}
                    onCancel={() => setEditingId(null)}
                    onSave={(form) => saveStudent(form, r)}
                  />
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted">لا نتائج.</p>
        )}
      </div>
      </>
      )}
    </div>
  );
}

function StudentForm({ classes, existing, initialClassId, initialGuardian, busy, onSave, onCancel }) {
  const [fullName, setFullName] = useState(existing?.full_name ?? "");
  const [nationalId, setNationalId] = useState(existing?.national_id ?? "");
  const [grade, setGrade] = useState(() => {
    const c = classes.find((c) => c.id === initialClassId);
    return c?.grade ?? "";
  });
  const [classId, setClassId] = useState(initialClassId ?? "");
  const [newGuardianName, setNewGuardianName] = useState("");
  const [newGuardianMobile, setNewGuardianMobile] = useState("");

  const classesForGrade = classes.filter((c) => !grade || c.grade === Number(grade));

  const submit = (e) => {
    e.preventDefault();
    onSave({
      full_name: fullName,
      national_id: nationalId,
      classId: classId || null,
      newGuardianName,
      newGuardianMobile,
    });
  };

  return (
    <form onSubmit={submit} className="card space-y-3 border-[#CCF2DB] bg-mint-tint/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الاسم الكامل">
          <input className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </Field>
        <Field label="رقم الهوية">
          <input
            className="field num"
            value={nationalId}
            onChange={(e) => setNationalId(e.target.value)}
            required
          />
        </Field>
        <Field label="الصف">
          <select
            className="field"
            value={grade}
            onChange={(e) => {
              setGrade(e.target.value);
              setClassId("");
            }}
          >
            <option value="">— اختر —</option>
            {[1, 2, 3].map((g) => (
              <option key={g} value={g}>
                {GRADE_NAMES[g]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="الفصل">
          <select className="field" value={classId} onChange={(e) => setClassId(e.target.value)} disabled={!grade}>
            <option value="">— اختر —</option>
            {classesForGrade.map((c) => (
              <option key={c.id} value={c.id}>
                فصل {c.class_no} · {trackName(c.track)}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="border-t border-[#CCF2DB] pt-3">
        <p className="text-xs font-semibold text-mint-deep">ولي الأمر</p>
        {initialGuardian ? (
          <div className="mt-2 rounded-sm2 border border-line bg-paper px-3 py-2.5">
            <p className="text-sm text-ink">
              {initialGuardian.full_name || "بلا اسم"} · <span className="num">{initialGuardian.mobile}</span>
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              مربوط بهذا الطالب — لتغييره، أزل الربط الحالي أولًا من زر «إزالة الربط» في
              القائمة، ثم عدّل الطالب من جديد لإسناد ولي أمر آخر.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <Field label="اسم ولي الأمر الجديد">
                <input className="field" value={newGuardianName} onChange={(e) => setNewGuardianName(e.target.value)} />
              </Field>
              <Field label="جوال ولي الأمر الجديد">
                <input
                  className="field num"
                  value={newGuardianMobile}
                  onChange={(e) => setNewGuardianMobile(e.target.value)}
                />
              </Field>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
              تعبئة الحقلين تُنشئ وليًا جديدًا وتربطه بالطالب مباشرة.
            </p>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "جارٍ الحفظ…" : "حفظ"}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost">
          إلغاء
        </button>
      </div>
    </form>
  );
}

/* ============================================================= */
/* تبويب المعلمين                                                 */
/* ============================================================= */

function TeachersTab() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("teachers")
      .select("id, national_id, full_name, mobile, specialization, user_id")
      .order("full_name");
    setRows(data ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const searching = q.trim().length > 0;
  const filtered = useMemo(() => {
    const term = q.trim();
    if (!term) return [];
    return (rows ?? []).filter(
      (r) => r.full_name?.includes(term) || r.national_id?.includes(term)
    );
  }, [rows, q]);

  const save = async (form, existing) => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const national_id = cleanIdentity(form.national_id);
      const full_name = cleanText(form.full_name);
      if (!national_id) throw new Error("رقم الهوية مطلوب");
      if (!full_name) throw new Error("اسم المعلم مطلوب");
      const mobile = form.mobile ? cleanMobile(form.mobile) : "";
      if (form.mobile && !mobile) throw new Error("رقم الجوال غير صالح");
      const specialization = cleanText(form.specialization) || null;

      if (existing) {
        const { error } = await supabase
          .from("teachers")
          .update({ national_id, full_name, mobile: mobile || null, specialization })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("teachers")
          .insert({ national_id, full_name, mobile: mobile || null, specialization });
        if (error) throw error;
      }

      if (existing?.user_id) {
        await supabase.from("users").update({ full_name }).eq("id", existing.user_id);
      }

      setMsg(existing ? "تم حفظ تعديلات المعلم." : "تمت إضافة المعلم.");
      setAdding(false);
      setEditingId(null);
      await load();
    } catch (e) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!rows) return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="field flex-1"
          placeholder="بحث بالاسم أو رقم الهوية"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          className="btn-primary shrink-0"
          onClick={() => {
            setAdding((v) => !v);
            setEditingId(null);
            setErr("");
            setMsg("");
          }}
        >
          {adding ? "إلغاء" : "+ إضافة معلم"}
        </button>
      </div>

      <Banner err={err} msg={msg} />

      {adding && <TeacherForm busy={busy} onCancel={() => setAdding(false)} onSave={(f) => save(f)} />}

      {!searching ? (
        <p className="card px-4 py-8 text-center text-sm text-muted">
          اكتب اسمًا أو رقم هوية في مربع البحث لعرض المعلمين.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">
            <span className="num font-semibold text-ink">{filtered.length}</span> نتيجة
          </p>

          <div className="card divide-y divide-line overflow-hidden">
            {filtered.slice(0, 200).map((r) => {
              const editing = editingId === r.id;
              return (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.full_name}</p>
                      <p className="num mt-0.5 text-right text-xs text-faint">{r.national_id}</p>
                      <p className="mt-1 text-xs text-muted">
                        {r.mobile ? <span className="num">{r.mobile}</span> : "بلا جوال"}
                        {r.specialization ? ` · ${r.specialization}` : ""}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingId(editing ? null : r.id);
                        setAdding(false);
                        setErr("");
                        setMsg("");
                      }}
                      className="shrink-0 text-xs font-medium text-mint-deep hover:underline"
                    >
                      {editing ? "إغلاق" : "تعديل"}
                    </button>
                  </div>
                  {editing && (
                    <div className="mt-3">
                      <TeacherForm
                        existing={r}
                        busy={busy}
                        onCancel={() => setEditingId(null)}
                        onSave={(f) => save(f, r)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted">لا نتائج.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TeacherForm({ existing, busy, onSave, onCancel }) {
  const [fullName, setFullName] = useState(existing?.full_name ?? "");
  const [nationalId, setNationalId] = useState(existing?.national_id ?? "");
  const [mobile, setMobile] = useState(existing?.mobile ?? "");
  const [specialization, setSpecialization] = useState(existing?.specialization ?? "");

  const submit = (e) => {
    e.preventDefault();
    onSave({ full_name: fullName, national_id: nationalId, mobile, specialization });
  };

  return (
    <form onSubmit={submit} className="card space-y-3 border-[#CCF2DB] bg-mint-tint/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الاسم الكامل">
          <input className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </Field>
        <Field label="رقم الهوية">
          <input className="field num" value={nationalId} onChange={(e) => setNationalId(e.target.value)} required />
        </Field>
        <Field label="رقم الجوال">
          <input className="field num" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </Field>
        <Field label="التخصص">
          <input className="field" value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
        </Field>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "جارٍ الحفظ…" : "حفظ"}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost">
          إلغاء
        </button>
      </div>
    </form>
  );
}

/* ============================================================= */
/* تبويب أولياء الأمور                                            */
/* ============================================================= */

function GuardiansTab() {
  const [rows, setRows] = useState(null);
  const [linkCount, setLinkCount] = useState(new Map());
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    const [{ data }, { data: links }] = await Promise.all([
      supabase.from("guardians").select("id, national_id, full_name, mobile, user_id").order("full_name"),
      supabase.from("guardian_student").select("guardian_id"),
    ]);
    setRows(data ?? []);
    const m = new Map();
    (links ?? []).forEach((r) => m.set(r.guardian_id, (m.get(r.guardian_id) ?? 0) + 1));
    setLinkCount(m);
  };

  useEffect(() => {
    load();
  }, []);

  const searching = q.trim().length > 0;
  const filtered = useMemo(() => {
    const term = q.trim();
    if (!term) return [];
    return (rows ?? []).filter(
      (r) => r.full_name?.includes(term) || r.mobile?.includes(term) || r.national_id?.includes(term)
    );
  }, [rows, q]);

  const save = async (form, existing) => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const full_name = cleanText(form.full_name);
      const mobile = cleanMobile(form.mobile);
      const national_id = form.national_id ? cleanIdentity(form.national_id) : null;
      if (!full_name) throw new Error("اسم ولي الأمر مطلوب");
      if (!mobile) throw new Error("رقم الجوال غير صالح");

      if (existing) {
        const { error } = await supabase
          .from("guardians")
          .update({ full_name, mobile, national_id })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("guardians")
          .upsert({ full_name, mobile, national_id }, { onConflict: "mobile" });
        if (error) throw error;
      }

      if (existing?.user_id) {
        await supabase.from("users").update({ full_name }).eq("id", existing.user_id);
      }

      setMsg(existing ? "تم حفظ تعديلات ولي الأمر." : "تمت إضافة ولي الأمر.");
      setAdding(false);
      setEditingId(null);
      await load();
    } catch (e) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!rows) return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="field flex-1"
          placeholder="بحث بالاسم أو الجوال أو رقم الهوية"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button
          className="btn-primary shrink-0"
          onClick={() => {
            setAdding((v) => !v);
            setEditingId(null);
            setErr("");
            setMsg("");
          }}
        >
          {adding ? "إلغاء" : "+ إضافة ولي أمر"}
        </button>
      </div>

      <Banner err={err} msg={msg} />

      <p className="text-xs leading-relaxed text-muted">
        رقم الجوال هو المعرّف الأساسي لولي الأمر (ويُستخدم اسم مستخدم لحساب دخوله) — لا يمكن أن
        يشترك وليّا أمر في نفس رقم الجوال.
      </p>

      {adding && <GuardianForm busy={busy} onCancel={() => setAdding(false)} onSave={(f) => save(f)} />}

      {!searching ? (
        <p className="card px-4 py-8 text-center text-sm text-muted">
          اكتب اسمًا أو جوالًا أو رقم هوية في مربع البحث لعرض أولياء الأمور.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">
            <span className="num font-semibold text-ink">{filtered.length}</span> نتيجة
          </p>

          <div className="card divide-y divide-line overflow-hidden">
            {filtered.slice(0, 200).map((r) => {
              const editing = editingId === r.id;
              return (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.full_name || "بلا اسم"}</p>
                      <p className="num mt-0.5 text-right text-xs text-faint">{r.mobile}</p>
                      <p className="mt-1 text-xs text-muted">
                        {r.national_id ? <span className="num">{r.national_id}</span> : "بلا رقم هوية"} ·{" "}
                        <span className="num">{linkCount.get(r.id) ?? 0}</span> طالب مرتبط
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingId(editing ? null : r.id);
                        setAdding(false);
                        setErr("");
                        setMsg("");
                      }}
                      className="shrink-0 text-xs font-medium text-mint-deep hover:underline"
                    >
                      {editing ? "إغلاق" : "تعديل"}
                    </button>
                  </div>
                  {editing && (
                    <div className="mt-3">
                      <GuardianForm
                        existing={r}
                        busy={busy}
                        onCancel={() => setEditingId(null)}
                        onSave={(f) => save(f, r)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted">لا نتائج.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function GuardianForm({ existing, busy, onSave, onCancel }) {
  const [fullName, setFullName] = useState(existing?.full_name ?? "");
  const [mobile, setMobile] = useState(existing?.mobile ?? "");
  const [nationalId, setNationalId] = useState(existing?.national_id ?? "");

  const submit = (e) => {
    e.preventDefault();
    onSave({ full_name: fullName, mobile, national_id: nationalId });
  };

  return (
    <form onSubmit={submit} className="card space-y-3 border-[#CCF2DB] bg-mint-tint/40 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الاسم الكامل">
          <input className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </Field>
        <Field label="رقم الجوال">
          <input className="field num" value={mobile} onChange={(e) => setMobile(e.target.value)} required />
        </Field>
        <Field label="رقم الهوية (اختياري)">
          <input className="field num" value={nationalId} onChange={(e) => setNationalId(e.target.value)} />
        </Field>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? "جارٍ الحفظ…" : "حفظ"}
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost">
          إلغاء
        </button>
      </div>
    </form>
  );
}

/* ============================================================= */
/* تبويب حسابات الإدارة                                           */
/* تعديل الاسم فقط هنا — إضافة الحساب وتحديد الأدوار من صفحة        */
/* «الإدارة» (staff) كما هو معتاد، لضبط الصلاحيات في مكان واحد.     */
/* ============================================================= */

function AdminAccountsTab() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const load = async () => {
    const { data: admins } = await supabase
      .from("users")
      .select("id, username, full_name, is_active")
      .eq("role", "admin")
      .order("full_name");

    const ids = (admins ?? []).map((a) => a.id);
    const roleMap = {};
    if (ids.length) {
      const { data: rs } = await supabase
        .from("admin_roles")
        .select("user_id, role_type")
        .in("user_id", ids);
      (rs ?? []).forEach((r) => { (roleMap[r.user_id] ??= []).push(r.role_type); });
    }
    setRows((admins ?? []).map((a) => ({ ...a, roles: roleMap[a.id] ?? [] })));
  };

  useEffect(() => { load(); }, []);

  const searching = q.trim().length > 0;
  const filtered = useMemo(() => {
    const term = q.trim();
    if (!term) return [];
    return (rows ?? []).filter(
      (r) => r.full_name?.includes(term) || r.username?.includes(term)
    );
  }, [rows, q]);

  // تعديل حساب إداري (حتى الاسم فقط) يمرّ عبر نفس دالة Supabase Edge المستخدمة
  // في صفحة «الإدارة» — تحديث جدول users مباشرة لصف role=admin محجوب بصلاحية
  // RLS أضيق مخصّصة لصلاحية staff فقط، فلا يُطبَّق من هنا مباشرة.
  const save = async (row) => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const full_name = cleanText(name);
      if (!full_name) throw new Error("الاسم مطلوب");

      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("create-admin-account", {
        body: {
          full_name,
          national_id: row.username,
          admin_roles: row.roles,
        },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMsg("تم حفظ تعديل الاسم.");
      setEditingId(null);
      await load();
    } catch (e) {
      setErr(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!rows) return <p className="py-10 text-center text-sm text-muted">جارٍ التحميل…</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-muted">
        هنا يمكن تصحيح اسم أي حساب إداري فقط. لإضافة حساب جديد أو تعديل أدواره
        وصلاحياته، استخدم صفحة «الإدارة».
      </p>

      <input
        className="field"
        placeholder="بحث بالاسم أو اسم المستخدم"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <Banner err={err} msg={msg} />

      {!searching ? (
        <p className="card px-4 py-8 text-center text-sm text-muted">
          اكتب اسمًا أو اسم مستخدم في مربع البحث لعرض حسابات الإدارة.
        </p>
      ) : (
        <>
          <p className="text-sm text-muted">
            <span className="num font-semibold text-ink">{filtered.length}</span> نتيجة
          </p>

          <div className="card divide-y divide-line overflow-hidden">
            {filtered.map((r) => {
              const editing = editingId === r.id;
              return (
                <div key={r.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.full_name ?? r.username}</p>
                      <p className="num mt-0.5 text-right text-xs text-faint">{r.username}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {r.roles.map((role) => (
                          <span key={role} className="chip bg-mint-tint text-mint-deep">
                            {ADMIN_ROLE_LABEL[role] ?? role}
                          </span>
                        ))}
                        {!r.is_active && (
                          <span className="chip bg-absent/10 text-absent">معطّل</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditingId(editing ? null : r.id);
                        setName(r.full_name ?? "");
                        setErr("");
                        setMsg("");
                      }}
                      className="shrink-0 text-xs font-medium text-mint-deep hover:underline"
                    >
                      {editing ? "إغلاق" : "تعديل الاسم"}
                    </button>
                  </div>

                  {editing && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        className="field flex-1"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                      <button className="btn-primary shrink-0" disabled={busy} onClick={() => save(r)}>
                        {busy ? "جارٍ الحفظ…" : "حفظ"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted">لا نتائج.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
