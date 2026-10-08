-- شواهد الأداء الوظيفي: تنبيه في صفحة النموذج وفي نسخته المطبوعة
-- «يمكنك الاستفادة من هذا النموذج شاهدًا على: …» بحسب فئة الموظف.
-- المصدر: وثيقة «خدمات البوابة وبنود الأداء الوظيفي لكل فئة» (الدليل الإرشادي، الإصدار الثاني).
-- شغّل الملف كاملًا في Supabase ← SQL Editor؛ يمكن تكراره دون تكرار الصفوف.

create table if not exists public.evidence_links (
  id uuid primary key default gen_random_uuid(),
  template_key text not null,                       -- form_templates.key
  kind text not null default 'job' check (kind in ('job', 'school')),
                                                    -- job: الأداء الوظيفي، school: مؤشرات التقويم المدرسي (للإدارة، لاحقًا)
  category text not null check (category in
    ('all', 'teacher', 'activity', 'health', 'lab', 'guide', 'leadership')),
                                                    -- all: كل الفئات، leadership: الوكلاء والمدير
  code text,                                        -- رمز المؤشر المدرسي (للنوع school)
  element text not null,                            -- عنصر التقييم أو المؤشر
  level text not null check (level in ('direct', 'support')),
  note text,                                        -- ما الذي في النموذج يخدم العنصر
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (template_key, kind, category, element)
);

alter table public.evidence_links enable row level security;

drop policy if exists evidence_links_read on public.evidence_links;
create policy evidence_links_read on public.evidence_links as PERMISSIVE for SELECT to authenticated
  using (is_active);

drop policy if exists evidence_links_write_tech on public.evidence_links;
create policy evidence_links_write_tech on public.evidence_links as PERMISSIVE for ALL to authenticated
  using (public.is_tech_support()) with check (public.is_tech_support());

-- نماذج الغياب والتأخر الأربعة: عنصر «أداء الواجبات الوظيفية» المشترك بين الفئات
insert into public.evidence_links (template_key, category, element, level, note, sort_order)
select k, 'all', 'أداء الواجبات الوظيفية', 'direct', 'النماذج الموقعة بإقرار صاحبها', 10
from unnest(array['frm_late_notice', 'frm_hours_deduction', 'frm_absence_inquiry', 'frm_absence_deduction']) as k
on conflict do nothing;

-- استمارة دعم وتطوير الهيئة التعليمية
insert into public.evidence_links (template_key, category, element, level, note, sort_order) values
  ('teacher_support_visit', 'all',        'التفاعل مع المجتمع المهني',                         'support', 'استمارات الدعم الموقعة', 10),
  ('teacher_support_visit', 'teacher',    'التنويع في استراتيجيات التدريس',                    'support', 'استمارات زيارات الدعم', 20),
  ('teacher_support_visit', 'leadership', 'يقدم التغذية الراجعة ويتابع مؤشرات تحقق الأداء الوظيفي', 'direct', 'الاستمارات الموقعة بأرقامها التسلسلية', 20),
  ('teacher_support_visit', 'leadership', 'يقيّم أداء منسوبي المدرسة',                        'direct',  'استمارة التقييم المطبوعة', 30),
  ('teacher_support_visit', 'leadership', 'يدعم تنفيذ برامج التطوير المهني',                  'support', 'استمارات الدعم وسجل الإشعارات', 40),
  ('teacher_support_visit', 'leadership', 'يعد أو يشارك في إعداد خطة للتطوير المهني',         'support', 'تقرير نموذج لزيارات الدعم', 50)
on conflict do nothing;
