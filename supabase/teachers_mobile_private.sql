-- =====================================================================
-- حماية جوالات المعلمين: لا يقرؤها إلا الإداريون
--
-- سياسة teachers_read_basic تسمح لكل مستخدم مسجّل (ومنهم الطلاب وأولياء
-- الأمور) بقراءة جدول المعلمين، فكان عمود mobile مكشوفًا لهم عبر الواجهة
-- البرمجية. الحل بصلاحيات الأعمدة: تبقى قراءة بقية الأعمدة كما هي، ويُمنع
-- عمود mobile، ويقرؤه الإداري عبر الدالة teacher_mobiles().
-- الإضافة والتعديل (سجل المعلمين والاستيراد) لا تتأثر.
--
-- تنبيه: أي عمود يُضاف لاحقًا إلى teachers يحتاج سطر grant select له هنا.
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

revoke select on public.teachers from anon, authenticated;
grant select (id, user_id, national_id, full_name, specialization, is_active, created_at)
  on public.teachers to authenticated;

create or replace function public.teacher_mobiles()
returns table (id uuid, mobile text)
language sql stable security definer set search_path = public as $$
  select t.id, t.mobile from public.teachers t
  where public.is_admin() and t.mobile is not null
$$;

revoke all on function public.teacher_mobiles() from public, anon;
grant execute on function public.teacher_mobiles() to authenticated;

-- نهاية الجزء 1
