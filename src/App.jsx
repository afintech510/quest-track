import { useState, useCallback, useEffect, useRef } from 'react';
import { ToastProvider, useToast } from './components/layout/Toast';
import { LevelUpProvider, useLevelUp } from './components/shared/LevelUpModal';
import Header from './components/layout/Header';
import ProfileSwitcher from './components/profiles/ProfileSwitcher';
import HeroStatsHUD from './components/profiles/HeroStatsHUD';
import RemoteEmulator from './components/layout/RemoteEmulator';
import FirstVisitHints from './components/onboarding/FirstVisitHints';
import QuestBoard from './components/quests/QuestBoard';
import CalendarView from './components/calendar/CalendarView';
import RewardGrid from './components/shop/RewardGrid';
import EarlyBirdBanner from './components/academy/EarlyBirdBanner';
import ModuleGrid from './components/academy/ModuleGrid';
import LessonPlayer from './components/academy/LessonPlayer';
import QuizEngine from './components/academy/QuizEngine';
import ProgressiveRamp from './components/admin/ProgressiveRamp';
import BookLibrary from './components/reading/BookLibrary';
import BookDetail from './components/reading/BookDetail';
import ChapterCheckpoint from './components/reading/ChapterCheckpoint';
import BookReflection from './components/reading/BookReflection';
import BookAssigner from './components/admin/BookAssigner';
import useSupabase from './hooks/useSupabase';
import useDeviceType from './hooks/useDeviceType';
import { fireConfetti } from './components/shared/ConfettiCanvas';
import useEconomy from './hooks/useEconomy';
import useCatchUpReset from './hooks/useCatchUpReset';
import useSpatialNav from './hooks/useSpatialNav';
import useVisibilityReconnect from './hooks/useVisibilityReconnect';
import useConnectionHealth from './hooks/useConnectionHealth';
import { Swords, GraduationCap, BookOpen, CalendarDays, ShoppingBag } from 'lucide-react';

const TABS = [
  { key: 'quests', label: 'Quest Board', icon: Swords },
  { key: 'academy', label: 'Academy', icon: GraduationCap },
  { key: 'reading', label: 'Reading Guild', icon: BookOpen },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'shop', label: 'Reward Shop', icon: ShoppingBag },
];

function AppContent() {
  const [activeProfileId, setActiveProfileId] = useState(undefined);
  const [activeTab, setActiveTab] = useState('quests');
  const [profileTheme, setProfileTheme] = useState(null);
  const [academyLesson, setAcademyLesson] = useState(null);
  const [academyModule, setAcademyModule] = useState(null);
  const [quizState, setQuizState] = useState(null);
  const [readingView, setReadingView] = useState('library');
  const [selectedBook, setSelectedBook] = useState(null);
  const [selectedBookProgress, setSelectedBookProgress] = useState(null);
  const [lastChapterCheckpoint, setLastChapterCheckpoint] = useState(false);

  const { showToast } = useToast();
  const { triggerLevelUp } = useLevelUp();
  const deviceType = useDeviceType();

  const {
    kids, choreEvents, calendarEvents, rewards,
    books, bookProgress, readingCheckpoints,
    modules, lessons, quizAttempts,
    loading, isOnline, pendingMutationCount,
    systemState, refreshData, supabase,
  } = useSupabase();

  const { saveFocusMemory, restoreFocusMemory } = useSpatialNav();
  const { status: connectionStatus, isStaleReset } = useConnectionHealth(isOnline, systemState);

  useVisibilityReconnect(supabase, refreshData);

  const activeKid = kids.find(k => k.id === activeProfileId) || null;

  const { completeChore, redeemReward } = useEconomy(
    supabase, activeKid, showToast, triggerLevelUp, refreshData, isOnline
  );

  useCatchUpReset(supabase, systemState, refreshData, isOnline);

  const prevBookProgressIdsRef = useRef(new Set());
  useEffect(() => {
    if (!bookProgress || !activeKid || !books) return;
    const kidProgress = bookProgress.filter(bp => bp.kid_id === activeKid.id);
    const currentIds = new Set(kidProgress.map(bp => bp.id));
    if (prevBookProgressIdsRef.current.size > 0) {
      for (const bp of kidProgress) {
        if (!prevBookProgressIdsRef.current.has(bp.id) && bp.status === 'assigned') {
          const book = books.find(b => b.id === bp.book_id);
          if (book) showToast(`📚 New book assigned: ${book.title}!`, 'gold');
        }
      }
    }
    prevBookProgressIdsRef.current = currentIds;
  }, [bookProgress, activeKid, books, showToast]);

  const handleSelectProfile = useCallback((kidId, theme) => {
    if (activeProfileId !== undefined) {
      saveFocusMemory(activeProfileId || 'family');
    }
    setActiveProfileId(kidId);
    setProfileTheme(theme);
    restoreFocusMemory(kidId || 'family');
  }, [activeProfileId, saveFocusMemory, restoreFocusMemory]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-dark flex items-center justify-center">
        <div className="text-center">
          <p className="font-fredoka text-3xl text-primary mb-4">QuestTrack Academy</p>
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'quests':
        return (
          <QuestBoard
            choreEvents={choreEvents}
            activeKid={activeKid}
            completeChore={completeChore}
            supabase={supabase}
          />
        );
      case 'academy':
        if (quizState) {
          return (
            <QuizEngine
              lesson={quizState.lesson}
              module={quizState.module}
              skippedVideo={quizState.skippedVideo}
              activeKid={activeKid}
              supabase={supabase}
              isOnline={isOnline}
              showToast={showToast}
              triggerLevelUp={triggerLevelUp}
              refreshData={refreshData}
              onBack={() => { setQuizState(null); setAcademyLesson(null); setAcademyModule(null); }}
            />
          );
        }
        if (academyLesson && academyModule) {
          return (
            <div className="space-y-4">
              <EarlyBirdBanner />
              <LessonPlayer
                lesson={academyLesson}
                module={academyModule}
                onBack={() => { setAcademyLesson(null); setAcademyModule(null); }}
                onQuizStart={(lesson, module, skippedVideo) => {
                  setQuizState({ lesson, module, skippedVideo });
                }}
              />
            </div>
          );
        }
        return (
          <div className="space-y-4">
            <EarlyBirdBanner />
            <ModuleGrid
              modules={modules}
              lessons={lessons}
              activeKid={activeKid}
              quizAttempts={quizAttempts}
              onSelectLesson={(lesson, module) => {
                setAcademyLesson(lesson);
                setAcademyModule(module);
              }}
            />
          </div>
        );
      case 'reading':
        if (readingView === 'checkpoint' && selectedBook) {
          return (
            <ChapterCheckpoint
              book={selectedBook}
              progress={selectedBookProgress}
              activeKid={activeKid}
              supabase={supabase}
              isOnline={isOnline}
              showToast={showToast}
              triggerLevelUp={triggerLevelUp}
              refreshData={refreshData}
              onBack={() => {
                if (lastChapterCheckpoint) {
                  setLastChapterCheckpoint(false);
                  setReadingView('complete');
                } else {
                  setReadingView('detail');
                }
              }}
            />
          );
        }
        if (readingView === 'reflection' && selectedBook) {
          return (
            <BookReflection
              book={selectedBook}
              progress={selectedBookProgress}
              supabase={supabase}
              showToast={showToast}
              refreshData={refreshData}
              onDone={() => {
                setReadingView('library');
                setSelectedBook(null);
                setSelectedBookProgress(null);
              }}
            />
          );
        }
        if (readingView === 'complete' && selectedBook) {
          return (
            <div className="max-w-md mx-auto text-center space-y-6">
              <div className="text-6xl">📖</div>
              <p className="font-fredoka text-2xl text-white">Book Complete!</p>
              <p className="font-quicksand text-sm text-slate-400">
                Amazing work finishing {selectedBook.title}!
              </p>
              <button
                className="tv-focusable px-6 py-3 rounded-xl bg-primary text-white font-fredoka text-base hover:bg-primary/80 transition-colors"
                onClick={async () => {
                  const mutationId = crypto.randomUUID();
                  fireConfetti();
                  if (supabase && selectedBookProgress) {
                    try {
                      const { data } = await supabase.rpc('complete_book', {
                        p_book_progress_id: selectedBookProgress.id,
                        p_mutation_id: mutationId,
                      });
                      if (data?.status === 'success') {
                        showToast(`📖 +${data.xp_awarded} XP, +${data.coins_awarded} coins!`, 'gold');
                        if (data.leveled_up) {
                          triggerLevelUp(activeKid.name, data.level, activeKid.color);
                        }
                        await refreshData();
                      }
                    } catch (_err) {
                      showToast('Rewards saved offline!', 'info');
                    }
                  }
                  if (deviceType === 'tv') {
                    showToast('You can add a review from your phone or tablet!', 'info');
                    setReadingView('library');
                    setSelectedBook(null);
                    setSelectedBookProgress(null);
                  } else {
                    setReadingView('reflection');
                  }
                }}
              >
                Continue
              </button>
            </div>
          );
        }
        if (readingView === 'detail' && selectedBook) {
          return (
            <BookDetail
              book={selectedBook}
              progress={selectedBookProgress}
              activeKid={activeKid}
              supabase={supabase}
              isOnline={isOnline}
              showToast={showToast}
              triggerLevelUp={triggerLevelUp}
              refreshData={refreshData}
              onBack={() => {
                setReadingView('library');
                setSelectedBook(null);
                setSelectedBookProgress(null);
              }}
              onCheckpoint={(book, progress, isLast) => {
                setSelectedBook(book);
                setSelectedBookProgress(progress);
                setLastChapterCheckpoint(!!isLast);
                setReadingView('checkpoint');
              }}
              onComplete={(book, progress) => {
                setSelectedBook(book);
                setSelectedBookProgress(progress);
                setReadingView('complete');
              }}
            />
          );
        }
        if (readingView === 'assign') {
          return (
            <BookAssigner
              books={books}
              bookProgress={bookProgress}
              kids={kids}
              activeKid={activeKid}
              supabase={supabase}
              showToast={showToast}
              refreshData={refreshData}
            />
          );
        }
        return (
          <BookLibrary
            books={books}
            bookProgress={bookProgress}
            readingCheckpoints={readingCheckpoints}
            activeKid={activeKid}
            onSelectBook={(book, progress) => {
              setSelectedBook(book);
              setSelectedBookProgress(progress);
              setReadingView('detail');
            }}
          />
        );
      case 'calendar':
        return (
          <CalendarView
            calendarEvents={calendarEvents}
            kids={kids}
          />
        );
      case 'shop':
        return (
          <RewardGrid
            rewards={rewards}
            activeKid={activeKid}
            redeemReward={redeemReward}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-surface-dark">
      <Header />

      <main className="max-w-5xl mx-auto px-6 pb-8">
        <ProfileSwitcher
          kids={kids}
          activeProfileId={activeProfileId}
          onSelectProfile={handleSelectProfile}
          supabase={supabase}
        />

        {activeProfileId !== undefined && activeKid && (
          <>
            <HeroStatsHUD
              kid={activeKid}
              connectionStatus={connectionStatus}
              pendingCount={pendingMutationCount}
            />

            <ProgressiveRamp
              supabase={supabase}
              kids={kids}
              choreEvents={choreEvents}
            />

            <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
              {TABS.map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    className={`tv-focusable flex items-center gap-2 px-4 py-2.5 rounded-xl font-quicksand text-sm whitespace-nowrap transition-all ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                    }`}
                    onClick={() => setActiveTab(tab.key)}
                  >
                    <Icon size={16} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="bg-surface rounded-2xl p-6 min-h-[300px]">
              {renderTabContent()}
            </div>
          </>
        )}

        {activeProfileId === null && (
          <div className="bg-surface rounded-2xl p-6 min-h-[300px]">
            <CalendarView calendarEvents={calendarEvents} kids={kids} />
          </div>
        )}

        {activeProfileId === undefined && (
          <div className="text-center py-16">
            <p className="font-fredoka text-2xl text-slate-500">
              Pick your profile to get started!
            </p>
          </div>
        )}
      </main>

      <RemoteEmulator />
      <FirstVisitHints />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <LevelUpProvider>
        <AppContent />
      </LevelUpProvider>
    </ToastProvider>
  );
}
