-- =====================================================================
-- الثقافة المؤسسية (7 من 7): إسهام كل عضو في الفريق، وشواهده في ملف الأداء الوظيفي.
-- • cult_team_works: أعمال كل عضو (أنشطة مكتملة، لقاءات، بطاقات «نهتم بك»، تهيئة، أفكار رُدّ عليها، رسائل)
--   للوحة التنفيذ ورسمها البياني والتقرير.
-- • بند e02_12 «أعمال فريق الثقافة المؤسسية» يظهر لأعضاء الفريق وحدهم (roles = cult_team) ويصل تلقائيًا.
-- يُنفَّذ بعد cult_6.sql وstaff_perf_2.sql. تكرار التنفيذ آمن.
-- =====================================================================
-- من ردّ على الفكرة
create or replace function public.cult_idea_touch() returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and (new.status is distinct from old.status or new.reply is distinct from old.reply) then new.reviewed_by := auth.uid(); end if;
  return new;
end $$;
drop trigger if exists cult_idea_touch on public.cult_ideas;
create trigger cult_idea_touch before update on public.cult_ideas for each row execute function public.cult_idea_touch();

-- أعمال عضو واحد: (النوع، العنوان، التاريخ) — بمعرّفه، أو باسمه في السجلات القديمة
create or replace function public.cult_works_of(p_uid uuid, y0 date)
returns table (kind text, title text, at timestamptz)
language sql stable security definer set search_path = public as $$
  with me as (select full_name nm from users where id = p_uid)
  select 'act', a.title, coalesce(a.done_at::timestamptz, a.updated_at) from cult_activities a, me
   where a.status = 'done' and (a.updated_by = p_uid or (a.updated_by is null and a.updated_by_name = me.nm)) and coalesce(a.done_at, a.updated_at::date) >= y0
  union all select 'meet', coalesce(m.title, 'لقاء'), m.held_on::timestamptz from cult_meetings m, me
   where (m.created_by = p_uid or (m.created_by is null and m.created_by_name = me.nm)) and m.held_on >= y0
  union all select 'care', o.person_name, o.sent_at from cult_occasions o, me
   where o.sent_at is not null and (o.created_by = p_uid or (o.created_by is null and o.created_by_name = me.nm)) and o.held_on >= y0
  union all select 'onboard', b.person_name, b.joined_on::timestamptz from cult_onboard b, me
   where (b.created_by = p_uid or (b.created_by is null and b.created_by_name = me.nm)) and b.joined_on >= y0
  union all select 'idea', i.title, i.updated_at from cult_ideas i where i.reviewed_by = p_uid and i.status <> 'new' and i.updated_at >= y0
  union all select 'msg', g.title, g.sent_at from cult_messages g where g.sent_by = p_uid and g.sent_at >= y0;
$$;
revoke all on function public.cult_works_of(uuid, date) from public, anon, authenticated;

-- إسهام أعضاء الفريق للوحة التنفيذ والتقرير
create or replace function public.cult_team_works()
returns table (user_id uuid, full_name text, role text, kind text, n bigint)
language sql stable security definer set search_path = public as $$
  select t.user_id, u.full_name, t.role, w.kind, count(*)
    from cult_team t join users u on u.id = t.user_id
    cross join lateral public.cult_works_of(t.user_id, (select coalesce(min(start_date), current_date - 365) from academic_calendar
                                                          where academic_year = (select value from settings where key = 'active_year'))) w
   where public.cult_member() group by 1, 2, 3, 4;
$$;
revoke all on function public.cult_team_works() from public, anon;
grant execute on function public.cult_team_works() to authenticated;

-- بند الشواهد لأعضاء الفريق
alter table public.perf_items add column if not exists roles text[];
insert into public.perf_items (key, element_key, sort_order, title, source, is_record, portal, roles)
values ('e02_12', 'e02', 12, 'أعمال فريق الثقافة المؤسسية (سفير الثقافة وأعضاؤه)', 'school', false, 'auto', array['cult_team'])
on conflict (key) do update set title = excluded.title, portal = excluded.portal, roles = excluded.roles, is_active = true;

-- عدّاد البند وتفاصيله: للعضو نفسه، ولمدير المدرسة والدعم الفني (وللكل حين p_uid فارغ)
create or replace function public.cult_perf_auto(p_uid uuid, p_year text)
returns table (teacher_user_id uuid, item_key text, cnt bigint, last_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare y0 date;
begin
  if not (p_uid = auth.uid() or public.has_admin_role(array['principal', 'tech_support'])) then return; end if;
  select coalesce(min(start_date), current_date - 365) into y0 from academic_calendar where academic_year = p_year;
  return query select t.user_id, 'e02_12'::text, count(*), max(w.at)
    from cult_team t cross join lateral public.cult_works_of(t.user_id, y0) w
   where p_uid is null or t.user_id = p_uid group by t.user_id;
end $$;
create or replace function public.cult_perf_details(p_uid uuid, p_year text, p_item text)
returns table (r_title text, r_detail text, r_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
declare y0 date; lbl jsonb := '{"act":"نشاط من الخطة اكتمل","meet":"لقاء في التواصل الملهم","care":"بطاقة «نهتم بك»","onboard":"تهيئة موظف جديد في «حيّاك»","idea":"رد على فكرة موظف","msg":"رسالة للموظفين"}';
begin
  if not (p_uid = auth.uid() or public.has_admin_role(array['principal', 'tech_support'])) then return; end if;
  select coalesce(min(start_date), current_date - 365) into y0 from academic_calendar where academic_year = p_year;
  return query select w.title, lbl ->> w.kind, w.at from public.cult_works_of(p_uid, y0) w order by 3 desc nulls last;
end $$;
-- علامات صاحب الملف: أدواره الإدارية، وcult_team إن كان في فريق الثقافة (لبنود roles)
create or replace function public.perf_owner_tags(p_uid uuid) returns text[]
language sql stable security definer set search_path = public as $$
  select case when p_uid = auth.uid() or public.has_admin_role(array['principal', 'tech_support']) then
    coalesce((select array_agg(role_type::text) from admin_roles where user_id = p_uid), '{}')
    || case when exists (select 1 from cult_team where user_id = p_uid) then array['cult_team'] else '{}'::text[] end end;
$$;
revoke all on function public.cult_perf_auto(uuid, text), public.cult_perf_details(uuid, text, text), public.perf_owner_tags(uuid) from public, anon;
grant execute on function public.cult_perf_auto(uuid, text), public.cult_perf_details(uuid, text, text), public.perf_owner_tags(uuid) to authenticated;
-- نهاية الجزء 7
