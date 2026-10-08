-- =====================================================================
-- إجراءات المعلم قبل الإحالة (الجزء 1 من 2): سجل الإجراءات وإشعار ولي الأمر.
--
-- • student_actions: ما اتخذه المعلم مع الطالب قبل الإحالة، سطر لكل موقف:
--   تنبيه شفهي ← تدوين المشكلة ← إشعار ولي الأمر (بالتدرج في دليل السلوك).
-- • teacher_notify_guardian: إشعار من البوابة لطالب واحد من فصول المعلم
--   ولأولياء أمره، ويُسجَّل إجراءً في student_actions.
-- يُنفَّذ قبل الجزء 2. تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.student_actions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid not null default auth.uid(),
  category text not null check (category in ('behavior', 'academic')),
  action text not null check (action in ('verbal', 'record', 'guardian')),
  detail text,
  violation_text text,
  violation_degree integer,
  notification_id uuid,
  action_date date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists student_actions_student_idx on public.student_actions (student_id, teacher_id);

alter table public.student_actions enable row level security;

drop policy if exists student_actions_read on public.student_actions;
create policy student_actions_read on public.student_actions for select to authenticated
  using (teacher_id = auth.uid()
         or public.has_admin_role(array['principal', 'tech_support', 'deputy_students',
                                        'counselor_1', 'counselor_2', 'counselor_3']));

drop policy if exists student_actions_insert on public.student_actions;
create policy student_actions_insert on public.student_actions for insert to authenticated
  with check (teacher_id = auth.uid() and action <> 'guardian');

create or replace function public.teacher_notify_guardian(
  p_student uuid, p_title text, p_body text, p_category text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tid uuid;
  v_id uuid;
  v_g int;
begin
  select id into v_tid from teachers where user_id = auth.uid();
  if v_tid is null then raise exception 'الحساب غير مرتبط بسجل معلم'; end if;
  if p_category not in ('behavior', 'academic') then raise exception 'نوع غير صالح'; end if;

  -- الطالب من فصول المعلم في الفصل الدراسي النشط
  if not exists (
    select 1 from student_enrollment se
      join schedule sc on sc.class_id = se.class_id and sc.teacher_id = v_tid
      join settings sy on sy.key = 'active_year' and sc.academic_year = sy.value
      join settings st on st.key = 'active_term' and sc.term = st.value::int
     where se.student_id = p_student and se.status = 'active') then
    raise exception 'الطالب ليس من فصولك';
  end if;

  select count(*) into v_g from guardian_student gs join guardians g on g.id = gs.guardian_id
   where gs.student_id = p_student and g.user_id is not null;
  if v_g = 0 then raise exception 'لا يوجد ولي أمر للطالب مسجّل في البوابة'; end if;

  insert into notifications (title, body, kind, is_auto, created_by)
  values (p_title, p_body, 'general', false, auth.uid())
  returning id into v_id;

  insert into notification_recipients (notification_id, user_id)
  select v_id, g.user_id from guardian_student gs join guardians g on g.id = gs.guardian_id
   where gs.student_id = p_student and g.user_id is not null
  union
  select v_id, s.user_id from students s where s.id = p_student and s.user_id is not null
  on conflict do nothing;

  insert into student_actions (student_id, teacher_id, category, action, detail, notification_id)
  values (p_student, auth.uid(), p_category, 'guardian', p_title, v_id);
  return v_id;
end;
$$;

revoke execute on function public.teacher_notify_guardian(uuid, text, text, text) from public, anon;
grant  execute on function public.teacher_notify_guardian(uuid, text, text, text) to authenticated;
-- نهاية الجزء 1
