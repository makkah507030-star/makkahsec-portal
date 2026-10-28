-- =====================================================================
-- ملف المعلم الرقمي (الجزء 9): اطلاع وكيل الشؤون التعليمية ووكيل شؤون الطلاب
-- على «ملفات المعلمين الرقمية» (القائمة وحالة كل ملف ورابطه)، مع المدير والدعم الفني.
-- الإيقاف وإعادة التفعيل يبقيان للدعم الفني وحده (teacher_dfiles_update دون تغيير).
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================
drop policy if exists teacher_dfiles_read on public.teacher_dfiles;
create policy teacher_dfiles_read on public.teacher_dfiles for select to authenticated
  using (teacher_user_id = auth.uid()
         or public.has_admin_role(array['principal', 'tech_support', 'deputy_academic', 'deputy_students']));

-- للتحقق
select count(*) as "الملفات المفعّلة" from public.teacher_dfiles where disabled_at is null;
-- نهاية الجزء 9
