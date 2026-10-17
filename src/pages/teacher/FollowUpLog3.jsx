import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useSession } from "../../lib/session.jsx";
import { GRADE_NAMES } from "../../lib/schoolTime";
import { printReport, PRINCIPAL_NAME } from "../../lib/exportUtils";
import logoIcon from "../../assets/icon-mint.png";
import moeLogo from "../../assets/moe-logo.png";
import { noEra } from "../../lib/dates";
import { countAr } from "../../lib/arabicCount.js";
import EvidenceTags from "../../components/EvidenceTags.jsx";
import { logColumns, itemsFor, validDist, mergeDist, defaultItems, newItemId, TEMPLATES, ITEM_PREFIX, DIST_TABLE } from "../../lib/followUp3.js";

/* =====================================================================
   سجل المتابعة الإلكتروني 3 (تجريبي في الفصل الدراسي الأول، ثم يُستغنى عن أحد السجلات) —
   بفكرة السجل 2 مع توزيع حر للدرجات:
   يوزّع المعلم درجات الفترة على بنود يسمّيها كما يشاء (اختبار لكل وحدة، تلاوة وحفظ…)،
   وكل بند يتبع عمودًا من أعمدة نور للمادة، ومجموع بنود كل عمود يساوي سقفه.
   • البند «خانات»: خانة لكل درجة، ضغطة = ✓ (تُحتسب)، ضغطتان = ✗، ثالثة = تُمسح.
   • البند «درجة»: رقم يُكتب من 0 إلى درجته.
   • ما يُرصد هنا يملأ كشف رصد الدرجات تلقائيًا لكل عمود اكتملت بنوده (lib/followUp3.js).

   الرصد في teacher_follow_up ببنود مستقلة (r3_*) فلا يتأثر السجلان 1 و2:
   mark = 1 للصح و0 للخطأ، وللدرجة قيمتها، وحذف الصف = خانة فارغة. والتوزيع في
   teacher_follow_up_dist3 (supabase/follow_up_v3.sql).
   ===================================================================== */

const TERM_LABEL = { 1: "الأول", 2: "الثاني" };
const PERIODS = ["الفترة الأولى", "الفترة الثانية"];

const dbKey = (k) => `${ITEM_PREFIX}${k}`;
const markKey = (studentId, itemKey, slotNo) => `${studentId}::${itemKey}::${slotNo}`;
const lsKey = (teacherId, subject, year, term) => `followup3-dist:${teacherId}:${subject}:${year}:${term}`;
const clampInt = (v, max) => (v === "" ? "" : String(Math.max(0, Math.min(max, Math.round(Number(v) || 0)))));

export default function FollowUpLog3() {
  const { session } = useSession();
  const [me, setMe] = useState(null);
  const [groups, setGroups] = useState(null);
  const [year, setYear] = useState("");
  const [yearLabel, setYearLabel] = useState("");
  const [term, setTerm] = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [groupKey, setGroupKey] = useState("");
  const [period, setPeriod] = useState(PERIODS[0]);
  const [itemKey, setItemKey] = useState("");

  // التوزيع المحفوظ للمادة (كل بنيات الأعمدة)، ومسودة بنود هذه البنية أثناء التعديل
  const [saved, setSaved] = useState(undefined);   // undefined: لم يُحمَّل بعد
  const [draft, setDraft] = useState([]);
  const [editingW, setEditingW] = useState(false);
  const [wMissing, setWMissing] = useState(false);   // جدول التوزيع لم يُنشأ بعد
  const [wSaving, setWSaving] = useState(false);

  const [marks, setMarks] = useState({});
  const [marksLoading, setMarksLoading] = useState(false);
  const [saveState, setSaveState] = useState({});
  const [errorMsg, setErrorMsg] = useState({});

  /* ---------- تحميل الإسنادات وطلابها (كالسجل الأول) ---------- */
  useEffect(() => {
    (async () => {
      const uid = session?.user?.id;
      if (!uid) return;

      const [{ data: st }, { data: t0 }] = await Promise.all([
        supabase.from("settings").select("key, value")
          .in("key", ["active_year", "active_term", "active_year_label"]),
        supabase.from("teachers").select("id, full_name, specialization")
          .eq("user_id", uid).maybeSingle(),
      ]);

      const m = Object.fromEntries((st ?? []).map((r) => [r.key, r.value]));
      const y = m.active_year ?? "";
      setYearLabel(noEra(m.active_year_label) ?? y);
      const t = Number(m.active_term ?? 1);
      setYear(y);
      setTerm(t);

      setMe(t0 ?? null);
      if (!t0) { setGroups([]); setLoading(false); return; }

      const { data: sch } = await supabase
        .from("schedule")
        .select("class_id, classes(class_no, grade), subjects(name)")
        .eq("teacher_id", t0.id)
        .eq("academic_year", y)
        .eq("term", t);

      const map = new Map();
      (sch ?? []).forEach((r) => {
        const subject = r.subjects?.name ?? "—";
        const key = `${r.class_id}::${subject}`;
        if (!map.has(key)) {
          map.set(key, {
            key, subject, class_id: r.class_id,
            class_no: r.classes?.class_no ?? 0, grade: r.classes?.grade ?? 0, students: [],
          });
        }
      });

      const list = [...map.values()];
      const classIds = [...new Set(list.map((g) => g.class_id))];
      if (classIds.length) {
        const { data: enr } = await supabase
          .from("student_enrollment")
          .select("class_id, students(id, full_name, national_id)")
          .in("class_id", classIds)
          .eq("status", "active");
        const byClass = {};
        (enr ?? []).forEach((e) => { if (e.students) (byClass[e.class_id] ??= []).push(e.students); });
        Object.values(byClass).forEach((arr) => arr.sort((a, b) => a.full_name.localeCompare(b.full_name, "ar")));
        list.forEach((g) => { g.students = byClass[g.class_id] ?? []; });
      }
      list.sort((a, b) => a.subject.localeCompare(b.subject, "ar") || a.class_no - b.class_no);

      setGroups(list);
      if (list.length) setGroupKey(list[0].key);
      setLoading(false);
    })();
  }, [session]);

  const group = useMemo(() => (groups ?? []).find((g) => g.key === groupKey) ?? null, [groups, groupKey]);

  /* ---------- تحميل توزيع الدرجات لمادة هذا الفصل ---------- */
  // أعمدة نور للمادة في صف هذا الفصل، وبنود التوزيع المعتمد لها
  const cols = useMemo(() => (group ? logColumns(group.subject, group.grade) : []), [group?.subject, group?.grade]);   // eslint-disable-line react-hooks/exhaustive-deps
  const items = useMemo(() => (saved === undefined ? null : itemsFor(saved, cols)), [saved, cols]);
  const weights = items;   // التوزيع المعتمد لهذا الفصل (null إن لم يُعتمد)

  useEffect(() => {
    (async () => {
      if (!me || !group) return;
      setSaved(undefined);
      const { data, error } = await supabase
        .from(DIST_TABLE)
        .select("weights")
        .eq("teacher_id", me.id).eq("subject", group.subject)
        .eq("academic_year", year).eq("term", term)
        .maybeSingle();
      let w = data?.weights ?? null;
      if (error) {
        // الجدول لم يُنشأ بعد: نحفظ التوزيع على هذا الجهاز مؤقتًا
        setWMissing(true);
        try { w = JSON.parse(localStorage.getItem(lsKey(me.id, group.subject, year, term)) || "null"); } catch { w = null; }
      }
      setSaved(w);
    })();
  }, [me, group?.subject, year, term]);   // eslint-disable-line react-hooks/exhaustive-deps

  // بلا توزيع معتمد لهذه الأعمدة: يُفتح المحرر بالتوزيع المعتاد
  useEffect(() => {
    if (saved === undefined) return;
    const it = itemsFor(saved, cols);
    setDraft((it ?? defaultItems(cols)).map((x) => ({ ...x, max: String(x.max) })));
    setEditingW(!it);
  }, [saved, cols]);

  const activeItem = (items ?? []).find((it) => it.id === itemKey) ?? items?.[0] ?? null;
  useEffect(() => { if (activeItem && activeItem.id !== itemKey) setItemKey(activeItem.id); }, [activeItem, itemKey]);

  /* ---------- تحميل الرصد لهذا الفصل × المادة × الفترة ---------- */
  useEffect(() => {
    (async () => {
      if (!me || !group) return;
      setMarksLoading(true);
      const { data } = await supabase
        .from("teacher_follow_up")
        .select("student_id, item_key, slot_no, mark")
        .eq("teacher_id", me.id).eq("class_id", group.class_id).eq("subject", group.subject)
        .eq("academic_year", year).eq("term", term).eq("period", period)
        .like("item_key", `${ITEM_PREFIX}%`);
      const next = {};
      (data ?? []).forEach((r) => {
        if (r.mark === null || r.mark === undefined) return;
        next[markKey(r.student_id, r.item_key.slice(ITEM_PREFIX.length), r.slot_no)] = String(Number(r.mark));
      });
      setMarks(next);
      setMarksLoading(false);
    })();
  }, [me, group, year, term, period]);

  const markValue = (studentId, ik, sn) => marks[markKey(studentId, ik, sn)] ?? "";

  /* ---------- اعتماد التوزيع ---------- */
  const draftItems = draft.map((x) => ({ ...x, max: Number(x.max) || 0 }));
  const check = validDist(draftItems, cols);
  const saveWeights = async () => {
    if (!me || !group || !check.ok) return;
    const w = mergeDist(saved, cols, draftItems);
    setWSaving(true);
    if (wMissing) {
      try { localStorage.setItem(lsKey(me.id, group.subject, year, term), JSON.stringify(w)); } catch { /* تجاهل */ }
    } else {
      const { error } = await supabase.from(DIST_TABLE).upsert(
        { teacher_id: me.id, subject: group.subject, academic_year: year, term, weights: w, updated_at: new Date().toISOString() },
        { onConflict: "teacher_id,subject,academic_year,term" });
      if (error) { setWSaving(false); window.alert(`تعذّر حفظ التوزيع: ${error.message}`); return; }
    }
    setWSaving(false);
    setSaved(w);
    setEditingW(false);
  };

  const editItem = (id, patch) => setDraft((d) => d.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const addItem = (col) => setDraft((d) => [...d, { id: newItemId(), label: "", max: "", type: "score", col }]);
  const removeItem = (id) => setDraft((d) => d.filter((x) => x.id !== id));
  const applyTemplate = (t) => {
    if (draft.some((x) => x.label.trim()) && !window.confirm(`استبدال البنود الحالية بقالب «${t.t}»؟`)) return;
    setDraft(t.make(cols).map((x) => ({ ...x, max: String(x.max) })));
  };

  /* ---------- حفظ خانة أو درجة ---------- */
  const flash = (studentId, state, msg) => {
    setSaveState((p) => ({ ...p, [studentId]: state }));
    if (msg) setErrorMsg((p) => ({ ...p, [studentId]: msg }));
    if (state === "saved") {
      setTimeout(() => setSaveState((p) => (p[studentId] === "saved" ? { ...p, [studentId]: null } : p)), 1500);
    }
  };

  const base = () => ({
    teacher_id: me.id, class_id: group.class_id, subject: group.subject,
    academic_year: year, term, period,
  });

  const saveMark = async (studentId, ik, sn, rawValue) => {
    if (!me || !group) return;
    const value = String(rawValue).trim();
    flash(studentId, "saving");
    try {
      if (value === "") {
        const { error } = await supabase.from("teacher_follow_up").delete()
          .eq("teacher_id", me.id).eq("class_id", group.class_id).eq("subject", group.subject)
          .eq("academic_year", year).eq("term", term).eq("period", period)
          .eq("student_id", studentId).eq("item_key", dbKey(ik)).eq("slot_no", sn);
        if (error) throw error;
      } else {
        const num = Number(value.replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace("٫", "."));
        const max = (items ?? []).find((it) => it.id === ik)?.max ?? Infinity;
        if (Number.isNaN(num) || num < 0 || num > max) throw new Error(`اكتب رقمًا من 0 إلى ${max}`);
        const { error } = await supabase.from("teacher_follow_up").upsert(
          { ...base(), student_id: studentId, item_key: dbKey(ik), slot_no: sn, mark: num },
          { onConflict: "teacher_id,class_id,subject,academic_year,term,period,student_id,item_key,slot_no" });
        if (error) throw error;
      }
      flash(studentId, "saved");
    } catch (e) {
      console.error("saveMark failed:", e);
      flash(studentId, "error", e?.message || String(e));
    }
  };

  const setLocal = (studentId, ik, sn, value) =>
    setMarks((p) => ({ ...p, [markKey(studentId, ik, sn)]: value }));

  // فارغة ← ✓ ← ✗ ← فارغة
  const cycleBox = (studentId, ik, sn) => {
    const cur = markValue(studentId, ik, sn);
    const next = cur === "" ? "1" : cur === "1" ? "0" : "";
    setLocal(studentId, ik, sn, next);
    saveMark(studentId, ik, sn, next);
  };

  // صح للجميع في خانة: لمن خانته فارغة فقط، في طلب واحد
  const checkColumn = async (sn) => {
    if (!group || !activeItem) return;
    const targets = group.students.filter((s) => markValue(s.id, activeItem.id, sn) === "");
    if (!targets.length) return;
    targets.forEach((s) => setLocal(s.id, activeItem.id, sn, "1"));
    const { error } = await supabase.from("teacher_follow_up").upsert(
      targets.map((s) => ({ ...base(), student_id: s.id, item_key: dbKey(activeItem.id), slot_no: sn, mark: 1 })),
      { onConflict: "teacher_id,class_id,subject,academic_year,term,period,student_id,item_key,slot_no" });
    if (error) {
      targets.forEach((s) => { setLocal(s.id, activeItem.id, sn, ""); flash(s.id, "error", error.message); });
    }
  };

  // درجة الطالب في بند خانات: عدد علامات الصح داخل عدد خانات البند الحالي
  const boxScore = (studentId, it) => {
    let ok = 0, bad = 0;
    for (let sn = 1; sn <= it.max; sn++) {
      const v = markValue(studentId, it.id, sn);
      if (v === "1") ok++; else if (v === "0") bad++;
    }
    return { ok, bad, empty: it.max - ok - bad };
  };

  const logos = () => ({
    logoUrl: new URL(logoIcon, window.location.origin).href,
    moeLogoUrl: new URL(moeLogo, window.location.origin).href,
  });

  /* ---------- تصدير وطباعة ---------- */
  const printGroup = async () => {
    if (!me || !group || !weights) return;
    setBusy(true);
    const { data } = await supabase
      .from("teacher_follow_up")
      .select("student_id, item_key, slot_no, mark")
      .eq("teacher_id", me.id).eq("class_id", group.class_id).eq("subject", group.subject)
      .eq("academic_year", year).eq("term", term).eq("period", period)
      .like("item_key", `${ITEM_PREFIX}%`);
    const got = {};
    (data ?? []).forEach((r) => { got[`${r.student_id}::${r.item_key.slice(ITEM_PREFIX.length)}::${r.slot_no}`] = r.mark; });

    // لكل عمود من أعمدة نور: بنوده (خانات بعدد درجاتها، أو درجة واحدة) ثم مجموعه
    const groupsByCol = cols.map((c) => ({ c, its: items.filter((it) => it.col === c.i) })).filter((x) => x.its.length);
    const width = (it) => (it.type === "box" ? it.max : 1);
    const row1 = [
      { text: "م", rowspan: 3 },
      { text: "اسم الطالب", rowspan: 3 },
      ...groupsByCol.map(({ c, its }) => ({ text: `${c.label} (${c.max})`, colspan: its.reduce((a, it) => a + width(it), 0) + 1 })),
      { text: "المجموع", rowspan: 3, cls: "total-h" },
    ];
    const row2 = groupsByCol.flatMap(({ its }) => [
      ...its.map((it) => (it.type === "box"
        ? { text: `${it.label} (${it.max})`, colspan: it.max }
        : { text: `${it.label} (${it.max})`, rowspan: 2 })),
      { text: "المجموع", rowspan: 2, cls: "total-h" },
    ]);
    const row3 = groupsByCol.flatMap(({ its }) => its.filter((it) => it.type === "box")
      .flatMap((it) => Array.from({ length: it.max }, (_, i) => ({ text: String(i + 1), cls: "slot" }))));

    const slots = groupsByCol.reduce((a, { its }) => a + its.reduce((b, it) => b + width(it), 0), 0);
    const extra = groupsByCol.length + 1;   // مجموع كل عمود والمجموع الكلي
    const slotW = (74 / Math.max(slots, 1)).toFixed(2);
    const colWidths = ["3%", "17%", ...groupsByCol.flatMap(({ its }) => [
      ...its.flatMap((it) => Array.from({ length: width(it) }, () => `${it.type === "box" ? slotW : (slotW * 2).toFixed(2)}%`)),
      `${(6 / extra).toFixed(2)}%`,
    ]), `${(6 / extra).toFixed(2)}%`];

    const rows = group.students.map((s, i) => {
      let all = 0, anyAll = false;
      const cells = groupsByCol.flatMap(({ its }) => {
        let sum = 0, any = false;
        const out = its.flatMap((it) => {
          if (it.type === "score") {
            const v = got[`${s.id}::${it.id}::1`];
            if (v === undefined || v === null) return [{ text: "", cls: "blank" }];
            any = true; sum += Number(v) || 0;
            return [{ text: String(Number(v)) }];
          }
          return Array.from({ length: it.max }, (_, si) => {
            const v = got[`${s.id}::${it.id}::${si + 1}`];
            if (v === undefined || v === null) return { text: "", cls: "blank slot" };
            any = true;
            if (Number(v) > 0) { sum += 1; return { text: "✓", cls: "slot st-present" }; }
            return { text: "✗", cls: "slot st-absent" };
          });
        });
        if (any) { anyAll = true; all += sum; }
        return [...out, { text: any ? String(Math.round(sum * 100) / 100) : "", cls: any ? "total" : "blank total" }];
      });
      return [
        i + 1,
        { text: s.full_name ?? "", cls: "name" },
        ...cells,
        { text: anyAll ? String(Math.round(all * 100) / 100) : "", cls: anyAll ? "total" : "blank total" },
      ];
    });

    printReport({
      title: "سجل المتابعة الإلكتروني 3",
      landscape: true,
      sections: [{
        title: `سجل متابعة مادة ${group.subject} — ${period}`,
        subtitle: `${GRADE_NAMES[group.grade] ?? ""} · فصل ${group.class_no} · ${countAr(group.students.length, "student")} · ✓ تُحتسب درجة، ✗ لا تُحتسب`,
        headerRows: [row1, row2, row3],
        tableClass: "follow",
        colWidths,
        rows,
      }],
      cover: {
        title: "سجل المتابعة الإلكتروني",
        rows: [
          ["المعلم", me?.full_name ?? ""],
          ["المادة", group.subject],
          ["الفصل", `${GRADE_NAMES[group.grade] ?? ""} · فصل ${group.class_no}`],
          ["الفترة", period],
          ["توزيع الدرجات", items.map((it) => `${it.label} ${it.max}`).join(" · ")],
        ],
        year: `العام الدراسي ${yearLabel} — الفصل الدراسي ${TERM_LABEL[term] ?? term}`,
      },
      signatures: [
        { title: "معلم المادة", name: me?.full_name ?? "" },
        { title: "مدير المدرسة", name: PRINCIPAL_NAME },
      ],
      hideSignatureLine: true,
      ...logos(),
    });
    setBusy(false);
  };

  /* ---------- العرض ---------- */
  if (loading) {
    return (
      <div className="animate-pulse space-y-5">
        <div className="h-5 w-56 rounded bg-line" />
        <div className="h-28 rounded-card border border-line bg-white/60" />
        <div className="h-64 rounded-card border border-line bg-white/60" />
      </div>
    );
  }
  if (!me) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">الحساب غير مرتبط بسجل معلم</p>
        <p className="mt-1.5 text-sm text-muted">راجع إدارة المدرسة.</p>
      </div>
    );
  }
  if (!groups.length) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">لا توجد إسنادات</p>
        <p className="mt-1.5 text-sm text-muted">لم تُسند إليك مواد أو فصول في هذا الفصل الدراسي.</p>
      </div>
    );
  }

  const periodMax = cols.reduce((a, c) => a + c.max, 0);
  const tone = (sum, max) => (sum === max ? ["text-mint-deep", "bg-mint-deep"] : sum > max ? ["text-danger", "bg-danger"] : ["text-warning", "bg-warning"]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold text-ink">سجل المتابعة الإلكتروني 3 <span className="chip mr-1 bg-warning-light align-middle text-warning">تجريبي</span></h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          وزّع درجات الفترة على بنود تسمّيها كما تشاء تحت كل عمود من أعمدة نور: اختبار لكل وحدة، أو تلاوة وحفظ، أو واجبات ومشاركة.
          بند «الخانات» تؤشّر عليه: ضغطة <b className="text-mint-deep">✓</b> تُحتسب درجة، وضغطتان <b className="text-danger">✗</b>، والثالثة تمسح.
          وبند «الدرجة» تكتب رقمه. يُحفظ كل شيء تلقائيًا، ويملأ كشف رصد الدرجات.
        </p>
        <EvidenceTags className="mt-2" items={["e03_06", "e11_02", "e11_03"]} />
      </div>

      {/* المادة والفصل والفترة */}
      <section className="card space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">المادة والفصل</label>
            <select value={groupKey} onChange={(e) => setGroupKey(e.target.value)} className="field">
              {groups.map((g) => (
                <option key={g.key} value={g.key}>{g.subject} — {GRADE_NAMES[g.grade] ?? ""} فصل {g.class_no}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">الفترة</label>
            <div className="flex gap-2">
              {PERIODS.map((p) => (
                <button key={p} onClick={() => setPeriod(p)}
                  className={"flex-1 rounded-sm2 border px-3 py-2 text-sm font-medium " +
                    (period === p ? "border-mint-deep bg-mint-tint text-mint-deep" : "border-line bg-paper text-ink hover:bg-canvas")}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* شريط توزيع الدرجات: بنود يسمّيها المعلم تحت كل عمود من أعمدة نور */}
      {group && saved !== undefined && (
        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-mint-tint/50 px-4 py-3">
            <h2 className="text-sm font-semibold text-ink">توزيع درجات الفترة — {group.subject}</h2>
            <span className="rounded-pill border border-warning/40 bg-warning-light px-3 py-1 text-xs font-bold text-warning">
              ⚠ {cols.map((c) => `${c.label} = ${c.max}`).join(" · ")}
            </span>
          </div>

          {!editingW && weights ? (
            <div className="space-y-2 px-4 py-3">
              {cols.map((c) => (
                <div key={c.i} className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-muted">{c.label}:</span>
                  {weights.filter((it) => it.col === c.i).map((it) => (
                    <span key={it.id} className="rounded-pill border border-line bg-paper px-3 py-1.5 text-sm text-ink">
                      {it.label} <b className="num text-mint-deep">{it.max}</b>
                    </span>
                  ))}
                </div>
              ))}
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-mint-deep">مجموع الفترة <span className="num">{periodMax}</span></span>
                <button onClick={() => setEditingW(true)} className="mr-auto text-xs font-semibold text-mint-deep hover:underline">
                  تعديل التوزيع
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 px-4 py-4">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted">قوالب جاهزة:</span>
                {TEMPLATES.map((t) => (
                  <button key={t.key} type="button" onClick={() => applyTemplate(t)}
                          className="rounded-pill border border-mint-light bg-white px-3 py-1 text-xs font-medium text-mint-deep hover:bg-mint-tint">
                    {t.t}
                  </button>
                ))}
              </div>

              {cols.map((c) => {
                const its = draft.filter((x) => x.col === c.i);
                const sum = check.sums[c.i] ?? 0;
                const [txt, bar] = tone(sum, c.max);
                return (
                  <div key={c.i} className="rounded-card border border-line p-3">
                    <p className="text-sm font-semibold text-ink">
                      {c.label} <span className="num text-muted">({c.max})</span>
                      <span className="mr-1 text-[11px] font-normal text-faint">عمود في نور</span>
                    </p>
                    <div className="mt-2 space-y-2">
                      {its.map((it) => (
                        <div key={it.id} className="flex flex-wrap items-center gap-1.5 border-b border-line/60 pb-2 last:border-0 sm:border-0 sm:pb-0">
                          <input value={it.label} onChange={(e) => editItem(it.id, { label: e.target.value })} maxLength={40}
                                 placeholder="اسم البند، مثل: التلاوة" aria-label="اسم البند"
                                 className="field h-10 min-w-0 basis-full py-0 sm:basis-auto sm:flex-1" />
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => editItem(it.id, { max: clampInt((Number(it.max) || 0) - 1, c.max) })}
                                    className="h-10 w-9 shrink-0 rounded-sm2 border border-line text-lg font-bold text-ink hover:bg-canvas">−</button>
                            <input type="number" inputMode="numeric" min={0} max={c.max} placeholder="0" aria-label="درجة البند"
                                   value={it.max} onChange={(e) => editItem(it.id, { max: clampInt(e.target.value, c.max) })}
                                   className="num field h-10 w-16 py-0 text-center text-base font-bold" />
                            <button type="button" onClick={() => editItem(it.id, { max: clampInt((Number(it.max) || 0) + 1, c.max) })}
                                    className="h-10 w-9 shrink-0 rounded-sm2 border border-line text-lg font-bold text-ink hover:bg-canvas">+</button>
                          </div>
                          <div className="flex overflow-hidden rounded-sm2 border border-line text-xs">
                            {[["box", "خانات ✓"], ["score", "درجة"]].map(([k, t]) => (
                              <button key={k} type="button" onClick={() => editItem(it.id, { type: k })}
                                      className={`px-2.5 py-2.5 font-medium ${it.type === k ? "bg-mint-deep text-white" : "bg-paper text-muted hover:bg-canvas"}`}>
                                {t}
                              </button>
                            ))}
                          </div>
                          <button type="button" onClick={() => removeItem(it.id)} aria-label="حذف البند"
                                  className="mr-auto rounded-sm2 px-2 py-2 text-xs text-absent hover:bg-absent/10 sm:mr-0">حذف</button>
                        </div>
                      ))}
                      <button type="button" onClick={() => addItem(c.i)} className="text-sm font-medium text-mint-deep hover:underline">
                        + إضافة بند
                      </button>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className={`font-bold ${txt}`}>
                        المجموع <span className="num">{sum}</span> من <span className="num">{c.max}</span>
                        {sum < c.max && <> — باقٍ <span className="num">{c.max - sum}</span></>}
                        {sum > c.max && <> — زائد <span className="num">{sum - c.max}</span></>}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                      <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${Math.min(100, (sum / c.max) * 100)}%` }} />
                    </div>
                  </div>
                );
              })}

              <div className="flex flex-wrap items-center gap-3">
                <button onClick={saveWeights} disabled={!check.ok || wSaving} className="btn-primary disabled:opacity-40">
                  اعتماد التوزيع
                </button>
                {weights && (
                  <button onClick={() => { setEditingW(false); setDraft(weights.map((x) => ({ ...x, max: String(x.max) }))); }}
                          className="text-xs text-muted hover:underline">إلغاء</button>
                )}
                {!check.ok && draft.some((x) => !x.label.trim() || !(Number(x.max) > 0)) && (
                  <span className="text-xs text-warning">لكل بند اسم ودرجة.</span>
                )}
              </div>
              <ul className="list-disc space-y-0.5 pr-4 text-[11px] leading-relaxed text-muted">
                <li>«خانات ✓» خانة لكل درجة تؤشّر عليها، وتناسب الدرجات الصغيرة كالواجبات. و«درجة» رقم تكتبه، ويناسب الاختبار أو التلاوة.</li>
                <li>يسري التوزيع على كل فصولك في هذه المادة بالصف نفسه، وعلى الفترتين.</li>
                <li>ما ترصده هنا يملأ «كشف رصد الدرجات» تلقائيًا لكل عمود اكتملت بنوده، ويبقى لك تعديل الكشف.</li>
                <li>إن حذفت بندًا أو خفّضت درجته بعد الرصد تُخفى خاناته الزائدة ولا تُحذف.</li>
              </ul>
              {wMissing && (
                <p className="rounded-sm2 bg-warning-light px-3 py-2 text-[11px] text-warning">
                  يُحفظ التوزيع على هذا الجهاز مؤقتًا حتى يُنفَّذ ملف supabase/follow_up_v3.sql في قاعدة البيانات.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {group && weights && !editingW && activeItem && (
        <>
          {/* البند */}
          <section className="card space-y-2 p-4">
            <h2 className="text-sm font-semibold text-ink">البند الذي تعمل عليه الآن</h2>
            <div className="flex flex-wrap gap-2">
              {items.map((it) => (
                <button key={it.id} onClick={() => setItemKey(it.id)}
                  className={"rounded-full border px-4 py-2 text-sm font-medium transition " +
                    (activeItem.id === it.id ? "border-mint-deep bg-mint-deep text-white" : "border-line bg-paper text-ink hover:bg-canvas")}>
                  {it.label}<span className="num mr-1 opacity-80">({it.max})</span>
                </button>
              ))}
            </div>
          </section>

          {/* قائمة التأشير */}
          <section className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">
                {activeItem.label} — <span className="num">{activeItem.max}</span> درجة
                <span className="mr-1 text-[11px] font-normal text-faint">({cols.find((c) => c.i === activeItem.col)?.label})</span>
              </h2>
              <span className="text-xs text-muted">{group.subject} · {GRADE_NAMES[group.grade] ?? ""} فصل {group.class_no}</span>
            </div>

            {activeItem.type === "box" && (
              <div className="space-y-2 border-b border-line bg-canvas/60 px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-4 text-[11px]">
                  <span className="flex items-center gap-1.5"><Box state="1" small /> ضغطة: صح تُحتسب درجة</span>
                  <span className="flex items-center gap-1.5"><Box state="0" small /> ضغطتان: خطأ</span>
                  <span className="flex items-center gap-1.5"><Box state="" small /> ثلاث: تُمسح</span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <span className="ml-1 text-[11px] text-muted">صح للجميع في الخانة:</span>
                  {Array.from({ length: activeItem.max }, (_, i) => i + 1).map((n) => (
                    <button key={n} onClick={() => checkColumn(n)} title={`✓ للخانة ${n} لكل من خانته فارغة`}
                      className="num h-6 min-w-6 rounded border border-line bg-paper px-1 text-[11px] font-semibold text-mint-deep hover:bg-mint-tint">
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {marksLoading ? (
              <div className="animate-pulse divide-y divide-line">
                {group.students.map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="h-3 w-4 rounded bg-line" /><div className="h-3.5 flex-1 rounded bg-line" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="divide-y divide-line">
                {group.students.map((s, idx) => {
                  const st = saveState[s.id];
                  const sc = activeItem.type === "box" ? boxScore(s.id, activeItem) : null;
                  return (
                    <div key={s.id} className="px-4 py-2.5 hover:bg-canvas/60">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                        <div className="flex min-w-0 items-center gap-2 sm:w-56 sm:shrink-0 sm:pt-1">
                          <span className="num w-6 shrink-0 text-xs text-muted">{idx + 1}</span>
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{s.full_name}</span>
                          {sc && (
                            <span className={`num shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-bold ${
                              sc.ok === activeItem.max ? "bg-mint-tint text-mint-deep" : "bg-canvas text-muted"}`}>
                              {sc.ok}/{activeItem.max}
                            </span>
                          )}
                        </div>

                        {activeItem.type === "box" ? (
                          <div className="flex flex-1 flex-wrap gap-1">
                            {Array.from({ length: activeItem.max }, (_, i) => i + 1).map((sn) => (
                              <button key={sn} type="button" onClick={() => cycleBox(s.id, activeItem.id, sn)}
                                aria-label={`الخانة ${sn}`}
                                className={sn % 5 === 0 && sn < activeItem.max ? "ml-2" : ""}>
                                <Box state={markValue(s.id, activeItem.id, sn)} n={sn} />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <input type="number" inputMode="decimal" min={0} max={activeItem.max} placeholder={`من ${activeItem.max}`}
                            value={markValue(s.id, activeItem.id, 1)}
                            onChange={(e) => setLocal(s.id, activeItem.id, 1, e.target.value)}
                            onBlur={(e) => saveMark(s.id, activeItem.id, 1, e.target.value)}
                            className="num w-24 rounded-sm2 border border-line bg-paper px-2 py-1.5 text-center text-sm font-semibold text-ink focus:border-mint-deep focus:outline-none" />
                        )}

                        <span className="w-16 shrink-0 text-[11px] sm:pt-1.5">
                          {st === "saving" && <span className="text-muted">جارٍ الحفظ…</span>}
                          {st === "saved" && <span className="text-mint-deep">تم الحفظ</span>}
                          {st === "error" && <span className="text-danger">تعذّر الحفظ</span>}
                        </span>
                      </div>
                      {st === "error" && errorMsg[s.id] && (
                        <p className="mt-1 mr-8 text-[11px] leading-relaxed text-danger">{errorMsg[s.id]}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* التصدير */}
          <section className="card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-ink">تصدير</h2>
            <button onClick={printGroup} disabled={busy} className="btn-primary w-full disabled:opacity-40 sm:w-auto">
              تصدير وطباعة هذا السجل
            </button>
            <p className="text-xs leading-relaxed text-muted">
              يصدّر السجل ببنود كل عمود: الخانات بعلامات الصح والخطأ، والدرجات، ومجموع كل عمود والمجموع من{" "}
              <span className="num">{periodMax}</span>، لهذه المادة والفصل والفترة الحالية.
            </p>
          </section>
        </>
      )}

      {group && (!weights || editingW) && (
        <div className="card px-6 py-10 text-center">
          <p className="font-semibold text-ink">وزّع الدرجات أولًا</p>
          <p className="mt-1.5 text-sm text-muted">
            اعتمد توزيع الـ<span className="num">{periodMax}</span> درجة على البنود في الشريط أعلاه، فتظهر خانات الطلاب.
          </p>
        </div>
      )}
    </div>
  );
}

/* خانة واحدة: فارغة، أو ✓ أخضر، أو ✗ أحمر */
function Box({ state, n, small = false }) {
  const size = small ? "h-5 w-5 text-[11px]" : "h-8 w-8 text-base";
  if (state === "1") {
    return <span className={`grid ${size} place-items-center rounded-md border-2 border-[#3E8E5E] bg-[#DDF3E6] font-bold text-[#1F6B45]`}>✓</span>;
  }
  if (state === "0") {
    return <span className={`grid ${size} place-items-center rounded-md border-2 border-[#E08A80] bg-[#FCE4E1] font-bold text-[#B02A2A]`}>✗</span>;
  }
  return (
    <span className={`grid ${size} place-items-center rounded-md border-2 border-line bg-paper text-[10px] text-faint`}>
      {n ?? ""}
    </span>
  );
}
