# النسخ الاحتياطي والاسترجاع

للبوابة طبقتان من النسخ الاحتياطي:

| | نسخ Supabase اليومية | النسخة الأسبوعية المشفّرة (هذا المستودع) |
|---|---|---|
| متى | كل ليلة قرابة 9:55 م | كل جمعة 1:00 فجرًا (ويمكن تشغيلها يدويًا) |
| مدة الحفظ | 7 أيام | 90 يومًا |
| أين | داخل حساب Supabase | GitHub ← Actions ← Backup (خارج Supabase) |
| الملفات المرفوعة | لا تشملها | تشملها |
| الاسترجاع | زر Restore في Supabase ← Database ← Backups | الخطوات أدناه |

**خطأ حديث (أقل من أسبوع)؟** استخدم نسخ Supabase اليومية أولًا، فهي الأسهل.
النسخة الأسبوعية للحالات الأصعب: خطأ اكتُشف متأخرًا، أو فقدان مشروع Supabase أو الحساب.

محتوى النسخة الأسبوعية (`makkahsec-backup-<التاريخ>.tar.gz.gpg`):

- `backup/db/public.dump` — مخطط public كاملًا: الجداول وبياناتها، الدوال، السياسات، المشغّلات.
- `backup/db/auth.dump` — حسابات الدخول (`auth.users` و`auth.identities`) بكلمات مرورها المشفّرة.
- `backup/db/storage_policies.sql` — سياسات صلاحيات الملفات.
- `backup/storage/` — كل الملفات المرفوعة، و`buckets.json` بإعدادات الحاويات.

## الإعداد (مرة واحدة)

في GitHub ← المستودع ← Settings ← Secrets and variables ← Actions ← **New repository secret**، أضف:

| الاسم | القيمة |
|---|---|
| `SUPABASE_DB_URL` | Supabase ← زر **Connect** أعلى المشروع ← **Session pooler** ← انسخ الرابط وضع كلمة مرور قاعدة البيانات مكان `[YOUR-PASSWORD]`. (الاتصال المباشر Direct لا يعمل من GitHub.) |
| `SUPABASE_URL` | القيمة نفسها الموجودة في Netlify |
| `SUPABASE_SERVICE_ROLE_KEY` | القيمة نفسها الموجودة في Netlify |
| `BACKUP_PASSPHRASE` | كلمة سر طويلة جديدة لتشفير النسخ. **احفظها في مكان آمن: بدونها لا يمكن فتح أي نسخة.** |

نسيت كلمة مرور قاعدة البيانات؟ Supabase ← Project Settings ← Database ← **Reset database password**.
لا يتأثر الموقع بتغييرها، فهو يتصل بالمفاتيح لا بكلمة المرور.

ثم للتجربة: Actions ← **Backup** ← **Run workflow**. بعد دقائق تظهر النسخة أسفل صفحة التشغيل في **Artifacts**.
إن فشل تشغيل مجدول يصلك بريد من GitHub.

## الاسترجاع

يلزم جهاز عليه `gpg` و`postgresql-client` (الإصدار 17) و`node` ونسخة من هذا المستودع.

### ١) فك التشفير

نزّل النسخة من Actions ← Backup ← التشغيل المطلوب ← Artifacts، ثم:

```bash
unzip makkahsec-backup-2026-10-02.zip
gpg -d -o backup.tar.gz makkahsec-backup-2026-10-02.tar.gz.gpg   # يطلب BACKUP_PASSPHRASE
tar -xzf backup.tar.gz
```

### ٢) قاعدة البيانات (على مشروع Supabase جديد وفارغ)

```bash
DB="رابط Session pooler للمشروع الجديد"

# حسابات الدخول أولًا (جدول users في البوابة يرتبط بها)
pg_restore -d "$DB" --data-only --exit-on-error backup/db/auth.dump

# مخطط public — عدا إنشاء المخطط نفسه لأنه موجود في كل مشروع
pg_restore -l backup/db/public.dump | grep -v " SCHEMA - public " > list.txt
pg_restore -d "$DB" --no-owner --exit-on-error -L list.txt backup/db/public.dump

# سياسات صلاحيات الملفات
psql "$DB" -v ON_ERROR_STOP=1 -f backup/db/storage_policies.sql
```

### ٣) الملفات المرفوعة

```bash
npm ci
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… node scripts/restore-storage.mjs backup/storage
```

### ٤) ربط الموقع بالمشروع الجديد

- Netlify ← Environment variables: حدّث `VITE_SUPABASE_URL` و`VITE_SUPABASE_ANON_KEY`
  و`SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` (و`SUPABASE_PROJECT_REF` و`SUPABASE_ACCESS_TOKEN` إن وُجدت)، ثم أعد النشر.
- خزنة Supabase: أعد حفظ مفتاح إشعارات الجوال
  `select vault.create_secret('<قيمة PUSH_INTERNAL_SECRET>', 'push_internal_secret');`
- Supabase ← Authentication: أعد إعداداته كما كانت (لا تُنسخ مع البيانات).
- حدّث أسرار GitHub للنسخ الاحتياطي بقيم المشروع الجديد.
