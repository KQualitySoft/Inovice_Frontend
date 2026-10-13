import React, { useState } from 'react';
import Modal from '../common/Modal';
import { fmtDate, formatAppDate } from '../../utils/dateUtils';
import ApprovalStatusBadge from './ApprovalStatusBadge';

// ── Approve Confirmation Modal ─────────────────────
export function ApproveConfirmModal({
  isOpen,
  docNumber,
  docType,
  initialApprovedSign = '',
  initialApprovedDate = '',
  onClose,
  onConfirm,
  loading = false
}) {
  const [comments, setComments] = useState('');
  const [approvedSign, setApprovedSign] = useState(initialApprovedSign);
  const [approvedDate, setApprovedDate] = useState(
    initialApprovedDate || (docType === 'payment_voucher' ? new Date().toISOString().split('T')[0] : '')
  );
  const [error, setError] = useState('');

  const isPaymentVoucher = docType === 'payment_voucher' || String(docNumber || '').startsWith('PV-');

  React.useEffect(() => {
    if (isOpen) {
      setApprovedSign(initialApprovedSign || '');
      setApprovedDate(
        initialApprovedDate || (docType === 'payment_voucher' ? new Date().toISOString().split('T')[0] : '')
      );
      setError('');
    }
  }, [isOpen, initialApprovedSign, initialApprovedDate, docType]);

  const handleConfirm = () => {
    if (isPaymentVoucher) {
      if (!approvedSign?.trim() || !approvedDate?.trim()) {
        const msg = "Approved By Signature and Date are required before approving the payment voucher.";
        setError(msg);
        alert(msg);
        return;
      }
    }
    setError('');
    onConfirm(comments, approvedSign?.trim() || '', approvedDate?.trim() || '');
    setComments('');
  };

  const handleCancel = () => {
    setComments('');
    setError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Confirm Document Approval"
      onClose={handleCancel}
      onConfirm={handleConfirm}
      confirmText={loading ? 'Approving...' : 'Approve Document'}
      cancelText="Cancel"
      icon="fa-solid fa-circle-check"
      maxWidth="500px"
      width="100%"
      message={
        <div>
          <p style={{ fontSize: '14px', color: '#334155', marginBottom: '14px' }}>
            Are you sure you want to approve document <strong>{docNumber}</strong>?
          </p>
          <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '14px' }}>
            Once approved, the document will become finalized and locked from editing.
          </p>

          {isPaymentVoucher && (
            <div
              style={{
                marginTop: '12px',
                marginBottom: '14px',
                padding: '12px 14px',
                backgroundColor: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px'
              }}
            >
              <div
                style={{
                  fontSize: '12.5px',
                  fontWeight: '700',
                  color: '#1e293b',
                  marginBottom: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <i className="fa-solid fa-pen-nib" style={{ color: '#4f46e5' }}></i>
                Approver Signature &amp; Date (Mandatory for Payment Voucher)
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#475569',
                    marginBottom: '4px'
                  }}
                >
                  Approved By Sign <span style={{ color: '#ef4444' }}>*</span>:
                </label>
                <input
                  type="text"
                  placeholder="Enter approver signature / name"
                  value={approvedSign}
                  onChange={(e) => {
                    setApprovedSign(e.target.value);
                    if (error) setError('');
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: error && !approvedSign.trim() ? '2px solid #ef4444' : '1px solid #cbd5e1',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: '#475569',
                    marginBottom: '4px'
                  }}
                >
                  Approved By Date <span style={{ color: '#ef4444' }}>*</span>:
                </label>
                <div style={{ position: 'relative', width: '100%' }}>
                  <input
                    type="date"
                    value={approvedDate}
                    onChange={(e) => {
                      setApprovedDate(e.target.value);
                      if (error) setError('');
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: error && !approvedDate.trim() ? '2px solid #ef4444' : '1px solid #cbd5e1',
                      fontSize: '13px',
                      boxSizing: 'border-box',
                      color: 'transparent',
                      caretColor: 'transparent',
                      cursor: 'pointer'
                    }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: 0,
                      bottom: 0,
                      right: '34px',
                      display: 'flex',
                      alignItems: 'center',
                      pointerEvents: 'none',
                      fontSize: '13px',
                      color: approvedDate ? '#0f172a' : '#94a3b8'
                    }}
                  >
                    {approvedDate ? fmtDate(approvedDate) : 'DD/MMM/YYYY'}
                  </span>
                </div>
              </div>

              {error && (
                <div
                  style={{
                    color: '#ef4444',
                    fontSize: '12px',
                    marginTop: '8px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <i className="fa-solid fa-triangle-exclamation"></i>
                  {error}
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: '12px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: '#475569',
                marginBottom: '6px'
              }}
            >
              Approval Comments (Optional):
            </label>
            <textarea
              rows="3"
              placeholder="Add any internal approval remarks or references..."
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>
      }
    />
  );
}

// ── Reject Reason Modal (Reason Mandatory) ─────────
export function RejectReasonModal({
  isOpen,
  docNumber,
  onClose,
  onConfirm,
  loading = false
}) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = () => {
    if (!reason.trim()) {
      setError('A rejection reason is mandatory. Please explain why this document was rejected.');
      return;
    }
    setError('');
    onConfirm(reason.trim());
    setReason('');
  };

  const handleCancel = () => {
    setReason('');
    setError('');
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Reject Document"
      onClose={handleCancel}
      onConfirm={handleConfirm}
      confirmText={loading ? 'Rejecting...' : 'Reject Document'}
      cancelText="Cancel"
      isDanger={true}
      icon="fa-solid fa-circle-xmark"
      message={
        <div>
          <p style={{ fontSize: '14px', color: '#334155', marginBottom: '10px' }}>
            You are rejecting document <strong>{docNumber}</strong>.
          </p>
          <p style={{ fontSize: '13px', color: '#b91c1c', marginBottom: '14px' }}>
            A rejection reason is required so the submitter understands what details need to be corrected before resubmission.
          </p>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                color: '#334155',
                marginBottom: '6px'
              }}
            >
              Rejection Reason <span style={{ color: '#ef4444' }}>*</span>:
            </label>
            <textarea
              rows="4"
              placeholder="Specify the reason for rejection (e.g., incorrect billing address, invalid tax rates, missing line items)..."
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (error) setError('');
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: error ? '2px solid #ef4444' : '1px solid #cbd5e1',
                fontSize: '13px',
                fontFamily: 'inherit',
                resize: 'vertical',
                boxSizing: 'border-box'
              }}
            />
            {error && (
              <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '6px', fontWeight: '500' }}>
                <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '4px' }}></i>
                {error}
              </div>
            )}
          </div>
        </div>
      }
    />
  );
}

// ── Approval History Timeline Modal ────────────────
export function ApprovalHistoryModal({
  isOpen,
  docNumber,
  history = [],
  onClose
}) {
  return null;

  const sortedHistory = [...history].sort(
    (a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
  );

  const getActionBadge = (action) => {
    const act = (action || '').toLowerCase();
    if (act.includes('approve')) {
      return { bg: '#dcfce7', color: '#166534', icon: 'fa-check' };
    }
    if (act.includes('reject')) {
      return { bg: '#fee2e2', color: '#991b1b', icon: 'fa-xmark' };
    }
    if (act.includes('resubmit')) {
      return { bg: '#e0e7ff', color: '#3730a3', icon: 'fa-rotate-right' };
    }
    if (act.includes('submit')) {
      return { bg: '#fef3c7', color: '#92400e', icon: 'fa-paper-plane' };
    }
    return { bg: '#f1f5f9', color: '#475569', icon: 'fa-file-lines' };
  };

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        className="modal-box"
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '620px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: '#e0e7ff',
                color: '#4f46e5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px'
              }}
            >
              <i className="fa-solid fa-clock-rotate-left"></i>
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '700', color: '#0f172a' }}>
                Approval History
              </h3>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Document: <strong>{docNumber || '—'}</strong>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '18px',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            &times;
          </button>
        </div>

        {/* Body Timeline */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {sortedHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: '#94a3b8' }}>
              <i className="fa-regular fa-folder-open fa-2x" style={{ marginBottom: '10px' }}></i>
              <p style={{ margin: 0, fontSize: '14px' }}>No approval history recorded for this document yet.</p>
            </div>
          ) : (
            <div style={{ position: 'relative', paddingLeft: '28px' }}>
              {/* Vertical line */}
              <div
                style={{
                  position: 'absolute',
                  left: '11px',
                  top: '12px',
                  bottom: '12px',
                  width: '2px',
                  backgroundColor: '#e2e8f0'
                }}
              />

              {sortedHistory.map((item, idx) => {
                const badge = getActionBadge(item.action);
                return (
                  <div key={idx} style={{ position: 'relative', marginBottom: '22px' }}>
                    {/* Node Dot */}
                    <div
                      style={{
                        position: 'absolute',
                        left: '-28px',
                        top: '2px',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: badge.bg,
                        color: badge.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        border: '2px solid #ffffff',
                        boxShadow: '0 0 0 1px #e2e8f0'
                      }}
                    >
                      <i className={`fa-solid ${badge.icon}`}></i>
                    </div>

                    <div
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '8px',
                        padding: '12px 16px'
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '6px',
                          marginBottom: '6px'
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: badge.bg,
                            color: badge.color,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '11.5px',
                            fontWeight: '700',
                            textTransform: 'uppercase'
                          }}
                        >
                          {item.action}
                        </span>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                          {item.timestamp ? formatAppDate(item.timestamp, true) : '—'}
                        </span>
                      </div>

                      <div style={{ fontSize: '13px', color: '#334155', fontWeight: '500' }}>
                        By: <span style={{ color: '#0f172a' }}>{item.userEmail || 'System'}</span>
                        {item.newStatus && (
                          <span style={{ marginLeft: '12px' }}>
                            Status: <ApprovalStatusBadge status={item.newStatus} />
                          </span>
                        )}
                      </div>

                      {item.comments && (
                        <div
                          style={{
                            marginTop: '8px',
                            fontSize: '12.5px',
                            color: '#475569',
                            background: '#ffffff',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid #f1f5f9'
                          }}
                        >
                          <strong>Remarks:</strong> {item.comments}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'flex-end',
            background: '#f8fafc'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
