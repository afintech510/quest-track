import { useState, useMemo } from 'react';
import { ArrowLeft, Check, Clock, Play } from 'lucide-react';

const SUBJECT_CONFIG = {
  math: { label: 'Math', accentLight: 'bg-indigo-500/20', text: 'text-indigo-400', border: 'border-indigo-500/30', dot: 'bg-indigo-500' },
  ela: { label: 'ELA', accentLight: 'bg-teal-500/20', text: 'text-teal-400', border: 'border-teal-500/30', dot: 'bg-teal-500' },
  science: { label: 'Science', accentLight: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', dot: 'bg-amber-500' },
  social_studies: { label: 'Social Studies', accentLight: 'bg-violet-500/20', text: 'text-violet-400', border: 'border-violet-500/30', dot: 'bg-violet-500' },
};

const SUBJECT_ORDER = ['math', 'ela', 'science', 'social_studies'];

function formatDuration(seconds) {
  if (!seconds) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ModuleGrid({ modules, lessons, activeKid, quizAttempts, onSelectLesson }) {
  const [selectedModule, setSelectedModule] = useState(null);

  const lessonsByModule = useMemo(() => {
    const map = {};
    for (const lesson of lessons) {
      if (!map[lesson.module_id]) map[lesson.module_id] = [];
      map[lesson.module_id].push(lesson);
    }
    return map;
  }, [lessons]);

  const completedLessonIds = useMemo(() => {
    if (!quizAttempts || !activeKid) return new Set();
    return new Set(
      quizAttempts
        .filter(a => a.kid_id === activeKid.id && a.lesson_id)
        .map(a => a.lesson_id)
    );
  }, [quizAttempts, activeKid]);

  const groupedModules = useMemo(() => {
    const groups = {};
    for (const subject of SUBJECT_ORDER) {
      groups[subject] = modules
        .filter(m => m.subject === subject)
        .sort((a, b) => a.sort_order - b.sort_order);
    }
    return groups;
  }, [modules]);

  if (selectedModule) {
    const config = SUBJECT_CONFIG[selectedModule.subject] || SUBJECT_CONFIG.math;
    const moduleLessons = (lessonsByModule[selectedModule.id] || []).sort((a, b) => a.sort_order - b.sort_order);

    return (
      <div className="space-y-3">
        <button
          className="tv-focusable flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-quicksand text-sm transition-colors"
          onClick={() => setSelectedModule(null)}
        >
          <ArrowLeft size={16} />
          Back to Modules
        </button>

        <div className="flex items-center gap-3 mb-4">
          <span className="text-2xl">{selectedModule.module_icon}</span>
          <div>
            <h2 className="font-fredoka text-xl text-white">{selectedModule.module_name}</h2>
            <p className={`font-quicksand text-xs ${config.text}`}>
              {config.label} — {moduleLessons.length} lesson{moduleLessons.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {moduleLessons.map((lesson, i) => {
            const completed = completedLessonIds.has(lesson.id);
            return (
              <button
                key={lesson.id}
                className={`tv-focusable w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
                  completed
                    ? `${config.accentLight} ${config.border}`
                    : 'bg-slate-800/60 border-slate-700/50 hover:bg-slate-700/60'
                }`}
                onClick={() => onSelectLesson(lesson, selectedModule)}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  completed ? config.dot : 'bg-slate-700'
                }`}>
                  {completed
                    ? <Check size={14} className="text-white" />
                    : <span className="font-fredoka text-xs text-slate-400">{i + 1}</span>
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-fredoka text-sm text-white truncate">{lesson.lesson_name}</p>
                  <p className="font-quicksand text-xs text-slate-400">
                    {lesson.standard_code || 'Standard TBD'}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="flex items-center gap-1 font-quicksand text-xs text-slate-500">
                    <Clock size={12} />
                    {formatDuration(lesson.duration_seconds)}
                  </span>
                  <Play size={14} className="text-slate-500" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {SUBJECT_ORDER.map(subject => {
        const config = SUBJECT_CONFIG[subject];
        const subjectModules = groupedModules[subject] || [];
        if (subjectModules.length === 0) return null;

        return (
          <div key={subject}>
            <h3 className={`font-fredoka text-sm uppercase tracking-wider ${config.text} mb-3`}>
              {config.label}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {subjectModules.map(mod => {
                const lessonCount = (lessonsByModule[mod.id] || []).length;
                return (
                  <button
                    key={mod.id}
                    className={`tv-focusable flex flex-col items-center gap-2 p-4 rounded-xl border ${config.border} ${config.accentLight} hover:brightness-125 transition-all text-center`}
                    onClick={() => setSelectedModule(mod)}
                  >
                    <span className="text-3xl">{mod.module_icon}</span>
                    <p className="font-fredoka text-sm text-white leading-tight">{mod.module_name}</p>
                    <div className="flex flex-wrap justify-center gap-1">
                      {(mod.standard_codes || []).slice(0, 2).map(code => (
                        <span key={code} className="font-quicksand text-[10px] px-1.5 py-0.5 rounded bg-black/20 text-slate-400">
                          {code}
                        </span>
                      ))}
                    </div>
                    <p className="font-quicksand text-xs text-slate-400">
                      {lessonCount} lesson{lessonCount !== 1 ? 's' : ''}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
