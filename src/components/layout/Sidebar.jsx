import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import approvalService from '../../services/approvalService';
import { hasAnyApproveOrRejectPrivilege } from '../../services/permissionService';

export default function Sidebar({ collapsed }) {
  const { isMainAdmin, currentUser, hasModuleAccess } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  const canApprove = isMainAdmin || hasAnyApproveOrRejectPrivilege(currentUser);

  useEffect(() => {
    if (canApprove) {
      const updatePendingCount = async () => {
        try {
          const list = await approvalService.getPendingApprovalsAsync(currentUser);
          setPendingCount(list.length);
        } catch (e) {
          setPendingCount(0);
        }
      };
      updatePendingCount();
      const interval = setInterval(updatePendingCount, 4000);
      window.addEventListener('invox_approvals_updated', updatePendingCount);
      return () => {
        clearInterval(interval);
        window.removeEventListener('invox_approvals_updated', updatePendingCount);
      };
    }
  }, [canApprove, currentUser]);

  // Standard business modules with moduleKey mapping to permissionService
  const businessNavItems = [
    { to: '/dashboard', label: 'Home', icon: 'fa-solid fa-house', moduleKey: 'dashboard' },
    { to: '/quotations', label: 'Quotations', icon: 'fa-solid fa-file-lines', moduleKey: 'quotations' },
    { to: '/purchase-orders', label: 'Purchase Order', icon: 'fa-solid fa-cart-flatbed', moduleKey: 'purchase_orders' },
    { to: '/delivery-challan', label: 'Delivery Challan', icon: 'fa-solid fa-truck', moduleKey: 'delivery_challans' },
    { to: '/proforma', label: 'Proforma Invoice', icon: 'fa-solid fa-truck', moduleKey: 'proforma_invoices' },
    { to: '/invoices', label: 'Invoices', icon: 'fa-solid fa-file-invoice', moduleKey: 'invoices' },
    { to: '/payment-vouchers', label: 'Payment Voucher', icon: 'fa-solid fa-file-lines', moduleKey: 'payment_vouchers' },
    { to: '/clients', label: 'Customers', icon: 'fa-solid fa-user-tie', moduleKey: 'clients' },
    { to: '/drafts', label: 'Drafts', icon: 'fa-solid fa-floppy-disk', moduleKey: 'dashboard' }
  ];

  // Filter items based on user privileges
  const allowedBusinessItems = businessNavItems.filter((item) => {
    // If Main Admin, has access to everything
    if (isMainAdmin) return true;
    return hasModuleAccess(item.moduleKey);
  });

  return (
    <aside className={`db-sidebar ${collapsed ? 'collapsed' : ''}`} id="dbSidebar">
      <div className="db-brand">
        <span className="db-brand-name">Quality SalesPro</span>
      </div>

      <nav className="db-sidenav">
        {/* Approvals & Admin Dedicated Modules */}
        {(canApprove || isMainAdmin) && (
          <div style={{ marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid #e2e8f0' }}>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#64748b',
                padding: '4px 16px',
                marginBottom: '4px'
              }}
            >
              {isMainAdmin ? 'Administration' : 'Approvals'}
            </div>

            {canApprove && (
              <NavLink
                to="/pending-approvals"
                className={({ isActive }) => `db-nav-item ${isActive ? 'active' : ''}`}
                title="Pending Approvals"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', boxSizing: 'border-box' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                  <i className="fa-solid fa-stamp" style={{ color: '#f59e0b' }}></i>
                  <span style={{ whiteSpace: 'nowrap' }}>Pending Approvals</span>
                </div>
                {pendingCount > 0 && (
                  <span
                    style={{
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      borderRadius: '10px',
                      padding: '2px 7px',
                      fontSize: '10px',
                      fontWeight: 800,
                      marginRight: '6px',
                      flexShrink: 0
                    }}
                  >
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            )}

            {isMainAdmin && (
              <NavLink
                to="/user-management"
                className={({ isActive }) => `db-nav-item ${isActive ? 'active' : ''}`}
                title="User Management"
              >
                <i className="fa-solid fa-users-gear" style={{ color: '#6366f1' }}></i>
                <span>User Management</span>
              </NavLink>
            )}
          </div>
        )}

        {/* Business Modules filtered by permissions */}
        {allowedBusinessItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `db-nav-item ${isActive ? 'active' : ''}`}
            title={item.label}
          >
            <i className={item.icon}></i>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="db-sidenav-bottom">
        <NavLink
          to="/update-credentials"
          className={({ isActive }) => `db-nav-item ${isActive ? 'active' : ''}`}
          title="Account Settings"
        >
          <i className="fa-solid fa-gear"></i>
          <span>Account Settings</span>
        </NavLink>
      </div>
    </aside>
  );
}
