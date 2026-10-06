-- =====================================================================
-- ملاحظات الطلاب: صحية وسلوكية ونفسية — يطّلع عليها معلمو الطالب باستمرار
-- وتظهر تحت اسمه في كشف التحضير شارةً تُفتح بالضغط.
--
-- • الكتابة: كل الأنواع للموجه الصحي والموجهين الطلابيين، ومعهم المدير ووكيل
--   شؤون الطلاب والدعم الفني (الصلاحية المحدّثة في student_notes_all_kinds.sql).
-- • القراءة:
--     كاتبو النوع يرون كل ملاحظاته، ومنها السرية والمنتهية.
--     معلمو الطالب (من في جدولهم فصله) وبقية الحسابات الإدارية يرون
--     غير السرية السارية فقط (لم ينتهِ تاريخ مراجعتها ولم تُوقف).
-- • الملاحظة تكتب ما يفعله المعلم، لا التشخيص فقط.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.student_notes (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students(id) on delete cascade,
  kind             text not null check (kind in ('health', 'behavior', 'psych')),
  body             text not null check (length(trim(body)) > 0),
  confidential     boolean not null default false,
  guardian_informed boolean not null default false,
  review_until     date,
  is_active        boolean not null default true,
  created_by       uuid default auth.uid(),
  created_by_name  text,
  created_at       timestamptz not null default now(),
  updated_by_name  text,
  updated_at       timestamptz not null default now()
);
create index if not exists student_notes_student_idx on public.student_notes (student_id) where is_active;

alter table public.student_notes enable row level security;

-- من يكتب هذا النوع
create or replace function public.sn_can_write(p_kind text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_roles ar
    where ar.user_id = auth.uid()
      and (
        ar.role_type in ('principal', 'deputy_students', 'tech_support')
        or (p_kind = 'health' and ar.role_type = 'health_counselor')
        or (p_kind in ('behavior', 'psych') and ar.role_type in ('counselor', 'counselor_1', 'counselor_2', 'counselor_3'))
      )
  );
$$;

-- هل يدرّس المستخدم هذا الطالب؟ (فصله في جدول المعلم)
create or replace function public.sn_teaches(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.teachers t
    join public.schedule s on s.teacher_id = t.id
    join public.student_enrollment e on e.class_id = s.class_id and e.status = 'active'
    where t.user_id = auth.uid() and e.student_id = p_student
  );
$$;

-- حساب إداري فعّال
create or replace function public.sn_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin' and coalesce(u.is_active, true)
  );
$$;

revoke execute on function public.sn_can_write(text) from public, anon;
revoke execute on function public.sn_teaches(uuid) from public, anon;
revoke execute on function public.sn_is_staff() from public, anon;
grant execute on function public.sn_can_write(text) to authenticated;
grant execute on function public.sn_teaches(uuid) to authenticated;
grant execute on function public.sn_is_staff() to authenticated;

drop policy if exists "sn read" on public.student_notes;
create policy "sn read" on public.student_notes for select to authenticated
  using (
    public.sn_can_write(kind)
    or (
      is_active and not confidential
      and (review_until is null or review_until >= current_date)
      and (public.sn_is_staff() or public.sn_teaches(student_id))
    )
  );

drop policy if exists "sn insert" on public.student_notes;
create policy "sn insert" on public.student_notes for insert to authenticated
  with check (public.sn_can_write(kind) and created_by = auth.uid());

drop policy if exists "sn update" on public.student_notes;
create policy "sn update" on public.student_notes for update to authenticated
  using (public.sn_can_write(kind)) with check (public.sn_can_write(kind));

drop policy if exists "sn delete" on public.student_notes;
create policy "sn delete" on public.student_notes for delete to authenticated
  using (public.sn_can_write(kind));

-- ملاحظات طلاب فصل كامل دفعة واحدة — لكشف التحضير (استعلام واحد بدل فحص كل صف)
create or replace function public.class_student_notes(p_class uuid)
returns table (id uuid, student_id uuid, kind text, body text, created_by_name text, updated_at timestamptz)
language sql stable security definer set search_path = public as $$
  select n.id, n.student_id, n.kind, n.body, coalesce(n.updated_by_name, n.created_by_name), n.updated_at
  from public.student_notes n
  join public.student_enrollment e on e.student_id = n.student_id and e.class_id = p_class and e.status = 'active'
  where n.is_active and not n.confidential
    and (n.review_until is null or n.review_until >= current_date)
    and (
      public.sn_is_staff()
      or exists (
        select 1 from public.teachers t join public.schedule s on s.teacher_id = t.id
        where t.user_id = auth.uid() and s.class_id = p_class
      )
    )
  order by n.kind, n.updated_at desc;
$$;

revoke execute on function public.class_student_notes(uuid) from public, anon;
grant execute on function public.class_student_notes(uuid) to authenticated;
