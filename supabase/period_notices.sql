-- =====================================================================
-- إشعار الفترة من نور (الجزء 1 من 1): يُرفع ملف Excel المصدَّر من نور (ورقة لكل طالب)، فيرى
-- الطالب وولي أمره المواد المرصودة فقط بأجزائها مع «آخر تحديث». يُعاد الرفع كلما اكتمل رصد،
-- فيُستبدل إشعار كل طالب تغيّرت درجاته ويصله وولي أمره إشعار، ويُسجَّل كل رفع في سجل.
-- المجموع والنسبة (من المواد المرصودة) لتقرير المتفوقين في الإدارة، ولا يظهران للطالب.
-- تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.period_notices (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  academic_year text not null,
  report_key text not null,                  -- الفصل الدراسي|عنوان الإشعار
  term text, title text, grade_name text, section text, class_label text,
  subjects jsonb not null default '[]',      -- [{name, max, total, parts:[{label,value}], note}]
  total numeric, max_total numeric, pct numeric,
  attendance numeric, behavior_excellent numeric, behavior_positive numeric,
  published boolean not null default true,
  updated_at timestamptz not null default now(),
  uploaded_by uuid default auth.uid(),
  unique (student_id, academic_year, report_key)
);
create index if not exists period_notices_key on public.period_notices (academic_year, report_key);

create table if not exists public.period_notice_log (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null, report_key text not null, title text,
  students int, added int, changed int,
  uploaded_by uuid default auth.uid(), uploader_name text,
  created_at timestamptz not null default now()
);

alter table public.period_notices enable row level security;
alter table public.period_notice_log enable row level security;
drop policy if exists period_notices_admin on public.period_notices;
create policy period_notices_admin on public.period_notices for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists period_notices_own on public.period_notices;
create policy period_notices_own on public.period_notices for select to authenticated
  using (published and (exists (select 1 from students s where s.id = student_id and s.user_id = auth.uid())
    or exists (select 1 from guardian_student gs join guardians g on g.id = gs.guardian_id
               where gs.student_id = period_notices.student_id and g.user_id = auth.uid())));
drop policy if exists period_notice_log_admin on public.period_notice_log;
create policy period_notice_log_admin on public.period_notice_log for select to authenticated using (public.is_admin());
grant select, insert, update, delete on public.period_notices to authenticated;
grant select on public.period_notice_log to authenticated;

-- النشر: يضيف الجديد ويستبدل ما تغيّر فقط، ويُشعر أصحابه، ويسجّل الرفع
create or replace function public.period_notice_publish(p_year text, p_key text, p_title text, p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb; old period_notices; n_add int := 0; n_chg int := 0; ids uuid[] := '{}'; uids uuid[];
begin
  if not public.is_admin() then raise exception 'غير مصرّح'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    select * into old from period_notices
     where student_id = (r->>'student_id')::uuid and academic_year = p_year and report_key = p_key;
    if old.id is not null and old.subjects = r->'subjects' and old.attendance is not distinct from (r->>'attendance')::numeric
       and old.behavior_excellent is not distinct from (r->>'behavior_excellent')::numeric
       and old.behavior_positive is not distinct from (r->>'behavior_positive')::numeric then continue; end if;
    insert into period_notices (student_id, academic_year, report_key, term, title, grade_name, section, class_label,
      subjects, total, max_total, pct, attendance, behavior_excellent, behavior_positive, published, updated_at, uploaded_by)
    values ((r->>'student_id')::uuid, p_year, p_key, r->>'term', p_title, r->>'grade_name', r->>'section', r->>'class_label',
      r->'subjects', (r->>'total')::numeric, (r->>'max_total')::numeric, (r->>'pct')::numeric, (r->>'attendance')::numeric,
      (r->>'behavior_excellent')::numeric, (r->>'behavior_positive')::numeric, true, now(), auth.uid())
    on conflict (student_id, academic_year, report_key) do update set
      term = excluded.term, title = excluded.title, grade_name = excluded.grade_name, section = excluded.section,
      class_label = excluded.class_label, subjects = excluded.subjects, total = excluded.total,
      max_total = excluded.max_total, pct = excluded.pct, attendance = excluded.attendance,
      behavior_excellent = excluded.behavior_excellent, behavior_positive = excluded.behavior_positive,
      published = true, updated_at = now(), uploaded_by = auth.uid();
    if old.id is null then n_add := n_add + 1; else n_chg := n_chg + 1; end if;
    ids := ids || (r->>'student_id')::uuid;
  end loop;

  insert into period_notice_log (academic_year, report_key, title, students, added, changed, uploader_name)
  values (p_year, p_key, p_title, jsonb_array_length(p_rows), n_add, n_chg, (select full_name from users where id = auth.uid()));

  select array_agg(distinct u) into uids from (
    select s.user_id u from students s where s.id = any(ids) and s.user_id is not null
    union select g.user_id from guardian_student gs join guardians g on g.id = gs.guardian_id
     where gs.student_id = any(ids) and g.user_id is not null) x;
  if uids is not null then
    perform public.send_notification('تحدّثت درجات ' || p_title, 'تفقّد درجات المواد المرصودة من الصفحة الرئيسية في البوابة.',
      'general', '/', null, uids, null, null, true);
  end if;
  return jsonb_build_object('added', n_add, 'changed', n_chg, 'same', jsonb_array_length(p_rows) - n_add - n_chg);
end $$;
revoke all on function public.period_notice_publish(text, text, text, jsonb) from public, anon;
grant execute on function public.period_notice_publish(text, text, text, jsonb) to authenticated;
-- نهاية الجزء 1
