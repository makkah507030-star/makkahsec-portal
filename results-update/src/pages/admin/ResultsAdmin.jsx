import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { cleanIdentity } from "../../lib/importer";
import { extractResultCandidates } from "../../lib/pdfResults";
import { gradeBand, REPORT_TYPE_LABEL } from "../../lib/gradeBands";
import { GRADE_NAMES } from "../../lib/schoolTime";

const REPORT_TYPES = ["period1", "period2", "final"];

function Banner({ err, msg }) {
  if (!err && !msg) return null;
  return (
    <div className={`rounded-sm2 px-4 py-2.5 text-sm ${err ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
      {err || msg}
    </div>
  );
}

export default function ResultsAdmin() {
  const { profile } = useSession();
  const [reportType, setReportType] = useState("period1");
  const [year, setYear] = useState("");
  const [students, setStudents] = useState([]); // {id, national_id, full_name}
  const [enrollMap, setEnrollMap] = useState(new Map()); // student_id -> {class_id, class_no, grade}
  const [notifyMap, setNotifyMap] = useState(new Map()); // student_id -> Set(user_id) [الطالب + أولياء أمره]
  const [queue, setQueue] = useState([]); // processing queue for new uploads
  const [existing, setExisting] = useState([]); // rows already in DB for this report_type+year
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const { data: sset } = await supabase
        .from("settings").select("key, value").eq("key", "active_year").maybeSingle();
      const y = sset?.value ?? "";
      setYear(y);

      const [{ data: st }, { data: enr }, { data: gs }] = await Promise.all([
        supabase.from("students").select("id, national_id, full_name, user_id"),
        supabase.from("student_enrollment")
          .select("student_id, class_id, classes(class_no, grade)")
          .eq("academic_year", y).eq("status", "active"),
        supabase.from("guardian_student").select("student_id, guardians(user_id)"),
      ]);
      setStudents(st ?? []);

      const m = new Map();
      (enr ?? []).forEach((r) => {
        m.set(r.student_id, { class_id: r.class_id, class_no: r.classes?.class_no, grade: r.classes?.grade });
      });
      setEnrollMap(m);

      const nm = new Map();
      (st ?? []).forEach((s) => {
        if (s.user_id) nm.set(s.id, new Set([s.user_id]));
      });
      (gs ?? []).forEach((r) => {
        const uid = r.guardians?.user_id;
        if (!uid) return;
        if (!nm.has(r.student_id)) nm.set(r.student_id, new Set());
        nm.get(r.student_id).add(uid);
      });
      setNotifyMap(nm);
    })();
  }, []);

  /** يرسل إشعارًا تلقائيًا لحسابات الطلاب وأولياء أمورهم عند نشر نتائجهم */
  const notifyPublished = async (studentIds, type) => {
    const userIds = new Set();
    studentIds.forEach((sid) => {
      (notifyMap.get(sid) ?? []).forEach((uid) => userIds.add(uid));
    });
    if (!userIds.size) return;
    await supabase.rpc("send_notification", {
      p_title: `صدرت نتيجة ${REPORT_TYPE_LABEL[type] ?? type}`,
      p_body: "تفقد نتيجتك من الصفحة الرئيسية في البوابة.",
      p_kind: "general",
      p_link: "/",
      p_roles: null,
      p_user_ids: [...userIds],
      p_grade: null,
      p_class_no: null,
      p_is_auto: true,
    });
  };

  const studentByNid = useMemo(() => {
    const m = new Map();
    students.forEach((s) => m.set(cleanIdentity(s.national_id), s));
    return m;
  }, [students]);

  const loadExisting = async () => {
    if (!year) return;
    const { data } = await supabase
      .from("student_results")
      .select("id, student_id, average, published, rank_class, class_count, rank_grade, grade_count, file_path, students(full_name, national_id)")
      .eq("report_type", reportType)
      .eq("academic_year", year)
      .order("created_at", { ascending: false });
    setExisting(data ?? []);
  };

  useEffect(() => { loadExisting(); }, [reportType, year]);

  /* ---------------- معالجة الملفات المرفوعة ---------------- */

  const handleFiles = async (fileList) => {
    setErr(""); setMsg("");
    const files = Array.from(fileList);
    const items = files.map((file) => ({
      id: `${file.name}-${file.size}-${Math.random()}`,
      file,
      url: URL.createObjectURL(file),
      status: "processing",
      nationalId: null,
      matched: null,
      candidates: [],
      chosen: null,
      error: null,
    }));
    setQueue((q) => [...q, ...items]);

    for (const item of items) {
      try {
        const { nationalId, averageCandidates } = await extractResultCandidates(item.file);
        const matched = nationalId ? studentByNid.get(cleanIdentity(nationalId)) ?? null : null;
        setQueue((q) => q.map((r) => r.id === item.id ? {
          ...r, status: matched ? "matched" : "unmatched",
          nationalId, candidates: averageCandidates, matched,
        } : r));
      } catch (e) {
        setQueue((q) => q.map((r) => r.id === item.id ? { ...r, status: "error", error: e.message } : r));
      }
    }
  };

  const setChosen = (id, value) => {
    setQueue((q) => q.map((r) => r.id === id ? { ...r, chosen: value } : r));
  };

  const applyFirstChoiceToAll = () => {
    const first = queue.find((r) => r.chosen != null);
    if (!first) return;
    const idx = first.candidates.indexOf(first.chosen);
    if (idx === -1) return;
    setQueue((q) => q.map((r) => (
      r.candidates[idx] != null ? { ...r, chosen: r.candidates[idx] } : r
    )));
  };

  const removeItem = (id) => setQueue((q) => q.filter((r) => r.id !== id));
  const clearDone = () => setQueue((q) => q.filter((r) => r.status !== "uploaded"));

  const uploadAll = async () => {
    setBusy(true); setErr(""); setMsg("");
    let ok = 0, fail = 0;
    for (const item of queue) {
      if (item.status === "uploaded" || !item.matched || item.chosen == null) continue;
      try {
        const path = `${item.matched.id}/${reportType}_${year}.pdf`;
        const { error: upErr } = await supabase.storage.from("results")
          .upload(path, item.file, { upsert: true, contentType: "application/pdf" });
        if (upErr) throw upErr;

        const { error: dbErr } = await supabase.from("student_results").upsert({
          student_id: item.matched.id,
          report_type: reportType,
          academic_year: year,
          average: item.chosen,
          file_path: path,
          uploaded_by: profile?.id ?? null,
        }, { onConflict: "student_id,report_type,academic_year" });
        if (dbErr) throw dbErr;

        setQueue((q) => q.map((r) => r.id === item.id ? { ...r, status: "uploaded" } : r));
        ok++;
      } catch (e) {
        setQueue((q) => q.map((r) => r.id === item.id ? { ...r, status: "error", error: e.message } : r));
        fail++;
      }
    }
    setBusy(false);
    setMsg(`تم رفع ${ok} ملفًا بنجاح${fail ? ` — فشل ${fail}` : ""}.`);
    await loadExisting();
  };

  /* ---------------- احتساب الترتيب ---------------- */

  const recomputeRanks = async () => {
    setBusy(true); setErr(""); setMsg("");
    try {
      const { data: rows } = await supabase
        .from("student_results")
        .select("id, student_id, average")
        .eq("report_type", reportType)
        .eq("academic_year", year)
        .not("average", "is", null);

      const withInfo = (rows ?? []).map((r) => ({ ...r, info: enrollMap.get(r.student_id) }));

      const byClass = new Map();
      const byGrade = new Map();
      withInfo.forEach((r) => {
        if (!r.info) return;
        if (r.info.class_id) {
          if (!byClass.has(r.info.class_id)) byClass.set(r.info.class_id, []);
          byClass.get(r.info.class_id).push(r);
        }
        if (r.info.grade != null) {
          if (!byGrade.has(r.info.grade)) byGrade.set(r.info.grade, []);
          byGrade.get(r.info.grade).push(r);
        }
      });

      const rankMap = new Map(); // id -> {rank_class, class_count, rank_grade, grade_count}
      const initRank = (id) => rankMap.get(id) ?? { rank_class: null, class_count: null, rank_grade: null, grade_count: null };

      byClass.forEach((list) => {
        const sorted = [...list].sort((a, b) => b.average - a.average);
        sorted.forEach((r, i) => {
          rankMap.set(r.id, { ...initRank(r.id), rank_class: i + 1, class_count: sorted.length });
        });
      });

      byGrade.forEach((list) => {
        const sorted = [...list].sort((a, b) => b.average - a.average);
        sorted.forEach((r, i) => {
          rankMap.set(r.id, { ...initRank(r.id), rank_grade: i + 1, grade_count: sorted.length });
        });
      });

      for (const [id, ranks] of rankMap.entries()) {
        await supabase.from("student_results").update(ranks).eq("id", id);
      }

      setMsg(`تم احتساب الترتيب لـ ${rankMap.size} نتيجة.`);
      await loadExisting();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };

  /* ---------------- نشر / إلغاء نشر / حذف ---------------- */

  const togglePublish = async (row) => {
    const nextPublished = !row.published;
    await supabase.from("student_results").update({ published: nextPublished }).eq("id", row.id);
    if (nextPublished) await notifyPublished([row.student_id], reportType);
    await loadExisting();
  };

  const publishAll = async (value) => {
    setBusy(true);
    const ids = existing.map((r) => r.id);
    if (ids.length) await supabase.from("student_results").update({ published: value }).in("id", ids);
    if (value) {
      const newlyPublished = existing.filter((r) => !r.published).map((r) => r.student_id);
      await notifyPublished(newlyPublished, reportType);
    }
    setBusy(false);
    await loadExisting();
  };

  const deleteRow = async (row) => {
    if (!confirm(`حذف نتيجة ${row.students?.full_name}؟`)) return;
    await supabase.storage.from("results").remove([row.file_path]);
    await supabase.from("student_results").delete().eq("id", row.id);
    await loadExisting();
  };

  const matchedCount = queue.filter((r) => r.status === "matched" || r.status === "uploaded").length;
  const readyCount = queue.filter((r) => r.matched && r.chosen != null && r.status !== "uploaded").length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">نتائج الطلاب</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          ارفع ملفات النتائج PDF كما هي من نظام نور — يتم ربطها تلقائيًا برقم الهوية داخل كل
          ملف. تبقى النتائج مخفية عن الطلاب وأولياء الأمور حتى تضغط «نشر».
        </p>
      </div>

      <Banner err={err} msg={msg} />

      <div className="flex flex-wrap items-center gap-2">
        {REPORT_TYPES.map((t) => (
          <button key={t} onClick={() => setReportType(t)}
            className={`rounded-pill px-4 py-1.5 text-sm font-medium transition-colors ${
              reportType === t ? "bg-mint-deep text-white" : "border border-line bg-white text-muted hover:bg-canvas"}`}>
            {REPORT_TYPE_LABEL[t]}
          </button>
        ))}
        <span className="num mr-auto rounded-pill bg-canvas px-3 py-1 text-xs text-muted">
          العام الدراسي: {year || "—"}
        </span>
      </div>

      {/* رفع ملفات جديدة */}
      <section className="card space-y-3 p-4">
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-card border-2 border-dashed border-line bg-canvas px-4 py-8 text-center hover:border-mint-deep">
          <span className="text-sm font-semibold text-ink">اضغط لاختيار ملفات PDF (يمكن اختيار عدة ملفات دفعة واحدة)</span>
          <span className="text-xs text-muted">سيُستخرج رقم الهوية من كل ملف تلقائيًا لمطابقته بالطالب</span>
          <input type="file" accept="application/pdf" multiple className="hidden"
            onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ""; }} />
        </label>

        {queue.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span>مطابق: <span className="num font-bold text-ink">{matchedCount}</span> من <span className="num font-bold text-ink">{queue.length}</span></span>
              <button onClick={applyFirstChoiceToAll}
                className="mr-auto rounded-sm2 border border-line bg-paper px-3 py-1.5 font-medium text-ink hover:bg-canvas">
                تطبيق نفس موضع المعدل المختار على كل الملفات
              </button>
              <button onClick={clearDone}
                className="rounded-sm2 border border-line bg-paper px-3 py-1.5 font-medium text-ink hover:bg-canvas">
                إخفاء المرفوعة
              </button>
            </div>

            <div className="divide-y divide-line rounded-card border border-line">
              {queue.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                  <a href={r.url} target="_blank" rel="noopener" className="text-xs font-medium text-mint-deep hover:underline">
                    معاينة
                  </a>
                  <div className="min-w-[140px] flex-1">
                    {r.status === "processing" && <p className="text-xs text-muted">جارٍ التحليل…</p>}
                    {r.status === "unmatched" && (
                      <p className="text-xs text-danger">
                        لم يُطابَق (رقم الهوية المستخرج: {r.nationalId ?? "غير موجود"})
                      </p>
                    )}
                    {r.status === "error" && <p className="text-xs text-danger">خطأ: {r.error}</p>}
                    {(r.status === "matched" || r.status === "uploaded") && (
                      <p className="text-sm font-medium text-ink">
                        {r.matched.full_name}
                        <span className="num text-xs text-muted"> · {r.matched.national_id}</span>
                        {r.status === "uploaded" && <span className="chip mr-2 bg-success/10 text-success">تم الرفع</span>}
                      </p>
                    )}
                  </div>

                  {(r.status === "matched" || r.status === "uploaded") && (
                    <div className="flex flex-wrap gap-1.5">
                      {r.candidates.length === 0 ? (
                        <span className="text-xs text-danger">لا توجد أرقام مرشّحة للمعدل</span>
                      ) : r.candidates.map((c) => (
                        <button key={c} onClick={() => setChosen(r.id, c)} disabled={r.status === "uploaded"}
                          className={`num rounded-sm2 border px-2.5 py-1 text-xs font-semibold transition-colors ${
                            r.chosen === c ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-white text-ink hover:bg-canvas"}`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  )}

                  <button onClick={() => removeItem(r.id)} disabled={r.status === "uploaded"}
                    className="text-xs text-danger hover:underline disabled:opacity-30">إزالة</button>
                </div>
              ))}
            </div>

            <button onClick={uploadAll} disabled={busy || readyCount === 0}
              className="w-full rounded-sm2 bg-mint-deep py-2.5 text-sm font-bold text-white hover:bg-mint-hover disabled:opacity-40">
              رفع {readyCount} ملفًا جاهزًا
            </button>
            <p className="text-[11px] leading-relaxed text-muted">
              اختر لكل ملف الرقم الصحيح للمعدل من الأزرار أعلاه (افتح «معاينة» أول مرة للتأكد من
              الرقم الصحيح في نفس الموضع لكل الملفات)، ثم استخدم «تطبيق نفس الموضع» لتوفير الوقت.
            </p>
          </>
        )}
      </section>

      {/* النتائج المرفوعة سابقًا */}
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h2 className="text-sm font-semibold text-ink">
            النتائج المرفوعة — {REPORT_TYPE_LABEL[reportType]} <span className="num">({existing.length})</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={recomputeRanks} disabled={busy}
              className="rounded-sm2 border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas disabled:opacity-40">
              احتساب الترتيب
            </button>
            <button onClick={() => publishAll(true)} disabled={busy || !existing.length}
              className="rounded-sm2 bg-mint-deep px-3 py-1.5 text-xs font-bold text-white hover:bg-mint-hover disabled:opacity-40">
              نشر الكل
            </button>
            <button onClick={() => publishAll(false)} disabled={busy || !existing.length}
              className="rounded-sm2 border border-line bg-paper px-3 py-1.5 text-xs font-medium text-ink hover:bg-canvas disabled:opacity-40">
              إلغاء نشر الكل
            </button>
          </div>
        </div>

        {existing.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">لا نتائج مرفوعة لهذا النوع والعام بعد.</p>
        ) : (
          <div className="divide-y divide-line">
            {existing.map((r) => {
              const info = enrollMap.get(r.student_id);
              const band = gradeBand(r.average, reportType);
              return (
                <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <div className="min-w-[160px] flex-1">
                    <p className="text-sm font-medium text-ink">{r.students?.full_name}</p>
                    <p className="text-xs text-muted">
                      {info ? `${GRADE_NAMES[info.grade] ?? ""} · فصل ${info.class_no}` : "بلا فصل معيّن"}
                    </p>
                  </div>
                  <span className="num text-sm font-semibold text-ink">{r.average ?? "—"}</span>
                  {band && (
                    <span className="rounded-pill px-2.5 py-1 text-[11px] font-bold" style={{ background: band.bg, color: band.text }}>
                      {band.label}
                    </span>
                  )}
                  <span className="num text-xs text-muted">
                    {r.rank_class != null ? `فصل ${r.rank_class}/${r.class_count}` : "—"} ·{" "}
                    {r.rank_grade != null ? `مدرسة ${r.rank_grade}/${r.grade_count}` : "—"}
                  </span>
                  <button onClick={() => togglePublish(r)}
                    className={`rounded-sm2 px-3 py-1.5 text-xs font-bold ${
                      r.published ? "bg-success/10 text-success" : "border border-line bg-white text-muted"}`}>
                    {r.published ? "منشورة" : "غير منشورة"}
                  </button>
                  <button onClick={() => deleteRow(r)} className="text-xs text-danger hover:underline">حذف</button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
