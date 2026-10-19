-- =====================================================================
-- بنك الأنشطة (الجزء 1 من 2): حقيبة حصص الانتظار والأنشطة الصفية
-- يديره وكيل الشؤون التعليمية والدعم الفني (إضافة وتعديل ونشر)، ويستفيد منه المعلمون.
-- الصور في مخزن activity-media (عام للقراءة)، والفيديو روابط فقط.
-- تكرار التنفيذ آمن.
-- =====================================================================

create table if not exists public.activity_cards (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('waiting', 'class')),  -- حقيبة الانتظار أو نشاط صفي
  section     text not null,             -- القسم: games, sports, tech, puzzles, culture… أو نوع الاستراتيجية
  title       text not null,
  summary     text,
  cover_path  text,                      -- صورة الغلاف في activity-media
  images      text[] not null default '{}',
  video_url   text,                      -- رابط (يوتيوب مثلًا) بلا رفع
  grades      int[] not null default '{}',   -- فارغ = كل الصفوف
  subject     text,                      -- للنشاط الصفي الخاص بمادة (فارغ = عام)
  duration_min int,
  goals       text,
  materials   text,
  steps       jsonb not null default '[]',   -- [{ "min": 5, "text": "…" }]
  game        text,                      -- لعبة جاهزة على السبورة: huroof, teams_quiz
  game_data   jsonb,
  seed_key    text unique,               -- البطاقات الجاهزة المستوردة
  published   boolean not null default true,
  sort        int not null default 0,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.activity_uses (
  id        uuid primary key default gen_random_uuid(),
  card_id   uuid not null references public.activity_cards(id) on delete cascade,
  user_id   uuid not null default auth.uid(),
  class_id  uuid,
  context   text not null default 'class' check (context in ('waiting', 'class')),
  used_on   date not null default (now() at time zone 'Asia/Riyadh')::date,
  rating    smallint check (rating in (-1, 1)),
  created_at timestamptz not null default now()
);
create index if not exists activity_uses_card on public.activity_uses (card_id);
create index if not exists activity_uses_class on public.activity_uses (class_id, used_on);

create or replace function public.activity_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_admin_role(array['deputy_academic', 'tech_support']);
$$;

alter table public.activity_cards enable row level security;
alter table public.activity_uses enable row level security;

drop policy if exists "activity cards read" on public.activity_cards;
create policy "activity cards read" on public.activity_cards for select to authenticated
  using (published or public.activity_manager() or public.has_admin_role(array['principal', 'tech_support']));
drop policy if exists "activity cards manage" on public.activity_cards;
create policy "activity cards manage" on public.activity_cards for all to authenticated
  using (public.activity_manager()) with check (public.activity_manager());

drop policy if exists "activity uses own" on public.activity_uses;
create policy "activity uses own" on public.activity_uses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "activity uses read admin" on public.activity_uses;
create policy "activity uses read admin" on public.activity_uses for select to authenticated
  using (public.activity_manager() or public.has_admin_role(array['principal', 'tech_support']));

-- البطاقات التي قُدّمت لفصل من قبل (من أي معلم)، لاقتراح الجديد في حصة الانتظار
create or replace function public.activity_class_used(p_class uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select distinct card_id from activity_uses where class_id = p_class;
$$;
revoke all on function public.activity_class_used(uuid) from public, anon;
grant execute on function public.activity_class_used(uuid) to authenticated;

-- الصور: يقرؤها الجميع، ويرفعها ويحذفها الوكيل
insert into storage.buckets (id, name, public) values ('activity-media', 'activity-media', true)
on conflict (id) do nothing;
drop policy if exists "activity media write" on storage.objects;
create policy "activity media write" on storage.objects for insert to authenticated
  with check (bucket_id = 'activity-media' and public.activity_manager());
drop policy if exists "activity media delete" on storage.objects;
create policy "activity media delete" on storage.objects for delete to authenticated
  using (bucket_id = 'activity-media' and public.activity_manager());

grant select, insert, update, delete on public.activity_cards, public.activity_uses to authenticated;

-- نهاية الجزء 1
