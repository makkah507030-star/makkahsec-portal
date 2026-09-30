# النشر على Netlify

المستودع خاص، وNetlify لا يستطيع سحب الكود منه (يفشل البناء عند «preparing repo»
بخطأ 404). لذلك يُبنى الموقع على GitHub ويُرفع جاهزًا إلى Netlify:

- **تلقائيًا** بعد كل دمج في `main` — سير العمل **Deploy** في GitHub ← Actions.
- **يدويًا** عند الحاجة: Actions ← Deploy ← **Run workflow**.

يفحص الكود أولًا (oxlint ودوال Netlify)، ثم يبني الموقع والدوال بإعدادات `netlify.toml`
ومتغيرات الموقع المحفوظة في Netlify (`VITE_SUPABASE_URL` وغيرها)، ثم ينشر.

## الإعداد (مرة واحدة)

### 1) مفتاح Netlify

Netlify ← صورة الحساب ← **User settings** ← **Applications** ←
**Personal access tokens** ← **New access token**. سمّه `github-deploy`، واختر
مدة الصلاحية الأطول، وانسخ المفتاح (يظهر مرة واحدة).

### 2) الأسرار في GitHub

المستودع ← **Settings** ← **Secrets and variables** ← **Actions** ← **New repository secret**:

| الاسم | القيمة |
|---|---|
| `NETLIFY_AUTH_TOKEN` | المفتاح من الخطوة 1 |
| `NETLIFY_SITE_ID` | Netlify ← Project configuration ← General ← **Project ID** |

### 3) إيقاف بناء Netlify الذاتي

Netlify ← Project configuration ← Build & deploy ← Build settings ← **Configure** ←
**Build status: Stopped** ← Save.

يمنع محاولات البناء الفاشلة (والعلامات الحمراء على طلبات الدمج). النشر من GitHub
لا يتأثر بهذا الإيقاف.

### 4) التجربة

Actions ← Deploy ← **Run workflow**. عند نجاحه يظهر في Netlify ← Deploys نشر جديد
منشور (Published) برسالة `GitHub Actions <رقم>`.

## عند فشل النشر

افتح Actions ← Deploy ← آخر تشغيل، وانظر الخطوة الحمراء:

- **التحقق من الأسرار**: سرّ ناقص — راجع الخطوة 2.
- **البناء والنشر** بخطأ `Unauthorized`: المفتاح انتهت صلاحيته أو حُذف — أنشئ مفتاحًا
  جديدًا وحدّث `NETLIFY_AUTH_TOKEN`.
