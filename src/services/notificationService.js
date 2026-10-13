import { getDocumentPaymentStatus, fmtDate, parseDate } from '../utils/dateUtils.js';

// In-App Notification Service
const STORAGE_KEY = 'invox_inapp_notifications';
const EVENT_NAME = 'invox_notification_updated';

function getStored() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function saveStored(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  } catch (e) {
    console.warn('Error saving notifications:', e);
  }
}

export const notificationService = {
  getNotifications: (userEmail, userRole) => {
    const all = getStored();
    const emailLower = (userEmail || '').toLowerCase();
    const isAdmin = userRole === 'MainAdmin';

    return all.filter((n) => {
      // If notification targeted to a specific user
      if (n.targetEmail && n.targetEmail.toLowerCase() === emailLower) return true;
      // If notification targeted to approvers / admin
      if (n.targetRole === 'approver' && (isAdmin || userRole === 'Admin')) return true;
      // If notification is global / all
      if (n.targetRole === 'all') return true;
      // Fallback: If user created/submitted it
      if (n.userEmail && n.userEmail.toLowerCase() === emailLower) return true;
      return false;
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  getUnreadCount: (userEmail, userRole) => {
    const list = notificationService.getNotifications(userEmail, userRole);
    return list.filter((n) => !n.read).length;
  },

  addNotification: ({
    title,
    message,
    type = 'info', // 'success', 'warning', 'danger', 'info'
    targetEmail = null,
    targetRole = null, // 'approver', 'all', or null
    userEmail = null,
    docType = null,
    docNumber = null,
    actionUrl = null
  }) => {
    const all = getStored();
    const newNotif = {
      id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      title,
      message,
      type,
      targetEmail,
      targetRole,
      userEmail,
      docType,
      docNumber,
      actionUrl,
      timestamp: new Date().toISOString(),
      read: false
    };

    // Keep up to 100 recent notifications
    const updated = [newNotif, ...all].slice(0, 100);
    saveStored(updated);

    // Also dispatch toast notification event for real-time banner
    window.dispatchEvent(
      new CustomEvent('invox_show_toast', {
        detail: {
          title,
          message,
          type
        }
      })
    );

    return newNotif;
  },

  notify: (message, title = 'Notification', type = 'info') => {
    return notificationService.addNotification({
      title,
      message,
      type,
      targetRole: 'all'
    });
  },

  notifyError: (message, title = 'Error') => {
    return notificationService.addNotification({
      title,
      message,
      type: 'danger',
      targetRole: 'all'
    });
  },

  notifyWarning: (message, title = 'Warning') => {
    return notificationService.addNotification({
      title,
      message,
      type: 'warning',
      targetRole: 'all'
    });
  },

  notifySuccess: (message, title = 'Success') => {
    return notificationService.addNotification({
      title,
      message,
      type: 'success',
      targetRole: 'all'
    });
  },

  checkAndNotifyDueDocuments: (documents = [], defaultDocType = 'invoice') => {
    if (!Array.isArray(documents) || documents.length === 0) return;

    const NOTIFIED_KEY = 'invox_notified_due_documents';
    let notifiedMap = {};
    try {
      notifiedMap = JSON.parse(localStorage.getItem(NOTIFIED_KEY) || '{}');
      const oldInvoiceMap = JSON.parse(localStorage.getItem('invox_notified_due_invoices') || '{}');
      Object.assign(notifiedMap, oldInvoiceMap);
    } catch (e) {
      notifiedMap = {};
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let updatedMap = false;

    const DOC_CONFIGS = {
      invoice: { title: 'Invoice', recipientField: 'Client', url: (num) => `/invoices?edit=${encodeURIComponent(num)}` },
      quotation: { title: 'Quotation', recipientField: 'Client', url: (num) => `/quotations?edit=${encodeURIComponent(num)}` },
      purchase_order: { title: 'Purchase Order', recipientField: 'Vendor', url: (num) => `/purchase-orders?edit=${encodeURIComponent(num)}` },
      delivery_challan: { title: 'Delivery Challan', recipientField: 'Consignee', url: (num) => `/delivery-challans?edit=${encodeURIComponent(num)}` },
      proforma: { title: 'Proforma Invoice', recipientField: 'Client', url: (num) => `/proforma?edit=${encodeURIComponent(num)}` },
      payment_voucher: { title: 'Payment Voucher', recipientField: 'Paid To', url: () => '/payment-vouchers' }
    };

    documents.forEach((doc) => {
      const resolvedDocType = doc.docType || defaultDocType || 'invoice';
      const config = DOC_CONFIGS[resolvedDocType] || { title: 'Document', recipientField: 'Client', url: () => '/dashboard' };

      const payment = getDocumentPaymentStatus(doc);
      if (payment.isPaid || payment.outstandingAmount <= 0.001) return;

      const dueDateStr = payment.dueDate;
      if (!dueDateStr) return;

      const due = parseDate(dueDateStr);
      due.setHours(0, 0, 0, 0);
      if (due.getTime() === 0) return;

      const isDueToday = today.getTime() === due.getTime();
      const isPastDue = today.getTime() > due.getTime();

      if (!isDueToday && !isPastDue) return;

      const docNum =
        doc.docNumber ||
        doc.number ||
        doc.invoiceNumber ||
        doc.quotationNumber ||
        doc.poNumber ||
        doc.challanNumber ||
        doc.voucherNumber ||
        `DOC-${doc.id}`;

      let recipientName =
        doc.billedTo ||
        doc.vendor ||
        doc.paidTo ||
        doc.consignee ||
        doc.client?.name ||
        doc.clientName ||
        config.recipientField;
      if (typeof recipientName === 'object') {
        recipientName = recipientName.bizName || recipientName.name || config.recipientField;
      }

      const amountDue = payment.outstandingAmount;
      const formattedAmt = `₹${amountDue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      const formattedDue = fmtDate(dueDateStr);

      // Do not generate repeated duplicate notifications for the same document and due date
      const dedupKey = `${resolvedDocType}_${docNum}_${dueDateStr}`;
      const legacyKey = `${docNum}_${dueDateStr}`;
      if (notifiedMap[dedupKey] || notifiedMap[legacyKey]) return;

      const docTitle = config.title;
      const actionUrl = config.url(docNum);

      if (isPastDue) {
        notificationService.addNotification({
          title: `${docTitle} Overdue: ${docNum}`,
          message: `${docTitle} ${docNum} for ${recipientName} is Overdue. Amount Due: ${formattedAmt} (Due Date: ${formattedDue}).`,
          type: 'danger',
          targetRole: 'all',
          docType: resolvedDocType,
          docNumber: docNum,
          actionUrl
        });
      } else {
        notificationService.addNotification({
          title: `${docTitle} Due Today: ${docNum}`,
          message: `${docTitle} ${docNum} for ${recipientName} is Due Today. Amount Due: ${formattedAmt} (Due Date: ${formattedDue}).`,
          type: 'warning',
          targetRole: 'all',
          docType: resolvedDocType,
          docNumber: docNum,
          actionUrl
        });
      }

      notifiedMap[dedupKey] = {
        timestamp: new Date().toISOString(),
        type: isPastDue ? 'overdue' : 'due',
        docNum,
        docType: resolvedDocType,
        dueDate: dueDateStr
      };
      updatedMap = true;
    });

    if (updatedMap) {
      try {
        localStorage.setItem(NOTIFIED_KEY, JSON.stringify(notifiedMap));
        localStorage.setItem('invox_notified_due_invoices', JSON.stringify(notifiedMap));
      } catch (e) {}
    }
  },

  checkAndNotifyDueInvoices: (invoices = []) => {
    notificationService.checkAndNotifyDueDocuments(invoices, 'invoice');
  },

  markAsRead: (id) => {
    const all = getStored();
    const updated = all.map((n) => (n.id === id ? { ...n, read: true } : n));
    saveStored(updated);
  },

  markAllAsRead: (userEmail, userRole) => {
    const all = getStored();
    const emailLower = (userEmail || '').toLowerCase();
    const isAdmin = userRole === 'MainAdmin';

    const updated = all.map((n) => {
      const isForUser =
        (n.targetEmail && n.targetEmail.toLowerCase() === emailLower) ||
        (n.targetRole === 'approver' && (isAdmin || userRole === 'Admin')) ||
        n.targetRole === 'all' ||
        (n.userEmail && n.userEmail.toLowerCase() === emailLower);

      if (isForUser) {
        return { ...n, read: true };
      }
      return n;
    });

    saveStored(updated);
  },

  clearAll: (userEmail, userRole) => {
    const all = getStored();
    const emailLower = (userEmail || '').toLowerCase();
    const isAdmin = userRole === 'MainAdmin';

    const updated = all.filter((n) => {
      const isForUser =
        (n.targetEmail && n.targetEmail.toLowerCase() === emailLower) ||
        (n.targetRole === 'approver' && (isAdmin || userRole === 'Admin')) ||
        n.targetRole === 'all' ||
        (n.userEmail && n.userEmail.toLowerCase() === emailLower);

      return !isForUser;
    });

    saveStored(updated);
  },

  subscribe: (callback) => {
    const handler = () => callback();
    window.addEventListener(EVENT_NAME, handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener(EVENT_NAME, handler);
      window.removeEventListener('storage', handler);
    };
  }
};

export default notificationService;
