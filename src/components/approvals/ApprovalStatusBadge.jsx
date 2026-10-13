import React from 'react';
import { DOC_STATUS, normalizeStatus } from '../../services/approvalService';

export default function ApprovalStatusBadge({ status }) {
  const norm = normalizeStatus(status);

  const getBadgeConfig = () => {
    switch (norm) {
      case DOC_STATUS.DRAFT:
        return {
          label: 'Draft',
          icon: 'fa-regular fa-file',
          bg: '#f1f5f9',
          color: '#475569',
          border: '#cbd5e1'
        };
      case DOC_STATUS.PENDING_APPROVAL:
        return {
          label: 'Pending Approval',
          icon: 'fa-solid fa-hourglass-half',
          bg: '#fef3c7',
          color: '#b45309',
          border: '#fde68a',
          pulse: true
        };
      case DOC_STATUS.APPROVED:
        return {
          label: 'Approved',
          icon: 'fa-solid fa-check-circle',
          bg: '#dcfce7',
          color: '#15803d',
          border: '#bbf7d0'
        };
      case DOC_STATUS.REJECTED:
        return {
          label: 'Rejected',
          icon: 'fa-solid fa-circle-xmark',
          bg: '#fee2e2',
          color: '#b91c1c',
          border: '#fecaca'
        };
      default:
        return {
          label: norm,
          icon: 'fa-regular fa-circle',
          bg: '#f8fafc',
          color: '#64748b',
          border: '#e2e8f0'
        };
    }
  };

  const cfg = getBadgeConfig();

  return (
    <>
      <style>{`
        @media print {
          .approval-status-badge,
          .approval-status-badge * {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            max-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            border: none !important;
          }
        }
      `}</style>
      <span
        className={`approval-status-badge no-print ${cfg.pulse ? 'pulse-badge' : ''}`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '9999px',
          fontSize: '12px',
          fontWeight: '600',
          backgroundColor: cfg.bg,
          color: cfg.color,
          border: `1px solid ${cfg.border}`,
          whiteSpace: 'nowrap',
          letterSpacing: '0.02em',
          textTransform: 'capitalize'
        }}
      >
        <i className={cfg.icon} style={{ fontSize: '11px' }}></i>
        {cfg.label}
      </span>
    </>
  );
}
