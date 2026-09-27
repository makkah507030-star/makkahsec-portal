"""Teacher tools motion video — 1080×1920 (540×960 css), ~52s, real (blurred) portal screenshots."""
import os
from build import icon, URL, FONTS, OUT, I

DUR = 52.0
PRINCIPAL = "عبدالله بن حسن سلمان الفيفي"
I.update({
 "camera": '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
 "grid": '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
 "certificate": '<path d="M6 3h12v13l-6 5-6-5zM9 8h6M9 11h6"/>',
 "pen": '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
 "book": '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5zM4 19.5A2.5 2.5 0 0 1 6.5 17H20v5H6.5A2.5 2.5 0 0 1 4 19.5z"/>',
 "key": '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
 "award": '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
 "ticket": '<path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4Z"/>',
 "chat": '<path d="M21 12a8 8 0 0 1-8 8H7l-4 3v-7a8 8 0 0 1 8-8h2a8 8 0 0 1 8 4Z"/>',
 "home": '<path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5"/>',
 "chalk": '<path d="M4 19v-3l11-11 3 3-11 11H4ZM14 6l3 3"/>',
})
ic = lambda n, s=None: icon(n, "") if s is None else icon(n, "").replace("<svg ", f'<svg width="{s}" height="{s}" ', 1)

# the scene timeline (seconds)
WIPES = [7.3, 18.8, 28.8, 38.8, 45.8]
S3, S4, S5, S6, S7 = 7.8, 19.3, 29.3, 39.3, 46.3

def A(*parts):
    return "animation:" + ", ".join(parts)
def inn(name, t, d=.75, ease="var(--out)"): return f"{name} {d}s {t:.2f}s {ease} both"
def out(name, t, d=.45): return f"{name} {d}s {t:.2f}s var(--in) forwards"

CSS = open(os.path.join(OUT, "motion.css"), encoding="utf-8").read().replace("{FONTS}", FONTS) + f"""
.lines,.b1,.b2,.ghost{{animation-duration:{DUR}s !important}}
.progress i{{animation-duration:{DUR}s !important}}
@keyframes slideL{{from{{opacity:0;transform:translateX(-80px)}}to{{opacity:1;transform:none}}}}
@keyframes scrollShot{{from{{transform:scale(1)}}to{{transform:scale(1.18)}}}}
@keyframes zoomIn{{from{{opacity:0;transform:scale(.82) translateY(30px)}}to{{opacity:1;transform:none}}}}
@keyframes shine{{from{{transform:translateX(120%) skewX(-18deg)}}to{{transform:translateX(-220%) skewX(-18deg)}}}}
@keyframes ring2{{0%{{box-shadow:0 0 0 0 rgba(137,215,173,.9)}}100%{{box-shadow:0 0 0 16px rgba(137,215,173,0)}}}}
.scene{{position:absolute;inset:0}}
.kick{{position:absolute;top:112px;right:34px;display:flex;align-items:center;gap:10px}}
.kick .no{{font-family:PlexL;font-size:14px;font-weight:700;color:var(--mint)}}
.st{{position:absolute;top:156px;right:34px;left:34px;font-size:38px;line-height:1.28;font-weight:700}}
.st .ln{{display:block;overflow:hidden;padding-bottom:3px}}.st .ln span{{display:inline-block}}
.st em{{font-style:normal;color:var(--mint)}}
.card2{{display:flex;gap:12px;align-items:flex-start;padding:13px 14px;border-radius:14px;
  background:linear-gradient(135deg,rgba(255,255,255,.085),rgba(255,255,255,.03));border:1px solid rgba(204,242,219,.14)}}
.card2 .fi{{flex:none;width:36px;height:36px;border-radius:11px;background:var(--mint);color:var(--night);display:grid;place-items:center;font-family:PlexL;font-weight:700;font-size:15px}}
.card2 .fi svg{{width:19px;height:19px;stroke-width:2}}
.card2 b{{display:block;font-size:15.5px;line-height:1.4}}.card2 span{{display:block;font-size:12.8px;line-height:1.65;color:#C9E3D3;margin-top:2px}}
.real{{position:absolute;left:8px;bottom:8px;font-size:10px;font-weight:600;background:rgba(16,33,26,.85);color:#fff;padding:3px 9px;border-radius:20px;z-index:3}}
.phoneR{{position:absolute;width:212px;height:396px;border-radius:32px;background:#0b1712;border:3px solid #3c5a4b;padding:9px;box-shadow:0 30px 70px rgba(0,0,0,.45)}}
.phoneR .scr{{position:relative;height:100%;border-radius:23px;overflow:hidden;background:#fff}}
.phoneR img{{display:block;width:100%;transform-origin:50% 35%}}
.win{{position:absolute;border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 26px 60px rgba(0,0,0,.4)}}
.win .tb{{display:flex;align-items:center;gap:5px;padding:8px 11px;background:#eef2ef;border-bottom:1px solid #dde3df}}
.win .tb i{{width:8px;height:8px;border-radius:50%;background:#c9d2cc}}.win .tb span{{margin-inline-start:auto;font-size:10.5px;color:#6b6b6b;font-family:PlexL;direction:ltr}}
.win img{{display:block;width:100%}}
.hot{{position:absolute;border:2px solid var(--mint);border-radius:6px}}
.bubble{{position:absolute;background:var(--mint);color:var(--night);font-weight:700;font-size:12px;padding:5px 11px;border-radius:20px;white-space:nowrap}}
.sheen{{position:absolute;top:0;bottom:0;width:40%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.65),transparent);z-index:2}}
.grid2{{position:absolute;left:34px;right:34px;display:grid;grid-template-columns:1fr 1fr;gap:10px}}
.grid2 .card2{{flex-direction:column;gap:8px;padding:13px}}
.close{{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}}
.close .lg{{width:112px}}
.close h2{{font-size:28px;font-weight:700;margin-top:22px}}
.close .u{{font-family:PlexL;font-size:30px;font-weight:700;color:var(--mint);margin-top:4px;direction:ltr}}
.close .sep{{width:70px;height:3px;border-radius:3px;background:var(--mint);margin:22px 0 18px}}
.close .legacy{{margin-top:26px;font-size:25px;line-height:1.45;font-weight:700}}
.close .legacy .ln{{display:block;overflow:hidden}}.close .legacy .ln span{{display:inline-block}}
.close .legacy em{{font-style:normal;color:var(--mint)}}
.close small{{font-size:14px;color:var(--light)}}
.close .pname{{font-size:24px;font-weight:700;margin-top:6px}}
"""

def title(t0, l1, l2, chip_icon, chip, no):
    return (f'<div class="kick"><span class="chip" style="{A(inn("popIn",t0,.7,"var(--pop)"))}">{ic(chip_icon)}<span>{chip}</span></span>'
            f'<span class="no" style="{A(inn("fadeIn",t0+.3,.6))}">{no}</span></div>'
            f'<div class="st"><span class="ln"><span style="{A(inn("rise",t0+.25,.85))}">{l1}</span></span>'
            f'<span class="ln"><span style="{A(inn("rise",t0+.45,.85))}"><em>{l2}</em></span></span></div>')

def card(t, anim, fi, b, s, style=""):
    fi_html = ic(fi) if fi in I else f'<span>{fi}</span>'
    return (f'<div class="card2" style="{style}{A(inn(anim,t))}"><div class="fi" style="{A(inn("popIn",t+.15,.6,"var(--pop)"))}">{fi_html}</div>'
            f'<div><b>{b}</b><span>{s}</span></div></div>')

def scene(t_out, body): return f'<section class="scene" style="{A(out("outFade", t_out, .4))}">{body}</section>'

# ——— scene 1+2: intro and hero (timings from motion.css) ———
pillars = [("camera","التصحيح الآلي"),("chart","الرصد والسجلات"),("certificate","الشهادات"),("grid","خدمات يومية")]
pill = "".join(f'<span class="chip" style="background:rgba(255,255,255,.08);color:#fff;border:1px solid rgba(204,242,219,.25);font-weight:600;font-size:14px;{A(inn("popIn",5.3+i*.28,.6,"var(--pop)"))}">{ic(a)}<span>{b}</span></span>'
               for i,(a,b) in enumerate(pillars))
INTRO = f"""
<section class="abs intro">
  <div class="logo-wrap"><div class="ring r1"></div><div class="ring r2"></div><img class="logo" src="icon-white.png" alt=""></div>
  <h2><span>بوابة مكة الثانوية الرقمية</span></h2><p>مدرسة مكة الثانوية</p><div class="bar"></div>
</section>
<section class="abs hero">
  <div class="chip">{ic('pen')}<span>للمعلم</span></div>
  <div class="h1"><span class="ln l1"><span>أدواتك كلها</span></span><span class="ln l2"><span>في مكان واحد</span></span></div>
  <div class="underline"></div>
  <p class="lead">دليل مختصر لأهم ما تقدّمه البوابة للمعلم.</p>
  <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:22px">{pill}</div>
</section>"""

# ——— scene 3: auto grading ———
steps = [(1,"أنشئ الاختبار في «اختباراتي»","اختيار متعدد، صح وخطأ، مزاوجة — تُصحَّح آليًا."),
         (2,"اطبعه في صفحة واحدة","مع بطاقة تظليل جانبية تُقرأ آليًا."),
         (3,"صوّر بطاقة كل طالب","تُقرأ الدوائر داخل جوالك دون رفع الصورة."),
         (4,"تنتقل الدرجة لكشف الرصد","وحدها، ثم الطالب التالي.")]
st_html = "".join(card(S3+1.3+i*1.55, "slideR", str(n), b, s, "margin-bottom:10px;") for i,(n,b,s) in enumerate(steps))
SC3 = scene(18.75, title(S3, "صحّح اختبارك", "في ثوانٍ", "camera", "التصحيح الآلي", "01") + f"""
<div class="phoneR" style="top:278px;left:30px;{A(inn('slideL',S3+.7,.9))}"><div class="scr">
  <img src="shots/scan.jpg" alt="" style="{A(f'scrollShot 6.5s {S3+2.6:.2f}s cubic-bezier(.45,0,.3,1) both')}"><span class="real">لقطة من البوابة</span></div></div>
<div style="position:absolute;top:278px;right:34px;width:246px">{st_html}</div>
{card(S3+8.0,"fadeUp","globe" if "globe" in I else "chart","أو أرسله اختبارًا إلكترونيًا","برابط وإشعار لطلابك، بعدّاد وقت وتصحيح فوري ومتابعة حيّة لمن سلّم.","position:absolute;top:724px;left:34px;right:34px;")}
""")

# ——— scene 4: grade sheet ———
W4 = 472
pts4 = [("chart","كشف الرصد تلقائيًا","الخانة الخضراء رُصدت من التصحيح الآلي."),
        ("chalk","سجل المتابعة الإلكتروني","الواجبات والمشاركة والتطبيقات الصفية."),
        ("home","الحضور والغياب اليومي","ويُبلَّغ ولي الأمر بالغياب تلقائيًا."),
        ("book","السجلات والتقارير","كشوف الحضور والدرجات بضغطة.")]
g4 = "".join(card(S4+3.6+i*1.2,"fadeUp",a,b,s) for i,(a,b,s) in enumerate(pts4))
# green cell in grades.jpg: x 541–597 of 851, y 193–222 of 395 ; window image top offset = tb 26px
sc = W4/851
hx, hy, hw, hh = 541*sc, 26+193*sc, 56*sc, 29*sc
SC4 = scene(28.75, title(S4, "الدرجات", "تُرصد وحدها", "chart", "الرصد والسجلات", "02") + f"""
<div class="win" style="top:282px;left:34px;width:{W4}px;{A(inn('zoomIn',S4+.7,1))}">
  <div class="tb"><i></i><i></i><i></i><span>makkahsec.com</span></div><img src="shots/grades.jpg" alt=""><span class="real">لقطة من البوابة</span>
  <div class="hot" style="left:{hx-3:.1f}px;top:{hy-3:.1f}px;width:{hw+6:.1f}px;height:{hh+6:.1f}px;{A(inn('popIn',S4+2.1,.5,'var(--pop)'), f'ring2 1.2s {S4+2.6:.2f}s ease-out 3 both')}"></div>
  <div class="bubble" style="left:{hx-150:.1f}px;top:{hy-4:.1f}px;{A(inn('popIn',S4+2.5,.6,'var(--pop)'))}">رُصدت آليًا من التصحيح</div>
</div>
<div class="grid2" style="top:552px">{g4}</div>
""")

# ——— scene 5: certificates ———
W5 = 420
pts5 = [("users","اختر الفصل والطلاب","شهادة لكل طالب برقم تسلسلي، دفعة واحدة."),
        ("key","بتوقيعك الإلكتروني","وختم المدرسة حسب النموذج."),
        ("award","خمسة قوالب للإطار","الكلاسيكي والذهبي والوسام والحديث والمزخرف."),
        ("shield","محفوظة في «نماذجي»","للرجوع إليها في أي وقت.")]
g5 = "".join(card(S5+3.2+i*1.2,"fadeUp",a,b,s) for i,(a,b,s) in enumerate(pts5))
SC5 = scene(38.75, title(S5, "شهادات طلابك", "بضغطة", "certificate", "الشهادات والنماذج", "03") + f"""
<div class="win" style="top:286px;left:{(540-W5)/2:.0f}px;width:{W5}px;{A(inn('zoomIn',S5+.7,1.1))}">
  <img src="shots/cert.jpg" alt=""><span class="real">لقطة من البوابة</span>
  <div class="sheen" style="{A(f'shine 1.4s {S5+2.0:.2f}s ease-in-out both')}"></div></div>
<div class="grid2" style="top:612px">{g5}</div>
""")

# ——— scene 6: daily services ———
items = [("grid","جدولي وحصص الانتظار","جدولك والحصص المسندة إليك."),("ticket","الاستئذان","استئذان الطلاب موثّق إلكترونيًا."),
         ("shield","إحالة طالب","أحِل الطالب للموجّه وتابع حالتها."),("chat","الإشعارات","نبّه طلابك أو أولياءهم على جوالاتهم."),
         ("calendar","جداول الاختبارات","مواعيد الاختبارات لكل الفصول."),("news","الأحداث والمناسبات","وثّق الفعاليات بتقارير مصوّرة.")]
g6 = "".join(card(S6+1.0+i*.45,"fadeUp",a,b,s) for i,(a,b,s) in enumerate(items))
SC6 = scene(45.75, title(S6, "وكل ما تحتاجه", "كل يوم", "grid", "خدمات يومية", "04") + f"""
<div class="grid2" style="top:280px">{g6}</div>
{card(S6+4.0,"fadeUp","book","كل خدمة مشروحة خطوة بخطوة","في «دليل الاستخدام» داخل البوابة، وللمساعدة «الدعم الفني».","position:absolute;top:690px;left:34px;right:34px;")}
""")

# ——— scene 7: closing with the principal ———
SC7 = f"""<section class="scene close">
<img class="lg" src="icon-white.png" alt="" style="{A(inn('logoIn',S7+.1,1.1,'var(--pop)'))}">
<h2 style="{A(inn('fadeUp',S7+.5))}">بوابة مكة الثانوية الرقمية</h2>
<div class="u" style="{A(inn('fadeUp',S7+.7))}">{URL}</div>
<div class="legacy"><span class="ln"><span style="{A(inn('rise',S7+1.2,.8))}">ستون عامًا من الريادة</span></span>
<span class="ln"><span style="{A(inn('rise',S7+1.6,.8))}"><em>تبدأ فصلًا رقميًا جديدًا</em></span></span></div>
<div class="sep" style="{A(inn('grow',S7+2.4,.8))}"></div>
<small style="{A(inn('fadeUp',S7+2.7))}">مدير المدرسة</small>
<div class="pname" style="{A(inn('fadeUp',S7+2.9))}">{PRINCIPAL}</div>
</section>"""

def wipe(t): return f'<div class="wipe" style="animation:wipe .95s {t}s cubic-bezier(.65,0,.35,1) both"></div>'

HTML = f"""<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>{CSS}</style></head><body>
<div class="stage">
  <div class="lines"></div><div class="blob b1"></div><div class="blob b2"></div>
  <img class="ghost" src="icon-white.png" alt="">
  <div class="topbar" style="animation:fadeIn .8s 3.3s both, outFade .4s 45.9s forwards"><div class="brand"><img src="icon-white.png" alt=""><div><b>بوابة مكة الثانوية الرقمية</b><small>مدرسة مكة الثانوية</small></div></div>
    <div class="yr">١٤٤٨ – ١٤٤٩ هـ</div></div>
  {INTRO}{SC3}{SC4}{SC5}{SC6}{SC7}
  {''.join(wipe(w) for w in WIPES)}
  <div class="progress"><i></i></div>
</div></body></html>"""
open(os.path.join(OUT, "motion-teacher-tools.html"), "w", encoding="utf-8").write(HTML)
print("ok")
