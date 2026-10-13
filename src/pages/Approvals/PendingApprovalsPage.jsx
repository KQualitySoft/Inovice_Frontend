import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import approvalService, { DOC_STATUS } from '../../services/approvalService';
import userService from '../../services/userService';
import {
  hasAnyApproveOrRejectPrivilege,
  canUserPerform
} from '../../services/permissionService';
import {
  ApproveConfirmModal,
  RejectReasonModal,
  ApprovalHistoryModal
} from '../../components/approvals/ApprovalModals';
import ApprovalStatusBadge from '../../components/approvals/ApprovalStatusBadge';
import Toast from '../../components/common/Toast';
import Modal from '../../components/common/Modal';
import { fmtDate } from '../../utils/dateUtils';
import { numberToWords } from '../../utils/numberToWords';
import notificationService from '../../services/notificationService';
import { FIXED_BILLED_BY, normalizeCompanyName } from '../../constants/companyDetails';

export default function PendingApprovalsPage() {
  const { isMainAdmin, currentUser, userEmail } = useAuth();
  const navigate = useNavigate();

  const [pendingList, setPendingList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [viewDocModalOpen, setViewDocModalOpen] = useState(false);
  const [approveModalOpen, setApproveModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyList, setHistoryList] = useState([]);

  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  const triggerToast = (msg) => {
    setToastMsg(msg);
    setShowToast(true);
  };

  const loadPendingDocuments = async () => {
    setLoading(true);
    try {
      const list = await approvalService.getPendingApprovalsAsync(currentUser);
      setPendingList(list);
    } catch (e) {
      console.warn('Error loading pending approvals:', e);
      setPendingList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingDocuments();
    window.addEventListener('invox_approvals_updated', loadPendingDocuments);
    return () => window.removeEventListener('invox_approvals_updated', loadPendingDocuments);
  }, [currentUser]);

  const canAccessApprovals = isMainAdmin || hasAnyApproveOrRejectPrivilege(currentUser);

  if (!canAccessApprovals) {
    return (
      <div className="db-content" style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', color: '#ef4444', marginBottom: '16px' }}>
          <i className="fa-solid fa-stamp"></i>
        </div>
        <h2>Access Denied</h2>
        <p style={{ color: '#64748b' }}>
          You do not have approval privileges assigned. Please contact the Main Administrator if you require access to approve business documents.
        </p>
      </div>
    );
  }

  // Filter pending documents
  const filteredDocs = pendingList.filter((doc) => {
    if (selectedType !== 'ALL' && doc.docType !== selectedType) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const docNum = (doc.docNumber || '').toLowerCase();
    const creator = (doc.submittedByName || doc.submittedBy || '').toLowerCase();
    const client = (doc.billedTo || '').toLowerCase();
    return docNum.includes(q) || creator.includes(q) || client.includes(q);
  });

  const totalPendingAmount = pendingList.reduce(
    (acc, d) => acc + (parseFloat(d.amount) || 0),
    0
  );

  const getDocRoute = (type) => {
    switch (type) {
      case 'invoice':
        return '/invoices/new';
      case 'quotation':
        return '/quotations/new';
      case 'purchase_order':
        return '/purchase-orders/new';
      case 'delivery_challan':
        return '/delivery-challan/new';
      case 'proforma_invoice':
        return '/proforma/new';
      case 'payment_voucher':
        return '/payment-vouchers/new';
      default:
        return '/invoices/new';
    }
  };

  // Handlers
  const handleView = async (doc) => {
    let parsedFd = {};
    if (doc.fullDataJson) {
      try {
        parsedFd = typeof doc.fullDataJson === 'string' ? JSON.parse(doc.fullDataJson) : doc.fullDataJson;
      } catch (e) {
        console.warn('Failed to parse fullDataJson:', e);
      }
    }
    const initialDoc = {
      ...doc,
      ...parsedFd
    };
    setSelectedDoc(initialDoc);
    setViewDocModalOpen(true);

    try {
      const full = await approvalService.getFullDocumentAsync(doc.docType, doc.docNumber);
      if (full) {
        setSelectedDoc((prev) => ({
          ...prev,
          ...full
        }));
      }
    } catch (e) {
      console.warn('Could not fetch additional full doc details:', e);
    }
  };

  const handleOpenApprove = (doc) => {
    setSelectedDoc(doc);
    setApproveModalOpen(true);
  };

  const handleOpenReject = (doc) => {
    setSelectedDoc(doc);
    setRejectModalOpen(true);
  };

  const handleOpenHistory = async (doc) => {
    setSelectedDoc(doc);
    const hist = await approvalService.getHistory(doc.docType, doc.docNumber);
    setHistoryList(hist);
    setHistoryModalOpen(true);
  };

  const confirmApprove = async (comments = '', sign = '', date = '') => {
    if (!selectedDoc) return;
    try {
      const activeRole = currentUser?.role || (isMainAdmin ? 'MainAdmin' : 'User');
      const activeEmail = currentUser?.email || 'admin@qualitysalespro.com';
      const activeId = currentUser?.id || 1;

      if (selectedDoc.docType === 'payment_voucher') {
        const approvedSign = (sign || selectedDoc.approvedSign || '').trim();
        const approvedDate = (date || selectedDoc.approvedDate || '').trim();
        if (!approvedSign || !approvedDate) {
          triggerToast('Approved By Signature and Date are required before approving the payment voucher.');
          alert('Approved By Signature and Date are required before approving the payment voucher.');
          return;
        }
      }

      const res = await approvalService.approveDocument({
        docType: selectedDoc.docType,
        docNumber: selectedDoc.docNumber,
        comments,
        approvedSign: sign || selectedDoc.approvedSign,
        approvedDate: date || selectedDoc.approvedDate,
        user: { userEmail: activeEmail, userId: activeId, userRole: activeRole, role: activeRole }
      });

      if (!res.success) {
        triggerToast(res.errors ? res.errors.join('\n') : 'Error approving document.');
        return;
      }

      userService.logActivity({
        userEmail: currentUser?.email || activeEmail,
        userName: currentUser?.fullName || 'Main Admin',
        action: 'Document Approved',
        details: `Main Admin approved ${selectedDoc.docType.toUpperCase()} ${selectedDoc.docNumber} submitted by ${selectedDoc.submittedByName || selectedDoc.submittedBy}`
      });

      notificationService.addNotification({
        title: 'Document Approved',
        message: `${formatDocTypeLabel(selectedDoc.docType)} ${selectedDoc.docNumber} has been approved by ${currentUser?.fullName || activeEmail}.`,
        type: 'success',
        targetEmail: selectedDoc.submittedBy,
        userEmail: currentUser?.email || activeEmail,
        docType: selectedDoc.docType,
        docNumber: selectedDoc.docNumber,
        actionUrl: `${getDocRoute(selectedDoc.docType)}?edit=${encodeURIComponent(selectedDoc.docNumber)}&step=3`
      });

      triggerToast(`Document ${selectedDoc.docNumber} approved successfully.`);
      setApproveModalOpen(false);
      setViewDocModalOpen(false);
      await loadPendingDocuments();
    } catch (err) {
      triggerToast(err.message || 'Error approving document.');
    }
  };

  const confirmReject = async (reason) => {
    if (!selectedDoc) return;
    try {
      const activeRole = currentUser?.role || (isMainAdmin ? 'MainAdmin' : 'User');
      const activeEmail = currentUser?.email || 'admin@qualitysalespro.com';
      const activeId = currentUser?.id || 1;
      const res = await approvalService.rejectDocument({
        docType: selectedDoc.docType,
        docNumber: selectedDoc.docNumber,
        reason,
        user: { userEmail: activeEmail, userId: activeId, userRole: activeRole, role: activeRole }
      });

      if (!res.success) {
        triggerToast(res.errors ? res.errors.join('\n') : 'Error rejecting document.');
        return;
      }

      userService.logActivity({
        userEmail: currentUser.email,
        userName: currentUser.fullName,
        action: 'Document Rejected',
        details: `Main Admin rejected ${selectedDoc.docType.toUpperCase()} ${selectedDoc.docNumber}. Reason: ${reason}`
      });

      notificationService.addNotification({
        title: 'Document Rejected',
        message: `${formatDocTypeLabel(selectedDoc.docType)} ${selectedDoc.docNumber} was rejected by ${currentUser.fullName || currentUser.email}. Reason: "${reason}"`,
        type: 'danger',
        targetEmail: selectedDoc.submittedBy,
        userEmail: currentUser.email,
        docType: selectedDoc.docType,
        docNumber: selectedDoc.docNumber,
        actionUrl: `${getDocRoute(selectedDoc.docType)}?edit=${encodeURIComponent(selectedDoc.docNumber)}&step=3`
      });

      triggerToast(`Document ${selectedDoc.docNumber} was rejected.`);
      setRejectModalOpen(false);
      setViewDocModalOpen(false);
      loadPendingDocuments();
    } catch (err) {
      triggerToast(err.message || 'Error rejecting document.');
    }
  };

  const formatDocTypeLabel = (type) => {
    switch (type) {
      case 'invoice':
        return 'Invoice';
      case 'quotation':
        return 'Quotation';
      case 'purchase_order':
        return 'Purchase Order';
      case 'delivery_challan':
        return 'Delivery Challan';
      case 'proforma_invoice':
        return 'Proforma Invoice';
      case 'payment_voucher':
        return 'Payment Voucher';
      default:
        return type;
    }
  };

  const getDocTypeIcon = (type) => {
    switch (type) {
      case 'invoice':
        return 'fa-file-invoice';
      case 'quotation':
        return 'fa-file-lines';
      case 'purchase_order':
        return 'fa-cart-flatbed';
      case 'delivery_challan':
        return 'fa-truck';
      case 'proforma_invoice':
        return 'fa-truck';
      case 'payment_voucher':
        return 'fa-money-bill-wave';
      default:
        return 'fa-file';
    }
  };

  return (
    <div className="db-content" style={{ maxWidth: '100%', width: '100%', boxSizing: 'border-box', padding: '20px 24px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
              Pending Approvals
            </h1>
            <span
              style={{
                backgroundColor: pendingList.length > 0 ? '#dc2626' : '#64748b',
                color: '#ffffff',
                borderRadius: '20px',
                padding: '2px 10px',
                fontSize: '12px',
                fontWeight: 800
              }}
            >
              {pendingList.length} Waiting
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px', marginBottom: 0 }}>
            Review business documents submitted by staff members. Approve to finalize or reject with feedback.
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '20px', width: '100%' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', minWidth: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px', letterSpacing: '0.04em' }}>
            Pending Documents
          </div>
          <div style={{ fontSize: '26px', fontWeight: 800, color: '#dc2626' }}>
            {pendingList.length}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Awaiting your final review
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', minWidth: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px', letterSpacing: '0.04em' }}>
            Total Pending Value
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            ₹{totalPendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
            Combined value of awaiting documents
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', minWidth: 0 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px', letterSpacing: '0.04em' }}>
            Approval Authority
          </div>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#4f46e5', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
            <i className="fa-solid fa-shield-halved"></i> Main Administrator
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Logged in as: {currentUser?.fullName}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', width: '100%' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', maxWidth: '420px', minWidth: '200px' }}>
          <i
            className="fa-solid fa-magnifying-glass"
            style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
          ></i>
          <input
            type="text"
            placeholder="Search document no, creator, client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Document Type:</span>
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '13px',
              backgroundColor: '#ffffff'
            }}
          >
            <option value="ALL">All Document Types</option>
            <option value="invoice">Invoices</option>
            <option value="quotation">Quotations</option>
            <option value="purchase_order">Purchase Orders</option>
            <option value="delivery_challan">Delivery Challans</option>
            <option value="proforma_invoice">Proforma Invoices</option>
            <option value="payment_voucher">Payment Vouchers</option>
          </select>
        </div>
      </div>

      {/* Pending Approvals Table */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflowX: 'auto', WebkitOverflowScrolling: 'touch', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', width: '100%' }}>
        <table style={{ width: '100%', minWidth: '880px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
              <th style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>Document</th>
              <th style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>Type</th>
              <th style={{ padding: '11px 14px' }}>Created By</th>
              <th style={{ padding: '11px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>Amount</th>
              <th style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>Date Submitted</th>
              <th style={{ padding: '11px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>Status</th>
              <th style={{ padding: '11px 14px', textAlign: 'center', whiteSpace: 'nowrap', width: '210px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '40px 16px', textAlign: 'center', color: '#94a3b8' }}>
                  <i className="fa-solid fa-clipboard-check" style={{ fontSize: '32px', marginBottom: '10px', display: 'block', color: '#10b981' }}></i>
                  <strong>All caught up!</strong>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>There are no documents currently pending your approval.</div>
                </td>
              </tr>
            ) : (
              filteredDocs.map((doc) => (
                <tr key={`${doc.docType}_${doc.docNumber}`} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                    <div style={{ fontWeight: 700, color: '#0f172a', fontFamily: 'monospace', fontSize: '13px' }}>
                      {doc.docNumber}
                    </div>
                    {doc.billedTo && (
                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>Client: {doc.billedTo}</div>
                    )}
                  </td>
                  <td style={{ padding: '11px 14px', whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: '#f1f5f9',
                        color: '#334155',
                        fontSize: '12px',
                        fontWeight: 600
                      }}
                    >
                      <i className={`fa-solid ${getDocTypeIcon(doc.docType)}`} style={{ color: '#6366f1' }}></i>
                      {formatDocTypeLabel(doc.docType)}
                    </span>
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '13px' }}>
                      {doc.submittedByName || (doc.submittedBy ? doc.submittedBy.split('@')[0] : 'User')}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748b' }}>{doc.submittedBy}</div>
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'right', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
                    ₹{(parseFloat(doc.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td style={{ padding: '11px 14px', color: '#64748b', fontSize: '12px', whiteSpace: 'nowrap' }}>
                    {fmtDate(doc.submittedAt || doc.date)}
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <ApprovalStatusBadge status={DOC_STATUS.PENDING_APPROVAL} />
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', gap: '5px', alignItems: 'center', justifyContent: 'center' }}>
                      {/* View button */}
                      <button
                        type="button"
                        onClick={() => handleView(doc)}
                        title="View Document Details"
                        style={{
                          background: '#ffffff',
                          border: '1px solid #cbd5e1',
                          borderRadius: '6px',
                          padding: '5px 9px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: '#334155',
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <i className="fa-solid fa-eye"></i> View
                      </button>

                      {/* Approve button */}
                      {(isMainAdmin || canUserPerform(currentUser, doc.docType, 'approve')) && (
                        <button
                          type="button"
                          onClick={() => handleOpenApprove(doc)}
                          title="Approve Document"
                          style={{
                            background: '#16a34a',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '5px 10px',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#ffffff',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <i className="fa-solid fa-check"></i> Approve
                        </button>
                      )}

                      {/* Reject button */}
                      {(isMainAdmin || canUserPerform(currentUser, doc.docType, 'reject')) && (
                        <button
                          type="button"
                          onClick={() => handleOpenReject(doc)}
                          title="Reject Document"
                          style={{
                            background: '#dc2626',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '5px 10px',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#ffffff',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <i className="fa-solid fa-xmark"></i> Reject
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── VIEW DOCUMENT DETAILS MODAL ── */}
      {viewDocModalOpen && selectedDoc && (
        <Modal
          isOpen={viewDocModalOpen}
          onClose={() => setViewDocModalOpen(false)}
          title={`Review ${formatDocTypeLabel(selectedDoc.docType)}: ${selectedDoc.docNumber}`}
          maxWidth="940px"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: 'calc(85vh - 100px)', overflowY: 'auto', paddingRight: '6px' }}>
            
            {/* Top Bar: Submitter, Status & Open Full Page Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ApprovalStatusBadge status={selectedDoc.status || DOC_STATUS.PENDING_APPROVAL} />
                <span style={{ fontSize: '13px', color: '#475569' }}>
                  Submitted by <strong style={{ color: '#0f172a' }}>{selectedDoc.submittedByName || selectedDoc.submittedBy}</strong> {selectedDoc.submittedAt ? `on ${fmtDate(selectedDoc.submittedAt)}` : ''}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setViewDocModalOpen(false);
                  navigate(`${getDocRoute(selectedDoc.docType)}?edit=${encodeURIComponent(selectedDoc.docNumber)}&step=3`);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: '#4f46e5',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '7px 14px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
                title="Open in full screen document preview and editor"
              >
                <i className="fa-solid fa-arrow-up-right-from-square"></i> Open Full Screen Document
              </button>
            </div>

            {/* Document Header & Dates Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', padding: '14px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
              <div>
                <span style={{ color: '#64748b', fontSize: '12px' }}>Document No:</span>
                <strong style={{ display: 'block', color: '#0f172a', fontSize: '15px' }}>{selectedDoc.docNumber}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '12px' }}>Document Type:</span>
                <strong style={{ display: 'block', color: '#0f172a' }}>{formatDocTypeLabel(selectedDoc.docType)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', fontSize: '12px' }}>Date:</span>
                <strong style={{ display: 'block', color: '#0f172a' }}>{selectedDoc.date ? fmtDate(selectedDoc.date) : '—'}</strong>
              </div>
              {!(selectedDoc.docType === 'payment_voucher' || selectedDoc.docType === 'payment-voucher' || String(selectedDoc.docNumber || '').startsWith('PV-')) && (
                <div>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Due Date:</span>
                  <strong style={{ display: 'block', color: '#0f172a' }}>{selectedDoc.dueDate ? fmtDate(selectedDoc.dueDate) : '—'}</strong>
                </div>
              )}
              {selectedDoc.refPoNo && (
                <div>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Reference PO No:</span>
                  <strong style={{ display: 'block', color: '#0f172a' }}>{selectedDoc.refPoNo}</strong>
                </div>
              )}
              {selectedDoc.refDcNo && (
                <div>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Reference DC No:</span>
                  <strong style={{ display: 'block', color: '#0f172a' }}>{selectedDoc.refDcNo}</strong>
                </div>
              )}
              {selectedDoc.refPiNo && (
                <div>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Reference PI No:</span>
                  <strong style={{ display: 'block', color: '#0f172a' }}>{selectedDoc.refPiNo}</strong>
                </div>
              )}
              {selectedDoc.refQuotationNo && (
                <div>
                  <span style={{ color: '#64748b', fontSize: '12px' }}>Reference Quotation No:</span>
                  <strong style={{ display: 'block', color: '#0f172a' }}>{selectedDoc.refQuotationNo}</strong>
                </div>
              )}
            </div>

            {/* Billing Parties (Billed By & Billed To) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {/* Billed By */}
              <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  Billed By (Issuer)
                </div>
                <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                  {normalizeCompanyName(selectedDoc.billedBy?.bizName || FIXED_BILLED_BY.bizName)}
                </strong>
                <div style={{ color: '#475569', fontSize: '12px', marginBottom: '2px' }}>
                  <span style={{ fontWeight: 600 }}>GSTIN:</span> {selectedDoc.billedBy?.gstin || FIXED_BILLED_BY.gstin}
                </div>
                <div style={{ color: '#475569', fontSize: '12px', marginBottom: '2px' }}>
                  <span style={{ fontWeight: 600 }}>PAN:</span> {selectedDoc.billedBy?.pan || FIXED_BILLED_BY.pan}
                </div>
                <div style={{ color: '#475569', fontSize: '12px', marginBottom: '2px' }}>
                  <span style={{ fontWeight: 600 }}>Email:</span> {selectedDoc.billedBy?.email || FIXED_BILLED_BY.email}
                </div>
                <div style={{ color: '#475569', fontSize: '12px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600 }}>Phone:</span> {selectedDoc.billedBy?.phone || FIXED_BILLED_BY.phone}
                </div>
                <div style={{ color: '#64748b', fontSize: '12px', lineHeight: 1.4 }}>
                  {[
                    selectedDoc.billedBy?.address || FIXED_BILLED_BY.address,
                    selectedDoc.billedBy?.city || FIXED_BILLED_BY.city,
                    selectedDoc.billedBy?.state || FIXED_BILLED_BY.state,
                    selectedDoc.billedBy?.postal || FIXED_BILLED_BY.postal
                  ].filter(Boolean).join(', ') || 'India'}
                </div>
              </div>

              {/* Billed To */}
              <div style={{ backgroundColor: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '13px' }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                  Billed To / Client
                </div>
                <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                  {selectedDoc.billedTo?.bizName || (typeof selectedDoc.billedTo === 'string' ? selectedDoc.billedTo : '') || selectedDoc.client?.name || selectedDoc.paidTo || '—'}
                </strong>
                {selectedDoc.billedTo?.gstin && (
                  <div style={{ color: '#475569', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600 }}>GSTIN:</span> {selectedDoc.billedTo.gstin}
                  </div>
                )}
                {typeof selectedDoc.billedTo === 'object' && selectedDoc.billedTo?.address && (
                  <div style={{ color: '#64748b', fontSize: '12px', lineHeight: 1.4, marginBottom: '4px' }}>
                    {[selectedDoc.billedTo.address, selectedDoc.billedTo.city, selectedDoc.billedTo.state, selectedDoc.billedTo.postal].filter(Boolean).join(', ')}
                  </div>
                )}
                {(selectedDoc.contactEmail || selectedDoc.contactPhone || selectedDoc.email || selectedDoc.phone) && (
                  <div style={{ color: '#475569', fontSize: '12px' }}>
                    {[selectedDoc.contactEmail || selectedDoc.email, selectedDoc.contactPhone || selectedDoc.phone].filter(Boolean).join(' | ')}
                  </div>
                )}
              </div>
            </div>

            {/* Line Items Table */}
            {Array.isArray(selectedDoc.items) && selectedDoc.items.length > 0 && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', backgroundColor: '#f1f5f9', fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                  Line Items & Charges
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                        <th style={{ padding: '8px 12px', width: '36px' }}>#</th>
                        <th style={{ padding: '8px 12px' }}>Item & Description</th>
                        <th style={{ padding: '8px 12px', width: '90px' }}>HSN/SAC</th>
                        <th style={{ padding: '8px 12px', width: '70px', textAlign: 'right' }}>Qty</th>
                        <th style={{ padding: '8px 12px', width: '90px', textAlign: 'right' }}>Rate (₹)</th>
                        <th style={{ padding: '8px 12px', width: '70px', textAlign: 'right' }}>GST %</th>
                        <th style={{ padding: '8px 12px', width: '100px', textAlign: 'right' }}>Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDoc.items.map((item, idx) => {
                        const clean = (val) => parseFloat(String(val || '').replace(/[^\d.]/g, '')) || 0;
                        const rateNum = clean(item.rate);
                        const qtyNum = clean(item.qty) || 1;
                        const gstNum = clean(item.gst);
                        const lineAmt = clean(item.amount) || clean(item.total) || (qtyNum * rateNum);
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{idx + 1}</td>
                            <td style={{ padding: '8px 12px' }}>
                              <strong style={{ color: '#0f172a', display: 'block' }}>{item.itemName || item.name || 'Item'}</strong>
                              {item.desc && <span style={{ color: '#64748b', fontSize: '11px' }}>{item.desc}</span>}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#475569' }}>{item.hsn || '—'}</td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#0f172a' }}>
                              {item.qty || 1} {item.uom || ''}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#0f172a' }}>
                              ₹{rateNum.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', color: '#475569' }}>
                              {gstNum ? `${gstNum}%` : '0%'}
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, color: '#0f172a' }}>
                              ₹{lineAmt.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payment Rows (for Payment Vouchers) */}
            {Array.isArray(selectedDoc.paymentRows) && selectedDoc.paymentRows.length > 0 && (
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', backgroundColor: '#f1f5f9', fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                  Payment Details
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                      <th style={{ padding: '8px 12px', width: '36px' }}>#</th>
                      <th style={{ padding: '8px 12px' }}>Payee (Paid To)</th>
                      <th style={{ padding: '8px 12px' }}>Description / Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedDoc.paymentRows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{idx + 1}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: '#0f172a' }}>{row.payee || '—'}</td>
                        <td style={{ padding: '8px 12px', color: '#475569' }}>{row.description || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Totals & Notes Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
              {/* Left Column: Bank accounts & Notes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Array.isArray(selectedDoc.bankAccounts) && selectedDoc.bankAccounts.length > 0 && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                    <div style={{ fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                      <i className="fa-solid fa-building-columns" style={{ marginRight: '6px' }}></i> Bank Account Details
                    </div>
                    {selectedDoc.bankAccounts.map((b, i) => (
                      <div key={i} style={{ color: '#334155', lineHeight: 1.4 }}>
                        <div><strong>Bank:</strong> {b.bankName} | <strong>A/C:</strong> {b.accountNumber || b.accountNo}</div>
                        <div><strong>IFSC:</strong> {b.ifscCode || b.ifsc} {b.accountHolderName ? `| Holder: ${b.accountHolderName}` : (b.branch ? `| Branch: ${b.branch}` : '')}</div>
                      </div>
                    ))}
                  </div>
                )}

                {Array.isArray(selectedDoc.upiAccounts) && selectedDoc.upiAccounts.length > 0 && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                    <span style={{ fontWeight: 700, color: '#475569' }}>
                      <i className="fa-solid fa-qrcode" style={{ marginRight: '6px' }}></i> UPI ID:
                    </span>{' '}
                    <span style={{ color: '#0f172a', fontWeight: 600 }}>{selectedDoc.upiAccounts[0]?.upiId}</span>
                  </div>
                )}

                {selectedDoc.notes && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                    <div style={{ fontWeight: 700, color: '#475569', marginBottom: '4px' }}>Notes</div>
                    <div style={{ color: '#475569', whiteSpace: 'pre-wrap' }}>{selectedDoc.notes}</div>
                  </div>
                )}

                {selectedDoc.docType === 'payment_voucher' && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}>
                    <div style={{ fontWeight: 700, color: '#475569', marginBottom: '8px' }}>
                      <i className="fa-solid fa-signature" style={{ marginRight: '6px' }}></i> Signatures
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <div style={{ background: '#fff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>RECEIVED BY:</div>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>Sign: {selectedDoc.receivedSign || '—'}</div>
                        <div style={{ color: '#475569' }}>Date: {selectedDoc.receivedDate || '—'}</div>
                      </div>
                      <div style={{ background: '#fff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>APPROVED BY:</div>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>Sign: {selectedDoc.approvedSign || '(Pending)'}</div>
                        <div style={{ color: '#475569' }}>Date: {selectedDoc.approvedDate || '(Pending)'}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Financial Summary Card */}
              <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <span style={{ color: '#64748b', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Total Document Amount
                </span>
                <strong style={{ color: '#16a34a', fontSize: '24px', margin: '4px 0 6px' }}>
                  ₹{(parseFloat(selectedDoc.amount || selectedDoc.totalAmount || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </strong>
                <div style={{ fontSize: '12px', color: '#64748b', fontStyle: 'italic', lineHeight: 1.4 }}>
                  {numberToWords(Math.round(parseFloat(selectedDoc.amount || selectedDoc.totalAmount || 0)))}
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid #e2e8f0', marginTop: '8px' }}>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleOpenReject(selectedDoc)}
                  style={{
                    backgroundColor: '#dc2626',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-xmark"></i> Reject
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenApprove(selectedDoc)}
                  style={{
                    backgroundColor: '#16a34a',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 20px',
                    borderRadius: '6px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-check"></i> Approve Document
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation & Action Modals */}
      {approveModalOpen && selectedDoc && (
        <ApproveConfirmModal
          isOpen={approveModalOpen}
          onClose={() => setApproveModalOpen(false)}
          onConfirm={confirmApprove}
          docType={selectedDoc.docType}
          docNumber={selectedDoc.docNumber}
          initialApprovedSign={selectedDoc.approvedSign || ''}
          initialApprovedDate={selectedDoc.approvedDate || ''}
        />
      )}

      {rejectModalOpen && selectedDoc && (
        <RejectReasonModal
          isOpen={rejectModalOpen}
          onClose={() => setRejectModalOpen(false)}
          onConfirm={confirmReject}
          docType={formatDocTypeLabel(selectedDoc.docType)}
          docNumber={selectedDoc.docNumber}
        />
      )}



      {showToast && <Toast message={toastMsg} onClose={() => setShowToast(false)} />}
    </div>
  );
}
