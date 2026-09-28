-- =====================================================================
-- منع تحضير حصة قبل بدايتها.
--
-- الثغرة: شاشة التحضير كانت تسمح برصد أي حصة في اليوم متى شاء المعلم،
-- وفي الفسحة تختار الحصة القادمة تلقائيًا فيُحضّرها قبل وقتها.
-- أُقفلت الحصة في الواجهة، وهذا الفحص يرفضه في القاعدة كذلك، فلا يتجاوزه
-- تقديم ساعة الجهاز ولا أي طلب مباشر.
--
-- • يسري على المعلمين فقط. الإدارة (تعديل السجلات، المفقودون…) والدوال
--   الآلية (بلا مستخدم) مستثناة.
-- • التوقيت بتوقيت الرياض، ووقت الحصة من التوقيت الزمني المفعّل (صيفي/شتوي/رمضان).
-- • تحضير يوم لم يأتِ مرفوض، والأيام السابقة كما كانت.
--
-- يعتمد على الدالة public.sa_is_staff() من ملف student_affairs.sql.
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، ويمكن إعادة تنفيذه بأمان.
-- =====================================================================

create or replace function public.ca_block_early_marking()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_now    timestamp := now() at time zone 'Asia/Riyadh';
  v_season text;
  v_start  time;
begin
  if auth.uid() is null or public.sa_is_staff() then
    return new;
  end if;

  if new.attend_date > v_now::date then
    raise exception 'لا يمكن تحضير يوم لم يأتِ بعد.' using errcode = 'check_violation';
  end if;

  if new.attend_date < v_now::date then
    return new;
  end if;

  select coalesce((select value from public.settings where key = 'active_season'), 'summer')
    into v_season;

  select pt.start_time::time into v_start
  from public.schedule s
  join public.period_times pt
    on pt.kind = 'period' and pt.period_no = s.period_no and pt.season = v_season
  where s.id = new.schedule_id
  limit 1;

  if v_start is not null and v_now::time < v_start then
    raise exception 'لم تبدأ هذه الحصة بعد — يُفتح تحضيرها الساعة %', to_char(v_start, 'HH12:MI')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists ca_block_early_marking on public.class_attendance;
create trigger ca_block_early_marking
  before insert or update on public.class_attendance
  for each row execute function public.ca_block_early_marking();

-- للمراجعة: تحضير اليوم الذي حُفظ قبل بداية حصته (إن كان في الجدول وقت الإنشاء)
-- select s.period_no, c.class_no, t.full_name, min(ca.created_at at time zone 'Asia/Riyadh') as saved_at
-- from public.class_attendance ca
-- join public.schedule s on s.id = ca.schedule_id
-- join public.classes c on c.id = s.class_id
-- join public.teachers t on t.id = s.teacher_id
-- where ca.attend_date = (now() at time zone 'Asia/Riyadh')::date
-- group by 1, 2, 3 order by 1, 2;
