import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { paymentVouchersApi } from '../../services/api';
import { getDocumentPaymentStatus, isDocumentOverdue, fmtDate } from '../../utils/dateUtils';
import notificationService from '../../services/notificationService';
import Modal from '../../components/common/Modal';
import Pagination from '../../components/common/Pagination';
import { useAuth } from '../../context/AuthContext';
import ApprovalStatusBadge from '../../components/approvals/ApprovalStatusBadge';
import { ApprovalHistoryModal } from '../../components/approvals/ApprovalModals';
import {
  DOC_STATUS,
  normalizeStatus,
  canDeleteDocument,
  getAuditHistory,
  approvalService
} from '../../services/approvalService';
import '../../styles/document-dashboard.css';
import '../../styles/clients.css';

export default function PaymentVoucherDashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, userEmail, userId, userRole, isMainAdmin, hasActionAccess } = useAuth();

  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Status Filter: ALL, DRAFT, PENDING, APPROVED, REJECTED, due_all, due, overdue, paid
  const urlStatus = (searchParams.get('status') || 'ALL');
  const [statusFilter, setStatusFilter] = useState(urlStatus);
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    const s = (searchParams.get('status') || 'ALL');
    setStatusFilter(s);
  }, [searchParams]);

  const handleStatusFilterChange = (statusKey) => {
    setStatusFilter(statusKey);
    setCurrentPage(1);
    if (statusKey === 'ALL') {
      searchParams.delete('status');
      setSearchParams(searchParams);
    } else {
      setSearchParams({ status: statusKey });
    }
  };

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  // Delete modal
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteVoucher, setPendingDeleteVoucher] = useState(null);

  // Status Action modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [pendingStatusVoucher, setPendingStatusVoucher] = useState(null);
  const [pendingStatusAction, setPendingStatusAction] = useState(null);

  // Mark Paid modal
  const [paidModalOpen, setPaidModalOpen] = useState(false);
  const [pendingPaidVoucher, setPendingPaidVoucher] = useState(null);
  const [pendingAction, setPendingAction] = useState('paid');
  const [paymentAmountInput, setPaymentAmountInput] = useState('');

  // History modal
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyDoc, setHistoryDoc] = useState(null);

  const fetchVouchers = async () => {
    setLoading(true);
    try {
      const data = await paymentVouchersApi.getAll();
      if (Array.isArray(data)) {
        const mapped = data.map((v) => {
          let fd = {};
          if (v.fullDataJson || v.FullDataJson) {
            try {
              const raw = v.fullDataJson || v.FullDataJson;
              fd = typeof raw === 'string' ? JSON.parse(raw) : raw;
            } catch (e) {}
          }
          return {
            id: v.id,
            number: v.voucherNumber || `PV-${v.id}`,
            voucherNumber: v.voucherNumber || `PV-${v.id}`,
            paidTo: v.client ? v.client.name : v.paidTo || '—',
            amount: parseFloat(v.amount) || 0,
            paidAmount: parseFloat(v.paidAmount ?? v.amountPaid ?? (v.status?.toLowerCase() === 'paid' ? v.amount : 0)) || 0,
            isPaid: v.isPaid ?? (v.status?.toLowerCase() === 'paid'),
            date: v.date ? v.date.split('T')[0] : '',
            dueDate: v.dueDate ? v.dueDate.split('T')[0] : '',
            paymentMode: v.paymentMode || v.paymentMethod || 'Cash',
            status: normalizeStatus(v.status || DOC_STATUS.DRAFT),
            rawStatus: v.status,
            fullData: v.fullDataJson || v.FullDataJson,
            receivedSign: fd.receivedSign || '',
            receivedDate: fd.receivedDate || '',
            approvedSign: fd.approvedSign || (normalizeStatus(v.status) === DOC_STATUS.APPROVED ? (fd.approvedByName || (fd.approvedBy ? (fd.approvedBy.includes('@') ? fd.approvedBy.split('@')[0] : fd.approvedBy) : 'admin')) : ''),
            approvedDate: fd.approvedDate || (normalizeStatus(v.status) === DOC_STATUS.APPROVED ? ((fd.approvedAt || v.date || '').split('T')[0]) : '')
          };
        });
        setVouchers(mapped);
        try {
          localStorage.setItem('invox_payment_vouchers', JSON.stringify(mapped));
        } catch (e) {}
        try {
          notificationService.checkAndNotifyDueDocuments(mapped, 'payment_voucher');
        } catch (e) {
          console.warn('Due notification error:', e);
        }
        setLoading(false);
        return;
      }
    } catch (e) {
      console.warn('API error fetching payment vouchers, using localStorage:', e);
    }

    // Fallback: localStorage
    try {
      const stored = JSON.parse(localStorage.getItem('invox_payment_vouchers') || '[]');
      const mappedStored = stored.map((v) => ({
        ...v,
        status: normalizeStatus(v.status || DOC_STATUS.DRAFT),
        amount: parseFloat(v.amount) || 0,
        paidAmount: parseFloat(v.paidAmount ?? v.amountPaid ?? (v.status?.toLowerCase() === 'paid' ? v.amount : 0)) || 0,
        isPaid: v.isPaid ?? (v.status?.toLowerCase() === 'paid')
      }));
      setVouchers(mappedStored);
      try {
        notificationService.checkAndNotifyDueDocuments(mappedStored, 'payment_voucher');
      } catch (e) {}
    } catch (e) {
      setVouchers([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchVouchers();
    window.addEventListener('invox_approvals_updated', fetchVouchers);
    return () => window.removeEventListener('invox_approvals_updated', fetchVouchers);
  }, []);

  const baseFilteredVouchers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return vouchers;
    return vouchers.filter((v) => {
      const paidTo = (v.paidTo || '').toLowerCase();
      const num = (v.number || '').toLowerCase();
      const mode = (v.paymentMode || '').toLowerCase();
      return paidTo.includes(q) || num.includes(q) || mode.includes(q);
    });
  }, [vouchers, searchQuery]);

  const totalAmount = useMemo(() => {
    return baseFilteredVouchers.reduce((acc, v) => acc + (parseFloat(v.amount) || 0), 0);
  }, [baseFilteredVouchers]);

  const statistics = useMemo(() => {
    let totalDue = 0;
    let dueCount = 0;
    let normalDueCount = 0;
    let overdueCount = 0;
    let overdueAmount = 0;
    let paidCount = 0;

    baseFilteredVouchers.forEach((r) => {
      const s = normalizeStatus(r.status);
      const pay = getDocumentPaymentStatus(r);
      if (pay.status === 'Paid' || pay.isPaid) {
        paidCount++;
      } else if (s !== DOC_STATUS.REJECTED) {
        totalDue += pay.outstandingAmount;
        dueCount++;
        if (pay.status === 'Overdue') {
          overdueCount++;
          overdueAmount += pay.outstandingAmount;
        } else {
          normalDueCount++;
        }
      }
    });

    return { totalDue, dueCount, normalDueCount, overdueCount, overdueAmount, paidCount };
  }, [baseFilteredVouchers]);

  // Counts by status
  const counts = useMemo(() => {
    const res = {
      all: baseFilteredVouchers.length,
      draft: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    };
    baseFilteredVouchers.forEach((v) => {
      const s = normalizeStatus(v.status);
      if (s === DOC_STATUS.DRAFT) res.draft++;
      else if (s === DOC_STATUS.PENDING_APPROVAL) res.pending++;
      else if (s === DOC_STATUS.APPROVED) res.approved++;
      else if (s === DOC_STATUS.REJECTED) res.rejected++;
    });
    return res;
  }, [baseFilteredVouchers]);

  // Search & Status filter
  const filteredVouchers = useMemo(() => {
    return baseFilteredVouchers
      .filter((v) => {
        const s = normalizeStatus(v.status);
        const pay = getDocumentPaymentStatus(v);
        const hasOutstanding = !pay.isPaid && pay.outstandingAmount > 0 && pay.status !== 'Paid';
        if (statusFilter === 'due' || statusFilter === 'due_all') {
          if (!hasOutstanding) return false;
        } else if (statusFilter === 'overdue') {
          if (pay.status !== 'Overdue' || !hasOutstanding) return false;
        } else if (statusFilter === 'paid') {
          if (pay.status !== 'Paid' && !pay.isPaid) return false;
        } else if (statusFilter === 'DRAFT' && s !== DOC_STATUS.DRAFT) return false;
        else if (statusFilter === 'PENDING' && s !== DOC_STATUS.PENDING_APPROVAL) return false;
        else if (statusFilter === 'APPROVED' && s !== DOC_STATUS.APPROVED) return false;
        else if (statusFilter === 'REJECTED' && s !== DOC_STATUS.REJECTED) return false;
        return true;
      })
      .sort((a, b) => {
        let va = a[sortCol];
        let vb = b[sortCol];
        if (sortCol === 'date' || sortCol === 'dueDate') {
          va = va ? new Date(va).getTime() : 0;
          vb = vb ? new Date(vb).getTime() : 0;
        } else if (sortCol === 'amount') {
          va = parseFloat(va) || 0;
          vb = parseFloat(vb) || 0;
        } else if (sortCol === 'outstandingAmount') {
          const pa = getDocumentPaymentStatus(a).outstandingAmount;
          const pb = getDocumentPaymentStatus(b).outstandingAmount;
          return sortDir === 'asc' ? pa - pb : pb - pa;
        } else {
          va = (va || '').toString().toLowerCase();
          vb = (vb || '').toString().toLowerCase();
        }
        return sortDir === 'asc' ? (va > vb ? 1 : va < vb ? -1 : 0) : va < vb ? 1 : va > vb ? -1 : 0;
      });
  }, [baseFilteredVouchers, statusFilter, sortCol, sortDir]);

  const pagedVouchers = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredVouchers.slice(start, start + perPage);
  }, [filteredVouchers, currentPage]);

  const handleDownloadCSV = () => {
    if (!vouchers.length) {
      alert('No payment vouchers to download.');
      return;
    }
    const rows = [['Voucher No', 'Paid To', 'Date', 'Mode', 'Amount (₹)', 'Status']];
    vouchers.forEach((v) =>
      rows.push([v.number, v.paidTo, fmtDate(v.date), v.paymentMode, (v.amount || 0).toFixed(2), v.status])
    );
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'payment_vouchers.csv';
    a.click();
  };

  const handleDeleteClick = (v) => {
    if (!isMainAdmin && !hasActionAccess('payment_vouchers', 'delete')) {
      alert('You do not have privilege to delete payment vouchers.');
      return;
    }
    if (!canDeleteDocument(v.status)) {
      alert(`Cannot delete document in '${v.status}' status. Only Draft documents can be deleted.`);
      return;
    }
    setPendingDeleteVoucher(v);
    setDeleteModalOpen(true);
  };

  const handleOpenHistory = (v) => {
    const hist = getAuditHistory('payment_voucher', v.number || v.id);
    setHistoryDoc({
      docType: 'Payment Voucher',
      docNumber: v.number || v.id,
      history: hist,
    });
    setHistoryModalOpen(true);
  };

  const handleMarkPaidClick = (v, action = 'paid') => {
    setPendingPaidVoucher(v);
    setPendingAction(action);
    if (action === 'paid') {
      const pay = getDocumentPaymentStatus(v);
      setPaymentAmountInput(String(pay.outstandingAmount > 0 ? pay.outstandingAmount : v.amount || 0));
    } else {
      setPaymentAmountInput('0');
    }
    setPaidModalOpen(true);
  };

  const handleConfirmMarkPaid = async () => {
    if (!pendingPaidVoucher) return;
    const v = pendingPaidVoucher;
    setPaidModalOpen(false);

    let targetStatus = pendingAction === 'paid' ? 'Paid' : 'Unpaid';
    let paidAmt = v.amount;

    if (pendingAction === 'unpaid') {
      paidAmt = 0;
      targetStatus = 'Due';
    } else {
      const parsed = parseFloat(paymentAmountInput);
      paidAmt = isNaN(parsed) ? v.amount : Math.max(0, parsed);
      if (paidAmt >= v.amount) {
        targetStatus = 'Paid';
      } else {
        const overdue = isDocumentOverdue({ ...v, paidAmount: paidAmt, isPaid: false });
        targetStatus = overdue ? 'Overdue' : 'Due';
      }
    }

    try {
      if (paymentVouchersApi && paymentVouchersApi.updateStatusByNumber) {
        await paymentVouchersApi.updateStatusByNumber(v.number, targetStatus, paidAmt);
      } else if (paymentVouchersApi && paymentVouchersApi.updateStatus && v.id) {
        await paymentVouchersApi.updateStatus(v.id, targetStatus, paidAmt);
      }
    } catch (e) {
      console.warn('API status update error:', e);
    }

    // Sync localStorage
    try {
      const stored = JSON.parse(localStorage.getItem('invox_payment_vouchers') || '[]');
      const match = stored.find(
        (x) => String(x.id) === String(v.id) || x.number === v.number || x.voucherNumber === v.number
      );
      if (match) {
        match.status = targetStatus;
        match.paidAmount = paidAmt;
        match.amountPaid = paidAmt;
        match.isPaid = targetStatus.toLowerCase() === 'paid';
        localStorage.setItem('invox_payment_vouchers', JSON.stringify(stored));
      }
    } catch (e) {}

    await fetchVouchers();
    setPendingPaidVoucher(null);
  };

  const handleStatusClick = (v) => {
    const norm = normalizeStatus(v.status);
    if (norm === DOC_STATUS.DRAFT) {
      setPendingStatusVoucher(v);
      setPendingStatusAction({
        type: 'submit',
        title: 'Submit Payment Voucher for Approval',
        message: `Are you sure you want to submit Payment Voucher ${v.number} for Approval? Once submitted, the document will be under review.`,
        confirmText: 'Submit for Approval',
        confirmColor: '#4f46e5',
        icon: 'fa-solid fa-paper-plane'
      });
      setStatusModalOpen(true);
      return;
    }
    if (norm === DOC_STATUS.PENDING_APPROVAL) {
      if (isMainAdmin || hasActionAccess('payment_vouchers', 'approve')) {
        setPendingStatusVoucher(v);
        setPendingStatusAction({
          type: 'approve',
          title: 'Approve Payment Voucher',
          message: `Are you sure you want to approve Payment Voucher ${v.number}? Once approved, the document will become finalized and locked.`,
          confirmText: 'Approve Voucher',
          confirmColor: '#16a34a',
          icon: 'fa-solid fa-circle-check'
        });
        setStatusModalOpen(true);
      }
      return;
    }
    if (norm === DOC_STATUS.REJECTED) {
      setPendingStatusVoucher(v);
      setPendingStatusAction({
        type: 'submit',
        title: 'Resubmit Payment Voucher for Approval',
        message: `Are you sure you want to resubmit Payment Voucher ${v.number} for Approval?`,
        confirmText: 'Resubmit for Approval',
        confirmColor: '#4f46e5',
        icon: 'fa-solid fa-paper-plane'
      });
      setStatusModalOpen(true);
      return;
    }
    if (norm === DOC_STATUS.APPROVED) {
      const pay = getDocumentPaymentStatus(v);
      if (pay.status === 'Paid') {
        handleMarkPaidClick(v, 'unpaid');
      } else {
        handleMarkPaidClick(v, 'paid');
      }
      return;
    }
  };

  const handleConfirmStatusAction = async () => {
    if (!pendingStatusVoucher || !pendingStatusAction) return;
    const v = pendingStatusVoucher;
    const action = pendingStatusAction;
    setStatusModalOpen(false);

    try {
      if (action.type === 'submit') {
        const full = await approvalService.getFullDocumentAsync('payment_voucher', v.number);
        const recSign = (v.receivedSign || full?.receivedSign || '').trim();
        const recDate = (v.receivedDate || full?.receivedDate || '').trim();
        if (!recSign || !recDate) {
          alert('Received By Signature and Date are required before sending for approval.');
          navigate(`/payment-vouchers/new?edit=${encodeURIComponent(v.number || v.id)}&id=${encodeURIComponent(v.id)}`);
          return;
        }
        await approvalService.submitForApproval({
          docType: 'payment_voucher',
          docNumber: v.number,
          docData: {
            ...v,
            receivedSign: recSign,
            receivedDate: recDate
          },
          user: currentUser || { email: userEmail, id: userId, role: userRole },
          currentStatus: v.status
        });
      } else if (action.type === 'approve') {
        const full = await approvalService.getFullDocumentAsync('payment_voucher', v.number);
        const appSign = (v.approvedSign || full?.approvedSign || '').trim();
        const appDate = (v.approvedDate || full?.approvedDate || '').trim();
        if (!appSign || !appDate) {
          alert('Approved By Signature and Date are required before approving the payment voucher.');
          navigate(`/payment-vouchers/new?edit=${encodeURIComponent(v.number || v.id)}&id=${encodeURIComponent(v.id)}`);
          return;
        }
        await approvalService.approveDocument({
          docType: 'payment_voucher',
          docNumber: v.number,
          user: currentUser || { email: userEmail, id: userId, role: userRole },
          comments: 'Approved via Payment Voucher Dashboard',
          approvedSign: appSign,
          approvedDate: appDate
        });
      }
      await fetchVouchers();
    } catch (err) {
      console.error('Status action error:', err);
      alert(`Operation failed: ${err.message || err}`);
    } finally {
      setPendingStatusVoucher(null);
      setPendingStatusAction(null);
    }
  };

  const getStatusActionTitle = (v) => {
    const norm = normalizeStatus(v.status);
    if (norm === DOC_STATUS.DRAFT) {
      return 'Submit Payment Voucher for Approval';
    }
    if (norm === DOC_STATUS.PENDING_APPROVAL) {
      return isMainAdmin || hasActionAccess('payment_vouchers', 'approve')
        ? 'Approve Payment Voucher'
        : 'Pending Approval (Under Review)';
    }
    if (norm === DOC_STATUS.REJECTED) {
      return 'Resubmit Payment Voucher for Approval';
    }
    const pay = getDocumentPaymentStatus(v);
    if (pay.status === 'Paid') {
      return 'Payment Voucher Paid (Click to modify payment)';
    }
    return `Record Payment (Due: ₹${pay.outstandingAmount.toFixed(2)})`;
  };

  const getStatusActionColor = (v) => {
    const norm = normalizeStatus(v.status);
    if (norm === DOC_STATUS.DRAFT) return '#4f46e5';
    if (norm === DOC_STATUS.PENDING_APPROVAL) return '#d97706';
    if (norm === DOC_STATUS.REJECTED) return '#dc2626';
    const pay = getDocumentPaymentStatus(v);
    if (pay.status === 'Paid') return '#16a34a';
    if (pay.status === 'Overdue') return '#dc2626';
    return '#ea580c';
  };

  const getStatusActionIcon = (v) => {
    const norm = normalizeStatus(v.status);
    if (norm === DOC_STATUS.DRAFT) return 'fa-solid fa-paper-plane';
    if (norm === DOC_STATUS.PENDING_APPROVAL) {
      return isMainAdmin || hasActionAccess('payment_vouchers', 'approve') ? 'fa-solid fa-check' : 'fa-solid fa-clock';
    }
    if (norm === DOC_STATUS.REJECTED) return 'fa-solid fa-rotate-right';
    const pay = getDocumentPaymentStatus(v);
    if (pay.status === 'Paid') return 'fa-solid fa-circle-check';
    if (pay.status === 'Overdue') return 'fa-solid fa-triangle-exclamation';
    return 'fa-regular fa-circle-check';
  };

  const handleDuplicate = (v) => {
    const existingNums = vouchers.map((x) => x.number);
    let newNum = `PV-${Date.now()}`;
    const match = (v.number || '').match(/^([A-Za-z0-9\-]*\-)?(\d+)$/);
    if (match) {
      const prefix = match[1] || '';
      const numStr = match[2];
      const width = numStr.length;
      let n = parseInt(numStr, 10) + 1;
      while (existingNums.includes(prefix + String(n).padStart(width, '0'))) n++;
      newNum = prefix + String(n).padStart(width, '0');
    }
    navigate(`/payment-vouchers/new?copy=${encodeURIComponent(v.number || v.id)}&newnum=${encodeURIComponent(newNum)}`);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteVoucher) return;
    const v = pendingDeleteVoucher;
    const { id, number } = v;

    try {
      if (id && !String(id).startsWith('pv_')) {
        await paymentVouchersApi.delete(id);
      } else if (number) {
        await paymentVouchersApi.delete(number);
      }
    } catch (err) {
      console.warn('API delete error, falling back to delete by number:', err);
      if (number) {
        try {
          await paymentVouchersApi.delete(number);
        } catch (e2) {
          console.error('Delete failed:', e2);
          alert(`Could not delete payment voucher: ${e2.message || 'Server error'}`);
          return;
        }
      }
    }

    const updated = vouchers.filter((x) => String(x.id) !== String(id) && x.number !== number);
    setVouchers(updated);
    try {
      localStorage.setItem('invox_payment_vouchers', JSON.stringify(updated));
    } catch (e) {}

    setDeleteModalOpen(false);
    setPendingDeleteVoucher(null);
    await fetchVouchers();
  };

  if (loading) {
    return (
      <div className="inv-page" style={{ padding: '28px 32px', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '32px', marginBottom: '12px', display: 'block' }}></i>
          <p style={{ fontSize: '14px' }}>Loading payment vouchers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="inv-page" style={{ padding: '28px 32px', flex: 1, minWidth: 0 }}>
      {/* Top bar */}
      <div className="inv-topbar">
        <div>
          <div className="inv-breadcrumb">
            <Link to="/dashboard">Home</Link>
            <span className="sep">›</span>
            <span>Payment Vouchers</span>
          </div>
          <h1 className="inv-title">Payment Vouchers</h1>
        </div>
        <div className="inv-topbar-actions">
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <i
              className="fa-solid fa-magnifying-glass"
              style={{ position: 'absolute', left: '12px', color: '#94a3b8', fontSize: '13px', pointerEvents: 'none' }}
            ></i>
            <input
              type="text"
              id="voucherSearch"
              placeholder="Search vouchers…"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '8px 14px 8px 34px',
                borderRadius: '8px',
                border: '1px solid #e2e8f0',
                fontSize: '13.5px',
                outline: 'none',
                width: '240px',
                background: '#fff',
                color: '#0f172a',
                transition: 'all 0.15s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#6366f1';
                e.target.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#e2e8f0';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>
          {(isMainAdmin || hasActionAccess('payment_vouchers', 'create')) && (
            <Link to="/payment-vouchers/new" className="btn-create">
              <i className="fa-solid fa-plus"></i> Create New Payment Voucher
            </Link>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="inv-stats">
        <div
          className={`stat-card ${statusFilter === 'ALL' ? 'active-total' : ''}`}
          onClick={() => { handleStatusFilterChange('ALL'); }}
          title="Total Vouchers"
        >
          <div className="stat-card-header">
            <span className="stat-label">Total Vouchers</span>
            <div className="stat-icon blue">
              <i className="fa-solid fa-file-invoice"></i>
            </div>
          </div>
          <div className="stat-card-body">
            <div className="stat-value">{counts.all}</div>
            <div className="stat-amount-block" title={`Total Amount: ₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
              <span className="stat-amount-title" style={{ color: '#6366f1' }}>Total Amt</span>
              <span className="stat-amount-val" style={{ color: '#0f172a' }}>
                ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        <div
          className={`stat-card ${statusFilter === 'DRAFT' ? 'active-draft' : ''}`}
          onClick={() => { handleStatusFilterChange('DRAFT'); }}
          title="Drafts"
        >
          <div className="stat-card-header">
            <span className="stat-label">Drafts</span>
            <div className="stat-icon slate">
              <i className="fa-regular fa-file"></i>
            </div>
          </div>
          <div className="stat-card-body">
            <div className="stat-value">{counts.draft}</div>
          </div>
        </div>

        <div
          className={`stat-card ${statusFilter === 'PENDING' ? 'active-pending' : ''}`}
          onClick={() => { handleStatusFilterChange('PENDING'); }}
          title="Pending Approval"
        >
          <div className="stat-card-header">
            <span className="stat-label">Pending</span>
            <div className="stat-icon amber">
              <i className="fa-solid fa-hourglass-half"></i>
            </div>
          </div>
          <div className="stat-card-body">
            <div className="stat-value">{counts.pending}</div>
          </div>
        </div>

        <div
          className={`stat-card ${statusFilter === 'APPROVED' ? 'active-approved' : ''}`}
          onClick={() => { handleStatusFilterChange('APPROVED'); }}
          title="Approved"
        >
          <div className="stat-card-header">
            <span className="stat-label">Approved</span>
            <div className="stat-icon green">
              <i className="fa-solid fa-check-circle"></i>
            </div>
          </div>
          <div className="stat-card-body">
            <div className="stat-value">{counts.approved}</div>
          </div>
        </div>

        <div
          className={`stat-card ${statusFilter === 'REJECTED' ? 'active-rejected' : ''}`}
          onClick={() => { handleStatusFilterChange('REJECTED'); }}
          title="Rejected"
        >
          <div className="stat-card-header">
            <span className="stat-label">Rejected</span>
            <div className="stat-icon red">
              <i className="fa-solid fa-circle-xmark"></i>
            </div>
          </div>
          <div className="stat-card-body">
            <div className="stat-value">{counts.rejected}</div>
          </div>
        </div>

        <div
          className={`stat-card ${statusFilter === 'due' || statusFilter === 'due_all' ? 'active-due' : ''}`}
          onClick={() => handleStatusFilterChange(statusFilter === 'due' || statusFilter === 'due_all' ? 'ALL' : 'due')}
          title="Due Vouchers"
        >
          <div className="stat-card-header">
            <span className="stat-label">Due Vouchers</span>
            <div className="stat-icon orange">
              <i className="fa-solid fa-clock"></i>
            </div>
          </div>
          <div className="stat-card-body">
            <div className="stat-value">{statistics.dueCount}</div>
            <div className="stat-amount-block" title={`Due Amount: ₹${statistics.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${statistics.overdueAmount > 0 ? ` (Overdue: ₹${statistics.overdueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : ''}`}>
              <span className="stat-amount-title" style={{ color: '#ea580c' }}>Due Amt</span>
              <span className="stat-amount-val" style={{ color: '#dc2626' }}>
                ₹{statistics.totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="inv-toolbar" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div className="inv-toolbar-left" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Status Pills */}
          <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: '2px', flexWrap: 'wrap' }}>
            {[
              { id: 'ALL', label: 'All', count: counts.all },
              { id: 'due', label: 'Due', count: statistics.dueCount },
              { id: 'overdue', label: 'Overdue', count: statistics.overdueCount },
              { id: 'paid', label: 'Paid', count: statistics.paidCount },
              { id: 'DRAFT', label: 'Draft', count: counts.draft },
              { id: 'PENDING', label: 'Pending', count: counts.pending },
              { id: 'APPROVED', label: 'Approved', count: counts.approved },
              { id: 'REJECTED', label: 'Rejected', count: counts.rejected }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleStatusFilterChange(tab.id)}
                style={{
                  padding: '4px 9px',
                  borderRadius: '5px',
                  border: 'none',
                  fontSize: '11.5px',
                  fontWeight: statusFilter === tab.id ? '700' : '500',
                  background: statusFilter === tab.id ? '#ffffff' : 'transparent',
                  color: statusFilter === tab.id ? '#0f172a' : '#64748b',
                  boxShadow: statusFilter === tab.id ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  cursor: 'pointer'
                }}
              >
                {tab.label} <span style={{ opacity: 0.75, fontSize: '10.5px' }}>({tab.count})</span>
              </button>
            ))}
          </div>
        </div>
        <div className="inv-toolbar-right">
          <button type="button" className="btn-toolbar" onClick={handleDownloadCSV}>
            <i className="fa-solid fa-download"></i> Download CSV
          </button>
        </div>
      </div>

      {/* Table Wrap */}
      <div className="inv-table-wrap">
        <div className="inv-count">
          Showing <strong>{filteredVouchers.length ? (currentPage - 1) * perPage + 1 : 0}</strong> to{' '}
          <strong>{Math.min(currentPage * perPage, filteredVouchers.length)}</strong> of{' '}
          <strong>{filteredVouchers.length}</strong> Payment Vouchers
        </div>

        <table className="inv-table" id="clientsTable">
          <thead>
            <tr>
              <th onClick={() => handleSort('paidTo')} style={{ cursor: 'pointer' }}>
                Paid To{' '}
                <span className="sort-icon">
                  <i className={`fa-solid ${sortCol === 'paidTo' ? (sortDir === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'}`}></i>
                </span>
              </th>
              <th onClick={() => handleSort('number')} style={{ cursor: 'pointer' }}>
                Voucher No{' '}
                <span className="sort-icon">
                  <i className={`fa-solid ${sortCol === 'number' ? (sortDir === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'}`}></i>
                </span>
              </th>
              <th onClick={() => handleSort('date')} style={{ cursor: 'pointer' }}>
                Date{' '}
                <span className="sort-icon">
                  <i className={`fa-solid ${sortCol === 'date' ? (sortDir === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'}`}></i>
                </span>
              </th>
              <th onClick={() => handleSort('paymentMode')} style={{ cursor: 'pointer' }}>
                Mode{' '}
                <span className="sort-icon">
                  <i className={`fa-solid ${sortCol === 'paymentMode' ? (sortDir === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'}`}></i>
                </span>
              </th>
              <th onClick={() => handleSort('amount')} style={{ cursor: 'pointer' }}>
                Total Amount{' '}
                <span className="sort-icon">
                  <i className={`fa-solid ${sortCol === 'amount' ? (sortDir === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'}`}></i>
                </span>
              </th>
              <th onClick={() => handleSort('status')} style={{ cursor: 'pointer' }}>
                Status{' '}
                <span className="sort-icon">
                  <i className={`fa-solid ${sortCol === 'status' ? (sortDir === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'}`}></i>
                </span>
              </th>
              <th style={{ textAlign: 'center', paddingRight: '12px', minWidth: '165px', width: '165px' }}>Actions</th>
            </tr>
          </thead>
          <tbody id="clientsTbody">
            {pagedVouchers.map((v) => {
              const initial = (v.paidTo || '?').trim().charAt(0).toUpperCase();
              const canDelete = canDeleteDocument(v.status);

              return (
                <tr
                  key={v.id || v.number}
                  onClick={() => navigate(`/payment-vouchers/new?edit=${encodeURIComponent(v.number || v.id)}&id=${encodeURIComponent(v.id)}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                      <div
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          background: '#ede9fe',
                          color: '#6366f1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 700,
                          flexShrink: 0
                        }}
                      >
                        {initial}
                      </div>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>{v.paidTo || '—'}</span>
                    </div>
                  </td>
                  <td>
                    <span
                      className="inv-num"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/payment-vouchers/new?edit=${encodeURIComponent(v.number || v.id)}&id=${encodeURIComponent(v.id)}`);
                      }}
                    >
                      {v.number}
                    </span>
                  </td>
                  <td>{fmtDate(v.date)}</td>
                  <td>
                    <span
                      style={{
                        background: '#f1f5f9',
                        color: '#475569',
                        borderRadius: '99px',
                        padding: '3px 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        display: 'inline-block'
                      }}
                    >
                      {v.paymentMode || 'Cash'}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, color: '#0f172a' }}>
                    ₹{(parseFloat(v.amount) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td>
                    {(() => {
                      const norm = normalizeStatus(v.status);
                      const pay = getDocumentPaymentStatus(v);
                      const isApproved = norm === DOC_STATUS.APPROVED;

                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                          <ApprovalStatusBadge status={v.status} />
                          {isApproved && pay.status === 'Paid' && (
                            <span className="badge-paid" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <i className="fa-solid fa-circle-check"></i> Paid
                            </span>
                          )}
                          {isApproved && pay.status === 'Overdue' && (
                            <span className="badge-overdue" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <i className="fa-solid fa-triangle-exclamation"></i> Overdue
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ textAlign: 'center', whiteSpace: 'nowrap', paddingRight: '12px', minWidth: '165px', width: '165px' }}>
                    <div className="row-actions" style={{ justifyContent: 'center', gap: '6px' }}>
                      {/* 1. View */}
                      <button
                        type="button"
                        className="ra-btn"
                        title="View Payment Voucher"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/payment-vouchers/new?edit=${encodeURIComponent(v.number || v.id)}&id=${encodeURIComponent(v.id)}&view=true`);
                        }}
                      >
                        <i className="fa-regular fa-eye"></i>
                      </button>

                      {/* 2. Edit */}
                      <button
                        type="button"
                        className="ra-btn"
                        title={
                          v.status === DOC_STATUS.APPROVED
                            ? 'Payment Voucher is Approved (Editing Locked)'
                            : v.status === DOC_STATUS.PENDING_APPROVAL && !(isMainAdmin || hasActionAccess('payment_vouchers', 'approve'))
                            ? 'Payment Voucher is Pending Approval (Editing Locked)'
                            : 'Edit Payment Voucher'
                        }
                        style={
                          v.status === DOC_STATUS.APPROVED || (v.status === DOC_STATUS.PENDING_APPROVAL && !(isMainAdmin || hasActionAccess('payment_vouchers', 'approve')))
                            ? { opacity: 0.45, cursor: 'not-allowed' }
                            : {}
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          if (v.status === DOC_STATUS.APPROVED) {
                            alert(`Payment Voucher ${v.number} is approved and finalized. Editing is locked.`);
                            return;
                          }
                          if (v.status === DOC_STATUS.PENDING_APPROVAL && !(isMainAdmin || hasActionAccess('payment_vouchers', 'approve'))) {
                            alert(`Payment Voucher ${v.number} is currently under review (Pending Approval). Editing is locked.`);
                            return;
                          }
                          navigate(`/payment-vouchers/new?edit=${encodeURIComponent(v.number || v.id)}&id=${encodeURIComponent(v.id)}`);
                        }}
                      >
                        <i className={v.status === DOC_STATUS.APPROVED ? 'fa-solid fa-lock' : 'fa-solid fa-pen-to-square'}></i>
                      </button>

                      {/* 3. Status / Complete */}
                      <button
                        type="button"
                        className="ra-btn"
                        title={getStatusActionTitle(v)}
                        style={{ color: getStatusActionColor(v) }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStatusClick(v);
                        }}
                      >
                        <i className={getStatusActionIcon(v)}></i>
                      </button>

                      {/* 4. Duplicate */}
                      <button
                        type="button"
                        className="ra-btn"
                        title="Duplicate Payment Voucher"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(v);
                        }}
                      >
                        <i className="fa-regular fa-copy"></i>
                      </button>

                      </div>
                    </td>
                  </tr>
              );
            })}
          </tbody>
        </table>

        {filteredVouchers.length === 0 && (
          <div className="inv-empty">
            <i className="fa-regular fa-file-lines"></i>
            <p>No payment vouchers found for the selected filter.</p>
            {(isMainAdmin || hasActionAccess('payment_vouchers', 'create')) && (
              <Link to="/payment-vouchers/new">
                <i className="fa-solid fa-plus"></i> Create Payment Voucher
              </Link>
            )}
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalItems={filteredVouchers.length}
          perPage={perPage}
          onPageChange={setCurrentPage}
        />
      </div>


      {/* Status Action Confirmation Modal */}
      <Modal
        isOpen={statusModalOpen}
        onClose={() => {
          setStatusModalOpen(false);
          setPendingStatusVoucher(null);
          setPendingStatusAction(null);
        }}
        title={pendingStatusAction?.title || 'Confirm Status Action'}
      >
        <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '14px', lineHeight: '1.5' }}>
          {pendingStatusAction?.message}
        </p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="modal-btn cancel"
            onClick={() => {
              setStatusModalOpen(false);
              setPendingStatusVoucher(null);
              setPendingStatusAction(null);
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="modal-btn"
            style={{
              background: pendingStatusAction?.confirmColor || '#4f46e5',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={handleConfirmStatusAction}
          >
            {pendingStatusAction?.icon && <i className={pendingStatusAction.icon}></i>}
            {pendingStatusAction?.confirmText || 'Confirm'}
          </button>
        </div>
      </Modal>

      {/* Mark Paid Modal */}
      <Modal
        isOpen={paidModalOpen}
        onClose={() => setPaidModalOpen(false)}
        onConfirm={handleConfirmMarkPaid}
        title={
          pendingAction === 'paid'
            ? 'Record Payment / Mark as Paid'
            : 'Mark as Unpaid'
        }
        message={
          <div>
            <p style={{ marginBottom: '12px' }}>
              Are you sure you want to mark payment voucher <strong>{pendingPaidVoucher?.number}</strong> as{' '}
              <strong>{pendingAction}</strong>?
            </p>
            {pendingAction === 'paid' && pendingPaidVoucher && (
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                  <span style={{ color: '#64748b' }}>Total Voucher Amount:</span>
                  <strong style={{ color: '#0f172a' }}>₹{(pendingPaidVoucher.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Payment Amount (₹):
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={pendingPaidVoucher.amount}
                    value={paymentAmountInput}
                    onChange={(e) => setPaymentAmountInput(e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '14px',
                      fontWeight: 600
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setPaymentAmountInput(String(pendingPaidVoucher.amount || 0))}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Full Amount
                  </button>
                </div>
                {parseFloat(paymentAmountInput) < pendingPaidVoucher.amount && (
                  <div style={{ fontSize: '12px', color: '#c2410c', marginTop: '6px', fontWeight: 500 }}>
                    Remaining Due: ₹{Math.max(0, pendingPaidVoucher.amount - (parseFloat(paymentAmountInput) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>
            )}
          </div>
        }
      />

    </div>
  );
}
