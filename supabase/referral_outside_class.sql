-- =====================================================================
-- إحالة طالب من خارج فصول المعلم (حصة انتظار / إشراف / مناوبة)
-- يُنفَّذ مرة واحدة من Supabase ← SQL Editor.
--
-- • صلاحية إنشاء الإحالة لا تشترط أن يكون الطالب من طلاب المعلم
--   (سياسة "teacher creates referral" تتحقق من teacher_id فقط)،
--   والقيد كان في قراءة الفصول والطلاب (enroll_teacher_read).
-- • بدل فتح القراءة لكل المعلمين، تُضاف دالتان تُرجعان الحد الأدنى فقط:
--   الفصول (رقم الفصل والصف)، وأسماء طلاب فصل واحد يُطلب بعينه.
--   تعملان للمعلم وللإدارة، ولا تعملان لغيرهما.
-- • العمود outside_class يوثّق أن الإحالة صدرت من خارج فصول صاحبها.
-- =====================================================================

alter table public.student_referrals
  add column if not exists outside_class boolean not null default false;

create or replace function public.referral_all_classes()
returns table (class_id uuid, class_no integer, grade integer)
language sql stable security definer
set search_path = public
as $$
  select c.id, c.class_no, c.grade
  from public.classes c
  where c.is_active
    and c.academic_year = public.active_year()
    and (public.current_teacher_id() is not null or public.is_admin())
  order by c.grade, c.class_no
$$;

create or replace function public.referral_class_students(p_class uuid)
returns table (id uuid, full_name text)
language sql stable security definer
set search_path = public
as $$
  select s.id, s.full_name
  from public.student_enrollment se
  join public.students s on s.id = se.student_id
  where se.class_id = p_class
    and se.status = 'active'
    and se.academic_year = public.active_year()
    and (public.current_teacher_id() is not null or public.is_admin())
  order by s.full_name
$$;

revoke all on function public.referral_all_classes() from public, anon;
revoke all on function public.referral_class_students(uuid) from public, anon;
grant execute on function public.referral_all_classes() to authenticated;
grant execute on function public.referral_class_students(uuid) to authenticated;
