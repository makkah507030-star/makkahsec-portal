# مؤثرات صوتية لفيديو «ملف المعلم الرقمي» بلا موسيقى، مولَّدة رياضيًا (لا ملفات خارجية ولا حقوق).
# الأوقات مطابقة لحركات video.html. الاستعمال: python3 sfx.py <ملف-الإخراج.wav>
import sys, wave
import numpy as np

SR, DUR = 48000, 45.0
rng = np.random.default_rng(7)          # بذرة ثابتة: كل توليد يطابق السابق
out = np.zeros(int(SR * DUR))

def t(d): return np.arange(int(SR * d)) / SR

def env(n, a=.005, r=.2):              # صعود سريع ثم خفوت أُسّي
    x = np.arange(n) / SR
    e = np.minimum(1, x / max(a, 1e-4)) * np.exp(-x / max(r, 1e-4))
    return e

def lowpass(x, fc):                    # مرشح أحادي القطب، يكفي لتنعيم الضجيج
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); s = 0.0
    for i, v in enumerate(x):
        s = (1 - a) * v + a * s; y[i] = s
    return y

def add(at, sig, gain=1.0):
    i = int(at * SR); j = min(len(out), i + len(sig))
    out[i:j] += sig[: j - i] * gain

def tone(f, d, r=.25, a=.004, harm=(1, .3, .1)):
    x = t(d)
    s = sum(h * np.sin(2 * np.pi * f * (k + 1) * x) for k, h in enumerate(harm))
    return s * env(len(x), a, r)

def whoosh(d=.7, f0=300, f1=3200, rise=True):
    n = int(SR * d); x = rng.standard_normal(n)
    fc = np.linspace(f0, f1, n) if rise else np.linspace(f1, f0, n)
    y = np.empty(n); s = 0.0
    for i in range(n):                 # ضجيج بمرشح يتحرك ترددُه = صوت «ووش»
        a = np.exp(-2 * np.pi * fc[i] / SR); s = (1 - a) * x[i] + a * s; y[i] = s
    shape = np.sin(np.linspace(0, np.pi, n)) ** 1.6
    return y * shape * 2.2

def click(f=2400, d=.03): return tone(f, d, r=.008, a=.0005, harm=(1,))
def pop(f=520):
    x = t(.12); fr = f * (1 + 1.4 * np.exp(-x * 40))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * env(len(x), .002, .05)
def chime(fs, gap=.07, r=.6):
    sig = np.zeros(int(SR * (gap * len(fs) + r * 3)))
    for k, f in enumerate(fs):
        s = tone(f, r * 3, r=r, harm=(1, .25, .08)); i = int(k * gap * SR); sig[i:i + len(s)] += s
    return sig
def buzz(d=.18):
    x = t(d); return np.sign(np.sin(2 * np.pi * 150 * x)) * .3 * lowpass(np.ones(len(x)), 40)[::-1] * env(len(x), .01, d)

# الأوقات مطابقة لتوقيت video.html بعد مواءمته مع التعليق الصوتي (يبدأ عند 0.6 ث)
# 1) الإشعار: انزلاق، ورنّة، واهتزاز ثلاث نبضات، ثم إبراز «أداة الملاحظة الصفية»
add(.8, whoosh(.5, 600, 2600), .35)
add(1.05, chime([1318.5, 1760], gap=.11, r=.35), .5)
for k in range(3): add(1.5 + k * .22, lowpass(buzz(.16), 900), .55)
add(6.6, whoosh(.6, 1200, 5000), .18)

# الانتقالات بين المشاهد
for T in [10.6, 14.4, 20.2, 30.1, 33.8, 36.8]: add(T - .4, whoosh(.8, 200, 2400), .38)

# 2) الكلمات والخط والأيقونات
for k in range(3): add(10.8 + k * .22, click(2200), .4)
for k in range(5): add(12.5 + k * .18, click(2600), .4)
add(13.3, whoosh(.4, 1500, 6000), .2)
for k in range(3): add(13.4 + k * .18, pop(560 + k * 90), .45)

# 3) الشعار: ارتداد ولمعة
add(14.5, pop(300), .6)
add(14.8, chime([1046.5, 1568, 2093], gap=.06, r=.5), .3)
add(14.7, whoosh(.7, 800, 4500), .22)
add(18.9, chime([2637, 3136], gap=.08, r=.3), .18)

# 4) الجوال والشارات والعدّادات والوسوم
add(20.4, whoosh(.9, 150, 1800), .32)
for k, s0 in enumerate([22.0, 25.4, 27.2]):
    add(s0, pop(480 + k * 60), .5)
    for j in range(10): add(s0 + .2 + j * .1, click(3200 - j * 60, .02), .22)   # تكتكة العدّاد
for k, s0 in enumerate([22.6, 25.3, 27.7, 28.6]): add(s0, pop(620 + k * 40), .4)

# 5) لوحة المعلم وعلامات الصح
add(30.2, whoosh(.8, 150, 1800), .32)
for s0 in [30.6, 32.1, 33.0]: add(s0, chime([1568, 2093], gap=.05, r=.18), .35)

# 6) البطاقة: انقلاب، ومسح، ونجاح
add(33.9, whoosh(.8, 400, 3000, rise=False), .45)
for k in range(5): add(34.9 + k * .24, tone(1900, .06, r=.03, harm=(1,)), .16)
add(36.0, chime([1046.5, 1318.5, 1568, 2093], gap=.07, r=.45), .45)

# 7) الدعوة: كلمات، وزر، وقصاصات، ونبضتان
for k in range(3): add(37.0 + k * .2, click(2400), .4)
add(38.4, pop(260), .7)
burst = rng.standard_normal(int(SR * 1.2)) * env(int(SR * 1.2), .002, .25)
add(38.5, lowpass(burst, 6000) * 1.5, .25)
for k in range(14): add(38.55 + k * .07, tone(2400 + (k * 373) % 1800, .08, r=.04, harm=(1,)), .06)
for T in [42.4, 43.2]: add(T, tone(196, .5, r=.25, harm=(1, .5)), .25)
add(43.8, chime([784, 1046.5, 1318.5, 1568], gap=.09, r=.7), .35)

# تطبيع لطيف وحماية من التشبع
peak = np.max(np.abs(out)) or 1
out = np.tanh(out / peak * 1.4) * .85
fade = int(SR * .4); out[-fade:] *= np.linspace(1, 0, fade)
pcm = (out * 32767).astype(np.int16)
stereo = np.repeat(pcm[:, None], 2, axis=1)
with wave.open(sys.argv[1] if len(sys.argv) > 1 else "sfx.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(stereo.tobytes())
print("ok")
