import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'warning' | 'info';
}

interface ToastItemProps {
  toast: ToastData;
  onRemove: (id: string) => void;
  duration?: number;
}

export function ToastItem({ toast, onRemove, duration = 3800 }: ToastItemProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const startTimeRef = useRef<number>(Date.now());
  const remainingTimeRef = useRef<number>(duration);

  // Auto-dismiss countdown
  useEffect(() => {
    if (isPaused || isExiting) return;

    const interval = 30; // update frequency
    const timer = setInterval(() => {
      remainingTimeRef.current -= interval;
      const pct = Math.max(0, (remainingTimeRef.current / duration) * 100);
      setProgress(pct);

      if (remainingTimeRef.current <= 0) {
        clearInterval(timer);
        triggerExit();
      }
    }, interval);

    return () => clearInterval(timer);
  }, [isPaused, isExiting, duration]);

  const triggerExit = () => {
    setIsExiting(true);
    setTimeout(() => {
      onRemove(toast.id);
    }, 280); // Wait for exit animation
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={16} className="toast-icon success" style={{ color: 'var(--success)' }} />;
      case 'warning':
        return <AlertTriangle size={16} className="toast-icon warning" style={{ color: 'var(--warning)' }} />;
      default:
        return <Info size={16} className="toast-icon info" style={{ color: 'var(--accent)' }} />;
    }
  };

  return (
    <div
      className={`toast ${toast.type} ${isExiting ? 'toast-exit' : 'toast-enter'}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        cursor: 'default',
        transform: isExiting ? 'translateX(120%) scale(0.95)' : 'translateX(0) scale(1)',
        opacity: isExiting ? 0 : 1,
        transition: 'all 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, paddingRight: 6 }}>
        {getIcon()}
        <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{toast.message}</span>
      </div>

      <button
        className="btn-icon"
        style={{
          width: 22,
          height: 22,
          background: 'transparent',
          border: 'none',
          color: 'var(--text-tertiary)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
        onClick={triggerExit}
        title="Dismiss"
      >
        <X size={13} />
      </button>

      {/* Animated shrink progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 2,
          width: `${progress}%`,
          background: toast.type === 'success' ? 'var(--success)' : toast.type === 'warning' ? 'var(--warning)' : 'var(--accent)',
          transition: 'width 0.05s linear',
          opacity: 0.8,
        }}
      />
    </div>
  );
}

export function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: ToastData[];
  onRemove: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" style={{ zIndex: 9999 }}>
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}
