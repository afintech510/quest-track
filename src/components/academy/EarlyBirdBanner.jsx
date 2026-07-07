import { useState, useEffect } from 'react';
import { isEarlyBirdWindow } from '../../lib/clockService';
import { Sunrise } from 'lucide-react';

export default function EarlyBirdBanner() {
  const [isEarlyBird, setIsEarlyBird] = useState(false);

  useEffect(() => {
    setIsEarlyBird(isEarlyBirdWindow());
    const interval = setInterval(() => {
      setIsEarlyBird(isEarlyBirdWindow());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  if (!isEarlyBird) return null;

  return (
    <div className="bg-gradient-to-r from-amber-400 to-rose-400 rounded-xl p-3 mb-4 flex items-center gap-3">
      <Sunrise size={20} className="text-white shrink-0" />
      <p className="font-fredoka text-sm text-white">
        Early Bird Active — Bonus rewards on quizzes!
      </p>
    </div>
  );
}

export function useEarlyBird() {
  const [isEarlyBird, setIsEarlyBird] = useState(false);

  useEffect(() => {
    setIsEarlyBird(isEarlyBirdWindow());
    const interval = setInterval(() => {
      setIsEarlyBird(isEarlyBirdWindow());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  return isEarlyBird;
}
