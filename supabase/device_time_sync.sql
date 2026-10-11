-- مزامنة ساعة أجهزة البصمة من الخادم: وقت آخر ضبط لساعة كل جهاز
alter table public.devices add column if not exists time_synced_at timestamp with time zone;
-- نهاية الجزء 1
