-- شهادات الأحداث والمناسبات: نص الشهادة القابل للتعديل لكل حدث.
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor.
alter table public.school_events add column if not exists cert_title    text;
alter table public.school_events add column if not exists cert_template text default 'classic';
alter table public.school_events add column if not exists cert_text     text;
