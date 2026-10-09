-- =====================================================================
-- التطوير المهني (الجزء 5): ملف التطوير المهني للقسم.
--
-- dept_pd_file: شواهد عنصر «التفاعل مع المجتمع المهني» (e02) لكل معلم في
-- القسم للعام، سطر لكل شاهد، ومعلم بلا شواهد يظهر بسطر فارغ (item_key = null)
-- ليُحسب في النواقص. لرئيس القسم على قسمه، وللمدير ووكيل الشؤون التعليمية
-- والدعم الفني على أي قسم. يُنفَّذ بعد الأجزاء 1–4. تكرار التنفيذ آمن.
-- =====================================================================

create or replace function public.dept_pd_file(p_dept uuid, p_year text)
returns table (teacher_id uuid, user_id uuid, full_name text, is_head boolean, item_key text,
               title text, provider text, event_date date, hours numeric, source text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.is_dept_head(p_dept)
          or public.has_admin_role(array['principal', 'deputy_academic', 'tech_support'])) then
    raise exception 'غير مصرّح';
  end if;

  return query
  select t.id, t.user_id, t.full_name, m.is_head, e.item_key, e.title, e.provider, e.event_date, e.hours,
         e.source, e.created_at
    from department_members m
    join teachers t on t.id = m.teacher_id
    left join perf_evidence e
      on e.teacher_user_id = t.user_id and e.academic_year = p_year and e.item_key like 'e02\_%'
   where m.department_id = p_dept
   order by m.is_head desc, t.full_name, e.item_key, e.event_date;
end;
$$;

revoke execute on function public.dept_pd_file(uuid, text) from public, anon;
grant  execute on function public.dept_pd_file(uuid, text) to authenticated;
-- نهاية الجزء 5
