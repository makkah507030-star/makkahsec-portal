-- =====================================================================
-- تذكير التحضير بعد ربع ساعة من بداية الحصة (بدل ١٠ دقائق)، لمن لم يرصد
-- تحضير حصته فقط. الدالة attendance-reminder تقرأ المهلة من هذا الإعداد،
-- وقيمتها الافتراضية في الكود 15 أيضًا.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

insert into public.settings (key, value) values ('attendance_reminder_minutes', '15')
on conflict (key) do update set value = excluded.value, updated_at = now();

-- للتحقق
select key, value from public.settings
where key in ('attendance_reminder_minutes', 'attendance_reminder_enabled');
