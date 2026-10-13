import React from 'react';
import { DOC_STATUS, normalizeStatus } from '../../services/approvalService';
import { fmtDate } from '../../utils/dateUtils';

export default function ApprovalBanner({
  status,
  isMainAdmin,
  canApprove = isMainAdmin,
  canReject = isMainAdmin,
  submittedBy,
  submittedAt,
  approvedBy,
  approvedAt,
  rejectedBy,
  rejectedAt,
  rejectionReason,
  onApprove,
  onReject,
  onViewHistory
}) {
  const norm = normalizeStatus(status);

  const printStyles = (
    <style>{`
      @media print {
        .approval-banner,
        .approval-banner * {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          max-height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
          border: none !important;
          box-shadow: none !important;
        }
      }
    `}</style>
  );

  if (norm === DOC_STATUS.PENDING_APPROVAL) {
    const hasActionAuthority = isMainAdmin || canApprove || canReject;

    return (
      <>
        {printStyles}
        <div
          className="approval-banner approval-banner-pending no-print"
        style={{
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          border: '1px solid #fde68a',
          borderRadius: '10px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
          boxShadow: '0 2px 6px rgba(217, 119, 6, 0.08)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#fef08a',
              color: '#b45309',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              flexShrink: 0
            }}
          >
            <i className="fa-solid fa-hourglass-half"></i>
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: '700', color: '#92400e' }}>
              Pending Approval {hasActionAuthority ? '– Action Required' : '– Under Review'}
            </div>
            <div style={{ fontSize: '13px', color: '#b45309', marginTop: '2px' }}>
              {hasActionAuthority
                ? `Submitted by ${submittedBy || 'User'} on ${submittedAt ? fmtDate(submittedAt) : 'Recently'}. Please review and approve or reject.`
                : 'This document has been submitted for approval and is currently locked from normal editing.'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>

          {canReject && (
            <button
              type="button"
              onClick={onReject}
              style={{
                background: '#ef4444',
                border: 'none',
                color: '#ffffff',
                padding: '7px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(239, 68, 68, 0.2)'
              }}
            >
              <i className="fa-solid fa-xmark"></i> Reject
            </button>
          )}

          {canApprove && (
            <button
              type="button"
              onClick={onApprove}
              style={{
                background: '#16a34a',
                border: 'none',
                color: '#ffffff',
                padding: '7px 16px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(22, 163, 74, 0.2)'
              }}
            >
              <i className="fa-solid fa-check"></i> Approve
            </button>
          )}
        </div>
      </div>
    </>
  );
}

  if (norm === DOC_STATUS.APPROVED) {
    return (
      <>
        {printStyles}
        <div
          className="approval-banner approval-banner-approved no-print"
          style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
            border: '1px solid #bbf7d0',
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            boxShadow: '0 2px 6px rgba(22, 163, 74, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#bbf7d0',
                color: '#15803d',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                flexShrink: 0
              }}
            >
              <i className="fa-solid fa-check-circle"></i>
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#166534' }}>
                Approved Document (Final)
              </div>
              <div style={{ fontSize: '13px', color: '#15803d', marginTop: '2px' }}>
                Approved by <strong>{approvedBy || 'Main Admin'}</strong>
                {approvedAt ? ` on ${fmtDate(approvedAt)}` : ''}. This document is finalized and locked from editing.
              </div>
            </div>
          </div>

        </div>
      </>
    );
  }

  if (norm === DOC_STATUS.REJECTED) {
    return (
      <>
        {printStyles}
        <div
          className="approval-banner approval-banner-rejected no-print"
          style={{
            background: 'linear-gradient(135deg, #fff1f2 0%, #fee2e2 100%)',
            border: '1px solid #fecaca',
            borderRadius: '10px',
            padding: '16px 20px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '14px',
            boxShadow: '0 2px 6px rgba(220, 38, 38, 0.08)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: '1 1 300px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                background: '#fecaca',
                color: '#b91c1c',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                flexShrink: 0
              }}
            >
              <i className="fa-solid fa-circle-exclamation"></i>
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#991b1b' }}>
                Document Rejected
              </div>
              <div style={{ fontSize: '13px', color: '#b91c1c', marginTop: '4px' }}>
                Rejected by <strong>{rejectedBy || 'Main Admin'}</strong>
                {rejectedAt ? ` on ${fmtDate(rejectedAt)}` : ''}.
              </div>
              {rejectionReason && (
                <div
                  style={{
                    marginTop: '8px',
                    background: 'rgba(255, 255, 255, 0.8)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    color: '#7f1d1d',
                    borderLeft: '3px solid #ef4444'
                  }}
                >
                  <strong>Reason:</strong> {rejectionReason}
                </div>
              )}
              <div style={{ fontSize: '12px', color: '#991b1b', marginTop: '6px' }}>
                <i className="fa-solid fa-circle-info"></i> You can edit this document to correct the details and click <strong>Resubmit for Approval</strong>.
              </div>
            </div>
          </div>

        </div>
      </>
    );
  }

  // Draft Banner
  return (
    <>
      {printStyles}
      <div
        className="approval-banner approval-banner-draft no-print"
        style={{
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px 18px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '13px',
          color: '#475569'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="fa-regular fa-file-lines" style={{ color: '#6366f1' }}></i>
          <span>
            <strong>Draft Document:</strong> You can edit and save changes freely, or submit for Main Admin approval when ready.
          </span>
        </div>
      </div>
    </>
  );
}
