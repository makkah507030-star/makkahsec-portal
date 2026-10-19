// src/pages/lab/LabSheets.jsx
// مطبوعات معمل الحاسب الآلي بهوية البوابة: أوراق الاستوديو نفسها (الترويسة
// والزخارف والنسخ الثلاث: فاتحة وغامقة ورسمية) — لوحة قواعد السلامة، ولوحة
// البلاغ العامة، وملصقات الأجهزة، وخلفية سطح المكتب.
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import iconMint from "../../assets/icon-mint.png";
import iconWhite from "../../assets/icon-white.png";
import { Decor, Head, Foot, ICONS } from "../studio/Sheets.jsx";
import { fitTitle, academicYearLabel } from "../studio/lib";
import { reportUrl } from "../../lib/lab.js";
import "./lab-sheets.css";

/** رموز QR جاهزة (data URL) لقائمة روابط */
export function useQrCodes(urls, width = 360) {
  const key = urls.join("|");
  const [codes, setCodes] = useState({});
  useEffect(() => {
    let alive = true;
    Promise.all(urls.map((u) => QRCode.toDataURL(u, {
      margin: 0, width, errorCorrectionLevel: "M", color: { dark: "#1C3328", light: "#FFFFFF" },
    }).then((d) => [u, d]))).then((list) => alive && setCodes(Object.fromEntries(list)));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, width]);
  return codes;
}

const Tag = ({ labName }) => <span className="stu-tag">{ICONS.monitor}{labName}</span>;

/* ----------------------------- لوحة قواعد السلامة ----------------------------- */
export function RulesSheet({ theme = "light", items, labName }) {
  const n = items.length;
  // حجم النص بحسب عدد القواعد ليملأ الورقة دون أن يفيض
  const size = n <= 6 ? 24 : n <= 8 ? 21 : n <= 10 ? 19 : n <= 14 ? 16.5 : 14.5;
  const one = n <= 6;
  return (
    <div className={`stu stu-${theme} stu-portrait lab-rules sheet`}>
      <Decor />
      <div className="stu-page">
        <Head theme={theme} year={academicYearLabel()} />
        <div className="lab-hero">
          <Tag labName={labName} />
          <div className="stu-h1" style={{ fontSize: 62 }}>قواعد السلامة والتعليمات</div>
          <div className="stu-grule" />
        </div>
        <ol className={`lab-rules-list${one ? " one" : ""}`}>
          {items.map((t, i) => (
            <li key={i}>
              <span className="stu-ic num">{i + 1}</span>
              <p style={{ fontSize: size }}>{t}</p>
            </li>
          ))}
        </ol>
        <p className="lab-note">أقرّ كل طالب بقراءة هذه القواعد والالتزام بها عبر بوابة المدرسة.</p>
        <Foot />
      </div>
    </div>
  );
}

/* ----------------------------- لوحة البلاغ العامة ----------------------------- */
export function PosterSheet({ theme = "light", labName, qr }) {
  const steps = [
    "امسح الرمز بجوالك وسجّل الدخول للبوابة.",
    "اختر الجهاز من رسم المعمل (الترقيم يبدأ من يمين المعلم).",
    "حدّد نوع العطل وأرسل البلاغ إلى محضر المعمل.",
  ];
  return (
    <div className={`stu stu-${theme} stu-portrait lab-poster sheet`}>
      <Decor />
      <div className="stu-page">
        <Head theme={theme} year={academicYearLabel()} />
        <div className="lab-hero center">
          <Tag labName={labName} />
          <div className="stu-h1" style={{ fontSize: 70 }}>بلاغ عطل جهاز</div>
          <span className="stu-sub" style={{ fontSize: 24 }}>للمعلم — حين لا يعمل الجهاز أو لا يظهر رمزه على الشاشة</span>
          <div className="stu-grule" />
        </div>
        <div className="lab-qr big">{qr && <img src={qr} alt="" />}</div>
        <div className="stu-info lab-steps">
          {steps.map((s, i) => (
            <div key={i} className="stu-row"><span className="stu-ic num">{i + 1}</span><span className="v">{s}</span></div>
          ))}
        </div>
        <Foot />
      </div>
    </div>
  );
}

/* ----------------------------- ورقة ملصقات الأجهزة ----------------------------- */
export function StickersSheet({ theme = "light", devices, labName, codes }) {
  const cells = Array.from({ length: 24 }, (_, i) => devices[i] ?? null);
  return (
    <div className={`stu stu-${theme} stu-portrait lab-stickers sheet`}>
      <div className="grid">
        {cells.map((d, i) => (
          <div key={i} className={`lab-sticker${d ? "" : " empty"}`}>
            {d && (
              <div className="in">
                <div className="qr">{codes[reportUrl(d.seat_no)] && <img src={codes[reportUrl(d.seat_no)]} alt="" />}</div>
                <div className="tx">
                  <div className="br"><img src={theme === "dark" ? iconWhite : iconMint} alt="" /><span>{labName}</span></div>
                  <b className="num">{d.seat_no}</b>
                  <small className="num">{d.code}</small>
                  <i>بلاغ عطل — للمعلم</i>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="note">ملصقات 6.3 × 3.3 سم · قصّ على الخط المتقطع والصقها على الشاشة أو صندوق الجهاز</p>
    </div>
  );
}

/* ----------------------------- خلفية سطح المكتب ----------------------------- */
// بمقاس الشاشة الحقيقي (w×h بكسل). اللوحة يمينًا لأن أيقونات Windows تبدأ من اليسار.
export function WallpaperSheet({ theme = "dark", w, h, device, labName, note, qr }) {
  const k = Math.min(w / 1920, h / 1080);
  const px = (n) => Math.round(n * k);
  const panelH = h - px(56) - px(76);
  const numSize = Math.min(px(250), Math.round(panelH * 0.24));
  const qrSize = Math.min(px(260), Math.round(panelH * 0.3));
  const lab = fitTitle(labName, { max: px(22), min: 10, width: px(300), weight: 500 });
  return (
    <div className={`stu stu-social stu-${theme} lab-wall`} style={{ width: w, height: h }}>
      <Decor />
      <div className="panel" style={{ top: px(56), right: px(56), width: px(440), height: panelH, padding: px(34), borderRadius: px(30) }}>
        <div className="stu-brand" style={{ gap: px(12) }}>
          <img src={theme === "dark" ? iconWhite : iconMint} alt="" style={{ width: px(52), height: px(52) }} />
          <div>
            <b style={{ fontSize: px(22) }}>بوابة مكة الثانوية الرقمية</b>
            <span style={{ fontSize: px(16) }}>مدرسة مكة الثانوية</span>
          </div>
        </div>
        <div className="mid">
          <span className="stu-tag" style={{ fontSize: lab.size, padding: `${px(6)}px ${px(18)}px`, gap: px(8) }}>{ICONS.monitor}{labName}</span>
          <span className="lbl" style={{ fontSize: px(22), marginTop: px(22) }}>رقم الجهاز</span>
          <b className="num big" style={{ fontSize: numSize }}>{device.seat_no}</b>
          <span className="num code" style={{ fontSize: px(28) }}>{device.code}</span>
          <div className="stu-grule" style={{ width: px(200), marginTop: px(16) }} />
        </div>
        <div className="lab-qr" style={{ padding: px(14), borderRadius: px(20) }}>
          {qr && <img src={qr} alt="" style={{ width: qrSize, height: qrSize }} />}
        </div>
        <p className="cap" style={{ fontSize: px(21), marginTop: px(14) }}>للمعلم: امسح الرمز للإبلاغ عن عطل<small>في هذا الجهاز عبر بوابة المدرسة</small></p>
      </div>
      {note?.trim() && (
        <p className="foot-note" style={{ right: px(56) + px(440) + px(48), bottom: px(76), fontSize: px(22) }}>{note.trim()}</p>
      )}
    </div>
  );
}
