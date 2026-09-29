-- يُخرج سياسات صلاحيات الملفات (storage.objects) كأوامر SQL قابلة لإعادة التنفيذ.
-- يستخدمه سير النسخ الاحتياطي، لأن نسخة مخطط public لا تشملها.
select format('drop policy if exists %I on storage.objects;%screate policy %I on storage.objects as %s for %s to %s%s%s;',
  policyname, chr(10), policyname, permissive, cmd, array_to_string(roles, ', '),
  case when qual is not null then chr(10) || '  using (' || qual || ')' else '' end,
  case when with_check is not null then chr(10) || '  with check (' || with_check || ')' else '' end)
from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname;
