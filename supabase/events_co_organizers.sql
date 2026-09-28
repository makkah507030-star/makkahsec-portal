-- =====================================================================
-- الحدث المنظَّم من أكثر من معلم: يضيف المنظّم زملاءه المشاركين، فتظهر
-- أسماؤهم وتواقيعهم المحفوظة مع توقيعه في نماذج موافقة أولياء الأمور.
--
--   • school_events.co_organizers : [{user_id, name, role}]
--   • form_documents.co_signers   : نسخة منها في كل مستند موافقة
--   • ev_teacher_directory()      : أسماء المعلمين لاختيارهم (اسم وحساب فقط)
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، ويمكن إعادة تنفيذه بأمان.
-- =====================================================================

alter table public.school_events  add column if not exists co_organizers jsonb not null default '[]'::jsonb;
alter table public.form_documents add column if not exists co_signers    jsonb not null default '[]'::jsonb;

create or replace function public.ev_teacher_directory()
returns table (user_id public.teachers.user_id%type, full_name public.teachers.full_name%type)
language sql stable security definer set search_path = public as $$
  select t.user_id, t.full_name
  from public.teachers t
  where t.user_id is not null and auth.uid() is not null
  order by t.full_name;
$$;

revoke execute on function public.ev_teacher_directory() from public;
grant  execute on function public.ev_teacher_directory() to authenticated;
