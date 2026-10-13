import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import userService, { formatNameFromEmail } from '../../services/userService';
import {
  APP_MODULES,
  ACTION_TYPES,
  createEmptyPrivileges,
  createFullPrivileges,
  createStandardUserPrivileges,
  getSupportedActionsForModule
} from '../../services/permissionService';
import Toast from '../../components/common/Toast';
import Modal from '../../components/common/Modal';
import { fmtDate, formatAppDate } from '../../utils/dateUtils';
import '../../styles/clients.css';

export default function UserManagementPage() {
  const { isMainAdmin, currentUser, refreshCurrentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [activities, setActivities] = useState([]);
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'activity'
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Modals state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewDetailsModalOpen, setViewDetailsModalOpen] = useState(false);
  const [resetPwdModalOpen, setResetPwdModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    employeeId: '',
    temporaryPassword: '',
    password: '',
    role: 'User',
    isActive: true,
    privileges: createStandardUserPrivileges()
  });

  const [newPassword, setNewPassword] = useState('');
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$';
    let pwd = '';
    for (let i = 0; i < 8; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  };

  const generateEmployeeId = () => {
    return 'EMP-' + Math.floor(1000 + Math.random() * 9000);
  };

  const handleRegenerateTempPassword = () => {
    const newTemp = generateTempPassword();
    setFormData((prev) => ({
      ...prev,
      temporaryPassword: newTemp,
      password: newTemp
    }));
  };

  const handleRegenerateEmpId = () => {
    const newEmpId = generateEmployeeId();
    setFormData((prev) => ({
      ...prev,
      employeeId: newEmpId
    }));
  };

  const triggerToast = (msg) => {
    setToastMsg(msg);
    setShowToast(true);
  };

  const loadData = async () => {
    try {
      const dbUsers = await userService.getUsersAsync();
      setUsers(dbUsers);
    } catch (e) {
      setUsers(userService.getUsers());
    }
    setActivities(userService.getActivityLogs());
  };

  useEffect(() => {
    loadData();
  }, []);

  if (!isMainAdmin) {
    return (
      <div className="db-content" style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '48px', color: '#ef4444', marginBottom: '16px' }}>
          <i className="fa-solid fa-lock"></i>
        </div>
        <h2>Access Denied</h2>
        <p style={{ color: '#64748b' }}>
          You do not have permission to view User Management. This module is restricted to Main Administrators.
        </p>
      </div>
    );
  }

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (u.fullName || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.employeeId || '').toLowerCase().includes(q)
    );
  });

  // Open Create Modal
  const handleOpenCreate = () => {
    const tempPass = generateTempPassword();
    const tempEmpId = generateEmployeeId();
    setFormData({
      fullName: '',
      username: '',
      email: '',
      employeeId: tempEmpId,
      temporaryPassword: tempPass,
      password: tempPass,
      role: 'User',
      isActive: true,
      privileges: createStandardUserPrivileges()
    });
    setShowTempPassword(false);
    setCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (user) => {
    setSelectedUser(user);
    setFormData({
      fullName: user.fullName || '',
      username: user.username || '',
      email: user.email || '',
      employeeId: user.employeeId || '',
      password: '',
      role: user.role || 'User',
      isActive: user.isActive !== undefined ? user.isActive : true,
      privileges: user.privileges || createStandardUserPrivileges()
    });
    setEditModalOpen(true);
  };

  // Open View Details Modal
  const handleOpenViewDetails = (user) => {
    setSelectedUser(user);
    setViewDetailsModalOpen(true);
  };

  // Open Reset Password Modal
  const handleOpenResetPwd = (user) => {
    setSelectedUser(user);
    setNewPassword('');
    setResetPwdModalOpen(true);
  };

  // Handle Privilege Matrix Checkbox Toggle
  const handlePrivilegeToggle = (moduleKey, actionKey) => {
    setFormData((prev) => {
      const currentMod = prev.privileges[moduleKey] || {};
      return {
        ...prev,
        privileges: {
          ...prev.privileges,
          [moduleKey]: {
            ...currentMod,
            [actionKey]: !currentMod[actionKey]
          }
        }
      };
    });
  };

  // Select all supported permissions for a module
  const handleToggleAllForModule = (moduleKey) => {
    setFormData((prev) => {
      const currentMod = prev.privileges[moduleKey] || {};
      const supported = getSupportedActionsForModule(moduleKey);
      const allActive = supported.every((act) => currentMod[act.key]);
      const nextMod = { ...currentMod };
      supported.forEach((act) => {
        nextMod[act.key] = !allActive;
      });
      return {
        ...prev,
        privileges: {
          ...prev.privileges,
          [moduleKey]: nextMod
        }
      };
    });
  };

  // Quick preset buttons
  const handleApplyFullPrivileges = () => {
    setFormData((prev) => ({ ...prev, privileges: createFullPrivileges() }));
  };

  const handleApplyEmptyPrivileges = () => {
    setFormData((prev) => ({ ...prev, privileges: createEmptyPrivileges() }));
  };

  // Submit Create User
  const handleSubmitCreate = async (e) => {
    e.preventDefault();
    try {
      const email = (formData.email || '').trim();
      const employeeId = (formData.employeeId || '').trim();
      const tempPass = (formData.temporaryPassword || formData.password || '').trim();

      if (!email) {
        alert('Please enter an Email address.');
        return;
      }
      if (!employeeId) {
        alert('Please enter an Employee ID.');
        return;
      }
      if (!tempPass) {
        alert('Please enter a Temporary Password.');
        return;
      }

      const derivedName = formatNameFromEmail(email);
      const created = await userService.createUser({
        ...formData,
        fullName: (formData.fullName || '').trim() || derivedName,
        email,
        employeeId,
        password: tempPass,
        temporaryPassword: tempPass
      });
      await loadData();
      setCreateModalOpen(false);
      triggerToast(`User "${created.fullName}" created. Account details sent to ${created.email}.`);
    } catch (err) {
      alert(err.message);
    }
  };

  // Submit Edit User
  const handleSubmitEdit = (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      userService.updateUser(selectedUser.id, {
        fullName: formData.fullName,
        role: formData.role,
        isActive: formData.isActive,
        privileges: formData.role === 'MainAdmin' ? createFullPrivileges() : formData.privileges
      });
      loadData();
      refreshCurrentUser();
      setEditModalOpen(false);
      triggerToast(`User "${formData.fullName}" updated successfully.`);
    } catch (err) {
      alert(err.message);
    }
  };

  // Submit Reset Password
  const handleSubmitResetPwd = (e) => {
    e.preventDefault();
    if (!selectedUser) return;
    try {
      userService.resetPassword(selectedUser.id, newPassword);
      setResetPwdModalOpen(false);
      triggerToast(`Password reset successfully for ${selectedUser.fullName}.`);
    } catch (err) {
      alert(err.message);
    }
  };

  // Toggle User Active Status
  const handleToggleStatus = (user) => {
    try {
      const updated = userService.toggleUserStatus(user.id);
      loadData();
      triggerToast(`User ${updated.fullName} is now ${updated.isActive ? 'Active' : 'Deactivated'}.`);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="db-content" style={{ maxWidth: '100%', width: '100%', boxSizing: 'border-box', padding: '20px 24px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', margin: 0 }}>
            User Management & Privileges
          </h1>
          <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
            Manage user accounts, assign roles, define module and action privileges, and review audit activity.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenCreate}
          className="db-action-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#4f46e5',
            color: '#ffffff',
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(79, 70, 229, 0.2)'
          }}
        >
          <i className="fa-solid fa-user-plus"></i> Create New User
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'users' ? '3px solid #4f46e5' : '3px solid transparent',
            color: activeTab === 'users' ? '#4f46e5' : '#64748b',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <i className="fa-solid fa-users"></i> User Accounts ({users.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('activity')}
          style={{
            padding: '10px 18px',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'activity' ? '3px solid #4f46e5' : '3px solid transparent',
            color: activeTab === 'activity' ? '#4f46e5' : '#64748b',
            fontWeight: 700,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <i className="fa-solid fa-clock-rotate-left"></i> Activity Audit Log ({activities.length})
        </button>
      </div>

      {/* ── TAB 1: USERS LIST ── */}
      {activeTab === 'users' && (
        <div>
          {/* Controls: Search & Role Filter */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ position: 'relative', minWidth: '280px' }}>
              <i
                className="fa-solid fa-magnifying-glass"
                style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
              ></i>
              <input
                type="text"
                placeholder="Search by name, email, or username..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '9px 12px 9px 36px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Role:</span>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '13px',
                  backgroundColor: '#ffffff'
                }}
              >
                <option value="ALL">All Roles</option>
                <option value="MainAdmin">Main Admin</option>
                <option value="User">Standard User</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflowX: 'auto', WebkitOverflowScrolling: 'touch', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', width: '100%' }}>
            <table style={{ width: '100%', minWidth: '850px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                  <th style={{ padding: '12px 16px' }}>User</th>
                  <th style={{ padding: '12px 16px' }}>Employee ID / Username</th>
                  <th style={{ padding: '12px 16px' }}>Role</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Module Privileges</th>
                  <th style={{ padding: '12px 16px' }}>Last Login</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                      No user accounts found matching your filter.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    // Summarize permitted modules
                    const permittedMods = Object.keys(u.privileges || {}).filter(
                      (k) => u.privileges[k]?.view
                    );
                    const isSelf = currentUser?.id === u.id;

                    return (
                      <tr key={u.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 700, color: '#0f172a' }}>
                            {u.fullName || u.email.split('@')[0]} {isSelf && <span style={{ fontSize: '11px', color: '#4f46e5' }}>(You)</span>}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{u.email}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1e293b' }}>
                            {u.employeeId || 'EMP-0001'}
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>
                            @{u.username}
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              padding: '3px 9px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              backgroundColor: u.role === 'MainAdmin' ? '#fef3c7' : '#e0e7ff',
                              color: u.role === 'MainAdmin' ? '#b45309' : '#3730a3',
                              border: `1px solid ${u.role === 'MainAdmin' ? '#fde68a' : '#c7d2fe'}`
                            }}
                          >
                            {u.role === 'MainAdmin' ? 'Main Admin' : 'User'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span
                            style={{
                              padding: '3px 9px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: u.isActive ? '#ecfdf5' : '#fef2f2',
                              color: u.isActive ? '#059669' : '#dc2626',
                              border: `1px solid ${u.isActive ? '#a7f3d0' : '#fecaca'}`
                            }}
                          >
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', maxWidth: '300px' }}>
                          {u.role === 'MainAdmin' ? (
                            <span style={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                              <i className="fa-solid fa-check-double" style={{ marginRight: '4px' }}></i> Full Application Access
                            </span>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {permittedMods.length > 0 ? (
                                permittedMods.slice(0, 4).map((modKey) => (
                                  <span
                                    key={modKey}
                                    style={{
                                      fontSize: '11px',
                                      backgroundColor: '#f1f5f9',
                                      color: '#475569',
                                      padding: '2px 6px',
                                      borderRadius: '4px'
                                    }}
                                  >
                                    {modKey}
                                  </span>
                                ))
                              ) : (
                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>No modules assigned</span>
                              )}
                              {permittedMods.length > 4 && (
                                <span style={{ fontSize: '11px', color: '#6366f1', fontWeight: 600 }}>
                                  +{permittedMods.length - 4} more
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>
                          {u.lastLoginAt ? formatAppDate(u.lastLoginAt, true) : 'Never'}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            {/* View Details */}
                            <button
                              type="button"
                              onClick={() => handleOpenViewDetails(u)}
                              title="View User Details & Privileges"
                              style={{
                                background: '#eff6ff',
                                border: '1px solid #bfdbfe',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                fontSize: '12px',
                                color: '#2563eb',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <i className="fa-regular fa-eye"></i> View
                            </button>

                            {/* Edit */}
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(u)}
                              title="Edit User & Privileges"
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                fontSize: '12px',
                                color: '#334155',
                                cursor: 'pointer'
                              }}
                            >
                              <i className="fa-solid fa-pen-to-square"></i> Edit
                            </button>

                            {/* Reset Password */}
                            <button
                              type="button"
                              onClick={() => handleOpenResetPwd(u)}
                              title="Reset Password"
                              style={{
                                background: '#f8fafc',
                                border: '1px solid #cbd5e1',
                                borderRadius: '6px',
                                padding: '6px 10px',
                                fontSize: '12px',
                                color: '#334155',
                                cursor: 'pointer'
                              }}
                            >
                              <i className="fa-solid fa-key"></i> Reset
                            </button>

                            {/* Activate / Deactivate */}
                            {u.id !== 'usr_admin' && (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(u)}
                                title={u.isActive ? 'Deactivate User' : 'Activate User'}
                                style={{
                                  background: u.isActive ? '#fff1f2' : '#f0fdf4',
                                  border: `1px solid ${u.isActive ? '#fecdd3' : '#bbf7d0'}`,
                                  borderRadius: '6px',
                                  padding: '6px 10px',
                                  fontSize: '12px',
                                  color: u.isActive ? '#e11d48' : '#16a34a',
                                  cursor: 'pointer'
                                }}
                              >
                                <i className={`fa-solid ${u.isActive ? 'fa-user-slash' : 'fa-user-check'}`}></i>{' '}
                                {u.isActive ? 'Deactivate' : 'Activate'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 2: ACTIVITY AUDIT LOG ── */}
      {activeTab === 'activity' && (
        <div style={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', overflowX: 'auto', WebkitOverflowScrolling: 'touch', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', width: '100%' }}>
          <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 700 }}>
                <th style={{ padding: '12px 16px' }}>Timestamp</th>
                <th style={{ padding: '12px 16px' }}>User</th>
                <th style={{ padding: '12px 16px' }}>Action</th>
                <th style={{ padding: '12px 16px' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {activities.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: '32px', textAlign: 'center', color: '#94a3b8' }}>
                    No audit records recorded yet.
                  </td>
                </tr>
              ) : (
                activities.map((act) => (
                  <tr key={act.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {formatAppDate(act.timestamp, true)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{act.userName || 'System'}</div>
                      <div style={{ fontSize: '11px', color: '#64748b' }}>{act.userEmail}</div>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span
                        style={{
                          padding: '3px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor:
                            act.action.includes('Approved') || act.action.includes('Create')
                              ? '#ecfdf5'
                              : act.action.includes('Rejected')
                              ? '#fef2f2'
                              : '#f1f5f9',
                          color:
                            act.action.includes('Approved') || act.action.includes('Create')
                              ? '#065f46'
                              : act.action.includes('Rejected')
                              ? '#991b1b'
                              : '#334155'
                        }}
                      >
                        {act.action}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: '#334155' }}>
                      {act.details}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CREATE USER MODAL ── */}
      {createModalOpen && (
        <Modal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          title="Create New User Account"
          icon="fa-solid fa-user-plus"
          maxWidth="780px"
        >
          <form onSubmit={handleSubmitCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Top Info Banner */}
            <div
              style={{
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                color: '#1e40af',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <i className="fa-solid fa-circle-info"></i>
              <span>Enter the Email, Employee ID, and Temporary Password to create the user's login credentials.</span>
            </div>

            {/* Email Address & Employee ID */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 700, marginBottom: '5px', color: '#1e293b' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. employee@qualitysalespro.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                    Employee ID *
                  </label>
                  <button
                    type="button"
                    onClick={handleRegenerateEmpId}
                    style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                  >
                    <i className="fa-solid fa-arrows-rotate" style={{ marginRight: '4px' }}></i>Auto-generate
                  </button>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. EMP-1002"
                  value={formData.employeeId}
                  onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'monospace', fontWeight: 600 }}
                />
              </div>
            </div>

            {/* Temporary Password */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
                  Temporary Password *
                </label>
                <button
                  type="button"
                  onClick={handleRegenerateTempPassword}
                  style={{ background: 'none', border: 'none', color: '#4f46e5', fontSize: '11px', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  <i className="fa-solid fa-arrows-rotate" style={{ marginRight: '4px' }}></i>Generate Temporary Password
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  type={showTempPassword ? 'text' : 'password'}
                  required
                  placeholder="Enter or generate temporary password"
                  value={formData.temporaryPassword}
                  onChange={(e) => setFormData({ ...formData, temporaryPassword: e.target.value, password: e.target.value })}
                  style={{ width: '100%', padding: '9px 42px 9px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', fontFamily: 'monospace' }}
                />
                <button
                  type="button"
                  onClick={() => setShowTempPassword(!showTempPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '4px'
                  }}
                  title={showTempPassword ? 'Hide Password' : 'Show Password'}
                >
                  <i className={showTempPassword ? 'fa-solid fa-eye-slash' : 'fa-solid fa-eye'}></i>
                </button>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                The user can log in immediately using this temporary password with either their Email or Employee ID.
              </div>
            </div>

            {/* Optional Full Name & Role */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#475569' }}>
                  Full Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. John Doe (optional)"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '4px', color: '#475569' }}>
                  Role *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '13px' }}
                >
                  <option value="User">Standard User</option>
                  <option value="MainAdmin">Main Admin (Full Privileges & Approval Authority)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', color: '#334155' }}>
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <span>Account Active (user can log in immediately)</span>
              </label>
            </div>

            {/* PRIVILEGES MATRIX */}
            {formData.role !== 'MainAdmin' ? (
              <div style={{ marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                      Application & Action Privileges
                    </h4>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Control what modules this user can see and what operations they can perform.
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleApplyFullPrivileges}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyEmptyPrivileges}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'center' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                        <th style={{ textAlign: 'left', padding: '8px 12px' }}>Module</th>
                        {ACTION_TYPES.map((act) => (
                          <th key={act.key} style={{ padding: '8px 10px' }}>{act.label}</th>
                        ))}
                        <th style={{ padding: '8px 10px' }}>All</th>
                      </tr>
                    </thead>
                    <tbody>
                      {APP_MODULES.map((mod) => {
                        const modPriv = formData.privileges[mod.key] || {};
                        return (
                          <tr key={mod.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#1e293b' }}>
                              <i className={mod.icon} style={{ marginRight: '8px', color: '#6366f1', width: '16px' }}></i>
                              {mod.label}
                            </td>
                            {ACTION_TYPES.map((act) => {
                              const supported = getSupportedActionsForModule(mod.key).some((a) => a.key === act.key);
                              if (!supported) {
                                return (
                                  <td key={act.key} style={{ padding: '8px 10px', color: '#cbd5e1' }}>
                                    —
                                  </td>
                                );
                              }
                              return (
                                <td key={act.key} style={{ padding: '8px 10px' }}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(modPriv[act.key])}
                                    onChange={() => handlePrivilegeToggle(mod.key, act.key)}
                                  />
                                </td>
                              );
                            })}
                            <td style={{ padding: '8px 10px' }}>
                              <button
                                type="button"
                                onClick={() => handleToggleAllForModule(mod.key)}
                                style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                              >
                                Toggle
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ backgroundColor: '#fef3c7', padding: '12px 16px', borderRadius: '8px', color: '#92400e', fontSize: '13px' }}>
                <i className="fa-solid fa-crown" style={{ marginRight: '8px' }}></i>
                Main Admin automatically receives unrestricted access to all modules, administrative controls, and document approvals.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Create User
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── EDIT USER MODAL ── */}
      {editModalOpen && selectedUser && (
        <Modal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          title={`Edit User: ${selectedUser.fullName}`}
        >
          <form onSubmit={handleSubmitEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  disabled
                  value={formData.email}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#f1f5f9', color: '#64748b' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                  Role *
                </label>
                <select
                  value={formData.role}
                  disabled={selectedUser.id === 'usr_admin'}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff' }}
                >
                  <option value="User">Standard User</option>
                  <option value="MainAdmin">Main Admin</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                  Status
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    disabled={selectedUser.id === 'usr_admin'}
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <span>Account Active</span>
                </label>
              </div>
            </div>

            {/* PRIVILEGES MATRIX FOR EDIT */}
            {formData.role !== 'MainAdmin' ? (
              <div style={{ marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                    Application & Action Privileges
                  </h4>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleApplyFullPrivileges}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={handleApplyEmptyPrivileges}
                      style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '4px', padding: '4px 8px', fontSize: '11px', cursor: 'pointer' }}
                    >
                      Clear All
                    </button>
                  </div>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'center' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                        <th style={{ textAlign: 'left', padding: '8px 12px' }}>Module</th>
                        {ACTION_TYPES.map((act) => (
                          <th key={act.key} style={{ padding: '8px 10px' }}>{act.label}</th>
                        ))}
                        <th style={{ padding: '8px 10px' }}>All</th>
                      </tr>
                    </thead>
                    <tbody>
                      {APP_MODULES.map((mod) => {
                        const modPriv = formData.privileges[mod.key] || {};
                        return (
                          <tr key={mod.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 600, color: '#1e293b' }}>
                              <i className={mod.icon} style={{ marginRight: '8px', color: '#6366f1', width: '16px' }}></i>
                              {mod.label}
                            </td>
                            {ACTION_TYPES.map((act) => {
                              const supported = getSupportedActionsForModule(mod.key).some((a) => a.key === act.key);
                              if (!supported) {
                                return (
                                  <td key={act.key} style={{ padding: '8px 10px', color: '#cbd5e1' }}>
                                    —
                                  </td>
                                );
                              }
                              return (
                                <td key={act.key} style={{ padding: '8px 10px' }}>
                                  <input
                                    type="checkbox"
                                    checked={Boolean(modPriv[act.key])}
                                    onChange={() => handlePrivilegeToggle(mod.key, act.key)}
                                  />
                                </td>
                              );
                            })}
                            <td style={{ padding: '8px 10px' }}>
                              <button
                                type="button"
                                onClick={() => handleToggleAllForModule(mod.key)}
                                style={{ background: 'none', border: 'none', color: '#4f46e5', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
                              >
                                Toggle
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ backgroundColor: '#fef3c7', padding: '12px 16px', borderRadius: '8px', color: '#92400e', fontSize: '13px' }}>
                <i className="fa-solid fa-crown" style={{ marginRight: '8px' }}></i>
                Main Admin accounts automatically receive full privileges across all modules.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px' }}>
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── RESET PASSWORD MODAL ── */}
      {resetPwdModalOpen && selectedUser && (
        <Modal
          isOpen={resetPwdModalOpen}
          onClose={() => setResetPwdModalOpen(false)}
          title={`Reset Password: ${selectedUser.fullName}`}
        >
          <form onSubmit={handleSubmitResetPwd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
              Set a new password for <strong>{selectedUser.fullName}</strong> ({selectedUser.email}). The user will be able to log in immediately with this new password.
            </p>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px', color: '#334155' }}>
                New Password *
              </label>
              <input
                type="password"
                required
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setResetPwdModalOpen(false)}
                style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#4f46e5', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
              >
                Reset Password
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── VIEW USER DETAILS & PRIVILEGES MODAL ── */}
      {viewDetailsModalOpen && selectedUser && (
        <Modal
          isOpen={viewDetailsModalOpen}
          onClose={() => setViewDetailsModalOpen(false)}
          title={`User Details: ${selectedUser.fullName}`}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* User Profile Card */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px',
                backgroundColor: '#f8fafc',
                borderRadius: '10px',
                border: '1px solid #e2e8f0'
              }}
            >
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4338ca 100%)',
                  color: '#ffffff',
                  fontSize: '20px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}
              >
                {(selectedUser.fullName || selectedUser.username || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                    {selectedUser.fullName}
                  </h3>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: selectedUser.role === 'MainAdmin' ? '#fef3c7' : '#e0e7ff',
                      color: selectedUser.role === 'MainAdmin' ? '#b45309' : '#3730a3',
                      border: `1px solid ${selectedUser.role === 'MainAdmin' ? '#fde68a' : '#c7d2fe'}`
                    }}
                  >
                    {selectedUser.role === 'MainAdmin' ? 'Main Admin' : 'User'}
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: selectedUser.isActive ? '#ecfdf5' : '#fef2f2',
                      color: selectedUser.isActive ? '#059669' : '#dc2626',
                      border: `1px solid ${selectedUser.isActive ? '#a7f3d0' : '#fecaca'}`
                    }}
                  >
                    {selectedUser.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#4f46e5', backgroundColor: '#eef2ff', padding: '1px 6px', borderRadius: '4px', marginRight: '6px' }}>
                    {selectedUser.employeeId || 'EMP-0001'}
                  </span>
                  @{selectedUser.username} • {selectedUser.email}
                </div>
              </div>
            </div>

            {/* Account Metadata Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <div style={{ padding: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Employee ID</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b', marginTop: '2px', fontFamily: 'monospace' }}>
                  {selectedUser.employeeId || 'EMP-0001'}
                </div>
              </div>
              <div style={{ padding: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>User ID</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginTop: '2px', wordBreak: 'break-all' }}>
                  {selectedUser.id}
                </div>
              </div>
              <div style={{ padding: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Account Created</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>
                  {selectedUser.createdAt ? fmtDate(selectedUser.createdAt) : 'N/A'}
                </div>
              </div>
              <div style={{ padding: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Last Login</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#334155', marginTop: '2px' }}>
                  {selectedUser.lastLoginAt ? formatAppDate(selectedUser.lastLoginAt, true) : 'Never'}
                </div>
              </div>
            </div>

            {/* Privileges Matrix Breakdown */}
            <div>
              <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                Assigned Module & Action Privileges
              </h4>
              {selectedUser.role === 'MainAdmin' ? (
                <div style={{ padding: '14px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', fontSize: '13px' }}>
                  <i className="fa-solid fa-shield-check" style={{ marginRight: '8px', fontSize: '16px' }}></i>
                  <strong>Full Administrative Authority:</strong> Main Admin has unrestricted access to all modules, administrative controls, user management, and document approvals & rejections.
                </div>
              ) : (
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', textAlign: 'left' }}>
                        <th style={{ padding: '10px 14px' }}>Application Module</th>
                        <th style={{ padding: '10px 14px' }}>Permitted Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {APP_MODULES.map((mod) => {
                        const userPrivs = selectedUser.privileges || {};
                        const modPriv = userPrivs[mod.key] || {};
                        const supportedActions = getSupportedActionsForModule(mod.key);
                        const activeActions = supportedActions.filter((act) => Boolean(modPriv[act.key]));

                        return (
                          <tr key={mod.key} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b', width: '220px' }}>
                              <i className={mod.icon} style={{ marginRight: '8px', color: '#6366f1', width: '16px' }}></i>
                              {mod.label}
                            </td>
                            <td style={{ padding: '10px 14px' }}>
                              {activeActions.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  {activeActions.map((act) => (
                                    <span
                                      key={act.key}
                                      style={{
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        padding: '3px 8px',
                                        borderRadius: '6px',
                                        backgroundColor: act.badgeColor ? `${act.badgeColor}15` : '#f1f5f9',
                                        color: act.badgeColor || '#475569',
                                        border: `1px solid ${act.badgeColor ? `${act.badgeColor}40` : '#e2e8f0'}`
                                      }}
                                    >
                                      {act.label}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                                  No access
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setViewDetailsModalOpen(false);
                  handleOpenEdit(selectedUser);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  color: '#334155',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                <i className="fa-solid fa-pen-to-square" style={{ marginRight: '6px' }}></i> Edit Privileges
              </button>
              <button
                type="button"
                onClick={() => setViewDetailsModalOpen(false)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#4f46e5',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {showToast && <Toast message={toastMsg} onClose={() => setShowToast(false)} />}
    </div>
  );
}
