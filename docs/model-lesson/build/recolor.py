# يلوّن «الحصة النموذجية» بأحد ألوان ملف المعلم الرقمي (COLORS في src/lib/dfile.js).
#   python3 recolor.py <الملف الأخضر.pptx> <المجلد> [مفتاح اللون…]
# الأخضر هو الأصل؛ وكل لون من عائلة الأخضر في الشرائح والقالب والصور (الخلفيات والشعار والرموز)
# يُنقل إلى عائلة اللون المختار، فتبقى درجاته (داكن ومتوسط وفاتح) كما هي. والذهبي والأحمر
# والأبيض والرمادي المحايد لا تتغير.
import colorsys, io, os, re, sys, zipfile

import numpy as np
from PIL import Image

# درجات كل لون كما في dfile.css: داكن (s-a)، ومتوسط (s-b)، وفاتح (s-c)
PALETTES = {
    "science": ("أخضر",       "2F4F40", "3E6350", "89D7AD"),
    "math":    ("أزرق",       "2A5A8A", "3A78B5", "A4CBF2"),
    "islamic": ("أزرق-مخضر",  "1F4F4C", "2F7F7A", "87D3CC"),
    "english": ("بنفسجي",     "3B3566", "5A5199", "B2A9F0"),
    "navy":    ("كحلي",       "121A33", "22305A", "A3B3E0"),
    "arabic":  ("أحمر",       "5A2E2E", "8A4343", "E3A7A0"),
    "social":  ("ذهبي",       "5C4417", "8C6A22", "E6C27A"),
    "slate":   ("رمادي",      "2B343D", "4A5866", "A9BACB"),
}
BASE = PALETTES["science"]
KEEP = {"2E7D52"}  # أخضر «إجابة صحيحة» ومؤشر «فهمت» يبقى أخضر في كل الألوان (OK في build.py)


def hls(hx):
    r, g, b = (int(hx[i:i + 2], 16) / 255 for i in (0, 2, 4))
    return colorsys.rgb_to_hls(r, g, b)


class Mapper:
    """تحويل عائلة الأخضر إلى عائلة اللون الهدف: الإضاءة والتشبع يُطابقان الدرجات الثلاث
    (داكن، متوسط، فاتح) ويُستكملان خطيًا بينها، والصبغة تُزاح بفرق صبغة الدرجة المتوسطة."""

    def __init__(self, key):
        b = [hls(x) for x in BASE[1:]]
        t = [hls(x) for x in PALETTES[key][1:]]
        self.dh = t[1][0] - b[1][0]
        self.lx = [0.0] + [x[1] for x in b] + [1.0]
        self.ly = [0.0] + [x[1] for x in t] + [1.0]
        rs = [tt[2] / max(bb[2], 1e-6) for bb, tt in zip(b, t)]
        self.sy = [rs[0]] + rs + [rs[2]]

    @staticmethod
    def family(h, s):
        # الأخضر والأخضر المزرق (الصبغة 90°–185°) غير المحايد
        return (h >= 0.25) & (h <= 0.515) & (s >= 0.06)

    def map(self, h, l, s):
        nl = np.interp(l, self.lx, self.ly)
        ns = np.clip(s * np.interp(l, self.lx, self.sy), 0, 1)
        nh = (h + self.dh) % 1.0
        return nh, nl, ns

    def hex(self, hx):
        if hx in KEEP:
            return hx
        h, l, s = hls(hx)
        if not self.family(np.array(h), np.array(s)):
            return hx
        nh, nl, ns = self.map(h, l, s)
        r, g, b = colorsys.hls_to_rgb(float(nh), float(nl), float(ns))
        return "".join(f"{round(c * 255):02X}" for c in (r, g, b))

    def image(self, data, fmt):
        im = Image.open(io.BytesIO(data))
        mode = im.mode
        rgba = np.asarray(im.convert("RGBA")).astype(np.float64) / 255
        rgb, a = rgba[..., :3], rgba[..., 3:]
        mx, mn = rgb.max(-1), rgb.min(-1)
        l = (mx + mn) / 2
        d = mx - mn
        s = np.where(d == 0, 0, d / np.where(l < 0.5, mx + mn, 2 - mx - mn + 1e-12))
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        dd = np.where(d == 0, 1, d)
        h = np.where(mx == r, ((g - b) / dd) % 6, np.where(mx == g, (b - r) / dd + 2, (r - g) / dd + 4)) / 6
        h = np.where(d == 0, 0, h)
        fam = self.family(h, s)
        nh, nl, ns = self.map(h, l, s)
        # من HLS إلى RGB للبكسلات المحوَّلة
        q = np.where(nl < 0.5, nl * (1 + ns), nl + ns - nl * ns)
        p = 2 * nl - q

        def ch(t):
            t = t % 1.0
            return np.where(t < 1 / 6, p + (q - p) * 6 * t, np.where(t < 0.5, q, np.where(t < 2 / 3, p + (q - p) * (2 / 3 - t) * 6, p)))
        out = np.stack([ch(nh + 1 / 3), ch(nh), ch(nh - 1 / 3)], -1)
        rgb2 = np.where(fam[..., None], out, rgb)
        res = Image.fromarray(np.clip(np.concatenate([rgb2, a], -1) * 255 + 0.5, 0, 255).astype(np.uint8), "RGBA")
        buf = io.BytesIO()
        if fmt == "JPEG":
            res.convert("RGB").save(buf, "JPEG", quality=92)
        else:
            res.save(buf, "PNG", optimize=True)
        return buf.getvalue()


def recolor(src, out, key):
    m = Mapper(key)
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zout:
        for it in zin.infolist():
            data = zin.read(it.filename)
            name = it.filename.lower()
            if name.endswith(".xml") or name.endswith(".rels"):
                txt = data.decode("utf-8")
                txt = re.sub(r'((?:srgbClr val|color|lastClr)=")([0-9A-Fa-f]{6})(")',
                             lambda x: x.group(1) + m.hex(x.group(2).upper()) + x.group(3), txt)
                data = txt.encode("utf-8")
            elif name.startswith("ppt/media/") and name.endswith((".png", ".jpg", ".jpeg")):
                data = m.image(data, "JPEG" if name.endswith((".jpg", ".jpeg")) else "PNG")
            zout.writestr(it, data)


if __name__ == "__main__":
    src, outdir, *keys = sys.argv[1:]
    os.makedirs(outdir, exist_ok=True)
    for k in keys or [k for k in PALETTES if k != "science"]:
        dst = os.path.join(outdir, f"model-lesson-{k}.pptx")
        recolor(src, dst, k)
        print(PALETTES[k][0], "→", dst)
