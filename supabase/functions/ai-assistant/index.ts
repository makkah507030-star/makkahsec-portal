// ai-assistant: مساعد المعلم بالذكاء الاصطناعي (Claude) — مهام محددة فقط، لا محادثة مفتوحة.
// المهمة الأولى quiz_questions: توليد أسئلة لاختبار المعلم من نص الدرس (أو صفحات الكتاب PDF/صورة)
// بأنماط البوابة نفسها (اختيار من متعدد، وصح وخطأ، ومزاوجة)، فتُراجَع ثم تُضاف إلى الاختبار.
// • المفتاح ANTHROPIC_API_KEY سرّ في Supabase لا يصل إلى المتصفح.
// • للمعلم صاحب الاختبار وحده، وبحصة شهرية (settings.ai_monthly_limit)، وكل طلب يُسجَّل في ai_usage.
// • لا تُرسل بيانات الطلاب: نص الدرس فقط.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Anthropic from "npm:@anthropic-ai/sdk";

const MODEL = Deno.env.get("AI_MODEL") || "claude-opus-5-5";
// أسعار التقدير لكل مليون وحدة (إدخال، إخراج) بالدولار
const PRICE: Record<string, [number, number]> = {
  "claude-opus-5-5": [4, 20], "claude-sonnet-5-5": [2, 10], "claude-haiku-5-5": [0.1, 0.5],
};
const MAX_TEXT = 40000;                 // حروف نص الدرس
const MAX_FILE = 7 * 1024 * 1024;       // حجم الملف بعد base64 (نحو 5 م.ب)

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// شكل المخرجات المضمون: قائمة أسئلة، لكل نوع حقوله وتبقى البقية فارغة
const SCHEMA = {
  type: "object", additionalProperties: false, required: ["questions"],
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        required: ["kind", "text", "options", "correct_index", "is_true", "pairs", "explanation"],
        properties: {
          kind: { type: "string", enum: ["mcq", "truefalse", "match"] },
          text: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          correct_index: { type: "integer" },
          is_true: { type: "boolean" },
          pairs: {
            type: "array",
            items: { type: "object", additionalProperties: false, required: ["left", "right"],
              properties: { left: { type: "string" }, right: { type: "string" } } },
          },
          explanation: { type: "string" },
        },
      },
    },
  },
};

const LEVEL: Record<string, string> = {
  easy: "سهلة في معظمها: تذكّر وفهم مباشر.",
  mixed: "متدرجة: نحو الثلث تذكّر، والثلث فهم، والثلث تطبيق وتحليل.",
  hard: "أعلى مستوى: تطبيق وتحليل واستنتاج، مع بعض أسئلة الفهم.",
};

const shuffle = <T,>(a: T[]) => { const x = [...a]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
const clean = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "غير مصرّح" }, 401);
    const userClient = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const actor = (await userClient.auth.getUser()).data.user;
    if (!actor) return json({ error: "جلسة غير صالحة" }, 401);
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });
    if (!Deno.env.get("ANTHROPIC_API_KEY")) return json({ error: "المساعد لم يُفعَّل بعد: مفتاح Claude غير مضبوط في أسرار Supabase" }, 503);

    const body = await req.json().catch(() => ({}));
    if (body.task !== "quiz_questions") return json({ error: "مهمة غير مدعومة" }, 400);

    // الاختبار للمعلم نفسه
    const { data: quiz } = await admin.from("quizzes").select("id, teacher_id, mode, lang, subject_name, title").eq("id", body.quiz_id).maybeSingle();
    if (!quiz || quiz.teacher_id !== actor.id) return json({ error: "الاختبار ليس لك" }, 403);
    if (quiz.mode === "external") return json({ error: "الاختبار من خارج البوابة بلا أسئلة" }, 400);

    // الحصة الشهرية (بتوقيت مكة)
    const { data: quota } = await userClient.rpc("ai_my_quota");
    if (quota && quota.used >= quota.limit) return json({ error: `بلغت حدّك الشهري (${quota.limit} طلبًا). يتجدد أول الشهر القادم.` }, 429);

    // المدخلات
    const title = clean(body.lesson?.title).slice(0, 200);
    const text = String(body.lesson?.text ?? "").trim().slice(0, MAX_TEXT);
    const file = body.file && typeof body.file.data === "string" ? body.file : null;
    if (file && file.data.length > MAX_FILE) return json({ error: "الملف أكبر من 5 م.ب" }, 400);
    if (file && !["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.media_type)) return json({ error: "الملف PDF أو صورة فقط" }, 400);
    if (!text && !file) return json({ error: "الصق نص الدرس أو ارفع صفحاته" }, 400);
    const n = (k: string, max: number) => Math.max(0, Math.min(max, Number(body.counts?.[k]) || 0));
    const counts = { mcq: n("mcq", 30), truefalse: n("truefalse", 30), match: n("match", 4) };
    const total = counts.mcq + counts.truefalse + counts.match;
    if (!total || total > 30) return json({ error: "اختر من 1 إلى 30 سؤالًا" }, 400);
    const paper = quiz.mode === "paper";
    const nOpts = paper ? 4 : 3;
    const pairsMax = paper ? 8 : 5;
    const en = quiz.lang === "en";

    const system = [
      "أنت معدّ اختبارات خبير لطلاب المرحلة الثانوية في المملكة العربية السعودية، وفق المنهج السعودي.",
      "تكتب أسئلة من محتوى الدرس المعطى وحده، فلا تسأل عن معلومة غير موجودة فيه.",
      en ? "اكتب الأسئلة والخيارات بالإنجليزية لأن الاختبار بالإنجليزية، والشرح (explanation) بالعربية." : "اكتب بالعربية الفصحى الواضحة المناسبة لطالب ثانوي.",
      "قواعد الجودة:",
      "- لكل سؤال إجابة صحيحة واحدة لا خلاف فيها، والمشتّتات معقولة من موضوع الدرس نفسه وليست سخيفة.",
      "- لا تستعمل «جميع ما سبق» ولا «لا شيء مما سبق»، ولا تجعل الإجابة الصحيحة أطول الخيارات دائمًا.",
      "- نص السؤال قصير ومباشر، ولا يكشف الإجابة، ولا يتكرر سؤالان بمعنى واحد.",
      "- عبارات الصح والخطأ متوازنة بين الصحيحة والخاطئة، والخاطئة خطؤها واضح لمن فهم الدرس.",
      `- المزاوجة: من 3 إلى ${Math.min(5, pairsMax)} أزواج، كل عنصر يقابله عنصر واحد فقط، وكلها من مجال واحد. نص السؤال تعليمات قصيرة مثل «زاوج بين المصطلح وتعريفه».`,
      "- explanation: سطر واحد يبيّن سبب صحة الإجابة للمعلم المراجع.",
      "تعبئة الحقول:",
      `- mcq: options فيها ${nOpts} خيارات بالضبط، وcorrect_index رقم الصحيح بدءًا من 0، وis_true=false، وpairs فارغة.`,
      "- truefalse: text هي العبارة، وis_true صحتها، وoptions فارغة، وcorrect_index=0، وpairs فارغة.",
      "- match: pairs الأزواج الصحيحة (left يقابله right)، وoptions فارغة، وcorrect_index=0، وis_true=false.",
    ].join("\n");

    const ask = [
      title && `الدرس: ${title}`,
      quiz.subject_name && `المادة: ${quiz.subject_name}`,
      `المطلوب: ${counts.mcq} اختيار من متعدد، و${counts.truefalse} صح وخطأ، و${counts.match} مزاوجة.`,
      `مستوى الأسئلة: ${LEVEL[body.level] ?? LEVEL.mixed}`,
      text && `محتوى الدرس:\n${text}`,
      file && !text && "محتوى الدرس في الملف المرفق.",
    ].filter(Boolean).join("\n\n");

    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (file) {
      content.push(file.media_type === "application/pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.data } }
        : { type: "image", source: { type: "base64", media_type: file.media_type, data: file.data } });
    }
    content.push({ type: "text", text: ask });

    const client = new Anthropic();
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",                          // إن اعتذر النموذج يُعاد الطلب على نموذج بديل في الخادم
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      system,
      messages: [{ role: "user", content }],
    } as Anthropic.Beta.MessageCreateParamsNonStreaming);

    if (res.stop_reason === "refusal") return json({ error: "اعتذر المساعد عن هذا المحتوى. جرّب نصًا آخر من الدرس." }, 422);
    if (res.stop_reason === "max_tokens") return json({ error: "الطلب أطول من المسموح. قلّل عدد الأسئلة." }, 422);
    const out = res.content.find((b) => b.type === "text");
    let parsed: { questions?: Record<string, unknown>[] } = {};
    try { parsed = JSON.parse(out && "text" in out ? out.text : "{}"); } catch { return json({ error: "تعذّر قراءة النتيجة، أعد المحاولة" }, 502); }

    // التحويل إلى صيغة البوابة، مع خلط الخيارات وعمود المزاوجة، وإسقاط الناقص
    const questions = (parsed.questions ?? []).map((q) => {
      const kind = q.kind, qt = clean(q.text), explanation = clean(q.explanation);
      if (!qt) return null;
      if (kind === "mcq") {
        const opts = (q.options as string[] ?? []).map(clean).filter(Boolean).slice(0, nOpts);
        const right = opts[Number(q.correct_index)];
        if (opts.length !== nOpts || !right || new Set(opts).size !== opts.length) return null;
        const mixed = shuffle(opts);
        return { kind, text: qt, options: mixed, answer: String(mixed.indexOf(right)), explanation };
      }
      if (kind === "truefalse") return { kind, text: qt, options: null, answer: q.is_true ? "true" : "false", explanation };
      if (kind === "match") {
        const pairs = (q.pairs as { left: string; right: string }[] ?? [])
          .map((p) => ({ left: clean(p.left), right: clean(p.right) })).filter((p) => p.left && p.right).slice(0, pairsMax);
        if (pairs.length < 2) return null;
        const order = shuffle(pairs.map((_, i) => i));        // order[k] = الزوج الذي يقع في الموضع k من العمود الثاني
        const answer = Object.fromEntries(pairs.map((_, i) => [String(i), String(order.indexOf(i))]));
        return { kind, text: qt, options: { left: pairs.map((p) => p.left), right: order.map((i) => pairs[i].right) }, answer, explanation };
      }
      return null;
    }).filter(Boolean);

    const model = res.model || MODEL;
    const [pi, po] = PRICE[model] ?? PRICE[MODEL] ?? [0, 0];
    const inTok = res.usage.input_tokens ?? 0, outTok = res.usage.output_tokens ?? 0;
    const cost = (inTok * pi + outTok * po) / 1e6;
    await admin.from("ai_usage").insert({ user_id: actor.id, task: "quiz_questions", ref_id: quiz.id, model,
      input_tokens: inTok, output_tokens: outTok, cost_usd: Number(cost.toFixed(4)), items: questions.length });

    return json({ ok: true, questions, model, used: (quota?.used ?? 0) + 1, limit: quota?.limit ?? null });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return json({ error: "المساعد مشغول الآن، أعد المحاولة بعد دقيقة" }, 429);
    if (e instanceof Anthropic.AuthenticationError) return json({ error: "مفتاح Claude غير صالح. راجع الدعم الفني." }, 503);
    if (e instanceof Anthropic.APIError) return json({ error: `خطأ من خدمة Claude (${e.status}): ${e.message}` }, 502);
    return json({ error: String(e) }, 500);
  }
});
// نهاية الملف ai-assistant
