-- =====================================================================
-- ملف المعلم الرقمي: قسم «مختبرات العلوم» لمعلمي الأحياء والكيمياء والفيزياء.
-- • dfile_sci(كود الملف): يفتحه الزائر بكود الملف، أرقام بلا أسماء طلاب: حجوزات المختبر،
--   والتجارب المنفّذة في المختبر أو افتراضيًا هذا العام، والفصول، والمختبرات، وآخر التجارب.
-- • يعيد null لمن لا عمل له في مختبرات العلوم، فلا يظهر القسم. تكرار التنفيذ آمن.
-- =====================================================================
create or replace function public.dfile_sci(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare f teacher_dfiles; tid uuid; y text; r jsonb;
begin
  select d.* into f from teacher_dfiles d join users u on u.id = d.teacher_user_id
   where d.code = upper(trim(p_code)) and d.disabled_at is null and u.is_active;
  if not found then return null; end if;
  tid := (select id from teachers where user_id = f.teacher_user_id);
  y := (select value from settings where key = 'active_year');
  if tid is null or not (exists (select 1 from sci_runs where teacher_id = tid and academic_year = y)
     or exists (select 1 from sci_bookings where teacher_id = tid and booking_date >= current_date - 365)) then
    return null;
  end if;
  select jsonb_build_object(
    'bookings', (select count(*) from sci_bookings where teacher_id = tid and booking_date >= current_date - 365 and booking_date <= current_date),
    'lab',      (select count(*) from sci_runs where teacher_id = tid and academic_year = y and outcome = 'lab'),
    'virtual',  (select count(*) from sci_runs where teacher_id = tid and academic_year = y and outcome = 'virtual'),
    'not_done', (select count(*) from sci_runs where teacher_id = tid and academic_year = y and outcome = 'not_done'),
    'classes',  (select count(distinct class_id) from sci_runs where teacher_id = tid and academic_year = y),
    'labs', (select coalesce(jsonb_agg(jsonb_build_object('name', l.name, 'n', x.n) order by l.sort), '[]')
               from (select e.lab, count(*) n from sci_runs s join sci_experiments e on e.id = s.experiment_id
                      where s.teacher_id = tid and s.academic_year = y and s.outcome <> 'not_done' group by e.lab) x
               join sci_labs l on l.key = x.lab),
    'recent', (select coalesce(jsonb_agg(z order by z->>'date' desc), '[]') from (
               select jsonb_build_object('title', e.title, 'course', e.course, 'outcome', s.outcome, 'date', s.run_date) z
                 from sci_runs s join sci_experiments e on e.id = s.experiment_id
                where s.teacher_id = tid and s.academic_year = y and s.outcome <> 'not_done'
                order by s.run_date desc limit 8) q)
  ) into r;
  return r;
end $$;
revoke execute on function public.dfile_sci(text) from public;
grant execute on function public.dfile_sci(text) to anon, authenticated;

-- نهاية الجزء 1
