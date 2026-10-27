-- =====================================================================
-- أعذار الغياب (الجزء 4): العذر اليدوي، والأعذار الرسمية وحدها — يُنفَّذ بعد النشر.
-- • العذر اليدوي: يسجّله متخذ القرار (الوكيل والمساعدان 1 و2 والمدير والدعم الفني) لعذر
--   لم يُرفع عبر البوابة (ورقي أو حضوري)، فيُقبل مباشرة ويصير غياب أيامه «غائب بعذر»،
--   ويظهر في السجل بصفة «المدرسة».
-- • الطالب وولي الأمر يختاران من الأعذار الرسمية (c1..c11) وحدها، بلا «ظرف آخر».
-- تكرار التنفيذ آمن.
-- =====================================================================
alter table public.absence_excuses drop constraint if exists absence_excuses_requester_check;
alter table public.absence_excuses add constraint absence_excuses_requester_check
  check (requester in ('student', 'guardian', 'school'));

-- محفّز الرفع من البوابة لا يعمل على ما تسجّله المدرسة يدويًا
drop trigger if exists absence_excuse_trg on public.absence_excuses;
create trigger absence_excuse_trg before insert on public.absence_excuses
  for each row when (coalesce(current_setting('app.excuse_manual', true), '') <> '1')
  execute function public.absence_excuse_trg();

-- الرفع من البوابة: حالة من الأعذار الرسمية فقط
create or replace function public.absence_excuse_case_trg() returns trigger
language plpgsql set search_path = public as $$
begin
  if coalesce(new.case_key, '') !~ '^c([1-9]|1[01])$' then
    raise exception 'اختر حالة العذر من الأعذار المقبولة رسميًا';
  end if;
  return new;
end $$;
drop trigger if exists absence_excuse_case_trg on public.absence_excuses;
create trigger absence_excuse_case_trg before insert on public.absence_excuses
  for each row when (coalesce(current_setting('app.excuse_manual', true), '') <> '1')
  execute function public.absence_excuse_case_trg();

-- مرفق العذر اليدوي يرفعه متخذ القرار أيضًا
drop policy if exists "absence excuses add" on storage.objects;
create policy "absence excuses add" on storage.objects for insert to authenticated
  with check (bucket_id = 'absence-excuses' and (public.excuse_manager()
              or public.excuse_relation(((storage.foldername(name))[1])::uuid) is not null));

create or replace function public.absence_excuse_manual(p_student uuid, p_dates date[], p_case text, p_reason text,
                                                        p_file_path text default null, p_file_name text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_dates date[]; who text; rl text; n int := 0; yr text; d date;
begin
  if not public.excuse_manager() then raise exception 'غير مصرّح'; end if;
  if coalesce(p_case, '') !~ '^c([1-9]|1[01])$' then raise exception 'اختر حالة العذر من الأعذار المقبولة رسميًا'; end if;
  -- أيام غياب فعلية فقط، كما في الرفع من البوابة
  select array_agg(distinct x order by x) into v_dates from unnest(p_dates) x
   where exists (select 1 from official_day_marks m where m.student_id = p_student and m.attend_date = x and m.status = 'absent')
      or exists (select 1 from class_attendance ca where ca.student_id = p_student and ca.attend_date = x and ca.status = 'absent');
  if v_dates is null then raise exception 'اختر أيام غياب مسجلة'; end if;
  who := (select full_name from users where id = auth.uid());
  select r.role_type::text into rl from admin_roles r where r.user_id = auth.uid()
   order by array_position(array['deputy_students', 'clerk', 'clerk_2', 'principal', 'tech_support'], r.role_type::text) nulls last limit 1;

  perform set_config('app.excuse_manual', '1', true);
  insert into absence_excuses (student_id, dates, kind, reason, file_path, file_name, requested_by, requester,
                               status, decision_note, decided_by_name, decided_by_role, decided_at, case_key)
  values (p_student, v_dates, case when p_case in ('c1', 'c2', 'c10') then 'medical' else 'other' end,
          nullif(trim(p_reason), ''), p_file_path, p_file_name, auth.uid(), 'school',
          'accepted', 'عذر مسجّل يدويًا من المدرسة', who, rl, now(), p_case);
  perform set_config('app.excuse_manual', '', true);

  update official_day_marks m
     set status = 'excused', manual = true, edited_by_name = who, edited_at = now(),
         note = left('عذر يدوي' || coalesce(': ' || nullif(trim(p_reason), ''), ''), 200)
   where m.student_id = p_student and m.attend_date = any(v_dates) and m.status = 'absent';
  get diagnostics n = row_count;
  select value into yr from settings where key = 'active_year';
  insert into excused_absences (student_id, date_from, date_to, excuse, reason, created_by, academic_year)
  select p_student, x, x, (case when p_case in ('c1', 'c2', 'c10') then 'medical' else 'other' end)::excuse_type,
         left(coalesce(nullif(trim(p_reason), ''), 'عذر يدوي من المدرسة'), 200), auth.uid(), coalesce(yr, '')
    from unnest(v_dates) x
   where not exists (select 1 from excused_absences e where e.student_id = p_student and x between e.date_from and e.date_to);
  -- أرقام الأيام المعتمدة بعد التحويل إلى «بعذر»
  foreach d in array v_dates loop
    if exists (select 1 from official_attendance_days where attend_date = d) then perform public.sa_recount_day(d); end if;
  end loop;
  return n;
end $$;
revoke all on function public.absence_excuse_manual(uuid, date[], text, text, text, text) from public, anon;
grant execute on function public.absence_excuse_manual(uuid, date[], text, text, text, text) to authenticated;
-- نهاية الجزء 1
