"""Students motion video — white theme, same structure as teacher/admin."""
import os
import motion_teacher as M
from motion_teacher import A, inn, out, card, scene, title, ic, CSS, OUT, WIPES, S3, S4, S5, S6, S7, I
from motion_admin import LIGHT, LOGO

I.update({"phone": '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
          "folder": '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
          "timer": '<path d="M10 2h4"/><path d="m12 14 3-3"/><circle cx="12" cy="14" r="8"/>'})

EXTRA = """
@keyframes zoomCard{from{transform:scale(1)}to{transform:scale(1.9)}}
.paperz{position:absolute;background:#fff;border:1px solid #DCE7E0;border-radius:6px;overflow:hidden;box-shadow:0 26px 60px -20px rgba(31,58,46,.45)}
.paperz img{display:block;width:100%;transform-origin:50% 88%}
"""

pillars = [("calendar","جدولي اليومي"),("timer","الاختبارات"),("chart","سجلي ونتائجي"),("phone","خدمات الطالب")]
pill = "".join(f'<span class="chip pill" style="font-weight:600;font-size:14px;{A(inn("popIn",5.3+i*.28,.6,"var(--pop)"))}">{ic(a)}<span>{b}</span></span>'
               for i,(a,b) in enumerate(pillars))
INTRO = f"""
<section class="abs intro">
  <div class="logo-wrap"><div class="ring r1"></div><div class="ring r2"></div><img class="logo" src="{LOGO}" alt=""></div>
  <h2><span>بوابة مكة الثانوية الرقمية</span></h2><p>مدرسة مكة الثانوية</p><div class="bar"></div>
</section>
<section class="abs hero">
  <div class="chip">{ic('cap')}<span>للطالب</span></div>
  <div class="h1"><span class="ln l1"><span>مدرستك الآن</span></span><span class="ln l2"><span>في جوالك</span></span></div>
  <div class="underline"></div>
  <p class="lead">جدولك وحضورك ونتائجك واختباراتك في مكان واحد.</p>
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:22px">{pill}</div>
</section>"""

W = 472
def box(sc, x0, y0, x1, y1, pad=4): return (x0*sc-pad, 26+y0*sc-pad, (x1-x0)*sc+2*pad, (y1-y0)*sc+2*pad)

# ——— 01 schedule ———
sc3 = W / 1282; hx, hy, hw, hh = box(sc3, 22, 105, 68, 133)
pts3 = [("book","الجدول اليومي","المادة ورقم الحصة ووقتها."),
        ("calendar","الجدول الأسبوعي كاملًا","بضغطة زر واحدة."),
        ("clock","الحصة الجارية الآن","تعرف أين أنت في يومك بنظرة."),
        ("bell","تنبيهات المدرسة","تعاميم وتنبيهات تصلك على جوالك.")]
g3 = "".join(card(S3+3.4+i*1.2,"fadeUp",a,b,s) for i,(a,b,s) in enumerate(pts3))
SC3 = scene(18.75, title(S3, "جدولك اليومي", "أمامك", "calendar", "جدولي اليومي", "01") + f"""
<div class="win" style="top:282px;left:34px;width:{W}px;{A(inn('zoomIn',S3+.7,1))}">
  <div class="tb"><i></i><i></i><i></i><span>makkahsec.com</span></div><img src="shots/st-schedule.jpg" alt=""><span class="real" style="left:auto;right:8px">لقطة من البوابة</span>
  <div class="hot" style="left:{hx:.1f}px;top:{hy:.1f}px;width:{hw:.1f}px;height:{hh:.1f}px;border-radius:14px;{A(inn('popIn',S3+2.0,.5,'var(--pop)'), f'ring2 1.2s {S3+2.5:.2f}s ease-out 3 both')}"></div>
  <div class="bubble" style="left:{hx+hw+8:.1f}px;top:{hy+1:.1f}px;{A(inn('popIn',S3+2.4,.6,'var(--pop)'))}">الحصة الجارية الآن</div>
</div>
<div class="grid2" style="top:624px">{g3}</div>
""")

# ——— 02 quizzes (numbered steps) ———
PW = 236
steps = [(1,"ورقي ببطاقة تظليل","في صفحة واحدة، يُصحَّح آليًا."),
         (2,"أو إلكتروني","يصلك رابطه من المعلم بإشعار على الجوال."),
         (3,"حلّه من جوالك","بعدّاد وقت، وإجاباتك تُحفظ تلقائيًا."),
         (4,"ودرجتك تظهر أمامك","إذا أتاح معلمك ذلك.")]
col4 = "".join(card(S4+1.8+i*1.5,"slideR",str(n),b,s,"margin-bottom:10px;") for i,(n,b,s) in enumerate(steps))
SC4 = scene(28.75, title(S4, "اختبارك", "بين يديك", "timer", "الاختبارات", "02") + f"""
<div class="paperz" style="top:284px;left:34px;width:{PW}px;{A(inn('zoomIn',S4+.7,1.1))}">
  <img src="shots/st-quiz.jpg" alt="" style="{A(f'zoomCard 2.2s {S4+4.2:.2f}s cubic-bezier(.45,0,.3,1) both')}">
  <span class="real">لقطة من البوابة</span></div>
<div style="position:absolute;top:284px;right:34px;width:{540-68-PW-14}px">{col4}</div>
""")

# ——— 03 record & results ———
sc5 = W / 1282; rx, ry, rw, rh = box(sc5, 20, 692, 1260, 770, 3)
pts5 = [("check","سجل الغياب والتأخر","كل يوم بحالته، قبل أن يفاجئك."),
        ("clock","حضوري الصباحي","وقت بصمة دخولك كل يوم."),
        ("chart","درجاتك","كل درجات اختباراتك واضحة أمامك."),
        ("cap","نتائجي الدراسية","نتائجك الفصلية متى اعتمدتها المدرسة.")]
g5 = "".join(card(S5+3.2+i*1.2,"fadeUp",a,b,s) for i,(a,b,s) in enumerate(pts5))
SC5 = scene(38.75, title(S5, "حضورك ودرجاتك", "واضحة أمامك", "chart", "سجلي ونتائجي", "03") + f"""
<div class="win" style="top:282px;left:34px;width:{W}px;{A(inn('zoomIn',S5+.7,1))}">
  <div class="tb"><i></i><i></i><i></i><span>makkahsec.com</span></div><img src="shots/st-record.jpg" alt=""><span class="real" style="left:auto;right:8px;top:34px;bottom:auto">لقطة من البوابة</span>
  <div class="hot" style="left:{rx:.1f}px;top:{ry:.1f}px;width:{rw:.1f}px;height:{rh:.1f}px;border-radius:9px;{A(inn('popIn',S5+2.0,.5,'var(--pop)'), f'ring2 1.2s {S5+2.5:.2f}s ease-out 3 both')}"></div>
  <div class="bubble" style="left:{rx+8:.1f}px;top:{ry-30:.1f}px;{A(inn('popIn',S5+2.4,.6,'var(--pop)'))}">درجاتك واضحة أمامك</div>
</div>
<div class="grid2" style="top:624px">{g5}</div>
""")

# ——— 04 student services ———
items = [("calendar","جداول الاختبارات","مع عدّ تنازلي لأقرب اختبار."),("folder","نماذجي","شهاداتك ومستنداتك محفوظة لك."),
         ("bell","الإشعارات الفورية","تعاميم المدرسة ورابط كل اختبار."),("phone","ثبّتها كتطبيق","من المتصفح: «إضافة إلى الشاشة الرئيسية»."),
         ("book","دليل الاستخدام","كل خدمة مشروحة خطوة بخطوة."),("chat","الدعم الفني","للمساعدة في أي وقت.")]
g6 = "".join(card(S6+1.0+i*.45,"fadeUp",a,b,s) for i,(a,b,s) in enumerate(items))
SC6 = scene(45.75, title(S6, "وكل ما تحتاجه", "في جوالك", "phone", "خدمات الطالب", "04") + f"""
<div class="grid2" style="top:280px">{g6}</div>
{card(S6+4.0,"fadeUp","bell","فعّل الإشعارات","حتى يصلك كل تنبيه ورابط كل اختبار أولًا بأول.","position:absolute;top:690px;left:34px;right:34px;")}
""")

SC7 = M.SC7.replace('src="icon-white.png"', f'src="{LOGO}"')
HTML = f"""<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>{CSS}{LIGHT}{EXTRA}</style></head><body>
<div class="stage">
  <div class="lines"></div><div class="blob b1"></div><div class="blob b2"></div>
  <img class="ghost" src="{LOGO}" alt="">
  <div class="topbar" style="animation:fadeIn .8s 3.3s both, outFade .4s 45.9s forwards"><div class="brand"><img src="{LOGO}" alt=""><div><b>بوابة مكة الثانوية الرقمية</b><small>مدرسة مكة الثانوية</small></div></div>
    <div class="yr">١٤٤٨ – ١٤٤٩ هـ</div></div>
  {INTRO}{SC3}{SC4}{SC5}{SC6}{SC7}
  {''.join(M.wipe(w) for w in WIPES)}
  <div class="progress"><i></i></div>
</div></body></html>"""
open(os.path.join(OUT, "motion-student-tools.html"), "w", encoding="utf-8").write(HTML)
print("student ok")
