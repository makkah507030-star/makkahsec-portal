-- =====================================================================
-- ملف الأداء الوظيفي للمعلم — الدفعة الأولى: الملف والشواهد.
--
-- • perf_elements و perf_items: عناصر نموذج تقييم المعلم الـ11 وبنود متابعتها
--   الـ87 كما اعتمدتها المدرسة (الدليل الإرشادي + نموذج البنود).
--   «أداء الواجبات الوظيفية» للمقيِّم فقط: لا شواهد له في ملف المعلم.
-- • perf_evidence: شواهد المعلم. البند العادي له شاهد واحد مع عداد،
--   وبنود «سجل التطوير المهني» (is_record) يُرفق فيها كل مشاركة بشاهدها.
-- • لا يرى الشواهد إلا المعلم صاحبها ومدير المدرسة، والدعم الفني للمتابعة الفنية (اطلاع فقط).
-- • المرفقات في مخزن خاص perf-evidence، المسار: <معرّف المعلم>/<اسم الملف>.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

-- 1) العناصر
create table if not exists public.perf_elements (
  key text primary key,
  title text not null,
  weight integer not null,
  sort_order integer not null,
  evaluator_only boolean not null default false
);

insert into public.perf_elements (key, title, weight, sort_order, evaluator_only) values
  ('e01', 'أداء الواجبات الوظيفية', 10, 1, true),
  ('e02', 'التفاعل مع المجتمع المهني', 10, 2, false),
  ('e03', 'التفاعل مع أولياء الأمور', 10, 3, false),
  ('e04', 'التنويع في استراتيجيات التدريس', 10, 4, false),
  ('e05', 'تحسين نتائج المتعلمين', 10, 5, false),
  ('e06', 'إعداد وتنفيذ خطة التعلم', 10, 6, false),
  ('e07', 'توظيف تقنيات ووسائل التعلم المناسبة', 10, 7, false),
  ('e08', 'تهيئة بيئة تعليمية', 5, 8, false),
  ('e09', 'الإدارة الصفية', 5, 9, false),
  ('e10', 'تحليل نتائج المتعلمين وتشخيص مستوياتهم', 10, 10, false),
  ('e11', 'تنوع أساليب التقويم', 10, 11, false)
on conflict (key) do update
  set title = excluded.title, weight = excluded.weight,
      sort_order = excluded.sort_order, evaluator_only = excluded.evaluator_only;

-- 2) البنود (source: guide = من الدليل، school = تطبيق مدرسي)
create table if not exists public.perf_items (
  key text primary key,
  element_key text not null references public.perf_elements(key),
  sort_order integer not null,
  title text not null,
  source text not null check (source in ('guide', 'school')),
  is_record boolean not null default false,
  is_active boolean not null default true
);

insert into public.perf_items (key, element_key, sort_order, title, source, is_record) values
  -- 1. أداء الواجبات الوظيفية (للمقيِّم فقط)
  ('e01_01', 'e01', 1, 'الحفاظ على الدوام', 'school', false),
  ('e01_02', 'e01', 2, 'رفع الإجازات وفق النظام', 'school', false),
  ('e01_03', 'e01', 3, 'إشعار الإدارة بالغياب بوقت كافٍ', 'school', false),
  ('e01_04', 'e01', 4, 'شغل حصص الانتظار وتفعيلها', 'school', false),
  ('e01_05', 'e01', 5, 'المشاركة في اللجان المدرسية وتفعيلها', 'school', false),
  ('e01_06', 'e01', 6, 'الالتزام بالمناوبة اليومية وفق الجدول المعد', 'school', false),
  ('e01_07', 'e01', 7, 'تفعيل حصص النشاط', 'school', false),
  ('e01_08', 'e01', 8, 'المشاركة في الأنشطة والمناسبات الوطنية', 'guide', false),
  ('e01_09', 'e01', 9, 'التواصل الفعال مع الإدارة المدرسية', 'school', false),
  ('e01_10', 'e01', 10, 'تقديم مبادرة للمدرسة وتنفيذها على المنسوبين', 'school', false),
  ('e01_11', 'e01', 11, 'تفعيل الإذاعة الصباحية', 'school', false),
  ('e01_12', 'e01', 12, 'الالتزام بحضور الطابور الصباحي والمساهمة في تنظيمه', 'school', false),
  ('e01_13', 'e01', 13, 'الالتزام بزمن الحصة الدراسية', 'school', false),
  ('e01_14', 'e01', 14, 'الاطلاع على التعاميم واللوائح المنظمة والالتزام بها والتوقيع بالعلم', 'guide', false),
  ('e01_15', 'e01', 15, 'الالتزام بالسلوك المهني', 'guide', false),
  ('e01_16', 'e01', 16, 'اتباع الأساليب التربوية مع الطلاب', 'guide', false),
  ('e01_17', 'e01', 17, 'تفعيل منصة مدرستي', 'school', false),
  ('e01_18', 'e01', 18, 'المحافظة على خصوصية المعلومات المهنية وحماية البيانات', 'guide', false),
  -- 2. التفاعل مع المجتمع المهني (البنود 1–8 سجل التطوير المهني)
  ('e02_01', 'e02', 1, 'تنفيذ البرامج التدريبية', 'guide', true),
  ('e02_02', 'e02', 2, 'حضور البرامج التدريبية الداخلية والخارجية والفردية', 'guide', true),
  ('e02_03', 'e02', 3, 'تنفيذ زيارات تبادلية', 'guide', true),
  ('e02_04', 'e02', 4, 'حضور الزيارات التبادلية', 'guide', true),
  ('e02_05', 'e02', 5, 'حضور المؤتمرات', 'guide', true),
  ('e02_06', 'e02', 6, 'تفعيل دوره في مجتمعات التعلم المهنية', 'guide', true),
  ('e02_07', 'e02', 7, 'تنفيذ الدروس التطبيقية والحلقات التنشيطية', 'guide', true),
  ('e02_08', 'e02', 8, 'تقديم إنتاج معرفي أو تجارب عملية أو وسيلة تعليمية أو تطوير مناهج أو ساعات تطوع', 'guide', true),
  ('e02_09', 'e02', 9, 'إصدار الرخصة المهنية', 'school', false),
  ('e02_10', 'e02', 10, 'دعم المعلمين الجدد ومشاركتهم الخبرات', 'guide', false),
  ('e02_11', 'e02', 11, 'التفكير الذاتي لتحسين الممارسات', 'guide', false),
  -- 3. التفاعل مع أولياء الأمور
  ('e03_01', 'e03', 1, 'التواصل الفعال مع أولياء الأمور', 'guide', false),
  ('e03_02', 'e03', 2, 'إرسال تقارير مستويات الطلاب', 'guide', false),
  ('e03_03', 'e03', 3, 'حضور اجتماعات أولياء الأمور', 'school', false),
  ('e03_04', 'e03', 4, 'إرسال استمارات الاستدعاء عند الحاجة', 'school', false),
  ('e03_05', 'e03', 5, 'مشاركة أولياء الأمور في العملية التعليمية', 'guide', false),
  ('e03_06', 'e03', 6, 'تفعيل سجل المتابعة لاطلاع ولي الأمر على مستوى الطالب', 'guide', false),
  ('e03_07', 'e03', 7, 'الاستماع لمخاوف أولياء الأمور وإيجاد حلول مشتركة', 'guide', false),
  -- 4. التنويع في استراتيجيات التدريس
  ('e04_01', 'e04', 1, 'دمج مهارات التفكير والإبداع في التدريس', 'guide', false),
  ('e04_02', 'e04', 2, 'تفعيل استراتيجيات تدريس مناسبة للموقف التعليمي وملائمة لميول الطلاب واحتياجاتهم', 'guide', false),
  ('e04_03', 'e04', 3, 'تفعيل استراتيجيات تنمي الفهم القرائي وتدعم الحوار والمناقشة', 'guide', false),
  ('e04_04', 'e04', 4, 'ربط الدرس بالواقع والخبرات الحياتية', 'school', false),
  -- 5. تحسين نتائج المتعلمين
  ('e05_01', 'e05', 1, 'تحديد أهداف ومعايير واضحة يعرف بها الطلاب ما يُتوقع منهم', 'guide', false),
  ('e05_02', 'e05', 2, 'تقديم إفادة سريعة ومحددة فور ملاحظة الأداء', 'guide', false),
  ('e05_03', 'e05', 3, 'تكييف الإفادة وفق الاحتياجات الفردية', 'guide', false),
  ('e05_04', 'e05', 4, 'استخدام التقنية لتقديم الإفادة (المنصات والإشعارات)', 'guide', false),
  ('e05_05', 'e05', 5, 'تحديد المهارات المفقودة', 'school', false),
  ('e05_06', 'e05', 6, 'وضع خطة علاجية للمهارات المتدنية', 'school', false),
  ('e05_07', 'e05', 7, 'وضع خطة إثرائية للمهارات الجيدة', 'school', false),
  ('e05_08', 'e05', 8, 'متابعة ملفات إنجاز المتعلمين', 'school', false),
  ('e05_09', 'e05', 9, 'تصحيح الكتب الدراسية', 'school', false),
  ('e05_10', 'e05', 10, 'التحفيز والتكريم وتعزيز ثقة الطلاب بأنفسهم', 'guide', false),
  ('e05_11', 'e05', 11, 'تحسين نتائج الطلاب في الاختبارات الوطنية (نافس) والتحصيل', 'school', false),
  -- 6. إعداد وتنفيذ خطة التعلم
  ('e06_01', 'e06', 1, 'تسليم توزيع المنهج في الوقت المحدد', 'guide', false),
  ('e06_02', 'e06', 2, 'تسليم خطة التعلم الأسبوعية في الوقت المحدد', 'guide', false),
  ('e06_03', 'e06', 3, 'تحضير الدروس في المنصة في الوقت المحدد', 'school', false),
  ('e06_04', 'e06', 4, 'تنفيذ الخطة العلاجية للمهارات المفقودة', 'school', false),
  ('e06_05', 'e06', 5, 'تنفيذ الخطة الإثرائية', 'school', false),
  ('e06_06', 'e06', 6, 'تنفيذ خطة النشاط في الوقت المحدد', 'guide', false),
  ('e06_07', 'e06', 7, 'مراعاة الخصائص النفسية للمرحلة العمرية للطلاب', 'guide', false),
  ('e06_08', 'e06', 8, 'المشاركة مع المعلم الخبير في إعداد الأنشطة الصفية وغير الصفية وتنفيذها', 'guide', false),
  -- 7. توظيف تقنيات ووسائل التعلم المناسبة
  ('e07_01', 'e07', 1, 'تفعيل سجل مصادر التعلم', 'school', false),
  ('e07_02', 'e07', 2, 'استخدام وسائل وتقنيات مناسبة لحاجات وأنماط المتعلمين وتراعي الفروق الفردية', 'guide', false),
  ('e07_03', 'e07', 3, 'تنمية قدرة الطالب على التأمل والملاحظة والتفكير العلمي', 'guide', false),
  ('e07_04', 'e07', 4, 'تفعيل تطبيقات وبرامج الذكاء الاصطناعي في الحصة الدراسية', 'school', false),
  ('e07_05', 'e07', 5, 'تفعيل قنوات عين', 'school', false),
  ('e07_06', 'e07', 6, 'تفعيل الأنشطة والواجبات والاختبارات والإثرائيات في منصة مدرستي', 'school', false),
  -- 8. تهيئة بيئة تعليمية
  ('e08_01', 'e08', 1, 'توفير بيئة تعليمية آمنة خالية من الأخطار', 'guide', false),
  ('e08_02', 'e08', 2, 'توفير بيئة تعليمية تحقق الأمان النفسي والاحترام المتبادل', 'guide', false),
  ('e08_03', 'e08', 3, 'إتاحة الفرصة للطلاب للتعبير عن أنفسهم ومشاركة أفكارهم مع أقرانهم', 'guide', false),
  ('e08_04', 'e08', 4, 'إثارة دافعية الطلاب من خلال التنويع في أساليب التعلم', 'guide', false),
  -- 9. الإدارة الصفية
  ('e09_01', 'e09', 1, 'عرض القوانين الصفية للطلاب في الحصة الدراسية', 'school', false),
  ('e09_02', 'e09', 2, 'توجيه الطلاب لتطبيق القوانين الصفية', 'guide', false),
  ('e09_03', 'e09', 3, 'تعزيز الانضباط وتنظيم التفاعل بين الطلاب', 'guide', false),
  ('e09_04', 'e09', 4, 'تنوع نبرات الصوت بما يتوافق مع الموقف التعليمي', 'school', false),
  ('e09_05', 'e09', 5, 'تنظيم الطلاب داخل الفصل بما يتناسب مع الموقف الدراسي', 'guide', false),
  ('e09_06', 'e09', 6, 'مراعاة الفروق الفردية بين المتعلمين', 'guide', false),
  -- 10. تحليل نتائج المتعلمين وتشخيص مستوياتهم
  ('e10_01', 'e10', 1, 'تحليل نتائج التقييم وإعداد التقارير بشأن فعالية التدريس', 'guide', false),
  ('e10_02', 'e10', 2, 'تحديد نقاط القوة والضعف', 'guide', false),
  ('e10_03', 'e10', 3, 'إشراك الطلاب في نتائجهم ومدى تقدمهم لدعم تطورهم', 'guide', false),
  ('e10_04', 'e10', 4, 'وضع أهداف تعليمية قصيرة وطويلة المدى تراعي الفروق الفردية', 'guide', false),
  ('e10_05', 'e10', 5, 'قياس التطبيق العملي للمعرفة عبر مواقف ومشاريع حقيقية', 'guide', false),
  -- 11. تنوع أساليب التقويم
  ('e11_01', 'e11', 1, 'تطبيق التقويم القبلي (التشخيصي) لتحديد استعداد المتعلمين', 'guide', false),
  ('e11_02', 'e11', 2, 'تنوع مصادر التقويم (ملاحظة صفية، استبانات، تقارير ذاتية، تحليل نتائج)', 'guide', false),
  ('e11_03', 'e11', 3, 'تنوع أساليب التقويم (اختبارات شفهية، تحريرية، مهام أدائية)', 'guide', false),
  ('e11_04', 'e11', 4, 'تقديم التغذية الراجعة لتقويم الطلاب', 'guide', false),
  ('e11_05', 'e11', 5, 'تطبيق التقويم التكويني والبنائي لتطوير أداء الطلاب', 'guide', false),
  ('e11_06', 'e11', 6, 'تطبيق التقويم الختامي وقياس تقدم التعلم وإصدار الحكم على مستوى الطالب', 'guide', false),
  ('e11_07', 'e11', 7, 'بناء الاختبارات (الفصلية والنهائية) وفق معايير الاختبار الجيد', 'school', false)
on conflict (key) do update
  set element_key = excluded.element_key, sort_order = excluded.sort_order, title = excluded.title,
      source = excluded.source, is_record = excluded.is_record;

alter table public.perf_elements enable row level security;
alter table public.perf_items enable row level security;

drop policy if exists perf_elements_read on public.perf_elements;
create policy perf_elements_read on public.perf_elements for select to authenticated using (true);
drop policy if exists perf_items_read on public.perf_items;
create policy perf_items_read on public.perf_items for select to authenticated using (true);

-- 3) الشواهد
create table if not exists public.perf_evidence (
  id uuid primary key default gen_random_uuid(),
  teacher_user_id uuid not null default auth.uid(),
  academic_year text not null,
  item_key text not null references public.perf_items(key),
  is_record boolean not null default false,          -- يُضبط آليًا من البند
  source text not null check (source in ('upload', 'form')),
  title text not null,
  note text,
  provider text,                                     -- الجهة (سجل التطوير المهني)
  event_date date,
  hours numeric(6,1),
  file_path text,
  file_name text,
  form_document_id uuid references public.form_documents(id) on delete set null,
  form_docs uuid[] not null default '{}',            -- النماذج المُرسلة لهذا البند (يمنع تكرار العدّ)
  use_count integer not null default 1 check (use_count >= 1),
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists perf_evidence_teacher_idx on public.perf_evidence (teacher_user_id, academic_year);
-- البند العادي له شاهد واحد في العام
create unique index if not exists perf_evidence_single_uq
  on public.perf_evidence (teacher_user_id, academic_year, item_key) where not is_record;

-- is_record يُؤخذ من البند، ولا تُقبل بنود المقيِّم
create or replace function public.perf_evidence_guard()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  it public.perf_items;
  only_eval boolean;
begin
  select * into it from public.perf_items where key = new.item_key;
  select evaluator_only into only_eval from public.perf_elements where key = it.element_key;
  if not found or coalesce(only_eval, false) or not it.is_active then
    raise exception 'هذا البند لا يقبل شواهد';
  end if;
  new.is_record := it.is_record;
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.teacher_user_id := old.teacher_user_id;   -- لا يُنقل الشاهد لمعلم آخر
    -- عداد شاهد النماذج تحسبه الدالة perf_send_form وحدها، لا المعلم
    if current_user = 'authenticated' then
      new.source := old.source;
      new.form_document_id := old.form_document_id;
      new.form_docs := old.form_docs;
      if old.source = 'form' then
        new.use_count := old.use_count;
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists perf_evidence_guard on public.perf_evidence;
create trigger perf_evidence_guard before insert or update on public.perf_evidence
  for each row execute function public.perf_evidence_guard();

alter table public.perf_evidence enable row level security;

drop policy if exists perf_evidence_read on public.perf_evidence;
create policy perf_evidence_read on public.perf_evidence for select to authenticated
  using (teacher_user_id = auth.uid() or public.has_admin_role(array['principal', 'tech_support']));

-- الرفع المباشر للمعلم نفسه فقط، وشواهد النماذج عبر الدالة perf_send_form
drop policy if exists perf_evidence_insert on public.perf_evidence;
create policy perf_evidence_insert on public.perf_evidence for insert to authenticated
  with check (teacher_user_id = auth.uid() and source = 'upload' and form_document_id is null);

drop policy if exists perf_evidence_update on public.perf_evidence;
create policy perf_evidence_update on public.perf_evidence for update to authenticated
  using (teacher_user_id = auth.uid())
  with check (teacher_user_id = auth.uid());

drop policy if exists perf_evidence_delete on public.perf_evidence;
create policy perf_evidence_delete on public.perf_evidence for delete to authenticated
  using (teacher_user_id = auth.uid());

-- 4) إرسال نموذج صادر إلى ملف الشواهد: أول إرسال يصبح الشاهد، وما بعده يزيد العداد.
--    في بنود السجل يُضاف كل نموذج سجلًا مستقلًا. النموذج نفسه لا يُعدّ مرتين.
create or replace function public.perf_send_form(p_doc uuid, p_item text, p_year text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  d   public.form_documents;
  it  public.perf_items;
  ev  public.perf_evidence;
  only_eval boolean;
begin
  select * into d from public.form_documents where id = p_doc;
  if not found or d.created_by is distinct from auth.uid() then
    raise exception 'المستند غير موجود أو ليس من إصدارك';
  end if;
  if d.status in ('draft', 'pending', 'rejected') then
    raise exception 'المستند لم يصدر بعد';
  end if;
  select * into it from public.perf_items where key = p_item and is_active;
  select evaluator_only into only_eval from public.perf_elements where key = it.element_key;
  if it.key is null or coalesce(only_eval, false) then
    raise exception 'هذا البند لا يقبل شواهد';
  end if;
  if coalesce(p_year, '') = '' then
    raise exception 'العام الدراسي غير محدد';
  end if;

  if it.is_record then
    select * into ev from public.perf_evidence
     where teacher_user_id = auth.uid() and item_key = p_item and form_document_id = p_doc;
    if found then return 1; end if;
    insert into public.perf_evidence (teacher_user_id, academic_year, item_key, source, title,
                                      form_document_id, form_docs, event_date)
    values (auth.uid(), p_year, p_item, 'form', d.title || ' · ' || d.serial,
            p_doc, array[p_doc], d.created_at::date);
    return 1;
  end if;

  select * into ev from public.perf_evidence
   where teacher_user_id = auth.uid() and academic_year = p_year and item_key = p_item
   for update;
  if not found then
    insert into public.perf_evidence (teacher_user_id, academic_year, item_key, source, title,
                                      form_document_id, form_docs, event_date)
    values (auth.uid(), p_year, p_item, 'form', d.title || ' · ' || d.serial,
            p_doc, array[p_doc], d.created_at::date);
    return 1;
  end if;
  if p_doc = any(ev.form_docs) then
    return ev.use_count;
  end if;
  update public.perf_evidence
     set use_count = use_count + 1, form_docs = form_docs || p_doc, last_used_at = now()
   where id = ev.id;
  return ev.use_count + 1;
end;
$$;

revoke execute on function public.perf_send_form(uuid, text, text) from public, anon;
grant  execute on function public.perf_send_form(uuid, text, text) to authenticated;

-- 5) مخزن المرفقات: خاص، 5 م.ب للملف، PDF والصور فقط
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('perf-evidence', 'perf-evidence', false, 5242880,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "perf evidence read" on storage.objects;
create policy "perf evidence read" on storage.objects for select to authenticated
  using (bucket_id = 'perf-evidence'
         and ((storage.foldername(name))[1] = auth.uid()::text
              or public.has_admin_role(array['principal', 'tech_support'])));

drop policy if exists "perf evidence write" on storage.objects;
create policy "perf evidence write" on storage.objects for insert to authenticated
  with check (bucket_id = 'perf-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "perf evidence delete" on storage.objects;
create policy "perf evidence delete" on storage.objects for delete to authenticated
  using (bucket_id = 'perf-evidence' and (storage.foldername(name))[1] = auth.uid()::text);

-- 6) ربط الشواهد بالنماذج: البند المقترح عند الإرسال (اختياري؛ إن كان جدول evidence_links منشأً)
do $$
begin
  if to_regclass('public.evidence_links') is not null then
    alter table public.evidence_links add column if not exists item_key text references public.perf_items(key);
  end if;
end $$;

-- تحقق: 11 عنصرًا و87 بندًا، منها 8 بنود سجل
select (select count(*) from public.perf_elements) as elements,
       (select count(*) from public.perf_items) as items,
       (select count(*) from public.perf_items where is_record) as record_items;
