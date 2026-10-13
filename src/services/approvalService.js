import {
  approvalsApi,
  invoicesApi,
  quotationsApi,
  proformasApi,
  deliveryChallansApi,
  purchaseOrdersApi,
  paymentVouchersApi
} from './api.js';
import userService from './userService.js';
import { canUserPerform } from './permissionService.js';
import { extractPanFromGstin, getAllClientsAggregated } from '../utils/clientHelper.js';
import { FIXED_BANK_ACCOUNT, FIXED_BANK_ACCOUNTS, normalizeBankAccounts } from '../constants/companyDetails.js';

const docApiMap = {
  invoice: invoicesApi,
  quotation: quotationsApi,
  purchase_order: purchaseOrdersApi,
  delivery_challan: deliveryChallansApi,
  proforma_invoice: proformasApi,
  payment_voucher: paymentVouchersApi
};

// ── Canonical Status Constants ─────────────────────
export const DOC_STATUS = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected'
};

// ── Document Storage Key Mappings ──────────────────
export const STORAGE_KEYS = {
  invoice: 'invox_invoices',
  quotation: 'invox_quotations',
  purchase_order: 'invox_purchase_orders',
  delivery_challan: 'invox_delivery_challans',
  proforma_invoice: 'invox_proforma_invoices',
  payment_voucher: 'invox_payment_vouchers'
};

export const FULLDATA_KEYS = {
  invoice: 'invox_invoice_fulldata',
  quotation: 'invox_quotation_fulldata',
  purchase_order: 'invox_po_fulldata',
  delivery_challan: 'invox_challan_fulldata',
  proforma_invoice: 'invox_proforma_fulldata',
  payment_voucher: 'invox_payment_voucher_fulldata'
};

export const HISTORY_STORAGE_KEY = 'invox_approval_history';

// ── Normalize Status Helper ────────────────────────
export function normalizeStatus(status) {
  if (!status) return DOC_STATUS.DRAFT;
  const s = String(status).trim().toLowerCase();
  if (s === 'pending approval' || s === 'pending_approval' || s === 'pendingapproval') {
    return DOC_STATUS.PENDING_APPROVAL;
  }
  if (s === 'approved' || s === 'paid') {
    return DOC_STATUS.APPROVED;
  }
  if (s === 'rejected') {
    return DOC_STATUS.REJECTED;
  }
  if (s === 'draft' || s === 'unpaid' || s === 'pending') {
    return DOC_STATUS.DRAFT;
  }
  return DOC_STATUS.DRAFT;
}

// ── Permission Checker ────────────────────────────
export const approvalPermissions = {
  canEdit: (status, user, docType) => {
    const norm = normalizeStatus(status);
    if (norm !== DOC_STATUS.DRAFT && norm !== DOC_STATUS.REJECTED) return false;
    if (!user) return true;
    if (user.role === 'MainAdmin' || user.userRole === 'MainAdmin') return true;
    if (!docType) return true;
    return canUserPerform(user, docType, 'edit');
  },
  canSubmit: (status, user, docType) => {
    const norm = normalizeStatus(status);
    if (norm !== DOC_STATUS.DRAFT && norm !== DOC_STATUS.REJECTED) return false;
    if (!user) return true;
    if (user.role === 'MainAdmin' || user.userRole === 'MainAdmin') return true;
    if (!docType) return true;
    return canUserPerform(user, docType, 'submit');
  },
  canApproveOrReject: (status, user, docType) => {
    const norm = normalizeStatus(status);
    if (norm !== DOC_STATUS.PENDING_APPROVAL) return false;
    if (!user) return false;
    if (user.role === 'MainAdmin' || user.userRole === 'MainAdmin') return true;
    if (!docType) return false;
    return canUserPerform(user, docType, 'approve') || canUserPerform(user, docType, 'reject');
  },
  canDelete: () => {
    return false;
  },
  isLocked: (status) => {
    const norm = normalizeStatus(status);
    return norm === DOC_STATUS.PENDING_APPROVAL || norm === DOC_STATUS.APPROVED;
  }
};

export function canDeleteDocument(status, user, docType) {
  return approvalPermissions.canDelete(status, user, docType);
}

export function getAuditHistory(docType, docNumber) {
  return getStoredHistory(docNumber);
}

// ── Helper to fully resolve Billed To details including PAN, Email, Phone, Telephone ───────
export function resolveDocumentBilledTo(rawBilledTo, doc = {}, fd = {}) {
  let b = rawBilledTo;
  if (typeof b === 'string') {
    b = { bizName: b };
  } else if (!b || typeof b !== 'object') {
    b = {};
  }

  const clientObj = (doc?.client && typeof doc.client === 'object') ? doc.client : ((fd?.client && typeof fd.client === 'object') ? fd.client : {});
  const clientName = b.bizName || b.name || clientObj.name || clientObj.bizName || doc?.paidTo || fd?.paidTo || '';
  const gstinVal = b.gstin || clientObj.gstin || doc?.gstin || fd?.gstin || '';

  let matchedClient = null;
  try {
    const allClients = getAllClientsAggregated();
    matchedClient = allClients.find((c) =>
      (gstinVal && c.gstin && c.gstin.trim().toUpperCase() === gstinVal.trim().toUpperCase()) ||
      (clientName && c.bizName && c.bizName.trim().toLowerCase() === clientName.trim().toLowerCase())
    );
  } catch (e) {}

  const effectiveGstin = gstinVal || matchedClient?.gstin || '';
  const effectivePan = b.pan || clientObj.pan || matchedClient?.pan || '';
  const effectiveEmail = b.email || clientObj.email || fd?.email || doc?.clientEmail || doc?.email || fd?.clientEmail || matchedClient?.email || '';
  const effectivePhone = b.phone || clientObj.phone || fd?.phone || doc?.clientPhone || doc?.phone || fd?.clientPhone || matchedClient?.phone || '';
  const effectiveTelephone = b.telephoneNumber || b.telephone || clientObj.telephoneNumber || clientObj.telephone || fd?.telephoneNumber || fd?.telephone || doc?.telephoneNumber || doc?.telephone || matchedClient?.telephoneNumber || matchedClient?.telephone || '';

  return {
    ...b,
    country: b.country || clientObj.country || matchedClient?.country || 'India',
    bizName: clientName || matchedClient?.bizName || '—',
    gstin: effectiveGstin,
    address: b.address || clientObj.address || matchedClient?.address || '',
    city: b.city || clientObj.city || matchedClient?.city || '',
    postal: b.postal || b.zip || clientObj.postal || matchedClient?.postal || '',
    state: b.state || clientObj.state || matchedClient?.state || '',
    pan: effectivePan,
    email: effectiveEmail,
    phone: effectivePhone,
    telephoneNumber: effectiveTelephone
  };
}

// ── Retrieve Full Document Data ───────────────────
export function getFullDocument(docType, docNumber) {
  if (!docNumber) return null;
  const cleanNum = String(docNumber).trim();

  const possibleKeys = [
    FULLDATA_KEYS[docType],
    STORAGE_KEYS[docType],
    'invox_invoice_fulldata',
    'invox_quotation_fulldata',
    'invox_po_fulldata',
    'invox_purchase_order_fulldata',
    'invox_challan_fulldata',
    'invox_delivery_challan_fulldata',
    'invox_proforma_fulldata',
    'invox_payment_voucher_fulldata',
    'invox_invoices',
    'invox_quotations',
    'invox_purchase_orders',
    'invox_delivery_challans',
    'invox_proforma_invoices',
    'invox_payment_vouchers'
  ].filter(Boolean);

  for (const key of possibleKeys) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        if (parsed[cleanNum]) {
          const item = parsed[cleanNum];
          const resBilledTo = resolveDocumentBilledTo(item.billedTo, item, item);
          return { ...item, billedTo: resBilledTo };
        }
        for (const item of Object.values(parsed)) {
          const itemNum = item?.proformaNumber || item?.proformaNo || item?.invoiceNo || item?.number || item?.quotationNumber || item?.challanNumber || item?.poNumber || item?.voucherNumber || item?.docNumber || item?.id;
          if (itemNum && String(itemNum).trim().toLowerCase() === cleanNum.toLowerCase()) {
            const resBilledTo = resolveDocumentBilledTo(item.billedTo, item, item);
            return { ...item, billedTo: resBilledTo };
          }
        }
      } else if (Array.isArray(parsed)) {
        const found = parsed.find((item) => {
          const itemNum = item?.proformaNumber || item?.proformaNo || item?.invoiceNo || item?.number || item?.quotationNumber || item?.challanNumber || item?.poNumber || item?.voucherNumber || item?.docNumber || item?.id;
          return itemNum && String(itemNum).trim().toLowerCase() === cleanNum.toLowerCase();
        });
        if (found) {
          let fd = {};
          if (found.fullData) {
            fd = typeof found.fullData === 'string' ? JSON.parse(found.fullData) : found.fullData;
          }
          if (!fd || Object.keys(fd).length === 0) {
            try {
              const fullKey = FULLDATA_KEYS[docType];
              if (fullKey) {
                const fullMap = JSON.parse(localStorage.getItem(fullKey) || '{}');
                if (fullMap[cleanNum]) fd = fullMap[cleanNum];
              }
            } catch (e) {}
          }
          const resBilledTo = resolveDocumentBilledTo(fd.billedTo || found.billedTo, found, fd);
          const resBankAccounts = normalizeBankAccounts(fd.bankAccounts || found.bankAccounts);
          const resUpiAccounts = (Array.isArray(fd.upiAccounts) && fd.upiAccounts.length > 0)
            ? fd.upiAccounts
            : (Array.isArray(found.upiAccounts) && found.upiAccounts.length > 0 ? found.upiAccounts : []);

          const rawTerms = fd.terms ?? found.terms ?? fd.termsAndConditions ?? found.termsAndConditions ?? [];
          const resTerms = Array.isArray(rawTerms) ? rawTerms : (typeof rawTerms === 'string' && rawTerms.trim() ? [rawTerms.trim()] : []);
          const resNotes = fd.notes ?? found.notes ?? fd.note ?? found.note ?? '';
          const rawAtts = fd.attachments ?? found.attachments ?? fd.files ?? found.files ?? [];
          const resAtts = Array.isArray(rawAtts) ? rawAtts : (rawAtts ? [rawAtts] : []);
          const resEmail = fd.contactEmail ?? found.contactEmail ?? fd.email ?? found.email ?? '';
          const resPhone = fd.contactPhone ?? found.contactPhone ?? fd.phone ?? found.phone ?? '';
          const resCountry = fd.countryCode ?? found.countryCode ?? '+91';

          return {
            ...found,
            ...fd,
            billedTo: resBilledTo,
            bankAccounts: resBankAccounts,
            upiAccounts: resUpiAccounts,
            terms: resTerms,
            termsAndConditions: resTerms,
            notes: resNotes,
            note: resNotes,
            attachments: resAtts,
            contactEmail: resEmail,
            contactPhone: resPhone,
            countryCode: resCountry
          };
        }
      }
    } catch (e) {}
  }
  return null;
}

export async function getSavedBankAccountsAsync() {
  try {
    const cached = JSON.parse(localStorage.getItem('invox_saved_bank_accounts') || '[]');
    if (Array.isArray(cached) && cached.length > 0) {
      const normalized = normalizeBankAccounts(cached);
      localStorage.setItem('invox_saved_bank_accounts', JSON.stringify(normalized));
      return normalized;
    }
  } catch (e) {}

  const defaultAccs = [FIXED_BANK_ACCOUNT];
  try {
    localStorage.setItem('invox_saved_bank_accounts', JSON.stringify(defaultAccs));
  } catch (e) {}
  return defaultAccs;
}

export async function getFullDocumentAsync(docType, docNumber) {
  const cleanNum = docNumber ? String(docNumber).trim() : '';
  const api = docApiMap[docType];
  if (api) {
    try {
      let doc = null;
      if (cleanNum && cleanNum !== '—' && cleanNum !== '-' && cleanNum !== 'undefined') {
        if (api.getByNumber) {
          try { doc = await api.getByNumber(cleanNum); } catch (e) {}
        }
        if (!doc && api.getById) {
          try { doc = await api.getById(cleanNum); } catch (e) {}
        }
      }
      if (!doc && api.getAll) {
        try {
          const allDocs = await api.getAll();
          if (Array.isArray(allDocs) && allDocs.length > 0) {
            if (cleanNum && cleanNum !== '—' && cleanNum !== '-' && cleanNum !== 'undefined') {
              doc = allDocs.find((d) => {
                const num = d.proformaNumber || d.proformaNo || d.invoiceNumber || d.invoiceNo || d.quotationNumber || d.challanNumber || d.poNumber || d.voucherNumber || d.number;
                return (num && String(num).trim().toLowerCase() === cleanNum.toLowerCase()) || String(d.id) === cleanNum;
              });
            } else {
              doc = allDocs[allDocs.length - 1];
            }
          }
        } catch (e) {}
      }
      if (doc) {
        let fd = {};
        const rawFd = doc.fullDataJson || doc.fullData;
        if (rawFd) {
          try {
            fd = typeof rawFd === 'string' ? JSON.parse(rawFd) : rawFd;
          } catch (e) {}
        }
        const resolvedBilledTo = resolveDocumentBilledTo(fd.billedTo || doc.billedTo, doc, fd);
        const resolvedBankAccounts = normalizeBankAccounts(
          (Array.isArray(fd.bankAccounts) && fd.bankAccounts.length > 0)
            ? fd.bankAccounts
            : (Array.isArray(doc.bankAccounts) && doc.bankAccounts.length > 0 ? doc.bankAccounts : [])
        );

        const resolvedUpiAccounts = (Array.isArray(fd.upiAccounts) && fd.upiAccounts.length > 0)
          ? fd.upiAccounts
          : (Array.isArray(doc.upiAccounts) && doc.upiAccounts.length > 0 ? doc.upiAccounts : []);

        const rawTerms = fd.terms ?? doc.terms ?? fd.termsAndConditions ?? doc.termsAndConditions ?? [];
        const resolvedTerms = Array.isArray(rawTerms) ? rawTerms : (typeof rawTerms === 'string' && rawTerms.trim() ? [rawTerms.trim()] : []);
        const resolvedNotes = fd.notes ?? doc.notes ?? fd.note ?? doc.note ?? '';
        const rawAtts = fd.attachments ?? doc.attachments ?? fd.files ?? doc.files ?? [];
        const resolvedAttachments = Array.isArray(rawAtts) ? rawAtts : (rawAtts ? [rawAtts] : []);
        const resolvedContactEmail = fd.contactEmail ?? doc.contactEmail ?? fd.email ?? doc.email ?? '';
        const resolvedContactPhone = fd.contactPhone ?? doc.contactPhone ?? fd.phone ?? doc.phone ?? '';
        const resolvedCountryCode = fd.countryCode ?? doc.countryCode ?? '+91';

        const merged = {
          ...doc,
          ...fd,
          status: normalizeStatus(doc.status),
          amount: parseFloat(doc.totalAmount ?? doc.amount) || 0,
          totalAmount: parseFloat(doc.totalAmount ?? doc.amount) || 0,
          date: doc.date ? doc.date.split('T')[0] : (doc.challanDate ? doc.challanDate.split('T')[0] : ''),
          dueDate: doc.dueDate ? doc.dueDate.split('T')[0] : '',
          billedTo: resolvedBilledTo,
          bankAccounts: resolvedBankAccounts,
          upiAccounts: resolvedUpiAccounts,
          terms: resolvedTerms,
          termsAndConditions: resolvedTerms,
          notes: resolvedNotes,
          note: resolvedNotes,
          attachments: resolvedAttachments,
          contactEmail: resolvedContactEmail,
          contactPhone: resolvedContactPhone,
          countryCode: resolvedCountryCode
        };
        const syncNum = merged.proformaNumber || merged.invoiceNo || merged.number || cleanNum;
        if (syncNum && syncNum !== '—') {
          syncDocumentStatusLocally(docType, syncNum, normalizeStatus(doc.status), merged);
        }
        return merged;
      }
    } catch (e) {}
  }
  return getFullDocument(docType, cleanNum);
}


// ── Mandatory Fields Validator ─────────────────────
export function validateDocumentForSubmission(docData, docType = 'invoice') {
  const errors = [];

  const docNumber = docData.proformaNumber || docData.proformaNo || docData.invoiceNo || docData.number || docData.quotationNumber || docData.challanNumber || docData.poNumber || docData.voucherNumber || '';
  if (!docNumber || !String(docNumber).trim()) {
    errors.push('Document number is required.');
  }

  const date = docData.date || docData.docDate || '';
  if (!date) {
    errors.push('Document date is required.');
  }

  if (docType === 'payment_voucher') {
    const payee = docData.paidTo || (docData.paymentRows && docData.paymentRows[0]?.payee) || '';
    if (!payee || !payee.trim()) {
      errors.push('Payment payee (Paid To) is required.');
    }
    const amt = parseFloat(String(docData.amount || 0).replace(/,/g, ''));
    if (isNaN(amt) || amt <= 0) {
      errors.push('A valid voucher amount greater than 0 is required.');
    }
    const recSign = docData.receivedSign || docData.fullData?.receivedSign;
    const recDate = docData.receivedDate || docData.fullData?.receivedDate;
    if (!recSign || !String(recSign).trim() || !recDate || !String(recDate).trim()) {
      errors.push('Received By Signature and Date are required before sending for approval.');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// ── Approval History Manager ──────────────────────
export function getStoredHistory(docNumber) {
  try {
    const all = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
    if (!docNumber) return all;
    return all.filter((h) => String(h.documentNumber).toLowerCase() === String(docNumber).toLowerCase());
  } catch (e) {
    return [];
  }
}

export function appendHistoryRecord(record) {
  try {
    const all = JSON.parse(localStorage.getItem(HISTORY_STORAGE_KEY) || '[]');
    const newRecord = {
      id: 'ah_' + Date.now() + '_' + Math.random().toString(36).slice(2),
      timestamp: new Date().toISOString(),
      ...record
    };
    all.push(newRecord);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(all));
    return newRecord;
  } catch (e) {
    console.warn('Error saving approval history:', e);
    return record;
  }
}

// ── Sync Status in Local Storage ──────────────────
function syncDocumentStatusLocally(docType, docNumber, newStatus, extraMetadata = {}) {
  const storageKey = STORAGE_KEYS[docType] || 'invox_invoices';
  const fullKey = FULLDATA_KEYS[docType] || 'invox_invoice_fulldata';

  // 1. Update summary list
  try {
    const list = JSON.parse(localStorage.getItem(storageKey) || '[]');
    const target = list.find(
      (x) =>
        (x.invoiceNo || x.number || x.quotationNumber || x.challanNumber || x.poNumber || x.voucherNumber || '') === docNumber ||
        String(x.id) === String(docNumber)
    );
    if (target) {
      target.status = newStatus;
      Object.assign(target, extraMetadata);
    } else {
      list.push({
        id: docNumber,
        invoiceNo: docNumber,
        number: docNumber,
        quotationNumber: docNumber,
        challanNumber: docNumber,
        poNumber: docNumber,
        voucherNumber: docNumber,
        status: newStatus,
        savedAt: new Date().toISOString(),
        ...extraMetadata
      });
    }
    localStorage.setItem(storageKey, JSON.stringify(list));
  } catch (e) {}

  // 2. Update fulldata map
  try {
    const fullMap = JSON.parse(localStorage.getItem(fullKey) || '{}');
    if (fullMap[docNumber]) {
      fullMap[docNumber].status = newStatus;
      Object.assign(fullMap[docNumber], extraMetadata);
    } else {
      fullMap[docNumber] = {
        docNumber,
        status: newStatus,
        ...extraMetadata
      };
    }
    localStorage.setItem(fullKey, JSON.stringify(fullMap));
  } catch (e) {}

  // 3. Update invoiceDrafts
  try {
    const drafts = JSON.parse(localStorage.getItem('invoiceDrafts') || '[]');
    const di = drafts.findIndex((d) => d.invoiceNo === docNumber);
    if (di !== -1) {
      if (newStatus === DOC_STATUS.DRAFT) {
        drafts[di].status = DOC_STATUS.DRAFT;
      } else {
        // If submitted or approved, remove from active drafts list
        drafts.splice(di, 1);
      }
      localStorage.setItem('invoiceDrafts', JSON.stringify(drafts));
    }
  } catch (e) {}
}

// ── Purge Any Dummy Seeded Documents ──
function purgeSeedDummyDocuments() {
  try {
    const dummyIds = ['inv_001', 'qtn_005', 'po_012', 'INV-001', 'QTN-005', 'PO-012'];
    const dummyEmails = ['john@qualitysalespro.com', 'sarah@qualitysalespro.com', 'david@qualitysalespro.com'];

    ['invoice', 'quotation', 'purchase_order', 'delivery_challan', 'proforma_invoice', 'payment_voucher'].forEach((type) => {
      const storageKey = STORAGE_KEYS[type];
      const list = JSON.parse(localStorage.getItem(storageKey) || '[]');
      const filtered = list.filter((doc) => {
        const num = doc.invoiceNo || doc.number || doc.quotationNumber || doc.challanNumber || doc.poNumber || doc.voucherNumber || '';
        const id = String(doc.id || '');
        const submitter = (doc.submittedBy || '').toLowerCase();
        if (dummyIds.includes(num) || dummyIds.includes(id)) return false;
        if (dummyEmails.includes(submitter)) return false;
        return true;
      });
      localStorage.setItem(storageKey, JSON.stringify(filtered));
    });

    localStorage.removeItem('invox_approval_seeded_v2');
  } catch (e) {}
}

// ── Main Approval Service ─────────────────────────
export const approvalService = {
  validateDocumentForSubmission,
  getStoredHistory,
  canDeleteDocument,
  getFullDocument,
  getFullDocumentAsync,
  resolveDocumentBilledTo,
  getSavedBankAccountsAsync,
  // 1. Submit for Approval
  submitForApproval: async ({ docType, docNumber, docData = {}, user, currentStatus = DOC_STATUS.DRAFT }) => {
    // Permission check
    const canSubmit = !user || user.userRole === 'MainAdmin' || user.role === 'MainAdmin' || canUserPerform(user, docType, 'submit');
    if (!canSubmit) {
      return { success: false, errors: ['Security Violation: You do not have permission to submit this document for approval.'] };
    }

    // Validate
    const validation = validateDocumentForSubmission(docData, docType);
    if (!validation.isValid) {
      return { success: false, errors: validation.errors };
    }

    const normCurrent = normalizeStatus(currentStatus);
    if (normCurrent === DOC_STATUS.APPROVED) {
      return { success: false, errors: ['Approved documents cannot be submitted again.'] };
    }

    const isResubmission = normCurrent === DOC_STATUS.REJECTED;
    const action = isResubmission ? 'Resubmitted' : 'Submitted';
    const comments = isResubmission
      ? 'Document resubmitted for approval after correction'
      : 'Document submitted for approval';

    const currentNotes = docData?.notes || docData?.note || '';
    const extraMetadata = {
      submittedBy: user?.userEmail || user?.email || 'user@example.com',
      submittedByName: user?.fullName || user?.userName || (user?.email ? user.email.split('@')[0] : 'User'),
      submittedAt: new Date().toISOString(),
      billedTo: docData?.billedTo?.bizName || docData?.client?.name || (typeof docData?.billedTo === 'string' ? docData.billedTo : '—'),
      amount: docData?.totalAmount || docData?.amount || 0,
      totalAmount: docData?.totalAmount || docData?.amount || 0,
      date: docData?.date || docData?.docDate || new Date().toISOString().split('T')[0],
      dueDate: docData?.dueDate || '',
      terms: docData?.terms || docData?.termsAndConditions || [],
      termsAndConditions: docData?.terms || docData?.termsAndConditions || [],
      notes: currentNotes,
      note: currentNotes,
      attachments: docData?.attachments || docData?.files || [],
      contactEmail: docData?.contactEmail || docData?.email || '',
      contactPhone: docData?.contactPhone || docData?.phone || '',
      countryCode: docData?.countryCode || '+91',
      fullData: docData
    };

    // 1. Submit to Backend API FIRST
    let apiRes = null;
    try {
      const callerRole = user?.userRole || user?.role || 'User';
      apiRes = await approvalsApi.submit(
        {
          documentType: docType,
          documentNumber: docNumber,
          userEmail: user?.userEmail || user?.email || 'user@example.com',
          userId: user?.userId || user?.id,
          userRole: callerRole,
          comments
        },
        callerRole
      );
    } catch (err) {
      console.warn('Backend approval submission error/offline, syncing locally:', err.message);
      const isNetworkErr = !err.status || err.message?.includes('fetch') || err.message?.includes('NetworkError') || err.message?.includes('Failed to fetch');
      if (!isNetworkErr && err.status >= 400 && err.status < 500) {
        return {
          success: false,
          errors: [err.message || 'Submission failed on backend server.']
        };
      }
    }

    // 2. Update locally (whether backend responded or using local fallback)
    syncDocumentStatusLocally(docType, docNumber, DOC_STATUS.PENDING_APPROVAL, extraMetadata);

    const historyRecord = appendHistoryRecord({
      documentType: docType,
      documentNumber: docNumber,
      action,
      userEmail: user?.userEmail || user?.email || 'user@example.com',
      userId: user?.userId || user?.id || 'usr',
      previousStatus: normCurrent,
      newStatus: DOC_STATUS.PENDING_APPROVAL,
      comments
    });

    try {
      userService.logActivity({
        userEmail: user?.userEmail || user?.email,
        userName: user?.fullName || user?.userName || user?.userEmail,
        action: isResubmission ? 'Resubmitted for Approval' : 'Submitted for Approval',
        details: `${user?.fullName || user?.userEmail} submitted ${docType.replace('_', ' ')} ${docNumber} for approval`
      });
    } catch (e) {}

    try {
      window.dispatchEvent(new CustomEvent('invox_approvals_updated'));
    } catch (e) {}

    return {
      success: true,
      status: DOC_STATUS.PENDING_APPROVAL,
      message: isResubmission ? 'Document resubmitted for approval successfully!' : 'Document submitted for approval successfully!',
      history: apiRes?.history || historyRecord
    };
  },

  // 2. Approve Document (Authorized users only)
  approveDocument: async ({ docType, docNumber, comments = '', approvedSign = '', approvedDate = '', user }) => {
    const canApprove = !user || user.userRole === 'MainAdmin' || user.role === 'MainAdmin' || canUserPerform(user, docType, 'approve');
    if (!canApprove) {
      return {
        success: false,
        errors: ['Security Violation: You do not have permission to approve this document.']
      };
    }

    if (docType === 'payment_voucher') {
      let sign = (approvedSign || '').trim();
      let date = (approvedDate || '').trim();
      if (!sign || !date) {
        const fullDoc = await approvalService.getFullDocumentAsync(docType, docNumber);
        if (fullDoc) {
          sign = sign || (fullDoc.approvedSign || '').trim();
          date = date || (fullDoc.approvedDate || '').trim();
        }
      }
      if (!sign || !date) {
        return {
          success: false,
          errors: ['Approved By Signature and Date are required before approving the payment voucher.']
        };
      }
      approvedSign = sign;
      approvedDate = date;
    }

    // 1. Call Backend API FIRST
    let apiRes = null;
    try {
      const callerRole = user?.userRole || user?.role || 'MainAdmin';
      apiRes = await approvalsApi.approve(
        {
          documentType: docType,
          documentNumber: docNumber,
          userEmail: user?.userEmail || user?.email || 'admin@qualitysalespro.com',
          userId: user?.userId || user?.id,
          userRole: callerRole,
          comments: comments || 'Approved by Main Admin',
          approvedSign,
          approvedDate
        },
        callerRole
      );
    } catch (err) {
      console.warn('Backend approval error/offline, updating locally:', err.message);
      const isNetworkErr = !err.status || err.message?.includes('fetch') || err.message?.includes('NetworkError') || err.message?.includes('Failed to fetch');
      if (!isNetworkErr && err.status >= 400 && err.status < 500) {
        return {
          success: false,
          errors: [err.message || 'Approval failed on backend server.']
        };
      }
    }

    // 2. Update local cache
    const extraMetadata = {
      approvedBy: user?.userEmail || user?.email,
      approvedByName: user?.fullName || user?.userName || (user?.userEmail ? user.userEmail.split('@')[0] : 'Approver'),
      approvedAt: new Date().toISOString(),
      approvalComments: comments,
      ...(docType === 'payment_voucher' ? { approvedSign, approvedDate } : {})
    };

    syncDocumentStatusLocally(docType, docNumber, DOC_STATUS.APPROVED, extraMetadata);

    const historyRecord = appendHistoryRecord({
      documentType: docType,
      documentNumber: docNumber,
      action: 'Approved',
      userEmail: user?.userEmail || user?.email,
      userId: user?.userId || user?.id,
      previousStatus: DOC_STATUS.PENDING_APPROVAL,
      newStatus: DOC_STATUS.APPROVED,
      comments: comments || `Approved by ${user?.fullName || user?.userEmail}`
    });

    try {
      userService.logActivity({
        userEmail: user?.userEmail || user?.email,
        userName: user?.fullName || user?.userName || user?.userEmail,
        action: 'Approved Document',
        details: `${user?.fullName || user?.userEmail} approved ${docType.replace('_', ' ')} ${docNumber}`
      });
    } catch (e) {}

    try {
      window.dispatchEvent(new CustomEvent('invox_approvals_updated'));
    } catch (e) {}

    return {
      success: true,
      status: DOC_STATUS.APPROVED,
      message: `Document ${docNumber} approved successfully!`,
      history: apiRes?.history || historyRecord
    };
  },

  // 3. Reject Document (Authorized users only, reason mandatory)
  rejectDocument: async ({ docType, docNumber, reason, user }) => {
    const canReject = !user || user.userRole === 'MainAdmin' || user.role === 'MainAdmin' || canUserPerform(user, docType, 'reject');
    if (!canReject) {
      return {
        success: false,
        errors: ['Security Violation: You do not have permission to reject this document.']
      };
    }

    if (!reason || !reason.trim()) {
      return {
        success: false,
        errors: ['A rejection reason is mandatory.']
      };
    }

    // 1. Call Backend API FIRST
    let apiRes = null;
    try {
      const callerRole = user?.userRole || user?.role || 'MainAdmin';
      apiRes = await approvalsApi.reject(
        {
          documentType: docType,
          documentNumber: docNumber,
          userEmail: user?.userEmail || user?.email,
          userId: user?.userId || user?.id,
          userRole: callerRole,
          reason: reason.trim(),
          comments: reason.trim()
        },
        callerRole
      );
    } catch (err) {
      console.warn('Backend rejection error/offline, updating locally:', err.message);
      const isNetworkErr = !err.status || err.message?.includes('fetch') || err.message?.includes('NetworkError') || err.message?.includes('Failed to fetch');
      if (!isNetworkErr && err.status >= 400 && err.status < 500) {
        return {
          success: false,
          errors: [err.message || 'Rejection failed on backend server.']
        };
      }
    }

    // 2. Update local cache
    const extraMetadata = {
      rejectedBy: user?.userEmail || user?.email,
      rejectedByName: user?.fullName || user?.userName || (user?.userEmail ? user.userEmail.split('@')[0] : 'Reviewer'),
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason.trim()
    };

    syncDocumentStatusLocally(docType, docNumber, DOC_STATUS.REJECTED, extraMetadata);

    const historyRecord = appendHistoryRecord({
      documentType: docType,
      documentNumber: docNumber,
      action: 'Rejected',
      userEmail: user?.userEmail || user?.email,
      userId: user?.userId || user?.id,
      previousStatus: DOC_STATUS.PENDING_APPROVAL,
      newStatus: DOC_STATUS.REJECTED,
      comments: reason.trim()
    });

    try {
      userService.logActivity({
        userEmail: user?.userEmail || user?.email,
        userName: user?.fullName || user?.userName || user?.userEmail,
        action: 'Rejected Document',
        details: `${user?.fullName || user?.userEmail} rejected ${docType.replace('_', ' ')} ${docNumber}. Reason: "${reason.trim()}"`
      });
    } catch (e) {}

    try {
      window.dispatchEvent(new CustomEvent('invox_approvals_updated'));
    } catch (e) {}

    return {
      success: true,
      status: DOC_STATUS.REJECTED,
      message: `Document ${docNumber} was rejected.`,
      history: apiRes?.history || historyRecord
    };
  },

  // 4. Get Chronological History
  getHistory: async (docType, docNumber) => {
    let localHistory = getStoredHistory(docNumber);
    try {
      const serverHistory = await approvalsApi.getHistory(docType, docNumber);
      if (Array.isArray(serverHistory) && serverHistory.length > 0) {
        return serverHistory;
      }
    } catch (e) {}
    return localHistory;
  },

  // 5. Aggregate All Pending Approvals (For Authorized Approvers)
  getPendingApprovalsAsync: async (user) => {
    try {
      const res = await approvalsApi.getPending();
      if (res && Array.isArray(res.items)) {
        return res.items.map((item) => ({
          ...item,
          docType: item.docType,
          docNumber: item.docNumber || item.number || '—',
          amount: parseFloat(item.amount) || 0,
          totalAmount: parseFloat(item.amount) || 0,
          date: item.date ? item.date.split('T')[0] : '',
          dueDate: item.dueDate ? item.dueDate.split('T')[0] : '',
          billedTo: item.billedTo || '—',
          status: DOC_STATUS.PENDING_APPROVAL,
          submittedBy: item.submittedBy || 'Standard User',
          submittedByName: item.submittedByName || 'Standard User',
          submittedAt: item.submittedAt || '',
          fullDataJson: item.fullDataJson || ''
        }));
      }
    } catch (e) {
      console.warn('API getPendingApprovals offline:', e.message);
    }
    return [];
  },

  getPendingApprovals: (user) => {
    purgeSeedDummyDocuments();
    const docTypes = ['invoice', 'quotation', 'purchase_order', 'delivery_challan', 'proforma_invoice', 'payment_voucher'];
    const pendingList = [];

    // Filter to docTypes user is authorized to approve or reject
    const allowedTypes = docTypes.filter((type) => {
      if (!user) return true;
      if (user.role === 'MainAdmin' || user.userRole === 'MainAdmin') return true;
      return canUserPerform(user, type, 'approve') || canUserPerform(user, type, 'reject');
    });

    allowedTypes.forEach((type) => {
      const storageKey = STORAGE_KEYS[type];
      try {
        const list = JSON.parse(localStorage.getItem(storageKey) || '[]');
        list.forEach((doc) => {
          if (normalizeStatus(doc.status) === DOC_STATUS.PENDING_APPROVAL) {
            pendingList.push({
              ...doc,
              docType: type,
              docNumber: doc.invoiceNo || doc.number || doc.quotationNumber || doc.challanNumber || doc.poNumber || doc.voucherNumber || '—',
              amount: doc.amount || doc.totalAmount || 0,
              submittedByName: doc.submittedByName || (doc.submittedBy ? doc.submittedBy.split('@')[0] : 'Standard User'),
              submittedBy: doc.submittedBy || 'Standard User'
            });
          }
        });
      } catch (e) {}
    });

    return pendingList;
  },

  // 6. Aggregate Dashboard Counts by Status
  getDashboardCounts: (userEmail, userRole) => {
    const docTypes = ['invoice', 'quotation', 'purchase_order', 'delivery_challan', 'proforma_invoice', 'payment_voucher'];
    const counts = {
      all: 0,
      draft: 0,
      pendingApproval: 0,
      approved: 0,
      rejected: 0
    };

    docTypes.forEach((type) => {
      const storageKey = STORAGE_KEYS[type];
      try {
        const list = JSON.parse(localStorage.getItem(storageKey) || '[]');
        list.forEach((doc) => {
          // If normal user, filter by their documents if submittedBy is present
          if (userRole !== 'MainAdmin' && doc.submittedBy && doc.submittedBy.toLowerCase() !== (userEmail || '').toLowerCase()) {
            return;
          }

          counts.all++;
          const st = normalizeStatus(doc.status);
          if (st === DOC_STATUS.DRAFT) counts.draft++;
          else if (st === DOC_STATUS.PENDING_APPROVAL) counts.pendingApproval++;
          else if (st === DOC_STATUS.APPROVED) counts.approved++;
          else if (st === DOC_STATUS.REJECTED) counts.rejected++;
        });
      } catch (e) {}
    });

    return counts;
  }
};

export default approvalService;
