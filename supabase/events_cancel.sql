-- إلغاء الأحداث والمناسبات: الحدث الملغى يبقى موثّقًا بسببه ووقته ومن ألغاه.
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، ويمكن إعادة تنفيذه بأمان.
-- الإلغاء تحديث للحدث، فتسري عليه قاعدة «update events» القائمة:
-- منظّم الحدث، أو المدير والدعم الفني ووكيل شؤون الطلاب.
alter table public.school_events add column if not exists cancelled_at      timestamptz;
alter table public.school_events add column if not exists cancel_reason     text;
alter table public.school_events add column if not exists cancelled_by_name text;
