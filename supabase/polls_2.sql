-- =====================================================================
-- التصويت والاستطلاعات (الجزء 2 من 2): التصويت والنتائج، وربط الترشيحات.
-- • poll_vote: صوت واحد لكل حساب داخل الموعد، لمن يحق له، وحتى عدد الخيارات المسموح.
-- • poll_results: الأصوات لكل خيار وعدد المصوّتين ومن يحق لهم، بحسب إعداد ظهور النتائج.
-- • nom_calls.vote_mode: committee (اللجنة وحدها، الافتراضي)، advisory (تصويت استئناسي
--   نتائجه للجنة وحدها)، decisive (تصويت حاسم تعتمد اللجنة نتيجته).
-- يُنفَّذ بعد polls_1.sql، وتكرار التنفيذ آمن.
-- =====================================================================
alter table public.nom_calls add column if not exists vote_mode text not null default 'committee'
  check (vote_mode in ('committee', 'advisory', 'decisive'));

create or replace function public.poll_vote(p_poll uuid, p_options uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare p polls; n int;
begin
  select * into p from polls where id = p_poll;
  if p.id is null or not p.published or p.cancelled_at is not null then raise exception 'التصويت غير متاح'; end if;
  if now() < p.opens_at then raise exception 'لم يبدأ التصويت بعد'; end if;
  if now() >= p.closes_at then raise exception 'انتهى وقت التصويت'; end if;
  if not public.banner_for_me(p.audience, p.grades) then raise exception 'هذا التصويت ليس لفئتك'; end if;
  select count(distinct o.id) into n from poll_options o where o.poll_id = p_poll and o.id = any(coalesce(p_options, '{}'));
  if n = 0 or n <> cardinality(p_options) then raise exception 'اختر من الخيارات المتاحة'; end if;
  if n > p.max_choices then raise exception 'يمكنك اختيار % على الأكثر', p.max_choices; end if;
  begin
    insert into poll_voters (poll_id, voter) values (p_poll, auth.uid());
  exception when unique_violation then raise exception 'سبق تصويتك في هذا التصويت';
  end;
  insert into poll_ballots (poll_id, option_id) select p_poll, unnest(p_options);
end $$;

-- عدد من يحق لهم التصويت (للنسبة)
create or replace function public.poll_eligible(p_poll uuid) returns int
language sql stable security definer set search_path = public as $$
  select (case when 'student' = any(p.audience) then (select count(distinct s.user_id) from v_active_students v
            join students s on s.id = v.student_id where s.user_id is not null
             and (cardinality(p.grades) = 0 or v.grade = any(p.grades))) else 0 end
        + case when 'guardian' = any(p.audience) then (select count(distinct g.user_id) from guardians g
            join guardian_student gs on gs.guardian_id = g.id join v_active_students v on v.student_id = gs.student_id
           where g.user_id is not null and (cardinality(p.grades) = 0 or v.grade = any(p.grades))) else 0 end
        + case when 'staff' = any(p.audience) then (select count(*) from users u
            where u.is_active and u.role::text in ('admin', 'teacher')) else 0 end)::int
    from polls p where p.id = p_poll;
$$;

create or replace function public.poll_results(p_poll uuid)
returns table (option_id uuid, label text, note text, app_id uuid, votes int, voters int, eligible int, voted boolean)
language plpgsql stable security definer set search_path = public as $$
declare p polls; mgr boolean; mine boolean;
begin
  select * into p from polls where id = p_poll;
  if p.id is null then return; end if;
  mgr := public.poll_manager(p_poll);
  mine := exists (select 1 from poll_voters v where v.poll_id = p_poll and v.voter = auth.uid());
  if not (mgr or (public.banner_for_me(p.audience, p.grades) and p.published
          and ((p.results = 'live' and (mine or now() >= p.closes_at))
               or (p.results = 'after' and now() >= p.closes_at and (p.nom_call_id is null or p.approved_at is not null))))) then
    raise exception 'النتائج غير متاحة الآن';
  end if;
  return query
    select o.id, o.label, o.note, o.app_id,
           (select count(*) from poll_ballots b where b.option_id = o.id)::int,
           (select count(*) from poll_voters v where v.poll_id = p_poll)::int,
           case when mgr then public.poll_eligible(p_poll) end, mine
      from poll_options o where o.poll_id = p_poll order by o.sort, o.label;
end $$;

revoke all on function public.poll_vote(uuid, uuid[]), public.poll_eligible(uuid), public.poll_results(uuid),
  public.poll_manager(uuid), public.poll_has_votes(uuid) from public, anon;
grant execute on function public.poll_vote(uuid, uuid[]), public.poll_eligible(uuid), public.poll_results(uuid),
  public.poll_manager(uuid), public.poll_has_votes(uuid) to authenticated;

select to_regprocedure('public.poll_vote(uuid, uuid[])') is not null as "التصويت جاهز",
       exists (select 1 from information_schema.columns where table_name = 'nom_calls' and column_name = 'vote_mode') as "ربط الترشيحات";
-- نهاية الجزء 2
