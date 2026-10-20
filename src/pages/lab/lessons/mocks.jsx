// src/pages/lab/lessons/mocks.jsx
// واجهات محاكاة للبرامج في محطات «الخطوات»: كل عنصر قابل للضغط له معرّف (target)،
// والمحطة تحدد العنصر المطلوب في كل خطوة. الحالة (state) تأتي من بيانات الدرس.
// حاسبة ويندوز: الوضع القياسي ووضع المبرمج مع أسطر HEX وDEC وOCT وBIN.
// جدار حماية ويندوز: من زر البدء إلى تشغيل «جدار حماية Windows Defender» (كتاب الدرس الرابع ص52).

const BASES = { hex: 16, dec: 10, oct: 8, bin: 2 };

/* زر في المحاكاة: يُبرَز عند التلميح، ويُبلَّغ بالضغط عليه */
function Hit({ id, onHit, hint, className = "", children, ...rest }) {
  return (
    <button type="button" data-target={id} onClick={() => onHit(id)} {...rest}
            className={`${className} ${hint === id ? "relative z-10 ring-4 ring-amber-400 ring-offset-1 animate-pulse" : ""}`}>
      {children}
    </button>
  );
}

function Calculator({ state, onHit, hint }) {
  const prog = state.mode === "programmer";
  const n = parseInt(state.display || "0", BASES[state.base] ?? 10) || 0;
  const group = (s, k) => s.replace(new RegExp(`\\B(?=(.{${k}})+$)`, "g"), " ");
  const rows = [
    ["hex", "HEX", n.toString(16).toUpperCase()],
    ["dec", "DEC", n.toLocaleString("en-US")],
    ["oct", "OCT", n.toString(8)],
    ["bin", "BIN", group(n.toString(2), 4)],
  ];
  const keys = prog
    ? ["A", "B", "7", "8", "9", "C", "D", "4", "5", "6", "E", "F", "1", "2", "3", "", "", "", "0", ""]
    : ["7", "8", "9", "4", "5", "6", "1", "2", "3", "", "0", ""];

  return (
    <div dir="ltr" className="relative mx-auto w-full max-w-[22rem] select-none overflow-hidden rounded-[10px] border border-[#cfd6d2] bg-[#f3f3f3] text-[#1b1b1b] shadow-card">
      <div className="flex items-center justify-between bg-[#e8e8e8] px-3 py-1.5 text-[11px] text-[#555]">
        <span>Calculator · الحاسبة</span><span>— ▢ ✕</span>
      </div>
      <div className="flex items-center gap-2 px-2 py-2">
        <Hit id="menu" onHit={onHit} hint={hint} className="rounded px-2 py-1 text-lg hover:bg-black/5">☰</Hit>
        <span className="text-base font-semibold" dir="rtl">{prog ? "مبرمج" : "قياسي"}</span>
      </div>
      <div className="px-4 pb-2 text-right font-mono text-4xl font-semibold tracking-wide">{prog && state.base !== "dec" ? n.toString(BASES[state.base]).toUpperCase() : n.toLocaleString("en-US")}</div>
      {prog && (
        <div className="space-y-0.5 px-2 pb-2">
          {rows.map(([id, label, val]) => (
            <Hit key={id} id={`row-${id}`} onHit={onHit} hint={hint}
                 className={`flex w-full items-center gap-3 rounded px-2 py-1 text-left text-sm hover:bg-black/5 ${state.base === id ? "border-l-4 border-[#3E6350] bg-white" : ""}`}>
              <span className="w-9 font-semibold text-[#555]">{label}</span>
              <span className="font-mono">{val}</span>
            </Hit>
          ))}
        </div>
      )}
      <div className={`grid gap-1 p-2 ${prog ? "grid-cols-5" : "grid-cols-3"}`}>
        {keys.map((k, i) => (k
          ? <Hit key={i} id={`key-${k.toLowerCase()}`} onHit={onHit} hint={hint}
                 className="rounded bg-white py-2.5 font-mono text-base font-semibold shadow-sm hover:bg-[#fafafa]">{k}</Hit>
          : <span key={i} className="rounded bg-[#ececec] py-2.5" />))}
      </div>
      {state.menuOpen && (
        <div className="absolute inset-y-0 left-0 z-20 w-48 bg-white shadow-xl" dir="rtl">
          <p className="px-3 py-2 text-xs font-semibold text-[#777]">الحاسبة</p>
          {[["mode-standard", "قياسي"], ["mode-scientific", "علمي"], ["mode-graph", "تخطيط المنحنى البياني"], ["mode-programmer", "مبرمج"], ["mode-date", "حساب التاريخ"]].map(([id, label]) => (
            <Hit key={id} id={id} onHit={onHit} hint={hint} className="block w-full px-4 py-2 text-start text-sm hover:bg-black/5">{label}</Hit>
          ))}
          <p className="px-3 pb-1 pt-2 text-xs font-semibold text-[#777]">المحول</p>
          <Hit id="conv-currency" onHit={onHit} hint={hint} className="block w-full px-4 py-2 text-start text-sm hover:bg-black/5">العملة</Hit>
        </div>
      )}
    </div>
  );
}


/* جدار حماية ويندوز (واجهة عربية مبسّطة): البدء ← نظام Windows ← لوحة التحكم ← البحث
   ← جدار حماية Windows Defender ← تشغيل أو إيقاف ← تشغيل للشبكتين ← موافق.
   الحالة: { start, system, screen: "desktop"|"cpanel"|"firewall"|"custom", search, priv, pub, on } */
function Firewall({ state, onHit, hint }) {
  const H = (p) => <Hit onHit={onHit} hint={hint} {...p} />;
  const Radio = ({ id, on, children }) => (
    <H id={id} className="flex w-full items-start gap-2 rounded px-2 py-1 text-start hover:bg-black/5">
      <span className={`mt-1 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border ${on ? "border-[#0067c0]" : "border-[#888]"}`}>
        {on && <span className="h-2 w-2 rounded-full bg-[#0067c0]" />}
      </span>
      <span>{children}</span>
    </H>
  );
  const status = (on) => (
    <div className={`flex items-center gap-2 rounded px-3 py-2 text-xs ${on ? "bg-[#e7f4e4] text-[#1e6b1e]" : "bg-[#fde7e9] text-[#a4262c]"}`}>
      <span className={`grid h-5 w-5 place-items-center rounded-full text-white ${on ? "bg-[#2e8b2e]" : "bg-[#c50f1f]"}`}>{on ? "✓" : "✕"}</span>
      {on ? "جدار حماية Windows Defender: تشغيل" : "جدار حماية Windows Defender: إيقاف (غير مستحسن)"}
    </div>
  );
  const win = (title, body) => (
    <div className="absolute inset-3 bottom-12 flex flex-col overflow-hidden rounded-md border border-[#c8c8c8] bg-white shadow-xl">
      <div className="flex items-center justify-between bg-[#f3f3f3] px-3 py-1.5 text-[11px] text-[#444]"><span>{title}</span><span dir="ltr">— ▢ ✕</span></div>
      <div className="flex-1 overflow-auto p-3 text-[12.5px] text-[#1b1b1b]">{body}</div>
    </div>
  );

  return (
    <div dir="rtl" className="relative mx-auto h-[26rem] w-full max-w-[34rem] select-none overflow-hidden rounded-[10px] border border-[#cfd6d2] bg-gradient-to-br from-[#2b5876] to-[#4e4376] shadow-card">
      {state.screen === "cpanel" && win("كافة عناصر لوحة التحكم", (
        <div className="space-y-3">
          <H id="cp-search" className={`block w-full rounded border px-2 py-1.5 text-start ${state.search ? "border-[#0067c0]" : "border-[#bbb] text-[#777]"}`}>
            🔍 {state.search ? "جدار حماية" : "البحث في لوحة التحكم"}
          </H>
          {state.search ? (
            <div className="space-y-1">
              <H id="fw-result" className="block w-full rounded px-2 py-1.5 text-start font-semibold text-[#0067c0] hover:bg-black/5">🛡️ جدار حماية Windows Defender</H>
              <p className="px-2 text-[11px] text-[#0067c0]">السماح بتطبيق عبر جدار حماية Windows · فحص حالة جدار الحماية</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-[11px] text-[#0067c0]">
              {["الأمان والصيانة", "الأجهزة والطابعات", "البرامج والميزات", "الشبكة والإنترنت", "الحسابات", "خيارات الطاقة"].map((x) => <span key={x}>▪ {x}</span>)}
            </div>
          )}
        </div>
      ))}
      {state.screen === "firewall" && win("جدار حماية Windows Defender", (
        <div className="flex gap-3">
          <div className="w-36 shrink-0 space-y-1.5 border-l border-[#e5e5e5] pl-2 text-[11px] text-[#0067c0]">
            <p>السماح بتطبيق أو ميزة عبر جدار الحماية</p>
            <H id="fw-onoff" className="block w-full text-start text-[11px] text-[#0067c0] underline">تشغيل جدار حماية Windows Defender أو إيقاف تشغيله</H>
            <p>الإعدادات المتقدمة</p>
          </div>
          <div className="flex-1 space-y-2">
            <p className="font-semibold">المساعدة في حماية جهازك باستخدام «جدار حماية Windows Defender»</p>
            <p className="text-[11px] text-[#555]">شبكات خاصة: غير متصل</p>
            <p className="text-[11px] text-[#555]">شبكات عامة أو شبكات الضيوف: متصل</p>
            {status(state.on)}
          </div>
        </div>
      ))}
      {state.screen === "custom" && win("تخصيص الإعدادات", (
        <div className="space-y-2">
          <p className="font-semibold">تخصيص إعدادات كافة أنواع الشبكات</p>
          {[["priv", "إعدادات الشبكات الخاصة"], ["pub", "إعدادات الشبكات العامة"]].map(([k, label]) => (
            <div key={k} className="space-y-0.5 rounded border border-[#e5e5e5] p-2">
              <p className="text-[11px] font-semibold text-[#555]">{label}</p>
              <Radio id={`${k}-on`} on={state[k]}>تشغيل «جدار حماية Windows Defender»</Radio>
              <p className="pr-7 text-[10.5px] text-[#888]">منع كافة الاتصالات الواردة · أخبرني عند حظر أي تطبيق جديد</p>
              <Radio id={`${k}-off`} on={!state[k]}>إيقاف تشغيل «جدار حماية Windows Defender» (غير مستحسن)</Radio>
            </div>
          ))}
          <div className="flex justify-start gap-2 pt-1">
            <H id="fw-ok" className="rounded border border-[#0067c0] bg-[#0067c0] px-5 py-1 text-white">موافق</H>
            <span className="rounded border border-[#bbb] px-3 py-1 text-[#555]">إلغاء الأمر</span>
          </div>
        </div>
      ))}

      {state.start && (
        <div className="absolute bottom-10 right-2 z-10 w-56 rounded-md bg-[#1f1f1f]/95 p-2 text-[12px] text-white shadow-xl">
          <p className="px-2 pb-1 text-[11px] text-white/60">كافة التطبيقات</p>
          {["الحاسبة", "الخرائط", "الصور"].map((x) => <p key={x} className="px-2 py-1 text-white/80">{x}</p>)}
          <H id="win-system" className="block w-full rounded px-2 py-1 text-start hover:bg-white/10">📁 نظام Windows {state.system ? "▴" : "▾"}</H>
          {state.system && (
            <div className="pr-4">
              {["إدارة المهام", "الأدوات الإدارية في Windows", "تشغيل"].map((x) => <p key={x} className="px-2 py-0.5 text-white/70">{x}</p>)}
              <H id="control-panel" className="block w-full rounded px-2 py-1 text-start hover:bg-white/10">⚙️ لوحة التحكم</H>
              {["مستكشف الملفات", "موجه الأوامر", "هذا الكمبيوتر"].map((x) => <p key={x} className="px-2 py-0.5 text-white/70">{x}</p>)}
            </div>
          )}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex h-10 items-center gap-2 bg-[#202020]/95 px-2">
        <H id="start" className="grid h-8 w-8 place-items-center rounded hover:bg-white/10">
          <span className="grid grid-cols-2 gap-[2px]">{[0, 1, 2, 3].map((i) => <span key={i} className="h-2 w-2 bg-[#4cc2ff]" />)}</span>
        </H>
        <span className="text-[11px] text-white/50">ابدأ</span>
      </div>
    </div>
  );
}

export const MOCKS = { calculator: Calculator, firewall: Firewall };
