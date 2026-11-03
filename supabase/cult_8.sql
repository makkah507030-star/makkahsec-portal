-- =====================================================================
-- صفة سفير الثقافة في أحداثه السابقة: الأحداث التي أنشأها سفير الثقافة المؤسسية بصفة «معلم» وربطها بنشاط
-- في الخطة التنفيذية تصير صفته فيها «سفير الثقافة المؤسسية»، فتظهر تحت توقيعه في الشهادات والتقرير.
-- والأحداث الجديدة يختار فيها صفته عند إنشائها. يُنفَّذ بعد cult_6.sql. تكرار التنفيذ آمن.
-- =====================================================================
update public.school_events e set organizer_role = 'سفير الثقافة المؤسسية'
 where e.organizer_role = 'معلم'
   and e.organizer_id in (select user_id from public.cult_team where role = 'ambassador')
   and exists (select 1 from public.cult_activities a where a.event_id = e.id);

-- للمراجعة: أحداث السفير الأخرى التي ما زالت بصفة «معلم» (غير مربوطة بنشاط في الخطة).
-- إن كان منها حدث للثقافة المؤسسية فاربطه بنشاطه من «الخطة التنفيذية» ثم شغّل هذا الملف مرة أخرى،
-- أو غيّر صفته بالسطر المعطّل في آخر الملف برقم الحدث.
select e.serial as "رقم الحدث", e.title as "الحدث", e.event_date as "التاريخ", e.organizer_role as "الصفة"
  from public.school_events e
 where e.organizer_id in (select user_id from public.cult_team where role = 'ambassador')
 order by e.event_date desc;

-- update public.school_events set organizer_role = 'سفير الثقافة المؤسسية' where serial = '...';
-- نهاية الجزء 1
