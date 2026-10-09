-- =====================================================================
-- صور بطاقات الإجابة — الجزء 2: حذفها بنهاية الفصل من «وضع الصيانة» للدعم الفني.
-- quiz_cards_stats: عدد الصور وحجمها، كلها ومن الفصول السابقة.
-- quiz_cards_old: صور الفصول السابقة (المعرّف والمسار) لتحذفها الصفحة من المخزن.
-- quiz_cards_cleared: يفرّغ card_path بعد الحذف. يُنفَّذ بعد quiz_cards.sql.
-- تكرار التنفيذ آمن.
-- =====================================================================

-- الفصول السابقة: كل اختبار من غير العام والفصل النشطين في الإعدادات
create or replace function public._quiz_is_old(q quizzes)
returns boolean language sql stable set search_path = public as $$
  select q.academic_year is distinct from (select value from settings where key = 'active_year')
      or q.term is distinct from (select value::int from settings where key = 'active_term');
$$;

create or replace function public.quiz_cards_stats()
returns table (total bigint, total_kb bigint, old bigint, old_kb bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role(array['tech_support']) then raise exception 'غير مصرّح'; end if;
  return query
  select count(*), coalesce(sum((o.metadata->>'size')::bigint), 0) / 1024,
         count(*) filter (where public._quiz_is_old(q)),
         coalesce(sum((o.metadata->>'size')::bigint) filter (where public._quiz_is_old(q)), 0) / 1024
    from quiz_submissions s
    join quizzes q on q.id = s.quiz_id
    left join storage.objects o on o.bucket_id = 'quiz-cards' and o.name = s.card_path
   where s.card_path is not null;
end $$;

create or replace function public.quiz_cards_old()
returns table (id uuid, card_path text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_admin_role(array['tech_support']) then raise exception 'غير مصرّح'; end if;
  return query
  select s.id, s.card_path from quiz_submissions s join quizzes q on q.id = s.quiz_id
   where s.card_path is not null and public._quiz_is_old(q);
end $$;

create or replace function public.quiz_cards_cleared(p_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_admin_role(array['tech_support']) then raise exception 'غير مصرّح'; end if;
  update quiz_submissions set card_path = null where id = any(p_ids);
end $$;

-- الدعم الفني يحذف من مخزن البطاقات
drop policy if exists "quiz cards support delete" on storage.objects;
create policy "quiz cards support delete" on storage.objects for delete to authenticated
  using (bucket_id = 'quiz-cards' and public.has_admin_role(array['tech_support']));

revoke execute on function public.quiz_cards_stats() from public, anon;
grant  execute on function public.quiz_cards_stats() to authenticated;
revoke execute on function public.quiz_cards_old() from public, anon;
grant  execute on function public.quiz_cards_old() to authenticated;
revoke execute on function public.quiz_cards_cleared(uuid[]) from public, anon;
grant  execute on function public.quiz_cards_cleared(uuid[]) to authenticated;
-- نهاية الجزء 2
