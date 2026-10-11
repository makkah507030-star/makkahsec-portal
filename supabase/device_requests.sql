-- سجل تشخيصي لاتصالات أجهزة البصمة (يحفظ أسبوعًا واحدًا)
create table if not exists public.device_requests (
  id bigint generated always as identity primary key,
  at timestamp with time zone not null default now(),
  serial_no text,
  method text,
  path text,
  query text,
  body_lines integer,
  body_head text,
  status integer,
  reply text
);
create index if not exists device_requests_sn_at on public.device_requests (serial_no, at desc);
-- للخادم فقط: لا سياسات قراءة للمستخدمين
alter table public.device_requests enable row level security;
-- نهاية الجزء 1
