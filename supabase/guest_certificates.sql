-- =====================================================================
-- شهادة شكر الضيوف والمتعاونين — للمحاضرين والمدربين ومنفّذي الأحداث
-- الذين يفدون إلى المدرسة بمهام محددة.
--
-- ١) نموذج «شهادة شكر وتقدير — ضيف أو متعاون» في النماذج والشهادات،
--    بتصميم مستقل في GuestCertificate (المفتاح guest_appreciation).
--    يُصدره المدير والوكلاء ورائد النشاط، بتوقيع المُصدِر والمدير والختم.
-- ٢) عمود guests في الأحداث: قائمة الضيوف الاختيارية في مرحلة «الشهادات»،
--    تُطبع لهم الشهادة نفسها بتوقيع منظّم الحدث والمدير والختم.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن
-- (يُحدّث حقول النموذج دون تكراره).
-- =====================================================================

-- ١) النموذج
insert into public.form_templates
  (key, title, category, department, description, orientation, fields,
   allowed_roles, requires_approval, signature_source, show_stamp, is_active, sort_order)
select
  'guest_appreciation',
  'شهادة شكر وتقدير — ضيف أو متعاون',
  'certificate',
  'school_admin',
  'للمحاضرين والمدربين ومنفّذي الأحداث من خارج المدرسة، في نهاية مهامهم.',
  'landscape',
  '[]'::jsonb,
  array['deputy_academic', 'deputy_school', 'deputy_students', 'activity_leader'],
  false,
  'both',
  true,
  true,
  15
on conflict (key) do nothing;

update public.form_templates
set fields = '[
  {"name": "recipient", "label": "اسم الضيف (مع لقبه)", "type": "text", "required": true,
   "presets": ["الأستاذ/ ", "الدكتور/ ", "المهندس/ ", "الشيخ/ "]},
  {"name": "entity", "label": "جهته (اختياري)", "type": "text", "required": false},
  {"name": "activity", "label": "البرنامج أو الحدث (اختياري)", "type": "text", "required": false},
  {"name": "reason", "label": "نص الشكر", "type": "textarea", "required": true,
   "presets": [
     "وذلك تقديرًا لتقديمه محاضرة قيّمة لطلاب المدرسة، وما قدّمه من علم نافع وجهد مشكور.",
     "وذلك تقديرًا لتنفيذه برنامجًا تدريبيًا متميّزًا، أسهم في تنمية مهارات المتدربين وإثراء خبراتهم.",
     "وذلك تقديرًا لإسهامه في تنفيذ فعاليات المدرسة، وما بذله من جهد وعطاء أسهم في نجاحها.",
     "وذلك تقديرًا لتقديمه ورشة عمل تطبيقية، وما أبداه من تعاون صادق وحرص على الفائدة.",
     "وذلك تقديرًا لشراكته المجتمعية الفاعلة، ودعمه المتواصل لبرامج المدرسة وأنشطتها."
   ]},
  {"name": "closing", "label": "الخاتمة", "type": "text", "required": false,
   "default": "سائلين الله له دوام التوفيق والسداد",
   "presets": ["سائلين الله له دوام التوفيق والسداد", "شاكرين له حسن تعاونه، متمنين له مزيدًا من التميّز"]},
  {"name": "date", "label": "التاريخ", "type": "date", "required": true}
]'::jsonb,
    updated_at = now()
where key = 'guest_appreciation';

-- ٢) ضيوف الحدث: [{id, name, entity, task}]
alter table public.school_events add column if not exists guests jsonb not null default '[]'::jsonb;

-- للتحقق بعد التنفيذ
select key, title, category, allowed_roles, signature_source, jsonb_array_length(fields) as fields
from public.form_templates where key = 'guest_appreciation';
