-- =====================================================================
-- نماذج السلوك والمواظبة (دليل السلوك والمواظبة 1447هـ):
--   pledge   تعهد سلوكي              (نموذج 8)  — يقرّ به الطالب وولي أمره
--   invite   خطاب دعوة ولي الأمر      (نموذج 10) — يرد ولي الأمر بالحضور أو تغيير الموعد
--   incident سري: محضر ضبط واقعة     (نموذج 11) — داخلي للإدارة
--   statement إفادة طالب                        — داخلية، تُطبع ليوقّع عليها الطالب
-- يُنفَّذ مرة واحدة من Supabase ← SQL Editor.
-- =====================================================================

create table if not exists public.behavior_forms (
  id uuid primary key default gen_random_uuid(),
  serial text unique,
  kind text not null,
  student_id uuid not null references public.students(id) on delete cascade,
  student_name text,
  class_label text,
  grade integer,
  violation_degree integer check (violation_degree is null or violation_degree between 1 and 5),
  violation_type text,
  violation_text text,
  violation_date date,
  data jsonb not null default '{}'::jsonb,       -- حقول كل نموذج (الموعد، الشهود، …)
  issued_by uuid references public.users(id) on delete set null,
  issued_name text,
  issued_role text,
  issued_sig text,
  status text not null default 'sent' check (status in ('sent', 'answered', 'closed')),
  student_ack_at timestamptz,
  guardian_id uuid references public.users(id) on delete set null,
  guardian_ack_at timestamptz,
  guardian_reply jsonb,                           -- رد ولي الأمر على الدعوة
  guardian_note text,
  created_at timestamptz not null default now()
);

alter table public.behavior_forms drop constraint if exists behavior_forms_kind_check;
alter table public.behavior_forms add constraint behavior_forms_kind_check
  check (kind in ('pledge', 'invite', 'incident', 'statement'));

create index if not exists behavior_forms_student_idx on public.behavior_forms (student_id);
create index if not exists behavior_forms_kind_idx on public.behavior_forms (kind, created_at desc);

-- الرقم التسلسلي: BHV-2026-0001
create or replace function public.behavior_forms_serial()
returns trigger language plpgsql security definer set search_path = public as $$
declare y text := to_char(current_date, 'YYYY'); n int;
begin
  if new.serial is null then
    select coalesce(max(substring(serial from '\d+$')::int), 0) + 1 into n
      from public.behavior_forms where serial like 'BHV-' || y || '-%';
    new.serial := 'BHV-' || y || '-' || lpad(n::text, 4, '0');
  end if;
  return new;
end $$;

drop trigger if exists behavior_forms_serial on public.behavior_forms;
create trigger behavior_forms_serial before insert on public.behavior_forms
  for each row execute function public.behavior_forms_serial();

alter table public.behavior_forms enable row level security;

-- من يُصدر ويدير: المدير والدعم الفني ووكيل شؤون الطلاب والموجهون
drop policy if exists "staff read behavior forms" on public.behavior_forms;
create policy "staff read behavior forms" on public.behavior_forms for select to authenticated
  using (
    issued_by = auth.uid()
    or has_admin_role(array['principal', 'tech_support', 'deputy_students', 'counselor_1', 'counselor_2', 'counselor_3'])
    -- الطالب وولي أمره: التعهد والدعوة فقط (المحضر والإفادة داخليان)
    or (kind in ('pledge', 'invite') and exists (
          select 1 from public.students s where s.id = behavior_forms.student_id and s.user_id = auth.uid()))
    or (kind in ('pledge', 'invite') and exists (
          select 1 from public.guardian_student gs join public.guardians g on g.id = gs.guardian_id
          where gs.student_id = behavior_forms.student_id and g.user_id = auth.uid()))
  );

drop policy if exists "staff issue behavior forms" on public.behavior_forms;
create policy "staff issue behavior forms" on public.behavior_forms for insert to authenticated
  with check (
    issued_by = auth.uid()
    and has_admin_role(array['principal', 'tech_support', 'deputy_students', 'counselor_1', 'counselor_2', 'counselor_3'])
  );

drop policy if exists "staff update behavior forms" on public.behavior_forms;
create policy "staff update behavior forms" on public.behavior_forms for update to authenticated
  using (has_admin_role(array['principal', 'tech_support', 'deputy_students', 'counselor_1', 'counselor_2', 'counselor_3']));

drop policy if exists "managers delete behavior forms" on public.behavior_forms;
create policy "managers delete behavior forms" on public.behavior_forms for delete to authenticated
  using (has_admin_role(array['principal', 'tech_support', 'deputy_students']));

-- إقرار الطالب أو ولي الأمر ورده — دالة واحدة تتحقق من صاحب الحق
-- فلا يُعدّل الطالب أو ولي الأمر إلا حقول إقراره.
create or replace function public.behavior_form_ack(p_id uuid, p_note text default null, p_reply jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
declare f public.behavior_forms; is_student boolean; is_guardian boolean;
begin
  select * into f from public.behavior_forms where id = p_id;
  if f.id is null or f.kind not in ('pledge', 'invite') then raise exception 'غير متاح'; end if;

  select exists (select 1 from public.students s where s.id = f.student_id and s.user_id = auth.uid())
    into is_student;
  select exists (select 1 from public.guardian_student gs join public.guardians g on g.id = gs.guardian_id
                 where gs.student_id = f.student_id and g.user_id = auth.uid())
    into is_guardian;

  if is_guardian then
    update public.behavior_forms set
      guardian_id = auth.uid(), guardian_ack_at = now(),
      guardian_note = nullif(trim(coalesce(p_note, '')), ''),
      guardian_reply = coalesce(p_reply, guardian_reply),
      status = case when f.kind = 'invite' or student_ack_at is not null then 'answered' else status end
    where id = p_id;
  elsif is_student and f.kind = 'pledge' then
    update public.behavior_forms set
      student_ack_at = now(),
      status = case when guardian_ack_at is not null then 'answered' else status end
    where id = p_id;
  else
    raise exception 'لا تملك صلاحية الإقرار على هذا النموذج';
  end if;
end $$;

grant execute on function public.behavior_form_ack(uuid, text, jsonb) to authenticated;
