-- =====================================================================
-- ملف الطالب الشامل (الجزء 1 من 3): الهوية والمواظبة. ثلاث دوال يجمع كل منها جانبًا من بيانات
-- الطالب في الفترة، للمدير ووكيل شؤون الطلاب والدعم الفني وموجّه صفه (guidance_can).
-- security definer: يقرأ من يحق له الملف كل جوانبه وإن لم تتح له الجداول نفسها. تكرار التنفيذ آمن.
-- =====================================================================

-- هل يحق للمستخدم فتح ملف هذا الطالب؟ (حسب صفّه الحالي)
create or replace function public.sf_can(p_student uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select public.guidance_can(coalesce((select grade from v_active_students where student_id = p_student limit 1), 0));
$$;

-- الهوية والمواظبة في الفترة
create or replace function public.student_file_attendance(p_student uuid, p_from date, p_to date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb; v_drop jsonb; v_scout boolean := false;
begin
  if not public.sf_can(p_student) then raise exception 'غير مصرّح'; end if;
  -- الانقطاع والفريق الكشفي إن وُجدت جداولهما (وحدتان قد لا تكونان مفعّلتين)
  if to_regclass('public.student_dropouts') is not null then
    execute 'select jsonb_build_object(''status'', status, ''reason'', reason, ''at'', reported_at) from student_dropouts
             where student_id = $1 order by reported_at desc limit 1' into v_drop using p_student;
  end if;
  if to_regclass('public.scout_members') is not null then
    execute 'select exists (select 1 from scout_members where student_id = $1)' into v_scout using p_student;
  end if;
  select jsonb_build_object(
    'student', (select jsonb_build_object('id', s.id, 'full_name', s.full_name, 'national_id', s.national_id,
        'birth_date', s.birth_date, 'nationality', s.nationality, 'class_no', v.class_no, 'grade', v.grade,
        'guardian', (select jsonb_build_object('name', g.full_name, 'mobile', g.mobile, 'relation', gs.relation)
                       from guardian_student gs join guardians g on g.id = gs.guardian_id
                      where gs.student_id = s.id order by gs.is_primary desc limit 1),
        'dropout', v_drop, 'scout', v_scout)
      from students s left join v_active_students v on v.student_id = s.id where s.id = p_student limit 1),
    'school_days', (select coalesce(jsonb_agg(d.attend_date order by d.attend_date), '[]') from official_attendance_days d
                     where d.attend_date between p_from and least(p_to, current_date)),   -- أيام الدراسة المعتمدة
    'days', (select coalesce(jsonb_agg(jsonb_build_object('d', m.attend_date, 's', m.status,
                 'late', coalesce(m.late_minutes, 0), 'punched', m.punched) order by m.attend_date), '[]')
               from official_day_marks m where m.student_id = p_student and m.attend_date between p_from and p_to),
    'excused', (select coalesce(jsonb_agg(jsonb_build_object('from', e.date_from, 'to', e.date_to,
                 'excuse', e.excuse, 'reason', e.reason) order by e.date_from), '[]')
               from excused_absences e where e.student_id = p_student and e.date_to >= p_from and e.date_from <= p_to),
    'periods', (select coalesce(jsonb_agg(jsonb_build_object('d', c.attend_date, 's', c.status, 'p', sc.period_no,
                 'subject', sub.name) order by c.attend_date, sc.period_no), '[]')
               from class_attendance c left join schedule sc on sc.id = c.schedule_id left join subjects sub on sub.id = sc.subject_id
              where c.student_id = p_student and c.attend_date between p_from and p_to and c.status <> 'present'),
    'warnings', (select coalesce(jsonb_agg(jsonb_build_object('stage', w.stage, 'on', w.issued_on, 'days', w.days_count,
                 'by', w.issued_by_name) order by w.issued_on), '[]')
               from absence_warnings w where w.student_id = p_student and w.issued_on between p_from and p_to),
    'permissions', (select coalesce(jsonb_agg(jsonb_build_object('d', r.request_date, 'scope', r.scope,
                 'periods', r.period_numbers, 'note', r.note) order by r.request_date), '[]')
               from permission_request_students ps join permission_requests r on r.id = ps.request_id
              where ps.student_id = p_student and r.request_date between p_from and p_to)
  ) into v;
  return v;
end $$;

revoke all on function public.sf_can(uuid), public.student_file_attendance(uuid, date, date) from public, anon;
grant execute on function public.sf_can(uuid), public.student_file_attendance(uuid, date, date) to authenticated;
-- نهاية الجزء 1
