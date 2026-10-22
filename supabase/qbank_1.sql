-- =====================================================================
-- بنك الأسئلة (الجزء 1 من 2): الجدول والصلاحيات والحفظ التلقائي.
-- كل سؤال يكتبه المعلم في اختباراته يُحفظ في بنكه تلقائيًا (خاصًا به)، ويشاركه مع معلمي
-- المدرسة متى شاء بلا اعتماد. السؤال المكرر بنصه وإجابته لا يُحفظ مرتين، فيبقى باسم من أضافه
-- أولًا (ومنه ما يُنسخ من البنك إلى اختبار آخر). تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.qbank (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.users(id) on delete cascade,
  owner_name text,
  source_question uuid unique,                -- السؤال الأصلي في quiz_questions
  content_hash text not null unique,          -- النوع والنص والخيارات والإجابة
  subject_name text,
  grade int,
  lesson text,
  difficulty text check (difficulty in ('easy', 'medium', 'hard')),
  kind text not null,
  body text not null default '',              -- نص السؤال للبحث والعرض
  q jsonb not null,                           -- السؤال كاملًا كما في quiz_questions
  shared boolean not null default false,
  uses int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);
create index if not exists qbank_subject on public.qbank (subject_name, grade);
create index if not exists qbank_owner on public.qbank (owner_id);

-- معلم أو إداري نشِط (من يرى البنك المشترك)
create or replace function public.qbank_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from users u where u.id = auth.uid() and u.role in ('teacher', 'admin') and u.is_active);
$$;
revoke all on function public.qbank_staff() from public, anon;
grant execute on function public.qbank_staff() to authenticated;

alter table public.qbank enable row level security;
-- يقرأ المعلم أسئلته كلها، وأسئلة غيره المشاركة؛ والإدارة كذلك. التعديل عبر الدوال (الجزء 2)
drop policy if exists qbank_read on public.qbank;
create policy qbank_read on public.qbank for select to authenticated using (
  owner_id = auth.uid()
  or (shared and public.qbank_staff()));
drop policy if exists qbank_delete on public.qbank;
create policy qbank_delete on public.qbank for delete to authenticated using (owner_id = auth.uid());
grant select, delete on public.qbank to authenticated;

-- الحفظ التلقائي: بعد إضافة سؤال أو تعديله في أي اختبار (لا يعطّل حفظ السؤال أبدًا)
create or replace function public.qbank_capture() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_q quizzes; v_hash text; v_name text; v_row jsonb;
begin
  select * into v_q from quizzes where id = new.quiz_id;
  if v_q.id is null or v_q.mode = 'external' then return new; end if;
  v_hash := md5(new.kind || '|' || coalesce(new.text, '') || '|' || coalesce(new.options::text, '') || '|' || coalesce(new.answer::text, ''));
  v_row := to_jsonb(new) - 'id' - 'quiz_id' - 'created_at' - 'updated_at' - 'sort_order';
  if tg_op = 'UPDATE' then
    update qbank set q = v_row, body = coalesce(new.text, ''), kind = new.kind, content_hash = v_hash, updated_at = now()
     where source_question = new.id
       and not exists (select 1 from qbank x where x.content_hash = v_hash and x.source_question is distinct from new.id);
    if found then return new; end if;
  end if;
  select coalesce((select t.full_name from teachers t where t.user_id = v_q.teacher_id limit 1), u.full_name)
    into v_name from users u where u.id = v_q.teacher_id;
  insert into qbank (owner_id, owner_name, source_question, content_hash, subject_name, grade, kind, body, q)
  values (v_q.teacher_id, v_name, new.id, v_hash, v_q.subject_name, v_q.grade, new.kind, coalesce(new.text, ''), v_row)
  on conflict do nothing;
  return new;
exception when others then
  return new;
end $$;

drop trigger if exists qbank_capture on public.quiz_questions;
create trigger qbank_capture after insert or update on public.quiz_questions
  for each row execute function public.qbank_capture();

-- الأسئلة الموجودة سابقًا تدخل بنوك أصحابها (خاصة)
insert into public.qbank (owner_id, owner_name, source_question, content_hash, subject_name, grade, kind, body, q, created_at)
select z.teacher_id,
       coalesce((select t.full_name from public.teachers t where t.user_id = z.teacher_id limit 1),
                (select u.full_name from public.users u where u.id = z.teacher_id)),
       x.id, md5(x.kind || '|' || coalesce(x.text, '') || '|' || coalesce(x.options::text, '') || '|' || coalesce(x.answer::text, '')),
       z.subject_name, z.grade, x.kind, coalesce(x.text, ''),
       to_jsonb(x) - 'id' - 'quiz_id' - 'created_at' - 'updated_at' - 'sort_order', x.created_at
  from public.quiz_questions x join public.quizzes z on z.id = x.quiz_id
 where z.mode <> 'external' and exists (select 1 from public.users u where u.id = z.teacher_id)
 order by x.created_at
on conflict do nothing;
-- نهاية الجزء 1
