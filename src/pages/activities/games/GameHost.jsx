// src/pages/activities/games/GameHost.jsx
// تشغيل لعبة البطاقة على السبورة بملء الشاشة: حروف، أو مسابقة الفرق.
import { useEffect, useState } from "react";
import { loadSchoolFacts } from "../../../lib/schoolQuestions.js";
import Huroof from "./Huroof.jsx";
import TeamsQuiz from "./TeamsQuiz.jsx";

export const fullscreen = () => {
  const el = document.documentElement;
  if (document.fullscreenElement) document.exitFullscreen?.(); else el.requestFullscreen?.().catch(() => {});
};

export default function GameHost({ card, onClose }) {
  // «من مدرستي»: أسئلة من معلومات المدرسة تُدمج في اللعبة (تُجلب مرة، ودون إنترنت تُلعب بدونها)
  const [school, setSchool] = useState(undefined);
  useEffect(() => { loadSchoolFacts().then(setSchool); }, []);
  useEffect(() => {
    const h = (e) => {
      if (e.target.tagName === "INPUT") return;
      if (e.key === "f" || e.key === "F") fullscreen();
    };
    window.addEventListener("keydown", h);
    return () => { window.removeEventListener("keydown", h); if (document.fullscreenElement) document.exitFullscreen?.(); };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#F4F7F5]" dir="rtl">
      <div className="flex items-center gap-2 border-b border-line bg-white px-4 py-2">
        <p className="flex-1 truncate font-bold text-ink">{card.title}</p>
        <button type="button" className="btn-ghost py-1 text-sm" onClick={fullscreen}>ملء الشاشة (F)</button>
        <button type="button" className="btn-ghost py-1 text-sm" onClick={onClose}>خروج</button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {school !== undefined && card.game === "huroof" && <Huroof data={card.game_data} school={school} />}
        {school !== undefined && card.game === "teams_quiz" && <TeamsQuiz data={card.game_data} school={school} />}
      </div>
    </div>
  );
}
