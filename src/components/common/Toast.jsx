import React from 'react';

export default function Toast({ message, icon = 'fa-solid fa-circle-check', show }) {
  if (!show || !message) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '28px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#1e293b',
        color: '#fff',
        padding: '11px 22px',
        borderRadius: '10px',
        fontSize: '14px',
        fontWeight: 500,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
      }}
    >
      <i className={icon}></i>
      <span>{message}</span>
    </div>
  );
}
