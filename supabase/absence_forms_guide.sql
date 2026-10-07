-- =====================================================================
-- نماذج الغياب والتأخر وفق «الدليل الإجرائي لمدارس التعليم العام»
-- (الإصدار الثالث، النماذج 18–21). الطباعة نفسها في FormSheet.jsx (AbsenceForm)
-- بنص الدليل حرفيًا؛ وهذا الملف يكمّل حقول جدول بيانات الموظف كما في الدليل:
--
--   (18) تنبيه على تأخر / انصراف      + المستوى/المرتبة، رقم الوظيفة
--   (19) قرار حسم ساعات تأخر          + التخصص، المستوى/المرتبة، رقم الوظيفة
--   (20) مساءلة غياب                 + التخصص، المستوى/المرتبة، الدرجة، رقم الوظيفة
--   (21) قرار حسم غياب               + التخصص، المستوى/المرتبة، الدرجة، رقم الوظيفة
--
-- وما ليس في نماذج الدليل يُخفى من الإصدار الجديد (legacy) ويبقى في المستندات
-- السابقة كما صدرت:
--   (18) «الإجراء المتخذ»   (19) «رقم الوظيفة والمرتبة» المدمج، و«سبب عدم قبول العذر»
--   (20) «رأي مدير المدرسة» (قرار المدير في الدليل خيارات أ، ب، ج)
--   (21) «رقم الوظيفة والمرتبة» المدمج
-- واسم النموذج (18) كما في الدليل: «تنبيه على تأخر / انصراف»، وصيغ قرار المدير
-- في (20) هي خيارات الدليل الثلاثة بنصها.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

do $$
declare
  spec  constant jsonb := '{"name": "emp_spec",   "type": "text", "label": "التخصص",            "required": false}';
  rnk   constant jsonb := '{"name": "emp_rank",   "type": "text", "label": "المستوى / المرتبة", "required": false}';
  grd   constant jsonb := '{"name": "emp_grade",  "type": "text", "label": "الدرجة",            "required": false}';
  jobno constant jsonb := '{"name": "emp_job_no", "type": "text", "label": "رقم الوظيفة",       "required": false}';
  t record;
  cur jsonb;
  out jsonb;
  f jsonb;
  extra jsonb;
begin
  for t in
    select * from (values
      ('22ef83f8-a573-4c6d-bf29-3f0ffb3ce496'::uuid, jsonb_build_array(rnk, jobno),             array['action_taken']),
      ('c8d17093-c0de-4807-9719-f035b263a199'::uuid, jsonb_build_array(spec, rnk, jobno),       array['f4', 'f7']),
      ('c071d50d-1ca0-48d8-9447-5fbb6c7cf41e'::uuid, jsonb_build_array(spec, rnk, grd, jobno),  array['f6']),
      ('7d209ca1-e52b-4ed5-b0fb-d31f50f5cc97'::uuid, jsonb_build_array(spec, rnk, grd, jobno),  array['f4'])
    ) as x(id, add_fields, legacy_names)
  loop
    select fields::jsonb into cur from public.form_templates where id = t.id;
    continue when cur is null;

    -- الحقول الجديدة غير الموجودة بعدُ (تكرار التنفيذ لا يكرّرها)
    select coalesce(jsonb_agg(a), '[]'::jsonb) into extra
    from jsonb_array_elements(t.add_fields) a
    where not exists (select 1 from jsonb_array_elements(cur) c where c->>'name' = a->>'name');

    out := '[]'::jsonb;
    for f in select value from jsonb_array_elements(cur) with ordinality as e(value, ord) order by ord loop
      if f->>'name' = any(t.legacy_names) then
        f := f || '{"legacy": true}'::jsonb;
      end if;
      out := out || jsonb_build_array(f);
      -- بعد «السجل المدني» مباشرة، كترتيب جدول الدليل
      if f->>'name' = 'f3' then
        out := out || extra;
        extra := '[]'::jsonb;
      end if;
    end loop;
    out := out || extra;   -- إن لم يوجد حقل السجل المدني

    update public.form_templates set fields = out where id = t.id;
  end loop;

  -- (18) اسم النموذج كما في الدليل
  update public.form_templates set title = 'تنبيه على تأخر / انصراف'
  where id = '22ef83f8-a573-4c6d-bf29-3f0ffb3ce496';

  -- (20) قرار المدير: خيارات الدليل الثلاثة بنصها
  update public.form_templates ft
  set fields = (
    select jsonb_agg(
             case when el->>'name' = 'action_taken'
                  then jsonb_set(el, '{presets}', '["تحتسب له إجازة مرضية بعد التأكد من نظامية التقرير",
                                                   "يحتسب غيابه من رصيده للإجازات الاضطرارية لقبول عذره إذا كان رصيده يسمح وإلا يحسم عليه.",
                                                   "يعتمد الحسم لعدم قبول عذره"]'::jsonb)
                  else el end
             order by ord)
    from jsonb_array_elements(ft.fields::jsonb) with ordinality as x(el, ord)
  )
  where ft.id = 'c071d50d-1ca0-48d8-9447-5fbb6c7cf41e';
end $$;

-- للتحقق: حقول النماذج الأربعة بعد التحديث
select t.title, f->>'name' as name, f->>'label' as label, coalesce(f->>'legacy', '') as legacy
from public.form_templates t, jsonb_array_elements(t.fields::jsonb) with ordinality as x(f, ord)
where t.id in ('22ef83f8-a573-4c6d-bf29-3f0ffb3ce496', 'c8d17093-c0de-4807-9719-f035b263a199',
               'c071d50d-1ca0-48d8-9447-5fbb6c7cf41e', '7d209ca1-e52b-4ed5-b0fb-d31f50f5cc97')
order by t.title, ord;
