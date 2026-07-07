import { createContext, useContext, useState, useCallback } from 'react';
import { TOAST_DURATION_MS } from '../../lib/constants';
import { Check, Coins, Info, AlertTriangle } from 'lucide-react';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

const TOAST_STYLES = {
  success: { bg: 'bg-emerald-600', icon: Check },
  gold: { bg: 'bg-amber-600', icon: Coins },
  info: { bg: 'bg-blue-600', icon: Info },
  error: { bg: 'bg-red-600', icon: AlertTriangle },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + '-' + Math.random().toString(36).slice(2, 9);
    setToasts(prev => {
      if (prev.some(t => t.message === message && Date.now() - t.ts < 500)) return prev;
      return [...prev, { id, message, type, ts: Date.now() }];
    });
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => {
          const style = TOAST_STYLES[toast.type] || TOAST_STYLES.info;
          const Icon = style.icon;
          return (
            <div
              key={toast.id}
              className={`${style.bg} text-white font-quicksand px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 pointer-events-auto animate-slide-in min-w-[280px]`}
              onClick={() => dismissToast(toast.id)}
            >
              <Icon size={20} />
              <span className="text-sm font-medium">{toast.message}</span>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export default function Toast() {
  return null;
}
