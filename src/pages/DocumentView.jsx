// src/pages/DocumentView.jsx
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import FormSheet, { PrintArea, SHEET_PX } from "../components/FormSheet.jsx";
import DateField, { TimeField } from "../components/DateField.jsx";
import { useSession } from "../lib/session.jsx";
import Loader from "../components/Loader.jsx";
import { useNotice } from "../lib/useNotice.js";
import { ReplyFilesEditor, ReplyFilesList, REPLY_BUCKET } from "../components/ReplyFiles.jsx";

/* =====================================================================
   عرض مستند صادر لصاحبه: الطالب أو المنسوب أو ولي أمر الطالب،
   ومُصدِر المستند والدعم الفني ومدير المدرسة.
   صور التوقيع والختم تُجلب عبر دالة محميّة تتحقق من الصلاحية،
   فلا يُفتح مخزن التواقيع لبقية المستخدمين.
   ===================================================================== */

function SheetPreview({ landscape, children }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0.5);
  useLayoutEffect(() => {
    const fit = () => {
      const w = box.current?.clientWidth ?? 0;
      const sheet = landscape ? SHEET_PX.landscape : SHEET_PX.portrait;
      if (w) setScale(Math.min(1, Math.max(0.25, (w - 8) / sheet)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [landscape]);

  // ارتفاع المحتوى الفعلي — النموذج قد يكون أكثر من صفحة
  const inner = useRef(null);
  const [contentH, setContentH] = useState(landscape ? SHEET_PX.portrait : 1123);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(() => setContentH(el.offsetHeight || (landscape ? SHEET_PX.portrait : 1123)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [landscape]);

  const h = contentH * scale + 16;
  return (
    <div ref={box} className="w-full min-w-0 max-w-full overflow-hidden">
      <div className="min-w-0" style={{ height: h }}>
        <div className="w-0 min-w-0" style={{ transform: `scale(${scale})`, transformOrigin: "top center" }}>
          <div ref={inner} style={{ width: landscape ? SHEET_PX.landscape : SHEET_PX.portrait }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DocumentView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session, profile } = useSession();
  const [reply, setReply] = useState({});
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useNotice(null);
  const [mySig, setMySig] = useState(null);      // مسار توقيعي المحفوظ
  const [mySigUrl, setMySigUrl] = useState(null);
  const [signIt, setSignIt] = useState(true);
  const [ackChecked, setAckChecked] = useState(false);

  // ولي الأمر يقرّ بلا توقيع إلكتروني — الإقرار باسمه وتاريخه يكفي
  const isGuardianReply = profile?.role === "guardian";
  const [doc, setDoc] = useState(null);
  const [assets, setAssets] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error: e } = await supabase
        .from("form_documents")
        .select("*, form_templates(title, category, orientation, fields, key, signature_source)")
        .eq("id", id)
        .maybeSingle();

      if (e || !data) {
        setError("المستند غير موجود أو لا تملك صلاحية عرضه.");
        setLoading(false);
        return;
      }
      setDoc(data);
      setReply(data.data ?? {});

      // مرفقات رُفعت ثم غادر صاحبها قبل الإرسال — تبقى في المخزن فنستعيدها
      if (data.status === "awaiting_reply") {
        const { data: objs } = await supabase.storage.from(REPLY_BUCKET).list(data.id);
        const known = new Set((data.data?.reply_files ?? []).map((f) => f.path));
        const extra = (objs ?? [])
          .filter((o) => o.name && !known.has(`${data.id}/${o.name}`))
          .map((o, i) => ({
            path: `${data.id}/${o.name}`,
            name: `مرفق ${known.size + i + 1}${/\.pdf$/i.test(o.name) ? ".pdf" : ""}`,
            type: o.metadata?.mimetype ?? "",
            size: o.metadata?.size ?? 0,
          }));
        if (extra.length) {
          setReply((r) => ({ ...r, reply_files: [...(r.reply_files ?? []), ...extra] }));
        }
      }

      // توقيع المستخدم الحالي — ليُرفق بردّه إن رغب
      const uid = (await supabase.auth.getUser()).data?.user?.id;
      if (uid) {
        const { data: sig } = await supabase
          .from("user_signatures").select("path").eq("user_id", uid).maybeSingle();
        if (sig?.path) {
          setMySig(sig.path);
          const { data: su } = await supabase.storage
            .from("form-assets").createSignedUrl(sig.path, 600);
          setMySigUrl(su?.signedUrl ?? null);
        }
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/.netlify/functions/doc-assets", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token ?? ""}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ document_id: id }),
        });
        const j = await res.json();
        if (res.ok) setAssets(j);
      } catch { /* يُعرض المستند بلا صور التوقيع */ }

      setLoading(false);
    })();
  }, [id]);

  if (loading) return <Loader />;

  if (error) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold text-ink">تعذّر عرض المستند</p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-muted">{error}</p>
        <button onClick={() => navigate("/")}
                className="mt-4 rounded-pill border border-line px-4 py-1.5 text-sm text-muted hover:bg-canvas">
          العودة للرئيسية
        </button>
      </div>
    );
  }

  const template = { ...doc.form_templates, fields: doc.form_templates?.fields ?? [] };
  const myTurn =
    doc.status === "awaiting_reply" && doc.recipient_user_id === session?.user?.id;
  const replyFields = template.fields.filter((f) => f.by_recipient);

  const sendReply = async () => {
    const miss = replyFields.filter((f) => f.required && !String(reply[f.name] ?? "").trim());
    if (miss.length) {
      setMsg({ ok: false, text: `أكمل: ${miss.map((f) => f.label).join("، ")}` });
      return;
    }
    setSending(true);
    const patch = {
      data: { ...doc.data, ...reply },
      status: "replied",
      reply_at: new Date().toISOString(),
    };
    if (isGuardianReply) {
      // إقرار باسمه وتاريخه بلا صورة توقيع
      patch.reply_signature_path = null;
      patch.reply_signature_name = profile?.full_name ?? doc.recipient ?? "";
    } else if (signIt && mySig) {
      patch.reply_signature_path = mySig;
      patch.reply_signature_name = doc.recipient ?? "";
    }

    const { error } = await supabase.from("form_documents").update(patch).eq("id", doc.id);
    setSending(false);
    if (error) { setMsg({ ok: false, text: `تعذّر الإرسال: ${error.message}` }); return; }
    setDoc((d) => ({ ...d, status: "replied", data: { ...d.data, ...reply } }));
    setMsg({ ok: true, text: "أُرسلت إفادتك. ستصلك النتيجة بعد مراجعتها." });
  };
  const printable = doc.status === "issued" || doc.status === "approved";

  // إقرار المستفيد بالاطلاع (نماذج البنود كاستمارة دعم وتطوير الهيئة التعليمية)
  const needsAck = template.fields.some((f) => f.type === "rubric" || f.ack);
  const ackAt = doc.data?.ack_at ?? null;
  const isRecipient = doc.recipient_user_id === session?.user?.id;
  const ackTurn = needsAck && printable && isRecipient && !ackAt;
  const ackDate = (t) => new Date(t).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn",
    { year: "numeric", month: "2-digit", day: "2-digit" });

  const acknowledge = async () => {
    if (!ackChecked) { setMsg({ ok: false, text: "ضع علامة على الإقرار أولًا." }); return; }
    setSending(true);
    const withSig = !!(signIt && mySig);
    const { data: at, error } = await supabase.rpc("acknowledge_form_document", { p_doc: doc.id, p_sign: withSig });
    setSending(false);
    if (error) { setMsg({ ok: false, text: `تعذّر تسجيل الإقرار: ${error.message}` }); return; }
    const name = doc.recipient || profile?.full_name || "";
    setDoc((d) => ({ ...d, reply_at: at, reply_signature_name: name,
                     reply_signature_path: withSig ? mySig : null,
                     data: { ...d.data, ack_at: at } }));
    setAssets((a) => ({ ...a, reply_signature: withSig ? mySigUrl : null, reply_signature_name: name }));
    setMsg({ ok: true, text: "سُجّل اطلاعك على الاستمارة، ووصل الإشعار لمُصدِرها." });
  };
  const landscape = template.orientation === "landscape";

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold text-ink">{doc.title}</h1>
          <p className="num mt-0.5 text-xs text-faint">
            رقم المستند: {doc.serial}
            {doc.recipient ? ` · ${doc.recipient}` : ""}
          </p>
        </div>
        {printable ? (
          <button className="btn-primary" onClick={() => window.print()}>طباعة</button>
        ) : (
          <span className="chip bg-warning/10 text-warning">بانتظار الاعتماد</span>
        )}
      </div>

      {ackTurn && (
        <section className="no-print card space-y-3 border-mint-deep/30 p-4">
          <div>
            <p className="text-sm font-semibold text-ink">إقرار بالاطلاع على الاستمارة</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">
              راجع الاستمارة أدناه، ثم أكّد اطلاعك عليها. يُسجَّل إقرارك وتوقيعك فيها، ويصل مُصدِرَها إشعار بذلك.
            </p>
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-ink">
            <input type="checkbox" className="mt-1 accent-[#3E6350]" checked={ackChecked}
                   onChange={(e) => setAckChecked(e.target.checked)} />
            أقرّ بأني اطلعت على ما ورد في هذه الاستمارة من تقييم وجوانب دعم وتطوير.
          </label>
          <div className="rounded-sm2 border border-line p-3">
            <p className="text-xs font-semibold text-ink">التوقيع</p>
            {mySigUrl ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-1.5 text-sm text-muted">
                  <input type="checkbox" checked={signIt} onChange={(e) => setSignIt(e.target.checked)} />
                  أرفق توقيعي
                </label>
                {signIt && (
                  <img src={mySigUrl} alt="توقيعي"
                       className="h-12 w-auto rounded-sm2 border border-line bg-white object-contain px-2" />
                )}
              </div>
            ) : (
              <p className="mt-1.5 text-xs leading-relaxed text-warning">
                لم ترفع توقيعك بعد. يمكنك الإقرار بلا توقيع (يُسجَّل باسمك وتاريخه)، أو رفع توقيعك من صفحة «توقيعي» ثم العودة.
              </p>
            )}
          </div>
          <button className="btn-primary w-full" onClick={acknowledge} disabled={sending || !ackChecked}>
            {sending ? "جارٍ التسجيل…" : "تأكيد الاطلاع والتوقيع"}
          </button>
        </section>
      )}

      {needsAck && printable && ackAt && (
        <p className="no-print rounded-card bg-present/10 px-4 py-3 text-sm text-present">
          ✓ {isRecipient ? "اطلعت على الاستمارة" : `اطلع ${doc.recipient || "المستفيد"} على الاستمارة`}
          {" "}بتاريخ <span className="num">{ackDate(ackAt)}</span>
          {doc.reply_signature_path ? " ووقّعها." : "."}
        </p>
      )}
      {needsAck && printable && !ackAt && !isRecipient && (
        <p className="no-print rounded-card bg-warning/10 px-4 py-3 text-sm text-warning">
          لم يطّلع {doc.recipient || "المستفيد"} على الاستمارة بعد.
          {doc.sent_at ? "" : " أرسلها له من الأرشيف ليصله إشعار بها."}
        </p>
      )}

      {doc.decision_note && myTurn && (
        <div className="no-print rounded-card border border-warning/40 bg-warning/5 px-4 py-3">
          <p className="text-sm font-semibold text-warning">ملاحظة على إفادتك السابقة</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink">{doc.decision_note}</p>
        </div>
      )}

      {myTurn && (
        <section className="no-print card space-y-3 p-4">
          <div>
            <p className="text-sm font-semibold text-ink">مطلوب إفادتك</p>
            <p className="mt-0.5 text-xs text-muted">
              اكتب إفادتك ثم أرسلها، وستصل مُصدِر النموذج لمراجعتها.
            </p>
          </div>

          {replyFields.length === 0 && (
            <p className="rounded-sm2 bg-warning/10 px-3 py-2 text-xs leading-relaxed text-warning">
              تعذّر تحميل حقول الإفادة لهذا النموذج. أبلغ الدعم الفني ليتحقق من صلاحية قراءة
              القالب (supabase/form_templates_recipient_read.sql).
            </p>
          )}

          {replyFields.map((f) => (
            <div key={f.name}>
              <label className="text-xs text-muted">
                {f.label}{f.required && <span className="text-absent"> *</span>}
              </label>
              {f.type === "date" || f.type === "daterange" ? (
                <div className="mt-1">
                  <DateField range={f.type === "daterange"} value={reply[f.name] ?? ""}
                             onChange={(v) => setReply((r) => ({ ...r, [f.name]: v }))} />
                </div>
              ) : f.type === "time" || f.type === "timerange" ? (
                <div className="mt-1">
                  <TimeField range={f.type === "timerange"} value={reply[f.name] ?? ""}
                             onChange={(v) => setReply((r) => ({ ...r, [f.name]: v }))} />
                </div>
              ) : f.type === "textarea" ? (
                <>
                  {Array.isArray(f.presets) && f.presets.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {f.presets.map((t, i) => (
                        <button key={i} type="button" title={t}
                                onClick={() => setReply((r) => ({ ...r, [f.name]: t }))}
                                className="max-w-full truncate rounded-pill border border-[#CCF2DB] bg-mint-tint px-3 py-1 text-[11.5px] font-medium text-mint-deep hover:bg-[#CCF2DB]">
                          {t.length > 42 ? t.slice(0, 42) + "…" : t}
                        </button>
                      ))}
                    </div>
                  )}
                  <textarea rows={4} className="field mt-1 w-full" value={reply[f.name] ?? ""}
                            onChange={(e) => setReply((r) => ({ ...r, [f.name]: e.target.value }))} />
                </>
              ) : (
                <input className="field mt-1 w-full" value={reply[f.name] ?? ""}
                       onChange={(e) => setReply((r) => ({ ...r, [f.name]: e.target.value }))} />
              )}
            </div>
          ))}

          <ReplyFilesEditor docId={doc.id} files={reply.reply_files ?? []}
                            onChange={(f) => setReply((r) => ({ ...r, reply_files: f }))} />

          {/* التوقيع الإلكتروني على الرد — ولي الأمر يقرّ بلا توقيع */}
          {!isGuardianReply && (
            <div className="rounded-sm2 border border-line p-3">
              <p className="text-xs font-semibold text-ink">التوقيع على الرد</p>
              {mySigUrl ? (
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-sm text-muted">
                    <input type="checkbox" checked={signIt}
                           onChange={(e) => setSignIt(e.target.checked)} />
                    أرفق توقيعي
                  </label>
                  {signIt && (
                    <img src={mySigUrl} alt="توقيعي"
                         className="h-12 w-auto rounded-sm2 border border-line bg-white object-contain px-2" />
                  )}
                </div>
              ) : (
                <p className="mt-1.5 text-xs leading-relaxed text-warning">
                  لم ترفع توقيعك بعد. يمكنك إرسال الرد بلا توقيع، أو رفع توقيعك من صفحة «توقيعي» ثم العودة.
                </p>
              )}
            </div>

          )}

          {isGuardianReply && (
            <p className="rounded-sm2 bg-mint-tint px-3 py-2.5 text-xs leading-relaxed text-mint-deep">
              إرسالك للرد يُعدّ إقرارًا منك بالاطّلاع والموافقة، ويُسجَّل باسمك وتاريخه
              في المستند. ولا يُطلب منك توقيع إلكتروني.
            </p>
          )}

          <button className="btn-primary w-full" onClick={sendReply} disabled={sending}>
            {sending ? "جارٍ الإرسال…" : "إرسال الإفادة"}
          </button>

          {msg && (
            <p className={`rounded-sm2 px-3 py-2 text-sm ${
              msg.ok ? "bg-present/10 text-present" : "bg-absent/10 text-absent"}`}>
              {msg.text}
            </p>
          )}
        </section>
      )}

      {doc.status === "replied" && (
        <p className="no-print rounded-card bg-mint-tint px-4 py-3 text-sm text-mint-deep">
          وصلت إفادتك وهي قيد المراجعة.
        </p>
      )}

      {!myTurn && doc.data?.reply_files?.length > 0 && (
        <div className="no-print card p-4">
          <ReplyFilesList files={doc.data.reply_files} />
        </div>
      )}

      <div className="no-print">
        <SheetPreview landscape={landscape}>
          <FormSheet
            template={template} values={doc.data} doc={doc}
            sigUrl={assets.signature} stampUrl={assets.stamp}
            principalSigUrl={assets.principal} principalName={assets.principal_name}
            replySigUrl={assets.reply_signature} replySigName={assets.reply_signature_name}
          />
        </SheetPreview>
      </div>

      {printable && (
        <div className="hidden print:block">
          <PrintArea landscape={landscape}>
            <FormSheet
              template={template} values={doc.data} doc={doc}
              sigUrl={assets.signature} stampUrl={assets.stamp}
              principalSigUrl={assets.principal} principalName={assets.principal_name}
              replySigUrl={assets.reply_signature} replySigName={assets.reply_signature_name}
            />
          </PrintArea>
        </div>
      )}

      <p className="no-print text-xs leading-relaxed text-faint">
        هذه نسخة إلكترونية من المستند. للنسخة الرسمية الموقّعة راجع إدارة المدرسة.
      </p>
    </div>
  );
}
