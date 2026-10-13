import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import approvalService from '../../services/approvalService';
import notificationService from '../../services/notificationService';
import { formatNameFromEmail } from '../../services/userService';
import {
  invoicesApi,
  quotationsApi,
  purchaseOrdersApi,
  deliveryChallansApi,
  proformasApi,
  paymentVouchersApi
} from '../../services/api';
import { hasAnyApproveOrRejectPrivilege } from '../../services/permissionService';

function formatTimeAgo(isoString) {
  if (!isoString) return '';
  const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export default function Header({ onToggleSidebar }) {
  const { currentUser, userEmail, logout, isMainAdmin, userRole } = useAuth();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const dropdownRef = useRef(null);
  const notifRef = useRef(null);

  const rawName = (currentUser?.fullName || '').trim();
  const isEmpName = !rawName || /^EMP-\d+/i.test(rawName) || (currentUser?.employeeId && rawName.toLowerCase() === String(currentUser.employeeId).toLowerCase());
  const emailName = formatNameFromEmail(currentUser?.email || userEmail);
  const displayName = isEmpName ? (emailName || (userEmail ? userEmail.split('@')[0] : 'My Account')) : rawName;
  const avatar = displayName.charAt(0).toUpperCase();

  const canApprove = isMainAdmin || hasAnyApproveOrRejectPrivilege(currentUser);

  // Check for due / overdue documents across all modules and notify
  useEffect(() => {
    const runDueCheck = async () => {
      const modules = [
        { type: 'invoice', api: invoicesApi, storageKey: 'invox_invoices' },
        { type: 'quotation', api: quotationsApi, storageKey: 'invox_quotations' },
        { type: 'purchase_order', api: purchaseOrdersApi, storageKey: 'invox_purchase_orders' },
        { type: 'delivery_challan', api: deliveryChallansApi, storageKey: 'invox_delivery_challans' },
        { type: 'proforma', api: proformasApi, storageKey: 'invox_proforma_invoices' },
        { type: 'payment_voucher', api: paymentVouchersApi, storageKey: 'invox_payment_vouchers' }
      ];

      for (const mod of modules) {
        try {
          let items = [];
          try {
            const apiItems = await mod.api.getAll();
            if (Array.isArray(apiItems)) {
              items = apiItems;
            }
          } catch (e) {}
          if (items.length > 0) {
            notificationService.checkAndNotifyDueDocuments(items, mod.type);
          }
        } catch (e) {
          console.warn(`Error checking due ${mod.type} in Header:`, e);
        }
      }
    };
    runDueCheck();
  }, []);

  // Load in-app notifications
  useEffect(() => {
    const updateNotifs = () => {
      const list = notificationService.getNotifications(userEmail, userRole);
      setNotifications(list);
    };
    updateNotifs();
    const unsub = notificationService.subscribe(updateNotifs);
    return unsub;
  }, [userEmail, userRole]);

  // Load pending approvals count if authorized approver
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

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotifDropdownOpen(false);
      }
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const unreadNotifsCount = notifications.filter((n) => !n.read).length;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="db-topbar">
      <div className="db-topbar-left">
        <button
          className="db-hamburger"
          id="dbHamburger"
          title="Toggle Sidebar"
          onClick={onToggleSidebar}
          type="button"
        >
          <i className="fa-solid fa-bars"></i>
        </button>
        <span className="db-topbar-title">Quality SalesPro</span>
      </div>

      <div className="db-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Quick Pending Approvals Badge for Authorized Approvers */}
        {canApprove && (
          <Link
            to="/pending-approvals"
            title="View Documents Pending Approval"
            style={{
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: pendingCount > 0 ? '#fef2f2' : '#f8fafc',
              color: pendingCount > 0 ? '#b91c1c' : '#475569',
              border: `1px solid ${pendingCount > 0 ? '#fecaca' : '#e2e8f0'}`,
              borderRadius: '20px',
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: 700,
              transition: 'all 0.2s ease',
            }}
          >
            <i className="fa-solid fa-bell" style={{ color: pendingCount > 0 ? '#dc2626' : '#64748b' }}></i>
            <span>Pending Approvals:</span>
            <span
              style={{
                backgroundColor: pendingCount > 0 ? '#dc2626' : '#94a3b8',
                color: '#ffffff',
                borderRadius: '10px',
                padding: '1px 7px',
                fontSize: '11px',
                fontWeight: 800
              }}
            >
              {pendingCount}
            </span>
          </Link>
        )}

        {/* User Role Badge (Display Only - No Switch Toggle) */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              backgroundColor: isMainAdmin ? '#fef3c7' : '#e0e7ff',
              color: isMainAdmin ? '#92400e' : '#3730a3',
              border: `1px solid ${isMainAdmin ? '#fde68a' : '#c7d2fe'}`,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <i className={`fa-solid ${isMainAdmin ? 'fa-shield-halved' : 'fa-user'}`}></i>
            {isMainAdmin ? 'Main Admin' : 'Standard User'}
          </span>
        </div>

        {/* In-App Notifications Center (For All Users) */}
        <div style={{ position: 'relative' }} ref={notifRef}>
          <button
            type="button"
            onClick={() => setNotifDropdownOpen((prev) => !prev)}
            title="In-App Notifications"
            style={{
              position: 'relative',
              background: notifDropdownOpen ? '#eff6ff' : '#f8fafc',
              border: `1px solid ${notifDropdownOpen ? '#93c5fd' : '#e2e8f0'}`,
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: unreadNotifsCount > 0 ? '#4f46e5' : '#64748b',
              fontSize: '15px',
              transition: 'all 0.2s ease',
            }}
          >
            <i className="fa-solid fa-bell"></i>
            {unreadNotifsCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-3px',
                  right: '-3px',
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  borderRadius: '10px',
                  fontSize: '10px',
                  fontWeight: 800,
                  padding: '1px 5px',
                  minWidth: '16px',
                  height: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 0 0 2px #ffffff'
                }}
              >
                {unreadNotifsCount > 9 ? '9+' : unreadNotifsCount}
              </span>
            )}
          </button>

          {/* In-App Notification Dropdown Panel */}
          {notifDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                top: '120%',
                right: 0,
                width: '340px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.15)',
                zIndex: 1000,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: '#f8fafc'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '14px', color: '#0f172a' }}>Notifications</strong>
                  {unreadNotifsCount > 0 && (
                    <span style={{ fontSize: '11px', backgroundColor: '#e0e7ff', color: '#4338ca', padding: '1px 6px', borderRadius: '10px', fontWeight: 700 }}>
                      {unreadNotifsCount} new
                    </span>
                  )}
                </div>
                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={() => notificationService.markAllAsRead(userEmail, userRole)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '11px',
                      color: '#4f46e5',
                      cursor: 'pointer',
                      fontWeight: 600,
                      padding: 0
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notification Items List */}
              <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94a3b8' }}>
                    <i className="fa-regular fa-bell-slash" style={{ fontSize: '24px', marginBottom: '8px', display: 'block' }}></i>
                    <p style={{ fontSize: '13px', margin: 0 }}>No notifications yet</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => {
                        notificationService.markAsRead(n.id);
                        if (n.actionUrl) {
                          setNotifDropdownOpen(false);
                          navigate(n.actionUrl);
                        }
                      }}
                      style={{
                        padding: '12px 16px',
                        borderBottom: '1px solid #f8fafc',
                        display: 'flex',
                        gap: '12px',
                        alignItems: 'flex-start',
                        backgroundColor: n.read ? '#ffffff' : '#f8faff',
                        cursor: n.actionUrl ? 'pointer' : 'default',
                        transition: 'background-color 0.15s ease'
                      }}
                    >
                      <div style={{ marginTop: '2px', flexShrink: 0 }}>
                        {n.type === 'success' ? (
                          <i className="fa-solid fa-circle-check" style={{ color: '#16a34a', fontSize: '16px' }}></i>
                        ) : n.type === 'danger' ? (
                          <i className="fa-solid fa-circle-xmark" style={{ color: '#dc2626', fontSize: '16px' }}></i>
                        ) : n.type === 'warning' ? (
                          <i className="fa-solid fa-triangle-exclamation" style={{ color: '#d97706', fontSize: '16px' }}></i>
                        ) : (
                          <i className="fa-solid fa-circle-info" style={{ color: '#4f46e5', fontSize: '16px' }}></i>
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                          <strong style={{ fontSize: '13px', color: '#0f172a' }}>{n.title}</strong>
                          <span style={{ fontSize: '10px', color: '#94a3b8', flexShrink: 0, marginLeft: '6px' }}>
                            {formatTimeAgo(n.timestamp)}
                          </span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#475569', margin: 0, lineHeight: 1.35 }}>
                          {n.message}
                        </p>
                      </div>
                      {!n.read && (
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#4f46e5', marginTop: '6px', flexShrink: 0 }}></div>
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              {notifications.length > 0 && (
                <div
                  style={{
                    padding: '8px 16px',
                    borderTop: '1px solid #f1f5f9',
                    textAlign: 'center',
                    backgroundColor: '#fafafa'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => notificationService.clearAll(userEmail, userRole)}
                    style={{
                      background: 'none',
                      border: 'none',
                      fontSize: '11px',
                      color: '#64748b',
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Clear All Notifications
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Profile Chip */}
        <div
          className="db-profile-chip"
          id="profileChip"
          ref={dropdownRef}
          style={{ position: 'relative', cursor: 'pointer' }}
          onClick={() => setDropdownOpen((prev) => !prev)}
        >
          <div className="db-profile-avatar" id="navAvatar">
            {avatar}
          </div>
          <span className="db-profile-name" id="navUsername">
            {displayName}
          </span>
          <i className="fa-solid fa-chevron-down db-chevron"></i>

          {dropdownOpen && (
            <div
              id="profileDropdown"
              style={{
                display: 'block',
                position: 'absolute',
                top: '115%',
                right: 0,
                background: 'white',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
                width: '210px',
                zIndex: 1000,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #f1f5f9',
                  backgroundColor: '#f8fafc'
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{displayName}</div>
                <div style={{ fontSize: '11px', color: '#64748b', wordBreak: 'break-all' }}>{userEmail}</div>
                <div style={{ fontSize: '11px', marginTop: '4px', color: isMainAdmin ? '#b45309' : '#4338ca', fontWeight: 600 }}>
                  Role: {userRole}
                </div>
              </div>

              {isMainAdmin && (
                <Link
                  to="/user-management"
                  onClick={() => setDropdownOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 16px',
                    color: '#0f172a',
                    textDecoration: 'none',
                    fontSize: '13px',
                    fontWeight: 500,
                    borderBottom: '1px solid #f1f5f9'
                  }}
                >
                  <i className="fa-solid fa-users-gear" style={{ color: '#6366f1' }}></i>
                  User Management
                </Link>
              )}

              <Link
                to="/update-credentials"
                onClick={() => setDropdownOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  color: '#475569',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: 500,
                  borderBottom: '1px solid #f1f5f9'
                }}
              >
                <i className="fa-solid fa-key" style={{ color: '#64748b' }}></i>
                Change Password
              </Link>

              <button
                id="logoutBtn"
                type="button"
                onClick={handleLogout}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  padding: '12px 16px',
                  cursor: 'pointer',
                  color: '#dc2626',
                  fontWeight: 600,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-solid fa-arrow-right-from-bracket"></i>
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
