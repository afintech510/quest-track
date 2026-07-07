import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Play, Pause, MonitorX, SkipForward, Target } from 'lucide-react';
import { useToast } from '../layout/Toast';

const YT_PARAMS = {
  controls: 0,
  rel: 0,
  modestbranding: 1,
  disablekb: 1,
  fs: 0,
  iv_load_policy: 3,
  playsinline: 1,
};

const WATCH_THRESHOLD = 85;
const POLL_INTERVAL_MS = 5000;
const LOAD_TIMEOUT_MS = 10000;

function loadYouTubeAPI() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve();
      return;
    }
    const existing = document.getElementById('yt-iframe-api');
    if (!existing) {
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
  });
}

export default function LessonPlayer({ lesson, module, onBack, onQuizStart }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [duration, setDuration] = useState(lesson.duration_seconds || 0);
  const [quizUnlocked, setQuizUnlocked] = useState(false);
  const [skippedVideo, setSkippedVideo] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [usingFallback, setUsingFallback] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);

  const { showToast } = useToast();
  const playerRef = useRef(null);
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const pollRef = useRef(null);
  const timeoutRef = useRef(null);
  const lastTimeRef = useRef(0);

  const isMP4 = lesson.video_type === 'mp4' || lesson.video_type === 'local';
  const progress = duration > 0 ? Math.min(100, (watchedSeconds / duration) * 100) : 0;

  const checkProgress = useCallback(() => {
    if (duration <= 0) return;
    const pct = (watchedSeconds / duration) * 100;
    if (pct >= WATCH_THRESHOLD && !quizUnlocked) {
      setQuizUnlocked(true);
    }
  }, [watchedSeconds, duration, quizUnlocked]);

  useEffect(() => { checkProgress(); }, [checkProgress]);

  // YouTube player setup
  useEffect(() => {
    if (isMP4) return;

    const videoId = usingFallback ? lesson.fallback_video_id : lesson.video_id;
    if (!videoId) {
      setVideoFailed(true);
      return;
    }

    let destroyed = false;

    const initPlayer = async () => {
      await loadYouTubeAPI();
      if (destroyed) return;

      const params = new URLSearchParams({ ...YT_PARAMS, origin: window.location.origin });

      playerRef.current = new window.YT.Player('yt-player-frame', {
        videoId,
        playerVars: YT_PARAMS,
        events: {
          onReady: () => {
            if (destroyed) return;
            clearTimeout(timeoutRef.current);
            setPlayerReady(true);
            const iframe = document.querySelector('#yt-player-frame iframe');
            if (iframe) iframe.tabIndex = -1;
            const ytDuration = playerRef.current.getDuration?.();
            if (ytDuration > 0) setDuration(ytDuration);
          },
          onStateChange: (e) => {
            if (destroyed) return;
            setIsPlaying(e.data === window.YT.PlayerState.PLAYING);
          },
          onError: () => {
            if (destroyed) return;
            handleVideoError();
          },
        },
      });

      timeoutRef.current = setTimeout(() => {
        if (!destroyed && !playerReady) handleVideoError();
      }, LOAD_TIMEOUT_MS);
    };

    const handleVideoError = () => {
      if (usingFallback || !lesson.fallback_video_id) {
        setVideoFailed(true);
      } else {
        showToast('Video unavailable — trying backup...', 'info');
        setUsingFallback(true);
      }
    };

    initPlayer();

    return () => {
      destroyed = true;
      clearTimeout(timeoutRef.current);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, [isMP4, usingFallback, lesson.video_id, lesson.fallback_video_id]);

  // Progress polling for YouTube
  useEffect(() => {
    if (isMP4 || !isPlaying || !playerRef.current) return;

    pollRef.current = setInterval(() => {
      const current = playerRef.current?.getCurrentTime?.();
      if (current != null) {
        if (current > lastTimeRef.current + 1) {
          // Jumped forward (scrub) — only credit 1 second advance
          lastTimeRef.current = Math.min(lastTimeRef.current + 5, current);
        } else {
          lastTimeRef.current = current;
        }
        setWatchedSeconds(prev => Math.max(prev, lastTimeRef.current));
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(pollRef.current);
  }, [isMP4, isPlaying]);

  // Progress polling for MP4/local
  useEffect(() => {
    if (!isMP4 || !isPlaying || !videoRef.current) return;

    pollRef.current = setInterval(() => {
      const el = videoRef.current;
      if (!el) return;
      const current = el.currentTime;
      if (el.duration > 0 && duration === 0) setDuration(el.duration);
      if (current > lastTimeRef.current + 1) {
        lastTimeRef.current = Math.min(lastTimeRef.current + 5, current);
      } else {
        lastTimeRef.current = current;
      }
      setWatchedSeconds(prev => Math.max(prev, lastTimeRef.current));
    }, POLL_INTERVAL_MS);

    return () => clearInterval(pollRef.current);
  }, [isMP4, isPlaying, duration]);

  const togglePlayPause = () => {
    if (isMP4) {
      const el = videoRef.current;
      if (!el) return;
      if (el.paused) { el.play(); setIsPlaying(true); }
      else { el.pause(); setIsPlaying(false); }
    } else {
      if (!playerRef.current) return;
      if (isPlaying) playerRef.current.pauseVideo();
      else playerRef.current.playVideo();
    }
  };

  const handleSkipToQuiz = () => {
    setSkippedVideo(true);
    setQuizUnlocked(true);
  };

  const handleQuizStart = () => {
    if (isPlaying) {
      if (isMP4) videoRef.current?.pause();
      else playerRef.current?.pauseVideo?.();
    }
    onQuizStart?.(lesson, module, skippedVideo);
  };

  const formatTime = (s) => {
    const min = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${min}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <button
        className="tv-focusable flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 font-quicksand text-sm transition-colors"
        onClick={onBack}
      >
        <ArrowLeft size={16} />
        Back to Lessons
      </button>

      <div>
        <h2 className="font-fredoka text-lg text-white">{lesson.lesson_name}</h2>
        <p className="font-quicksand text-xs text-slate-400">
          {module.module_name} — {lesson.standard_code || ''}
        </p>
      </div>

      {/* Video area */}
      {videoFailed ? (
        <div className="aspect-video bg-slate-900 rounded-xl flex flex-col items-center justify-center gap-4">
          <MonitorX size={48} className="text-slate-600" />
          <p className="font-fredoka text-lg text-slate-400">Video unavailable</p>
          <button
            className="tv-focusable flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white font-quicksand text-sm hover:bg-amber-500 transition-colors"
            onClick={handleSkipToQuiz}
          >
            <SkipForward size={16} />
            Skip to Quiz (reduced rewards)
          </button>
        </div>
      ) : isMP4 ? (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
          <video
            ref={videoRef}
            src={lesson.video_url}
            className="w-full h-full"
            tabIndex={-1}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onLoadedMetadata={(e) => {
              if (e.target.duration > 0) setDuration(e.target.duration);
            }}
          />
        </div>
      ) : (
        <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black" ref={containerRef}>
          <div id="yt-player-frame" className="absolute inset-0 w-full h-full" />
          {/* Transparent overlay blocks all iframe interaction */}
          <div className="absolute inset-0 z-10" />
        </div>
      )}

      {/* Controls */}
      {!videoFailed && (
        <div className="flex items-center gap-3">
          <button
            className="tv-focusable w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center hover:bg-slate-700 transition-colors"
            onClick={togglePlayPause}
          >
            {isPlaying
              ? <Pause size={18} className="text-white" />
              : <Play size={18} className="text-white ml-0.5" />
            }
          </button>

          <div className="flex-1">
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <span className="font-quicksand text-xs text-slate-400 shrink-0 tabular-nums">
            {formatTime(watchedSeconds)} / {formatTime(duration)}
          </span>
        </div>
      )}

      {/* Progress message / Quiz unlock */}
      <div className="text-center">
        {quizUnlocked ? (
          <button
            className="tv-focusable inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-fredoka text-base animate-pulse-glow hover:bg-primary-dark transition-colors"
            onClick={handleQuizStart}
          >
            <Target size={20} />
            {skippedVideo ? 'Start Quiz (reduced rewards)' : 'Quiz Unlocked!'}
          </button>
        ) : !videoFailed && (
          <p className="font-quicksand text-sm text-slate-400">
            Keep watching! <span className="text-primary font-fredoka">{Math.floor(progress)}%</span> complete — unlock quiz at {WATCH_THRESHOLD}%
          </p>
        )}
      </div>
    </div>
  );
}
