import { forwardRef, useEffect, useState } from "react";
import QRCode from "qrcode";
import "./dfile.css";
import logo from "../../assets/icon-white.png";
import { dfileLink } from "../../lib/dfile.js";

/* =====================================================================
   بطاقة الرمز: بهوية البوابة وبمقاس شاشة الجوال (9:16)، تُنزَّل صورة 1080×1920.
   الرمز يفتح الرابط الثابت مع q=1 ليُعرف أن الزائر مسح الرمز.
   الصورة اختيارية، وإلا ظهرت أيقونة شخص. تأخذ لون ملف المعلم.
   ===================================================================== */

const DfileCard = forwardRef(function DfileCard({ name, rank, spec, code, color, photo }, ref) {
  const [qr, setQr] = useState(null);
  useEffect(() => {
    QRCode.toDataURL(dfileLink(code, true), { margin: 0, width: 600, errorCorrectionLevel: "M", color: { dark: "#1F3A2D", light: "#FFFFFF" } })
      .then(setQr, () => setQr(null));
  }, [code]);

  return (
    <div className="dfile df-cardwrap" data-subject={color || "science"} dir="rtl">
      <div className="df-idcard" ref={ref}>
        <div className="df-id-top"><img src={logo} alt="" /><div><b>بوابة مكة الثانوية الرقمية</b><span>ملف المعلم الرقمي</span></div></div>
        <div className="df-id-photo">
          {photo ? <img src={photo} alt="" /> : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="8.5" r="4" /><path d="M4.5 20.5c1.2-3.8 4.1-5.5 7.5-5.5s6.3 1.7 7.5 5.5" />
            </svg>
          )}
        </div>
        <div className="df-id-name">أ. {name}</div>
        <div className="df-id-meta">{rank && <span className="df-id-rank">{rank}</span>}{spec && <span>{spec}</span>}</div>
        <div className="df-id-qr">{qr && <img src={qr} alt={`رمز ملف ${name}`} />}</div>
        <div className="df-id-code">{code}</div>
        <div className="df-id-foot">امسح الرمز لعرض ملف المعلم</div>
      </div>
    </div>
  );
});

export default DfileCard;
