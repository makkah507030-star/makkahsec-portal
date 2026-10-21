-- =====================================================================
-- الأحداث الممتدة: «إلى تاريخ» لحدث يمتد أيامًا أو شهورًا (مثل برنامج كشفي طوال الفصل).
-- event_date يبقى تاريخ البدء، وend_date آخر يوم (فارغ = حدث في يوم واحد).
-- تكرار التنفيذ آمن.
-- =====================================================================
alter table public.school_events add column if not exists end_date date;

alter table public.school_events drop constraint if exists school_events_end_after_start;
alter table public.school_events
  add constraint school_events_end_after_start check (end_date is null or end_date >= event_date);

-- للتحقق: عدد الأحداث الممتدة
select count(*) filter (where end_date is not null) as extended_events, count(*) as all_events
  from public.school_events;
-- نهاية الجزء 1
