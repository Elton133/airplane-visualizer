"use client";

import { useMemo } from "react";
import { motion } from "motion/react";
import { ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { getAircraft } from "@/aircraft/registry";
import { currentQuestion, quizBest, quizNext, quizReveal, setMode, startQuiz } from "@/state/controller";
import { useHangar } from "@/state/store";
import { Icon } from "./Icon";

/**
 * QUIZ: labels off, find the part on the aircraft itself. Wrong picks name
 * what was clicked, so a miss still teaches something.
 */
export function QuizPanel() {
  const quiz = useHangar((s) => s.quiz);
  const def = getAircraft(useHangar((s) => s.aircraftId));
  const question = useMemo(() => currentQuestion(), [quiz?.index, quiz?.order]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!quiz) return null;
  const pickedName = def.components.find((c) => c.id === quiz.picked)?.name;
  const total = quiz.order.length;

  return (
    <motion.section
      className="quiz"
      initial={{ opacity: 0, y: 10, x: "-50%" }}
      animate={{ opacity: 1, y: 0, x: "-50%" }}
      exit={{ opacity: 0, y: 10, x: "-50%" }}
      transition={{ duration: 0.22 }}
      aria-live="polite"
    >
      {quiz.status === "done" ? (
        <Summary firstTry={quiz.firstTry} total={total} />
      ) : (
        question && (
          <>
            <div className="quiz-head">
              <span className="meta">
                QUIZ / {def.code} · {String(quiz.index + 1).padStart(2, "0")} OF {String(total).padStart(2, "0")}
              </span>
              <span className="meta">FIRST TRY {quiz.firstTry}</span>
            </div>
            <div className="quiz-progress">
              {quiz.order.map((id, i) => (
                <i key={id} data-state={i < quiz.index ? "done" : i === quiz.index ? "now" : "todo"} />
              ))}
            </div>
            <div className="quiz-kicker">{question.kicker}</div>
            <div className="quiz-prompt">{question.prompt}</div>

            {quiz.status === "asking" && <p className="quiz-hint meta">Rotate the aircraft and click the part.</p>}
            {quiz.status === "wrong" && (
              <p className="quiz-feedback wrong">
                <span className="mark">✕</span> That's the {pickedName?.toLowerCase() ?? "wrong part"}. Try again.
              </p>
            )}
            {(quiz.status === "correct" || quiz.status === "revealed") && (
              <p className="quiz-feedback right">
                <span className="mark">{quiz.status === "correct" ? "✓" : "→"}</span>
                <span>
                  <strong>{pickedName}</strong> — {question.explain}
                </span>
              </p>
            )}

            <div className="quiz-actions">
              {(quiz.status === "asking" || quiz.status === "wrong") && (
                <>
                  <button className="btn" onClick={quizReveal} disabled={quiz.misses < 2} title={quiz.misses < 2 ? "Available after two tries" : undefined}>
                    SHOW ME
                    {quiz.misses < 2 && <span className="tag">AFTER 2 TRIES</span>}
                  </button>
                  <button className="btn" onClick={quizNext}>
                    SKIP
                  </button>
                </>
              )}
              {(quiz.status === "correct" || quiz.status === "revealed") && (
                <button className="btn" data-variant="accent" onClick={quizNext}>
                  {quiz.index + 1 >= total ? "SEE RESULT" : "NEXT"}
                  <Icon icon={ArrowRight01Icon} size={14} />
                </button>
              )}
            </div>
          </>
        )
      )}
    </motion.section>
  );
}

function Summary({ firstTry, total }: { firstTry: number; total: number }) {
  const best = quizBest();
  return (
    <>
      <div className="quiz-head">
        <span className="meta">QUIZ / RESULT</span>
        {best !== null && <span className="meta">BEST {best} / {total}</span>}
      </div>
      <div className="quiz-score">
        {firstTry}
        <small> / {total}</small>
      </div>
      <p className="quiz-hint meta">Correct on the first try.</p>
      <div className="quiz-actions">
        <button className="btn" data-variant="accent" onClick={startQuiz}>
          NEW ROUND
          <Icon icon={ArrowRight01Icon} size={14} />
        </button>
        <button className="btn" onClick={() => setMode("explore")}>
          BACK TO EXPLORE
        </button>
      </div>
    </>
  );
}
