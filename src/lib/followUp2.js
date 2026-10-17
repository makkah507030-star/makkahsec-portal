// src/lib/followUp2.js
/* =====================================================================
   سجل المتابعة الإلكتروني 2: توزيع المعلم درجات الفترة على بنود يسمّيها،
   وحساب درجة كل عمود من أعمدة نور منها لكشف رصد الدرجات.

   • كل بند يتبع عمودًا من أعمدة الفترة كما في نور (lib/gradeSheets.js)،
     ومجموع بنود كل عمود يساوي سقفه، فيخرج الكشف مطابقًا لنور.
   • البند «خانات»: خانة لكل درجة (✓ تُحتسب، ✗ لا)، أو «درجة»: رقم يُكتب.
   • التوزيع في teacher_follow_up_weights.weights لكل معلم × مادة × عام × فصل دراسي:
       { v: 2, dists: { "<بنية الأعمدة>": [ {id, label, max, type, col}, … ] } }
     بنية الأعمدة (shapeSig) تفصل الصفوف التي تختلف أعمدة المادة فيها.
     والصيغة الأولى { homework, participation, classwork } تُقرأ كما هي.
   • الرصد في teacher_follow_up ببند r2_<id> (للخانات slot_no لكل خانة، وللدرجة 1).
   ===================================================================== */
import { configFor } from "./gradeSheets";

export const LOG_PERIODS = { period1: "الفترة الأولى", period2: "الفترة الثانية" };

/** أعمدة الفترة للمادة والصف كما في نور */
export function logColumns(subject, grade) {
  return configFor(subject, grade).periodGroups.flatMap((x) => x.cols).map((c, i) => ({ i, label: c.label, max: c.max }));
}
export const shapeSig = (cols) => cols.map((c) => `${c.label}:${c.max}`).join("|");

const isTasks = (c) => c.label.startsWith("المهام الأدائية");
export const newItemId = () => `c${Math.random().toString(36).slice(2, 8)}`;

/** التوزيع المعتاد: عمود المهام على الواجبات والمشاركة والتطبيقات الصفية، وغيره درجة واحدة باسمه */
export function defaultItems(cols) {
  return cols.flatMap((c) => (isTasks(c) && c.max === 40
    ? [
        { id: "homework", label: "الواجبات", max: 15, type: "box", col: c.i },
        { id: "participation", label: "المشاركة", max: 15, type: "box", col: c.i },
        { id: "classwork", label: "التطبيقات الصفية", max: 10, type: "box", col: c.i },
      ]
    // معرّف ثابت: «written» للعمود الأول كما في الصيغة الأولى، فيبقى ما رُصد فيه
    : [{ id: c.i === 0 ? "written" : `col${c.i}`, label: c.label, max: c.max, type: "score", col: c.i }]));
}

/** قوالب جاهزة: تُعيد توزيع كل الأعمدة */
export const TEMPLATES = [
  { key: "default", t: "التوزيع المعتاد", make: defaultItems },
  {
    key: "units", t: "اختبار لكل وحدة",
    make: (cols) => cols.flatMap((c) => (isTasks(c) ? defaultItems([c]) : split(c, 4, (n) => `اختبار الوحدة ${n}`, "score"))),
  },
  {
    key: "quran", t: "القرآن الكريم: تلاوة وحفظ",
    make: (cols) => cols.flatMap((c) => (isTasks(c) ? defaultItems([c]) : [
      { id: newItemId(), label: "التلاوة", max: Math.ceil(c.max / 2), type: "score", col: c.i },
      { id: newItemId(), label: "الحفظ", max: Math.floor(c.max / 2), type: "score", col: c.i },
    ])),
  },
];
function split(c, n, name, type) {
  const base = Math.floor(c.max / n), extra = c.max - base * n;
  return Array.from({ length: n }, (_, k) => ({ id: newItemId(), label: name(k + 1), max: base + (k < extra ? 1 : 0), type, col: c.i }));
}

/** بنود التوزيع لهذه الأعمدة من المحفوظ، أو null إن لم يُعتمد توزيع صالح لها */
export function itemsFor(weights, cols) {
  if (!weights) return null;
  if (weights.v === 2) {
    const items = weights.dists?.[shapeSig(cols)];
    return validDist(items, cols).ok ? items : null;
  }
  // الصيغة الأولى: بنود المهام الثلاثة بدرجاتها، وبقية الأعمدة كالتوزيع المعتاد
  const tasks = cols.find(isTasks);
  const old = ["homework", "participation", "classwork"];
  if (!tasks || old.reduce((a, k) => a + (Number(weights[k]) || 0), 0) !== tasks.max) return null;
  const labels = { homework: "الواجبات", participation: "المشاركة", classwork: "التطبيقات الصفية" };
  const items = [
    ...cols.filter((c) => c !== tasks).flatMap((c) => defaultItems([c])),
    ...old.filter((k) => Number(weights[k]) > 0).map((k) => ({ id: k, label: labels[k], max: Number(weights[k]), type: "box", col: tasks.i })),
  ];
  return items.sort((a, b) => a.col - b.col);
}

/** صلاحية التوزيع: كل بند باسم ودرجة، ومجموع كل عمود يساوي سقفه */
export function validDist(items, cols) {
  if (!Array.isArray(items) || !items.length) return { ok: false, sums: {} };
  const sums = Object.fromEntries(cols.map((c) => [c.i, 0]));
  let ok = true;
  items.forEach((it) => {
    if (!(it.col in sums) || !String(it.label ?? "").trim() || !(Number(it.max) > 0)) ok = false;
    else sums[it.col] += Number(it.max);
  });
  cols.forEach((c) => { if (sums[c.i] !== c.max) ok = false; });
  return { ok, sums };
}

/** يدمج توزيع هذه الأعمدة في المحفوظ دون أن يمسّ توزيعات الأعمدة الأخرى */
export function mergeDist(weights, cols, items) {
  const dists = weights?.v === 2 ? { ...weights.dists } : {};
  dists[shapeSig(cols)] = items.map(({ id, label, max, type, col }) => ({ id, label: label.trim(), max: Number(max), type, col }));
  return { v: 2, dists };
}

/** درجة الطالب في بند من رصده: { [`${itemId}::${slot}`]: mark } ← رقم، أو null إن لم يُرصد شيء */
export function itemScore(it, get) {
  if (it.type === "score") {
    const v = get(it.id, 1);
    return v === undefined || v === null || v === "" || !isFinite(Number(v)) ? null : Math.min(Number(v), it.max);
  }
  let any = false, ok = 0;
  for (let sn = 1; sn <= it.max; sn++) {
    const v = get(it.id, sn);
    if (v === undefined || v === null || v === "") continue;
    any = true;
    if (Number(v) > 0) ok++;
  }
  return any ? ok : null;
}

/** درجات أعمدة نور للطالب: { [col]: رقم } لكل عمود رُصدت كل بنوده */
export function columnScores(items, get) {
  const out = {}, open = {};
  items.forEach((it) => {
    const s = itemScore(it, get);
    if (s === null) open[it.col] = true;
    else out[it.col] = (out[it.col] ?? 0) + s;
  });
  Object.keys(open).forEach((c) => { delete out[c]; });
  return out;
}

/* ——— لكشف رصد الدرجات: درجات الأعمدة من السجل ———
   ترجع { [g.key]: { period1: { studentId: { col: درجة } }, period2: {…} } } */
export async function loadLogMarks(supabase, { uid, year, term, groups }) {
  if (!uid || !groups.length) return {};
  const { data: t } = await supabase.from("teachers").select("id").eq("user_id", uid).maybeSingle();
  if (!t) return {};
  const subjects = [...new Set(groups.map((g) => g.subject))];
  const classIds = [...new Set(groups.map((g) => g.class_id))];
  const [{ data: ws }, { data: rows }] = await Promise.all([
    supabase.from("teacher_follow_up_weights").select("subject, weights")
      .eq("teacher_id", t.id).eq("academic_year", String(year)).eq("term", term).in("subject", subjects),
    supabase.from("teacher_follow_up").select("class_id, subject, period, student_id, item_key, slot_no, mark")
      .eq("teacher_id", t.id).eq("academic_year", String(year)).eq("term", term)
      .in("class_id", classIds).like("item_key", "r2_%"),
  ]);
  const out = {};
  groups.forEach((g) => {
    const cols = logColumns(g.subject, g.grade);
    const items = itemsFor((ws ?? []).find((w) => w.subject === g.subject)?.weights, cols);
    if (!items) return;
    const res = { period1: {}, period2: {} };
    Object.entries(LOG_PERIODS).forEach(([p, label]) => {
      const marks = {};
      (rows ?? []).forEach((r) => {
        if (String(r.class_id) !== String(g.class_id) || r.subject !== g.subject || r.period !== label || r.mark === null) return;
        marks[`${r.student_id}::${r.item_key.slice(3)}::${r.slot_no}`] = r.mark;
      });
      g.students.forEach((st) => {
        const sc = columnScores(items, (id, sn) => marks[`${st.id}::${id}::${sn}`]);
        if (Object.keys(sc).length) res[p][st.id] = sc;
      });
    });
    out[g.key] = res;
  });
  return out;
}
