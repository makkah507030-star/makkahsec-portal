-- =====================================================================
-- توقيعات أصحاب الأدوار الإدارية متاحة للطباعة لكل منسوبي المدرسة
--
-- المشكلة: لا يقرأ المستخدم إلا توقيعه (والمدير والدعم الفني الجميع)، فإذا
-- طبع الموجه أو المساعد الإداري تقريرًا فيه خانة للوكيل بقيت فارغة.
-- الحل: توقيعات من له دور إداري (المدير، الوكلاء، الموجهون…) تُقرأ لكل
-- معلم وإداري، كتوقيع المدير. توقيعات المعلمين تبقى كما هي.
-- يُنفَّذ مرة واحدة في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

-- هل المستخدم الحالي من منسوبي المدرسة (معلم أو إداري)
create or replace function public.is_school_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_user_role()::text in ('admin', 'teacher'), false);
$$;

-- توقيعات أصحاب الأدوار الإدارية: الاسم ومسار التوقيع
create or replace function public.staff_signatures()
returns table (user_id uuid, full_name text, path text)
language sql stable security definer set search_path = public as $$
  select s.user_id, u.full_name, s.path
    from user_signatures s
    join users u on u.id = s.user_id
   where public.is_school_staff()
     and exists (select 1 from admin_roles r where r.user_id = s.user_id);
$$;
revoke execute on function public.staff_signatures() from public, anon;
grant  execute on function public.staff_signatures() to authenticated;

-- قراءة ملف التوقيع نفسه من حاوية form-assets
drop policy if exists "read staff signatures" on storage.objects;
create policy "read staff signatures" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'form-assets'
    and public.is_school_staff()
    and exists (
      select 1 from public.user_signatures s
      join public.admin_roles r on r.user_id = s.user_id
      where s.path = objects.name
    )
  );
-- نهاية الجزء 1
