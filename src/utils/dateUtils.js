// Date utilities matching global application standard: DD/MMM/YYYY (e.g. 02/Oct/2026)

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Global date formatter producing "DD/MMM/YYYY" (e.g. "02/Oct/2026") style dates throughout the app.
 * @param {string|Date} dateStr – ISO string, YYYY-MM-DD, or a Date object
 * @param {boolean} [withTime=false] – if true, appends " HH:MM" (24-h)
 * @returns {string} formatted date string or '—' on failure
 */
export function formatAppDate(dateStr, withTime = false) {
  if (!dateStr || dateStr === '—' || dateStr === 'null' || dateStr === 'undefined') return '—';
  let d;
  if (dateStr instanceof Date) {
    d = dateStr;
  } else {
    const s = String(dateStr).trim();
    if (!s || s === '—') return '—';
    // Handle YYYY-MM-DD without time (treat as local date, avoiding timezone drift)
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch && !s.includes('T')) {
      const y = parseInt(isoMatch[1], 10);
      const mo = parseInt(isoMatch[2], 10);
      const da = parseInt(isoMatch[3], 10);
      d = new Date(y, mo - 1, da);
    } else {
      // Check if already in DD-MMM-YYYY or DD/MMM/YYYY or DD-MM-YYYY or DD/MM/YYYY
      const slashOrDash = s.match(/^(\d{1,2})[-/]([A-Za-z]{3}|\d{1,2})[-/](\d{4})(.*)$/);
      if (slashOrDash) {
        const da = parseInt(slashOrDash[1], 10);
        const mPart = slashOrDash[2].toLowerCase();
        const y = parseInt(slashOrDash[3], 10);
        const mIdx = MONTHS.findIndex((m) => m.toLowerCase() === mPart);
        if (mIdx !== -1) {
          d = new Date(y, mIdx, da);
        } else {
          const numM = parseInt(mPart, 10);
          if (!isNaN(numM) && numM >= 1 && numM <= 12) {
            d = new Date(y, numM - 1, da);
          } else {
            d = new Date(s);
          }
        }
      } else {
        d = new Date(s);
      }
    }
  }
  if (!d || isNaN(d.getTime()) || d.getTime() === 0) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTHS[d.getMonth()];
  const year = d.getFullYear();
  let result = `${day}/${month}/${year}`;
  if (withTime) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    result += ` ${hh}:${mm}`;
  }
  return result;
}

/**
 * Parses date string in "DD/MMM/YYYY", "DD-MMM-YYYY", or ISO format back to "YYYY-MM-DD"
 */
export function parseAppDate(dateStr) {
  if (!dateStr || dateStr === '—') return '';
  const str = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parts = str.split(/[-/]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const monthStr = parts[1].trim().toLowerCase();
    const year = parseInt(parts[2], 10);
    const monthIdx = MONTHS.findIndex((m) => m.toLowerCase() === monthStr);
    if (!isNaN(day) && monthIdx !== -1 && !isNaN(year)) {
      return `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    const numM = parseInt(monthStr, 10);
    if (!isNaN(day) && !isNaN(numM) && numM >= 1 && numM <= 12 && !isNaN(year)) {
      return `${year}-${String(numM).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  return str;
}

// Expose globally for legacy scripts and interoperability
if (typeof window !== 'undefined') {
  window.formatAppDate = formatAppDate;
  window.parseAppDate = parseAppDate;
}

export function getFinancialYear() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed: 0=Jan, 11=Dec
  const startYear = currentMonth >= 3 ? currentYear : currentYear - 1;
  const endYear = (startYear + 1) % 100;
  return `${startYear}-${String(endYear).padStart(2, '0')}`;
}

export function parseDate(str) {
  if (!str) return new Date(0);
  const s = String(str).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, mo, da] = s.split('-').map(Number);
    return new Date(y, mo - 1, da);
  }
  const parts = s.split(/[-/]/);
  if (parts.length === 3) {
    let y, m, d;
    if (parts[0].trim().length === 4) {
      // YYYY-MM-DD
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10) - 1;
      d = parseInt(parts[2], 10);
    } else {
      // DD-MMM-YYYY or DD/MMM/YYYY or DD/MM/YYYY
      d = parseInt(parts[0], 10);
      const mStr = parts[1].trim().toLowerCase();
      const monthIdx = MONTHS.findIndex((mo) => mo.toLowerCase() === mStr);
      if (monthIdx !== -1) {
        m = monthIdx;
      } else {
        m = parseInt(parts[1], 10) - 1;
      }
      y = parseInt(parts[2], 10);
    }
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const dateObj = new Date(y, m, d);
      if (!isNaN(dateObj.getTime())) return dateObj;
    }
  }
  const t = new Date(s);
  if (!isNaN(t.getTime())) return t;
  return new Date(0);
}

export function fmtDate(str) {
  return formatAppDate(str, false);
}

export function isValidDueDate(str) {
  if (!str) return false;
  if (str.startsWith('0001-01-01')) return false;
  const d = parseDate(str);
  return d.getTime() !== 0;
}

export function getDueDate(r, offsetDays = 15) {
  if (r && isValidDueDate(r.dueDate)) {
    return r.dueDate.split('T')[0];
  }
  const dateStr = r ? (r.date || r.challanDate || r.invoiceDate) : '';
  const d = parseDate(dateStr);
  if (d.getTime() === 0) return '';
  const due = new Date(d);
  due.setDate(due.getDate() + offsetDays);
  return due.toISOString().split('T')[0];
}

export function fmtDue(str) {
  if (!str) return '';
  const formatted = formatAppDate(str, false);
  if (formatted === '—') return '';
  return 'Due on ' + formatted;
}

export function isDocumentOverdue(doc) {
  if (!doc) return false;
  const rawStatus = (doc.rawStatus || doc.status || '').toLowerCase().trim();
  if (rawStatus === 'paid' || doc.isPaid === true) return false;

  const total = parseFloat(doc.totalAmount || doc.amount || 0);
  let paid = doc.isPaid ? total : 0;
  if (!doc.isPaid) {
    let p = doc.paidAmount;
    if (p === undefined && doc.fullData) {
      try {
        const fd = typeof doc.fullData === 'string' ? JSON.parse(doc.fullData) : doc.fullData;
        p = fd.paidAmount ?? fd.amountPaid;
      } catch (e) {}
    }
    paid = parseFloat(p ?? doc.amountPaid ?? 0);
  }
  if (paid >= total && total > 0) return false;

  const dueStr = getDueDate(doc, 15);
  if (!dueStr) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = parseDate(dueStr);
  due.setHours(0, 0, 0, 0);
  return due.getTime() !== 0 && today >= due;
}

export function isInvoiceOverdue(doc) {
  return isDocumentOverdue(doc);
}

export function getDocumentPaymentStatus(doc) {
  if (!doc) {
    return {
      status: 'Due',
      paidAmount: 0,
      outstandingAmount: 0,
      isPaid: false,
      isOverdue: false,
      isDue: true,
      dueDate: ''
    };
  }

  const total = parseFloat(doc.totalAmount || doc.amount || 0);
  const rawStatus = (doc.rawStatus || doc.status || '').toLowerCase().trim();
  const isExplicitPaid = rawStatus === 'paid' || doc.isPaid === true;

  let paid = 0;
  if (isExplicitPaid) {
    paid = total;
  } else {
    let p = doc.paidAmount;
    if (p === undefined && doc.fullData) {
      try {
        const fd = typeof doc.fullData === 'string' ? JSON.parse(doc.fullData) : doc.fullData;
        p = fd.paidAmount ?? fd.amountPaid;
      } catch (e) {}
    }
    paid = parseFloat(p ?? doc.amountPaid ?? 0);
  }

  const outstanding = Math.max(0, total - paid);
  const dueDate = getDueDate(doc, 15);

  if (outstanding <= 0.001 || (paid >= total && total > 0) || isExplicitPaid) {
    return {
      status: 'Paid',
      paidAmount: total,
      outstandingAmount: 0,
      isPaid: true,
      isOverdue: false,
      isDue: false,
      dueDate
    };
  }

  // There is an outstanding amount
  const overdue = isDocumentOverdue(doc);

  return {
    status: overdue ? 'Overdue' : 'Due',
    paidAmount: paid,
    outstandingAmount: outstanding,
    isPaid: false,
    isOverdue: overdue,
    isDue: !overdue,
    dueDate
  };
}

export function getInvoicePaymentStatus(doc) {
  return getDocumentPaymentStatus(doc);
}

export function isOverdue(doc) {
  return isDocumentOverdue(doc);
}

export function resolvedStatus(doc) {
  if (!doc) return 'draft';
  const raw = (doc.rawStatus || doc.status || '').toLowerCase().trim();
  if (raw === 'paid' || doc.isPaid) return 'paid';
  const payment = getDocumentPaymentStatus(doc);
  if (payment.isPaid) return 'paid';
  if (payment.isOverdue) return 'overdue';
  return 'due';
}

export function formatDraftDate(dateStr) {
  return formatAppDate(dateStr, true);
}
