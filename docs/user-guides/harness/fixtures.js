// بيانات تجريبية للقطات الأدلة: أسماء وأرقام وهمية، لا بيانات حقيقية.
// عناصر نموذج تقييم الأداء وبنوده من ملفات القاعدة نفسها، فتطابق البوابة.
import perfSql from "../../../supabase/teacher_performance.sql?raw";
import perfPortalSql from "../../../supabase/teacher_performance_portal.sql?raw";
// تاريخ اللقطات الثلاثاء 2026-11-10 (shoot.mjs)، فيوم الأسبوع في الجدول 3.
export const TODAY = "2026-11-10";
export const USERS = {
  teacher:  { id: "u-t1", username: "1010101010", full_name: "أحمد بن محمد العتيبي", role: "teacher", is_active: true, must_change_pw: false },
  student:  { id: "u-s1", username: "1122334455", full_name: "عبدالله خالد الحربي", role: "student", is_active: true, must_change_pw: false },
  guardian: { id: "u-g1", username: "0551234567", full_name: "خالد سعد الحربي", role: "guardian", is_active: true, must_change_pw: false },
  clerk:     { id: "u-a1", username: "1020304050", full_name: "سامي عبدالله المالكي", role: "admin", roles: ["clerk", "clerk_3"] },
  counselor: { id: "u-a2", username: "1020304051", full_name: "فهد علي الشهري", role: "admin", roles: ["counselor_1"] },
  health:    { id: "u-a3", username: "1020304052", full_name: "ماجد حسن الثقفي", role: "admin", roles: ["health_counselor"] },
  scilab:    { id: "u-a4", username: "1020304053", full_name: "نايف سعد الجهني", role: "admin", roles: ["science_labs"] },
  globe:     { id: "u-a5", username: "1020304054", full_name: "عمر ناصر السلمي", role: "admin", roles: ["globe_program"] },
  gifted:    { id: "u-a6", username: "1020304055", full_name: "طلال فهد الهذلي", role: "admin", roles: ["gifted_program"] },
  principal: { id: "u-p1", username: "1020304060", full_name: "عبدالرحمن صالح الزهراني", role: "admin", roles: ["principal"] },
  scouts:    { id: "u-a7", username: "1020304056", full_name: "بدر صالح القرشي", role: "admin", roles: ["custom_1"] },
};
Object.values(USERS).forEach((u) => { u.is_active = true; u.must_change_pw = false; });

const FIRST = ["عبدالله", "محمد", "فيصل", "سعود", "عبدالرحمن", "يوسف", "تركي", "خالد", "ريان", "عمر", "بندر", "ماجد", "نواف", "سلطان", "مشاري", "زياد", "حمزة", "إبراهيم", "أنس", "مهند", "راكان", "عبدالعزيز", "سامي", "ياسر"];
const FATHER = ["خالد", "سعد", "ناصر", "عبدالله", "فهد", "علي", "حسن", "صالح"];
const LAST = ["الحربي", "الغامدي", "الزهراني", "القرشي", "الشهري", "المالكي", "العتيبي", "الثقفي", "الهذلي", "اللحياني", "الجهني", "السلمي"];
export const CLASSES = [
  { id: "c1", grade: 1, class_no: 3, name: "أول ثانوي 3" },
  { id: "c2", grade: 2, class_no: 1, name: "ثاني ثانوي 1" },
  { id: "c3", grade: 3, class_no: 2, name: "ثالث ثانوي 2" },
];
export const STUDENTS = CLASSES.flatMap((c, ci) => FIRST.slice(0, 22).map((f, i) => ({
  id: `s${ci}${String(i).padStart(2, "0")}`, full_name: `${FIRST[(i + ci * 5) % FIRST.length]} ${FATHER[(i + ci) % FATHER.length]} ${LAST[(i * 7 + ci) % LAST.length]}`,
  national_id: String(1100000000 + ci * 1000 + i), class_id: c.id, grade: c.grade, class_no: c.class_no, user_id: ci === 0 && i === 0 ? "u-s1" : null,
  classes: c,
})));
STUDENTS[0].full_name = "عبدالله خالد الحربي";

const SUBJ = { id: "sub1", name: "الرياضيات" };
const T1 = { id: "t1", user_id: "u-t1", full_name: "أحمد بن محمد العتيبي", specialization: "رياضيات", mobile: "0500000000" };
const TEACHERS = [T1, { id: "t2", user_id: "u-t2", full_name: "سعيد عمر الغامدي", specialization: "فيزياء" }, { id: "t3", user_id: "u-t3", full_name: "ماجد علي الزهراني", specialization: "لغة عربية" }];
// حصص المعلم: [يوم، حصة، فصل]
const SLOTS = [[1, 1, 0], [1, 3, 1], [2, 2, 2], [2, 4, 0], [3, 1, 1], [3, 2, 0], [3, 4, 2], [3, 6, 1], [4, 2, 0], [4, 5, 2], [5, 1, 1], [5, 3, 0]];
const SCHEDULE = SLOTS.map(([d, p, c], i) => ({
  id: `sch${i}`, day_of_week: d, period_no: p, class_id: CLASSES[c].id, teacher_id: "t1", subject_id: "sub1", academic_year: "1448", term: 1,
  classes: CLASSES[c], subjects: SUBJ, teachers: { full_name: T1.full_name },
}));
const PT = [["period", 1, "الأولى", "07:00", "07:45"], ["period", 2, "الثانية", "07:45", "08:30"], ["period", 3, "الثالثة", "08:30", "09:15"],
  ["break", null, "الفسحة", "09:15", "09:35"], ["period", 4, "الرابعة", "09:35", "10:20"], ["period", 5, "الخامسة", "10:20", "11:05"],
  ["prayer", null, "الصلاة", "11:05", "11:25"], ["period", 6, "السادسة", "11:25", "12:10"], ["period", 7, "السابعة", "12:10", "12:55"]]
  .map(([kind, period_no, label, s, e], i) => ({ kind, period_no, label, start_time: s + ":00", end_time: e + ":00", sort_order: i, season: "summer" }));
const SETTINGS = Object.entries({ active_year: "1448", active_term: "1", active_year_label: "1447/1448هـ", active_season: "summer" })
  .map(([key, value]) => ({ key, value }));

// عناصر الأداء وبنوده من teacher_performance.sql، وحالة البند من teacher_performance_portal.sql
const PERF_ELEMENTS = [...perfSql.matchAll(/\('(e\d\d)', '([^']+)', (\d+), (\d+), (true|false)\)/g)]
  .map(([, key, title, w, o, ev]) => ({ key, title, weight: +w, sort_order: +o, evaluator_only: ev === "true", track: "teacher" }));
const portalOf = (() => {
  const m = {};
  for (const [, kind, keys] of perfPortalSql.matchAll(/portal = '(\w+)' where key in \(([^)]*)\)/g)) keys.match(/e\d\d_\d\d/g).forEach((k) => { m[k] = kind; });
  return (it) => m[it.key] ?? (it.is_record ? "record" : it.element_key === "e01" ? null : "partial");
})();
const PERF_ITEMS = [...perfSql.matchAll(/\('(e\d\d_\d\d)', '(e\d\d)', (\d+), '([^']+)', '(\w+)', (true|false)\)/g)]
  .map(([, key, element_key, o, title, source, rec]) => ({ key, element_key, sort_order: +o, title, source, is_record: rec === "true", is_active: true }))
  .map((it) => ({ ...it, portal: portalOf(it) }));
// شواهد مرفوعة لبعض البنود اليدوية
const PERF_EVIDENCE = PERF_ITEMS.filter((it) => it.portal === "manual").slice(0, 9).map((it, i) => ({
  id: `ev${i}`, teacher_user_id: "u-t1", academic_year: "1448", item_key: it.key, title: "شاهد " + it.title.split(" ").slice(0, 3).join(" "),
  source: "upload", file_path: "x.pdf", count: 1 + (i % 3), event_date: "2026-10-1" + (i % 9), created_at: "2026-10-12T08:00:00Z" }));
const PERF_AUTO = ["e03_01", "e03_02", "e03_06", "e05_02", "e05_04", "e10_01", "e10_02", "e11_02", "e11_03"]
  .map((k, i) => ({ teacher_user_id: "u-t1", item_key: k, cnt: 4 + i * 3, last_at: "2026-11-0" + (1 + i % 8) + "T09:00:00Z" }));

const QUIZZES = [
  { id: "q1", teacher_id: "u-t1", title: "اختبار قصير: الدوال الخطية", subject_name: "الرياضيات", grade: 1, mode: "omr", status: "marking", total_marks: 10, exam_date: "2026-11-04", period: "p1", created_at: "2026-11-01" },
  { id: "q2", teacher_id: "u-t1", title: "تحقق من الفهم: المتباينات", subject_name: "الرياضيات", grade: 2, mode: "online", status: "closed", total_marks: 10, exam_date: "2026-10-28", period: "p1", created_at: "2026-10-25" },
  { id: "q3", teacher_id: "u-t1", title: "الاختبار الأول: المصفوفات", subject_name: "الرياضيات", grade: 3, mode: "paper", status: "ready", total_marks: 20, exam_date: "2026-11-12", period: "p1", created_at: "2026-11-05" },
  { id: "q4", teacher_id: "u-t1", title: "اختبار دون إنترنت: الإحصاء", subject_name: "الرياضيات", grade: 2, mode: "offline", status: "draft", total_marks: 15, exam_date: "2026-11-16", period: "p2", created_at: "2026-11-06" },
];
const CIRCULARS = [
  ["تنظيم الاختبارات القصيرة للفترة الأولى", "إدارة التعليم بمكة", "تعليمي", true, null],
  ["مواعيد اجتماع أولياء الأمور", "إدارة المدرسة", "إداري", true, "2026-11-08T08:00:00Z"],
  ["دليل الإجراءات التنظيمية للمدارس", "وزارة التعليم", "تنظيمي", false, "2026-10-20T08:00:00Z"],
].map(([subject, source, category, needs_ack, ack], i) => ({ circular_id: `cr${i}`, user_id: "u-t1", read_at: ack, ack_at: ack,
  circulars: { id: `cr${i}`, seq: 40 + i, academic_year: "1448", direction: "in", subject, source, category, priority: i === 0 ? "urgent" : "normal",
    needs_ack, due_date: "2026-11-15", sent_at: `2026-11-0${9 - i * 3}T07:00:00Z`, closed_at: null } }));
const TEMPLATES = [
  ["certificate", "شهادة شكر وتقدير — طالب", "frm_student_thanks"], ["certificate", "شهادة شكر وتقدير — ولي أمر", "frm_guardian_thanks"],
  ["administrative", "طلب إجازة اضطرارية", "frm_leave"], ["administrative", "استمارة استدعاء ولي أمر", "frm_guardian_call"],
  ["official", "إفادة معلم", "frm_teacher_statement"], ["administrative", "طلب صيانة أو تجهيز", "frm_request"],
].map(([category, title, key], i) => ({ id: `tp${i}`, key, title, category, is_active: true, sort_order: i, allowed_roles: ["teacher", "admin"], fields: [], orientation: "portrait" }));
const CARDS = [["⏱", "دقيقة واحدة", "أنشطة سريعة لبداية الحصة"], ["🧩", "ألغاز ومنطق", "تحدٍّ ذهني للفرق"], ["📚", "قراءة ونقاش", "نص قصير وأسئلة"],
  ["🎯", "مسابقات", "مسابقة سريعة بين الصفوف"]].map(([emoji, label, desc], i) => ({ id: `ac${i}`, kind: "sub", published: true, sort: i, emoji, label, title: label, desc, body: desc, ring: "#3E8A62", soft: "#E6F5EC" }));

export const TABLES = {
  users: (me) => [me],
  teachers: (me) => (me.role === "teacher" ? [T1, ...TEACHERS.slice(1)] : TEACHERS),
  admin_roles: (me) => (me.roles ?? []).map((role_type) => ({ user_id: me.id, role_type })),
  guardian_student: [{ guardian_id: "gd1", student_id: "s000", relation: "أب", students: STUDENTS[0] }],
  teacher_granted_tabs: [{ teacher_id: "t1", tab_key: "computer_lab" }],
  guardians: (me) => (me.role === "guardian" ? [{ id: "gd1", user_id: "u-g1", student_id: "s000", full_name: me.full_name, mobile: "0551234567", is_active: true, students: STUDENTS[0] }] : []), custom_roles: [{ role_type: "custom_1", label: "قائد الفريق الكشفي", external: false }],
  // صلاحيات الأدوار غير الكاملة (role_permissions)
  role_permissions: [["clerk", "staff"], ["clerk_3", "staff"], ["counselor_1", "outreach"], ["counselor_1", "staff"], ["health_counselor", "outreach"],
    ["globe_program", "globe"], ["gifted_program", "gifted"], ["custom_1", "scouts"], ["science_labs", "staff"]].map(([role_type, permission]) => ({ role_type, permission })),
  sci_experiments: [["الأحياء 1", 1, "فحص الخلية النباتية بالمجهر", "مجهر ضوئي، شرائح زجاجية، بصل"], ["الأحياء 1", 2, "الكشف عن النشا في الأغذية", "محلول اليود، أنابيب اختبار"],
    ["الأحياء 1", 3, "انتشار المواد عبر الغشاء", "كيس ديلزة، محلول سكري"], ["الأحياء 2", 1, "تشريح القلب", "أدوات تشريح، قلب خروف"]]
    .map(([course, no, title, tools], i) => ({ id: i + 1, lab: "bio", course, grade: course.endsWith("1") ? 1 : 2, no, title, tools, page: 20 + i * 7, week: i + 3, kind: "lab", is_active: true })),
  sci_bookings: [[0, 2, 0, 1, "ready"], [1, 4, 1, 2, null], [2, 3, 2, 3, "missing"]].map(([d, p, c, e, prep], i) => ({ id: `sb${i}`, lab: "bio",
    booking_date: `2026-11-${String(9 + d).padStart(2, "0")}`, period_no: p, teacher_id: "t1", class_id: CLASSES[c].id, experiment_id: e, prep,
    teachers: { full_name: "سعيد عمر الغامدي" }, classes: CLASSES[c] })),
  sci_inventory: [["مجهر ضوئي", "جهاز", 12, "قطعة", "جيد", null], ["محلول اليود", "مادة", 3, "لتر", "جيد", "2027-03-01"], ["شرائح زجاجية", "أداة", 200, "قطعة", "جيد", null],
    ["كحول إيثيلي", "مادة", 2, "لتر", "جيد", "2026-12-01"]].map(([name, kind, qty, unit, status, expiry], i) => ({ id: i + 1, lab: "bio", name, kind, qty, unit, status, expiry, location: "خزانة " + (i + 1) })),
  settings: SETTINGS,
  period_times: PT,
  classes: CLASSES,
  subjects: [SUBJ],
  students: STUDENTS,
  schedule: SCHEDULE,
  student_enrollment: STUDENTS.map((s) => ({ student_id: s.id, class_id: s.class_id, status: "active", students: s, classes: s.classes })),
  perf_elements: PERF_ELEMENTS, perf_items: PERF_ITEMS, perf_evidence: PERF_EVIDENCE,
  qudrat_questions: [["quant", "arith", "إذا كان ثمن 3 أقلام 12 ريالًا، فما ثمن 5 أقلام؟", ["15", "18", "20", "24"], 2],
    ["quant", "algebra", "إذا كان 2س + 3 = 11، فما قيمة س؟", ["3", "4", "5", "7"], 1],
    ["verbal", "analogy", "قلم : كتابة", ["مقص : قص", "ورق : شجر", "باب : بيت", "ماء : نهر"], 0]]
    .map(([sec, skill, q, o, a], i) => ({ id: `qq${i}`, sec, skill, q, o, a, published: true, created_by: "u-t1", created_at: `2026-11-0${5 - i}T08:00:00Z` })),
  quizzes: QUIZZES, circular_recipients: CIRCULARS, form_templates: TEMPLATES, activity_cards: CARDS,
  class_attendance: SCHEDULE.flatMap((sc, k) => STUDENTS.filter((st) => st.class_id === sc.class_id).slice(0, 3).map((st, j) => ({
    schedule_id: sc.id, student_id: st.id, status: j === 2 ? "late" : "absent", attend_date: `2026-11-0${(k % 8) + 1}`, students: st, schedule: sc }))),
  academic_calendar: [{ kind: "term_start", start_date: "2026-08-23", is_active: true, academic_year: "1448", title: "بداية الفصل الأول" },
    { kind: "exam", start_date: "2027-01-03", end_date: "2027-01-14", is_active: true, title: "الاختبارات النهائية" }],
};
export const RPC = {
  sci_teacher_labs: (me) => (me.role === "teacher" ? ["bio"] : []), sci_manager: true,
  perf_auto_counts: PERF_AUTO, cult_me: { staff: true, member: false, amb: false, all: false },
  my_department: { department_id: "d1", department_name: "الرياضيات", is_head: false },
};
