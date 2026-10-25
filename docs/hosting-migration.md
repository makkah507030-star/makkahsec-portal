# الانتقال من Netlify إلى Vercel: النسخة الاحتياطية وخطة الرجوع

## إعدادات DNS قبل الانتقال (Cloudflare، 21 أكتوبر 2026)

| الاسم | النوع | القيمة | Proxy | TTL |
|---|---|---|---|---|
| makkahsec.com | A | `75.2.60.5` (Netlify) | DNS only | Auto |
| www | CNAME | `makkahsec.netlify.app` | DNS only | Auto |
| makkahsec.com | MX | mx.zoho.com / mx2.zoho.com / mx3.zoho.com | DNS only | 10 min |
| makkahsec.com | TXT | `v=spf1 include:zoho…` و`zoho-verification=…` | DNS only | — |

**سجلات البريد (MX وTXT لـ Zoho) لا تُمَس** في الانتقال ولا في الرجوع.
الانتقال يغيّر السجلين الأولين فقط (A وwww).

## الرجوع إلى Netlify

1. Cloudflare ← DNS ← Records.
2. سجل `A` لـ makkahsec.com ← Edit ← القيمة `75.2.60.5`، والسحابة رمادية (DNS only).
3. سجل `CNAME` لـ www ← Edit ← القيمة `makkahsec.netlify.app`، والسحابة رمادية.
4. إيقاف الدوال المجدولة في Vercel وتشغيلها في Netlify (كي لا تُرسل الإشعارات مرتين).
5. يسري التغيير خلال دقائق (TTL Auto = 5 دقائق في Cloudflare).

موقع Netlify لا يُحذف ولا يُلغى اشتراكه طوال أسبوع التجربة على الأقل.

## كيف تعمل البوابة على المنصتين أثناء الانتقال

> **مؤجَّل (25 أكتوبر 2026):** أُخرجت ملفات Vercel من المستودع حتى يُقرَّر الانتقال
> (`api/` و`vercel.json` و`netlify/lib/cronHost.js` وسطر التحقق في الدوال المجدولة الأربع).
> هي محفوظة كاملة في التعديل `094ddbc`، وتُعاد عند الانتقال بـ
> `git checkout 094ddbc -- api vercel.json netlify/lib/cronHost.js netlify/functions`
> ثم مراجعة الدوال الأربع إن تغيّرت بعده.

- **الدوال:** منطقها كله باقٍ في `netlify/functions/`. وكل ملف في `api/` يستورد دالته من هناك
  ويشغّلها على Vercel عبر `api/_adapter.js`، فلا نسختان من الكود.
- **المسارات القديمة تبقى:** `vercel.json` يحوّل `/.netlify/functions/*` إلى `/api/*`، و`/iclock/*`
  إلى دالة البصمة، فلا يتغيّر شيء في الواجهة ولا في وسيط البصمة.
- **الدوال المجدولة على منصة واحدة فقط:** المفتاح `cron_host` في جدول `settings`
  (`netlify/lib/cronHost.js`). القيمة الافتراضية `netlify`. التحويل بسطر SQL دون نشر:

```sql
insert into public.settings (key, value) values ('cron_host', 'vercel')
on conflict (key) do update set value = excluded.value;
```

  وللرجوع تُكتب `'netlify'` بدل `'vercel'`.

## متغيرات البيئة في Vercel (Settings ← Environment Variables)

تُنسخ قيمها من Netlify ← Site configuration ← Environment variables:

| المتغير | ملاحظة |
|---|---|
| `VITE_SUPABASE_URL`، `VITE_SUPABASE_ANON_KEY` | للبناء (الواجهة) |
| `SUPABASE_URL`، `SUPABASE_SERVICE_ROLE_KEY` | للدوال — سرّية |
| `VAPID_PUBLIC_KEY`، `VAPID_PRIVATE_KEY`، `VAPID_SUBJECT` | الإشعارات — نفس القيم وإلا بطلت الاشتراكات |
| `PUSH_INTERNAL_SECRET` | بين الدوال المجدولة ودالة الإشعارات |
| `SUPABASE_ACCESS_TOKEN`، `SUPABASE_PROJECT_REF` | لصفحة مؤشرات الموقع (اختياري) |
| `CRON_SECRET` | جديد: نص عشوائي طويل، يحمي الدوال المجدولة |

## ترتيب التحويل

1. تجربة رابط المعاينة من Vercel (الدخول، التحضير، الإشعارات، المستندات).
2. دمج الدفعة في `main` فيبني Vercel نسخة الإنتاج.
3. ربط النطاق في Vercel (Settings ← Domains) وأخذ القيم الجديدة.
4. Cloudflare: تعديل سجلي `A` و`www` إلى قيم Vercel (رماديان، DNS only).
5. SQL: `cron_host` = `'vercel'`.
6. تجربة البصمة صباحًا وإشعار تجريبي.
