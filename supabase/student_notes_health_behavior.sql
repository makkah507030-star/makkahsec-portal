-- =====================================================================
-- ملاحظات الطلاب: الموجه الصحي يكتب الملاحظات السلوكية أيضًا.
--
-- بعد هذا الملف:
--   الصحية:   الموجه الصحي.
--   السلوكية: الموجه الصحي والموجهون الطلابيون.
--   النفسية:  الموجهون الطلابيون.
--   وكل الأنواع: المدير ووكيل شؤون الطلاب والدعم الفني.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor بعد student_notes.sql، وتكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.sn_can_write(p_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_roles ar
    where ar.user_id = auth.uid()
      and (
        ar.role_type in ('principal', 'deputy_students', 'tech_support')
        or (p_kind in ('health', 'behavior') and ar.role_type = 'health_counselor')
        or (p_kind in ('behavior', 'psych') and ar.role_type in ('counselor', 'counselor_1', 'counselor_2', 'counselor_3'))
      )
  );
$$;
