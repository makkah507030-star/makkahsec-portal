-- =====================================================================
-- الثقافة المؤسسية (2): الخطة التنفيذية لسفير الثقافة 2026م بأنشطتها الـ24 كما في خطة الوزارة للمدارس،
-- وحالة كل نشاط (لم يبدأ، قيد التنفيذ، مكتمل، متعثر، مؤجل)، وتوثيق تنفيذه بالأثر والصور، وربطه بحدث
-- في «الأحداث والمناسبات». ومخزن خاص لصور التوثيق. يُنفَّذ بعد cult_1.sql، وتكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.cult_activities (
  id uuid primary key default gen_random_uuid(),
  program text not null,             -- rafah, takafu, values, hayyak, comm, care, innov, mazaya, ohi
  title text not null, due_date date, due_label text, target text, mechanism text,
  status text not null default 'todo' check (status in ('todo', 'doing', 'done', 'stuck', 'later')),
  event_id uuid references public.school_events(id) on delete set null,
  beneficiaries int, outcome text, photos text[] not null default '{}', done_at date,
  sort int not null default 0, updated_by_name text, updated_at timestamptz not null default now()
);
alter table public.cult_activities enable row level security;
drop policy if exists cult_act_read on public.cult_activities;
create policy cult_act_read on public.cult_activities for select to authenticated using (public.cult_member());
drop policy if exists cult_act_write on public.cult_activities;
create policy cult_act_write on public.cult_activities for all to authenticated using (public.cult_member()) with check (public.cult_member());
grant select, insert, update, delete on public.cult_activities to authenticated;

insert into public.cult_activities (program, title, due_date, due_label, target, mechanism, sort)
select * from (values
  ('rafah', 'تفعيل اليوم العالمي للإسعافات الأولية', date '2026-09-13', null, 'موظفو المدرسة', 'إبراز جهود المملكة في تفعيل الأيام العالمية والهدف منها: عرض تقديمي أو مقطع، أو استضافة طبيب بالتعاون مع وزارة الصحة وفق الأنظمة.', 1),
  ('rafah', 'تفعيل اليوم العالمي للزهايمر', date '2026-09-21', null, 'موظفو المدرسة', 'عرض تقديمي أو مقطع توعوي، أو استضافة مختص وفق الأنظمة.', 2),
  ('rafah', 'تفعيل اليوم العالمي للصحة النفسية', date '2026-10-11', null, 'موظفو المدرسة', 'عرض تقديمي أو مقطع توعوي، أو استضافة مختص وفق الأنظمة.', 3),
  ('rafah', 'تفعيل شهر التوعية بسرطان الثدي', null, 'أكتوبر', 'موظفو المدرسة', 'عرض تقديمي أو مقطع توعوي، أو استضافة طبيب بالتعاون مع وزارة الصحة.', 4),
  ('rafah', 'تفعيل اليوم العالمي للسكري', date '2026-11-15', null, 'موظفو المدرسة', 'عرض تقديمي أو مقطع توعوي، أو استضافة طبيب بالتعاون مع وزارة الصحة.', 5),
  ('rafah', 'اليوم العالمي لحقوق الإنسان', date '2026-10-12', null, 'موظفو المدرسة', 'عرض تقديمي أو مقطع توعوي.', 6),
  ('takafu', 'تفعيل اليوم العالمي للعصا البيضاء', date '2026-10-15', null, 'موظفو المدرسة', 'منشور أو عرض أو مشاركة.', 7),
  ('values', 'تفعيل قيمة الجودة: مبادرة «الجودة مسؤولية الجميع» لتعزيز الالتزام بالأنظمة وتحسين الخدمات والبيئة التعليمية', null, 'سبتمبر', 'موظفو المدرسة', 'اجتماع مدير المدرسة مع سفير الثقافة حول آلية التنفيذ، ثم التنفيذ والتوثيق.', 8),
  ('values', 'تفعيل قيمة الالتزام: لقاءات لمدير المدرسة لتوعية المعلمين والموظفين بأثر الالتزام في جودة العمل', null, 'أكتوبر', 'موظفو المدرسة', 'لقاءات المدير مع الموظفين.', 9),
  ('values', 'تفعيل قيمة روح الفريق: مهمة عمل جماعي بتوزيع أدوار، أو تعيين معلم قديم لتوجيه معلم جديد', null, 'نوفمبر', 'موظفو المدرسة', 'مهمة جماعية موثقة بأدوارها.', 10),
  ('values', 'تفعيل قيمة الإبداع: يوم الابتكار المدرسي لعرض المشاريع والأفكار التي تطور المدرسة والمجتمع', null, 'نوفمبر', 'موظفو المدرسة', 'يوم الابتكار المدرسي.', 11),
  ('values', 'تفعيل قيمة التعلم المستمر: مادة معرفية قصيرة، وكل موظف يذكر شيئًا تعلّمه هذا الشهر', null, 'ديسمبر', 'موظفو المدرسة', 'مشاركة معرفية شهرية.', 12),
  ('values', 'ملتقى الهوية المؤسسية: أبرز المبادرات والقصص والممارسات التي جسّدت القيم خلال 2026م', null, 'سبتمبر', 'موظفو المدرسة', 'فعالية بمشاركة المعلمين والموظفين.', 13),
  ('values', 'إعداد التقرير النهائي لتفعيل القيم المؤسسية لعام 2026م', null, 'ديسمبر', 'موظفو المدرسة', 'التقرير من تبويب «التقرير» في القسم.', 14),
  ('hayyak', 'تطبيق متطلبات تهيئة الموظف الجديد', null, 'فور الانضمام', 'الموظفون الجدد', 'وفق إرشادات برنامج حيّاك (تبويب «حيّاك»).', 15),
  ('comm', 'الاجتماعات الرسمية الدورية لمناقشة المهام والمنجزات', null, 'جدولة داخلية', 'موظفو المدرسة', 'التعاون مع مدير المدرسة في حصر اللقاءات الرسمية وغير الرسمية (تبويب «التواصل الملهم»).', 16),
  ('comm', 'الموظف الضيف: يقضي يوم عمل مع القيادات أو الموظفين لتبادل الخبرات', null, 'جدولة داخلية', 'استضافة موظفي المدارس', 'جدولة الاستضافة وتوثيقها.', 17),
  ('comm', 'القائد الموجه: لقاء رسمي للمدير مع الموظف مدته 30 دقيقة', null, 'جدولة داخلية', 'موظفو المدرسة', 'جدولة اللقاءات وتوثيقها.', 18),
  ('comm', 'جلسة فنجان: لقاء غير رسمي مع الموظف مدته ربع ساعة', null, 'جدولة داخلية', 'موظفو المدرسة', 'جدولة الجلسات وتوثيقها.', 19),
  ('comm', 'لقاء غير رسمي لموظفي المدرسة لتعزيز العلاقات الداخلية', null, 'جدولة داخلية', 'موظفو المدرسة', 'تنظيم اللقاء وتوثيقه.', 20),
  ('care', 'رسائل للموظفين في مناسباتهم الخاصة (تهنئة، تعزية)', null, 'وفق المناسبات', 'موظفو المدرسة', 'بطاقات المناسبات وفق التصاميم المعتمدة (تبويب «نهتم بك»).', 21),
  ('innov', 'تكريم الموظفين ذوي المبادرات الابتكارية المميزة على مستوى المدرسة', null, 'ديسمبر', 'موظفو المدرسة', 'تحفيز الموظفين على تقديم الحلول الابتكارية وتكريمهم (تبويب «الأفكار»).', 22),
  ('mazaya', 'نشر العروض الشهرية لبرنامج مزايا وحث الموظفين على الاستفادة منها', null, 'شهري', 'موظفو المدرسة', 'إشعار الموظفين بالنشرة الشهرية.', 23),
  ('ohi', 'نشر رسائل التوعية والممارسات الإدارية الإيجابية الواردة من فريق الثقافة المؤسسية', null, 'وفق الخطة الزمنية', 'موظفو المدرسة', 'إشعار الموظفين بالرسائل وتعزيز تطبيقها؛ بما يرفع مؤشر الصحة التنظيمية.', 24)
) v where not exists (select 1 from public.cult_activities);

-- مخزن خاص لصور التوثيق: حتى 10 ميجا للملف
-- إن شُغّل الملف قبل اعتماد كلمة «الموظفين»: تصحيح الفئة المستهدفة وعناوين الأنشطة
update public.cult_activities set target = replace(target, 'منسوبو', 'موظفو'),
  title = replace(replace(title, 'لمنسوبي المدرسة', 'لموظفي المدرسة'), 'المنسوبين', 'الموظفين')
 where target like '%منسوب%' or title like '%المنسوبين%' or title like '%لمنسوبي المدرسة%';

insert into storage.buckets (id, name, public, file_size_limit) values ('culture', 'culture', false, 10485760)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;
drop policy if exists "cult files read" on storage.objects;
create policy "cult files read" on storage.objects for select to authenticated using (bucket_id = 'culture' and public.cult_member());
drop policy if exists "cult files write" on storage.objects;
create policy "cult files write" on storage.objects for insert to authenticated with check (bucket_id = 'culture' and public.cult_member());
drop policy if exists "cult files delete" on storage.objects;
create policy "cult files delete" on storage.objects for delete to authenticated using (bucket_id = 'culture' and public.cult_member());

-- نهاية الجزء 2
