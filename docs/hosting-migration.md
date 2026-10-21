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
