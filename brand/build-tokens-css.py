"""يولّد brand/tokens.css من brand/tokens.json. التشغيل: python3 brand/build-tokens-css.py"""
import json, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
t = json.load(open(os.path.join(HERE, "tokens.json"), encoding="utf-8"))

def val(x):
    m = re.fullmatch(r"\{(.+)\}", x)
    return "var(--%s)" % m.group(1) if m else x

def esc(name):
    return name.replace(".", "\\.")

out = ["/* هوية بوابة مكة الثانوية الرقمية — مولَّد من brand/tokens.json، لا تعدّله يدويًا (أعد التوليد بالأمر في brand/README.md) */", ":root {"]
out += ["  --%s: %s;" % (k["name"], val(k["value"])) for k in t["color"]["tokens"]]
for fam in ("spacing", "radius", "shadow", "opacity"):
    out += ["  --%s: %s;" % (esc(k["name"]), k["value"]) for k in t[fam]["tokens"]]
out += ["  --font-%s: %s;" % (k, v) for k, v in t["type"]["families"].items()]
out.append("}")
for g in t["type"]["groups"]:
    for s in g["styles"]:
        out.append(".type-%s { font-family: var(--font-sans); font-size: %s; line-height: %s; font-weight: %s; }"
                   % (s["name"], s["fontSize"], s["lineHeight"], s["fontWeight"]))
open(os.path.join(HERE, "tokens.css"), "w", encoding="utf-8").write("\n".join(out) + "\n")
print("tokens.css updated")
