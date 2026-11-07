-- مركز اختبارات التقنية الرقمية (معمل الحاسب): الاختبارات وأسئلتها ودرجاتها لمعلم المادة صاحبها وحده،
-- وللدعم الفني اطّلاعًا فقط لتقديم الدعم. لا يراها مدير المدرسة ولا الوكلاء ولا محضر المعمل.
-- يُنفَّذ بعد lab_exam_1.sql. تكرار التنفيذ آمن.

-- الدعم الفني: اطّلاع على مركز الاختبارات
create or replace function public.lab_exam_support() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_any_admin_role(array['tech_support']::admin_role_type[]);
$$;
revoke execute on function public.lab_exam_support() from public, anon;
grant execute on function public.lab_exam_support() to authenticated;

-- صاحب الاختبار وحده (للكتابة على درجات الطلاب)
create or replace function public.lab_exam_mine(p_exam uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.lab_exams e where e.id = p_exam and e.teacher_id = public.current_teacher_id());
$$;

-- الاختبارات: المعلم صاحبها، والدعم الفني اطّلاعًا
drop policy if exists lab_exams_read on public.lab_exams;
create policy lab_exams_read on public.lab_exams for select to authenticated
  using (teacher_id = public.current_teacher_id() or public.lab_exam_support());

-- درجات الطلاب: الكتابة لصاحب الاختبار، والقراءة له وللدعم الفني
drop policy if exists lab_exam_subs_all on public.lab_exam_subs;
drop policy if exists lab_exam_subs_read on public.lab_exam_subs;
create policy lab_exam_subs_read on public.lab_exam_subs for select to authenticated
  using (public.lab_exam_mine(exam_id) or public.lab_exam_support());
drop policy if exists lab_exam_subs_add on public.lab_exam_subs;
create policy lab_exam_subs_add on public.lab_exam_subs for insert to authenticated
  with check (public.lab_exam_mine(exam_id));
drop policy if exists lab_exam_subs_edit on public.lab_exam_subs;
create policy lab_exam_subs_edit on public.lab_exam_subs for update to authenticated
  using (public.lab_exam_mine(exam_id)) with check (public.lab_exam_mine(exam_id));
drop policy if exists lab_exam_subs_del on public.lab_exam_subs;
create policy lab_exam_subs_del on public.lab_exam_subs for delete to authenticated
  using (public.lab_exam_mine(exam_id));

-- بنك الأسئلة: يعدّله معلمو التقنية المخوّلون، ويطّلع عليه الدعم الفني
drop policy if exists lab_qbank_read on public.lab_qbank;
create policy lab_qbank_read on public.lab_qbank for select to authenticated
  using (public.lab_can_book() or public.lab_exam_support());
drop policy if exists lab_qbank_write on public.lab_qbank;
create policy lab_qbank_write on public.lab_qbank for all to authenticated
  using (public.lab_can_book()) with check (public.lab_can_book());

-- للتحقق: السياسات الجديدة
select tablename, policyname, cmd from pg_policies
 where tablename in ('lab_exams', 'lab_exam_subs', 'lab_qbank') order by tablename, policyname;
-- نهاية الجزء 1
