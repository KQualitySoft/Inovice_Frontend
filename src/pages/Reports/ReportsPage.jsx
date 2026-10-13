import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { STORAGE_KEYS } from '../../services/approvalService';
import { reportsApi } from '../../services/api';

export default function ReportsPage() {
  const { hasModuleAccess, isMainAdmin } = useAuth();
  const [stats, setStats] = useState({
    invoices: { count: 0, total: 0 },
    quotations: { count: 0, total: 0 },
    purchaseOrders: { count: 0, total: 0 },
    deliveryChallans: { count: 0, total: 0 },
    proformas: { count: 0, total: 0 },
    paymentVouchers: { count: 0, total: 0 }
  });

  useEffect(() => {
    async function fetchReports() {
      let serverSummary = null;
      try {
        serverSummary = await reportsApi.getSummary();
      } catch (err) {
        console.warn('Backend reports API unavailable, using local cache:', err);
      }

      if (serverSummary) {
        setStats({
          invoices: serverSummary.invoices || { count: 0, total: 0 },
          quotations: serverSummary.quotations || { count: 0, total: 0 },
          purchaseOrders: serverSummary.purchaseOrders || { count: 0, total: 0 },
          deliveryChallans: serverSummary.deliveryChallans || { count: 0, total: 0 },
          proformas: serverSummary.proformas || { count: 0, total: 0 },
          paymentVouchers: serverSummary.paymentVouchers || { count: 0, total: 0 }
        });
      } else {
        setStats({
          invoices: { count: 0, total: 0 },
          quotations: { count: 0, total: 0 },
          purchaseOrders: { count: 0, total: 0 },
          deliveryChallans: { count: 0, total: 0 },
          proformas: { count: 0, total: 0 },
          paymentVouchers: { count: 0, total: 0 }
        });
      }
    }

    fetchReports();
  }, []);

  if (!isMainAdmin && !hasModuleAccess('reports')) {
    return (
      <div className="db-content" style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', color: '#ef4444', marginBottom: '16px' }}>
          <i className="fa-solid fa-lock"></i>
        </div>
        <h2>Access Denied</h2>
        <p style={{ color: '#64748b' }}>You do not have privilege to view Reports.</p>
      </div>
    );
  }

  const grandTotal = stats.invoices.total + stats.quotations.total + stats.purchaseOrders.total;

  return (
    <div className="db-content" style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
          Business Reports & Analytics
        </h1>
        <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
          Summary of financial records, document issuances, and transaction volumes.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '8px' }}>
            Total Invoiced Value
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#4f46e5' }}>
            ₹{stats.invoices.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
            Across {stats.invoices.count} issued invoices
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '8px' }}>
            Quoted Pipeline Value
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#059669' }}>
            ₹{stats.quotations.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
            Across {stats.quotations.count} customer quotations
          </div>
        </div>

        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '8px' }}>
            Purchase Order Commitments
          </div>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#d97706' }}>
            ₹{stats.purchaseOrders.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
            Across {stats.purchaseOrders.count} vendor purchase orders
          </div>
        </div>
      </div>

      {/* Breakdown Table */}
      <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>
          Document Activity Summary
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
              <th style={{ padding: '12px 20px' }}>Module / Document Type</th>
              <th style={{ padding: '12px 20px', textAlign: 'center' }}>Total Issued</th>
              <th style={{ padding: '12px 20px', textAlign: 'right' }}>Total Volume (₹)</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px 20px', fontWeight: 600, color: '#1e293b' }}>
                <i className="fa-solid fa-file-invoice" style={{ color: '#6366f1', marginRight: '8px' }}></i> Invoices
              </td>
              <td style={{ padding: '12px 20px', textAlign: 'center' }}>{stats.invoices.count}</td>
              <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700 }}>
                ₹{stats.invoices.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px 20px', fontWeight: 600, color: '#1e293b' }}>
                <i className="fa-solid fa-file-lines" style={{ color: '#059669', marginRight: '8px' }}></i> Quotations
              </td>
              <td style={{ padding: '12px 20px', textAlign: 'center' }}>{stats.quotations.count}</td>
              <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700 }}>
                ₹{stats.quotations.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px 20px', fontWeight: 600, color: '#1e293b' }}>
                <i className="fa-solid fa-cart-flatbed" style={{ color: '#d97706', marginRight: '8px' }}></i> Purchase Orders
              </td>
              <td style={{ padding: '12px 20px', textAlign: 'center' }}>{stats.purchaseOrders.count}</td>
              <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700 }}>
                ₹{stats.purchaseOrders.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px 20px', fontWeight: 600, color: '#1e293b' }}>
                <i className="fa-solid fa-truck" style={{ color: '#0284c7', marginRight: '8px' }}></i> Delivery Challans
              </td>
              <td style={{ padding: '12px 20px', textAlign: 'center' }}>{stats.deliveryChallans.count}</td>
              <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700 }}>
                ₹{stats.deliveryChallans.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
              <td style={{ padding: '12px 20px', fontWeight: 600, color: '#1e293b' }}>
                <i className="fa-solid fa-money-bill-wave" style={{ color: '#8b5cf6', marginRight: '8px' }}></i> Payment Vouchers
              </td>
              <td style={{ padding: '12px 20px', textAlign: 'center' }}>{stats.paymentVouchers.count}</td>
              <td style={{ padding: '12px 20px', textAlign: 'right', fontWeight: 700 }}>
                ₹{stats.paymentVouchers.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
