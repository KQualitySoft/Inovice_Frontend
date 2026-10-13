import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate } from '../utils/dateUtils';
import { getAllClientsAggregated } from '../utils/clientHelper';
import Modal from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import approvalService from '../services/approvalService';
import { hasAnyApproveOrRejectPrivilege } from '../services/permissionService';
import { formatNameFromEmail } from '../services/userService';
import {
  reportsApi,
  clientsApi,
  invoicesApi,
  quotationsApi,
  purchaseOrdersApi,
  deliveryChallansApi,
  proformasApi,
  paymentVouchersApi
} from '../services/api';
import { purgeLegacyMockData } from '../utils/cleanupStorage';

const getModuleStats = async (api) => {
  if (api && api.getAll) {
    try {
      const res = await api.getAll();
      if (Array.isArray(res)) {
        const count = res.length;
        const total = res.reduce((sum, item) => {
          const rawVal = item.totalAmount ?? item.amount ?? item.total ?? 0;
          const val = parseFloat(String(rawVal).replace(/[^\d.]/g, '')) || 0;
          return sum + val;
        }, 0);
        return { count, total };
      }
    } catch (e) {
      console.warn('Error querying module stats from API:', e.message);
    }
  }
  return { count: 0, total: 0 };
};

export default function Dashboard() {
  const { isMainAdmin, currentUser, userEmail, hasModuleAccess, hasActionAccess } = useAuth();
  const [activeCard, setActiveCard] = useState('invoices');

  // Pending count for authorized approvers
  const [pendingCount, setPendingCount] = useState(0);

  // Live document statistics from database
  const [docStats, setDocStats] = useState({
    invoices: { count: 0, total: 0 },
    quotations: { count: 0, total: 0 },
    purchaseOrders: { count: 0, total: 0 },
    deliveryChallans: { count: 0, total: 0 },
    proformas: { count: 0, total: 0 },
    paymentVouchers: { count: 0, total: 0 }
  });

  // Drafts state
  const [drafts, setDrafts] = useState([]);
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState(-1);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Clients state
  const [clients, setClients] = useState([]);

  const canApprove = isMainAdmin || hasAnyApproveOrRejectPrivilege(currentUser);

  // Load drafts strictly from backend database
  const loadDrafts = async () => {
    try {
      const allInvoices = await invoicesApi.getAll();
      if (Array.isArray(allInvoices)) {
        const draftInvoices = allInvoices
          .filter((d) => String(d.status || '').toLowerCase() === 'draft')
          .map((d) => ({
            id: d.id,
            invoiceNo: d.invoiceNumber || `DRAFT-${d.id}`,
            billedTo: d.client?.name || '—',
            amount: d.totalAmount ? `₹${parseFloat(d.totalAmount).toLocaleString('en-IN')}` : '',
            savedAt: d.updatedAt || d.createdAt || d.date,
            type: 'invoice'
          }));
        setDrafts(draftInvoices);
        return;
      }
    } catch (e) {}
    setDrafts([]);
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    purgeLegacyMockData();
    loadDrafts();

    async function fetchDashboardData() {
      try {
        let serverSummary = null;
        try {
          serverSummary = await reportsApi.getSummary();
        } catch (e) {
          console.warn('API error fetching reports summary on dashboard:', e);
        }

        if (serverSummary) {
          setDocStats({
            invoices: serverSummary.invoices || { count: 0, total: 0 },
            quotations: serverSummary.quotations || { count: 0, total: 0 },
            purchaseOrders: serverSummary.purchaseOrders || { count: 0, total: 0 },
            deliveryChallans: serverSummary.deliveryChallans || { count: 0, total: 0 },
            proformas: serverSummary.proformas || { count: 0, total: 0 },
            paymentVouchers: serverSummary.paymentVouchers || { count: 0, total: 0 }
          });
        } else {
          const [invStats, qtnStats, poStats, dcStats, piStats, pvStats] = await Promise.all([
            getModuleStats(invoicesApi),
            getModuleStats(quotationsApi),
            getModuleStats(purchaseOrdersApi),
            getModuleStats(deliveryChallansApi),
            getModuleStats(proformasApi),
            getModuleStats(paymentVouchersApi)
          ]);

          setDocStats({
            invoices: invStats,
            quotations: qtnStats,
            purchaseOrders: poStats,
            deliveryChallans: dcStats,
            proformas: piStats,
            paymentVouchers: pvStats
          });
        }
      } catch (err) {
        console.warn('Error computing dashboard docStats:', err);
      }

      try {
        const serverClients = await clientsApi.getAll();
        if (Array.isArray(serverClients)) {
          setClients(serverClients);
        } else {
          setClients(getAllClientsAggregated());
        }
      } catch (e) {
        setClients(getAllClientsAggregated());
      }

      if (canApprove) {
        try {
          const list = await approvalService.getPendingApprovalsAsync(currentUser);
          setPendingCount(list.length);
        } catch (e) {
          setPendingCount(0);
        }
      }
    }

    fetchDashboardData();
    window.addEventListener('invox_approvals_updated', fetchDashboardData);
    window.addEventListener('focus', fetchDashboardData);
    return () => {
      window.removeEventListener('invox_approvals_updated', fetchDashboardData);
      window.removeEventListener('focus', fetchDashboardData);
    };
  }, [canApprove, currentUser]);

  const handleDeleteDraft = () => {
    if (pendingDeleteIdx >= 0) {
      try {
        const currentDrafts = JSON.parse(localStorage.getItem('invoiceDrafts') || '[]');
        currentDrafts.splice(pendingDeleteIdx, 1);
        localStorage.setItem('invoiceDrafts', JSON.stringify(currentDrafts));
        setDrafts(currentDrafts);
      } catch (e) {
        console.error(e);
      }
    }
    setDeleteModalOpen(false);
    setPendingDeleteIdx(-1);
  };

  const getDraftEditRoute = (d) => {
    const editParam = encodeURIComponent(d.id || d.invoiceNo || '');
    if (d.type === 'quotation') return `/quotations/new?edit=${editParam}`;
    if (d.type === 'purchase_order') return `/purchase-orders/new?edit=${editParam}`;
    if (d.type === 'delivery_challan') return `/delivery-challan/new?edit=${editParam}`;
    if (d.type === 'proforma_invoice') return `/proforma/new?edit=${editParam}`;
    return `/invoices/new?edit=${editParam}`;
  };

  const getDraftTypeDetails = (type) => {
    if (type === 'quotation') return { label: 'Quotation', icon: 'fa-file-lines' };
    if (type === 'purchase_order') return { label: 'Purchase Order', icon: 'fa-cart-shopping' };
    if (type === 'delivery_challan') return { label: 'Delivery Challan', icon: 'fa-truck' };
    if (type === 'proforma_invoice') return { label: 'Proforma Invoice', icon: 'fa-file-invoice-dollar' };
    return { label: 'Invoice', icon: 'fa-file-invoice' };
  };

  const pendingDraftDocNo =
    pendingDeleteIdx >= 0 && drafts[pendingDeleteIdx]
      ? drafts[pendingDeleteIdx].invoiceNo || 'Untitled Draft'
      : '';

  const rawUserName = (currentUser?.fullName || '').trim();
  const isEmpName = !rawUserName || /^EMP-\d+/i.test(rawUserName) || (currentUser?.employeeId && rawUserName.toLowerCase() === String(currentUser.employeeId).toLowerCase());
  const welcomeName = isEmpName
    ? (formatNameFromEmail(currentUser?.email || userEmail) || 'User')
    : rawUserName;

  return (
    <div className="db-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <h1 className="db-page-title" style={{ margin: 0 }}>
          Welcome, {welcomeName}!
        </h1>
        <span
          style={{
            padding: '4px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '700',
            backgroundColor: isMainAdmin ? '#fef3c7' : '#e0e7ff',
            color: isMainAdmin ? '#92400e' : '#3730a3',
            border: `1px solid ${isMainAdmin ? '#fde68a' : '#c7d2fe'}`
          }}
        >
          <i className={`fa-solid ${isMainAdmin ? 'fa-shield-halved' : 'fa-user'}`} style={{ marginRight: '6px' }}></i>
          {isMainAdmin ? 'Main Administrator' : 'Standard User'}
        </span>
      </div>

      {/* Approvals Attention Banner */}
      {canApprove && pendingCount > 0 && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '12px',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '28px',
            boxShadow: '0 2px 4px rgba(220, 38, 38, 0.06)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px'
              }}
            >
              <i className="fa-solid fa-stamp"></i>
            </div>
            <div>
              <div style={{ fontWeight: 800, color: '#991b1b', fontSize: '15px' }}>
                Pending Approvals: {pendingCount}
              </div>
              <div style={{ color: '#b91c1c', fontSize: '13px' }}>
                You have {pendingCount} business document{pendingCount > 1 ? 's' : ''} waiting for your review and approval.
              </div>
            </div>
          </div>
          <Link
            to="/pending-approvals"
            style={{
              backgroundColor: '#dc2626',
              color: '#ffffff',
              textDecoration: 'none',
              padding: '8px 18px',
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: '13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            Review Documents <i className="fa-solid fa-arrow-right"></i>
          </Link>
        </div>
      )}

      {/* Admin Modules Quick Grid */}
      {isMainAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '28px' }}>
          <div className="db-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                Administration
              </div>
              <h3 style={{ margin: '4px 0 6px 0', fontSize: '18px', color: '#0f172a' }}>User Management</h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Create users, manage roles & application privileges</p>
            </div>
            <Link to="/user-management" className="db-action-btn" style={{ whiteSpace: 'nowrap' }}>
              <i className="fa-solid fa-users-gear"></i> Manage Users
            </Link>
          </div>

          <div className="db-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>
                Approval Center
              </div>
              <h3 style={{ margin: '4px 0 6px 0', fontSize: '18px', color: '#0f172a' }}>Pending Approvals</h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{pendingCount} documents currently under review</p>
            </div>
            <Link to="/pending-approvals" className="db-action-btn" style={{ whiteSpace: 'nowrap' }}>
              <i className="fa-solid fa-stamp"></i> Open Queue
            </Link>
          </div>
        </div>
      )}

      {/* ROW 1: Invoice | Quotation | Purchase Order */}
      <div className="db-grid">
        {/* Invoices Card */}
        {(isMainAdmin || hasModuleAccess('invoices')) && (
          <div
            className={`db-card center-card ${activeCard === 'invoices' ? 'active' : ''}`}
            id="invoiceCard"
            onClick={() => setActiveCard('invoices')}
          >
            <div className="db-card-icon-badge badge-purple">
              <i className="fa-solid fa-file-invoice"></i>
            </div>
            <h3 className="db-card-title">Invoices</h3>
            <div style={{ fontSize: '12px', color: '#64748b', margin: '-4px 0 10px 0' }}>
              {docStats.invoices?.count || 0} Invoices
            </div>
            {(isMainAdmin || hasActionAccess('invoices', 'create')) && (
              <Link to="/invoices/new" className="db-action-btn">
                <i className="fa-solid fa-plus"></i> Create New Invoice
              </Link>
            )}
            <Link to="/invoices" className="db-text-link">
              View All Invoices &rarr;
            </Link>
          </div>
        )}

        {/* Quotations Card */}
        {(isMainAdmin || hasModuleAccess('quotations')) && (
          <div
            className={`db-card center-card ${activeCard === 'quotation' ? 'active' : ''}`}
            id="quotation"
            onClick={() => setActiveCard('quotation')}
          >
            <div className="db-card-icon-badge badge-green">
              <i className="fa-solid fa-file-lines"></i>
            </div>
            <h3 className="db-card-title">Quotations</h3>
            <div style={{ fontSize: '12px', color: '#64748b', margin: '-4px 0 10px 0' }}>
              {docStats.quotations?.count || 0} Quotations
            </div>
            {(isMainAdmin || hasActionAccess('quotations', 'create')) && (
              <Link to="/quotations/new" className="db-action-btn">
                <i className="fa-solid fa-plus"></i> Create New Quotation
              </Link>
            )}
            <Link to="/quotations" className="db-text-link">
              View all Quotation &rarr;
            </Link>
          </div>
        )}

        {/* Purchase Order Card */}
        {(isMainAdmin || hasModuleAccess('purchase_orders')) && (
          <div
            className={`db-card center-card ${activeCard === 'purchaseOrder' ? 'active' : ''}`}
            id="purchaseOrder"
            onClick={() => setActiveCard('purchaseOrder')}
          >
            <div className="db-card-icon-badge badge-blue">
              <i className="fa-solid fa-cart-shopping"></i>
            </div>
            <h3 className="db-card-title">Purchase Order</h3>
            <div style={{ fontSize: '12px', color: '#64748b', margin: '-4px 0 10px 0' }}>
              {docStats.purchaseOrders?.count || 0} Purchase Orders
            </div>
            {(isMainAdmin || hasActionAccess('purchase_orders', 'create')) && (
              <Link to="/purchase-orders/new" className="db-action-btn">
                <i className="fa-solid fa-plus"></i> Create New Purchase Order
              </Link>
            )}
            <Link to="/purchase-orders" className="db-text-link">
              View all Purchase Orders &rarr;
            </Link>
          </div>
        )}
      </div>

      {/* ROW 2: Delivery Challan | Proforma Invoice | Payment Voucher */}
      <div className="db-grid" style={{ marginTop: '28px' }}>
        {/* Delivery Challan Card */}
        {(isMainAdmin || hasModuleAccess('delivery_challans')) && (
          <div
            className={`db-card center-card ${activeCard === 'delivery' ? 'active' : ''}`}
            id="delivery"
            onClick={() => setActiveCard('delivery')}
          >
            <div className="db-card-icon-badge badge-orange">
              <i className="fa-solid fa-truck"></i>
            </div>
            <h3 className="db-card-title">Delivery Challan</h3>
            <div style={{ fontSize: '12px', color: '#64748b', margin: '-4px 0 10px 0' }}>
              {docStats.deliveryChallans?.count || 0} Delivery Challans
            </div>
            {(isMainAdmin || hasActionAccess('delivery_challans', 'create')) && (
              <Link to="/delivery-challan/new" className="db-action-btn">
                <i className="fa-solid fa-plus"></i> Create Delivery Challan
              </Link>
            )}
            <Link to="/delivery-challan" className="db-text-link">
              View all Delivery Challans &rarr;
            </Link>
          </div>
        )}

        {/* Proforma Invoice Card */}
        {(isMainAdmin || hasModuleAccess('proforma_invoices')) && (
          <div
            className={`db-card center-card ${activeCard === 'proforma' ? 'active' : ''}`}
            id="proforma"
            onClick={() => setActiveCard('proforma')}
          >
            <div className="db-card-icon-badge badge-indigo">
              <i className="fa-solid fa-file-invoice-dollar"></i>
            </div>
            <h3 className="db-card-title">Proforma Invoice</h3>
            <div style={{ fontSize: '12px', color: '#64748b', margin: '-4px 0 10px 0' }}>
              {docStats.proformas?.count || 0} Proforma Invoices
            </div>
            {(isMainAdmin || hasActionAccess('proforma_invoices', 'create')) && (
              <Link to="/proforma/new" className="db-action-btn">
                <i className="fa-solid fa-plus"></i> Create Proforma Invoice
              </Link>
            )}
            <Link to="/proforma" className="db-text-link">
              View all Proforma Invoices &rarr;
            </Link>
          </div>
        )}

        {/* Payment Voucher Card */}
        {(isMainAdmin || hasModuleAccess('payment_vouchers')) && (
          <div
            className={`db-card center-card ${activeCard === 'paymentVoucher' ? 'active' : ''}`}
            id="paymentVoucher"
            onClick={() => setActiveCard('paymentVoucher')}
          >
            <div className="db-card-icon-badge badge-rose">
              <i className="fa-solid fa-credit-card"></i>
            </div>
            <h3 className="db-card-title">Payment Voucher</h3>
            <div style={{ fontSize: '12px', color: '#64748b', margin: '-4px 0 10px 0' }}>
              {docStats.paymentVouchers?.count || 0} Payment Vouchers
            </div>
            {(isMainAdmin || hasActionAccess('payment_vouchers', 'create')) && (
              <Link to="/payment-vouchers/new" className="db-action-btn">
                <i className="fa-solid fa-plus"></i> Create Payment Voucher
              </Link>
            )}
            <Link to="/payment-vouchers" className="db-text-link">
              View all Payment Vouchers &rarr;
            </Link>
          </div>
        )}

        {/* Clients Card */}
        {(isMainAdmin || hasModuleAccess('clients')) && (
          <div
            className={`db-card center-card ${activeCard === 'clients' ? 'active' : ''}`}
            id="clients"
            onClick={() => setActiveCard('clients')}
          >
            <div className="db-card-icon-badge badge-teal">
              <i className="fa-solid fa-user-group"></i>
            </div>
            <h3 className="db-card-title">Customers</h3>
            <div style={{ fontSize: '12px', color: '#64748b', margin: '-4px 0 10px 0' }}>
              {clients.length} Customers
            </div>
            <Link to="/clients" className="db-text-link" style={{ marginTop: '12px' }}>
              View All Customers &rarr;
            </Link>
          </div>
        )}
      </div>

      {/* ROW 3: Drafts (full width) */}
      <div className="db-grid db-grid-full" style={{ marginTop: '28px' }} id="drafts">
        <div className="db-card db-drafts-card">
          <div className="db-drafts-header">
            <div>
              <h3 className="db-card-title">Drafts</h3>
              <p className="db-card-desc">Pick up where you left off — all your unsaved documents in one place.</p>
            </div>
            {(isMainAdmin || hasActionAccess('invoices', 'create')) && (
              <Link to="/invoices/new" className="db-action-btn db-action-sm">
                <i className="fa-solid fa-plus"></i> New Draft
              </Link>
            )}
          </div>

          {drafts.length === 0 ? (
            <div id="dbDraftsEmpty" className="db-drafts-empty">
              <i className="fa-regular fa-floppy-disk fa-2x"></i>
              <p>No drafts yet. Click <strong>Save Draft</strong> in the invoice editor to save here.</p>
            </div>
          ) : (
            <div id="dbDraftsList">
              {drafts.map((d, index) => {
                const typeDetails = getDraftTypeDetails(d.type);
                const draftDocNo = d.invoiceNo || 'Untitled Draft';
                const draftClient = d.billedTo || '—';
                const draftDate = fmtDate(d.date || d.updatedAt || d.savedAt);
                const draftAmount = d.amount || (d.total ? `₹${parseFloat(d.total).toLocaleString('en-IN')}` : '');

                return (
                  <div className="db-draft-row" key={d.id || d.invoiceNo || index}>
                    <div className="db-draft-info">
                      <div className="db-draft-icon">
                        <i className={`fa-solid ${typeDetails.icon || 'fa-file-invoice'}`}></i>
                      </div>
                      <div>
                        <div className="db-draft-name">{draftDocNo}</div>
                        <div className="db-draft-sub">
                          {typeDetails.label} • {draftClient} • Saved {draftDate}
                        </div>
                      </div>
                    </div>
                    <div className="db-draft-right">
                      {draftAmount && <div className="db-draft-amount">{draftAmount}</div>}
                      <Link to={getDraftEditRoute(d)} className="db-draft-edit">
                        Resume
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
