-- =====================================================================
-- رسائل الغياب بواتساب (يدويًا بزر «التالي»): قائمة الغائبين غيابًا رسميًا
-- بلا عذر في يوم معتمد، مع جوال ولي الأمر، وسجل من أرسل لكل طالب حتى لا تتكرر.
-- لشؤون الطلاب والكتّاب بالصفوف كلها، وللموجه الطلابي بصفه وحده. تكرار تنفيذه آمن.
-- =====================================================================

create table if not exists public.absence_wa_sent (
  student_id   uuid not null,
  attend_date  date not null,
  sent_by      uuid default auth.uid(),
  sent_by_name text,
  sent_at      timestamptz not null default now(),
  primary key (student_id, attend_date)
);
-- بلا سياسات: القراءة والكتابة من الدالتين أدناه فقط
alter table public.absence_wa_sent enable row level security;

-- الصفوف المسموحة للمستخدم الحالي
create or replace function public.absence_wa_grades()
returns int[] language sql stable security definer set search_path = public as $$
  select case
    when public.has_admin_role(array['principal', 'deputy_students', 'tech_support', 'clerk', 'clerk_2']) then array[1, 2, 3]
    else array(select g from unnest(array[1, 2, 3]) g where public.has_admin_role(array['counselor_' || g]))
  end;
$$;

create or replace function public.absence_wa_list(p_date date)
returns table (student_id uuid, full_name text, grade int, class_no int, guardian_name text, mobile text,
               consent boolean, has_push boolean, last_login timestamptz, sent_at timestamptz, sent_by_name text)
language sql stable security definer set search_path = public as $$
  select m.student_id, m.full_name, m.grade, m.class_no, g.full_name, g.mobile,
         coalesce(g.sms_consent, true) and g.sms_opt_out_at is null,
         exists (select 1 from push_subscriptions p where p.user_id = g.user_id),
         u.last_login, w.sent_at, w.sent_by_name
  from official_day_marks m
  left join lateral (
    select gd.full_name, gd.mobile, gd.user_id, gd.sms_consent, gd.sms_opt_out_at
    from guardian_student gs join guardians gd on gd.id = gs.guardian_id
    where gs.student_id = m.student_id and gd.is_active
    order by gs.is_primary desc, gd.created_at limit 1) g on true
  left join users u on u.id = g.user_id
  left join absence_wa_sent w on w.student_id = m.student_id and w.attend_date = p_date
  where m.attend_date = p_date and m.status = 'absent' and m.grade = any (public.absence_wa_grades())
  order by m.grade, m.class_no, m.full_name;
$$;

-- تسجيل الإرسال (أو إلغاؤه) لطالب في يوم
create or replace function public.absence_wa_mark(p_student uuid, p_date date, p_undo boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from official_day_marks m where m.student_id = p_student and m.attend_date = p_date
                 and m.status = 'absent' and m.grade = any (public.absence_wa_grades())) then
    raise exception 'لا تملك صلاحية هذا الإجراء' using errcode = '42501';
  end if;
  if p_undo then
    delete from absence_wa_sent where student_id = p_student and attend_date = p_date;
  else
    insert into absence_wa_sent(student_id, attend_date, sent_by, sent_by_name)
      values (p_student, p_date, auth.uid(), public.sa_my_name())
      on conflict (student_id, attend_date) do nothing;
  end if;
end $$;

-- سجل الرسائل لمدة (حتى 190 يومًا): الغائبون بلا عذر، ومن أُرسل له ثم قُبل عذره، مع من أرسل ومتى
create or replace function public.absence_wa_range(p_from date, p_to date)
returns table (attend_date date, student_id uuid, full_name text, grade int, class_no int, status text,
               has_mobile boolean, sent_at timestamptz, sent_by_name text)
language sql stable security definer set search_path = public as $$
  select m.attend_date, m.student_id, m.full_name, m.grade, m.class_no, m.status,
         exists (select 1 from guardian_student gs join guardians gd on gd.id = gs.guardian_id
                 where gs.student_id = m.student_id and gd.is_active and coalesce(gd.mobile, '') <> ''),
         w.sent_at, w.sent_by_name
  from official_day_marks m
  left join absence_wa_sent w on w.student_id = m.student_id and w.attend_date = m.attend_date
  where m.attend_date between p_from and least(p_to, p_from + 190)
    and (m.status = 'absent' or w.sent_at is not null) and m.grade = any (public.absence_wa_grades())
  order by m.attend_date desc, m.grade, m.class_no, m.full_name;
$$;

revoke execute on function public.absence_wa_grades() from public, anon;
revoke execute on function public.absence_wa_list(date) from public, anon;
revoke execute on function public.absence_wa_mark(uuid, date, boolean) from public, anon;
revoke execute on function public.absence_wa_range(date, date) from public, anon;
grant execute on function public.absence_wa_grades() to authenticated;
grant execute on function public.absence_wa_list(date) to authenticated;
grant execute on function public.absence_wa_mark(uuid, date, boolean) to authenticated;
grant execute on function public.absence_wa_range(date, date) to authenticated;

-- نهاية الجزء 1
