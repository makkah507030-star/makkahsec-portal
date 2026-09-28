-- =====================================================================
-- إصلاح: infinite recursion detected in policy for relation "school_events"
--
-- السبب: قاعدة قراءة school_events تبحث في event_participants (هل الطالب
-- أو ولي الأمر مشارك؟)، وقواعد event_participants تبحث في school_events
-- (هل المستخدم منظّم الحدث أو إداري؟) — فتدور القاعدتان على بعضهما.
--
-- الحل: التحقق المتبادل ينتقل إلى دوال security definer تقرأ الجدول
-- مباشرة دون المرور بقواعد الصلاحية، فينقطع الدوران. الصلاحيات نفسها
-- لا تتغيّر: من يرى الحدث، ومن يديره، ومن يقرأ المشاركين.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، ويمكن إعادة تنفيذه بأمان.
-- =====================================================================

-- هل للمستخدم الحالي ابن أو هو نفسه مشارك في الحدث؟ (طالب أو ولي أمر)
create or replace function public.ev_is_participant(p_event public.school_events.id%type)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.event_participants p
    join public.students s on s.id = p.student_id
    where p.event_id = p_event and s.user_id = auth.uid()
  ) or exists (
    select 1 from public.event_participants p
    join public.guardian_student gs on gs.student_id = p.student_id
    join public.guardians g on g.id = gs.guardian_id
    where p.event_id = p_event and g.user_id = auth.uid()
  );
$$;

-- هل المستخدم الحالي منظّم الحدث أو يحمل أحد الأدوار الإدارية المذكورة؟
create or replace function public.ev_is_manager(p_event public.school_events.id%type, p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.school_events e
    where e.id = p_event
      and (e.organizer_id = auth.uid() or public.has_admin_role(p_roles))
  );
$$;

-- بلا قائمة معاملات: الاسم فريد، فلا حاجة لتكرار نوع المعرّف
revoke execute on function public.ev_is_participant from public, anon;
revoke execute on function public.ev_is_manager     from public, anon;
grant  execute on function public.ev_is_participant to authenticated;
grant  execute on function public.ev_is_manager     to authenticated;

-- ---------------------------------------------------------------------
-- school_events: القراءة (بقية القواعد لا تمسّ event_participants فتبقى كما هي)
-- ---------------------------------------------------------------------
drop policy if exists "read events" on public.school_events;
create policy "read events" on public.school_events
  for select to authenticated
  using (
    organizer_id = auth.uid()
    or public.has_admin_role(array['principal', 'tech_support', 'deputy_students',
                                   'deputy_academic', 'activity_leader'])
    or public.ev_is_participant(id)
  );

-- ---------------------------------------------------------------------
-- event_participants
-- ---------------------------------------------------------------------
drop policy if exists "manage participants" on public.event_participants;
create policy "manage participants" on public.event_participants
  for all to authenticated
  using (public.ev_is_manager(event_id, array['principal', 'tech_support', 'deputy_students']))
  -- كان with check = true، فيسمح لأي حساب بإضافة مشاركين لأي حدث؛ صار بنفس شرط الإدارة
  with check (public.ev_is_manager(event_id, array['principal', 'tech_support', 'deputy_students']));

drop policy if exists "read participants" on public.event_participants;
create policy "read participants" on public.event_participants
  for select to authenticated
  using (
    public.ev_is_manager(event_id, array['principal', 'tech_support', 'deputy_students',
                                         'deputy_academic', 'activity_leader'])
    or exists (
      select 1 from public.students s
      where s.id = event_participants.student_id and s.user_id = auth.uid()
    )
    or exists (
      select 1 from public.guardian_student gs
      join public.guardians g on g.id = gs.guardian_id
      where gs.student_id = event_participants.student_id and g.user_id = auth.uid()
    )
  );

-- موافقة ولي الأمر: كما كانت، مع منع نقل السجل لطالب آخر ليس من أبنائه
drop policy if exists "guardian consents" on public.event_participants;
create policy "guardian consents" on public.event_participants
  for update to authenticated
  using (
    exists (
      select 1 from public.guardian_student gs
      join public.guardians g on g.id = gs.guardian_id
      where gs.student_id = event_participants.student_id and g.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.guardian_student gs
      join public.guardians g on g.id = gs.guardian_id
      where gs.student_id = event_participants.student_id and g.user_id = auth.uid()
    )
  );
