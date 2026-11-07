-- إشعار الفترة: أعمدة كل مادة (أصناف تقويمها) كما وردت في إشعارات الصف نفسه للعام،
-- ليظهر «لم يرصد المعلم» في خانات المادة وحدها، و«—» في الخانات التي ليست من أصناف تقويمها.
-- بلا أسماء ولا درجات: المادة واسم العمود فقط. تكرار التنفيذ آمن.

create or replace function public.period_notice_labels(p_year text, p_grade text, p_section text)
returns table (subject text, label text)
language sql stable security definer set search_path = public as $$
  select distinct s->>'name', p->>'label'
    from public.period_notices n
    cross join lateral jsonb_array_elements(n.subjects) s
    cross join lateral jsonb_array_elements(coalesce(s->'parts', '[]'::jsonb)) p
   where n.academic_year = p_year
     and n.grade_name is not distinct from p_grade
     and n.section is not distinct from p_section;
$$;
revoke execute on function public.period_notice_labels(text, text, text) from public, anon;
grant execute on function public.period_notice_labels(text, text, text) to authenticated;
-- نهاية الجزء 1
