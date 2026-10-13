import React from 'react';

export default function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDanger = false,
  confirmColor,
  icon,
  children,
  maxWidth,
  width
}) {
  if (!isOpen) return null;

  const hasChildren = Boolean(children);
  const effectiveMaxWidth = maxWidth || (hasChildren ? '760px' : '520px');
  const displayIcon = icon || (isDanger ? 'fa-solid fa-triangle-exclamation' : null);

  return (
    <div
      className="modal-overlay open no-print"
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
      style={{
        display: 'flex',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box'
      }}
    >
      <div
        className="modal-box"
        style={{
          width: width || (hasChildren ? '100%' : '520px'),
          maxWidth: effectiveMaxWidth,
          maxHeight: 'min(90vh, 640px)',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          padding: '20px 24px',
          boxSizing: 'border-box'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '14px',
            borderBottom: hasChildren ? '1px solid #f1f5f9' : 'none',
            paddingBottom: hasChildren ? '12px' : 0,
            flexShrink: 0
          }}
        >
          <h4
            style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: 700,
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            {displayIcon && (
              <i
                className={displayIcon}
                style={{
                  color: isDanger ? '#dc2626' : confirmColor || '#6366f1',
                  marginRight: '4px',
                }}
              ></i>
            )}
            {title}
          </h4>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '18px',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px 8px',
                lineHeight: 1,
                borderRadius: '6px'
              }}
              title="Close"
            >
              ✕
            </button>
          )}
        </div>

        {hasChildren ? (
          <div style={{ overflowY: 'auto', flex: '1 1 auto', minHeight: 0, paddingRight: '4px' }}>
            {children}
          </div>
        ) : (
          <>
            <div
              className="modal-body-scroll"
              style={{
                overflowY: 'auto',
                flex: '1 1 auto',
                minHeight: 0,
                paddingRight: '6px',
                marginRight: '-4px',
                marginBottom: '14px',
                fontSize: '14px',
                color: '#64748b'
              }}
            >
              {message}
            </div>
            <div
              className="modal-actions"
              style={{
                display: 'flex',
                gap: '10px',
                justifyContent: 'flex-end',
                paddingTop: '14px',
                borderTop: '1px solid #f1f5f9',
                flexShrink: 0,
                backgroundColor: '#ffffff'
              }}
            >
              <button type="button" className="modal-btn cancel" onClick={onClose}>
                {cancelText}
              </button>
              <button
                type="button"
                className={`modal-btn ${isDanger ? 'danger' : 'confirm'}`}
                style={confirmColor ? { backgroundColor: confirmColor, color: '#fff' } : {}}
                onClick={onConfirm}
              >
                {confirmText}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

