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
import ParentPinPad from './components/admin/ParentPinPad';
import AdminDashboard from './components/admin/AdminDashboard';
import ApprovalQueue from './components/admin/ApprovalQueue';
import EventBuilder from './components/admin/EventBuilder';
import ChoreBuilder from './components/admin/ChoreBuilder';
import RewardBuilder from './components/admin/RewardBuilder';
import StaleResetBanner from './components/admin/StaleResetBanner';
import useSupabase from './hooks/useSupabase';
import useDeviceType from './hooks/useDeviceType';
import { fireConfetti } from './components/shared/ConfettiCanvas';
import useEconomy from './hooks/useEconomy';
import useCatchUpReset from './hooks/useCatchUpReset';
import useSpatialNav from './hooks/useSpatialNav';
import useVisibilityReconnect from './hooks/useVisibilityReconnect';
import useConnectionHealth from './hooks/useConnectionHealth';
import { FAMILY_ID } from './lib/constants';
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

  const [showPinPad, setShowPinPad] = useState(false);
  const [sessionToken, setSessionToken] = useState(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState(null);
  const [adminView, setAdminView] = useState(false);
  const [adminTab, setAdminTab] = useState('dashboard');

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

  const isSessionValid = useCallback(() => {
    return sessionToken && tokenExpiresAt && new Date(tokenExpiresAt) > new Date();
  }, [sessionToken, tokenExpiresAt]);

  useEffect(() => {
    if (!sessionToken || !tokenExpiresAt) return;
    const remaining = new Date(tokenExpiresAt).getTime() - Date.now();
    if (remaining <= 0) {
      setSessionToken(null);
      setTokenExpiresAt(null);
      setAdminView(false);
      showToast('Session expired', 'info');
      return;
    }
    const timer = setTimeout(() => {
      setSessionToken(null);
      setTokenExpiresAt(null);
      setAdminView(false);
      showToast('Session expired', 'info');
    }, remaining);
    return () => clearTimeout(timer);
  }, [sessionToken, tokenExpiresAt, showToast]);

  const handleAdminClick = useCallback(() => {
    if (isSessionValid()) {
      setAdminView(true);
    } else {
      setShowPinPad(true);
    }
  }, [isSessionValid]);

  const handlePinSuccess = useCallback((token, expiresAt) => {
    setSessionToken(token);
    setTokenExpiresAt(expiresAt);
    setShowPinPad(false);
    setAdminView(true);
    setAdminTab('dashboard');
  }, []);

  const handleExitAdmin = useCallback(() => {
    setAdminView(false);
  }, []);

  const handleFactoryReset = useCallback(async () => {
    if (!supabase || !sessionToken) return;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/factory-reset`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
          'x-session-token': sessionToken,
        },
        body: JSON.stringify({ family_id: FAMILY_ID }),
      });
      const data = await response.json();
      if (data.status === 'success') {
        showToast('Factory reset complete', 'info');
        await refreshData();
      } else {
        showToast('Factory reset failed', 'error');
      }
    } catch {
      showToast('Factory reset failed', 'error');
    }
  }, [supabase, sessionToken, showToast, refreshData]);

  const handleUncheckAll = useCallback(async (kidId) => {
    if (!supabase) return;
    try {
      await supabase.from('chore_events')
        .update({ status: 'reset' })
        .eq('kid_id', kidId)
        .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
      showToast('Chores reset for today', 'info');
      await refreshData();
    } catch {
      showToast('Reset failed', 'error');
    }
  }, [supabase, showToast, refreshData]);

  const handleUpdateSettings = useCallback(async (settings) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/update-family-settings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
          'x-session-token': sessionToken,
        },
        body: JSON.stringify({ family_id: FAMILY_ID, ...settings }),
      });
      const data = await response.json();
      if (data.status === 'success') {
        showToast('Settings updated', 'success');
        await refreshData();
      } else {
        showToast(data.message || 'Update failed', 'error');
      }
    } catch {
      showToast('Failed to update settings', 'error');
    }
  }, [sessionToken, showToast, refreshData]);

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
      <Header onAdminClick={handleAdminClick} isAdmin={adminView} onExitAdmin={handleExitAdmin} />

      {showPinPad && (
        <ParentPinPad
          onSuccess={handlePinSuccess}
          onClose={() => setShowPinPad(false)}
        />
      )}

      <main className="max-w-5xl mx-auto px-6 pb-8">
        {adminView && isSessionValid() ? (
          <div className="space-y-4">
            <StaleResetBanner systemState={systemState} />

            <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
              {[
                { key: 'dashboard', label: 'Dashboard' },
                { key: 'approve', label: 'Approve' },
                ...(deviceType !== 'tv' ? [{ key: 'manage', label: 'Manage' }] : []),
              ].map(tab => (
                <button
                  key={tab.key}
                  className={`tv-focusable px-4 py-2.5 rounded-xl font-quicksand text-sm whitespace-nowrap transition-all ${
                    adminTab === tab.key
                      ? 'bg-primary text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                  onClick={() => setAdminTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="bg-surface rounded-2xl p-6 min-h-[300px]">
              {adminTab === 'dashboard' && (
                <AdminDashboard supabase={supabase} kids={kids} />
              )}

              {adminTab === 'approve' && (
                <ApprovalQueue
                  choreEvents={choreEvents}
                  kids={kids}
                  supabase={supabase}
                  sessionToken={sessionToken}
                  refreshData={refreshData}
                />
              )}

              {adminTab === 'manage' && deviceType !== 'tv' && (
                <div className="space-y-6">
                  <ChoreBuilder supabase={supabase} choreEvents={choreEvents} refreshData={refreshData} sessionToken={sessionToken} />
                  <RewardBuilder supabase={supabase} rewards={rewards} refreshData={refreshData} sessionToken={sessionToken} />
                  <EventBuilder calendarEvents={calendarEvents} kids={kids} sessionToken={sessionToken} refreshData={refreshData} />
                  <BookAssigner books={books} bookProgress={bookProgress} kids={kids} activeKid={activeKid} supabase={supabase} showToast={showToast} refreshData={refreshData} sessionToken={sessionToken} />
                  <ProgressiveRamp supabase={supabase} kids={kids} choreEvents={choreEvents} />

                  <div className="border-t border-slate-700 pt-4 space-y-4">
                    <h3 className="font-fredoka text-base text-white">Settings & Controls</h3>
                    <EmergencyControls
                      deviceType={deviceType}
                      kids={kids}
                      systemState={systemState}
                      onUpdateSettings={handleUpdateSettings}
                      onUncheckAll={handleUncheckAll}
                      onFactoryReset={handleFactoryReset}
                    />
                  </div>
                </div>
              )}
            </div>

            {adminTab === 'dashboard' && deviceType === 'tv' && (
              <div className="bg-surface rounded-2xl p-6 space-y-4">
                <h3 className="font-fredoka text-base text-white">Quick Controls</h3>
                <EmergencyControls
                  deviceType={deviceType}
                  kids={kids}
                  systemState={systemState}
                  onUpdateSettings={handleUpdateSettings}
                  onUncheckAll={handleUncheckAll}
                  onFactoryReset={handleFactoryReset}
                />
              </div>
            )}
          </div>
        ) : (
        <>
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
        </>
        )}
      </main>

      <RemoteEmulator />
      <FirstVisitHints />
    </div>
  );
}

function EmergencyControls({ deviceType, kids, systemState, onUpdateSettings, onUncheckAll, onFactoryReset }) {
  const [confirmUncheck, setConfirmUncheck] = useState(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetText, setResetText] = useState('');
  const [autoApproveHours, setAutoApproveHours] = useState(systemState?.auto_approve_hours ?? 48);
  const forceBoost = systemState?.force_morning_boost ?? false;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-slate-800 rounded-xl p-3">
        <div>
          <p className="font-quicksand text-sm text-white">Force Morning Boost</p>
          <p className="font-quicksand text-xs text-slate-400">Early Bird bonus applies all day</p>
        </div>
        <button
          className={`tv-focusable w-12 h-7 rounded-full transition-colors ${forceBoost ? 'bg-primary' : 'bg-slate-600'}`}
          onClick={() => onUpdateSettings({ force_morning_boost: !forceBoost })}
        >
          <div className={`w-5 h-5 bg-white rounded-full transition-transform ${forceBoost ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      {deviceType !== 'tv' && (
        <div className="flex items-center justify-between bg-slate-800 rounded-xl p-3">
          <div>
            <p className="font-quicksand text-sm text-white">Auto-Approve Hours</p>
            <p className="font-quicksand text-xs text-slate-400">0 = disabled</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={autoApproveHours}
              onChange={e => setAutoApproveHours(parseInt(e.target.value) || 0)}
              onBlur={() => onUpdateSettings({ auto_approve_hours: autoApproveHours })}
              className="w-16 bg-slate-700 text-white text-sm text-center rounded-lg px-2 py-1 border border-slate-600"
              min="0"
            />
          </div>
        </div>
      )}

      {kids?.map(kid => (
        <div key={kid.id} className="flex items-center justify-between bg-slate-800 rounded-xl p-3">
          <p className="font-quicksand text-sm text-white">Uncheck All — {kid.name}</p>
          {confirmUncheck === kid.id ? (
            <div className="flex gap-2">
              <button
                className="tv-focusable px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-quicksand"
                onClick={() => { onUncheckAll(kid.id); setConfirmUncheck(null); }}
              >
                Confirm
              </button>
              <button
                className="tv-focusable px-3 py-1 rounded-lg bg-slate-600 text-white text-xs font-quicksand"
                onClick={() => setConfirmUncheck(null)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="tv-focusable px-3 py-1 rounded-lg bg-amber-600/20 text-amber-400 text-xs font-quicksand hover:bg-amber-600/40"
              onClick={() => setConfirmUncheck(kid.id)}
            >
              Reset
            </button>
          )}
        </div>
      ))}

      {deviceType !== 'tv' && (
        <div className="bg-red-900/20 border border-red-800/30 rounded-xl p-3 space-y-2">
          <p className="font-quicksand text-sm text-red-300">Factory Reset</p>
          <p className="font-quicksand text-xs text-slate-400">Resets all kids to level 1, 0 XP, 0 coins. Cannot be undone.</p>
          {!resetConfirm ? (
            <button
              className="px-3 py-1 rounded-lg bg-red-600/30 text-red-400 text-xs font-quicksand hover:bg-red-600/50"
              onClick={() => setResetConfirm(true)}
            >
              Factory Reset...
            </button>
          ) : (
            <div className="space-y-2">
              <p className="font-quicksand text-xs text-red-300">Type RESET to confirm:</p>
              <input
                type="text"
                value={resetText}
                onChange={e => setResetText(e.target.value)}
                className="w-full bg-slate-700 text-white text-sm rounded-lg px-3 py-1.5 border border-red-600"
                placeholder="RESET"
              />
              <div className="flex gap-2">
                <button
                  className="px-3 py-1 rounded-lg bg-red-600 text-white text-xs font-quicksand disabled:opacity-30"
                  disabled={resetText !== 'RESET'}
                  onClick={() => { onFactoryReset(); setResetConfirm(false); setResetText(''); }}
                >
                  Confirm Reset
                </button>
                <button
                  className="px-3 py-1 rounded-lg bg-slate-600 text-white text-xs font-quicksand"
                  onClick={() => { setResetConfirm(false); setResetText(''); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
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
