-- =====================================================================
-- قسم التقويم والاعتماد المدرسي (5): نتائج الاختبارات الوطنية الرسمية (بطاقات القدرات والتحصيلي
-- من هيئة تقويم التعليم والتدريب) لكل عام: المتوسط والتوزيع والمقارنة بالإدارة والمملكة والترتيب
-- والمجالات الفرعية وملف الهيئة. تُقاس بها المؤشرات 3-1-1-1 إلى 3-1-1-4، وأول عام خط الأساس للمستحدثين.
-- يُدخلها مشرف اللجنة، ويقرؤها أعضاء لجنة التميز ولجنة التحصيل والموجهون (صفحة «اختبارات قياس»).
-- يُنفَّذ بعد acc_4.sql، وتكرار التنفيذ آمن، ويُدرج بيانات 1447هـ إن لم تُدخل.
-- =====================================================================

create table if not exists public.acc_national (
  id uuid primary key default gen_random_uuid(),
  test text not null check (test in ('tahsili', 'qudrat')),
  academic_year text not null,
  track text not null default 'علمي',
  takers int,                                   -- المختبرون
  avg numeric,                                  -- متوسط الدرجات
  change_pct numeric,                           -- التغير عن العام السابق كما في البطاقة
  high_pct numeric, mid_pct numeric, low_pct numeric,   -- 75 فأكثر، 65 إلى أقل من 75، أقل من 65
  school_avg numeric, district_avg numeric, kingdom_avg numeric,
  kingdom_rank int, kingdom_total int, kingdom_above numeric,     -- أعلى من نسبة من المدارس
  district_rank int, district_total int, district_above numeric,
  subs jsonb not null default '[]',             -- المجالات الفرعية [{ t, v }]
  subs_estimated boolean not null default false, -- القيم مقدّرة من أطوال الأشرطة لا مكتوبة في البطاقة
  file_path text, notes text,
  created_by_name text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (test, academic_year, track)
);

alter table public.acc_national enable row level security;
drop policy if exists acc_national_read on public.acc_national;
create policy acc_national_read on public.acc_national for select to authenticated
  using (public.acc_member() or public.ach_all() or public.ach_is_member()
         or public.has_admin_role(array['counselor_1', 'counselor_2', 'counselor_3']));
drop policy if exists acc_national_write on public.acc_national;
create policy acc_national_write on public.acc_national for all to authenticated
  using (public.acc_coord()) with check (public.acc_coord());
grant select, insert, update, delete on public.acc_national to authenticated;

-- بطاقات 1447هـ (المسار العلمي): المجالات الفرعية مقدّرة من الرسم لأن البطاقة لا تكتب أرقامها
insert into public.acc_national (test, academic_year, takers, avg, change_pct, high_pct, mid_pct, low_pct,
  school_avg, district_avg, kingdom_avg, kingdom_rank, kingdom_total, kingdom_above, district_rank, district_total, district_above,
  subs, subs_estimated, notes, created_by_name)
values
  ('tahsili', '1447', 335, 63.7, 1.82, 19.7, 15.8, 64.4, 63.65, 62.45, 62.39, 662, 2192, 69.83, 34, 140, 76.26,
   '[{"t":"الأحياء","v":50},{"t":"الفيزياء","v":47},{"t":"الكيمياء","v":46},{"t":"الرياضيات","v":45}]', true,
   'بطاقة الاختبار التحصيلي 1447هـ من هيئة تقويم التعليم والتدريب. خط الأساس للمؤشر 3-1-1-3.', 'لجنة التميز'),
  ('qudrat', '1447', 354, 64.4, 1.03, 21.5, 17.5, 61, 65.72, 65.12, 64.35, 985, 2204, 55.33, 50, 141, 65,
   '[{"t":"الكمي","v":64},{"t":"اللفظي","v":64}]', true,
   'بطاقة القدرات العامة 1447هـ من هيئة تقويم التعليم والتدريب. خط الأساس للمؤشر 3-1-1-4.', 'لجنة التميز')
on conflict (test, academic_year, track) do nothing;

-- نهاية الجزء 1
