import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { FAMILY_ID } from '../lib/constants';
import { cacheState, getCachedState, getPendingMutations, clearMutation, getPendingCount } from '../lib/offlineCache';

const REALTIME_TABLES = ['kids', 'chore_events', 'calendar_events', 'books', 'book_progress', 'reading_checkpoints', 'quiz_attempts', 'reward_redemptions'];

export default function useSupabase() {
  const [kids, setKids] = useState([]);
  const [choreEvents, setChoreEvents] = useState([]);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [books, setBooks] = useState([]);
  const [bookProgress, setBookProgress] = useState([]);
  const [readingCheckpoints, setReadingCheckpoints] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [modules, setModules] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [quizAttempts, setQuizAttempts] = useState([]);
  const [systemState, setSystemState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingMutationCount, setPendingMutationCount] = useState(0);
  const channelRef = useRef(null);

  const fetchData = useCallback(async () => {
    try {
      const [kidsRes, choreRes, calRes, booksRes, bookRes, checkpointRes, rewardsRes, modulesRes, lessonsRes, quizRes, stateRes] = await Promise.all([
        supabase.from('kids').select('*').eq('family_id', FAMILY_ID),
        supabase.from('chore_events').select('*, chore_definitions(*)').order('created_at', { ascending: false }),
        supabase.from('calendar_events').select('*').eq('family_id', FAMILY_ID),
        supabase.from('books').select('*'),
        supabase.from('book_progress').select('*'),
        supabase.from('reading_checkpoints').select('*'),
        supabase.from('rewards').select('*').eq('family_id', FAMILY_ID).eq('is_active', true),
        supabase.from('modules').select('*').order('subject').order('sort_order'),
        supabase.from('lessons').select('*').is('deleted_at', null).order('sort_order'),
        supabase.from('quiz_attempts').select('id, kid_id, lesson_id, module_id, score, total'),
        supabase.from('system_state').select('*').eq('family_id', FAMILY_ID).single(),
      ]);

      const kidsData = kidsRes.data || [];
      const choreData = choreRes.data || [];
      const calData = calRes.data || [];
      const booksData = booksRes.data || [];
      const bookData = bookRes.data || [];
      const checkpointData = checkpointRes.data || [];
      const rewardsData = rewardsRes.data || [];
      const modulesData = modulesRes.data || [];
      const lessonsData = lessonsRes.data || [];
      const quizData = quizRes.data || [];

      setKids(kidsData);
      setChoreEvents(choreData);
      setCalendarEvents(calData);
      setBooks(booksData);
      setBookProgress(bookData);
      setReadingCheckpoints(checkpointData);
      setRewards(rewardsData);
      setModules(modulesData);
      setLessons(lessonsData);
      setQuizAttempts(quizData);
      setSystemState(stateRes.data);
      setError(null);

      await Promise.all([
        cacheState('kids', kidsData),
        cacheState('chore_events', choreData),
        cacheState('calendar_events', calData),
        cacheState('books', booksData),
        cacheState('book_progress', bookData),
        cacheState('reading_checkpoints', checkpointData),
        cacheState('rewards', rewardsData),
        cacheState('modules', modulesData),
        cacheState('lessons', lessonsData),
        cacheState('quiz_attempts', quizData),
      ]);
    } catch (err) {
      setError(err.message);
      const [cachedKids, cachedChores, cachedCal, cachedBooksAll, cachedBooks, cachedCheckpoints, cachedRewards, cachedModules, cachedLessons, cachedQuiz] = await Promise.all([
        getCachedState('kids'),
        getCachedState('chore_events'),
        getCachedState('calendar_events'),
        getCachedState('books'),
        getCachedState('book_progress'),
        getCachedState('reading_checkpoints'),
        getCachedState('rewards'),
        getCachedState('modules'),
        getCachedState('lessons'),
        getCachedState('quiz_attempts'),
      ]);
      setKids(cachedKids);
      setChoreEvents(cachedChores);
      setCalendarEvents(cachedCal);
      setBooks(cachedBooksAll);
      setBookProgress(cachedBooks);
      setReadingCheckpoints(cachedCheckpoints);
      setRewards(cachedRewards);
      setModules(cachedModules);
      setLessons(cachedLessons);
      setQuizAttempts(cachedQuiz);
    } finally {
      setLoading(false);
    }
  }, []);

  const replayMutations = useCallback(async () => {
    const pending = await getPendingMutations();
    for (const mutation of pending) {
      try {
        const { data, error: rpcError } = await supabase.rpc(mutation.rpc_name, mutation.params);
        if (!rpcError && data?.status !== 'error') {
          await clearMutation(mutation.mutation_id);
        }
      } catch {
        break;
      }
    }
    setPendingMutationCount(await getPendingCount());
  }, []);

  const refreshData = useCallback(async () => {
    if (navigator.onLine) {
      await replayMutations();
      await fetchData();
    }
  }, [fetchData, replayMutations]);

  useEffect(() => {
    fetchData();

    const channel = supabase.channel('family-sync');
    REALTIME_TABLES.forEach(table => {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        fetchData();
      });
    });
    channel.subscribe();
    channelRef.current = channel;

    const handleOnline = () => { setIsOnline(true); refreshData(); };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    getPendingCount().then(setPendingMutationCount);

    return () => {
      channel.unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchData, refreshData]);

  return {
    kids,
    choreEvents,
    calendarEvents,
    books,
    bookProgress,
    readingCheckpoints,
    rewards,
    modules,
    lessons,
    quizAttempts,
    systemState,
    loading,
    error,
    isOnline,
    pendingMutationCount,
    refreshData,
    supabase,
  };
}
