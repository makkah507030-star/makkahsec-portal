"""School administration motion video — white theme, same structure as the teacher video."""
import os
import motion_teacher as M
from motion_teacher import A, inn, out, card, scene, title, ic, CSS, PRINCIPAL, URL, OUT, DUR, WIPES, S3, S4, S5, S6, S7, I

I.update({
 "dashboard": '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
 "file": '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/>',
 "exit": '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
 "buoy": '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 9.17 4.24-4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m9.17 14.83-4.24 4.24"/>',
 "image": '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
})

# ——— white theme: same layout, brand light colours (promo light values) ———
LIGHT = """
.stage{background:radial-gradient(130% 70% at 100% 0%,#EDFAF2 0,transparent 60%),linear-gradient(170deg,#FFFFFF 0%,#F4FBF7 100%) !important;color:var(--ink,#101010)}
body{color:#101010}
.lines{background:repeating-linear-gradient(135deg,rgba(62,99,80,.05) 0 1px,transparent 1px 22px) !important}
.b1{background:rgba(137,215,173,.28) !important}.b2{background:rgba(204,242,219,.7) !important}
.ghost{opacity:.07 !important}
.topbar .brand b{color:#101010}.topbar .brand small{color:#6B6B6B}
.yr{color:#3E6350 !important;border-color:rgba(62,99,80,.3) !important}
.intro h2{color:#101010}.intro p{color:#6B6B6B !important}.intro .bar{background:#3E6350 !important}
.ring{border-color:#3E6350 !important}
.chip{background:#3E6350 !important;color:#fff !important}
.h1{color:#101010}.h1 .l2 span{color:#3E6350 !important}.underline{background:#89D7AD !important}
.lead{color:#5b6b64 !important}
.hero .pill{background:#fff !important;color:#101010 !important;border:1px solid #CCF2DB !important}
.kick .no{color:#3E6350 !important}
.st{color:#101010}.st em{color:#3E6350 !important}
.card2{background:#fff !important;border:1px solid #CCF2DB !important;box-shadow:0 1px 2px rgba(0,0,0,.04),0 10px 26px -18px rgba(31,58,46,.35)}
.card2 b{color:#101010}.card2 span{color:#6B6B6B !important}
.card2 .fi{background:#EDFAF2 !important;color:#3E6350 !important;border:1px solid #CCF2DB}
.win{box-shadow:0 26px 60px -20px rgba(31,58,46,.45) !important;border:1px solid #DCE7E0}
.paper{position:absolute;background:#fff;border:1px solid #DCE7E0;border-radius:6px;overflow:hidden;box-shadow:0 26px 60px -20px rgba(31,58,46,.45)}
.paper img{display:block;width:100%}
.bubble{background:#3E6350 !important;color:#fff !important}
.hot{border-color:#3E6350 !important}
@keyframes ring2{0%{box-shadow:0 0 0 0 rgba(62,99,80,.55)}100%{box-shadow:0 0 0 16px rgba(62,99,80,0)}}
.close h2{color:#101010}.close .u{color:#3E6350 !important}.close .sep{background:#89D7AD !important}
.close small{color:#6B6B6B !important}.close .legacy{color:#101010}.close .legacy em{color:#3E6350 !important}.close .pname{color:#101010}
.progress{background:rgba(62,99,80,.1) !important}.progress i{background:#3E6350 !important}
.toast2{position:absolute;display:flex;gap:10px;align-items:flex-start;background:#fff;border-radius:16px;padding:11px 13px;box-shadow:0 18px 40px -10px rgba(16,33,26,.35);border:1px solid #DCE7E0;color:#101010}
.toast2 .ti{flex:none;width:34px;height:34px;border-radius:10px;background:#3E6350;color:#fff;display:grid;place-items:center}
.toast2 .ti svg{width:18px;height:18px;stroke-width:2}
.toast2 b{display:block;font-size:13px;color:#3E6350}.toast2 span{display:block;font-size:12.5px;line-height:1.55}
.toast2 em{position:absolute;left:12px;top:10px;font-style:normal;font-size:10px;color:#8A968F}
"""

LOGO = "icon-mint.png"

# ——— hero ———
pillars = [("dashboard","لوحة المؤشرات"),("megaphone","الإشعارات والتعاميم"),("file","التقارير"),("grid","خدمات الإدارة")]
pill = "".join(f'<span class="chip pill" style="font-weight:600;font-size:14px;{A(inn("popIn",5.3+i*.28,.6,"var(--pop)"))}">{ic(a)}<span>{b}</span></span>'
               for i,(a,b) in enumerate(pillars))
INTRO = f"""
<section class="abs intro">
  <div class="logo-wrap"><div class="ring r1"></div><div class="ring r2"></div><img class="logo" src="{LOGO}" alt=""></div>
  <h2><span>بوابة مكة الثانوية الرقمية</span></h2><p>مدرسة مكة الثانوية</p><div class="bar"></div>
</section>
<section class="abs hero">
  <div class="chip">{ic('dashboard')}<span>للإدارة المدرسية</span></div>
  <div class="h1"><span class="ln l1"><span>إدارة المدرسة</span></span><span class="ln l2"><span>من شاشة واحدة</span></span></div>
  <div class="underline"></div>
  <p class="lead">صورة لحظية عن الحضور والانضباط، وأدوات تواصل وتقارير تختصر العمل الورقي.</p>
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:22px">{pill}</div>
</section>"""

# ——— scene 3: dashboard ———
W = 472; sc = W / 1040
def box(x0, y0, x1, y1, pad=4): return (x0*sc-pad, 26+y0*sc-pad, (x1-x0)*sc+2*pad, (y1-y0)*sc+2*pad)
hx, hy, hw, hh = box(22, 607, 112, 657)
pts3 = [("clock","التأخر الصباحي","المتأخرون اليوم بوقت بصمة دخولهم."),
        ("check","التحضير اليومي","نسبة تحضير الحصص لحظة بلحظة."),
        ("users","المناوبات","من يناوب اليوم، وموعد مناوبتك القادمة."),
        ("calendar","العدّ التنازلي للاختبارات","موعد الاختبارات النهائية وكم يومًا تبقّى.")]
g3 = "".join(card(S3+3.4+i*1.2,"fadeUp",a,b,s) for i,(a,b,s) in enumerate(pts3))
SC3 = scene(18.75, title(S3, "صورة لحظية", "أولًا بأول", "dashboard", "لوحة المؤشرات", "01") + f"""
<div class="win" style="top:282px;left:34px;width:{W}px;{A(inn('zoomIn',S3+.7,1))}">
  <div class="tb"><i></i><i></i><i></i><span>makkahsec.com</span></div><img src="shots/admin-dash-main.jpg" alt=""><span class="real" style="left:auto;right:8px;top:34px;bottom:auto">لقطة من البوابة</span>
  <div class="hot" style="left:{hx:.1f}px;top:{hy:.1f}px;width:{hw:.1f}px;height:{hh:.1f}px;{A(inn('popIn',S3+2.0,.5,'var(--pop)'), f'ring2 1.2s {S3+2.5:.2f}s ease-out 3 both')}"></div>
  <div class="bubble" style="left:{hx+hw+8:.1f}px;top:{hy-2:.1f}px;{A(inn('popIn',S3+2.4,.6,'var(--pop)'))}">نسبة تحضير الحصص الآن</div>
</div>
<div class="grid2" style="top:648px">{g3}</div>
""")

# ——— scene 4: notifications (numbered steps) ———
steps = [(1,"اكتب العنوان","مثل: اجتماع المعلمين غدًا."),
         (2,"اختر النوع","تعميم أو تنبيه."),
         (3,"أرفق صورة التعميم","تصل مع الإشعار."),
         (4,"حدّد المستلمين","ليصل على جوالاتهم فورًا.")]
g4 = "".join(card(S4+1.9+i*1.45,"fadeUp",str(n),b,s) for i,(n,b,s) in enumerate(steps))
SC4 = scene(28.75, title(S4, "تعميمك يصل", "فورًا", "megaphone", "الإشعارات والتعاميم", "02") + f"""
<div class="win" style="top:282px;left:34px;width:{W}px;{A(inn('zoomIn',S4+.7,1))}">
  <div class="tb"><i></i><i></i><i></i><span>makkahsec.com</span></div><img src="shots/admin-notify.jpg" alt=""><span class="real">لقطة من البوابة</span></div>
<div class="toast2" style="top:500px;left:60px;right:60px;{A(inn('toast',S4+7.8,.8,'var(--pop)'))}"><div class="ti">{ic('bell')}</div>
  <div><b>تعميم</b><span>اجتماع المعلمين غدًا بعد الحصة السادسة.</span></div><em>الآن</em></div>
<div class="grid2" style="top:590px">{g4}</div>
""")

# ——— scene 5: official reports ———
PW = 232
pts5 = [("home","الحضور والغياب","لكل حصة ولكل يوم، وللمعلمين والطلاب."),
        ("clock","الانتظار والمناوبة","من غطّى الحصة ومن ناوب."),
        ("exit","الاستئذان","طلبات خروج الطلاب موثّقة ومحفوظة."),
        ("news","الفعاليات","بتقارير مصوّرة بالهوية الرسمية.")]
col5 = "".join(card(S5+2.4+i*1.25,"slideR",a,b,s,"margin-bottom:10px;") for i,(a,b,s) in enumerate(pts5))
SC5 = scene(38.75, title(S5, "تقارير رسمية", "بضغطة واحدة", "file", "التقارير الجاهزة", "03") + f"""
<div class="paper" style="top:284px;left:34px;width:{PW}px;{A(inn('zoomIn',S5+.7,1.1))}">
  <img src="shots/admin-report.jpg" alt=""><span class="real">لقطة من البوابة</span>
  <div class="sheen" style="{A(f'shine 1.4s {S5+1.9:.2f}s ease-in-out both')}"></div></div>
<div style="position:absolute;top:284px;right:34px;width:{540-68-PW-14}px">{col5}</div>
{card(S5+7.6,"fadeUp","shield","بقالب رسمي","شعار الوزارة والمدرسة وتوقيع المسؤولين، جاهز للطباعة.","position:absolute;top:684px;left:34px;right:34px;")}
""")

# ——— scene 6: admin services ———
items = [("calendar","الجداول والانتظار","الجدول العام وجداول المعلمين والطلاب."),("exit","الاستئذان","خروج الطلاب موثّق إلكترونيًا."),
         ("cap","النتائج وجداول الاختبارات","ينشرها للطالب وولي أمره."),("certificate","النماذج والإحالات","بالتوقيع الإلكتروني، ومتابعة الإحالات."),
         ("news","الأخبار والأحداث","انشر أخبار المدرسة وفعالياتها."),("buoy","الدعم الفني","بلاغات ومتابعة ومؤشرات للموقع.")]
g6 = "".join(card(S6+1.0+i*.45,"fadeUp",a,b,s) for i,(a,b,s) in enumerate(items))
SC6 = scene(45.75, title(S6, "وخدمات الإدارة", "كلها هنا", "grid", "خدمات الإدارة", "04") + f"""
<div class="grid2" style="top:280px">{g6}</div>
{card(S6+4.0,"fadeUp","lock","كل موظف يطّلع على خدماته","الخدمات الخاصة به تظهر حسب صلاحيته.","position:absolute;top:690px;left:34px;right:34px;")}
""")

SC7 = M.SC7.replace('src="icon-white.png"', f'src="{LOGO}"')

HTML = f"""<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>{CSS}{LIGHT}</style></head><body>
<div class="stage">
  <div class="lines"></div><div class="blob b1"></div><div class="blob b2"></div>
  <img class="ghost" src="{LOGO}" alt="">
  <div class="topbar" style="animation:fadeIn .8s 3.3s both, outFade .4s 45.9s forwards"><div class="brand"><img src="{LOGO}" alt=""><div><b>بوابة مكة الثانوية الرقمية</b><small>مدرسة مكة الثانوية</small></div></div>
    <div class="yr">١٤٤٨ – ١٤٤٩ هـ</div></div>
  {INTRO}{SC3}{SC4}{SC5}{SC6}{SC7}
  {''.join(M.wipe(w) for w in WIPES)}
  <div class="progress"><i></i></div>
</div></body></html>"""
open(os.path.join(OUT, "motion-admin-tools.html"), "w", encoding="utf-8").write(HTML)
print("admin ok")
