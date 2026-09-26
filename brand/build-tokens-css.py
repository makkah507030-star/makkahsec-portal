"""يولّد brand/tokens.css من brand/tokens.json. التشغيل: python3 brand/build-tokens-css.py

الخلفية الأولى (light، أبيض) في :root، والداكنة تُفعَّل بوضع data-theme="dark" على العنصر الجذر للتصميم.
"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
t = json.load(open(os.path.join(HERE, "tokens.json"), encoding="utf-8"))
themes = [th["id"] for th in t["color"]["themes"]]

def val(x):
    m = re.fullmatch(r"\{(.+)\}", x)
    return "var(--%s)" % m.group(1) if m else x

def esc(name):
    return name.replace(".", "\\.")

def color(tok, theme):
    v = tok["value"]
    return v if isinstance(v, str) else v.get(theme, v[themes[0]])

out = ["/* هوية بوابة مكة الثانوية الرقمية — مولَّد من brand/tokens.json، لا تعدّله يدويًا (أعد التوليد بالأمر في brand/README.md) */",
       ':root, [data-theme="%s"] {' % themes[0]]
out += ["  --%s: %s;" % (k["name"], val(color(k, themes[0]))) for k in t["color"]["tokens"]]
for fam in ("spacing", "radius", "shadow", "opacity"):
    out += ["  --%s: %s;" % (esc(k["name"]), k["value"]) for k in t[fam]["tokens"]]
out += ["  --font-%s: %s;" % (k, v) for k, v in t["type"]["families"].items()]
out.append("}")
for th in themes[1:]:
    out.append('[data-theme="%s"] {' % th)
    out += ["  --%s: %s;" % (k["name"], val(k["value"][th])) for k in t["color"]["tokens"]
            if isinstance(k["value"], dict) and th in k["value"]]
    out.append("}")
for g in t["type"]["groups"]:
    for s in g["styles"]:
        out.append(".type-%s { font-family: var(--font-sans); font-size: %s; line-height: %s; font-weight: %s; }"
                   % (s["name"], s["fontSize"], s["lineHeight"], s["fontWeight"]))
open(os.path.join(HERE, "tokens.css"), "w", encoding="utf-8").write("\n".join(out) + "\n")
print("tokens.css updated")
