# أدوات بناء شرائح بهوية قالب البوابة (نفس الخط والألوان والمقاسات)
import re
from xml.sax.saxutils import escape

EMU = 914400
FONT = "IBM Plex Sans Arabic"
INK, MUTED, DEEP, MINT, DARK, TINT, LINE, GOLD = "1C3328", "5E7268", "3E6350", "89D7AD", "16301F", "EDFAF2", "D5E7DC", "D9B45A"


def e(v):
    return int(round(v * EMU))


class Slide:
    home = None  # شريحة خريطة الحصة: النقر على شارة المرحلة يعود إليها
    def __init__(self, layout, hidden=False):
        self.layout = layout  # 2 محتوى، 4 غامقة
        self.hidden = hidden
        self.shapes = []
        self.images = []  # مسارات الصور بترتيب rId
        self.notes = []
        self.nid = 1
        self.sp_ids = []    # أشكال (لا صور) لها حركة، لقائمة bldLst
        self.main = []      # مجموعات النقر في التسلسل الرئيسي: [[(spid, نوع, مدة، بدء)]]
        self.trig = []      # [(معرّف الزر، مجموعات النقر)] تسلسلات تُشغَّل بالنقر على زر
        self.links = []     # أهداف الروابط: شريحة أو "last" (آخر شريحة عُرضت)
        self.sounds = []    # أصوات مرافقة للحركات (أسماء ملفات sounds/*.wav)

    def _id(self):
        self.nid += 1
        return self.nid

    def img_rid(self, path):
        if path not in self.images:
            self.images.append(path)
        return f"rId{self.images.index(path) + 1}"

    # ---------- أشكال ----------
    def shape(self, x, y, w, h, prst="rect", fill=None, line=None, lw=12700, adj=None, shadow=False, dash=None, alpha=None, name="Shape",
              label=None, sz=12, color=INK, b=False, align="ctr", ins=(0, 0), link=None):
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
            f'<p:sp><p:nvSpPr><p:cNvPr id="{i}" name="{escape(name)} {i}">{self._hl(link)}</p:cNvPr><p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
            f'<p:spPr><a:xfrm><a:off x="{e(x)}" y="{e(y)}"/><a:ext cx="{e(w)}" cy="{e(h)}"/></a:xfrm>'
            f'<a:prstGeom prst="{prst}"><a:avLst>{av}</a:avLst></a:prstGeom>{f}{ln}{sh}</p:spPr>'
            + (f'<p:txBody><a:bodyPr wrap="square" lIns="{e(ins[1])}" tIns="0" rIns="{e(ins[0])}" bIns="0" rtlCol="1" anchor="ctr"/>'
               f'<a:lstStyle/><a:p><a:pPr rtl="1" algn="{align}"><a:buNone/></a:pPr>{self.run(label, sz, color, b)}</a:p></p:txBody>'
               if label is not None else "") + '</p:sp>')
        return i

    def card(self, x, y, w, h, fill="FFFFFF", adj=6000):
        return self.shape(x, y, w, h, "roundRect", fill, LINE, adj=adj, shadow=True, name="Card")

    def circle(self, x, y, d, fill=MINT, line=None):
        return self.shape(x, y, d, d, "ellipse", fill, line or fill, name="Circle")

    def pic(self, path, x, y, w, h, descr=""):
        i = self._id()
        rid = self.img_rid(path)
        self.shapes.append(
            f'<p:pic><p:nvPicPr><p:cNvPr id="{i}" name="Image {i}" descr="{escape(descr)}"/>'
            f'<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>'
            f'<p:blipFill><a:blip r:embed="{rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>'
            f'<p:spPr><a:xfrm><a:off x="{e(x)}" y="{e(y)}"/><a:ext cx="{e(w)}" cy="{e(h)}"/></a:xfrm>'
            f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>')
        return i

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
        return i

    # ---------- التفاعل ----------
    def _hl(self, link):
        """رابط النقر: شريحة، أو مفتاح في MARK، أو "last" للعودة إلى آخر شريحة عُرضت"""
        if link is None:
            return ""
        self.links.append(link)
        k = len(self.links) - 1
        return (f'<a:hlinkClick r:id="" action="ppaction://hlinkshowjump?jump=lastslideviewed"/>' if link == "last"
                else f'<a:hlinkClick r:id="@@L{k}@@" action="ppaction://hlinksldjump"/>')

    def button(self, x, y, w, h, label, link, fill=TINT, line="CCF2DB", color=DEEP, sz=11):
        """زر ظاهر يحمل نصه ورابطه في شكل واحد"""
        return self.shape(x, y, w, h, "roundRect", fill, line, adj=50000, name=f"زر {label}",
                          label=label, sz=sz, color=color, b=True, link=link)

    def hotspot(self, x, y, w, h, name="زر", link=None):
        """منطقة نقر شفافة (تعبئة بشفافية كاملة لتلتقط النقر)، وقد تحمل رابطًا لشريحة"""
        i = self._id()
        hl = self._hl(link)
        self.shapes.append(
            f'<p:sp><p:nvSpPr><p:cNvPr id="{i}" name="{escape(name)} {i}">{hl}</p:cNvPr><p:cNvSpPr/><p:nvPr/></p:nvSpPr>'
            f'<p:spPr><a:xfrm><a:off x="{e(x)}" y="{e(y)}"/><a:ext cx="{e(w)}" cy="{e(h)}"/></a:xfrm>'
            f'<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="FFFFFF"><a:alpha val="0"/></a:srgbClr></a:solidFill>'
            f'<a:ln><a:noFill/></a:ln></p:spPr></p:sp>')
        return i

    def anim(self, ids, kind="in", dur=500, start="click", trigger=None, pics=(), sound=None):
        """حركة لأشكال: kind = in (ظهور تدريجي) أو out (مسح خروج بطيء للمؤقت)،
        start = click (مجموعة نقر جديدة) أو with (مع السابق) أو after (بعد السابق)"""
        ids = [ids] if isinstance(ids, int) else list(ids)
        for i in ids:
            if i not in pics and i not in self.sp_ids:
                self.sp_ids.append(i)
        if trigger is None:
            seqs = self.main
        else:
            for t, g in self.trig:
                if t == trigger:
                    seqs = g
                    break
            else:
                seqs = []
                self.trig.append((trigger, seqs))
        if start == "click" or not seqs:
            assert trigger is None or not seqs, "زر التفاعل يشغّل مجموعة واحدة؛ استعمل زرًا لكل نقرة"
            seqs.append([])
        if sound and sound not in self.sounds:
            self.sounds.append(sound)
        for n, i in enumerate(ids):
            seqs[-1].append((i, kind, dur, start if n == 0 else "with", sound if n == 0 else None))

    def _effect(self, c, spid, kind, dur, node, sound=None, delay=0):
        tgt = f'<p:tgtEl><p:spTgt spid="{spid}"/></p:tgtEl>'
        vis = lambda v, d: (f'<p:set><p:cBhvr><p:cTn id="{c()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="{d}"/></p:stCondLst></p:cTn>'
                            f'{tgt}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr>'
                            f'<p:to><p:strVal val="{v}"/></p:to></p:set>')
        if kind == "in":
            head = f'presetID="10" presetClass="entr" presetSubtype="0"'
            body = vis("visible", 0) + f'<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="{c()}" dur="{dur}"/>{tgt}</p:cBhvr></p:animEffect>'
        else:
            head = f'presetID="22" presetClass="exit" presetSubtype="8"'
            body = (f'<p:animEffect transition="out" filter="wipe(left)"><p:cBhvr><p:cTn id="{c()}" dur="{dur}"/>{tgt}</p:cBhvr></p:animEffect>'
                    + vis("hidden", dur - 1))
        snd = ""
        if sound:
            # «صوت التحسين» للحركة كما يكتبه PowerPoint: يُشغَّل مع بدء الحركة
            snd = (f'<p:subTnLst><p:audio><p:cMediaNode showWhenStopped="0"><p:cTn id="{c()}" display="0" masterRel="sameClick">'
                   f'<p:stCondLst><p:cond delay="0"/></p:stCondLst><p:endCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:endCondLst>'
                   f'</p:cTn><p:tgtEl><p:sndTgt r:embed="@@S{self.sounds.index(sound)}@@" name="{sound}.wav"/></p:tgtEl></p:cMediaNode></p:audio></p:subTnLst>')
        return (f'<p:par><p:cTn id="{c()}" {head} fill="hold" grpId="0" nodeType="{node}"><p:stCondLst><p:cond delay="{delay}"/></p:stCondLst>'
                f'<p:childTnLst>{body}</p:childTnLst>{snd}</p:cTn></p:par>')

    def _groups(self, c, groups, first_now=False):
        out = []
        for gi, g in enumerate(groups):
            # تقسيم المجموعة إلى مراحل زمنية: «بعد السابق» يبدأ مرحلة جديدة بعد أطول حركة في المرحلة السابقة
            stages, t, longest = [], 0, 0
            for spid, kind, dur, start, sound in g:
                if start == "after" and stages:
                    t += longest
                    longest = 0
                    stages.append((t, []))
                elif not stages:
                    stages.append((0, []))
                node = "clickEffect" if start == "click" else ("afterEffect" if start == "after" else "withEffect")
                stages[-1][1].append((spid, kind, dur, node, sound))
                longest = max(longest, dur)
            inner = "".join(
                f'<p:par><p:cTn id="{c()}" fill="hold"><p:stCondLst><p:cond delay="{st}"/></p:stCondLst><p:childTnLst>'
                + "".join(self._effect(c, *ef) for ef in efs) + '</p:childTnLst></p:cTn></p:par>'
                for st, efs in stages)
            start = "0" if (first_now and gi == 0) else "indefinite"
            out.append(f'<p:par><p:cTn id="{c()}" fill="hold"><p:stCondLst><p:cond delay="{start}"/></p:stCondLst>'
                       f'<p:childTnLst>{inner}</p:childTnLst></p:cTn></p:par>')
        return "".join(out)

    def timing(self):
        if not self.main and not self.trig:
            return ""
        n = [2]

        def c():
            n[0] += 1
            return n[0]
        nav = ('<p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst>'
               '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst>')
        seqs = ""
        if self.main:
            seqs += (f'<p:seq concurrent="1" nextAc="seek"><p:cTn id="{c()}" dur="indefinite" nodeType="mainSeq"><p:childTnLst>'
                     f'{self._groups(c, self.main)}</p:childTnLst></p:cTn>{nav}</p:seq>')
        for t, g in self.trig:
            seqs += (f'<p:seq concurrent="1" nextAc="seek"><p:cTn id="{c()}" restart="whenNotActive" fill="hold" evtFilter="cancelBubble" nodeType="interactiveSeq">'
                     f'<p:stCondLst><p:cond evt="onClick" delay="0"><p:tgtEl><p:spTgt spid="{t}"/></p:tgtEl></p:cond></p:stCondLst>'
                     f'<p:endSync evt="end" delay="0"><p:rtn val="all"/></p:endSync><p:childTnLst>{self._groups(c, g, True)}</p:childTnLst></p:cTn>'
                     '<p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq>')
        bld = "".join(f'<p:bldP spid="{i}" grpId="0" animBg="1"/>' for i in self.sp_ids)
        xml = (f'<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst>'
               f'{seqs}</p:childTnLst></p:cTn></p:par></p:tnLst>' + (f'<p:bldLst>{bld}</p:bldLst>' if bld else "") + '</p:timing>')
        k = iter(range(1, 100000))
        return re.sub(r'<p:cTn id="\d+"', lambda m: f'<p:cTn id="{next(k)}"', xml)

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
            chip = self.shape(6.15, 0.95, 1.6, 0.36, "roundRect", DEEP, DEEP, adj=50000, name="زر المؤقت",
                              label=minutes, color="FFFFFF", b=True, ins=(0.42, 0.1))
            self.pic("icons/Timer-w.png", 7.38, 1.03, 0.2, 0.2, "مؤقت")
            # المؤقت: نقرة على الشارة تبدأ شريطًا يتناقص بالمدة الحقيقية، ثم تظهر «انتهى الوقت»
            mins = int("".join(ch for ch in minutes if ch.isdigit()))
            bar = self.shape(6.35, 1.245, 1.2, 0.035, "rect", MINT, None, name="شريط المؤقت")
            # تظهر بجانب الشارة لا فوقها، فتبقى المدة ظاهرة للتعديل في وضع التحرير
            end = [self.shape(4.85, 0.95, 1.2, 0.36, "roundRect", "B8912F", "B8912F", adj=50000, name="انتهى الوقت"),
                   self.text(4.85, 0.95, 1.2, 0.36, "انتهى الوقت", 12, "FFFFFF", True, "ctr", "ctr", name="انتهى الوقت")]
            self.anim(bar, "out", mins * 60000, trigger=chip)
            self.anim(end, "in", 500, start="after", trigger=chip, sound="timeup")
        if Slide.home is not None and Slide.home is not self:
            self.hotspot(7.9, 0.95, 1.6, 0.36, "العودة إلى خريطة الحصة", link=Slide.home)
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
                '</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>'
                '<p:transition spd="med"><p:fade/></p:transition>' + self.timing() + '</p:sld>')
