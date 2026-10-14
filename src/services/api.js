export const API_BASE = import.meta.env.VITE_API_BASE_URL !== undefined
  ? import.meta.env.VITE_API_BASE_URL
  : (import.meta.env.DEV ? 'http://localhost:5254' : '');


async function request(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const token = localStorage.getItem('invox_token') || localStorage.getItem('token');
  const { headers: customHeaders, ...restOptions } = options;
  const isFormData = restOptions.body && typeof FormData !== 'undefined' && restOptions.body instanceof FormData;
  const config = {
    ...restOptions,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(customHeaders || {}),
    },
  };

  try {
    const res = await fetch(url, config);
    if (!res.ok) {
      let errText = '';
      try {
        const errJson = await res.json();
        errText = errJson.message || errJson.error || JSON.stringify(errJson);
      } catch (e) {
        errText = await res.text();
      }
      const error = new Error(errText || `Request failed with status ${res.status}`);
      error.status = res.status;
      throw error;
    }
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await res.json();
    }
    return await res.text();
  } catch (err) {
    console.warn(`[API] Error calling ${url}:`, err.message);
    throw err;
  }
}

// ── Auth ──────────────────────────────────────────
export const authApi = {
  login: (email, password) =>
    request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  signup: (email, password) =>
    request('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),
  update: (email, newEmail, newPassword) =>
    request('/api/auth/update', {
      method: 'PUT',
      body: JSON.stringify({
        email,
        newEmail: newEmail || undefined,
        newPassword: newPassword || undefined
      })
    }),
  forgotPassword: (email) =>
    request('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    }),
  verifyResetToken: (token, email) =>
    request(`/api/auth/verify-reset-token?token=${encodeURIComponent(token)}${email ? `&email=${encodeURIComponent(email)}` : ''}`),
  resetPassword: (token, newPassword, email) =>
    request('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword, email })
    })
};

export const usersApi = {
  getAll: () => request('/api/Users'),
  getById: (id) => request(`/api/Users/${id}`),
  create: (data) => request('/api/Users', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/api/Users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  toggleStatus: (id) => request(`/api/Users/${id}/toggle-status`, { method: 'POST' }),
  resetPassword: (id, newPassword) =>
    request(`/api/Users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) })
};

// ── Invoices ──────────────────────────────────────
export const invoicesApi = {
  getAll: () => request('/api/Invoices'),
  getById: (id) => request(`/api/Invoices/${id}`),
  getByNumber: (num) => request(`/api/Invoices/bynumber/${encodeURIComponent(num)}`),
  getByClient: (name) => request(`/api/Invoices/byclient/${encodeURIComponent(name)}`),
  create: (data) => request('/api/Invoices', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id, status) =>
    request(`/api/Invoices/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateStatusByNumber: (num, status) =>
    request(`/api/Invoices/bynumber/${encodeURIComponent(num)}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  delete: (id) => request(`/api/Invoices/${id}`, { method: 'DELETE' })
};

// ── Quotations ────────────────────────────────────
export const quotationsApi = {
  getAll: () => request('/api/Quotations'),
  getById: (id) => request(`/api/Quotations/${id}`),
  getByNumber: (num) => request(`/api/Quotations/bynumber/${encodeURIComponent(num)}`),
  create: (data) => request('/api/Quotations', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id, status) =>
    request(`/api/Quotations/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateStatusByNumber: (num, status) =>
    request(`/api/Quotations/bynumber/${encodeURIComponent(num)}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  delete: (id) => request(`/api/Quotations/${id}`, { method: 'DELETE' })
};

// ── Proforma Invoices ─────────────────────────────
export const proformasApi = {
  getAll: () => request('/api/ProformaInvoices'),
  getById: (id) => request(`/api/ProformaInvoices/${id}`),
  getByNumber: (num) => request(`/api/ProformaInvoices/bynumber/${encodeURIComponent(num)}`),
  create: (data) => request('/api/ProformaInvoices', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id, status) =>
    request(`/api/ProformaInvoices/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateStatusByNumber: (num, status) =>
    request(`/api/ProformaInvoices/bynumber/${encodeURIComponent(num)}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  delete: (id) => request(`/api/ProformaInvoices/${id}`, { method: 'DELETE' })
};

// ── Delivery Challans ─────────────────────────────
export const deliveryChallansApi = {
  getAll: () => request('/api/DeliveryChallans'),
  getById: (id) => request(`/api/DeliveryChallans/${id}`),
  getByNumber: (num) => request(`/api/DeliveryChallans/bynumber/${encodeURIComponent(num)}`),
  create: (data) => request('/api/DeliveryChallans', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id, status) =>
    request(`/api/DeliveryChallans/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateStatusByNumber: (num, status) =>
    request(`/api/DeliveryChallans/bynumber/${encodeURIComponent(num)}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  delete: (id) => request(`/api/DeliveryChallans/${id}`, { method: 'DELETE' })
};

// ── Purchase Orders ───────────────────────────────
export const purchaseOrdersApi = {
  getAll: () => request('/api/PurchaseOrders'),
  getById: (id) => request(`/api/PurchaseOrders/${id}`),
  getByNumber: (num) => request(`/api/PurchaseOrders/bynumber/${encodeURIComponent(num)}`),
  create: (data) => request('/api/PurchaseOrders', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id, status) =>
    request(`/api/PurchaseOrders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateStatusByNumber: (num, status) =>
    request(`/api/PurchaseOrders/bynumber/${encodeURIComponent(num)}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  delete: (id) => request(`/api/PurchaseOrders/${id}`, { method: 'DELETE' })
};

// ── Payment Vouchers ──────────────────────────────
export const paymentVouchersApi = {
  getAll: () => request('/api/PaymentVouchers'),
  getById: (id) => request(`/api/PaymentVouchers/${id}`),
  getByNumber: (num) => request(`/api/PaymentVouchers/bynumber/${encodeURIComponent(num)}`),
  create: (data) => request('/api/PaymentVouchers', { method: 'POST', body: JSON.stringify(data) }),
  updateStatus: (id, status) =>
    request(`/api/PaymentVouchers/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  updateStatusByNumber: (num, status) =>
    request(`/api/PaymentVouchers/bynumber/${encodeURIComponent(num)}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  delete: (id) => request(`/api/PaymentVouchers/${id}`, { method: 'DELETE' })
};

// ── Clients ───────────────────────────────────────
export const clientsApi = {
  getAll: () => request('/api/Clients'),
  create: (data) => request('/api/Clients', { method: 'POST', body: JSON.stringify(data) }),
  getDashboard: (clientId = 1) => request(`/api/Clients/${clientId}/dashboard`)
};

// ── Approvals ─────────────────────────────────────
export const approvalsApi = {
  submit: (data, role = 'User') =>
    request('/api/approvals/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': role },
      body: JSON.stringify(data)
    }),
  approve: (data, role = 'MainAdmin') =>
    request('/api/approvals/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': role },
      body: JSON.stringify(data)
    }),
  reject: (data, role = 'MainAdmin') =>
    request('/api/approvals/reject', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Role': role },
      body: JSON.stringify(data)
    }),
  getHistory: (docType, docNumber) =>
    request(`/api/approvals/history/${encodeURIComponent(docType)}/${encodeURIComponent(docNumber)}`),
  getPending: () => request('/api/approvals/pending')
};

// ── Reports ───────────────────────────────────────
export const reportsApi = {
  getSummary: (userId) => request(`/api/Reports/summary${userId ? `?userId=${userId}` : ''}`)
};

export default {
  API_BASE,
  auth: authApi,
  invoices: invoicesApi,
  quotations: quotationsApi,
  proformas: proformasApi,
  deliveryChallans: deliveryChallansApi,
  purchaseOrders: purchaseOrdersApi,
  paymentVouchers: paymentVouchersApi,
  clients: clientsApi,
  approvals: approvalsApi,
  users: usersApi,
  reports: reportsApi
};
