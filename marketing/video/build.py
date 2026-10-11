#!/usr/bin/env python3
"""تجميع الفيديو المحدَّث لخدمات البوابة (1920×1080، 30 إطارًا).

  in/src.mov      الفيديو الأول (120 ث) — لا يُرفع للمستودع
  vo/*.mp3        التسجيلات الجديدة بأسماء VOICEOVER-update.txt (اختياري: بدونها تُستعمل أطوال تقديرية وصمت)
  out/            المشاهد والفيديو النهائي makkahsec-portal-2026.mp4

الترتيب: المقدمة (جديدة بعنوان «ماذا لو اجتمعت في مكان واحد؟» وبأصوات الأصل) ← الفيديو الأول حتى نهاية 06 ← الاستخدام الفعلي (جديد) ← 07 التقويم المدرسي (الأصل)
         ← 08 الجديد في البوابة ← 09 إنجازات المدرسة ← الخاتمة (الأصل).
نقاط القطع على لحظات الخلفية الفارغة بين المشاهد، والصوت يُقطع في الصمت قبل أول كلمة
(الصوت في الأصل يسبق ظهور المشهد بنحو نصف ثانية، فيُمسك أول إطار فارغ حتى يلحق).
"""
import json, os, subprocess, sys

FPS, XF = 30, 0.35
LEAD, GAP = 0.7, 0.55                 # نفس قيم scenes.html
SRC = "in/src.mov"
DEF = {"intro": [], "usage": [8.5], "new": [3.6, 6.2, 9.6, 6.4, 6.4, 8.8], "ach": [2.6, 9.4, 6.4, 6.0, 6.8]}
VO = {"intro": [], "usage": ["usage-1"], "new": [f"new-{i}" for i in range(6)], "ach": [f"ach-{i}" for i in range(5)]}

def run(*a):
    subprocess.run(a, check=True)

def dur(f):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f],
                       capture_output=True, text=True, check=True)
    return float(r.stdout.strip())

os.makedirs("out", exist_ok=True)

# 1) المشاهد الجديدة بأطوال الصوت الفعلية
scenes = {}
for s in ("intro", "usage", "new", "ach"):
    files = [f"vo/{n}.mp3" for n in VO[s]]
    have = bool(files) and all(os.path.exists(f) for f in files)
    d = [round(dur(f), 2) for f in files] if have else DEF[s]
    starts, t = [], LEAD
    for x in d:
        starts.append(t); t += x + GAP
    scenes[s] = {"files": files if have else [], "starts": starts}
    if "--skip-render" not in sys.argv:
        run("node", "rec.mjs", s, f"out/{s}.mp4", ",".join(map(str, d)) or "0")
    print(s, "صوت" if have else "تقديري", d)

# 2) المقاطع: (فيديو: ملف، من، إلى، إمساك أول إطار) (صوت: من، إلى) أو صوت جديد
# xf: طول الانتقال قبل المقطع (0 = قطع مباشر؛ المقدمة تنتهي بإطار الأصل 7.6 نفسه)
segs = [
    {"v": ("out/intro.mp4", None, None, 0), "a": (0.0, 7.60)},
    {"v": (SRC, 7.60, 79.30, 0),      "a": (7.60, 79.30), "xf": 0},
    {"v": ("out/usage.mp4", None, None, 0), "scene": "usage"},
    {"v": (SRC, 93.25, 104.90, 0.55), "a": (92.70, 104.90)},
    {"v": ("out/new.mp4", None, None, 0),   "scene": "new"},
    {"v": ("out/ach.mp4", None, None, 0),   "scene": "ach"},
    {"v": (SRC, 105.20, 120.0, 0.30), "a": (104.90, 120.0)},
]

inputs, fc, alabels = [], [], []
def inp(f):
    if f not in inputs: inputs.append(f)
    return inputs.index(f)

offs, lens, t = [], [], 0.0
for i, g in enumerate(segs):
    f, a, b, hold = g["v"]
    k = inp(f)
    if a is None:
        L = dur(f); chain = f"[{k}:v]setpts=PTS-STARTPTS"
    else:
        L = (b - a) + hold
        # الأصل: نغطي شريط التقدم القديم (آخر 6 بكسل) بالصفوف التي فوقه
        chain = (f"[{k}:v]trim={a}:{b},setpts=PTS-STARTPTS,tpad=start_duration={hold}:start_mode=clone,"
                 f"split[s{i}a][s{i}b];[s{i}b]crop=1920:6:0:1068[s{i}c];[s{i}a][s{i}c]overlay=0:1074")
    fc.append(f"{chain},fps={FPS},format=yuv420p,settb=AVTB[v{i}]")
    if i: t -= g.get("xf", XF)
    offs.append(t); lens.append(L); t += L
TOTAL = offs[-1] + lens[-1]

# انتقالات ناعمة بين المقاطع
cur = "v0"
for i in range(1, len(segs)):
    xf = segs[i].get("xf", XF)
    fc.append(f"[{cur}][v{i}]xfade=transition=fade:duration={xf}:offset={offs[i]:.3f}[x{i}]" if xf
              else f"[{cur}][v{i}]concat=n=2:v=1:a=0[x{i}]")
    cur = f"x{i}"
# شريط التقدم الجديد (يمتد من اليمين كالأصل)
fc.append(f"color=c=0x89D7AD:s=1920x6:r={FPS}[bar]")
fc.append(f"[{cur}][bar]overlay=x='W-W*t/{TOTAL:.3f}':y=1074:shortest=1:eval=frame[vout]")

# الصوت: كل مقطع في موضعه من الزمن النهائي
n = 0
for i, g in enumerate(segs):
    if "a" in g:
        a, b = g["a"]; k = inp(SRC)
        fc.append(f"[{k}:a]atrim={a}:{b},asetpts=PTS-STARTPTS,afade=t=in:d=0.03,afade=t=out:st={b - a - 0.05:.3f}:d=0.05,"
                  f"adelay={int(offs[i] * 1000)}:all=1[a{n}]")
        alabels.append(f"[a{n}]"); n += 1
    else:
        sc = scenes[g["scene"]]
        for f, st in zip(sc["files"], sc["starts"]):
            k = inp(f)
            fc.append(f"[{k}:a]aresample=48000,aformat=channel_layouts=stereo,adelay={int((offs[i] + st) * 1000)}:all=1[a{n}]")
            alabels.append(f"[a{n}]"); n += 1
fc.append(f"{''.join(alabels)}amix=inputs={n}:normalize=0:duration=longest,atrim=0:{TOTAL:.3f}[aout]")

cmd = ["ffmpeg", "-y", "-loglevel", "error"]
for f in inputs: cmd += ["-i", f]
cmd += ["-filter_complex", ";".join(fc), "-map", "[vout]", "-map", "[aout]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", f"{TOTAL:.3f}", "out/makkahsec-portal-2026.mp4"]
run(*cmd)
json.dump({"total": round(TOTAL, 2), "offsets": [round(x, 2) for x in offs]}, open("out/timeline.json", "w"))
print("الطول النهائي", round(TOTAL, 1), "ث · بدايات المقاطع", [round(x, 1) for x in offs])
