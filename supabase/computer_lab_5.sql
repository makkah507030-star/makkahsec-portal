-- =====================================================================
-- معمل الحاسب الآلي (5): قواعد السلامة وإقرار الطالب بها مرة كل فصل دراسي
-- (ومن جديد إن طلب المحضر ذلك بعد تعديلها). يُنفَّذ بعد الأجزاء 1-4.
-- =====================================================================

create table if not exists public.lab_rules (
  id smallint primary key default 1 check (id = 1),
  items jsonb not null,          -- ["نص القاعدة", ...]
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.lab_rules (id, items) values (1, '[
  "لا طعام ولا شراب داخل المعمل.",
  "اجلس على جهازك المحدد في خريطة الجلوس، ولا تنتقل دون إذن المعلم.",
  "لا تفصل الأسلاك ولا توصلها، ولا تفتح صندوق الجهاز.",
  "أبلغ المعلم فورًا عن أي عطل أو رائحة احتراق أو شرارة كهربائية.",
  "لا تثبّت البرامج ولا تغيّر إعدادات الجهاز أو خلفيته.",
  "لا تستخدم وحدات التخزين الخارجية (الفلاش) إلا بإذن المعلم.",
  "استخدم الإنترنت لأغراض الدرس فقط، واحفظ بيانات دخولك سرّية.",
  "حافظ على نظافة المكان، وأعد الكرسي ولوحة المفاتيح إلى مكانهما.",
  "أغلق البرامج وسجّل الخروج من حساباتك قبل مغادرة المعمل.",
  "في الطوارئ: اترك الجهاز واتبع تعليمات المعلم وخطة الإخلاء."
]'::jsonb) on conflict (id) do nothing;
alter table public.lab_rules enable row level security;
drop policy if exists "lab rules read" on public.lab_rules;
create policy "lab rules read" on public.lab_rules for select to authenticated using (true);

create table if not exists public.lab_rule_acks (
  student_id uuid not null references public.students(id) on delete cascade,
  term_key text not null,        -- العام-الفصل، مثل 1448-1
  version integer not null,
  acked_at timestamptz not null default now(),
  primary key (student_id, term_key, version)
);
alter table public.lab_rule_acks enable row level security;   -- القراءة والكتابة عبر الدوال

create or replace function public.lab_term_key() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select value from public.settings where key = 'active_year'), '') || '-' ||
         coalesce((select value from public.settings where key = 'active_term'), '1');
$$;

-- حفظ القواعد (لمسؤولي المعمل)، وp_reack يطلب من الطلاب الإقرار من جديد
create or replace function public.lab_rules_save(p_items jsonb, p_reack boolean default false)
returns integer language plpgsql security definer set search_path = public as $$
declare v integer;
begin
  if not public.lab_is_manager() then raise exception 'تعديل القواعد لمسؤول المعمل'; end if;
  update public.lab_rules set items = p_items, updated_at = now(), updated_by = auth.uid(),
         version = version + case when p_reack then 1 else 0 end
   where id = 1 returning version into v;
  return v;
end $$;

-- للطالب: هل عليه الإقرار؟ يظهر لمن وُزّع على جهاز أو حُجز المعمل لفصله
create or replace function public.lab_rules_mine()
returns table (items jsonb, version integer, required boolean, acked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select r.items, r.version,
         exists (select 1 from public.lab_seats s where s.student_id = public.current_student_id())
           or exists (select 1 from public.student_enrollment e join public.lab_bookings b on b.class_id = e.class_id
                       where e.student_id = public.current_student_id() and e.status = 'active'),
         (select a.acked_at from public.lab_rule_acks a where a.student_id = public.current_student_id()
             and a.term_key = public.lab_term_key() and a.version = r.version)
    from public.lab_rules r where r.id = 1 and public.current_student_id() is not null;
$$;

create or replace function public.lab_rules_ack() returns void
language sql security definer set search_path = public as $$
  insert into public.lab_rule_acks (student_id, term_key, version)
  select public.current_student_id(), public.lab_term_key(), r.version from public.lab_rules r
   where r.id = 1 and public.current_student_id() is not null
  on conflict do nothing;
$$;

-- إقرارات طلاب فصل في الفصل الدراسي الحالي (للمعلمين المخوّلين ومسؤولي المعمل)
create or replace function public.lab_rules_class(p_class uuid)
returns table (student_id uuid, full_name text, acked_at timestamptz)
language sql stable security definer set search_path = public as $$
  select st.id, st.full_name,
         (select a.acked_at from public.lab_rule_acks a join public.lab_rules r on r.id = 1
           where a.student_id = st.id and a.term_key = public.lab_term_key() and a.version = r.version)
    from public.student_enrollment e join public.students st on st.id = e.student_id
   where public.lab_can_view() and e.class_id = p_class and e.status = 'active';
$$;

revoke execute on function public.lab_term_key(), public.lab_rules_save(jsonb, boolean), public.lab_rules_mine(),
  public.lab_rules_ack(), public.lab_rules_class(uuid) from public, anon;
grant execute on function public.lab_term_key(), public.lab_rules_save(jsonb, boolean), public.lab_rules_mine(),
  public.lab_rules_ack(), public.lab_rules_class(uuid) to authenticated;
-- نهاية الجزء 5
