-- =====================================================================
-- بنك الأنشطة (الجزء 6): ملاحظة المعلم على النشاط عند تسجيل تنفيذه، والتقرير الشامل
-- للبطاقات (كل بطاقة باستخدامها وتقييمها وملاحظاتها، وما استخدمه كل معلم).
-- يُشغَّل بعد activities_1 و_4. تكرار التنفيذ آمن.
-- =====================================================================

-- ملاحظة اختيارية يكتبها المعلم مع «نُفّذ وأعجبني / لم يناسب»
alter table public.activity_uses add column if not exists note text;
alter table public.activity_uses drop constraint if exists activity_uses_note_len;
alter table public.activity_uses add constraint activity_uses_note_len check (note is null or length(note) <= 300);

-- التقرير الشامل للعام الدراسي: للوكيل والدعم الفني والمدير (كتقرير الاستخدام)
create or replace function public.act_cards_report(p_year text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare y_start timestamptz; r jsonb;
begin
  if not public.activity_manager() and not public.has_admin_role(array['principal']) then
    raise exception 'غير مصرّح'; end if;
  select min(start_date)::timestamptz into y_start from public.academic_calendar where academic_year = p_year;
  y_start := coalesce(y_start, now() - interval '1 year');
  with u as (
    select a.*, coalesce((select t.full_name from teachers t where t.user_id = a.user_id limit 1),
                         (select x.full_name from users x where x.id = a.user_id)) who, k.class_no, k.grade
    from activity_uses a left join classes k on k.id = a.class_id
    where a.created_at >= y_start
  )
  select jsonb_build_object(
    -- كل بطاقة (المستخدمة وغير المستخدمة) بأرقامها وملاحظات المعلمين عليها
    'cards', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'title', c.title, 'kind', c.kind, 'section', c.section, 'emoji', c.emoji, 'published', c.published,
        'uses', (select count(*) from u where u.card_id = c.id),
        'teachers', (select count(distinct user_id) from u where u.card_id = c.id),
        'classes', (select count(distinct class_id) from u where u.card_id = c.id),
        'likes', (select count(*) from u where u.card_id = c.id and rating = 1),
        'dislikes', (select count(*) from u where u.card_id = c.id and rating = -1),
        'last_on', (select max(used_on) from u where u.card_id = c.id),
        'notes', (select coalesce(jsonb_agg(jsonb_build_object('note', note, 'who', who, 'on', used_on, 'rating', rating)
                    order by used_on desc), '[]') from u where u.card_id = c.id and coalesce(trim(note), '') <> '')
      )), '[]') from activity_cards c),
    -- ما استخدمه كل معلم: البطاقة وعدد مراتها وآخرها
    'teachers', (select coalesce(jsonb_agg(jsonb_build_object('uid', uid, 'name', who, 'cards', cards)), '[]')
      from (select u.user_id uid, max(u.who) who,
                   jsonb_agg(jsonb_build_object('title', c.title, 'kind', c.kind, 'n', n, 'last_on', last_on) order by n desc, c.title) cards
            from (select user_id, card_id, max(who) who, count(*) n, max(used_on) last_on from u group by user_id, card_id) u
            join activity_cards c on c.id = u.card_id group by u.user_id) t)
  ) into r;
  return r;
end $$;
revoke all on function public.act_cards_report(text) from public, anon;
grant execute on function public.act_cards_report(text) to authenticated;

-- نهاية الجزء 1
