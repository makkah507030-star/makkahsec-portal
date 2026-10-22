-- =====================================================================
-- بنك الأسئلة (الجزء 2 من 2): المشاركة وبيانات السؤال (الدرس والصعوبة) لصاحبه وحده،
-- وعدّ مرات الاستخدام، وقراءة صور الأسئلة المشاركة لنسخها إلى اختبار آخر. يُشغَّل بعد الجزء 1.
-- =====================================================================

-- صاحب الأسئلة: المشاركة، والدرس، والصعوبة (null يُبقي القيمة كما هي، و'' يمسح الدرس)
create or replace function public.qbank_set(p_ids uuid[], p_shared boolean default null,
  p_lesson text default null, p_difficulty text default null) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update qbank set shared = coalesce(p_shared, shared),
         lesson = case when p_lesson is null then lesson else nullif(trim(p_lesson), '') end,
         difficulty = case when p_difficulty is null then difficulty else nullif(p_difficulty, '') end,
         updated_at = now()
   where id = any(p_ids) and owner_id = auth.uid();
  get diagnostics n = row_count;
  return n;
end $$;

-- عدّ مرات نسخ السؤال من البنك إلى اختبار
create or replace function public.qbank_used(p_ids uuid[]) returns void
language sql security definer set search_path = public as $$
  update qbank set uses = uses + 1
   where id = any(p_ids) and (owner_id = auth.uid() or shared) and public.qbank_staff();
$$;

-- المواد الموجودة في البنك (لقائمة التصفية)
create or replace function public.qbank_subjects() returns table (subject_name text, n int)
language sql stable security invoker set search_path = public as $$
  select coalesce(subject_name, 'بلا مادة'), count(*)::int from qbank group by 1 order by 1;
$$;

revoke all on function public.qbank_set(uuid[], boolean, text, text), public.qbank_used(uuid[]), public.qbank_subjects() from public, anon;
grant execute on function public.qbank_set(uuid[], boolean, text, text), public.qbank_used(uuid[]), public.qbank_subjects() to authenticated;

-- صور الأسئلة المشاركة: يقرؤها المعلمون لنسخها إلى اختباراتهم (المخزن يبقى خاصًا عن الطلاب)
create or replace function public.qbank_image_shared(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.qbank_staff()
     and exists (select 1 from qbank b where b.shared
                   and (b.q->>'image_path' = p_name or coalesce(b.q->'option_images', '[]') ? p_name));
$$;
revoke all on function public.qbank_image_shared(text) from public, anon;
grant execute on function public.qbank_image_shared(text) to authenticated;

drop policy if exists "quiz images bank read" on storage.objects;
create policy "quiz images bank read" on storage.objects for select to authenticated
  using (bucket_id = 'quiz-images' and public.qbank_image_shared(name));
-- نهاية الجزء 2
