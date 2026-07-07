import { useState, useEffect, useRef } from 'react';
import { Star, Zap, ArrowRight } from 'lucide-react';

const CORRECT_MESSAGES = ['Amazing!', 'You got it!', 'Great thinking!'];
const RETRY_MESSAGES = ['Not quite! Try again!', 'Almost! Give it another shot!', 'Close! Try once more!'];
const REVEAL_PREFIX = "Here's the answer!";
const MAX_RETRIES = 2;
const AUTO_ADVANCE_CORRECT_MS = 2000;
const AUTO_ADVANCE_REVEAL_MS = 3000;

export default function QuizQuestion({ question, questionIndex, totalQuestions, onAnswer }) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [state, setState] = useState('answering');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const advanceTimerRef = useRef(null);

  useEffect(() => {
    return () => clearTimeout(advanceTimerRef.current);
  }, []);

  const handleSelect = (index) => {
    if (state === 'correct' || state === 'revealed' || state === 'feedback') return;

    setSelectedIndex(index);

    if (index === question.correct_index) {
      setState('correct');
      setFeedbackMessage(CORRECT_MESSAGES[questionIndex % CORRECT_MESSAGES.length]);
      advanceTimerRef.current = setTimeout(() => {
        onAnswer({ questionIndex, attempts: attempts + 1, selectedIndex: index, isCorrect: true });
      }, AUTO_ADVANCE_CORRECT_MS);
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);

      if (newAttempts >= MAX_RETRIES) {
        setState('revealed');
        setFeedbackMessage(`${REVEAL_PREFIX} ${question.explanation}`);
        advanceTimerRef.current = setTimeout(() => {
          onAnswer({ questionIndex, attempts: newAttempts, selectedIndex: index, isCorrect: false, wasRevealed: true });
        }, AUTO_ADVANCE_REVEAL_MS);
      } else {
        setState('feedback');
        setFeedbackMessage(RETRY_MESSAGES[newAttempts % RETRY_MESSAGES.length]);
        setTimeout(() => {
          setSelectedIndex(null);
          setState('answering');
          setFeedbackMessage('');
        }, 1200);
      }
    }
  };

  const handleAdvance = () => {
    clearTimeout(advanceTimerRef.current);
    if (state === 'correct') {
      onAnswer({ questionIndex, attempts: attempts + 1, selectedIndex, isCorrect: true });
    } else if (state === 'revealed') {
      onAnswer({ questionIndex, attempts, selectedIndex, isCorrect: false });
    }
  };

  const getOptionStyle = (index) => {
    const base = 'tv-focusable w-full text-left px-4 py-3 rounded-xl font-quicksand text-sm transition-all';
    if ((state === 'correct' || state === 'revealed') && index === question.correct_index) {
      return `${base} bg-emerald-600 text-white ring-2 ring-emerald-400`;
    }
    if (state === 'revealed' && index === selectedIndex && index !== question.correct_index) {
      return `${base} bg-slate-700 text-slate-400`;
    }
    if (state === 'feedback' && index === selectedIndex) {
      return `${base} bg-amber-600/30 text-amber-200 ring-1 ring-amber-500`;
    }
    return `${base} bg-slate-800 text-slate-200 hover:bg-slate-700`;
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="font-quicksand text-xs text-slate-400">
          Question {questionIndex + 1} of {totalQuestions}
        </span>
        {attempts > 0 && state === 'answering' && (
          <span className="font-quicksand text-xs text-amber-400">
            Attempt {attempts + 1}
          </span>
        )}
      </div>

      <p className="font-fredoka text-lg text-white">{question.question}</p>

      <div className="space-y-2">
        {question.options.map((option, i) => (
          <button
            key={i}
            className={getOptionStyle(i)}
            onClick={() => handleSelect(i)}
            disabled={state === 'correct' || state === 'revealed' || state === 'feedback'}
          >
            {option}
          </button>
        ))}
      </div>

      {feedbackMessage && (
        <div className={`rounded-xl p-4 text-center ${
          state === 'correct'
            ? 'bg-emerald-900/40 border border-emerald-700'
            : state === 'revealed'
            ? 'bg-indigo-900/40 border border-indigo-700'
            : 'bg-amber-900/40 border border-amber-700'
        }`}>
          <p className="font-fredoka text-base text-white flex items-center justify-center gap-2">
            {state === 'correct' && <Star size={18} className="text-amber-400" />}
            {state === 'revealed' && <Zap size={18} className="text-indigo-400" />}
            {feedbackMessage}
          </p>
          {state === 'correct' && (
            <p className="font-quicksand text-xs text-slate-300 mt-2">{question.explanation}</p>
          )}
        </div>
      )}

      {(state === 'correct' || state === 'revealed') && (
        <button
          className="tv-focusable flex items-center gap-2 mx-auto px-5 py-2 rounded-xl bg-primary text-white font-quicksand text-sm hover:bg-primary/80 transition-colors"
          onClick={handleAdvance}
        >
          {questionIndex + 1 < totalQuestions ? 'Next Question' : 'See Results'}
          <ArrowRight size={16} />
        </button>
      )}
    </div>
  );
}
