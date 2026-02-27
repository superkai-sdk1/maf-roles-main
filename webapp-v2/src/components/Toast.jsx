import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const ToastContext = createContext();

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const showToast = useCallback((message, { type = 'error', title, duration = 4000 } = {}) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type, title }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, onDismiss }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 420, margin: '0 auto' }}>
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(timer);
  }, []);

  const styles = {
    error: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)', icon: '🔒', iconColor: '#ef4444' },
    warning: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)', icon: '⚠', iconColor: '#f59e0b' },
    info: { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.25)', icon: '👁', iconColor: '#6366f1' },
    success: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.25)', icon: '✓', iconColor: '#22c55e' },
  };

  const s = styles[toast.type] || styles.error;

  return (
    <div
      className="pointer-events-auto rounded-2xl backdrop-blur-xl shadow-2xl transition-all duration-300 ease-out"
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.95)',
      }}
      onClick={onDismiss}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="text-lg shrink-0 mt-0.5" style={{ color: s.iconColor }}>{s.icon}</span>
        <div className="flex-1 min-w-0">
          {toast.title && (
            <div className="text-[0.8em] font-extrabold text-white/90 mb-0.5">{toast.title}</div>
          )}
          <div className="text-[0.78em] font-medium text-white/60 leading-snug">{toast.message}</div>
        </div>
      </div>
    </div>
  );
}
