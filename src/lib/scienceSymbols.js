// src/lib/scienceSymbols.js
// رموز مكتبتي معلمي الكيمياء والفيزياء. لا توجد في كتب المادة صفحة رموز معتمدة
// كما في الرياضيات، فهذه القائمة مجمَّعة من الرموز الشائعة في دروس الكتب والاصطلاح
// الدولي (IUPAC للكيمياء وSI للوحدات)، وتُعدَّل بحسب ملاحظات المعلمين.
//
// حدود الكتابة في سطر واحد: لا توجد في Unicode حروف سفلية لكل اللاتينية (لا b ولا w
// ولا f)، فتُكتب Kb وKw وKsp بحروف عادية، ورموز النظائر تُكتب ⁴₂He متتالية لا مكدّسة.

export const CHEM_SYMBOL_GROUPS = [
  {
    key: "formula",
    title: "الصيغ والأرقام السفلية",
    items: [
      { sym: "₂", label: "رقم سفلي 2 — مثل H₂O" },
      { sym: "₃", label: "رقم سفلي 3 — مثل NH₃" },
      { sym: "₄", label: "رقم سفلي 4 — مثل CH₄" },
      { sym: "₅", label: "رقم سفلي 5" },
      { sym: "₆", label: "رقم سفلي 6 — مثل C₆H₁₂O₆" },
      { sym: "₇", label: "رقم سفلي 7" },
      { sym: "₈", label: "رقم سفلي 8" },
      { sym: "₉", label: "رقم سفلي 9" },
      { sym: "₁", label: "رقم سفلي 1" },
      { sym: "₀", label: "رقم سفلي 0" },
      { sym: "·", label: "نقطة ماء التبلور — مثل CuSO₄·5H₂O" },
    ],
  },
  {
    key: "ions",
    title: "الشحنات والأيونات",
    items: [
      { sym: "⁺", label: "شحنة موجبة — مثل Na⁺" },
      { sym: "⁻", label: "شحنة سالبة — مثل Cl⁻" },
      { sym: "²⁺", label: "شحنة +2 — مثل Ca²⁺" },
      { sym: "³⁺", label: "شحنة +3 — مثل Al³⁺" },
      { sym: "²⁻", label: "شحنة −2 — مثل SO₄²⁻" },
      { sym: "³⁻", label: "شحنة −3 — مثل PO₄³⁻" },
      { sym: "H⁺", label: "أيون الهيدروجين" },
      { sym: "OH⁻", label: "أيون الهيدروكسيد" },
      { sym: "H₃O⁺", label: "أيون الهيدرونيوم" },
      { sym: "NH₄⁺", label: "أيون الأمونيوم" },
      { sym: "e⁻", label: "الإلكترون" },
      { sym: "p⁺", label: "البروتون" },
      { sym: "n⁰", label: "النيوترون" },
      { sym: "δ⁺", label: "شحنة جزئية موجبة (الرابطة القطبية)" },
      { sym: "δ⁻", label: "شحنة جزئية سالبة (الرابطة القطبية)" },
    ],
  },
  {
    key: "reactions",
    title: "التفاعلات والحالات",
    items: [
      { sym: "→", label: "ينتج — سهم التفاعل" },
      { sym: "⇌", label: "تفاعل منعكس — اتزان" },
      { sym: "←", label: "سهم عكسي" },
      { sym: "↑", label: "غاز متصاعد" },
      { sym: "↓", label: "راسب" },
      { sym: "+", label: "زائد — بين المتفاعلات أو النواتج" },
      { sym: "(s)", label: "حالة صلبة" },
      { sym: "(l)", label: "حالة سائلة" },
      { sym: "(g)", label: "حالة غازية" },
      { sym: "(aq)", label: "محلول مائي" },
      { sym: "Δ", label: "حرارة (فوق سهم التفاعل)، أو التغيّر في كمية" },
    ],
  },
  {
    key: "quantities",
    title: "الكميات والوحدات",
    items: [
      { sym: "mol", label: "المول" },
      { sym: "g/mol", label: "الكتلة المولية" },
      { sym: "M", label: "المولارية (mol/L)" },
      { sym: "m", label: "المولالية (mol/kg)" },
      { sym: "mol/L", label: "مول لكل لتر" },
      { sym: "L", label: "لتر" },
      { sym: "mL", label: "ملِّيلتر" },
      { sym: "g", label: "جرام" },
      { sym: "atm", label: "ضغط جوي" },
      { sym: "kPa", label: "كيلوباسكال" },
      { sym: "mmHg", label: "ملِّيمتر زئبق" },
      { sym: "K", label: "كلفن" },
      { sym: "°C", label: "درجة سلسيوس" },
      { sym: "J", label: "جول" },
      { sym: "kJ", label: "كيلوجول" },
      { sym: "kJ/mol", label: "كيلوجول لكل مول" },
      { sym: "J/g·°C", label: "وحدة الحرارة النوعية" },
      { sym: "6.02×10²³", label: "عدد أفوجادرو" },
      { sym: "22.4 L", label: "حجم مول من الغاز في الظروف المعيارية STP" },
      { sym: "R", label: "ثابت الغازات: 0.0821 L·atm/mol·K أو 8.314 J/mol·K" },
      { sym: "%", label: "النسبة المئوية" },
    ],
  },
  {
    key: "energy",
    title: "الطاقة والاتزان والأحماض",
    items: [
      { sym: "ΔH", label: "التغيّر في المحتوى الحراري" },
      { sym: "ΔH°", label: "التغيّر في المحتوى الحراري القياسي" },
      { sym: "ΔS", label: "التغيّر في الإنتروبي" },
      { sym: "ΔG", label: "التغيّر في الطاقة الحرة" },
      { sym: "Eₐ", label: "طاقة التنشيط" },
      { sym: "Keq", label: "ثابت الاتزان" },
      { sym: "Ka", label: "ثابت تأين الحمض" },
      { sym: "Kb", label: "ثابت تأين القاعدة" },
      { sym: "Kw", label: "ثابت تأين الماء" },
      { sym: "Ksp", label: "ثابت حاصل الذائبية" },
      { sym: "pH", label: "الرقم الهيدروجيني" },
      { sym: "pOH", label: "الرقم الهيدروكسيلي" },
      { sym: "[H⁺]", label: "تركيز أيون الهيدروجين" },
      { sym: "[OH⁻]", label: "تركيز أيون الهيدروكسيد" },
      { sym: "[H₃O⁺]", label: "تركيز أيون الهيدرونيوم" },
      { sym: "E°", label: "جهد الاختزال القياسي" },
      { sym: "E°cell", label: "جهد الخلية القياسي" },
    ],
  },
  {
    key: "atom",
    title: "الذرة والتوزيع الإلكتروني",
    items: [
      { sym: "¹", label: "أس 1 — مثل 1s¹" },
      { sym: "²", label: "أس 2 — مثل 1s²" },
      { sym: "³", label: "أس 3" },
      { sym: "⁴", label: "أس 4" },
      { sym: "⁵", label: "أس 5" },
      { sym: "⁶", label: "أس 6 — مثل 2p⁶" },
      { sym: "⁷", label: "أس 7" },
      { sym: "¹⁰", label: "أس 10 — مثل 3d¹⁰" },
      { sym: "¹⁴", label: "أس 14 — مثل 4f¹⁴" },
      { sym: "[He]", label: "التوزيع المختصر بالغاز النبيل He" },
      { sym: "[Ne]", label: "التوزيع المختصر بالغاز النبيل Ne" },
      { sym: "[Ar]", label: "التوزيع المختصر بالغاز النبيل Ar" },
      { sym: "[Kr]", label: "التوزيع المختصر بالغاز النبيل Kr" },
      { sym: "[Xe]", label: "التوزيع المختصر بالغاز النبيل Xe" },
      { sym: "↑", label: "إلكترون في المستوى (مخطط المستويات)" },
      { sym: "⇅", label: "زوج إلكترونات متعاكسة الغزل" },
      { sym: "⁴₂He", label: "جسيم ألفا" },
      { sym: "⁰₋₁e", label: "جسيم بيتا" },
      { sym: "¹₀n", label: "النيوترون (معادلة نووية)" },
      { sym: "¹₁H", label: "البروتون (معادلة نووية)" },
      { sym: "γ", label: "أشعة جاما" },
    ],
  },
  {
    key: "bonds",
    title: "الروابط والكيمياء العضوية",
    items: [
      { sym: "−", label: "رابطة أحادية" },
      { sym: "=", label: "رابطة ثنائية" },
      { sym: "≡", label: "رابطة ثلاثية" },
      { sym: "σ", label: "رابطة سيجما" },
      { sym: "π", label: "رابطة باي" },
      { sym: "R", label: "مجموعة ألكيل" },
      { sym: "−OH", label: "مجموعة الهيدروكسيل" },
      { sym: "−COOH", label: "مجموعة الكربوكسيل" },
      { sym: "−CHO", label: "مجموعة الألدهيد" },
      { sym: "C=O", label: "مجموعة الكربونيل" },
      { sym: "−NH₂", label: "مجموعة الأمين" },
      { sym: "−X", label: "هالوجين" },
      { sym: "≈", label: "يساوي تقريبًا" },
      { sym: "°", label: "درجة" },
    ],
  },
];

export const PHYSICS_SYMBOL_GROUPS = [
  {
    key: "greek",
    title: "الحروف اليونانية",
    items: [
      { sym: "Δ", label: "التغيّر في كمية — مثل Δx وΔt" },
      { sym: "Σ", label: "المجموع — مثل ΣF" },
      { sym: "λ", label: "الطول الموجي" },
      { sym: "θ", label: "الزاوية" },
      { sym: "ω", label: "السرعة الزاوية" },
      { sym: "α", label: "التسارع الزاوي، أو جسيم ألفا" },
      { sym: "β", label: "جسيم بيتا" },
      { sym: "γ", label: "أشعة جاما" },
      { sym: "μ", label: "معامل الاحتكاك، أو البادئة ميكرو" },
      { sym: "ρ", label: "الكثافة، أو المقاومية" },
      { sym: "τ", label: "العزم" },
      { sym: "η", label: "الكفاءة" },
      { sym: "ε", label: "السماحية" },
      { sym: "φ", label: "فاي — زاوية الطور" },
      { sym: "Ω", label: "أوم — وحدة المقاومة" },
      { sym: "π", label: "باي (ط)" },
    ],
  },
  {
    key: "units",
    title: "الوحدات",
    items: [
      { sym: "m", label: "متر" },
      { sym: "kg", label: "كيلوجرام" },
      { sym: "s", label: "ثانية" },
      { sym: "A", label: "أمبير" },
      { sym: "K", label: "كلفن" },
      { sym: "N", label: "نيوتن — القوة" },
      { sym: "J", label: "جول — الشغل والطاقة" },
      { sym: "W", label: "واط — القدرة" },
      { sym: "Pa", label: "باسكال — الضغط" },
      { sym: "Hz", label: "هيرتز — التردد" },
      { sym: "C", label: "كولوم — الشحنة" },
      { sym: "V", label: "فولت — فرق الجهد" },
      { sym: "Ω", label: "أوم — المقاومة" },
      { sym: "F", label: "فاراد — السعة" },
      { sym: "T", label: "تسلا — المجال المغناطيسي" },
      { sym: "eV", label: "إلكترون فولت" },
      { sym: "m/s", label: "متر لكل ثانية — السرعة" },
      { sym: "m/s²", label: "متر لكل ثانية تربيع — التسارع" },
      { sym: "kg·m/s", label: "وحدة الزخم" },
      { sym: "N·m", label: "نيوتن متر — العزم" },
      { sym: "rad", label: "راديان" },
      { sym: "rad/s", label: "راديان لكل ثانية" },
      { sym: "°C", label: "درجة سلسيوس" },
      { sym: "kWh", label: "كيلوواط ساعة" },
    ],
  },
  {
    key: "powers",
    title: "الأسس والبادئات",
    items: [
      { sym: "×10", label: "الصيغة العلمية — مثل 3×10⁸" },
      { sym: "⁻", label: "أس سالب" },
      { sym: "⁰", label: "أس 0" },
      { sym: "¹", label: "أس 1" },
      { sym: "²", label: "أس 2 — تربيع" },
      { sym: "³", label: "أس 3 — تكعيب" },
      { sym: "⁴", label: "أس 4" },
      { sym: "⁵", label: "أس 5" },
      { sym: "⁶", label: "أس 6" },
      { sym: "⁷", label: "أس 7" },
      { sym: "⁸", label: "أس 8" },
      { sym: "⁹", label: "أس 9" },
      { sym: "⁻¹", label: "أس سالب 1 — مثل s⁻¹" },
      { sym: "G", label: "جيجا 10⁹" },
      { sym: "M", label: "ميجا 10⁶" },
      { sym: "k", label: "كيلو 10³" },
      { sym: "c", label: "سنتي 10⁻²" },
      { sym: "m", label: "ملِّي 10⁻³" },
      { sym: "μ", label: "ميكرو 10⁻⁶" },
      { sym: "n", label: "نانو 10⁻⁹" },
      { sym: "p", label: "بيكو 10⁻¹²" },
    ],
  },
  {
    key: "motion",
    title: "الحركة والمتجهات",
    items: [
      { sym: "v⃗", label: "متجه السرعة" },
      { sym: "a⃗", label: "متجه التسارع" },
      { sym: "F⃗", label: "متجه القوة" },
      { sym: "d⃗", label: "متجه الإزاحة" },
      { sym: "Δx", label: "الإزاحة" },
      { sym: "Δt", label: "الفترة الزمنية" },
      { sym: "Δv", label: "التغيّر في السرعة" },
      { sym: "v₀", label: "السرعة الابتدائية" },
      { sym: "x₀", label: "الموقع الابتدائي" },
      { sym: "ΣF", label: "محصلة القوى" },
      { sym: "·", label: "الضرب القياسي" },
      { sym: "×", label: "الضرب الاتجاهي" },
      { sym: "∝", label: "يتناسب طرديًا مع" },
      { sym: "≈", label: "يساوي تقريبًا" },
      { sym: "∥", label: "موازٍ" },
      { sym: "⊥", label: "عمودي" },
      { sym: "°", label: "درجة" },
      { sym: "→", label: "اتجاه اليمين" },
      { sym: "←", label: "اتجاه اليسار" },
      { sym: "↑", label: "اتجاه الأعلى" },
      { sym: "↓", label: "اتجاه الأسفل" },
    ],
  },
  {
    key: "electric",
    title: "الكهرباء والمغناطيسية",
    items: [
      { sym: "q", label: "الشحنة" },
      { sym: "e⁻", label: "الإلكترون" },
      { sym: "I", label: "التيار" },
      { sym: "R", label: "المقاومة" },
      { sym: "ΔV", label: "فرق الجهد" },
      { sym: "ε₀", label: "سماحية الفراغ" },
      { sym: "μ₀", label: "نفاذية الفراغ" },
      { sym: "⊙", label: "مجال خارج من الصفحة" },
      { sym: "⊗", label: "مجال داخل إلى الصفحة" },
      { sym: "kΩ", label: "كيلوأوم" },
      { sym: "μF", label: "ميكروفاراد" },
      { sym: "mA", label: "ملِّي أمبير" },
      { sym: "R₁", label: "المقاومة الأولى" },
      { sym: "R₂", label: "المقاومة الثانية" },
    ],
  },
  {
    key: "waves",
    title: "الموجات والضوء والفيزياء الحديثة",
    items: [
      { sym: "λ", label: "الطول الموجي" },
      { sym: "f", label: "التردد" },
      { sym: "T", label: "الزمن الدوري" },
      { sym: "n", label: "معامل الانكسار" },
      { sym: "n₁", label: "معامل انكسار الوسط الأول" },
      { sym: "n₂", label: "معامل انكسار الوسط الثاني" },
      { sym: "θ₁", label: "زاوية السقوط" },
      { sym: "θ₂", label: "زاوية الانكسار" },
      { sym: "hf", label: "طاقة الفوتون" },
      { sym: "⁴₂He", label: "جسيم ألفا" },
      { sym: "⁰₋₁e", label: "جسيم بيتا" },
      { sym: "¹₀n", label: "النيوترون (معادلة نووية)" },
      { sym: "¹₁p", label: "البروتون (معادلة نووية)" },
      { sym: "γ", label: "أشعة جاما" },
    ],
  },
  {
    key: "constants",
    title: "الثوابت",
    items: [
      { sym: "g = 9.8 m/s²", label: "تسارع الجاذبية الأرضية" },
      { sym: "c = 3.00×10⁸ m/s", label: "سرعة الضوء في الفراغ" },
      { sym: "G = 6.67×10⁻¹¹ N·m²/kg²", label: "ثابت الجذب الكوني" },
      { sym: "h = 6.63×10⁻³⁴ J·s", label: "ثابت بلانك" },
      { sym: "e = 1.60×10⁻¹⁹ C", label: "شحنة الإلكترون" },
      { sym: "K = 9.0×10⁹ N·m²/C²", label: "ثابت كولوم" },
      { sym: "mₑ = 9.11×10⁻³¹ kg", label: "كتلة الإلكترون" },
      { sym: "1 eV = 1.60×10⁻¹⁹ J", label: "الإلكترون فولت بالجول" },
    ],
  },
];

// =====================================================================
// تنسيق الصيغ الكيميائية: يكتب المعلم H2SO4 أو Fe3+ أو 2H2 + O2 -> 2H2O
// بلوحة المفاتيح العادية، فتصير H₂SO₄ وFe³⁺ و2H₂ + O₂ → 2H₂O.
// =====================================================================

const SUB_DIGITS = "₀₁₂₃₄₅₆₇₈₉";
const SUP_DIGITS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const toSub = (s) => s.replace(/\d/g, (d) => SUB_DIGITS[d]);
const toSup = (s) => s.replace(/\d/g, (d) => SUP_DIGITS[d]).replace(/\+/g, "⁺").replace(/[-−–]/g, "⁻");

const ELEMENT = /^[A-Z][a-z]?$/;
// رموز عناصر وأرقام وأقواس فقط — فلا تُمَس كلمة إنجليزية مثل Hello
const FORMULA_BODY = /^(?=[A-Z([])(?:[A-Z][a-z]?|\d+|[()[\]])+$/;
const ARROWS = { "->": "→", "-->": "→", "<-": "←", "<=>": "⇌", "<->": "⇌" };
const STATE = /\((?:s|l|g|aq)\)$/;
const STATE_ONLY = /^\((?:s|l|g|aq)\)$/;
const CONFIG = /^(?:\[[A-Z][a-z]?\])?(?:\d[spdf]\d{1,2}?(?=\d[spdf]|$))+$/;
const ISOLATE = /[⁦-⁩]/;

// صيغة بلا حالة ولا شحنة، وقد تبدأ بمعامل أو تحوي ماء تبلور: 2H2O، CuSO4·5H2O
function subscriptBody(body) {
  const out = [];
  for (const part of body.replace(/\*/g, "·").split("·")) {
    const [, coef, rest] = part.match(/^(\d*)(.*)$/);
    if (!FORMULA_BODY.test(rest)) return null;
    out.push(coef + rest.replace(/([A-Za-z)\]])(\d+)/g, (_, a, d) => a + toSub(d)));
  }
  return out.join("·");
}

// يعيد الكلمة منسّقة إن كانت صيغة أو سهمًا أو توزيعًا إلكترونيًا، وnull لغير ذلك
function chemToken(tok) {
  if (ISOLATE.test(tok)) return null;
  if (ARROWS[tok]) return ARROWS[tok];
  if (["→", "⇌", "←"].includes(tok) || STATE_ONLY.test(tok)) return tok;
  if (tok === "e-" || tok === "e−") return "e⁻";

  // التوزيع الإلكتروني: 1s2 2s2 2p6 أو [Ne]3s23p5
  if (CONFIG.test(tok)) return tok.replace(/(\d[spdf])(\d{1,2}?)(?=\d[spdf]|$)/g, (_, o, n) => o + toSup(n));

  // الأس الصريح: SO4^2- أو 10^-3
  const caret = tok.match(/^(.+?)\^([+\-−]?\d+|\d*[+\-−])$/);
  if (caret) {
    const base = subscriptBody(caret[1]) ?? (/^[\w.×]+$/.test(caret[1]) ? caret[1] : null);
    return base === null ? null : base + toSup(caret[2]);
  }

  let rest = tok;
  const state = rest.match(STATE)?.[0] ?? "";
  rest = rest.slice(0, rest.length - state.length);

  // الشحنة في الآخر: الأيون أحادي الذرة رقمه كله شحنة (Fe3+)، ومتعدد الذرات
  // رقمه الأخير وحده شحنة إن سبقه رقم (SO42-) وإلا فهو رقم سفلي (NH4+)
  let charge = "";
  const ion = rest.match(/^(.*?[A-Za-z)\]])(\d*)([+\-−])$/);
  if (ion) {
    let [, body, d, sign] = ion;
    const mono = ELEMENT.test(body.replace(/^\d+/, ""));
    if (d.length >= 2 || (mono && d)) { body += d.slice(0, -1); charge = d.slice(-1) + sign; }
    else { body += d; charge = sign; }
    rest = body;
  }
  const f = subscriptBody(rest);
  return f === null ? null : f + toSup(charge) + state;
}

/**
 * ينسّق الصيغ في نص قد يكون عربيًا مختلطًا، ولا يمس غيرها.
 * كل معادلة متصلة تُعزل يسار←يمين مرة واحدة (LRI…PDI)، فلا ينقلب ترتيب
 * طرفيها داخل سطر عربي.
 */
export function formatChemText(text) {
  const toks = [];
  for (const piece of String(text ?? "").split(/(\s+)/)) {
    if (!piece) continue;
    if (/^\s+$/.test(piece)) { toks.push({ t: piece, kind: "space" }); continue; }
    const [, core, punct] = piece.match(/^(.*?)([،؛,.:!?؟]*)$/);
    if (core === "+") toks.push({ t: core, kind: "join" });
    else if (core) {
      // رمز أُدرج من المكتبة معزولًا وحده (⁦→⁩) يدخل في المعادلة المحيطة به
      const inner = core.match(/^⁦([^⁦-⁩]+)⁩$/)?.[1];
      const out = chemToken(inner ?? core);
      toks.push(out === null ? { t: core, kind: "other" } : { t: out, kind: "chem", changed: out !== core });
    }
    if (punct) toks.push({ t: punct, kind: "other" });
  }

  let res = "";
  for (let i = 0; i < toks.length;) {
    if (toks[i].kind !== "chem") { res += toks[i].t; i++; continue; }
    let last = i;
    for (let j = i; j < toks.length && toks[j].kind !== "other"; j++) if (toks[j].kind === "chem") last = j;
    const run = toks.slice(i, last + 1);
    const s = run.map((x) => x.t).join("");
    res += run.some((x) => x.changed) ? `⁦${s}⁩` : s;
    i = last + 1;
  }
  return res;
}
