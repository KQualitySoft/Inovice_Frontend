// ── Application Modules & Permissions Configuration ──

export const APP_MODULES = [
  { key: 'dashboard', label: 'Dashboard', icon: 'fa-solid fa-house', route: '/dashboard' },
  { key: 'clients', label: 'Customers / Clients', icon: 'fa-solid fa-user-tie', route: '/clients' },
  { key: 'quotations', label: 'Quotations', icon: 'fa-solid fa-file-lines', route: '/quotations', createRoute: '/quotations/new', isDocument: true },
  { key: 'invoices', label: 'Invoices', icon: 'fa-solid fa-file-invoice', route: '/invoices', createRoute: '/invoices/new', isDocument: true },
  { key: 'purchase_orders', label: 'Purchase Orders', icon: 'fa-solid fa-cart-flatbed', route: '/purchase-orders', createRoute: '/purchase-orders/new', isDocument: true },
  { key: 'delivery_challans', label: 'Delivery Challans', icon: 'fa-solid fa-truck', route: '/delivery-challan', createRoute: '/delivery-challan/new', isDocument: true },
  { key: 'proforma_invoices', label: 'Proforma Invoices', icon: 'fa-solid fa-file-waveform', route: '/proforma', createRoute: '/proforma/new', isDocument: true },
  { key: 'payment_vouchers', label: 'Payment Vouchers', icon: 'fa-solid fa-receipt', route: '/payment-vouchers', createRoute: '/payment-vouchers/new', isDocument: true }
];

export const DOCUMENT_MODULE_KEYS = [
  'invoices',
  'quotations',
  'purchase_orders',
  'delivery_challans',
  'proforma_invoices',
  'payment_vouchers'
];

export const ACTION_TYPES = [
  { key: 'view', label: 'View', badgeColor: '#3b82f6' },
  { key: 'create', label: 'Create', badgeColor: '#10b981' },
  { key: 'edit', label: 'Edit', badgeColor: '#f59e0b' },
  { key: 'submit', label: 'Submit for Approval', badgeColor: '#6366f1' },
  { key: 'approve', label: 'Approve', badgeColor: '#16a34a' },
  { key: 'reject', label: 'Reject', badgeColor: '#dc2626' }
];

export function isDocumentModule(moduleKey) {
  const norm = normalizeModuleKey(moduleKey);
  return DOCUMENT_MODULE_KEYS.includes(norm);
}

export function getSupportedActionsForModule(moduleKey) {
  const norm = normalizeModuleKey(moduleKey);
  if (DOCUMENT_MODULE_KEYS.includes(norm)) {
    return ACTION_TYPES;
  }
  if (norm === 'clients') {
    return ACTION_TYPES.filter((a) => ['view', 'create', 'edit'].includes(a.key));
  }
  // Dashboard and Reports are view-only
  return ACTION_TYPES.filter((a) => a.key === 'view');
}

// Helper to construct empty privileges object
export function createEmptyPrivileges() {
  const privs = {};
  APP_MODULES.forEach((mod) => {
    privs[mod.key] = {
      view: false,
      create: false,
      edit: false,
      submit: false,
      approve: false,
      reject: false
    };
  });
  return privs;
}

// Helper to construct full privileges object (Main Admin)
export function createFullPrivileges() {
  const privs = {};
  APP_MODULES.forEach((mod) => {
    privs[mod.key] = {
      view: true,
      create: true,
      edit: true,
      submit: true,
      approve: true,
      reject: true
    };
  });
  return privs;
}

// Default standard operational user template
export function createStandardUserPrivileges() {
  const privs = createEmptyPrivileges();
  privs.dashboard = { view: true, create: false, edit: false, submit: false, approve: false, reject: false };
  privs.clients = { view: true, create: true, edit: true, submit: false, approve: false, reject: false };
  DOCUMENT_MODULE_KEYS.forEach((key) => {
    privs[key] = { view: true, create: true, edit: true, submit: true, approve: false, reject: false };
  });
  return privs;
}

// Normalize module keys across various string representations
export function normalizeModuleKey(key) {
  if (!key) return '';
  const s = String(key).toLowerCase().trim().replace(/[-_ ]/g, '');
  if (s.includes('invoice') && !s.includes('proforma')) return 'invoices';
  if (s.includes('quotation')) return 'quotations';
  if (s.includes('purchaseorder') || s === 'po') return 'purchase_orders';
  if (s.includes('deliverychallan') || s.includes('challan') || s === 'dc') return 'delivery_challans';
  if (s.includes('proforma')) return 'proforma_invoices';
  if (s.includes('paymentvoucher') || s.includes('voucher') || s === 'pv') return 'payment_vouchers';
  if (s.includes('client') || s.includes('customer')) return 'clients';
  if (s.includes('report')) return 'reports';
  if (s.includes('dashboard') || s.includes('home')) return 'dashboard';
  return key;
}

/**
 * Check if a given user has permission for a module and action
 */
export function canUserPerform(user, moduleKey, action = 'view') {
  if (!user) return false;
  if (action === 'delete') return false;
  // MainAdmin has absolute authority across all modules & actions
  if (user.role === 'MainAdmin' || user.userRole === 'MainAdmin') return true;

  const normalizedKey = normalizeModuleKey(moduleKey);

  // Submitting for approval is an action permitted to any user who can view/create documents
  if (action === 'submit' && DOCUMENT_MODULE_KEYS.includes(normalizedKey)) {
    return true;
  }

  let userPrivs = user.privileges;
  if (!userPrivs || Object.keys(userPrivs).length === 0) {
    userPrivs = createStandardUserPrivileges();
  }
  const modPriv = userPrivs[normalizedKey];

  if (!modPriv) {
    return false;
  }
  return Boolean(modPriv[action]);
}

/**
 * Check if user can approve or reject any document module
 */
export function hasAnyApproveOrRejectPrivilege(user) {
  if (!user) return false;
  if (user.role === 'MainAdmin') return true;
  const userPrivs = user.privileges || {};
  return DOCUMENT_MODULE_KEYS.some((modKey) => {
    const mod = userPrivs[modKey];
    return mod && (mod.approve || mod.reject);
  });
}

/**
 * Get list of document module keys that user is authorized to approve/reject
 */
export function getAuthorizedApprovalModules(user) {
  if (!user) return [];
  if (user.role === 'MainAdmin') return [...DOCUMENT_MODULE_KEYS];
  const userPrivs = user.privileges || {};
  return DOCUMENT_MODULE_KEYS.filter((modKey) => {
    const mod = userPrivs[modKey];
    return mod && (mod.approve || mod.reject);
  });
}
