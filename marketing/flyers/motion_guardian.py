"""Guardians motion video — dark theme (like the teacher video)."""
import os
import motion_teacher as M
from motion_teacher import A, inn, out, card, scene, title, ic, CSS, OUT, WIPES, S3, S4, S5, S6, S7, I

I.update({"phone": '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
          "folder": '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
          "alarm": '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="M5 3 2 6"/><path d="m22 6-3-3"/>'})

EXTRA = """
.panel{position:absolute;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 30px 70px rgba(0,0,0,.45)}
.panel img{display:block;width:100%}
"""

pillars = [("home","سجل ابنك"),("bell","التنبيهات الفورية"),("chart","درجاته ونتائجه"),("users","كل أبنائك")]
pill = "".join(f'<span class="chip" style="background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(204,242,219,.25);font-weight:600;font-size:14px;{A(inn("popIn",5.3+i*.28,.6,"var(--pop)"))}">{ic(a)}<span>{b}</span></span>'
               for i,(a,b) in enumerate(pillars))
INTRO = f"""
<section class="abs intro">
  <div class="logo-wrap"><div class="ring r1"></div><div class="ring r2"></div><img class="logo" src="icon-white.png" alt=""></div>
  <h2><span>بوابة مكة الثانوية الرقمية</span></h2><p>مدرسة مكة الثانوية</p><div class="bar"></div>
</section>
<section class="abs hero">
  <div class="chip">{ic('users')}<span>لولي الأمر</span></div>
  <div class="h1"><span class="ln l1"><span>تابع ابنك</span></span><span class="ln l2"><span>لحظة بلحظة</span></span></div>
  <div class="underline"></div>
  <p class="lead">اطمئن على حضور ابنك ومستواه من جوالك، دون انتظار مكالمة أو زيارة.</p>
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:22px">{pill}</div>
</section>"""

W = 472
def box(sc, x0, y0, x1, y1, pad=4): return (x0*sc-pad, 26+y0*sc-pad, (x1-x0)*sc+2*pad, (y1-y0)*sc+2*pad)

# ——— 01 home: child's record ———
sc3 = W / 1286; hx, hy, hw, hh = box(sc3, 4, 566, 1283, 666, 3)
pts3 = [("check","الغياب والتأخر والاستئذان","عدد الأيام لكل حالة، بنظرة واحدة."),
        ("calendar","العدّ التنازلي للاختبارات","موعد الاختبارات النهائية وكم يومًا تبقّى."),
        ("cap","النتائج الدراسية","نتائج ابنك الفصلية فور اعتمادها."),
        ("users","كل أبنائك بحساب واحد","تنتقل بينهم بضغطة واحدة.")]
g3 = "".join(card(S3+3.4+i*1.2,"fadeUp",a,b,s) for i,(a,b,s) in enumerate(pts3))
SC3 = scene(18.75, title(S3, "حضور ابنك", "كله أمامك", "home", "سجل ابنك", "01") + f"""
<div class="win" style="top:282px;left:34px;width:{W}px;{A(inn('zoomIn',S3+.7,1))}">
  <div class="tb"><i></i><i></i><i></i><span>makkahsec.com</span></div><img src="shots/g-home.jpg" alt=""><span class="real" style="left:auto;right:8px;top:34px;bottom:auto">لقطة من البوابة</span>
  <div class="hot" style="left:{hx:.1f}px;top:{hy:.1f}px;width:{hw:.1f}px;height:{hh:.1f}px;border-radius:10px;{A(inn('popIn',S3+2.0,.5,'var(--pop)'), f'ring2 1.2s {S3+2.5:.2f}s ease-out 3 both')}"></div>
  <div class="bubble" style="left:{hx+10:.1f}px;top:{hy-30:.1f}px;{A(inn('popIn',S3+2.4,.6,'var(--pop)'))}">أيام الغياب والتأخر والاستئذان</div>
</div>
<div class="grid2" style="top:586px">{g3}</div>
""")

# ——— 02 instant alerts (numbered steps) ———
PW = 236
steps = [(1,"فعّل الإشعارات","من زر «تفعيل الإشعارات» في الصفحة الرئيسية."),
         (2,"ثبّت البوابة على جوالك","من المتصفح: «إضافة إلى الشاشة الرئيسية»."),
         (3,"لو غاب ابنك","يأتيك التنبيه في نفس اليوم، لكل حصة."),
         (4,"أو تأخر صباحًا","يأتيك التنبيه بوقت بصمة دخوله.")]
col4 = "".join(card(S4+1.9+i*1.5,"slideR",str(n),b,s,"margin-bottom:10px;") for i,(n,b,s) in enumerate(steps))
SC4 = scene(28.75, title(S4, "يأتيك التنبيه", "في نفس اليوم", "bell", "التنبيهات الفورية", "02") + f"""
<div class="panel" style="top:284px;left:34px;width:{PW}px;{A(inn('zoomIn',S4+.7,1.1))}">
  <img src="shots/g-notify.jpg" alt="" style="{A(f'scrollShot 6s {S4+3.0:.2f}s cubic-bezier(.45,0,.3,1) both')};transform-origin:50% 20%"><span class="real">لقطة من البوابة</span></div>
<div style="position:absolute;top:284px;right:34px;width:{540-68-PW-14}px">{col4}</div>
""")

# ——— 03 grades ———
sc5 = W / 1347; rx, ry, rw, rh = box(sc5, 58, 98, 124, 146, 4)
pts5 = [("chart","درجات اختباراته القصيرة","درجة كل اختبار أولًا بأول."),
        ("cap","ونتائجه الفصلية","بتفاصيل المواد فور اعتمادها."),
        ("calendar","جداول الاختبارات","مواعيد اختباراته مع العدّ التنازلي."),
        ("folder","الإحالات والمستندات","ما يصدر بشأن ابنك يُحفظ في «نماذجي».")]
g5 = "".join(card(S5+3.0+i*1.2,"fadeUp",a,b,s) for i,(a,b,s) in enumerate(pts5))
SC5 = scene(38.75, title(S5, "مستوى ابنك", "أولًا بأول", "chart", "درجاته ونتائجه", "03") + f"""
<div class="win" style="top:300px;left:34px;width:{W}px;{A(inn('zoomIn',S5+.7,1))}">
  <div class="tb"><i></i><i></i><i></i><span>makkahsec.com</span></div><img src="shots/g-results.jpg" alt="">
  <div class="hot" style="left:{rx:.1f}px;top:{ry:.1f}px;width:{rw:.1f}px;height:{rh:.1f}px;border-radius:8px;{A(inn('popIn',S5+1.9,.5,'var(--pop)'), f'ring2 1.2s {S5+2.4:.2f}s ease-out 3 both')}"></div>
</div>
<div class="bubble" style="top:{300+26+68+14}px;left:44px;{A(inn('popIn',S5+2.3,.6,'var(--pop)'))}">درجات اختباراته القصيرة</div>
<span class="real" style="position:absolute;top:{300+26+68+18}px;right:34px;left:auto;bottom:auto;{A(inn('fadeIn',S5+1.2,.5))}">لقطة من البوابة</span>
<div class="grid2" style="top:470px">{g5}</div>
""")

# ——— 04 guardian services ———
items = [("calendar","جداول الاختبارات","مع عدّ تنازلي لأقرب اختبار."),("folder","نماذجي","الإحالات والمستندات مع تأكيد الاستلام."),
         ("bell","الإشعارات والتعاميم","كل ما يخص ابنك يصلك مباشرة."),("users","كل أبنائك","بحساب واحد وتنقّل بضغطة."),
         ("book","دليل الاستخدام","كل خدمة مشروحة خطوة بخطوة."),("chat","الدعم الفني","للمساعدة في أي وقت.")]
g6 = "".join(card(S6+1.0+i*.45,"fadeUp",a,b,s) for i,(a,b,s) in enumerate(items))
SC6 = scene(45.75, title(S6, "وكل ما يخص ابنك", "في مكان واحد", "users", "خدمات ولي الأمر", "04") + f"""
<div class="grid2" style="top:280px">{g6}</div>
{card(S6+4.0,"fadeUp","phone","ثبّتها وفعّل الإشعارات","حتى لا يفوتك أي تنبيه عن ابنك.","position:absolute;top:690px;left:34px;right:34px;")}
""")

HTML = f"""<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>{CSS}{EXTRA}</style></head><body>
<div class="stage">
  <div class="lines"></div><div class="blob b1"></div><div class="blob b2"></div>
  <img class="ghost" src="icon-white.png" alt="">
  <div class="topbar" style="animation:fadeIn .8s 3.3s both, outFade .4s 45.9s forwards"><div class="brand"><img src="icon-white.png" alt=""><div><b>بوابة مكة الثانوية الرقمية</b><small>مدرسة مكة الثانوية</small></div></div>
    <div class="yr">١٤٤٨ – ١٤٤٩ هـ</div></div>
  {INTRO}{SC3}{SC4}{SC5}{SC6}{M.SC7}
  {''.join(M.wipe(w) for w in WIPES)}
  <div class="progress"><i></i></div>
</div></body></html>"""
open(os.path.join(OUT, "motion-guardian-tools.html"), "w", encoding="utf-8").write(HTML)
print("guardian ok")
