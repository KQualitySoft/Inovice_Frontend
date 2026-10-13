import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  fmtDate,
  getDueDate,
  fmtDue,
  parseDate,
  resolvedStatus,
  getDocumentPaymentStatus,
  getInvoicePaymentStatus,
  isDocumentOverdue,
  isInvoiceOverdue
} from '../../utils/dateUtils';
import Modal from '../common/Modal';
import Pagination from '../common/Pagination';
import { useAuth } from '../../context/AuthContext';
import ApprovalStatusBadge from '../approvals/ApprovalStatusBadge';
import { ApprovalHistoryModal } from '../approvals/ApprovalModals';
import approvalService, {
  DOC_STATUS,
  normalizeStatus,
  approvalPermissions
} from '../../services/approvalService';
import notificationService from '../../services/notificationService';
import { FIXED_BILLED_BY, normalizeCompanyName } from '../../constants/companyDetails';

export default function DocumentDashboard({ config }) {
  const {
    docType = 'invoice',
    docTitle = 'Invoice',
    recipientLabel = 'Billed To',
    apiService,
    localStorageKey = 'invox_invoices',
    fullDataStorageKey = 'invox_invoice_fulldata',
    createRoute = '/invoices/new'
  } = config;

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { userEmail, userRole, isMainAdmin, hasActionAccess } = useAuth();
  const queryStatus = searchParams.get('status');

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state
  const [statusFilter, setStatusFilter] = useState(() => {
    if (queryStatus) {
      const q = queryStatus.toLowerCase().trim();
      if (q === 'pending' || q === 'pending_approval' || q === 'pendingapproval') return DOC_STATUS.PENDING_APPROVAL;
      if (q === 'approved') return DOC_STATUS.APPROVED;
      if (q === 'rejected') return DOC_STATUS.REJECTED;
      if (q === 'draft') return DOC_STATUS.DRAFT;
      if (q === 'due') return 'due';
      if (q === 'overdue') return 'overdue';
      if (q === 'paid') return 'paid';
    }
    return 'all';
  });
  const [showFilters, setShowFilters] = useState(false);
  const [filterBilledTo, setFilterBilledTo] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  // Sort state
  const [sortCol, setSortCol] = useState('date');
  const [sortDir, setSortDir] = useState('desc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  // View panel state
  const [viewPanelOpen, setViewPanelOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);

  // History modal state
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyDocNumber, setHistoryDocNumber] = useState('');
  const [historyList, setHistoryList] = useState([]);

  // Paid modal state
  const [paidModalOpen, setPaidModalOpen] = useState(false);
  const [pendingPaidDoc, setPendingPaidDoc] = useState(null);
  const [pendingAction, setPendingAction] = useState('paid');
  const [paymentAmountInput, setPaymentAmountInput] = useState('');

  // Status action modal state
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [pendingStatusDoc, setPendingStatusDoc] = useState(null);
  const [pendingStatusAction, setPendingStatusAction] = useState(null);

  // Delete modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState(null);

  const handleOpenHistory = async (doc) => {
    setHistoryDocNumber(doc.docNumber);
    setHistoryModalOpen(true);
    const hist = await approvalService.getHistory(docType, doc.docNumber);
    setHistoryList(hist);
  };

  const normaliseRecord = (item) => {
    // billedTo might be a string or an object with { bizName, gstin, ... }
    let resolvedBilledTo = 'Unknown';
    if (item.client && item.client.name) {
      resolvedBilledTo = item.client.name;
    } else if (typeof item.billedTo === 'string') {
      resolvedBilledTo = item.billedTo || 'Unknown';
    } else if (item.billedTo && typeof item.billedTo === 'object') {
      resolvedBilledTo = item.billedTo.bizName || item.billedTo.name || 'Unknown';
    } else if (typeof item.consignee === 'string') {
      resolvedBilledTo = item.consignee;
    } else if (item.consignee && typeof item.consignee === 'object') {
      resolvedBilledTo = item.consignee.bizName || item.consignee.name || 'Unknown';
    } else if (typeof item.vendor === 'string') {
      resolvedBilledTo = item.vendor;
    } else if (item.vendor && typeof item.vendor === 'object') {
      resolvedBilledTo = item.vendor.bizName || item.vendor.name || 'Unknown';
    } else if (typeof item.paidTo === 'string') {
      resolvedBilledTo = item.paidTo;
    } else if (item.paidTo && typeof item.paidTo === 'object') {
      resolvedBilledTo = item.paidTo.bizName || item.paidTo.name || 'Unknown';
    }

    let fd = null;
    if (item.fullData) {
      try {
        fd = typeof item.fullData === 'string' ? JSON.parse(item.fullData) : item.fullData;
      } catch (e) {}
    } else if (item.FullDataJson) {
      try {
        fd = typeof item.FullDataJson === 'string' ? JSON.parse(item.FullDataJson) : item.FullDataJson;
      } catch (e) {}
    } else if (item.fullDataJson) {
      try {
        fd = typeof item.fullDataJson === 'string' ? JSON.parse(item.fullDataJson) : item.fullDataJson;
      } catch (e) {}
    }

    const rawTotal = parseFloat(item.totalAmount ?? item.amount ?? fd?.totalAmount ?? fd?.amount) || 0;
    const isExplicitPaid =
      String(item.status || '').trim().toLowerCase() === 'paid' ||
      String(item.paymentStatus || '').trim().toLowerCase() === 'paid' ||
      item.isPaid === true;

    let resolvedPaidAmount = 0;
    if (isExplicitPaid) {
      resolvedPaidAmount = rawTotal;
    } else {
      const p = item.paidAmount ?? item.amountPaid ?? fd?.paidAmount ?? fd?.amountPaid;
      resolvedPaidAmount = p !== undefined && p !== null ? parseFloat(p) : 0;
    }

    const dueDateVal = item.dueDate || item.DueDate || fd?.dueDate || '';

    return {
      id: item.id,
      docType: item.docType || docType,
      docNumber:
        (item.proformaNumber ||
          item.proformaNo ||
          item.invoiceNumber ||
          item.invoiceNo ||
          item.quotationNumber ||
          item.challanNumber ||
          item.poNumber ||
          item.voucherNumber ||
          item.number ||
          item.docNumber ||
          fd?.proformaNumber ||
          fd?.proformaNo ||
          fd?.invoiceNo ||
          fd?.number ||
          '').trim() || (item.id ? (docType === 'proforma_invoice' ? `PI-${item.id}` : String(item.id)) : '—'),
      date: item.date || item.challanDate || item.invoiceDate || item.InvoiceDate || fd?.date || fd?.invoiceDate || '',
      dueDate: dueDateVal,
      billedTo: resolvedBilledTo,
      amount: rawTotal,
      paidAmount: resolvedPaidAmount,
      status: normalizeStatus(item.status),
      rawStatus: item.status || '',
      isPaid: isExplicitPaid || (resolvedPaidAmount >= rawTotal && rawTotal > 0),
      submittedBy: item.submittedBy || '',
      submittedAt: item.submittedAt || '',
      approvedBy: item.approvedBy || '',
      approvedAt: item.approvedAt || '',
      rejectedBy: item.rejectedBy || '',
      rejectedAt: item.rejectedAt || '',
      rejectionReason: item.rejectionReason || '',
      subTotal: item.subTotal,
      cgst: item.cgst,
      sgst: item.sgst,
      billedBy: normalizeCompanyName(typeof item.billedBy === 'string' ? item.billedBy : (item.billedBy && item.billedBy.bizName) || FIXED_BILLED_BY.bizName),
      refPoNo: item.refPoNo || '',
      refDcNo: item.refDcNo || '',
      refPiNo: item.refPiNo || '',
      refQuotationNo: item.refQuotationNo || '',
      items: item.items || fd?.items || []
    };
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (apiService && apiService.getAll) {
        // Add timeout to prevent hanging when backend is unreachable
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        try {
          const result = await apiService.getAll();
          clearTimeout(timeoutId);
          if (Array.isArray(result)) {
            const records = result.map(normaliseRecord);
            setData(records);
            notificationService.checkAndNotifyDueDocuments(records, docType);
            setLoading(false);
            return;
          }
        } catch (apiErr) {
          clearTimeout(timeoutId);
          console.warn('API error fetching documents, using localStorage:', apiErr);
        }
      }
    } catch (err) {
      console.warn('API error fetching documents, using localStorage:', err);
    }

    setData([]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const handleApprovalUpdate = () => {
      fetchData();
    };
    window.addEventListener('invox_approvals_updated', handleApprovalUpdate);
    return () => window.removeEventListener('invox_approvals_updated', handleApprovalUpdate);
  }, [docType]);

  // Base filtered data by search and date filters
  const baseFilteredData = useMemo(() => {
    return data.filter((r) => {
      if (
        filterBilledTo &&
        !(r.billedTo || '').toLowerCase().includes(filterBilledTo.toLowerCase()) &&
        !(r.docNumber || '').toLowerCase().includes(filterBilledTo.toLowerCase())
      ) {
        return false;
      }
      const d = parseDate(r.date);
      if (filterFrom && d < new Date(filterFrom)) return false;
      if (filterTo && d > new Date(filterTo)) return false;
      return true;
    });
  }, [data, filterBilledTo, filterFrom, filterTo]);

  const {
    totalCount,
    draftCount,
    pendingCount,
    approvedCount,
    rejectedCount,
    totalAmount,
    totalDue,
    dueCount,
    normalDueCount,
    overdueCount,
    overdueAmount,
    paidCount
  } = useMemo(() => {
    let drafts = 0;
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let totAmt = 0;
    let due = 0;
    let dueInvoicesCount = 0;
    let normalDue = 0;
    let overdue = 0;
    let overdueAmt = 0;
    let paid = 0;

    baseFilteredData.forEach((r) => {
      const amt = parseFloat(r.amount) || 0;
      totAmt += amt;
      const st = r.status;
      if (st === DOC_STATUS.DRAFT) drafts++;
      else if (st === DOC_STATUS.PENDING_APPROVAL) pending++;
      else if (st === DOC_STATUS.APPROVED) approved++;
      else if (st === DOC_STATUS.REJECTED) rejected++;

      const pay = getDocumentPaymentStatus(r);
      if (pay.isPaid || pay.status === 'Paid') {
        paid++;
      } else if (st !== DOC_STATUS.REJECTED) {
        due += pay.outstandingAmount;
        dueInvoicesCount++;
        if (pay.isOverdue || pay.status === 'Overdue') {
          overdue++;
          overdueAmt += pay.outstandingAmount;
        } else {
          normalDue++;
        }
      }
    });

    return {
      totalCount: baseFilteredData.length,
      draftCount: drafts,
      pendingCount: pending,
      approvedCount: approved,
      rejectedCount: rejected,
      totalAmount: totAmt,
      totalDue: due,
      dueCount: dueInvoicesCount,
      normalDueCount: normalDue,
      overdueCount: overdue,
      overdueAmount: overdueAmt,
      paidCount: paid
    };
  }, [baseFilteredData, docType]);

  // Filter and Sort
  const filteredData = useMemo(() => {
    return baseFilteredData
      .filter((r) => {
        if (statusFilter !== 'all') {
          const pay = getDocumentPaymentStatus(r);
          const hasOutstanding = !pay.isPaid && pay.outstandingAmount > 0 && pay.status !== 'Paid';
          if (statusFilter === 'due' || statusFilter === 'due_all') {
            if (!hasOutstanding) return false;
          } else if (statusFilter === 'overdue') {
            if (pay.status !== 'Overdue' || !hasOutstanding) return false;
          } else if (statusFilter === 'paid') {
            if (pay.status !== 'Paid' && !pay.isPaid) return false;
          } else if (r.status !== statusFilter) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        let va = a[sortCol];
        let vb = b[sortCol];
        if (sortCol === 'date') {
          va = parseDate(va).getTime();
          vb = parseDate(vb).getTime();
        } else if (sortCol === 'dueDate') {
          const da = getDocumentPaymentStatus(a).dueDate || a.dueDate;
          const db = getDocumentPaymentStatus(b).dueDate || b.dueDate;
          va = da ? parseDate(da).getTime() : 0;
          vb = db ? parseDate(db).getTime() : 0;
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
  }, [baseFilteredData, statusFilter, sortCol, sortDir, docType]);

  const pagedData = useMemo(() => {
    const start = (currentPage - 1) * perPage;
    return filteredData.slice(start, start + perPage);
  }, [filteredData, currentPage]);

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const handleOpenView = (doc) => {
    const full = approvalService.getFullDocument(docType, doc.docNumber);
    setSelectedDoc({
      ...doc,
      ...(full || {})
    });
    setViewPanelOpen(true);
  };

  const handleCloseView = () => {
    setViewPanelOpen(false);
    setSelectedDoc(null);
  };

  const handleMarkPaidClick = (doc, action = 'paid') => {
    setPendingPaidDoc(doc);
    setPendingAction(action);
    const pay = getDocumentPaymentStatus(doc);
    if (action === 'paid') {
      setPaymentAmountInput(pay.outstandingAmount > 0 ? pay.outstandingAmount.toString() : (doc.amount || 0).toString());
    } else {
      setPaymentAmountInput('0');
    }
    setPaidModalOpen(true);
  };

  const handleConfirmMarkPaid = async () => {
    if (!pendingPaidDoc) return;
    const doc = pendingPaidDoc;
    setPaidModalOpen(false);
    handleCloseView();

    let targetStatus = pendingAction === 'paid' ? 'Paid' : 'Unpaid';
    let paidAmt = doc.amount;

    if (pendingAction === 'unpaid') {
      paidAmt = 0;
      targetStatus = 'Due';
    } else {
      const parsed = parseFloat(paymentAmountInput);
      paidAmt = isNaN(parsed) ? doc.amount : Math.max(0, parsed);
      if (paidAmt >= doc.amount) {
        targetStatus = 'Paid';
      } else {
        const overdue = isDocumentOverdue({ ...doc, paidAmount: paidAmt, isPaid: false });
        targetStatus = overdue ? 'Overdue' : 'Due';
      }
    }

    // Call API if available
    try {
      if (apiService && apiService.updateStatusByNumber) {
        await apiService.updateStatusByNumber(doc.docNumber, targetStatus, paidAmt);
      } else if (apiService && apiService.updateStatus && doc.id) {
        await apiService.updateStatus(doc.id, targetStatus, paidAmt);
      }
    } catch (e) {
      console.warn('API status update error:', e);
    }

    // Sync localStorage
    try {
      const stored = JSON.parse(localStorage.getItem(localStorageKey) || '[]');
      const match = stored.find(
        (x) =>
          String(x.id) === String(doc.id) ||
          (x.invoiceNo || x.invoiceNumber || x.quotationNumber || x.challanNumber || x.poNumber || x.number) === doc.docNumber
      );
      if (match) {
        match.status = targetStatus;
        match.paidAmount = paidAmt;
        match.amountPaid = paidAmt;
        match.isPaid = targetStatus.toLowerCase() === 'paid';
        localStorage.setItem(localStorageKey, JSON.stringify(stored));
      }
    } catch (e) {}

    // Sync fullData
    try {
      const fullMap = JSON.parse(localStorage.getItem(fullDataStorageKey) || '{}');
      if (fullMap[doc.docNumber]) {
        fullMap[doc.docNumber].status = targetStatus;
        fullMap[doc.docNumber].paidAmount = paidAmt;
        fullMap[doc.docNumber].amountPaid = paidAmt;
        fullMap[doc.docNumber].isPaid = targetStatus.toLowerCase() === 'paid';
        localStorage.setItem(fullDataStorageKey, JSON.stringify(fullMap));
      }
    } catch (e) {}

    await fetchData();
    setPendingPaidDoc(null);
  };

  const handleDeleteClick = (doc) => {
    setPendingDeleteDoc(doc);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteDoc) return;
    const doc = pendingDeleteDoc;
    setDeleteModalOpen(false);
    handleCloseView();

    try {
      if (apiService && apiService.delete) {
        await apiService.delete(doc.id || doc.docNumber);
      }
    } catch (e) {
      console.error('API delete error:', e);
      alert(`Could not delete document: ${e.message || 'Server error'}`);
      return;
    }

    // Sync localStorage
    try {
      const stored = JSON.parse(localStorage.getItem(localStorageKey) || '[]');
      const filtered = stored.filter(
        (x) => String(x.id) !== String(doc.id) && (x.invoiceNo || x.quotationNumber || x.number || x.challanNumber || x.poNumber) !== doc.docNumber
      );
      localStorage.setItem(localStorageKey, JSON.stringify(filtered));
    } catch (e) {}

    try {
      const fullMap = JSON.parse(localStorage.getItem(fullDataStorageKey) || '{}');
      delete fullMap[doc.docNumber];
      localStorage.setItem(fullDataStorageKey, JSON.stringify(fullMap));
    } catch (e) {}

    await fetchData();
    setPendingDeleteDoc(null);
  };

  const handleStatusClick = (doc) => {
    const norm = normalizeStatus(doc.status);
    if (norm === DOC_STATUS.DRAFT) {
      setPendingStatusDoc(doc);
      setPendingStatusAction({
        type: 'submit',
        title: `Submit ${docTitle} for Approval`,
        message: `Are you sure you want to submit ${docTitle} ${doc.docNumber} for Approval? Once submitted, the document will be under review.`,
        confirmText: 'Submit for Approval',
        confirmColor: '#4f46e5',
        icon: 'fa-solid fa-paper-plane'
      });
      setStatusModalOpen(true);
      return;
    }
    if (norm === DOC_STATUS.PENDING_APPROVAL) {
      if (isMainAdmin || hasActionAccess(docType, 'approve')) {
        setPendingStatusDoc(doc);
        setPendingStatusAction({
          type: 'approve',
          title: `Approve ${docTitle}`,
          message: `Are you sure you want to approve ${docTitle} ${doc.docNumber}? Once approved, the document will become finalized and locked.`,
          confirmText: 'Approve Document',
          confirmColor: '#16a34a',
          icon: 'fa-solid fa-circle-check'
        });
        setStatusModalOpen(true);
      } else {
        handleOpenHistory(doc);
      }
      return;
    }
    if (norm === DOC_STATUS.REJECTED) {
      setPendingStatusDoc(doc);
      setPendingStatusAction({
        type: 'submit',
        title: `Resubmit ${docTitle} for Approval`,
        message: `Are you sure you want to resubmit ${docTitle} ${doc.docNumber} for Approval?`,
        confirmText: 'Resubmit for Approval',
        confirmColor: '#4f46e5',
        icon: 'fa-solid fa-paper-plane'
      });
      setStatusModalOpen(true);
      return;
    }
    if (norm === DOC_STATUS.APPROVED) {
      if (docType === 'delivery_challan' && doc.status !== 'Delivered') {
        setPendingStatusDoc(doc);
        setPendingStatusAction({
          type: 'patch_status',
          targetStatus: 'Delivered',
          title: 'Mark Delivery Challan as Delivered',
          message: `Are you sure you want to mark Delivery Challan ${doc.docNumber} as Delivered?`,
          confirmText: 'Mark Delivered',
          confirmColor: '#16a34a',
          icon: 'fa-solid fa-truck'
        });
        setStatusModalOpen(true);
        return;
      }
      if (docType === 'purchase_order' && doc.status !== 'Completed') {
        setPendingStatusDoc(doc);
        setPendingStatusAction({
          type: 'patch_status',
          targetStatus: 'Completed',
          title: 'Mark Purchase Order as Completed',
          message: `Are you sure you want to mark Purchase Order ${doc.docNumber} as Completed?`,
          confirmText: 'Mark Completed',
          confirmColor: '#16a34a',
          icon: 'fa-solid fa-circle-check'
        });
        setStatusModalOpen(true);
        return;
      }
      const pay = getDocumentPaymentStatus(doc);
      if (pay.status === 'Paid') {
        handleMarkPaidClick(doc, 'unpaid');
      } else {
        handleMarkPaidClick(doc, 'paid');
      }
      return;
    }
    const pay = getDocumentPaymentStatus(doc);
    if (pay.status === 'Paid') {
      handleMarkPaidClick(doc, 'unpaid');
    } else {
      handleMarkPaidClick(doc, 'paid');
    }
  };

  const handleConfirmStatusAction = async () => {
    if (!pendingStatusDoc || !pendingStatusAction) return;
    const doc = pendingStatusDoc;
    const action = pendingStatusAction;
    setStatusModalOpen(false);

    try {
      if (action.type === 'submit') {
        await approvalService.submitForApproval({
          docType,
          docNumber: doc.docNumber,
          user: currentUser || { email: userEmail, id: userId, role: userRole },
          currentStatus: doc.status
        });
      } else if (action.type === 'approve') {
        await approvalService.approveDocument({
          docType,
          docNumber: doc.docNumber,
          user: currentUser || { email: userEmail, id: userId, role: userRole },
          comments: 'Approved via Dashboard'
        });
      } else if (action.type === 'patch_status') {
        if (apiService && apiService.updateStatusByNumber) {
          await apiService.updateStatusByNumber(doc.docNumber, action.targetStatus);
        } else if (apiService && apiService.updateStatus && doc.id) {
          await apiService.updateStatus(doc.id, action.targetStatus);
        }
      }
      await fetchData();
    } catch (err) {
      console.error('Status action error:', err);
      alert(`Operation failed: ${err.message || err}`);
    } finally {
      setPendingStatusDoc(null);
      setPendingStatusAction(null);
    }
  };

  const getStatusActionTitle = (r) => {
    const norm = normalizeStatus(r.status);
    if (norm === DOC_STATUS.DRAFT) return `Submit ${docTitle} for Approval`;
    if (norm === DOC_STATUS.PENDING_APPROVAL) return isMainAdmin || hasActionAccess(docType, 'approve') ? `Approve ${docTitle}` : 'Pending Approval (Under Review)';
    if (norm === DOC_STATUS.REJECTED) return `Resubmit ${docTitle} for Approval`;
    if (docType === 'delivery_challan' && r.status !== 'Delivered') return 'Mark as Delivered';
    if (docType === 'purchase_order' && r.status !== 'Completed') return 'Mark as Completed';
    const pay = getDocumentPaymentStatus(r);
    if (pay.status === 'Paid') return `${docTitle} Paid (Click to modify payment)`;
    return `Record Payment (Due: ₹${pay.outstandingAmount.toFixed(2)})`;
  };

  const getStatusActionColor = (r) => {
    const norm = normalizeStatus(r.status);
    if (norm === DOC_STATUS.DRAFT) return '#4f46e5';
    if (norm === DOC_STATUS.PENDING_APPROVAL) return '#d97706';
    if (norm === DOC_STATUS.REJECTED) return '#dc2626';
    if (docType === 'delivery_challan' && r.status !== 'Delivered') return '#16a34a';
    if (docType === 'purchase_order' && r.status !== 'Completed') return '#16a34a';
    const pay = getDocumentPaymentStatus(r);
    if (pay.status === 'Paid') return '#16a34a';
    if (pay.status === 'Overdue') return '#dc2626';
    return '#ea580c';
  };

  const getStatusActionIcon = (r) => {
    const norm = normalizeStatus(r.status);
    if (norm === DOC_STATUS.DRAFT) return 'fa-solid fa-paper-plane';
    if (norm === DOC_STATUS.PENDING_APPROVAL) return isMainAdmin || hasActionAccess(docType, 'approve') ? 'fa-solid fa-check' : 'fa-solid fa-clock';
    if (norm === DOC_STATUS.REJECTED) return 'fa-solid fa-rotate-right';
    if (docType === 'delivery_challan' && r.status !== 'Delivered') return 'fa-solid fa-truck';
    if (docType === 'purchase_order' && r.status !== 'Completed') return 'fa-solid fa-circle-check';
    const pay = getDocumentPaymentStatus(r);
    if (pay.status === 'Paid') return 'fa-solid fa-circle-check';
    if (pay.status === 'Overdue') return 'fa-solid fa-triangle-exclamation';
    return 'fa-regular fa-circle-check';
  };

  const handleDuplicate = (doc) => {
    const existingNums = data.map((d) => d.docNumber);
    const match = (doc.docNumber || '').match(/^([A-Za-z0-9\-]*\-)?(\d+)$/);
    let newNum = '';
    if (!match) {
      newNum = `${doc.docNumber}-copy`;
    } else {
      const prefix = match[1] || '';
      const numStr = match[2];
      const width = numStr.length;
      let n = parseInt(numStr, 10) + 1;
      while (existingNums.includes(prefix + String(n).padStart(width, '0'))) n++;
      newNum = prefix + String(n).padStart(width, '0');
    }
    navigate(`${createRoute}?copy=${encodeURIComponent(doc.docNumber)}&newnum=${encodeURIComponent(newNum)}`);
  };

  const handleDownloadCSV = () => {
    if (!data.length) {
      alert(`No ${docTitle.toLowerCase()}s to download.`);
      return;
    }
    const rows = [[`${docTitle} No`, 'Date', recipientLabel, 'Amount (₹)', 'Status']];
    data.forEach((r) =>
      rows.push([r.docNumber, fmtDate(r.date), r.billedTo, (r.amount || 0).toFixed(2), resolvedStatus(r)])
    );
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `${docTitle.toLowerCase().replace(/\s+/g, '_')}s.csv`;
    a.click();
  };

  const activeFilterCount = [filterBilledTo, filterFrom, filterTo].filter(Boolean).length;

  if (loading) {
    return (
      <div className="inv-page" style={{ padding: '28px 32px', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '32px', marginBottom: '12px', display: 'block' }}></i>
          <p style={{ fontSize: '14px' }}>Loading {docTitle.toLowerCase()}s...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="inv-page" style={{ padding: '28px 32px', flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#ef4444' }}>
          <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '32px', marginBottom: '12px', display: 'block' }}></i>
          <p style={{ fontSize: '14px' }}>{error}</p>
          <button
            type="button"
            onClick={fetchData}
            style={{
              marginTop: '12px',
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              background: '#6366f1',
              color: '#fff',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <i className="fa-solid fa-rotate-right" style={{ marginRight: '6px' }}></i> Retry
          </button>
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
            <span>{docTitle}s</span>
          </div>
          <h1 className="inv-title">{docTitle}s</h1>
        </div>
        <div className="inv-topbar-actions">
          {(isMainAdmin || hasActionAccess(docType, 'create')) && (
            <Link to={createRoute} className="btn-create">
              <i className="fa-solid fa-plus"></i> Create New {docTitle}
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="inv-stats">
        <div
          className={`stat-card ${statusFilter === 'all' ? 'active-total' : ''}`}
          onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
          title={`Total ${docType === 'invoice' ? 'Invoices' : (docTitle.endsWith('s') ? docTitle : `${docTitle}s`)}`}
        >
          <div className="stat-card-header">
            <span className="stat-label">
              Total {docType === 'invoice' ? 'Invoices' : (docType === 'delivery_challan' ? 'Challans' : (docType === 'purchase_order' ? 'Orders' : (docType === 'quotation' ? 'Quotes' : (docType === 'proforma_invoice' ? 'Proforma' : 'Docs'))))}
            </span>
            <div className="stat-icon blue">
              <i className="fa-solid fa-file-invoice"></i>
            </div>
          </div>
          <div className="stat-card-body">
            <div className="stat-value">{totalCount}</div>
            <div className="stat-amount-block" title={`Total Amount: ₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}>
              <span className="stat-amount-title" style={{ color: '#6366f1' }}>Total Amt</span>
              <span className="stat-amount-val" style={{ color: '#0f172a' }}>
                ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        <div
          className={`stat-card ${statusFilter === DOC_STATUS.DRAFT ? 'active-draft' : ''}`}
          onClick={() => { setStatusFilter(DOC_STATUS.DRAFT); setCurrentPage(1); }}
          title="Drafts"
        >
          <div className="stat-card-header">
            <span className="stat-label">Drafts</span>
            <div className="stat-icon slate">
              <i className="fa-regular fa-file"></i>
            </div>
          </div>
          <div className="stat-card-body">
            <div className="stat-value">{draftCount}</div>
          </div>
        </div>

        <div
          className={`stat-card ${statusFilter === DOC_STATUS.PENDING_APPROVAL ? 'active-pending' : ''}`}
          onClick={() => { setStatusFilter(DOC_STATUS.PENDING_APPROVAL); setCurrentPage(1); }}
          title="Pending Approval"
        >
          <div className="stat-card-header">
            <span className="stat-label">Pending</span>
            <div className="stat-icon amber">
              <i className="fa-solid fa-hourglass-half"></i>
            </div>
          </div>
          <div className="stat-card-body">
            <div className="stat-value">{pendingCount}</div>
          </div>
        </div>

        <div
          className={`stat-card ${statusFilter === DOC_STATUS.APPROVED ? 'active-approved' : ''}`}
          onClick={() => { setStatusFilter(DOC_STATUS.APPROVED); setCurrentPage(1); }}
          title="Approved"
        >
          <div className="stat-card-header">
            <span className="stat-label">Approved</span>
            <div className="stat-icon green">
              <i className="fa-solid fa-check-circle"></i>
            </div>
          </div>
          <div className="stat-card-body">
            <div className="stat-value">{approvedCount}</div>
          </div>
        </div>

        <div
          className={`stat-card ${statusFilter === DOC_STATUS.REJECTED ? 'active-rejected' : ''}`}
          onClick={() => { setStatusFilter(DOC_STATUS.REJECTED); setCurrentPage(1); }}
          title="Rejected"
        >
          <div className="stat-card-header">
            <span className="stat-label">Rejected</span>
            <div className="stat-icon red">
              <i className="fa-solid fa-circle-xmark"></i>
            </div>
          </div>
          <div className="stat-card-body">
            <div className="stat-value">{rejectedCount}</div>
          </div>
        </div>

        <div
          className={`stat-card ${statusFilter === 'due' || statusFilter === 'due_all' ? 'active-due' : ''}`}
          onClick={() => {
            setStatusFilter((prev) => (prev === 'due' || prev === 'due_all' ? 'all' : 'due'));
            setCurrentPage(1);
          }}
          title={`Due ${docType === 'invoice' ? 'Invoices' : (docTitle.endsWith('s') ? docTitle : `${docTitle}s`)}`}
        >
          <div className="stat-card-header">
            <span className="stat-label">
              Due {docType === 'invoice' ? 'Invoices' : (docType === 'delivery_challan' ? 'Challans' : (docType === 'purchase_order' ? 'Orders' : (docType === 'quotation' ? 'Quotes' : (docType === 'proforma_invoice' ? 'Proforma' : 'Docs'))))}
            </span>
            <div className="stat-icon orange">
              <i className="fa-solid fa-clock"></i>
            </div>
          </div>
          <div className="stat-card-body">
            <div className="stat-value">{dueCount}</div>
            <div className="stat-amount-block" title={`Due Amount: ₹${totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${overdueAmount > 0 ? ` (Overdue: ₹${overdueAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})` : ''}`}>
              <span className="stat-amount-title" style={{ color: '#ea580c' }}>Due Amt</span>
              <span className="stat-amount-val" style={{ color: '#dc2626' }}>
                ₹{totalDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              { id: 'all', label: 'All', count: totalCount },
              { id: 'due', label: 'Due', count: dueCount },
              { id: 'overdue', label: 'Overdue', count: overdueCount },
              { id: 'paid', label: 'Paid', count: paidCount },
              { id: DOC_STATUS.DRAFT, label: 'Draft', count: draftCount },
              { id: DOC_STATUS.PENDING_APPROVAL, label: 'Pending', count: pendingCount },
              { id: DOC_STATUS.APPROVED, label: 'Approved', count: approvedCount },
              { id: DOC_STATUS.REJECTED, label: 'Rejected', count: rejectedCount }
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.id);
                  setCurrentPage(1);
                }}
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

          <button
            type="button"
            className={`btn-toolbar ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters((prev) => !prev)}
          >
            <i className="fa-solid fa-filter"></i> More Filters
            {activeFilterCount > 0 && (
              <span className="filter-badge" style={{ display: 'inline' }}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
        <div className="inv-toolbar-right">
          <button type="button" className="btn-toolbar" onClick={handleDownloadCSV}>
            <i className="fa-solid fa-download"></i> Download CSV
          </button>
        </div>
      </div>

      {/* Filter Row */}
      {showFilters && (
        <div className="inv-filters open" style={{ display: 'flex' }}>
          <span className="filter-label">
            <i className="fa-solid fa-filter"></i> Filters
          </span>
          <a
            className="filter-clear"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setFilterBilledTo('');
              setFilterFrom('');
              setFilterTo('');
              setCurrentPage(1);
            }}
          >
            <i className="fa-solid fa-xmark"></i> Clear All
          </a>
          <input
            className="filter-input"
            type="text"
            placeholder={`Search by ${recipientLabel}…`}
            value={filterBilledTo}
            onChange={(e) => {
              setFilterBilledTo(e.target.value);
              setCurrentPage(1);
            }}
          />
          <input
            className="filter-input"
            type="date"
            value={filterFrom}
            onChange={(e) => {
              setFilterFrom(e.target.value);
              setCurrentPage(1);
            }}
          />
          <input
            className="filter-input"
            type="date"
            value={filterTo}
            onChange={(e) => {
              setFilterTo(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      )}

      {/* Table */}
      <div className="inv-table-wrap">
        <div className="inv-count">
          Showing <strong>{filteredData.length ? (currentPage - 1) * perPage + 1 : 0}</strong> to{' '}
          <strong>{Math.min(currentPage * perPage, filteredData.length)}</strong> of{' '}
          <strong>{filteredData.length}</strong> {docTitle}
          {filteredData.length !== 1 ? 's' : ''}
        </div>

        <table className="inv-table">
          <thead>
            <tr>
              <th className="td-num">#</th>
              <th onClick={() => handleSort('docNumber')} style={{ cursor: 'pointer' }}>
                {docTitle} No{' '}
                <span className="sort-icon">
                  <i className={`fa-solid ${sortCol === 'docNumber' ? (sortDir === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'}`}></i>
                </span>
              </th>
              <th onClick={() => handleSort('billedTo')} style={{ cursor: 'pointer' }}>
                {recipientLabel}{' '}
                <span className="sort-icon">
                  <i className={`fa-solid ${sortCol === 'billedTo' ? (sortDir === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'}`}></i>
                </span>
              </th>
              <th onClick={() => handleSort('date')} style={{ cursor: 'pointer' }}>
                Date{' '}
                <span className="sort-icon">
                  <i className={`fa-solid ${sortCol === 'date' ? (sortDir === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'}`}></i>
                </span>
              </th>
              <th onClick={() => handleSort('dueDate')} style={{ cursor: 'pointer' }}>
                Due Date{' '}
                <span className="sort-icon">
                  <i className={`fa-solid ${sortCol === 'dueDate' ? (sortDir === 'asc' ? 'fa-sort-up' : 'fa-sort-down') : 'fa-sort'}`}></i>
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
          <tbody>
            {pagedData.map((r, pageIdx) => {
              const rs = resolvedStatus(r);
              const isPaid = rs === 'paid';
              return (
                <tr key={r.id || r.docNumber || pageIdx}>
                  <td className="td-num">{(currentPage - 1) * perPage + pageIdx + 1}</td>
                  <td>
                    <span
                      className="inv-num"
                      onClick={() => navigate(`${createRoute}?edit=${encodeURIComponent(r.docNumber)}${r.id ? `&id=${encodeURIComponent(r.id)}` : ''}`)}
                    >
                      {r.docNumber}
                    </span>
                  </td>
                  <td style={{ fontWeight: 500, color: '#0f172a' }}>{r.billedTo || '—'}</td>
                  <td>{fmtDate(r.date)}</td>
                  <td>
                    {(() => {
                      const pay = getDocumentPaymentStatus(r);
                      const dVal = pay.dueDate || r.dueDate;
                      if (!dVal) return <span style={{ color: '#94a3b8' }}>—</span>;
                      return (
                        <span style={{ color: pay.status === 'Overdue' ? '#dc2626' : '#334155', fontWeight: pay.status === 'Overdue' ? 600 : 400 }}>
                          {fmtDate(dVal)}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ fontWeight: 600, color: '#0f172a' }}>
                    ₹{(r.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td>
                    {(() => {
                      const pay = getDocumentPaymentStatus(r);
                      const isApproved = r.status === DOC_STATUS.APPROVED;
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'nowrap' }}>
                          <ApprovalStatusBadge status={r.status} />
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
                        title={`View ${docTitle}`}
                        onClick={() => navigate(`${createRoute}?edit=${encodeURIComponent(r.docNumber)}${r.id ? `&id=${encodeURIComponent(r.id)}` : ''}&step=3&view=true`)}
                      >
                        <i className="fa-regular fa-eye"></i>
                      </button>

                      {/* 2. Edit */}
                      <button
                        type="button"
                        className="ra-btn"
                        title={
                          r.status === DOC_STATUS.APPROVED
                            ? `${docTitle} is Approved (Editing Locked)`
                            : r.status === DOC_STATUS.PENDING_APPROVAL && !(isMainAdmin || hasActionAccess(docType, 'approve'))
                            ? `${docTitle} is Pending Approval (Editing Locked)`
                            : `Edit ${docTitle}`
                        }
                        style={
                          r.status === DOC_STATUS.APPROVED || (r.status === DOC_STATUS.PENDING_APPROVAL && !(isMainAdmin || hasActionAccess(docType, 'approve')))
                            ? { opacity: 0.45, cursor: 'not-allowed' }
                            : {}
                        }
                        onClick={() => {
                          if (r.status === DOC_STATUS.APPROVED) {
                            alert(`${docTitle} ${r.docNumber} is approved and finalized. Editing is locked.`);
                            return;
                          }
                          if (r.status === DOC_STATUS.PENDING_APPROVAL && !(isMainAdmin || hasActionAccess(docType, 'approve'))) {
                            alert(`${docTitle} ${r.docNumber} is currently under review (Pending Approval). Editing is locked.`);
                            return;
                          }
                          navigate(`${createRoute}?edit=${encodeURIComponent(r.docNumber)}${r.id ? `&id=${encodeURIComponent(r.id)}` : ''}`);
                        }}
                      >
                        <i className={r.status === DOC_STATUS.APPROVED ? 'fa-solid fa-lock' : 'fa-solid fa-pen-to-square'}></i>
                      </button>

                      {/* 3. Status / Complete */}
                      <button
                        type="button"
                        className="ra-btn"
                        title={getStatusActionTitle(r)}
                        style={{ color: getStatusActionColor(r) }}
                        onClick={() => handleStatusClick(r)}
                      >
                        <i className={getStatusActionIcon(r)}></i>
                      </button>

                      {/* 4. Duplicate */}
                      <button
                        type="button"
                        className="ra-btn"
                        title={`Duplicate ${docTitle}`}
                        onClick={() => handleDuplicate(r)}
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

        {pagedData.length === 0 && (
          <div className="inv-empty">
            <i className="fa-regular fa-file-lines"></i>
            <p>No {docTitle.toLowerCase()}s found. Create your first one!</p>
            <Link to={createRoute}>
              <i className="fa-solid fa-plus"></i> Create {docTitle}
            </Link>
          </div>
        )}

        <Pagination
          currentPage={currentPage}
          totalItems={filteredData.length}
          perPage={perPage}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Slide-out View Panel */}
      {viewPanelOpen && selectedDoc && (
        <>
          <div className="view-overlay open" onClick={handleCloseView}></div>
          <div className="view-panel open">
            <div className="vp-header">
              <div className="vp-header-left">
                <h3 className="vp-title">{selectedDoc.docNumber}</h3>
                <div>
                  {(() => {
                    const pay = getDocumentPaymentStatus(selectedDoc);
                    if (pay.status === 'Paid') return <span className="badge-paid">Paid</span>;
                    if (pay.status === 'Overdue') return <span className="badge-overdue">Overdue</span>;
                    return <span className="badge-due">Due</span>;
                  })()}
                </div>
              </div>
              <button type="button" className="vp-close" onClick={handleCloseView}>
                &times;
              </button>
            </div>
            <div className="vp-body">
              <div className="vp-card">
                <div className="vp-card-title">Total Amount</div>
                <div className="vp-amount-big">₹{selectedDoc.amount.toFixed(2)}</div>
                {(() => {
                  const pay = getDocumentPaymentStatus(selectedDoc);
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', fontSize: '13px' }}>
                      <div>
                        <span style={{ color: '#64748b' }}>Paid: </span>
                        <strong style={{ color: '#16a34a' }}>₹{pay.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Outstanding: </span>
                        <strong style={{ color: pay.status === 'Overdue' ? '#dc2626' : '#ea580c' }}>
                          ₹{pay.outstandingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </strong>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="vp-section">
                <div className="vp-row">
                  <span className="vp-label">{docTitle} No</span>
                  <span className="vp-value">{selectedDoc.docNumber}</span>
                </div>
                <div className="vp-row">
                  <span className="vp-label">Date</span>
                  <span className="vp-value">{fmtDate(selectedDoc.date)}</span>
                </div>
                <div className="vp-row">
                  <span className="vp-label">Due Date</span>
                  <span className="vp-value">{fmtDate(getDueDate(selectedDoc, 15))}</span>
                </div>
                <div className="vp-row">
                  <span className="vp-label">{recipientLabel}</span>
                  <span className="vp-value">{selectedDoc.billedTo}</span>
                </div>
                {selectedDoc.refPoNo && (
                  <div className="vp-row">
                    <span className="vp-label">Ref PO No</span>
                    <span className="vp-value">{selectedDoc.refPoNo}</span>
                  </div>
                )}
                {selectedDoc.refDcNo && (
                  <div className="vp-row">
                    <span className="vp-label">Ref DC No</span>
                    <span className="vp-value">{selectedDoc.refDcNo}</span>
                  </div>
                )}
                {selectedDoc.refPiNo && (
                  <div className="vp-row">
                    <span className="vp-label">Ref PI No</span>
                    <span className="vp-value">{selectedDoc.refPiNo}</span>
                  </div>
                )}
                {selectedDoc.refQuotationNo && (
                  <div className="vp-row">
                    <span className="vp-label">Ref Quotation No</span>
                    <span className="vp-value">{selectedDoc.refQuotationNo}</span>
                  </div>
                )}
                <div className="vp-row">
                  <span className="vp-label">Billed By</span>
                  <span className="vp-value">{normalizeCompanyName(selectedDoc.billedBy?.bizName || selectedDoc.billedBy || FIXED_BILLED_BY.bizName)}</span>
                </div>
              </div>

              {/* Line Items if available */}
              {Array.isArray(selectedDoc.items) && selectedDoc.items.length > 0 && (
                <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Items ({selectedDoc.items.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedDoc.items.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', backgroundColor: '#f8fafc', padding: '8px 10px', borderRadius: '6px' }}>
                        <div>
                          <strong style={{ color: '#0f172a', display: 'block' }}>{item.itemName || item.name || `Item #${idx + 1}`}</strong>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>Qty: {item.qty || 1} {item.uom || ''} × ₹{item.rate || 0}</span>
                        </div>
                        <strong style={{ color: '#0f172a' }}>{item.amount || item.total ? `₹${item.amount || item.total}` : '—'}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="vp-actions">
              <button
                type="button"
                className="vp-btn"
                onClick={() => {
                  handleCloseView();
                  navigate(`${createRoute}?edit=${encodeURIComponent(selectedDoc.docNumber)}${selectedDoc.id ? `&id=${encodeURIComponent(selectedDoc.id)}` : ''}&step=3`);
                }}
                style={{ color: '#4f46e5', fontWeight: 600 }}
              >
                <i className="fa-solid fa-arrow-up-right-from-square"></i> Open Full Document
              </button>
              <button
                type="button"
                className="vp-btn"
                onClick={() => handleMarkPaidClick(selectedDoc, resolvedStatus(selectedDoc) === 'paid' ? 'unpaid' : 'paid')}
              >
                <i className="fa-regular fa-circle-check"></i>{' '}
                {resolvedStatus(selectedDoc) === 'paid' ? 'Mark as Unpaid' : 'Mark as Paid'}
              </button>
              <button
                type="button"
                className="vp-btn"
                onClick={() => {
                  handleCloseView();
                  navigate(`${createRoute}?edit=${encodeURIComponent(selectedDoc.docNumber)}${selectedDoc.id ? `&id=${encodeURIComponent(selectedDoc.id)}` : ''}`);
                }}
              >
                <i className="fa-solid fa-pencil"></i> Edit
              </button>
              <button
                type="button"
                className="vp-btn"
                onClick={() => {
                  handleCloseView();
                  handleDuplicate(selectedDoc);
                }}
              >
                <i className="fa-regular fa-copy"></i> Duplicate
              </button>
            </div>
          </div>
        </>
      )}

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
              Are you sure you want to mark {docTitle.toLowerCase()} <strong>{pendingPaidDoc?.docNumber}</strong> as{' '}
              <strong>{pendingAction}</strong>?
            </p>
            {pendingAction === 'paid' && pendingPaidDoc && (
              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0', marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '8px' }}>
                  <span style={{ color: '#64748b' }}>Total {docTitle} Amount:</span>
                  <strong style={{ color: '#0f172a' }}>₹{(pendingPaidDoc.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '12px' }}>
                  <span style={{ color: '#64748b' }}>Due Date:</span>
                  <strong>{fmtDate(getDueDate(pendingPaidDoc, 15))}</strong>
                </div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '4px' }}>
                  Payment Amount (₹):
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={pendingPaidDoc.amount}
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
                    onClick={() => setPaymentAmountInput(String(pendingPaidDoc.amount || 0))}
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
                {parseFloat(paymentAmountInput) < pendingPaidDoc.amount && (
                  <div style={{ fontSize: '12px', color: '#c2410c', marginTop: '6px', fontWeight: 500 }}>
                    Remaining Due: ₹{Math.max(0, pendingPaidDoc.amount - (parseFloat(paymentAmountInput) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                )}
              </div>
            )}
          </div>
        }
        confirmText={pendingAction === 'paid' ? 'Confirm Payment' : 'Mark as Unpaid'}
        confirmColor={pendingAction === 'paid' ? '#16a34a' : '#c2410c'}
        icon="fa-solid fa-circle-check"
      />

      {/* Status Action Confirmation Modal */}
      <Modal
        isOpen={statusModalOpen}
        onClose={() => {
          setStatusModalOpen(false);
          setPendingStatusDoc(null);
          setPendingStatusAction(null);
        }}
        onConfirm={handleConfirmStatusAction}
        title={pendingStatusAction?.title || `Update ${docTitle} Status`}
        message={<p>{pendingStatusAction?.message}</p>}
        confirmText={pendingStatusAction?.confirmText || 'Confirm'}
        confirmColor={pendingStatusAction?.confirmColor || '#4f46e5'}
        icon={pendingStatusAction?.icon || 'fa-solid fa-circle-check'}
      />


    </div>
  );
}
