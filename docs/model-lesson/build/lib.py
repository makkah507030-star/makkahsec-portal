# أدوات بناء شرائح بهوية قالب البوابة (نفس الخط والألوان والمقاسات)
from xml.sax.saxutils import escape

EMU = 914400
FONT = "IBM Plex Sans Arabic"
INK, MUTED, DEEP, MINT, DARK, TINT, LINE, GOLD = "1C3328", "5E7268", "3E6350", "89D7AD", "16301F", "EDFAF2", "D5E7DC", "D9B45A"


def e(v):
    return int(round(v * EMU))


class Slide:
    def __init__(self, layout, hidden=False):
        self.layout = layout  # 2 محتوى، 4 غامقة
        self.hidden = hidden
        self.shapes = []
        self.images = []  # مسارات الصور بترتيب rId
        self.notes = []
        self.nid = 1

    def _id(self):
        self.nid += 1
        return self.nid

    def img_rid(self, path):
        if path not in self.images:
            self.images.append(path)
        return f"rId{self.images.index(path) + 1}"

    # ---------- أشكال ----------
    def shape(self, x, y, w, h, prst="rect", fill=None, line=None, lw=12700, adj=None, shadow=False, dash=None, alpha=None, name="Shape"):
        i = self._id()
        av = f'<a:gd name="adj" fmla="val {adj}"/>' if adj is not None else ""
        if fill:
            a = f'<a:alpha val="{alpha}"/>' if alpha is not None else ""
            f = f'<a:solidFill><a:srgbClr val="{fill}">{a}</a:srgbClr></a:solidFill>'
        else:
            f = "<a:noFill/>"
        if line:
            d = f'<a:prstDash val="{dash or "solid"}"/>'
            ln = f'<a:ln w="{lw}"><a:solidFill><a:srgbClr val="{line}"/></a:solidFill>{d}</a:ln>'
        else:
            ln = "<a:ln><a:noFill/></a:ln>"
        sh = ('<a:effectLst><a:outerShdw blurRad="127000" dist="38100" dir="5400000" algn="bl" rotWithShape="0">'
              '<a:srgbClr val="3E6350"><a:alpha val="12000"/></a:srgbClr></a:outerShdw></a:effectLst>') if shadow else ""
        self.shapes.append(
            f'<p:sp><p:nvSpPr><p:cNvPr id="{i}" name="{name} {i}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
            f'<p:spPr><a:xfrm><a:off x="{e(x)}" y="{e(y)}"/><a:ext cx="{e(w)}" cy="{e(h)}"/></a:xfrm>'
            f'<a:prstGeom prst="{prst}"><a:avLst>{av}</a:avLst></a:prstGeom>{f}{ln}{sh}</p:spPr></p:sp>')

    def card(self, x, y, w, h, fill="FFFFFF", adj=6000):
        self.shape(x, y, w, h, "roundRect", fill, LINE, adj=adj, shadow=True, name="Card")

    def circle(self, x, y, d, fill=MINT, line=None):
        self.shape(x, y, d, d, "ellipse", fill, line or fill, name="Circle")

    def pic(self, path, x, y, w, h, descr=""):
        i = self._id()
        rid = self.img_rid(path)
        self.shapes.append(
            f'<p:pic><p:nvPicPr><p:cNvPr id="{i}" name="Image {i}" descr="{escape(descr)}"/>'
            f'<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>'
            f'<p:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>'
            f'<p:spPr><a:xfrm><a:off x="{e(x)}" y="{e(y)}"/><a:ext cx="{e(w)}" cy="{e(h)}"/></a:xfrm>'
            f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>')

    def icon(self, name, cx, cy, d=0.6, bg=MINT, variant=""):
        """رمز داخل دائرة كما في القالب: دائرة نعناعية ورمز داكن"""
        self.circle(cx, cy, d, bg)
        k = d * 0.567
        self.pic(f"icons/{name}{variant}.png", cx + (d - k) / 2, cy + (d - k) / 2, k, k, name)

    # ---------- نصوص ----------
    @staticmethod
    def run(t, sz, color, b=False):
        bb = ' b="1"' if b else ""
        return (f'<a:r><a:rPr lang="ar-SA" altLang="en-US" sz="{int(sz * 100)}"{bb} dirty="0">'
                f'<a:solidFill><a:srgbClr val="{color}"/></a:solidFill>'
                f'<a:latin typeface="{FONT}"/><a:cs typeface="{FONT}"/></a:rPr><a:t>{escape(t)}</a:t></a:r>')

    def text(self, x, y, w, h, paras, sz=14, color=INK, b=False, align="r", anchor="t", bullet=None, after=0, line=None, name="Text"):
        """paras: نص، أو قائمة فقرات؛ الفقرة نص أو قائمة مقاطع (نص، مقاس، لون، غامق)"""
        if isinstance(paras, str):
            paras = [paras]
        ps = []
        for p in paras:
            runs = [(p, sz, color, b)] if isinstance(p, str) else [tuple(r) + (None, sz, color, b)[len(r):] for r in p]
            if bullet == "dot":
                bu = '<a:buSzPct val="100000"/><a:buChar char="&#x2022;"/>'
                ind = ' marL="285750" indent="-285750"'
            elif bullet == "num":
                bu = '<a:buSzPct val="100000"/><a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod"/>'
                ind = ' marL="285750" indent="-285750"'
            else:
                bu, ind = "<a:buNone/>", ' marL="0" indent="0"'
            sp = f'<a:spcAft><a:spcPts val="{int(after * 100)}"/></a:spcAft>' if after else ""
            ls = f'<a:lnSpc><a:spcPct val="{int(line * 1000)}"/></a:lnSpc>' if line else ""
            body = "".join(self.run(*r) for r in runs)
            ps.append(f'<a:p><a:pPr rtl="1" algn="{align}"{ind}>{ls}{sp}{bu}</a:pPr>{body}'
                      f'<a:endParaRPr lang="ar-SA" sz="{int(sz * 100)}" dirty="0"/></a:p>')
        i = self._id()
        self.shapes.append(
            f'<p:sp><p:nvSpPr><p:cNvPr id="{i}" name="{name} {i}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>'
            f'<p:spPr><a:xfrm><a:off x="{e(x)}" y="{e(y)}"/><a:ext cx="{e(w)}" cy="{e(h)}"/></a:xfrm>'
            f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>'
            f'<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" rtlCol="1" anchor="{anchor}"></a:bodyPr>'
            f'<a:lstStyle/>{"".join(ps)}</p:txBody></p:sp>')

    def slidenum(self, color=MUTED):
        i = self._id()
        self.shapes.append(
            f'<p:sp><p:nvSpPr><p:cNvPr id="{i}" name="Slide Number {i}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>'
            f'<p:spPr><a:xfrm><a:off x="{e(9.2)}" y="{e(5.15)}"/><a:ext cx="{e(0.4)}" cy="{e(0.3)}"/></a:xfrm>'
            f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>'
            f'<p:txBody><a:bodyPr wrap="square" lIns="0" tIns="0" rIns="0" bIns="0" anchor="t"/><a:lstStyle/>'
            f'<a:p><a:pPr algn="r"/><a:fld id="{{B6F15528-21DE-4FAA-801E-634DDDAF4B2B}}" type="slidenum">'
            f'<a:rPr lang="en-US" sz="900" dirty="0"><a:solidFill><a:srgbClr val="{color}"/></a:solidFill>'
            f'<a:latin typeface="{FONT}"/><a:cs typeface="{FONT}"/></a:rPr><a:t>‹#›</a:t></a:fld></a:p></p:txBody></p:sp>')

    # ---------- رأس الشريحة الموحّد ----------
    def header(self, pill, title, minutes=None):
        self.shape(7.9, 0.95, 1.6, 0.36, "roundRect", MINT, MINT, adj=50000, name="Pill")
        self.text(7.9, 0.95, 1.6, 0.36, pill, 12, DARK, True, "ctr", "ctr", name="Label")
        if minutes:
            # شارة الزمن: تتكرر في كل شريحة مرحلة لتذكير المعلم بإدارة الوقت
            self.shape(6.15, 0.95, 1.6, 0.36, "roundRect", DEEP, DEEP, adj=50000, name="Time")
            self.pic("icons/Timer-w.png", 7.38, 1.03, 0.2, 0.2, "مؤقت")
            self.text(6.25, 0.95, 1.08, 0.36, minutes, 12, "FFFFFF", True, "ctr", "ctr", name="TimeText")
        self.text(0.5, 1.4, 9.0, 0.7, title, 30, INK, True, name="Title")
        self.slidenum()

    def table(self, x, y, colw, rows, rowh=0.33, sz=11, key=-1):
        """key: عمود العناوين (الأيمن افتراضًا لأن الأعمدة تُمرَّر معكوسة للعربية)"""
        i = self._id()
        grid = "".join(f'<a:gridCol w="{e(c)}"/>' for c in colw)

        def cell(t, head, alt, first):
            fill = DEEP if head else ("F6FBF8" if alt else "FFFFFF")
            col = "FFFFFF" if head else (DEEP if first else INK)
            bd = "".join(f'<a:{s} w="9525"><a:solidFill><a:srgbClr val="{LINE}"/></a:solidFill></a:{s}>' for s in ("lnL", "lnR", "lnT", "lnB"))
            return (f'<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr rtl="1" algn="{"ctr" if head else "r"}"/>'
                    f'{self.run(t, sz, col, head or first)}</a:p></a:txBody>'
                    f'<a:tcPr marL="73152" marR="73152" marT="27432" marB="27432" anchor="ctr">{bd}'
                    f'<a:solidFill><a:srgbClr val="{fill}"/></a:solidFill></a:tcPr></a:tc>')
        trs = "".join(
            f'<a:tr h="{e(rowh)}">' + "".join(cell(t, ri == 0, ri % 2 == 0, ci == key % len(r)) for ci, t in enumerate(r)) + "</a:tr>"
            for ri, r in enumerate(rows))
        self.shapes.append(
            f'<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="{i}" name="Table {i}"/><p:cNvGraphicFramePr>'
            f'<a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>'
            f'<p:xfrm><a:off x="{e(x)}" y="{e(y)}"/><a:ext cx="{e(sum(colw))}" cy="{e(rowh * len(rows))}"/></p:xfrm>'
            f'<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table">'
            f'<a:tbl><a:tblPr rtl="1" firstRow="1" bandRow="1"/><a:tblGrid>{grid}</a:tblGrid>{trs}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>')

    def xml(self):
        show = ' show="0"' if self.hidden else ""
        return ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
                'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
                f'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"{show}><p:cSld><p:spTree>'
                '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>'
                '<p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>'
                + "".join(self.shapes) +
                '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>')
