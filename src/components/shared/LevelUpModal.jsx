import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { fireConfetti } from './ConfettiCanvas';
import { Trophy } from 'lucide-react';

const LevelUpContext = createContext(null);

export function useLevelUp() {
  return useContext(LevelUpContext);
}

export function LevelUpProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);

  const triggerLevelUp = useCallback((kidName, newLevel, themeColor) => {
    setQueue(prev => [...prev, { kidName, newLevel, themeColor, id: crypto.randomUUID() }]);
  }, []);

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0]);
      setQueue(prev => prev.slice(1));
      fireConfetti();
    }
  }, [current, queue]);

  const dismiss = useCallback(() => {
    setCurrent(null);
  }, []);

  return (
    <LevelUpContext.Provider value={{ triggerLevelUp }}>
      {children}
      {current && (
        <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center">
          <div className="text-center animate-bounce-in">
            <Trophy size={64} className="text-amber-400 mx-auto mb-4" />
            <p className="font-fredoka text-4xl text-white mb-2">LEVEL UP!</p>
            <p className="font-fredoka text-6xl font-bold mb-4" style={{ color: current.themeColor || '#f43f5e' }}>
              Level {current.newLevel}
            </p>
            <p className="font-quicksand text-xl text-slate-300 mb-8">
              Amazing work, {current.kidName}!
            </p>
            <button
              className="tv-focusable bg-primary hover:bg-primary/80 text-white font-fredoka px-8 py-3 rounded-xl text-lg transition-colors"
              onClick={dismiss}
            >
              Awesome!
            </button>
          </div>
        </div>
      )}
    </LevelUpContext.Provider>
  );
}

export default function LevelUpModal() {
  return null;
}
