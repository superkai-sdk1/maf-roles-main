import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { triggerHaptic } from '../utils/haptics';

const ModalContext = createContext();

export function useModal() {
  return useContext(ModalContext);
}

export function ModalProvider({ children }) {
  const [modal, setModal] = useState(null);

  const showModal = useCallback((config) => {
    setModal(config);
    triggerHaptic('warning');
  }, []);

  const closeModal = useCallback(() => {
    setModal(null);
  }, []);

  return (
    <ModalContext.Provider value={{ showModal, closeModal }}>
      {children}
      {modal && <ModalOverlay modal={modal} onClose={closeModal} />}
    </ModalContext.Provider>
  );
}

function ModalOverlay({ modal, onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center px-6"
      style={{
        background: visible ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
        backdropFilter: visible ? 'blur(4px)' : 'none',
        transition: 'all 200ms ease-out',
      }}
      onClick={handleClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(135deg, rgba(30,28,45,0.98) 0%, rgba(18,16,30,0.98) 100%)',
          border: '1px solid rgba(255,255,255,0.1)',
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1) translateY(0)' : 'scale(0.95) translateY(12px)',
          transition: 'all 250ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 pt-6 pb-4">
          {modal.icon && (
            <div className="text-3xl text-center mb-3">{modal.icon}</div>
          )}
          <h3 className="text-base font-extrabold text-white text-center mb-2">
            {modal.title}
          </h3>
          <p className="text-[0.82em] text-white/55 text-center leading-relaxed font-medium">
            {modal.message}
          </p>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          {modal.buttons?.map((btn, i) => (
            <button
              key={i}
              className={`flex-1 py-3 px-4 rounded-2xl font-bold text-[0.85em] transition-all active:scale-[0.97] ${
                btn.primary
                  ? btn.danger
                    ? 'bg-red-500/20 border border-red-500/30 text-red-400'
                    : 'bg-accent/20 border border-accent/30 text-accent'
                  : 'bg-white/[0.05] border border-white/[0.1] text-white/60'
              }`}
              onClick={() => {
                if (btn.action) btn.action();
                handleClose();
                triggerHaptic(btn.primary ? 'medium' : 'light');
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
