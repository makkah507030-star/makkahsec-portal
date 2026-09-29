-- =====================================================================
-- صلاحيات النماذج: لا يُصدر المستخدم مستندًا إلا من نموذج مُتاح لدوره.
--
-- «من يُصدره» في إدارة النماذج (form_templates.allowed_roles) يقبل:
--   • أدوارًا إدارية بعينها: deputy_students، counselor_1، activity_leader، …
--   • admin   : كل الإداريين (ما ضُبط سابقًا يبقى كما هو حتى يُوزَّع)
--   • teacher : المعلمون
-- والمدير والدعم الفني يُصدران من كل النماذج دائمًا.
--
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، ويمكن إعادة تنفيذه بأمان.
-- =====================================================================

create or replace function public.fd_can_use_template(p_template public.form_templates.id%type)
returns boolean language sql stable security definer set search_path = public as $$
  with me as (
    select auth.uid() as uid
  ),
  my_roles as (
    select ar.role_type::text as r from public.admin_roles ar, me where ar.user_id = me.uid
  ),
  allowed as (
    -- to_jsonb يقبل العمود نصًّا مصفوفًا أو jsonb
    select jsonb_array_elements_text(coalesce(to_jsonb(t.allowed_roles), '[]'::jsonb)) as r
    from public.form_templates t where t.id = p_template
  )
  select
    exists (select 1 from my_roles where r in ('principal', 'tech_support'))
    or exists (select 1 from allowed a join my_roles m on m.r = a.r)
    or (exists (select 1 from allowed where r = 'admin')
        and exists (select 1 from public.users u, me where u.id = me.uid and u.role = 'admin'))
    or (exists (select 1 from allowed where r = 'teacher')
        and (exists (select 1 from public.users u, me where u.id = me.uid and u.role = 'teacher')
             or exists (select 1 from public.teachers t, me where t.user_id = me.uid)));
$$;

revoke execute on function public.fd_can_use_template(public.form_templates.id%type) from public, anon;
grant  execute on function public.fd_can_use_template(public.form_templates.id%type) to authenticated;

create or replace function public.fd_guard_template_use()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- العمليات الخلفية (بلا مستخدم) لا تُقيَّد
  if auth.uid() is null then
    return new;
  end if;
  if not public.fd_can_use_template(new.template_id) then
    raise exception 'لا تملك صلاحية إصدار هذا النموذج';
  end if;
  return new;
end;
$$;

drop trigger if exists fd_guard_template_use on public.form_documents;
create trigger fd_guard_template_use
  before insert on public.form_documents
  for each row execute function public.fd_guard_template_use();
