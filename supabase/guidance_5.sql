-- =====================================================================
-- التوجيه الطلابي — الجزء 5: ربط البرنامج الإرشادي بحدث في «الأحداث والمناسبات».
-- ينفَّذ البرنامج حدثًا (مشاركون، وموافقات، وحضور، وشهادات، وتقرير واعتماد)،
-- أو يُربط بحدث نُفّذ. يُعدّ البرنامج منفَّذًا حين يُعتمد حدثه، ومستفيدوه
-- طلاب الحدث. يُنفَّذ بعد الجزء 3. تكرار التنفيذ آمن.
-- =====================================================================
alter table public.guidance_programs
  add column if not exists event_id uuid references public.school_events(id) on delete set null;
create index if not exists guidance_programs_event_idx on public.guidance_programs (event_id);
-- نهاية الجزء 5
