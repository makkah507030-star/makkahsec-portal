import os, html, segno
from build import FLYERS, icon, URL, FONTS, OUT

CSS = open(os.path.join(OUT, "motion.css"), encoding="utf-8").read().replace("{FONTS}", FONTS)
QR = segno.make("https://" + URL, error="m").svg_inline(scale=4, border=0, dark="#10211A")

PHONE = {
 "teacher": ("table", "كشف الرصد", "انتقلت درجات الاختبار القصير إلى كشف الرصد تلقائيًا.",
             "أنت تدرّس.. والبوابة ترصد", "التحضير والتصحيح والرصد والتقارير — كلها من جوالك."),
 "admin": ("chart", "لوحة المؤشرات", "تم تحديث حضور اليوم لجميع الفصول.",
           "المدرسة كلها بين يديك", "كل موظف يرى الخدمات المرتبطة بصلاحيته فقط."),
 "guardian": ("bell", "تنبيه الحضور", "تم تسجيل وصول ابنك إلى المدرسة.",
              "اطمئن من جوالك", "ثبّتها على الشاشة الرئيسية وفعّل الإشعارات — حتى لا يفوتك تنبيه."),
 "student": ("timer", "اختبار إلكتروني جديد", "اختبار قصير متاح الآن — اضغط للبدء.",
             "لا يفوتك شيء", "ثبّتها كتطبيق على جوالك وفعّل الإشعارات — بلا تحميل من المتجر."),
}

G1_IN, G1_OUT, G2_IN, G2_OUT, STAG = 7.85, 12.95, 13.75, 18.85, 0.28

def feat(i, n, f, t_in, t_out):
    ic, t, d = f
    style = (f"animation:slideR .75s {t_in:.2f}s var(--out) both, outL .45s {t_out:.2f}s var(--in) forwards")
    return (f'<div class="feat" style="{style}"><div class="fi" style="animation:popIn .6s {t_in+.15:.2f}s var(--pop) both">{icon(ic,"")}</div>'
            f'<div><h3>{html.escape(t)}</h3><p>{html.escape(d)}</p></div><span class="num">{i:02d}</span></div>')

def wipe(t):
    return f'<div class="wipe" style="animation:wipe .95s {t}s cubic-bezier(.65,0,.35,1) both"></div>'

def page(key, f):
    feats = f["features"]; n = len(feats); half = (n + 1) // 2
    g1 = "".join(feat(i+1, n, x, G1_IN + i*STAG, G1_OUT + i*.06) for i, x in enumerate(feats[:half]))
    g2 = "".join(feat(half+i+1, n, x, G2_IN + i*STAG, G2_OUT + i*.06) for i, x in enumerate(feats[half:]))
    pic, pt, pb, ch, cp = PHONE[key]
    steps = "".join(f'<div class="step"><span class="sn">{i}</span><div><b>{t}</b><span>{d}</span></div></div>'
                    for i, (_, t, d) in enumerate(f["steps"], 1)).replace('class="num"', 'class="nm"')
    dense = " dense" if n > 8 else ""
    return f"""<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div class="stage{dense}">
  <div class="lines"></div><div class="blob b1"></div><div class="blob b2"></div>
  <img class="ghost" src="icon-white.png" alt="">

  <div class="topbar"><div class="brand"><img src="icon-white.png" alt=""><div><b>بوابة مكة الثانوية الرقمية</b><small>مدرسة مكة الثانوية</small></div></div>
    <div class="yr">١٤٤٨ – ١٤٤٩ هـ</div></div>

  <section class="abs intro">
    <div class="logo-wrap"><div class="ring r1"></div><div class="ring r2"></div><img class="logo" src="icon-white.png" alt=""></div>
    <h2><span>بوابة مكة الثانوية الرقمية</span></h2>
    <p>مدرسة مكة الثانوية</p><div class="bar"></div>
  </section>

  <section class="abs hero">
    <div class="chip">{icon(f['aicon'],'')}<span>{f['audience']}</span></div>
    <div class="h1"><span class="ln l1"><span>{f['h1'][0]}</span></span><span class="ln l2"><span>{f['h1'][1]}</span></span></div>
    <div class="underline"></div>
    <p class="lead">{f['lead']}</p>
  </section>

  <div class="sec"><span>ماذا تقدّم لك البوابة؟</span><span class="count" dir="ltr">{n:02d} خدمات</span></div>
  <div class="group">{g1}</div>
  <div class="group">{g2}</div>

  <section class="abs phoneScene">
    <div class="phone"><div class="notch"></div><div class="screen">
      <div class="sh"><img src="icon-mint.png" alt=""><b>بوابة مكة الثانوية الرقمية</b></div>
      <div class="skel"><i></i><u></u></div><div class="skel"><i></i><u></u></div><div class="skel"><i></i><u></u></div><div class="skel"><i></i><u></u></div><div class="skel"><i></i><u></u></div>
      <div class="toast"><div class="ti">{icon(pic,'')}</div><div><b>{pt}</b><span>{pb}</span></div><em>الآن</em></div>
    </div></div>
    <div class="cap"><h3><span>{ch}</span></h3><p>{cp}</p></div>
  </section>

  <section class="abs cta">
    <div class="kick">ابدأ الآن</div>
    <h2><span>ثلاث خطوات فقط</span></h2>
    <div class="steps">{steps}</div>
    <div class="bottom">
      <div class="qr">{QR}</div>
      <div class="urlbig"><small>امسح الرمز أو ادخل مباشرة</small><strong>{URL}</strong><p>الدعم الفني لبوابة مكة الثانوية الرقمية</p></div>
    </div>
  </section>

  {wipe(2.7)}{wipe(18.95)}{wipe(22.55)}
  <div class="progress"><i></i></div>
</div></body></html>"""

for key, f in FLYERS.items():
    with open(os.path.join(OUT, f"motion-{key}.html"), "w", encoding="utf-8") as fh:
        fh.write(page(key, f))
print("motion built")
