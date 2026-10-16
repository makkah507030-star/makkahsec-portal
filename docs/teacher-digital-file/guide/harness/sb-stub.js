import { d } from "./data.js";
const row = { teacher_user_id: "u", records: ["سجل الطلاب المتعثرين", "ملف الأنشطة"], code: "MS-7Q4K", color: "science", hidden: [], sentences: ["improve", "top"], appoint_year: 1434, perf_rating: 4.62, perf_year: 1447, rank: "معلم متقدم",
  madrasati: { lessons: 64, homework: 38, tests: 12, enrich: 9, weekly_plan: true }, activities: { class: [{ t: "التعلم التعاوني", n: 14 }], extra: [{ t: "الإذاعة المدرسية", n: 3 }] },
  other_wins: [{ t: "المركز الثاني في أولمبياد الرياضيات على مستوى المنطقة", d: "تأهل أحد طلابه للمرحلة الوطنية" }], enabled_at: "2026-10-10T08:00:00Z", distribution: { items: [{ subject: "رياضيات 2-1", classes: [201, 202, 203], file: "توزيع-ثاني.xlsx", weeks: [{ n: 7, t: "المتسلسلات، مراجعة" }, { n: 8, t: "المتتابعات الحسابية، المتتابعات الهندسية" }, { n: 9, t: "مجموع المتسلسلة الهندسية" }] }, { subject: "رياضيات 1-1", classes: [101, 102], file: null, weeks: [{ n: 8, days: ["الدوال وتمثيلها", "مجال الدالة ومداها", "", "تدريبات على الدوال", "اختبار قصير"], t: "الأحد: الدوال وتمثيلها، الاثنين: مجال الدالة ومداها، الأربعاء: تدريبات على الدوال، الخميس: اختبار قصير" }] }] } };
const opinions = [{ id: "o1", author_role: "principal", author_name: "عبدالله بن محمد الزهراني", body: "معلم يصنع الفرق في فصوله: تخطيط منظّم، ومتابعة دقيقة لكل طالب، ومبادرة دائمة في مجتمع التعلم.", written_at: "2026-10-12T08:00:00Z", decision: "shown" },
  { id: "o2", author_role: "deputy_academic", author_name: "سعيد بن علي الغامدي", body: "تخطيطه للدروس مسبق ومنظّم، وسجل متابعته مكتمل أولًا بأول.", written_at: "2026-10-05T08:00:00Z", decision: "pending" }];
const visits = [
  { id: 0, visitor_name: "أ. سعد الغامدي", visitor_org: "مدير المدرسة", via: "wa", started_at: "2026-10-16T09:10:00Z", seconds: 540, note: "ملف منظم ومميز، بارك الله فيك. أقترح إضافة نماذج من أوراق العمل في قسم الشواهد." },
  { id: 1, visitor_name: "مشرف الرياضيات", visitor_org: "مكتب التعليم", via: "qr", started_at: "2026-10-15T06:04:00Z", seconds: 372 },
  { id: 2, visitor_name: "فريق التقويم الخارجي", visitor_org: "هيئة تقويم التعليم والتدريب", via: "qr", started_at: "2026-10-14T07:30:00Z", seconds: 731 },
  { id: 3, visitor_name: null, visitor_org: null, via: "link", started_at: "2026-10-12T10:00:00Z", seconds: 95 },
];
const admin = [{ ...row, users: { full_name: "فيصل بن سالم القرشي" } }, { teacher_user_id: "v", code: "MS-3HKD", enabled_at: "2026-10-05T08:00:00Z", disabled_at: "2026-10-13T08:00:00Z", disabled_reason: "نقل من المدرسة", users: { full_name: "خالد بن محمد الحربي" } }];
function q(table) {
  const res = { data: table === "dfile_visits" ? visits : table === "dfile_opinions" ? opinions : table === "teacher_dfiles" ? (location.search.includes("admin") ? admin : location.search.includes("new") ? null : row) : null, error: null };
  const o = { select() { return o; }, eq() { return o; }, order() { return o; }, limit() { return o; }, update() { return { eq: () => Promise.resolve({ error: null }) }; },
    insert() { return o; }, single() { return Promise.resolve({ data: row }); }, maybeSingle() { return Promise.resolve({ data: location.search.includes("new") ? null : row, error: null }); },
    then(f, r) { return Promise.resolve(res).then(f, r); } };
  return o;
}
export const supabase = { from: q,
  rpc: (fn) => Promise.resolve({ data: fn === "dfile_visit_start" ? "vid-1" : fn === "dfile_visit_note" ? true : fn === "dfile_opinion_list" ? [{ teacher_user_id: "u", name: "فيصل بن سالم القرشي", body: opinions[0].body, decision: "shown", written_at: "2026-10-12" }, { teacher_user_id: "v", name: "خالد بن محمد الحربي", body: null, decision: null }] : fn === "dfile_public" ? { status: "ok", settings: row, data: d } : fn === "dfile_data" ? d : null, error: null }),
  storage: { from: () => ({ download: async () => ({ data: null }), createSignedUrl: async () => ({ data: null }) }) },
  auth: { getUser: async () => ({ data: { user: { id: "x" } } }) } };
export const isConfigured = true;
