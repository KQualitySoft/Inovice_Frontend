import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import notificationService from '../services/notificationService';

// Global alert interceptor: Ensures ALL notifications appear in the application itself, never in the Edge/browser popup
if (typeof window !== 'undefined') {
  window.alert = (message) => {
    if (message === undefined || message === null) return;
    const msgStr = String(message);
    const lower = msgStr.toLowerCase();

    let type = 'warning';
    let title = 'Notice';

    if (
      lower.includes('privilege') ||
      lower.includes('permission') ||
      lower.includes('access restricted') ||
      lower.includes('not have privilege') ||
      lower.includes('locked')
    ) {
      type = 'danger';
      title = 'Access Restricted';
    } else if (
      lower.includes('error') ||
      lower.includes('failed') ||
      lower.includes('cannot') ||
      lower.includes('required') ||
      lower.includes('not allow')
    ) {
      type = 'danger';
      title = 'Notice';
    } else if (
      lower.includes('success') ||
      lower.includes('approved') ||
      lower.includes('created') ||
      lower.includes('saved')
    ) {
      type = 'success';
      title = 'Success';
    }

    try {
      notificationService.addNotification({
        title,
        message: msgStr,
        type,
        targetRole: 'all'
      });
    } catch (e) {
      window.dispatchEvent(
        new CustomEvent('invox_show_toast', {
          detail: { title, message: msgStr, type, duration: 4500 }
        })
      );
    }
  };
}

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(({ title, message, type = 'info', duration = 4500 }) => {
    const id = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newToast = { id, title, message, type };

    setToasts((prev) => [...prev, newToast]);

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, [removeToast]);

  const notifySuccess = useCallback((message, title = 'Success') => {
    showToast({ title, message, type: 'success' });
  }, [showToast]);

  const notifyError = useCallback((message, title = 'Error') => {
    showToast({ title, message, type: 'danger' });
  }, [showToast]);

  const notifyWarning = useCallback((message, title = 'Warning') => {
    showToast({ title, message, type: 'warning' });
  }, [showToast]);

  const notifyInfo = useCallback((message, title = 'Notice') => {
    showToast({ title, message, type: 'info' });
  }, [showToast]);

  // Listen to global toast events (e.g. from notificationService)
  useEffect(() => {
    const handleGlobalToast = (e) => {
      if (e.detail) {
        showToast(e.detail);
      }
    };

    window.addEventListener('invox_show_toast', handleGlobalToast);
    return () => window.removeEventListener('invox_show_toast', handleGlobalToast);
  }, [showToast]);

  const getToastIcon = (type) => {
    switch (type) {
      case 'success':
        return <i className="fa-solid fa-circle-check" style={{ color: '#16a34a', fontSize: '18px' }}></i>;
      case 'danger':
      case 'error':
        return <i className="fa-solid fa-circle-exclamation" style={{ color: '#dc2626', fontSize: '18px' }}></i>;
      case 'warning':
        return <i className="fa-solid fa-triangle-exclamation" style={{ color: '#d97706', fontSize: '18px' }}></i>;
      default:
        return <i className="fa-solid fa-circle-info" style={{ color: '#4f46e5', fontSize: '18px' }}></i>;
    }
  };

  const getToastAccent = (type) => {
    switch (type) {
      case 'success': return '#16a34a';
      case 'danger':
      case 'error': return '#dc2626';
      case 'warning': return '#d97706';
      default: return '#4f46e5';
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        showToast,
        notifySuccess,
        notifyError,
        notifyWarning,
        notifyInfo
      }}
    >
      {children}

      {/* Floating In-App Toast Container */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '400px',
          width: 'calc(100% - 40px)',
          pointerEvents: 'none'
        }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderLeft: `4px solid ${getToastAccent(toast.type)}`,
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
              borderRadius: '10px',
              padding: '12px 16px',
              animation: 'inAppToastSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              transition: 'all 0.2s ease',
            }}
          >
            <div style={{ marginTop: '2px', flexShrink: 0 }}>
              {getToastIcon(toast.type)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {toast.title && (
                <div style={{ fontWeight: 700, fontSize: '13.5px', color: '#0f172a', marginBottom: '2px' }}>
                  {toast.title}
                </div>
              )}
              <div style={{ fontSize: '12.5px', color: '#475569', lineHeight: 1.45, wordBreak: 'break-word' }}>
                {toast.message}
              </div>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              style={{
                background: 'none',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                lineHeight: 1,
                borderRadius: '4px',
                fontSize: '14px',
                flexShrink: 0
              }}
              title="Dismiss"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    // Fallback if used outside provider
    return {
      showToast: ({ message }) => console.log(message),
      notifySuccess: (msg) => console.log('Success:', msg),
      notifyError: (msg) => console.error('Error:', msg),
      notifyWarning: (msg) => console.warn('Warning:', msg),
      notifyInfo: (msg) => console.info('Info:', msg)
    };
  }
  return context;
}
