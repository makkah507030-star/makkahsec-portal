-- نموذج «تنبيه عن تأخر / انصراف»: صيغ جاهزة جديدة.
--   • «نوع المخالفة»: صيغتا ساعات التأخر، وعدم توثيق بصمة الخروج (نظام حضوري).
--   • «رأي مدير المدرسة»: عذره مقبول / عذره غير مقبول ويحسم عليه.
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor. لا يكرّر الصيغة إن نُفّذ مرة ثانية،
-- ولا يمسّ المستندات الصادرة سابقًا (بياناتها محفوظة معها).

with add(name, presets) as (
  values
    ('f6',  '["بلغ تأخركم عن الدوام الرسمي (    ) ساعات",
             "من خلال متابعة تقارير نظام حضوري لوحظ عدم قيامكم بتوثيق بصمة الخروج عند نهاية الدوام"]'::jsonb),
    ('f10', '["عذره مقبول", "عذره غير مقبول ويحسم عليه"]'::jsonb)
)
update public.form_templates t
set fields = (
  select jsonb_agg(
           case
             when a.name is null then f
             else jsonb_set(f, '{presets}',
                    coalesce(f->'presets', '[]'::jsonb)
                    || coalesce((select jsonb_agg(p) from jsonb_array_elements(a.presets) p
                                 where not coalesce(f->'presets', '[]'::jsonb) @> jsonb_build_array(p)),
                                '[]'::jsonb))
           end
           order by ord)
  from jsonb_array_elements(t.fields::jsonb) with ordinality as x(f, ord)
  left join add a on a.name = f->>'name'
)
where t.id = '22ef83f8-a573-4c6d-bf29-3f0ffb3ce496';

-- للتحقق بعد التنفيذ
select jsonb_pretty(fields::jsonb) from public.form_templates
where id = '22ef83f8-a573-4c6d-bf29-3f0ffb3ce496';
