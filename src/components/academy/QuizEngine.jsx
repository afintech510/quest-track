import { useState, useRef, useCallback } from 'react';
import { ArrowLeft, Trophy, Sunrise, Coins } from 'lucide-react';
import LoadingQuiz from '../shared/LoadingQuiz';
import QuizQuestion from './QuizQuestion';
import { fireConfetti } from '../shared/ConfettiCanvas';
import { queueMutation } from '../../lib/offlineCache';
import fallbackBank from '../../data/fallbackQuizBank.json';

const CLIENT_TIMEOUT_MS = 7000;

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function loadClientFallback(moduleId) {
  const moduleQuestions = fallbackBank.filter(q => q.module_id === moduleId);
  if (moduleQuestions.length === 0) return fallbackBank.slice(0, 3);
  return shuffleArray(moduleQuestions).slice(0, 3);
}

export default function QuizEngine({
  lesson,
  module,
  skippedVideo,
  activeKid,
  supabase,
  isOnline,
  showToast,
  triggerLevelUp,
  refreshData,
  onBack,
}) {
  const [quizState, setQuizState] = useState('loading');
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [results, setResults] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const inFlightRef = useRef(false);
  const abortRef = useRef(null);
  const resultsCardRef = useRef(null);
  const startedRef = useRef(false);

  const startQuiz = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    const controller = new AbortController();
    abortRef.current = controller;
    const clientTimeout = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const mutationId = crypto.randomUUID();

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-quiz`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          kid_id: activeKid?.id,
          lesson_id: lesson.id,
          difficulty: 'bronze',
          question_count: 3,
          mutation_id: mutationId,
        }),
        signal: controller.signal,
      });
      clearTimeout(clientTimeout);

      const data = await response.json();

      if (data.source === 'client_fallback' || !data.questions?.length) {
        setQuestions(loadClientFallback(module.id));
      } else {
        setQuestions(data.questions);
      }
      setQuizState('active');
    } catch (_err) {
      clearTimeout(clientTimeout);
      setQuestions(loadClientFallback(module.id));
      setQuizState('active');
    } finally {
      inFlightRef.current = false;
    }
  }, [lesson, module, activeKid]);

  if (!startedRef.current) {
    startedRef.current = true;
    startQuiz();
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
    setQuizState('results');

    const correctCount = finalAnswers.filter(a => a.isCorrect).length;
    const revealedCount = finalAnswers.filter(a => a.wasRevealed).length;
    const score = correctCount;
    const maxScore = questions.length;
    const mutationId = crypto.randomUUID();

    const baseXp = correctCount * 10 + revealedCount * 5;
    const baseCoins = correctCount * 5 + revealedCount * 2;
    const effectiveScore = skippedVideo ? Math.ceil((correctCount + revealedCount * 0.5) / 2) : correctCount;
    const effectiveXp = skippedVideo ? Math.floor(baseXp / 2) : baseXp;
    const effectiveCoins = skippedVideo ? Math.floor(baseCoins / 2) : baseCoins;

    if (!isOnline || !supabase) {
      setResults({
        score,
        maxScore,
        xpAwarded: effectiveXp,
        coinsAwarded: effectiveCoins,
        earlyBirdActive: false,
        leveledUp: false,
        offline: true,
      });

      await queueMutation({
        mutation_id: mutationId,
        rpc_name: 'submit_quiz',
        params: {
          p_kid_id: activeKid?.id,
          p_lesson_id: lesson.id,
          p_answers: JSON.stringify(finalAnswers),
          p_questions: JSON.stringify(questions),
          p_score: effectiveScore,
          p_max_score: maxScore,
          p_difficulty_tier: 'bronze',
          p_mutation_id: mutationId,
        },
      });

      if (score > maxScore / 2) fireConfetti(resultsCardRef.current);
      setSubmitting(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('submit_quiz', {
        p_kid_id: activeKid?.id,
        p_lesson_id: lesson.id,
        p_answers: JSON.stringify(finalAnswers),
        p_questions: JSON.stringify(questions),
        p_score: effectiveScore,
        p_max_score: maxScore,
        p_difficulty_tier: 'bronze',
        p_mutation_id: mutationId,
      });

      if (error) {
        showToast('Could not save quiz results. Try again!', 'error');
        setResults({
          score,
          maxScore,
          xpAwarded: effectiveXp,
          coinsAwarded: effectiveCoins,
          earlyBirdActive: false,
          leveledUp: false,
        });
      } else if (data?.status === 'success') {
        setResults({
          score,
          maxScore,
          xpAwarded: data.xp_awarded,
          coinsAwarded: data.coins_awarded,
          earlyBirdActive: data.early_bird_active,
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
          earlyBirdActive: false,
          leveledUp: false,
        });
      }

      if (score > maxScore / 2) fireConfetti(resultsCardRef.current);
    } catch (_err) {
      showToast('Saving results offline — will sync when connected!', 'info');
      await queueMutation({
        mutation_id: mutationId,
        rpc_name: 'submit_quiz',
        params: {
          p_kid_id: activeKid?.id,
          p_lesson_id: lesson.id,
          p_answers: JSON.stringify(finalAnswers),
          p_questions: JSON.stringify(questions),
          p_score: effectiveScore,
          p_max_score: maxScore,
          p_difficulty_tier: 'bronze',
          p_mutation_id: mutationId,
        },
      });

      setResults({
        score,
        maxScore,
        xpAwarded: effectiveXp,
        coinsAwarded: effectiveCoins,
        earlyBirdActive: false,
        leveledUp: false,
        offline: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (quizState === 'loading') {
    return <LoadingQuiz onCancel={handleCancel} />;
  }

  if (quizState === 'active' && questions.length > 0) {
    return (
      <div className="max-w-lg mx-auto">
        <QuizQuestion
          key={currentIndex}
          question={questions[currentIndex]}
          questionIndex={currentIndex}
          totalQuestions={questions.length}
          onAnswer={handleAnswer}
        />
      </div>
    );
  }

  if (quizState === 'results' && results) {
    const pct = results.maxScore > 0 ? Math.round((results.score / results.maxScore) * 100) : 0;

    return (
      <div className="max-w-md mx-auto text-center space-y-6" ref={resultsCardRef}>
        <Trophy size={48} className={`mx-auto ${pct >= 80 ? 'text-amber-400' : pct >= 50 ? 'text-slate-300' : 'text-slate-500'}`} />

        <div>
          <p className="font-fredoka text-3xl text-white">
            {pct >= 80 ? 'Amazing!' : pct >= 50 ? 'Great effort!' : 'Keep learning!'}
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

        {results.earlyBirdActive && (
          <div className="bg-gradient-to-r from-amber-400/20 to-rose-400/20 rounded-xl p-4 border border-amber-500/30">
            <div className="flex items-center justify-center gap-2">
              <Sunrise size={20} className="text-amber-400" />
              <p className="font-fredoka text-base text-amber-300">Early Bird Bonus!</p>
            </div>
            <p className="font-quicksand text-xs text-slate-300 mt-1">
              Doubled XP + 20 bonus coins for studying early
            </p>
          </div>
        )}

        {skippedVideo && (
          <p className="font-quicksand text-xs text-amber-400">
            Rewards reduced — try watching the full video next time!
          </p>
        )}

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
          Back to Lessons
        </button>
      </div>
    );
  }

  return null;
}
