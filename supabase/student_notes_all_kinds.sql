-- =====================================================================
-- ملاحظات الطلاب: كل الأنواع (صحية وسلوكية ونفسية) لكل الموجهين.
--
-- يكتب كل الأنواع: الموجه الصحي، والموجهون الطلابيون 1 و2 و3،
-- والمدير ووكيل شؤون الطلاب والدعم الفني.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor بعد student_notes.sql، وتكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.sn_can_write(p_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select p_kind in ('health', 'behavior', 'psych') and exists (
    select 1 from public.admin_roles ar
    where ar.user_id = auth.uid()
      and ar.role_type in ('principal', 'deputy_students', 'tech_support', 'health_counselor',
                           'counselor', 'counselor_1', 'counselor_2', 'counselor_3')
  );
$$;
