import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import {
  invoicesApi,
  quotationsApi,
  purchaseOrdersApi,
  proformasApi,
  deliveryChallansApi
} from '../../services/api';
import { fmtDate, getDueDate, resolvedStatus } from '../../utils/dateUtils';
import { getAllClientsAggregated } from '../../utils/clientHelper';
import Modal from '../../components/common/Modal';
import Toast from '../../components/common/Toast';
import { FIXED_BILLED_BY, normalizeCompanyName } from '../../constants/companyDetails';
import '../../styles/clients.css';

export default function ClientInvoicesPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const clientName = (searchParams.get('client') || '').trim();

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [createMenuOpen, setCreateMenuOpen] = useState(false);

  // View panel state
  const [viewDoc, setViewDoc] = useState(null);
  const [viewPanelOpen, setViewPanelOpen] = useState(false);

  // Mark Paid Modal state
  const [paidModalOpen, setPaidModalOpen] = useState(false);
  const [pendingPaidDoc, setPendingPaidDoc] = useState(null);

  // Delete Modal state
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState(null);

  // Toast
  const [toastMsg, setToastMsg] = useState('');
  const [toastIcon, setToastIcon] = useState('fa-solid fa-circle-check');
  const [showToast, setShowToast] = useState(false);

  const triggerToast = (msg, icon = 'fa-solid fa-circle-check') => {
    setToastMsg(msg);
    setToastIcon(icon);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  // Find client record for extra metadata
  const clientInfo = useMemo(() => {
    if (!clientName) return null;
    const all = getAllClientsAggregated();
    return all.find((c) => (c.bizName || '').trim().toLowerCase() === clientName.toLowerCase()) || null;
  }, [clientName]);

  const normaliseDoc = (doc, docType) => {
    const num =
      doc.invoiceNumber ||
      doc.invoiceNo ||
      doc.quotationNumber ||
      doc.challanNumber ||
      doc.poNumber ||
      doc.number ||
      doc.docNumber ||
      '—';
    const bt = doc.client ? doc.client.name || '' : doc.billedTo || doc.consignee || '';
    const date = doc.date || doc.challanDate || doc.docDate || doc.savedAt || '';
    const amt = parseFloat(doc.totalAmount ?? doc.amount) || 0;
    const status = (doc.status || 'draft').toLowerCase();

    const typeConfig = {
      invoice: {
        label: 'Invoice',
        badgeClass: 'badge-doctype-invoice',
        route: '/invoices/new',
        icon: 'fa-solid fa-file-invoice-dollar'
      },
      quotation: {
        label: 'Quotation',
        badgeClass: 'badge-doctype-quotation',
        route: '/quotations/new',
        icon: 'fa-solid fa-file-lines'
      },
      purchase_order: {
        label: 'Purchase Order',
        badgeClass: 'badge-doctype-po',
        route: '/purchase-orders/new',
        icon: 'fa-solid fa-cart-shopping'
      },
      proforma_invoice: {
        label: 'Proforma Invoice',
        badgeClass: 'badge-doctype-proforma',
        route: '/proforma/new',
        icon: 'fa-solid fa-file-invoice'
      },
      delivery_challan: {
        label: 'Delivery Challan',
        badgeClass: 'badge-doctype-challan',
        route: '/delivery-challan/new',
        icon: 'fa-solid fa-truck'
      }
    };

    const info = typeConfig[docType] || typeConfig.invoice;

    return {
      id: doc.id || num,
      docType,
      docTypeLabel: info.label,
      docTypeBadgeClass: info.badgeClass,
      docTypeIcon: info.icon,
      editRoute: info.route,
      invoiceNo: num,
      docNumber: num,
      billedTo: bt,
      date,
      dueDate: doc.dueDate || '',
      amount: amt,
      status,
      subTotal: doc.subTotal,
      cgst: doc.cgst,
      sgst: doc.sgst,
      billedBy: normalizeCompanyName((typeof doc.billedBy === 'string' ? doc.billedBy : (doc.billedBy && doc.billedBy.bizName)) || FIXED_BILLED_BY.bizName),
      refPoNo: doc.refPoNo || '',
      refDcNo: doc.refDcNo || '',
      refPiNo: doc.refPiNo || '',
      refQuotationNo: doc.refQuotationNo || '',
      raw: doc
    };
  };

  const fetchDocuments = async () => {
    setLoading(true);
    const allDocs = [];
    const seenNumbers = new Set();

    const addDocIfMatch = (rawDoc, docType) => {
      if (!rawDoc) return;
      const num = (
        rawDoc.invoiceNumber ||
        rawDoc.invoiceNo ||
        rawDoc.quotationNumber ||
        rawDoc.challanNumber ||
        rawDoc.poNumber ||
        rawDoc.number ||
        rawDoc.docNumber ||
        ''
      ).trim();
      if (!num || num === '—') return;
      if (seenNumbers.has(num)) return;

      const bt = (
        rawDoc.client?.name ||
        rawDoc.billedTo ||
        rawDoc.consignee ||
        rawDoc.fullData?.billedTo?.bizName ||
        ''
      ).trim();

      if (clientName && bt.toLowerCase() !== clientName.toLowerCase()) {
        return;
      }

      seenNumbers.add(num);
      allDocs.push(normaliseDoc(rawDoc, docType));
    };

    // 1. Invoices
    try {
      const invData = await invoicesApi.getAll();
      if (Array.isArray(invData)) {
        invData.forEach((d) => addDocIfMatch(d, 'invoice'));
      }
    } catch (e) {}
    try {
      const localInvoices = JSON.parse(localStorage.getItem('invox_invoices') || '[]');
      localInvoices.forEach((d) => addDocIfMatch(d, 'invoice'));
    } catch (e) {}
    try {
      const fullInvoices = JSON.parse(localStorage.getItem('invox_invoice_fulldata') || '{}');
      Object.values(fullInvoices).forEach((d) => addDocIfMatch(d, 'invoice'));
    } catch (e) {}

    // 2. Quotations
    try {
      const qData = await quotationsApi.getAll();
      if (Array.isArray(qData)) {
        qData.forEach((d) => addDocIfMatch(d, 'quotation'));
      }
    } catch (e) {}
    try {
      const localQuotations = JSON.parse(localStorage.getItem('invox_quotations') || '[]');
      localQuotations.forEach((d) => addDocIfMatch(d, 'quotation'));
    } catch (e) {}
    try {
      const fullQuotations = JSON.parse(localStorage.getItem('invox_quotation_fulldata') || '{}');
      Object.values(fullQuotations).forEach((d) => addDocIfMatch(d, 'quotation'));
    } catch (e) {}

    // 3. Purchase Orders
    try {
      const poData = await purchaseOrdersApi.getAll();
      if (Array.isArray(poData)) {
        poData.forEach((d) => addDocIfMatch(d, 'purchase_order'));
      }
    } catch (e) {}
    try {
      const localPOs = JSON.parse(localStorage.getItem('invox_purchase_orders') || '[]');
      localPOs.forEach((d) => addDocIfMatch(d, 'purchase_order'));
    } catch (e) {}
    try {
      const fullPOs = JSON.parse(localStorage.getItem('invox_po_fulldata') || '{}');
      Object.values(fullPOs).forEach((d) => addDocIfMatch(d, 'purchase_order'));
    } catch (e) {}

    // 4. Proforma Invoices
    try {
      const piData = await proformasApi.getAll();
      if (Array.isArray(piData)) {
        piData.forEach((d) => addDocIfMatch(d, 'proforma_invoice'));
      }
    } catch (e) {}
    try {
      const localPIs = [
        ...JSON.parse(localStorage.getItem('invox_proforma_invoices') || '[]'),
        ...JSON.parse(localStorage.getItem('invox_proformas') || '[]')
      ];
      localPIs.forEach((d) => addDocIfMatch(d, 'proforma_invoice'));
    } catch (e) {}
    try {
      const fullPIs = JSON.parse(localStorage.getItem('invox_proforma_fulldata') || '{}');
      Object.values(fullPIs).forEach((d) => addDocIfMatch(d, 'proforma_invoice'));
    } catch (e) {}

    // 5. Delivery Challans
    try {
      const dcData = await deliveryChallansApi.getAll();
      if (Array.isArray(dcData)) {
        dcData.forEach((d) => addDocIfMatch(d, 'delivery_challan'));
      }
    } catch (e) {}
    try {
      const localDCs = [
        ...JSON.parse(localStorage.getItem('invox_delivery_challans') || '[]'),
        ...JSON.parse(localStorage.getItem('invox_challans') || '[]')
      ];
      localDCs.forEach((d) => addDocIfMatch(d, 'delivery_challan'));
    } catch (e) {}
    try {
      const fullDCs = JSON.parse(localStorage.getItem('invox_challan_fulldata') || '{}');
      Object.values(fullDCs).forEach((d) => addDocIfMatch(d, 'delivery_challan'));
    } catch (e) {}

    // 6. Drafts
    try {
      const drafts = JSON.parse(localStorage.getItem('invoiceDrafts') || '[]');
      drafts.forEach((d) => {
        const mappedType = d.type || 'invoice';
        addDocIfMatch(d, mappedType);
      });
    } catch (e) {}

    setDocuments(allDocs);
    setLoading(false);
  };

  useEffect(() => {
    fetchDocuments();
  }, [clientName]);

  // Statistics
  const { totalCount, paidCount, unpaidCount, totalDueAmt } = useMemo(() => {
    let paid = 0;
    let unpaid = 0;
    let due = 0;

    documents.forEach((r) => {
      const rs = resolvedStatus(r);
      const isPaid = rs === 'paid' || rs === 'approved';
      if (isPaid) {
        paid++;
      } else {
        unpaid++;
        if (r.docType === 'invoice') {
          due += r.amount || 0;
        }
      }
    });

    return {
      totalCount: documents.length,
      paidCount: paid,
      unpaidCount: unpaid,
      totalDueAmt: due
    };
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    return documents
      .filter((r) => {
        if (typeFilter !== 'all' && r.docType !== typeFilter) return false;
        if (statusFilter === 'all') return true;
        const rs = resolvedStatus(r);
        if (statusFilter === 'paid') return rs === 'paid' || rs === 'approved';
        if (statusFilter === 'unpaid') return rs === 'unpaid' || rs === 'pending approval';
        return rs === statusFilter;
      })
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [documents, typeFilter, statusFilter]);

  const handleOpenView = (doc) => {
    setViewDoc(doc);
    setViewPanelOpen(true);
  };

  const handleCloseView = () => {
    setViewPanelOpen(false);
    setViewDoc(null);
  };

  const handleConfirmMarkPaid = async () => {
    if (!pendingPaidDoc) return;
    const inv = pendingPaidDoc;
    setPaidModalOpen(false);
    handleCloseView();

    try {
      if (inv.invoiceNo && inv.invoiceNo !== '—') {
        await invoicesApi.updateStatusByNumber(inv.invoiceNo, 'Paid');
      } else if (inv.id) {
        await invoicesApi.updateStatus(inv.id, 'Paid');
      }
    } catch (e) {
      console.warn('API error marking paid, updating locally:', e);
    }

    // Sync localStorage
    try {
      const stored = JSON.parse(localStorage.getItem('invox_invoices') || '[]');
      const match = stored.find(
        (x) => String(x.id) === String(inv.id) || x.invoiceNo === inv.invoiceNo
      );
      if (match) {
        match.status = 'paid';
        localStorage.setItem('invox_invoices', JSON.stringify(stored));
      }
    } catch (e) {}

    await fetchDocuments();
    triggerToast('Invoice marked as Paid!', 'fa-solid fa-circle-check');
    setPendingPaidDoc(null);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteDoc) return;
    const doc = pendingDeleteDoc;
    setDeleteModalOpen(false);
    handleCloseView();

    // Call API if applicable
    try {
      if (doc.id && !String(doc.id).startsWith('inv_') && !String(doc.id).startsWith('cli_')) {
        if (doc.docType === 'invoice') await invoicesApi.delete(doc.id);
        else if (doc.docType === 'quotation') await quotationsApi.delete(doc.id);
        else if (doc.docType === 'purchase_order') await purchaseOrdersApi.delete(doc.id);
        else if (doc.docType === 'proforma_invoice') await proformasApi.delete(doc.id);
        else if (doc.docType === 'delivery_challan') await deliveryChallansApi.delete(doc.id);
      }
    } catch (e) {
      console.warn('API delete error, deleting locally:', e);
    }

    // Sync localStorage across stores
    const removeStoreItem = (storeKey, fullDataKey) => {
      try {
        const stored = JSON.parse(localStorage.getItem(storeKey) || '[]');
        const filtered = stored.filter(
          (x) =>
            String(x.id) !== String(doc.id) &&
            (x.invoiceNo || x.number || x.quotationNumber || x.challanNumber || x.poNumber) !== doc.docNumber
        );
        localStorage.setItem(storeKey, JSON.stringify(filtered));
      } catch (e) {}

      if (fullDataKey) {
        try {
          const fullMap = JSON.parse(localStorage.getItem(fullDataKey) || '{}');
          delete fullMap[doc.docNumber];
          localStorage.setItem(fullDataKey, JSON.stringify(fullMap));
        } catch (e) {}
      }
    };

    if (doc.docType === 'invoice') removeStoreItem('invox_invoices', 'invox_invoice_fulldata');
    else if (doc.docType === 'quotation') removeStoreItem('invox_quotations', 'invox_quotation_fulldata');
    else if (doc.docType === 'purchase_order') removeStoreItem('invox_purchase_orders', 'invox_po_fulldata');
    else if (doc.docType === 'proforma_invoice') {
      removeStoreItem('invox_proforma_invoices', 'invox_proforma_fulldata');
      removeStoreItem('invox_proformas', 'invox_proforma_fulldata');
    } else if (doc.docType === 'delivery_challan') {
      removeStoreItem('invox_delivery_challans', 'invox_challan_fulldata');
      removeStoreItem('invox_challans', 'invox_challan_fulldata');
    }

    // Clear from invoiceDrafts
    try {
      const drafts = JSON.parse(localStorage.getItem('invoiceDrafts') || '[]');
      const filteredDrafts = drafts.filter(
        (d) => String(d.id) !== String(doc.id) && d.invoiceNo !== doc.docNumber
      );
      localStorage.setItem('invoiceDrafts', JSON.stringify(filteredDrafts));
    } catch (e) {}

    await fetchDocuments();
    triggerToast(`${doc.docTypeLabel} deleted.`, 'fa-solid fa-trash');
    setPendingDeleteDoc(null);
  };

  const avatarLetter = clientName ? clientName.charAt(0).toUpperCase() : '?';

  return (
    <div className="ci-page" style={{ padding: '28px 32px', flex: 1, maxWidth: '1100px' }}>
      {/* Breadcrumb */}
      <div className="ci-breadcrumb">
        <Link to="/clients">
          <i className="fa-solid fa-arrow-left"></i> Clients
        </Link>
        <span className="sep">›</span>
        <span>{clientName || 'Client'}</span>
      </div>

      {/* Top bar */}
      <div className="ci-topbar">
        <div className="ci-client-row">
          <div className="ci-avatar">{avatarLetter}</div>
          <div>
            <div className="ci-client-name">{clientName || 'Unknown Client'}</div>
            <div className="ci-client-sub">
              {clientInfo?.gstin && <span>GSTIN: <strong>{clientInfo.gstin}</strong> · </span>}
              {documents.length > 0
                ? `${documents.length} document${documents.length !== 1 ? 's' : ''} · Total Due: ₹${totalDueAmt.toFixed(2)}`
                : 'No documents yet'}
              {clientInfo && (clientInfo.city || clientInfo.state) && (
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  {[clientInfo.address, clientInfo.city, clientInfo.state].filter(Boolean).join(', ')}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Create Document Dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn-create"
            onClick={() => setCreateMenuOpen(!createMenuOpen)}
          >
            <i className="fa-solid fa-plus"></i> Create Document <i className="fa-solid fa-chevron-down" style={{ fontSize: '11px', marginLeft: '4px' }}></i>
          </button>
          {createMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '6px',
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                zIndex: 100,
                minWidth: '200px',
                overflow: 'hidden'
              }}
            >
              <Link
                to={`/invoices/new?client=${encodeURIComponent(clientName)}`}
                className="dropdown-item"
                style={{ display: 'block', padding: '10px 16px', color: '#1e293b', textDecoration: 'none', fontSize: '13px', borderBottom: '1px solid #f1f5f9' }}
                onClick={() => setCreateMenuOpen(false)}
              >
                <i className="fa-solid fa-file-invoice-dollar" style={{ color: '#2563eb', marginRight: '8px' }}></i> New Tax Invoice
              </Link>
              <Link
                to={`/quotations/new?client=${encodeURIComponent(clientName)}`}
                className="dropdown-item"
                style={{ display: 'block', padding: '10px 16px', color: '#1e293b', textDecoration: 'none', fontSize: '13px', borderBottom: '1px solid #f1f5f9' }}
                onClick={() => setCreateMenuOpen(false)}
              >
                <i className="fa-solid fa-file-lines" style={{ color: '#7e22ce', marginRight: '8px' }}></i> New Quotation
              </Link>
              <Link
                to={`/purchase-orders/new?client=${encodeURIComponent(clientName)}`}
                className="dropdown-item"
                style={{ display: 'block', padding: '10px 16px', color: '#1e293b', textDecoration: 'none', fontSize: '13px', borderBottom: '1px solid #f1f5f9' }}
                onClick={() => setCreateMenuOpen(false)}
              >
                <i className="fa-solid fa-cart-shopping" style={{ color: '#4338ca', marginRight: '8px' }}></i> New Purchase Order
              </Link>
              <Link
                to={`/proforma/new?client=${encodeURIComponent(clientName)}`}
                className="dropdown-item"
                style={{ display: 'block', padding: '10px 16px', color: '#1e293b', textDecoration: 'none', fontSize: '13px', borderBottom: '1px solid #f1f5f9' }}
                onClick={() => setCreateMenuOpen(false)}
              >
                <i className="fa-solid fa-file-invoice" style={{ color: '#047857', marginRight: '8px' }}></i> New Proforma Invoice
              </Link>
              <Link
                to={`/delivery-challan/new?client=${encodeURIComponent(clientName)}`}
                className="dropdown-item"
                style={{ display: 'block', padding: '10px 16px', color: '#1e293b', textDecoration: 'none', fontSize: '13px' }}
                onClick={() => setCreateMenuOpen(false)}
              >
                <i className="fa-solid fa-truck" style={{ color: '#b45309', marginRight: '8px' }}></i> New Delivery Challan
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="ci-stats">
        <div className="stat-card">
          <div className="stat-icon blue">
            <i className="fa-solid fa-folder-open"></i>
          </div>
          <div className="stat-label">Total Documents</div>
          <div className="stat-value">{totalCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber">
            <i className="fa-solid fa-clock"></i>
          </div>
          <div className="stat-label">Unpaid / Pending</div>
          <div className="stat-value">{unpaidCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">
            <i className="fa-solid fa-circle-check"></i>
          </div>
          <div className="stat-label">Paid / Approved</div>
          <div className="stat-value">{paidCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red">
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div className="stat-label">Total Due (Invoices)</div>
          <div className="stat-value">₹{totalDueAmt.toFixed(2)}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="ci-toolbar">
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {/* Document Type Filter */}
          <select
            className="select-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Document Types</option>
            <option value="invoice">Invoices</option>
            <option value="quotation">Quotations</option>
            <option value="purchase_order">Purchase Orders</option>
            <option value="proforma_invoice">Proforma Invoices</option>
            <option value="delivery_challan">Delivery Challans</option>
          </select>

          {/* Status Filter */}
          <select
            className="select-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="unpaid">Unpaid / Pending</option>
            <option value="paid">Paid / Approved</option>
            <option value="draft">Draft</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>

        <div className="ci-count" style={{ padding: 0 }}>
          Showing <strong>{filteredDocuments.length}</strong> of <strong>{documents.length}</strong> documents
        </div>
      </div>

      {/* Table */}
      <div className="ci-table-wrap">
        <table className="ci-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Document No</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Due Date</th>
              <th>Status</th>
              <th style={{ textAlign: 'right', minWidth: '290px', paddingRight: '20px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocuments.map((r, i) => {
              const rs = resolvedStatus(r);
              const isPaid = rs === 'paid' || rs === 'approved';
              return (
                <tr key={r.id || r.docNumber || i}>
                  <td style={{ color: '#94a3b8', fontSize: '13px' }}>{i + 1}</td>
                  <td>
                    <span className={`badge-doctype ${r.docTypeBadgeClass}`}>
                      <i className={r.docTypeIcon} style={{ fontSize: '10px' }}></i> {r.docTypeLabel}
                    </span>
                  </td>
                  <td>
                    <span
                      className="inv-no"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleOpenView(r)}
                    >
                      {r.docNumber || '—'}
                    </span>
                  </td>
                  <td>
                    <span className="inv-date">{fmtDate(r.date)}</span>
                  </td>
                  <td className="inv-amount">
                    {r.docType === 'delivery_challan' && r.amount === 0 ? '—' : `₹${r.amount.toFixed(2)}`}
                  </td>
                  <td>
                    <span className="inv-date">{r.dueDate ? fmtDate(r.dueDate) : fmtDate(getDueDate(r, 15))}</span>
                  </td>
                  <td>
                    {rs === 'paid' ? (
                      <span className="badge-paid">
                        <i className="fa-solid fa-circle-check" style={{ fontSize: '10px' }}></i> Paid
                      </span>
                    ) : rs === 'approved' ? (
                      <span className="badge-approved">
                        <i className="fa-solid fa-check" style={{ fontSize: '10px' }}></i> Approved
                      </span>
                    ) : rs === 'pending approval' ? (
                      <span className="badge-pending">
                        <i className="fa-solid fa-hourglass-half" style={{ fontSize: '10px' }}></i> Pending
                      </span>
                    ) : rs === 'draft' ? (
                      <span className="badge-draft">
                        <i className="fa-regular fa-file" style={{ fontSize: '10px' }}></i> Draft
                      </span>
                    ) : rs === 'overdue' ? (
                      <span className="badge-overdue">
                        <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '10px' }}></i> Overdue
                      </span>
                    ) : rs === 'rejected' ? (
                      <span className="badge-rejected">
                        <i className="fa-solid fa-xmark" style={{ fontSize: '10px' }}></i> Rejected
                      </span>
                    ) : (
                      <span className="badge-unpaid">
                        <i className="fa-regular fa-clock" style={{ fontSize: '10px' }}></i> Unpaid
                      </span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap', paddingRight: '20px' }}>
                    <div className="row-actions" style={{ justifyContent: 'flex-end', display: 'inline-flex', gap: '5px' }}>
                      <button
                        type="button"
                        className="ra-btn"
                        title="View Details"
                        onClick={() => handleOpenView(r)}
                      >
                        <i className="fa-regular fa-eye"></i> View
                      </button>
                      <button
                        type="button"
                        className="ra-btn"
                        title="Open in Editor"
                        onClick={() =>
                          navigate(`${r.editRoute}?edit=${encodeURIComponent(r.docNumber)}&step=3`)
                        }
                      >
                        <i className="fa-solid fa-arrow-up-right-from-square"></i> Open
                      </button>
                      {r.docType === 'invoice' && (
                        <button
                          type="button"
                          className="ra-btn success"
                          title="Mark as Paid"
                          disabled={isPaid}
                          onClick={() => {
                            setPendingPaidDoc(r);
                            setPaidModalOpen(true);
                          }}
                        >
                          <i className="fa-regular fa-circle-check"></i>{' '}
                          {isPaid ? 'Paid' : 'Mark Paid'}
                        </button>
                      )}
                      </div>
                    </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredDocuments.length === 0 && (
          <div className="ci-empty">
            <i className="fa-regular fa-file-lines"></i>
            <p>
              {statusFilter !== 'all' || typeFilter !== 'all'
                ? 'No matching documents found with the selected filters.'
                : `No documents found for ${clientName || 'this client'}.`}
            </p>
          </div>
        )}
      </div>

      {/* Slide-out View Panel */}
      {viewPanelOpen && viewDoc && (
        <>
          <div className="view-overlay open" onClick={handleCloseView}></div>
          <div className="view-panel open">
            <div className="vp-header">
              <div className="vp-header-left">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span className={`badge-doctype ${viewDoc.docTypeBadgeClass}`}>
                    {viewDoc.docTypeLabel}
                  </span>
                </div>
                <div className="vp-title">{viewDoc.docNumber || 'Document'}</div>
                <div style={{ marginTop: '4px' }}>
                  {resolvedStatus(viewDoc) === 'paid' ? (
                    <span className="badge-paid">Paid</span>
                  ) : resolvedStatus(viewDoc) === 'approved' ? (
                    <span className="badge-approved">Approved</span>
                  ) : resolvedStatus(viewDoc) === 'pending approval' ? (
                    <span className="badge-pending">Pending Approval</span>
                  ) : resolvedStatus(viewDoc) === 'draft' ? (
                    <span className="badge-draft">Draft</span>
                  ) : resolvedStatus(viewDoc) === 'overdue' ? (
                    <span className="badge-overdue">Overdue</span>
                  ) : (
                    <span className="badge-unpaid">Unpaid</span>
                  )}
                </div>
              </div>
              <button type="button" className="vp-close" onClick={handleCloseView}>
                &#10005;
              </button>
            </div>
            <div className="vp-body">
              <div className="vp-card">
                <div className="vp-card-title">Total Amount</div>
                <div className="vp-amount-big">
                  {viewDoc.docType === 'delivery_challan' && viewDoc.amount === 0
                    ? '—'
                    : `₹${viewDoc.amount.toFixed(2)}`}
                </div>
              </div>
              <div style={{ padding: 0 }}>
                <div className="vp-row">
                  <span className="vp-label">Document Type</span>
                  <span className="vp-value">{viewDoc.docTypeLabel}</span>
                </div>
                <div className="vp-row">
                  <span className="vp-label">Document No</span>
                  <span className="vp-value">{viewDoc.docNumber || '—'}</span>
                </div>
                <div className="vp-row">
                  <span className="vp-label">Date</span>
                  <span className="vp-value">{fmtDate(viewDoc.date)}</span>
                </div>
                {viewDoc.dueDate && (
                  <div className="vp-row">
                    <span className="vp-label">Due Date</span>
                    <span className="vp-value">{fmtDate(viewDoc.dueDate)}</span>
                  </div>
                )}
                <div className="vp-row">
                  <span className="vp-label">Billed To</span>
                  <span className="vp-value">{viewDoc.billedTo || '—'}</span>
                </div>
                <div className="vp-row">
                  <span className="vp-label">Billed By</span>
                  <span className="vp-value">{normalizeCompanyName(viewDoc.billedBy || FIXED_BILLED_BY.bizName)}</span>
                </div>
                {viewDoc.refPoNo && (
                  <div className="vp-row">
                    <span className="vp-label">Ref PO No</span>
                    <span className="vp-value">{viewDoc.refPoNo}</span>
                  </div>
                )}
                {viewDoc.refDcNo && (
                  <div className="vp-row">
                    <span className="vp-label">Ref DC No</span>
                    <span className="vp-value">{viewDoc.refDcNo}</span>
                  </div>
                )}
                {viewDoc.refPiNo && (
                  <div className="vp-row">
                    <span className="vp-label">Ref PI No</span>
                    <span className="vp-value">{viewDoc.refPiNo}</span>
                  </div>
                )}
                {viewDoc.refQuotationNo && (
                  <div className="vp-row">
                    <span className="vp-label">Ref Quotation No</span>
                    <span className="vp-value">{viewDoc.refQuotationNo}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="vp-footer-actions">
              <button
                type="button"
                className="vp-btn"
                style={{ background: '#6366f1', color: '#fff', borderColor: '#6366f1' }}
                onClick={() => {
                  handleCloseView();
                  navigate(`${viewDoc.editRoute}?edit=${encodeURIComponent(viewDoc.docNumber)}&step=3`);
                }}
              >
                <i className="fa-solid fa-arrow-up-right-from-square"></i> Open in Editor
              </button>

              {viewDoc.docType === 'invoice' && (
                <button
                  type="button"
                  className="vp-btn success"
                  disabled={resolvedStatus(viewDoc) === 'paid'}
                  onClick={() => {
                    setPendingPaidDoc(viewDoc);
                    setPaidModalOpen(true);
                  }}
                >
                  <i className="fa-regular fa-circle-check"></i> Mark as Paid
                </button>
              )}

            </div>
          </div>
        </>
      )}

      {/* Mark Paid Modal */}
      <Modal
        isOpen={paidModalOpen}
        onClose={() => setPaidModalOpen(false)}
        onConfirm={handleConfirmMarkPaid}
        title="Mark as Paid"
        message={
          <p>
            Are you sure you want to mark invoice{' '}
            <strong>{pendingPaidDoc?.docNumber}</strong> as paid? This will update the client's total due amount.
          </p>
        }
        confirmText="Yes, Mark as Paid"
        confirmColor="#16a34a"
        icon="fa-solid fa-circle-check"
      />


      <Toast message={toastMsg} icon={toastIcon} show={showToast} />
    </div>
  );
}

