-- =====================================================================
-- مركز تحليل النتائج (الجزء 1 من 3): نموذج ملاحظة التحصيل والخطة العلاجية.
-- نموذج لكل معلم ومادة وصف في كل إشعار فترة، فيه فصوله الضعيفة كلها. يُنشأ مسودة آليًا
-- عند فتح المركز، فيرسله موجه الصف ويتابعه، ويرد المعلم بالأسباب والخطة، فيراجعه الموجه
-- ويرفعه لوكيل الشؤون التعليمية للاعتماد، وتصل الخطة أولياء أمور المتعثرين.
-- الحالات: draft → sent → replied → forwarded → approved، ومعها returned وexcluded.
-- الكتابة من الدوال وحدها (الجزآن 2 و3). تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.ach_forms (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null,
  report_key text not null,
  grade int not null,
  subject text not null,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  teacher_user uuid,
  teacher_name text,
  classes jsonb not null default '[]',   -- [{class_id, class_no, stats, checks[], students[]}] لقطة التحليل
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'returned', 'replied', 'forwarded', 'approved', 'excluded')),
  counselor_note text, exclude_reason text,
  sent_at timestamptz, sent_by_name text, due_on date,
  seen_at timestamptz, reminded_at timestamptz,
  reasons jsonb,                          -- { picks: [..], other }
  plans jsonb,                            -- { "<class_id>": { actions, from, to, followup, students: [sid] } }
  replied_at timestamptz,
  review_note text, forwarded_at timestamptz, forwarded_by_name text, guardians_notified int,
  deputy_note text, decided_at timestamptz, decided_by_name text,
  log jsonb not null default '[]',        -- [{ at, by, action, note }]
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (academic_year, report_key, grade, subject, teacher_id)
);
create index if not exists ach_forms_key on public.ach_forms (academic_year, report_key);
create index if not exists ach_forms_teacher on public.ach_forms (teacher_user);

-- من يرى المدرسة كلها في المركز، ومن يرى صفه (counselor_N)
create or replace function public.ach_all() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_admin_role(array['principal', 'deputy_academic', 'deputy_students', 'tech_support']);
$$;
create or replace function public.ach_can_grade(p_grade int) returns boolean language sql stable security definer set search_path = public as $$
  select public.ach_all() or public.has_admin_role(array['counselor_' || p_grade]);
$$;
-- من يرسل ويراجع: موجه الصف، ومعه وكيل الشؤون التعليمية والمدير والدعم الفني
create or replace function public.ach_can_send(p_grade int) returns boolean language sql stable security definer set search_path = public as $$
  select public.has_admin_role(array['principal', 'deputy_academic', 'tech_support', 'counselor_' || p_grade]);
$$;
create or replace function public.ach_can_decide() returns boolean language sql stable security definer set search_path = public as $$
  select public.has_admin_role(array['principal', 'deputy_academic', 'tech_support']);
$$;
-- حسابات أصحاب أدوار بعينها
create or replace function public.ach_role_users(p_roles text[]) returns uuid[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct r.user_id), '{}') from admin_roles r join users u on u.id = r.user_id
  where r.role_type::text = any(p_roles) and u.is_active;
$$;
-- إضافة أيام دراسية (الأحد–الخميس)
create or replace function public.ach_add_days(p_from date, p_n int) returns date language plpgsql immutable as $$
declare d date := p_from; k int := 0;
begin
  while k < p_n loop d := d + 1; if extract(dow from d) not in (5, 6) then k := k + 1; end if; end loop;
  return d;
end $$;

alter table public.ach_forms enable row level security;
drop policy if exists ach_forms_staff on public.ach_forms;
create policy ach_forms_staff on public.ach_forms for select to authenticated using (public.ach_can_grade(grade));
drop policy if exists ach_forms_teacher on public.ach_forms;
create policy ach_forms_teacher on public.ach_forms for select to authenticated
  using (teacher_user = auth.uid() and status not in ('draft', 'excluded'));
grant select on public.ach_forms to authenticated;
revoke all on function public.ach_all(), public.ach_can_grade(int), public.ach_can_send(int), public.ach_can_decide(),
  public.ach_role_users(text[]) from public, anon;
grant execute on function public.ach_all(), public.ach_can_grade(int), public.ach_can_send(int), public.ach_can_decide()
  to authenticated;

-- نهاية الجزء 1
