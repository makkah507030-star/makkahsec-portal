-- =====================================================================
-- استمارة توضيح مستوى الطالب التحصيلي والسلوكي — الجزء 1 من 3: الجداول والصلاحيات.
-- يختار الموجه الطالب فتصل الاستمارة لمعلمي فصله (من الجدول الدراسي) فيعبّئ كل
-- معلم سطر مادته، ثم يكتب الموجه رأيه ويرسلها للوكيل، فيكتب رأيه ويعيدها للموجه،
-- فيرسل نسخة لولي الأمر في حسابه. والملصق (عاجل/سري/للاطلاع والتوجيه) يحدده الموجه.
-- المعلم يرى سطره وحده. يُنفَّذ بعد guidance_1.sql. تكرار التنفيذ آمن.
-- =====================================================================
create table if not exists public.guidance_inquiries (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  student_name text, class_label text,
  grade int not null check (grade between 1 and 3),
  flag text check (flag in ('urgent', 'confidential', 'info')),
  status text not null default 'teachers' check (status in ('teachers', 'deputy', 'counselor', 'sent')),
  counselor_id uuid default auth.uid(), counselor_name text, counselor_note text,
  counselor_sig text, counselor_at timestamptz,
  deputy_id uuid, deputy_name text, deputy_note text, deputy_sig text, deputy_at timestamptz,
  sent_at timestamptz, guardian_seen_at timestamptz,
  academic_year text, term int,
  created_at timestamptz not null default now()
);
create index if not exists guidance_inquiries_grade_idx on public.guidance_inquiries (grade, status);

create table if not exists public.guidance_inquiry_items (
  id uuid primary key default gen_random_uuid(),
  inquiry_id uuid not null references public.guidance_inquiries(id) on delete cascade,
  subject text not null,
  teacher_id uuid references public.teachers(id) on delete set null,
  teacher_user_id uuid, teacher_name text,
  academic text check (academic in ('excellent', 'good', 'weak')),
  behavior text check (behavior in ('excellent', 'good', 'weak')),
  note text, sig text, filled_at timestamptz,
  sort int not null default 0
);
create index if not exists guidance_inquiry_items_inq_idx on public.guidance_inquiry_items (inquiry_id);
create index if not exists guidance_inquiry_items_teacher_idx on public.guidance_inquiry_items (teacher_user_id) where filled_at is null;

-- دوال الوصول (security definer تتجاوز الصلاحيات فلا تتداخل سياسات الجدولين)
create or replace function public.gi_staff(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from guidance_inquiries i where i.id = p_id and public.guidance_can(i.grade));
$$;
create or replace function public.gi_teacher(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from guidance_inquiry_items x where x.inquiry_id = p_id and x.teacher_user_id = auth.uid());
$$;
create or replace function public.gi_guardian(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from guidance_inquiries i
                   join guardian_student gs on gs.student_id = i.student_id
                   join guardians g on g.id = gs.guardian_id
                  where i.id = p_id and i.status = 'sent' and g.user_id = auth.uid());
$$;
revoke execute on function public.gi_staff(uuid), public.gi_teacher(uuid), public.gi_guardian(uuid) from public, anon;
grant  execute on function public.gi_staff(uuid), public.gi_teacher(uuid), public.gi_guardian(uuid) to authenticated;

alter table public.guidance_inquiries enable row level security;
alter table public.guidance_inquiry_items enable row level security;

-- القراءة: التوجيه للصف، والمعلم المُرسلة إليه، وولي الأمر بعد إرسال نسخته.
-- الكتابة عبر الدوال في الجزأين 2 و3، والحذف (إلغاء الاستمارة) للتوجيه.
drop policy if exists "gi read" on public.guidance_inquiries;
create policy "gi read" on public.guidance_inquiries for select to authenticated
  using (public.guidance_can(grade) or public.gi_teacher(id) or public.gi_guardian(id));
drop policy if exists "gi delete" on public.guidance_inquiries;
create policy "gi delete" on public.guidance_inquiries for delete to authenticated
  using (public.guidance_can(grade));

drop policy if exists "gi items read" on public.guidance_inquiry_items;
create policy "gi items read" on public.guidance_inquiry_items for select to authenticated
  using (teacher_user_id = auth.uid() or public.gi_staff(inquiry_id) or public.gi_guardian(inquiry_id));

-- توقيعات الاستمارة تظهر لمن يحق له رؤيتها (الاستعلام يخضع لصلاحيات الجدولين)
drop policy if exists "read guidance inquiry signatures" on storage.objects;
create policy "read guidance inquiry signatures" on storage.objects for select to authenticated
  using (bucket_id = 'form-assets' and (
    exists (select 1 from public.guidance_inquiry_items x where x.sig = objects.name)
    or exists (select 1 from public.guidance_inquiries i
                where i.counselor_sig = objects.name or i.deputy_sig = objects.name)));
-- نهاية الجزء 1
