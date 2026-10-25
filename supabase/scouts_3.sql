-- =====================================================================
-- الفريق الكشفي (الجزء 3): الرتب الكشفية، وشارة الطالب في بطاقته، وجوال التواصل.
-- الرتب لمرحلة الكشاف المتقدم (المرحلة الثانوية) في جمعية الكشافة العربية
-- السعودية: كشاف متقدم مبتدئ ← كشاف ثانٍ ← كشاف أول. يُسندها القائد الكشفي ونائبه
-- (صلاحية «الفريق الكشفي»). يُنفَّذ بعد scouts_1.sql، وتكرار تنفيذه آمن.
-- =====================================================================

alter table public.scout_members add column if not exists rank         text;
alter table public.scout_members add column if not exists rank_at      date;
alter table public.scout_members add column if not exists rank_by_name text;
alter table public.scout_members drop constraint if exists scout_members_rank_check;
alter table public.scout_members add constraint scout_members_rank_check
  check (rank is null or rank in ('beginner', 'second', 'first'));

-- شارة الكشافة في بطاقة الطالب: للطالب نفسه ولولي أمره ولمن يدير الفريق.
-- null إن لم يكن عضوًا في الفريق.
create or replace function public.scout_badge(p_student uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('rank', m.rank, 'rank_at', m.rank_at, 'since', m.added_at)
  from public.scout_members m
  where m.student_id = p_student
    and (exists (select 1 from public.students s where s.id = p_student and s.user_id = auth.uid())
         or exists (select 1 from public.guardian_student gs join public.guardians g on g.id = gs.guardian_id
                    where gs.student_id = p_student and g.user_id = auth.uid())
         or public.has_permission('scouts') or public.is_admin());
$$;
revoke execute on function public.scout_badge(uuid) from public, anon;
grant  execute on function public.scout_badge(uuid) to authenticated;

-- جوال ولي الأمر لكل عضو، للتواصل من كشف الفريق
create or replace function public.scout_roster()
returns table (student_id uuid, mobile text)
language sql stable security definer set search_path = public as $$
  select m.student_id,
         (select g.mobile from public.guardian_student gs join public.guardians g on g.id = gs.guardian_id
          where gs.student_id = m.student_id and coalesce(g.mobile, '') <> ''
          order by g.is_active desc limit 1)
  from public.scout_members m
  where public.has_permission('scouts');
$$;
revoke execute on function public.scout_roster() from public, anon;
grant  execute on function public.scout_roster() to authenticated;

-- نهاية الجزء 1
