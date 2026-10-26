-- =====================================================================
-- إصلاحات أمنية عاجلة — الجزء 1 من 1 (المراجعة الأمنية للإصدار الأول).
-- ١) لا يعدّل المستخدم صفه في users (كان يستطيع جعل دوره admin). البوابة لا تحتاجه:
--    تغيير «يجب تغيير كلمة المرور» بالدالة clear_must_change_pw.
-- ٢) دوال لا تستعملها البوابة: لا يستدعيها أحد (تبقى لمحرر SQL).
-- ٣) دوال للمسجّلين: لا يستدعيها غير المسجّل (anon).
-- ٤) missing_students وofficial_daily_status للإدارة وحدها: تُغلَّف بفحص is_admin().
-- ٥) has_admin_role(text[]): الحساب الإداري الموقوف يفقد صلاحياته.
-- يُنفَّذ في Supabase ← SQL Editor، وتكرار التنفيذ آمن.
-- =====================================================================

-- ١)
drop policy if exists users_update_own on public.users;

-- ٢)
revoke execute on function public.clear_today_device_punches() from public, anon, authenticated;
do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.proname in ('link_duty_names', 'quiz_period_summary') loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
  end loop;
end $$;

-- ٣)
do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('grade_submission', 'set_notification_meta', 'student_day_timeline',
                                'substitute_roster', '_finish_online_attempt', '_sweep_online_quiz') loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ٤) الأصل يُنقل باسم *_unsafe (لا يستدعيه إلا الغلاف)، والغلاف بالاسم نفسه والتوقيع نفسه
do $do$
declare f record; ins text;
begin
  for f in select p.oid, p.proname, pg_get_function_arguments(p.oid) as args,
                  pg_get_function_identity_arguments(p.oid) as iargs, pg_get_function_result(p.oid) as res
             from pg_proc p
            where p.pronamespace = 'public'::regnamespace
              and p.proname in ('missing_students', 'official_daily_status')
              and not exists (select 1 from pg_proc q where q.pronamespace = p.pronamespace
                                and q.proname = p.proname || '_unsafe') loop   -- نُفّذ من قبل
    -- أسماء مُدخلات الدالة بترتيبها (دون أعمدة RETURNS TABLE)
    select string_agg(quote_ident(n), ', ' order by o) into ins
      from unnest((select proargnames from pg_proc where oid = f.oid),
                  coalesce((select proargmodes::text[] from pg_proc where oid = f.oid),
                           array_fill('i'::text, array[cardinality((select proargnames from pg_proc where oid = f.oid))])))
           with ordinality as a(n, m, o)
     where m in ('i', 'b');
    execute format('alter function public.%I(%s) rename to %I', f.proname, f.iargs, f.proname || '_unsafe');
    execute format('revoke execute on function public.%I(%s) from public, anon, authenticated', f.proname || '_unsafe', f.iargs);
    execute format($w$
      create function public.%I(%s) returns %s
      language plpgsql stable security definer set search_path = public as $b$
      begin
        if not public.is_admin() then raise exception 'غير مصرح'; end if;
        return query select * from public.%I(%s);
      end $b$ $w$, f.proname, f.args, f.res, f.proname || '_unsafe', coalesce(ins, ''));
    execute format('revoke execute on function public.%I(%s) from public, anon', f.proname, f.iargs);
    execute format('grant execute on function public.%I(%s) to authenticated', f.proname, f.iargs);
  end loop;
end $do$;

-- ٥)
create or replace function public.has_admin_role(p_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_roles r join public.users u on u.id = r.user_id
                  where r.user_id = auth.uid() and r.role_type::text = any(p_roles) and u.is_active);
$$;
-- نهاية الجزء 1
