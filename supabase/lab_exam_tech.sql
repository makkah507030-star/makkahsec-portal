-- مركز اختبارات معمل الحاسب: محضر المعمل يطّلع على الاختبارات العملية وحدها ودرجاتها، ليساهم في تجهيزها.
-- اطّلاع فقط: لا إنشاء ولا تعديل ولا تصحيح، ولا الاختبار النظري ولا بنك أسئلته.
-- يُنفَّذ بعد lab_exam_private.sql. تكرار التنفيذ آمن.

create or replace function public.lab_exam_tech() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_any_admin_role(array['computer_lab']::admin_role_type[]);
$$;
revoke execute on function public.lab_exam_tech() from public, anon;
grant execute on function public.lab_exam_tech() to authenticated;

-- الاختبار العملي (للمحضر)
create or replace function public.lab_exam_practical(p_exam uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lab_exams e where e.id = p_exam and e.kind = 'practical');
$$;
revoke execute on function public.lab_exam_practical(uuid) from public, anon;
grant execute on function public.lab_exam_practical(uuid) to authenticated;

drop policy if exists lab_exams_read on public.lab_exams;
create policy lab_exams_read on public.lab_exams for select to authenticated
  using (teacher_id = public.current_teacher_id() or public.lab_exam_support()
         or (kind = 'practical' and public.lab_exam_tech()));

drop policy if exists lab_exam_subs_read on public.lab_exam_subs;
create policy lab_exam_subs_read on public.lab_exam_subs for select to authenticated
  using (public.lab_exam_mine(exam_id) or public.lab_exam_support()
         or (public.lab_exam_tech() and public.lab_exam_practical(exam_id)));

-- للتحقق
select policyname, cmd from pg_policies where tablename in ('lab_exams', 'lab_exam_subs') and cmd = 'SELECT';
-- نهاية الجزء 1
