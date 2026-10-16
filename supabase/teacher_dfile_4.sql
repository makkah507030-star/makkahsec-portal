-- ملف المعلم الرقمي (الجزء 4): بيانات يكتبها المعلم لقسم «التخطيط والتدريس».
-- • madrasati: إحصاءات منصة مدرستي
--   { lessons, homework, tests, enrich, weekly_plan (true/false), at }
-- • activities: الأنشطة الصفية واللاصفية، نوع النشاط وعدده
--   { class: [{ t, n }], extra: [{ t, n }] }
-- • distribution: توزيع المنهج بعد قراءته ومراجعة المعلم، لكل مادة أسابيعها
--   { items: [{ subject, file, weeks: [{ n, t }] }] }، ويرى الزائر أسبوع dfile_week().
-- يُنفَّذ بعد الأجزاء 1 و2 و3. تكرار التنفيذ آمن.

alter table public.teacher_dfiles add column if not exists madrasati jsonb not null default '{}'::jsonb;
alter table public.teacher_dfiles add column if not exists activities jsonb not null default '{}'::jsonb;
alter table public.teacher_dfiles add column if not exists distribution jsonb not null default '{}'::jsonb;
-- نهاية الجزء 4
