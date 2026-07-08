import { useState, useRef, useCallback } from 'react';
import { ArrowLeft, Trophy, Coins, BookOpen, ArrowRight, Send } from 'lucide-react';
import QuizQuestion from '../academy/QuizQuestion';
import LoadingQuiz from '../shared/LoadingQuiz';
import { fireConfetti } from '../shared/ConfettiCanvas';
import { queueMutation } from '../../lib/offlineCache';
import { CHECKPOINT_CLIENT_TIMEOUT_MS } from '../../lib/constants';
import fallbackBank from '../../data/fallbackCheckpointBank.json';

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function loadClientFallback() {
  return shuffleArray(fallbackBank).slice(0, 3);
}

function OpenResponseQuestion({ question, questionIndex, totalQuestions, onAnswer }) {
  const [response, setResponse] = useState('');

  const handleSubmit = () => {
    onAnswer({ questionIndex, attempts: 1, selectedIndex: -1, isCorrect: true, openResponse: response.trim() });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="font-quicksand text-xs text-slate-400">
          Question {questionIndex + 1} of {totalQuestions}
        </span>
      </div>
      <p className="font-fredoka text-lg text-white">{question.question}</p>
      <textarea
        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-white font-quicksand text-sm placeholder-slate-500 focus:outline-none focus:border-primary resize-none"
        rows={3}
        placeholder="Share your thoughts..."
        value={response}
        onChange={e => setResponse(e.target.value)}
        maxLength={300}
      />
      <button
        className="tv-focusable flex items-center gap-2 mx-auto px-5 py-2 rounded-xl bg-primary text-white font-quicksand text-sm hover:bg-primary/80 transition-colors disabled:opacity-50"
        onClick={handleSubmit}
        disabled={!response.trim()}
      >
        <Send size={14} />
        {questionIndex + 1 < totalQuestions ? 'Next Question' : 'See Results'}
        <ArrowRight size={16} />
      </button>
    </div>
  );
}

// SPEC-AMBIGUITY: checkpoint reward mechanism — using complete_checkpoint RPC
export default function ChapterCheckpoint({
  book,
  progress,
  activeKid,
  supabase,
  isOnline,
  showToast,
  triggerLevelUp,
  refreshData,
  onBack,
}) {
  const [state, setState] = useState('loading');
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [results, setResults] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const inFlightRef = useRef(false);
  const abortRef = useRef(null);
  const resultsCardRef = useRef(null);
  const startedRef = useRef(false);

  const chapterNumber = progress?.current_chapter || 1;

  const startCheckpoint = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;
    const clientTimeout = setTimeout(() => controller.abort(), CHECKPOINT_CLIENT_TIMEOUT_MS);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-checkpoint`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kid_id: activeKid?.id,
          book_id: book.id,
          chapter_number: chapterNumber,
          kid_name: activeKid?.name || 'Reader',
          device_type: 'tv',
        }),
        signal: controller.signal,
      });
      clearTimeout(clientTimeout);

      const data = await response.json();

      if (data.source === 'client_fallback' || !data.questions?.length) {
        setQuestions(loadClientFallback());
      } else {
        setQuestions(data.questions);
      }
      setState('active');
    } catch (_err) {
      clearTimeout(clientTimeout);
      setQuestions(loadClientFallback());
      setState('active');
    } finally {
      inFlightRef.current = false;
    }
  }, [book, chapterNumber, activeKid]);

  if (!startedRef.current) {
    startedRef.current = true;
    startCheckpoint();
  }

  const handleCancel = () => {
    abortRef.current?.abort();
    inFlightRef.current = false;
    onBack();
  };

  const handleAnswer = (answer) => {
    const newAnswers = [...answers, answer];
    setAnswers(newAnswers);

    if (currentIndex + 1 < questions.length) {
      setCurrentIndex(currentIndex + 1);
    } else {
      submitResults(newAnswers);
    }
  };

  const submitResults = async (finalAnswers) => {
    setSubmitting(true);
    setState('results');

    const correctCount = finalAnswers.filter(a => a.isCorrect).length;
    const revealedCount = finalAnswers.filter(a => a.wasRevealed).length;
    const score = correctCount;
    const maxScore = questions.length;
    const mutationId = crypto.randomUUID();

    const baseXp = correctCount * 10 + revealedCount * 5;
    const baseCoins = correctCount * 5 + revealedCount * 2;

    if (!isOnline || !supabase || !progress) {
      setResults({
        score,
        maxScore,
        xpAwarded: baseXp,
        coinsAwarded: baseCoins,
        leveledUp: false,
        offline: true,
      });

      if (progress) {
        await queueMutation({
          mutation_id: mutationId,
          rpc_name: 'complete_checkpoint',
          params: {
            p_book_progress_id: progress.id,
            p_chapter_number: chapterNumber,
            p_questions: JSON.stringify(questions),
            p_answers: JSON.stringify(finalAnswers),
            p_score: score,
            p_max_score: maxScore,
            p_mutation_id: mutationId,
          },
        });
      }

      if (score > maxScore / 2) fireConfetti(resultsCardRef.current);
      setSubmitting(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('complete_checkpoint', {
        p_book_progress_id: progress.id,
        p_chapter_number: chapterNumber,
        p_questions: JSON.stringify(questions),
        p_answers: JSON.stringify(finalAnswers),
        p_score: score,
        p_max_score: maxScore,
        p_mutation_id: mutationId,
      });

      if (error) {
        showToast('Could not save checkpoint results. Try again!', 'error');
        setResults({
          score,
          maxScore,
          xpAwarded: baseXp,
          coinsAwarded: baseCoins,
          leveledUp: false,
        });
      } else if (data?.status === 'success') {
        setResults({
          score,
          maxScore,
          xpAwarded: data.xp_awarded,
          coinsAwarded: data.coins_awarded,
          leveledUp: data.leveled_up,
        });

        if (data.leveled_up) {
          triggerLevelUp(activeKid.name, data.level, activeKid.color);
        }

        refreshData();
      } else if (data?.status === 'already_processed') {
        setResults({
          score,
          maxScore,
          xpAwarded: 0,
          coinsAwarded: 0,
          leveledUp: false,
        });
      }

      if (score > maxScore / 2) fireConfetti(resultsCardRef.current);
    } catch (_err) {
      showToast('Saving locally — will sync when online!', 'info');
      await queueMutation({
        mutation_id: mutationId,
        rpc_name: 'complete_checkpoint',
        params: {
          p_book_progress_id: progress.id,
          p_chapter_number: chapterNumber,
          p_questions: JSON.stringify(questions),
          p_answers: JSON.stringify(finalAnswers),
          p_score: score,
          p_max_score: maxScore,
          p_mutation_id: mutationId,
        },
      });

      setResults({
        score,
        maxScore,
        xpAwarded: baseXp,
        coinsAwarded: baseCoins,
        leveledUp: false,
        offline: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (state === 'loading') {
    return (
      <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="absolute inset-2 rounded-full bg-primary/30 animate-pulse" />
            <div className="absolute inset-0 flex items-center justify-center">
              <BookOpen size={40} className="text-primary animate-pulse" />
            </div>
          </div>
          <p className="font-fredoka text-2xl text-white mb-2">
            Preparing questions about Chapter {chapterNumber}...
          </p>
          <p className="font-quicksand text-sm text-slate-400 mb-8">
            Let's see what you remember!
          </p>
          <button
            className="tv-focusable px-5 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-quicksand text-sm hover:bg-slate-700 transition-colors"
            onClick={handleCancel}
          >
            &larr; Back to Book
          </button>
        </div>
      </div>
    );
  }

  if (state === 'active' && questions.length > 0) {
    const currentQ = questions[currentIndex];
    const isOpenResponse = !currentQ.options || currentQ.options.length === 0;

    return (
      <div className="max-w-lg mx-auto">
        <div className="mb-4">
          <p className="font-quicksand text-xs text-slate-400">
            📖 {book.title} — Chapter {chapterNumber} Checkpoint
          </p>
        </div>
        {isOpenResponse ? (
          <OpenResponseQuestion
            key={currentIndex}
            question={currentQ}
            questionIndex={currentIndex}
            totalQuestions={questions.length}
            onAnswer={handleAnswer}
          />
        ) : (
          <QuizQuestion
            key={currentIndex}
            question={currentQ}
            questionIndex={currentIndex}
            totalQuestions={questions.length}
            onAnswer={handleAnswer}
          />
        )}
      </div>
    );
  }

  if (state === 'results' && results) {
    const pctScore = results.maxScore > 0 ? Math.round((results.score / results.maxScore) * 100) : 0;

    return (
      <div className="max-w-md mx-auto text-center space-y-6" ref={resultsCardRef}>
        <Trophy size={48} className={`mx-auto ${pctScore >= 80 ? 'text-amber-400' : pctScore >= 50 ? 'text-slate-300' : 'text-slate-500'}`} />

        <div>
          <p className="font-fredoka text-3xl text-white">
            {pctScore >= 80 ? 'Amazing reader!' : pctScore >= 50 ? 'Great effort!' : 'Keep reading!'}
          </p>
          <p className="font-quicksand text-sm text-slate-400 mt-1">
            You got {results.score} out of {results.maxScore} correct
          </p>
        </div>

        <div className="flex justify-center gap-6">
          <div className="text-center">
            <p className="font-fredoka text-2xl text-primary">{results.xpAwarded}</p>
            <p className="font-quicksand text-xs text-slate-400">XP earned</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1">
              <Coins size={18} className="text-amber-400" />
              <p className="font-fredoka text-2xl text-amber-400">{results.coinsAwarded}</p>
            </div>
            <p className="font-quicksand text-xs text-slate-400">Coins earned</p>
          </div>
        </div>

        {results.offline && (
          <p className="font-quicksand text-xs text-slate-500">
            Results saved offline — rewards will sync when connected
          </p>
        )}

        {submitting && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="font-quicksand text-xs text-slate-400">Saving results...</p>
          </div>
        )}

        <button
          className="tv-focusable inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-fredoka text-base hover:bg-primary/80 transition-colors"
          onClick={onBack}
        >
          <ArrowLeft size={18} />
          Keep Reading!
        </button>
      </div>
    );
  }

  return null;
}
