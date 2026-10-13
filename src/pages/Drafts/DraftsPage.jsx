import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { formatDraftDate } from '../../utils/dateUtils';
import Modal from '../../components/common/Modal';
import Toast from '../../components/common/Toast';
import {
  invoicesApi,
  quotationsApi,
  purchaseOrdersApi,
  deliveryChallansApi,
  proformasApi
} from '../../services/api';
import { normalizeStatus, DOC_STATUS } from '../../services/approvalService';

const apiMap = {
  invoice: invoicesApi,
  proforma_invoice: proformasApi,
  quotation: quotationsApi,
  delivery_challan: deliveryChallansApi,
  purchase_order: purchaseOrdersApi
};

const fullDataKeyMap = {
  invoice: 'invox_invoice_fulldata',
  proforma_invoice: 'invox_proforma_fulldata',
  quotation: 'invox_quotation_fulldata',
  delivery_challan: 'invox_challan_fulldata',
  purchase_order: 'invox_po_fulldata'
};

export default function DraftsPage() {
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingDeleteIdx, setPendingDeleteIdx] = useState(-1);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  const showNotification = (msg) => {
    setToastMsg(msg);
    setShowToast(true);
  };

  const loadAllDrafts = async () => {
    setLoading(true);
    let serverDrafts = [];

    // 1. Fetch drafts directly from backend database across all modules
    try {
      const [invs, pros, quots, chals, pos] = await Promise.allSettled([
        invoicesApi.getAll(),
        proformasApi.getAll(),
        quotationsApi.getAll(),
        deliveryChallansApi.getAll(),
        purchaseOrdersApi.getAll()
      ]);

      const processList = (res, type) => {
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
          return res.value
            .filter((item) => normalizeStatus(item.status) === DOC_STATUS.DRAFT)
            .map((item) => ({
              id: item.id,
              invoiceNo:
                item.invoiceNumber ||
                item.proformaNumber ||
                item.quotationNumber ||
                item.challanNumber ||
                item.poNumber ||
                `DRAFT-${item.id}`,
              billedTo: item.client?.name || item.clientName || '—',
              amount: item.totalAmount
                ? `₹${parseFloat(item.totalAmount).toLocaleString('en-IN')}`
                : '',
              savedAt: item.updatedAt || item.createdAt || item.date,
              type: type,
              status: DOC_STATUS.DRAFT,
              isServer: true,
              rawItem: item
            }));
        }
        return [];
      };

      serverDrafts = [
        ...processList(invs, 'invoice'),
        ...processList(pros, 'proforma_invoice'),
        ...processList(quots, 'quotation'),
        ...processList(chals, 'delivery_challan'),
        ...processList(pos, 'purchase_order')
      ];
    } catch (e) {
      console.warn('Error fetching server drafts:', e);
    }

    // 2. Read local drafts from browser localStorage
    let localDrafts = [];
    try {
      localDrafts = JSON.parse(localStorage.getItem('invoiceDrafts') || '[]');
      if (!Array.isArray(localDrafts)) localDrafts = [];
    } catch (e) {}

    // Merge: Server drafts prioritized, plus any unsynced local drafts
    const serverNumbers = new Set(
      serverDrafts.map((d) => (d.invoiceNo || '').trim().toLowerCase())
    );

    const merged = [
      ...serverDrafts,
      ...localDrafts
        .filter(
          (ld) =>
            ld.invoiceNo &&
            !serverNumbers.has(ld.invoiceNo.trim().toLowerCase())
        )
        .map((ld) => ({ ...ld, isServer: false }))
    ];

    setDrafts(merged);
    setLoading(false);
  };

  useEffect(() => {
    loadAllDrafts();
  }, []);

  // Sync local drafts to backend database
  const handleSyncToDatabase = async () => {
    setSyncing(true);
    let syncedCount = 0;
    let failedCount = 0;

    try {
      const localDrafts = JSON.parse(localStorage.getItem('invoiceDrafts') || '[]');
      if (!Array.isArray(localDrafts) || localDrafts.length === 0) {
        showNotification('No local drafts to send.');
        setSyncing(false);
        return;
      }

      for (const draft of localDrafts) {
        if (!draft || !draft.invoiceNo) continue;
        const type = draft.type || 'invoice';
        const api = apiMap[type] || invoicesApi;
        const fdKey = fullDataKeyMap[type] || 'invox_invoice_fulldata';

        let fd = {};
        try {
          const map = JSON.parse(localStorage.getItem(fdKey) || '{}');
          fd = map[draft.invoiceNo] || {};
        } catch (e) {}

        const billedTo = fd.billedTo || { bizName: draft.billedTo || 'Unknown Client' };
        const rawAmt = draft.amount || fd.total || fd.totalAmount || 0;
        const totalAmt =
          parseFloat(String(rawAmt).replace(/[^0-9.]/g, '')) || 0;

        const items =
          Array.isArray(fd.items) && fd.items.length > 0
            ? fd.items.map((it) => ({
                itemName: it.name || it.itemName || it.description || 'Item',
                description: it.description || it.name || '',
                quantity: parseInt(it.quantity || it.qty || 1, 10) || 1,
                unitPrice: parseFloat(it.price || it.rate || it.unitPrice || 0) || 0,
                taxRate: parseFloat(it.tax || it.taxRate || 0) || 0,
                taxAmount: parseFloat(it.taxAmount || 0) || 0,
                discount: parseFloat(it.discount || 0) || 0,
                totalAmount: parseFloat(it.total || it.amount || 0) || 0
              }))
            : [
                {
                  itemName: 'Draft Item',
                  description: 'Draft item',
                  quantity: 1,
                  unitPrice: totalAmt,
                  totalAmount: totalAmt
                }
              ];

        const payload = {
          invoiceNumber: draft.invoiceNo,
          proformaNumber: draft.invoiceNo,
          quotationNumber: draft.invoiceNo,
          challanNumber: draft.invoiceNo,
          poNumber: draft.invoiceNo,
          date: fd.date || fd.challanDate || new Date().toISOString().split('T')[0],
          dueDate: fd.dueDate || fd.date || new Date().toISOString().split('T')[0],
          totalAmount: totalAmt,
          amount: totalAmt,
          status: 'Draft',
          client: {
            name: billedTo.bizName || billedTo.name || draft.billedTo || 'Unknown Client',
            gstin: billedTo.gstin || '',
            address: billedTo.address || '',
            city: billedTo.city || '',
            postal: billedTo.postal || '',
            state: billedTo.state || '',
            pan: billedTo.pan || '',
            email: billedTo.email || '',
            phone: billedTo.phone || ''
          },
          items: items,
          fullDataJson: JSON.stringify({ ...fd, invoiceNo: draft.invoiceNo, billedTo })
        };

        try {
          await api.create(payload);
          syncedCount++;
        } catch (err) {
          console.warn(`Could not sync ${draft.invoiceNo}:`, err.message);
          if (
            err.message &&
            (err.message.includes('already exists') ||
              err.message.includes('duplicate') ||
              err.message.includes('409'))
          ) {
            syncedCount++;
          } else {
            failedCount++;
          }
        }
      }

      await loadAllDrafts();
      if (syncedCount > 0) {
        showNotification(`Successfully sent ${syncedCount} draft(s) to the backend database!`);
      } else if (failedCount > 0) {
        showNotification('Some drafts could not be sent. Please check backend connection.');
      } else {
        showNotification('Drafts are already saved in the backend database.');
      }
    } catch (e) {
      showNotification('Error syncing drafts: ' + e.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (pendingDeleteIdx >= 0 && drafts[pendingDeleteIdx]) {
      const target = drafts[pendingDeleteIdx];

      // 1. If stored on backend, delete via API
      if (target.isServer && target.id) {
        try {
          const api = apiMap[target.type] || invoicesApi;
          await api.delete(target.id);
        } catch (e) {
          console.warn('Error deleting draft from backend:', e);
        }
      }

      // 2. Clear from local storage
      try {
        const currentDrafts = JSON.parse(localStorage.getItem('invoiceDrafts') || '[]');
        const filtered = currentDrafts.filter(
          (d) => (d.invoiceNo || '').toLowerCase() !== (target.invoiceNo || '').toLowerCase()
        );
        localStorage.setItem('invoiceDrafts', JSON.stringify(filtered));
      } catch (e) {
        console.error(e);
      }

      showNotification(`Draft ${target.invoiceNo || ''} deleted.`);
      await loadAllDrafts();
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
    if (type === 'quotation')
      return { label: 'Quotation', badgeClass: 'badge-quotation', icon: 'fa-file-lines' };
    if (type === 'purchase_order')
      return { label: 'Purchase Order', badgeClass: 'badge-purchase-order', icon: 'fa-cart-shopping' };
    if (type === 'delivery_challan')
      return { label: 'Delivery Challan', badgeClass: 'badge-delivery-challan', icon: 'fa-truck' };
    if (type === 'proforma_invoice')
      return { label: 'Proforma Invoice', badgeClass: 'badge-proforma-invoice', icon: 'fa-file-invoice-dollar' };
    return { label: 'Invoice', badgeClass: 'badge-invoice', icon: 'fa-file-invoice' };
  };

  const pendingDraftDocNo =
    pendingDeleteIdx >= 0 && drafts[pendingDeleteIdx]
      ? drafts[pendingDeleteIdx].invoiceNo || 'Untitled Draft'
      : '';

  const unsyncedCount = drafts.filter((d) => !d.isServer).length;

  return (
    <div className="db-content">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
        <div>
          <h1 className="db-page-title" style={{ margin: 0 }}>
            Drafts
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px', margin: '4px 0 0 0' }}>
            Manage and sync all drafts for Invoices, Quotations, Purchase Orders, Delivery Challans, and Proforma Invoices with the database.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={handleSyncToDatabase}
            disabled={syncing}
            className="db-action-btn"
            style={{
              backgroundColor: '#6366f1',
              color: '#fff',
              border: 'none',
              cursor: syncing ? 'not-allowed' : 'pointer'
            }}
            title="Send all unsynced local drafts to the backend database"
          >
            <i className={`fa-solid ${syncing ? 'fa-spinner fa-spin' : 'fa-cloud-arrow-up'}`}></i>{' '}
            {syncing ? 'Sending to Database...' : 'Send Drafts to Database'}
          </button>
          <Link to="/dashboard" className="db-action-btn" style={{ textDecoration: 'none' }}>
            <i className="fa-solid fa-arrow-left"></i> Back to Dashboard
          </Link>
        </div>
      </div>

      {/* Main Drafts Card */}
      <div className="db-grid db-grid-full" id="drafts">
        <div className="db-card db-drafts-card">
          <div className="db-drafts-header">
            <div>
              <h3 className="db-card-title">Document Drafts</h3>
              <p className="db-card-desc">
                Pick up where you left off. Drafts are safely stored and synced with the backend database.
                {unsyncedCount > 0 && (
                  <span
                    style={{
                      marginLeft: '8px',
                      color: '#d97706',
                      fontWeight: 600
                    }}
                  >
                    ({unsyncedCount} draft{unsyncedCount > 1 ? 's' : ''} ready to sync)
                  </span>
                )}
              </p>
            </div>
            <Link to="/invoices/new" className="db-action-btn db-action-sm">
              <i className="fa-solid fa-plus"></i> New Draft
            </Link>
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
              <i className="fa-solid fa-spinner fa-spin fa-2x"></i>
              <p style={{ marginTop: '12px' }}>Loading drafts from database...</p>
            </div>
          ) : drafts.length === 0 ? (
            <div id="dbDraftsEmpty" className="db-drafts-empty">
              <i className="fa-regular fa-floppy-disk fa-2x"></i>
              <p>
                No drafts found in database or local storage. Click <strong>Save Draft</strong> in the document editor to create one.
              </p>
            </div>
          ) : (
            <div id="dbDraftsList">
              {drafts.map((d, index) => {
                const typeDetails = getDraftTypeDetails(d.type);
                const draftDocNo = d.invoiceNo || 'Untitled Draft';
                const draftClient = d.billedTo || '—';
                const draftDate = formatDraftDate(d.savedAt || d.date || d.updatedAt);
                const draftAmount =
                  d.amount ||
                  (d.total ? `₹${parseFloat(d.total).toLocaleString('en-IN')}` : '');

                return (
                  <div className="db-draft-row" key={d.id || d.invoiceNo || index}>
                    <div className="db-draft-info">
                      <div className="db-draft-icon">
                        <i className={`fa-solid ${typeDetails.icon || 'fa-file-invoice'}`}></i>
                      </div>
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <span className="db-draft-name">{draftDocNo}</span>
                          {d.isServer ? (
                            <span
                              style={{
                                fontSize: '11px',
                                background: '#dcfce7',
                                color: '#15803d',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Synced and saved in database"
                            >
                              <i className="fa-solid fa-cloud"></i> In Database
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: '11px',
                                background: '#fef3c7',
                                color: '#b45309',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                              title="Stored in local browser, click 'Send Drafts to Database' to sync"
                            >
                              <i className="fa-solid fa-laptop"></i> Local
                            </span>
                          )}
                        </div>
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
                      <button
                        type="button"
                        className="db-draft-del"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          padding: '6px 8px',
                          borderRadius: '6px',
                          fontSize: '14px',
                          transition: 'background 0.15s'
                        }}
                        title="Delete draft"
                        onClick={() => {
                          setPendingDeleteIdx(index);
                          setDeleteModalOpen(true);
                        }}
                      >
                        <i className="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModalOpen}
        title="Delete Draft"
        onClose={() => {
          setDeleteModalOpen(false);
          setPendingDeleteIdx(-1);
        }}
      >
        <p style={{ margin: '0 0 16px 0', color: '#475569' }}>
          Are you sure you want to permanently delete draft{' '}
          <strong>{pendingDraftDocNo}</strong>? This action cannot be undone.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            className="db-action-btn"
            style={{ background: '#f1f5f9', color: '#475569' }}
            onClick={() => {
              setDeleteModalOpen(false);
              setPendingDeleteIdx(-1);
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="db-action-btn"
            style={{ background: '#ef4444', color: '#fff', border: 'none' }}
            onClick={handleDeleteDraft}
          >
            Delete
          </button>
        </div>
      </Modal>

      {/* Toast Notification */}
      <Toast
        message={toastMsg}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
      />
    </div>
  );
}
